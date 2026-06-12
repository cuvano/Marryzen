import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';
import { Check, X, ZoomIn, User, AlertTriangle } from 'lucide-react';

// Visual thresholds for name match score (numeric 0..1 from Didit name comparison)
const MATCH_OK = 0.75;   // green: clearly the same person
const MATCH_WARN = 0.5;  // amber: partial overlap, reviewer should eyeball

const formatMatchPct = (score) => {
  if (typeof score !== 'number' || Number.isNaN(score)) return null;
  return Math.round(score * 100) + '%';
};

const matchColorClass = (score) => {
  if (typeof score !== 'number') return 'text-slate-400';
  if (score >= MATCH_OK) return 'text-green-400';
  if (score >= MATCH_WARN) return 'text-amber-400';
  return 'text-red-400';
};

const VerificationQueue = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState(null);

  const fetchQueue = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, selfie_url, photos, created_at, id_name_on_record, name_match_score')
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
    // Guard against double-click while a decision is in flight (any row)
    if (decidingId) return;
    setDecidingId(userId);

    try {
      // L3 hardening 2026-06-09: route through log_admin_identity_verify RPC
      // (migration 20260609010000) so the mutation + audit_logs row land
      // atomically in one transaction, and the privileged-column trigger
      // doesn't block the write.
      const { error } = await supabase.rpc('log_admin_identity_verify', {
        target_user: userId,
        decision: decision.toLowerCase(),       // 'approved' | 'rejected'
        reviewer_notes: null,                   // could surface a UI textarea later
      });

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
    } finally {
      setDecidingId(null);
    }
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
        {queue.map((profile) => {
          const matchScore = profile.name_match_score;
          const matchPct = formatMatchPct(matchScore);
          const isMismatch = typeof matchScore === 'number' && matchScore < MATCH_WARN;
          const hasIdName = !!profile.id_name_on_record;
          return (
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

              {/* ID name vs profile name comparison block */}
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/30">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <div>
                    <span className="text-slate-500">Profile name:&nbsp;</span>
                    <span className="text-slate-100 font-medium">{profile.full_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">ID name:&nbsp;</span>
                    <span className={`font-medium ${hasIdName ? 'text-slate-100' : 'text-slate-500 italic'}`}>
                      {hasIdName ? profile.id_name_on_record : 'Not provided by Didit'}
                    </span>
                  </div>
                  {matchPct && (
                    <div>
                      <span className="text-slate-500">Match:&nbsp;</span>
                      <span className={`font-semibold ${matchColorClass(matchScore)}`}>{matchPct}</span>
                    </div>
                  )}
                </div>
                {isMismatch && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-red-300 bg-red-950/40 border border-red-900 rounded px-2 py-1.5">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Name on ID doesn't match profile name. Ask the user to correct their profile name (the system rechecks automatically on save), or reject if you suspect fraud.</span>
                  </div>
                )}
              </div>

              <CardContent className="px-4 py-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Selfie submission</span>
                    <div className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden border border-slate-700 group">
                      {profile.selfie_url ? (
                        <>
                          <img loading="lazy" decoding="async" src={profile.selfie_url} alt="Selfie" className="w-full h-full object-cover" />
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
                          <img loading="lazy" decoding="async" src={photo} alt={`Profile ${idx + 1}`} className="w-full h-full object-cover" />
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
                <Button
                  variant="destructive"
                  disabled={decidingId !== null}
                  onClick={() => handleDecision(profile.id, 'REJECTED')}
                  className="disabled:opacity-60"
                >
                  <X className="w-4 h-4 mr-2" /> {decidingId === profile.id ? 'Rejecting…' : 'Reject'}
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-60"
                  disabled={decidingId !== null}
                  onClick={() => handleDecision(profile.id, 'APPROVED')}
                >
                  <Check className="w-4 h-4 mr-2" /> {decidingId === profile.id ? 'Approving…' : 'Approve verification'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default VerificationQueue;
