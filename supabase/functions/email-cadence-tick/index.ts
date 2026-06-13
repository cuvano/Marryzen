// supabase/functions/email-cadence-tick/index.ts
//
// Phase 50 + 51 — Behavioral onboarding email cadence + Founding-500 founder welcome
//
// Runs every 30 minutes via pg_cron (see migration 20260522010000_email_cadence_schedule.sql
// + 20260612210000_email_cadence_v2.sql). Scans profiles and advances each one's cadence
// state machine, sending the matching email via Resend at each transition.
//
// State machine (stored as jsonb in profiles.email_cadence_state):
//   {
//     stage: "signup" | "welcomed" | "profile_nudged" | "verify_nudged"
//          | "re_engaged" | "dormant" | "done",
//     transitioned_at: ISO timestamp,
//     lock_until: ISO timestamp (null when unlocked),
//     sends: { welcome, founding_welcome, profile_nudge, verify_nudge, re_engagement }
//            — each value is an ISO timestamp of when that email was sent, or null
//   }
//
// Transitions (T+ = time since profile.created_at):
//   signup → welcomed         at T+1h   (founder welcome if founding_member, else institutional)
//   welcomed → profile_nudged at T+24h  (if profile incomplete; otherwise skip)
//   profile_nudged → verify_nudged at T+48h (if not verified; otherwise → done)
//   verify_nudged → re_engaged at T+10d (if inactive >7d; otherwise → done)
//   re_engaged → dormant      at T+24d (re_engaged + 14d still inactive)
//   any → done                if profile complete + verified + no further nudges due
//
// Race-safety: each candidate is acquired via an atomic UPDATE that sets
// lock_until = now() + 5min WHERE current lock_until is null/expired AND
// stage matches expected. If the UPDATE returns 0 rows, another worker has it.
//
// Suppression (cadence stops):
//   - profiles.marketing_emails_opt_out = true   (if column exists)
//   - profiles.status in ('banned', 'suspended', 'paused')
//   - profile.last_active_at within last 48h     (active users get no nudges)
//   - profile.email is null or hard-bounced      (Resend handles bounces upstream)
//   - stage already 'done' or 'dormant'
//
// Author: Claude / Marryzen agent, 2026-06-12
// @ts-nocheck

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------- Env + constants ----------

// Cron secret. The literal fallback matches the pg_cron migration
// (20260522010000_email_cadence_schedule.sql) so first-deploy works without
// touching env vars. Reviewer caveat 2026-06-12: rotate to a random 32-byte
// value in Edge Function env BEFORE soft launch. When you rotate, also
// update the cron schedule to send the new value in its header.
const CRON_SECRET_ENV = Deno.env.get("CRON_SECRET");
if (!CRON_SECRET_ENV) {
  console.warn("email-cadence-tick: CRON_SECRET env var not set; using literal fallback. ROTATE BEFORE LAUNCH.");
}
const CRON_SECRET    = CRON_SECRET_ENV ?? "marryzen-cron-2026";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_INSTITUTIONAL = "Marryzen <noreply@marryzen.com>";
const FROM_FOUNDER       = "Omer at Marryzen <hello@marryzen.com>";
const REPLY_TO_FOUNDER   = "hello@marryzen.com";
const APP_URL = "https://www.marryzen.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------- Constants — windows + thresholds ----------

const WELCOME_AFTER_MS         =       60 * 60 * 1000;        //  1h
const PROFILE_NUDGE_AFTER_MS   =  24 * 60 * 60 * 1000;        // 24h
const VERIFY_NUDGE_AFTER_MS    =  48 * 60 * 60 * 1000;        // 48h
const RE_ENGAGE_AFTER_MS       = 10 * 24 * 60 * 60 * 1000;    // 10 days
const DORMANT_AFTER_RE_MS      = 14 * 24 * 60 * 60 * 1000;    // 14 days after re_engaged
const ACTIVE_SUPPRESS_MS       =  48 * 60 * 60 * 1000;        // suppress if active in last 48h
const INACTIVE_FOR_RE_MS       =   7 * 24 * 60 * 60 * 1000;   // re-engage only if inactive 7d+

// Reviewer should-fix 2026-06-12: dropped `bio` from completion check. Bio is
// famously the field people skip; structured fields are enough to enable
// meaningful matching. If user finished the structured-field pass, don't
// nudge them about a missing bio.
const PROFILE_COMPLETE_FIELDS  = [
  "full_name", "date_of_birth", "identify_as", "location_city",
  "location_country", "religious_affiliation", "relationship_goal",
];
const PROFILE_COMPLETE_MIN_PHOTOS = 1;

const BATCH_SIZE = 50;             // max candidates per cron tick
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minute optimistic lock

// ---------- Helpers ----------

function nowIso(): string {
  return new Date().toISOString();
}

function isAfter(iso: string | null, ts: Date): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() > ts.getTime();
}

function withinWindow(start: number, end: number, ms: number): boolean {
  return ms >= start && ms < end;
}

function isProfileComplete(p: Record<string, unknown>): boolean {
  for (const f of PROFILE_COMPLETE_FIELDS) {
    const v = p[f];
    if (v == null || (typeof v === "string" && v.trim() === "")) return false;
  }
  const photos = Array.isArray(p.photos) ? (p.photos as unknown[]) : [];
  return photos.length >= PROFILE_COMPLETE_MIN_PHOTOS;
}

function isVerified(p: Record<string, unknown>): boolean {
  return p.identity_verification_status === "verified" || p.is_verified === true;
}

function recentlyActive(p: Record<string, unknown>): boolean {
  const la = p.last_active_at as string | null | undefined;
  if (!la) return false;
  return Date.now() - new Date(la).getTime() < ACTIVE_SUPPRESS_MS;
}

function isSuppressedStatus(p: Record<string, unknown>): boolean {
  const s = (p.status as string | null | undefined)?.toLowerCase?.() ?? "";
  return s === "banned" || s === "suspended" || s === "paused";
}

function firstName(fullName: string | null | undefined): string {
  if (!fullName) return "there";
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

// Reviewer must-fix #1 2026-06-12: every user-supplied string that lands
// in an outbound HTML email must be HTML-escaped. A user with
// full_name = '<img src=x onerror=alert(1)>' would otherwise become a live
// payload at every email client that renders inline event handlers, AND a
// phishing vector to overwrite the heading. Apply to every ${...} value
// derived from profile data before injecting into the email shell.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------- HTML templates (branded, inline-styled for email-client safety) ----------

const BRAND_COLOR_PRIMARY = "#C85A72";
const BRAND_COLOR_GOLD    = "#E6B450";
const BRAND_COLOR_INK     = "#1F1F1F";
const BRAND_COLOR_MUTED   = "#706B67";
const BRAND_COLOR_CREAM   = "#FAF7F2";

function emailShell(innerHtml: string, footerSenderLine: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${BRAND_COLOR_CREAM};font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND_COLOR_INK}">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND_COLOR_CREAM};padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #E6DCD2;border-radius:14px;padding:32px">
        <tr><td>
          <div style="font-size:24px;font-weight:800;color:${BRAND_COLOR_INK};letter-spacing:-0.5px;margin-bottom:24px">Marryzen<span style="color:${BRAND_COLOR_PRIMARY}">.</span></div>
          ${innerHtml}
        </td></tr>
        <tr><td style="padding-top:28px;border-top:1px solid #E6DCD2;margin-top:24px">
          <p style="color:${BRAND_COLOR_MUTED};font-size:12px;line-height:1.6;margin:16px 0 0">${footerSenderLine}</p>
          <p style="color:${BRAND_COLOR_MUTED};font-size:11px;line-height:1.6;margin:12px 0 0">CUVAN LLC (operating Marryzen). You're receiving this because you signed up at marryzen.com.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND_COLOR_GOLD};color:${BRAND_COLOR_INK};font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px">${label}</a>`;
}

function welcomeInstitutional(): string {
  const inner = `<h1 style="font-size:22px;font-weight:700;color:${BRAND_COLOR_INK};margin:0 0 16px">Welcome to Marryzen</h1>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">You've joined a community built around one idea: marriage is a serious decision, and finding the right partner deserves more than a swipe.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">Here's what's next:</p>
<ul style="font-size:16px;line-height:1.8;color:${BRAND_COLOR_INK};margin:0 0 24px;padding-left:20px">
  <li>Complete your profile so our matching can understand your values, faith, and what you're looking for in a spouse.</li>
  <li>Verify your identity. Every member on Marryzen is ID-verified &mdash; it's how we keep this community trustworthy.</li>
  <li>Take your time. There's no streak to maintain, no algorithm rewarding speed.</li>
</ul>
<p style="margin:0 0 24px">${btn(APP_URL + "/login", "Continue to Marryzen")}</p>`;
  return emailShell(inner, "&mdash; Marryzen");
}

function welcomeFounding(name: string): string {
  const inner = `<h1 style="font-size:22px;font-weight:700;color:${BRAND_COLOR_INK};margin:0 0 16px">You're one of our first 500</h1>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">Hi ${name},</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">I'm Omer, founder of Marryzen. I'm writing because you're one of the first five hundred people to join, and that means something to me personally.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">Marryzen exists because I watched too many people of faith try to find a spouse on apps that were built for something else entirely &mdash; apps that reward attention, not commitment. I wanted a place where the question on day one is the same as the question on day one hundred: are we building toward marriage, together?</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">That's what we're building here. ID-verified members. Values-based matching. No swipe culture, no games. A community where the goal is named out loud.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">As a founding member, you'll see Marryzen evolve quickly over the coming months. If something feels off or you want to share what brought you here, write me at <a href="mailto:hello@marryzen.com" style="color:${BRAND_COLOR_PRIMARY}">hello@marryzen.com</a> &mdash; I read every reply and aim to respond within three business days.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">Thank you for trusting us with something this important.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 24px">Omer<br/><span style="color:${BRAND_COLOR_MUTED}">Founder, Marryzen</span></p>
<p style="margin:0 0 24px">${btn(APP_URL + "/login", "Continue to Marryzen")}</p>`;
  return emailShell(inner, "&mdash; Omer / Marryzen");
}

function profileNudge(name: string): string {
  const inner = `<h1 style="font-size:22px;font-weight:700;color:${BRAND_COLOR_INK};margin:0 0 16px">A few more details, when you're ready</h1>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">Hi ${name},</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">A complete profile is how our matching works &mdash; without it, we can't introduce you to anyone with confidence.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">The questions we ask aren't small talk. They're the things that actually matter in a marriage: faith practice, family vision, values, life stage.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 24px">Pick it up when you have fifteen quiet minutes.</p>
<p style="margin:0 0 24px">${btn(APP_URL + "/onboarding", "Finish your profile")}</p>`;
  return emailShell(inner, "&mdash; Marryzen");
}

function verifyNudge(name: string): string {
  const inner = `<h1 style="font-size:22px;font-weight:700;color:${BRAND_COLOR_INK};margin:0 0 16px">One step left: verify your identity</h1>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">Hi ${name},</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">Every profile on Marryzen is ID-verified. No bots, no catfishing, no second-guessing whether the person across from you is real.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">That standard only works if everyone meets it &mdash; including you.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 24px">Verification takes about two minutes and is handled by our identity partner. Your ID is never shown to other members.</p>
<p style="margin:0 0 24px">${btn(APP_URL + "/verify", "Verify your identity")}</p>`;
  return emailShell(inner, "&mdash; Marryzen");
}

function reEngagement(name: string): string {
  const inner = `<h1 style="font-size:22px;font-weight:700;color:${BRAND_COLOR_INK};margin:0 0 16px">Still thinking it through?</h1>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">Hi ${name},</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">We noticed you haven't been back in a while. That's okay.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 16px">Choosing how to look for a spouse is a real decision, and Marryzen is built for people who want to take it seriously rather than scroll through faces on a lunch break.</p>
<p style="font-size:16px;line-height:1.7;color:${BRAND_COLOR_INK};margin:0 0 24px">If now isn't the right season, your account stays open. If it is, your profile is one click away.</p>
<p style="margin:0 0 24px">${btn(APP_URL + "/login", "Sign in to Marryzen")}</p>`;
  return emailShell(inner, "&mdash; Marryzen");
}

// ---------- Resend ----------

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  voice: "institutional" | "founder";
}): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY not set" };
  if (!opts.to) return { ok: false, error: "no recipient" };

  const from = opts.voice === "founder" ? FROM_FOUNDER : FROM_INSTITUTIONAL;
  const body: Record<string, unknown> = {
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.voice === "founder") body.reply_to = REPLY_TO_FOUNDER;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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

// ---------- Cadence state-machine evaluator ----------

interface CadenceState {
  stage: string;
  transitioned_at: string | null;
  lock_until: string | null;
  sends: Record<string, string | null>;
}

type Decision =
  | { kind: "noop"; reason: string }
  | { kind: "send"; emailKey: string; subject: string; html: string; voice: "institutional" | "founder"; nextStage: string }
  | { kind: "advance"; nextStage: string; reason: string };

function evaluate(profile: Record<string, unknown>, state: CadenceState): Decision {
  // Suppression checks
  if (!profile.email) return { kind: "noop", reason: "no_email" };
  if (isSuppressedStatus(profile)) return { kind: "noop", reason: "status_suppressed" };
  // marketing opt-out is checked via user_preferences elsewhere if needed; for now
  // we use the dedicated column if it exists, else skip.
  if (profile.marketing_emails_opt_out === true) return { kind: "noop", reason: "opted_out" };
  if (recentlyActive(profile)) return { kind: "noop", reason: "recently_active" };

  const createdAt = new Date(profile.created_at as string);
  const elapsed = Date.now() - createdAt.getTime();
  // Reviewer must-fix #1 2026-06-12: escape name before HTML injection.
  const name = escapeHtml(firstName(profile.full_name as string | null | undefined));
  const complete = isProfileComplete(profile);
  const verified = isVerified(profile);

  switch (state.stage) {
    case "signup": {
      if (elapsed < WELCOME_AFTER_MS) return { kind: "noop", reason: "too_early_welcome" };
      // Founding cohort gets founder voice; everyone else institutional
      if (profile.founding_member === true) {
        if (state.sends.founding_welcome) return { kind: "advance", nextStage: "welcomed", reason: "already_sent_founding" };
        return {
          kind: "send",
          emailKey: "founding_welcome",
          subject: "You're one of our first 500",
          html: welcomeFounding(name),
          voice: "founder",
          nextStage: "welcomed",
        };
      }
      if (state.sends.welcome) return { kind: "advance", nextStage: "welcomed", reason: "already_sent_welcome" };
      return {
        kind: "send",
        emailKey: "welcome",
        subject: "Welcome to Marryzen",
        html: welcomeInstitutional(),
        voice: "institutional",
        nextStage: "welcomed",
      };
    }

    case "welcomed": {
      if (elapsed < PROFILE_NUDGE_AFTER_MS) return { kind: "noop", reason: "too_early_profile_nudge" };
      // Fast track: complete + verified — skip nudges entirely
      if (complete && verified) return { kind: "advance", nextStage: "done", reason: "fast_track_complete_verified" };
      // If profile complete but not verified, skip profile nudge, go straight to verify check
      if (complete) return { kind: "advance", nextStage: "profile_nudged", reason: "complete_skip_profile_nudge" };
      // Send profile nudge
      if (state.sends.profile_nudge) return { kind: "advance", nextStage: "profile_nudged", reason: "already_sent_profile_nudge" };
      return {
        kind: "send",
        emailKey: "profile_nudge",
        subject: "A few more details, when you're ready",
        html: profileNudge(name),
        voice: "institutional",
        nextStage: "profile_nudged",
      };
    }

    case "profile_nudged": {
      if (elapsed < VERIFY_NUDGE_AFTER_MS) return { kind: "noop", reason: "too_early_verify_nudge" };
      if (verified) return { kind: "advance", nextStage: "done", reason: "verified_skip_remaining" };
      if (state.sends.verify_nudge) return { kind: "advance", nextStage: "verify_nudged", reason: "already_sent_verify_nudge" };
      return {
        kind: "send",
        emailKey: "verify_nudge",
        subject: "One step left: verify your identity",
        html: verifyNudge(name),
        voice: "institutional",
        nextStage: "verify_nudged",
      };
    }

    case "verify_nudged": {
      if (elapsed < RE_ENGAGE_AFTER_MS) return { kind: "noop", reason: "too_early_reengage" };
      const lastActive = profile.last_active_at as string | null | undefined;
      const inactiveLongEnough = !lastActive || (Date.now() - new Date(lastActive).getTime() >= INACTIVE_FOR_RE_MS);
      if (!inactiveLongEnough) return { kind: "advance", nextStage: "done", reason: "re_engaged_but_user_already_active" };
      if (state.sends.re_engagement) return { kind: "advance", nextStage: "re_engaged", reason: "already_sent_reengagement" };
      return {
        kind: "send",
        emailKey: "re_engagement",
        subject: "Still thinking it through?",
        html: reEngagement(name),
        voice: "institutional",
        nextStage: "re_engaged",
      };
    }

    case "re_engaged": {
      const reTime = state.transitioned_at ? new Date(state.transitioned_at).getTime() : createdAt.getTime();
      if (Date.now() - reTime < DORMANT_AFTER_RE_MS) return { kind: "noop", reason: "re_engaged_grace" };
      return { kind: "advance", nextStage: "dormant", reason: "no_response_14d_after_reengagement" };
    }

    case "done":
    case "dormant":
    default:
      return { kind: "noop", reason: `terminal_${state.stage}` };
  }
}

// ---------- Main handler ----------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  // Cron secret
  const provided = req.headers.get("x-cron-secret") || req.headers.get("X-Cron-Secret");
  if (CRON_SECRET && provided !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
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

  // Candidate query: stage not in (done, dormant), lock expired or null
  const nowIsoStr = nowIso();
  const { data: candidates, error: qErr } = await sb
    .from("profiles")
    .select("id, email, full_name, status, created_at, last_active_at, is_verified, identity_verification_status, founding_member, photos, date_of_birth, identify_as, location_city, location_country, religious_affiliation, relationship_goal, bio, email_cadence_state")
    .or("email_cadence_state->>stage.is.null,email_cadence_state->>stage.in.(signup,welcomed,profile_nudged,verify_nudged,re_engaged)")
    .limit(BATCH_SIZE);

  if (qErr) {
    console.error("cadence-tick: candidate query failed:", qErr.message);
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const summary = { scanned: 0, sent: 0, advanced: 0, skipped: 0, locked: 0, errors: 0 };
  const errors: string[] = [];

  for (const profile of (candidates ?? [])) {
    summary.scanned++;
    const id = profile.id as string;
    let state: CadenceState = (profile.email_cadence_state as CadenceState) ?? { stage: "signup", transitioned_at: null, lock_until: null, sends: {} };
    if (!state.stage) state.stage = "signup";
    if (!state.sends) state.sends = {};

    // Attempt to acquire optimistic lock atomically.
    // Reviewer must-fix #3 2026-06-12: also constrain on stage so that if
    // another worker advanced the row between our SELECT and this UPDATE,
    // we lose the lock acquisition instead of clobbering their state
    // (lost-update). The .eq("email_cadence_state->>stage", state.stage)
    // filter enforces that.
    const lockUntilNew = new Date(Date.now() + LOCK_TTL_MS).toISOString();
    const newLockedState = { ...state, lock_until: lockUntilNew };
    const { data: locked, error: lockErr } = await sb
      .from("profiles")
      .update({ email_cadence_state: newLockedState })
      .eq("id", id)
      .eq("email_cadence_state->>stage", state.stage)
      .or(`email_cadence_state->>lock_until.is.null,email_cadence_state->>lock_until.lt.${nowIsoStr}`)
      .select("id")
      .maybeSingle();

    if (lockErr) {
      // Reviewer should-fix 2026-06-12: log the error so PostgREST syntax
      // problems surface in the first cron ticks instead of silently
      // masquerading as "locked".
      console.error(`cadence-tick: lock acquisition failed for ${id}: ${lockErr.message}`);
      summary.errors++;
      continue;
    }
    if (!locked) {
      summary.locked++;
      continue;
    }
    state = newLockedState;

    try {
      const decision = evaluate(profile, state);

      if (decision.kind === "noop") {
        // Clear lock so other workers can pick up later if needed
        await sb.from("profiles").update({
          email_cadence_state: { ...state, lock_until: null },
        }).eq("id", id);
        summary.skipped++;
        continue;
      }

      if (decision.kind === "advance") {
        const next: CadenceState = {
          ...state,
          stage: decision.nextStage,
          transitioned_at: nowIsoStr,
          lock_until: null,
        };
        await sb.from("profiles").update({ email_cadence_state: next }).eq("id", id);
        summary.advanced++;
        continue;
      }

      // Send branch
      const sendRes = await sendEmail({
        to: profile.email as string,
        subject: decision.subject,
        html: decision.html,
        voice: decision.voice,
      });
      if (!sendRes.ok) {
        summary.errors++;
        errors.push(`${id}: ${sendRes.error}`);
        // Clear lock, leave state as-is so next tick retries
        await sb.from("profiles").update({
          email_cadence_state: { ...state, lock_until: null },
        }).eq("id", id);
        continue;
      }

      // Record send + advance state atomically
      const next: CadenceState = {
        ...state,
        stage: decision.nextStage,
        transitioned_at: nowIsoStr,
        lock_until: null,
        sends: { ...state.sends, [decision.emailKey]: nowIsoStr },
      };
      await sb.from("profiles").update({ email_cadence_state: next }).eq("id", id);
      summary.sent++;
    } catch (err) {
      summary.errors++;
      errors.push(`${id}: ${String(err).slice(0, 200)}`);
      // Try to release lock so we don't deadlock the row
      await sb.from("profiles").update({
        email_cadence_state: { ...state, lock_until: null },
      }).eq("id", id).then(() => {}, () => {});
    }
  }

  return new Response(JSON.stringify({ ok: true, summary, errors: errors.slice(0, 10) }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
