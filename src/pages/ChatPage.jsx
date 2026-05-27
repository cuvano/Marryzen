import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, MoreVertical, ShieldAlert, Crown, Smile } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ReportUserModal from '@/components/ReportUserModal';
import BlockUserModal from '@/components/BlockUserModal';

import { Helmet } from 'react-helmet';
import { funnel } from '@/lib/analytics';
const ChatPage = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [partnerPremiumStatus, setPartnerPremiumStatus] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
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

  const markConversationAsRead = async () => {
    if (!currentUser || !activeConversation) return;
    try {
      // Mark any messages sent TO the current user as read
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', activeConversation.id)
        .eq('recipient_id', currentUser.id)
        .is('read_at', null);
    } catch (e) {
      // Non-fatal (RLS/schema may not be updated yet)
      console.error('Mark read failed:', e);
    }
  };

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
        .select(`*, user1:user1_id(id, full_name, photos, is_premium, premium_expires_at), user2:user2_id(id, full_name, photos, is_premium, premium_expires_at)`)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });
      
      const formatted = convos?.map(c => {
          const partner = c.user1.id === user.id ? c.user2 : c.user1;
          // Check if partner is premium
          const isPartnerPremium = partner.is_premium && 
            (!partner.premium_expires_at || new Date(partner.premium_expires_at) > new Date());
          return { ...c, partner: { ...partner, is_premium_active: isPartnerPremium } };
      }) || [];
      
      setConversations(formatted);
      setLoading(false);

      if (conversationId) {
          const active = formatted.find(c => c.id === conversationId);
          if (active) {
            setActiveConversation(active);
            // Fetch partner's premium status
            const { data: partnerProfile } = await supabase
              .from('profiles')
              .select('is_premium, premium_expires_at')
              .eq('id', active.partner.id)
              .maybeSingle();
            
            if (partnerProfile) {
              const isPremiumActive = partnerProfile.is_premium && 
                (!partnerProfile.premium_expires_at || new Date(partnerProfile.premium_expires_at) > new Date());
              setPartnerPremiumStatus(isPremiumActive);
            }
          }
      }
    };
    init();
  }, [conversationId, navigate]);

  useEffect(() => {
    if (!activeConversation) return;
    
    // Fetch partner's premium status
    const fetchPartnerPremiumStatus = async () => {
      if (activeConversation?.partner?.id) {
        const { data: partnerProfile } = await supabase
          .from('profiles')
          .select('is_premium, premium_expires_at')
          .eq('id', activeConversation.partner.id)
          .maybeSingle();
        
        if (partnerProfile) {
          const isPremiumActive = partnerProfile.is_premium && 
            (!partnerProfile.premium_expires_at || new Date(partnerProfile.premium_expires_at) > new Date());
          setPartnerPremiumStatus(isPremiumActive);
        }
      }
    };
    
    // Fetch Messages & Reactions
    const fetchMessages = async () => {
        const { data } = await supabase
            .from('messages')
            .select('*, reactions:message_reactions(id, reaction_emoji, user_id)')
            .eq('conversation_id', activeConversation.id)
            .order('created_at');
        setMessages(data || []);
        // Mark messages as read after loading
        await markConversationAsRead();
    };
    
    fetchPartnerPremiumStatus();
    fetchMessages();

    // Messages Channel
    const channel = supabase.channel(`convo:${activeConversation.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversation.id}` }, (payload) => {
            setMessages(prev => [...prev, { ...payload.new, reactions: [] }]);
            // If the new message is for me and I'm viewing this convo, mark it as read
            if (payload.new?.recipient_id === currentUser?.id) {
              markConversationAsRead();
            }
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

  // Spam / scam detection. See ROADMAP_NEXT.md and the Session 8 reviewer
  // notes — patterns here MUST avoid false positives on legitimate
  // marriage-conversation topics (military, medical, family).
  const detectSpam = (text) => {
    // Normalize space-separated evasion: "m o n e y" → "money", "t e l e g r a m" → "telegram".
    // Catches the common bypass where each letter of a flagged word is separated by spaces.
    // Requires 3+ consecutive single chars to avoid false positives on initials like "M N S".
    const denormSpaced = (s) => s.replace(/\b(?:[a-zA-Z]\s+){2,}[a-zA-Z]\b/g, (m) => m.replace(/\s+/g, ''));
    const variants = [text, denormSpaced(text)];
    const lowerVariants = variants.map((v) => v.toLowerCase());
    const matchAny = (re) => variants.some((v) => re.test(v));
    const containsAny = (sub) => lowerVariants.some((lv) => lv.includes(sub));
    const lowerText = lowerVariants[0];

    // 1. URLs / link shorteners
    const urlPattern = /(https?:\/\/|www\.|\.com|\.net|\.org|\.io|bit\.ly|tinyurl|t\.co|goo\.gl|tiny\.cc|is\.gd|short\.io)/i;
    if (matchAny(urlPattern)) {
      return { isSpam: true, reason: "Links aren't allowed in messages. Get to know each other on Marryzen first." };
    }

    // 2. Phone numbers
    const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
    if (matchAny(phonePattern)) {
      return { isSpam: true, reason: "Phone numbers can't be shared yet. Keep the conversation on Marryzen until you've built trust." };
    }

    // 3. Email addresses
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    if (matchAny(emailPattern)) {
      return { isSpam: true, reason: "Email addresses can't be shared in chat. Use Marryzen messaging until you've matched in person." };
    }

    // 4. Off-platform messaging handles. ONLY app names that are
    //    extremely unlikely to appear in casual conversation:
    //    whatsapp, wa.me, telegram, t.me, kik, viber, wechat, kakao.
    //    Deliberately NOT listed: "signal", "discord", "snap", "insta",
    //    "ig" — all of these have legitimate non-app meanings.
    const offPlatformHandles = /\b(whats?app|wa\.me|telegram|t\.me|\bkik\b|viber|wechat|kakao(talk)?)\b/i;
    if (matchAny(offPlatformHandles)) {
      return { isSpam: true, reason: "Outside messaging apps can't be shared. Stay on Marryzen to keep our community safe from scams." };
    }

    // 5. Crypto wallet addresses (BTC bech32, BTC legacy, ETH/EVM hex).
    //    BTC legacy regex is intentionally tolerant — false positive on
    //    a license key in chat is extremely rare on this platform.
    const cryptoAddr = /\b(bc1[a-z0-9]{8,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|0x[a-fA-F0-9]{40})\b/;
    if (matchAny(cryptoAddr)) {
      return { isSpam: true, reason: "Crypto wallet addresses aren't allowed in messages." };
    }

    // 6. Off-platform payment requests. Bounded patterns only —
    //    `paypal.me/X`, `$cashtag` (Cash App / Venmo),
    //    payment-app brand names where they're unambiguous (cashapp,
    //    venmo, zelle), and clear money-asking terms.
    //    AVOIDED bare-word "wise" — required wise.com only.
    const paypalLink = /paypal\.me\b/i;
    // Anchor $cashtag to start-of-line or any non-alphanumeric char
    // so we don't trip on mid-token "$" (e.g., "USD$ave") but DO catch
    // adversarial concatenations like "pay me at:$jdoe".
    const cashTag = /(?:^|[^A-Za-z0-9])\$[A-Za-z][A-Za-z0-9_]{2,}\b/;
    const paymentAppBrands = /\b(cash\s*app|cashapp|venmo|zelle\b|wise\.com|revolut\b|western\s*union|moneygram)\b/i;
    const giftCards = /\b(gift\s*card|itunes\s*card|amazon\s*card|google\s*play\s*card|steam\s*card|apple\s*pay\s*me)\b/i;
    if (matchAny(paypalLink) || matchAny(cashTag) || matchAny(paymentAppBrands) || matchAny(giftCards)) {
      return { isSpam: true, reason: "Off-platform payment requests aren't allowed. Real partners don't ask for money." };
    }

    // 7. Direct money-asking phrases — these are blunt enough to block.
    const moneyAsk = /\b(send\s+me\s+money|wire\s+me|i\s+need\s+money|send\s+(funds|cash))\b/i;
    if (matchAny(moneyAsk)) {
      return { isSpam: true, reason: "Asking for money isn't allowed on Marryzen." };
    }

    // 8. SOFT warnings — common scam-phrase topics that ALSO have
    //    legitimate uses. Show a yellow toast but don't block.
    const softScamPhrases = [
      'investment opportunity', 'crypto investment', 'forex', 'binary option',
      'oil rig', 'overseas mission', 'army deployment', 'syria deployment',
      'emergency funds', 'medical emergency', 'stuck abroad', 'stranded',
      'inheritance', 'wealthy uncle', 'dying father',
      'click here', 'buy now', 'free money', 'make money easy', 'work from home',
      'get rich', 'guaranteed return', 'risk free', 'no risk investment',
      'viagra', 'casino', 'lottery', 'sugar daddy', 'sugar baby', 'findom'
    ];
    if (softScamPhrases.some((p) => containsAny(p))) {
      return { isSpam: false, warning: "This phrase is often used in scams. Please be careful — real partners don't pressure you about money." };
    }

    // 9. Excessive capitalization (warning)
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.7 && text.length > 10) {
      return { isSpam: false, warning: "Please avoid using excessive capitalization." };
    }

    // 10. Repeated characters (warning)
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
          toast({ title: "Email Verification Required", description: "Confirm your email to be approved and to send messages.", variant: "destructive" });
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

      const { error } = await supabase/* track */ .from('messages').insert({
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
          // Handle server-side message limit enforcement
          if (error.message && error.message.includes('Daily message limit reached')) {
              toast({ 
                  title: "Daily Limit Reached", 
                  description: "You've reached the daily limit of 10 messages. Upgrade to Premium for unlimited messaging.",
                  variant: "destructive" 
              });
              // Refresh daily count to show accurate number
              const today = new Date();
              today.setHours(0,0,0,0);
              const { count } = await supabase
                 .from('messages')
                 .select('*', { count: 'exact', head: true })
                 .eq('sender_id', currentUser.id)
                 .gte('created_at', today.toISOString());
              setDailyMessageCount(count || 0);
          } else {
              toast({ title: "Failed to send", description: error.message || "An error occurred. Please try again.", variant: "destructive" });
          }
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
      <Helmet><title>Messages ... Marryzen</title></Helmet>
      <div className={`w-full md:w-80 bg-white border-r border-[#E6DCD2] flex flex-col ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
         <div className="p-4 border-b border-[#E6DCD2]">
            <h2 className="font-bold text-xl text-[#1F1F1F]">Messages</h2>
         </div>
         <div className="flex-1 overflow-y-auto">
             {conversations.map(convo => (
                <div key={convo.id} onClick={() => navigate(`/chat/${convo.id}`)} className={`p-4 border-b cursor-pointer hover:bg-[#FAF7F2] flex gap-3 ${activeConversation?.id === convo.id ? 'bg-[#FAF7F2]' : ''}`}>
                    <div className="relative">
                        <img src={convo.partner.photos?.[0] || 'https://via.placeholder.com/50'} className="w-12 h-12 rounded-full object-cover" />
                        {convo.partner.is_premium_active && (
                          <Crown className="absolute -top-1 -right-1 w-4 h-4 text-[#E6B450] fill-[#E6B450] bg-white rounded-full" />
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm">{convo.partner.full_name}</h3>
                            {convo.partner.is_premium_active && (
                              <Crown className="w-3 h-3 text-[#E6B450] fill-[#E6B450]" title="Premium Member" />
                            )}
                        </div>
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
                        {partnerPremiumStatus && (
                          <Crown className="w-4 h-4 text-[#E6B450] fill-[#E6B450]" title="Premium Member" />
                        )}
                    </div>
                    {activeConversation?.partner?.id && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIsBlockModalOpen(true)}
                          className="text-sm font-semibold text-[#706B67] hover:text-red-700 underline-offset-2 hover:underline"
                        >
                          Block
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsReportModalOpen(true)}
                          className="text-sm font-semibold text-red-600 hover:text-red-700 underline-offset-2 hover:underline"
                        >
                          Report
                        </button>
                      </div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.sender_id === currentUser.id ? 'items-end' : 'items-start'}`}>
                            <div className="relative group max-w-[80%]">
                                <div className={`rounded-2xl px-4 py-2 text-sm ${msg.sender_id === currentUser.id ? 'bg-[#E6B450] text-[#1F1F1F]' : 'bg-white border'} relative`}>
                                    {msg.content}
                                    {/* Premium Badge for messages from premium users */}
                                    {msg.sender_id !== currentUser.id && partnerPremiumStatus && (
                                      <Crown className="absolute -top-1 -right-1 w-4 h-4 text-[#E6B450] fill-[#E6B450]" />
                                    )}
                                </div>
                                {/* Read Receipt (Premium only) */}
                                {currentUser?.is_premium && msg.sender_id === currentUser.id && (
                                  <div className="mt-1 text-[10px] text-[#706B67] text-right">
                                    {msg.read_at ? 'Seen' : 'Delivered'}
                                  </div>
                                )}
                                {/* Reaction Picker Trigger */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="absolute -right-8 top-1 opacity-0 group-hover:opacity-100 h-6 w-6 rounded-full bg-white shadow-sm border">
                                            <Smile className="w-3 h-3 text-gray-500" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-2 flex gap-1">
                                        {['...', '...', '...', '...', '...'].map(emoji => (
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
                            {activeConversation.partner.full_name} is typing...
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-4 bg-white border-t border-[#E6DCD2]">
                    {!currentUser?.email_verified ? (
                         <div className="bg-yellow-50 p-3 rounded text-center text-sm text-yellow-800">
                             Confirm your email to be approved and start chatting. <span className="underline font-bold cursor-pointer" onClick={() => navigate('/verify-email')}>Verify Now</span>
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
                                    {dailyMessageCount >= 8 && <span className="text-yellow-600 ml-2">... Limit soon</span>}
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
    {activeConversation?.partner?.id && (
      <>
        <ReportUserModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          reportedUserName={activeConversation.partner.full_name}
          reportedUserId={activeConversation.partner.id}
        />
        <BlockUserModal
          isOpen={isBlockModalOpen}
          onClose={() => setIsBlockModalOpen(false)}
          blockedUserName={activeConversation.partner.full_name}
          blockedUserId={activeConversation.partner.id}
          onBlocked={() => navigate('/matches')}
        />
      </>
    )}
    </div>

  );
};

export default ChatPage;
