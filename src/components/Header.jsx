import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, User, Settings, Heart, Menu, X, LayoutDashboard, Search, Gift, Bell } from 'lucide-react';
import { currentUserProfile } from '@/lib/matchmaking';
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

  // Retrieve user profile or fall back to mock
  const localProfile = JSON.parse(localStorage.getItem('userProfile'));
  const user = localProfile || currentUserProfile;
  const firstName = user.name ? user.name.split(' ')[0] : 'User';
  const avatar = user.photos && user.photos.length > 0 ? user.photos[0] : null;

  useEffect(() => {
    fetchNotifications();
    
    // Subscribe to realtime notifications
    const channel = supabase
      .channel('header_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
          // In a real app, filter by user_id here or rely on RLS if possible (RLS doesn't filter realtime always correctly without row level security enabled properly on publication)
          // For now assuming we refetch or push
          fetchNotifications();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

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

  const markAsRead = async (id) => {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
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
          <NavItem label="Dashboard" path="/dashboard" icon={LayoutDashboard} active={location.pathname === '/dashboard'} />
          <NavItem label="My Matches" path="/discovery" icon={Search} active={location.pathname === '/discovery'} />
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
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">No new notifications</div>
                    ) : (
                        notifications.map(n => (
                            <DropdownMenuItem key={n.id} onClick={() => markAsRead(n.id)} className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${!n.read ? 'bg-blue-50' : ''}`}>
                                <div className="flex justify-between w-full">
                                    <span className="font-semibold text-sm">{n.title}</span>
                                    {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                                </div>
                                <p className="text-xs text-gray-600 line-clamp-2">{n.body}</p>
                                <span className="text-[10px] text-gray-400">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                            </DropdownMenuItem>
                        ))
                    )}
                </div>
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
                    <button onClick={() => { navigate('/rewards'); setIsProfileMenuOpen(false); }} className="text-left px-4 py-3 text-sm font-medium text-[#333333] hover:bg-[#FAF7F2] flex items-center gap-2">
                        <Gift size={16} /> My Rewards
                    </button>
                    <button onClick={() => { navigate('/premium'); setIsProfileMenuOpen(false); }} className="text-left px-4 py-3 text-sm font-medium text-[#333333] hover:bg-[#FAF7F2] flex items-center gap-2">
                         <Settings size={16} /> Account Settings
                    </button>
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
        </div>

        {/* Mobile Menu Toggle */}
        <button className="md:hidden text-[#1F1F1F]" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-b border-[#E6DCD2] p-4 flex flex-col gap-2 absolute w-full shadow-lg">
           <NavItem label="Dashboard" path="/dashboard" icon={LayoutDashboard} active={location.pathname === '/dashboard'} />
           <NavItem label="My Matches" path="/discovery" icon={Search} active={location.pathname === '/discovery'} />
           <NavItem label="Invite Friends" path="/referrals" icon={Gift} active={location.pathname === '/referrals'} />
           <NavItem label="My Rewards" path="/rewards" icon={Gift} active={location.pathname === '/rewards'} />
           <NavItem label="My Profile" path="/profile" icon={User} active={location.pathname === '/profile'} />
           <div className="h-px bg-[#E6DCD2] my-2"></div>
           <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-[#C85A72] bg-[#F9E7EB] rounded-lg">
                <LogOut size={18} /> Sign Out
           </button>
        </div>
      )}
    </header>
  );
};

export default Header;