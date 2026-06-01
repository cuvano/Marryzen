// supabase/functions/scan-photo/index.ts
//
// B6 - Photo moderation via Sightengine API.
//
// Flow:
//   1. Client uploads a base64 data URL via supabase.functions.invoke('scan-photo')
//   2. We decode -> POST multipart to Sightengine /1.0/check.json
//   3. Inspect per-model scores (nudity, wad, gore, offensive, scam, face-attributes)
//   4. Write an audit row to photo_scans
//   5. If CSAM indicator (nudity + face age < 18): also write csam_incidents +
//      auto-ban + email admin (Resend direct)
//   6. Return { safe, reason, flag, score, scan_id }
//
// FAIL MODES (fail-CLOSED by default):
//   - Sightengine returns minor + nudity -> block + ban + alert (CSAM proxy)
//   - Sightengine returns NSFW etc       -> block
//   - Sightengine returns 5xx or net err -> block with "moderation
//                                           temporarily unavailable" message
//
// ENVIRONMENT (set in Supabase Dashboard -> Edge Functions -> Secrets):
//   SIGHTENGINE_API_USER    - your Sightengine api_user (numeric ID)
//   SIGHTENGINE_API_SECRET  - your Sightengine api_secret (random hex)
//   RESEND_API_KEY          - already set for other functions
//   FROM_EMAIL              - already set
//   CSAM_ALERT_EMAIL        - optional, defaults to admin@marryzen.com
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY -> auto-injected

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SIGHTENGINE_ENDPOINT = "https://api.sightengine.com/1.0/check.json";
// Models we ask Sightengine to run. Comma-separated, single request.
//   nudity-2.1      = explicit + suggestive + safe scores
//   wad             = weapons / alcohol / drugs
//   gore-2.0        = gore / blood / violence
//   offensive       = hate symbols, middle finger, etc.
//   scam            = identifies scam patterns (fine for profile photos)
//   face-attributes = per-face age estimate + gender + emotion
//                     (we use age to flag potential CSAM via minor + nudity)
const SIGHTENGINE_MODELS = "nudity-2.1,wad,gore-2.0,offensive,face-attributes";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Marryzen Safety <alerts@marryzen.com>";
const CSAM_ALERT_EMAIL = Deno.env.get("CSAM_ALERT_EMAIL") ?? "admin@marryzen.com";

const ALLOWED_ORIGINS = new Set([
  "https://www.marryzen.com",
  "https://marryzen.com",
]);

function buildCors(origin: string | null) {
  const isMarryzen = !!origin && (
    ALLOWED_ORIGINS.has(origin) ||
    /^https:\/\/marryzen-[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/i.test(origin)
  );
  return {
    "Access-Control-Allow-Origin": isMarryzen ? origin! : "https://www.marryzen.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------- Threshold tuning ----------
// Sightengine returns scores 0..1. Thresholds chosen for a faith-marriage
// app where false-positives on borderline content are acceptable (user can
// just pick a different photo) and false-negatives are very costly.
const NUDITY_RAW_BLOCK = 0.60;       // nudity-2.1 "sexual_activity" / "sexual_display"
const NUDITY_EROTICA_BLOCK = 0.50;   // nudity-2.1 "erotica"
const SUGGESTIVE_FLAG = 0.70;        // nudity-2.1 "suggestive" -> pass+flag
const WAD_BLOCK = 0.80;              // weapons / alcohol / drugs combined score
const GORE_BLOCK = 0.85;
const OFFENSIVE_BLOCK = 0.80;
// Minor-age signal. If face-attributes reports a face with age < 18 AND any
// nudity score > MINOR_NUDITY_THRESHOLD, we treat as CSAM-positive.
const MINOR_AGE_CUTOFF = 18;
const MINOR_NUDITY_THRESHOLD = 0.30;

interface ScanDecision {
  decision: "pass" | "flag" | "block" | "error";
  reason?: string;
  primaryFlag?: string;
  primaryScore?: number;
  isCsam: boolean;
}

// Sightengine response is a deep object with per-model fields. Pluck out
// the scores we care about; default to 0 for any missing field so the
// classifier degrades gracefully if Sightengine changes their schema.
function classify(j: any): ScanDecision {
  if (!j || j.status !== "success") {
    return {
      decision: "error",
      reason: "Photo could not be verified by moderation service. Please try again.",
      isCsam: false,
    };
  }

  // ---- Nudity 2.1 model ----
  const n = j.nudity ?? {};
  const nudityRaw = Number(n.sexual_activity ?? 0) + Number(n.sexual_display ?? 0);
  const erotica = Number(n.erotica ?? 0);
  const suggestive = Number(n.suggestive ?? 0);

  // ---- WAD (weapons/alcohol/drugs) ----
  const wad = j.weapon ?? 0;
  const weaponScore = Number(wad);
  const alcoholScore = Number(j.alcohol ?? 0);
  const drugScore = Number(j.drugs ?? j.drug ?? 0);

  // ---- Gore ----
  const gore = j.gore ?? {};
  const goreScore = Number(gore.prob ?? gore.gore ?? 0);

  // ---- Offensive ----
  const off = j.offensive ?? {};
  const offensiveScore = Math.max(
    Number(off.nazi ?? 0),
    Number(off.confederate ?? 0),
    Number(off.supremacist ?? 0),
    Number(off.middle_finger ?? 0),
    Number(off.terrorist ?? 0),
  );

  // ---- Face attributes -> age estimates for CSAM proxy ----
  const faces = Array.isArray(j.faces) ? j.faces : [];
  const minorFace = faces.find((f: any) => {
    const age = Number(f?.attributes?.age ?? f?.age ?? 99);
    return age > 0 && age < MINOR_AGE_CUTOFF;
  });
  const hasAnyNudity = nudityRaw > MINOR_NUDITY_THRESHOLD ||
    erotica > MINOR_NUDITY_THRESHOLD ||
    suggestive > MINOR_NUDITY_THRESHOLD;

  // ---- Decision order: CSAM proxy first ----
  if (minorFace && hasAnyNudity) {
    return {
      decision: "block",
      reason: "Image flagged as potential CSAM (minor + nudity). This incident has been logged.",
      primaryFlag: "minor_with_nudity",
      primaryScore: Math.max(nudityRaw, erotica, suggestive),
      isCsam: true,
    };
  }

  if (nudityRaw >= NUDITY_RAW_BLOCK) {
    return {
      decision: "block",
      reason: "Photo contains explicit content. Please upload a different photo.",
      primaryFlag: "sexual_content",
      primaryScore: nudityRaw,
      isCsam: false,
    };
  }
  if (erotica >= NUDITY_EROTICA_BLOCK) {
    return {
      decision: "block",
      reason: "Photo contains explicit content. Please upload a different photo.",
      primaryFlag: "erotica",
      primaryScore: erotica,
      isCsam: false,
    };
  }
  if (goreScore >= GORE_BLOCK) {
    return {
      decision: "block",
      reason: "Photo contains violent or graphic content. Please upload a different photo.",
      primaryFlag: "gore",
      primaryScore: goreScore,
      isCsam: false,
    };
  }
  if (weaponScore >= WAD_BLOCK) {
    return {
      decision: "block",
      reason: "Photo contains weapons. Please upload a different photo.",
      primaryFlag: "weapon",
      primaryScore: weaponScore,
      isCsam: false,
    };
  }
  if (offensiveScore >= OFFENSIVE_BLOCK) {
    return {
      decision: "block",
      reason: "Photo contains offensive symbols. Please upload a different photo.",
      primaryFlag: "offensive",
      primaryScore: offensiveScore,
      isCsam: false,
    };
  }
  if (suggestive >= SUGGESTIVE_FLAG) {
    return {
      decision: "flag",
      reason: "Photo flagged for admin review (borderline content).",
      primaryFlag: "suggestive",
      primaryScore: suggestive,
      isCsam: false,
    };
  }

  return {
    decision: "pass",
    primaryFlag: "clean",
    primaryScore: 1 - Math.max(nudityRaw, erotica, suggestive, goreScore, weaponScore, offensiveScore),
    isCsam: false,
  };
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1];
  const b64 = match[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

Deno.serve(async (req: Request) => {
  const CORS = buildCors(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const seUser = Deno.env.get("SIGHTENGINE_API_USER");
  const seSecret = Deno.env.get("SIGHTENGINE_API_SECRET");

  if (!supabaseUrl || !serviceKey) {
    console.error("scan-photo: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response(JSON.stringify({ error: "Service misconfigured" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  if (!seUser || !seSecret) {
    console.error("scan-photo: SIGHTENGINE_API_USER / SIGHTENGINE_API_SECRET not set");
    return new Response(JSON.stringify({ error: "Moderation service not configured" }), {
      status: 503, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Resolve caller identity via the user's JWT (anon client, NOT service role)
  const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;
  const userEmail = userData.user.email ?? null;

  let body: { dataUrl?: string; context?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  if (!body.dataUrl || typeof body.dataUrl !== "string") {
    return new Response(JSON.stringify({ error: "Missing dataUrl" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const decoded = dataUrlToBytes(body.dataUrl);
  if (!decoded) {
    return new Response(
      JSON.stringify({ error: "dataUrl must be a base64 data URL (data:image/...;base64,...)" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
  if (decoded.bytes.length > 10 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: "Image exceeds 10 MB limit" }), {
      status: 413, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  // ---------- Call Sightengine ----------
  // Auth via query params (Sightengine's documented approach). The image
  // goes as a multipart "media" file field.
  const url = new URL(SIGHTENGINE_ENDPOINT);
  url.searchParams.set("models", SIGHTENGINE_MODELS);
  url.searchParams.set("api_user", seUser);
  url.searchParams.set("api_secret", seSecret);

  let seJson: any = null;
  let seError: string | null = null;
  try {
    const form = new FormData();
    const blob = new Blob([decoded.bytes], { type: decoded.mime });
    form.append("media", blob, "photo." + decoded.mime.split("/")[1]);

    const r = await fetch(url.toString(), { method: "POST", body: form });
    if (!r.ok) {
      seError = `Sightengine HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`;
    } else {
      seJson = await r.json();
    }
  } catch (e) {
    seError = "Sightengine call threw: " + ((e as Error).message ?? String(e));
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  // ---------- Decision (fail-CLOSED on errors) ----------
  let decision: ScanDecision;
  if (seError || !seJson) {
    decision = {
      decision: "error",
      reason: "Photo could not be verified by moderation service. Please try again in a few minutes.",
      isCsam: false,
    };
    console.error("scan-photo: Sightengine failure (fail-closed):", seError);
  } else {
    decision = classify(seJson);
  }

  // ---------- Write photo_scans audit row (always) ----------
  let scanId: string | null = null;
  try {
    const { data: insertedScan, error: insErr } = await adminClient
      .from("photo_scans")
      .insert({
        user_id: userId,
        decision: decision.decision,
        primary_flag: decision.primaryFlag ?? null,
        primary_score: decision.primaryScore ?? null,
        hive_response: seJson ?? { error: seError ?? "no response" },
        // hive_task_id kept for column compat; carries Sightengine request id.
        hive_task_id: seJson?.request?.id ?? null,
        upload_context: typeof body.context === "string" ? body.context.slice(0, 32) : null,
        client_ip: clientIp,
        user_agent: userAgent,
      })
      .select("id")
      .single();
    if (!insErr && insertedScan) scanId = insertedScan.id as string;
  } catch (e) {
    console.error("scan-photo: failed to write photo_scans row:", e);
  }

  // ---------- CSAM handling ----------
  if (decision.isCsam) {
    try {
      await adminClient.from("csam_incidents").insert({
        user_id: userId,
        user_email: userEmail,
        user_ip: clientIp,
        user_agent: userAgent,
        photo_scan_id: scanId,
        detection_method: "ml_detection",  // Sightengine minor-age + nudity heuristic
        detection_score: decision.primaryScore ?? null,
        ncmec_report_status: "pending",
        account_action: "banned",
      });
    } catch (e) {
      console.error("scan-photo: csam_incidents insert failed:", e);
    }
    try {
      await adminClient
        .from("profiles")
        .update({ status: "banned", suspended_until: null })
        .eq("id", userId);
    } catch (e) {
      console.error("scan-photo: profile ban failed:", e);
    }
    if (RESEND_API_KEY) {
      try {
        const html =
          "<h2 style=\"color:#b00\">URGENT: Possible CSAM detection</h2>" +
          "<p>Sightengine flagged an uploaded photo as containing a likely minor with nudity indicators.</p>" +
          "<table style=\"border-collapse: collapse; width: 100%;\">" +
          "<tr><td style=\"padding: 8px; background: #FAF7F2; font-weight: 600; width: 35%;\">User ID</td><td style=\"padding: 8px; background: #FFFFFF;\"><code>" + escapeHtml(userId) + "</code></td></tr>" +
          "<tr><td style=\"padding: 8px; background: #FAF7F2; font-weight: 600;\">User email</td><td style=\"padding: 8px; background: #FFFFFF;\">" + escapeHtml(userEmail ?? "unknown") + "</td></tr>" +
          "<tr><td style=\"padding: 8px; background: #FAF7F2; font-weight: 600;\">IP</td><td style=\"padding: 8px; background: #FFFFFF;\">" + escapeHtml(clientIp ?? "unknown") + "</td></tr>" +
          "<tr><td style=\"padding: 8px; background: #FAF7F2; font-weight: 600;\">Detection</td><td style=\"padding: 8px; background: #FFFFFF;\"><code>" + escapeHtml(decision.primaryFlag ?? "unknown") + "</code></td></tr>" +
          "<tr><td style=\"padding: 8px; background: #FAF7F2; font-weight: 600;\">Score</td><td style=\"padding: 8px; background: #FFFFFF;\">" + escapeHtml(String(decision.primaryScore ?? "?")) + "</td></tr>" +
          "<tr><td style=\"padding: 8px; background: #FAF7F2; font-weight: 600;\">Time (UTC)</td><td style=\"padding: 8px; background: #FFFFFF;\">" + escapeHtml(new Date().toISOString()) + "</td></tr>" +
          "<tr><td style=\"padding: 8px; background: #FAF7F2; font-weight: 600;\">Incident ID</td><td style=\"padding: 8px; background: #FFFFFF;\"><code>" + escapeHtml(scanId ?? "(none)") + "</code></td></tr>" +
          "</table>" +
          "<p style=\"margin-top: 16px;\"><strong>Account has been auto-banned.</strong></p>" +
          "<p>Required next step: review the image (do NOT view directly; use the photo_scans audit row metadata only) and file an NCMEC CyberTipline report at " +
          "<a href=\"https://report.cybertip.org\">report.cybertip.org</a>. Mandatory under <code>18 U.S.C. § 2258A</code> for U.S. providers.</p>" +
          "<p style=\"color: #706B67; font-size: 12px; margin-top: 24px;\">This alert was sent by the Marryzen scan-photo Edge Function (Sightengine backend).</p>";

        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + RESEND_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: CSAM_ALERT_EMAIL,
            subject: "[URGENT] Possible CSAM detected - NCMEC report required",
            html,
          }),
        });
        if (!r.ok) {
          console.error("scan-photo: Resend CSAM alert failed:", r.status, await r.text());
        }
      } catch (e) {
        console.error("scan-photo: CSAM email throw:", e);
      }
    } else {
      console.error("scan-photo: RESEND_API_KEY not set; CSAM admin alert SKIPPED.");
    }
  }

  // Fail-CLOSED: only 'pass' and 'flag' are considered safe.
  const safe = decision.decision === "pass" || decision.decision === "flag";
  return new Response(
    JSON.stringify({
      safe,
      decision: decision.decision,
      reason: decision.reason ?? null,
      flag: decision.primaryFlag ?? null,
      score: decision.primaryScore ?? null,
      scan_id: scanId,
    }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
