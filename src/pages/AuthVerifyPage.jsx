import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * Auth verify redirect page.
 * Used so password reset (and other auth) emails can link to marryzen.com instead of supabase.co.
 * Redirects to Supabase to complete the flow; shows a manual link if redirect is blocked.
 */
const AuthVerifyPage = () => {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);
  const [verifyUrl, setVerifyUrl] = useState(null);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://adufstvmmzpqdcmpinqd.supabase.co';

  useEffect(() => {
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    const redirectTo = searchParams.get('redirect_to') || searchParams.get('redirectTo');

    if (!token || !type) {
      setError('Invalid link: missing token or type.');
      return;
    }

    const params = new URLSearchParams({ token, type });
    if (redirectTo) params.set('redirect_to', redirectTo);
    const url = `${supabaseUrl}/auth/v1/verify?${params.toString()}`;
    setVerifyUrl(url);
    window.location.replace(url);
  }, [searchParams, supabaseUrl]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] p-4">
        <div className="text-center text-[#1F1F1F] max-w-md">
          <p className="font-medium text-[#706B67]">{error}</p>
          <p className="text-sm mt-2 text-[#706B67]">Please request a new link from the app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] p-4">
      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        <div className="w-12 h-12 border-4 border-[#E6B450] border-t-transparent rounded-full animate-spin shrink-0" />
        <p className="text-[#1F1F1F] font-medium">Taking you to reset your password…</p>
        <p className="text-sm text-[#706B67]">If you are not redirected, click the button below.</p>
        {verifyUrl && (
          <Button
            asChild
            className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-semibold"
          >
            <a href={verifyUrl}>Continue to reset password</a>
          </Button>
        )}
      </div>
    </div>
  );
};

export default AuthVerifyPage;
