import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from 'react-router-dom';
import { isRecaptchaEnabled } from '@/lib/recaptcha';

/**
 * Step 1c — Your commitment (Phase 2F split)
 * -------------------------------------------
 * The consent gate. supabase.auth.signUp fires when the user clicks
 * Continue here (handled in OnboardingPage handleNext).
 *
 * Owns: seriousRelationship checkbox (required), Terms checkbox
 * (required for new signups, hidden in edit mode), reCAPTCHA notice.
 */
const Step1c = ({ formData, updateFormData, errors = {}, isEditMode = false }) => {
  return (
    <div className="space-y-8">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-4">Your commitment</h2>
        <p className="text-brand-muted text-lg font-medium">Two quick agreements and you're in.</p>
      </div>

      <div className="space-y-4 bg-[#FAF7F2] p-6 rounded-xl border border-[#E6DCD2]">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="seriousRelationship"
            checked={formData.seriousRelationship}
            onCheckedChange={(checked) => updateFormData('seriousRelationship', checked)}
            className="border-[#C85A72] data-[state=checked]:bg-[#E6B450] data-[state=checked]:border-[#E6B450] mt-1"
          />
          <Label htmlFor="seriousRelationship" className="text-[#1F1F1F] text-sm leading-relaxed cursor-pointer font-bold">
            I am looking for a serious, long-term relationship leading to marriage.
          </Label>
        </div>

        {!isEditMode && (
          <div className="flex items-start space-x-3">
            <Checkbox
              id="agreeToTerms"
              checked={formData.agreeToTerms}
              onCheckedChange={(checked) => updateFormData('agreeToTerms', checked)}
              className="border-[#C85A72] data-[state=checked]:bg-[#E6B450] data-[state=checked]:border-[#E6B450] mt-1"
            />
            <Label htmlFor="agreeToTerms" className="text-[#1F1F1F] text-sm leading-relaxed cursor-pointer font-medium">
              I agree to the <Link to="/terms" className="text-brand-pink-strong hover:underline" target="_blank">Terms of Service</Link>, <Link to="/privacy" className="text-brand-pink-strong hover:underline" target="_blank">Privacy Policy</Link>, and <Link to="/community-guidelines" className="text-brand-pink-strong hover:underline" target="_blank">Community Guidelines</Link> of Marryzen.
            </Label>
          </div>
        )}
      </div>

      {/* reCAPTCHA v3 runs invisibly when the user clicks Continue */}
      {errors.captcha && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-600 text-sm font-medium">{errors.captcha}</p>
        </div>
      )}

      {isRecaptchaEnabled && (
        <div className="text-xs text-brand-muted text-center pt-2 pb-2 flex items-center justify-center gap-1 flex-wrap">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          {/* Google reCAPTCHA TOS requires the exact attribution sentence to render verbatim. */}
          <span>This site is protected by reCAPTCHA and the Google</span>
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-pink-strong hover:underline">Privacy Policy</a>
          <span>and</span>
          <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-brand-pink-strong hover:underline">Terms of Service</a>
          <span>apply.</span>
        </div>
      )}

      <p className="text-brand-muted text-sm text-center pt-4 font-medium">
        Most details can be updated in your profile settings.
      </p>
    </div>
  );
};

export default Step1c;
