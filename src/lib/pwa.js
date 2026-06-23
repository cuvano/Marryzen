/* pwa.js — Marryzen PWA registration + install-prompt orchestration.
 *
 * ============================================================================
 * What this file owns:
 *
 *   1. Service worker registration (registerServiceWorker)
 *      Registers /sw.js after the page is idle so we don't compete with
 *      initial-paint work. SW lives in /public/sw.js at the site root so its
 *      scope covers the entire app.
 *
 *   2. beforeinstallprompt capture (initInstallPromptCapture)
 *      Chrome/Edge fires this event when the site meets PWA installability
 *      criteria. We preventDefault() to stop the browser's mini-bar, stash
 *      the event in module state, and expose it for the InstallPromptBanner
 *      React component to fire on user click. This is the documented pattern
 *      for offering a branded install UX.
 *
 *   3. iOS install detection (isIOS, isInStandaloneMode)
 *      iOS Safari does NOT fire beforeinstallprompt — users must tap Share
 *      → Add to Home Screen manually. We detect iOS so the banner can show
 *      the platform-appropriate instructions.
 *
 *   4. Install-event telemetry hook
 *      When the user actually installs (Chrome fires "appinstalled"), we
 *      track it via the existing analytics layer so we can measure install
 *      conversion in PostHog.
 * ============================================================================
 */

import { track } from '@/lib/analytics';

// Module-scoped reference to the captured beforeinstallprompt event.
// React components can subscribe via subscribeToInstallPrompt() to know
// when it becomes available.
let deferredInstallPrompt = null;
const subscribers = new Set();

function notifySubscribers() {
  for (const cb of subscribers) {
    try { cb(deferredInstallPrompt); } catch (_) {}
  }
}

/**
 * Register the service worker. Safe on every page load; the browser
 * deduplicates registration of the same SW URL with the same scope.
 *
 * We defer to requestIdleCallback so the SW install doesn't compete with
 * Termly, PostHog, or first paint.
 *
 * Returns the registration Promise (for tests or for the rare callsite
 * that wants to chain off SW readiness).
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);

  // Don't register in dev — Vite's dev server doesn't ship the same files
  // and a stale SW can mask source changes.
  if (import.meta.env.MODE !== 'production') return Promise.resolve(null);

  return new Promise((resolve) => {
    const doRegister = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // When a new SW takes control (after a deploy), reload once so
          // the user sees the new bundle.
          //
          // H1 fix (2026-06-23): only attach the reload listener AFTER first
          // install. On the very first visit, navigator.serviceWorker.controller
          // is null because no SW was previously controlling the page; the
          // first `controllerchange` will fire when we call clients.claim()
          // in the SW's activate handler. Reloading on that first fire would
          // gratuitously refresh on every brand-new visitor's first session.
          //
          // The second guard (refreshing flag) prevents reload loops on the
          // RARE case where multiple SW versions are racing during a deploy.
          if (!navigator.serviceWorker.controller) {
            resolve(registration);
            return;
          }
          let refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
          });
          resolve(registration);
        })
        .catch(() => resolve(null));
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(doRegister, { timeout: 5000 });
    } else {
      setTimeout(doRegister, 2000);
    }
  });
}

/**
 * Install the beforeinstallprompt + appinstalled listeners on the window
 * so we can offer a branded install UI later. Safe to call once at app
 * boot. Idempotent.
 */
export function initInstallPromptCapture() {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (event) => {
    // Prevent Chrome's default mini-infobar from showing — we want our own
    // branded prompt to fire instead.
    event.preventDefault();
    deferredInstallPrompt = event;
    notifySubscribers();
    try { track('pwa_install_prompt_available'); } catch (_) {}
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    notifySubscribers();
    try { track('pwa_installed'); } catch (_) {}
  });
}

/**
 * React-friendly subscription: call with a callback that receives the
 * current deferred prompt (or null if not captured yet). Returns an
 * unsubscribe function. Fires immediately with current state.
 */
export function subscribeToInstallPrompt(cb) {
  subscribers.add(cb);
  try { cb(deferredInstallPrompt); } catch (_) {}
  return () => subscribers.delete(cb);
}

/**
 * Trigger the captured install prompt. Returns { outcome: 'accepted'|'dismissed' }
 * or null if no prompt was available. After a successful or dismissed prompt,
 * the deferredInstallPrompt is consumed and cleared — Chrome only allows one
 * prompt() call per beforeinstallprompt event.
 */
export async function fireInstallPrompt() {
  if (!deferredInstallPrompt) return null;
  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  notifySubscribers();
  try {
    prompt.prompt();
    const choice = await prompt.userChoice;
    try { track('pwa_install_prompt_response', { outcome: choice.outcome }); } catch (_) {}
    return choice;
  } catch (_) {
    return null;
  }
}

/**
 * iOS detection. iOS Safari (and iOS Chrome, which is Safari under the hood)
 * does NOT fire beforeinstallprompt. Users need to tap Share → Add to Home
 * Screen manually. We show instructional UI when this returns true.
 */
export function isIOS() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPad on iPadOS 13+ identifies as "Macintosh" with touch support.
  const isIPadOS = ua.includes('Macintosh') && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || isIPadOS;
}

/**
 * Detect if the user is already running the app in standalone (installed) mode.
 * When true, we hide the install prompt entirely.
 */
export function isInStandaloneMode() {
  if (typeof window === 'undefined') return false;
  // Modern API
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS legacy
  if (typeof navigator !== 'undefined' && navigator.standalone === true) return true;
  return false;
}
