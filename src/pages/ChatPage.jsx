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
  
  // Throttling state
  const [messageSendTimes, setMessageSendTimes] = useState([]);
  const messagesPerMinute = 10;
  const messageThrottleMs = 6000; // 6 seconds between messages minimum
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/login');
      
      const { data: profile, error: profileError } = await supabase.from('profiles').select('*, is_premium, email_verified').eq('id', user.id).maybeSingle();
      if (profileError && profileError.code !== 'PGRST116' && profileError.code !== 'NOT_FOUND') {
        console.error('Profile fetch error:', profileError);
      }
      if (profile) {
        setCurrentUser(profile);
      }

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

  // Spam detection
  const detectSpam = (text) => {
    const lowerText = text.toLowerCase();
    
    // Check for URLs
    const urlPattern = /(https?:\/\/|www\.|\.com|\.net|\.org|\.io|bit\.ly|tinyurl)/i;
    if (urlPattern.test(text)) {
      return { isSpam: true, reason: "URLs are not allowed in messages for security reasons." };
    }
    
    // Check for phone numbers
    const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
    if (phonePattern.test(text)) {
      return { isSpam: true, reason: "Phone numbers are not allowed. Please use Marryzen messaging to communicate." };
    }
    
    // Check for email addresses
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    if (emailPattern.test(text)) {
      return { isSpam: true, reason: "Email addresses are not allowed. Please use Marryzen messaging to communicate." };
    }
    
    // Check for common spam words/phrases
    const spamWords = ['click here', 'buy now', 'free money', 'make money', 'work from home', 'get rich', 'viagra', 'casino', 'lottery'];
    if (spamWords.some(word => lowerText.includes(word))) {
      return { isSpam: true, reason: "Your message contains prohibited content. Please send a respectful message." };
    }
    
    // Check for excessive capitalization (shouting)
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.7 && text.length > 10) {
      return { isSpam: false, warning: "Please avoid using excessive capitalization." };
    }
    
    // Check for repeated characters (e.g., "heyyyyyyyy")
    if (/(.)\1{4,}/.test(text)) {
      return { isSpam: false, warning: "Please avoid excessive character repetition." };
    }
    
    return { isSpam: false };
  };

  // Check for repeated messages (same message sent multiple times)
  const checkRepeatedMessage = async (text) => {
    if (!currentUser || !activeConversation) {
      return { isRepeated: false };
    }
    
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('content')
      .eq('sender_id', currentUser.id)
      .eq('conversation_id', activeConversation.id)
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (recentMessages && recentMessages.length > 0) {
      const exactMatches = recentMessages.filter(msg => msg.content.trim().toLowerCase() === text.trim().toLowerCase()).length;
      if (exactMatches >= 2) {
        return { isRepeated: true, reason: "You've already sent a similar message. Please send something different." };
      }
    }
    
    return { isRepeated: false };
  };

  const handleSendMessage = async () => {
      if (!messageText.trim() || !currentUser || !activeConversation) return;
      
      if (!currentUser.email_verified) {
          toast({ title: "Email Verification Required", description: "Please verify your email to send messages.", variant: "destructive" });
          return;
      }

      // Spam detection
      const spamCheck = detectSpam(messageText);
      if (spamCheck.isSpam) {
          toast({ 
              title: "Message Not Allowed", 
              description: spamCheck.reason,
              variant: "destructive" 
          });
          return;
      }
      
      if (spamCheck.warning) {
          // Show warning but allow sending
          toast({ 
              title: "Warning", 
              description: spamCheck.warning,
              variant: "default" 
          });
      }
      
      // Check for repeated messages
      const repeatCheck = await checkRepeatedMessage(messageText);
      if (repeatCheck.isRepeated) {
          toast({ 
              title: "Repeated Message", 
              description: repeatCheck.reason,
              variant: "destructive" 
          });
          return;
      }

      // Throttling: Check messages per minute
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      const recentMessages = messageSendTimes.filter(time => time > oneMinuteAgo);
      
      if (recentMessages.length >= messagesPerMinute) {
          toast({ 
              title: "Rate Limit", 
              description: `You can send up to ${messagesPerMinute} messages per minute. Please wait a moment.`,
              variant: "destructive" 
          });
          return;
      }

      // Throttling: Minimum 6 seconds between messages
      if (messageSendTimes.length > 0) {
          const lastMessageTime = messageSendTimes[messageSendTimes.length - 1];
          if (now - lastMessageTime < messageThrottleMs) {
              const waitSeconds = Math.ceil((messageThrottleMs - (now - lastMessageTime)) / 1000);
              toast({ 
                  title: "Please wait", 
                  description: `Please wait ${waitSeconds} more second${waitSeconds > 1 ? 's' : ''} before sending another message.`,
                  variant: "destructive" 
              });
              return;
          }
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
          setMessageSendTimes(prev => [...prev, now].filter(time => time > oneMinuteAgo)); // Keep only last minute
          setMessageText('');
          await supabase.from('conversations').update({ last_message_at: new Date() }).eq('id', activeConversation.id);
      } else {
          toast({ title: "Failed to send", variant: "destructive" });
      }
  };

  const toggleReaction = async (messageId, emoji) => {
      const { data: existing, error: existingError } = await supabase.from('message_reactions').select('id').eq('message_id', messageId).eq('user_id', currentUser.id).eq('reaction_emoji', emoji).maybeSingle();
      if (existingError && existingError.code !== 'PGRST116' && existingError.code !== 'NOT_FOUND') {
        console.error('Reaction check error:', existingError);
      }
      
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
                             <Crown className="w-4 h-4 inline mr-1" /> Daily message limit reached (10/10). <span className="underline font-bold cursor-pointer" onClick={() => navigate('/premium')}>Upgrade to Premium</span>
                         </div>
                    ) : (
                        <>
                            {!currentUser?.is_premium && (
                                <div className="mb-2 text-xs text-center text-[#706B67]">
                                    Messages today: <span className="font-bold">{dailyMessageCount}/10</span>
                                    {dailyMessageCount >= 8 && <span className="text-yellow-600 ml-2">• Limit soon</span>}
                                </div>
                            )}
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
                        </>
                    )}
                </div>
            </>
         ) : <div className="flex-1 flex items-center justify-center text-slate-400">Select a conversation</div>}
      </div>
    </div>
  );
};

export default ChatPage;