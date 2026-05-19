# Why Password Reset Emails Land in Spam (and How to Fix It)

## What’s happening

You’re receiving the reset email from **Marryzen &lt;noreply@marryzen.com&gt;** (good), but Gmail puts it in **Spam** with “This message might be dangerous” because:

- **From:** `noreply@marryzen.com` (your domain)
- **Link in email:** `https://adufstvmmzpqdcmpinqd.supabase.co/auth/v1/verify?token=...`

So the **sender domain** and the **link domain** don’t match. Filters treat “brand X sends a link to domain Y” as a common phishing pattern, so they flag it.

---

## Options (from best to quickest)

### 1. **Supabase custom domain (best long-term)**

Use your own domain for the auth link so it’s no longer `*.supabase.co`:

- Example: **auth.marryzen.com** (or **api.marryzen.com**) as the Supabase project URL.
- After setup, auth emails will use something like:  
  `https://auth.marryzen.com/auth/v1/verify?token=...&redirect_to=https://www.marryzen.com/reset-password`
- Sender = `noreply@marryzen.com`, link = `auth.marryzen.com` → same brand, much less likely to be marked as phishing.

**Requirements:** Supabase **paid plan** and the [Custom Domains](https://supabase.com/docs/guides/platform/custom-domains) add-on.

**Steps (high level):**

1. In Supabase: **Project Settings** → **Custom Domains** (add-on on paid plan).
2. Add a subdomain, e.g. **auth.marryzen.com**.
3. Add the CNAME (and any TXT) records Supabase gives you to your DNS for **marryzen.com**.
4. After verification/activation, **Supabase Auth will use this domain** for auth links (including the one in the reset email).
5. In your app, point the Supabase client at `https://auth.marryzen.com` (e.g. via `VITE_SUPABASE_URL`).

Result: reset emails still from `noreply@marryzen.com`, but the link is on your domain → better deliverability and less spam.

---

### 2. **Send Email Auth Hook + link to your site (no custom domain)**

Keep using Resend from `noreply@marryzen.com`, but **send the auth email yourself** and put a link that goes to **your** domain first; your site then redirects to Supabase to complete the flow.

- Email link:  
  `https://www.marryzen.com/auth/verify?token=...&type=recovery&redirect_to=https://www.marryzen.com/reset-password`
- Your route **/auth/verify** (already added in the app) redirects to:  
  `https://<project>.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=...`

So the **only link the user sees** is **marryzen.com**; the redirect is invisible. That removes the “link to supabase.co” signal and can help with spam.

**Requirements:** Implement Supabase [Send Email Auth Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) (e.g. Edge Function) that:

- Receives the auth event (e.g. “recovery”).
- Builds the **marryzen.com** link (e.g. `https://www.marryzen.com/auth/verify?token=...&type=recovery&redirect_to=...`).
- Sends the email via Resend (From: `noreply@marryzen.com`) with that link and does **not** use the default Supabase email.

The app already has **/auth/verify** to handle that URL and redirect to Supabase.

---

### 3. **Improve reputation and content (no code change)**

- **DKIM / SPF / DMARC:** Ensure they’re correctly set for **marryzen.com** in Resend/DNS (you’ve already verified the domain; double-check Resend’s “Enable Sending” and DNS).
- **Warm up:** Steady, low-volume sending from `noreply@marryzen.com` helps reputation over time.
- **User action:** Ask users to click **“Looks safe”** in Gmail when they get a legitimate reset; that can help for that address and future ones.

This won’t fix the “link goes to supabase.co” signal, but it can reduce spam for some providers.

---

## Summary

| Approach | Link domain in email | Cost | Effort |
|----------|----------------------|------|--------|
| Custom domain (auth.marryzen.com) | Your domain | Paid Supabase | DNS + config |
| Auth Hook + /auth/verify | Your domain (marryzen.com) | Free | Edge Function + Resend |
| Reputation + “Looks safe” | Still supabase.co | Free | Low |

Best long-term fix is **custom domain** so the link matches your brand. If you can’t use it yet, the **Auth Hook + /auth/verify** approach gives you a marryzen.com link without needing the custom domain add-on.
