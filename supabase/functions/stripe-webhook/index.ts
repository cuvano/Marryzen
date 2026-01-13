// @ts-nocheck
// Supabase Edge Function for Stripe Webhook Integration
// This handles Stripe webhook events to update user premium status
// NOTE: This file uses Deno runtime, not Node.js. TypeScript errors here are expected.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Stripe webhook secret from environment
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not set')
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Stripe signature from headers
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const body = await req.text()

    // Verify webhook signature using Stripe
    const Stripe = (await import('https://esm.sh/stripe@14.21.0')).default
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe secret key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })

    let event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 
                       'https://adufstvmmzpqdcmpinqd.supabase.co'
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 
                       Deno.env.get('SUPABASE_ANON_KEY') || 
                       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdWZzdHZtbXpwcWRjbXBpbnFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NTI3MTEsImV4cCI6MjA4MTQyODcxMX0.AtKLJ-33Oivu9DSbzKLd19O-fOPOeTtkwg9BD_vF4-w'
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata?.userId
        const customerId = session.customer

        if (!userId) {
          console.error('No userId in session metadata')
          break
        }

        // Get subscription details
        let subscriptionId = null
        let subscriptionStatus = null
        let currentPeriodEnd = null

        if (session.subscription) {
          try {
            const subscription = await stripe.subscriptions.retrieve(session.subscription)
            subscriptionId = subscription.id
            subscriptionStatus = subscription.status
            currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString()
          } catch (err) {
            console.error('Error retrieving subscription:', err)
          }
        }

        // Update user profile with premium status
        const updateData = {
          is_premium: true,
          stripe_customer_id: customerId,
        }

        if (currentPeriodEnd) {
          updateData.premium_expires_at = currentPeriodEnd
        } else {
          // If no subscription, calculate expiration based on price
          // Default to 1 month if we can't determine
          const expiresAt = new Date()
          expiresAt.setMonth(expiresAt.getMonth() + 1)
          updateData.premium_expires_at = expiresAt.toISOString()
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', userId)

        if (updateError) {
          console.error('Error updating profile:', updateError)
          return new Response(
            JSON.stringify({ error: 'Failed to update profile', details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('Profile updated for user:', userId, updateData)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const customerId = subscription.customer

        // Find user by customer ID
        const { data: profiles, error: findError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .limit(1)

        if (findError || !profiles || profiles.length === 0) {
          console.error('User not found for customer:', customerId)
          break
        }

        const userId = profiles[0].id
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString()

        // Update premium status based on subscription status
        const isActive = subscription.status === 'active' || subscription.status === 'trialing'
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            is_premium: isActive,
            premium_expires_at: currentPeriodEnd,
          })
          .eq('id', userId)

        if (updateError) {
          console.error('Error updating profile:', updateError)
        } else {
          console.log('Subscription updated for user:', userId, { isActive, currentPeriodEnd })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const customerId = subscription.customer

        // Find user by customer ID
        const { data: profiles, error: findError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .limit(1)

        if (findError || !profiles || profiles.length === 0) {
          console.error('User not found for customer:', customerId)
          break
        }

        const userId = profiles[0].id

        // Remove premium status
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            is_premium: false,
            premium_expires_at: null,
          })
          .eq('id', userId)

        if (updateError) {
          console.error('Error updating profile:', updateError)
        } else {
          console.log('Premium removed for user:', userId)
        }
        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Webhook processing failed',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
