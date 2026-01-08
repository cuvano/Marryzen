import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const FloatingNotificationBadge = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchUnreadCount(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchUnreadCount(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages',
        filter: `recipient_id=eq.${session.user.id}`
      }, () => {
        fetchUnreadCount(session.user.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const fetchUnreadCount = async (userId) => {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .is('read_at', null);
    
    if (!error) setUnreadCount(count || 0);
  };

  // Hide on chat page or if no unread
  if (location.pathname.startsWith('/chat') || unreadCount === 0 || !session) return null;

  return (
    <AnimatePresence>
        <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="fixed bottom-6 right-6 z-50 cursor-pointer group"
            onClick={() => navigate('/chat')}
        >
            <div className="bg-purple-600 text-white p-3 rounded-full shadow-lg relative hover:bg-purple-700 transition-colors">
                <MessageSquare className="w-6 h-6" />
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </div>
            </div>
        </motion.div>
    </AnimatePresence>
  );
};

export default FloatingNotificationBadge;