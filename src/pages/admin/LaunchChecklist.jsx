import React, { useState, useEffect } from 'react';
import { adminStore, logAdminAction } from '@/lib/admin-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/components/ui/use-toast';
import { Rocket, AlertTriangle, CheckCircle2, Lock, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LaunchChecklist = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [checklist, setChecklist] = useState(adminStore.checklist);
  const [status, setStatus] = useState(adminStore.platformStatus);

  // Security Check: Ensure only Super Admin can view
  useEffect(() => {
     const role = localStorage.getItem('adminRole');
     if (role !== 'SUPER_ADMIN') {
         toast({ title: "Access Denied", description: "Only Super Admins can access the Launch Checklist.", variant: "destructive" });
         navigate('/admin/dashboard');
     }
  }, [navigate, toast]);

  const calculateProgress = (sectionKey) => {
      const section = checklist[sectionKey];
      const total = section.items.length;
      const checked = section.items.filter(i => i.checked).length;
      return { checked, total, percent: Math.round((checked / total) * 100) };
  };

  const handleCheck = (sectionKey, itemId) => {
      const newChecklist = { ...checklist };
      const item = newChecklist[sectionKey].items.find(i => i.id === itemId);
      item.checked = !item.checked;
      setChecklist(newChecklist);
      // In a real app, we would save this to DB here
  };

  const isReadyToLaunch = () => {
      // Check all sections except 'go_live' (which is the switch itself)
      const sections = Object.keys(checklist).filter(k => k !== 'go_live');
      for (const key of sections) {
          if (checklist[key].items.some(i => !i.checked)) return false;
      }
      return true;
  };

  const handleGoLive = () => {
      setStatus('live');
      adminStore.platformStatus = 'live'; // Persist to store
      logAdminAction('SuperAdmin', 'GO_LIVE', 'Platform', 'Marryzen is now LIVE to the public.');
      toast({
          title: "🚀 Platform Launched!",
          description: "Marryzen is now live. Congratulations!",
          variant: "success",
          duration: 8000,
      });
  };

  const overallProgress = () => {
      const allItems = Object.values(checklist).flatMap(s => s.items).filter(i => i.id !== 'all_complete' && i.id !== 'confirm');
      const checked = allItems.filter(i => i.checked).length;
      const total = allItems.length;
      return Math.round((checked / total) * 100);
  }

  return (
    <div className="space-y-8 pb-24">
      <div className="flex justify-between items-start">
        <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <Rocket className={`w-8 h-8 ${status === 'live' ? 'text-green-500' : 'text-purple-500'}`} />
                Pre-Launch & Go-Live Checklist
            </h2>
            <p className="text-slate-400 mt-2">
                Complete all critical systems checks before enabling public access. 
                Current Status: <Badge variant={status === 'live' ? 'success' : 'secondary'} className="ml-2 uppercase">{status}</Badge>
            </p>
        </div>
        <div className="text-right">
            <div className="text-2xl font-mono font-bold text-white">{overallProgress()}%</div>
            <div className="text-xs text-slate-500">Readiness</div>
        </div>
      </div>

      <Accordion type="multiple" className="w-full space-y-4" defaultValue={Object.keys(checklist)}>
        {Object.entries(checklist).map(([key, section]) => {
            if (key === 'go_live') return null; // Handle separately
            const progress = calculateProgress(key);
            const isComplete = progress.checked === progress.total;

            return (
                <AccordionItem key={key} value={key} className="border border-slate-800 rounded-lg bg-slate-900 px-4">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-4 w-full pr-4">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${isComplete ? 'bg-green-500/20 border-green-500 text-green-500' : 'border-slate-600 text-slate-600'}`}>
                                {isComplete ? <Check className="w-4 h-4" /> : <span className="text-xs">{progress.checked}/{progress.total}</span>}
                            </div>
                            <span className={`text-lg font-medium ${isComplete ? 'text-green-400' : 'text-slate-200'}`}>{section.title}</span>
                            {key === 'legal' && <Badge variant="destructive" className="ml-auto mr-4">CRITICAL</Badge>}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-6 space-y-3 pl-10">
                         {section.items.map(item => (
                             <div key={item.id} className="flex items-start space-x-3">
                                <Checkbox 
                                    id={item.id} 
                                    checked={item.checked}
                                    onCheckedChange={() => handleCheck(key, item.id)}
                                    className="border-slate-600 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600 mt-1"
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <label
                                        htmlFor={item.id}
                                        className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${item.checked ? 'text-slate-400 line-through' : 'text-slate-200'}`}
                                    >
                                        {item.label}
                                    </label>
                                </div>
                             </div>
                         ))}
                    </AccordionContent>
                </AccordionItem>
            )
        })}
      </Accordion>

      <Card className="border-red-900/50 bg-red-950/10 mt-12">
        <CardHeader>
            <CardTitle className="text-red-500 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6" />
                Zone 11: GO-LIVE MASTER SWITCH
            </CardTitle>
            <CardDescription className="text-red-200/60">
                Platform cannot be publicly accessible until checklist is 100% completed.
            </CardDescription>
        </CardHeader>
        <CardContent>
             <div className="flex items-center justify-between p-6 bg-slate-950 rounded-lg border border-slate-800">
                <div className="space-y-1">
                    <h4 className="text-white font-bold text-lg">Public Launch</h4>
                    <p className="text-sm text-slate-500">Enable worldwide access to Marryzen.</p>
                </div>
                
                {status === 'live' ? (
                     <Button disabled className="bg-green-600 text-white opacity-100">
                        <CheckCircle2 className="w-4 h-4 mr-2" /> LIVE ACTIVE
                     </Button>
                ) : (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button 
                                size="lg" 
                                variant="destructive" 
                                disabled={!isReadyToLaunch()} 
                                className="font-bold tracking-wider"
                            >
                                {isReadyToLaunch() ? 'INITIATE LAUNCH SEQUENCE' : 'CHECKLIST INCOMPLETE'}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-2xl text-red-500">⚠️ IRREVERSIBLE ACTION</AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-300 text-base">
                                    You are about to launch <strong>Marryzen</strong> as a live, public marriage platform.
                                    <br/><br/>
                                    • Verification queues will open to public.<br/>
                                    • Payment gateways will process real transactions.<br/>
                                    • Marketing campaigns (if automated) will trigger.
                                    <br/><br/>
                                    <strong>This action cannot be undone. Proceed?</strong>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="border-slate-700 hover:bg-slate-800 text-white">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleGoLive} className="bg-red-600 hover:bg-red-700 text-white border-none">
                                    CONFIRM LAUNCH
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
             </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LaunchChecklist;