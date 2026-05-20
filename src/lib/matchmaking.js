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
 * V1 Matching Algorithm — weight-aware normalization
 *
 * Each dimension contributes both its earned points AND its weight to a denominator,
 * but ONLY if both profiles had the data needed to score it. The final score is
 * `earned / attempted * 100`, so a profile with partial data gets a real percentage
 * instead of being penalized down to 0%.
 *
 * Lifestyle and Completeness always score (lifestyle defaults to neutral when no
 * lifestyle fields are set on either side; completeness always has a value).
 */
export const calculateScore = (currentUser, candidate, config = null) => {
  const weights = config?.weights || {
    age: 15,
    distance: 15,
    intent: 20,
    faith: 15,
    values: 15,
    lifestyle: 15,
    completeness: 5
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
      const seriousGoals = ['Marriage', 'Long-term', 'Serious'];
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

  // 4. FAITH
  if (currentUser.religious_affiliation && candidate.religious_affiliation) {
    attempted += weights.faith;
    let pts = 0;
    if (currentUser.religious_affiliation === candidate.religious_affiliation) {
      pts = weights.faith;
    } else {
      const faithGroups = {
        Muslim: ['Muslim (Sunni)', 'Muslim (Shia)', 'Muslim'],
        Christian: ['Christian (Catholic)', 'Christian (Protestant)', 'Christian', 'Christianity'],
        Jewish: ['Jewish (Orthodox)', 'Jewish (Conservative)', 'Jewish']
      };
      const userGroup = Object.keys(faithGroups).find(g => faithGroups[g].includes(currentUser.religious_affiliation));
      const candGroup = Object.keys(faithGroups).find(g => faithGroups[g].includes(candidate.religious_affiliation));
      if (userGroup && userGroup === candGroup) pts = weights.faith * 0.6;
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

  // 6. LIFESTYLE — always attempted (gives a partial signal even when most fields empty)
  attempted += weights.lifestyle;
  let lifestyleRaw = 0;
  if (currentUser.smoking === candidate.smoking) lifestyleRaw += 4;
  else if ((currentUser.smoking === 'Never' && candidate.smoking === 'Socially') || (currentUser.smoking === 'Socially' && candidate.smoking === 'Never')) lifestyleRaw += 2;
  if (currentUser.drinking === candidate.drinking) lifestyleRaw += 4;
  else if ((currentUser.drinking === 'Never' && candidate.drinking === 'Socially') || (currentUser.drinking === 'Socially' && candidate.drinking === 'Never')) lifestyleRaw += 2;
  if (currentUser.education === candidate.education) lifestyleRaw += 3;
  else if (currentUser.education && candidate.education) {
    const eduLevels = ['High School', 'Bachelor', 'Master', 'PhD'];
    const ui = eduLevels.indexOf(currentUser.education);
    const ci = eduLevels.indexOf(candidate.education);
    if (ui >= 0 && ci >= 0 && Math.abs(ui - ci) <= 1) lifestyleRaw += 1.5;
  }
  if (currentUser.marital_status === candidate.marital_status) lifestyleRaw += 2;
  if (currentUser.has_children === candidate.has_children) lifestyleRaw += 2;
  const lifestylePts = (weights.lifestyle * lifestyleRaw) / 15;
  score += lifestylePts;
  breakdown['Lifestyle'] = Math.round(lifestylePts);

  // 7. COMPLETENESS — always attempted
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