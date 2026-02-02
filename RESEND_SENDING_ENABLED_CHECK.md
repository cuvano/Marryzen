# Resend "Enable Sending" Not Working - Troubleshooting

## The Problem

You're getting this error:
> "You can only send testing emails to your own email address (believerfellow@gmail.com). To send emails to other recipients, please verify a domain..."

Even though your domain is verified, Resend is still in "testing mode".

## Solution Steps

### Step 1: Check "Enable Sending" Status

1. Go to [resend.com/domains](https://resend.com/domains)
2. Click on `marryzen.com`
3. Look for the **"Enable Sending"** section
4. Check if the toggle is **ON (green)**

### Step 2: Verify All DNS Records Are Correct

In the Resend dashboard, check that ALL records show as **Verified**:

1. **Domain Verification (DKIM)**
   - Should show: ✅ Verified
   - Record: `resend._domainkey` (TXT)

2. **Enable Sending (SPF)**
   - Should show: ✅ Verified
   - You need BOTH:
     - MX record at `send` subdomain (if shown)
     - TXT record at `@` or `send` with `v=spf1 include:resend.com ~all`

3. **DMARC** (Optional but recommended)
   - Should show: ✅ Verified
   - Record: `_dmarc` (TXT)

### Step 3: Check Account Status

1. Go to Resend Dashboard → **Settings** → **Account**
2. Check if there's a message about:
   - Account verification required
   - Billing/payment required
   - Testing mode restrictions

### Step 4: Verify SPF Record is at Root Domain

The error suggests the SPF record might not be correct. Check:

1. In Hostinger DNS, you should have:
   - **TXT record** at `@` (root domain) with value: `v=spf1 include:resend.com ~all`
   - NOT just at `send` subdomain

2. Verify in Resend dashboard that it shows the SPF record as verified

### Step 5: Wait for DNS Propagation

If you just added the SPF record:
- Wait 5-30 minutes for DNS to propagate
- Check Resend dashboard again
- Use [dnschecker.org](https://dnschecker.org) to verify the SPF record is live globally

### Step 6: Check Resend Logs

1. Go to Resend Dashboard → **Logs**
2. Look for the failed email attempt
3. Check the error details - it might give more specific information

## Common Issues

### Issue 1: SPF Record Missing at Root Domain

**Problem**: You have SPF at `send` subdomain but not at root `@`

**Solution**: Add SPF TXT record at root domain (`@`) in Hostinger:
- Type: `TXT`
- Name: `@` (or leave blank)
- Value: `v=spf1 include:resend.com ~all`

### Issue 2: Account in Testing Mode

**Problem**: Resend free tier might have restrictions

**Solution**: 
- Check if you need to verify your Resend account email
- Check if you need to add a payment method
- Check Resend dashboard for any account warnings

### Issue 3: Domain Not Fully Verified for Sending

**Problem**: Domain is verified for DKIM but not for sending

**Solution**:
- Make sure "Enable Sending" toggle is ON
- Verify SPF record is correct and verified
- Wait for Resend to re-check DNS records

## Quick Test

To test if sending is enabled, try sending to your own verified email first:

1. Use the test script but change the recipient to `believerfellow@gmail.com`
2. If that works, then sending is enabled but there might be a recipient restriction
3. If that doesn't work, then "Enable Sending" isn't fully enabled

## What to Check in Resend Dashboard

When you go to `resend.com/domains` → `marryzen.com`, you should see:

```
✅ Domain Verification
   DKIM: Verified (green checkmark)

✅ Enable Sending (Toggle should be ON/green)
   SPF: Verified (green checkmark)
   [If shown] MX: Verified (green checkmark)

✅ DMARC (Optional)
   DMARC: Verified (green checkmark)
```

If any of these show as "Not Verified" or the toggle is OFF, that's the issue.

## Still Not Working?

If after checking all the above it still doesn't work:

1. **Contact Resend Support**: They can check your account status
2. **Check Billing**: Some features require a paid plan
3. **Verify Email**: Make sure your Resend account email is verified
4. **Check API Key**: Make sure you're using the correct API key (not a test key)

## Next Steps

1. ✅ Check "Enable Sending" toggle in Resend dashboard
2. ✅ Verify SPF record is at root domain (`@`)
3. ✅ Check all DNS records show as verified
4. ✅ Wait for DNS propagation if you just added records
5. ✅ Test again
