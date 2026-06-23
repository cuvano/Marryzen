import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import posthog from 'posthog-js';
import * as Sentry from '@sentry/react';
import { captureAndStoreUTM } from '@/lib/utm';

// ============================================================================
// UTM attribution capture — runs synchronously before React mounts so we
// never miss a first-visit utm_source. Cheap (~1ms): just reads URL params,
// writes one cookie if any utm_* present, idempotent on subsequent loads.
//
// First-visit-wins: if a cookie already exists from a prior visit, this is
// a no-op. We intentionally don't defer to requestIdleCallback because the
// user could click "Sign up" before idle fires.
//
// See src/lib/utm.js for the cookie format + GDPR posture (functional
// cookie, not a marketing tracker).
// ============================================================================
captureAndStoreUTM();

// ============================================================================
// Sentry: error tracking + perf. Init before anything renders so we capture
// mount errors.
// ============================================================================
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
  });
}

// ============================================================================
// PostHog: product analytics.
//
// Phase 44 fix (2026-06-13): defer init until the main thread is idle, and
// disable in-page surveys. Sentry was reporting a RangeError "Maximum call
// stack size exceeded" on the homepage from iOS Chrome Mobile — 5 events in
// 7 days, burst of 4 in 4 minutes from a single retry-looping session.
//
// Root cause: Termly's autoBlock script (loaded first in index.html) monkey-
// patches document.createElement to gate downstream pixels. PostHog SDK's
// surveys feature dynamically injects /static/surveys.js into <head> during
// SDK init. On iOS WebKit's smaller stack, the Termly wrapper + the inject
// + react-helmet's MutationObserver re-rendering <head> form a re-entry
// trampoline that overflows. Chrome desktop has a much larger stack so it
// survives; iOS Safari/Chrome (both WebKit) do not.
//
// Two-pronged mitigation:
//   1. disable_surveys: true   → eliminates the dynamic surveys.js injection
//      entirely (surveys aren't in use pre-launch anyway). Root cause fix.
//   2. requestIdleCallback     → delays PostHog init until the browser is
//      idle, after Termly + react-helmet have finished initial settling.
//      Belt-and-suspenders for any future SDK addition that does similar
//      dynamic injection.
//
// We keep `capture_pageview: true` and `autocapture: true` because both are
// load-bearing for Phase 45's funnel-tracking work and don't trigger
// dynamic head injection (autocapture only patches addEventListener, which
// happens once and doesn't trampoline).
// ============================================================================
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
if (POSTHOG_KEY) {
  const initPostHog = () => {
    posthog.init(POSTHOG_KEY, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      autocapture: true,
      session_recording: { maskAllInputs: true },
      capture_pageview: true,
      capture_pageleave: true,
      disable_surveys: true,
    });
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    // requestIdleCallback fires when the main thread is idle, with a hard
    // timeout fallback so PostHog never goes longer than 4s without init.
    window.requestIdleCallback(initPostHog, { timeout: 4000 });
  } else {
    // Safari < 16 / older WebKit fallback — setTimeout with a generous delay
    // so Termly's autoBlock has finished hooking everything it needs.
    setTimeout(initPostHog, 3000);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary fallback={<div style={{padding:'2rem',textAlign:'center'}}>Something went wrong. Please refresh the page.</div>}>
    <App />
  </Sentry.ErrorBoundary>
);
