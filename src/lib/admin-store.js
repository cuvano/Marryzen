import { allUsers } from './matchmaking';

// Mock Data Generators
const generateLogs = () => [
  { id: 1, admin: 'SuperAdmin', action: 'Updated Matching Algorithm', target: 'System', timestamp: '2025-11-30T10:00:00Z', details: 'Increased weight of Core Values to 30%' },
  { id: 2, admin: 'ModeratorSarah', action: 'Banned User', target: 'User #55', timestamp: '2025-11-29T14:30:00Z', details: 'Violation of anti-hookup policy' },
  { id: 3, admin: 'VerifyMike', action: 'Approved Verification', target: 'User #102', timestamp: '2025-11-29T09:15:00Z', details: 'ID and Selfie match confirmed' },
];

const generateReports = () => [
  { id: 1, reporter: 'Aisha', reported: 'JohnDoe', type: 'Inappropriate Messages', status: 'Pending', timestamp: '2025-11-30T08:00:00Z', content: 'He asked for money immediately.', history: 'First offense' },
  { id: 2, reporter: 'Priya', reported: 'CoolGuy123', type: 'Fake Profile', status: 'Investigating', timestamp: '2025-11-29T18:00:00Z', content: 'Photos look like stock images.', history: '2 previous warnings' },
];

const generateVerificationQueue = () => [
  { id: 101, name: 'Ahmed Khan', timestamp: '2025-11-30T11:20:00Z', idImage: 'https://images.unsplash.com/photo-1563225513-22458f006343?auto=format&fit=crop&w=300&q=80', selfieImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80', aiMatchScore: 98 },
  { id: 102, name: 'Sarah Jenkins', timestamp: '2025-11-30T10:45:00Z', idImage: 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&w=300&q=80', selfieImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80', aiMatchScore: 45 },
];

export const adminRoles = {
  SUPER_ADMIN: { label: '🔴 Super Admin', permissions: ['all'] },
  MODERATOR: { label: '🟠 Moderator', permissions: ['reports', 'users', 'audit'] },
  VERIFICATION: { label: '🟡 Verification Officer', permissions: ['verification'] }
};

// Checklist Data Structure
const initialChecklist = {
  legal: {
    title: '1. Legal & Compliance',
    items: [
      { id: 'terms', label: 'Terms & Conditions Drafted & Uploaded', checked: true },
      { id: 'privacy', label: 'Privacy Policy (GDPR/CCPA Compliant)', checked: true },
      { id: 'community', label: 'Community Standards & Safety Guidelines', checked: true },
      { id: 'age', label: '18+ Age Enforcement Mechanism', checked: true },
      { id: 'disclaimer', label: 'Marriage-Only Platform Disclaimer', checked: false },
      { id: 'liability', label: 'Payment & Refund Liability Clauses', checked: false },
      { id: 'intro', label: 'Platform Intro & Intent Disclaimer', checked: true }
    ]
  },
  payments: {
    title: '2. Payments & Premium Verification',
    items: [
      { id: 'stripe', label: 'Stripe Connected & Verified', checked: false },
      { id: 'test_pay', label: 'Test Payments Completed (Success/Fail flows)', checked: false },
      { id: 'live_pay', label: 'Live Payments Enabled', checked: false },
      { id: 'refunds', label: 'Refund System Operational', checked: false },
      { id: 'cancel', label: 'Subscription Cancellation Flow Working', checked: false },
      { id: 'gating', label: 'Premium Gating Verified (Discovery/Photos/Filters)', checked: false }
    ]
  },
  security: {
    title: '3. Security & Data Protection',
    items: [
      { id: 'pw_encrypt', label: 'Password Encryption Verified', checked: true },
      { id: 'id_encrypt', label: 'ID Documents Storage Encrypted', checked: true },
      { id: '2fa', label: 'Admin 2FA Enabled', checked: false },
      { id: 'rate_limit', label: 'API Rate-Limiting Active', checked: true },
      { id: 'brute', label: 'Brute-Force Protection Active', checked: true },
      { id: 'ban_sys', label: 'Device & IP Banning System Tested', checked: true },
      { id: 'backups', label: 'Daily Database Backups Configured', checked: false }
    ]
  },
  verification: {
    title: '4. Verification System',
    items: [
      { id: 'id_upload', label: 'ID Upload Functionality Verified', checked: true },
      { id: 'selfie', label: 'Selfie Capture Functionality Verified', checked: true },
      { id: 'ai_match', label: 'AI Face Matching Logic Verified', checked: true },
      { id: 'manual', label: 'Manual Approval/Rejection Tools Working', checked: true },
      { id: 'msgs', label: 'Rejection Email/Notification Templates', checked: true },
      { id: 'fraud', label: 'Fraud Freeze Capability Tested', checked: true }
    ]
  },
  matching: {
    title: '5. Matching & Discovery',
    items: [
      { id: 'scoring', label: 'Compatibility Scoring Algorithm Accurate', checked: true },
      { id: 'threshold', label: '60-Point Minimum Threshold Enforced', checked: true },
      { id: 'sorting', label: 'Verified User Priority Sorting', checked: true },
      { id: 'location', label: 'Same-City Priority Logic', checked: true },
      { id: 'filters', label: 'Premium Filters Functioning', checked: false },
      { id: 'limits', label: 'Free User View Limits Enforced', checked: true }
    ]
  },
  chat: {
    title: '6. Chat & Safety',
    items: [
      { id: 'intro_req', label: 'Introduction Required to Chat', checked: true },
      { id: 'template', label: 'First-Message Template Enforced', checked: true },
      { id: 'filter', label: 'Safety Filter (Sexual/Scam) Active', checked: true },
      { id: 'block_ext', label: 'External Contact Blocking (Phone/Email/Socials)', checked: true },
      { id: 'report', label: 'Report System Functional', checked: true },
      { id: 'auto_mod', label: 'Auto-Warn/Suspend/Freeze Logic Tested', checked: true },
      { id: 'perm_ban', label: 'Permanent Ban Action Tested', checked: true }
    ]
  },
  profile: {
    title: '7. Profile Quality Control',
    items: [
      { id: 'photo_req', label: 'Photo Requirement Enforced', checked: true },
      { id: 'about_req', label: 'About Section Required for Verification', checked: true },
      { id: 'intent', label: 'Marriage Intent Selection Mandatory', checked: true },
      { id: 'culture', label: 'Cultural Background Mandatory', checked: true },
      { id: 'values', label: 'Core Values Selection Mandatory', checked: true },
      { id: 'unverified', label: 'Unverified Profile Restrictions Active', checked: true }
    ]
  },
  admin: {
    title: '8. Admin Panel Final Test',
    items: [
      { id: 'search', label: 'User Search & Filtering Works', checked: true },
      { id: 'actions', label: 'Ban/Freeze/Suspend Actions Effective', checked: true },
      { id: 'review', label: 'Verification Review Queue Operational', checked: true },
      { id: 'safety', label: 'Reports Panel & Audit Logs Working', checked: true },
      { id: 'revenue', label: 'Revenue Dashboard Data Accurate', checked: false },
      { id: 'logging', label: 'Admin Activity Logging Verified', checked: true }
    ]
  },
  app_store: {
    title: '9. App Store & Web Launch Prep',
    items: [
      { id: 'icon', label: 'App Icon & Splash Screen Finalized', checked: true },
      { id: 'desc', label: 'App Description & Keywords Optimized', checked: false },
      { id: 'screens', label: 'App Screenshots Uploaded', checked: false },
      { id: 'disclosures', label: 'Privacy Disclosures Submitted', checked: false },
      { id: 'rating', label: 'Content Rating Guidelines Met', checked: true },
      { id: 'position', label: 'Marriage-Only Positioning Clear', checked: true }
    ]
  },
  marketing: {
    title: '10. Marketing Soft-Launch Mode',
    items: [
      { id: 'invite', label: 'Invite-Only Access Toggle Tested', checked: false },
      { id: 'ads', label: 'No Public Ads (Organic Only)', checked: true },
      { id: 'signup_limit', label: 'Daily Signup Limits Configured', checked: false },
      { id: 'moderation', label: 'Enhanced Moderation Queue Ready', checked: true },
      { id: 'priority', label: 'Manual Verification Priority Set', checked: true }
    ]
  },
  go_live: {
    title: '11. GO-LIVE MASTER SWITCH',
    items: [
      { id: 'all_complete', label: 'All Previous 10 Sections Completed', checked: false },
      { id: 'confirm', label: 'Super Admin Final Confirmation', checked: false }
    ]
  }
};

// Initial State (Simulated Database)
export const adminStore = {
  stats: {
    totalUsers: 12500,
    activeUsers24h: 843,
    activeUsers7d: 4500,
    verifiedLevel1: 5000,
    verifiedLevel2: 2000,
    verifiedLevel3: 500,
    premiumUsers: 1200,
    newSignups: 45,
    activeConversations: 320,
    pendingReports: 12,
    bannedUsers: 85,
    revenueToday: 1450,
    revenueMonth: 42000,
  },
  users: allUsers, // Imported from matchmaking for consistency
  verificationQueue: generateVerificationQueue(),
  reports: generateReports(),
  logs: generateLogs(),
  checklist: initialChecklist,
  platformStatus: 'development', // development, soft-launch, live
  systemRules: {
    minCompatibility: 60,
    reportAutoBanLimit: 5,
    freeIntroLimit: 1,
    freeViewLimit: 5,
    matchingWeights: {
      values: 25,
      culture: 25,
      intent: 30,
      location: 10,
      age: 10
    }
  },
  payments: [
    { id: 'SUB-001', user: 'Priya', plan: '12-Month Commitment', amount: 239.99, status: 'Active', date: '2025-11-01' },
    { id: 'SUB-002', user: 'Sofia', plan: 'Monthly', amount: 29.99, status: 'Active', date: '2025-11-15' },
    { id: 'SUB-003', user: 'John', plan: 'Monthly', amount: 29.99, status: 'Failed', date: '2025-11-28' },
  ]
};

// Helper to check permissions
export const hasPermission = (role, required) => {
  if (role === 'SUPER_ADMIN') return true;
  if (!role || !adminRoles[role]) return false;
  return adminRoles[role].permissions.includes(required);
};

export const logAdminAction = (adminName, action, target, details) => {
  const newLog = {
    id: Date.now(),
    admin: adminName,
    action,
    target,
    timestamp: new Date().toISOString(),
    details
  };
  adminStore.logs.unshift(newLog);
  return newLog;
};