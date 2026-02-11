# Auth Emails from Your Domain (e.g. noreply@marryzen.com)

## What the client wants

- **Today:** Password reset (and other auth emails like signup confirmation, magic link) are sent by **Supabase** from `noreply@mail.app.supabase.io`.
- **Goal:** Those same emails should be sent from **your domain**, like `noreply@marryzen.com` — the same way your other outgoing emails (notifications, support) are sent from `noreply@marryzen.com` via Resend.

So: **all system emails** (auth + notifications + support) should appear to come from `noreply@marryzen.com` (or your chosen sender), not from Supabase’s default address.

---

## What you have to do

Use **Supabase Custom SMTP** so Supabase Auth sends its emails through **Resend** with your domain. No code changes are required; everything is done in the Supabase Dashboard and Resend.

### Prerequisites (you likely already have these)

- Resend account with **marryzen.com** (or your domain) **verified**
- A Resend **API key** (same one you use for notifications/support is fine)

### Step 1: Open Supabase SMTP settings

1. Log in to [Supabase Dashboard](https://supabase.com/dashboard).
2. Open your **Marryzen** project.
3. In the left sidebar: **Authentication** → **Email** (under “Notifications”) → **SMTP Settings**.

### Step 2: Configure sender (required)

- **Sender email:** `noreply@marryzen.com` (must be from a domain you’ve verified in Resend).
- **Sender name:** `Marryzen` (or e.g. “Marryzen Team” — this is the “From” name users see).

### Step 3: Enter Resend SMTP credentials

Use these values in the Supabase SMTP form:

| Field in Supabase | Value |
|-------------------|--------|
| **Host**          | `smtp.resend.com` |
| **Port**          | `465` |
| **Username**      | `resend` |
| **Password**      | Your **Resend API key** (from [Resend → API Keys](https://resend.com/api-keys)) |

- **Sender email** and **Sender name** must be set as in Step 2 (Supabase requires them).
- You can copy the same credentials from [Resend → SMTP](https://resend.com/settings/smtp) if needed.

### Step 4: Save

Click **Save** in Supabase. From then on, all Auth emails (password reset, confirm signup, magic link, etc.) will be sent through Resend from `noreply@marryzen.com`.

---

## Result

- **Before:** Reset password email from `noreply@mail.app.supabase.io`.
- **After:** Reset password (and other auth) emails from `Marryzen <noreply@marryzen.com>`, same as your notification and support emails.

No app or Supabase function code changes are required; only Dashboard SMTP configuration.

---

## Optional: Customize email templates

In Supabase: **Authentication** → **Email Templates**. You can edit the **Reset password**, **Confirm signup**, and **Magic link** templates (subject and body) so they match your brand and wording. The “From” address is still the one you set in SMTP (e.g. `noreply@marryzen.com`).

---

## Troubleshooting: Not receiving reset email from noreply@marryzen.com

1. **Supabase really using custom SMTP?** Dashboard → **Authentication** → **Email** / **SMTP**. Ensure **Enable Custom SMTP** is **ON** and **Sender email** is exactly `noreply@marryzen.com`. Save, then request a new reset.
2. **Resend domain:** [resend.com/domains](https://resend.com/domains) → marryzen.com must be **Verified**. Turn **Enable Sending** **ON** for that domain.
3. **Resend testing mode:** If your account is in testing mode, emails may only go to your own address. Verify domain and enable sending so all recipients can receive.
4. **Check spam** and try a **different recipient** (e.g. another inbox).
5. **SMTP password** must be your **Resend API key** (from Resend → API Keys), not your Resend account password. Host: `smtp.resend.com`, Port: `465`, User: `resend`.
6. **Resend Logs:** After requesting a reset, open [resend.com/logs](https://resend.com/logs). If no log appears, Supabase may not be using SMTP or may be using the default server. If there is an error (e.g. sender not verified), fix that.

**Known issue:** Supabase sometimes sends with the user's email as From instead of your sender; Resend then rejects. Ensure Sender email/name are set. If it persists, use the [Send Email Auth Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) to send via Resend API with From: noreply@marryzen.com.

---

## Troubleshooting

- **Emails still from Supabase address:** Ensure SMTP is saved and “Enable Custom SMTP” (or equivalent) is on; try sending a test reset and check the received “From” header.
- **Emails not delivered / bounce:** Confirm in Resend that the domain is verified (SPF, DKIM, etc.) and that you’re not in “testing” mode if you need to send to arbitrary addresses.
- **“Invalid credentials”:** Double-check Host, Port, Username, and that the Password is the Resend **API key** (not your Resend account password).
