import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import { PremiumModalContext } from '@/contexts/PremiumModalContext';
import PremiumUpgradeModal from '@/components/PremiumUpgradeModal';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import FloatingNotificationBadge from '@/components/FloatingNotificationBadge';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import ChunkErrorBoundary from '@/components/ChunkErrorBoundary';

// ============================================================================
// Bundle Z (2026-06-15) — perf code-splitting.
// Every Route element is lazily imported via React.lazy so its JS chunk
// downloads only when the route is visited. Eager imports remain for the
// shell pieces (AuthProvider, AuthenticatedLayout, PremiumUpgradeModal,
// Toaster, the modal context, the floating badge, ChunkErrorBoundary) —
// those are needed before any route renders.
//
// Suspense fallback is a small cream-bg spinner that matches the brand;
// ChunkErrorBoundary wraps everything to recover gracefully if a chunk
// fails to load (network blip, deploy mid-session). The boundary offers
// a reload action that re-fetches the chunk.
// ============================================================================

// Public Pages
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const AuthVerifyPage = lazy(() => import('@/pages/AuthVerifyPage'));
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'));
const PressKitPage = lazy(() => import('@/pages/PressKitPage'));

// Authenticated Pages
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const DiscoveryPage = lazy(() => import('@/pages/DiscoveryPage'));
const MatchesPage = lazy(() => import('@/pages/MatchesPage'));
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const PremiumPage = lazy(() => import('@/pages/PremiumPage'));
const BillingPage = lazy(() => import('@/pages/BillingPage'));
const ReferralPage = lazy(() => import('@/pages/ReferralPage'));
const RewardsPage = lazy(() => import('@/pages/RewardsPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const AccountSettingsPage = lazy(() => import('@/pages/AccountSettingsPage'));
const HelpSupportPage = lazy(() => import('@/pages/HelpSupportPage'));

// Legal Pages
const TermsOfService = lazy(() => import('@/pages/legal/TermsOfService'));
const PrivacyPolicy = lazy(() => import('@/pages/legal/PrivacyPolicy'));
const CommunityGuidelines = lazy(() => import('@/pages/legal/CommunityGuidelines'));
const SafetyDisclaimer = lazy(() => import('@/pages/legal/SafetyDisclaimer'));
const BillingTerms = lazy(() => import('@/pages/legal/BillingTerms'));
const RefundPolicy = lazy(() => import('@/pages/legal/RefundPolicy'));
const CookiePolicy = lazy(() => import('@/pages/legal/CookiePolicy'));
const AppStoreLegalDisclosures = lazy(() => import('@/pages/legal/AppStoreLegalDisclosures'));
const InvestorLegalSummary = lazy(() => import('@/pages/legal/InvestorLegalSummary'));
const ReferralTerms = lazy(() => import('@/pages/legal/ReferralTerms'));
const FoundingMemberTerms = lazy(() => import('@/pages/legal/FoundingMemberTerms'));
const IncidentResponse = lazy(() => import('@/pages/legal/IncidentResponse'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// Admin Pages (whole admin tree split — only loaded if user navigates to /admin)
const AdminLayout = lazy(() => import('@/layouts/AdminLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const UserManagement = lazy(() => import('@/pages/admin/UserManagement'));
const SafetyPanel = lazy(() => import('@/pages/admin/SafetyPanel'));
const MatchingSettings = lazy(() => import('@/pages/admin/MatchingSettings'));
const PlatformSettings = lazy(() => import('@/pages/admin/PlatformSettings'));
const AuditLogsPage = lazy(() => import('@/pages/admin/AuditLogsPage'));
const ActivityDashboard = lazy(() => import('@/pages/admin/ActivityDashboard'));
const VerificationQueue = lazy(() => import('@/pages/admin/VerificationQueue'));

// Cream-bg spinner shown while a route chunk is downloading.
// Matches the AuthenticatedLayout loading state so users don't see a flash
// on first visit to a protected route.
const RouteSuspenseFallback = () => (
  <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center" aria-hidden="true">
    <div className="w-12 h-12 border-4 border-[#E6B450] border-t-transparent rounded-full animate-spin"></div>
  </div>
);

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Helmet>
        <title>Marryzen ... A platform for serious marriage</title>
        <meta name="description" content="Marryzen is a private, values-based platform for people seeking serious, long-term marriage. Verified profiles, marriage-intent only ... no casual dating." />
      </Helmet>
      <AuthProvider>
        <PremiumModalContext.Provider value={{ openPremiumModal: () => setIsModalOpen(true) }}>
          <Router>
              <div className="min-h-screen bg-[#FAF7F2]">
                  <FloatingNotificationBadge />
                  <ChunkErrorBoundary>
                    <Suspense fallback={<RouteSuspenseFallback />}>
                      <Routes>
                          {/* Public Routes */}
                          <Route path="/" element={<LandingPage />} />
                          <Route path="/login" element={<LoginPage />} />
                          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                          <Route path="/reset-password" element={<ResetPasswordPage />} />
                          <Route path="/auth/verify" element={<AuthVerifyPage />} />
                          <Route path="/join" element={<OnboardingPage />} />
                          <Route path="/onboarding" element={<OnboardingPage />} />
                          <Route path="/press" element={<PressKitPage />} />

                          {/* Authenticated Routes with Global Header */}
                          <Route element={<AuthenticatedLayout />}>
                              <Route path="/verify-email" element={<VerifyEmailPage />} />
                              <Route path="/dashboard" element={<DashboardPage />} />
                              <Route path="/profile" element={<ProfilePage />} />
                                <Route path="/discovery" element={<DiscoveryPage />} />
                                <Route path="/matches" element={<MatchesPage />} />
                                <Route path="/chat" element={<ChatPage />} />
                                <Route path="/chat/:conversationId" element={<ChatPage />} />
                                <Route path="/profile/:userId" element={<ProfilePage />} />
                              <Route path="/premium" element={<PremiumPage />} />
                              <Route path="/billing" element={<BillingPage />} />
                              <Route path="/referrals" element={<ReferralPage />} />
                              <Route path="/rewards" element={<RewardsPage />} />
                              <Route path="/notifications" element={<NotificationsPage />} />
                              <Route path="/account-settings" element={<AccountSettingsPage />} />
                              <Route path="/help" element={<HelpSupportPage />} />
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
                          <Route path="/founding-member-terms" element={<FoundingMemberTerms />} />
                          <Route path="/trust/incident" element={<IncidentResponse />} />

                          {/* Admin Routes - Protected by AdminLayout logic */}
                          <Route path="/admin" element={<AdminLayout />}>
                              <Route index element={<AdminDashboard />} />
                              <Route path="dashboard" element={<AdminDashboard />} />
                              <Route path="users" element={<UserManagement />} />
                              <Route path="reports" element={<SafetyPanel />} />
                              <Route path="verification" element={<VerificationQueue />} />
                              <Route path="matching" element={<MatchingSettings />} />
                              <Route path="settings" element={<PlatformSettings />} />
                              <Route path="audit-logs" element={<AuditLogsPage />} />
                              <Route path="activity" element={<ActivityDashboard />} />
                          </Route>
                        {/* 404 catch-all */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
                    </Suspense>
                  </ChunkErrorBoundary>
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
