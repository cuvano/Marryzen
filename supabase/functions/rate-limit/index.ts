// Supabase Edge Function for API Rate Limiting
// This should be deployed to Supabase Edge Functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limit configuration
const RATE_LIMITS = {
  USER: {
    API_REQUESTS: 100, // per hour
    PROFILE_VIEWS: 50,
    SEARCHES: 30,
  },
  IP: {
    API_REQUESTS: 200, // per hour
    SIGNUP_ATTEMPTS: 5,
    LOGIN_ATTEMPTS: 10,
  }
};

// In-memory rate limit store (for production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get user and IP
    const authHeader = req.headers.get('Authorization');
    const userId = authHeader ? await getUserIdFromToken(authHeader) : null;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // Determine rate limit type from request
    const url = new URL(req.url);
    const endpoint = url.pathname;
    const rateLimitType = getRateLimitType(endpoint);

    // Check rate limit
    const identifier = userId || ip;
    const limit = userId 
      ? RATE_LIMITS.USER[rateLimitType] || RATE_LIMITS.USER.API_REQUESTS
      : RATE_LIMITS.IP[rateLimitType] || RATE_LIMITS.IP.API_REQUESTS;
    
    const windowMs = 3600000; // 1 hour
    
    const result = checkRateLimit(identifier, limit, windowMs);

    if (!result.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter
        }),
        { 
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': result.retryAfter.toString() }
        }
      );
    }

    // Add rate limit headers to response
    const headers = {
      ...corsHeaders,
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetAt.toString(),
    };

    // For now, return success - in production, proxy the actual request
    return new Response(
      JSON.stringify({ message: 'Rate limit check passed', remaining: result.remaining }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getUserIdFromToken(authHeader: string): Promise<string | null> {
  // Extract and verify JWT token
  // This is a simplified version - use proper JWT verification in production
  return Promise.resolve(null);
}

function getRateLimitType(endpoint: string): string {
  if (endpoint.includes('/profiles') && req.method === 'GET') return 'PROFILE_VIEWS';
  if (endpoint.includes('/profiles') && req.method === 'POST') return 'SEARCHES';
  return 'API_REQUESTS';
}

function checkRateLimit(identifier: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = identifier;
  const stored = rateLimitStore.get(key);

  if (!stored || now >= stored.resetAt) {
    const newData = { count: 1, resetAt: now + windowMs };
    rateLimitStore.set(key, newData);
    return { allowed: true, remaining: limit - 1, resetAt: newData.resetAt };
  }

  if (stored.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: stored.resetAt,
      retryAfter: Math.ceil((stored.resetAt - now) / 1000)
    };
  }

  stored.count += 1;
  rateLimitStore.set(key, stored);

  return {
    allowed: true,
    remaining: limit - stored.count,
    resetAt: stored.resetAt
  };
}
