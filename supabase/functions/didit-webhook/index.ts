// supabase/functions/didit-webhook/index.ts
//
// Marryzen ID verification webhook (v8)
//
// Behavior (canonical, replaces ad-hoc v7 deployed source):
//
// - Accepts POST from Didit with the verification decision payload.
//   Responds 2xx as fast as possible; all credit/grant work is best-effort
//   and never blocks the webhook ack.
//
// - Marks the user `verified` when Didit returns Approved AND the name on
//   the ID document fuzzy-matches the user's self-reported full_name
//   (Levenshtein + token-prefix, threshold 0.75). If the name does not
//   match, the user stays in `pending` with `id_name_on_record` and
//   `name_match_score` set so the admin/dashboard can surface the issue.
//
// - On successful verify:
//     * If the user was referred (profiles.referred_by IS NOT NULL and
//       != self), insert a 30-day `referral_verify` credit for the
//       referrer (best-effort, idempotent via unique partial index,
//       capped to <12 referral credits per year).
//     * Insert a 30-day `referee_signup_bonus` credit for the verifying
//       user (best-effort, idempotent via unique partial index — one
//       welcome credit per user lifetime).
//     * Update referrals.status = 'completed' for the matching row.
//
// - Anti-farming (NEW in v8): the ID document is fingerprinted as
//   SHA-256(`${type}|${number}|${country}`) and stored on the profile
//   as `document_hash`. A partial unique index on
//   (document_hash WHERE is_verified) means a SECOND account trying to
//   verify with the same physical ID is rejected before flipping
//   is_verified — the second user stays `rejected` (NO credits
//   granted on either side). The status alone communicates the
//   rejection; ID name + match score on the row give the admin
//   queue enough context.
//
// - All inserts/updates use SECURITY DEFINER paths (service_role key)
//   so RLS doesn't block legitimate writes from the webhook context.
//
// - OPTIONS preflight handler responds with CORS headers so Didit's
//   webhook test UI succeeds.
//
// Idempotency: every credit insert tolerates Postgres 23505 (unique
// violation) as a no-op success. Self-referral guards are in place.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-didit-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

// ---------- Name match helpers (Levenshtein + token prefix) ----------

const NAME_MATCH_THRESHOLD = 0.80;

function normalizeTokens(name: string): string[] {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  const dp = new Array(n + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

function namesMatch(profileName: string, idName: string): { match: boolean; score: number } {
  const a = normalizeTokens(profileName);
  const b = normalizeTokens(idName);
  if (!a.length || !b.length) return { match: false, score: 0 };

  // Token-set similarity: each token in shorter array finds best fuzzy match in longer
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  let totalScore = 0;
  for (const t of shorter) {
    let best = 0;
    for (const u of longer) {
      const dist = levenshtein(t, u);
      const sim = 1 - dist / Math.max(t.length, u.length);
      if (sim > best) best = sim;
    }
    totalScore += best;
  }
  const avgScore = totalScore / shorter.length;
  return { match: avgScore >= NAME_MATCH_THRESHOLD, score: avgScore };
}

// ---------- Document hash (anti-farming) ----------

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeDocPart(s: string | undefined | null): string {
  return (s || "").toString().trim().toUpperCase().replace(/[\s\-]+/g, "");
}

async function computeDocumentHash(doc: {
  type?: string | null;
  number?: string | null;
  country?: string | null;
}): Promise<string | null> {
  // We intentionally drop document_type from the hash composition.
  // Didit's OCR sometimes returns the type and sometimes omits it; including
  // it in the hash would let the same physical doc fingerprint differently
  // on a re-verification and bypass anti-farming. number+country alone is
  // sufficient: state-issued ID numbers are unique within a country.
  const number = normalizeDocPart(doc.number);
  const country = normalizeDocPart(doc.country);
  if (!number || !country) return null;
  return await sha256Hex(`${number}|${country}`);
}

// ---------- Didit payload field extractors (defensive) ----------

function extractDocumentFields(payload: Record<string, unknown>): {
  type?: string | null;
  number?: string | null;
  country?: string | null;
} {
  // Didit field names vary; try the documented paths in order.
  // decision.id_verification.{document_number, document_type, issuing_country}
  // OR top-level kyc.{document_number, ...}
  // OR features.id_verification.{...}
  const tryPaths = [
    ["decision", "id_verification"],
    ["features", "id_verification"],
    ["kyc"],
    ["id_verification"],
  ];
  for (const path of tryPaths) {
    let node: any = payload;
    for (const p of path) node = node?.[p];
    if (node && typeof node === "object") {
      const number = node.document_number ?? node.documentNumber ?? node.number ?? null;
      const type = node.document_type ?? node.documentType ?? node.type ?? null;
      const country = node.issuing_country ?? node.issuingCountry ?? node.country ?? null;
      if (number) return { type, number, country };
    }
  }
  return { type: null, number: null, country: null };
}

function extractIdName(payload: Record<string, unknown>): string | null {
  const tryPaths = [
    ["decision", "id_verification"],
    ["features", "id_verification"],
    ["kyc"],
  ];
  for (const path of tryPaths) {
    let node: any = payload;
    for (const p of path) node = node?.[p];
    if (!node) continue;
    const first = node.first_name ?? node.firstName ?? "";
    const last = node.last_name ?? node.lastName ?? "";
    const full = node.full_name ?? node.fullName ?? null;
    if (full) return String(full).trim() || null;
    const joined = `${first} ${last}`.trim();
    if (joined) return joined;
  }
  return null;
}

function extractStatus(payload: Record<string, unknown>): string {
  // Common: status, decision.status, kyc.status
  const candidates: any[] = [
    (payload as any).status,
    (payload as any).decision?.status,
    (payload as any).kyc?.status,
  ];
  for (const c of candidates) {
    if (typeof c === "string") return c.toLowerCase();
  }
  return "unknown";
}

function extractUserId(payload: Record<string, unknown>): string | null {
  // Marryzen stores the user_id in vendor_data when creating the session.
  // Didit echoes it back as a string (or sometimes a stringified JSON blob).
  const vd: any = (payload as any).vendor_data ?? (payload as any).vendorData;
  if (typeof vd === "string") {
    // Plain UUID
    if (/^[0-9a-f-]{32,40}$/i.test(vd.trim())) return vd.trim();
    // Stringified JSON like '{"user_id":"..."}'
    try {
      const parsed = JSON.parse(vd);
      if (parsed && typeof parsed.user_id === "string") return parsed.user_id;
    } catch (_) { /* fallthrough */ }
    // Last resort: trust the raw string
    if (vd.trim().length) return vd.trim();
  }
  if (vd && typeof vd === "object" && typeof vd.user_id === "string") return vd.user_id;
  const md: any = (payload as any).metadata;
  if (md && typeof md.user_id === "string") return md.user_id;
  return null;
}

// ---------- Helpers: credits + cap ----------

const REFERRAL_SOURCES = [
  "referral_verify",
  "referral_subscribe",
  "referral_verify_after_rename",
];

async function referrerHasCapacity(referrerId: string): Promise<boolean> {
  // 12 referral credits per rolling year
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
  const { count, error } = await supabase
    .from("premium_credits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", referrerId)
    .in("source", REFERRAL_SOURCES)
    .gte("earned_at", oneYearAgo);
  if (error) {
    console.warn("Cap check failed (allowing):", error.message);
    return true;
  }
  return (count ?? 0) < 12;
}

async function insertCredit(row: {
  user_id: string;
  source: string;
  referred_user_id: string | null;
  days: number;
}): Promise<{ ok: boolean; alreadyExisted: boolean; error?: string }> {
  const { error } = await supabase.from("premium_credits").insert(row);
  if (!error) return { ok: true, alreadyExisted: false };
  // 23505 = unique violation; means we already granted this credit. Treat as success.
  if ((error as { code?: string }).code === "23505") {
    return { ok: true, alreadyExisted: true };
  }
  return { ok: false, alreadyExisted: false, error: error.message };
}

// ---------- Main handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    console.log("didit-webhook v8: received event", JSON.stringify({
      status: extractStatus(payload),
      hasVendorData: !!extractUserId(payload),
    }));

    const userId = extractUserId(payload);
    if (!userId) {
      console.warn("No user_id in vendor_data; cannot route this webhook");
      return new Response(JSON.stringify({ ok: true, ignored: "no_user_id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = extractStatus(payload);

    // Always pull the existing profile (need referred_by, full_name, current verification state)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, full_name, referred_by, is_verified, identity_verification_status, document_hash")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) {
      console.error("Profile fetch failed:", profileErr);
      // Don't crash the webhook on a transient DB error
      return new Response(JSON.stringify({ ok: true, deferred: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!profile) {
      console.warn("No profile for user_id", userId);
      return new Response(JSON.stringify({ ok: true, ignored: "no_profile" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Non-approved decisions: mark accordingly, no credits, no hash check.
    // Didit emits "approved", "declined", "rejected", "pending", and occasionally
    // "approved_with_warnings" — treat the latter as approved (warnings are
    // typically liveness or doc-quality nits; the reviewer signed off).
    const isApproved = status === "approved" || status === "approved_with_warnings";
    if (!isApproved) {
      const target = status === "declined" || status === "rejected" ? "rejected" : "pending";
      await supabase
        .from("profiles")
        .update({ identity_verification_status: target })
        .eq("id", userId);
      return new Response(JSON.stringify({ ok: true, status: target }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Approved path: compute document hash + name match
    const docFields = extractDocumentFields(payload);
    const docHash = await computeDocumentHash(docFields);
    if (!docHash) {
      // Anti-farming silently degrades to "no dedup" if we can't extract
      // doc fields — this is intentional (we never want to drop a real
      // verification because Didit changed their payload shape), but it
      // IS a hole worth watching. Log loudly so we notice in production.
      console.error(
        "didit-webhook v8: approved event has NO extractable document fields. " +
        "Anti-farming dedup is SKIPPED for this verification. Payload top-level keys: " +
        Object.keys(payload || {}).join(",")
      );
    }
    const idName = extractIdName(payload);
    const nameCheck = idName
      ? namesMatch(profile.full_name || "", idName)
      : { match: false, score: 0 };

    // ANTI-FARMING: if another VERIFIED profile already owns this document_hash, reject this one.
    if (docHash) {
      const { data: dupe, error: dupeErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("document_hash", docHash)
        .eq("is_verified", true)
        .neq("id", userId)
        .limit(1)
        .maybeSingle();
      if (!dupeErr && dupe) {
        console.warn("Document-hash collision detected; rejecting verification for", userId);
        await supabase
          .from("profiles")
          .update({
            identity_verification_status: "rejected",
            is_verified: false,
            id_name_on_record: idName,
            name_match_score: nameCheck.score,
            // Don't overwrite existing document_hash on the rejected profile (keep evidence trail)
          })
          .eq("id", userId);
        return new Response(JSON.stringify({ ok: true, status: "rejected", reason: "document_already_used" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Build the profile update
    const update: Record<string, unknown> = {
      id_name_on_record: idName,
      name_match_score: nameCheck.score,
    };
    if (docHash) update.document_hash = docHash;

    if (nameCheck.match) {
      update.identity_verification_status = "verified";
      update.is_verified = true;
    } else {
      // Name mismatch: keep pending so admin/user can resolve via profile-edit trigger
      update.identity_verification_status = "pending";
      update.is_verified = false;
    }

    const { error: updErr } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", userId);
    if (updErr) {
      // 23505 here means another concurrent webhook already wrote this hash
      // for a different user — caught by the partial unique index. Race
      // ordering doesn't matter for our purposes: the OTHER user wins the
      // race and is_verified, this one stays unverified and quiet.
      if ((updErr as { code?: string }).code === "23505") {
        console.log("Profile update hit 23505 (concurrent verification by another account); leaving this profile unverified.");
        return new Response(JSON.stringify({ ok: true, status: "rejected", reason: "race_lost" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("Profile update failed:", updErr);
      return new Response(JSON.stringify({ ok: true, error: "profile_update_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If we didn't flip is_verified, stop here (no credits on name mismatch)
    if (!nameCheck.match) {
      return new Response(JSON.stringify({ ok: true, status: "pending_name_mismatch", score: nameCheck.score }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Replay-safety fast path: if the user was ALREADY verified before this
    // webhook, credits were already considered. The 23505-tolerant inserts
    // below would no-op anyway, but skipping the work also avoids spurious
    // referral_verify attempts on bursty Didit retries. (Real replay
    // protection still requires signature verification; tracked separately.)
    if (profile.is_verified === true) {
      console.log("Replay detected (user already verified); skipping credit grants.");
      return new Response(JSON.stringify({ ok: true, status: "verified", replay: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Grant credits (best-effort, never block the webhook ack)
    const referredBy = profile.referred_by as string | null;

    // Referrer credit (only if there's a valid referrer and not self-referral, and under cap)
    if (referredBy && referredBy !== userId) {
      try {
        const underCap = await referrerHasCapacity(referredBy);
        if (underCap) {
          const r = await insertCredit({
            user_id: referredBy,
            source: "referral_verify",
            referred_user_id: userId,
            days: 30,
          });
          if (!r.ok) {
            console.warn("Referrer credit insert failed:", r.error);
          } else if (!r.alreadyExisted) {
            // Flip the referrals row to completed for this pair
            await supabase
              .from("referrals")
              .update({ status: "completed", reward_claimed: true })
              .eq("referrer_id", referredBy)
              .eq("referred_user_id", userId);
          }
        } else {
          console.log("Referrer at 12/year cap; skipping referral_verify credit for", referredBy);
        }
      } catch (e) {
        console.error("Referrer credit grant error (non-fatal):", e);
      }
    }

    // Referee signup bonus (best-effort, one-time per user)
    try {
      const r = await insertCredit({
        user_id: userId,
        source: "referee_signup_bonus",
        referred_user_id: null,
        days: 30,
      });
      if (!r.ok) {
        console.warn("Referee bonus insert failed:", r.error);
      } else if (r.alreadyExisted) {
        console.log("Referee signup bonus already exists (idempotent skip)");
      } else {
        console.log("Referee signup bonus granted to", userId);
      }
    } catch (e) {
      console.error("Referee bonus grant error (non-fatal):", e);
    }

    return new Response(JSON.stringify({ ok: true, status: "verified" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("didit-webhook v8: top-level error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
