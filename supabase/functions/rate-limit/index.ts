// @ts-nocheck
// Supabase Edge Function: Rate Limiting (v2 — Postgres-backed)
//
// SECURITY MODEL
// --------------
// - Verifies caller identity via JWT.sub (cribbed from notify-admin-report).
//   Falls back to client IP when no JWT (login/signup pre-auth flows).
// - Uses SUPABASE_SERVICE_ROLE_KEY to call the atomic check_rate_limit RPC,
//   which is RLS-protected (no policies → only service role can read/write
//   the rate_limits table).
//
// STORAGE
// -------
// Postgres-backed via public.check_rate_limit() defined in
// supabase/migrations/20260527120000_create_rate_limits_table.sql.
// Replaces the prior in-memory Map<> which was per-isolate (broken).
//
// FAIL MODE
// ---------
// Fail-OPEN on RPC errors: if the rate-limit infrastructure is down, allow
// the request through. Trade-off: brief abuse window during DB outages.
// For a dating app, locking legitimate users out during an incident is
// worse than a few minutes of unlimited login attempts. Logged so we can
// alert on it separately.
//
// CALL CONTRACT (for client wiring — Phase 2)
// -------------------------------------------
//   POST /functions/v1/rate-limit
//   Authorization: Bearer <user-jwt>   (optional — falls back to IP)
//   Body: { "action": "LOGIN_ATTEMPTS" | "SIGNUP_ATTEMPTS" | ... }
//   Returns:
//     200 { allowed: true,  remaining: N, reset_at: "..." }
//     429 { allowed: false, error: "rate_limited", retry_after: <seconds> }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ALLOWED_ORIGINS = new Set([
  "https://www.marryzen.com",
  "https://marryzen.com",
]);

function buildCors(origin: string | null) {
  const isMarryzen = !!origin && (
    ALLOWED_ORIGINS.has(origin) ||
    /^https:\/\/marryzen-[a-z0-9-]+\.vercel\.app$/i.test(origin)
  );
  return {
    "Access-Control-Allow-Origin": isMarryzen ? origin! : "https://www.marryzen.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Vary": "Origin",
  };
}

// NOTE: this decodes the JWT payload WITHOUT verifying the signature.
// Risk for the rate-limit context is low: a forged `sub` only lets an
// attacker fill *their chosen* user-bucket (not bypass it), and we're
// fail-open anyway. If you ever switch to fail-closed, swap to a
// jose-based verify against SUPABASE_JWT_SECRET. Same convention as
// notify-admin-report.v2.ts.
function jwtSub(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 = b64.padEnd(b64.length + (4 - pad), "=");
    const payload = JSON.parse(atob(b64));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

// Resolve a TRUSTED client IP. `x-forwarded-for` is client-controllable,
// so we prefer headers set by the platform (cf-connecting-ip on
// Cloudflare, x-real-ip on Supabase edge) and fall back to the LAST hop
// of XFF (which is the closest proxy, not the spoofable first hop).
function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return "unknown";
}

// Per-action rate-limit config. (limit, windowSeconds) — user vs IP scope.
// Logged-in callers get more headroom than anonymous IPs.
const LIMITS = {
  LOGIN_ATTEMPTS:   { user: [20,  3600], ip: [10,  3600] },
  SIGNUP_ATTEMPTS:  { user: [10,  3600], ip: [5,   3600] },
  MESSAGE_SEND:     { user: [20,  60],   ip: [30,  60]   }, // 20/min user, 30/min IP. T&S exec: client throttles ~10/min via 6s spacing, so 2x headroom. IP cap >= user cap (NAT/shared wifi rule).
  LIKE:             { user: [30,  60],   ip: [60,  60]   }, // 30/min user, 60/min IP. T&S exec: 3x headroom over client rapid-like 10/min. IP cap >= user cap. Primary defense against enumeration of <100-user table by scripted attacker.
  PROFILE_VIEW:     { user: [50,  3600], ip: [200, 3600] },
  SEARCH:           { user: [30,  3600], ip: [200, 3600] },
  REPORT_SUBMIT:    { user: [10,  3600], ip: [5,   3600] }, // anti-griefing on reports
  API_REQUEST:      { user: [100, 3600], ip: [200, 3600] }, // catch-all
} as const;

type RateAction = keyof typeof LIMITS;

function isValidAction(a: string): a is RateAction {
  return Object.prototype.hasOwnProperty.call(LIMITS, a);
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const CORS = buildCors(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "Method Not Allowed" }, { status: 405, headers: CORS });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("rate-limit: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env");
    return Response.json({ error: "Server misconfigured" }, { status: 500, headers: CORS });
  }

  // Cap body size to 1 KB — this endpoint only takes a small JSON object.
  const lenHeader = req.headers.get("content-length");
  if (lenHeader && parseInt(lenHeader, 10) > 1024) {
    return Response.json({ error: "Payload Too Large" }, { status: 413, headers: CORS });
  }

  // Parse + validate body.
  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
  }
  const action = String(body.action || "API_REQUEST");
  if (!isValidAction(action)) {
    return Response.json({ error: `Unknown action: ${action}` }, { status: 400, headers: CORS });
  }

  // Identify caller — prefer JWT.sub, fall back to trusted client IP.
  // Note: clientIp() trusts platform headers and the LAST hop of XFF;
  // see its docblock above for why.
  const userId = jwtSub(req.headers.get("authorization"));
  const ip = clientIp(req);
  const identifier = userId ?? `ip:${ip}`;
  const [limit, windowSec] = userId ? LIMITS[action].user : LIMITS[action].ip;

  // Call the atomic RPC.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_identifier: identifier,
    p_rate_type: action,
    p_limit: limit,
    p_window_seconds: windowSec,
  });

  if (error) {
    console.error("rate-limit: check_rate_limit RPC failed:", error.message);
    // Fail-OPEN. See header comment for rationale.
    return Response.json({ allowed: true, fail_open: true }, { status: 200, headers: CORS });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return Response.json({ allowed: true, fail_open: true }, { status: 200, headers: CORS });
  }

  const headers = {
    ...CORS,
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, limit - row.current_count)),
    "X-RateLimit-Reset": String(Math.floor(new Date(row.reset_at).getTime() / 1000)),
    "Content-Type": "application/json",
  };

  if (!row.allowed) {
    return new Response(
      JSON.stringify({
        allowed: false,
        error: "rate_limited",
        message: `Too many ${action} requests. Retry in ${row.retry_after}s.`,
        retry_after: row.retry_after,
      }),
      { status: 429, headers: { ...headers, "Retry-After": String(row.retry_after) } }
    );
  }

  return new Response(
    JSON.stringify({
      allowed: true,
      remaining: limit - row.current_count,
      reset_at: row.reset_at,
    }),
    { status: 200, headers }
  );
});
// @ts-nocheck
// Supabase Edge Function: Rate Limiting (v2 — Postgres-backed)
//
// SECURITY MODEL
// --------------
// - Verifies caller identity via JWT.sub (cribbed from notify-admin-report).
//   Falls back to client IP when no JWT (login/signup pre-auth flows).
// - Uses SUPABASE_SERVICE_ROLE_KEY to call the atomic check_rate_limit RPC,
//   which is RLS-protected (no policies → only service role can read/write
//   the rate_limits table).
//
// STORAGE
// -------
// Postgres-backed via public.check_rate_limit() defined in
// supabase/migrations/20260527120000_create_rate_limits_table.sql.
// Replaces the prior in-memory Map<> which was per-isolate (broken).
//
// FAIL MODE
// ---------
// Fail-OPEN on RPC errors: if the rate-limit infrastructure is down, allow
// the request through. Trade-off: brief abuse window during DB outages.
// For a dating app, locking legitimate users out during an incident is
// worse than a few minutes of unlimited login attempts. Logged so we can
// alert on it separately.
//
// CALL CONTRACT (for client wiring — Phase 2)
// -------------------------------------------
//   POST /functions/v1/rate-limit
//   Authorization: Bearer <user-jwt>   (optional — falls back to IP)
//   Body: { "action": "LOGIN_ATTEMPTS" | "SIGNUP_ATTEMPTS" | ... }
//   Returns:
//     200 { allowed: true,  remaining: N, reset_at: "..." }
//     429 { allowed: false, error: "rate_limited", retry_after: <seconds> }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ALLOWED_ORIGINS = new Set([
  "https://www.marryzen.com",
  "https://marryzen.com",
]);

function buildCors(origin: string | null) {
  const isMarryzen = !!origin && (
    ALLOWED_ORIGINS.has(origin) ||
    /^https:\/\/marryzen-[a-z0-9-]+\.vercel\.app$/i.test(origin)
  );
  return {
    "Access-Control-Allow-Origin": isMarryzen ? origin! : "https://www.marryzen.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Vary": "Origin",
  };
}

// NOTE: this decodes the JWT payload WITHOUT verifying the signature.
// Risk for the rate-limit context is low: a forged `sub` only lets an
// attacker fill *their chosen* user-bucket (not bypass it), and we're
// fail-open anyway. If you ever switch to fail-closed, swap to a
// jose-based verify against SUPABASE_JWT_SECRET. Same convention as
// notify-admin-report.v2.ts.
function jwtSub(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 = b64.padEnd(b64.length + (4 - pad), "=");
    const payload = JSON.parse(atob(b64));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

// Resolve a TRUSTED client IP. `x-forwarded-for` is client-controllable,
// so we prefer headers set by the platform (cf-connecting-ip on
// Cloudflare, x-real-ip on Supabase edge) and fall back to the LAST hop
// of XFF (which is the closest proxy, not the spoofable first hop).
function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return "unknown";
}

// Per-action rate-limit config. (limit, windowSeconds) — user vs IP scope.
// Logged-in callers get more headroom than anonymous IPs.
const LIMITS = {
  LOGIN_ATTEMPTS:   { user: [20,  3600], ip: [10,  3600] },
  SIGNUP_ATTEMPTS:  { user: [10,  3600], ip: [5,   3600] },
  MESSAGE_SEND:     { user: [60,  60],   ip: [20,  60]   }, // 60/min logged-in; 20/min unauth (defense in depth — chat is auth-gated anyway)
  LIKE:             { user: [120, 60],   ip: [120, 60]   },
  PROFILE_VIEW:     { user: [50,  3600], ip: [200, 3600] },
  SEARCH:           { user: [30,  3600], ip: [200, 3600] },
  REPORT_SUBMIT:    { user: [10,  3600], ip: [5,   3600] }, // anti-griefing on reports
  API_REQUEST:      { user: [100, 3600], ip: [200, 3600] }, // catch-all
} as const;

type RateAction = keyof typeof LIMITS;

function isValidAction(a: string): a is RateAction {
  return Object.prototype.hasOwnProperty.call(LIMITS, a);
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const CORS = buildCors(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "Method Not Allowed" }, { status: 405, headers: CORS });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("rate-limit: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env");
    return Response.json({ error: "Server misconfigured" }, { status: 500, headers: CORS });
  }

  // Cap body size to 1 KB — this endpoint only takes a small JSON object.
  const lenHeader = req.headers.get("content-length");
  if (lenHeader && parseInt(lenHeader, 10) > 1024) {
    return Response.json({ error: "Payload Too Large" }, { status: 413, headers: CORS });
  }

  // Parse + validate body.
  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
  }
  const action = String(body.action || "API_REQUEST");
  if (!isValidAction(action)) {
    return Response.json({ error: `Unknown action: ${action}` }, { status: 400, headers: CORS });
  }

  // Identify caller — prefer JWT.sub, fall back to trusted client IP.
  // Note: clientIp() trusts platform headers and the LAST hop of XFF;
  // see its docblock above for why.
  const userId = jwtSub(req.headers.get("authorization"));
  const ip = clientIp(req);
  const identifier = userId ?? `ip:${ip}`;
  const [limit, windowSec] = userId ? LIMITS[action].user : LIMITS[action].ip;

  // Call the atomic RPC.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_identifier: identifier,
    p_rate_type: action,
    p_limit: limit,
    p_window_seconds: windowSec,
  });

  if (error) {
    console.error("rate-limit: check_rate_limit RPC failed:", error.message);
    // Fail-OPEN. See header comment for rationale.
    return Response.json({ allowed: true, fail_open: true }, { status: 200, headers: CORS });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return Response.json({ allowed: true, fail_open: true }, { status: 200, headers: CORS });
  }

  const headers = {
    ...CORS,
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, limit - row.current_count)),
    "X-RateLimit-Reset": String(Math.floor(new Date(row.reset_at).getTime() / 1000)),
    "Content-Type": "application/json",
  };

  if (!row.allowed) {
    return new Response(
      JSON.stringify({
        allowed: false,
        error: "rate_limited",
        message: `Too many ${action} requests. Retry in ${row.retry_after}s.`,
        retry_after: row.retry_after,
      }),
      { status: 429, headers: { ...headers, "Retry-After": String(row.retry_after) } }
    );
  }

  return new Response(
    JSON.stringify({
      allowed: true,
      remaining: limit - row.current_count,
      reset_at: row.reset_at,
    }),
    { status: 200, headers }
  );
});
