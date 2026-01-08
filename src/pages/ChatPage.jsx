import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, MoreVertical, ShieldAlert, Crown, Smile } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ChatPage = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [dailyMessageCount, setDailyMessageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const typingTimeoutRef = useRef(null);
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/login');
      
      const { data: profile } = await supabase.from('profiles').select('*, is_premium, email_verified').eq('id', user.id).single();
      setCurrentUser(profile);

      // Check daily message count for free users
      const today = new Date();
      today.setHours(0,0,0,0);
      const { count } = await supabase
         .from('messages')
         .select('*', { count: 'exact', head: true })
         .eq('sender_id', user.id)
         .gte('created_at', today.toISOString());
      
      setDailyMessageCount(count || 0);

      const { data: convos } = await supabase
        .from('conversations')
        .select(`*, user1:user1_id(id, full_name, photos), user2:user2_id(id, full_name, photos)`)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });
      
      const formatted = convos?.map(c => {
          const partner = c.user1.id === user.id ? c.user2 : c.user1;
          return { ...c, partner };
      }) || [];
      
      setConversations(formatted);
      setLoading(false);

      if (conversationId) {
          const active = formatted.find(c => c.id === conversationId);
          if (active) setActiveConversation(active);
      }
    };
    init();
  }, [conversationId, navigate]);

  useEffect(() => {
    if (!activeConversation) return;
    
    // Fetch Messages & Reactions
    const fetchMessages = async () => {
        const { data } = await supabase
            .from('messages')
            .select('*, reactions:message_reactions(id, reaction_emoji, user_id)')
            .eq('conversation_id', activeConversation.id)
            .order('created_at');
        setMessages(data || []);
    };
    fetchMessages();

    // Messages Channel
    const channel = supabase.channel(`convo:${activeConversation.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversation.id}` }, (payload) => {
            setMessages(prev => [...prev, { ...payload.new, reactions: [] }]);
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
             if (payload.payload.userId !== currentUser.id) {
                 setTypingUsers(prev => new Set(prev).add(payload.payload.userId));
                 setTimeout(() => {
                     setTypingUsers(prev => {
                         const next = new Set(prev);
                         next.delete(payload.payload.userId);
                         return next;
                     });
                 }, 3000);
             }
        })
        .subscribe();
    
    // Reaction Channel (Separate subscription or same channel depending on implementation details, using separate for clarity)
    const reactionChannel = supabase.channel(`reactions:${activeConversation.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
            fetchMessages(); // Refresh messages to get reactions updated
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(reactionChannel);
    };
  }, [activeConversation, currentUser]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typingUsers]);

  const handleTyping = (e) => {
      setMessageText(e.target.value);
      
      if (!typingTimeoutRef.current && activeConversation) {
          supabase.channel(`convo:${activeConversation.id}`).send({
              type: 'broadcast',
              event: 'typing',
              payload: { userId: currentUser.id }
          });
          typingTimeoutRef.current = setTimeout(() => {
              typingTimeoutRef.current = null;
          }, 3000);
      }
  };

  const handleSendMessage = async () => {
      if (!messageText.trim() || !currentUser || !activeConversation) return;
      
      if (!currentUser.email_verified) {
          toast({ title: "Email Verification Required", description: "Please verify your email to send messages.", variant: "destructive" });
          return;
      }

      if (!currentUser.is_premium && dailyMessageCount >= 10) {
          toast({ title: "Daily Limit Reached", description: "Upgrade to Premium for unlimited chat.", variant: "destructive" });
          return;
      }

      const { error } = await supabase.from('messages').insert({
          conversation_id: activeConversation.id,
          sender_id: currentUser.id,
          recipient_id: activeConversation.partner.id,
          content: messageText
      });

      if (!error) {
          setDailyMessageCount(prev => prev + 1);
          setMessageText('');
          await supabase.from('conversations').update({ last_message_at: new Date() }).eq('id', activeConversation.id);
      } else {
          toast({ title: "Failed to send", variant: "destructive" });
      }
  };

  const toggleReaction = async (messageId, emoji) => {
      const { data: existing } = await supabase.from('message_reactions').select('id').eq('message_id', messageId).eq('user_id', currentUser.id).eq('reaction_emoji', emoji).single();
      
      if (existing) {
          await supabase.from('message_reactions').delete().eq('id', existing.id);
      } else {
          await supabase.from('message_reactions').insert({
              message_id: messageId,
              user_id: currentUser.id,
              reaction_emoji: emoji
          });
      }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#FAF7F2] overflow-hidden">
      <div className={`w-full md:w-80 bg-white border-r border-[#E6DCD2] flex flex-col ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
         <div className="p-4 border-b border-[#E6DCD2]">
            <h2 className="font-bold text-xl text-[#1F1F1F]">Messages</h2>
         </div>
         <div className="flex-1 overflow-y-auto">
             {conversations.map(convo => (
                <div key={convo.id} onClick={() => navigate(`/chat/${convo.id}`)} className={`p-4 border-b cursor-pointer hover:bg-[#FAF7F2] flex gap-3 ${activeConversation?.id === convo.id ? 'bg-[#FAF7F2]' : ''}`}>
                    <img src={convo.partner.photos?.[0] || 'https://via.placeholder.com/50'} className="w-12 h-12 rounded-full object-cover" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-sm">{convo.partner.full_name}</h3>
                        <p className="text-xs text-slate-500 truncate">Click to chat...</p>
                    </div>
                </div>
             ))}
         </div>
      </div>
      <div className={`flex-1 flex flex-col h-full bg-[#FAF7F2] ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
         {activeConversation ? (
            <>
                <div className="bg-white p-4 border-b border-[#E6DCD2] flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => navigate('/chat')}><ArrowLeft/></Button>
                        <h3 className="font-bold">{activeConversation.partner.full_name}</h3>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.sender_id === currentUser.id ? 'items-end' : 'items-start'}`}>
                            <div className="relative group max-w-[80%]">
                                <div className={`rounded-2xl px-4 py-2 text-sm ${msg.sender_id === currentUser.id ? 'bg-[#E6B450] text-[#1F1F1F]' : 'bg-white border'}`}>
                                    {msg.content}
                                </div>
                                {/* Reaction Picker Trigger */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="absolute -right-8 top-1 opacity-0 group-hover:opacity-100 h-6 w-6 rounded-full bg-white shadow-sm border">
                                            <Smile className="w-3 h-3 text-gray-500" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-2 flex gap-1">
                                        {['❤️', '😂', '😮', '😢', '👍'].map(emoji => (
                                            <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} className="hover:bg-gray-100 p-1 rounded text-lg">{emoji}</button>
                                        ))}
                                    </PopoverContent>
                                </Popover>
                                
                                {/* Reactions Display */}
                                {msg.reactions && msg.reactions.length > 0 && (
                                    <div className="flex gap-1 mt-1">
                                        {Array.from(new Set(msg.reactions.map(r => r.reaction_emoji))).map(emoji => {
                                            const count = msg.reactions.filter(r => r.reaction_emoji === emoji).length;
                                            const meReacted = msg.reactions.some(r => r.reaction_emoji === emoji && r.user_id === currentUser.id);
                                            return (
                                                <Badge key={emoji} variant="secondary" className={`text-[10px] px-1 py-0 ${meReacted ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>
                                                    {emoji} {count > 1 && count}
                                                </Badge>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {typingUsers.size > 0 && (
                        <div className="flex items-center gap-2 text-xs text-gray-400 ml-4 animate-pulse">
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            Someone is typing...
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-4 bg-white border-t border-[#E6DCD2]">
                    {!currentUser?.email_verified ? (
                         <div className="bg-yellow-50 p-3 rounded text-center text-sm text-yellow-800">
                             Verify your email to start chatting. <span className="underline font-bold cursor-pointer" onClick={() => navigate('/verify-email')}>Verify Now</span>
                         </div>
                    ) : !currentUser?.is_premium && dailyMessageCount >= 10 ? (
                         <div className="bg-yellow-50 p-3 rounded text-center text-sm text-yellow-800">
                             <Crown className="w-4 h-4 inline mr-1" /> Daily message limit reached. <span className="underline font-bold cursor-pointer" onClick={() => navigate('/premium')}>Upgrade to Premium</span>
                         </div>
                    ) : (
                        <div className="flex items-center gap-2">
                             <Input 
                                value={messageText} 
                                onChange={handleTyping}
                                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Type a respectful message..."
                                className="flex-1"
                             />
                             <Button onClick={handleSendMessage} disabled={!messageText.trim()}>Send</Button>
                        </div>
                    )}
                </div>
            </>
         ) : <div className="flex-1 flex items-center justify-center text-slate-400">Select a conversation</div>}
      </div>
    </div>
  );
};

export default ChatPage;