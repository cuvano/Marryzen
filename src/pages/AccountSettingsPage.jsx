import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Lock, Mail, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft, CreditCard, Heart } from 'lucide-react';
import Footer from '@/components/Footer';
import DeleteAccountModal from '@/components/DeleteAccountModal';
import { Download, Trash2 } from 'lucide-react';
import MatchPreferencesCard from '@/components/MatchPreferencesCard';
import { funnel } from '@/lib/analytics';

const AccountSettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);

  // Password change form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});

  // Phase 41a — Match preferences (deal-breakers). Loaded from profiles row,
  // persisted on toggle change. All defaults false (opt-in only).
  const [profileForPrefs, setProfileForPrefs] = useState(null);
  const [dealbreakers, setDealbreakers] = useState({
    dealbreaker_faith: false,
    dealbreaker_marital_status: false,
    dealbreaker_has_children: false,
    dealbreaker_relationship_goal: false,
  });
  const [dealbreakersSaving, setDealbreakersSaving] = useState(false);

  useEffect(() => {
    fetchUserInfo();
    fetchMatchPreferences();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;

      if (user) {
        setUserEmail(user.email || '');
        setEmailVerified(user.email_confirmed_at !== null);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
      toast({
        title: "Error",
        description: "Failed to load account information.",
        variant: "destructive"
      });
    }
  };

  // Phase 41a — load the profile row with the 4 deal-breaker columns + the
  // context fields the MatchPreferencesCard uses to show "Currently: X" hints.
  const fetchMatchPreferences = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('religious_affiliation, marital_status, has_children, relationship_goal, dealbreaker_faith, dealbreaker_marital_status, dealbreaker_has_children, dealbreaker_relationship_goal')
        .eq('id', session.user.id)
        .maybeSingle();
      if (error) {
        // PGRST116 = no rows. Acceptable for very new accounts that haven't
        // finished onboarding; the toggles are still functional and will
        // persist on save.
        if (error.code && error.code !== 'PGRST116') throw error;
      }
      if (data) {
        setProfileForPrefs({
          religious_affiliation: data.religious_affiliation,
          marital_status: data.marital_status,
          has_children: data.has_children,
          relationship_goal: data.relationship_goal,
        });
        setDealbreakers({
          dealbreaker_faith: !!data.dealbreaker_faith,
          dealbreaker_marital_status: !!data.dealbreaker_marital_status,
          dealbreaker_has_children: !!data.dealbreaker_has_children,
          dealbreaker_relationship_goal: !!data.dealbreaker_relationship_goal,
        });
      }
    } catch (err) {
      console.error('Error fetching match preferences:', err);
    }
  };

  // Phase 41a — persist deal-breaker changes immediately. Optimistic update +
  // toast feedback. Emits a `dealbreakers_changed` PostHog event so we can
  // track the north-star metric (Day-7 return rate by dealbreakers_set_count).
  const handleDealbreakersChange = async (next) => {
    const prev = dealbreakers;
    setDealbreakers(next);
    setDealbreakersSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Revert + error toast
        setDealbreakers(prev);
        toast({
          title: 'Not signed in',
          description: 'Please sign in to update your match preferences.',
          variant: 'destructive',
        });
        return;
      }
      const { error } = await supabase
        .from('profiles')
        .update(next)
        .eq('id', session.user.id);
      if (error) {
        setDealbreakers(prev); // revert on failure
        throw error;
      }
      // Telemetry — emit a single event with the full from/to snapshot so we
      // can reconstruct preference evolution in PostHog.
      try {
        const activeCount = Object.values(next).filter(Boolean).length;
        funnel.dealbreakersChanged({
          from: prev,
          to: next,
          trigger: 'settings',
          active_count: activeCount,
        });
      } catch (_) {}
    } catch (err) {
      console.error('Error saving match preferences:', err);
      toast({
        title: 'Save failed',
        description: err.message || 'Could not save your match preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDealbreakersSaving(false);
    }
  };

  const validatePassword = () => {
    const errors = {};

    if (!currentPassword) {
      errors.currentPassword = 'Current password is required';
    }

    if (!newPassword) {
      errors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one lowercase letter';
    } else if (!/(?=.*[A-Z])/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one uppercase letter';
    } else if (!/(?=.*\d)/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one number';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      errors.newPassword = 'New password must be different from current password';
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!validatePassword()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before submitting.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        current_password: currentPassword,
        password: newPassword,
      });

      if (updateError) {
        const msg = (updateError.message || '').toLowerCase();
        if (
          msg.includes('current password') ||
          msg.includes('incorrect') ||
          msg.includes('does not match') ||
          msg.includes('invalid login credentials')
        ) {
          setPasswordErrors({ currentPassword: 'Current password is incorrect' });
          toast({
            title: "Error",
            description: "Current password is incorrect.",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
        throw updateError;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordErrors({});

      toast({
        title: "Success!",
        description: "Your password has been updated successfully.",
        variant: "default"
      });
    } catch (error) {
      console.error('Password update error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update password. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4 text-[#706B67] hover:text-[#1F1F1F]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-[#1F1F1F]">Account Settings</h1>
          <p className="text-[#706B67] mt-2">Manage your account security and preferences</p>
        </div>

        {/* Email Information Card */}
        <Card className="mb-6 border-[#E6DCD2]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1F1F1F]">
              <Mail className="w-5 h-5 text-[#E6B450]" />
              Email Address
            </CardTitle>
            <CardDescription>Your account email address</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-[#FAF7F2] rounded-lg">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium text-[#1F1F1F]">{userEmail || 'Loading...'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {emailVerified ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-600 font-medium">Verified</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm text-yellow-600 font-medium">Not Verified</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {!emailVerified && (
              <p className="text-sm text-[#706B67] mt-3">
                Confirm your email to be approved. Please check your inbox and click the verification link.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6 border-[#E6DCD2]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1F1F1F]">
              <CreditCard className="w-5 h-5 text-[#E6B450]" />
              Billing & subscription
            </CardTitle>
            <CardDescription>Manage Premium, payment methods, invoices, and cancellation in Stripe</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              onClick={() => navigate('/billing')}
              className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-semibold"
            >
              Open billing page
            </Button>
          </CardContent>
        </Card>

        {/* Phase 41a — Match preferences (deal-breakers) */}
        <div id="match-preferences" className="mb-6">
          <MatchPreferencesCard
            value={dealbreakers}
            onChange={handleDealbreakersChange}
            profile={profileForPrefs}
            compact={false}
          />
          {dealbreakersSaving && (
            <p className="text-xs text-[#706B67] mt-2 ml-2">Saving&hellip;</p>
          )}
        </div>

        {/* Change Password Card */}
        <Card className="mb-6 border-[#E6DCD2]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1F1F1F]">
              <Lock className="w-5 h-5 text-[#E6B450]" />
              Change Password
            </CardTitle>
            <CardDescription>Update your account password to keep it secure</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-[#1F1F1F] font-medium">
                  Current Password
                </Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (passwordErrors.currentPassword) {
                        setPasswordErrors(prev => ({ ...prev, currentPassword: '' }));
                      }
                    }}
                    placeholder="Enter your current password"
                    className={`pr-10 ${passwordErrors.currentPassword ? 'border-red-500' : 'border-[#E6DCD2]'}`}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#706B67] hover:text-[#1F1F1F]"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {passwordErrors.currentPassword}
                  </p>
                )}
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-[#1F1F1F] font-medium">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (passwordErrors.newPassword) {
                        setPasswordErrors(prev => ({ ...prev, newPassword: '' }));
                      }
                    }}
                    placeholder="Enter your new password"
                    className={`pr-10 ${passwordErrors.newPassword ? 'border-red-500' : 'border-[#E6DCD2]'}`}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#706B67] hover:text-[#1F1F1F]"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordErrors.newPassword && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {passwordErrors.newPassword}
                  </p>
                )}
                <p className="text-xs text-[#706B67]">
                  Password must be at least 8 characters and include uppercase, lowercase, and a number.
                </p>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-[#1F1F1F] font-medium">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (passwordErrors.confirmPassword) {
                        setPasswordErrors(prev => ({ ...prev, confirmPassword: '' }));
                      }
                    }}
                    placeholder="Confirm your new password"
                    className={`pr-10 ${passwordErrors.confirmPassword ? 'border-red-500' : 'border-[#E6DCD2]'}`}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#706B67] hover:text-[#1F1F1F]"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordErrors.confirmPassword && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {passwordErrors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold"
                >
                  {loading ? 'Updating Password...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Danger Zone — data export + delete account (GDPR Article 15/17) */}
        <Card className="mt-6 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Your data &amp; account</CardTitle>
            <CardDescription>
              Export everything Marryzen holds about you, or permanently delete your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) return;
                    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://adufstvmmzpqdcmpinqd.supabase.co'}/functions/v1/account-export`, {
                      headers: { Authorization: `Bearer ${session.access_token}` }
                    });
                    const blob = await resp.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `marryzen-export-${new Date().toISOString().slice(0, 10)}.json`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('Export failed', err);
                  }
                }}
                className="border-[#E6DCD2]"
              >
                <Download className="w-4 h-4 mr-2" />
                Export my data
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteAccount(true)}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete my account
              </Button>
            </div>
          </CardContent>
        </Card>
        <DeleteAccountModal isOpen={showDeleteAccount} onClose={() => setShowDeleteAccount(false)} />

        <Footer />
      </div>
    </div>
  );
};

export default AccountSettingsPage;
