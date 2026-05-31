// src/lib/onboardingStatus.js
//
// Single source of truth for "is this profile finished onboarding?"
// Use everywhere that needs to decide between routing to /onboarding vs /dashboard.
//
// History: Phase 2E (session 11) split Step 3 into 3a + 3b, bumping totalSteps
// from 5 to 6. LoginPage was hard-coding `< 5` in two places — combined with
// a "null falls through to dashboard" branch, this let users with incomplete
// profiles (no photos, no bio, no values) reach the dashboard. Friend's test
// account hit this exact bug.

export const ONBOARDING_TOTAL_STEPS = 6;

/**
 * True only when the profile is finished with onboarding.
 *
 * A profile is "complete" iff onboarding_step is a number >= ONBOARDING_TOTAL_STEPS.
 * - null / undefined → NOT complete (default-deny, so we never accidentally send
 *   a half-finished or fresh-account user to the dashboard).
 * - Any non-number (string, etc.) → NOT complete (defensive).
 * - >= total → complete (the >= is forward-compatible if we ever add a step).
 *
 * @param {{ onboarding_step?: number | null } | null | undefined} profile
 * @returns {boolean}
 */
export function isOnboardingComplete(profile) {
  if (!profile) return false;
  const step = profile.onboarding_step;
  if (typeof step !== 'number') return false;
  return step >= ONBOARDING_TOTAL_STEPS;
}
