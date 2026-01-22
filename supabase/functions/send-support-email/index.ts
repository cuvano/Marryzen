import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Resend API configuration
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const RESEND_API_URL = 'https://api.resend.com/emails'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Get the request body
    const { name, email, subject, message, userId } = await req.json()

    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get support email from platform settings
    const { data: settings } = await supabaseClient
      .from('platform_settings')
      .select('support_email')
      .single()

    const supportEmail = settings?.support_email || Deno.env.get('SUPPORT_EMAIL') || 'support@marryzen.com'
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@marryzen.com'

    // Check if user is premium
    let isPremium = false;
    if (userId) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('is_premium, premium_expires_at')
        .eq('id', userId)
        .maybeSingle();
      
      if (profile) {
        // Check if premium is active (not expired)
        isPremium = profile.is_premium && 
          (!profile.premium_expires_at || new Date(profile.premium_expires_at) > new Date());
      }
    }

    // Insert ticket into database with priority flag
    const { data: ticket, error: ticketError } = await supabaseClient
      .from('support_tickets')
      .insert({
        user_id: userId || null,
        name,
        email,
        subject,
        message,
        status: 'open',
        is_priority: isPremium
      })
      .select()
      .single()

    if (ticketError) {
      console.error('Error creating ticket:', ticketError)
      return new Response(
        JSON.stringify({ error: 'Failed to create support ticket' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send email using Resend
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured')
      // Still return success since ticket was created
      return new Response(
        JSON.stringify({ 
          success: true, 
          ticketId: ticket.id,
          warning: 'Email not sent - RESEND_API_KEY not configured. Ticket saved to database.',
          message: 'Support ticket created successfully. We will respond via email.'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const ticketNumber = ticket.id.substring(0, 8).toUpperCase()
    const priorityLabel = isPremium ? '[PRIORITY] ' : ''
    const emailSubject = `${priorityLabel}[Support Ticket #${ticketNumber}] ${subject}`
    
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1F1F1F;">
          ${isPremium ? '<span style="background-color: #E6B450; color: #1F1F1F; padding: 4px 8px; border-radius: 4px; font-size: 14px; margin-right: 8px;">PRIORITY</span>' : ''}
          New Support Ticket #${ticketNumber}
        </h2>
        
        <div style="background-color: #FAF7F2; padding: 20px; border-radius: 8px; margin: 20px 0; ${isPremium ? 'border-left: 4px solid #E6B450;' : ''}">
          <p><strong>From:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ''}
          ${isPremium ? '<p><strong style="color: #E6B450;">⭐ Premium Member - Priority Support</strong></p>' : ''}
        </div>
        
        <div style="background-color: #FFFFFF; padding: 20px; border: 1px solid #E6DCD2; border-radius: 8px;">
          <h3 style="color: #1F1F1F; margin-top: 0;">Message:</h3>
          <p style="color: #706B67; white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</p>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #FFFBEB; border-left: 4px solid #E6B450; border-radius: 4px;">
          <p style="margin: 0; color: #706B67; font-size: 14px;">
            <strong>Ticket ID:</strong> ${ticket.id}<br>
            <strong>Created:</strong> ${new Date(ticket.created_at).toLocaleString()}
          </p>
        </div>
        
        <p style="color: #706B67; font-size: 12px; margin-top: 30px;">
          This is an automated message from Marryzen Support System.
        </p>
      </div>
    `

    // Send email via Resend API
    try {
      const resendResponse = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [supportEmail],
          subject: emailSubject,
          html: emailBody,
          reply_to: email, // Allow replying directly to the user
        }),
      })

      if (!resendResponse.ok) {
        const errorData = await resendResponse.json()
        console.error('Resend API error:', errorData)
        // Still return success since ticket was created
        return new Response(
          JSON.stringify({ 
            success: true, 
            ticketId: ticket.id,
            warning: 'Email sending failed, but ticket was saved.',
            message: 'Support ticket created successfully. We will respond via email.'
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const resendData = await resendResponse.json()
      console.log('Email sent successfully via Resend:', resendData)
    } catch (emailError) {
      console.error('Error sending email via Resend:', emailError)
      // Still return success since ticket was created
      // Email failure shouldn't block ticket creation
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        ticketId: ticket.id,
        message: 'Support ticket created successfully. We will respond via email.'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
