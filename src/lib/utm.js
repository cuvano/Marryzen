/**
 * utm.js - Capture UTM parameters from the inbound URL on first visit,
 * persist them via a cookie that survives the OAuth round-trip, and expose
 * a read helper for the signup flow (so we can write the attribution into
 * profiles.referral_source at the moment the user creates their account).
 *
 * Why a cookie and not localStorage:
 *   - Cookies survive cross-tab navigation and the Supabase OAuth redirect.
 *   - LocalStorage is more aggressively cleared by ad blockers / privacy tools.
 *   - We never use the cookie for tracking; it's a 30-day TTL technical cookie
 *     that holds the inbound UTM and is read once at signup, then never again.
 *
 * GDPR posture: marketing-attribution cookies require consent under ePrivacy.
 * However a "first-visit source" record stored only for the purpose of writing
 * it once to the user's own profile (so they can later see where they came
 * from, and so we can attribute their signup) is widely treated as a strictly-
 * necessary functional cookie for the signup form, NOT a marketing cookie.
 * The cookie is set without consent because no third-party tag fires from it
 * and no third party reads it.
 *
 * Wire-in points:
 *   - Call captureAndStoreUTM() once on first page load (from main.jsx, before
 *     React renders).
 *   - Call formatReferralSource() at the signup-completion step (in
 *     OnboardingPage profile insert) to get a "source/medium/campaign" string
 *     to write into profiles.referral_source.
 *   - Call clearStoredUTM() after the profile insert succeeds (optional).
 *
 * Format stored in cookie (single JSON-encoded string, URL-safe):
 *   {"s":"instagram","m":"bio","c":"organic","cap":"2026-06-22T01:23:45Z","r":"..."}
 *   - s = utm_source
 *   - m = utm_medium
 *   - c = utm_campaign
 *   - t = utm_term (optional)
 *   - n = utm_content (optional)
 *   - cap = captured-at timestamp
 *   - r = referrer at time of capture (truncated to 200 chars)
 */

const COOKIE_NAME = 'mz_utm_v1';
const COOKIE_MAX_AGE_DAYS = 30;

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

/**
 * Read UTM params from current URL. If any are present, write the bundle to a
 * cookie. First-visit-wins: if a cookie already exists, do NOT overwrite -
 * the first attribution beats any subsequent re-visit.
 *
 * Safe to call on every page load; cheap and idempotent.
 */
export function captureAndStoreUTM() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Bail if we already captured this session's source.
  if (readCookie(COOKIE_NAME)) return;

  let params;
  try {
    params = new URLSearchParams(window.location.search);
  } catch (_) {
    return;
  }

  const present = {};
  for (const key of UTM_KEYS) {
    const val = params.get(key);
    if (val) present[key] = sanitize(val);
  }

  // Nothing to capture if no utm_* params on the URL.
  if (Object.keys(present).length === 0) return;

  const bundle = {
    s: present.utm_source || null,
    m: present.utm_medium || null,
    c: present.utm_campaign || null,
    t: present.utm_term || null,
    n: present.utm_content || null,
    cap: new Date().toISOString(),
    r: sanitize(document.referrer || '').slice(0, 200) || null,
  };

  writeCookie(COOKIE_NAME, JSON.stringify(bundle), COOKIE_MAX_AGE_DAYS);
}

/**
 * Read the stored UTM bundle. Returns the parsed object or null if no cookie.
 *
 * Callers (OnboardingPage profile insert) typically want a compact string
 * representation - see formatReferralSource() below.
 */
export function getStoredUTM() {
  const raw = readCookie(COOKIE_NAME);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Format the stored UTM bundle as a single short string suitable for writing
 * into profiles.referral_source (a text column).
 *
 * Returns something like:
 *   "instagram/bio/organic"           (source/medium/campaign)
 *   "podcast/sponsorship/halfdeen"
 *
 * Or null if nothing was captured.
 */
export function formatReferralSource() {
  const u = getStoredUTM();
  if (!u) return null;
  const parts = [u.s, u.m, u.c].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join('/').slice(0, 200);
}

/** Clear the cookie. Optional - call after the signup write succeeds. */
export function clearStoredUTM() {
  writeCookie(COOKIE_NAME, '', -1);
}

// ----------------------------------------------------------------------------
// Internal helpers - cookie + sanitisation
// ----------------------------------------------------------------------------

function writeCookie(name, value, maxAgeDays) {
  if (typeof document === 'undefined') return;
  const maxAgeSeconds = maxAgeDays > 0 ? Math.floor(maxAgeDays * 86400) : 0;
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    `path=/`,
    maxAgeDays > 0 ? `max-age=${maxAgeSeconds}` : `max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `samesite=lax`,
  ];
  // Set Secure only over HTTPS so localhost dev still works.
  if (window.location?.protocol === 'https:') attrs.push('secure');
  document.cookie = attrs.join('; ');
}

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const target = `${name}=`;
  const parts = document.cookie ? document.cookie.split('; ') : [];
  for (const part of parts) {
    if (part.startsWith(target)) {
      const raw = part.slice(target.length);
      try {
        return decodeURIComponent(raw);
      } catch (_) {
        return raw;
      }
    }
  }
  return null;
}

/**
 * Sanitise an incoming param via an ALLOWLIST of UTM-safe characters.
 *
 * Allowed: a-z, A-Z, 0-9, underscore, dash, dot, slash.
 * Everything else (spaces, quotes, angle brackets, control chars, anything
 * exotic) is stripped. Then lowercase + cap at 80 chars.
 *
 * Why allowlist (not blocklist): a blocklist like /[\x00-\x1f\x7f<>"\'`\\]/g
 * preserves spaces and parens which are weird in UTM values, and depends on
 * exact byte handling across platforms. An allowlist is bulletproof - exactly
 * the characters we expect, nothing else.
 *
 * UTM values are user-attacker-controllable (an attacker can craft a link
 * with arbitrary utm_source=...). Allowlist prevents path-injection / script
 * payload / shell metacharacters reaching downstream consumers.
 */
function sanitize(s) {
  if (!s) return '';
  return String(s)
    .replace(/[^a-zA-Z0-9_\-./]/g, '')
    .slice(0, 80)
    .toLowerCase();
}
