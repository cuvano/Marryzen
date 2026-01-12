import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import PremiumUpgradeModal from '@/components/PremiumUpgradeModal';
import { 
  SlidersHorizontal, Search, RotateCcw, Heart, Save, BookHeart, 
  Clock, Flame, Star, MapPin, Loader2, MoreHorizontal, Undo2,
  Trash2, Check, Shield, X, ArrowRight, Settings, Crown
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { PremiumModalContext } from '@/contexts/PremiumModalContext';
import { calculateScore, getMatchLabel } from '@/lib/matchmaking';
import Footer from '@/components/Footer';
import FilterPanel from '@/components/discovery/FilterPanel';
import ProfileCard from '@/components/discovery/ProfileCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

const DiscoveryPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { openPremiumModal } = useContext(PremiumModalContext);
  
  // -- State --
  const [currentUser, setCurrentUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [matchingConfig, setMatchingConfig] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // History & Undo
  const [lastAction, setLastAction] = useState(null); // { type: 'like'|'pass', profileId, interactionId, timestamp }
  const [undoTimer, setUndoTimer] = useState(0);

  // Favorites
  const [favorites, setFavorites] = useState(new Set());
  
  // Usage tracking
  const [dailyLikeCount, setDailyLikeCount] = useState(0);
  const LIKE_LIMIT_FREE = 50;
  
  // Throttling state
  const [lastActionTime, setLastActionTime] = useState(0);
  const [rapidLikeCount, setRapidLikeCount] = useState(0);
  const [lastRapidLikeReset, setLastRapidLikeReset] = useState(Date.now());
  const actionDebounceTime = 500; // 500ms minimum between actions
  const rapidLikeWindow = 60000; // 1 minute window
  const rapidLikeThreshold = 10; // More than 10 likes in 1 minute triggers cooldown

  // Preferences & Saved
  const [savedPreferences, setSavedPreferences] = useState([]);
  const [activePreferenceId, setActivePreferenceId] = useState(null);
  const [isSavePrefModalOpen, setIsSavePrefModalOpen] = useState(false);
  const [newPrefName, setNewPrefName] = useState('');
  
  // Premium Modal
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [premiumModalFeature, setPremiumModalFeature] = useState(null);

  // Filters State
  const defaultFilters = {
    ageRange: [18, 65],
    distance: 50, // km
    city: '',
    faith: '',
    faithLifestyle: '',
    smoking: '',
    drinking: '',
    maritalStatus: '',
    hasChildren: '',
    educationLevel: '',
    relationshipGoal: '',
    languages: [],
    zodiacSign: '',
    countries: [],
    // Premium
    recentActive: false,
    verifiedOnly: false,
  };
  
  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem('discovery_filters');
    return saved ? JSON.parse(saved) : defaultFilters;
  });

  // Load Initial Data
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/login');

      // Profile
      const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (profileError && profileError.code !== 'PGRST116' && profileError.code !== 'NOT_FOUND') {
        console.error('Profile fetch error:', profileError);
      }
      if (profile) {
        setCurrentUser(profile);
      }

      // Config
      const { data: config, error: configError } = await supabase.from('matching_config').select('*').maybeSingle();
      if (configError && configError.code !== 'PGRST116' && configError.code !== 'NOT_FOUND') {
        console.error('Matching config error:', configError);
      }
      setMatchingConfig(config);

      // Saved Prefs
      const { data: prefs } = await supabase.from('user_preferences').select('*').eq('user_id', user.id);
      setSavedPreferences(prefs || []);

      // Favorites
      const { data: favs } = await supabase.from('favorites').select('favorited_user_id').eq('user_id', user.id);
      setFavorites(new Set(favs?.map(f => f.favorited_user_id) || []));

      setLoading(false);
    };
    init();
  }, [navigate]);

  // Persist Filters
  useEffect(() => {
    localStorage.setItem('discovery_filters', JSON.stringify(filters));
  }, [filters]);

  // Undo Timer Effect
  useEffect(() => {
    let interval;
    if (lastAction && undoTimer > 0) {
      interval = setInterval(() => setUndoTimer(t => t - 1), 1000);
    } else if (undoTimer <= 0) {
      setLastAction(null);
    }
    return () => clearInterval(interval);
  }, [lastAction, undoTimer]);


  // -- Fetching Profiles --
  useEffect(() => {
    if (!currentUser || !matchingConfig) return;
    
    // Debounce fetch
    const timeout = setTimeout(() => {
        fetchProfiles();
    }, 500);
    return () => clearTimeout(timeout);
  }, [filters, searchQuery, currentUser, matchingConfig]);


  const fetchProfiles = async () => {
    setLoading(true);

    try {
        // 1. Interactions to exclude
        const { data: interactions } = await supabase.from('user_interactions').select('target_user_id').eq('user_id', currentUser.id);
        const { data: blocked } = await supabase.from('user_blocks').select('blocked_user_id').eq('blocker_id', currentUser.id);
        const { data: reports } = await supabase.from('user_reports').select('reported_user_id').eq('reporter_id', currentUser.id);

        const excludeIds = new Set([
            currentUser.id,
            ...(interactions?.map(i => i.target_user_id) || []),
            ...(blocked?.map(b => b.blocked_user_id) || []),
            ...(reports?.map(r => r.reported_user_id) || [])
        ]);

        let query = supabase.from('profiles').select('*').eq('status', 'approved');

        // Apply Server-Side Filters
        if (filters.city) query = query.ilike('location_city', `%${filters.city}%`);
        if (filters.faith) query = query.eq('religious_affiliation', filters.faith);
        if (filters.faithLifestyle) query = query.eq('faith_lifestyle', filters.faithLifestyle);
        if (filters.maritalStatus) query = query.eq('marital_history', filters.maritalStatus);
        if (filters.educationLevel) query = query.eq('education_level', filters.educationLevel);
        if (filters.relationshipGoal) query = query.eq('relationship_goal', filters.relationshipGoal);
        
        // Premium Server Filters
        if (currentUser.is_premium) {
            if (filters.countries && filters.countries.length > 0) {
                query = query.in('country_of_residence', filters.countries);
            }
        }

        const { data: candidates, error } = await query;
        if (error) throw error;

        // Apply Client-Side Filtering & Scoring
        let processed = candidates
            .filter(p => !excludeIds.has(p.id))
            .filter(p => {
                // Age
                const age = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
                if (age < filters.ageRange[0] || age > filters.ageRange[1]) return false;

                // Search Query (Bio or Name)
                if (searchQuery) {
                    const text = `${p.full_name} ${p.bio || ''} ${p.occupation || ''} ${p.education || ''}`.toLowerCase();
                    if (!text.includes(searchQuery.toLowerCase())) return false;
                }

                // Complex Filters
                if (filters.smoking && p.smoking !== filters.smoking) return false;
                if (filters.drinking && p.drinking !== filters.drinking) return false;
                if (filters.hasChildren && String(p.has_children) !== filters.hasChildren) return false;
                if (filters.educationLevel && p.education_level !== filters.educationLevel) return false;
                if (filters.zodiacSign && p.zodiac_sign !== filters.zodiacSign) return false;
                
                // Premium Checks
                if (currentUser.is_premium) {
                    if (filters.verifiedOnly && !p.is_verified) return false;
                    if (filters.recentActive && p.last_active_at) {
                         const daysSinceActive = (new Date() - new Date(p.last_active_at)) / (1000 * 60 * 60 * 24);
                         if (daysSinceActive > 30) return false;
                    }
                    if (filters.languages && filters.languages.length > 0) {
                        const profileLangs = p.languages || [];
                        if (!filters.languages.some(lang => profileLangs.includes(lang))) return false;
                    }
                }

                // Distance (Mock Calculation if coords missing, or just simple check)
                // Real implementation would use Haversine here if lat/lng present
                if (currentUser.latitude && currentUser.longitude && p.latitude && p.longitude) {
                     const R = 6371; // km
                     const dLat = (p.latitude - currentUser.latitude) * Math.PI / 180;
                     const dLon = (p.longitude - currentUser.longitude) * Math.PI / 180;
                     const a = 
                        Math.sin(dLat/2) * Math.sin(dLat/2) +
                        Math.cos(currentUser.latitude * Math.PI / 180) * Math.cos(p.latitude * Math.PI / 180) * 
                        Math.sin(dLon/2) * Math.sin(dLon/2);
                     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                     const dist = R * c;
                     p.distance = dist;
                     
                     // Only apply distance filter if we have data and it's set
                     if (currentUser.is_premium && dist > filters.distance) return false;
                }

                return true;
            })
            .map(p => {
                const { score } = calculateScore(currentUser, p, matchingConfig);
                return {
                    ...p,
                    age: new Date().getFullYear() - new Date(p.date_of_birth).getFullYear(),
                    compatibilityScore: score,
                    matchLabel: getMatchLabel(score)
                };
            })
            .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

        setProfiles(processed);
    } catch (err) {
        console.error("Fetch error", err);
        toast({ title: "Error loading profiles", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };


  // -- Actions --

  const handleInteraction = async (target, type) => {
    const now = Date.now();
    
    // Throttling: Prevent rapid actions (500ms minimum between actions)
    if (now - lastActionTime < actionDebounceTime) {
      toast({ 
        title: "Please wait", 
        description: "Please wait a moment before your next action.",
        variant: "destructive" 
      });
      return;
    }
    
    // Abuse prevention: Check for rapid likes (anti-spam)
    if (type === 'like') {
      // Reset rapid like counter if window expired
      if (now - lastRapidLikeReset > rapidLikeWindow) {
        setRapidLikeCount(0);
        setLastRapidLikeReset(now);
      }
      
      // Check if user is liking too rapidly
      if (rapidLikeCount >= rapidLikeThreshold) {
        const cooldownSeconds = Math.ceil((rapidLikeWindow - (now - lastRapidLikeReset)) / 1000);
        toast({ 
          title: "Please Slow Down", 
          description: `You're liking profiles too quickly. Please wait ${cooldownSeconds} seconds before continuing. This helps ensure quality matches.`,
          variant: "destructive" 
        });
        return;
      }
      
      // Check daily like limit for free users
      if (!currentUser?.is_premium && dailyLikeCount >= LIKE_LIMIT_FREE) {
        toast({ 
          title: "Daily Limit Reached", 
          description: `You've reached the daily limit of ${LIKE_LIMIT_FREE} likes. Upgrade to Premium for unlimited likes.`,
          variant: "destructive" 
        });
        openPremiumModal && openPremiumModal();
        return;
      }
    }

    setLastActionTime(now);

    // Optimistic Update
    setProfiles(prev => prev.filter(p => p.id !== target.id));

    // DB Call
    const { data, error } = await supabase.from('user_interactions').insert({
        user_id: currentUser.id,
        target_user_id: target.id,
        interaction_type: type
    }).select().maybeSingle();

    if (!error && data) {
        setLastAction({ type, profileId: target.id, interactionId: data.id, timestamp: Date.now() });
        setUndoTimer(10); // 10 seconds to undo
        
        // Update like count if it's a like
        if (type === 'like') {
          setDailyLikeCount(prev => prev + 1);
          setRapidLikeCount(prev => prev + 1); // Track rapid likes
          
          // Check Match
          const { data: mutual, error: mutualError } = await supabase.from('user_interactions').select('*').eq('user_id', target.id).eq('target_user_id', currentUser.id).eq('interaction_type', 'like').maybeSingle();
          if (mutualError && mutualError.code !== 'PGRST116' && mutualError.code !== 'NOT_FOUND') {
            console.error('Mutual match check error:', mutualError);
          }
          if (mutual) {
              toast({ title: "It's a Match! 🎉", description: `You matched with ${target.full_name}` });
              await supabase.from('conversations').insert({ user1_id: currentUser.id < target.id ? currentUser.id : target.id, user2_id: currentUser.id > target.id ? currentUser.id : target.id });
          }
        }
    } else {
        // Restore profile on error
        setProfiles(prev => [...prev, target]);
    }
  };

  const handleUndo = async () => {
    if (!lastAction) return;

    try {
        await supabase.from('user_interactions').delete().eq('id', lastAction.interactionId);
        setLastAction(null);
        setUndoTimer(0);
        fetchProfiles(); // Reload to bring them back
        toast({ title: "Action Undone" });
    } catch (e) {
        toast({ title: "Undo Failed", variant: "destructive" });
    }
  };

  const toggleFavorite = async (profile) => {
      if (favorites.has(profile.id)) {
          // Remove
          await supabase.from('favorites').delete().eq('user_id', currentUser.id).eq('favorited_user_id', profile.id);
          const newFavs = new Set(favorites);
          newFavs.delete(profile.id);
          setFavorites(newFavs);
          toast({ title: "Removed from Favorites" });
      } else {
          // Add
          await supabase.from('favorites').insert({ user_id: currentUser.id, favorited_user_id: profile.id });
          const newFavs = new Set(favorites);
          newFavs.add(profile.id);
          setFavorites(newFavs);
          toast({ title: "Added to Favorites" });
      }
  };

  const savePreferences = async () => {
      if (!newPrefName.trim()) return;
      const { data, error } = await supabase.from('user_preferences').insert({
          user_id: currentUser.id,
          preference_name: newPrefName,
          age_min: filters.ageRange[0],
          age_max: filters.ageRange[1],
          distance_km: filters.distance || 50,
          faith_ids: filters.faith ? [filters.faith] : [],
          faith_lifestyle: filters.faithLifestyle || '',
          smoking: filters.smoking || '',
          drinking: filters.drinking || '',
          marital_status: filters.maritalStatus || '',
          has_children: filters.hasChildren || '',
          education_level: filters.educationLevel || '',
          relationship_goal: filters.relationshipGoal || '',
          languages: filters.languages || [],
          zodiac_sign: filters.zodiacSign || '',
          countries: filters.countries || [],
          recent_active: filters.recentActive || false,
          verified_only: filters.verifiedOnly || false,
          premium_only: false
      }).select().maybeSingle();
      if (error && error.code !== 'PGRST116' && error.code !== 'NOT_FOUND') {
        console.error('Save preference error:', error);
        toast({ title: "Error", description: "Failed to save preferences", variant: "destructive" });
        return;
      }

      if (!error && data) {
          setSavedPreferences([...savedPreferences, data]);
          setActivePreferenceId(data.id);
          setIsSavePrefModalOpen(false);
          setNewPrefName('');
          toast({ title: "Preferences Saved", description: "Your search preferences have been saved successfully." });
      }
  };

  const loadPreference = (pref) => {
      setFilters({
          ...defaultFilters,
          ageRange: [pref.age_min || 18, pref.age_max || 65],
          distance: pref.distance_km || 50,
          faith: pref.faith_ids?.[0] || '',
          faithLifestyle: pref.faith_lifestyle || '',
          smoking: pref.smoking || '',
          drinking: pref.drinking || '',
          maritalStatus: pref.marital_status || '',
          hasChildren: pref.has_children || '',
          educationLevel: pref.education_level || '',
          relationshipGoal: pref.relationship_goal || '',
          languages: pref.languages || [],
          zodiacSign: pref.zodiac_sign || '',
          countries: pref.countries || [],
          recentActive: pref.recent_active || false,
          verifiedOnly: pref.verified_only || false
      });
      setActivePreferenceId(pref.id);
      toast({ title: `Loaded "${pref.preference_name}"`, description: "Filters have been applied. Click 'Apply Filters' to see results." });
      // Auto-apply filters when loading
      setTimeout(() => {
        fetchProfiles();
      }, 100);
  };
  
  const deletePreference = async (id, e) => {
      e.stopPropagation();
      await supabase.from('user_preferences').delete().eq('id', id);
      setSavedPreferences(prev => prev.filter(p => p.id !== id));
      if (activePreferenceId === id) setActivePreferenceId(null);
  };

  // Empty State Component
  const EmptyState = ({ filters, defaultFilters, isPremium, userProfile, onClearFilters, onExpandAge, onIncreaseDistance, onRemovePremiumFilters, onCompleteProfile }) => {
    const hasActiveFilters = filters.city || filters.faith || filters.smoking || filters.drinking || filters.maritalStatus || filters.hasChildren || 
                            filters.ageRange[0] !== defaultFilters.ageRange[0] || filters.ageRange[1] !== defaultFilters.ageRange[1] ||
                            filters.distance !== defaultFilters.distance || (isPremium && (filters.recentActive || filters.verifiedOnly || filters.minPhotos > 0 || filters.income));

    const suggestions = [];

    // Age range suggestion
    if (filters.ageRange[0] > 20 || filters.ageRange[1] < 65) {
      suggestions.push({
        icon: Heart,
        title: 'Expand Age Range',
        description: `Currently ${filters.ageRange[0]}-${filters.ageRange[1]}. Expand to see more profiles.`,
        action: onExpandAge,
        color: 'text-blue-600',
        bg: 'bg-blue-50'
      });
    }

    // Distance suggestion
    if (filters.distance < 100 && isPremium) {
      suggestions.push({
        icon: MapPin,
        title: 'Increase Distance',
        description: `Currently ${filters.distance}km. Increase to see more matches nearby.`,
        action: onIncreaseDistance,
        color: 'text-green-600',
        bg: 'bg-green-50'
      });
    }

    // Premium filters suggestion
    if (isPremium && (filters.recentActive || filters.verifiedOnly || filters.minPhotos > 0 || filters.income)) {
      suggestions.push({
        icon: X,
        title: 'Remove Premium-Only Filters',
        description: 'These filters are limiting your results. Remove them to see more profiles.',
        action: onRemovePremiumFilters,
        color: 'text-orange-600',
        bg: 'bg-orange-50'
      });
    }

    // Profile completion suggestion
    if (!userProfile || userProfile.onboarding_step < 5 || userProfile.status !== 'approved') {
      suggestions.push({
        icon: Settings,
        title: 'Complete Your Profile',
        description: 'Complete your profile to get better matches and see more results.',
        action: onCompleteProfile,
        color: 'text-purple-600',
        bg: 'bg-purple-50'
      });
    }

    return (
      <div className="bg-white rounded-2xl border border-dashed border-[#E6DCD2] p-8 md:p-12">
        <div className="text-center max-w-2xl mx-auto">
          <Search className="w-16 h-16 mx-auto text-[#706B67] mb-4 opacity-50" />
          <h3 className="text-2xl font-bold text-[#1F1F1F] mb-2">No profiles found</h3>
          <p className="text-[#706B67] mb-8">
            {hasActiveFilters 
              ? "Your current filters are too specific. Try adjusting them to see more matches."
              : "No matches found right now. Check back soon or adjust your preferences."}
          </p>

          {/* Actionable Suggestions */}
          {suggestions.length > 0 && (
            <div className="mb-8 text-left">
              <h4 className="text-lg font-bold text-[#1F1F1F] mb-4 text-center">Try these suggestions:</h4>
              <div className="grid md:grid-cols-2 gap-4">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={suggestion.action}
                    className={`p-4 rounded-lg border border-[#E6DCD2] hover:border-[#E6B450] transition-all text-left group ${suggestion.bg}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${suggestion.bg} group-hover:scale-110 transition-transform`}>
                        <suggestion.icon className={`w-5 h-5 ${suggestion.color}`} />
                      </div>
                      <div className="flex-1">
                        <h5 className="font-bold text-[#1F1F1F] mb-1">{suggestion.title}</h5>
                        <p className="text-sm text-[#706B67]">{suggestion.description}</p>
                      </div>
                      <ArrowRight className={`w-4 h-4 ${suggestion.color} opacity-0 group-hover:opacity-100 transition-opacity mt-1`} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3 justify-center">
            {hasActiveFilters && (
              <Button 
                onClick={() => onClearFilters(defaultFilters)} 
                variant="outline"
                className="border-[#E6B450] text-[#E6B450] hover:bg-[#FFFBEB]"
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Clear All Filters
              </Button>
            )}
            <Button 
              onClick={() => onClearFilters(defaultFilters)}
              className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D]"
            >
              <Search className="w-4 h-4 mr-2" /> Browse All Profiles
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-[#FAF7F2]">
        
        {/* Desktop Filter Sidebar */}
        <div className={`hidden lg:block w-80 fixed top-16 bottom-0 left-0 z-20 transition-transform duration-300 ${isFilterOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
            <FilterPanel 
                filters={filters} 
                setFilters={setFilters} 
                isPremium={currentUser?.is_premium} 
                onApply={() => fetchProfiles()} 
                onClear={(clearedFilters) => {
                    setFilters(clearedFilters);
                    fetchProfiles();
                }}
                onSave={() => setIsSavePrefModalOpen(true)}
                resultsCount={profiles.length}
                onPremiumFeatureClick={(feature) => {
                    setPremiumModalFeature(feature);
                    setPremiumModalOpen(true);
                }}
            />
        </div>

        {/* Mobile Filter Drawer */}
        {isFilterOpen && (
            <div className="lg:hidden fixed inset-0 z-50 bg-black/50 flex justify-end">
                <div className="w-[85%] max-w-sm h-full animate-in slide-in-from-right">
                    <FilterPanel 
                        filters={filters} 
                        setFilters={setFilters} 
                        isPremium={currentUser?.is_premium} 
                        onApply={() => { fetchProfiles(); setIsFilterOpen(false); }} 
                        onClear={(clearedFilters) => {
                            setFilters(clearedFilters);
                            fetchProfiles();
                        }}
                        onSave={() => {
                            setIsSavePrefModalOpen(true);
                            setIsFilterOpen(false);
                        }}
                        onClose={() => setIsFilterOpen(false)}
                        resultsCount={profiles.length}
                        onPremiumFeatureClick={(feature) => {
                            setPremiumModalFeature(feature);
                            setPremiumModalOpen(true);
                        }}
                    />
                </div>
            </div>
        )}

        {/* Main Content */}
        <div className="flex-1 lg:pl-80 w-full transition-all duration-300">
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                
                {/* Top Bar */}
                <div className="mb-6 flex flex-col gap-4">
                    {/* Usage Counter (Free Users Only) */}
                    {!currentUser?.is_premium && (
                      <div className="bg-[#FFFBEB] border border-[#E6B450]/30 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4 text-[#E6B450]" />
                          <span className="text-sm text-[#1F1F1F]">
                            Likes today: <span className="font-bold">{dailyLikeCount}/{LIKE_LIMIT_FREE}</span>
                            {dailyLikeCount >= LIKE_LIMIT_FREE - 5 && dailyLikeCount < LIKE_LIMIT_FREE && (
                              <span className="text-yellow-600 ml-2">• Limit soon</span>
                            )}
                          </span>
                        </div>
                        {dailyLikeCount >= LIKE_LIMIT_FREE && (
                          <Button 
                            size="sm" 
                            onClick={() => openPremiumModal && openPremiumModal()}
                            className="bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold"
                          >
                            <Crown className="w-3 h-3 mr-1" /> Upgrade
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {/* Search & Actions */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                         <div className="relative w-full md:w-96">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                             <input 
                                className="w-full pl-10 pr-4 py-2 rounded-full border border-[#E6DCD2] focus:outline-none focus:ring-2 focus:ring-[#C85A72]/20 bg-white shadow-sm"
                                placeholder="Search by name, job, bio..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                             />
                         </div>

                         <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                            <Button 
                                variant="outline" 
                                className="lg:hidden bg-white" 
                                onClick={() => setIsFilterOpen(true)}
                            >
                                <SlidersHorizontal className="w-4 h-4 mr-2" /> Filters
                            </Button>

                            {/* Presets */}
                            <Button variant="ghost" size="sm" className="whitespace-nowrap bg-white border border-[#E6DCD2] hover:bg-[#FAF7F2]" onClick={() => setFilters({...defaultFilters, recentActive: true})}>
                                <Clock className="w-3 h-3 mr-1" /> Recently Active
                            </Button>
                            <Button variant="ghost" size="sm" className="whitespace-nowrap bg-white border border-[#E6DCD2] hover:bg-[#FAF7F2]" onClick={() => setFilters({...defaultFilters, verifiedOnly: true})}>
                                <Shield className="w-3 h-3 mr-1" /> Verified
                            </Button>

                            {/* Saved Prefs Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="bg-white border-dashed border-[#C85A72] text-[#C85A72] hover:bg-[#C85A72]/5">
                                        <BookHeart className="w-4 h-4 mr-2" /> {activePreferenceId ? savedPreferences.find(p => p.id === activePreferenceId)?.preference_name : 'Load Saved'}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel>Saved Preferences</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {savedPreferences.length === 0 ? (
                                        <div className="p-2 text-xs text-gray-500 text-center">No saved preferences</div>
                                    ) : (
                                        savedPreferences.map(pref => (
                                            <DropdownMenuItem key={pref.id} onClick={() => loadPreference(pref)} className="justify-between group">
                                                <span>{pref.preference_name}</span>
                                                <Trash2 
                                                    className="w-3 h-3 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 cursor-pointer" 
                                                    onClick={(e) => deletePreference(pref.id, e)}
                                                />
                                            </DropdownMenuItem>
                                        ))
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setIsSavePrefModalOpen(true)}>
                                        <Save className="w-3 h-3 mr-2" /> Save Current Filters
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                         </div>
                    </div>

                    {/* Filter Summary Tags */}
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs font-bold text-[#706B67] uppercase tracking-wider mr-1">Active:</span>
                        {filters.faith && <Badge variant="secondary" className="bg-white border gap-1">{filters.faith} <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({...filters, faith: ''})}/></Badge>}
                        {filters.city && <Badge variant="secondary" className="bg-white border gap-1">{filters.city} <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({...filters, city: ''})}/></Badge>}
                        {filters.recentActive && <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 gap-1">Active Today <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({...filters, recentActive: false})}/></Badge>}
                        {filters.verifiedOnly && <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">Verified <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({...filters, verifiedOnly: false})}/></Badge>}
                        {/* Undo Button */}
                        {lastAction && (
                            <Button 
                                size="sm" 
                                onClick={handleUndo} 
                                className="ml-auto bg-[#1F1F1F] text-white animate-in fade-in slide-in-from-top-2"
                            >
                                <Undo2 className="w-4 h-4 mr-1" /> Undo ({undoTimer}s)
                            </Button>
                        )}
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-[#E6B450]" />
                        <p className="text-[#706B67]">Finding compatible matches...</p>
                    </div>
                ) : profiles.length === 0 ? (
                    <EmptyState 
                        filters={filters}
                        defaultFilters={defaultFilters}
                        isPremium={currentUser?.is_premium}
                        userProfile={currentUser}
                        onClearFilters={(clearedFilters) => {
                            setFilters(clearedFilters);
                            fetchProfiles();
                        }}
                        onExpandAge={() => {
                            const newAgeRange = [Math.max(18, filters.ageRange[0] - 5), Math.min(70, filters.ageRange[1] + 5)];
                            const newFilters = { ...filters, ageRange: newAgeRange };
                            setFilters(newFilters);
                            fetchProfiles();
                        }}
                        onIncreaseDistance={() => {
                            const newDistance = Math.min(500, filters.distance + 50);
                            const newFilters = { ...filters, distance: newDistance };
                            setFilters(newFilters);
                            fetchProfiles();
                        }}
                        onRemovePremiumFilters={() => {
                            const newFilters = {
                                ...filters,
                                recentActive: false,
                                verifiedOnly: false,
                                minPhotos: 0,
                                income: ''
                            };
                            setFilters(newFilters);
                            fetchProfiles();
                        }}
                        onCompleteProfile={() => navigate('/profile')}
                    />
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                            {profiles.map(profile => (
                                <ProfileCard 
                                    key={profile.id} 
                                    profile={profile}
                                    isFavorite={favorites.has(profile.id)}
                                    onLike={(p) => handleInteraction(p, 'like')}
                                    onPass={(p) => handleInteraction(p, 'pass')}
                                    onFavorite={(p) => toggleFavorite(p)}
                                    onClick={() => navigate(`/profile/${profile.id}`)}
                                />
                            ))}
                        </div>
                        {/* Pagination / Load More would go here */}
                    </>
                )}

                <Footer />
            </div>
        </div>

        {/* Save Preference Modal */}
        <Dialog open={isSavePrefModalOpen} onOpenChange={setIsSavePrefModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Save Search Preferences</DialogTitle>
                    <DialogDescription>
                        Give a name to your current filter set to easily load it later.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <input 
                        className="w-full border rounded-md px-3 py-2" 
                        placeholder="e.g. Serious Candidates, London Only..." 
                        value={newPrefName}
                        onChange={(e) => setNewPrefName(e.target.value)}
                        autoFocus
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSavePrefModalOpen(false)}>Cancel</Button>
                    <Button onClick={savePreferences} disabled={!newPrefName.trim()} className="bg-[#E6B450] text-[#1F1F1F]">Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Premium Upgrade Modal */}
        <PremiumUpgradeModal 
            isOpen={premiumModalOpen}
            onClose={() => setPremiumModalOpen(false)}
            feature={premiumModalFeature}
        />
    </div>
  );
};

export default DiscoveryPage;