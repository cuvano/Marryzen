// TEST NOTIFICATION EMAIL - Browser Console Script
// Copy and paste this ENTIRE script into your browser console (while logged into your app)

(async () => {
  try {
    // Supabase configuration (from your codebase)
    const SUPABASE_URL = 'https://adufstvmmzpqdcmpinqd.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdWZzdHZtbXpwcWRjbXBpbnFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NTI3MTEsImV4cCI6MjA4MTQyODcxMX0.AtKLJ-33Oivu9DSbzKLd19O-fOPOeTtkwg9BD_vF4-w';
    
    // Get auth token from localStorage
    const getAuthToken = () => {
      // Try different possible storage keys
      const keys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('auth'));
      console.log('🔍 Checking localStorage keys:', keys);
      
      for (const key of keys) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const parsed = JSON.parse(item);
            if (parsed.access_token) {
              console.log('✅ Found token in:', key);
              return parsed.access_token;
            }
            if (parsed.session?.access_token) {
              console.log('✅ Found token in session:', key);
              return parsed.session.access_token;
            }
            // Try nested structures
            if (parsed.currentSession?.access_token) {
              console.log('✅ Found token in currentSession:', key);
              return parsed.currentSession.access_token;
            }
          }
        } catch (e) {
          console.log('⚠️  Error parsing', key, e);
        }
      }
      return null;
    };
    
    const token = getAuthToken();
    if (!token) {
      console.error('❌ Not logged in. Please log into the app first.');
      console.log('💡 Make sure you are logged in to the app in this browser tab');
      return;
    }
    
    console.log('✅ Auth token found');
    
    // Get current user
    console.log('🔍 Getting current user...');
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });
    
    if (!userResponse.ok) {
      const errorData = await userResponse.json();
      console.error('❌ Failed to get user:', errorData);
      console.log('💡 Try logging out and logging back in');
      return;
    }
    
    const userData = await userResponse.json();
    console.log('📋 User response:', userData);
    
    const user = userData.user || userData;
    
    if (!user || !user.id) {
      console.error('❌ User data not found in response');
      console.log('💡 Full response:', userData);
      return;
    }
    
    if (!user.email) {
      console.error('❌ User email not found');
      console.log('💡 User object:', user);
      // Try to get email from auth metadata or use a test email
      console.log('⚠️  Continuing with user ID:', user.id);
    } else {
      console.log('✅ User found:', user.email);
    }
    
    // Create test notification
    console.log('📧 Creating notification...');
    const notifResponse = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_id: user.id,
        type: 'new_match',
        title: 'Test Email Notification 🧪',
        body: 'This is a test email to verify your Resend domain setup! If you receive this, everything is working!',
        metadata: { test: true }
      })
    });
    
    if (!notifResponse.ok) {
      const error = await notifResponse.json();
      console.error('❌ Error creating notification:', error);
      return;
    }
    
    const [notification] = await notifResponse.json();
    console.log('✅ Notification created:', notification.id);
    
    // Send email via Edge Function
    console.log('📤 Sending email via Edge Function...');
    const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        notification_id: notification.id,
        user_id: user.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        metadata: notification.metadata || {}
      })
    });
    
    const emailResult = await emailResponse.json();
    
    if (!emailResponse.ok) {
      console.error('❌ Email error:', emailResult);
      return;
    }
    
    console.log('✅ SUCCESS! Email sent:', emailResult);
    if (user.email) {
      console.log('📬 Check your inbox:', user.email);
    } else {
      console.log('📬 Check your inbox (email from user profile)');
    }
    console.log('📬 Also check spam folder');
    console.log('💡 Email should be from: noreply@marryzen.com');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
  }
})();
