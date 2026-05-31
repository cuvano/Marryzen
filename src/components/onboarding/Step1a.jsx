import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Step 1a — Create your account (Phase 2F split)
 * -----------------------------------------------
 * Riley's #1 conversion lift: split the old 9-field Step 1 into three
 * focused sub-screens. This is the FIRST sub-screen — just the account
 * basics so the user can start without facing a wall of fields.
 *
 * Fields owned: name, email, password, confirmPassword (passwords only
 * when showPasswordFields=true, i.e. brand-new signups, not edit mode).
 *
 * Account creation does NOT happen here. supabase.auth.signUp fires at
 * the end of Step 1c after the user has filled identity + commitments.
 */
const Step1a = ({
  formData,
  updateFormData,
  errors = {},
  showPasswordFields = true,
  showPasswordSettingsLink = false,
}) => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="space-y-8">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-4">Create your account</h2>
        <p className="text-[#706B67] text-lg font-medium">A few quick basics to get you in.</p>
      </div>

      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-[#333333] font-bold text-base">Full Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateFormData('name', e.target.value)}
            aria-describedby={errors.name ? 'name-error' : 'name-helper'}
            aria-invalid={!!errors.name}
            className={`bg-white border-[#CFC6BA] text-[#1F1F1F] placeholder:text-[#8A857D] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl h-12 px-4 ${errors.name ? 'border-red-500 focus:border-red-500' : ''}`}
            placeholder="Enter your full name"
          />
          {errors.name ? (
            <p id="name-error" className="text-red-500 text-sm">{errors.name}</p>
          ) : (
            <p id="name-helper" className="text-[#706B67] text-xs mt-1 font-medium">Enter your full legal name. This will be used when Marryzen verifies your identity as part of our safety process.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-[#333333] font-bold text-base">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => updateFormData('email', e.target.value)}
            aria-describedby={errors.email ? 'email-error' : 'email-helper'}
            aria-invalid={!!errors.email}
            className={`bg-white border-[#CFC6BA] text-[#1F1F1F] placeholder:text-[#8A857D] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl h-12 px-4 ${errors.email ? 'border-red-500 focus:border-red-500' : ''}`}
            placeholder="your@email.com"
          />
          {errors.email ? (
            <div id="email-error" className="flex flex-col gap-1">
              <p className="text-red-500 text-sm">{errors.email}</p>
              {errors.email.includes("already registered") && (
                <button onClick={() => navigate('/login')} className="text-[#C85A72] text-sm font-bold hover:underline self-start">
                  Go to Login
                </button>
              )}
            </div>
          ) : (
            <p id="email-helper" className="text-[#706B67] text-xs mt-1 font-medium">We'll never share your email with other members.</p>
          )}
        </div>

        {showPasswordFields && (
          <>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#333333] font-bold text-base">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password || ''}
                  onChange={(e) => updateFormData('password', e.target.value)}
                  className={`bg-white border-[#CFC6BA] text-[#1F1F1F] placeholder:text-[#8A857D] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl h-12 px-4 pr-10 ${errors.password ? 'border-red-500 focus:border-red-500' : ''}`}
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#706B67] hover:text-[#1F1F1F]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* Phase 2F fix: always show the format hint, even when there's an error.
                  Previously the helper text disappeared on error, leaving users to guess what to fix. */}
              <p className="text-[#706B67] text-xs font-medium">
                Minimum 8 characters, at least 1 letter and 1 number. Special characters are allowed.
              </p>
              {errors.password && <p className="text-red-500 text-sm">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#333333] font-bold text-base">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword || ''}
                  onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                  className={`bg-white border-[#CFC6BA] text-[#1F1F1F] placeholder:text-[#8A857D] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl h-12 px-4 pr-10 ${errors.confirmPassword ? 'border-red-500 focus:border-red-500' : ''}`}
                  placeholder="Confirm password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#706B67] hover:text-[#1F1F1F]"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-red-500 text-sm">{errors.confirmPassword}</p>}
            </div>
          </>
        )}

        {showPasswordSettingsLink && (
          <p className="text-[#706B67] text-xs font-medium -mt-1">
            To change your password, go to{' '}
            <Link to="/account-settings" className="text-[#C85A72] font-semibold hover:underline">
              Account settings
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
};

export default Step1a;
