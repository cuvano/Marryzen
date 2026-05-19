# All Notification Types That Send Emails

## ✅ Complete List of Email Notifications

Here are **ALL** the notification types that automatically send emails from `noreply@marryzen.com`:

### 1. **New Match** 🎉
- **When**: When two users like each other (mutual match)
- **Trigger**: Automatic (database trigger when conversation is created)
- **Email Subject**: "Marryzen: New Match! 🎉"
- **Email Body**: "[Name] liked you back! Start a conversation."
- **Action Button**: "View Matches"
- **Notification Type**: `new_match`

### 2. **New Message** 💬
- **When**: When someone sends you a message
- **Trigger**: Automatic (database trigger when message is inserted)
- **Email Subject**: "Marryzen: New Message"
- **Email Body**: "[Name] sent you a message: [preview]"
- **Action Button**: "View Message"
- **Notification Type**: `new_message`

### 3. **Profile Approved** ✅
- **When**: When admin approves your profile
- **Trigger**: Automatic (database trigger when status changes to 'approved')
- **Email Subject**: "Marryzen: Profile Approved! ✅"
- **Email Body**: "Great news! Your profile has been approved. You can now start matching and messaging."
- **Action Button**: "View Profile"
- **Notification Type**: `profile_approved`

### 4. **Profile Rejected** ❌
- **When**: When admin rejects your profile
- **Trigger**: Automatic (database trigger when status changes to 'rejected')
- **Email Subject**: "Marryzen: Profile Update Required"
- **Email Body**: "Your profile needs some updates. Please review and resubmit for approval."
- **Action Button**: "View Profile"
- **Notification Type**: `profile_rejected`

### 5. **Profile Suspended** ⚠️
- **When**: When admin suspends your profile
- **Trigger**: Automatic (database trigger when status changes to 'suspended')
- **Email Subject**: "Marryzen: Profile Suspended ⚠️"
- **Email Body**: "Your profile has been temporarily suspended. Please contact support for assistance."
- **Action Button**: "View Profile"
- **Notification Type**: `profile_suspended`

### 6. **Profile Banned** 🚫
- **When**: When admin bans your account
- **Trigger**: Automatic (database trigger when status changes to 'banned')
- **Email Subject**: "Marryzen: Account Banned 🚫"
- **Email Body**: "Your account has been banned. Please contact support if you believe this is an error."
- **Action Button**: "View Profile"
- **Notification Type**: `profile_banned`

### 7. **Referral Reward** 🎁
- **When**: When you earn a reward for referring a friend
- **Trigger**: Automatic (database trigger when referral status changes to 'completed')
- **Email Subject**: "Marryzen: Referral Reward Earned! 🎁"
- **Email Body**: "You earned a reward for referring a friend! Check your rewards page to claim it."
- **Action Button**: "View Rewards"
- **Notification Type**: `referral_reward`

### 8. **Intro Request** (If implemented)
- **When**: When someone requests an introduction
- **Trigger**: Manual (when intro request is created)
- **Email Subject**: "Marryzen: New Introduction Request"
- **Email Body**: "[Name] requested an introduction"
- **Action Button**: "View Profile"
- **Notification Type**: `intro_request`

## 📧 Email Settings

Users can control which emails they receive in their **Notification Settings**:
- **Email Enabled**: Master switch for all email notifications
- **Email Match**: Toggle for new match emails
- **Email Message**: Toggle for new message emails
- **Email Intro**: Toggle for introduction request emails
- **Email Profile**: Toggle for profile status emails (approved/rejected/suspended/banned)
- **Email Reward**: Toggle for referral reward emails

## 🔄 How It Works

1. **Event Happens** (e.g., match created, message sent, profile approved)
2. **Database Trigger** automatically creates a notification
3. **Notification Created** in `notifications` table
4. **Email Sent** automatically via Edge Function to `send-notification-email`
5. **User Receives Email** from `noreply@marryzen.com`

## ✅ All Automatic (No Manual Action Needed)

All these notifications are **automatic** - they happen when:
- Database triggers detect changes
- No code changes needed in your app
- Emails are sent asynchronously (won't slow down your app)

## 📝 Summary

**Total: 8 notification types** that send emails:
1. ✅ New Match
2. ✅ New Message
3. ✅ Profile Approved
4. ✅ Profile Rejected
5. ✅ Profile Suspended (just added)
6. ✅ Profile Banned (just added)
7. ✅ Referral Reward
8. ✅ Intro Request (if implemented)

All emails are sent from: **`noreply@marryzen.com`**
