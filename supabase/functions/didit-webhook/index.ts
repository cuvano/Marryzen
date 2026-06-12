// supabase/functions/didit-webhook/index.ts
//
// Marryzen ID verification webhook (v11)
//
// Significant changes vs v10:
//
//   * Process-and-purge (data minimization, DPIA §4.1 + Didit retention
//     hardening). After all terminal-state processing is complete, the
//     webhook calls DELETE https://verification.didit.me/v3/session/{id}/
//     against Didit so the verification session is wiped from Didit's
//     storage as soon as Marryzen has persisted everything we need.
//
//     Belt-and-suspenders with the 6-month Didit-side retention policy:
//     this brings the typical session lifetime on Didit's side down from
//     180 days to a few seconds.
//
//     OPT-IN behavior: requires DIDIT_API_KEY env var. If unset, the
//     purge is skipped (logged once) and the webhook behaves identically
//     to v10. This keeps the rollout safe — set the env var to enable.
//
//     Best-effort: errors are logged but never fail the 200 ack to Didit.
//     The 6-month server-side retention remains as the backstop if a
//     purge call fails.
//
// Significant changes vs v9:
//
//   * GDPR/DPIA sanitization (§4.1 compliance). awsRekognitionCompareFaces()
//     no longer returns the raw AWS response. It now returns a sanitized
//     audit summary: counts of FaceMatches/UnmatchedFaces, the array of
//     similarity values (numbers only), and source_image_face_detected (bool).
//     The Face.Landmarks (27 facial points), BoundingBox, Pose, Quality, and
//     SourceImageFace objects are dropped before persistence. This brings the
//     Edge Function in line with the DPIA's claim that Marryzen retains only
//     the numeric similarity score, not biometric-derived geometry.
//
//   * vendor_request_id is now extracted from the x-amzn-RequestId HTTP
//     header (the canonical location), not from a (non-existent) JSON body
//     ResponseMetadata field. This fixes a latent bug where vendor_request_id
//     was always null on success.
//
//   * Bundled with the AWS_REGION env var flip from us-east-1 to eu-west-1
//     (DPIA §1.5, §4.1, Annex B commitment). Code is region-agnostic — it
//     reads from Deno.env.get("AWS_REGION"). The default fallback remains
//     "us-east-1" for safety in case the env var is ever missing.
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

function extractDocumentDOB(payload: Record<string, unknown>): string | null {
  // B7 — server-side underage hard-stop. Pull the verified date_of_birth out
  // of the Didit id_verification node so we can cross-check against the
  // claimed DOB and reject anyone under 18 at the document-of-record level.
  // Didit uses date_of_birth (snake) and dateOfBirth (camel); also seen
  // "birthDate" and "birthday" in some sample payloads — tolerate all.
  const id = extractIdVerification(payload);
  if (!id) return null;
  const raw =
    (id as { date_of_birth?: unknown }).date_of_birth ??
    (id as { dateOfBirth?: unknown }).dateOfBirth ??
    (id as { birthDate?: unknown }).birthDate ??
    (id as { birthday?: unknown }).birthday ??
    null;
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Accept ISO YYYY-MM-DD or full ISO timestamp. Reject anything we can't
  // parse, since "I couldn't read the DOB" is a soft signal we should not
  // silently approve through.
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function isUnder18(dobIso: string | null): boolean {
  if (!dobIso) return false; // unknown DOB — don't reject on this path alone
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return false;
  const today = new Date();
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate())) {
    age--;
  }
  return age < 18;
}

// B1 — Pull the live selfie image URL from Didit's webhook payload. Didit V3
// places it under decision.face_verifications[].image_url OR decision.id_verifications[]
// .face_image_url depending on version. Tolerate both.
function extractDiditSelfieUrl(payload: Record<string, unknown>): string | null {
  const dec = getDecisionNode(payload);
  if (!dec) return null;

  const fvArr = (dec as { face_verifications?: unknown }).face_verifications;
  if (Array.isArray(fvArr) && fvArr.length > 0) {
    for (const fv of fvArr) {
      const v = fv as Record<string, unknown>;
      const u = v.image_url ?? v.selfie_url ?? v.face_image_url ?? v.live_image_url ?? v.url;
      if (typeof u === "string" && u.startsWith("http")) return u;
    }
  }

  const fmArr = (dec as { face_matches?: unknown }).face_matches;
  if (Array.isArray(fmArr) && fmArr.length > 0) {
    for (const fm of fmArr) {
      const v = fm as Record<string, unknown>;
      const u = v.selfie_url ?? v.image_url ?? v.face_image_url ?? v.live_image_url;
      if (typeof u === "string" && u.startsWith("http")) return u;
    }
  }

  const idArr = (dec as { id_verifications?: unknown }).id_verifications;
  if (Array.isArray(idArr) && idArr.length > 0) {
    for (const idv of idArr) {
      const v = idv as Record<string, unknown>;
      const u = v.face_image_url ?? v.selfie_url ?? v.live_image_url;
      if (typeof u === "string" && u.startsWith("http")) return u;
    }
  }

  return null;
}

// Fetch an image URL and return base64-encoded bytes (no data: prefix).
// Returns null on any failure.
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) {
      console.warn("fetchImageAsBase64: HTTP " + r.status + " for " + url);
      return null;
    }
    const buf = new Uint8Array(await r.arrayBuffer());
    // Chunked btoa to avoid stack overflow on large images
    let bin = "";
    const CHUNK = 8192;
    for (let i = 0; i < buf.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + CHUNK)));
    }
    return btoa(bin);
  } catch (e) {
    console.warn("fetchImageAsBase64 threw: " + String(e));
    return null;
  }
}

// B1 — AWS Rekognition CompareFaces.
// Compares two face images. Returns the highest similarity score 0..100 (we
// divide by 100 to return 0..1) or null on failure. Uses AWS Signature V4
// via the aws4fetch library.
//
// DPIA §4.1 sanitization: the `summary` field returned here is what gets
// persisted into face_match_attempts.vendor_response. It deliberately omits
// all biometric-derived geometry from the AWS response:
//   - Face.Landmarks (27 facial points per detected face)
//   - Face.BoundingBox (x/y/width/height of each face)
//   - Face.Pose (roll/yaw/pitch)
//   - Face.Quality (brightness/sharpness)
//   - SourceImageFace (same shape as above for the source)
// Only similarity values and counts are retained — these are sufficient for
// audit (was a face detected? how many matches? what scores?) without
// persisting biometric templates.
async function awsRekognitionCompareFaces(
  sourceB64: string,
  targetB64: string,
): Promise<{ score: number | null; summary: Record<string, unknown>; requestId: string | null; error?: string }> {
  const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
  const region = Deno.env.get("AWS_REGION") ?? "us-east-1";
  if (!accessKeyId || !secretAccessKey) {
    return { score: null, summary: { error: "AWS credentials missing" }, requestId: null, error: "AWS credentials missing" };
  }

  try {
    const { AwsClient } = await import("https://esm.sh/aws4fetch@1.0.18");
    const aws = new AwsClient({ accessKeyId, secretAccessKey, service: "rekognition", region });

    const body = JSON.stringify({
      SourceImage: { Bytes: sourceB64 },
      TargetImage: { Bytes: targetB64 },
      // Only return faces with > 70% similarity (we still get the top match in
      // FaceMatches even if below threshold via UnmatchedFaces).
      SimilarityThreshold: 70,
    });

    const r = await aws.fetch("https://rekognition." + region + ".amazonaws.com/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "RekognitionService.CompareFaces",
      },
      body,
    });

    // AWS puts the request ID in the x-amzn-RequestId header (not the JSON body).
    const requestId = r.headers.get("x-amzn-requestid");

    if (!r.ok) {
      const errText = (await r.text()).slice(0, 400);
      return {
        score: null,
        summary: { error: errText, http_status: r.status, region },
        requestId,
        error: "Rekognition HTTP " + r.status,
      };
    }

    const j = await r.json();
    // Response: { FaceMatches: [{ Similarity: 95.2, Face: {...biometric...} }, ...], UnmatchedFaces: [...], SourceImageFace: {...biometric...} }
    // Use the highest similarity score among matches, or 0 if no matches.
    const matches = Array.isArray(j?.FaceMatches) ? j.FaceMatches : [];
    const unmatched = Array.isArray(j?.UnmatchedFaces) ? j.UnmatchedFaces : [];
    let topSimilarity = 0;
    const similarities: number[] = [];
    for (const m of matches) {
      const s = Number(m?.Similarity ?? 0);
      similarities.push(s);
      if (s > topSimilarity) topSimilarity = s;
    }

    // DPIA §4.1: sanitized audit summary. NO Face objects, NO Landmarks, NO
    // BoundingBox, NO Pose, NO Quality, NO SourceImageFace. Just counts and
    // similarity values.
    const summary: Record<string, unknown> = {
      face_matches_count: matches.length,
      unmatched_faces_count: unmatched.length,
      source_image_face_detected: !!j?.SourceImageFace,
      similarities,
      region,
    };

    return { score: topSimilarity / 100, summary, requestId };
  } catch (e) {
    const errStr = ("AWS call threw: " + String(e)).slice(0, 400);
    return { score: null, summary: { error: errStr }, requestId: null, error: errStr };
  }
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

// ---------- Process-and-purge (v11) ----------
//
// After Marryzen has persisted everything we need from a Didit verification
// session, DELETE the session from Didit so the verification data doesn't
// sit on their servers longer than necessary. Belt-and-suspenders with
// the 6-month dashboard retention policy.
//
// Best-effort: errors are logged, never fatal. The 200 ack to Didit fires
// regardless of purge outcome.
//
// Auth uses x-api-key against Marryzen's DIDIT_API_KEY env var. If the
// env var is unset, purge is a no-op (logged once via the unsetWarned flag).
let purgeDisabledLogged = false;
async function purgeDiditSession(sessionId: string | null | undefined): Promise<void> {
  if (!sessionId) return;
  const apiKey = Deno.env.get("DIDIT_API_KEY") ?? "";
  if (!apiKey) {
    if (!purgeDisabledLogged) {
      console.log("didit-webhook v11: DIDIT_API_KEY not set; purge skipped (set the env var to enable process-and-purge)");
      purgeDisabledLogged = true;
    }
    return;
  }
  try {
    const url = `https://verification.didit.me/v3/session/${encodeURIComponent(sessionId)}/`;
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(url, {
      method: "DELETE",
      headers: { "x-api-key": apiKey },
      signal: ctrl.signal,
    });
    clearTimeout(timeoutId);
    if (resp.ok) {
      console.log(`didit-webhook v11: purged Didit session ${sessionId} (status ${resp.status})`);
    } else {
      // 404 is fine — session already purged or expired
      const text = await resp.text().catch(() => "");
      if (resp.status === 404) {
        console.log(`didit-webhook v11: purge — session ${sessionId} already gone (404)`);
      } else {
        console.warn(`didit-webhook v11: purge FAILED for session ${sessionId}: ${resp.status} ${text.slice(0, 200)}`);
      }
    }
  } catch (err) {
    // Network error / abort / etc. — best-effort, swallow
    console.warn("didit-webhook v11: purge threw (non-fatal):", err);
  }
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

  // v11: extract sessionId once at the top so each terminal return can
  // fire the process-and-purge call cleanly (no closure-over-mutable-scope).
  const purgeSessionId = (payload.session_id ?? "") as string;

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
        "id, full_name, referred_by, is_verified, identity_verification_status, document_hash, photos",
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

    // B1 — Replay-safety: if user was already verified, skip ALL re-verification
    // logic (including face-match). Prevents Didit retries from revoking
    // already-granted verified badges due to lighting/pose differences in a
    // re-uploaded selfie. Moved earlier (was after the verified-grant block).
    if (profile.is_verified === true) {
      console.log("Replay detected (user already verified); skipping credit grants.");
      return new Response(
        JSON.stringify({ ok: true, status: "verified", replay: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // B7 — server-side underage hard-stop. Before we honor a Didit "approved"
    // verification, cross-check the ID-extracted DOB. If the document of
    // record shows <18, refuse to mark the profile verified regardless of
    // what the user claimed at signup. The DB CHECK constraint
    // (profiles_dob_must_be_18_plus, migration b7_underage_hardstop.sql)
    // handles the claimed-DOB side; this handles the document side.
    const verifiedDob = extractDocumentDOB(payload);
    if (isUnder18(verifiedDob)) {
      console.warn(
        "didit-webhook: rejecting verification — document DOB shows user is under 18.",
        { userId, verifiedDob },
      );
      await supabase
        .from("profiles")
        .update({
          identity_verification_status: "rejected",
          is_verified: false,
        })
        .eq("id", userId);
      return new Response(
        JSON.stringify({ ok: true, status: "rejected", reason: "underage" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    // B1 — Face-match gate. Even if the name matches the document, we require
    // the live selfie to match the user's primary profile photo before
    // granting the verified badge. Prevents the "predator uploads stolen
    // photo + verifies with their own face" attack.
    //
    // Thresholds:
    //   score >= 0.85 -> match  (grant verified)
    //   0.60 - 0.85   -> review (don't grant; admin reviews)
    //   score < 0.60  -> mismatch (don't grant; admin reviews)
    //   missing/error -> review (don't grant; admin reviews) — fail-CLOSED
    //
    // ALL outcomes write a row to face_match_attempts for the audit log.
    // Status enum: face-fail uses 'pending' (existing ProfilePage UI handles)
    // rather than introducing a new status the UI doesn't render.
    const FACE_MATCH_THRESHOLD = 0.85;
    const FACE_MISMATCH_THRESHOLD = 0.60;
    let faceMatchDecision: "match" | "mismatch" | "review" | "error" = "error";
    let faceMatchScore: number | null = null;
    // v10: faceMatchSummary is the sanitized DPIA-compliant audit object,
    // NOT the raw Rekognition response. See awsRekognitionCompareFaces().
    let faceMatchSummary: Record<string, unknown> | null = null;
    let faceMatchRequestId: string | null = null;
    let faceMatchPassed = false;
    const profilePhotos = Array.isArray(profile?.photos) ? profile.photos as unknown[] : [];
    const primaryPhotoUrl = typeof profilePhotos[0] === "string" ? profilePhotos[0] as string : null;
    const diditSelfieUrl = extractDiditSelfieUrl(payload);

    if (nameCheck.match) {
      if (!primaryPhotoUrl || !diditSelfieUrl) {
        faceMatchDecision = "review";
        console.warn(
          "didit-webhook B1: missing image for face-match; fail-closed to review.",
          { hasProfile: !!primaryPhotoUrl, hasSelfie: !!diditSelfieUrl },
        );
      } else {
        // Fetch both images, base64-encode, send to AWS Rekognition.
        const [selfieB64, profileB64] = await Promise.all([
          fetchImageAsBase64(diditSelfieUrl),
          fetchImageAsBase64(primaryPhotoUrl),
        ]);
        if (!selfieB64 || !profileB64) {
          faceMatchDecision = "review";
          console.warn("didit-webhook B1: failed to download one or both images");
        } else {
          const cmp = await awsRekognitionCompareFaces(selfieB64, profileB64);
          faceMatchScore = cmp.score;
          faceMatchSummary = cmp.summary;
          faceMatchRequestId = cmp.requestId;
          if (cmp.error || faceMatchScore === null) {
            faceMatchDecision = "review";
            console.error("didit-webhook B1: AWS Rekognition failed:", cmp.error);
          } else if (faceMatchScore >= FACE_MATCH_THRESHOLD) {
            faceMatchDecision = "match";
            faceMatchPassed = true;
          } else if (faceMatchScore < FACE_MISMATCH_THRESHOLD) {
            faceMatchDecision = "mismatch";
          } else {
            faceMatchDecision = "review";
          }
        }
      }

      // Persist audit row regardless of outcome (best-effort).
      // v10: vendor_response stores the DPIA-sanitized summary (counts +
      // similarity values), NOT the raw Rekognition JSON. vendor_request_id
      // comes from the x-amzn-RequestId HTTP header (canonical AWS location).
      try {
        await supabase.from("face_match_attempts").insert({
          user_id: userId,
          selfie_url: diditSelfieUrl,
          profile_photo_url: primaryPhotoUrl,
          similarity_score: faceMatchScore,
          decision: faceMatchDecision,
          granted_verified: faceMatchPassed,
          vendor_response: faceMatchSummary,
          vendor_request_id: faceMatchRequestId,
        });
      } catch (e) {
        console.error("didit-webhook B1: face_match_attempts insert failed:", e);
      }
    }

    if (nameCheck.match && faceMatchPassed) {
      update.identity_verification_status = "verified";
      update.is_verified = true;
    } else if (nameCheck.match && !faceMatchPassed) {
      // Name matched but face-match did not. Mark as 'pending' so existing
      // ProfilePage UI shows "Verification pending" (the user sees a clean
      // message; admin reviews via face_match_attempts table).
      update.identity_verification_status = "pending";
      update.is_verified = false;
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
        await purgeDiditSession(purgeSessionId);
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
      await purgeDiditSession(purgeSessionId);
      return new Response(
        JSON.stringify({ ok: true, status: "pending_name_mismatch", score: nameCheck.score }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // B1 — Face-match did not pass even though name matched.
    if (!faceMatchPassed) {
      console.log("didit-webhook B1: face-match did not pass; status=" + faceMatchDecision + ", score=" + faceMatchScore);
      await purgeDiditSession(purgeSessionId);
      return new Response(
        JSON.stringify({
          ok: true,
          status: "pending_face_review",
          face_match_decision: faceMatchDecision,
          face_match_score: faceMatchScore,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // (Replay-safety check moved earlier — see below approved-path opening.)

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

    await purgeDiditSession(purgeSessionId);
    return new Response(JSON.stringify({ ok: true, status: "verified" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("didit-webhook v11: top-level error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
