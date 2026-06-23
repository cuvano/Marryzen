/**
 * utm.js - Capture UTM parameters from the inbound URL on first visit,
 * persist them via a cookie that survives the OAuth round-trip, and expose
 * a read helper for the signup flow (so we can write the attribution into
 * profiles.referral_source at the moment the user creates their account).
 *
 * Why a cookie and not localStorage:
 *   - Cookies survive cross-tab navigation and the Supabase OAuth redirect.
 *   - LocalStorage is more aggressively cleared by ad blockers / privacy tools.
 *
 * ============================================================================
 * ePRIVACY POSTURE (corrected 2026-06-23)
 * ============================================================================
 *
 * Per CJEU Planet49 (C-673/17) + EDPB Guidelines 2/2023 on the application of
 * ePrivacy Article 5(3), attribution / marketing cookies are NOT covered by
 * the "strictly necessary" exemption even when they are first-party and no
 * third party reads them. They must be set only after the user gives explicit,
 * informed, freely-given consent.
 *
 * Earlier versions of this file set the mz_utm_v1 cookie unconditionally on
 * every first visit. That was an ePrivacy violation against EEA / UK
 * visitors. Corrected as follows:
 *
 *   1. The cookie is now gated behind Termly's "advertising" consent
 *      category. If the user has not (yet) consented, we cache the captured
 *      UTM bundle IN MEMORY (per-tab JS variable, no persistence) and write
 *      the cookie only after the Termly "consent" event fires with
 *      advertising === true.
 *
 *   2. We extract the URL UTM params at first script-eval time (which is the
 *      first paint), so even if the user navigates within the SPA before
 *      consenting, the inbound source is preserved in the in-memory cache
 *      and can be persisted when consent eventually fires.
 *
 *   3. If the user declines marketing consent, NO cookie is ever written.
 *      profiles.referral_source for that user will be null (the lawful
 *      outcome).
 *
 *   4. If Termly fails to load at all (network error, ad blocker), we
 *      conservatively DENY capture. The default state is "no consent."
 *
 * Companion fix required in Termly console: reclassify mz_utm_v1 from
 * "essential" to "advertising" so the cookie scan + auto-block work end-to-
 * end with this gate. (Tracked as ROPA v1.0.11 task.)
 *
 * ============================================================================
 *
 * Wire-in points:
 *   - Call captureAndStoreUTM() once on first page load (from main.jsx,
 *     before React renders). Idempotent + cheap; safe on every page load.
 *   - Call formatReferralSource() at the signup-completion step (in
 *     OnboardingPage profile insert) to get a "source/medium/campaign"
 *     string to write into profiles.referral_source. Returns null if the
 *     user never consented (cookie never written) - that's the lawful no-op.
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

// In-memory cache of the captured UTM bundle for the current SPA session.
// Lives only as long as the JS runtime - never persisted without consent.
// Populated by captureAndStoreUTM on first call; consumed by the consent
// listener when (and if) Termly fires advertising === true.
let pendingUtmBundle = null;

// Set to true once we have started waiting for Termly consent so we don't
// register duplicate listeners across multiple captureAndStoreUTM calls.
let listenerRegistered = false;

/**
 * Read UTM params from current URL. If any are present AND the user has
 * consented to advertising cookies via Termly, write the bundle to a cookie.
 *
 * First-visit-wins: if a cookie already exists, do NOT overwrite - the
 * first attribution beats any subsequent re-visit.
 *
 * Consent-gated: if Termly advertising consent is not yet given, the
 * captured bundle is cached in memory and persisted when consent fires.
 *
 * Safe to call on every page load; cheap and idempotent.
 */
export function captureAndStoreUTM() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Bail if we already captured this session's source.
  if (readCookie(COOKIE_NAME)) return;

  // Extract URL params NOW (before any in-app navigation could destroy them).
  // Cache in memory regardless of consent state.
  if (!pendingUtmBundle) {
    pendingUtmBundle = extractUtmFromURL();
  }

  // Nothing to capture if no utm_* params on the URL.
  if (!pendingUtmBundle) return;

  // ePrivacy gate: only persist after explicit advertising consent.
  if (!hasMarketingConsent()) {
    waitForConsentThenPersist();
    return;
  }

  // Consent already given (returning user, or single-page-flow accept) -
  // persist immediately.
  persistPendingBundle();
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
 * Returns null if nothing was captured (either no UTM params on inbound URL,
 * or the user declined advertising-cookie consent and the bundle was never
 * persisted). Null is the GDPR-lawful outcome for declined-consent users.
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
  pendingUtmBundle = null;
}

// ----------------------------------------------------------------------------
// Internal helpers - consent, capture, cookie, sanitisation
// ----------------------------------------------------------------------------

/**
 * Read UTM params + referrer from current window.location.
 * Returns a bundle object or null if no utm_* params present.
 */
function extractUtmFromURL() {
  let params;
  try {
    params = new URLSearchParams(window.location.search);
  } catch (_) {
    return null;
  }

  const present = {};
  for (const key of UTM_KEYS) {
    const val = params.get(key);
    if (val) present[key] = sanitize(val);
  }

  if (Object.keys(present).length === 0) return null;

  return {
    s: present.utm_source || null,
    m: present.utm_medium || null,
    c: present.utm_campaign || null,
    t: present.utm_term || null,
    n: present.utm_content || null,
    cap: new Date().toISOString(),
    r: sanitize(document.referrer || '').slice(0, 200) || null,
  };
}

/**
 * Check if the user has given advertising-category consent via Termly.
 *
 * Conservative default: if Termly hasn't loaded yet (async script in flight),
 * or if the API surface is missing, return false. The cookie will not be
 * written until Termly confirms consent.
 */
function hasMarketingConsent() {
  try {
    const state = window.Termly?.getConsentState?.();
    if (!state) return false;
    // "advertising" is Termly's category for attribution / marketing cookies.
    // (Other categories: essential, analytics, performance, social_networking,
    // unclassified, do_not_sell.)
    return state.advertising === true;
  } catch (_) {
    return false;
  }
}

/**
 * Persist the in-memory pendingUtmBundle to the cookie. Called when consent
 * has been confirmed (either at first call or via the consent listener).
 */
function persistPendingBundle() {
  if (!pendingUtmBundle) return;
  writeCookie(COOKIE_NAME, JSON.stringify(pendingUtmBundle), COOKIE_MAX_AGE_DAYS);
  // Keep pendingUtmBundle around for the SPA session lifetime so subsequent
  // captureAndStoreUTM calls see "already captured" via readCookie and bail.
}

/**
 * Register a one-shot listener that waits for Termly to emit a consent event
 * with advertising === true, then persists the cached bundle.
 *
 * Defensive triple-redundancy:
 *   (a) Termly.on('consent', ...) - the documented event channel
 *   (b) 1-second polling for 30 seconds - covers cases where (a) doesn't fire
 *   (c) idempotent guard so duplicate captureAndStoreUTM calls don't pile up
 *       listeners
 */
function waitForConsentThenPersist() {
  if (listenerRegistered) return;
  listenerRegistered = true;

  let done = false;
  const finish = () => {
    if (done) return;
    if (hasMarketingConsent()) {
      done = true;
      persistPendingBundle();
    }
  };

  // Channel (a): Termly event listener
  try {
    if (typeof window.Termly?.on === 'function') {
      window.Termly.on('consent', finish);
    }
  } catch (_) {}

  // Channel (b): polling fallback. 30 polls x 1s = 30s window. After that,
  // the visitor has effectively declined (closed banner, ignored it, etc.)
  // and we leave the bundle un-persisted - the lawful outcome.
  let polls = 0;
  const interval = setInterval(() => {
    polls++;
    if (done || polls >= 30) {
      clearInterval(interval);
      return;
    }
    finish();
  }, 1000);
}

// ----------------------------------------------------------------------------
// Cookie + sanitisation primitives
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
