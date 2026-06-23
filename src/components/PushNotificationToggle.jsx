import React, { useEffect, useState, useCallback } from 'react';
import { Bell, BellOff, AlertCircle, CheckCircle2, Smartphone } from 'lucide-react';
import {
  isPushSupported,
  getSubscriptionState,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/pushNotifications';
import { isIOS, isInStandaloneMode } from '@/lib/pwa';
import { useToast } from '@/components/ui/use-toast';

/**
 * PushNotificationToggle — drop-in Settings card for /account-settings.
 *
 * UI states (mutually exclusive):
 *
 *   - 'loading'         — initial mount, checking state
 *   - 'unsupported'     — browser doesn't support Web Push (very old)
 *   - 'not-configured'  — VAPID public key missing from env (deploy issue)
 *   - 'ios-install-required' — iOS Safari, not yet installed as PWA
 *   - 'permission-denied'   — user previously denied; needs OS-level reset
 *   - 'subscribed'      — push is active, toggle shows ON
 *   - 'unsubscribed'    — supported but not subscribed, toggle shows OFF
 *
 * The toggle row matches the existing AccountSettings card styling (cream
 * background, gold accent, lucide icon left-aligned, description below the
 * label). Same visual language as EmailPreferencesCard.
 */

export default function PushNotificationToggle() {
  const { toast } = useToast();
  const [uiState, setUiState] = useState('loading');
  const [busy, setBusy] = useState(false);

  // Re-derive UI state on mount + after every subscribe/unsubscribe.
  const refreshState = useCallback(async () => {
    if (!isPushSupported()) { setUiState('unsupported'); return; }

    // iOS quirk: PushManager exists but subscribing throws unless the PWA
    // is installed to the home screen first. Surface that requirement
    // up-front.
    if (isIOS() && !isInStandaloneMode()) {
      setUiState('ios-install-required');
      return;
    }

    const { state } = await getSubscriptionState();
    setUiState(state);
  }, []);

  useEffect(() => { refreshState(); }, [refreshState]);

  const handleSubscribe = useCallback(async () => {
    setBusy(true);
    const result = await subscribeToPush();
    setBusy(false);
    if (result.ok) {
      toast({
        title: 'Notifications enabled',
        description: 'We\'ll let you know when there\'s a new match or message.',
      });
      await refreshState();
      return;
    }
    const messages = {
      'unsupported':           'Your browser doesn\'t support push notifications.',
      'no-vapid-key':          'Notifications are not configured yet. Try again later.',
      'not-configured':        'Notifications are not configured yet. Try again later.',
      'permission-denied':     'Notifications are blocked. Enable them in your browser settings to turn this on.',
      'permission-dismissed':  'You\'ll need to allow notifications when prompted.',
      'subscribe-failed':      'Couldn\'t set up notifications. Please try again.',
      'db-failed':             'Notifications were set up but we couldn\'t save your preference. Please try again.',
      'not-authenticated':     'Please sign in again to enable notifications.',
    };
    toast({
      title: 'Couldn\'t enable notifications',
      description: messages[result.reason] || 'Please try again.',
      variant: 'destructive',
    });
    await refreshState();
  }, [toast, refreshState]);

  const handleUnsubscribe = useCallback(async () => {
    setBusy(true);
    await unsubscribeFromPush();
    setBusy(false);
    toast({
      title: 'Notifications turned off',
      description: 'You won\'t get push alerts on this device.',
    });
    await refreshState();
  }, [toast, refreshState]);

  // ----- Render branches -----

  // Don't take up space on browsers where this is impossible.
  if (uiState === 'unsupported' || uiState === 'not-configured') return null;

  return (
    <div className="bg-white rounded-2xl border border-[#E6B450]/20 p-5">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#FAF7F2] flex items-center justify-center">
          {uiState === 'subscribed'
            ? <Bell className="w-5 h-5 text-[#1F1F1F]" aria-hidden="true" />
            : <BellOff className="w-5 h-5 text-[#5F5A56]" aria-hidden="true" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-[#1F1F1F]">Push notifications</h3>
          <p className="text-sm text-[#5F5A56] mt-0.5">
            Get notified on this device when there's a new match or message.
          </p>

          {uiState === 'loading' && (
            <p className="mt-3 text-sm text-[#5F5A56]">Checking…</p>
          )}

          {uiState === 'ios-install-required' && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-[#FAF7F2] text-sm text-[#1F1F1F]">
              <Smartphone className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#E6B450]" aria-hidden="true" />
              <span>
                Add Marryzen to your home screen first. Once installed, open the app from your home screen and come back here to turn on notifications.
              </span>
            </div>
          )}

          {uiState === 'permission-denied' && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-[#FAF7F2] text-sm text-[#1F1F1F]">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#B14961]" aria-hidden="true" />
              <span>
                Notifications are blocked. Enable them in your browser's site settings, then refresh this page.
              </span>
            </div>
          )}

          {uiState === 'unsubscribed' && (
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={busy}
              className="mt-3 px-4 py-2 rounded-lg bg-[#1F1F1F] text-white text-sm font-medium hover:bg-[#3a3a3a] transition-colors disabled:opacity-50"
            >
              {busy ? 'Turning on…' : 'Turn on notifications'}
            </button>
          )}

          {uiState === 'subscribed' && (
            <div className="mt-3 flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm text-[#1F1F1F]">
                <CheckCircle2 className="w-4 h-4 text-[#2F855A]" aria-hidden="true" />
                On for this device
              </span>
              <button
                type="button"
                onClick={handleUnsubscribe}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg border border-[#E6B450]/30 text-[#5F5A56] text-sm hover:bg-[#FAF7F2] transition-colors disabled:opacity-50"
              >
                {busy ? 'Turning off…' : 'Turn off'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
