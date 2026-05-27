// supabase/functions/notify-admin-report/index.ts (v2 - hardened post-review)
//
// Sends a Resend email to the safety team when a new T&S report is filed.
// Security model: verify_jwt=true; reporter_id is derived from JWT sub
// (never trusted from client body). CORS pinned to marryzen.com.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ADMIN_REPORT_EMAIL = Deno.env.get("ADMIN_REPORT_EMAIL") ?? "safety@marryzen.com";
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

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const CORS = buildCors(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  }
  if (!RESEND_API_KEY) {
    return Response.json({ error: "RESEND_API_KEY not set" }, { status: 500, headers: CORS });
  }

  const reporterId = jwtSub(req.headers.get("authorization"));
  if (!reporterId) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  }

  let body: {
    reported_user_id?: string;
    reported_user_name?: string;
    reason_category?: string;
    reason_details?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
  }

  const reportedId = String(body.reported_user_id || "").slice(0, 64);
  const reportedName = String(body.reported_user_name || "(unknown)").slice(0, 200);
  const category = String(body.reason_category || "(none)").slice(0, 100);
  const details = String(body.reason_details || "").slice(0, 2000);

  const to = ADMIN_REPORT_EMAIL.split(",").map((s) => s.trim()).filter(Boolean);
  if (to.length === 0) {
    return Response.json({ error: "ADMIN_REPORT_EMAIL has no valid recipients" }, { status: 500, headers: CORS });
  }

  const safetyPanelUrl = "https://www.marryzen.com/admin/safety";
  const subject = "[Marryzen Safety] New report: " + category;
  const html =
    "<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;\">" +
    "<h2 style=\"color: #C85A72; margin-top: 0;\">New T&amp;S Report Filed</h2>" +
    "<p style=\"color: #1F1F1F; font-size: 15px;\">A user has filed a safety report on Marryzen. Please review within 24 hours.</p>" +
    "<table style=\"width: 100%; border-collapse: collapse; margin-top: 16px;\">" +
    "<tr><td style=\"padding: 8px; background: #FAF7F2; font-weight: 600; width: 40%;\">Reported user</td><td style=\"padding: 8px; background: #FFFFFF;\">" + escapeHtml(reportedName) + " <code style=\"font-size: 11px; color: #706B67;\">(" + escapeHtml(reportedId) + ")</code></td></tr>" +
    "<tr><td style=\"padding: 8px; background: #FAF7F2; font-weight: 600;\">Reporter</td><td style=\"padding: 8px; background: #FFFFFF;\"><code style=\"font-size: 11px; color: #706B67;\">" + escapeHtml(reporterId) + "</code></td></tr>" +
    "<tr><td style=\"padding: 8px; background: #FAF7F2; font-weight: 600;\">Category</td><td style=\"padding: 8px; background: #FFFFFF;\">" + escapeHtml(category) + "</td></tr>" +
    "<tr><td style=\"padding: 8px; background: #FAF7F2; font-weight: 600; vertical-align: top;\">Details</td><td style=\"padding: 8px; background: #FFFFFF; white-space: pre-wrap;\">" + escapeHtml(details) + "</td></tr>" +
    "</table>" +
    "<p style=\"margin-top: 24px;\"><a href=\"" + safetyPanelUrl + "\" style=\"background: #E6B450; color: #1F1F1F; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;\">Review in Safety Panel</a></p>" +
    "<p style=\"color: #8A857D; font-size: 12px; margin-top: 24px;\">Sent by Marryzen safety automation. Do not reply to this email.</p>" +
    "</div>";

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  const text = await r.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch (_) {}

  if (!r.ok) {
    return Response.json({ error: "Resend send failed", status: r.status, body: parsed }, { status: 502, headers: CORS });
  }

  return Response.json({ ok: true }, { status: 200, headers: CORS });
});
