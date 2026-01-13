// @ts-nocheck
// Supabase Edge Function for Stripe Payment Integration
// This handles Stripe checkout session creation and portal sessions
// NOTE: This file uses Deno runtime, not Node.js. TypeScript errors here are expected.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header - Supabase automatically passes this when using supabase.functions.invoke()
    // Check all possible header variations
    const authHeader = req.headers.get('Authorization') || 
                      req.headers.get('authorization') ||
                      req.headers.get('x-authorization')
    
    // Log headers for debugging (remove in production)
    console.log('Request headers:', {
      hasAuth: !!authHeader,
      method: req.method,
      url: req.url
    })

    if (!authHeader) {
      console.error('No authorization header found. Available headers:', Array.from(req.headers.keys()))
      return new Response(
        JSON.stringify({ error: 'Not authenticated. Please log in and try again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client - use environment variables or fallback
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 
                       'https://adufstvmmzpqdcmpinqd.supabase.co'
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || 
                       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdWZzdHZtbXpwcWRjbXBpbnFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NTI3MTEsImV4cCI6MjA4MTQyODcxMX0.AtKLJ-33Oivu9DSbzKLd19O-fOPOeTtkwg9BD_vF4-w'
    
    // Create Supabase client with authorization header
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { 
        headers: { 
          Authorization: authHeader
        } 
      }
    })

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Authentication failed: ' + authError.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!user) {
      console.error('No user found after authentication check')
      return new Response(
        JSON.stringify({ error: 'Not authenticated. Please log in and try again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { action, priceId, returnUrl } = await req.json()

    // Get Stripe secret key from environment
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY is not set')
      return new Response(
        JSON.stringify({ error: 'Stripe is not configured. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'create_checkout_session') {
      if (!priceId) {
        return new Response(
          JSON.stringify({ error: 'priceId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Import Stripe (using CDN)
      const Stripe = (await import('https://esm.sh/stripe@14.21.0')).default
      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })

      // Get the origin from the returnUrl or use a default
      const origin = returnUrl ? new URL(returnUrl).origin : 'http://localhost:5173'
      
      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer_email: user.email,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${origin}/billing?success=true`,
        cancel_url: `${origin}/premium?canceled=true`,
        metadata: {
          userId: user.id,
        },
      })

      return new Response(
        JSON.stringify({ url: session.url }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'create_portal_session') {
      // Import Stripe
      const Stripe = (await import('https://esm.sh/stripe@14.21.0')).default
      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })

      // Get customer ID from user metadata or create one
      // For now, we'll need to store customer_id in user metadata or profiles table
      // This is a simplified version - you may need to adjust based on your setup
      
      // Check if user has a Stripe customer ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single()

      if (!profile?.stripe_customer_id) {
        return new Response(
          JSON.stringify({ error: 'No active subscription found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get the origin from the returnUrl or use a default
      const origin = returnUrl ? new URL(returnUrl).origin : 'http://localhost:5173'
      
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${origin}/billing`,
      })

      return new Response(
        JSON.stringify({ url: portalSession.url }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'verify_subscription') {
      // Import Stripe
      const Stripe = (await import('https://esm.sh/stripe@14.21.0')).default
      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })

      // Use current user's email to find customer
      const email = user.email
      if (!email) {
        return new Response(
          JSON.stringify({ error: 'User email not found', updated: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Try to find customer by email
      const customers = await stripe.customers.list({
        email: email,
        limit: 1
      })

      if (customers.data.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No Stripe customer found', updated: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const customer = customers.data[0]
      
      // Get active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 1
      })

      let subscription = subscriptions.data[0]

      if (!subscription) {
        // Check for trialing subscriptions
        const trialingSubs = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'trialing',
          limit: 1
        })
        subscription = trialingSubs.data[0]
      }

      if (!subscription) {
        return new Response(
          JSON.stringify({ error: 'No active subscription found', updated: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update profile with premium status
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString()
      const isActive = subscription.status === 'active' || subscription.status === 'trialing'

      // Use service role key for update (bypass RLS)
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || supabaseKey
      const adminSupabase = createClient(supabaseUrl, serviceRoleKey)

      const { error: updateError } = await adminSupabase
        .from('profiles')
        .update({
          is_premium: isActive,
          stripe_customer_id: customer.id,
          premium_expires_at: currentPeriodEnd
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('Error updating profile:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update profile', details: updateError.message, updated: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          updated: true,
          is_premium: isActive,
          expires_at: currentPeriodEnd
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Stripe API Error:', error)
    
    // Provide more specific error messages
    let errorMessage = 'An error occurred processing your request'
    let statusCode = 500
    
    if (error.message) {
      if (error.message.includes('No such price')) {
        errorMessage = 'Invalid price ID. Please check your Stripe Price IDs are correct.'
        statusCode = 400
      } else if (error.message.includes('Invalid API Key')) {
        errorMessage = 'Invalid Stripe API key. Please check your Stripe secret key configuration.'
        statusCode = 500
      } else if (error.message.includes('rate_limit')) {
        errorMessage = 'Rate limit exceeded. Please try again in a moment.'
        statusCode = 429
      } else {
        errorMessage = error.message
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.toString(),
        type: error.type || 'unknown'
      }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
