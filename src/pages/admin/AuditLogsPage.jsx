import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download, Search } from 'lucide-react';
import { format } from 'date-fns';

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    // In a real app, join with profiles to get admin name
    const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
    
    if (!error) setLogs(data || []);
    setLoading(false);
  };

  const handleExport = () => {
      const csvContent = "data:text/csv;charset=utf-8," 
        + "ID,Action,Admin,Target,Details,Date\n"
        + logs.map(row => `${row.id},${row.action},${row.admin_id},${row.target_user_id},"${JSON.stringify(row.details).replace(/"/g, '""')}",${row.created_at}`).join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "audit_logs.csv");
      document.body.appendChild(link);
      link.click();
  };

  const filteredLogs = logs.filter(log => 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (log.details && JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">Audit Logs</h2>
        <Button variant="outline" onClick={handleExport} className="border-slate-700 text-slate-200">
            <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
             <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
             <Input 
                placeholder="Search actions..." 
                className="pl-10 bg-slate-900 border-slate-700 text-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
             />
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-950 border-b border-slate-800">
                        <tr>
                            <th className="px-6 py-4">Timestamp</th>
                            <th className="px-6 py-4">Action</th>
                            <th className="px-6 py-4">Admin ID</th>
                            <th className="px-6 py-4">Target ID</th>
                            <th className="px-6 py-4">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" className="px-6 py-8 text-center">Loading...</td></tr>
                        ) : filteredLogs.length === 0 ? (
                            <tr><td colSpan="5" className="px-6 py-8 text-center">No logs found.</td></tr>
                        ) : (
                            filteredLogs.map(log => (
                                <tr key={log.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                    <td className="px-6 py-4 font-mono text-xs">{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}</td>
                                    <td className="px-6 py-4 font-bold text-white">{log.action}</td>
                                    <td className="px-6 py-4 font-mono text-xs">{log.admin_id?.slice(0,8)}...</td>
                                    <td className="px-6 py-4 font-mono text-xs">{log.target_user_id?.slice(0,8)}...</td>
                                    <td className="px-6 py-4 max-w-xs truncate text-xs text-slate-500">{JSON.stringify(log.details)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
             </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogsPage;