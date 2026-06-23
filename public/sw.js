/* Marryzen Service Worker
 * ============================================================================
 * Cache strategy (deliberately conservative for a Vite SPA on Vercel):
 *
 *   - APP SHELL (index.html, favicon, manifest, icons): STALE-WHILE-REVALIDATE
 *     so first paint comes from cache (fast) while we fetch a fresh copy in
 *     the background for the next visit.
 *
 *   - SAME-ORIGIN ASSETS in /assets/* (Vite-hashed JS/CSS bundles): CACHE-FIRST
 *     with no revalidation. Vite bundle filenames already include a content
 *     hash, so cached bundles are immutable. New deploys ship new filenames
 *     referenced by the new index.html — the old SW automatically picks up
 *     the new bundle filenames on the next index.html revalidation.
 *
 *   - API + CROSS-ORIGIN (Supabase, Termly, Sentry, PostHog, Didit, Resend,
 *     anything not us): NETWORK-ONLY, no caching. We never want to serve a
 *     stale auth token, stale profile data, or stale realtime websocket.
 *
 *   - DOCUMENT NAVIGATIONS (SPA route changes): NETWORK-FIRST with a 3s
 *     timeout, then fall back to the cached index.html for offline.
 *
 * Cache versioning: bumping CACHE_VERSION on deploy is unnecessary because
 * Vite's content-hashed filenames already invalidate stale chunks. But we
 * keep the version so we can force-evict caches if the SW itself ships a
 * bug (see "activate" handler — it deletes any cache whose name doesn't
 * match the current CACHE_VERSION).
 *
 * Push notifications (Tier 3): the "push" + "notificationclick" handlers
 * receive notifications sent by the send-push-notification Edge Function.
 * VAPID-signed, scoped to subscribed devices only.
 * ============================================================================
 */

const CACHE_VERSION = 'marryzen-v1-2026-06-23';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSETS_CACHE = `${CACHE_VERSION}-assets`;

// Files we pre-cache on install so the app is openable offline immediately.
const APP_SHELL_FILES = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// ----------------------------------------------------------------------------
// Install: pre-cache the app shell
// ----------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then(async (cache) => {
        // Per-file fetch+put so one missing file (e.g. favicon variant not
        // yet deployed) doesn't abort the whole precache the way addAll() would.
        await Promise.allSettled(
          APP_SHELL_FILES.map((url) =>
            fetch(url, { cache: 'reload' }).then((res) => {
              if (res && res.ok) return cache.put(url, res);
              return null;
            })
          )
        );
      })
      .then(() => self.skipWaiting())
      .catch(() => {
        // Belt-and-suspenders: SW must activate even if precache is fully empty;
        // runtime stale-while-revalidate will refill on the first visit.
      })
  );
});

// ----------------------------------------------------------------------------
// Activate: clean up old caches from prior SW versions, claim all clients
// ----------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(CACHE_VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ----------------------------------------------------------------------------
// Fetch: routing by request type
// ----------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET. Everything else (POST to Supabase, etc.) passes through.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Cross-origin (Supabase, Termly, Sentry, PostHog, etc.): network-only.
  // Don't touch — they have their own caching headers + auth and we never
  // want a stale token in the cache.
  if (!sameOrigin) return;

  // Document navigations (SPA route changes): network-first with offline
  // fallback to cached index.html.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithIndexFallback(request));
    return;
  }

  // Hashed asset bundles (/assets/*): cache-first, immutable.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  // Everything else (icons, manifest, favicon, og images): stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(request, APP_SHELL_CACHE));
});

// ----------------------------------------------------------------------------
// Cache strategies
// ----------------------------------------------------------------------------

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    // Only cache successful responses (skip 4xx / 5xx / opaque-error).
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (_) {
    // Network failure on first request for an asset — return a synthetic
    // empty response rather than crashing the page. The chunk-error
    // boundary in React will catch the bundle-load failure and offer a
    // reload.
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || fetchPromise || new Response('', { status: 504 });
}

async function networkFirstWithIndexFallback(request) {
  try {
    // 3-second timeout so a slow network doesn't block the cached fallback.
    const fresh = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    if (fresh && fresh.ok && fresh.type === 'basic') {
      // Only persist the response as the offline-fallback if this navigation
      // IS for the root path. Persisting /dashboard or /discovery responses
      // under the '/' key would serve the wrong shell on the next offline
      // navigation. Match by pathname (ignore query string + hash).
      try {
        const reqUrl = new URL(request.url);
        if (reqUrl.pathname === '/' || reqUrl.pathname === '') {
          const cache = await caches.open(APP_SHELL_CACHE);
          cache.put('/', fresh.clone());
        }
      } catch (_) {}
    }
    return fresh;
  } catch (_) {
    const cache = await caches.open(APP_SHELL_CACHE);
    const cached = await cache.match('/', { ignoreSearch: true, ignoreVary: true });
    if (cached) return cached;
    // Last resort: bare HTML that triggers a reload when network returns.
    return new Response(
      '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="30"><title>Marryzen offline</title></head><body style="background:#FAF7F2;color:#1F1F1F;font-family:system-ui;padding:2rem;text-align:center"><h1>You appear to be offline</h1><p>Reconnecting...</p></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// ----------------------------------------------------------------------------
// PUSH NOTIFICATIONS (Tier 3) — payload-based
//
// Payload shape (set by the send-push-notification Edge Function):
//   { title: "New match!", body: "Aisha liked your profile.",
//     url: "/matches", tag: "match:123", icon?: "/icon-192.png" }
//
// `tag` collapses duplicate notifications of the same kind (e.g. 5 unread
// messages from the same conversation show as one notification, not five).
// ----------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch (_) {
    // Plain-text fallback
    data = { title: 'Marryzen', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Marryzen';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'marryzen-notification',
    data: { url: data.url || '/dashboard' },
    // renotify=true forces a sound/vibration even if a notification with the
    // same tag is already showing — used for time-sensitive updates.
    renotify: data.renotify === true,
    requireInteraction: data.requireInteraction === true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clientsList) => {
        // Prefer a standalone (installed-PWA) window over a regular browser tab.
        const sameOrigin = clientsList.filter((c) => {
          try { return new URL(c.url).origin === self.location.origin; } catch (_) { return false; }
        });
        // matchAll doesn't sort, so we just take the first same-origin client.
        // (Heuristic: if multiple are open, the PWA window is usually the one
        // most recently focused by the OS push-tap.)
        for (const client of sameOrigin) {
          try {
            await client.focus();
            if ('navigate' in client) {
              try { await client.navigate(targetUrl); } catch (_) { /* cross-origin / BFCache */ }
            }
            return;
          } catch (_) {}
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});

// Optional: allow the page to skip-waiting on a new SW deploy without a manual
// reload. The page can postMessage({ type: 'SKIP_WAITING' }) after asking the
// user to refresh.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
