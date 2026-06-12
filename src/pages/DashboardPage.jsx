import React, { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Heart, MessageCircle, Star, Send, Settings, Search, Crown, ShieldCheck, AlertCircle, CheckCircle2, XCircle, Upload, User, Mail, Sliders, Camera, FileText, Clock, ArrowRight, X, Gift, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { PremiumModalContext } from '@/contexts/PremiumModalContext';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { calculateScore, getMatchLabel } from '@/lib/matchmaking';
import { getPotentialMatchesCount } from '@/lib/matchStats';

import { Helmet } from 'react-helmet';
import PromptsEditorModal from '@/components/PromptsEditorModal';
import { funnel } from '@/lib/analytics';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { openPremiumModal } = useContext(PremiumModalContext);
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState(null);
  const [suggestedProfiles, setSuggestedProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusBannerDismissed, setStatusBannerDismissed] = useState(false);
  // Phase polish: dismissible admin safety notice. localStorage flag means once
  // the admin clicks X, it stays hidden forever for that browser. Must live in
  // the top-of-component hook cluster (Rules of Hooks — never declare a hook
  // after the early-return for loading state further down).
  const [safetyNoticeVisible, setSafetyNoticeVisible] = useState(() => {
    try { return localStorage.getItem('mrz_safety_notice_dismissed') !== '1'; }
    catch { return true; }
  });

  // Sprint B — "Profile Health" consolidation. Per board verdict the 6-banner
  // stack was burying real content. We default to EXPANDED on first visit
  // (so users see what's pending) but persist the toggle once dismissed.
  const [profileHealthExpanded, setProfileHealthExpanded] = useState(() => {
    try { return localStorage.getItem('mrz_profile_health_collapsed') !== '1'; }
    catch { return true; }
  });
  const toggleProfileHealth = () => {
    setProfileHealthExpanded(prev => {
      const next = !prev;
      try { localStorage.setItem('mrz_profile_health_collapsed', next ? '0' : '1'); } catch {}
      return next;
    });
  };
  const [showPromptsEditor, setShowPromptsEditor] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [unclaimedCredits, setUnclaimedCredits] = useState([]);
  const [claimingCredit, setClaimingCredit] = useState(false);
  
  const [stats, setStats] = useState({
    potentialMatches: 0,
    conversations: 0,
    introductionsSent: 0,
    profileInterest: 0
  });
  const [referralInfo, setReferralInfo] = useState(null);

  // Meta Pixel CompleteRegistration: fires ONCE when the user's identity is
  // verified (Didit returns success and is_verified flips true). Deduped via
  // localStorage so we don't refire on every dashboard visit after verification.
  // Best fire point client-side because the didit-webhook is server-side and
  // doesn't have access to the user's pixel session.
  useEffect(() => {
    if (!userProfile?.id) return;
    if (!userProfile.is_verified) return;
    try {
      const key = 'mrz_didit_completed_fired_' + userProfile.id;
      if (localStorage.getItem(key) === '1') return;
      funnel.diditCompleted({ user_id: userProfile.id });
      localStorage.setItem(key, '1');
    } catch (_) { /* analytics must never crash UI */ }
  }, [userProfile?.id, userProfile?.is_verified]);

  useEffect(() => {
    if (!authUser?.id) {
      setUserProfile(null);
      setSuggestedProfiles([]);
      setStats({ potentialMatches: 0, conversations: 0, introductionsSent: 0, profileInterest: 0 });
      setLoading(false);
      return;
    }
    // Check if status banner was dismissed or if it was already shown once
    const dismissed = localStorage.getItem('status_banner_dismissed');
        if (dismissed) {
      setStatusBannerDismissed(true);
    }

    const init = async () => {
      setLoading(true);
      try {
      const { data: { user } } = await supabase.auth.getUser();
        if (!user || user.id !== authUser.id) {
          setLoading(false);
          return;
        }

        // Check email verification status
        setEmailVerified(user.email_confirmed_at !== null);
        try {
          const { data: credits } = await supabase
            .from('premium_credits')
            .select('id, days, source, earned_at, expires_at')
            .eq('user_id', authUser.id)
            .is('claimed_at', null)
            .gt('expires_at', new Date().toISOString())
            .order('earned_at', { ascending: false });
          setUnclaimedCredits(credits || []);
        } catch (e) { console.error('Failed to load credits:', e); }

        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError && profileError.code !== 'PGRST116' && profileError.code !== 'NOT_FOUND') {
          console.error('Profile fetch error:', profileError);
        }

        if (profile) {
          setUserProfile(profile);
          // Drop the blocking spinner as soon as the profile is in state.
          // Stats + suggestions resolve in the background and update the UI
          // when they arrive ... the user does not have to wait on them.
          setLoading(false);

          const profileStatusLower = profile.status?.toLowerCase()?.trim();
          Promise.all([
            fetchRealStats(user.id, profile),
            profileStatusLower === 'approved'
              ? fetchSuggestedProfiles(user.id, profile)
              : Promise.resolve()
          ]).catch((err) => {
            console.warn('Dashboard background fetch error:', err);
          });
        }
      } catch (error) {
        // Ignore 404 NOT_FOUND errors
        if (error.code === 'NOT_FOUND' || error.message?.includes('404')) {
          console.warn('Resource not found (expected in some cases):', error);
      } else {
          console.error('Dashboard initialization error:', error);
          toast({
            title: "Error Loading Dashboard",
            description: "Please refresh the page.",
            variant: "destructive"
          });
        }
      } finally {
        setLoading(false);
      }
    };

    init();
    
    // Refresh profile and email verification status periodically and on focus
    const refreshProfileStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Refresh email verification
        setEmailVerified(user.email_confirmed_at !== null);
        
        // Refresh profile status
        const { data: profile } = await supabase
          .from('profiles')
          .select('status, onboarding_step')
          .eq('id', user.id)
          .maybeSingle();
        
        if (profile) {
          setUserProfile(prev => prev ? { ...prev, status: profile.status, onboarding_step: profile.onboarding_step } : profile);
        }
      } catch (error) {
        console.error('Error refreshing profile status:', error);
      }
    };
    
    // Realtime: push-update profile status when this user's row changes (replaces the 10s poll).
    const channel = supabase
      .channel('dashboard-profile-' + authUser.id)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: 'id=eq.' + authUser.id
      }, (payload) => {
        if (payload?.new) {
          setUserProfile(prev => prev
            ? { ...prev, status: payload.new.status, onboarding_step: payload.new.onboarding_step }
            : payload.new);
        }
      })
      .subscribe();

    // Safety net: refresh on focus / visibility change in case a Realtime event was missed across a reconnect.
    const handleFocus = () => refreshProfileStatus();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshProfileStatus();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authUser?.id, navigate, toast]);

  // Auto-dismiss status banner after showing once (5 seconds)
  useEffect(() => {
    if (userProfile?.status && !statusBannerDismissed) {
      const statusShown = localStorage.getItem('status_banner_shown');
      if (!statusShown) {
        // Auto-dismiss after 5 seconds
        const timer = /* auto-dismiss removed - banner persists until user clicks X */ undefined;
        
        return () => clearTimeout(timer);
      }
    }
  }, [userProfile?.status, statusBannerDismissed]);

  const fetchRealStats = async (userId, profile) => {
    const queries = [
      ['potentialMatches', async () => {
        const n = await getPotentialMatchesCount(supabase, userId);
        return typeof n === 'number' ? n : 0;
      }],
      ['conversations', async () => {
        const { count, error } = await supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
        if (error) throw error;
        return count ?? 0;
      }],
      ['introductionsSent', async () => {
        const { count, error } = await supabase
          .from('user_interactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('interaction_type', 'like');
        if (error) throw error;
        return count ?? 0;
      }],
      ['profileInterest', async () => {
        // B3 — Premium-likes gate. After the RLS tightening, direct count on
        // incoming likes only returns mutual rows (under-count). The RPC
        // returns the true total, which is fine to show non-premium users
        // (the count is the tease — only the LIKER IDENTITY is gated).
        const { data, error } = await supabase.rpc('get_received_likes_count');
        if (error) throw error;
        return data ?? 0;
      }],
    ];

    // Fire all four count queries in parallel.
    const firstPass = await Promise.allSettled(queries.map(([, fn]) => fn()));

    // Retry once after 1.5s for any that failed (handles transient Supabase 503s).
    const needsRetry = firstPass
      .map((r, i) => (r.status === 'rejected' ? i : -1))
      .filter(i => i >= 0);

    let retryResults = [];
    if (needsRetry.length) {
      await new Promise(r => setTimeout(r, 1500));
      retryResults = await Promise.allSettled(needsRetry.map(i => queries[i][1]()));
    }

    // Merge: prefer first-pass success, else retry success, else keep prior value.
    setStats(prev => {
      const next = { ...prev };
      queries.forEach(([label], i) => {
        const r = firstPass[i];
        if (r.status === 'fulfilled') {
          next[label] = r.value;
          return;
        }
        const retryIdx = needsRetry.indexOf(i);
        if (retryIdx >= 0) {
          const rr = retryResults[retryIdx];
          if (rr && rr.status === 'fulfilled') {
            next[label] = rr.value;
            return;
          }
          console.warn(`[stats] "${label}" failed twice:`, rr?.reason || r.reason);
        } else {
          console.warn(`[stats] "${label}" failed:`, r.reason);
        }
      });
      return next;
    });
  };

  const fetchSuggestedProfiles = async (userId, userProfile) => {
    try {
      // Get interactions to exclude
      const { data: interactions } = await supabase
        .from('user_interactions')
        .select('target_user_id')
        .eq('user_id', userId);

      const { data: blocked } = await supabase
        .from('user_blocks')
        .select('blocked_user_id')
        .eq('blocker_id', userId);

      const excludeIds = new Set([
        userId,
        ...(interactions?.map(i => i.target_user_id) || []),
        ...(blocked?.map(b => b.blocked_user_id) || [])
      ]);

      // Get matching config for scoring
      const { data: matchingConfig } = await supabase
        .from('matching_config')
        .select('*')
        .maybeSingle();

      // Fetch approved profiles that user hasn't interacted with
      // Fetch more to allow for better matching algorithm ranking
      // PERF: keep the field set tight so we don't drag huge base64 photo blobs
      // off legacy rows just to score and rank. The discovery page does the full
      // detail fetch. Lower the candidate pool from 50 -> 20 for faster dashboard paint.
      let query = supabase
        .from('profiles')
        .select('id, full_name, photos, is_premium, identify_as, date_of_birth, location_city, location_country, latitude, longitude, religion, religion_practice, looking_for_gender, age_range, distance_preference, height_range, education_level, smoking_drinking, marital_status, has_children, wants_children, languages, core_values, occupation, status')
        .eq('status', 'approved')
        .limit(20);

      const { data: profiles, error } = await query;

      if (error) throw error;

      // Filter out excluded IDs, calculate compatibility scores, and rank
      const suggested = (profiles || [])
        .filter(p => !excludeIds.has(p.id))
        .map(p => {
          // Calculate distance if coordinates available
          if (userProfile.latitude && userProfile.longitude && p.latitude && p.longitude) {
            const R = 6371; // km
            const dLat = (p.latitude - userProfile.latitude) * Math.PI / 180;
            const dLon = (p.longitude - userProfile.longitude) * Math.PI / 180;
            const a = 
              Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(userProfile.latitude * Math.PI / 180) * Math.cos(p.latitude * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            p.distance = R * c;
          }

          // Calculate compatibility score using enhanced algorithm
          const { score, breakdown, candidateAge } = calculateScore(userProfile, p, matchingConfig);

          // Validate and round the score
          const validScore = (typeof score === 'number' && !isNaN(score)) ? Math.round(score) : 0;

          return {
            id: p.id,
            name: p.full_name,
            photos: p.photos || [],
            location: `${p.location_city || ''}${p.location_city && p.location_country ? ', ' : ''}${p.location_country || ''}`.trim() || 'Location not set',
            age: candidateAge || (p.date_of_birth ? Math.floor((new Date() - new Date(p.date_of_birth)) / (1000 * 60 * 60 * 24 * 365)) : null),
            isPremium: p.is_premium,
            identifyAs: p.identify_as,
            compatibilityScore: validScore,
            matchLabel: getMatchLabel(validScore),
            breakdown,
            distance: p.distance || null,
            // Store full profile for navigation
            profile: p
          };
        })
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore) // Rank by compatibility score
        .slice(0, 6); // Return top 6 matches

      setSuggestedProfiles(suggested);
    } catch (error) {
      console.error('Error fetching suggested profiles:', error);
    }
  };

  const getStatusBadge = (status) => {
    // Normalize status to lowercase for case-insensitive matching
    const normalizedStatus = status ? String(status).toLowerCase().trim() : 'pending_review';
    
    const statusConfig = {
      'pending_review': { 
        label: 'Pending Review', 
        bg: 'bg-yellow-100', 
        text: 'text-yellow-800', 
        border: 'border-yellow-300',
        icon: Clock,
        description: 'Your profile is being reviewed by our team. This usually takes 24-48 hours.'
      },
      'approved': { 
        label: 'Approved', 
        bg: 'bg-green-100', 
        text: 'text-green-800', 
        border: 'border-green-300',
        icon: CheckCircle2,
        description: 'Your profile is live! You can now discover and connect with other members.'
      },
      'rejected': { 
        label: 'Rejected', 
        bg: 'bg-red-100', 
        text: 'text-red-800', 
        border: 'border-red-300',
        icon: XCircle,
        description: 'Your profile needs changes. Please review our guidelines and update your profile.'
      },
      'suspended': { 
        label: 'Suspended', 
        bg: 'bg-orange-100', 
        text: 'text-orange-800', 
        border: 'border-orange-300',
        icon: AlertCircle,
        description: 'Your profile has been temporarily suspended. Please contact support for assistance.'
      }
    };

    return statusConfig[normalizedStatus] || statusConfig['pending_review'];
  };

  const getNextSteps = (profile) => {
    if (!profile) return [];
    
    const steps = [];
    
    // Email verification - check via state
    if (!emailVerified) {
      steps.push({
        id: 'verify_email',
        title: 'Verify Your Email',
        description: 'Confirm your email to be approved and unlock messaging',
        icon: Mail,
        action: () => navigate('/verify-email'),
        priority: 'high'
      });
    }

    // Profile completion
    const onboardingStep = profile.onboarding_step || 0;
    if (onboardingStep < 5) {
      steps.push({
        id: 'complete_profile',
        title: 'Complete Your Profile',
        description: 'Finish your onboarding to get approved faster',
        icon: User,
        action: () => navigate('/onboarding'),
        priority: 'high'
      });
    }

    // Photos
    const photoCount = profile.photos?.length || 0;
    if (photoCount < 4) {
      steps.push({
        id: 'upload_photos',
        title: 'Upload More Photos',
        description: `Add ${4 - photoCount} more photo${4 - photoCount > 1 ? 's' : ''} to increase matches`,
        icon: Camera,
        action: () => navigate('/profile'),
        priority: photoCount === 0 ? 'high' : 'medium'
      });
    }

    // Bio/About Me
    if (!profile.bio || profile.bio.trim().length < 50) {
      steps.push({
        id: 'complete_bio',
        title: 'Write Your About Me',
        description: 'Add a detailed bio (at least 50 characters) to attract better matches',
        icon: FileText,
        action: () => navigate('/profile'),
        priority: 'medium'
      });
    }

    // Preferences
    if (!profile.looking_for_gender || !profile.serious_relationship) {
      steps.push({
        id: 'set_preferences',
        title: 'Set Your Preferences',
        description: 'Define who you\'re looking for to see better matches',
        icon: Sliders,
        action: () => navigate('/profile'),
        priority: 'medium'
      });
    }

    return steps.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }).slice(0, 4); // Show max 4 steps
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 bg-[#FAF7F2] flex items-center justify-center">
        <Helmet><title>Dashboard ... Marryzen</title></Helmet>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#E6B450] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#706B67] font-medium">Finding your people...</p>
        </div>
      </div>
    );
  }

  // Safely get status badge, handle null/undefined status
  const statusConfig = userProfile && userProfile.status ? getStatusBadge(userProfile.status) : null;
  const nextSteps = getNextSteps(userProfile);

  // Check if profile is approved (case-insensitive)
  // Handle null, undefined, or empty string status
  const profileStatus = userProfile?.status;
  const profileStatusLower = profileStatus ? String(profileStatus).toLowerCase().trim() : '';
  const isApproved = profileStatusLower === 'approved';
  
  // Check if user is admin
  const userRole = userProfile?.role?.toLowerCase();
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  
  const marriageTools = [
    { icon: Search, title: 'Find Marriage Matches', description: 'View compatible profiles', action: () => navigate('/discovery'), bg: 'bg-[#EAF2F7]', iconColor: 'text-[#3B82F6]', disabled: false },
    { icon: MessageCircle, title: 'Conversations', description: 'Continue meaningful discussions', action: () => navigate('/chat'), bg: 'bg-[#F0FDF4]', iconColor: 'text-[#22C55E]', disabled: false },
    { icon: Send, title: 'Send Introduction', description: 'Express sincere interest', action: () => navigate('/discovery'), bg: 'bg-[#FDF2F8]', iconColor: 'text-[#EC4899]', disabled: false },
    { icon: Crown, title: 'Upgrade for Serious Features', description: 'Unlock advanced filters', action: () => navigate('/premium'), bg: 'bg-[#FFFBEB]', iconColor: 'text-[#F59E0B]', disabled: false }
  ];

  const handleClaimCredit = async (creditId) => {
    if (claimingCredit) return;
    setClaimingCredit(true);
    try {
      const { data, error } = await supabase.rpc('claim_premium_credit', { p_credit_id: creditId });
      if (error) throw error;
      if (data && data.ok) {
        const newExpiry = new Date(data.new_expiry).toLocaleDateString();
        toast({ title: 'Free month activated', description: 'Your Premium runs through ' + newExpiry + '.' });
        setUnclaimedCredits(prev => prev.filter(c => c.id !== creditId));
        if (userProfile) setUserProfile({ ...userProfile, is_premium: true, premium_expires_at: data.new_expiry });
      } else {
        toast({ title: 'Could not claim credit', description: (data && data.error) || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) {
      console.error('Claim failed:', e);
      toast({ title: 'Could not claim credit', description: e.message || 'Try again', variant: 'destructive' });
    } finally {
      setClaimingCredit(false);
    }
  };

  return (
    <div className="min-h-screen p-4 bg-[#FAF7F2]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-[#1F1F1F]">Welcome to Marryzen</h1>
              <p className="text-[#706B67] mt-1">A marriage-focused platform for serious relationships.</p>
            </div>
          </div>

          {/* Sprint B — Profile Health consolidation.
              Counts how many actionable banners would show; when >1, defaults
              to a single collapsible card so the dashboard isn't a banner-wall.
              When the count is 1 we still wrap for visual consistency but
              start expanded. Each inner banner keeps its own dismiss/action
              behavior — we only consolidated the visual container. */}
          {(() => {
            const showStatusBanner = userProfile && statusConfig && userProfile.status !== 'approved' && !statusBannerDismissed;
            const showPremiumCredit = unclaimedCredits && unclaimedCredits.length > 0;
            const showNameMismatch = userProfile && userProfile.identity_verification_status === 'name_mismatch';
            const showVerifyId = userProfile && !userProfile.is_verified && (userProfile.identity_verification_status || '').toLowerCase() !== 'approved' && userProfile.identity_verification_status !== 'name_mismatch';
            const showMarriageTimeline = userProfile && !userProfile.marriage_timeline;
            const showPromptsBanner = userProfile && (!userProfile.prompts || userProfile.prompts.length < 3);
            const totalActionable = [showStatusBanner, showPremiumCredit, showNameMismatch, showVerifyId, showMarriageTimeline, showPromptsBanner].filter(Boolean).length;
            if (totalActionable === 0) return null;
            return (
              <div className="mb-4 rounded-xl bg-white border border-[#E6DCD2] shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={toggleProfileHealth}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-[#FAF7F2] transition-colors text-left"
                  aria-expanded={profileHealthExpanded}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#FFFBEB] border border-[#E6B450]/40 flex items-center justify-center">
                      <span className="text-sm font-bold text-[#8a6c1e]">{totalActionable}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#1F1F1F]">
                        {totalActionable === 1 ? '1 thing to take care of' : `${totalActionable} things to take care of`}
                      </h3>
                      <p className="text-xs text-[#706B67] mt-0.5">{profileHealthExpanded ? 'Tap to collapse' : 'Tap to see what needs your attention'}</p>
                    </div>
                  </div>
                  {profileHealthExpanded
                    ? <ChevronUp className="w-5 h-5 text-[#706B67] shrink-0" />
                    : <ChevronDown className="w-5 h-5 text-[#706B67] shrink-0" />}
                </button>
                {profileHealthExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-[#F0EDE9] pt-4">
          {/* Profile Status Banner - Only show once, dismissible */}
          {userProfile && statusConfig && userProfile.status !== 'approved' && !statusBannerDismissed && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: 0.1 }}
              className={`${statusConfig.bg} ${statusConfig.border} border rounded-xl p-4 mb-4 flex items-start justify-between relative`}
            >
              <div className="flex items-start gap-3 flex-1">
                <statusConfig.icon className={`w-5 h-5 ${statusConfig.text} mt-0.5 flex-shrink-0`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-bold ${statusConfig.text}`}>Profile Status: {statusConfig.label}</h3>
                  </div>
                  <p className={`text-sm ${statusConfig.text} opacity-90`}>{statusConfig.description}</p>
                  {(userProfile.status?.toLowerCase()?.trim() === 'pending_review') && (
                    <Button 
                      size="sm" 
                      onClick={() => navigate('/profile?openVerify=1')} 
                      className="mt-3 bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold"
                    >
                      Complete Profile
                    </Button>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setStatusBannerDismissed(true);
                  localStorage.setItem('status_banner_dismissed', 'true');
                  localStorage.setItem('status_banner_shown', 'true');
                }}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* ID Verification Banner ... every member must be Didit-verified to start matching */}
          {/* Premium Credit Banner */}
          {unclaimedCredits && unclaimedCredits.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="bg-gradient-to-r from-[#FFFBEB] to-[#FFF7DD] border border-[#E6B450] rounded-xl p-4 flex items-start gap-3">
              <Gift className="w-6 h-6 text-[#8a6c1e] mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-bold text-[#1F1F1F] mb-1">{unclaimedCredits.length === 1 ? '1 free month of Premium is ready' : unclaimedCredits.length + ' free months of Premium ready'}</h3>
                <p className="text-sm text-[#706B67] mb-3">Earned from your referrals. Activate when you're ready - the 30-day clock starts the moment you claim.</p>
                <button onClick={() => handleClaimCredit(unclaimedCredits[0].id)} disabled={claimingCredit} className="bg-[#E6B450] hover:bg-[#D0A23D] disabled:opacity-50 text-[#1F1F1F] font-semibold px-4 py-2 rounded-lg text-sm transition-colors">{claimingCredit ? 'Activating...' : 'Activate 1 month'}</button>
              </div>
            </motion.div>
          )}

          {/* Name mismatch banner */}
          {userProfile && userProfile.identity_verification_status === 'name_mismatch' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-[#B91C1C] mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-bold text-[#7F1D1D] mb-1">ID name doesn't match your profile</h3>
                <p className="text-sm text-[#991B1B] mb-3">Your ID verified, but the name on your document {userProfile.id_name_on_record ? '(' + userProfile.id_name_on_record + ')' : ''} doesn't match your profile. Update your profile name to your legal first name (last initial is fine) and your verification will complete automatically.</p>
                <button onClick={() => navigate('/profile')} className="bg-[#B91C1C] hover:bg-[#991B1B] text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">Update profile name</button>
              </div>
            </motion.div>
          )}

          {userProfile && !userProfile.is_verified && (userProfile.identity_verification_status || '').toLowerCase() !== 'approved' && userProfile.identity_verification_status !== 'name_mismatch' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="bg-gradient-to-r from-[#FFF7E1] to-[#FFF1CD] border border-[#E6B450] rounded-xl p-4 flex items-start gap-3"
            >
              <ShieldCheck className="w-6 h-6 text-[#8a6c1e] mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-bold text-[#1F1F1F] mb-1">Verify your identity to start matching</h3>
                <p className="text-sm text-[#5e4e1f] leading-relaxed">
                  Marryzen is the verified marriage app. Every member completes a quick ID check before they can view profiles or send messages. It takes about 60 seconds.
                </p>
                <Button
                  size="sm"
                  onClick={() => navigate('/profile?openVerify=1')}
                  className="mt-3 bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold"
                >
                  Verify my identity
                </Button>
              </div>
            </motion.div>
          )}

          {/* Marriage Timeline Banner ... self-select seriousness */}
          {userProfile && !userProfile.marriage_timeline && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.13 }}
              className="bg-white border border-[#E6DCD2] rounded-xl p-4"
            >
              <h3 className="font-bold text-[#1F1F1F] mb-1">When are you hoping to get married?</h3>
              <p className="text-sm text-[#706B67] mb-3">
                We show this on your profile so other members can see you're serious. You can change it later.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: 'within_6mo', label: 'Within 6 months' },
                  { value: 'within_1y', label: 'Within 1 year' },
                  { value: 'within_2y', label: 'Within 2 years' },
                  { value: 'open', label: "I'm open" }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={async () => {
                      const { data: updated, error } = await supabase
                        .from('profiles')
                        .update({ marriage_timeline: opt.value })
                        .eq('id', userProfile.id)
                        .select('*')
                        .maybeSingle();
                      if (!error && updated) { setUserProfile(updated); funnel.timelineSet({ value: opt.value }); }
                    }}
                    className="px-3 py-2 rounded-lg border border-[#E6DCD2] hover:border-[#E6B450] hover:bg-[#FFFBEB] text-sm font-medium text-[#1F1F1F] transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Prompts Banner ... Hinge-style three prompts to make profiles feel like marriage-intent profiles */}
          {userProfile && (!userProfile.prompts || userProfile.prompts.length < 3) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="bg-white border border-[#E6DCD2] rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <div className="flex-1">
                <h3 className="font-bold text-[#1F1F1F] mb-1">Help your future spouse meet you</h3>
                <p className="text-sm text-[#706B67]">
                  Pick three prompts and write short answers. Profiles with prompts get up to 3x more conversations.
                </p>
              </div>
              <Button
                onClick={() => setShowPromptsEditor(true)}
                className="bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold flex-shrink-0"
              >
                Add prompts
              </Button>
            </motion.div>
          )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Safety Notice — admins only, dismissible once-per-account via localStorage flag */}
          {isAdmin && safetyNoticeVisible && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.15 }}
              className="bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-between p-4 rounded-xl"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ShieldCheck className="w-5 h-5 text-[#15803D] flex-shrink-0" />
                <p className="text-sm text-[#166534] font-medium">All members have confirmed serious marriage intentions.</p>
              </div>
              <button
                type="button"
                aria-label="Dismiss notice"
                onClick={() => {
                  try { localStorage.setItem('mrz_safety_notice_dismissed', '1'); } catch {}
                  setSafetyNoticeVisible(false);
                }}
                className="text-[#15803D] hover:text-[#0F5A2A] p-1 rounded transition-colors flex-shrink-0 ml-3"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </motion.div>
        
        {/* Stats Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.2 }} 
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {/* Sprint A — all 4 stat squares now clickable with correct destinations.
              Empty-state copy is motivational, not "0 X = failure" framing.
              The Profile Interest stat blurs for non-premium users + nudges upgrade. */}
          <button
            type="button"
            onClick={() => navigate('/discovery')}
            className="bg-white border border-[#E6DCD2] rounded-2xl p-4 sm:p-6 text-center shadow-sm cursor-pointer hover:border-[#C85A72] hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[#C85A72]/40"
          >
            <Heart className="w-8 h-8 text-[#C85A72] mx-auto mb-2" />
            <div className="text-3xl font-bold text-[#1F1F1F]">{stats.potentialMatches}</div>
            <div className="text-[#706B67] text-sm font-medium">
              {stats.potentialMatches === 0 ? 'Find profiles' : 'Profiles for you'}
            </div>
            <div className="text-[#C85A72] text-xs font-semibold mt-1">
              {stats.potentialMatches === 0 ? 'Get started →' : 'Browse now →'}
            </div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/chat')}
            className="bg-white border border-[#E6DCD2] rounded-2xl p-4 sm:p-6 text-center shadow-sm cursor-pointer hover:border-[#3B82F6] hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
          >
            <MessageCircle className="w-8 h-8 text-[#3B82F6] mx-auto mb-2" />
            <div className="text-3xl font-bold text-[#1F1F1F]">{stats.conversations}</div>
            <div className="text-[#706B67] text-sm font-medium">
              {stats.conversations === 0 ? 'Start chatting' : 'Conversations'}
            </div>
            <div className="text-[#3B82F6] text-xs font-semibold mt-1">
              {stats.conversations === 0 ? 'Find someone →' : 'Open inbox →'}
            </div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/discovery')}
            className="bg-white border border-[#E6DCD2] rounded-2xl p-4 sm:p-6 text-center shadow-sm cursor-pointer hover:border-[#EC4899] hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[#EC4899]/40"
          >
            <Send className="w-8 h-8 text-[#EC4899] mx-auto mb-2" />
            <div className="text-3xl font-bold text-[#1F1F1F]">{stats.introductionsSent}</div>
            <div className="text-[#706B67] text-sm font-medium">
              {stats.introductionsSent === 0 ? 'Send your first' : 'Introductions'}
            </div>
            <div className="text-[#EC4899] text-xs font-semibold mt-1">
              {stats.introductionsSent === 0 ? 'Get started →' : 'Send another →'}
            </div>
          </button>
          <button
            type="button"
            onClick={() => userProfile?.is_premium ? navigate('/matches') : openPremiumModal()}
            className="bg-white border border-[#E6DCD2] rounded-2xl p-4 sm:p-6 text-center shadow-sm cursor-pointer hover:border-[#E6B450] hover:shadow-md transition-all relative focus:outline-none focus:ring-2 focus:ring-[#E6B450]/40"
          >
            <Star className="w-8 h-8 text-[#F59E0B] mx-auto mb-2" />
            {userProfile?.is_premium ? (
              <>
                <div className="text-3xl font-bold text-[#1F1F1F]">{stats.profileInterest}</div>
                <div className="text-[#706B67] text-sm font-medium">Profile Interest</div>
                <div className="text-[#E6B450] text-xs font-semibold mt-1">View matches →</div>
              </>
            ) : (
              <>
                {/* Non-premium: blur the count + show unlock nudge — Hinge/Tinder pattern.
                    Phase 56 2026-06-12: CSS blur is visual-only — screen readers still
                    announce the real number. Hide the blurred node from AT and surface
                    a sr-only fallback so assistive-tech users get the lock-message
                    instead of the real count (which they shouldn't see). */}
                <div aria-hidden="true" className="text-3xl font-bold text-[#1F1F1F] blur-sm select-none">{stats.profileInterest || '?'}</div>
                <span className="sr-only">Profile Interest count is hidden. Upgrade to Premium to see who&rsquo;s interested.</span>
                <div className="text-[#706B67] text-sm font-medium">Profile Interest</div>
                <div className="text-[#E6B450] text-xs font-semibold mt-1 flex items-center justify-center gap-1">
                  <Crown size={11} className="fill-[#E6B450]" />
                  Unlock with Premium
                </div>
              </>
            )}
          </button>
        </motion.div>

        {/* Two Column Layout: Next Steps + Marriage Tools */}
        <div className="space-y-6 mb-8">
          {/* Next Steps Widget */}
          {nextSteps.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.3 }}
              className=""
            >
              <div className="bg-white border border-[#E6DCD2] rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-bold text-[#1F1F1F] mb-4 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-[#E6B450]" />
                  Next Steps
                </h2>
                <div className="space-y-3">
                  {nextSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className="p-3 rounded-lg border border-[#E6DCD2] hover:border-[#E6B450] transition-colors cursor-pointer"
                      onClick={step.action}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${step.priority === 'high' ? 'bg-red-50' : 'bg-blue-50'}`}>
                          <step.icon className={`w-4 h-4 ${step.priority === 'high' ? 'text-red-600' : 'text-blue-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[#1F1F1F] text-sm mb-1">{step.title}</h3>
                          <p className="text-xs text-[#706B67]">{step.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Marriage Tools */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.35 }}
            className=""
          >
          <h2 className="text-2xl font-bold text-[#1F1F1F] mb-6">Marriage Tools</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {marriageTools.map((tool, index) => (
                <motion.div
                  key={index}
                  whileHover={!tool.disabled ? { scale: 1.02 } : {}}
                  whileTap={!tool.disabled ? { scale: 0.98 } : {}}
                  className={`bg-white border border-[#E6DCD2] rounded-2xl p-6 cursor-pointer shadow-sm transition-all ${
                    tool.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'
                  }`}
                  onClick={tool.disabled ? undefined : tool.action}
                >
                  <div className={`w-12 h-12 rounded-full ${tool.bg} flex items-center justify-center mb-4`}>
                    <tool.icon className={`w-6 h-6 ${tool.iconColor}`} />
                  </div>
                <h3 className="text-lg font-bold text-[#1F1F1F] mb-1">{tool.title}</h3>
                <p className="text-[#706B67] text-sm font-medium">{tool.description}</p>
                  {tool.disabled && (
                    <p className="text-xs text-orange-600 mt-2 font-medium">Requires profile approval</p>
                  )}
              </motion.div>
            ))}
          </div>
        </motion.div>
        </div>

        {/* Suggested Profiles (only show if approved) */}
        {(userProfile?.status?.toLowerCase()?.trim() === 'approved') && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.4 }}
          >
          <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#1F1F1F]">Top Compatibility Matches</h2>
                <p className="text-[#706B67] text-sm mt-1">Ranked by compatibility algorithm</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/discovery')} className="border-[#E6B450] text-[#E6B450] hover:bg-[#FFFBEB]">
                View All
              </Button>
          </div>
            {suggestedProfiles.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-6">
                {suggestedProfiles.map((profile) => (
                  <motion.div
                    key={profile.id}
                    whileHover={{ y: -5 }}
                    className="bg-white rounded-2xl overflow-hidden cursor-pointer shadow-sm border border-[#E6DCD2]"
                    onClick={() => navigate(`/profile/${profile.id}`)}
                  >
                    <div className="aspect-[3/4] relative bg-slate-100">
                      {profile.photos?.[0] ? (
                        <img loading="lazy" decoding="async"
                          className="w-full h-full object-cover object-top"
                          alt={profile.name}
                          src={profile.photos[0]}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <User className="w-16 h-16" />
                        </div>
                      )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white pt-12">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                              {profile.name}
                              {profile.age && <span className="text-base font-normal opacity-90">, {profile.age}</span>}
                              {profile.isPremium && (
                                <Crown className="w-4 h-4 text-[#E6B450] fill-[#E6B450]" />
                              )}
                            </h3>
                            <p className="text-white/90 text-sm font-medium mt-1">{profile.location}</p>
                            {profile.distance !== null && (
                              <p className="text-white/80 text-xs mt-1">{Math.round(profile.distance)} km away</p>
                            )}
                          </div>
                          {profile.compatibilityScore !== undefined && typeof profile.compatibilityScore === 'number' && !isNaN(profile.compatibilityScore) && profile.compatibilityScore > 0 && (
                            <div className="text-right">
                              <Badge className="bg-[#E6B450] text-[#1F1F1F] font-bold text-base px-3 py-1">
                                {profile.compatibilityScore}%
                              </Badge>
                              <p className="text-[#E6B450] text-xs font-bold mt-1">{profile.matchLabel}</p>
                            </div>
                          )}
                        </div>
                        <p className="font-bold text-xs text-[#E6B450] mt-2 uppercase tracking-wide">
                          Marriage Intent: Serious
                        </p>
                  </div>
                </div>
              </motion.div>
            ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E6DCD2] p-12 text-center">
                <Search className="w-12 h-12 text-[#706B67] mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-[#1F1F1F] mb-2">No suggestions right now</h3>
                <p className="text-[#706B67] mb-6">Check back soon for new profiles!</p>
                <Button onClick={() => navigate('/discovery')} className="bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F]">
                  Browse Discovery
                </Button>
          </div>
            )}
        </motion.div>
        )}

        <PromptsEditorModal
          isOpen={showPromptsEditor}
          onClose={() => setShowPromptsEditor(false)}
          currentPrompts={userProfile?.prompts || []}
          onSaved={(saved) => { setUserProfile(prev => prev ? { ...prev, prompts: saved } : prev); funnel.promptsSaved({ count: saved.length }); }}
        />

        <Footer />
      </div>
    </div>
  );
};

export default DashboardPage;
