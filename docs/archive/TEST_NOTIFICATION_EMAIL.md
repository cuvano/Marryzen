# Test Notification Email Feature

Since your domain is verified on Resend, you can now test the notification email feature.

## Method 1: Browser Console Test (Easiest)

1. **Open your app** in the browser (logged in as a user)
2. **Open Browser Console** (F12 or Right-click → Inspect → Console)
3. **Paste and run this script**:

```javascript
// Test Notification Email Script
(async () => {
  try {
    // Import Supabase client (adjust path if needed)
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    
    // Get your Supabase URL and anon key from your app
    // You can find these in your Supabase dashboard → Settings → API
    const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Replace with your URL
    const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your anon key
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ Not logged in. Please log in first.');
      return;
    }
    
    console.log('✅ User found:', user.email);
    
    // Create a test notification
    console.log('📧 Creating test notification...');
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'new_match',
        title: 'Test Email Notification 🧪',
        body: 'This is a test email to verify that your Resend domain is working correctly. If you receive this email, your notification system is set up properly!',
        metadata: { test: true }
      })
      .select()
      .single();
    
    if (notifError) {
      console.error('❌ Error creating notification:', notifError);
      return;
    }
    
    console.log('✅ Notification created:', notification.id);
    
    // Trigger email sending via Edge Function
    console.log('📤 Sending email via Edge Function...');
    const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-notification-email', {
      body: {
        notification_id: notification.id,
        user_id: user.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        metadata: notification.metadata || {}
      }
    });
    
    if (emailError) {
      console.error('❌ Error sending email:', emailError);
      return;
    }
    
    console.log('✅ Email sent successfully!', emailResult);
    console.log('📬 Check your inbox:', user.email);
    console.log('📬 Also check spam folder if not in inbox');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
})();
```

**Before running**: Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` with your actual values from Supabase dashboard.

## Method 2: Using the Notification Utility (From Your App Code)

If you're testing from within your React app, you can use the notification utility:

```javascript
import { createNotification } from '@/lib/notifications';

// In your component or test function
const testEmail = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  await createNotification({
    user_id: user.id,
    type: 'new_match',
    title: 'Test Email Notification 🧪',
    body: 'This is a test email to verify your notification system!',
    metadata: { test: true }
  });
  
  console.log('Test notification created and email sent!');
};
```

## Method 3: Test Different Notification Types

You can test all notification types:

```javascript
// Test different notification types
const testTypes = [
  {
    type: 'new_match',
    title: 'New Match! 🎉',
    body: 'You have a new match! Start a conversation.'
  },
  {
    type: 'new_message',
    title: 'New Message',
    body: 'You received a new message from someone.'
  },
  {
    type: 'profile_approved',
    title: 'Profile Approved! ✅',
    body: 'Your profile has been approved.'
  },
  {
    type: 'referral_reward',
    title: 'Referral Reward Earned! 🎁',
    body: 'You earned a reward for referring a friend!'
  }
];

// Test each type
for (const test of testTypes) {
  await createNotification({
    user_id: user.id,
    ...test,
    metadata: { test: true }
  });
  console.log(`✅ Sent ${test.type} notification`);
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between emails
}
```

## Method 4: Direct Edge Function Test (Advanced)

You can also test the Edge Function directly:

```javascript
// Direct Edge Function test
const { data, error } = await supabase.functions.invoke('send-notification-email', {
  body: {
    notification_id: 'existing-notification-id', // Use an existing notification ID
    user_id: 'your-user-id',
    type: 'new_match',
    title: 'Direct Test',
    body: 'Testing Edge Function directly',
    metadata: {}
  }
});

console.log('Result:', data, error);
```

## What to Check After Testing

1. **Check Your Email Inbox**:
   - Look for email from `noreply@marryzen.com`
   - Check spam folder if not in inbox
   - Verify the email content is correct

2. **Check Browser Console**:
   - Look for success messages
   - Check for any error messages

3. **Check Supabase Dashboard**:
   - Go to **Edge Functions** → **send-notification-email** → **Logs**
   - Look for successful email sends or errors

4. **Check Resend Dashboard**:
   - Go to [resend.com](https://resend.com) → **Logs**
   - Verify emails were sent successfully
   - Check delivery status

5. **Check Database**:
   - Go to **Table Editor** → **notifications**
   - Verify `email_sent` is `true`
   - Check `email_sent_at` timestamp

## Troubleshooting

### Email Not Received
- **Check spam folder**: New domains often go to spam initially
- **Check Resend logs**: See if email was sent
- **Check Edge Function logs**: See if there were errors
- **Verify email address**: Make sure user email is correct in database

### Edge Function Error
- **Check environment variables**: Ensure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set
- **Check domain status**: Verify domain is still verified in Resend
- **Check API key**: Ensure Resend API key is valid

### Email Sent But Not Delivered
- **Check Resend logs**: See delivery status
- **Check spam folder**: Emails might be filtered
- **Verify SPF/DKIM**: Ensure DNS records are correct
- **Wait a bit**: Sometimes emails are delayed

## Expected Results

✅ **Success**: You should see:
- Console log: "Email sent successfully!"
- Email in your inbox from `noreply@marryzen.com`
- `email_sent: true` in notifications table
- Successful log entry in Resend dashboard

❌ **Failure**: If you see errors:
- Check console for error messages
- Check Edge Function logs in Supabase
- Verify all environment variables are set
- Ensure domain is verified in Resend
