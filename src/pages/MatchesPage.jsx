import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Footer from '@/components/Footer';

const MatchesPage = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch conversations (which are effectively matches in this system)
    const { data, error } = await supabase
        .from('conversations')
        .select(`
            id,
            user1:user1_id(id, full_name, photos, location_city),
            user2:user2_id(id, full_name, photos, location_city),
            last_message_at
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

    if (error) console.error(error);
    
    // Format data to identify "the other person"
    const formatted = data?.map(convo => {
        const otherUser = convo.user1.id === user.id ? convo.user2 : convo.user1;
        return {
            conversationId: convo.id,
            ...otherUser
        };
    }) || [];

    setMatches(formatted);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-[#1F1F1F] mb-2">Your Matches</h1>
        <p className="text-[#706B67] mb-8">Mutual likes turn into conversations. Be respectful and sincere.</p>

        {loading ? (
           <div>Loading...</div>
        ) : matches.length === 0 ? (
           <div className="text-center py-20 bg-white rounded-xl border border-dashed border-[#E6DCD2]">
                <h3 className="text-xl font-bold text-[#1F1F1F]">No matches yet</h3>
                <p className="text-[#706B67] mt-2 mb-6">Keep exploring profiles to find someone special.</p>
                <Button onClick={() => navigate('/discovery')} className="bg-[#E6B450] text-[#1F1F1F]">Go to Discovery</Button>
           </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {matches.map(match => (
                    <div key={match.conversationId} className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#E6DCD2] flex flex-col">
                        <div className="aspect-square bg-slate-100 relative">
                            {match.photos?.[0] ? (
                                <img src={match.photos[0]} alt={match.full_name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <User className="w-12 h-12" />
                                </div>
                            )}
                            <div className="absolute bottom-2 left-2">
                                <Badge className="bg-green-600">Matched</Badge>
                            </div>
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                            <h3 className="font-bold text-lg">{match.full_name}</h3>
                            <p className="text-sm text-[#706B67] mb-4">{match.location_city || 'Location Hidden'}</p>
                            
                            <Button 
                                className="w-full mt-auto bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D]"
                                onClick={() => navigate(`/chat/${match.conversationId}`)}
                            >
                                <MessageSquare className="w-4 h-4 mr-2" /> Message
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        )}
        <Footer />
      </div>
    </div>
  );
};

export default MatchesPage;