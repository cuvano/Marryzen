// supabase/functions/send-verification-result/index.ts
//
// Phase 52 — Verification result emails (approved / rejected)
//
// Two modes, selected by request body:
//
//   1) Instant mode: POST { mode: "instant", user_id, decision, reason? }
//      Sends the matching email immediately. Used by didit-webhook v12 for
//      approved results (no delay).
//
//   2) Queue mode: POST { mode: "queue" }
//      Called by pg_cron every 5 minutes. Scans pending_verification_rejections
//      for due rows (fire_at <= now() AND not sent/canceled). For each row:
//        - if user is now is_verified=true → cancel (Didit auto-retry resolved)
//        - else → send rejection email + mark sent_at
//
// Cron secret header X-Cron-Secret protects against unauthenticated POSTs.
//
// Reasons (rejection branch):
//   - 'name_mismatch'    → "name on ID didn't match" template
//   - 'document_quality' → generic "we need another look" template
//
// Author: Claude / Marryzen agent, 2026-06-12
// @ts-nocheck

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------- Env + constants ----------

// S2 2026-06-12: CRON_SECRET is coupled to didit-webhook v12's triggerVerificationEmail
// (it sends this header on the approved-instant call). When rotating, deploy
// BOTH functions with the new env var simultaneously or the instant call returns 401.
const CRON_SECRET_ENV = Deno.env.get("CRON_SECRET");
if (!CRON_SECRET_ENV) {
  console.warn("send-verification-result: CRON_SECRET env var not set; using literal fallback. ROTATE BEFORE LAUNCH (coordinate with didit-webhook env).");
}
const CRON_SECRET    = CRON_SECRET_ENV ?? "marryzen-cron-2026";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_INSTITUTIONAL = "Marryzen <noreply@marryzen.com>";
const APP_URL = "https://www.marryzen.com";
const QUEUE_BATCH_SIZE = 25;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------- Helpers ----------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(fullName: string | null | undefined): string {
  if (!fullName) return "there";
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

// ---------- HTML templates ----------

const BRAND_PRIMARY = "#C85A72";
const BRAND_GOLD    = "#E6B450";
const BRAND_INK     = "#1F1F1F";
const BRAND_MUTED   = "#706B67";
const BRAND_CREAM   = "#FAF7F2";

function emailShell(innerHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${BRAND_CREAM};font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND_INK}">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND_CREAM};padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #E6DCD2;border-radius:14px;padding:32px">
        <tr><td>
          <div style="font-size:24px;font-weight:800;color:${BRAND_INK};letter-spacing:-0.5px;margin-bottom:24px">Marryzen<span style="color:${BRAND_PRIMARY}">.</span></div>
          ${innerHtml}
        </td></tr>
        <tr><td style="padding-top:28px;border-top:1px solid #E6DCD2;margin-top:24px">
          <p style="color:${BRAND_MUTED};font-size:12px;line-height:1.6;margin:16px 0 0">&mdash; Marryzen</p>
          <p style="color:${BRAND_MUTED};font-size:11px;line-height:1.6;margin:12px 0 0">CUVAN LLC (operating Marryzen). You&rsquo;re receiving this because you signed up at marryzen.com.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND_GOLD};color:${BRAND_INK};font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px">${label}</a>`;
}

function approvedEmail(name: string): string {
  const inner = `<h1 style="font-size:22px;font-weight:700;color:${BRAND_INK};margin:0 0 16px">You&rsquo;re verified</h1>
<p style="font-size:16px;line-height:1.7;color:${BRAND_INK};margin:0 0 16px">Hi ${name},</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_INK};margin:0 0 16px">Your identity has been verified.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_INK};margin:0 0 16px">You now have a verified badge on your profile, and you&rsquo;ll see verified badges on every member you&rsquo;re matched with. That&rsquo;s the standard &mdash; and you just helped uphold it.</p>
<p style="margin:0 0 24px">${btn(APP_URL + "/profile", "View your profile")}</p>`;
  return emailShell(inner);
}

function rejectedQualityEmail(name: string): string {
  const inner = `<h1 style="font-size:22px;font-weight:700;color:${BRAND_INK};margin:0 0 16px">We need another look at your ID</h1>
<p style="font-size:16px;line-height:1.7;color:${BRAND_INK};margin:0 0 16px">Hi ${name},</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_INK};margin:0 0 16px">We weren&rsquo;t able to verify your identity from the documents submitted. This is almost always a quality issue &mdash; a blurry photo, glare on the ID, or a document type our partner doesn&rsquo;t yet support.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_INK};margin:0 0 16px">It&rsquo;s not a judgment, and your account remains active.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_INK};margin:0 0 16px">A few tips that usually fix it on the second try:</p>
<ul style="font-size:16px;line-height:1.8;color:${BRAND_INK};margin:0 0 16px;padding-left:20px">
  <li>Good lighting, no glare</li>
  <li>The full document inside the frame</li>
  <li>A passport or government-issued ID rather than a temporary card</li>
</ul>
<p style="font-size:16px;line-height:1.7;color:${BRAND_INK};margin:0 0 24px">If you&rsquo;ve tried twice and it&rsquo;s still not working, email <a href="mailto:support@marryzen.com" style="color:${BRAND_PRIMARY}">support@marryzen.com</a> with the timestamp of your retry attempt and we&rsquo;ll help.</p>
<p style="margin:0 0 24px">${btn(APP_URL + "/verify", "Try again")}</p>`;
  return emailShell(inner);
}

function rejectedNameMismatchEmail(name: string): string {
  const inner = `<h1 style="font-size:22px;font-weight:700;color:${BRAND_INK};margin:0 0 16px">Quick fix &mdash; the name on your ID</h1>
<p style="font-size:16px;line-height:1.7;color:${BRAND_INK};margin:0 0 16px">Hi ${name},</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_INK};margin:0 0 16px">Your document was readable, but the name on your ID didn&rsquo;t match the name on your Marryzen profile.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_INK};margin:0 0 16px">If you go by a different name day-to-day (maiden name, transliteration, nickname), update your profile to match your government ID exactly, then retry verification. We use the matching to keep impersonation off the platform.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_INK};margin:0 0 24px">If you&rsquo;ve already retried and still hit a wall, email <a href="mailto:support@marryzen.com" style="color:${BRAND_PRIMARY}">support@marryzen.com</a> with the timestamp of your last attempt.</p>
<p style="margin:0 0 24px">${btn(APP_URL + "/profile", "Edit your profile")}</p>`;
  return emailShell(inner);
}

// ---------- Resend send ----------

async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY not set" };
  if (!opts.to) return { ok: false, error: "no recipient" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_INSTITUTIONAL, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { ok: false, error: `Resend HTTP ${r.status} ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Resend threw: ${String(e).slice(0, 200)}` };
  }
}

// ---------- Subject + template pickers ----------

function pickSubject(decision: string, reason: string | null | undefined): string {
  if (decision === "approved") return "You're verified";
  if (reason === "name_mismatch") return "Quick fix — the name on your ID";
  return "We need another look at your ID";
}

function pickHtml(decision: string, reason: string | null | undefined, name: string): string {
  const escaped = escapeHtml(name);
  if (decision === "approved") return approvedEmail(escaped);
  if (reason === "name_mismatch") return rejectedNameMismatchEmail(escaped);
  return rejectedQualityEmail(escaped);
}

// ---------- Mode: instant send ----------

async function handleInstant(sb: ReturnType<typeof createClient>, body: { user_id: string; decision: string; reason?: string | null }) {
  if (!body.user_id || !body.decision) {
    return new Response(JSON.stringify({ error: "missing user_id or decision" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", body.user_id)
    .maybeSingle();
  if (pErr || !profile?.email) {
    return new Response(JSON.stringify({ ok: false, error: "profile_or_email_missing" }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const name = firstName(profile.full_name as string | null | undefined);
  const subject = pickSubject(body.decision, body.reason);
  const html = pickHtml(body.decision, body.reason, name);

  const res = await sendEmail({ to: profile.email as string, subject, html });
  return new Response(JSON.stringify({ ok: res.ok, error: res.error }), {
    status: res.ok ? 200 : 500,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ---------- Mode: queue processor ----------

async function handleQueue(sb: ReturnType<typeof createClient>) {
  const nowIso = new Date().toISOString();
  const { data: due, error: qErr } = await sb
    .from("pending_verification_rejections")
    .select("id, user_id, reason")
    .lte("fire_at", nowIso)
    .is("sent_at", null)
    .is("canceled_at", null)
    .order("fire_at", { ascending: true })   // S3 2026-06-12: prevent starvation under load
    .limit(QUEUE_BATCH_SIZE);

  if (qErr) {
    console.error("send-verification-result: queue scan failed:", qErr.message);
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const summary = { due: (due ?? []).length, sent: 0, canceled: 0, errors: 0 };
  const errors: string[] = [];

  for (const row of (due ?? [])) {
    const { data: profile, error: pErr } = await sb
      .from("profiles")
      .select("id, email, full_name, status, is_verified, identity_verification_status")
      .eq("id", row.user_id)
      .maybeSingle();

    if (pErr || !profile) {
      summary.errors++;
      errors.push(`${row.id}: profile lookup failed`);
      continue;
    }

    // S1 2026-06-12: don't email banned/suspended users — they've been removed
    // from the platform and a "try again" CTA is confusing T&S signal.
    const status = (profile.status as string | null | undefined)?.toLowerCase?.() ?? "";
    if (status === "banned" || status === "suspended") {
      await sb
        .from("pending_verification_rejections")
        .update({ canceled_at: nowIso, cancel_reason: "user_" + status + "_during_delay" })
        .eq("id", row.id);
      summary.canceled++;
      continue;
    }

    // Cancel if user has since become verified (Didit auto-retry or admin override)
    if (profile.is_verified === true || profile.identity_verification_status === "verified") {
      await sb
        .from("pending_verification_rejections")
        .update({ canceled_at: nowIso, cancel_reason: "user_verified_during_delay" })
        .eq("id", row.id);
      summary.canceled++;
      continue;
    }

    if (!profile.email) {
      await sb
        .from("pending_verification_rejections")
        .update({ canceled_at: nowIso, cancel_reason: "no_email_on_profile" })
        .eq("id", row.id);
      summary.canceled++;
      continue;
    }

    const name = firstName(profile.full_name as string | null | undefined);
    const subject = pickSubject("rejected", row.reason);
    const html = pickHtml("rejected", row.reason, name);

    const res = await sendEmail({ to: profile.email as string, subject, html });
    if (!res.ok) {
      summary.errors++;
      errors.push(`${row.id}: ${res.error}`);
      continue;
    }

    await sb
      .from("pending_verification_rejections")
      .update({ sent_at: nowIso })
      .eq("id", row.id);
    summary.sent++;
  }

  return new Response(JSON.stringify({ ok: true, summary, errors: errors.slice(0, 10) }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ---------- Main handler ----------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  const provided = req.headers.get("x-cron-secret") || req.headers.get("X-Cron-Secret");
  if (CRON_SECRET && provided !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let body: { mode?: string; user_id?: string; decision?: string; reason?: string | null } = {};
  try {
    body = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "supabase env missing" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  if (body.mode === "queue") return await handleQueue(sb);
  if (body.mode === "instant") return await handleInstant(sb, body as any);

  return new Response(JSON.stringify({ error: "unknown_mode" }), {
    status: 400, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
