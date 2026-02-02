# How to Set RESEND_FROM_EMAIL Environment Variable

## Step 1: Set Environment Variable in Supabase

1. **Go to Supabase Dashboard**
   - Navigate to: [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project

2. **Go to Edge Functions Settings**
   - Click on **Project Settings** (gear icon in sidebar)
   - Click on **Edge Functions** in the left menu
   - Scroll down to **Environment Variables** section

3. **Add/Update RESEND_FROM_EMAIL**
   - Click **Add new secret** or find existing `RESEND_FROM_EMAIL`
   - **Name**: `RESEND_FROM_EMAIL`
   - **Value**: `noreply@marryzen.com`
   - Click **Save**

4. **Redeploy Edge Function** (Important!)
   - After setting the environment variable, you need to redeploy the function
   - Go to **Edge Functions** → **send-notification-email**
   - Click **Redeploy** or **Deploy** button
   - Or use Supabase CLI: `supabase functions deploy send-notification-email`

## Step 2: Verify SPF Record in Resend

If Resend isn't showing your SPF record:

### Option A: Refresh DNS Check in Resend

1. Go to [resend.com/domains](https://resend.com/domains)
2. Click on `marryzen.com`
3. Look for a **"Refresh"** or **"Re-check DNS"** button
4. Click it to force Resend to check DNS again

### Option B: Check DNS Propagation

1. Go to [dnschecker.org](https://dnschecker.org)
2. Select **TXT** record type
3. Enter: `marryzen.com`
4. Click **Search**
5. Look for the record: `v=spf1 include:resend.com ~all`
6. Check if it's propagated globally (should show green checkmarks)

### Option C: Verify Record Format in Hostinger

Make sure the record in Hostinger is exactly:
- **Type**: `TXT`
- **Name**: `@` (or blank if Hostinger doesn't accept `@`)
- **Value**: `v=spf1 include:resend.com ~all` (no quotes, no extra spaces)
- **TTL**: `3600` or default

## Step 3: Wait for DNS Propagation

- DNS can take 5-30 minutes (usually)
- Sometimes up to 48 hours
- After adding, wait at least 10-15 minutes before checking Resend again

## Step 4: Check Resend Dashboard Again

After waiting:
1. Go back to Resend dashboard → `marryzen.com`
2. Check "Enable Sending" section
3. You should see a new entry for SPF at root domain (`@`)
4. It should show as **Verified** (green checkmark)

## Troubleshooting: Resend Still Not Showing SPF

### Issue 1: Record Not Propagated Yet
- **Solution**: Wait longer (up to 1 hour)
- Check dnschecker.org to confirm it's live

### Issue 2: Wrong Record Format
- **Solution**: Double-check the value in Hostinger
- Should be: `v=spf1 include:resend.com ~all`
- No quotes, no extra spaces

### Issue 3: Resend Needs Manual Refresh
- **Solution**: Look for "Refresh DNS" or "Re-check" button in Resend
- Or try removing and re-adding the domain (last resort)

### Issue 4: Multiple SPF Records Conflict
- **Solution**: You can have multiple SPF records at different levels:
  - `@` → for Resend
  - `send` → for Amazon SES
  - They don't conflict

## Current Configuration

Your Edge Function is configured to use:
```javascript
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@marryzen.com'
```

So if `RESEND_FROM_EMAIL` is not set, it defaults to `noreply@marryzen.com`.

## Verify Environment Variable is Set

After setting it in Supabase:
1. Go to Edge Functions → **send-notification-email** → **Logs**
2. The function should log the `FROM_EMAIL` value (check console logs)
3. Or test by sending an email and checking the "From" address

## Quick Checklist

- [ ] Set `RESEND_FROM_EMAIL` in Supabase Edge Functions environment variables
- [ ] Set value to: `noreply@marryzen.com`
- [ ] Redeploy the Edge Function
- [ ] Wait 10-30 minutes for DNS propagation
- [ ] Check dnschecker.org to verify SPF record is live
- [ ] Refresh DNS check in Resend dashboard
- [ ] Verify SPF shows as "Verified" in Resend
- [ ] Test email sending again
