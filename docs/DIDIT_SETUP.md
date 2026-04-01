# Didit ID Verification Setup (Marryzen) — Step-by-step

This guide walks you through exactly what to do to switch identity verification to **Didit**. Follow the steps in order.

---

## What you’ll do (overview)

1. Create a Didit account and get API key + webhook secret  
2. Create a verification workflow and copy its ID  
3. Set your webhook URL in Didit  
4. Add secrets in Supabase  
5. Deploy two Edge Functions  
6. Test the flow  

---

## Step 1 — Create a Didit account and get credentials

1. Open **[business.didit.me](https://business.didit.me)** (or the sign-up link from [didit.me](https://www.didit.me)).
2. Sign up / log in to the **Didit Console**.
3. In the sidebar, go to **API & Webhooks** (or **Settings** → **API Keys**).
4. **Copy and save:**
   - **API Key** — you’ll use this as `DIDIT_API_KEY` in Supabase.
   - **Webhook Secret Key** — you’ll use this as `DIDIT_WEBHOOK_SECRET` in Supabase.  
   Keep these somewhere safe; you’ll need them in Step 4.

---

## Step 2 — Create a workflow and get Workflow ID

1. In the Didit Console sidebar, open **Workflows** (or **Console** → **Workflows**).
2. Create a **new workflow** for identity verification (e.g. “ID document + selfie” or “KYC”).
3. Configure the steps you want (ID document, selfie/liveness, etc.) and save.
4. Open the workflow you created and find its **Workflow ID** (a UUID like `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).
5. **Copy and save** this UUID — you’ll use it as `DIDIT_WORKFLOW_ID` in Supabase.

---

## Step 3 — Set the webhook URL in Didit

1. Stay in **API & Webhooks** in the Didit Console.
2. Find the **Webhook URL** (or “Webhook endpoint”) field.
3. Set it to your Supabase Edge Function URL:
   ```text
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/didit-webhook
   ```
   Replace **YOUR_PROJECT_REF** with your actual Supabase project reference:
   - In Supabase: **Project Settings** (gear) → **General** → **Reference ID**.
4. Save the webhook URL in Didit.
5. (Optional) Use Didit’s **“Try Webhook”** (or similar) to send a test event and confirm the URL is reachable.

**If you use Cloudflare** in front of Supabase or your app, whitelist Didit’s IP: **18.203.201.92**.

---

## Step 4 — Add secrets in Supabase

1. Open **[app.supabase.com](https://app.supabase.com)** and select your Marryzen project.
2. Go to **Project Settings** (gear icon in the left sidebar) → **Edge Functions**.
3. Open the **Secrets** (or “Environment variables”) section.
4. Add these three secrets (use “Add new secret” or similar):

   | Name                   | Value                                      |
   |------------------------|--------------------------------------------|
   | `DIDIT_API_KEY`        | The API Key from Didit (Step 1)            |
   | `DIDIT_WORKFLOW_ID`    | The Workflow ID UUID from Didit (Step 2)  |
   | `DIDIT_WEBHOOK_SECRET` | The Webhook Secret Key from Didit (Step 1)|

5. Save. Do **not** commit these values to git.

Optional:  
- **`DIDIT_API_BASE`** — only set if Didit gives you a different API base URL; default is `https://verification.didit.me`.

---

## Step 5 — Deploy the Edge Functions

1. On your machine, open a terminal in the **Marryzen project root** (where `supabase/functions` lives).
2. Log in to Supabase CLI if needed:
   ```bash
   supabase login
   ```
3. Link the project if not already linked:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   Use the same **Reference ID** as in Step 3.
4. Deploy both functions:
   ```bash
   supabase functions deploy create-verification-session
   supabase functions deploy didit-webhook --no-verify-jwt
   ```
   The `--no-verify-jwt` flag is required for `didit-webhook` because Didit calls it without a Supabase JWT; the function verifies requests using Didit’s signature headers.
5. If the CLI asks for secrets, ensure the three secrets from Step 4 are set in the dashboard; they are usually read from there automatically.

---

## Step 6 — Test the flow

1. **In your app:** Log in as a user, go to **Profile**, and click **Verify** (identity verification).
2. The app should open a dialog and a **“Start verification”** button that redirects to Didit.
3. Complete the Didit flow (ID + selfie) on Didit’s page.
4. You should be redirected back to your app (e.g. `/profile?verification=done`) and see a message like “Verification submitted”.
5. When Didit sends the result:
   - The **didit-webhook** function receives it and updates the profile.
   - On the profile (or after refresh), the user should see **Identity: Verified** (or Rejected if Didit declined).

**If “Start verification” fails:**  
- Check the browser console and Supabase **Edge Function logs** for `create-verification-session`.  
- Confirm `DIDIT_API_KEY` and `DIDIT_WORKFLOW_ID` are set correctly in Supabase secrets.

**If the status never updates to Verified/Rejected:**  
- In Didit Console, check that the **webhook URL** is exactly the one in Step 3 and that Didit shows successful deliveries.  
- In Supabase, check **Edge Function logs** for `didit-webhook` and confirm `DIDIT_WEBHOOK_SECRET` is set (signature verification will fail without it).

---

## "Verification unavailable" or "Edge Function returned a non-2xx status code"

If clicking **Start verification** shows an error:

1. **Check the toast message**  
   The app now shows the reason from the Edge Function when possible (e.g. "Didit not configured", or the Didit API error).

2. **Confirm Supabase secrets**  
   In **Project Settings** → **Edge Functions** → **Secrets**, ensure all three are set:
   - `DIDIT_API_KEY`
   - `DIDIT_WORKFLOW_ID`
   - `DIDIT_WEBHOOK_SECRET`  
   If `DIDIT_API_KEY` or `DIDIT_WORKFLOW_ID` is missing, the function returns **503** and the message will say **"Didit not configured"**.

3. **Check Edge Function logs**  
   In Supabase Dashboard → **Edge Functions** → **create-verification-session** → **Logs**, look at the run when you click Start verification. You’ll see either:
   - "DIDIT_API_KEY or DIDIT_WORKFLOW_ID not set", or  
   - The exact error from Didit’s API (e.g. invalid key, wrong workflow ID).

4. **Redeploy after changing secrets**  
   After adding or changing secrets, redeploy so the function picks them up:
   ```bash
   supabase functions deploy create-verification-session
   ```

---

## Quick reference

| Item | Where to get it / set it |
|------|---------------------------|
| Didit API Key | Didit Console → API & Webhooks |
| Didit Webhook Secret | Didit Console → API & Webhooks |
| Didit Workflow ID | Didit Console → Workflows → your workflow (UUID) |
| Webhook URL | Didit Console → API & Webhooks → set to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/didit-webhook` |
| Supabase project ref | Supabase Dashboard → Project Settings → General → Reference ID |
| Supabase secrets | Supabase Dashboard → Project Settings → Edge Functions → Secrets |

---

## Flow summary (for reference)

1. User clicks **Verify identity** on Profile → app calls `create-verification-session` (with user JWT).
2. Edge function calls Didit `POST /v3/session/` with `workflow_id`, `vendor_data` (user id), and `callback` URL, then returns the session URL.
3. App redirects the user to that URL; user completes ID + selfie on Didit.
4. Didit redirects the user back to your callback (e.g. `/profile?verification=done`).
5. Didit sends a webhook to `didit-webhook` with `status` (e.g. Approved, Declined) and `vendor_data` (user id).
6. The Edge Function updates `profiles`: `identity_verification_status` = `verified` or `rejected`, and `is_verified` = true when status is Approved.

---

## Optional: admin queue

- The admin **ID Verification** queue in your app can still be used for manual overrides.
- Admins can change `identity_verification_status` in User Management if needed.
