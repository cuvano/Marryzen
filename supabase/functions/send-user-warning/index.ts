// @ts-nocheck
// Supabase Edge Function: send-user-warning
//
// Sends a Resend email warning to a user, called by an admin from the
// SafetyPanel. Records nothing in the DB (the admin's UI flow does that
// separately via user_reports update).
//
// SECURITY MODEL
// --------------
// - Verifies caller's JWT via Supabase auth.getUser (real signature check,
//   not just payload decoding — closes the forged-token risk).
// - Uses SUPABASE_SERVICE_ROLE_KEY to look up the admin's role and the
//   target user's email (RLS would otherwise restrict).
// - CORS pinned to marryzen.com + Vercel previews (same pattern as the
//   other Edge Functions).
//
// REQUEST
//   POST /functions/v1/send-user-warning
//   Authorization: Bearer <admin user JWT>
//   Body: { user_id: string, message: string }
//
// RESPONSE
//   200 { ok: true }
//   400 invalid body
//   401 unauthenticated
//   403 caller is not an admin
//   404 target user not found / no email
//   502 Resend send failed
//   500 misconfigured

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Marryzen Safety <alerts@marryzen.com>";

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Verify the caller's JWT against the project secret using supabase-js.
// Returns the verified user ID, or null if the token is missing/invalid/forged.
async function verifiedCallerId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anonClient.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch (e) {
    console.error("verifiedCallerId: getUser failed:", (e as Error).message);
    return null;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const CORS = buildCors(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return Response.json({ error: "Server misconfigured" }, { status: 500, headers: CORS });
  }

  // Verify the caller's JWT against the Supabase project secret.
  // Plain payload-decoding (jwtSub) would allow forged tokens to pass —
  // a serious risk for a function that sends emails impersonating Marryzen
  // Safety. Real verification via auth.getUser closes that hole.
  const adminId = await verifiedCallerId(req.headers.get("authorization"));
  if (!adminId) {
    return Response.json({ error: "unauthenticated" }, { status: 401, headers: CORS });
  }

  // Parse body
  let body: { user_id?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
  }
  const targetUserId = String(body.user_id || "").trim();
  const adminMessage = String(body.message || "").trim();
  if (!targetUserId || !adminMessage) {
    return Response.json({ error: "user_id and message are required" }, { status: 400, headers: CORS });
  }
  if (adminMessage.length > 4000) {
    return Response.json({ error: "message too long" }, { status: 400, headers: CORS });
  }

  // Use service role to confirm admin AND look up target email
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify caller is admin or super_admin
  const { data: adminProfile, error: adminLookupErr } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", adminId)
    .maybeSingle();

  if (adminLookupErr) {
    console.error("send-user-warning: admin lookup failed:", adminLookupErr.message);
    return Response.json({ error: "Server error" }, { status: 500, headers: CORS });
  }
  const adminRole = (adminProfile?.role || "").toLowerCase();
  if (!["admin", "super_admin"].includes(adminRole)) {
    return Response.json({ error: "forbidden — admin role required" }, { status: 403, headers: CORS });
  }

  // Look up target user's email + name
  const { data: target, error: targetErr } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", targetUserId)
    .maybeSingle();

  if (targetErr) {
    console.error("send-user-warning: target lookup failed:", targetErr.message);
    return Response.json({ error: "Server error" }, { status: 500, headers: CORS });
  }
  if (!target || !target.email) {
    return Response.json({ error: "Target user not found or has no email" }, { status: 404, headers: CORS });
  }

  // Compose email
  const subject = "[Marryzen] Important: Your account has received a warning";
  const html =
    "<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;\">" +
    "<h2 style=\"color: #C85A72; margin-top: 0;\">A note from Marryzen Safety</h2>" +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">Hi " + escapeHtml(target.full_name || "there") + ",</p>" +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">A safety report was filed about your recent activity on Marryzen. After review, our team would like to share the following with you:</p>" +
    "<blockquote style=\"border-left: 4px solid #E6B450; background: #FAF7F2; padding: 16px 20px; margin: 20px 0; color: #1F1F1F; white-space: pre-wrap; font-size: 15px; line-height: 1.5;\">" +
    escapeHtml(adminMessage) +
    "</blockquote>" +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">Please review our <a href=\"https://www.marryzen.com/community-guidelines\" style=\"color: #C85A72;\">Community Guidelines</a>. Continued violations may result in account suspension or permanent removal.</p>" +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">If you believe this warning was issued in error, you may reply directly to this email or contact <a href=\"mailto:admin@marryzen.com\" style=\"color: #C85A72;\">admin@marryzen.com</a>.</p>" +
    "<p style=\"color: #1F1F1F; font-size: 15px;\">— The Marryzen Safety Team</p>" +
    "<p style=\"color: #8A857D; font-size: 12px; margin-top: 32px;\">Sent by Marryzen safety automation in response to a moderator action.</p>" +
    "</div>";

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [target.email],
      reply_to: "admin@marryzen.com",
      subject,
      html,
    }),
  });

  if (!r.ok) {
    let parsed: unknown;
    try { parsed = await r.json(); } catch { parsed = await r.text(); }
    console.error("send-user-warning: Resend send failed:", r.status, parsed);
    return Response.json({ error: "Resend send failed", status: r.status }, { status: 502, headers: CORS });
  }

  return Response.json({ ok: true }, { status: 200, headers: CORS });
});
