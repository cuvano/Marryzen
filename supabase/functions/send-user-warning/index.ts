// @ts-nocheck
// Supabase Edge Function: send-user-warning (v2 — multi-action)
//
// Sends a Resend email to a user from the SafetyPanel. v2 extends v1 to
// cover all three moderation actions a moderator can take:
//
//   action_type: 'warning'    → custom admin message (existing behavior)
//   action_type: 'suspension' → DSA-compliant temporary suspension notice
//   action_type: 'ban'        → DSA-compliant permanent termination notice
//
// Backwards compatible: callers omitting action_type get the v1 warning
// behavior (message field required, suspend_days/unlock_at ignored).
//
// SECURITY MODEL (unchanged from v1)
// ----------------------------------
// - Verifies caller's JWT via Supabase auth.getUser (real signature check).
// - Service role used to look up admin role + target email (bypasses RLS).
// - CORS pinned to marryzen.com + Vercel previews.
//
// REQUEST
//   POST /functions/v1/send-user-warning
//   Authorization: Bearer <admin user JWT>
//   Body:
//     {
//       user_id: string,                                  // target
//       action_type?: 'warning' | 'suspension' | 'ban',   // default 'warning'
//       message?: string,           // required when action_type='warning'
//       suspend_days?: number,      // required when action_type='suspension'
//                                    // (unlock_at is computed server-side as now + suspend_days)
//       user_facing_reason?: string // optional short reason for suspension/ban email
//     }
//
// RESPONSE
//   200 { ok: true, action_type, message_id? }
//   400 invalid body / missing required field for action_type
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

// Format an ISO datetime for display in an email. Example:
// "2026-06-05T17:00:00.000Z" -> "June 5, 2026 at 17:00 UTC"
function formatUnlockDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const month = ["January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"][d.getUTCMonth()];
    const day = d.getUTCDate();
    const year = d.getUTCFullYear();
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${month} ${day}, ${year} at ${hh}:${mm} UTC`;
  } catch {
    return iso;
  }
}

// Build the warning email (v1 behavior, unchanged).
function buildWarningEmail(targetName: string, adminMessage: string) {
  const subject = "[Marryzen] Important: Your account has received a warning";
  const html =
    "<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;\">" +
    "<h2 style=\"color: #C85A72; margin-top: 0;\">A note from Marryzen Safety</h2>" +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">Hi " + escapeHtml(targetName || "there") + ",</p>" +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">A safety report was filed about your recent activity on Marryzen. After review, our team would like to share the following with you:</p>" +
    "<blockquote style=\"border-left: 4px solid #E6B450; background: #FAF7F2; padding: 16px 20px; margin: 20px 0; color: #1F1F1F; white-space: pre-wrap; font-size: 15px; line-height: 1.5;\">" +
    escapeHtml(adminMessage) +
    "</blockquote>" +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">Please review our <a href=\"https://www.marryzen.com/terms\" style=\"color: #C85A72;\">Community Guidelines</a>. Continued violations may result in account suspension or permanent removal.</p>" +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">If you believe this warning was issued in error, you may reply directly to this email or contact <a href=\"mailto:admin@marryzen.com\" style=\"color: #C85A72;\">admin@marryzen.com</a>.</p>" +
    "<p style=\"color: #1F1F1F; font-size: 15px;\">— The Marryzen Safety Team</p>" +
    "<p style=\"color: #8A857D; font-size: 12px; margin-top: 32px;\">Sent by Marryzen safety automation in response to a moderator action.</p>" +
    "</div>";
  return { subject, html };
}

// Build the suspension email. DSA Article 17 compliant: decision type,
// scope, plain-language reason, legal basis (our ToS), human-reviewer
// disclosure, redress options (reply-to-admin + out-of-court + judicial),
// decision date.
function buildSuspensionEmail(targetName: string, suspendDays: number, unlockAt: string, userFacingReason: string) {
  const subject = `Your Marryzen account is suspended for ${suspendDays} day${suspendDays === 1 ? "" : "s"}`;
  const unlockHuman = formatUnlockDate(unlockAt);
  const today = formatUnlockDate(new Date().toISOString());
  const reasonLine = userFacingReason
    ? "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\"><strong>Reason:</strong> " + escapeHtml(userFacingReason) + " This violates our <a href=\"https://www.marryzen.com/terms\" style=\"color: #C85A72;\">Community Guidelines</a>.</p>"
    : "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\"><strong>Reason:</strong> Violation of our <a href=\"https://www.marryzen.com/terms\" style=\"color: #C85A72;\">Community Guidelines</a> following a safety report filed about your account.</p>";

  const html =
    "<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;\">" +
    "<h2 style=\"color: #C85A72; margin-top: 0;\">Account suspended</h2>" +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">Hi " + escapeHtml(targetName || "there") + ",</p>" +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">Your Marryzen account has been <strong>suspended for " + suspendDays + " day" + (suspendDays === 1 ? "" : "s") + "</strong> following a review by our Trust &amp; Safety team on " + escapeHtml(today) + ". This decision was reviewed by a human moderator.</p>" +
    reasonLine +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">You will be able to sign in again on <strong>" + escapeHtml(unlockHuman) + "</strong>. Your profile and matches are preserved during the suspension.</p>" +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">If you believe this decision was made in error, you may reply to this email within 14 days with any information you'd like a moderator to consider. You may also pursue out-of-court dispute resolution or judicial remedies available in your jurisdiction.</p>" +
    "<p style=\"color: #1F1F1F; font-size: 15px;\">— The Marryzen Safety Team</p>" +
    "<p style=\"color: #8A857D; font-size: 12px; margin-top: 32px;\">CUVAN LLC, Florida, USA. Sent by Marryzen safety automation in response to a moderator action.</p>" +
    "</div>";
  return { subject, html };
}

// Build the ban email. DSA Article 17 compliant. Note we do NOT promise
// re-activation or data return; data is retained per our Privacy Policy.
function buildBanEmail(targetName: string, userFacingReason: string) {
  const subject = "Your Marryzen account has been permanently closed";
  const today = formatUnlockDate(new Date().toISOString());
  const reasonLine = userFacingReason
    ? "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\"><strong>Reason:</strong> " + escapeHtml(userFacingReason) + "</p>"
    : "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\"><strong>Reason:</strong> Violation of our <a href=\"https://www.marryzen.com/terms\" style=\"color: #C85A72;\">Community Guidelines</a> following a safety report.</p>";

  const html =
    "<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;\">" +
    "<h2 style=\"color: #C85A72; margin-top: 0;\">Account permanently closed</h2>" +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">Hi " + escapeHtml(targetName || "there") + ",</p>" +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">Following a review by our Trust &amp; Safety team on " + escapeHtml(today) + ", your Marryzen account has been <strong>permanently closed</strong> for violating our <a href=\"https://www.marryzen.com/terms\" style=\"color: #C85A72;\">Community Guidelines</a>. This decision was reviewed by a human moderator.</p>" +
    reasonLine +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">Account data is handled in accordance with our <a href=\"https://www.marryzen.com/privacy\" style=\"color: #C85A72;\">Privacy Policy</a>. You will not be able to create a new Marryzen account.</p>" +
    "<p style=\"color: #1F1F1F; font-size: 15px; line-height: 1.5;\">If you believe this decision was made in error, you may reply to this email within 14 days with information you'd like a moderator to review. You may also seek out-of-court dispute resolution or judicial remedies in your jurisdiction.</p>" +
    "<p style=\"color: #1F1F1F; font-size: 15px;\">— The Marryzen Safety Team</p>" +
    "<p style=\"color: #8A857D; font-size: 12px; margin-top: 32px;\">CUVAN LLC, Florida, USA. Sent by Marryzen safety automation in response to a moderator action.</p>" +
    "</div>";
  return { subject, html };
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

  const adminId = await verifiedCallerId(req.headers.get("authorization"));
  if (!adminId) {
    return Response.json({ error: "unauthenticated" }, { status: 401, headers: CORS });
  }

  let body: {
    user_id?: string;
    action_type?: string;
    message?: string;
    suspend_days?: number;
    unlock_at?: string;
    user_facing_reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
  }

  const targetUserId = String(body.user_id || "").trim();
  if (!targetUserId) {
    return Response.json({ error: "user_id is required" }, { status: 400, headers: CORS });
  }

  // Default to 'warning' for backward compat with the existing v1 callers.
  const actionType = String(body.action_type || "warning").toLowerCase();
  if (!["warning", "suspension", "ban"].includes(actionType)) {
    return Response.json({ error: `Unknown action_type: ${actionType}` }, { status: 400, headers: CORS });
  }

  // Per-action validation BEFORE doing any DB work.
  let adminMessage = "";
  let suspendDays = 0;
  let unlockAt = "";
  const userFacingReasonRaw = String(body.user_facing_reason || "").trim();
  if (userFacingReasonRaw.length > 500) {
    return Response.json({ error: "user_facing_reason too long (max 500 chars)" }, { status: 400, headers: CORS });
  }
  const userFacingReason = userFacingReasonRaw;

  if (actionType === "warning") {
    adminMessage = String(body.message || "").trim();
    if (!adminMessage) {
      return Response.json({ error: "message is required for action_type=warning" }, { status: 400, headers: CORS });
    }
    if (adminMessage.length > 4000) {
      return Response.json({ error: "message too long" }, { status: 400, headers: CORS });
    }
  } else if (actionType === "suspension") {
    suspendDays = Number(body.suspend_days);
    if (!Number.isFinite(suspendDays) || suspendDays < 1 || suspendDays > 365) {
      return Response.json({ error: "suspend_days must be 1-365" }, { status: 400, headers: CORS });
    }
    // Server-compute unlockAt so a malicious client can't say "suspended 7d"
    // but show the user "unlocks in 2099". Single source of truth.
    unlockAt = new Date(Date.now() + suspendDays * 24 * 60 * 60 * 1000).toISOString();
  }
  // 'ban' has no extra required fields beyond user_id.

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

  // Compose email based on action_type
  let email: { subject: string; html: string };
  if (actionType === "warning") {
    email = buildWarningEmail(target.full_name || "", adminMessage);
  } else if (actionType === "suspension") {
    email = buildSuspensionEmail(target.full_name || "", suspendDays, unlockAt, userFacingReason);
  } else {
    email = buildBanEmail(target.full_name || "", userFacingReason);
  }

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
      subject: email.subject,
      html: email.html,
    }),
  });

  if (!r.ok) {
    let parsed: unknown;
    try { parsed = await r.json(); } catch { parsed = await r.text(); }
    console.error("send-user-warning: Resend send failed:", r.status, parsed);
    return Response.json({ error: "Resend send failed", status: r.status }, { status: 502, headers: CORS });
  }

  let resendResp: { id?: string } = {};
  try { resendResp = await r.json(); } catch {}

  return Response.json(
    { ok: true, action_type: actionType, message_id: resendResp.id || null },
    { status: 200, headers: CORS }
  );
});
