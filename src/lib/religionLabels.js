// src/lib/religionLabels.js
//
// Display-label map for religious_affiliation + faith_lifestyle.
//
// Per the session-11 exec board verdict (VP Product + VP T&S + VP Legal):
// the DB stores the canonical NOUN (e.g. 'Islam') because that's what
// Step3.jsx onboarding writes and DiscoveryPage's strict-equality filter
// queries — but profile cards, filter chips, and admin panels should
// render the warmer adjective (e.g. 'Muslim'). Per VP Product: 'users
// self-identify as Muslim, not as an Islam — the card copy must reflect
// that or it reads like a Wikipedia infobox.'
//
// CANONICAL VALUES (source: src/components/onboarding/Step3.jsx line 37)
//   religiousAffiliations = ['Islam', 'Christianity', 'Judaism',
//     'Hinduism', 'Buddhism', 'Sikhism', 'Atheist',
//     'Spiritual but not religious', 'Other', 'Prefer not to say']
//
// CANONICAL FAITH LIFESTYLES (Step3.jsx line 38)
//   faithLifestyles = ['Very religious / practicing', 'Moderately practicing',
//     'Cultural faith only', 'Spiritual but not religious',
//     'Not religious / Not practicing', 'Prefer not to say']

const RELIGION_DISPLAY = {
  'Islam': 'Muslim',
  'Christianity': 'Christian',
  'Judaism': 'Jewish',
  'Hinduism': 'Hindu',
  'Buddhism': 'Buddhist',
  'Sikhism': 'Sikh',
  'Atheist': 'Atheist',
  'Spiritual but not religious': 'Spiritual',
  'Other': 'Other',
  'Prefer not to say': 'Prefer not to say',
};

const FAITH_LIFESTYLE_DISPLAY = {
  'Very religious / practicing': 'Practicing',
  'Moderately practicing': 'Moderately practicing',
  'Cultural faith only': 'Cultural faith',
  'Spiritual but not religious': 'Spiritual',
  'Not religious / Not practicing': 'Not practicing',
  'Prefer not to say': 'Prefer not to say',
};

/**
 * Map a canonical religion stored in DB to its display label.
 * Falls back to the original value if no mapping exists (forward-compatible
 * if the canonical enum grows). Returns empty string for null/undefined.
 *
 * @param {string|null|undefined} value canonical religion noun from DB
 * @returns {string} display-friendly label (usually the adjective form)
 */
export function displayReligion(value) {
  if (!value) return '';
  return RELIGION_DISPLAY[value] || value;
}

/**
 * Map a canonical faith lifestyle to its display label.
 * Falls back to original if no mapping exists.
 *
 * @param {string|null|undefined} value canonical lifestyle from DB
 * @returns {string} shorter display label
 */
export function displayFaithLifestyle(value) {
  if (!value) return '';
  return FAITH_LIFESTYLE_DISPLAY[value] || value;
}

/**
 * Validate a religion value matches the canonical set. Useful for tests
 * or admin tooling. Returns true for null (column is nullable) or any
 * canonical value, false otherwise.
 */
export function isCanonicalReligion(value) {
  return value == null || Object.prototype.hasOwnProperty.call(RELIGION_DISPLAY, value);
}

export const CANONICAL_RELIGIONS = Object.keys(RELIGION_DISPLAY);
export const CANONICAL_FAITH_LIFESTYLES = Object.keys(FAITH_LIFESTYLE_DISPLAY);
