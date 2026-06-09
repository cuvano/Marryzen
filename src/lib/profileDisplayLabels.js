// src/lib/profileDisplayLabels.js
//
// Display-label maps for profile-page UI strings. Per the session-11 exec
// board verdict (VP Product + VP Growth + VP T&S):
// the DB stores canonical/raw values, but the profile page renders warmer,
// more human-feeling copy. This is the same pattern as religionLabels.js.
//
// Why not pure DB rename? Backward compat with existing rows and the
// onboarding wizard. Why not at write time? Same. Why these specific
// strings? Approved by the board on session 11 — see brief.
//
// LEVEL-3 AUDIT UPDATE 2026-06-08:
// Three board members independently flagged a 100% miss rate on
// displayFamilyGoals (helper keys were snake_case but Step4 form writes
// Title Case). Plus DiscoveryPage / ProfileCard / MatchesPage / ChatPage /
// DashboardPage / UserManagement all bypassed the helpers and rendered raw
// DB values — the exact Maria-class bug that surfaced on marital_status.
// Fixes here:
//   • RELATIONSHIP_GOAL_DISPLAY: expanded to cover the three current Step5
//     canonical values + legacy "Traditional Marriage Mindset"
//   • FAMILY_GOALS_DISPLAY: rewritten to use the SIX exact Step4 form values
//     as keys, mapping each to a warmer phrase the board approved
//   • New `displayEducation` helper (raw values are already friendly,
//     but centralizes for consistency and future warming)
//   • All helpers null-safe; return '' on empty/null/undefined so callers
//     can use the standard `{value && <Row ... />}` pattern.

const RELATIONSHIP_GOAL_DISPLAY = {
  // Current canonical Step5 options
  'Marriage Within 1–2 Years': 'Hoping to marry within 1–2 years',
  'Family-Supervised Courtship': 'Family-supervised courtship',
  'Serious Relationship → Marriage': 'Dating with marriage in mind',
  // Legacy values (kept untouched in DB per Jun 8 normalization decision)
  'Traditional Marriage Mindset': 'Traditional marriage mindset',
  // Older legacy values still mapped for safety
  'Serious Relationship': 'Dating with marriage in mind',
  'Marriage': 'Dating with marriage in mind',
  'Friendship First': 'Friendship-first, then marriage',
};

const RELOCATE_DISPLAY = {
  true: 'Open to relocating for the right person',
  false: 'Prefers to stay where they are',
  'true': 'Open to relocating for the right person',
  'false': 'Prefers to stay where they are',
  'Yes': 'Open to relocating for the right person',
  'No': 'Prefers to stay where they are',
  'Maybe': 'Open to relocating with the right partner',
};

const MARRIAGE_TIMELINE_DISPLAY = {
  'within_6mo': 'Hoping to marry within 6 months',
  'within_1y': 'Hoping to marry within a year',
  'within_2y': 'Open to marrying within 2 years',
  'open': 'Marriage-minded, no fixed timeline',
};

// LEVEL-3 FIX: keys now match what Step4 actually writes. Six options.
// Previous keys (snake_case like 'want_children_soon') never matched.
const FAMILY_GOALS_DISPLAY = {
  'Want children (1-2)': 'Hopes for 1–2 children',
  'Want children (2-3)': 'Hopes for 2–3 children',
  'Want children (3-4)': 'Hopes for 3–4 children',
  'Want children (5+)': 'Hopes for a larger family',
  'Open to children': 'Open to children',
  "Don't want children": 'Not planning on children',
};

const SMOKING_DISPLAY = {
  'No': "Doesn't smoke",
  'Socially': 'Smokes socially',
  'Regularly': 'Smokes regularly',
};
const DRINKING_DISPLAY = {
  'No': "Doesn't drink",
  'Socially': 'Drinks socially',
  'Regularly': 'Drinks regularly',
};
const MARITAL_DISPLAY = {
  'Never Married': 'Never married',
  'Divorced': 'Divorced',
  'Widowed': 'Widowed',
  'Annulled': 'Marriage annulled',
};

// Education values from Step3b are already display-friendly. This helper
// exists for consistency with the rest of the family so callers always go
// through the same code path. Future copy warming lives here.
const EDUCATION_DISPLAY = {
  'High School': 'High School',
  'Some College': 'Some College',
  "Bachelor's Degree": "Bachelor's Degree",
  "Master's Degree": "Master's Degree",
  'Doctorate': 'Doctorate',
  'Professional Degree': 'Professional Degree',
};

/**
 * Display label for relationship_goal value. Falls back to original.
 */
export function displayRelationshipGoal(value) {
  if (!value) return '';
  return RELATIONSHIP_GOAL_DISPLAY[value] || value;
}

/**
 * Display label for willing_to_relocate (boolean OR Yes/No string).
 */
export function displayRelocate(value) {
  if (value === null || value === undefined) return '';
  return RELOCATE_DISPLAY[value] || String(value);
}

/**
 * Display label for marriage_timeline value.
 */
export function displayMarriageTimeline(value) {
  if (!value) return '';
  return MARRIAGE_TIMELINE_DISPLAY[value] || value;
}

/**
 * Display label for family_goals — accepts either a single string or
 * the first element of an array.
 */
export function displayFamilyGoals(value) {
  if (!value) return '';
  const v = Array.isArray(value) ? value[0] : value;
  if (!v) return '';
  return FAMILY_GOALS_DISPLAY[v] || v;
}

/**
 * Smoking lifestyle display label.
 */
export function displaySmoking(value) {
  if (!value) return '';
  return SMOKING_DISPLAY[value] || value;
}

/**
 * Drinking lifestyle display label.
 */
export function displayDrinking(value) {
  if (!value) return '';
  return DRINKING_DISPLAY[value] || value;
}

/**
 * Marital history display label.
 */
export function displayMaritalStatus(value) {
  if (!value) return '';
  return MARITAL_DISPLAY[value] || value;
}

/**
 * Education level display label.
 */
export function displayEducation(value) {
  if (!value) return '';
  return EDUCATION_DISPLAY[value] || value;
}

/**
 * Has-children display — handles null/undefined safely so callers don't
 * accidentally render "No" for users who simply haven't answered the
 * question (DB null vs explicit boolean false).
 *
 * Returns '' for null/undefined → caller should not render the row.
 * Returns 'Yes' / 'No' for explicit boolean true / false.
 *
 * @param {boolean|null|undefined} value
 * @param {boolean|null|undefined} livesWithYou Optional second value:
 *   when true → "Yes — they live with me"; when false → "Yes — separately"
 */
export function displayHasChildren(value, livesWithYou) {
  if (value === null || value === undefined) return '';
  if (value === false) return 'No';
  if (livesWithYou === true) return 'Yes — they live with me';
  if (livesWithYou === false) return 'Yes — they live separately';
  return 'Yes';
}
