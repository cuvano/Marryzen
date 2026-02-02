import React, { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
  Heart, MessageCircle, Star, Send, Settings, Search, Crown, ShieldCheck, 
  AlertCircle, CheckCircle2, XCircle, Upload, User, Mail, Sliders,
  Camera, FileText, Clock, ArrowRight, X
} from 'lucide-react';
import { PremiumModalContext } from '@/contexts/PremiumModalContext';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/customSupabaseClient';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { calculateScore, getMatchLabel } from '@/lib/matchmaking';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { openPremiumModal } = useContext(PremiumModalContext);
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState(null);
  const [suggestedProfiles, setSuggestedProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusBannerDismissed, setStatusBannerDismissed] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  
  const [stats, setStats] = useState({
    potentialMatches: 0,
    conversations: 0,
    introductionsSent: 0,
    profileInterest: 0
  });
  const [referralInfo, setReferralInfo] = useState(null);

  useEffect(() => {
    // Check if status banner was dismissed or if it was already shown once
    const dismissed = localStorage.getItem('status_banner_dismissed');
    const statusShown = localStorage.getItem('status_banner_shown');
    
    if (dismissed || statusShown) {
      setStatusBannerDismissed(true);
    }

    const init = async () => {
      setLoading(true);
      try {
      const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Check email verification status
        setEmailVerified(user.email_confirmed_at !== null);

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
          
          // Debug: Log profile status
          console.log('Dashboard - Initial Profile Load:', {
            status: profile.status,
            statusType: typeof profile.status,
            statusLower: profile.status?.toLowerCase()?.trim(),
            isApproved: profile.status?.toLowerCase()?.trim() === 'approved',
            fullProfile: profile
          });
          
          // Fetch real stats from database
          await fetchRealStats(user.id, profile);
          
          // Fetch suggested profiles only if approved (case-insensitive check)
          const profileStatusLower = profile.status?.toLowerCase()?.trim();
          if (profileStatusLower === 'approved') {
            await fetchSuggestedProfiles(user.id, profile);
          }
        } else {
          console.log('Dashboard - No profile found');
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
          
          // Debug logging
          console.log('Dashboard - Profile Status Refresh:', {
            status: profile.status,
            statusLower: profile.status?.toLowerCase()?.trim(),
            isApproved: profile.status?.toLowerCase()?.trim() === 'approved'
          });
        }
      } catch (error) {
        console.error('Error refreshing profile status:', error);
      }
    };
    
    const interval = setInterval(refreshProfileStatus, 10000); // Check every 10 seconds
    const handleFocus = () => refreshProfileStatus();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshProfileStatus();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate, toast]);

  // Auto-dismiss status banner after showing once (5 seconds)
  useEffect(() => {
    if (userProfile?.status && !statusBannerDismissed) {
      const statusShown = localStorage.getItem('status_banner_shown');
      if (!statusShown) {
        // Auto-dismiss after 5 seconds
        const timer = setTimeout(() => {
          setStatusBannerDismissed(true);
          localStorage.setItem('status_banner_shown', 'true');
        }, 5000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [userProfile?.status, statusBannerDismissed]);

  const fetchRealStats = async (userId, profile) => {
    try {
      // 1. Potential Matches: Count of approved profiles user hasn't interacted with
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

      // Get all approved profiles, then filter client-side (more reliable)
      const { data: allApproved, error: approvedError } = await supabase
        .from('profiles')
        .select('id')
        .eq('status', 'approved');

      if (approvedError) throw approvedError;

      const potentialMatches = (allApproved || []).filter(p => !excludeIds.has(p.id)).length;

      // 2. Conversations: Count of conversations where user is participant
      const { count: conversations } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

      // 3. Introductions Sent: Count of 'like' interactions (these are introductions)
      const { count: introductionsSent } = await supabase
        .from('user_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('interaction_type', 'like');

      // 4. Profile Interest: Count of users who liked this profile (likes where this user is the target)
      const { count: profileInterest } = await supabase
        .from('user_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('target_user_id', userId)
        .eq('interaction_type', 'like');

      setStats({
        potentialMatches,
        conversations: conversations || 0,
        introductionsSent: introductionsSent || 0,
        profileInterest: profileInterest || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
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
      let query = supabase
        .from('profiles')
        .select('*')
        .eq('status', 'approved')
        .limit(50); // Fetch more for better algorithm ranking

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
        description: 'Verify your email address to unlock messaging',
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
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#E6B450] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#706B67] font-medium">Loading dashboard...</p>
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
    { icon: Search, title: 'Find Marriage Matches', description: 'View compatible profiles', action: () => navigate('/discovery'), bg: 'bg-[#EAF2F7]', iconColor: 'text-[#3B82F6]', disabled: !isApproved },
    { icon: MessageCircle, title: 'Conversations', description: 'Continue meaningful discussions', action: () => navigate('/chat'), bg: 'bg-[#F0FDF4]', iconColor: 'text-[#22C55E]', disabled: false },
    { icon: Send, title: 'Send Introduction', description: 'Express sincere interest', action: () => navigate('/discovery'), bg: 'bg-[#FDF2F8]', iconColor: 'text-[#EC4899]', disabled: !isApproved },
    { icon: Crown, title: 'Upgrade for Serious Features', description: 'Unlock advanced filters', action: () => navigate('/premium'), bg: 'bg-[#FFFBEB]', iconColor: 'text-[#F59E0B]', disabled: false }
  ];

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
            <Button variant="outline" onClick={() => navigate('/profile')} className="bg-white border-[#E6DCD2] text-[#333333] hover:bg-[#FAF7F2] hidden sm:flex">
              <Settings className="w-4 h-4 mr-2" /> My Profile
            </Button>
          </div>

          {/* Profile Status Banner - Only show once, dismissible */}
          {userProfile && statusConfig && !statusBannerDismissed && (
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
                      onClick={() => navigate('/profile')} 
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

          {/* Safety Notice - Only show to admins */}
          {isAdmin && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.15 }}
              className="bg-[#F0FDF4] border border-[#BBF7D0] flex items-center p-4 rounded-xl"
            >
              <ShieldCheck className="w-5 h-5 text-[#15803D] mr-3 flex-shrink-0" />
              <p className="text-sm text-[#166534] font-medium">All members have confirmed serious marriage intentions.</p>
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
          <div className="bg-white border border-[#E6DCD2] rounded-2xl p-6 text-center shadow-sm">
            <Heart className="w-8 h-8 text-[#C85A72] mx-auto mb-2" />
            <div className="text-3xl font-bold text-[#1F1F1F]">{stats.potentialMatches}</div>
            <div className="text-[#706B67] text-sm font-medium">Potential Matches</div>
          </div>
          <div className="bg-white border border-[#E6DCD2] rounded-2xl p-6 text-center shadow-sm">
            <MessageCircle className="w-8 h-8 text-[#3B82F6] mx-auto mb-2" />
            <div className="text-3xl font-bold text-[#1F1F1F]">{stats.conversations}</div>
            <div className="text-[#706B67] text-sm font-medium">Conversations</div>
          </div>
          <div className="bg-white border border-[#E6DCD2] rounded-2xl p-6 text-center shadow-sm">
            <Send className="w-8 h-8 text-[#EC4899] mx-auto mb-2" />
            <div className="text-3xl font-bold text-[#1F1F1F]">{stats.introductionsSent}</div>
            <div className="text-[#706B67] text-sm font-medium">Introductions Sent</div>
          </div>
          <div 
            className="bg-white border border-[#E6DCD2] rounded-2xl p-6 text-center shadow-sm cursor-pointer hover:border-[#E6B450] transition-colors"
            onClick={() => userProfile?.is_premium ? navigate('/matches') : openPremiumModal()}
          >
            <Star className="w-8 h-8 text-[#F59E0B] mx-auto mb-2" />
            <div className="text-3xl font-bold text-[#1F1F1F]">{stats.profileInterest}</div>
            <div className="text-[#706B67] text-sm font-medium">Profile Interest</div>
          </div>
        </motion.div>

        {/* Two Column Layout: Next Steps + Marriage Tools */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Next Steps Widget */}
          {nextSteps.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.3 }}
              className="lg:col-span-1"
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
            className={nextSteps.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}
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
                        <img
                          className="w-full h-full object-cover"
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

        <Footer />
      </div>
    </div>
  );
};

export default DashboardPage;
