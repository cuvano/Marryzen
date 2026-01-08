import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Activity, ShieldAlert, UserPlus, AlertCircle, CheckCircle2, Ban } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
  <Card className="bg-slate-900 border-slate-800 text-slate-50">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
      <Icon className={`h-4 w-4 ${color}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
    </CardContent>
  </Card>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    active30d: 0,
    new24h: 0,
    new7d: 0,
    pending: 0,
    approved: 0,
    suspended: 0,
    banned: 0,
    openReports: 0
  });
  const [recentSignups, setRecentSignups] = useState([]);
  const [recentReports, setRecentReports] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      // 1. Total Users
      const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      
      // 2. Active 30 Days (assuming updated_at implies activity or last login)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: active30d } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('updated_at', thirtyDaysAgo.toISOString());

      // 3. New Signups (24h & 7d)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const { count: new24h } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('created_at', oneDayAgo.toISOString());
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: new7d } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('created_at', sevenDaysAgo.toISOString());

      // 4. Status Counts
      const { count: pending } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending_review');
      const { count: approved } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved');
      const { count: suspended } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'suspended');
      const { count: banned } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'banned');

      // 5. Open Reports
      const { count: openReports } = await supabase.from('user_reports').select('*', { count: 'exact', head: true }).eq('status', 'open');

      setStats({ totalUsers, active30d, new24h, new7d, pending, approved, suspended, banned, openReports });

      // 6. Recent Signups List
      const { data: signups } = await supabase.from('profiles').select('id, full_name, email, created_at, status').order('created_at', { ascending: false }).limit(5);
      setRecentSignups(signups || []);

      // 7. Recent Reports
      const { data: reports } = await supabase.from('user_reports').select('id, reason_category, created_at, reporter:reporter_id(full_name), reported:reported_user_id(full_name)').eq('status', 'open').order('created_at', { ascending: false }).limit(5);
      setRecentReports(reports || []);
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} color="text-blue-500" subtext={`${stats.active30d} active in last 30d`} />
        <StatCard title="New Signups (24h)" value={stats.new24h} icon={UserPlus} color="text-green-500" subtext={`${stats.new7d} in last 7 days`} />
        <StatCard title="Pending Review" value={stats.pending} icon={AlertCircle} color="text-yellow-500" subtext="Requires approval" />
        <StatCard title="Open Reports" value={stats.openReports} icon={ShieldAlert} color="text-red-500" subtext="Safety attention needed" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Signups */}
        <Card className="bg-slate-900 border-slate-800 text-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Recent Signups</CardTitle>
            <Button variant="link" onClick={() => navigate('/admin/users')} className="text-purple-400 text-sm">View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSignups.map(user => (
                <div key={user.id} className="flex items-center justify-between border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium text-white">{user.full_name || 'No Name'}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      user.status === 'approved' ? 'bg-green-900 text-green-300' :
                      user.status === 'pending_review' ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'
                    }`}>
                      {user.status}
                    </span>
                    <span className="text-xs text-slate-500 mt-1">{new Date(user.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card className="bg-slate-900 border-slate-800 text-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Open Reports</CardTitle>
            <Button variant="link" onClick={() => navigate('/admin/reports')} className="text-purple-400 text-sm">View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentReports.length > 0 ? recentReports.map(report => (
                <div key={report.id} className="flex items-center justify-between border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium text-red-400">{report.reason_category.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-slate-500">
                      Reported: {report.reported?.full_name || 'Unknown'} <br/>
                      By: {report.reporter?.full_name || 'Unknown'}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="border-slate-700 h-7 text-xs" onClick={() => navigate('/admin/reports')}>Review</Button>
                </div>
              )) : (
                <div className="text-center py-8 text-slate-500">No open reports.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Status Breakdown */}
      <div className="grid gap-4 md:grid-cols-4">
         <Card className="bg-slate-950 border border-slate-800 text-center p-4">
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Pending</div>
         </Card>
         <Card className="bg-slate-950 border border-slate-800 text-center p-4">
            <div className="text-2xl font-bold text-green-500">{stats.approved}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Approved</div>
         </Card>
         <Card className="bg-slate-950 border border-slate-800 text-center p-4">
            <div className="text-2xl font-bold text-orange-500">{stats.suspended}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Suspended</div>
         </Card>
         <Card className="bg-slate-950 border border-slate-800 text-center p-4">
            <div className="text-2xl font-bold text-red-500">{stats.banned}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Banned</div>
         </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;