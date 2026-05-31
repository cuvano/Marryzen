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
// CANONICAL VALUES (Phase 2C expansion — see migration 2c_migration.sql)
//   religiousAffiliations = ['Islam', 'Christianity',
//     'Christianity (Eastern Orthodox)', 'Christianity (Catholic)',
//     'Christianity (Protestant)', 'Christianity (LDS / Mormon)',
//     'Christianity (Jehovah\'s Witness)', 'Judaism', 'Hinduism',
//     'Buddhism', 'Sikhism', 'Baha\'i', 'Zoroastrian / Parsi',
//     'Atheist' (legacy, back-compat only), 'Non-religious',
//     'Spiritual but not religious', 'Other', 'Prefer not to say']
//
// CANONICAL FAITH LIFESTYLES (Step3.jsx line 38)
//   faithLifestyles = ['Very religious / practicing', 'Moderately practicing',
//     'Cultural faith only', 'Spiritual but not religious',
//     'Not religious / Not practicing', 'Prefer not to say']

// Display map — session-11 Phase 2C: expanded for the larger religion list.
// Pattern: noun (DB) → adjective/short form (UI). For Christianity sub-options
// we use the parent adjective ('Christian') with the tradition in parens so
// the chip strip stays readable while still surfacing the specificity.
const RELIGION_DISPLAY = {
  'Islam': 'Muslim',
  'Christianity': 'Christian',
  'Christianity (Eastern Orthodox)': 'Christian (Orthodox)',
  'Christianity (Catholic)': 'Catholic',
  'Christianity (Protestant)': 'Protestant',
  'Christianity (LDS / Mormon)': 'LDS',
  "Christianity (Jehovah's Witness)": "Jehovah's Witness",
  'Judaism': 'Jewish',
  'Hinduism': 'Hindu',
  'Buddhism': 'Buddhist',
  'Sikhism': 'Sikh',
  "Baha'i": "Baha'i",
  'Zoroastrian / Parsi': 'Zoroastrian',
  'Atheist': 'Non-religious',          // legacy DB value, display as new label
  'Non-religious': 'Non-religious',
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

// Filter-grouping map — when a user filters Discovery by a parent denomination
// like "Christianity", they likely want to see anyone Christian regardless of
// sub-denomination. Maps each canonical filter value to the full set of DB
// values that should match. Sub-options match themselves only.
// Includes the Atheist → Non-religious back-compat shim.
const RELIGION_FILTER_GROUPS = {
  'Christianity': [
    'Christianity',
    'Christianity (Eastern Orthodox)',
    'Christianity (Catholic)',
    'Christianity (Protestant)',
    'Christianity (LDS / Mormon)',
    "Christianity (Jehovah's Witness)",
  ],
  // Filtering for "Non-religious" should also surface legacy 'Atheist' rows.
  'Non-religious': ['Non-religious', 'Atheist'],
};

/**
 * Expand a religion filter value to the array of DB values it should match.
 * For parent denominations (Christianity), returns all sub-options. For
 * specific sub-options or single-value religions, returns just that value
 * in a one-element array. Null/undefined returns []. Useful for Supabase
 * `.in()` queries.
 */
export function getReligionFilterValues(value) {
  if (!value) return [];
  return RELIGION_FILTER_GROUPS[value] || [value];
}

export const CANONICAL_RELIGIONS = Object.keys(RELIGION_DISPLAY);
export const CANONICAL_FAITH_LIFESTYLES = Object.keys(FAITH_LIFESTYLE_DISPLAY);
