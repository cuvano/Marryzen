import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { MessageSquare, User, Heart, Search, Settings, ArrowRight, X, MapPin, Eye, Star } from 'lucide-react';
import { getPotentialMatchesCount } from '@/lib/matchStats';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Footer from '@/components/Footer';
import { Crown } from 'lucide-react';

const MatchesPage = () => {
  const { user: authUser } = useAuth();
  const [matches, setMatches] = useState([]);
  const [suggestedProfiles, setSuggestedProfiles] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pastInteractions, setPastInteractions] = useState([]);
  const [likesReceived, setLikesReceived] = useState([]);
  const [profileViews, setProfileViews] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [potentialMatchesCount, setPotentialMatchesCount] = useState(null);
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' | 'interactions' | 'likes-you' | 'profile-views' | 'favorites'
  const navigate = useNavigate();

  // Re-fetch when auth user changes so a new account in same browser doesn't see previous user's data
  useEffect(() => {
    if (!authUser?.id) {
      setMatches([]);
      setPastInteractions([]);
      setLikesReceived([]);
      setProfileViews([]);
      setFavorites([]);
      setUserProfile(null);
      setSuggestedProfiles([]);
      setPotentialMatchesCount(null);
      setLoading(false);
      return;
    }
    fetchData();
    fetchPastInteractions();
    fetchLikesReceived();
    fetchProfileViews();
    fetchFavorites();
    fetchPotentialMatchesCount();

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
  }, [authUser?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setUserProfile(profile);
      }

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

      const formatted = (data || [])
        .map((convo) => {
          const u1 = convo.user1;
          const u2 = convo.user2;
          if (!u1?.id || !u2?.id) return null;
          const otherUser = u1.id === user.id ? u2 : u1;
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
            last_message_at: convo.last_message_at,
          };
        })
        .filter(Boolean);

      const byOtherId = new Map(formatted.map((m) => [m.id, m]));

      const [{ data: myLikes }, { data: likesToMe }] = await Promise.all([
        supabase.from('user_interactions').select('target_user_id').eq('user_id', user.id).eq('interaction_type', 'like'),
        supabase.from('user_interactions').select('user_id').eq('target_user_id', user.id).eq('interaction_type', 'like'),
      ]);

      const myLikeSet = new Set((myLikes || []).map((r) => r.target_user_id));
      const mutualIds = [...new Set((likesToMe || []).map((r) => r.user_id))].filter((oid) => myLikeSet.has(oid));

      for (const otherId of mutualIds) {
        if (byOtherId.has(otherId)) continue;

        const { data: p } = await supabase
          .from('profiles')
          .select('id, full_name, photos, location_city, location_country, date_of_birth, is_premium')
          .eq('id', otherId)
          .maybeSingle();

        if (!p) continue;

        const user1_id = user.id < otherId ? user.id : otherId;
        const user2_id = user.id < otherId ? otherId : user.id;

        let { data: existingConvo } = await supabase
          .from('conversations')
          .select('id')
          .eq('user1_id', user1_id)
          .eq('user2_id', user2_id)
          .maybeSingle();

        let conversationId = existingConvo?.id;
        if (!conversationId) {
          const ins = await supabase
            .from('conversations')
            .insert({ user1_id, user2_id })
            .select('id')
            .maybeSingle();
          if (!ins.error && ins.data?.id) conversationId = ins.data.id;
          else if (ins.error) console.error('Backfill conversation:', ins.error);
        }

        const age = p.date_of_birth
          ? Math.floor((new Date() - new Date(p.date_of_birth)) / (1000 * 60 * 60 * 24 * 365))
          : null;

        const row = {
          conversationId: conversationId || null,
          id: p.id,
          full_name: p.full_name,
          photos: p.photos || [],
          location_city: p.location_city,
          location_country: p.location_country,
          age,
          is_premium: p.is_premium,
          last_message_at: null,
        };
        formatted.push(row);
        byOtherId.set(otherId, row);
      }

      formatted.sort((a, b) => {
        const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return tb - ta;
      });

      setMatches(formatted);

      if (formatted.length === 0 && profile?.status === 'approved') {
        await fetchSuggestedProfiles(user.id, profile.looking_for_gender);
      } else {
        setSuggestedProfiles([]);
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestedProfiles = async (userId, lookingForGender) => {
    try {
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

      const preferredGender = lookingForGender?.trim();
      const genderValues = !preferredGender ? [] : preferredGender === 'Man' ? ['Man', 'Male'] : preferredGender === 'Woman' ? ['Woman', 'Female'] : [preferredGender];

      let query = supabase
        .from('profiles')
        .select('id, full_name, photos, location_city, location_country, date_of_birth, is_premium, identify_as')
        .eq('status', 'approved')
        .limit(24);
      if (genderValues.length > 0) {
        query = query.in('identify_as', genderValues);
      }
      const { data: profiles, error } = await query;

      if (error) throw error;

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

  const fetchPotentialMatchesCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const count = await getPotentialMatchesCount(supabase, user.id);
      setPotentialMatchesCount(count);
    } catch (error) {
      console.error('Error fetching potential matches count:', error);
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

      const { data: likes, error } = await supabase
        .from('user_interactions')
        .select('id, created_at, user_id')
        .eq('target_user_id', user.id)
        .eq('interaction_type', 'like')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching likes received:', error);
        return;
      }

      const likerIds = [...new Set((likes || []).map((l) => l.user_id).filter(Boolean))];
      const profilesById = {};
      if (likerIds.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('id, full_name, photos, location_city, location_country, date_of_birth, is_premium')
          .in('id', likerIds);
        if (pErr) console.error('Error loading liker profiles:', pErr);
        (profs || []).forEach((p) => {
          profilesById[p.id] = p;
        });
      }

      const formatted = (likes || []).map((like) => {
        const profile = profilesById[like.user_id];
        const age = profile?.date_of_birth
          ? Math.floor((new Date() - new Date(profile.date_of_birth)) / (1000 * 60 * 60 * 24 * 365))
          : null;

        return {
          id: like.id,
          createdAt: like.created_at,
          profile: {
            id: profile?.id ?? like.user_id,
            full_name: profile?.full_name || 'Member',
            photos: profile?.photos || [],
            location_city: profile?.location_city,
            location_country: profile?.location_country,
            age,
            is_premium: profile?.is_premium,
          },
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

      const { data: views, error } = await supabase
        .from('profile_views')
        .select('id, viewed_at, viewer_id')
        .eq('viewed_profile_id', user.id)
        .order('viewed_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching profile views:', error);
        return;
      }

      const viewerIds = [...new Set((views || []).map((v) => v.viewer_id).filter(Boolean))];
      const profilesById = {};
      if (viewerIds.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('id, full_name, photos, location_city, location_country, date_of_birth, is_premium')
          .in('id', viewerIds);
        if (pErr) console.error('Error loading viewer profiles:', pErr);
        (profs || []).forEach((p) => {
          profilesById[p.id] = p;
        });
      }

      const formatted = (views || []).map((view) => {
        const profile = profilesById[view.viewer_id];
        const age = profile?.date_of_birth
          ? Math.floor((new Date() - new Date(profile.date_of_birth)) / (1000 * 60 * 60 * 24 * 365))
          : null;

        return {
          id: view.id,
          viewedAt: view.viewed_at,
          profile: {
            id: profile?.id ?? view.viewer_id,
            full_name: profile?.full_name || 'Member',
            photos: profile?.photos || [],
            location_city: profile?.location_city,
            location_country: profile?.location_country,
            age,
            is_premium: profile?.is_premium,
          },
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

      const { data: favs, error } = await supabase
        .from('favorites')
        .select('id, created_at, favorited_user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching favorites:', error);
        return;
      }

      const favUserIds = [...new Set((favs || []).map((f) => f.favorited_user_id).filter(Boolean))];
      const profilesById = {};
      if (favUserIds.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('id, full_name, photos, location_city, location_country, date_of_birth, is_premium')
          .in('id', favUserIds);
        if (pErr) console.error('Error loading favorite profiles:', pErr);
        (profs || []).forEach((p) => {
          profilesById[p.id] = p;
        });
      }

      const formatted = (favs || []).map((fav) => {
        const profile = profilesById[fav.favorited_user_id];
        const age = profile?.date_of_birth
          ? Math.floor((new Date() - new Date(profile.date_of_birth)) / (1000 * 60 * 60 * 24 * 365))
          : null;

        return {
          id: fav.id,
          createdAt: fav.created_at,
          profile: {
            id: profile?.id ?? fav.favorited_user_id,
            full_name: profile?.full_name || 'Member',
            photos: profile?.photos || [],
            location_city: profile?.location_city,
            location_country: profile?.location_country,
            age,
            is_premium: profile?.is_premium,
          },
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
          <p className="text-[#706B67] mb-2">
            {activeTab === 'matches'
              ? (matches.length > 0
                  ? "Mutual likes turn into conversations. Be respectful and sincere."
                  : "Profiles who liked you back appear here. Like people on Discovery to get matches!")
              : "View profiles you've liked or passed on."}
          </p>
          {potentialMatchesCount !== null && (
            <p className="text-sm text-[#706B67] mb-4">
              <span className="font-medium text-[#1F1F1F]">Potential matches:</span> {potentialMatchesCount} — people you haven&apos;t liked or passed yet. Find them on <button type="button" onClick={() => navigate('/discovery')} className="text-[#E6B450] font-medium hover:underline">Profiles</button>.
            </p>
          )}
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
            {userProfile?.is_premium && (
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
            )}
            <button
              onClick={() => setActiveTab('likes-you')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'likes-you'
                  ? 'text-[#E6B450] border-b-2 border-[#E6B450]'
                  : 'text-[#706B67] hover:text-[#1F1F1F]'
              }`}
            >
              Likes You ({likesReceived.length})
            </button>
            {userProfile?.is_premium && (
              <button
                onClick={() => setActiveTab('profile-views')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'profile-views'
                    ? 'text-[#E6B450] border-b-2 border-[#E6B450]'
                    : 'text-[#706B67] hover:text-[#1F1F1F]'
                }`}
              >
                Who Viewed You ({profileViews.length})
              </button>
            )}
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
          // Likes You Tab - Show blurred profiles for basic users, full for premium
          likesReceived.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {likesReceived.map(item => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#E6DCD2] flex flex-col hover:shadow-md transition-shadow relative"
                >
                  <div className="aspect-square bg-slate-100 relative overflow-hidden">
                    {item.profile.photos?.[0] ? (
                      <img
                        src={item.profile.photos[0]}
                        alt={item.profile.full_name}
                        className={`w-full h-full object-cover ${!userProfile?.is_premium ? 'blur-lg scale-110' : ''}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <User className="w-16 h-16" />
                      </div>
                    )}
                    {!userProfile?.is_premium && (
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <Crown className="w-16 h-16 text-white/60" />
                      </div>
                    )}
                    {item.profile.is_premium && userProfile?.is_premium && (
                      <div className="absolute top-2 right-2 z-10">
                        <Crown className="w-5 h-5 text-[#E6B450] fill-[#E6B450]" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 z-10">
                      <Badge className="bg-[#E6B450] text-[#1F1F1F] font-bold">Liked you</Badge>
                    </div>
                  </div>
                  <div className={`p-4 flex-1 flex flex-col ${!userProfile?.is_premium ? 'opacity-60' : ''}`}>
                    <h3 className="font-bold text-lg text-[#1F1F1F] mb-1">
                      {userProfile?.is_premium ? item.profile.full_name : 'Someone liked you'}
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
                      {!userProfile?.is_premium && (
                        <span className="text-xs italic">Upgrade to see details</span>
                      )}
                    </div>
                    <p className="text-xs text-[#706B67] mb-4">
                      {userProfile?.is_premium ? new Date(item.createdAt).toLocaleDateString() : 'Unlock Premium to see who liked you'}
                    </p>
                    <Button
                      className={`w-full mt-auto font-bold ${userProfile?.is_premium ? 'bg-[#1F1F1F] text-white hover:bg-[#333333]' : 'bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D]'}`}
                      onClick={() => userProfile?.is_premium ? navigate(`/profile/${item.profile.id}`) : navigate('/premium')}
                    >
                      {userProfile?.is_premium ? 'View Profile' : (
                        <>
                          <Crown className="w-4 h-4 mr-2" /> Unlock Premium
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
          // Who Viewed Your Profile Tab - Premium only feature
          userProfile?.is_premium ? (
            profileViews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {profileViews.map(item => (
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
                        <Badge className="bg-blue-600 text-white font-bold">Viewed you</Badge>
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-bold text-lg text-[#1F1F1F] mb-1">
                        {item.profile.full_name}
                      </h3>
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
                        {new Date(item.viewedAt).toLocaleDateString()}
                      </p>
                      <Button
                        className="w-full mt-auto font-bold bg-[#1F1F1F] text-white hover:bg-[#333333]"
                        onClick={() => navigate(`/profile/${item.profile.id}`)}
                      >
                        View Profile
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
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-[#E6DCD2] p-12 text-center">
              <Crown className="w-16 h-16 mx-auto text-[#E6B450] mb-4 opacity-50" />
              <h3 className="text-2xl font-bold text-[#1F1F1F] mb-2">Premium Feature</h3>
              <p className="text-[#706B67] mb-8 max-w-md mx-auto">
                See who viewed your profile is a Premium feature. Upgrade to unlock this feature and see who's interested in you!
              </p>
              <Button
                onClick={() => navigate('/premium')}
                className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-bold px-8"
              >
                <Crown className="w-4 h-4 mr-2" /> Upgrade to Premium
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
          // Past Interactions Tab - Premium only feature
          userProfile?.is_premium ? (
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
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-[#E6DCD2] p-12 text-center">
              <Crown className="w-16 h-16 mx-auto text-[#E6B450] mb-4 opacity-50" />
              <h3 className="text-2xl font-bold text-[#1F1F1F] mb-2">Premium Feature</h3>
              <p className="text-[#706B67] mb-8 max-w-md mx-auto">
                View Past Interactions is a Premium feature. Upgrade to unlock this feature and see your complete interaction history!
              </p>
              <Button
                onClick={() => navigate('/premium')}
                className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-bold px-8"
              >
                <Crown className="w-4 h-4 mr-2" /> Upgrade to Premium
              </Button>
            </div>
          )
        ) : matches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {matches.map(match => (
              <div 
                key={match.id} 
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
                                onClick={async () => {
                                  let cid = match.conversationId;
                                  if (!cid) {
                                    const { data: { user: u } } = await supabase.auth.getUser();
                                    if (!u) return;
                                    const user1_id = u.id < match.id ? u.id : match.id;
                                    const user2_id = u.id < match.id ? match.id : u.id;
                                    const ins = await supabase
                                      .from('conversations')
                                      .insert({ user1_id, user2_id })
                                      .select('id')
                                      .maybeSingle();
                                    if (!ins.error && ins.data?.id) cid = ins.data.id;
                                  }
                                  if (cid) navigate(`/chat/${cid}`);
                                }}
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
              <p className="text-[#706B67] mb-2 max-w-md mx-auto">
                <strong>Matches</strong> are people who liked you back. When you like someone and they like you, they show up here.
              </p>
              {potentialMatchesCount != null && potentialMatchesCount > 0 && (
                <p className="text-[#706B67] mb-8 max-w-md mx-auto">
                  You have <strong>{potentialMatchesCount} potential matches</strong> to explore — go to Profiles to see and like them.
                </p>
              )}
              {(!potentialMatchesCount || potentialMatchesCount === 0) && (
                <p className="text-[#706B67] mb-8 max-w-md mx-auto">
                  Keep exploring profiles on Discovery to find someone special!
                </p>
              )}
              
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
