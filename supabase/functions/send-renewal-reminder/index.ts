// supabase/functions/send-renewal-reminder/index.ts
//
// B14 - Daily auto-renewal reminder email job. Called by pg_cron at 09:00 UTC.
//
// Flow:
//   1. Scan profiles where premium_expires_at falls in the T-7 window
//      (between now+6.5d and now+7.5d) OR T-1 window (now+0.5d to now+1.5d)
//      AND is_premium=true.
//   2. For each match, check renewal_reminders_sent jsonb to see if we've
//      already sent the email for this specific period_end + reminder type.
//      Key shape: "<premium_expires_at_iso_date>_<d7|d1>" e.g.
//      "2026-09-15_d7". Idempotent across cron retries.
//   3. If not already sent: build the email + POST to Resend + update the
//      jsonb to record we sent it. If Resend fails, do NOT update the jsonb
//      so the next cron run will retry.
//
// SECURITY:
//   - This function MUST have "Verify JWT with legacy secret" turned OFF in
//     the Supabase Dashboard. It's called by pg_cron with the service-role
//     key (via Vault); no user is logged in.
//   - All writes use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
//
// ENVIRONMENT (auto-injected + your secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  - injected
//   RESEND_API_KEY                            - already set for other emails
//   FROM_EMAIL                                - already set
//   CANCEL_LINK_BASE                          - optional, defaults to https://www.marryzen.com/billing

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Marryzen Billing <alerts@marryzen.com>";
const CANCEL_LINK_BASE = Deno.env.get("CANCEL_LINK_BASE") ?? "https://www.marryzen.com/billing";
const PRICE_LABEL = "$24.99/month";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRenewalDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

function buildEmailHtml(
  reminderType: "d7" | "d1",
  fullName: string,
  renewalDateIso: string,
): { subject: string; html: string } {
  const daysOut = reminderType === "d7" ? 7 : 1;
  const dayWord = reminderType === "d7" ? "7 days" : "24 hours";
  const subject =
    reminderType === "d7"
      ? "Your Marryzen Premium renews in 7 days"
      : "Your Marryzen Premium renews tomorrow";

  const html =
    "<div style=\"font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #1F1F1F;\">" +
    "<h2 style=\"color: #1F1F1F; margin: 0 0 16px;\">Hi " + escapeHtml(fullName || "there") + ",</h2>" +
    "<p style=\"font-size: 16px; line-height: 1.5;\">This is a friendly reminder that your <strong>Marryzen Premium</strong> subscription will automatically renew in <strong>" + dayWord + "</strong>.</p>" +
    "<table style=\"width: 100%; border-collapse: collapse; margin: 24px 0; background: #FAF7F2; border-radius: 12px;\">" +
    "<tr><td style=\"padding: 14px 18px; font-weight: 600; color: #706B67; width: 45%;\">Renewal date</td>" +
    "<td style=\"padding: 14px 18px; color: #1F1F1F;\">" + escapeHtml(formatRenewalDate(renewalDateIso)) + "</td></tr>" +
    "<tr><td style=\"padding: 14px 18px; font-weight: 600; color: #706B67; border-top: 1px solid #E6DCD2;\">Renewal price</td>" +
    "<td style=\"padding: 14px 18px; color: #1F1F1F; border-top: 1px solid #E6DCD2;\"><strong>" + PRICE_LABEL + "</strong></td></tr>" +
    "<tr><td style=\"padding: 14px 18px; font-weight: 600; color: #706B67; border-top: 1px solid #E6DCD2;\">Billing</td>" +
    "<td style=\"padding: 14px 18px; color: #1F1F1F; border-top: 1px solid #E6DCD2;\">Monthly, until canceled</td></tr>" +
    "</table>" +
    "<p style=\"font-size: 15px; line-height: 1.5;\"><strong>Want to keep Premium?</strong> No action needed - your card will be charged on the renewal date and you keep all Premium features.</p>" +
    "<p style=\"font-size: 15px; line-height: 1.5; margin-top: 18px;\"><strong>Want to cancel?</strong> One click below. No phone tree, no retention conversation, no friction.</p>" +
    "<div style=\"text-align: center; margin: 28px 0;\">" +
    "<a href=\"" + escapeHtml(CANCEL_LINK_BASE) + "\" style=\"display: inline-block; background: #1F1F1F; color: #FFFFFF; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;\">Cancel subscription</a>" +
    "</div>" +
    "<p style=\"font-size: 13px; line-height: 1.5; color: #706B67; margin-top: 24px;\">If you cancel within the next " + dayWord + ", you will not be charged. You keep Premium access through " + escapeHtml(formatRenewalDate(renewalDateIso)) + " regardless.</p>" +
    "<hr style=\"border: 0; border-top: 1px solid #E6DCD2; margin: 32px 0 16px;\" />" +
    "<p style=\"font-size: 12px; color: #8A857D; line-height: 1.5;\">This is an automated pre-renewal notice required by U.S. consumer protection laws (FTC negative-option rule + state laws). " +
    "Questions? Email <a href=\"mailto:admin@marryzen.com\" style=\"color: #C85A72;\">admin@marryzen.com</a> - a human responds within one business day.</p>" +
    "<p style=\"font-size: 11px; color: #8A857D; margin-top: 12px;\">CUVAN LLC, Florida, USA. <a href=\"https://www.marryzen.com/billing-terms\" style=\"color: #706B67;\">Billing Terms</a> | <a href=\"https://www.marryzen.com/founding-member-terms\" style=\"color: #706B67;\">Founding Member Terms</a></p>" +
    "</div>";

  return { subject, html };
}

interface ProfileToRemind {
  id: string;
  email: string | null;
  full_name: string | null;
  premium_expires_at: string;
  renewal_reminders_sent: Record<string, string> | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  // This function is intentionally callable without user auth. The cron uses
  // the service role key as a Bearer token; that's all we need.
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("send-renewal-reminder: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response(JSON.stringify({ error: "Service misconfigured" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(supabaseUrl, serviceKey);

  // Compute the two scan windows. We use a +/- 12 hour tolerance around the
  // exact T-7 / T-1 marks so the cron has slack and we don't miss anyone if
  // the cron is delayed. The renewal_reminders_sent jsonb prevents dupes.
  const now = new Date();
  const d7Start = new Date(now.getTime() + (6.5 * 24 * 60 * 60 * 1000)).toISOString();
  const d7End   = new Date(now.getTime() + (7.5 * 24 * 60 * 60 * 1000)).toISOString();
  const d1Start = new Date(now.getTime() + (0.5 * 24 * 60 * 60 * 1000)).toISOString();
  const d1End   = new Date(now.getTime() + (1.5 * 24 * 60 * 60 * 1000)).toISOString();

  const summary = { d7_scanned: 0, d7_sent: 0, d7_skipped: 0, d7_failed: 0,
                    d1_scanned: 0, d1_sent: 0, d1_skipped: 0, d1_failed: 0 };

  for (const win of [
    { type: "d7" as const, start: d7Start, end: d7End },
    { type: "d1" as const, start: d1Start, end: d1End },
  ]) {
    const { data: candidates, error: scanErr } = await sb
      .from("profiles")
      .select("id, email, full_name, premium_expires_at, renewal_reminders_sent")
      .eq("is_premium", true)
      .gte("premium_expires_at", win.start)
      .lt("premium_expires_at", win.end);

    if (scanErr) {
      console.error("send-renewal-reminder: scan failed for", win.type, scanErr);
      continue;
    }

    for (const p of (candidates ?? []) as ProfileToRemind[]) {
      const wKey = win.type === "d7" ? "d7" : "d1";
      summary[`${win.type}_scanned`]++;
      if (!p.email) {
        summary[`${win.type}_skipped`]++;
        console.warn("send-renewal-reminder: profile", p.id, "has no email; skipping");
        continue;
      }
      const reminders = p.renewal_reminders_sent ?? {};
      const dateKey = p.premium_expires_at.slice(0, 10); // YYYY-MM-DD
      const sentKey = dateKey + "_" + wKey;
      if (reminders[sentKey]) {
        summary[`${win.type}_skipped`]++;
        continue;
      }

      const { subject, html } = buildEmailHtml(win.type, p.full_name ?? "", p.premium_expires_at);

      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + RESEND_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: p.email,
            subject,
            html,
          }),
        });

        if (!r.ok) {
          summary[`${win.type}_failed`]++;
          console.error("send-renewal-reminder: Resend failed for", p.id, r.status, await r.text());
          continue;
        }

        // Mark as sent only after Resend confirmed success.
        const newReminders = { ...reminders, [sentKey]: new Date().toISOString() };
        const { error: updErr } = await sb
          .from("profiles")
          .update({ renewal_reminders_sent: newReminders })
          .eq("id", p.id);
        if (updErr) {
          summary[`${win.type}_failed`]++;
          console.error("send-renewal-reminder: profile update failed for", p.id, updErr);
        } else {
          summary[`${win.type}_sent`]++;
        }
      } catch (e) {
        summary[`${win.type}_failed`]++;
        console.error("send-renewal-reminder: exception for", p.id, e);
      }
    }
  }

  console.log("send-renewal-reminder summary:", JSON.stringify(summary));
  return new Response(JSON.stringify({ ok: true, summary }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
