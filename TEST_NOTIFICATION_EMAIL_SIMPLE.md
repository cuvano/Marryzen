# Simple Test Notification Email (Browser Console)

## Method 1: Direct Supabase Client (No CDN - Works!)

This script creates the Supabase client directly without CDN imports:

```javascript
// Copy and paste this ENTIRE script into browser console
(async () => {
  try {
    // Create Supabase client directly (no CDN import needed)
    const SUPABASE_URL = 'https://adufstvmmzpqdcmpinqd.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdWZzdHZtbXpwcWRjbXBpbnFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NTI3MTEsImV4cCI6MjA4MTQyODcxMX0.AtKLJ-33Oivu9DSbzKLd19O-fOPOeTtkwg9BD_vF4-w';
    
    // Use fetch to create Supabase client (works in browser)
    const supabase = {
      auth: {
        getUser: async () => {
          const token = localStorage.getItem('sb-adufstvmmzpqdcmpinqd-auth-token') || 
                        JSON.parse(localStorage.getItem('sb-adufstvmmzpqdcmpinqd-auth-token') || '{}').access_token;
          const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY }
          });
          return response.json();
        }
      },
      from: (table) => ({
        insert: (data) => ({
          select: () => ({
            single: async () => {
              const token = localStorage.getItem('sb-adufstvmmzpqdcmpinqd-auth-token') || 
                            JSON.parse(localStorage.getItem('sb-adufstvmmzpqdcmpinqd-auth-token') || '{}').access_token;
              const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                  'apikey': SUPABASE_ANON_KEY,
                  'Prefer': 'return=representation'
                },
                body: JSON.stringify(data)
              });
              const result = await response.json();
              return { data: Array.isArray(result) ? result[0] : result, error: response.ok ? null : result };
            }
          })
        })
      }),
      functions: {
        invoke: async (name, options) => {
          const token = localStorage.getItem('sb-adufstvmmzpqdcmpinqd-auth-token') || 
                        JSON.parse(localStorage.getItem('sb-adufstvmmzpqdcmpinqd-auth-token') || '{}').access_token;
          const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify(options.body)
          });
          const result = await response.json();
          return { data: result, error: response.ok ? null : result };
        }
      }
    };
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ Please log in first');
      console.log('💡 Make sure you are logged into the app');
      return;
    }
    
    console.log('✅ User found:', user.email);
    
    // Create test notification
    console.log('📧 Creating notification...');
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'new_match',
        title: 'Test Email Notification 🧪',
        body: 'This is a test email to verify your Resend domain setup! If you receive this, everything is working!',
        metadata: { test: true }
      })
      .select()
      .single();
    
    if (notifError) {
      console.error('❌ Error creating notification:', notifError);
      return;
    }
    
    console.log('✅ Notification created:', notification.id);
    
    // Send email via Edge Function
    console.log('📤 Sending email...');
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
      console.error('❌ Email error:', emailError);
      return;
    }
    
    console.log('✅ SUCCESS! Email sent:', emailResult);
    console.log('📬 Check your inbox:', user.email);
    console.log('📬 Also check spam folder');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
})();
```

**Actually, even simpler - use this approach:**

## Method 2: If Supabase is Not Available Globally

If `supabase` is not available in the console, you can access it from the React app:

```javascript
// Access Supabase from window object (if exposed)
// Or use React DevTools to access component state

// Option A: If you expose it globally in your app
const supabase = window.supabase || window.__SUPABASE__;

// Option B: Access from React component
// Open React DevTools, select a component, and in console type:
// $r.props.supabase or $r.context.supabaseClient

// Then use Method 1 script above
```

## Method 3: Create a Test Button in Your App (Recommended)

Add this to any page temporarily for testing:

```javascript
// Add to any component (e.g., DashboardPage.jsx temporarily)
const testEmail = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('Please log in');
    return;
  }
  
  try {
    // Create notification
    const { data: notification } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'new_match',
        title: 'Test Email 🧪',
        body: 'Testing Resend email notifications!',
        metadata: { test: true }
      })
      .select()
      .single();
    
    // Send email
    const { data, error } = await supabase.functions.invoke('send-notification-email', {
      body: {
        notification_id: notification.id,
        user_id: user.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        metadata: notification.metadata
      }
    });
    
    if (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    } else {
      alert('✅ Test email sent! Check: ' + user.email);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
  }
};

// Add button in JSX:
<Button onClick={testEmail}>Test Email Notification</Button>
```

## Method 4: Use the Notification Utility Function

If you can import the notification utility:

```javascript
// In browser console (if you can access modules)
// Or add this to a component

import { createNotification } from '@/lib/notifications';

const testEmail = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  await createNotification({
    user_id: user.id,
    type: 'new_match',
    title: 'Test Email 🧪',
    body: 'Testing notification emails!',
    metadata: { test: true }
  });
  
  console.log('✅ Test notification created and email sent!');
};
```

## Quick Check: Is Supabase Available?

Run this first to check:

```javascript
// Check if supabase is available
if (typeof supabase !== 'undefined') {
  console.log('✅ Supabase is available!');
  console.log('You can use Method 1');
} else {
  console.log('❌ Supabase not available globally');
  console.log('Try Method 2 or 3');
}
```

## What to Check After Running

1. **Browser Console**: Look for success/error messages
2. **Email Inbox**: Check for email from `noreply@marryzen.com`
3. **Spam Folder**: New domains often go to spam initially
4. **Supabase Logs**: Edge Functions → send-notification-email → Logs
5. **Resend Dashboard**: Check logs at resend.com

## Troubleshooting

### "supabase is not defined"
- Use Method 3 (add test button to your app)
- Or expose Supabase globally in your app temporarily

### "Failed to bundle using Rollup"
- Don't use CDN imports in browser console
- Use the Supabase client that's already in your app

### Email Not Received
- Check spam folder
- Verify environment variables in Supabase
- Check Edge Function logs
- Check Resend dashboard logs
