import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import posthog from 'posthog-js';
import * as Sentry from '@sentry/react';

// Sentry: error tracking + perf. Init before anything renders so we capture mount errors.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
    // Privacy: never send PII automatically. We attach user attribution
    // explicitly via SupabaseAuthContext (window.Sentry?.setUser) only
    // when we have a verified auth.uid.
    sendDefaultPii: false,
  });
  // L3 2026-06-09: expose the Sentry namespace on window so the
  // SupabaseAuthContext shim (window.Sentry?.setUser) can attach the
  // authenticated user. PostHog auto-attaches itself; Sentry does not.
  if (typeof window !== 'undefined') {
    window.Sentry = Sentry;
  }
}

// PostHog: product analytics. Loaded second so a PostHog hiccup never blocks Sentry.
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    autocapture: true,
    session_recording: { maskAllInputs: true },
    // Phase 45 2026-06-12: defer the first $pageview so it lands on the
    // authenticated distinct_id after SupabaseAuthContext fires identify().
    // Previously this was true, which meant every signed-in user's first
    // pageview was anonymous and PostHog showed device IDs instead of
    // auth.uid in the Activity feed.
    capture_pageview: false,
    capture_pageleave: true,
  });
  // Phase 45 2026-06-12: ES-module `import posthog from 'posthog-js'` does
  // NOT auto-attach to window in modern posthog-js versions — that's only
  // the snippet loader. The SupabaseAuthContext shim (window.posthog?.identify)
  // depends on this assignment to actually attribute events. Without it,
  // every event is anonymous regardless of auth state.
  if (typeof window !== 'undefined') {
    window.posthog = posthog;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary fallback={<div style={{padding:'2rem',textAlign:'center'}}>Something went wrong. Please refresh the page.</div>}>
    <App />
  </Sentry.ErrorBoundary>
);
