// Marryzen analytics — thin wrapper over PostHog + Sentry.
// Use track(event, props) for explicit funnel events.
// PostHog autocapture handles every click and pageview automatically.
// Every tracked event is ALSO added as a Sentry breadcrumb so that when
// an error happens, the Sentry issue shows what the user was doing right before.
import posthog from 'posthog-js';
import * as Sentry from '@sentry/react';

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

export function identify(userId, props = {}) {
  try {
    if (typeof posthog?.identify === 'function') {
      posthog.identify(userId, props);
    }
    Sentry.setUser({ id: userId, ...props });
  } catch (_) {}
}

export function reset() {
  try {
    if (typeof posthog?.reset === 'function') posthog.reset();
    Sentry.setUser(null);
  } catch (_) {}
}

// Convenience funnel helpers — encourage consistent event naming.
export const funnel = {
  signupCompleted: (props) => track('signup_completed', props),
  emailVerified: (props) => track('email_verified', props),
  photoUploaded: (props) => track('photo_uploaded', props),
  promptsSaved: (props) => track('prompts_saved', props),
  timelineSet: (props) => track('marriage_timeline_set', props),
  diditStarted: (props) => track('didit_verification_started', props),
  diditCompleted: (props) => track('didit_verification_completed', props),
  discoveryViewed: (props) => track('discovery_viewed', props),
  profileViewed: (props) => track('profile_viewed', props),
  likeSent: (props) => track('like_sent', props),
  passSent: (props) => track('pass_sent', props),
  matchCreated: (props) => track('match_created', props),
  chatOpened: (props) => track('chat_opened', props),
  messageSent: (props) => track('message_sent', props),
  premiumModalShown: (props) => track('premium_modal_shown', props),
  checkoutStarted: (props) => track('checkout_started', props),
  subscriptionActive: (props) => track('subscription_active', props),
  subscriptionCanceled: (props) => track('subscription_canceled', props),
  reportSubmitted: (props) => track('report_submitted', props),
  userBlocked: (props) => track('user_blocked', props),
  accountDeleted: (props) => track('account_deleted', props),
  dataExported: (props) => track('data_exported', props),
};
