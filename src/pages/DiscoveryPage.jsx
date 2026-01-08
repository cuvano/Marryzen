import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
  SlidersHorizontal, Search, RotateCcw, Heart, Save, BookHeart, 
  Clock, Flame, Star, MapPin, Loader2, MoreHorizontal, Undo2,
  Trash2, Check, Shield, X
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

  // Preferences & Saved
  const [savedPreferences, setSavedPreferences] = useState([]);
  const [activePreferenceId, setActivePreferenceId] = useState(null);
  const [isSavePrefModalOpen, setIsSavePrefModalOpen] = useState(false);
  const [newPrefName, setNewPrefName] = useState('');

  // Filters State
  const defaultFilters = {
    ageRange: [18, 65],
    distance: 50, // km
    city: '',
    faith: '',
    marriageIntent: '',
    smoking: '',
    drinking: '',
    maritalStatus: '',
    hasChildren: '',
    // Premium
    recentActive: false,
    verifiedOnly: false,
    minPhotos: 0,
    income: '',
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
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setCurrentUser(profile);

      // Config
      const { data: config } = await supabase.from('matching_config').select('*').single();
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
        if (filters.maritalStatus) query = query.eq('marital_status', filters.maritalStatus);
        
        // Premium Server Filters
        if (currentUser.is_premium) {
            if (filters.income) query = query.eq('income_range', filters.income);
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
                
                // Premium Checks
                if (currentUser.is_premium) {
                    if (filters.verifiedOnly && !p.is_verified) return false;
                    if (filters.minPhotos > 0 && (p.photos?.length || 0) < filters.minPhotos) return false;
                    if (filters.recentActive && p.last_active_at) {
                         const hoursSinceActive = (new Date() - new Date(p.last_active_at)) / (1000 * 60 * 60);
                         if (hoursSinceActive > 24) return false;
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
    // Optimistic Update
    setProfiles(prev => prev.filter(p => p.id !== target.id));

    // DB Call
    const { data, error } = await supabase.from('user_interactions').insert({
        user_id: currentUser.id,
        target_user_id: target.id,
        interaction_type: type
    }).select().single();

    if (!error) {
        setLastAction({ type, profileId: target.id, interactionId: data.id, timestamp: Date.now() });
        setUndoTimer(10); // 10 seconds to undo
        
        if (type === 'like') {
            // Check Match
            const { data: mutual } = await supabase.from('user_interactions').select('*').eq('user_id', target.id).eq('target_user_id', currentUser.id).eq('interaction_type', 'like').single();
            if (mutual) {
                toast({ title: "It's a Match! 🎉", description: `You matched with ${target.full_name}` });
                await supabase.from('conversations').insert({ user1_id: currentUser.id < target.id ? currentUser.id : target.id, user2_id: currentUser.id > target.id ? currentUser.id : target.id });
            }
        }
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
          distance_km: filters.distance,
          faith_ids: filters.faith ? [filters.faith] : [],
          premium_only: false
      }).select().single();

      if (!error) {
          setSavedPreferences([...savedPreferences, data]);
          setActivePreferenceId(data.id);
          setIsSavePrefModalOpen(false);
          setNewPrefName('');
          toast({ title: "Preferences Saved" });
      }
  };

  const loadPreference = (pref) => {
      setFilters({
          ...filters,
          ageRange: [pref.age_min, pref.age_max],
          distance: pref.distance_km,
          faith: pref.faith_ids?.[0] || ''
      });
      setActivePreferenceId(pref.id);
      toast({ title: `Loaded "${pref.preference_name}"` });
  };
  
  const deletePreference = async (id, e) => {
      e.stopPropagation();
      await supabase.from('user_preferences').delete().eq('id', id);
      setSavedPreferences(prev => prev.filter(p => p.id !== id));
      if (activePreferenceId === id) setActivePreferenceId(null);
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
                resultsCount={profiles.length}
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
                        onClose={() => setIsFilterOpen(false)}
                        resultsCount={profiles.length}
                    />
                </div>
            </div>
        )}

        {/* Main Content */}
        <div className="flex-1 lg:pl-80 w-full transition-all duration-300">
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                
                {/* Top Bar */}
                <div className="mb-6 flex flex-col gap-4">
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
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-[#E6DCD2]">
                        <Search className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-bold text-[#1F1F1F]">No matches found</h3>
                        <p className="text-[#706B67] mt-2 mb-6">Try broadening your filters or clearing them to see more people.</p>
                        <Button onClick={() => setFilters(defaultFilters)} variant="outline">Reset All Filters</Button>
                    </div>
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

    </div>
  );
};

export default DiscoveryPage;