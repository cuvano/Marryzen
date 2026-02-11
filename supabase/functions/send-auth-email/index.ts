// @ts-nocheck
// Send Email Auth Hook: send auth emails (reset password, signup, magic link) via Resend
// with a link to https://www.marryzen.com/auth/verify so the email link domain matches the sender (avoids spam).
// Deploy: supabase functions deploy send-auth-email --no-verify-jwt
// Configure: Supabase Dashboard → Authentication → Hooks → Send Email → this function URL + secret.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const RESEND_API_URL = "https://api.resend.com/emails"
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@marryzen.com"
const FROM_NAME = "Marryzen"
const APP_URL = Deno.env.get("APP_URL") || "https://www.marryzen.com"

// Hook secret from Dashboard (Auth → Hooks). Strip "v1,whsec_" for verification.
const hookSecretRaw = Deno.env.get("SEND_EMAIL_HOOK_SECRET") || ""
const hookSecret = hookSecretRaw.replace(/^v1,whsec_/, "")

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers.entries())

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set")
    return new Response(JSON.stringify({ error: "Email service not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!hookSecret) {
    console.error("SEND_EMAIL_HOOK_SECRET is not set")
    return new Response(JSON.stringify({ error: "Hook not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  let user: { email: string; email_new?: string }
  let email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
    token_new?: string
    token_hash_new?: string
  }

  // 1) Try Standard Webhooks signature verification (payload + headers).
  try {
    const wh = new Webhook(hookSecret)
    const verified = wh.verify(payload, headers) as { user: typeof user; email_data: typeof email_data }
    user = verified.user
    email_data = verified.email_data
  } catch {
    // 2) Fallback: accept if Supabase sent the hook secret in Authorization header (avoids "Hook requires authorization token").
    const authHeader = req.headers.get("Authorization")
    const expectedBearer = `Bearer ${hookSecretRaw}`
    if (hookSecretRaw && authHeader === expectedBearer) {
      try {
        const body = JSON.parse(payload) as { user: typeof user; email_data: typeof email_data }
        if (body?.user?.email && body?.email_data) {
          user = body.user
          email_data = body.email_data
        } else {
          throw new Error("Invalid payload")
        }
      } catch (e) {
        console.error("Fallback auth: invalid payload", e)
        return new Response(JSON.stringify({ error: "Invalid webhook" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      }
    } else {
      console.error("Webhook verification failed: invalid signature or missing secret")
      return new Response(JSON.stringify({ error: "Invalid webhook" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }
  }

  const redirectTo = email_data.redirect_to || `${APP_URL}/reset-password`
  const type = email_data.email_action_type || "recovery"

  // Link to YOUR domain so the email doesn't contain supabase.co (reduces spam flags).
  // Supabase verify endpoint expects the token_hash in the token query param.
  const verifyLink = `${APP_URL}/auth/verify?token=${encodeURIComponent(email_data.token_hash)}&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(redirectTo)}`

  const subjectByType: Record<string, string> = {
    recovery: "Reset Your Password",
    signup: "Confirm Your Email",
    magiclink: "Your Login Link",
    email_change: "Confirm Your New Email",
  }
  const subject = subjectByType[type] || "Marryzen – Confirm your request"

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1F1F1F;">${type === "recovery" ? "Reset Password" : type === "signup" ? "Confirm your signup" : type === "magiclink" ? "Log in" : "Confirm your request"}</h2>
  <p>Follow this link to continue:</p>
  <p><a href="${verifyLink}" style="color: #E6B450; font-weight: bold;">${type === "recovery" ? "Reset Password" : "Confirm"}</a></p>
  <p style="color: #706B67; font-size: 14px;">If you didn't request this, you can ignore this email.</p>
  <p style="color: #706B67; font-size: 12px; margin-top: 24px;">Marryzen – Serious marriage matchmaking</p>
</body>
</html>
`.trim()

  const text = `${subject}\n\nFollow this link to continue:\n${verifyLink}\n\nIf you didn't request this, you can ignore this email.\n\n— Marryzen`

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [user.email],
        subject,
        html,
        text,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("Resend error:", res.status, err)
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  } catch (e) {
    console.error("Send failed:", e)
    return new Response(JSON.stringify({ error: "Failed to send email" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
})
