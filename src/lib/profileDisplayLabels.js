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

const RELATIONSHIP_GOAL_DISPLAY = {
  'Serious Relationship → Marriage': 'Dating with marriage in mind',
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
};

const MARRIAGE_TIMELINE_DISPLAY = {
  'within_6mo': 'Hoping to marry within 6 months',
  'within_1y': 'Hoping to marry within a year',
  'within_2y': 'Open to marrying within 2 years',
  'open': 'Marriage-minded, no fixed timeline',
};

// Family-goals stored as an array (per DB schema: family_goals text[]).
// Common values include 'want_children_soon', 'open_to_children', etc.
// We keep "Open to children" untouched per VP T&S verdict — already warm.
const FAMILY_GOALS_DISPLAY = {
  'want_children_soon': 'Wants children soon',
  'open_to_children': 'Open to children',
  'no_children': 'Doesn\'t want children',
  'has_children_open_to_more': 'Has children, open to more',
  'has_children_no_more': 'Has children, no more planned',
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
