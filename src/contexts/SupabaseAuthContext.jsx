import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { unsubscribeFromPush } from '@/lib/pushNotifications';

const AuthContext = createContext(undefined);

// LEVEL-3 AUDIT 2026-06-08:
// Previous code referenced `posthog.identify(...)` and `Sentry.setUser(...)`
// as bare globals without imports, and wrapped the calls in `try/catch (_) {}`
// — which silently swallowed the `ReferenceError`. Result: analytics and
// Sentry user attribution were dead in production. Per ROPA: PostHog is
// planned but not yet active; Sentry DPA is deferred. So the right fix
// (until both are properly installed as packages or loaded via script tag)
// is to call them through `window.*` so the code is a safe no-op when
// they're not present, AND in dev mode log a warning so the absence is
// noticed instead of hidden.
function identifyAnalyticsUser(user) {
  try {
    if (typeof window === 'undefined') return;
    if (user && user.id) {
      window.posthog?.identify(user.id, { email: user.email });
      window.Sentry?.setUser({ id: user.id, email: user.email });
      // Phase 45 2026-06-12: main.jsx now ships with capture_pageview:false
      // (so the first $pageview doesn't fire as anonymous before identify
      // arrives). Manually fire it here, AFTER identify, so the first
      // pageview lands on the authenticated distinct_id.
      window.posthog?.capture('$pageview');
    } else {
      window.posthog?.reset();
      window.Sentry?.setUser(null);
    }
  } catch (err) {
    // Only surface this in dev — analytics failure must never break auth.
    if (import.meta.env?.DEV) {
      console.warn('[auth] analytics identify failed:', err);
    }
  }
}

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSession = useCallback(async (session) => {
    setSession(session);
    setUser(session?.user ?? null);
    identifyAnalyticsUser(session?.user ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      handleSession(session);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        handleSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSession]);

  const signUp = useCallback(async (email, password, options) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign up Failed",
        description: error.message || "Something went wrong",
      });
    }

    return { error };
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign in Failed",
        description: error.message || "Something went wrong",
      });
    }

    return { error };
  }, [toast]);

  const signOut = useCallback(async () => {
    // PWA Tier 3 — privacy fix (2026-06-23): tear down the device's push
    // subscription BEFORE invalidating the session, so the DELETE row write
    // succeeds (push_subscriptions RLS requires auth.uid() = user_id). Without
    // this, a shared device where the previous user installed Marryzen would
    // keep receiving the previous user's match notifications until the push
    // service expires the endpoint (potentially weeks). The unsubscribe call
    // is wrapped in try/catch so a network failure or absent subscription
    // never blocks sign-out itself.
    try { await unsubscribeFromPush(); } catch (_) {}

    const { error } = await supabase.auth.signOut();
    // Clear stored admin role and user profile so a new account in same browser doesn't inherit them
    try {
      localStorage.removeItem('adminRole');
      localStorage.removeItem('userProfile');
    } catch (_) {}

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign out Failed",
        description: error.message || "Something went wrong",
      });
    }

    return { error };
  }, [toast]);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  }), [user, session, loading, signUp, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
