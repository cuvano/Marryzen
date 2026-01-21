import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import PremiumUpgradeModal from '@/components/PremiumUpgradeModal';
import { 
  SlidersHorizontal, Search, RotateCcw, Heart, Save, BookHeart, 
  Clock, Flame, Star, MapPin, Loader2, MoreHorizontal, Undo2,
  Trash2, Check, Shield, X, ArrowRight, Settings, Crown, ChevronLeft, ChevronRight
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

  // Carousel & Detailed View State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState(null); // null = carousel view, profile object = detailed view

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
      const { data: prefs } = await supabase.from('user_preferences').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
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
  }, [filters, currentUser, matchingConfig]);


  // Helper function to get education levels equal to or higher than selected level
  const getEducationLevels = (selectedLevel) => {
    const educationHierarchy = {
      'High School': ['High School', 'Some College', "Bachelor's Degree", "Master's Degree", 'Doctorate', 'Professional Degree'],
      'Some College': ['Some College', "Bachelor's Degree", "Master's Degree", 'Doctorate', 'Professional Degree'],
      "Bachelor's Degree": ["Bachelor's Degree", "Master's Degree", 'Doctorate', 'Professional Degree'],
      "Master's Degree": ["Master's Degree", 'Doctorate', 'Professional Degree'],
      'Doctorate': ['Doctorate', 'Professional Degree'],
      'Professional Degree': ['Professional Degree']
    };
    return educationHierarchy[selectedLevel] || [selectedLevel];
  };

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
        if (filters.maritalStatus) query = query.eq('marital_status', filters.maritalStatus);
        // Education level: include selected level and all higher levels
        if (filters.educationLevel) {
          const educationLevels = getEducationLevels(filters.educationLevel);
          query = query.in('education', educationLevels);
        }
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

                // Complex Filters
                if (filters.smoking && p.smoking !== filters.smoking) return false;
                if (filters.drinking && p.drinking !== filters.drinking) return false;
                if (filters.hasChildren && String(p.has_children) !== filters.hasChildren) return false;
                // Education level: include selected level and all higher levels
                if (filters.educationLevel) {
                  const educationLevels = getEducationLevels(filters.educationLevel);
                  if (!educationLevels.includes(p.education)) return false;
                }
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
                const validScore = (typeof score === 'number' && !isNaN(score)) ? score : 0;
                return {
                    ...p,
                    age: new Date().getFullYear() - new Date(p.date_of_birth).getFullYear(),
                    compatibilityScore: validScore,
                    matchLabel: getMatchLabel(validScore)
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
    
    // If we're in detailed view and the profile is removed, go back to carousel
    if (selectedProfile && selectedProfile.id === target.id) {
      setSelectedProfile(null);
      // Adjust currentIndex if needed
      if (currentIndex >= profiles.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      }
    } else {
      // Adjust currentIndex if a profile before current is removed
      const removedIndex = profiles.findIndex(p => p.id === target.id);
      if (removedIndex !== -1 && removedIndex < currentIndex) {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      }
    }

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
      if (!newPrefName.trim()) {
        toast({ title: "Name Required", description: "Please enter a name for your saved preferences.", variant: "destructive" });
        return;
      }
      
      if (!currentUser) {
        toast({ title: "Error", description: "Please log in to save preferences.", variant: "destructive" });
        return;
      }

      // Premium check - Save/Load Search is premium-only
      if (!currentUser.is_premium) {
        setIsSavePrefModalOpen(false);
        setPremiumModalFeature('Save/Load Search Preferences');
        setPremiumModalOpen(true);
        toast({ 
          title: "Premium Feature", 
          description: "Save and load search preferences is a premium feature. Upgrade to unlock this feature.", 
          variant: "default"
        });
        return;
      }

      try {
      // Store all filters in the filters JSONB column to match existing schema
      const filtersData = {
          ageRange: filters.ageRange,
          distance: filters.distance || 50,
          city: filters.city || '',
          faith: filters.faith || '',
          faithLifestyle: filters.faithLifestyle || '',
          smoking: filters.smoking || '',
          drinking: filters.drinking || '',
          maritalStatus: filters.maritalStatus || '',
          hasChildren: filters.hasChildren || '',
          educationLevel: filters.educationLevel || '',
          relationshipGoal: filters.relationshipGoal || '',
          languages: filters.languages || [],
          zodiacSign: filters.zodiacSign || '',
          countries: filters.countries || [],
          recentActive: filters.recentActive || false,
          verifiedOnly: filters.verifiedOnly || false
      };

      const { data, error } = await supabase.from('user_preferences').insert({
          user_id: currentUser.id,
          name: newPrefName.trim(),
          filters: filtersData,
          is_default: false
        }).select().maybeSingle();
        
        if (error) {
          console.error('Save preference error:', error);
          toast({ 
            title: "Error", 
            description: error.message || "Failed to save preferences. Please try again.", 
            variant: "destructive" 
          });
          return;
        }

        if (data) {
          // Refresh saved preferences list
          const { data: prefs } = await supabase.from('user_preferences').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
          setSavedPreferences(prefs || []);
          setActivePreferenceId(data.id);
          setIsSavePrefModalOpen(false);
          setNewPrefName('');
          toast({ 
            title: "Preferences Saved", 
            description: `"${newPrefName}" has been saved successfully. You can load it anytime from the "Load Saved" menu.` 
          });
        }
      } catch (err) {
        console.error('Unexpected error saving preferences:', err);
        toast({ 
          title: "Error", 
          description: "An unexpected error occurred. Please try again.", 
          variant: "destructive" 
        });
      }
  };

  const loadPreference = (pref) => {
      if (!pref) return;
      
      // Premium check - Save/Load Search is premium-only
      if (!currentUser?.is_premium) {
        setPremiumModalFeature('Save/Load Search Preferences');
        setPremiumModalOpen(true);
        toast({ 
          title: "Premium Feature", 
          description: "Save and load search preferences is a premium feature. Upgrade to unlock this feature.", 
          variant: "default"
        });
        return;
      }
      
      // Load filters from JSONB column
      const filtersData = pref.filters || {};
      
      const loadedFilters = {
          ...defaultFilters,
          ageRange: Array.isArray(filtersData.ageRange) ? filtersData.ageRange : [18, 65],
          distance: filtersData.distance || 50,
          city: filtersData.city || '',
          faith: filtersData.faith || '',
          faithLifestyle: filtersData.faithLifestyle || '',
          smoking: filtersData.smoking || '',
          drinking: filtersData.drinking || '',
          maritalStatus: filtersData.maritalStatus || '',
          hasChildren: filtersData.hasChildren || '',
          educationLevel: filtersData.educationLevel || '',
          relationshipGoal: filtersData.relationshipGoal || '',
          languages: Array.isArray(filtersData.languages) ? filtersData.languages : [],
          zodiacSign: filtersData.zodiacSign || '',
          countries: Array.isArray(filtersData.countries) ? filtersData.countries : [],
          recentActive: filtersData.recentActive || false,
          verifiedOnly: filtersData.verifiedOnly || false
      };
      
      setFilters(loadedFilters);
      setActivePreferenceId(pref.id);
      toast({ 
        title: `Loaded "${pref.name || 'Saved Preferences'}"`, 
        description: "Filters have been applied. Results are being updated..." 
      });
      
      // Auto-apply filters when loading - use a longer timeout to ensure state is updated
      setTimeout(() => {
        fetchProfiles();
      }, 300);
  };
  
  const deletePreference = async (id, e) => {
      e.stopPropagation();
      await supabase.from('user_preferences').delete().eq('id', id);
      setSavedPreferences(prev => prev.filter(p => p.id !== id));
      if (activePreferenceId === id) setActivePreferenceId(null);
  };

  // Detailed Profile View Component
  const DetailedProfileView = ({ profile, isFavorite, onLike, onPass, onFavorite, onClose, onNext, onPrevious, hasNext, hasPrevious }) => {
    return (
      <div className="bg-white rounded-2xl border border-[#E6DCD2] shadow-lg overflow-hidden">
        <div className="relative">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm hover:bg-white rounded-full"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>

          {/* Main Image */}
          <div className="relative h-96 overflow-hidden">
            <img 
              src={profile.photos?.[0] || 'https://via.placeholder.com/800x600'} 
              alt={profile.full_name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            
            {/* Profile Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-3xl font-bold mb-2">{profile.full_name}, {profile.age}</h2>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.location_city || 'Unknown City'}</span>
                    {profile.distance !== undefined && <span>• {Math.round(profile.distance)} km away</span>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full h-10 w-10 backdrop-blur-md ${isFavorite ? 'bg-red-500 text-white' : 'bg-black/20 text-white hover:bg-black/40'}`}
                  onClick={() => onFavorite(profile)}
                >
                  <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                </Button>
              </div>

              {/* Match Badge */}
              {profile.matchLabel && typeof profile.compatibilityScore === 'number' && !isNaN(profile.compatibilityScore) && (
                <Badge className="bg-green-500 text-white border-0 font-bold mb-4">
                  {Math.round(profile.compatibilityScore)}% Match - {profile.matchLabel}
                </Badge>
              )}

              {/* Quick Info Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {profile.religious_affiliation && (
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    {profile.religious_affiliation}
                  </Badge>
                )}
                {profile.occupation && (
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    {profile.occupation}
                  </Badge>
                )}
                {profile.height && (
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    {Math.floor(profile.height/30.48)}'{Math.round((profile.height%30.48)/2.54)}"
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Content */}
          <div className="p-6 space-y-6">
            {/* Bio */}
            {profile.bio && (
              <div>
                <h3 className="font-bold text-lg text-[#1F1F1F] mb-2">About</h3>
                <p className="text-[#706B67] leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {/* Additional Photos */}
            {profile.photos && profile.photos.length > 1 && (
              <div>
                <h3 className="font-bold text-lg text-[#1F1F1F] mb-3">Photos</h3>
                <div className="grid grid-cols-3 gap-3">
                  {profile.photos.slice(1, 4).map((photo, idx) => (
                    <img 
                      key={idx}
                      src={photo || 'https://via.placeholder.com/200x200'} 
                      alt={`${profile.full_name} photo ${idx + 2}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Additional Details */}
            <div className="grid grid-cols-2 gap-4">
              {profile.faith_lifestyle && (
                <div>
                  <span className="text-sm text-[#706B67]">Faith Lifestyle</span>
                  <p className="font-medium text-[#1F1F1F]">{profile.faith_lifestyle}</p>
                </div>
              )}
              {profile.marital_status && (
                <div>
                  <span className="text-sm text-[#706B67]">Marital Status</span>
                  <p className="font-medium text-[#1F1F1F]">{profile.marital_status}</p>
                </div>
              )}
              {profile.education && (
                <div>
                  <span className="text-sm text-[#706B67]">Education</span>
                  <p className="font-medium text-[#1F1F1F]">{profile.education}</p>
                </div>
              )}
              {profile.zodiac_sign && (
                <div>
                  <span className="text-sm text-[#706B67]">Zodiac Sign</span>
                  <p className="font-medium text-[#1F1F1F]">{profile.zodiac_sign}</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-6 border-t border-[#E6DCD2] bg-[#FAF7F2]">
            <div className="flex items-center justify-between gap-4">
              {/* Previous Button */}
              <Button
                variant="outline"
                className="flex-1 border-[#E6DCD2] hover:border-[#E6B450]"
                onClick={onPrevious}
                disabled={!hasPrevious}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full border-2 border-[#E6DCD2] hover:border-red-300"
                  onClick={() => onPass(profile)}
                >
                  <X className="w-6 h-6" />
                </Button>
                <Button
                  className="h-12 w-12 rounded-full bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] border-none shadow-lg"
                  onClick={() => onLike(profile)}
                >
                  <Heart className="w-6 h-6 fill-black/20" />
                </Button>
              </div>

              {/* Next Button */}
              <Button
                variant="outline"
                className="flex-1 border-[#E6DCD2] hover:border-[#E6B450]"
                onClick={onNext}
                disabled={!hasNext}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
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

                    {/* Actions */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                         <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                            {/* View Past Interactions Button */}
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="whitespace-nowrap bg-white border border-[#E6DCD2] hover:bg-[#FAF7F2]"
                                onClick={() => navigate('/matches?tab=interactions')}
                            >
                                <Clock className="w-3 h-3 mr-1" /> View Past Interactions
                            </Button>
                            
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

                            {/* Saved Prefs Dropdown - Premium Only */}
                            {currentUser?.is_premium && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="bg-white border-dashed border-[#C85A72] text-[#C85A72] hover:bg-[#C85A72]/5">
                                            <BookHeart className="w-4 h-4 mr-2" /> {activePreferenceId ? savedPreferences.find(p => p.id === activePreferenceId)?.name : 'Load Saved'}
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
                                                    <span>{pref.name}</span>
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
                            )}
                         </div>
                    </div>

                    {/* Filter Summary Tags */}
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs font-bold text-[#706B67] uppercase tracking-wider mr-1">Active:</span>
                        {filters.faith && <Badge variant="secondary" className="bg-white border gap-1">{filters.faith} <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({...filters, faith: ''})}/></Badge>}
                        {filters.city && <Badge variant="secondary" className="bg-white border gap-1">{filters.city} <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({...filters, city: ''})}/></Badge>}
                        {filters.recentActive && <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 gap-1">Active Today <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({...filters, recentActive: false})}/></Badge>}
                        {filters.verifiedOnly && <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">Verified <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({...filters, verifiedOnly: false})}/></Badge>}
                        {/* Undo Button - Premium Only */}
                        {lastAction && currentUser?.is_premium && (
                            <Button 
                                size="sm" 
                                onClick={handleUndo} 
                                className="ml-auto bg-[#1F1F1F] text-white animate-in fade-in slide-in-from-top-2"
                            >
                                <Undo2 className="w-4 h-4 mr-1" /> Undo ({undoTimer}s)
                            </Button>
                        )}
                        {lastAction && !currentUser?.is_premium && (
                            <Button 
                                size="sm" 
                                onClick={() => openPremiumModal && openPremiumModal()} 
                                className="ml-auto bg-[#E6B450] text-[#1F1F1F] animate-in fade-in slide-in-from-top-2"
                            >
                                <Crown className="w-4 h-4 mr-1" /> Premium: Undo ({undoTimer}s)
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
                ) : selectedProfile ? (
                    // Detailed View
                    <DetailedProfileView
                        profile={selectedProfile}
                        isFavorite={favorites.has(selectedProfile.id)}
                        onLike={(p) => handleInteraction(p, 'like')}
                        onPass={(p) => handleInteraction(p, 'pass')}
                        onFavorite={(p) => toggleFavorite(p)}
                        onClose={() => setSelectedProfile(null)}
                        onNext={() => {
                            const nextIndex = (currentIndex + 1) % profiles.length;
                            setCurrentIndex(nextIndex);
                            setSelectedProfile(profiles[nextIndex]);
                        }}
                        onPrevious={() => {
                            const prevIndex = (currentIndex - 1 + profiles.length) % profiles.length;
                            setCurrentIndex(prevIndex);
                            setSelectedProfile(profiles[prevIndex]);
                        }}
                        hasNext={currentIndex < profiles.length - 1}
                        hasPrevious={currentIndex > 0}
                    />
                ) : (
                    // Carousel View - 3 profiles side-by-side
                    <div className="relative w-full">
                        <div className="flex items-center justify-center gap-2 md:gap-6 w-full">
                            {/* Previous Button */}
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 rounded-full border-2 border-[#E6DCD2] hover:border-[#E6B450] bg-white shadow-md flex-shrink-0"
                                onClick={() => {
                                    const prevIndex = Math.max(0, currentIndex - 3);
                                    setCurrentIndex(prevIndex);
                                }}
                                disabled={currentIndex === 0}
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </Button>

                            {/* Carousel Container */}
                            <div className="flex-1 flex justify-center gap-2 md:gap-4 overflow-hidden">
                                {profiles.slice(currentIndex, Math.min(currentIndex + 3, profiles.length)).map((profile, idx) => (
                                    <div 
                                        key={profile.id} 
                                        className="flex-shrink-0 transition-all duration-300 w-[calc(33.333%-0.5rem)] min-w-[250px] max-w-[280px]"
                                    >
                                <ProfileCard 
                                    profile={profile}
                                    isFavorite={favorites.has(profile.id)}
                                    onLike={(p) => handleInteraction(p, 'like')}
                                    onPass={(p) => handleInteraction(p, 'pass')}
                                    onFavorite={(p) => toggleFavorite(p)}
                                            onClick={() => {
                                                setSelectedProfile(profile);
                                                setCurrentIndex(currentIndex + idx);
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Next Button */}
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 rounded-full border-2 border-[#E6DCD2] hover:border-[#E6B450] bg-white shadow-md flex-shrink-0"
                                onClick={() => {
                                    const nextIndex = Math.min(profiles.length - 3, currentIndex + 3);
                                    setCurrentIndex(nextIndex >= 0 ? nextIndex : 0);
                                }}
                                disabled={currentIndex >= profiles.length - 3}
                            >
                                <ChevronRight className="w-6 h-6" />
                            </Button>
                        </div>

                        {/* Carousel Indicators */}
                        {profiles.length > 3 && (
                            <div className="flex justify-center gap-2 mt-6">
                                {Array.from({ length: Math.ceil(profiles.length / 3) }).map((_, idx) => (
                                    <button
                                        key={idx}
                                        className={`h-2 rounded-full transition-all ${
                                            Math.floor(currentIndex / 3) === idx 
                                                ? 'w-8 bg-[#E6B450]' 
                                                : 'w-2 bg-[#E6DCD2]'
                                        }`}
                                        onClick={() => setCurrentIndex(idx * 3)}
                                />
                            ))}
                        </div>
                        )}

                        {/* Profile Counter */}
                        <div className="text-center mt-4 text-sm text-[#706B67]">
                            Showing {Math.min(currentIndex + 1, profiles.length)} of {profiles.length} profiles
                        </div>
                    </div>
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