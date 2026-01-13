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
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
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

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Stripe API Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An error occurred processing your request',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
