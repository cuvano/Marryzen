import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, User, Heart, Search, Settings, ArrowRight, X, MapPin, Eye, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Footer from '@/components/Footer';
import { Crown } from 'lucide-react';

const MatchesPage = () => {
  const [matches, setMatches] = useState([]);
  const [suggestedProfiles, setSuggestedProfiles] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pastInteractions, setPastInteractions] = useState([]);
  const [likesReceived, setLikesReceived] = useState([]);
  const [profileViews, setProfileViews] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' | 'interactions' | 'likes-you' | 'profile-views' | 'favorites'
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
    fetchPastInteractions();
    fetchLikesReceived();
    fetchProfileViews();
    fetchFavorites();
    
    // Check URL for tab parameter
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'interactions') {
      setActiveTab('interactions');
    } else if (tab === 'likes-you') {
      setActiveTab('likes-you');
    } else if (tab === 'profile-views') {
      setActiveTab('profile-views');
    } else if (tab === 'favorites') {
      setActiveTab('favorites');
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setUserProfile(profile);
      }

      // Fetch matches (conversations)
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          user1:user1_id(id, full_name, photos, location_city, location_country, date_of_birth, is_premium),
          user2:user2_id(id, full_name, photos, location_city, location_country, date_of_birth, is_premium),
          last_message_at
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (error) console.error(error);
      
      const formatted = (data || []).map(convo => {
        const otherUser = convo.user1.id === user.id ? convo.user2 : convo.user1;
        const age = otherUser.date_of_birth 
          ? Math.floor((new Date() - new Date(otherUser.date_of_birth)) / (1000 * 60 * 60 * 24 * 365))
          : null;
        
        return {
          conversationId: convo.id,
          id: otherUser.id,
          full_name: otherUser.full_name,
          photos: otherUser.photos || [],
          location_city: otherUser.location_city,
          location_country: otherUser.location_country,
          age,
          is_premium: otherUser.is_premium,
          last_message_at: convo.last_message_at
        };
      });

      setMatches(formatted);

      // If no matches, fetch suggested profiles as fallback
      if (formatted.length === 0 && profile?.status === 'approved') {
        await fetchSuggestedProfiles(user.id);
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestedProfiles = async (userId) => {
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

      // Fetch approved profiles that user hasn't interacted with
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, photos, location_city, location_country, date_of_birth, is_premium, identify_as')
        .eq('status', 'approved')
        .limit(6);

      if (error) throw error;

      // Filter and format suggested profiles
      const suggested = (profiles || [])
        .filter(p => !excludeIds.has(p.id))
        .slice(0, 6)
        .map(p => ({
          id: p.id,
          full_name: p.full_name,
          photos: p.photos || [],
          location: `${p.location_city || ''}${p.location_city && p.location_country ? ', ' : ''}${p.location_country || ''}`.trim() || 'Location not set',
          age: p.date_of_birth ? Math.floor((new Date() - new Date(p.date_of_birth)) / (1000 * 60 * 60 * 24 * 365)) : null,
          is_premium: p.is_premium,
          identify_as: p.identify_as
        }));

      setSuggestedProfiles(suggested);
    } catch (error) {
      console.error('Error fetching suggested profiles:', error);
    }
  };

  const fetchPastInteractions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all interactions (likes and passes)
      const { data: interactions, error } = await supabase
        .from('user_interactions')
        .select(`
          id,
          interaction_type,
          created_at,
          target_user:target_user_id(
            id,
            full_name,
            photos,
            location_city,
            location_country,
            date_of_birth,
            is_premium
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching interactions:', error);
        return;
      }

      const formatted = (interactions || []).map(interaction => {
        const profile = interaction.target_user;
        const age = profile?.date_of_birth 
          ? Math.floor((new Date() - new Date(profile.date_of_birth)) / (1000 * 60 * 60 * 24 * 365))
          : null;
        
        return {
          id: interaction.id,
          interactionType: interaction.interaction_type,
          createdAt: interaction.created_at,
          profile: {
            id: profile?.id,
            full_name: profile?.full_name,
            photos: profile?.photos || [],
            location_city: profile?.location_city,
            location_country: profile?.location_country,
            age,
            is_premium: profile?.is_premium
          }
        };
      });

      setPastInteractions(formatted);
    } catch (error) {
      console.error('Error fetching past interactions:', error);
    }
  };

  const fetchLikesReceived = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Requires RLS policy allowing select where target_user_id = auth.uid()
      const { data: likes, error } = await supabase
        .from('user_interactions')
        .select(`
          id,
          created_at,
          from_user:user_id(
            id,
            full_name,
            photos,
            location_city,
            location_country,
            date_of_birth,
            is_premium
          )
        `)
        .eq('target_user_id', user.id)
        .eq('interaction_type', 'like')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching likes received:', error);
        return;
      }

      const formatted = (likes || []).map(like => {
        const profile = like.from_user;
        const age = profile?.date_of_birth
          ? Math.floor((new Date() - new Date(profile.date_of_birth)) / (1000 * 60 * 60 * 24 * 365))
          : null;

        return {
          id: like.id,
          createdAt: like.created_at,
          profile: {
            id: profile?.id,
            full_name: profile?.full_name,
            photos: profile?.photos || [],
            location_city: profile?.location_city,
            location_country: profile?.location_country,
            age,
            is_premium: profile?.is_premium
          }
        };
      });

      setLikesReceived(formatted);
    } catch (e) {
      console.error('Error fetching likes received:', e);
    }
  };

  const fetchProfileViews = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile views (who viewed this user's profile)
      const { data: views, error } = await supabase
        .from('profile_views')
        .select(`
          id,
          viewed_at,
          viewer:viewer_id(
            id,
            full_name,
            photos,
            location_city,
            location_country,
            date_of_birth,
            is_premium
          )
        `)
        .eq('viewed_profile_id', user.id)
        .order('viewed_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching profile views:', error);
        return;
      }

      const formatted = (views || []).map(view => {
        const profile = view.viewer;
        const age = profile?.date_of_birth
          ? Math.floor((new Date() - new Date(profile.date_of_birth)) / (1000 * 60 * 60 * 24 * 365))
          : null;

        return {
          id: view.id,
          viewedAt: view.viewed_at,
          profile: {
            id: profile?.id,
            full_name: profile?.full_name,
            photos: profile?.photos || [],
            location_city: profile?.location_city,
            location_country: profile?.location_country,
            age,
            is_premium: profile?.is_premium
          }
        };
      });

      setProfileViews(formatted);
    } catch (e) {
      console.error('Error fetching profile views:', e);
    }
  };

  const fetchFavorites = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch favorited profiles
      const { data: favs, error } = await supabase
        .from('favorites')
        .select(`
          id,
          created_at,
          favorited_user:favorited_user_id(
            id,
            full_name,
            photos,
            location_city,
            location_country,
            date_of_birth,
            is_premium
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching favorites:', error);
        return;
      }

      const formatted = (favs || []).map(fav => {
        const profile = fav.favorited_user;
        const age = profile?.date_of_birth
          ? Math.floor((new Date() - new Date(profile.date_of_birth)) / (1000 * 60 * 60 * 24 * 365))
          : null;

        return {
          id: fav.id,
          createdAt: fav.created_at,
          profile: {
            id: profile?.id,
            full_name: profile?.full_name,
            photos: profile?.photos || [],
            location_city: profile?.location_city,
            location_country: profile?.location_country,
            age,
            is_premium: profile?.is_premium
          }
        };
      });

      setFavorites(formatted);
    } catch (e) {
      console.error('Error fetching favorites:', e);
    }
  };

  const getEmptyStateSuggestions = () => {
    const suggestions = [];

    if (!userProfile) {
      return [
        { icon: Settings, text: 'Complete your profile to get better matches', action: () => navigate('/onboarding') }
      ];
    }

    if (userProfile.status !== 'approved') {
      suggestions.push({
        icon: Settings,
        text: 'Complete your profile to get approved and see matches',
        action: () => navigate('/profile')
      });
    }

    suggestions.push(
      { icon: Search, text: 'Browse Discovery to find potential matches', action: () => navigate('/discovery') },
      { icon: Heart, text: 'Send introductions to profiles you like', action: () => navigate('/discovery') }
    );

    return suggestions;
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1F1F1F] mb-2">Your Matches</h1>
          <p className="text-[#706B67] mb-4">
            {activeTab === 'matches' 
              ? (matches.length > 0 
                  ? "Mutual likes turn into conversations. Be respectful and sincere."
                  : "These are profiles who have liked you back. Start a conversation!")
              : "View profiles you've liked or passed on."}
          </p>
          
          {/* Tabs */}
          <div className="flex gap-2 border-b border-[#E6DCD2]">
            <button
              onClick={() => setActiveTab('matches')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'matches'
                  ? 'text-[#E6B450] border-b-2 border-[#E6B450]'
                  : 'text-[#706B67] hover:text-[#1F1F1F]'
              }`}
            >
              Matches ({matches.length})
            </button>
            <button
              onClick={() => setActiveTab('interactions')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'interactions'
                  ? 'text-[#E6B450] border-b-2 border-[#E6B450]'
                  : 'text-[#706B67] hover:text-[#1F1F1F]'
              }`}
            >
              Past Interactions ({pastInteractions.length})
            </button>
            <button
              onClick={() => setActiveTab('likes-you')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'likes-you'
                  ? 'text-[#E6B450] border-b-2 border-[#E6B450]'
                  : 'text-[#706B67] hover:text-[#1F1F1F]'
              }`}
            >
              Likes You
              {userProfile?.is_premium ? ` (${likesReceived.length})` : ''}
            </button>
            <button
              onClick={() => setActiveTab('profile-views')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'profile-views'
                  ? 'text-[#E6B450] border-b-2 border-[#E6B450]'
                  : 'text-[#706B67] hover:text-[#1F1F1F]'
              }`}
            >
              Who Viewed You
              {userProfile?.is_premium ? ` (${profileViews.length})` : ''}
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'favorites'
                  ? 'text-[#E6B450] border-b-2 border-[#E6B450]'
                  : 'text-[#706B67] hover:text-[#1F1F1F]'
              }`}
            >
              Favorites ({favorites.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 border-4 border-[#E6B450] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[#706B67] font-medium">Loading...</p>
          </div>
        ) : activeTab === 'likes-you' ? (
          // Likes You Tab - Show blurred for free users, full for premium
          likesReceived.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {likesReceived.map(item => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#E6DCD2] flex flex-col hover:shadow-md transition-shadow relative"
                >
                  {/* Blur overlay for free users */}
                  {!userProfile?.is_premium && (
                    <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center p-4">
                      <Crown className="w-12 h-12 text-[#E6B450] mb-3" />
                      <h4 className="font-bold text-lg text-[#1F1F1F] mb-2">Premium Feature</h4>
                      <p className="text-sm text-[#706B67] text-center mb-4">
                        Unlock to see who liked you
                      </p>
                      <Button
                        onClick={() => navigate('/premium')}
                        className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-bold"
                      >
                        <Crown className="w-4 h-4 mr-2" /> Unlock Premium
                      </Button>
                    </div>
                  )}
                  
                  <div className="aspect-square bg-slate-100 relative">
                    {item.profile.photos?.[0] ? (
                      <img
                        src={item.profile.photos[0]}
                        alt={item.profile.full_name}
                        className={`w-full h-full object-cover ${!userProfile?.is_premium ? 'blur-md' : ''}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <User className="w-16 h-16" />
                      </div>
                    )}
                    {item.profile.is_premium && (
                      <div className="absolute top-2 right-2">
                        <Crown className="w-5 h-5 text-[#E6B450] fill-[#E6B450]" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-[#E6B450] text-[#1F1F1F] font-bold">Liked you</Badge>
                    </div>
                  </div>
                  <div className={`p-4 flex-1 flex flex-col ${!userProfile?.is_premium ? 'opacity-50' : ''}`}>
                    <h3 className="font-bold text-lg text-[#1F1F1F] mb-1">
                      {userProfile?.is_premium ? item.profile.full_name : 'Hidden Profile'}
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-[#706B67] mb-2">
                      {userProfile?.is_premium && item.profile.age && <span>{item.profile.age}</span>}
                      {userProfile?.is_premium && item.profile.location_city && (
                        <>
                          {item.profile.age && <span>•</span>}
                          <MapPin className="w-3 h-3" />
                          <span>{item.profile.location_city}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-[#706B67] mb-4">
                      {userProfile?.is_premium ? new Date(item.createdAt).toLocaleDateString() : 'Upgrade to see details'}
                    </p>
                    <Button
                      className={`w-full mt-auto font-bold ${userProfile?.is_premium ? 'bg-[#1F1F1F] text-white hover:bg-[#333333]' : 'bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D]'}`}
                      onClick={() => userProfile?.is_premium ? navigate(`/profile/${item.profile.id}`) : navigate('/premium')}
                    >
                      {userProfile?.is_premium ? 'View Profile' : (
                        <>
                          <Crown className="w-4 h-4 mr-2" /> Unlock to View
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-[#E6DCD2] p-12 text-center">
              <Heart className="w-16 h-16 mx-auto text-[#C85A72] mb-4 opacity-50" />
              <h3 className="text-2xl font-bold text-[#1F1F1F] mb-2">No likes yet</h3>
              <p className="text-[#706B67] mb-8 max-w-md mx-auto">
                When someone likes you, they’ll appear here.
              </p>
              <Button
                onClick={() => navigate('/discovery')}
                className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-bold px-8"
              >
                <Search className="w-4 h-4 mr-2" /> Browse Discovery
              </Button>
            </div>
          )
        ) : activeTab === 'profile-views' ? (
          // Who Viewed Your Profile Tab - Show blurred for free users, full for premium
          profileViews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {profileViews.map(item => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#E6DCD2] flex flex-col hover:shadow-md transition-shadow relative"
                >
                  {/* Blur overlay for free users */}
                  {!userProfile?.is_premium && (
                    <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center p-4">
                      <Crown className="w-12 h-12 text-[#E6B450] mb-3" />
                      <h4 className="font-bold text-lg text-[#1F1F1F] mb-2">Premium Feature</h4>
                      <p className="text-sm text-[#706B67] text-center mb-4">
                        Unlock to see who viewed your profile
                      </p>
                      <Button
                        onClick={() => navigate('/premium')}
                        className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-bold"
                      >
                        <Crown className="w-4 h-4 mr-2" /> Unlock Premium
                      </Button>
                    </div>
                  )}
                  
                  <div className="aspect-square bg-slate-100 relative">
                    {item.profile.photos?.[0] ? (
                      <img
                        src={item.profile.photos[0]}
                        alt={item.profile.full_name}
                        className={`w-full h-full object-cover ${!userProfile?.is_premium ? 'blur-md' : ''}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <User className="w-16 h-16" />
                      </div>
                    )}
                    {item.profile.is_premium && (
                      <div className="absolute top-2 right-2">
                        <Crown className="w-5 h-5 text-[#E6B450] fill-[#E6B450]" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-blue-600 text-white font-bold">Viewed you</Badge>
                    </div>
                  </div>
                  <div className={`p-4 flex-1 flex flex-col ${!userProfile?.is_premium ? 'opacity-50' : ''}`}>
                    <h3 className="font-bold text-lg text-[#1F1F1F] mb-1">
                      {userProfile?.is_premium ? item.profile.full_name : 'Hidden Profile'}
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-[#706B67] mb-2">
                      {userProfile?.is_premium && item.profile.age && <span>{item.profile.age}</span>}
                      {userProfile?.is_premium && item.profile.location_city && (
                        <>
                          {item.profile.age && <span>•</span>}
                          <MapPin className="w-3 h-3" />
                          <span>{item.profile.location_city}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-[#706B67] mb-4">
                      {userProfile?.is_premium ? new Date(item.viewedAt).toLocaleDateString() : 'Upgrade to see details'}
                    </p>
                    <Button
                      className={`w-full mt-auto font-bold ${userProfile?.is_premium ? 'bg-[#1F1F1F] text-white hover:bg-[#333333]' : 'bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D]'}`}
                      onClick={() => userProfile?.is_premium ? navigate(`/profile/${item.profile.id}`) : navigate('/premium')}
                    >
                      {userProfile?.is_premium ? 'View Profile' : (
                        <>
                          <Crown className="w-4 h-4 mr-2" /> Unlock to View
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-[#E6DCD2] p-12 text-center">
              <Eye className="w-16 h-16 mx-auto text-[#C85A72] mb-4 opacity-50" />
              <h3 className="text-2xl font-bold text-[#1F1F1F] mb-2">No profile views yet</h3>
              <p className="text-[#706B67] mb-8 max-w-md mx-auto">
                When someone views your profile, they'll appear here.
              </p>
              <Button
                onClick={() => navigate('/discovery')}
                className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-bold px-8"
              >
                <Search className="w-4 h-4 mr-2" /> Browse Discovery
              </Button>
            </div>
          )
        ) : activeTab === 'favorites' ? (
          // Favorites Tab
          favorites.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map(item => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#E6DCD2] flex flex-col hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square bg-slate-100 relative">
                    {item.profile.photos?.[0] ? (
                      <img
                        src={item.profile.photos[0]}
                        alt={item.profile.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <User className="w-16 h-16" />
                      </div>
                    )}
                    {item.profile.is_premium && (
                      <div className="absolute top-2 right-2">
                        <Crown className="w-5 h-5 text-[#E6B450] fill-[#E6B450]" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-red-500 text-white font-bold">
                        <Star className="w-3 h-3 mr-1 fill-white" />
                        Favorited
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-bold text-lg text-[#1F1F1F] mb-1">{item.profile.full_name}</h3>
                    <div className="flex items-center gap-1 text-sm text-[#706B67] mb-2">
                      {item.profile.age && <span>{item.profile.age}</span>}
                      {item.profile.location_city && (
                        <>
                          {item.profile.age && <span>•</span>}
                          <MapPin className="w-3 h-3" />
                          <span>{item.profile.location_city}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-[#706B67] mb-4">
                      Favorited {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex flex-col gap-2 mt-auto">
                      <Button 
                        className="w-full bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-bold"
                        onClick={() => navigate(`/profile/${item.profile.id}`)}
                      >
                        View Profile
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full border-[#E6DCD2] text-[#706B67] hover:border-red-300 hover:text-red-600"
                        onClick={async () => {
                          try {
                            await supabase.from('favorites').delete().eq('id', item.id);
                            setFavorites(prev => prev.filter(f => f.id !== item.id));
                          } catch (e) {
                            console.error('Failed to remove favorite', e);
                          }
                        }}
                      >
                        Remove from Favorites
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-[#E6DCD2] p-12 text-center">
              <Star className="w-16 h-16 mx-auto text-[#E6B450] mb-4 opacity-50" />
              <h3 className="text-2xl font-bold text-[#1F1F1F] mb-2">No favorites yet</h3>
              <p className="text-[#706B67] mb-8 max-w-md mx-auto">
                Profiles you favorite will appear here. Click the heart icon on any profile to add them to your favorites!
              </p>
              <Button
                onClick={() => navigate('/discovery')}
                className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-bold px-8"
              >
                <Search className="w-4 h-4 mr-2" /> Browse Discovery
              </Button>
            </div>
          )
        ) : activeTab === 'interactions' ? (
          // Past Interactions Tab
          pastInteractions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastInteractions.map(interaction => (
                <div 
                  key={interaction.id} 
                  className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#E6DCD2] flex flex-col hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square bg-slate-100 relative">
                    {interaction.profile.photos?.[0] ? (
                      <img 
                        src={interaction.profile.photos[0]} 
                        alt={interaction.profile.full_name} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <User className="w-16 h-16" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      {interaction.interactionType === 'like' ? (
                        <div className="flex items-center gap-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm border border-white/20">
                          <Heart className="w-4 h-4 fill-white" />
                          <span className="font-bold text-sm">Liked</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-gradient-to-r from-gray-600 to-gray-700 text-white px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm border border-white/20">
                          <X className="w-4 h-4" />
                          <span className="font-bold text-sm">Passed</span>
                        </div>
                      )}
                    </div>
                    {interaction.profile.is_premium && (
                      <div className="absolute top-2 right-2">
                        <Crown className="w-5 h-5 text-[#E6B450] fill-[#E6B450]" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-bold text-lg text-[#1F1F1F] mb-1">{interaction.profile.full_name}</h3>
                    <div className="flex items-center gap-1 text-sm text-[#706B67] mb-2">
                      {interaction.profile.age && <span>{interaction.profile.age}</span>}
                      {interaction.profile.location_city && (
                        <>
                          {interaction.profile.age && <span>•</span>}
                          <MapPin className="w-3 h-3" />
                          <span>{interaction.profile.location_city}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-[#706B67] mb-4">
                      {new Date(interaction.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex flex-col gap-2 mt-auto">
                      <Button 
                        className="w-full bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-bold"
                        onClick={() => navigate(`/profile/${interaction.profile.id}`)}
                      >
                        View Profile
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full border-[#E6DCD2] text-[#706B67] hover:border-red-300 hover:text-red-600"
                        onClick={async () => {
                          try {
                            await supabase.from('user_interactions').delete().eq('id', interaction.id);
                            setPastInteractions(prev => prev.filter(p => p.id !== interaction.id));
                            // Refresh matches/suggestions in case this frees the profile
                            fetchData();
                          } catch (e) {
                            console.error('Failed to reset interaction', e);
                          }
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-[#E6DCD2] p-12 text-center">
              <Heart className="w-16 h-16 mx-auto text-[#C85A72] mb-4 opacity-50" />
              <h3 className="text-2xl font-bold text-[#1F1F1F] mb-2">No past interactions</h3>
              <p className="text-[#706B67] mb-8 max-w-md mx-auto">
                Profiles you like or pass on will appear here. Start exploring to see your interaction history!
              </p>
              <Button 
                onClick={() => navigate('/discovery')} 
                className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-bold px-8"
              >
                <Search className="w-4 h-4 mr-2" /> Browse Discovery
              </Button>
            </div>
          )
        ) : matches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map(match => (
              <div 
                key={match.conversationId} 
                className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#E6DCD2] flex flex-col hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-slate-100 relative">
                  {match.photos?.[0] ? (
                    <img 
                      src={match.photos[0]} 
                      alt={match.full_name} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <User className="w-16 h-16" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-green-600 text-white">Matched</Badge>
                  </div>
                  {match.is_premium && (
                    <div className="absolute top-2 right-2">
                      <Crown className="w-5 h-5 text-[#E6B450] fill-[#E6B450]" />
                    </div>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-lg text-[#1F1F1F] mb-1">{match.full_name}</h3>
                  <div className="flex items-center gap-1 text-sm text-[#706B67] mb-1">
                    {match.age && <span>{match.age}</span>}
                    {match.location_city && (
                      <>
                        {match.age && <span>•</span>}
                        <MapPin className="w-3 h-3" />
                        <span>{match.location_city}</span>
                      </>
                    )}
                  </div>
                  
                  <Button 
                    className="w-full mt-auto bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-bold"
                    onClick={() => navigate(`/chat/${match.conversationId}`)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" /> Message
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Empty State */}
            <div className="bg-white rounded-2xl border border-dashed border-[#E6DCD2] p-12 text-center">
              <Heart className="w-16 h-16 mx-auto text-[#C85A72] mb-4 opacity-50" />
              <h3 className="text-2xl font-bold text-[#1F1F1F] mb-2">No matches yet</h3>
              <p className="text-[#706B67] mb-8 max-w-md mx-auto">
                Matches appear here when someone likes you back. Keep exploring profiles to find someone special!
              </p>
              
              {/* Action Suggestions */}
              <div className="space-y-3 max-w-md mx-auto mb-8">
                {getEmptyStateSuggestions().map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={suggestion.action}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-[#E6DCD2] hover:border-[#E6B450] hover:bg-[#FFFBEB] transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#FAF7F2] group-hover:bg-[#FFFBEB]">
                        <suggestion.icon className="w-5 h-5 text-[#E6B450]" />
                      </div>
                      <span className="text-[#1F1F1F] font-medium text-left">{suggestion.text}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#706B67] group-hover:text-[#E6B450]" />
                  </button>
                ))}
              </div>

              <Button 
                onClick={() => navigate('/discovery')} 
                className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-bold px-8"
              >
                <Search className="w-4 h-4 mr-2" /> Browse Discovery
              </Button>
            </div>

            {/* Fallback: Suggested Profiles */}
            {suggestedProfiles.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E6DCD2] p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-[#1F1F1F]">Suggested Profiles</h2>
                    <p className="text-sm text-[#706B67] mt-1">Start exploring these profiles to find matches</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/discovery')}
                    className="border-[#E6B450] text-[#E6B450] hover:bg-[#FFFBEB]"
                  >
                    View All
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {suggestedProfiles.map(profile => (
                    <div
                      key={profile.id}
                      onClick={() => navigate(`/profile/${profile.id}`)}
                      className="cursor-pointer group"
                    >
                      <div className="aspect-[3/4] rounded-lg overflow-hidden bg-slate-100 relative mb-2">
                        {profile.photos?.[0] ? (
                          <img
                            src={profile.photos[0]}
                            alt={profile.full_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <User className="w-12 h-12" />
                          </div>
                        )}
                        {profile.is_premium && (
                          <div className="absolute top-1 right-1">
                            <Crown className="w-4 h-4 text-[#E6B450] fill-[#E6B450]" />
                          </div>
                        )}
                      </div>
                      <h4 className="font-semibold text-sm text-[#1F1F1F] truncate">{profile.full_name}</h4>
                      {profile.age && (
                        <p className="text-xs text-[#706B67]">{profile.age}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        <Footer />
      </div>
    </div>
  );
};

export default MatchesPage;
