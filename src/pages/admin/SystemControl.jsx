import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminStore, logAdminAction } from '@/lib/admin-store';
import { useToast } from '@/components/ui/use-toast';
import { Save, DollarSign, Shield, FileText, List, Download } from 'lucide-react';

const SystemControl = () => {
  const { toast } = useToast();
  const [rules, setRules] = useState(adminStore.systemRules);
  const [logs] = useState(adminStore.logs);

  const handleSaveRules = () => {
      logAdminAction('SuperAdmin', 'UPDATE_RULES', 'System', 'Modified matching weights/limits');
      toast({ title: "System Rules Updated", description: "Changes have been applied and logged." });
  };

  const downloadLogs = () => {
      toast({ title: "Exporting Logs...", description: "Audit log CSV download started." });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white">System Control</h2>

      <Tabs defaultValue="rules">
        <TabsList className="bg-slate-900 border border-slate-800 w-full justify-start rounded-lg p-1">
            <TabsTrigger value="rules" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400">System Rules</TabsTrigger>
            <TabsTrigger value="finance" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400">Finance & Payments</TabsTrigger>
            <TabsTrigger value="content" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400">Content Settings</TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400">Audit Logs</TabsTrigger>
        </TabsList>

        {/* System Rules */}
        <TabsContent value="rules" className="mt-6 space-y-6">
            <Card className="bg-slate-900 border-slate-800 text-slate-200">
                <CardHeader>
                    <CardTitle>Matching Algorithm Weights</CardTitle>
                    <CardDescription>Adjust how compatibility is calculated.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <Label>Values & Principles ({rules.matchingWeights.values}%)</Label>
                        </div>
                        <Slider defaultValue={[rules.matchingWeights.values]} max={100} step={1} className="py-2" onValueChange={(v) => setRules({...rules, matchingWeights: {...rules.matchingWeights, values: v[0]}})} />
                    </div>
                     <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <Label>Cultural Background ({rules.matchingWeights.culture}%)</Label>
                        </div>
                        <Slider defaultValue={[rules.matchingWeights.culture]} max={100} step={1} className="py-2" />
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <Label>Marriage Intent ({rules.matchingWeights.intent}%)</Label>
                        </div>
                        <Slider defaultValue={[rules.matchingWeights.intent]} max={100} step={1} className="py-2" />
                    </div>
                    <Button onClick={handleSaveRules} className="bg-purple-600 hover:bg-purple-700"><Save className="w-4 h-4 mr-2"/> Save Algorithm Changes</Button>
                </CardContent>
            </Card>
             <Card className="bg-slate-900 border-slate-800 text-slate-200">
                <CardHeader><CardTitle>Safety Thresholds</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>Report Auto-Ban Limit</Label>
                        <Input type="number" defaultValue={rules.reportAutoBanLimit} className="bg-slate-950 border-slate-700 text-white" />
                    </div>
                    <div className="space-y-2">
                         <Label>Free User Intro Limit (Weekly)</Label>
                         <Input type="number" defaultValue={rules.freeIntroLimit} className="bg-slate-950 border-slate-700 text-white" />
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        {/* Finance */}
        <TabsContent value="finance" className="mt-6">
             <Card className="bg-slate-900 border-slate-800 text-slate-200">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Recent Transactions</CardTitle>
                        <CardDescription>Live feed of payments and refunds.</CardDescription>
                    </div>
                    <Button variant="outline" className="border-slate-700"><DollarSign className="w-4 h-4 mr-2"/> Export Report</Button>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {adminStore.payments.map(p => (
                            <div key={p.id} className="flex justify-between items-center p-3 bg-slate-950 rounded border border-slate-800">
                                <div>
                                    <div className="font-bold text-white">{p.user} - {p.plan}</div>
                                    <div className="text-xs text-slate-500">{p.id} • {p.date}</div>
                                </div>
                                <div className={`font-mono ${p.status === 'Active' ? 'text-green-400' : 'text-red-400'}`}>
                                    {p.status === 'Active' ? '+' : ''}${p.amount}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        {/* Content */}
         <TabsContent value="content" className="mt-6">
             <Card className="bg-slate-900 border-slate-800 text-slate-200">
                <CardHeader><CardTitle>Platform Content</CardTitle></CardHeader>
                <CardContent className="grid gap-4">
                    <Button variant="outline" className="justify-start border-slate-700 text-slate-300"><FileText className="w-4 h-4 mr-2"/> Edit Terms of Service</Button>
                    <Button variant="outline" className="justify-start border-slate-700 text-slate-300"><Shield className="w-4 h-4 mr-2"/> Edit Privacy Policy</Button>
                    <Button variant="outline" className="justify-start border-slate-700 text-slate-300"><List className="w-4 h-4 mr-2"/> Edit Onboarding Questions</Button>
                </CardContent>
            </Card>
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs" className="mt-6">
             <Card className="bg-slate-900 border-slate-800 text-slate-200">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Admin Activity Log</CardTitle>
                    <Button variant="outline" size="sm" onClick={downloadLogs} className="border-slate-700"><Download className="w-4 h-4 mr-2"/> CSV Export</Button>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto max-h-[500px]">
                         <table className="w-full caption-bottom text-sm text-left text-slate-300">
                            <thead>
                                <tr className="border-b border-slate-800">
                                    <th className="p-2 text-slate-500">Time</th>
                                    <th className="p-2 text-slate-500">Admin</th>
                                    <th className="p-2 text-slate-500">Action</th>
                                    <th className="p-2 text-slate-500">Target</th>
                                    <th className="p-2 text-slate-500">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                                        <td className="p-2 text-xs font-mono text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="p-2 font-medium text-purple-400">{log.admin}</td>
                                        <td className="p-2">{log.action}</td>
                                        <td className="p-2 text-slate-400">{log.target}</td>
                                        <td className="p-2 text-slate-500 truncate max-w-[200px]">{log.details}</td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default SystemControl;