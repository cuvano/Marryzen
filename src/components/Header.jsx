import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, User, Settings, Heart, Menu, X, LayoutDashboard, Search, Gift, Bell, MessageSquare, UserPlus, CheckCircle, XCircle, Award, Shield, Lock } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Define fetchNotifications before useEffect
  const fetchNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      setNotifications(data || []);
      const unread = data?.filter(n => !n.read).length || 0;
      setUnreadCount(unread);
  };

  useEffect(() => {
    const initUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser(authUser);
        // Fetch profile for avatar, name, and role
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, photos, role')
          .eq('id', authUser.id)
          .maybeSingle();
        setUserProfile(profile);
        // Check if user is admin
        const userRole = profile?.role?.toLowerCase();
        setIsAdmin(userRole === 'admin' || userRole === 'super_admin');
      }
    };
    initUser();
    fetchNotifications();
    
    // Subscribe to realtime notifications
    const channel = supabase
      .channel('header_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
          fetchNotifications();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const firstName = userProfile?.full_name ? userProfile.full_name.split(' ')[0] : 'User';
  const avatar = userProfile?.photos?.[0] || null;

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_match':
        return <Heart className="w-4 h-4 text-[#C85A72]" />;
      case 'new_message':
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      case 'intro_request':
        return <UserPlus className="w-4 h-4 text-[#E6B450]" />;
      case 'profile_approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'profile_rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'referral_reward':
        return <Award className="w-4 h-4 text-[#E6B450]" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', notification.id);
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    // Route based on notification type
    const metadata = notification.metadata || {};
    
    switch (notification.type) {
      case 'new_match':
        navigate('/matches');
        break;
      case 'new_message':
        if (metadata.conversation_id) {
          navigate(`/chat/${metadata.conversation_id}`);
        } else {
          navigate('/chat');
        }
        break;
      case 'intro_request':
        if (metadata.profile_id) {
          navigate(`/profile/${metadata.profile_id}`);
        } else {
          navigate('/discovery');
        }
        break;
      case 'profile_approved':
      case 'profile_rejected':
        navigate('/profile');
        break;
      case 'referral_reward':
        navigate('/rewards');
        break;
      default:
        navigate('/notifications');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('userProfile');
    navigate('/');
  };

  const NavItem = ({ label, path, icon: Icon, active }) => (
    <button
      onClick={() => { navigate(path); setIsMenuOpen(false); }}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition-colors rounded-lg w-full md:w-auto
        ${active ? 'bg-[#FAF7F2] text-[#C85A72]' : 'text-[#706B67] hover:text-[#1F1F1F] hover:bg-[#FAF7F2]'}
      `}
    >
      {Icon && <Icon size={18} />}
      {label}
    </button>
  );

  return (
    <header className="bg-white border-b border-[#E6DCD2] sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center cursor-pointer" onClick={() => navigate('/dashboard')}>
          <span className="text-2xl font-extrabold text-[#1F1F1F] tracking-tight">
            Marryzen<span className="text-[#C85A72]">.</span>
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {user ? (
            <>
              <NavItem label="Dashboard" path="/dashboard" icon={LayoutDashboard} active={location.pathname === '/dashboard'} />
              <NavItem label="My Matches" path="/matches" icon={Search} active={location.pathname === '/matches'} />
              <NavItem label="Filter Profiles" path="/discovery" icon={Search} active={location.pathname === '/discovery'} />
              <NavItem label="Invite Friends" path="/referrals" icon={Gift} active={location.pathname === '/referrals'} />
              
              {/* Notifications */}
              <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-[#706B67] hover:text-[#1F1F1F]">
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-2 py-1.5">
                    <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate('/notifications');
                        }}
                    >
                        View All
                    </Button>
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p>No new notifications</p>
                        </div>
                    ) : (
                        notifications.map(n => (
                            <DropdownMenuItem 
                                key={n.id} 
                                onClick={() => handleNotificationClick(n)} 
                                className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-[#FAF7F2] ${!n.read ? 'bg-blue-50/50' : ''}`}
                            >
                                <div className="mt-0.5">
                                    {getNotificationIcon(n.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="font-semibold text-sm text-[#1F1F1F]">{n.title}</span>
                                        {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1"></span>}
                                    </div>
                                    <p className="text-xs text-[#706B67] line-clamp-2 mt-1">{n.body}</p>
                                    <span className="text-[10px] text-gray-400 mt-1 block">
                                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                    </span>
                                </div>
                            </DropdownMenuItem>
                        ))
                    )}
                </div>
                {notifications.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                            onClick={() => navigate('/notifications')}
                            className="text-center justify-center text-sm font-medium text-[#C85A72]"
                        >
                            View All Notifications
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
          </DropdownMenu>

              {/* Profile Dropdown */}
              <div className="relative">
                <button 
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="flex items-center gap-2 pl-4 border-l border-[#E6DCD2] hover:opacity-80 transition-opacity"
                >
                    <div className="w-8 h-8 rounded-full bg-[#F3E8D9] overflow-hidden border border-[#E6DCD2]">
                        {avatar ? (
                            <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User className="w-full h-full p-1.5 text-[#C85A72]" />
                        )}
                    </div>
                    <span className="text-sm font-bold text-[#1F1F1F]">{firstName}</span>
                </button>

                {isProfileMenuOpen && (
                    <div className="absolute right-0 mt-3 w-56 bg-white border border-[#E6DCD2] rounded-xl shadow-xl py-2 flex flex-col z-50">
                        <button onClick={() => { navigate('/profile'); setIsProfileMenuOpen(false); }} className="text-left px-4 py-3 text-sm font-medium text-[#333333] hover:bg-[#FAF7F2] flex items-center gap-2">
                            <User size={16} /> My Profile
                        </button>
                        <button onClick={() => { navigate('/notifications'); setIsProfileMenuOpen(false); }} className="text-left px-4 py-3 text-sm font-medium text-[#333333] hover:bg-[#FAF7F2] flex items-center gap-2 relative">
                            <Bell size={16} /> Notifications
                            {unreadCount > 0 && (
                                <span className="ml-auto w-2 h-2 bg-red-500 rounded-full"></span>
                            )}
                        </button>
                        <button onClick={() => { navigate('/rewards'); setIsProfileMenuOpen(false); }} className="text-left px-4 py-3 text-sm font-medium text-[#333333] hover:bg-[#FAF7F2] flex items-center gap-2">
                            <Gift size={16} /> My Rewards
                        </button>
                        <button onClick={() => { navigate('/premium'); setIsProfileMenuOpen(false); }} className="text-left px-4 py-3 text-sm font-medium text-[#333333] hover:bg-[#FAF7F2] flex items-center gap-2">
                            <Settings size={16} /> Account Settings
                        </button>
                        <button onClick={() => { navigate('/account-settings'); setIsProfileMenuOpen(false); }} className="text-left px-4 py-3 text-sm font-medium text-[#333333] hover:bg-[#FAF7F2] flex items-center gap-2">
                             <Lock size={16} /> Change Password
                        </button>
                        {isAdmin && (
                          <>
                            <div className="h-px bg-[#E6DCD2] my-1"></div>
                            <button onClick={() => { navigate('/admin'); setIsProfileMenuOpen(false); }} className="text-left px-4 py-3 text-sm font-medium text-purple-600 hover:bg-purple-50 flex items-center gap-2">
                                <Shield size={16} /> Admin Panel
                            </button>
                          </>
                        )}
                        <div className="h-px bg-[#E6DCD2] my-1"></div>
                        <button onClick={handleLogout} className="text-left px-4 py-3 text-sm font-bold text-[#C85A72] hover:bg-[#F9E7EB] flex items-center gap-2">
                            <LogOut size={16} /> Sign Out
                        </button>
                    </div>
                )}
                
                {/* Backdrop for dropdown */}
                {isProfileMenuOpen && (
                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)}></div>
                )}
              </div>
            </>
          ) : (
            <>
              <Button 
                variant="ghost" 
                onClick={() => navigate('/login')}
                className="text-[#706B67] hover:text-[#1F1F1F]"
              >
                Log In
              </Button>
              <Button 
                onClick={() => navigate('/onboarding')}
                className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D]"
              >
                Sign Up
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button className="md:hidden text-[#1F1F1F]" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-b border-[#E6DCD2] p-4 flex flex-col gap-2 absolute w-full shadow-lg">
          {user ? (
            <>
              <NavItem label="Dashboard" path="/dashboard" icon={LayoutDashboard} active={location.pathname === '/dashboard'} />
              <NavItem label="My Matches" path="/matches" icon={Search} active={location.pathname === '/matches'} />
              <NavItem label="Discovery" path="/discovery" icon={Search} active={location.pathname === '/discovery'} />
              <NavItem label="Invite Friends" path="/referrals" icon={Gift} active={location.pathname === '/referrals'} />
              <NavItem 
                label={`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}`} 
                path="/notifications" 
                icon={Bell} 
                active={location.pathname === '/notifications'} 
              />
              <NavItem label="My Rewards" path="/rewards" icon={Gift} active={location.pathname === '/rewards'} />
              <NavItem label="My Profile" path="/profile" icon={User} active={location.pathname === '/profile'} />
              <div className="h-px bg-[#E6DCD2] my-2"></div>
              <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-[#C85A72] bg-[#F9E7EB] rounded-lg">
                <LogOut size={18} /> Sign Out
              </button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={() => { navigate('/login'); setIsMenuOpen(false); }}
                className="w-full border-[#E6DCD2] text-[#1F1F1F] hover:bg-[#FAF7F2]"
              >
                Log In
              </Button>
              <Button 
                onClick={() => { navigate('/onboarding'); setIsMenuOpen(false); }}
                className="w-full bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D]"
              >
                Sign Up
              </Button>
            </>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;