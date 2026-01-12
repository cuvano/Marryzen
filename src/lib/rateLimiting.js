/**
 * Rate Limiting Utilities
 * 
 * Client-side rate limiting helpers that complement server-side rate limiting.
 * For production, implement server-side rate limiting in Supabase Edge Functions.
 */

// Rate limit configuration
export const RATE_LIMITS = {
  // Per-user limits (hourly)
  USER: {
    API_REQUESTS: 100, // 100 requests per hour
    PROFILE_VIEWS: 50, // 50 profile views per hour
    SEARCHES: 30, // 30 searches per hour
  },
  
  // Per-IP limits (hourly)
  IP: {
    API_REQUESTS: 200, // 200 requests per hour per IP
    SIGNUP_ATTEMPTS: 5, // 5 signup attempts per hour per IP
    LOGIN_ATTEMPTS: 10, // 10 login attempts per hour per IP
  },
  
  // Action-specific limits
  ACTIONS: {
    MESSAGES_PER_MINUTE: 10,
    LIKES_PER_DAY_FREE: 50,
    LIKES_PER_DAY_PREMIUM: 1000, // Higher limit but not unlimited
    PROFILE_UPDATES_PER_HOUR: 10,
  }
};

/**
 * Store rate limit data in localStorage
 * Format: { key: { count: number, resetAt: number } }
 */
const getRateLimitKey = (type, identifier) => `rate_limit_${type}_${identifier}`;

/**
 * Check if action is allowed based on rate limit
 * @param {string} type - Type of rate limit (e.g., 'user_api', 'ip_signup')
 * @param {string} identifier - User ID or IP address
 * @param {number} limit - Maximum allowed actions
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
export const checkRateLimit = (type, identifier, limit, windowMs = 3600000) => {
  const key = getRateLimitKey(type, identifier);
  const now = Date.now();
  
  try {
    const stored = localStorage.getItem(key);
    const data = stored ? JSON.parse(stored) : { count: 0, resetAt: now + windowMs };
    
    // Reset if window expired
    if (now >= data.resetAt) {
      const newData = { count: 1, resetAt: now + windowMs };
      localStorage.setItem(key, JSON.stringify(newData));
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: newData.resetAt
      };
    }
    
    // Check if limit exceeded
    if (data.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: data.resetAt,
        retryAfter: Math.ceil((data.resetAt - now) / 1000) // seconds
      };
    }
    
    // Increment count
    const newData = { count: data.count + 1, resetAt: data.resetAt };
    localStorage.setItem(key, JSON.stringify(newData));
    
    return {
      allowed: true,
      remaining: limit - newData.count,
      resetAt: data.resetAt
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open - allow action if localStorage fails
    return { allowed: true, remaining: limit, resetAt: now + windowMs };
  }
};

/**
 * Clear rate limit for a specific type and identifier
 */
export const clearRateLimit = (type, identifier) => {
  const key = getRateLimitKey(type, identifier);
  localStorage.removeItem(key);
};

/**
 * Get remaining actions for a rate limit
 */
export const getRateLimitRemaining = (type, identifier, limit, windowMs = 3600000) => {
  const key = getRateLimitKey(type, identifier);
  const stored = localStorage.getItem(key);
  
  if (!stored) return limit;
  
  try {
    const data = JSON.parse(stored);
    const now = Date.now();
    
    if (now >= data.resetAt) return limit;
    
    return Math.max(0, limit - data.count);
  } catch {
    return limit;
  }
};
