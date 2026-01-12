import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Users, ShieldAlert, Sliders, Settings, LogOut, Lock } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminProfile, setAdminProfile] = useState(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, full_name, email')
        .eq('id', session.user.id)
        .maybeSingle();

      // Debug logging (remove in production)
      console.log('Admin check - Profile:', profile);
      console.log('Admin check - Role:', profile?.role);
      console.log('Admin check - Error:', error);

      if (error) {
        console.error('Profile fetch error:', error);
        toast({ 
          title: "Error", 
          description: `Could not load profile: ${error.message}`,
          variant: "destructive"
        });
        navigate('/dashboard');
        return;
      }

      if (!profile) {
        toast({ 
          title: "Access Denied", 
          description: "Profile not found.",
          variant: "destructive"
        });
        navigate('/dashboard');
        return;
      }

      // Check if role is admin or super_admin (case-insensitive)
      const userRole = profile.role?.toLowerCase();
      if (!userRole || !['admin', 'super_admin'].includes(userRole)) {
        toast({ 
          title: "Access Denied", 
          description: `You do not have permission to access the admin panel. Current role: ${profile.role || 'none'}. Required: admin or super_admin`,
          variant: "destructive"
        });
        navigate('/dashboard');
        return;
      }

      setAdminProfile(profile);
      setIsAdmin(true);
      setLoading(false);
    };

    checkAdminStatus();
  }, [navigate, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Verifying privileges...</div>;
  if (!isAdmin) return null;

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/reports', label: 'Reports/Safety', icon: ShieldAlert },
    { path: '/admin/matching', label: 'Matching Settings', icon: Sliders },
    { path: '/admin/settings', label: 'Platform Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col fixed h-full">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2 text-white">
            <Lock className="w-5 h-5 text-purple-500" />
            Marryzen Admin
          </h2>
          <div className="mt-2 text-xs text-slate-400 flex flex-col">
            <span className="font-semibold text-slate-300">{adminProfile.full_name}</span>
            <span className="capitalize text-purple-400">{adminProfile.role.replace('_', ' ')}</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}
              `}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-950/30"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" /> Log out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 ml-64 bg-slate-950">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center justify-between px-8 sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-white capitalize">
            {navItems.find(i => i.path === location.pathname)?.label || 'Admin Panel'}
          </h1>
          <div className="text-sm text-slate-400">
             System Status: <span className="text-green-400 font-medium">● Operational</span>
          </div>
        </header>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;