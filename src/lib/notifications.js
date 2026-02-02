/**
 * Notification Utility Functions
 * 
 * This module provides functions to create notifications and send emails.
 * 
 * Usage:
 *   import { createNotification } from '@/lib/notifications';
 *   
 *   await createNotification({
 *     user_id: userId,
 *     type: 'new_match',
 *     title: 'New Match!',
 *     body: 'You have a new match!',
 *     metadata: { conversation_id: '...' }
 *   });
 */

import { supabase } from './customSupabaseClient';

/**
 * Create a notification and send email if enabled
 * @param {Object} notificationData - Notification data
 * @param {string} notificationData.user_id - User ID to notify
 * @param {string} notificationData.type - Notification type (new_match, new_message, etc.)
 * @param {string} notificationData.title - Notification title
 * @param {string} notificationData.body - Notification body
 * @param {Object} notificationData.metadata - Optional metadata (JSON object)
 * @returns {Promise<Object>} Created notification
 */
export async function createNotification({ user_id, type, title, body, metadata = {} }) {
  try {
    // Create notification in database
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id,
        type,
        title,
        body,
        metadata
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      throw error;
    }

    // Send email asynchronously (don't wait for it)
    sendNotificationEmail(notification).catch(err => {
      console.error('Error sending notification email:', err);
      // Don't throw - email failure shouldn't block notification creation
    });

    return notification;
  } catch (error) {
    console.error('Error in createNotification:', error);
    throw error;
  }
}

/**
 * Send email for a notification via Edge Function
 * @param {Object} notification - Notification object
 * @returns {Promise<void>}
 */
async function sendNotificationEmail(notification) {
  try {
    // Call the Edge Function to send email
    const { error } = await supabase.functions.invoke('send-notification-email', {
      body: {
        notification_id: notification.id,
        user_id: notification.user_id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        metadata: notification.metadata || {}
      }
    });

    if (error) {
      console.error('Error calling send-notification-email function:', error);
      // Don't throw - email failure is not critical
    }
  } catch (error) {
    console.error('Error in sendNotificationEmail:', error);
    // Don't throw - email failure is not critical
  }
}

/**
 * Helper function to create a new match notification
 */
export async function notifyNewMatch(userId, matchedUserName, conversationId, matchedUserId) {
  return createNotification({
    user_id: userId,
    type: 'new_match',
    title: 'New Match! 🎉',
    body: `${matchedUserName || 'Someone'} liked you back! Start a conversation.`,
    metadata: {
      conversation_id: conversationId,
      matched_user_id: matchedUserId
    }
  });
}

/**
 * Helper function to create a new message notification
 */
export async function notifyNewMessage(receiverId, senderName, messageContent, conversationId, messageId, senderId) {
  const preview = messageContent.length > 50 
    ? messageContent.substring(0, 50) + '...' 
    : messageContent;

  return createNotification({
    user_id: receiverId,
    type: 'new_message',
    title: 'New Message',
    body: `${senderName || 'Someone'} sent you a message: ${preview}`,
    metadata: {
      conversation_id: conversationId,
      message_id: messageId,
      sender_id: senderId
    }
  });
}

/**
 * Helper function to create a profile approval notification
 */
export async function notifyProfileApproved(userId) {
  return createNotification({
    user_id: userId,
    type: 'profile_approved',
    title: 'Profile Approved! ✅',
    body: 'Great news! Your profile has been approved. You can now start matching and messaging.',
    metadata: {
      profile_id: userId
    }
  });
}

/**
 * Helper function to create a profile rejection notification
 */
export async function notifyProfileRejected(userId) {
  return createNotification({
    user_id: userId,
    type: 'profile_rejected',
    title: 'Profile Update Required',
    body: 'Your profile needs some updates. Please review and resubmit for approval.',
    metadata: {
      profile_id: userId
    }
  });
}

/**
 * Helper function to create a referral reward notification
 */
export async function notifyReferralReward(userId, rewardId, referralId) {
  return createNotification({
    user_id: userId,
    type: 'referral_reward',
    title: 'Referral Reward Earned! 🎁',
    body: 'You earned a reward for referring a friend! Check your rewards page to claim it.',
    metadata: {
      reward_id: rewardId,
      referral_id: referralId
    }
  });
}

/**
 * Helper function to create a profile suspension notification
 */
export async function notifyProfileSuspended(userId) {
  return createNotification({
    user_id: userId,
    type: 'profile_suspended',
    title: 'Profile Suspended ⚠️',
    body: 'Your profile has been temporarily suspended. Please contact support for assistance.',
    metadata: {
      profile_id: userId
    }
  });
}

/**
 * Helper function to create a profile ban notification
 */
export async function notifyProfileBanned(userId) {
  return createNotification({
    user_id: userId,
    type: 'profile_banned',
    title: 'Account Banned 🚫',
    body: 'Your account has been banned. Please contact support if you believe this is an error.',
    metadata: {
      profile_id: userId
    }
  });
}
