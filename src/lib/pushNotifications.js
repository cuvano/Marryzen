/* pushNotifications.js — Web Push subscribe/unsubscribe + Supabase sync.
 *
 * ============================================================================
 * The user-opt-in flow:
 *
 *   1. User taps "Enable push notifications" in /account-settings.
 *   2. We call Notification.requestPermission() — browser shows native dialog.
 *   3. If granted, we call serviceWorker.pushManager.subscribe() with our
 *      VAPID public key. Browser registers with the push service (Chrome →
 *      Firebase Cloud Messaging; Safari → APNs) and returns a PushSubscription
 *      object containing { endpoint, keys: { p256dh, auth } }.
 *   4. We upsert that object into the push_subscriptions table.
 *
 * Unsubscribe is the reverse: subscription.unsubscribe() + DELETE the row.
 *
 * ============================================================================
 * VAPID public key:
 *
 * The VAPID public key is committed in plain VITE_PUBLIC_VAPID_KEY env var
 * (it's literally a public key — base64-encoded ECDH-P256). The matching
 * PRIVATE key lives only in the Supabase Edge Function secrets as
 * VAPID_PRIVATE_KEY and is used by the send-push-notification function to
 * sign each push request. Generate the pair once with:
 *
 *   npx web-push generate-vapid-keys
 *
 * Public goes to Vercel env + redeploy. Private goes to Supabase secrets.
 * Never rotate without a clear-and-resubscribe-all-devices plan because the
 * push services bind each subscription to the VAPID public key it was
 * registered with.
 *
 * ============================================================================
 * Browser support (2026-06):
 *
 *   - Chrome / Edge / Firefox (Android + desktop) — full support, programmatic
 *     subscribe + permission via Notification API.
 *   - Safari 16.4+ on iOS — supported BUT requires the PWA to be added to
 *     the home screen first (Apple restriction). We surface this requirement
 *     in the UI: if isStandalone() === false on iOS, we say "Add Marryzen to
 *     your home screen first, then enable notifications from inside the app."
 *   - Older iOS Safari — no support. We show a "not available on this browser"
 *     fallback rather than the toggle.
 */

import { supabase } from '@/lib/customSupabaseClient';
import { track } from '@/lib/analytics';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_PUBLIC_VAPID_KEY;

// ----------------------------------------------------------------------------
// Browser-capability checks
// ----------------------------------------------------------------------------

export function isPushSupported() {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function currentPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

// ----------------------------------------------------------------------------
// Convert a base64 URL-safe string (the VAPID public key format) to the
// Uint8Array the Push API expects.
// ----------------------------------------------------------------------------
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// ----------------------------------------------------------------------------
// Convert a PushSubscription to the shape we store in push_subscriptions.
// ----------------------------------------------------------------------------
function serializeSubscription(subscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh || '',
    auth: json.keys?.auth || '',
    user_agent: typeof navigator !== 'undefined' ? (navigator.userAgent || '').slice(0, 500) : null,
  };
}

// ----------------------------------------------------------------------------
// Subscribe — full flow including permission prompt + DB upsert.
//
// Returns { ok: true, subscription } on success, or { ok: false, reason } on failure.
// Reasons: 'unsupported' | 'no-vapid-key' | 'permission-denied' | 'permission-dismissed'
//          | 'subscribe-failed' | 'db-failed' | 'not-authenticated'
// ----------------------------------------------------------------------------
export async function subscribeToPush() {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-vapid-key' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'not-authenticated' };

  // Ask permission (native browser dialog).
  let perm = Notification.permission;
  if (perm === 'default') {
    try {
      perm = await Notification.requestPermission();
    } catch (_) {
      return { ok: false, reason: 'permission-dismissed' };
    }
  }
  if (perm !== 'granted') {
    try { track('push_permission_denied', { perm }); } catch (_) {}
    return { ok: false, reason: 'permission-denied' };
  }

  // Get the active SW registration. If SW hasn't installed yet, wait for it.
  let registration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch (_) {
    return { ok: false, reason: 'subscribe-failed' };
  }

  // Subscribe with the push service.
  let subscription;
  try {
    // Reuse existing subscription if present (idempotent).
    subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
  } catch (_) {
    return { ok: false, reason: 'subscribe-failed' };
  }

  // Upsert into push_subscriptions (UNIQUE on endpoint).
  const payload = { ...serializeSubscription(subscription), user_id: user.id, last_seen_at: new Date().toISOString() };
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(payload, { onConflict: 'endpoint' });

  if (error) {
    return { ok: false, reason: 'db-failed' };
  }

  try { track('push_subscribed'); } catch (_) {}
  return { ok: true, subscription };
}

// ----------------------------------------------------------------------------
// Unsubscribe — revoke browser subscription + delete DB row.
// ----------------------------------------------------------------------------
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return { ok: true }; // nothing to do

  let registration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch (_) {
    return { ok: false, reason: 'sw-not-ready' };
  }

  let subscription;
  try {
    subscription = await registration.pushManager.getSubscription();
  } catch (_) {
    return { ok: false, reason: 'get-failed' };
  }

  if (!subscription) return { ok: true }; // already unsubscribed

  const endpoint = subscription.endpoint;

  try {
    await subscription.unsubscribe();
  } catch (_) {
    // Continue to DB cleanup even if browser-side fails
  }

  try {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  } catch (_) {}

  try { track('push_unsubscribed'); } catch (_) {}
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Check current subscription state — drives the toggle UI.
// ----------------------------------------------------------------------------
export async function getSubscriptionState() {
  if (!isPushSupported()) return { state: 'unsupported' };
  if (!VAPID_PUBLIC_KEY) return { state: 'not-configured' };

  const perm = Notification.permission;
  if (perm === 'denied') return { state: 'permission-denied' };

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return { state: sub ? 'subscribed' : 'unsubscribed', perm };
  } catch (_) {
    return { state: 'unsubscribed', perm };
  }
}
