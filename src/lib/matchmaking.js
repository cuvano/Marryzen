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
 * V1 Matching Algorithm
 * Calculates comprehensive compatibility score between current user and a candidate profile
 * 
 * Scoring inputs:
 * 1. Age distance score (0-15 points)
 * 2. Location distance score (0-15 points)
 * 3. Intent/goal match score (0-20 points)
 * 4. Faith/religious match score (0-15 points)
 * 5. Values overlap score (0-15 points)
 * 6. Lifestyle compatibility score (0-15 points)
 * 7. Profile completeness bonus (0-5 points)
 * 
 * Total: 0-100 points
 */
export const calculateScore = (currentUser, candidate, config = null) => {
  // Default weights if config not provided
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
  let breakdown = {};

  // 1. AGE DISTANCE SCORE (0-15 points)
  const userAge = calculateAge(currentUser.date_of_birth);
  const candidateAge = calculateAge(candidate.date_of_birth);
  
  if (userAge && candidateAge) {
    const ageDiff = Math.abs(userAge - candidateAge);
    if (ageDiff === 0) {
      score += weights.age;
      breakdown['Age'] = weights.age;
    } else if (ageDiff <= 2) {
      score += weights.age * 0.9;
      breakdown['Age'] = Math.round(weights.age * 0.9);
    } else if (ageDiff <= 5) {
      score += weights.age * 0.7;
      breakdown['Age'] = Math.round(weights.age * 0.7);
    } else if (ageDiff <= 10) {
      score += weights.age * 0.5;
      breakdown['Age'] = Math.round(weights.age * 0.5);
    } else if (ageDiff <= 15) {
      score += weights.age * 0.3;
      breakdown['Age'] = Math.round(weights.age * 0.3);
    }
    // > 15 years difference gets 0 points
  }

  // 2. LOCATION DISTANCE SCORE (0-15 points)
  if (currentUser.latitude && currentUser.longitude && candidate.latitude && candidate.longitude) {
    const distance = calculateDistance(
      currentUser.latitude, currentUser.longitude,
      candidate.latitude, candidate.longitude
    );
    
    if (distance <= 10) {
      score += weights.distance;
      breakdown['Distance'] = weights.distance;
    } else if (distance <= 25) {
      score += weights.distance * 0.8;
      breakdown['Distance'] = Math.round(weights.distance * 0.8);
    } else if (distance <= 50) {
      score += weights.distance * 0.6;
      breakdown['Distance'] = Math.round(weights.distance * 0.6);
    } else if (distance <= 100) {
      score += weights.distance * 0.4;
      breakdown['Distance'] = Math.round(weights.distance * 0.4);
    } else if (distance <= 250) {
      score += weights.distance * 0.2;
      breakdown['Distance'] = Math.round(weights.distance * 0.2);
    }
    // > 250km gets 0 points
  } else if (currentUser.location_city === candidate.location_city) {
    // Fallback to city match
    score += weights.distance * 0.8;
    breakdown['Distance'] = Math.round(weights.distance * 0.8);
  } else if (currentUser.location_country === candidate.location_country) {
    score += weights.distance * 0.4;
    breakdown['Distance'] = Math.round(weights.distance * 0.4);
  }

  // 3. INTENT/GOAL MATCH SCORE (0-20 points) - CRITICAL
  if (currentUser.relationship_goal && candidate.relationship_goal) {
    if (currentUser.relationship_goal === candidate.relationship_goal) {
      score += weights.intent;
      breakdown['Intent'] = weights.intent;
    } else {
      // Partial credit for compatible goals
      const seriousGoals = ['Marriage', 'Long-term', 'Serious'];
      const bothSerious = 
        seriousGoals.includes(currentUser.relationship_goal) && 
        seriousGoals.includes(candidate.relationship_goal);
      
      if (bothSerious) {
        score += weights.intent * 0.7;
        breakdown['Intent'] = Math.round(weights.intent * 0.7);
      } else {
        // Family goals compatibility
        if (currentUser.family_goals === candidate.family_goals) {
          score += weights.intent * 0.3;
          breakdown['Intent'] = Math.round(weights.intent * 0.3);
        }
      }
    }
  }

  // 4. FAITH/RELIGIOUS MATCH SCORE (0-15 points)
  if (currentUser.religious_affiliation && candidate.religious_affiliation) {
    if (currentUser.religious_affiliation === candidate.religious_affiliation) {
      score += weights.faith;
      breakdown['Faith'] = weights.faith;
    } else {
      // Partial credit for same faith family
      const faithGroups = {
        'Muslim': ['Muslim (Sunni)', 'Muslim (Shia)', 'Muslim'],
        'Christian': ['Christian (Catholic)', 'Christian (Protestant)', 'Christian'],
        'Jewish': ['Jewish (Orthodox)', 'Jewish (Conservative)', 'Jewish']
      };
      
      const userFaithGroup = Object.keys(faithGroups).find(group => 
        faithGroups[group].includes(currentUser.religious_affiliation)
      );
      const candFaithGroup = Object.keys(faithGroups).find(group => 
        faithGroups[group].includes(candidate.religious_affiliation)
      );
      
      if (userFaithGroup && userFaithGroup === candFaithGroup) {
        score += weights.faith * 0.6;
        breakdown['Faith'] = Math.round(weights.faith * 0.6);
      }
    }
    
    // Faith lifestyle match
    if (currentUser.faith_lifestyle === candidate.faith_lifestyle) {
      score += weights.faith * 0.2;
      breakdown['Faith'] = (breakdown['Faith'] || 0) + Math.round(weights.faith * 0.2);
    }
  }

  // 5. VALUES OVERLAP SCORE (0-15 points)
  const userValues = Array.isArray(currentUser.core_values) ? currentUser.core_values : [];
  const candValues = Array.isArray(candidate.core_values) ? candidate.core_values : [];
  
  if (userValues.length > 0 && candValues.length > 0) {
    const commonValues = userValues.filter(v => candValues.includes(v));
    const valueOverlap = commonValues.length / Math.max(userValues.length, candValues.length, 1);
    
    score += weights.values * valueOverlap;
    breakdown['Values'] = Math.round(weights.values * valueOverlap);
  }

  // 6. LIFESTYLE COMPATIBILITY SCORE (0-15 points)
  let lifestyleScore = 0;
  
  // Smoking compatibility
  if (currentUser.smoking === candidate.smoking) {
    lifestyleScore += 4;
  } else if (currentUser.smoking === 'Never' && candidate.smoking === 'Socially') {
    lifestyleScore += 2;
  } else if (currentUser.smoking === 'Socially' && candidate.smoking === 'Never') {
    lifestyleScore += 2;
  }
  
  // Drinking compatibility
  if (currentUser.drinking === candidate.drinking) {
    lifestyleScore += 4;
  } else if (
    (currentUser.drinking === 'Never' && candidate.drinking === 'Socially') ||
    (currentUser.drinking === 'Socially' && candidate.drinking === 'Never')
  ) {
    lifestyleScore += 2;
  }
  
  // Education compatibility
  if (currentUser.education === candidate.education) {
    lifestyleScore += 3;
  } else if (currentUser.education && candidate.education) {
    const eduLevels = ['High School', 'Bachelor', 'Master', 'PhD'];
    const userEduIndex = eduLevels.indexOf(currentUser.education);
    const candEduIndex = eduLevels.indexOf(candidate.education);
    if (Math.abs(userEduIndex - candEduIndex) <= 1) {
      lifestyleScore += 1.5;
    }
  }
  
  // Marital status / children compatibility
  if (currentUser.marital_status === candidate.marital_status) {
    lifestyleScore += 2;
  }
  if (currentUser.has_children === candidate.has_children) {
    lifestyleScore += 2;
  }
  
  score += (weights.lifestyle * lifestyleScore) / 15;
  breakdown['Lifestyle'] = Math.round((weights.lifestyle * lifestyleScore) / 15);

  // 7. PROFILE COMPLETENESS BONUS (0-5 points)
  const candidateCompleteness = calculateProfileCompleteness(candidate);
  const completenessBonus = (candidateCompleteness / 100) * weights.completeness;
  score += completenessBonus;
  breakdown['Completeness'] = Math.round(completenessBonus);

  // Cap score at 100
  const finalScore = Math.min(Math.round(score), 100);

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