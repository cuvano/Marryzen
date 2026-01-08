import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { adminStore, logAdminAction } from '@/lib/admin-store';
import { Check, X, AlertTriangle, ZoomIn } from 'lucide-react';

const VerificationQueue = () => {
  const { toast } = useToast();
  const [queue, setQueue] = useState(adminStore.verificationQueue);

  const handleDecision = (id, decision) => {
    const item = queue.find(q => q.id === id);
    
    logAdminAction('VerificationOfficer', decision, `User #${id}`, decision === 'APPROVED' ? 'ID Verified' : 'ID Rejected');

    toast({
        title: decision === 'APPROVED' ? "Verification Approved" : "Verification Rejected",
        description: decision === 'APPROVED' ? `User ${item.name} is now verified.` : `Rejection notice sent to ${item.name}.`,
        variant: decision === 'APPROVED' ? "success" : "destructive"
    });

    setQueue(queue.filter(q => q.id !== id));
  };

  if (queue.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-96 text-slate-500">
              <Check className="w-16 h-16 mb-4 opacity-20" />
              <h2 className="text-2xl font-semibold">All Caught Up!</h2>
              <p>No pending verifications in the queue.</p>
          </div>
      )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">Verification Queue ({queue.length})</h2>
      </div>

      <div className="grid gap-6">
        {queue.map(item => (
            <Card key={item.id} className="bg-slate-900 border-slate-800 text-slate-50 overflow-hidden">
                <CardHeader className="bg-slate-950 border-b border-slate-800 pb-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-xl text-white">{item.name}</CardTitle>
                            <CardDescription>User ID: {item.id} • Submitted: {new Date(item.timestamp).toLocaleTimeString()}</CardDescription>
                        </div>
                        <div className="text-right">
                             <Badge variant={item.aiMatchScore > 80 ? "success" : "warning"} className={item.aiMatchScore > 80 ? "bg-green-900 text-green-300" : "bg-yellow-900 text-yellow-300"}>
                                AI Match: {item.aiMatchScore}%
                             </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Government ID</span>
                            <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 group cursor-zoom-in">
                                <img src={item.idImage} alt="ID Doc" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <ZoomIn className="text-white" />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                             <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Live Selfie</span>
                            <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 group cursor-zoom-in">
                                <img src={item.selfieImage} alt="Selfie" className="w-full h-full object-cover" />
                                 <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <ZoomIn className="text-white" />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="bg-slate-950/50 border-t border-slate-800 p-4 flex justify-end gap-3">
                    <Button variant="destructive" onClick={() => handleDecision(item.id, 'REJECTED')}>
                        <X className="w-4 h-4 mr-2" /> Reject
                    </Button>
                    <Button variant="outline" className="border-yellow-600 text-yellow-500 hover:bg-yellow-950" onClick={() => handleDecision(item.id, 'FLAGGED')}>
                        <AlertTriangle className="w-4 h-4 mr-2" /> Flag Fraud
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleDecision(item.id, 'APPROVED')}>
                        <Check className="w-4 h-4 mr-2" /> Approve Verification
                    </Button>
                </CardFooter>
            </Card>
        ))}
      </div>
    </div>
  );
};

export default VerificationQueue;