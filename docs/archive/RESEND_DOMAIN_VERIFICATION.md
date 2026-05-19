# Resend Domain Verification Guide

## Why Domain Verification is Required

Resend requires domain verification to send emails from your custom domain (e.g., `noreply@marryzen.com`). Without verification, you can only send from Resend's test domain (`onboarding@resend.dev`), which has limitations and is not suitable for production.

## Current Configuration

Your Edge Functions are configured to send from:
- **Default**: `noreply@marryzen.com` (from `RESEND_FROM_EMAIL` environment variable)
- **Fallback**: `noreply@marryzen.com` (hardcoded in the function)

## Steps to Verify Your Domain

### 1. Log in to Resend Dashboard
- Go to [https://resend.com](https://resend.com)
- Log in to your account
- Navigate to **Domains** in the sidebar

### 2. Add Your Domain
- Click **Add Domain**
- Enter your domain: `marryzen.com`
- Click **Add**

### 3. Add DNS Records
Resend will provide you with DNS records to add. You'll need to add these to your domain's DNS settings:

#### Required Records - 3 TXT Records:

**IMPORTANT**: Resend will give you the EXACT values to use. You need to add **3 TXT records** total.

1. **DKIM Record** (TXT record - for Domain Verification)
   - **Type**: `TXT`
   - **Name/Host**: `resend._domainkey` (Resend will provide exact name)
   - **Value/Content**: Long string starting with `p=MIGfMA0GCSqGSIb3DQEB...` (Resend provides the full public key)
   - **TTL**: `Auto` or `3600` (default is fine)

2. **SPF Record** (TXT record - for Enable Sending)
   - **Type**: `TXT`
   - **Name/Host**: `@` or `send` (Resend will specify - usually `@` for root domain)
   - **Value/Content**: `v=spf1 include:resend.com ~all` (Resend will provide exact value)
   - **TTL**: `3600` (or default)

3. **DMARC Record** (TXT record - Optional but recommended)
   - **Type**: `TXT`
   - **Name/Host**: `_dmarc`
   - **Value/Content**: `v=DMARC1; p=none;` (or `v=DMARC1; p=none; rua=mailto:dmarc@marryzen.com`)
   - **TTL**: `Auto` or `3600` (default is fine)

**Note**: Some email services use CNAME records for DKIM, but Resend typically uses TXT records. If Resend shows CNAME records instead, use those.

#### What Resend Will Show You:

When you add your domain in Resend, you'll see **3 TXT records** to add:

```
Domain: marryzen.com

Add these DNS records:

1. TXT Record (DKIM - Domain Verification)
   Name: resend._domainkey
   Content: p=MIGfMA0GCSqGSIb3DQEB... (long public key string)

2. TXT Record (SPF - Enable Sending)
   Name: @
   Content: v=spf1 include:resend.com ~all

3. TXT Record (DMARC - Optional)
   Name: _dmarc
   Content: v=DMARC1; p=none;
```

**Copy these EXACT values from Resend** - they are unique to your account!

**Summary**: You need to add **3 TXT records** in Hostinger:
- ✅ 1 DKIM record (for verification)
- ✅ 1 SPF record (for sending)
- ✅ 1 DMARC record (recommended)

### 4. Where to Add DNS Records

The location depends on where your domain is registered:

- **Hostinger**: DNS / Nameservers → DNS Zone Editor → Add Record
- **Cloudflare**: DNS → Records → Add record
- **GoDaddy**: DNS Management → Add
- **Namecheap**: Advanced DNS → Add New Record
- **AWS Route 53**: Hosted zones → Create record
- **Google Domains**: DNS → Custom records

#### For Hostinger (Your Setup):

1. **Log in to Hostinger**:
   - Go to [hpanel.hostinger.com](https://hpanel.hostinger.com)
   - Log in with your account

2. **Navigate to DNS Settings**:
   - Click on **Domains** in the left sidebar
   - Find `marryzen.com` and click on it
   - Go to **DNS / Nameservers** tab
   - Click on **DNS Zone Editor** or **Manage DNS Records**

3. **Add the DNS Records**:
   - You'll add the records that Resend provides (see below)
   - Click **Add Record** for each one

#### Hostinger-Specific Instructions:

**Step-by-step for Hostinger DNS Zone Editor:**

1. In Hostinger, go to **DNS Zone Editor**
2. You'll see existing records (A, CNAME, MX, etc.)
3. Click **Add Record** button
4. For each of the **3 TXT records** from Resend:
   - **Select Type**: Choose `TXT`
   - **Name**: Enter the name exactly as Resend shows:
     - `resend._domainkey` (for DKIM)
     - `@` (for SPF - or leave blank if Hostinger doesn't accept `@`)
     - `_dmarc` (for DMARC)
   - **Value/Content**: Paste the exact value from Resend (the long string)
   - **TTL**: Leave as default (usually 3600 or Auto)
   - Click **Add Record** or **Save**
5. Repeat for all **3 TXT records** (DKIM, SPF, DMARC)

**Important Notes for Hostinger:**
- If Hostinger asks for "Host" instead of "Name", use the same value
- For the root domain (`@`), some interfaces use `@`, others use blank, or `marryzen.com` - try `@` first
- Don't add `marryzen.com` to the name if it's already implied (Hostinger usually handles this)
- Wait a few minutes after adding, then check Resend dashboard for verification status

### 5. Wait for Verification
- DNS propagation can take 24-48 hours (usually faster)
- Resend will automatically verify once DNS records are detected
- Check the status in the Resend dashboard

### 6. Verify Domain Status
- In Resend dashboard, check that your domain shows as **Verified** (green checkmark)
- Once verified, you can send from any email address on that domain

## Testing After Verification

Once your domain is verified, test the email functionality:

1. **Test via Edge Function**:
   ```javascript
   // In browser console or test script
   const { data, error } = await supabase.functions.invoke('send-notification-email', {
     body: {
       notification_id: 'test-id',
       user_id: 'your-user-id',
       type: 'new_match',
       title: 'Test Email',
       body: 'This is a test email to verify domain setup'
     }
   });
   ```

2. **Check Email Delivery**:
   - Check your inbox (and spam folder)
   - Verify the "From" address shows `noreply@marryzen.com`
   - Check that emails are not marked as spam

## Environment Variables

Make sure these are set in your Supabase project:

1. Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Environment Variables**
2. Set:
   - `RESEND_API_KEY`: Your Resend API key
   - `RESEND_FROM_EMAIL`: `noreply@marryzen.com` (or your preferred address)

## Alternative: Use Resend Test Domain (Temporary)

If you need to test before domain verification:

1. Change `RESEND_FROM_EMAIL` to `onboarding@resend.dev`
2. Note: This has limitations:
   - Limited to 100 emails/day
   - Emails may be marked as spam
   - Not suitable for production

## Troubleshooting

### Domain Not Verifying
- **Check DNS propagation**: Use [dnschecker.org](https://dnschecker.org) to verify records are propagated globally
- **Wait longer**: DNS can take up to 48 hours
- **Verify record format**: Ensure no extra spaces or quotes in DNS records
- **Check Resend dashboard**: Look for specific error messages

### Emails Not Sending
- **Check API key**: Verify `RESEND_API_KEY` is correct
- **Check domain status**: Ensure domain shows as verified
- **Check Resend logs**: View logs in Resend dashboard for error details
- **Check Edge Function logs**: View logs in Supabase dashboard

### Emails Going to Spam
- **Verify SPF/DKIM records**: These help with deliverability
- **Add DMARC record**: Improves email reputation
- **Warm up domain**: Start with low volume and gradually increase
- **Check email content**: Avoid spam trigger words

## Important Notes

- ⚠️ **Domain verification is required for production use**
- ⚠️ **Without verification, emails may not send or may be blocked**
- ✅ **Once verified, you can send from any `@marryzen.com` address**
- ✅ **Verification is a one-time process per domain**

## Next Steps

1. Add your domain to Resend
2. Add DNS records to your domain provider
3. Wait for verification (check Resend dashboard)
4. Test email sending
5. Monitor email delivery and spam rates

## Common Issues

### Multiple SPF Records

If you have multiple email services (e.g., Amazon SES and Resend), you have two options:

**Option 1: Separate SPF Records (Recommended)**
- Keep your existing SPF record for Amazon SES at `send` subdomain
- Add a new SPF record for Resend at root domain (`@`):
  - **Type**: `TXT`
  - **Name**: `@` (or leave blank)
  - **Value**: `v=spf1 include:resend.com ~all`

**Option 2: Combined SPF Record**
- If you want one SPF record for both services, combine them:
  - **Type**: `TXT`
  - **Name**: `@`
  - **Value**: `v=spf1 include:amazonses.com include:resend.com ~all`

**Important**: You can only have ONE SPF record per domain/subdomain. If you have an SPF at `@` already, you need to combine services in that record, not create multiple records.

### Checking Your Current Setup

Based on your DNS records:
- ✅ DKIM (`resend._domainkey`) - Correct
- ✅ DMARC (`_dmarc`) - Correct
- ⚠️ SPF - You have one for `send` subdomain (Amazon SES), but need one for root domain (`@`) for Resend

**Action Required**: Add a TXT record:
- **Type**: `TXT`
- **Name**: `@` (root domain)
- **Value**: `v=spf1 include:resend.com ~all`
- **TTL**: `3600` (or default)

This won't conflict with your `send` subdomain SPF record since they're at different levels.
