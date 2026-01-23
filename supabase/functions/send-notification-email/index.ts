// @ts-nocheck
// Supabase Edge Function for Notification Email
// This sends email notifications via Resend when notifications are created
// NOTE: This file uses Deno runtime, not Node.js.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Resend API configuration
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@marryzen.com'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Get the request body
    let requestBody
    try {
      requestBody = await req.json()
    } catch (parseError) {
      console.error('Error parsing request body:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const { notification_id, user_id, type, title, body, metadata } = requestBody

    if (!notification_id || !user_id || !type || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if email was already sent
    const { data: existingNotification } = await supabaseClient
      .from('notifications')
      .select('email_sent, email_sent_at')
      .eq('id', notification_id)
      .single()

    if (existingNotification?.email_sent) {
      return new Response(
        JSON.stringify({ success: true, message: 'Email already sent' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile to get email
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', user_id)
      .single()

    if (profileError || !profile) {
      console.error('Error fetching profile:', profileError)
      
      // Fallback: Try to get email from auth.users
      try {
        const { data: authUser, error: authError } = await supabaseClient.auth.admin.getUserById(user_id)
        if (authError || !authUser?.user?.email) {
          console.error('Error fetching auth user:', authError)
          return new Response(
            JSON.stringify({ error: 'User email not found', details: profileError?.message || authError?.message }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Use auth user email as fallback
        profile = { email: authUser.user.email, full_name: authUser.user.user_metadata?.full_name || 'User' }
      } catch (fallbackError) {
        console.error('Fallback email fetch failed:', fallbackError)
        return new Response(
          JSON.stringify({ error: 'User email not found', details: profileError?.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
    
    if (!profile.email) {
      console.error('No email found for user:', user_id)
      return new Response(
        JSON.stringify({ error: 'User email is missing' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user notification preferences
    const { data: preferences } = await supabaseClient
      .from('user_preferences')
      .select('notification_settings')
      .eq('user_id', user_id)
      .maybeSingle()

    const settings = preferences?.notification_settings || {
      email_enabled: true,
      email_match: true,
      email_message: true,
      email_intro: true,
      email_profile: true,
      email_reward: true
    }

    // Check if email notifications are enabled
    if (!settings.email_enabled) {
      return new Response(
        JSON.stringify({ success: true, message: 'Email notifications disabled by user' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if this specific notification type is enabled
    const typeEnabled = {
      'new_match': settings.email_match,
      'new_message': settings.email_message,
      'intro_request': settings.email_intro,
      'profile_approved': settings.email_profile,
      'profile_rejected': settings.email_profile,
      'referral_reward': settings.email_reward
    }[type]

    if (!typeEnabled) {
      return new Response(
        JSON.stringify({ success: true, message: 'This notification type is disabled by user' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if RESEND_API_KEY is configured
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured')
      return new Response(
        JSON.stringify({ 
          success: false, 
          warning: 'Email not sent - RESEND_API_KEY not configured' 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Build email content based on notification type
    const emailSubject = getEmailSubject(type, title)
    const emailBody = getEmailBody(type, title, body, metadata, profile.full_name)

    // Send email via Resend API
    try {
      const resendResponse = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [profile.email],
          subject: emailSubject,
          html: emailBody,
        }),
      })

      if (!resendResponse.ok) {
        const errorData = await resendResponse.json()
        console.error('Resend API error:', errorData)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to send email',
            details: errorData 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const resendData = await resendResponse.json()
      console.log('Email sent successfully via Resend:', resendData)

      // Update notification to mark email as sent
      await supabaseClient
        .from('notifications')
        .update({ 
          email_sent: true,
          email_sent_at: new Date().toISOString()
        })
        .eq('id', notification_id)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email sent successfully',
          emailId: resendData.id
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } catch (emailError) {
      console.error('Error sending email via Resend:', emailError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to send email',
          details: emailError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
  } catch (error) {
    console.error('Unhandled error in send-notification-email:', error)
    console.error('Error stack:', error.stack)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message || 'Unknown error',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function getEmailSubject(type: string, title: string): string {
  return `Marryzen: ${title}`
}

function getEmailBody(type: string, title: string, body: string, metadata: any, userName: string): string {
  const baseUrl = Deno.env.get('APP_URL') || 'https://marryzen.com'
  
  let actionButton = ''
  let actionUrl = baseUrl

  switch (type) {
    case 'new_match':
      actionUrl = `${baseUrl}/matches`
      actionButton = '<a href="' + actionUrl + '" style="display: inline-block; background-color: #E6B450; color: #1F1F1F; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">View Matches</a>'
      break
    case 'new_message':
      actionUrl = metadata?.conversation_id ? `${baseUrl}/chat/${metadata.conversation_id}` : `${baseUrl}/chat`
      actionButton = '<a href="' + actionUrl + '" style="display: inline-block; background-color: #E6B450; color: #1F1F1F; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">View Message</a>'
      break
    case 'intro_request':
      actionUrl = metadata?.profile_id ? `${baseUrl}/profile/${metadata.profile_id}` : `${baseUrl}/discovery`
      actionButton = '<a href="' + actionUrl + '" style="display: inline-block; background-color: #E6B450; color: #1F1F1F; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">View Profile</a>'
      break
    case 'profile_approved':
    case 'profile_rejected':
      actionUrl = `${baseUrl}/profile`
      actionButton = '<a href="' + actionUrl + '" style="display: inline-block; background-color: #E6B450; color: #1F1F1F; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">View Profile</a>'
      break
    case 'referral_reward':
      actionUrl = `${baseUrl}/rewards`
      actionButton = '<a href="' + actionUrl + '" style="display: inline-block; background-color: #E6B450; color: #1F1F1F; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">View Rewards</a>'
      break
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1F1F1F; background-color: #FAF7F2; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #E6B450 0%, #D0A23D 100%); padding: 30px; text-align: center;">
          <h1 style="color: #1F1F1F; margin: 0; font-size: 28px; font-weight: bold;">
            Marryzen<span style="color: #C85A72;">.</span>
          </h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
          <h2 style="color: #1F1F1F; margin-top: 0; font-size: 24px;">${title}</h2>
          <p style="color: #706B67; font-size: 16px; line-height: 1.8;">${body.replace(/\n/g, '<br>')}</p>
          
          ${actionButton}
        </div>
        
        <!-- Footer -->
        <div style="background-color: #FAF7F2; padding: 20px 30px; border-top: 1px solid #E6DCD2; text-align: center;">
          <p style="color: #706B67; font-size: 12px; margin: 0;">
            This is an automated notification from Marryzen.<br>
            You can manage your notification preferences in your <a href="${baseUrl}/notifications" style="color: #E6B450; text-decoration: none;">account settings</a>.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}
