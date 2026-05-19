# Fix: No Email When Profile Status Changed to Suspended

## Problem
When you change a profile status to "suspended" in the admin panel, no email is sent.

## Solution: Update Database Trigger

The database trigger needs to be updated to include the `suspended` status. You need to run this SQL in your Supabase database.

### Step 1: Run This SQL in Supabase

Go to **Supabase Dashboard** → **SQL Editor** → **New Query** and run:

```sql
-- Update the function to include suspended and banned statuses
CREATE OR REPLACE FUNCTION notify_profile_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  IF NEW.status = 'approved' THEN
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      NEW.id,
      'profile_approved',
      'Profile Approved! ✅',
      'Great news! Your profile has been approved. You can now start matching and messaging.',
      jsonb_build_object('profile_id', NEW.id)
    );
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      NEW.id,
      'profile_rejected',
      'Profile Update Required',
      'Your profile needs some updates. Please review and resubmit for approval.',
      jsonb_build_object('profile_id', NEW.id)
    );
  ELSIF NEW.status = 'suspended' THEN
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      NEW.id,
      'profile_suspended',
      'Profile Suspended ⚠️',
      'Your profile has been temporarily suspended. Please contact support for assistance.',
      jsonb_build_object('profile_id', NEW.id)
    );
  ELSIF NEW.status = 'banned' THEN
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      NEW.id,
      'profile_banned',
      'Account Banned 🚫',
      'Your account has been banned. Please contact support if you believe this is an error.',
      jsonb_build_object('profile_id', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 2: Verify the Trigger Exists

Run this to check if the trigger is active:

```sql
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_notify_profile_status';
```

You should see the trigger listed.

### Step 3: Redeploy Edge Function

After updating the database trigger:

1. Go to **Supabase Dashboard** → **Edge Functions** → **send-notification-email**
2. Click **Redeploy** or **Deploy**
3. Wait for deployment to complete

### Step 4: Test Again

1. Change a profile status to "suspended" in the admin panel
2. Check if notification is created in `notifications` table
3. Check if email is sent (check Resend logs or user's inbox)

## Troubleshooting

### Issue 1: Trigger Not Firing

**Check if trigger exists:**
```sql
SELECT * FROM information_schema.triggers 
WHERE event_object_table = 'profiles';
```

**If trigger doesn't exist, create it:**
```sql
DROP TRIGGER IF EXISTS trigger_notify_profile_status ON profiles;
CREATE TRIGGER trigger_notify_profile_status
AFTER UPDATE OF status ON profiles
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_profile_status_change();
```

### Issue 2: Notification Created But No Email

**Check notifications table:**
```sql
SELECT * FROM notifications 
WHERE type = 'profile_suspended' 
ORDER BY created_at DESC 
LIMIT 5;
```

**Check if email_sent is true:**
```sql
SELECT id, type, title, email_sent, email_sent_at 
FROM notifications 
WHERE type = 'profile_suspended' 
ORDER BY created_at DESC 
LIMIT 5;
```

**Check Edge Function logs:**
- Go to **Supabase Dashboard** → **Edge Functions** → **send-notification-email** → **Logs**
- Look for errors or success messages

### Issue 3: Edge Function Not Updated

**Verify Edge Function handles profile_suspended:**
- Check that `profile_suspended` is in the `typeEnabled` mapping
- Check that it's included in the email template switch statement

### Issue 4: User Email Preferences

**Check if user has email notifications disabled:**
```sql
SELECT user_id, notification_settings 
FROM user_preferences 
WHERE user_id = 'USER_ID_HERE';
```

The `notification_settings.email_profile` should be `true` for profile status emails.

## Quick Test

After running the SQL update, test by:

1. **Manually create a notification:**
```sql
INSERT INTO notifications (user_id, type, title, body, metadata)
VALUES (
  'USER_ID_HERE',
  'profile_suspended',
  'Profile Suspended ⚠️',
  'Your profile has been temporarily suspended. Please contact support for assistance.',
  jsonb_build_object('profile_id', 'USER_ID_HERE')
);
```

2. **Check if email is sent:**
- Check `notifications` table for `email_sent = true`
- Check user's inbox
- Check Resend logs

## Summary

**To fix:**
1. ✅ Run the SQL to update the trigger function
2. ✅ Verify trigger exists
3. ✅ Redeploy Edge Function
4. ✅ Test by changing status to suspended
5. ✅ Check notifications table and email delivery
