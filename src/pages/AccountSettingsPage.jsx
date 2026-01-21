import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Lock, Mail, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import Footer from '@/components/Footer';

const AccountSettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    fetchUserInfo();
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
      // First, verify the current password by attempting to sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordErrors({ currentPassword: 'Current password is incorrect' });
        toast({
          title: "Error",
          description: "Current password is incorrect.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // If current password is correct, update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw updateError;
      }

      // Clear form
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
                Please check your email inbox to verify your email address.
              </p>
            )}
          </CardContent>
        </Card>

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

        <Footer />
      </div>
    </div>
  );
};

export default AccountSettingsPage;
