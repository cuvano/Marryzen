import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

/**
 * Gate that requires the signed-in member to have completed Didit ID verification.
 *
 * Marryzen's brand promise is "every member is identity-verified" â this enforces it
 * for the interaction surfaces (discovery, matches, chat, other-profile views).
 *
 * Bypassed for:
 *   - admin / super_admin roles (so the founder can test flows)
 *   - users whose profiles.is_verified === true
 *   - users whose profiles.identity_verification_status === 'approved'
 *
 * Unverified members are redirected to /auth/verify so they can complete Didit.
 * Dashboard, own profile, premium and billing stay accessible without verification,
 * so members can finish their profile and pay before they hit the gate.
 */
const RequireVerified = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, allowed: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        if (!cancelled) setState({ loading: false, allowed: false });
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('is_verified, identity_verification_status, role')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const role = (data?.role || '').toString().toLowerCase();
      const isAdmin = role === 'admin' || role === 'super_admin';
      const verified = !!(data && (
        data.is_verified === true ||
        (data.identity_verification_status &&
          String(data.identity_verification_status).toLowerCase() === 'approved')
      ));
      setState({ loading: false, allowed: isAdmin || verified });
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
  if (!state.allowed) {
    return <Navigate to="/profile?verify=1" replace />;
  }
  return children ? children : <Outlet />;
};

export default RequireVerified;
