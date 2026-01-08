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
 * Calculates compatibility score between current user and a candidate profile
 * Based on matching_config weights (fetched separately or passed in)
 */
export const calculateScore = (currentUser, candidate, config) => {
  if (!config) return { score: 0, breakdown: {} };

  let score = 0;
  let breakdown = {};
  const weights = config.weights || {};

  // 1. Marriage Intent (High Weight)
  // Simplified logic: Exact match is best
  if (currentUser.relationship_goal === candidate.relationship_goal) {
    score += (weights.marriage_intent || 0);
    breakdown['Intent'] = weights.marriage_intent;
  } else if (currentUser.relationship_goal && candidate.relationship_goal) {
    // Partial match if both are serious
    score += (weights.marriage_intent || 0) * 0.5;
    breakdown['Intent'] = (weights.marriage_intent || 0) * 0.5;
  }

  // 2. Culture & Faith
  // Check for overlap in cultures array
  const commonCultures = currentUser.cultures?.filter(c => candidate.cultures?.includes(c)) || [];
  if (commonCultures.length > 0) {
     const cultureScore = (weights.culture_faith || 0) * 0.6;
     score += cultureScore;
     breakdown['Culture'] = (breakdown['Culture'] || 0) + cultureScore;
  }
  
  // Faith match
  if (currentUser.religious_affiliation === candidate.religious_affiliation) {
      const faithScore = (weights.culture_faith || 0) * 0.4;
      score += faithScore;
      breakdown['Faith'] = faithScore;
  }

  // 3. Values
  // Intersection of values
  const userValues = currentUser.core_values || [];
  const candValues = candidate.core_values || [];
  const commonValues = userValues.filter(v => candValues.includes(v));
  
  if (userValues.length > 0) {
      const valueRatio = commonValues.length / Math.max(userValues.length, 1);
      const valueScore = (weights.values || 0) * valueRatio;
      score += valueScore;
      breakdown['Values'] = Math.round(valueScore);
  }

  // 4. Location
  if (currentUser.location_city === candidate.location_city) {
      score += (weights.location || 0);
      breakdown['Location'] = weights.location;
  } else if (currentUser.location_country === candidate.location_country) {
      score += (weights.location || 0) * 0.5;
      breakdown['Location'] = (weights.location || 0) * 0.5;
  }

  // 5. Language
  const commonLangs = currentUser.languages?.filter(l => candidate.languages?.includes(l)) || [];
  if (commonLangs.length > 0) {
      score += (weights.language || 0);
      breakdown['Language'] = weights.language;
  }

  // 6. Profile Quality (Verification)
  if (candidate.is_verified) {
      score += (weights.profile_quality || 0);
      breakdown['Verified'] = weights.profile_quality;
  }

  return { 
      score: Math.min(Math.round(score), 100), 
      breakdown 
  };
};

export const getMatchLabel = (score) => {
  if (score >= 90) return "Excellent Match";
  if (score >= 75) return "Strong Match";
  if (score >= 60) return "Good Match";
  return "Potential Match";
};