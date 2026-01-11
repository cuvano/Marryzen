import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import { PremiumModalContext } from '@/contexts/PremiumModalContext';
import PremiumUpgradeModal from '@/components/PremiumUpgradeModal';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import FloatingNotificationBadge from '@/components/FloatingNotificationBadge';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';

// Public Pages
import LandingPage from '@/pages/LandingPage';
import OnboardingPage from '@/pages/OnboardingPage';
import LoginPage from '@/pages/LoginPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';

// Authenticated Pages
import DashboardPage from '@/pages/DashboardPage';
import DiscoveryPage from '@/pages/DiscoveryPage';
import MatchesPage from '@/pages/MatchesPage';
import ChatPage from '@/pages/ChatPage';
import ProfilePage from '@/pages/ProfilePage';
import PremiumPage from '@/pages/PremiumPage';
import BillingPage from '@/pages/BillingPage';
import ReferralPage from '@/pages/ReferralPage';
import RewardsPage from '@/pages/RewardsPage';
import NotificationsPage from '@/pages/NotificationsPage';

// Legal Pages
import TermsOfService from '@/pages/legal/TermsOfService';
import PrivacyPolicy from '@/pages/legal/PrivacyPolicy';
import CommunityGuidelines from '@/pages/legal/CommunityGuidelines';
import SafetyDisclaimer from '@/pages/legal/SafetyDisclaimer';
import BillingTerms from '@/pages/legal/BillingTerms';
import RefundPolicy from '@/pages/legal/RefundPolicy';
import CookiePolicy from '@/pages/legal/CookiePolicy';
import AppStoreLegalDisclosures from '@/pages/legal/AppStoreLegalDisclosures';
import InvestorLegalSummary from '@/pages/legal/InvestorLegalSummary';
import ReferralTerms from '@/pages/legal/ReferralTerms';

// Admin Pages
import AdminLayout from '@/layouts/AdminLayout';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import UserManagement from '@/pages/admin/UserManagement';
import SafetyPanel from '@/pages/admin/SafetyPanel';
import MatchingSettings from '@/pages/admin/MatchingSettings';
import PlatformSettings from '@/pages/admin/PlatformSettings';
import AuditLogsPage from '@/pages/admin/AuditLogsPage';
import ActivityDashboard from '@/pages/admin/ActivityDashboard';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Helmet>
        <title>Marryzen - Find Your Marriage Partner</title>
        <meta name="description" content="A marriage-focused platform for people seeking serious, long-term relationships based on shared cultural heritage and family values." />
      </Helmet>
      <AuthProvider>
        <PremiumModalContext.Provider value={{ openPremiumModal: () => setIsModalOpen(true) }}>
          <Router>
              <div className="min-h-screen bg-[#FAF7F2]">
                  <FloatingNotificationBadge />
                  <Routes>
                      {/* Public Routes */}
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />
                      <Route path="/onboarding" element={<OnboardingPage />} />
                      
                      {/* Authenticated Routes with Global Header */}
                      <Route element={<AuthenticatedLayout />}>
                          <Route path="/verify-email" element={<VerifyEmailPage />} />
                          <Route path="/dashboard" element={<DashboardPage />} />
                          <Route path="/discovery" element={<DiscoveryPage />} />
                          <Route path="/matches" element={<MatchesPage />} />
                          <Route path="/chat" element={<ChatPage />} />
                          <Route path="/chat/:conversationId" element={<ChatPage />} />
                          <Route path="/profile" element={<ProfilePage />} />
                          <Route path="/profile/:userId" element={<ProfilePage />} />
                          <Route path="/premium" element={<PremiumPage />} />
                          <Route path="/billing" element={<BillingPage />} />
                          <Route path="/referrals" element={<ReferralPage />} />
                          <Route path="/rewards" element={<RewardsPage />} />
                          <Route path="/notifications" element={<NotificationsPage />} />
                      </Route>
                      
                      {/* Legal Routes */}
                      <Route path="/terms" element={<TermsOfService />} />
                      <Route path="/privacy" element={<PrivacyPolicy />} />
                      <Route path="/community-guidelines" element={<CommunityGuidelines />} />
                      <Route path="/safety" element={<SafetyDisclaimer />} />
                      <Route path="/billing-terms" element={<BillingTerms />} />
                      <Route path="/refund-policy" element={<RefundPolicy />} />
                      <Route path="/cookie-policy" element={<CookiePolicy />} />
                      <Route path="/app-store-disclosures" element={<AppStoreLegalDisclosures />} />
                      <Route path="/investor-legal" element={<InvestorLegalSummary />} />
                      <Route path="/referral-terms" element={<ReferralTerms />} />

                      {/* Admin Routes - Protected by AdminLayout logic */}
                      <Route path="/admin" element={<AdminLayout />}>
                          <Route index element={<AdminDashboard />} />
                          <Route path="dashboard" element={<AdminDashboard />} />
                          <Route path="users" element={<UserManagement />} />
                          <Route path="reports" element={<SafetyPanel />} />
                          <Route path="matching" element={<MatchingSettings />} />
                          <Route path="settings" element={<PlatformSettings />} />
                          <Route path="audit-logs" element={<AuditLogsPage />} />
                          <Route path="activity" element={<ActivityDashboard />} />
                      </Route>
                  </Routes>
                  <Toaster />
                  <PremiumUpgradeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
              </div>
          </Router>
        </PremiumModalContext.Provider>
      </AuthProvider>
    </>
  );
}

export default App;