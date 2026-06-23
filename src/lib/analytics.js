// Marryzen analytics — thin wrapper over PostHog + Sentry + Meta Pixel.
// Use track(event, props) for explicit funnel events.
// PostHog autocapture handles every click and pageview automatically.
// Every tracked event is ALSO added as a Sentry breadcrumb so that when
// an error happens, the Sentry issue shows what the user was doing right before.
// Selected funnel events ALSO fire Meta Pixel standard events so Meta ad
// reporting + optimization gets per-conversion-value signal.
import posthog from 'posthog-js';
import * as Sentry from '@sentry/react';
import { formatReferralSource } from '@/lib/utm';

export function track(event, props = {}) {
  try {
    if (typeof posthog?.capture === 'function') {
      posthog.capture(event, props);
    }
    Sentry.addBreadcrumb({
      category: 'event',
      message: event,
      level: 'info',
      data: props,
    });
  } catch (_) {
    // never let analytics crash the app
  }
}

function fbPixel(eventName, params = {}) {
  try {
    if (typeof window === 'undefined') return;
    if (typeof window.fbq !== 'function') return;
    window.fbq('track', eventName, params);
  } catch (_) {}
}

export function identify(userId, props = {}) {
  try {
    // Phase 2 UTM (2026-06-22): auto-enrich the PostHog identify call with
    // the captured attribution source (formatReferralSource pulls from the
    // mz_utm_v1 cookie set on first visit). This makes the source available
    // as a PostHog person-property so we can cohort by acquisition channel
    // in the analytics dashboard ("show me Day-7 retention by referral_source").
    // Null when the user arrived direct, which is fine — PostHog handles
    // null properties cleanly.
    const enrichedProps = { ...props };
    if (!('referral_source' in enrichedProps)) {
      const src = formatReferralSource();
      if (src) enrichedProps.referral_source = src;
    }

    if (typeof posthog?.identify === 'function') {
      posthog.identify(userId, enrichedProps);
    }
    Sentry.setUser({ id: userId, ...enrichedProps });
  } catch (_) {}
}

export function reset() {
  try {
    if (typeof posthog?.reset === 'function') posthog.reset();
    Sentry.setUser(null);
  } catch (_) {}
}

export const funnel = {
  signupCompleted: (props) => {
    // Phase 2 UTM (2026-06-22): include the captured referral_source on the
    // signup_completed event so we can attribute first-conversion events to
    // their inbound channel without needing a join against the profiles
    // table in downstream PostHog reports.
    const src = formatReferralSource();
    const enriched = src ? { ...props, referral_source: src } : props;
    track('signup_completed', enriched);
    fbPixel('Lead');
  },
  emailVerified: (props) => track('email_verified', props),
  photoUploaded: (props) => track('photo_uploaded', props),
  promptsSaved: (props) => track('prompts_saved', props),
  timelineSet: (props) => track('marriage_timeline_set', props),
  diditStarted: (props) => track('didit_verification_started', props),
  diditCompleted: (props) => {
    track('didit_verification_completed', props);
    fbPixel('CompleteRegistration');
  },
  discoveryViewed: (props) => track('discovery_viewed', props),
  profileViewed: (props) => track('profile_viewed', props),
  likeSent: (props) => track('like_sent', props),
  passSent: (props) => track('pass_sent', props),
  matchCreated: (props) => track('match_created', props),
  chatOpened: (props) => track('chat_opened', props),
  messageSent: (props) => track('message_sent', props),
  premiumModalShown: (props) => track('premium_modal_shown', props),
  checkoutStarted: (props) => {
    track('checkout_started', props);
    const value = props?.value;
    const currency = props?.currency || 'USD';
    if (typeof value === 'number' && value > 0) {
      fbPixel('InitiateCheckout', { value, currency });
      fbPixel('Subscribe', { value, currency });
    } else {
      fbPixel('InitiateCheckout');
    }
  },
  subscriptionActive: (props) => track('subscription_active', props),
  subscriptionCanceled: (props) => track('subscription_canceled', props),
  reportSubmitted: (props) => track('report_submitted', props),
  userBlocked: (props) => track('user_blocked', props),
  accountDeleted: (props) => track('account_deleted', props),
  dataExported: (props) => track('data_exported', props),

  // Phase 41a — deal-breaker telemetry. North-star metric is Day-7 return
  // rate of founding-500 users segmented by dealbreakers_set_count, so we
  // need (a) the count at onboarding completion, (b) every toggle change,
  // and (c) empty-feed events tagged with which dealbreakers were active.
  // See Matchmaking_v1.5_Decision_2026-06-13.md for the full success criteria.
  dealbreakersSet: (props) => track('dealbreakers_set', props),
  dealbreakersChanged: (props) => track('dealbreakers_changed', props),
  discoveryEmptyByDealbreakers: (props) => track('discovery_empty_by_dealbreakers', props),
};
