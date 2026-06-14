import { supabase } from '@/lib/customSupabaseClient';
import {
  relationshipGoalCompatibility,
  RELATIONSHIP_GOAL_DEALBREAKER_THRESHOLD,
} from '@/lib/relationshipGoals';

// --- Mock Data for Fallbacks (Required for existing components) ---

export const currentUserProfile = {
  id: 'user-123',
  name: 'Sarah Ahmed',
  age: 28,
  location: 'London, UK',
  faith: 'Muslim (Sunni)',
  sect: 'Sunni',
  ethnicity: 'Pakistani',
  profession: 'Doctor',
  education: 'Masters',
  height: "5'6\"",
  maritalStatus: 'Single',
  children: 'None',
  bio: "I'm a family-oriented person who values tradition and modern ambition. Looking for a partner who shares my faith and love for travel.",
  photos: ['https://images.unsplash.com/photo-1494790108377-be9c29b29330'],
  badges: ['Verified', 'Premium'],
  isPremium: true,
  verificationLevel: 2,
  cultures: ['Pakistani', 'British'],
  languages: ['English', 'Urdu'],
  religious_affiliation: 'Muslim',
  relationship_goal: 'Marriage',
  core_values: ['Family', 'Education', 'Faith'],
  location_city: 'London',
  location_country: 'UK'
};

export const allUsers = [
  {
    id: 'match-1', name: 'Omar Khan', age: 30, location: 'Manchester, UK',
    faith: 'Muslim (Sunni)', profession: 'Engineer',
    photos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d'],
    compatibility: 95, cultures: ['Pakistani'], verificationLevel: 2, isPremium: true,
    religious_affiliation: 'Muslim', relationship_goal: 'Marriage',
    core_values: ['Family', 'Faith'], location_city: 'Manchester', location_country: 'UK'
  },
  {
    id: 'match-2', name: 'Zayn Malik', age: 29, location: 'London, UK',
    faith: 'Muslim (Sunni)', profession: 'Architect',
    photos: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e'],
    compatibility: 88, cultures: ['British'], verificationLevel: 1, isPremium: false,
    religious_affiliation: 'Muslim', relationship_goal: 'Marriage',
    core_values: ['Career', 'Faith'], location_city: 'London', location_country: 'UK'
  },
  {
    id: 'match-3', name: 'Bilal Ahmed', age: 32, location: 'Birmingham, UK',
    faith: 'Muslim (Sunni)', profession: 'Teacher',
    photos: ['https://images.unsplash.com/photo-1472099645785-5658abf4ff4e'],
    compatibility: 82, cultures: ['Pakistani'], verificationLevel: 2, isPremium: false,
    religious_affiliation: 'Muslim', relationship_goal: 'Marriage',
    core_values: ['Family', 'Education'], location_city: 'Birmingham', location_country: 'UK'
  }
];

export const findMatches = (user, candidates) => {
  return candidates || allUsers;
};


// --- Real Matchmaking Logic ---

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  return new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
};

const calculateProfileCompleteness = (profile) => {
  const fields = [
    'full_name', 'date_of_birth', 'bio', 'photos', 'religious_affiliation',
    'relationship_goal', 'core_values', 'languages', 'occupation', 'education',
    'location_city', 'location_country', 'family_goals', 'values'
  ];
  let completed = 0;
  fields.forEach(field => {
    if (field === 'photos') {
      if (profile.photos && profile.photos.length > 0) completed++;
    } else if (field === 'core_values') {
      if (profile.core_values && profile.core_values.length > 0) completed++;
    } else if (profile[field]) {
      completed++;
    }
  });
  return (completed / fields.length) * 100;
};

/**
 * Phase 41e (2026-06-13) — Marital-status compatibility matrix.
 *
 * Board-approved partial-credit matrix (refinement 3b). Replaces the v1.5
 * binary equality check inside the lifestyle subscore with a tiered compat
 * lookup. Symmetric. Diagonals = 1.0 (exact match). Cell rationale:
 *   - NM ↔ ANN = 0.9 (annulled is religiously-equivalent to never-married
 *     in many faith traditions)
 *   - NM ↔ WID = 0.8 (widowed often viewed as no-fault by traditional contexts)
 *   - NM ↔ DIV = 0.5 (real life-experience gap)
 *   - DIV ↔ WID = 0.7 (both "have been married once")
 *   - DIV ↔ ANN = 0.7 (both "marriage ended" but different finality)
 *   - WID ↔ ANN = 0.8
 *
 * T&S note: matrix reflects experiential overlap, NOT religious doctrine.
 * A UI tooltip on the breakdown surface (DiscoveryPage ProfileCard) should
 * clarify this — deferred to Phase 41f along with the Settings card for
 * preferred_age_min/max controls.
 *
 * Keys match the canonical CHECK-constraint values per CLAUDE.md (locked
 * 2026-06-08): Never Married, Divorced, Widowed, Annulled.
 */
const MARITAL_STATUS_COMPAT = Object.freeze({
  'Never Married': Object.freeze({
    'Never Married': 1.0,
    'Divorced':      0.5,
    'Widowed':       0.8,
    'Annulled':      0.9,
  }),
  'Divorced': Object.freeze({
    'Never Married': 0.5,
    'Divorced':      1.0,
    'Widowed':       0.7,
    'Annulled':      0.7,
  }),
  'Widowed': Object.freeze({
    'Never Married': 0.8,
    'Divorced':      0.7,
    'Widowed':       1.0,
    'Annulled':      0.8,
  }),
  'Annulled': Object.freeze({
    'Never Married': 0.9,
    'Divorced':      0.7,
    'Widowed':       0.8,
    'Annulled':      1.0,
  }),
});

const maritalStatusCompat = (a, b) => {
  if (!a || !b) return null;
  const row = MARITAL_STATUS_COMPAT[a];
  if (!row) return null;
  const v = row[b];
  return typeof v === 'number' ? v : null;
};

/**
 * Phase 41a — deal-breaker pre-score filter pass. (Unchanged from Phase 41a.)
 */
export const violatesDealbreakers = (currentUser, candidate) => {
  if (!currentUser || !candidate) return false;

  if (currentUser.dealbreaker_faith
      && currentUser.religious_affiliation
      && currentUser.religious_affiliation !== candidate.religious_affiliation) {
    return true;
  }

  if (currentUser.dealbreaker_marital_status
      && currentUser.marital_status
      && currentUser.marital_status !== candidate.marital_status) {
    return true;
  }

  if (currentUser.dealbreaker_has_children
      && currentUser.has_children !== undefined && currentUser.has_children !== null
      && candidate.has_children !== undefined && candidate.has_children !== null
      && currentUser.has_children !== candidate.has_children) {
    return true;
  }

  if (currentUser.dealbreaker_relationship_goal
      && currentUser.relationship_goal
      && candidate.relationship_goal) {
    const compat = relationshipGoalCompatibility(
      currentUser.relationship_goal,
      candidate.relationship_goal
    );
    if (compat !== null && compat < RELATIONSHIP_GOAL_DEALBREAKER_THRESHOLD) {
      return true;
    }
  }

  return false;
};

/**
 * V1.5 Matching Algorithm — weight-aware normalization + faith-first re-weighting
 * + Phase 41a deal-breaker hard filter pass
 * + Phase 41b 4x4 marriage-intent matrix
 * + Phase 41e age preference + heavier children weight + marital-status matrix.
 *
 * --------------------------------------------------------------------------------
 * Phase 41e changes (2026-06-13) — board-approved scorer refinements
 * --------------------------------------------------------------------------------
 *
 * 1b. AGE (preferred-range scoring, no gender-asymmetric default)
 *    If the current user has set `preferred_age_min` and `preferred_age_max`,
 *    the candidate's age is scored against that range: in-range = full credit,
 *    tiered falloff outside. This lets users encode personal preferences
 *    (e.g. "I want a partner 2-5 years older") WITHOUT the platform asserting
 *    a gender-asymmetric default that would expose us under UK Equality
 *    Act §13. When the user has not set a preference, falls back to the
 *    v1.5 symmetric tier scoring (no behavioral change).
 *
 * 2b. CHILDREN (triple lifestyle subscore weight)
 *    Children match: 2 -> 6 raw lifestyle points. Lifestyle denominator
 *    rises from 15 to 19. Net effect: children mismatch loses ~3.2% of
 *    total score (vs ~1.3% in v1.5). Meaningful but not punitive — the
 *    existing dealbreaker_has_children toggle remains the hard-NO surface
 *    for users who truly won't compromise.
 *
 * 3b. MARITAL STATUS (compatibility matrix in lifestyle subscore)
 *    Replaces binary 0/2 with matrix-multiplied scoring inside lifestyle.
 *    NM ↔ NM = full 2 pts; NM ↔ ANN = 1.8; NM ↔ WID = 1.6; NM ↔ DIV = 1.0;
 *    etc. Same code surface as today (still 2 raw pts max in lifestyle),
 *    much better partial-credit signal.
 *
 * Headline dimension weights UNCHANGED — refinements live inside age + lifestyle
 * dimensions only. Founder's tuned weights (age:15, faith:25, intent:10, ...)
 * stay in effect.
 *
 * --------------------------------------------------------------------------------
 * Older phase history retained for context:
 *  - v1.5 (Phase 41): faith 15->28, group bonus 0.6->0.4, completeness 5->2, cultures 10->7
 *  - Phase 41a: 4 user-opt-in deal-breaker hard filters
 *  - Phase 41b: relationship_goal 4x4 compatibility matrix
 *  - Phase 41c: Step5 + AccountSettings deal-breaker UI
 *  - Phase 41d: Muslim-women faith-aligned interstitial
 * --------------------------------------------------------------------------------
 */
export const calculateScore = (currentUser, candidate, config = null) => {
  if (violatesDealbreakers(currentUser, candidate)) {
    return {
      score: null, filtered: true, breakdown: {},
      candidateAge: null, candidateDistance: null,
    };
  }

  const weights = config?.weights || {
    age: 12,
    distance: 12,
    intent: 18,
    faith: 28,
    values: 13,
    cultures: 7,
    lifestyle: 8,
    completeness: 2,
  };

  let score = 0;
  let attempted = 0;
  const breakdown = {};

  // 1. AGE — Phase 41e 1b preferred-range scoring with v1.5 fallback
  const userAge = calculateAge(currentUser.date_of_birth);
  const candidateAge = calculateAge(candidate.date_of_birth);
  if (userAge && candidateAge) {
    attempted += weights.age;
    let pts = 0;

    const prefMin = (typeof currentUser.preferred_age_min === 'number') ? currentUser.preferred_age_min : null;
    const prefMax = (typeof currentUser.preferred_age_max === 'number') ? currentUser.preferred_age_max : null;
    const hasPreference = prefMin !== null && prefMax !== null && prefMin <= prefMax;

    if (hasPreference) {
      // Phase 41e 1b — score against user's stated preferred range.
      // Inside the range: full credit. Outside: distance-from-edge falloff.
      // Symmetric — doesn't encode any gender-asymmetric default.
      if (candidateAge >= prefMin && candidateAge <= prefMax) {
        pts = weights.age;
      } else {
        const dist = candidateAge < prefMin ? (prefMin - candidateAge) : (candidateAge - prefMax);
        if (dist <= 2)       pts = weights.age * 0.7;
        else if (dist <= 5)  pts = weights.age * 0.5;
        else if (dist <= 10) pts = weights.age * 0.3;
        else                  pts = 0;
      }
    } else {
      // v1.5 fallback — symmetric absolute-age-gap tiers.
      const ageDiff = Math.abs(userAge - candidateAge);
      if (ageDiff === 0)       pts = weights.age;
      else if (ageDiff <= 2)   pts = weights.age * 0.9;
      else if (ageDiff <= 5)   pts = weights.age * 0.7;
      else if (ageDiff <= 10)  pts = weights.age * 0.5;
      else if (ageDiff <= 15)  pts = weights.age * 0.3;
    }

    score += pts;
    breakdown['Age'] = Math.round(pts);
  }

  // 2. DISTANCE — unchanged
  if (currentUser.latitude && currentUser.longitude && candidate.latitude && candidate.longitude) {
    attempted += weights.distance;
    const distance = calculateDistance(currentUser.latitude, currentUser.longitude, candidate.latitude, candidate.longitude);
    let pts = 0;
    if (distance <= 10) pts = weights.distance;
    else if (distance <= 25) pts = weights.distance * 0.8;
    else if (distance <= 50) pts = weights.distance * 0.6;
    else if (distance <= 100) pts = weights.distance * 0.4;
    else if (distance <= 250) pts = weights.distance * 0.2;
    score += pts;
    breakdown['Distance'] = Math.round(pts);
  } else if (currentUser.location_city && candidate.location_city && currentUser.location_city === candidate.location_city) {
    attempted += weights.distance;
    score += weights.distance * 0.8;
    breakdown['Distance'] = Math.round(weights.distance * 0.8);
  } else if (currentUser.location_country && candidate.location_country && currentUser.location_country === candidate.location_country) {
    attempted += weights.distance;
    score += weights.distance * 0.4;
    breakdown['Distance'] = Math.round(weights.distance * 0.4);
  }

  // 3. INTENT / GOAL — Phase 41b matrix (unchanged)
  if (currentUser.relationship_goal && candidate.relationship_goal) {
    attempted += weights.intent;
    const compat = relationshipGoalCompatibility(
      currentUser.relationship_goal,
      candidate.relationship_goal
    );
    if (compat !== null) {
      const pts = weights.intent * compat;
      score += pts;
      breakdown['Intent'] = Math.round(pts);
    } else if (currentUser.family_goals === candidate.family_goals && currentUser.family_goals) {
      score += weights.intent * 0.3;
      breakdown['Intent'] = Math.round(weights.intent * 0.3);
    }
  }

  // 4. FAITH — v1.5 reweight (unchanged)
  if (currentUser.religious_affiliation && candidate.religious_affiliation) {
    attempted += weights.faith;
    let pts = 0;
    if (currentUser.religious_affiliation === candidate.religious_affiliation) {
      pts = weights.faith;
    } else {
      const faithGroups = {
        Islam: ['Islam'],
        Christianity: [
          'Christianity',
          'Christianity (Eastern Orthodox)',
          'Christianity (Catholic)',
          'Christianity (Protestant)',
          'Christianity (LDS / Mormon)',
          "Christianity (Jehovah's Witness)",
        ],
        Judaism: ['Judaism'],
        NonReligious: ['Atheist', 'Non-religious', 'Spiritual but not religious'],
      };
      const userGroup = Object.keys(faithGroups).find(g => faithGroups[g].includes(currentUser.religious_affiliation));
      const candGroup = Object.keys(faithGroups).find(g => faithGroups[g].includes(candidate.religious_affiliation));
      if (userGroup && userGroup === candGroup) pts = weights.faith * 0.4;
    }
    if (currentUser.faith_lifestyle && candidate.faith_lifestyle && currentUser.faith_lifestyle === candidate.faith_lifestyle) {
      pts += weights.faith * 0.2;
    }
    pts = Math.min(pts, weights.faith);
    score += pts;
    breakdown['Faith'] = Math.round(pts);
  }

  // 5. VALUES — unchanged
  const userValues = Array.isArray(currentUser.core_values) ? currentUser.core_values : [];
  const candValues = Array.isArray(candidate.core_values) ? candidate.core_values : [];
  if (userValues.length > 0 && candValues.length > 0) {
    attempted += weights.values;
    const common = userValues.filter(v => candValues.includes(v));
    const overlap = common.length / Math.max(userValues.length, candValues.length);
    const pts = weights.values * overlap;
    score += pts;
    breakdown['Values'] = Math.round(pts);
  }

  // 6. CULTURES — unchanged
  const userCultures = Array.isArray(currentUser.cultures) ? currentUser.cultures : [];
  const candCultures = Array.isArray(candidate.cultures) ? candidate.cultures : [];
  if (userCultures.length > 0 && candCultures.length > 0) {
    attempted += weights.cultures;
    const shared = userCultures.filter(c => candCultures.includes(c));
    let pts = 0;
    if (shared.length > 0) {
      const minLen = Math.min(userCultures.length, candCultures.length);
      const overlap = shared.length / minLen;
      pts = weights.cultures * overlap;
    }
    pts = Math.min(pts, weights.cultures);
    score += pts;
    breakdown['Cultures'] = Math.round(pts);
  }

  // 7. LIFESTYLE — Phase 41e 2b (children weight tripled) + 3b (marital matrix)
  //
  // Subscore raw point budget changes:
  //   smoking:        4 (or 2 partial)        unchanged
  //   drinking:       4 (or 2 partial)        unchanged
  //   education:      3 (or 1.5 partial)      unchanged
  //   marital_status: 2 (× compat matrix)     2 -> 2 max, partial credit via matrix (3b)
  //   has_children:   6                       2 -> 6 (TRIPLED — 2b)
  //   TOTAL MAX:    19                        was 15
  //
  // Denominator updated: lifestylePts = (weights.lifestyle * lifestyleRaw) / 19
  attempted += weights.lifestyle;
  let lifestyleRaw = 0;

  if (currentUser.smoking === candidate.smoking) lifestyleRaw += 4;
  else if (
    (currentUser.smoking === 'No' && candidate.smoking === 'Socially') ||
    (currentUser.smoking === 'Socially' && candidate.smoking === 'No')
  ) lifestyleRaw += 2;

  if (currentUser.drinking === candidate.drinking) lifestyleRaw += 4;
  else if (
    (currentUser.drinking === 'No' && candidate.drinking === 'Socially') ||
    (currentUser.drinking === 'Socially' && candidate.drinking === 'No')
  ) lifestyleRaw += 2;

  // Phase 41g defensive guard: require non-empty education on both sides
  // before awarding exact-match credit. Previous code awarded 3 pts when
  // both `education` were empty string (pre-existing v1.5 bug, caught by
  // reviewer during Phase 41g pass).
  if (currentUser.education && currentUser.education === candidate.education) lifestyleRaw += 3;
  else if (currentUser.education && candidate.education) {
    // Phase 41g (2026-06-14): tier map (not linear array) so Doctorate and
    // Professional Degree share the apex tier — they're PARALLEL terminal
    // tracks (PhD vs JD/MD), not sequential. Under the old array order,
    // Master's <-> Doctorate scored as gap=2 (no adjacent credit), which was
    // wrong. Under the tier map below:
    //   Master's (3) <-> Doctorate (4) -> adjacent (gap=1) ✓
    //   Master's (3) <-> Professional (4) -> adjacent ✓
    //   Doctorate (4) <-> Professional (4) -> same tier, adjacent credit ✓
    // Exact-match credit (3 pts) still wins for same-string matches above.
    const eduTiers = {
      'High School': 0,
      'Some College': 1,
      "Bachelor's Degree": 2,
      "Master's Degree": 3,
      'Professional Degree': 4,
      'Doctorate': 4,
    };
    const ui = eduTiers[currentUser.education];
    const ci = eduTiers[candidate.education];
    if (ui !== undefined && ci !== undefined && Math.abs(ui - ci) <= 1) {
      lifestyleRaw += 1.5;
    }
  }

  // Phase 41e 3b — marital-status compatibility matrix (replaces binary).
  if (currentUser.marital_status && candidate.marital_status) {
    const maritalCompat = maritalStatusCompat(currentUser.marital_status, candidate.marital_status);
    if (maritalCompat !== null) {
      lifestyleRaw += 2 * maritalCompat;
    } else if (currentUser.marital_status === candidate.marital_status) {
      // Defensive fallback if a non-canonical value sneaks through.
      lifestyleRaw += 2;
    }
  }

  // Phase 41e 2b — children mismatch now costs 6 of 19 (vs 2 of 15).
  // Phase 41g (2026-06-14) — dynamic denominator: if either side lacks
  // has_children data, exclude the 6 child-points from the denominator so
  // the user isn't silently penalized on lifestyle just because the
  // candidate didn't fill that field in.
  const childrenScorable =
    currentUser.has_children !== undefined && currentUser.has_children !== null
    && candidate.has_children !== undefined && candidate.has_children !== null;
  if (childrenScorable && currentUser.has_children === candidate.has_children) {
    lifestyleRaw += 6;
  }

  // Phase 41g — dynamic denominator. Base max is 13 (smoking 4 + drinking 4
  // + education 3 + marital 2). Add children-6 only when both sides have data.
  // This keeps the v1.5-equivalent scoring stable for profiles that don't
  // have children data on either side — they no longer take a ~0.9% headline
  // hit on lifestyle just because their data is incomplete.
  const LIFESTYLE_RAW_MAX = childrenScorable ? 19 : 13;
  const lifestylePts = (weights.lifestyle * lifestyleRaw) / LIFESTYLE_RAW_MAX;
  score += lifestylePts;
  breakdown['Lifestyle'] = Math.round(lifestylePts);

  // 8. COMPLETENESS — unchanged
  attempted += weights.completeness;
  const candidateCompleteness = calculateProfileCompleteness(candidate);
  const completenessBonus = (candidateCompleteness / 100) * weights.completeness;
  score += completenessBonus;
  breakdown['Completeness'] = Math.round(completenessBonus);

  const finalScore = attempted > 0 ? Math.min(Math.round((score / attempted) * 100), 100) : 0;

  return {
    score: finalScore,
    breakdown,
    candidateAge,
    candidateDistance: candidate.distance || null
  };
};

export const getMatchLabel = (score) => {
  if (score >= 90) return "Excellent Match";
  if (score >= 75) return "Strong Match";
  if (score >= 60) return "Good Match";
  return "Potential Match";
};
