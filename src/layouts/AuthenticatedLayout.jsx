import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header';
import { supabase } from '@/lib/customSupabaseClient';
import { touchLastActiveIfDue } from '@/lib/profileActivity';
import { isOnboardingComplete } from '@/lib/onboardingStatus';

const AuthenticatedLayout = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/login');
          return;
        }

        // Phase 2E+ defensive gate: if profile hasn't finished onboarding,
        // send them back. This catches the case where a user with a stale
        // session visits /dashboard directly (bookmark, deep link, browser
        // back button) — without this gate they'd see the app with no photo,
        // no bio, no values, polluting Discovery and matching signal.
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_step')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!isOnboardingComplete(profile)) {
          navigate('/onboarding', { replace: true });
          return;
        }

        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check error:', error);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session && (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED')) {
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
      } else if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        setIsAuthenticated(true);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Keep profiles.last_active_at fresh for “Active today” on Discovery (throttled per tab).
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const run = () => {
      if (!cancelled) touchLastActiveIfDue(supabase);
    };
    run();
    const interval = setInterval(run, 6 * 60 * 1000);
    const onFocus = () => touchLastActiveIfDue(supabase);
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <Helmet><meta name="robots" content="noindex,nofollow" /></Helmet>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#E6B450] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-brand-muted font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col">
      <Helmet><meta name="robots" content="noindex,nofollow" /></Helmet>
      <Header />
      <main className="flex-grow">
        <Outlet />
      </main>
    </div>
  );
};

export default AuthenticatedLayout;
