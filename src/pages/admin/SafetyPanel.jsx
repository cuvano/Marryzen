import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { ShieldAlert, CheckCircle, Ban, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const SafetyPanel = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [selectedReport, setSelectedReport] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      // First check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Check admin role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      console.log('Admin profile check:', { userId: user.id, role: profile?.role });

      if (!profile || !['admin', 'super_admin'].includes(profile.role?.toLowerCase())) {
        toast({ 
          title: "Access Denied", 
          description: `Admin role required. Current role: ${profile?.role || 'none'}`, 
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      // First try a simple query to see if we can access reports at all
      console.log('Fetching reports with filter:', filter);
      let query = supabase
          .from('user_reports')
          .select('*')
          .order('created_at', { ascending: false });

      if (filter !== 'all') {
          query = query.eq('status', filter);
          console.log('Applied status filter:', filter);
      }

      console.log('Executing query...');
      const { data, error } = await query;
      console.log('Query completed. Data length:', data?.length, 'Error:', error);
      
      // If we get an RLS error, try to diagnose it
      if (error && (error.code === '42501' || error.message?.includes('row-level security'))) {
        console.error('RLS Policy Error detected!');
        console.error('This means the RLS policy is blocking the query.');
        console.error('Your user ID:', user.id);
        console.error('Your role:', profile?.role);
        console.error('Expected: admin or super_admin');
        
        // Try to verify the role check works
        const { data: roleCheck } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', user.id)
          .eq('role', profile?.role)
          .single();
        console.log('Role verification query result:', roleCheck);
      }
      
      if (error) {
        console.error('Error fetching reports:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        console.error('Error code:', error.code);
        console.error('Error hint:', error.hint);
        toast({ 
          title: "Error", 
          description: error.message || "Failed to load reports. Check console for details.", 
          variant: "destructive" 
        });
        setReports([]);
      } else {
        console.log('Reports fetched:', data?.length || 0, 'reports');
        console.log('Reports data:', data);
        
        // If we got reports, now fetch the related profile data
        if (data && data.length > 0) {
          // Fetch reporter and reported user profiles separately
          const reporterIds = [...new Set(data.map(r => r.reporter_id))];
          const reportedIds = [...new Set(data.map(r => r.reported_user_id))];
          
          const { data: reporters } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', reporterIds);
          
          const { data: reportedUsers } = await supabase
            .from('profiles')
            .select('id, full_name, email, status')
            .in('id', reportedIds);
          
          // Map profiles to reports
          const reportsWithProfiles = data.map(report => ({
            ...report,
            reporter: reporters?.find(p => p.id === report.reporter_id),
            reported: reportedUsers?.find(p => p.id === report.reported_user_id)
          }));
          
          setReports(reportsWithProfiles);
        } else {
          setReports([]);
          console.log('No reports found with filter:', filter);
        }
      }
    } catch (err) {
      console.error('Exception fetching reports:', err);
      toast({ 
        title: "Error", 
        description: err.message || "An unexpected error occurred", 
        variant: "destructive" 
      });
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filter]);

  const resolveReport = async (status, banUser = false) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Update report status
      const { error: reportError } = await supabase.from('user_reports').update({
          status,
          admin_resolved_by: session.user.id,
          admin_resolution_notes: resolutionNotes
      }).eq('id', selectedReport.id);

      if (reportError) {
          toast({ title: "Error updating report", variant: "destructive" });
          return;
      }

      // Optional: Ban user
      if (banUser && selectedReport.reported?.id) {
          await supabase.from('profiles').update({ status: 'banned' }).eq('id', selectedReport.reported.id);
          toast({ title: "User Banned", description: "Report resolved and user banned.", variant: "destructive" });
      } else {
          toast({ title: "Report Resolved", description: `Marked as ${status}` });
      }

      setSelectedReport(null);
      fetchReports();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">Reports & Safety Queue</h2>
        <select 
            className="h-10 rounded-md border border-slate-700 bg-slate-900 text-white px-3 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
        >
            <option value="open">Open Reports</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All History</option>
        </select>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="text-slate-500 py-10 text-center">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="text-slate-500 py-10 text-center border border-dashed border-slate-800 rounded">
            <p className="mb-2">No reports found with filter: <strong>{filter}</strong></p>
            <p className="text-xs text-slate-600">Try selecting "All History" to see all reports, or check the browser console for errors.</p>
          </div>
        ) : (
          reports.map(report => (
             <Card key={report.id} className="bg-slate-900 border-slate-800 text-slate-200">
                 <CardHeader className="pb-2 flex flex-row items-start justify-between">
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                             <Badge variant="destructive" className="uppercase tracking-wider">{report.reason_category?.replace(/_/g, ' ')}</Badge>
                             <span className="text-xs text-slate-500">{new Date(report.created_at).toLocaleString()}</span>
                        </div>
                        <CardTitle className="text-lg">
                            <span className="text-red-400">{report.reporter?.full_name}</span> reported <span className="text-red-400">{report.reported?.full_name}</span>
                        </CardTitle>
                     </div>
                     <Badge variant="outline" className={`${report.status === 'open' ? 'text-green-400 border-green-800' : 'text-slate-500'}`}>{report.status}</Badge>
                 </CardHeader>
                 <CardContent>
                     <div className="bg-slate-950 p-4 rounded border border-slate-800 mb-4 italic text-slate-300">
                         "{report.reason_details || report.reason_category}"
                     </div>
                     
                     <div className="flex justify-end gap-2">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button size="sm" onClick={() => { setSelectedReport(report); setResolutionNotes(''); }}>
                                    Resolve / Action
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
                                <DialogHeader><DialogTitle>Take Action</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div>
                                        <Label>Admin Resolution Notes</Label>
                                        <textarea 
                                            className="w-full h-24 bg-slate-950 border border-slate-700 rounded p-2 text-sm mt-1"
                                            placeholder="Details about action taken..."
                                            value={resolutionNotes}
                                            onChange={e => setResolutionNotes(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Button className="bg-green-600 hover:bg-green-700" onClick={() => resolveReport('resolved')}>
                                            <CheckCircle className="w-4 h-4 mr-2"/> Mark Resolved (No Action)
                                        </Button>
                                        <Button variant="secondary" onClick={() => resolveReport('dismissed')}>
                                            <XCircle className="w-4 h-4 mr-2"/> Dismiss as Invalid
                                        </Button>
                                        <Button variant="destructive" onClick={() => resolveReport('resolved', true)}>
                                            <Ban className="w-4 h-4 mr-2"/> Resolve & Ban Reported User
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                     </div>
                 </CardContent>
             </Card>
         ))
        )}
      </div>
    </div>
  );
};

export default SafetyPanel;