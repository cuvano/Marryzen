# Fix: Email Sending from onboarding@resend.dev Instead of noreply@marryzen.com

## Problem

The Resend API log shows emails are being sent from `onboarding@resend.dev` instead of `noreply@marryzen.com`. This means the `RESEND_FROM_EMAIL` environment variable is either:
- Not set in Supabase
- Set to the wrong value (`onboarding@resend.dev`)
- The Edge Function wasn't redeployed after setting it

## Solution: Set RESEND_FROM_EMAIL Correctly

### Step 1: Check Current Environment Variable

1. Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions**
2. Scroll to **Environment Variables** section
3. Look for `RESEND_FROM_EMAIL`
4. Check what value it's set to

### Step 2: Set/Update RESEND_FROM_EMAIL

1. In the **Environment Variables** section:
   - If `RESEND_FROM_EMAIL` exists: Click **Edit**
   - If it doesn't exist: Click **Add new secret**

2. Set the value:
   - **Name**: `RESEND_FROM_EMAIL`
   - **Value**: `noreply@marryzen.com` (NOT `onboarding@resend.dev`)
   - Click **Save**

### Step 3: Redeploy Edge Function (CRITICAL!)

After setting the environment variable, you MUST redeploy the function:

**Option A: Via Supabase Dashboard**
1. Go to **Edge Functions** in the sidebar
2. Click on **send-notification-email**
3. Click **Redeploy** or **Deploy** button
4. Wait for deployment to complete

**Option B: Via Supabase CLI**
```bash
supabase functions deploy send-notification-email
```

### Step 4: Verify It's Working

1. Run your test script again
2. Check the Resend API logs
3. The "from" address should now be `noreply@marryzen.com`

## Why This Happened

The Edge Function code has this fallback:
```javascript
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@marryzen.com'
```

If `RESEND_FROM_EMAIL` is not set, it defaults to `noreply@marryzen.com`. But the log shows `onboarding@resend.dev`, which means:
- Either the environment variable is explicitly set to `onboarding@resend.dev` (wrong)
- Or there's a cached/old deployment

## Quick Checklist

- [ ] Go to Supabase Dashboard → Edge Functions → Environment Variables
- [ ] Check if `RESEND_FROM_EMAIL` exists
- [ ] If it exists and is `onboarding@resend.dev`, change it to `noreply@marryzen.com`
- [ ] If it doesn't exist, add it with value `noreply@marryzen.com`
- [ ] **IMPORTANT**: Redeploy the Edge Function
- [ ] Test again and verify "from" address is `noreply@marryzen.com`

## After Fixing

Once you've:
1. Set `RESEND_FROM_EMAIL` = `noreply@marryzen.com`
2. Redeployed the function
3. Verified SPF record is added and propagated

The email should:
- Send from `noreply@marryzen.com` ✅
- Work with your verified domain ✅
- Send to any recipient (not just your own email) ✅
