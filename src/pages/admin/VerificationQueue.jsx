import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';
import { Check, X, ZoomIn, User } from 'lucide-react';

const VerificationQueue = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, selfie_url, photos, created_at')
      .eq('identity_verification_status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setQueue([]);
      return;
    }
    setQueue(data || []);
  };

  useEffect(() => {
    fetchQueue().finally(() => setLoading(false));
  }, []);

  const handleDecision = async (userId, decision) => {
    const updates = decision === 'APPROVED'
      ? { identity_verification_status: 'verified', is_verified: true }
      : { identity_verification_status: 'rejected' };

    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: decision === 'APPROVED' ? 'Verification approved' : 'Verification rejected',
      description: decision === 'APPROVED' ? 'User is now verified.' : 'User has been notified.',
      variant: decision === 'APPROVED' ? 'default' : 'destructive'
    });

    setQueue((prev) => prev.filter((p) => p.id !== userId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        Loading verification queue…
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <Check className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-2xl font-semibold">All caught up</h2>
        <p className="mt-2">No ID verifications pending review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">ID Verification queue ({queue.length})</h2>
      </div>

      <div className="grid gap-6">
        {queue.map((profile) => (
          <Card key={profile.id} className="bg-slate-900 border-slate-800 text-slate-50 overflow-hidden">
            <CardHeader className="bg-slate-950 border-b border-slate-800 py-3 px-4 pb-3">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <CardTitle className="text-xl text-white">{profile.full_name || 'No name'}</CardTitle>
                  <CardDescription className="text-slate-400 mt-0.5">
                    {profile.email} · Submitted {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-slate-500 bg-slate-800 text-white hover:bg-slate-700 hover:text-white"
                  onClick={() => navigate('/admin/users')}
                >
                  <User className="w-4 h-4 mr-2" /> View in Users
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 py-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Selfie submission</span>
                  <div className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden border border-slate-700 group">
                    {profile.selfie_url ? (
                      <>
                        <img src={profile.selfie_url} alt="Selfie" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="text-white w-8 h-8" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">No selfie</div>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Profile photos</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(profile.photos || []).slice(0, 4).map((photo, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-700">
                        <img src={photo} alt={`Profile ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {(!profile.photos || profile.photos.length === 0) && (
                      <div className="col-span-2 aspect-video rounded-lg border border-slate-700 flex items-center justify-center text-slate-500">No photos</div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-950/50 border-t border-slate-800 py-3 px-4 flex justify-end gap-3">
              <Button variant="destructive" onClick={() => handleDecision(profile.id, 'REJECTED')}>
                <X className="w-4 h-4 mr-2" /> Reject
              </Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleDecision(profile.id, 'APPROVED')}>
                <Check className="w-4 h-4 mr-2" /> Approve verification
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default VerificationQueue;
