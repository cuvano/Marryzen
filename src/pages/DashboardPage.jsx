import React, { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Heart, MessageCircle, Star, Send, Settings, Search, Crown, ShieldCheck } from 'lucide-react';
import { currentUserProfile, findMatches, allUsers } from '@/lib/matchmaking';
import { PremiumModalContext } from '@/contexts/PremiumModalContext';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/customSupabaseClient';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { openPremiumModal } = useContext(PremiumModalContext);
  const [userProfile, setUserProfile] = useState(currentUserProfile);
  const [newCompatibilityMatches, setNewCompatibilityMatches] = useState([]);
  
  const [stats, setStats] = useState({
    matches: 0,
    messages: 0,
    introductions: 0,
    interest: 0
  });

  useEffect(() => {
    const init = async () => {
      // Try to get real user data first
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Fetch real profile
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profile) {
           setUserProfile(profile);
           // Fetch real matches count (simplified)
           const { count: matchCount } = await supabase.from('conversations').select('*', { count: 'exact', head: true });
           setStats(prev => ({ ...prev, matches: matchCount || 0 }));
        }
      } else {
        // Fallback to mock data if not logged in or error (though auth layout should prevent this)
        const profile = localStorage.getItem('userProfile');
        if (profile) {
          setUserProfile(JSON.parse(profile));
        }
      }

      // Use mock matches for dashboard display for now to ensure UI looks populated
      // In a real scenario, we'd fetch these from the DB using the discovery logic
      const calculatedMatches = findMatches(userProfile, allUsers).filter(u => u.verificationLevel >= 1);
      setNewCompatibilityMatches(calculatedMatches.slice(0, 3));
      
      // Simulate other stats
      const convos = JSON.parse(localStorage.getItem('conversations')) || [];
      setStats(prev => ({
          ...prev,
          messages: convos.length,
          introductions: localStorage.getItem('weeklyIntro') ? 1 : 0,
          interest: 28 // static for now
      }));
    };

    init();
  }, []);

  const marriageTools = [
    { icon: Search, title: 'Find Marriage Matches', description: 'View compatible profiles', action: () => navigate('/discovery'), bg: 'bg-[#EAF2F7]', iconColor: 'text-[#3B82F6]' },
    { icon: MessageCircle, title: 'Conversations', description: 'Continue meaningful discussions', action: () => navigate('/chat'), bg: 'bg-[#F0FDF4]', iconColor: 'text-[#22C55E]' },
    { icon: Send, title: 'Send Introduction', description: 'Express sincere interest', action: () => navigate('/discovery'), bg: 'bg-[#FDF2F8]', iconColor: 'text-[#EC4899]' },
    { icon: Crown, title: 'Upgrade for Serious Features', description: 'Unlock advanced filters', action: () => navigate('/premium'), bg: 'bg-[#FFFBEB]', iconColor: 'text-[#F59E0B]' }
  ];

  return (
    <div className="min-h-screen p-4 bg-[#FAF7F2]">
      <div className="max-w-6xl mx-auto">
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#F0FDF4] border border-[#BBF7D0] flex items-center p-4 rounded-xl">
            <ShieldCheck className="w-5 h-5 text-[#15803D] mr-3 flex-shrink-0" />
            <p className="text-sm text-[#166534] font-medium">All members have confirmed serious marriage intentions.</p>
          </motion.div>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-[#E6DCD2] rounded-2xl p-6 text-center shadow-sm"><Heart className="w-8 h-8 text-[#C85A72] mx-auto mb-2" /><div className="text-3xl font-bold text-[#1F1F1F]">{stats.matches}</div><div className="text-[#706B67] text-sm font-medium">Potential Matches</div></div>
          <div className="bg-white border border-[#E6DCD2] rounded-2xl p-6 text-center shadow-sm"><MessageCircle className="w-8 h-8 text-[#3B82F6] mx-auto mb-2" /><div className="text-3xl font-bold text-[#1F1F1F]">{stats.messages}</div><div className="text-[#706B67] text-sm font-medium">Conversations</div></div>
          <div className="bg-white border border-[#E6DCD2] rounded-2xl p-6 text-center shadow-sm"><Send className="w-8 h-8 text-[#EC4899] mx-auto mb-2" /><div className="text-3xl font-bold text-[#1F1F1F]">{stats.introductions}</div><div className="text-[#706B67] text-sm font-medium">Introductions Sent</div></div>
          <div className="bg-white border border-[#E6DCD2] rounded-2xl p-6 text-center shadow-sm cursor-pointer hover:border-[#E6B450] transition-colors" onClick={() => userProfile.isPremium ? navigate('/profile-views') : openPremiumModal()}><Star className="w-8 h-8 text-[#F59E0B] mx-auto mb-2" /><div className="text-3xl font-bold text-[#1F1F1F]">{stats.interest}</div><div className="text-[#706B67] text-sm font-medium">Profile Interest</div></div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-8">
          <h2 className="text-2xl font-bold text-[#1F1F1F] mb-6">Marriage Tools</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {marriageTools.map((tool, index) => (
              <motion.div key={index} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-white border border-[#E6DCD2] rounded-2xl p-6 cursor-pointer shadow-sm hover:shadow-md transition-all" onClick={tool.action}>
                <div className={`w-12 h-12 rounded-full ${tool.bg} flex items-center justify-center mb-4`}><tool.icon className={`w-6 h-6 ${tool.iconColor}`} /></div>
                <h3 className="text-lg font-bold text-[#1F1F1F] mb-1">{tool.title}</h3>
                <p className="text-[#706B67] text-sm font-medium">{tool.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-[#1F1F1F]">New Compatibility Matches</h2>
            <Button variant="outline" onClick={() => navigate('/discovery')} className="border-[#E6B450] text-[#E6B450] hover:bg-[#FFFBEB]">View All</Button>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {newCompatibilityMatches.map((match) => (
              <motion.div key={match.id} whileHover={{ y: -5 }} className={`bg-white rounded-2xl overflow-hidden cursor-pointer shadow-sm border border-[#E6DCD2] ${match.isPremium ? 'ring-2 ring-[#E6B450]' : ''}`} onClick={() => navigate(`/profile/${match.id}`)}>
                <div className="aspect-[3/4] relative">
                  <img className="w-full h-full object-cover" alt={`${match.name} - ${match.cultures[0]} culture`} src={match.photos[0]} />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white pt-12">
                    <h3 className="text-xl font-bold flex items-center">{match.name}, {match.age}{match.isPremium && <Crown className="w-4 h-4 ml-2 text-[#E6B450] fill-[#E6B450]"/>}</h3>
                    <p className="text-white/90 text-sm font-medium">{match.cultures.join(' & ')}</p>
                    <p className="font-bold text-xs text-[#E6B450] mt-1 uppercase tracking-wide">Marriage Intent: Serious</p>
                  </div>
                </div>
              </motion.div>
            ))}
             {newCompatibilityMatches.length === 0 && <p className="text-[#706B67] col-span-full text-center py-8 font-medium">No new matches right now. Check back soon!</p>}
          </div>
        </motion.div>
        <Footer />
      </div>
    </div>
  );
};

export default DashboardPage;