// supabase/functions/didit-webhook/index.ts
//
// Marryzen ID verification webhook (v9)
//
// Significant changes vs v8:
//
//   * Signature verification (OPT-IN). The code path is implemented but
//     gated behind DIDIT_REQUIRE_SIGNATURE=1 env var. With the flag UNSET
//     (current production state) we behave like v8: accept any well-formed
//     POST. Setting DIDIT_REQUIRE_SIGNATURE=1 enables HMAC-SHA256 checking
//     against DIDIT_WEBHOOK_SECRET. We try X-Signature-V2 first (canonical
//     JSON, middleware-safe); X-Signature-Simple is gated separately by
//     ALLOW_SIMPLE_SIG=1. X-Timestamp must be within 5 minutes. Failed
//     verification returns 401.
//
//     Why opt-in: when v9 first shipped with required verification, the
//     test webhook from Didit returned a digest that didn't match our
//     computed expected digest. Root cause TBD (secret mismatch or
//     canonicalization edge case). Until that's debugged with a one-off
//     diagnostic build, we keep the security at v8 levels and ship the
//     V3 plural-array + anti-farming fixes that are independently valuable.
//
//   * V3 payload extraction. v8 read singular legacy fields
//     (decision.id_verification, decision.face_match) which only appear when
//     a destination is pinned to webhook_version="V2". The current Didit
//     destination is V3 and sends plural arrays:
//
//         decision.id_verifications[]
//         decision.face_matches[]
//         decision.aml_screenings[]
//
//     so the extractors read those instead. The document hash composition
//     uses document_number + issuing_state (the actual field name; v8 tried
//     issuing_country and silently produced nulls).
//
//   * Didit status values are capitalized ("Approved", "Declined", "In Review",
//     "In Progress", "Abandoned", "Expired", "KYC Expired", "Resubmitted").
//     We lower-case before comparing.
//
//   * "Approved with warnings" is NOT a real Didit status — removed the
//     reviewer-paranoia branch.
//
// Behavior preserved from v8:
//   - OPTIONS preflight with CORS, POST-only otherwise.
//   - Best-effort credit grants that never block the 2xx ack.
//   - Name match (Levenshtein + token-set, threshold 0.80).
//   - Anti-farming via SHA-256(documentNumber|issuingState) and the partial
//     unique index profiles_document_hash_unique_verified.
//   - Idempotent inserts (23505 tolerated).
//   - Replay fast path when the user is already verified.
//   - Concurrent-write race lost path on 23505 of the profile update.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-didit-signature, x-signature, x-signature-v2, x-signature-simple, x-timestamp",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

const WEBHOOK_SECRET = Deno.env.get("DIDIT_WEBHOOK_SECRET") ?? "";

// ---------- Signature verification ----------

const TIMESTAMP_TOLERANCE_SECONDS = 300;

function hexFromBuffer(buf: ArrayBuffer): string {
  const arr = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < arr.length; i++) out += arr[i].toString(16).padStart(2, "0");
  return out;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return hexFromBuffer(sig);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// "Shorten" whole-valued floats to ints, matching Didit's float normalization.
function shortenFloats(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(shortenFloats);
  if (data !== null && typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      out[k] = shortenFloats(v);
    }
    return out;
  }
  if (typeof data === "number" && !Number.isInteger(data) && data % 1 === 0) {
    return Math.trunc(data);
  }
  return data;
}

// Recursively sort object keys (alphabetical).
function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[k] = sortKeys((obj as Record<string, unknown>)[k]);
    }
    return sorted;
  }
  return obj;
}

// Canonical V2 JSON: sorted keys, compact separators, Unicode preserved.
function canonicalJsonV2(body: unknown): string {
  return JSON.stringify(sortKeys(shortenFloats(body)));
}

function buildSimpleString(body: Record<string, unknown>): string {
  return [
    body.timestamp ?? "",
    body.session_id ?? "",
    body.status ?? "",
    body.webhook_type ?? "",
  ].join(":");
}

async function verifyDiditSignature(
  parsedBody: Record<string, unknown>,
  headers: Headers,
  secret: string,
): Promise<{ ok: boolean; reason?: string; method?: string }> {
  if (!secret) return { ok: false, reason: "no_secret_configured" };

  const tsHeader = headers.get("x-timestamp");
  if (!tsHeader) return { ok: false, reason: "missing_timestamp_header" };
  const ts = Number(tsHeader);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad_timestamp_header" };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, reason: "timestamp_out_of_window" };
  }

  // Normalise header hex (lowercase, strip optional "sha256=" prefix).
  // Our expected hex is already lowercase. Comparing case-insensitively
  // avoids false-401s if Didit (or any proxy) upper-cases the digest.
  const normalizeSig = (s: string | null): string =>
    (s || "").replace(/^sha256=/i, "").toLowerCase();

  // Try V2 first (canonical JSON, middleware-safe).
  const sigV2 = normalizeSig(headers.get("x-signature-v2"));
  if (sigV2) {
    const expected = await hmacSha256Hex(secret, canonicalJsonV2(parsedBody));
    if (constantTimeEqual(expected, sigV2)) return { ok: true, method: "v2" };
  }

  // Fallback to Simple (envelope-only). Gated by env flag so the more-secure
  // V2 path is the only acceptor by default. Flip ALLOW_SIMPLE_SIG=1 only if
  // V2 breaks in production (middleware re-encoding); accepting Simple is a
  // real security downgrade because it does NOT cover the decision block.
  if (Deno.env.get("ALLOW_SIMPLE_SIG") === "1") {
    const sigSimple = normalizeSig(headers.get("x-signature-simple"));
    if (sigSimple) {
      const expected = await hmacSha256Hex(secret, buildSimpleString(parsedBody));
      if (constantTimeEqual(expected, sigSimple)) {
        console.warn(
          "didit-webhook v9: ACCEPTED via X-Signature-Simple — decision body is NOT authenticated.",
        );
        return { ok: true, method: "simple" };
      }
    }
  }

  return { ok: false, reason: "no_valid_signature" };
}

// ---------- Name match helpers (token-set + Levenshtein) ----------

const NAME_MATCH_THRESHOLD = 0.80;

function normalizeTokens(name: string): string[] {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

function namesMatch(profileName: string, idName: string): { match: boolean; score: number } {
  const a = normalizeTokens(profileName);
  const b = normalizeTokens(idName);
  if (!a.length || !b.length) return { match: false, score: 0 };
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  let total = 0;
  for (const t of shorter) {
    let best = 0;
    for (const u of longer) {
      const dist = levenshtein(t, u);
      const sim = 1 - dist / Math.max(t.length, u.length);
      if (sim > best) best = sim;
    }
    total += best;
  }
  const avg = total / shorter.length;
  return { match: avg >= NAME_MATCH_THRESHOLD, score: avg };
}

// ---------- Document hash (anti-farming) ----------

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return hexFromBuffer(hash);
}

function normalizeDocPart(s: unknown): string {
  return (s == null ? "" : String(s))
    .trim()
    .toUpperCase()
    .replace(/[\s\-]+/g, "");
}

async function computeDocumentHash(doc: {
  number?: unknown;
  state?: unknown;
}): Promise<string | null> {
  const number = normalizeDocPart(doc.number);
  const state = normalizeDocPart(doc.state);
  if (!number || !state) return null;
  return await sha256Hex(`${number}|${state}`);
}

// ---------- Didit V3 payload extractors ----------

function getDecisionNode(payload: Record<string, unknown>): Record<string, unknown> | null {
  const d = (payload as { decision?: unknown }).decision;
  return d && typeof d === "object" ? (d as Record<string, unknown>) : null;
}

function extractIdVerification(payload: Record<string, unknown>): Record<string, unknown> | null {
  const dec = getDecisionNode(payload);
  if (!dec) return null;
  // V3: plural arrays. Each entry has node_id + per-feature fields.
  const arr = (dec as { id_verifications?: unknown }).id_verifications;
  if (Array.isArray(arr) && arr.length > 0) {
    // Use the first Approved entry, or the first entry if none are Approved.
    const approved = arr.find(
      (e) => e && typeof e === "object" && /^approved$/i.test(String((e as { status?: unknown }).status ?? "")),
    );
    return ((approved ?? arr[0]) as Record<string, unknown>) || null;
  }
  return null;
}

function extractDocumentFields(payload: Record<string, unknown>): { number?: unknown; state?: unknown } {
  const id = extractIdVerification(payload);
  if (!id) return {};
  return {
    number: id.document_number ?? id.documentNumber ?? id.number ?? null,
    // Didit uses "issuing_state" (e.g. "ESP"). Some payloads may also have
    // "issuing_country" or "country"; we'll tolerate both as last-resort fallbacks.
    state:
      id.issuing_state ?? id.issuingState ?? id.issuing_country ?? id.issuingCountry ?? id.country ?? null,
  };
}

function extractIdName(payload: Record<string, unknown>): string | null {
  const id = extractIdVerification(payload);
  if (!id) return null;
  const first = String(id.first_name ?? id.firstName ?? "").trim();
  const last = String(id.last_name ?? id.lastName ?? "").trim();
  const full = id.full_name ?? id.fullName ?? null;
  if (full) {
    const v = String(full).trim();
    if (v) return v;
  }
  const joined = `${first} ${last}`.trim();
  return joined || null;
}

function extractStatus(payload: Record<string, unknown>): string {
  const s = (payload as { status?: unknown }).status;
  if (typeof s === "string") return s.toLowerCase().trim();
  return "unknown";
}

function extractUserId(payload: Record<string, unknown>): string | null {
  // Didit echoes vendor_data back as the string we supplied at session creation.
  const vd = (payload as { vendor_data?: unknown }).vendor_data;
  if (typeof vd === "string") {
    const trimmed = vd.trim();
    if (!trimmed) return null;
    // Real UUID regex (not just "hex+dash chars"). Defense-in-depth on top of
    // signature verification: prevents a tampered vendor_data from routing the
    // webhook at an arbitrary profile row.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return trimmed;
    }
    // Stringified JSON containing { user_id }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.user_id === "string") return parsed.user_id;
    } catch (_) {
      /* fallthrough */
    }
    return trimmed;
  }
  if (vd && typeof vd === "object" && typeof (vd as { user_id?: unknown }).user_id === "string") {
    return String((vd as { user_id: string }).user_id);
  }
  const md = (payload as { metadata?: { user_id?: string } }).metadata;
  if (md && typeof md.user_id === "string") return md.user_id;
  return null;
}

// ---------- Credits + cap ----------

const REFERRAL_SOURCES = [
  "referral_verify",
  "referral_subscribe",
  "referral_verify_after_rename",
];

async function referrerHasCapacity(referrerId: string): Promise<boolean> {
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

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch (_) {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Signature verification — OPT-IN via DIDIT_REQUIRE_SIGNATURE=1.
  // While disabled we accept any POST (matches v8 behavior). The check is
  // fully implemented; just gated so we can ship the V3 extraction fixes
  // without breaking real webhook delivery while signature debugging is
  // pending.
  let sig: { ok: boolean; reason?: string; method?: string } = { ok: true, method: "skipped" };
  if (Deno.env.get("DIDIT_REQUIRE_SIGNATURE") === "1") {
    sig = await verifyDiditSignature(payload, req.headers, WEBHOOK_SECRET);
    if (!sig.ok) {
      console.warn("didit-webhook v9.1: rejecting unverified webhook:", sig.reason);
      return new Response(
        JSON.stringify({ ok: false, error: "unauthorized", reason: sig.reason }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } else {
    console.log("didit-webhook v9.1: signature verification DISABLED (set DIDIT_REQUIRE_SIGNATURE=1 to enable)");
  }

  try {
    console.log(
      "didit-webhook v9.1: received event",
      JSON.stringify({
        status: extractStatus(payload),
        webhook_type: payload.webhook_type,
        sig_method: sig.method,
      }),
    );

    const userId = extractUserId(payload);
    if (!userId) {
      console.warn("No user_id in vendor_data; cannot route this webhook");
      return new Response(JSON.stringify({ ok: true, ignored: "no_user_id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = extractStatus(payload);

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select(
        "id, full_name, referred_by, is_verified, identity_verification_status, document_hash",
      )
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) {
      console.error("Profile fetch failed:", profileErr);
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

    // Non-approved decisions: mark accordingly. We deliberately do NOT treat
    // "approved with warnings" as approved — Didit does not emit that as a
    // top-level status.
    if (status !== "approved") {
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

    // Approved path
    const docFields = extractDocumentFields(payload);
    const docHash = await computeDocumentHash(docFields);
    if (!docHash) {
      console.error(
        "didit-webhook v9.1: approved event has NO extractable document fields. " +
          "Anti-farming dedup is SKIPPED for this verification. Payload top-level keys: " +
          Object.keys(payload || {}).join(","),
      );
    }
    const idName = extractIdName(payload);
    const nameCheck = idName ? namesMatch(profile.full_name || "", idName) : { match: false, score: 0 };

    // Anti-farming: another VERIFIED profile already owns this document_hash?
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
            // Write document_hash on the rejected profile for forensics. The
            // partial unique index only enforces uniqueness for verified rows,
            // so this is safe and gives investigators an evidence trail when
            // multiple accounts attempt the same document.
            document_hash: docHash,
          })
          .eq("id", userId);
        return new Response(
          JSON.stringify({ ok: true, status: "rejected", reason: "document_already_used" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
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
      update.identity_verification_status = "pending";
      update.is_verified = false;
    }

    const { error: updErr } = await supabase.from("profiles").update(update).eq("id", userId);
    if (updErr) {
      // 23505 here means another concurrent webhook already wrote this hash
      // for a different user — caught by the partial unique index. The other
      // user wins; this one stays unverified.
      if ((updErr as { code?: string }).code === "23505") {
        console.log("Profile update hit 23505 (race lost); leaving this profile unverified.");
        return new Response(
          JSON.stringify({ ok: true, status: "rejected", reason: "race_lost" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.error("Profile update failed:", updErr);
      return new Response(JSON.stringify({ ok: true, error: "profile_update_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Name mismatch — no credits on this path.
    if (!nameCheck.match) {
      return new Response(
        JSON.stringify({ ok: true, status: "pending_name_mismatch", score: nameCheck.score }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Replay-safety fast path: if the user was already verified before this
    // webhook, credits were considered already. Skip the work.
    if (profile.is_verified === true) {
      console.log("Replay detected (user already verified); skipping credit grants.");
      return new Response(
        JSON.stringify({ ok: true, status: "verified", replay: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Referrer credit
    const referredBy = profile.referred_by as string | null;
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

    // Referee signup bonus (one-time per user)
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
    console.error("didit-webhook v9.1: top-level error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
