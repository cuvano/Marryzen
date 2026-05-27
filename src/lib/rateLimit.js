// src/lib/rateLimit.js
//
// Client-side wrapper for the rate-limit Edge Function.
//
// USAGE
// -----
//   import { checkRateLimit } from '@/lib/rateLimit';
//
//   const gate = await checkRateLimit('LOGIN_ATTEMPTS', { toast });
//   if (!gate.allowed) return;            // user already saw a toast
//   await supabase.auth.signInWithPassword(...);
//
// Pass the action name (one of: LOGIN_ATTEMPTS, SIGNUP_ATTEMPTS, MESSAGE_SEND,
// LIKE, PROFILE_VIEW, SEARCH, REPORT_SUBMIT, API_REQUEST). Optionally pass a
// `toast` function — if provided, a destructive toast is shown when the
// caller is rate-limited so the call site doesn't have to repeat the UX code.
//
// FAIL-OPEN: if the Edge Function is unreachable or errors unexpectedly,
// this returns { allowed: true, failOpen: true } so the user isn't locked
// out of legitimate actions during an outage. Mirrors the Edge Function's
// own fail-open behavior. Trade-off: brief abuse window during incidents.

import { supabase } from '@/lib/customSupabaseClient';

const DEFAULT_BLOCKED_TITLE = 'Slow down';

export async function checkRateLimit(action, opts = {}) {
  if (!action || typeof action !== 'string') {
    console.warn('checkRateLimit: action is required');
    return { allowed: true, failOpen: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke('rate-limit', {
      body: { action },
    });

    // Path A: HTTP non-2xx (e.g., 429 from our function). supabase-js v2
    // surfaces these as FunctionsHttpError with `error.context` being the
    // raw Response. FunctionsRelayError / FunctionsFetchError don't have
    // `.context`, so we guard before touching it.
    if (error) {
      const ctx = error?.context;
      const hasResponseContext =
        ctx && typeof ctx.status === 'number' && typeof ctx.json === 'function';
      if (hasResponseContext && ctx.status === 429) {
        let body = {};
        try {
          // Clone before reading in case anything upstream needs it.
          body = await ctx.clone().json();
        } catch (_) {
          // Couldn't parse JSON — fall through with whatever we have.
        }
        // Prefer body.retry_after, then the Retry-After response header,
        // then leave undefined.
        let retryAfter = body?.retry_after;
        if (retryAfter == null && typeof ctx.headers?.get === 'function') {
          const headerVal = ctx.headers.get('Retry-After');
          if (headerVal) {
            const parsed = Number(headerVal);
            if (Number.isFinite(parsed)) retryAfter = parsed;
          }
        }
        const message =
          body?.message ||
          `Too many ${action.replace(/_/g, ' ').toLowerCase()} requests. Please wait a moment.`;
        if (opts.toast) {
          opts.toast({
            title: DEFAULT_BLOCKED_TITLE,
            description: message,
            variant: 'destructive',
          });
        }
        return {
          allowed: false,
          message,
          retryAfter,
        };
      }
      // Other error (network down, function crashed, non-429 HTTP, etc.) — fail OPEN
      console.warn('checkRateLimit: invoke failed (fail-open):', error);
      return { allowed: true, failOpen: true };
    }

    // Path B: 200 OK. Either { allowed: true, ... } or { allowed: false, ... }
    // (the latter shouldn't happen with our current Edge Function but is
    // defensively handled).
    if (data && data.allowed === false) {
      const message =
        data.message ||
        `Too many ${action.replace(/_/g, ' ').toLowerCase()} requests.`;
      if (opts.toast) {
        opts.toast({
          title: DEFAULT_BLOCKED_TITLE,
          description: message,
          variant: 'destructive',
        });
      }
      return {
        allowed: false,
        message,
        retryAfter: data.retry_after,
      };
    }

    return {
      allowed: true,
      remaining: data?.remaining,
      resetAt: data?.reset_at,
      failOpen: data?.fail_open === true,
    };
  } catch (e) {
    console.warn('checkRateLimit: unexpected error (fail-open):', e);
    return { allowed: true, failOpen: true };
  }
}
