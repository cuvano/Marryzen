import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

/**
 * Gate that requires the signed-in member to have completed Didit ID verification.
 * Marryzen's brand promise is "every member is identity-verified" — this enforces it
 * for the interaction surfaces (discovery, matches, chat, other-profile views).
 *
 * Members can still reach the dashboard, their own profile, premium and billing pages
 * without verification, so they can finish onboarding and pay if they want to.
 */
const RequireVerified = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, verified: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        if (!cancelled) setState({ loading: false, verified: false });
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('is_verified, identity_verification_status')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const verified = !!(
        data && (data.is_verified === true ||
          (data.identity_verification_status &&
           String(data.identity_verification_status).toLowerCase() === 'approved'))
      );
      setState({ loading: false, verified });
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
        <div className="w-10 h-10 border-4 border-[#E6B450] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!state.verified) {
    return <Navigate to="/auth/verify?required=1" replace />;
  }
  return children ? children : <Outlet />;
};

export default RequireVerified;
