import { supabase } from '@/lib/customSupabaseClient';

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
 * V1.5 Matching Algorithm — weight-aware normalization + faith-first re-weighting
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
 *
 * 1. Faith default weight 15 -> 28: Marryzen's wedge is "faith-first" but the v1
 *    defaults treated faith the same as age/distance/values. A Brand/Founder board
 *    review flagged this as a product-promise mismatch — devout founding-500 members
 *    will quit (and tweet) if denomination mismatches score in the 90s.
 *
 * 2. Faith same-religion-GROUP bonus 60% -> 40%: previously, a Catholic + Protestant
 *    pair earned 60% of the faith weight via the Christianity-group fallback. At
 *    weights.faith=15, that was 9 of 15 points (visible but not loud). At
 *    weights.faith=28 that would have been 16.8 of 28 — much louder. The board
 *    correctly identified this as a brand-damage vector. Tightening the group
 *    bonus to 40% keeps the signal that same-religion-group still matters (a
 *    Catholic and a Protestant share more than a Catholic and a Buddhist) without
 *    misrepresenting sub-denomination compatibility on a faith-first platform.
 *
 * 3. Completeness 5 -> 2 and Cultures 10 -> 7: surface area reduced for both
 *    because faith took the additional points. Completeness is a hygiene nudge,
 *    not a compatibility signal; cultures remains because cultural overlap is
 *    a real signal for the faith-first audience but does not deserve a third of
 *    the weight that faith does.
 *
 * Lifestyle 15 -> 8 and intent 20 -> 18, age/distance 15 -> 12 each: the rest
 * of the budget was rebalanced to sum to 100 exactly (admin UI's validator
 * requires that). All scorer math otherwise unchanged.
 *
 * The `matching_config` table's seeded weights row is also updated by a
 * companion migration (20260613XXX_matchmaking_v15_faith_reweight.sql) so the
 * admin UI sees the same defaults the code does. Super_admin can still override.
 *
 * --------------------------------------------------------------------------------
 * v1.5 also fixes 3 silent dead-code regressions caught by reviewer pass:
 *   1. `smoking`/`drinking` partial-credit checked against literal 'Never';
 *      DB CHECK constraint enforces 'No'. Branch was dead. Fixed below.
 *   2. `seriousGoals` array used legacy ['Marriage', 'Long-term', 'Serious'];
 *      onboarding writes canonical Step5.jsx values. Branch was dead. Fixed.
 *   3. `eduLevels` ladder used short ['High School', 'Bachelor', 'Master', 'PhD'];
 *      DB stores sentence-case values like "Bachelor's Degree". Branch was dead.
 *      Fixed.
 * --------------------------------------------------------------------------------
 */
export const calculateScore = (currentUser, candidate, config = null) => {
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

  // 3. INTENT / GOAL
  if (currentUser.relationship_goal && candidate.relationship_goal) {
    attempted += weights.intent;
    if (currentUser.relationship_goal === candidate.relationship_goal) {
      score += weights.intent;
      breakdown['Intent'] = weights.intent;
    } else {
      // v1.5 drift fix (Phase 41): the old literal array
      // ['Marriage', 'Long-term', 'Serious'] never matched a real
      // `relationship_goal` value — the onboarding flow saves canonical
      // Step5.jsx values per CLAUDE.md (2026-06-08 lockdown). This branch
      // was effectively dead code in production. Restoring it to the
      // canonical set so "both serious but not exact same goal" finally
      // earns the 70%-of-intent partial credit.
      const seriousGoals = [
        'Marriage Within 1–2 Years',           // U+2013 en-dash
        'Family-Supervised Courtship',
        'Serious Relationship → Marriage',     // U+2192 right arrow
        'Traditional Marriage Mindset',              // legacy value still in some profiles
      ];
      const bothSerious = seriousGoals.includes(currentUser.relationship_goal) && seriousGoals.includes(candidate.relationship_goal);
      if (bothSerious) {
        score += weights.intent * 0.7;
        breakdown['Intent'] = Math.round(weights.intent * 0.7);
      } else if (currentUser.family_goals === candidate.family_goals && currentUser.family_goals) {
        score += weights.intent * 0.3;
        breakdown['Intent'] = Math.round(weights.intent * 0.3);
      }
    }
  }

  // 4. FAITH — v1.5 reweight (28 default, 0.4 group bonus)
  if (currentUser.religious_affiliation && candidate.religious_affiliation) {
    attempted += weights.faith;
    let pts = 0;
    if (currentUser.religious_affiliation === candidate.religious_affiliation) {
      pts = weights.faith;
    } else {
      // Phase 2D: use canonical DB nouns (matches what onboarding actually saves).
      // The old map used display-layer adjectives like 'Christian (Catholic)' which
      // never appeared in the religious_affiliation column — fuzzy faith bonus
      // was effectively dead code. With Phase 2C adding 5 more Christianity
      // sub-options, fixing this is essential or sub-denomination users score
      // zero against each other.
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
        // 'Atheist' kept for back-compat with pre-Phase-2C profiles.
        NonReligious: ['Atheist', 'Non-religious', 'Spiritual but not religious'],
      };
      const userGroup = Object.keys(faithGroups).find(g => faithGroups[g].includes(currentUser.religious_affiliation));
      const candGroup = Object.keys(faithGroups).find(g => faithGroups[g].includes(candidate.religious_affiliation));
      // v1.5: same-group bonus tightened from 0.6 -> 0.4. Two Christianity
      // sub-denoms (e.g., Catholic + Protestant) now read as ~40% faith
      // compatibility, not ~60%. Brand-promise alignment for a faith-FIRST app.
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

  // 6. CULTURES — Phase 2H. Multi-select up to 3 per Phase 2G. Shared
  // cultural heritage is a meaningful compatibility signal for a faith-first
  // marriage app (e.g. two users who both selected 'South Asian' or both
  // chose 'Turkish / Turkic' speak the same cultural language even before
  // language matching kicks in).
  //
  // Scoring: we divide shared.length by the SMALLER of the two arrays so
  // that a user who self-identified with exactly one culture and matched
  // on it gets full credit, rather than being penalized by a partner who
  // happened to list multiple. Two users sharing 1+ culture out of 1 each
  // = 100%. Sharing 2 out of 3 each = 67%. No overlap = 0% (not penalized;
  // attempted is added either way so the normalization stays honest).
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

  // 7. LIFESTYLE — always attempted (gives a partial signal even when most fields empty)
  //
  // v1.5 drift fix (Phase 41) — the old literals 'Never' (smoking, drinking) and
  // the eduLevels ladder ['High School', 'Bachelor', 'Master', 'PhD'] never matched
  // real profile values. Per CLAUDE.md (2026-06-08 lockdown), the database CHECK
  // constraints enforce 'No' / 'Socially' / 'Regularly' for smoking and drinking,
  // and the canonical education values are sentence-case ("Bachelor's Degree" etc.).
  // The partial-credit branches were dead code for every real user pair.
  // Restoring canonical literals so the asymmetric-tolerance and adjacent-tier
  // branches finally score.
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
    // Ordered ladder of canonical education values from CLAUDE.md. "Professional
    // Degree" is intentionally placed between Master's and Doctorate because in
    // practice (JD, MD, etc.) it sits at that academic tier; this gives JD+MD
    // pairs the adjacent-tier partial credit they deserve.
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

  // Normalize: percent of points earned out of points attempted (not full weight total)
  // This means a profile with only partial data on both sides still gets a real percentage
  // instead of being penalized to 0% by missing dimensions.
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
