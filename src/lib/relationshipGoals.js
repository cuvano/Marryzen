// src/lib/relationshipGoals.js
//
// Phase 41a + Phase 41b (2026-06-13) — single source of truth for the four
// canonical relationship_goal stored values, their display labels, and the
// board-approved 5x5 compatibility matrix used by the matchmaking scorer.
//
// Decision doc: C:\Marryzen\Marriage_Intent_Matrix_Decision_2026-06-13.md
//
// CLAUDE.md 2026-06-08 lockdown: the four stored values are CHECK-constraint
// equivalent — onboarding writes them, the matchmaking scorer keys on them,
// and any seed/admin tool MUST use these exact strings. The U+2013 en-dash
// in `Marriage Within 1–2 Years` and the U+2192 right-arrow in
// `Serious Relationship → Marriage` are intentional. Do not "fix" to ASCII.

export const RELATIONSHIP_GOALS = Object.freeze({
  TMM: 'Traditional Marriage Mindset',
  M12: 'Marriage Within 1–2 Years',           // U+2013 en-dash
  FSC: 'Family-Supervised Courtship',
  SRM: 'Serious Relationship → Marriage',     // U+2192 right arrow
});

/** All 4 canonical stored values, for iteration + validation. */
export const RELATIONSHIP_GOAL_VALUES = Object.freeze(Object.values(RELATIONSHIP_GOALS));

/**
 * Display labels (UI-only, NOT stored). Updated 2026-06-13 per board verdict:
 * the old "Marriage First — No Dating Period" TMM label was performatively
 * strict in a way that obscured the user's actual openness to family
 * involvement. New label "Marriage-bound, family-introduced" reflects the
 * matrix-aware similarity with FSC (90% compatible).
 *
 * The stored value for TMM remains `Traditional Marriage Mindset` — display
 * rename is free, schema rename would cascade.
 */
export const RELATIONSHIP_GOAL_LABELS = Object.freeze({
  [RELATIONSHIP_GOALS.TMM]: 'Marriage-bound, family-introduced',
  [RELATIONSHIP_GOALS.M12]: 'Marriage Within 1 to 2 Years',
  [RELATIONSHIP_GOALS.FSC]: 'Family-Supervised Courtship',
  [RELATIONSHIP_GOALS.SRM]: 'Serious Relationship Leading to Marriage',
});

/**
 * Short user-facing descriptions for the onboarding Step5 radio list.
 * Kept parallel to the labels above so a copy change here doesn't desync.
 */
export const RELATIONSHIP_GOAL_DESCRIPTIONS = Object.freeze({
  [RELATIONSHIP_GOALS.TMM]: 'I am only interested in communication that leads directly to marriage.',
  [RELATIONSHIP_GOALS.M12]: 'I am actively preparing for marriage within the next 1 to 2 years.',
  [RELATIONSHIP_GOALS.FSC]: 'I want my family involved during a longer courtship that leads to marriage.',
  [RELATIONSHIP_GOALS.SRM]: 'I want to build a serious relationship that leads to marriage at the right time.',
});

/**
 * Board-approved 4x4 symmetric compatibility matrix (2026-06-13).
 * See Marriage_Intent_Matrix_Decision_2026-06-13.md for reasoning per cell.
 *
 * Diagonals = 1.0 (exact match).
 * TMM ↔ FSC = 0.9   (both family-mediated, marriage-bound)
 * M12 ↔ SRM = 0.7   (both modern-marriage-intent; differ on urgency)
 * TMM ↔ M12 = 0.5   (structured but opposite on dating axis)
 * FSC ↔ M12 = 0.5   (family vs timeline-driven)
 * FSC ↔ SRM = 0.4   (family-expectation mismatch)
 * TMM ↔ SRM = 0.3   (near-opposite postures on what courtship IS)
 */
const COMPAT = Object.freeze({
  [RELATIONSHIP_GOALS.TMM]: Object.freeze({
    [RELATIONSHIP_GOALS.TMM]: 1.0,
    [RELATIONSHIP_GOALS.M12]: 0.5,
    [RELATIONSHIP_GOALS.FSC]: 0.9,
    [RELATIONSHIP_GOALS.SRM]: 0.3,
  }),
  [RELATIONSHIP_GOALS.M12]: Object.freeze({
    [RELATIONSHIP_GOALS.TMM]: 0.5,
    [RELATIONSHIP_GOALS.M12]: 1.0,
    [RELATIONSHIP_GOALS.FSC]: 0.5,
    [RELATIONSHIP_GOALS.SRM]: 0.7,
  }),
  [RELATIONSHIP_GOALS.FSC]: Object.freeze({
    [RELATIONSHIP_GOALS.TMM]: 0.9,
    [RELATIONSHIP_GOALS.M12]: 0.5,
    [RELATIONSHIP_GOALS.FSC]: 1.0,
    [RELATIONSHIP_GOALS.SRM]: 0.4,
  }),
  [RELATIONSHIP_GOALS.SRM]: Object.freeze({
    [RELATIONSHIP_GOALS.TMM]: 0.3,
    [RELATIONSHIP_GOALS.M12]: 0.7,
    [RELATIONSHIP_GOALS.FSC]: 0.4,
    [RELATIONSHIP_GOALS.SRM]: 1.0,
  }),
});

/**
 * Return the compatibility score (0.0 - 1.0) between two relationship_goal
 * values. Returns `null` if either value is missing or not in the canonical
 * set — callers should treat null as "no matrix signal available" and fall
 * back to the family-goals heuristic or skip the dimension.
 */
export function relationshipGoalCompatibility(a, b) {
  if (!a || !b) return null;
  const row = COMPAT[a];
  if (!row) return null;
  const v = row[b];
  return typeof v === 'number' ? v : null;
}

/**
 * Phase 41a deal-breaker filter threshold. When a user opts into the
 * `dealbreaker_relationship_goal` toggle, Discovery hides candidates whose
 * matrix score with the user is BELOW this value. T&S-recommended at 0.7,
 * which (a) preserves the TMM↔FSC pairing (0.9) and the M12↔SRM pairing
 * (0.7) and (b) hides everything weaker. Devout users (TMM dealbreaker on)
 * still see FSC candidates but not M12 or SRM ones.
 */
export const RELATIONSHIP_GOAL_DEALBREAKER_THRESHOLD = 0.7;

/**
 * Onboarding's Step5 + admin tools want the canonical list ordered for
 * display. Order is: most-traditional → most-modern.
 */
export const RELATIONSHIP_GOALS_ORDERED = Object.freeze([
  RELATIONSHIP_GOALS.TMM,
  RELATIONSHIP_GOALS.FSC,
  RELATIONSHIP_GOALS.M12,
  RELATIONSHIP_GOALS.SRM,
]);
