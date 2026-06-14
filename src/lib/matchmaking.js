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
    id: 'match-1',
    name: 'Omar Khan',
    age: 30,
    location: 'Manchester, UK',
    faith: 'Muslim (Sunni)',
    profession: 'Engineer',
    photos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d'],
    compatibility: 95,
    cultures: ['Pakistani'],
    verificationLevel: 2,
    isPremium: true,
    religious_affiliation: 'Muslim',
    relationship_goal: 'Marriage',
    core_values: ['Family', 'Faith'],
    location_city: 'Manchester',
    location_country: 'UK'
  },
  {
    id: 'match-2',
    name: 'Zayn Malik',
    age: 29,
    location: 'London, UK',
    faith: 'Muslim (Sunni)',
    profession: 'Architect',
    photos: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e'],
    compatibility: 88,
    cultures: ['British'],
    verificationLevel: 1,
    isPremium: false,
    religious_affiliation: 'Muslim',
    relationship_goal: 'Marriage',
    core_values: ['Career', 'Faith'],
    location_city: 'London',
    location_country: 'UK'
  },
  {
    id: 'match-3',
    name: 'Bilal Ahmed',
    age: 32,
    location: 'Birmingham, UK',
    faith: 'Muslim (Sunni)',
    profession: 'Teacher',
    photos: ['https://images.unsplash.com/photo-1472099645785-5658abf4ff4e'],
    compatibility: 82,
    cultures: ['Pakistani'],
    verificationLevel: 2,
    isPremium: false,
    religious_affiliation: 'Muslim',
    relationship_goal: 'Marriage',
    core_values: ['Family', 'Education'],
    location_city: 'Birmingham',
    location_country: 'UK'
  }
];

// Helper to find matches (Mock implementation for Dashboard fallback)
export const findMatches = (user, candidates) => {
  return candidates || allUsers;
};


// --- Real Matchmaking Logic ---

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Calculate age from date of birth
 */
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  return new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
};

/**
 * Calculate profile completeness percentage
 */
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
 * Phase 41a — deal-breaker pre-score filter pass.
 *
 * Returns true when `candidate` violates one of `currentUser`'s ENABLED
 * dealbreakers, false otherwise. Callers MUST short-circuit (skip the
 * candidate / return null from calculateScore) when this returns true.
 *
 * All defaults are false (opt-in only) — see migration
 * 20260613040000_phase41a_dealbreaker_columns.sql. So this function is a
 * no-op for users who haven't opted in.
 *
 * Each check requires BOTH (a) the user opted into the dealbreaker AND
 * (b) the user actually has a value for the field they're filtering on
 * (otherwise the filter would silently exclude everyone). Equality is
 * strict — there is no fuzzy/group fallback at the dealbreaker layer
 * (that's the scorer's job).
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

  // has_children is a tri-state: true/false/null. We only filter when BOTH
  // sides have a defined value AND the user opted in. A user who hasn't
  // declared has_children shouldn't accidentally filter out everyone.
  if (currentUser.dealbreaker_has_children
      && currentUser.has_children !== undefined && currentUser.has_children !== null
      && candidate.has_children !== undefined && candidate.has_children !== null
      && currentUser.has_children !== candidate.has_children) {
    return true;
  }

  // Phase 41b matrix interaction: relationship_goal dealbreaker is NOT a
  // binary equality check. Use the board-approved compatibility matrix and
  // the T&S-set threshold (0.7) so a TMM dealbreaker user still sees FSC
  // candidates (0.9 compat) but not M12 (0.5) or SRM (0.3). Exact-match
  // dealbreaker semantics for the other 3 fields remain unchanged.
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
 * + Phase 41a deal-breaker hard filter pass.
 *
 * Each dimension contributes both its earned points AND its weight to a denominator,
 * but ONLY if both profiles had the data needed to score it. The final score is
 * `earned / attempted * 100`, so a profile with partial data gets a real percentage
 * instead of being penalized down to 0%.
 *
 * Lifestyle and Completeness always score (lifestyle defaults to neutral when no
 * lifestyle fields are set on either side; completeness always has a value).
 *
 * --------------------------------------------------------------------------------
 * v1.5 changes (Phase 41, 2026-06-13) — board-approved faith-first re-weighting
 * --------------------------------------------------------------------------------
 * 1. Faith default weight 15 -> 28
 * 2. Faith same-religion-GROUP bonus 60% -> 40%
 * 3. Completeness 5 -> 2 and Cultures 10 -> 7
 * Plus 3 drift fixes: smoking/drinking 'Never' -> 'No', seriousGoals -> canonical
 * Step5 values, eduLevels -> canonical sentence-case set.
 *
 * --------------------------------------------------------------------------------
 * Phase 41a (2026-06-13) — deal-breaker hard filters at top of scorer
 * --------------------------------------------------------------------------------
 * 4 user-controlled dealbreakers (faith / marital_status / has_children /
 * relationship_goal) applied BEFORE any scoring math. Returns `null` for
 * filtered candidates so Discovery can distinguish "this candidate violated
 * a dealbreaker" from "this candidate scored zero". All defaults are opt-out
 * (column defaults are false in the migration); pre-launch behavior is
 * unchanged unless the user explicitly enables one or more dealbreakers.
 */
export const calculateScore = (currentUser, candidate, config = null) => {
  // Phase 41a — deal-breaker hard filter pass. Runs BEFORE any scoring math.
  //
  // We return an object shape (not `null`) so that existing callers like
  // DiscoveryPage and DashboardPage that destructure `const { score } = ...`
  // do not throw "Cannot destructure property 'score' of 'null'". Callers
  // that gate on `typeof score === 'number'` (DiscoveryPage already does)
  // will correctly treat `score: null` as "skip / don't render". The
  // `filtered: true` flag lets newer callers distinguish "filtered by
  // dealbreaker" from "scored zero on the algorithm" without crashing.
  if (violatesDealbreakers(currentUser, candidate)) {
    return {
      score: null,
      filtered: true,
      breakdown: {},
      candidateAge: null,
      candidateDistance: null,
    };
  }

  const weights = config?.weights || {
    age: 12,
    distance: 12,
    intent: 18,
    faith: 28,        // v1.5: 15 -> 28 (faith-first re-weight)
    values: 13,
    cultures: 7,      // v1.5: 10 -> 7
    lifestyle: 8,
    completeness: 2,  // v1.5: 5 -> 2
  };

  let score = 0;
  let attempted = 0; // sum of weights for dimensions that had data on both sides
  const breakdown = {};

  // 1. AGE
  const userAge = calculateAge(currentUser.date_of_birth);
  const candidateAge = calculateAge(candidate.date_of_birth);
  if (userAge && candidateAge) {
    attempted += weights.age;
    const ageDiff = Math.abs(userAge - candidateAge);
    let pts = 0;
    if (ageDiff === 0) pts = weights.age;
    else if (ageDiff <= 2) pts = weights.age * 0.9;
    else if (ageDiff <= 5) pts = weights.age * 0.7;
    else if (ageDiff <= 10) pts = weights.age * 0.5;
    else if (ageDiff <= 15) pts = weights.age * 0.3;
    score += pts;
    breakdown['Age'] = Math.round(pts);
  }

  // 2. DISTANCE
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

  // 3. INTENT / GOAL — Phase 41b 5x5 matrix scoring (2026-06-13).
  //
  // Replaces the v1.5 flat `bothSerious = 70%` partial-credit branch with a
  // board-approved tiered compatibility matrix. Decision doc:
  // C:\Marryzen\Marriage_Intent_Matrix_Decision_2026-06-13.md
  //
  // Diagonal cells (same value, exact match) score 100% of intent weight (= 18).
  // Off-diagonal cells score per the matrix: TMM↔FSC 90%, M12↔SRM 70%, etc.
  // Worst pair (TMM↔SRM) scores 30% — vs the old flat 70%, this corrects the
  // brand-damage vector where structurally-incompatible pairings used to land
  // at "high-quality match" UI scores.
  //
  // Non-canonical or missing values fall through to the family_goals heuristic.
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
      // Family-goals fallback retained for legacy / non-canonical values.
      score += weights.intent * 0.3;
      breakdown['Intent'] = Math.round(weights.intent * 0.3);
    }
  }

  // 4. FAITH — v1.5 reweight (28 default, 0.4 group bonus)
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

  // 5. VALUES
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

  // 6. CULTURES
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

  // 7. LIFESTYLE — always attempted, v1.5 drift fixes applied
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
  if (currentUser.education === candidate.education) lifestyleRaw += 3;
  else if (currentUser.education && candidate.education) {
    const eduLevels = [
      'High School',
      'Some College',
      "Bachelor's Degree",
      "Master's Degree",
      'Professional Degree',
      'Doctorate',
    ];
    const ui = eduLevels.indexOf(currentUser.education);
    const ci = eduLevels.indexOf(candidate.education);
    if (ui >= 0 && ci >= 0 && Math.abs(ui - ci) <= 1) lifestyleRaw += 1.5;
  }
  if (currentUser.marital_status === candidate.marital_status) lifestyleRaw += 2;
  if (currentUser.has_children === candidate.has_children) lifestyleRaw += 2;
  const lifestylePts = (weights.lifestyle * lifestyleRaw) / 15;
  score += lifestylePts;
  breakdown['Lifestyle'] = Math.round(lifestylePts);

  // 8. COMPLETENESS — always attempted
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
