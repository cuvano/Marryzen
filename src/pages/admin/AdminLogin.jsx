import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Lock, Shield, Eye } from 'lucide-react';
import { adminRoles } from '@/lib/admin-store';

const AdminLogin = () => {
  const navigate = useNavigate();

  const handleLogin = (roleKey) => {
    localStorage.setItem('adminRole', roleKey);
    navigate('/admin/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Decorative bg */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-950 to-slate-950"></div>
      
      <Card className="w-full max-w-md bg-slate-900/90 border-slate-800 backdrop-blur relative z-10">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto bg-slate-800 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-inner shadow-black/50">
            <Lock className="w-8 h-8 text-purple-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">Admin Access</CardTitle>
          <CardDescription className="text-slate-400">Select a role to simulate login for the Control Panel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            className="w-full h-auto py-4 justify-start px-4 bg-red-950/30 hover:bg-red-900/40 border border-red-900/50 text-red-200 hover:text-white group"
            onClick={() => handleLogin('SUPER_ADMIN')}
          >
            <div className="bg-red-500/20 p-2 rounded mr-4 group-hover:bg-red-500/30 transition-colors">
                <Lock className="w-5 h-5 text-red-500" />
            </div>
            <div className="text-left">
                <div className="font-bold">{adminRoles.SUPER_ADMIN.label}</div>
                <div className="text-xs opacity-70 font-normal">Full System Control & Payments</div>
            </div>
          </Button>

          <Button 
            className="w-full h-auto py-4 justify-start px-4 bg-orange-950/30 hover:bg-orange-900/40 border border-orange-900/50 text-orange-200 hover:text-white group"
            onClick={() => handleLogin('MODERATOR')}
          >
             <div className="bg-orange-500/20 p-2 rounded mr-4 group-hover:bg-orange-500/30 transition-colors">
                <Shield className="w-5 h-5 text-orange-500" />
            </div>
            <div className="text-left">
                <div className="font-bold">{adminRoles.MODERATOR.label}</div>
                <div className="text-xs opacity-70 font-normal">Safety, Reports & Messaging</div>
            </div>
          </Button>

          <Button 
            className="w-full h-auto py-4 justify-start px-4 bg-yellow-950/30 hover:bg-yellow-900/40 border border-yellow-900/50 text-yellow-200 hover:text-white group"
            onClick={() => handleLogin('VERIFICATION')}
          >
             <div className="bg-yellow-500/20 p-2 rounded mr-4 group-hover:bg-yellow-500/30 transition-colors">
                <Eye className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="text-left">
                <div className="font-bold">{adminRoles.VERIFICATION.label}</div>
                <div className="text-xs opacity-70 font-normal">ID & Selfie Verification Queue</div>
            </div>
          </Button>
          
          <div className="pt-4 text-center">
            <Button variant="link" className="text-slate-500 text-xs" onClick={() => navigate('/')}>Return to Main Site</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;