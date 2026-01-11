import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, User, Heart, Search, Settings, ArrowRight, X, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Footer from '@/components/Footer';
import { Crown } from 'lucide-react';

const MatchesPage = () => {
  const [matches, setMatches] = useState([]);
  const [suggestedProfiles, setSuggestedProfiles] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
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
          <p className="text-[#706B67]">
            {matches.length > 0 
              ? "Mutual likes turn into conversations. Be respectful and sincere."
              : "These are profiles who have liked you back. Start a conversation!"}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 border-4 border-[#E6B450] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[#706B67] font-medium">Loading your matches...</p>
          </div>
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
