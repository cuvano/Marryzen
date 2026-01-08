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
    let query = supabase
        .from('user_reports')
        .select(`
            *,
            reporter:reporter_id(full_name, email),
            reported:reported_user_id(full_name, email, status, id)
        `)
        .order('created_at', { ascending: false });

    if (filter !== 'all') {
        query = query.eq('status', filter);
    }

    const { data, error } = await query;
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setReports(data || []);
    setLoading(false);
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
        {loading ? <div className="text-slate-500">Loading reports...</div> : 
         reports.length === 0 ? <div className="text-slate-500 py-10 text-center border border-dashed border-slate-800 rounded">No reports found in this filter.</div> :
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
                         "{report.reason_text}"
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
        }
      </div>
    </div>
  );
};

export default SafetyPanel;