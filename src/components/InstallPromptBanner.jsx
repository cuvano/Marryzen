import React, { useEffect, useState, useCallback } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';
import {
  subscribeToInstallPrompt,
  fireInstallPrompt,
  isIOS,
  isInStandaloneMode,
} from '@/lib/pwa';
import { track } from '@/lib/analytics';

/**
 * InstallPromptBanner — bottom-anchored, dismissible install CTA.
 *
 * Two states (mutually exclusive):
 *
 *   (A) Android / desktop Chrome / Edge — we have the captured
 *       beforeinstallprompt event. Banner shows a one-tap "Install" button
 *       that fires the native install dialog.
 *
 *   (B) iOS Safari / iOS Chrome — no programmatic prompt available. Banner
 *       shows step-by-step instructions ("Tap Share, then Add to Home Screen").
 *
 * Hide conditions (ALL of which suppress the banner):
 *   - User has already installed the app (display-mode: standalone)
 *   - User dismissed the banner in this browser (localStorage flag, 30-day TTL)
 *   - On Android: beforeinstallprompt hasn't fired yet (site not yet eligible
 *     — Chrome requires user engagement before firing it)
 *   - On iOS but not Safari (e.g., in-app browsers like Instagram WebView
 *     where Add-to-Home-Screen doesn't work)
 *
 * Timing:
 *   - Mounts at app shell level so it's available on every route
 *   - Shows after a 5s delay so it doesn't interrupt the initial landing
 *     experience or compete with the Termly consent banner for attention
 */

const DISMISS_KEY = 'mz_pwa_install_dismissed_at';
const DISMISS_TTL_DAYS = 30;

function wasRecentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    const ageMs = Date.now() - dismissedAt;
    return ageMs < DISMISS_TTL_DAYS * 86400000;
  } catch (_) {
    return false;
  }
}

function markDismissed() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (_) {}
}

// Distinguish real iOS Safari from in-app browsers (Instagram, FB, TikTok,
// etc.) where Add-to-Home-Screen does not work even on iOS.
function isRealIOSSafari() {
  if (!isIOS()) return false;
  const ua = navigator.userAgent || '';
  // In-app browsers usually advertise FBAN/FBAV/Instagram/Line/TikTok/etc.
  if (/FBAN|FBAV|Instagram|Line|MicroMessenger|TikTok|Twitter|Snapchat/i.test(ua)) return false;
  return true;
}

export default function InstallPromptBanner() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isInStandaloneMode());

    if (wasRecentlyDismissed()) return undefined;
    if (isInStandaloneMode()) return undefined;

    const unsub = subscribeToInstallPrompt((evt) => setInstallPrompt(evt));

    // 5-second grace so the banner doesn't compete with Termly consent
    // banner or first-paint content for attention.
    const timer = setTimeout(() => setVisible(true), 5000);

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (installPrompt) {
      const choice = await fireInstallPrompt();
      if (choice && choice.outcome === 'accepted') {
        setVisible(false);
        markDismissed();
      } else {
        // Dismissed — respect that for the TTL
        markDismissed();
        setVisible(false);
      }
      return;
    }
    // No native prompt available → assume iOS, show instructions panel.
    setShowIOSInstructions(true);
    try { track('pwa_ios_instructions_shown'); } catch (_) {}
  }, [installPrompt]);

  const handleDismiss = useCallback(() => {
    markDismissed();
    setVisible(false);
    setShowIOSInstructions(false);
    try { track('pwa_install_banner_dismissed'); } catch (_) {}
  }, []);

  // Don't render at all if app is already installed.
  if (standalone) return null;
  if (!visible) return null;

  // Determine which UI to show.
  const canPromptNatively = !!installPrompt;
  const showIOSAffordance = !canPromptNatively && isRealIOSSafari();

  // If we have no native prompt AND we're not on iOS Safari, suppress the
  // banner — there's nothing actionable for the user on Firefox desktop, etc.
  if (!canPromptNatively && !showIOSAffordance) return null;

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Install Marryzen to your home screen"
      className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 sm:pb-6 pointer-events-none"
    >
      <div className="max-w-md mx-auto bg-white border border-[#E6B450]/30 rounded-2xl shadow-lg pointer-events-auto overflow-hidden">
        {!showIOSInstructions ? (
          <div className="flex items-center gap-3 p-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#E6B450] flex items-center justify-center">
              <Download className="w-6 h-6 text-[#1F1F1F]" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1F1F1F]">Add Marryzen to your home screen</p>
              <p className="text-xs text-[#5F5A56] mt-0.5">
                {canPromptNatively
                  ? 'Faster access. No app store needed.'
                  : 'Tap to see how — takes 5 seconds.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleInstall}
              className="flex-shrink-0 px-4 py-2 rounded-lg bg-[#1F1F1F] text-white text-sm font-medium hover:bg-[#3a3a3a] transition-colors"
            >
              {canPromptNatively ? 'Install' : 'Show me'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
              className="flex-shrink-0 p-2 rounded-lg text-[#5F5A56] hover:bg-[#FAF7F2] transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#E6B450] flex items-center justify-center">
                <Download className="w-6 h-6 text-[#1F1F1F]" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1F1F1F]">Add Marryzen to your home screen</p>
                <p className="text-xs text-[#5F5A56] mt-0.5">Two taps in Safari.</p>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss install instructions"
                className="flex-shrink-0 p-2 rounded-lg text-[#5F5A56] hover:bg-[#FAF7F2] transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <ol className="space-y-2 ml-1">
              <li className="flex items-center gap-2 text-sm text-[#1F1F1F]">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FAF7F2] text-xs font-semibold flex items-center justify-center">1</span>
                <span>Tap the</span>
                <Share className="w-4 h-4 text-[#007AFF]" aria-label="Share icon" />
                <span>Share button below.</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-[#1F1F1F]">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FAF7F2] text-xs font-semibold flex items-center justify-center">2</span>
                <span>Scroll and tap</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FAF7F2] text-xs font-medium">
                  <Plus className="w-3 h-3" aria-hidden="true" />
                  Add to Home Screen
                </span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
