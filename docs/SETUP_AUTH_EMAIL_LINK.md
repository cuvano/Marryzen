# How to Set Up Auth Emails So the Link Uses Your Domain (Avoid Spam)

Two options. Choose **one**.

---

# Option A: Supabase Custom Domain (recommended if you have a paid plan)

The link in the email becomes `https://auth.marryzen.com/...` instead of `*.supabase.co`. No code changes to email content; Supabase does it for you.

## Requirements
- Supabase **Pro** (or higher) plan
- **Custom Domains** add-on enabled for your project

## Step-by-step

### 1. Enable Custom Domain in Supabase
1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your **Marryzen** project.
2. Open **Project Settings** (gear icon) → **General** (or **Custom Domains** / **Add-ons**).
3. Find **Custom Domains** and enable / add the add-on if needed.
4. In the Custom Domain section, click **Add custom domain** (or equivalent).

### 2. Add your hostname
- **Custom hostname:** Use a subdomain, e.g. `auth.marryzen.com` (not root `marryzen.com`).
- Supabase will show:
  - A **CNAME** record: e.g. `auth.marryzen.com` → `adufstvmmzpqdcmpinqd.supabase.co`
  - Sometimes a **TXT** record for verification (e.g. `_acme-challenge.auth.marryzen.com`).

### 3. Add DNS records at your domain provider
1. Log in where you manage DNS for **marryzen.com** (e.g. Cloudflare, Hostinger, Namecheap).
2. Add the **CNAME** record Supabase gave you:
   - **Name / Host:** `auth` (or `auth.marryzen.com` if your provider wants full name).
   - **Target / Value:** `adufstvmmzpqdcmpinqd.supabase.co`
3. If Supabase shows a **TXT** record for `_acme-challenge.auth.marryzen.com`, add that too.
4. Save. DNS can take 5–60 minutes to propagate.

### 4. Verify and activate in Supabase
1. Back in Supabase → Custom Domain, click **Verify** (or **Reverify**).
2. When verification succeeds, click **Activate** (or follow the dashboard flow to activate the domain).
3. Supabase will issue an SSL certificate for `auth.marryzen.com`.

### 5. Point your app at the custom domain
1. In your **production** environment (e.g. Netlify, Vercel), set:
   - **Name:** `VITE_SUPABASE_URL`
   - **Value:** `https://auth.marryzen.com`
2. Redeploy the frontend so it uses this URL for the Supabase client.
3. In **Supabase Dashboard** → **Authentication** → **URL Configuration**:
   - **Site URL:** `https://www.marryzen.com`
   - **Redirect URLs:** include `https://www.marryzen.com/**` (and any other allowed redirects).

After this, auth emails (reset password, magic link, signup confirmation) will contain links like:
`https://auth.marryzen.com/auth/v1/verify?token=...&type=recovery&redirect_to=...`
So the link domain matches your brand (marryzen.com subdomain), which helps with spam.

---

# Option B: Send Email Auth Hook (works on free tier; link = www.marryzen.com)

You send the auth email yourself via Resend. The link in the email goes to **https://www.marryzen.com/auth/verify?...**; that page redirects to Supabase to complete the flow. The user only sees a marryzen.com link.

## Requirements
- Resend API key and verified domain `marryzen.com` (you already have this).
- Supabase project (any plan).

## Step-by-step

### 1. Create the Edge Function
In your repo, the function is at:
`supabase/functions/send-auth-email/index.ts`
(See that file for the full code.)

If you prefer to create it via CLI from the project root:
```bash
supabase functions new send-auth-email
```
Then replace the contents of `supabase/functions/send-auth-email/index.ts` with the code from the repo.

### 2. Deploy the function first (you need its URL for the hook)

**If `supabase` is not recognized:** Install the CLI as a dev dependency and use `npx`:
```bash
npm install supabase --save-dev
npx supabase login
npx supabase functions deploy send-auth-email --no-verify-jwt
```
`npx supabase login` opens a browser to get an access token (or set `SUPABASE_ACCESS_TOKEN` in your environment).

From the project root (with CLI in PATH or via npx):
```bash
supabase functions deploy send-auth-email --no-verify-jwt
```
or
```bash
npx supabase functions deploy send-auth-email --no-verify-jwt
```
`--no-verify-jwt` is required because the Auth Hook calls this URL without a user JWT.

Note the function URL, e.g.:
`https://adufstvmmzpqdcmpinqd.supabase.co/functions/v1/send-auth-email`

### 3. Create the Auth Hook and get the secret (Dashboard step-by-step)

You’re on the **“Add Send Email hook”** page. Do the following:

1. **Enable Send Email hook**  
   Turn the **“Enable Send Email hook”** toggle **ON** (green).

2. **Hook type: choose HTTPS (not Postgres)**  
   - **Postgres** = “Used to call a Postgres function.” (We are **not** using this.)  
   - **HTTPS** = “Used to call any HTTPS endpoint.”  
   Select **HTTPS** so Supabase calls your Edge Function URL.

3. **URL (HTTPS endpoint)**  
   After selecting HTTPS, a **URL** field appears. Paste your Edge Function URL, for example:
   ```text
   https://adufstvmmzpqdcmpinqd.supabase.co/functions/v1/send-auth-email
   ```
   Use your real project URL: replace `adufstvmmzpqdcmpinqd` with your project reference if different.  
   You can copy the exact URL from the deploy output in step 2.

4. **Secret (for verifying the hook)**  
   - Click **“Generate secret”** (or similar).  
   - **Copy the secret** and store it somewhere safe (e.g. `v1,whsec_xxxxxxxx...`).  
   - You will paste this same value into **Edge Function secrets** as `SEND_EMAIL_HOOK_SECRET` in step 4.

5. **Save the hook**  
   Click **“Create hook”** (or “Save”).  
   The Send Email hook is now active: Supabase will POST to your function whenever it needs to send an auth email (reset password, signup confirmation, magic link, etc.).

### 4. Set secrets for the function
The function needs your Resend key and the hook secret so it can verify requests.

1. Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets** (or run CLI below).
2. Add these secrets (use the secret you copied in step 3 for `SEND_EMAIL_HOOK_SECRET`):

| Secret name              | Value |
|--------------------------|--------|
| `RESEND_API_KEY`         | Your Resend API key (e.g. `re_xxxx`) |
| `RESEND_FROM_EMAIL`      | `noreply@marryzen.com` |
| `SEND_EMAIL_HOOK_SECRET` | The value from step 3 (e.g. `v1,whsec_xxxx`) |
| `APP_URL` (optional)     | `https://www.marryzen.com` (defaults to this if not set) |

Or via CLI (from project root):
```bash
supabase secrets set RESEND_API_KEY=re_xxxx
supabase secrets set RESEND_FROM_EMAIL=noreply@marryzen.com
supabase secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_xxxx"
```
Optional: `supabase secrets set APP_URL=https://www.marryzen.com`

3. Redeploy so the function picks up the new secrets:
   ```bash
   supabase functions deploy send-auth-email --no-verify-jwt
   ```

### 5. Ensure redirect URLs are allowed
In **Authentication** → **URL Configuration**:
- **Redirect URLs** must include: `https://www.marryzen.com/**` and `https://www.marryzen.com/auth/verify` (or a wildcard that covers it).

### 6. Turn off SMTP for Auth (optional)
Once the hook is working, you can disable **Custom SMTP** under **Authentication** → **Email** so only the hook sends auth emails. If you leave SMTP on and the hook is enabled, the hook takes precedence.

## How it works
- User requests password reset (or signup / magic link).
- Supabase Auth calls your **send-auth-email** function with `user` and `email_data` (token, type, redirect_to, etc.).
- The function builds a link:  
  `https://www.marryzen.com/auth/verify?token=...&type=recovery&redirect_to=https://www.marryzen.com/reset-password`
- It sends the email via Resend from `noreply@marryzen.com` with that link.
- User clicks the link → hits **www.marryzen.com/auth/verify** → your app’s `/auth/verify` page redirects to Supabase’s `/auth/v1/verify?...` → user ends up on `/reset-password` (or the correct screen).

The link the user sees is always **www.marryzen.com**, which avoids the “link to supabase.co” spam trigger.

---

**Option B checklist (in order):** (1) Deploy the function. (2) Add Send Email hook: enable → select **HTTPS** → paste function URL → Generate secret, copy it → Create hook. (3) Set Edge Function secrets, redeploy. (4) Add `https://www.marryzen.com/**` to Redirect URLs. (5) Test password reset.

**"Hook requires authorization token" error:** This usually means the hook returned 401 (e.g. webhook verification failed). Fix: (1) In **Project Settings** → **Edge Functions** → **Secrets**, set **SEND_EMAIL_HOOK_SECRET** to the **exact** value from the Auth Hook (the one you copied when you clicked Generate secret; it looks like `v1,whsec_xxxx`). (2) Redeploy: `supabase functions deploy send-auth-email --no-verify-jwt`. (3) Confirm the function is deployed with **JWT verification disabled** (the hook is called without a user JWT). The function also accepts the secret in the `Authorization: Bearer <secret>` header as a fallback.

---

# Summary

| Option | Link in email        | Cost              | Steps |
|--------|----------------------|-------------------|--------|
| **A – Custom domain** | auth.marryzen.com   | Paid Supabase     | DNS + add custom domain + set VITE_SUPABASE_URL |
| **B – Auth Hook**     | www.marryzen.com    | Free              | Deploy send-auth-email, set secrets, add hook |

Use **Option A** if you have (or will have) a paid plan. Use **Option B** if you stay on the free tier and want the link to be on marryzen.com.
