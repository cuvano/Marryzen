import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Gift, Loader2, Sparkles, CheckCircle, Calendar, Crown } from 'lucide-react';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const SOURCE_LABELS = {
  referral_verify: 'Referral - friend verified',
  referral_subscribe: 'Referral - friend subscribed',
  referral_verify_after_rename: 'Referral - friend verified',
  referee_signup_bonus: 'Welcome bonus - joined via referral',
};

// Reviewer fix #2: map raw RPC error codes to human-readable messages
const CLAIM_ERROR_MESSAGES = {
  not_authenticated: 'Please sign in again to claim this reward.',
  credit_not_found_or_already_claimed: 'This reward was already activated.',
  credit_expired: 'This reward has expired. Invite another friend to earn a new one.',
  not_owner: 'This reward isn\'t available on your account.',
};

const RewardsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [unclaimed, setUnclaimed] = useState([]);
  const [claimed, setClaimed] = useState([]);
  const [premium, setPremium] = useState({ is_premium: false, premium_expires_at: null });

  useEffect(() => {
    if (!user?.id) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [creditsRes, profileRes] = await Promise.all([
        supabase
          .from('premium_credits')
          .select('id, source, days, earned_at, claimed_at, expires_at, referred_user_id')
          .eq('user_id', user.id)
          .order('earned_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('is_premium, premium_expires_at')
          .eq('id', user.id)
          .maybeSingle(),
      ]);
      const all = creditsRes.data || [];
      const now = new Date();
      setUnclaimed(all.filter(c => !c.claimed_at && new Date(c.expires_at) > now));
      setClaimed(all.filter(c => c.claimed_at));
      setPremium(profileRes.data || { is_premium: false, premium_expires_at: null });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error loading rewards', description: e.message || 'Try again', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (creditId) => {
    // Reviewer fix #1: guard with claimingId (disable all buttons via prop below)
    if (claimingId) return;
    setClaimingId(creditId);
    try {
      const { data, error } = await supabase.rpc('claim_premium_credit', { p_credit_id: creditId });
      if (error) throw error;
      if (data && data.ok) {
        // Reviewer fix #3: use days_added instead of hardcoded "month"
        const newExpiry = new Date(data.new_expiry).toLocaleDateString();
        const daysAdded = data.days_added || 30;
        toast({
          title: 'Reward activated',
          description: 'Added ' + daysAdded + ' days of Premium. Runs through ' + newExpiry + '.',
        });
        await fetchAll();
      } else {
        const friendly = (data && CLAIM_ERROR_MESSAGES[data.error]) || 'Something went wrong. Please try again.';
        toast({ title: 'Could not activate reward', description: friendly, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Could not activate reward', description: e.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setClaimingId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#E6B450]" /></div>;
  }

  const premiumExpiryStr = premium.premium_expires_at ? new Date(premium.premium_expires_at).toLocaleDateString() : null;

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Gift className="w-8 h-8 text-brand-pink-strong" />
          <h1 className="text-3xl font-bold text-[#1F1F1F]">My Rewards</h1>
        </div>
        <p className="text-brand-muted mb-8">Manage and claim your referral rewards.</p>

        {/* Premium status card */}
        {premium.is_premium && premiumExpiryStr && (
          <Card className="mb-6 border-[#E6B450] bg-[#FFFBEB]">
            <CardContent className="p-4 flex items-center gap-3">
              <Crown className="w-6 h-6 text-[#8a6c1e]" />
              <div>
                <div className="font-bold text-[#1F1F1F]">Premium active</div>
                <div className="text-sm text-brand-muted">Renews / ends on {premiumExpiryStr}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available to Claim */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#E6B450]" />
              Available to Claim ({unclaimed.length})
            </CardTitle>
            <CardDescription>Click Activate when you're ready - the 30-day clock starts the moment you claim.</CardDescription>
          </CardHeader>
          <CardContent>
            {unclaimed.length === 0 ? (
              <div className="text-center py-8 bg-[#FAF7F2] rounded-lg border border-dashed border-[#E6DCD2]">
                <Gift className="w-12 h-12 text-[#E6DCD2] mx-auto mb-3" />
                <p className="text-[#1F1F1F] font-medium mb-1">No available rewards</p>
                <p className="text-sm text-brand-muted mb-4">Invite friends to earn premium perks.</p>
                <Button variant="outline" onClick={() => navigate('/referrals')}>Go to Referrals</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {unclaimed.map(credit => (
                  <div key={credit.id} className="flex items-center justify-between p-4 bg-[#FFFBEB] border border-[#E6B450] rounded-lg gap-3">
                    <div className="flex-1">
                      <div className="font-bold text-[#1F1F1F]">{credit.days} free days of Premium</div>
                      <div className="text-xs text-brand-muted mt-0.5">
                        {SOURCE_LABELS[credit.source] || credit.source} - earned {new Date(credit.earned_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-brand-muted">
                        Expires {new Date(credit.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleClaim(credit.id)}
                      disabled={claimingId !== null /* fix #1: disable ALL buttons while any claim in flight */}
                      className="bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-semibold disabled:opacity-60"
                    >
                      {claimingId === credit.id ? 'Activating...' : 'Activate'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Claim history */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-700" />
              Activated history ({claimed.length})
            </CardTitle>
            <CardDescription>Rewards you've already activated.</CardDescription>
          </CardHeader>
          <CardContent>
            {claimed.length === 0 ? (
              <p className="text-center text-gray-500 py-6 text-sm">No claimed rewards yet.</p>
            ) : (
              <div className="space-y-2">
                {claimed.map(credit => (
                  <div key={credit.id} className="flex items-center justify-between p-3 bg-[#FAF7F2] border border-[#E6DCD2] rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-700 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-[#1F1F1F]">{credit.days} days of Premium</div>
                        <div className="text-xs text-brand-muted">
                          {SOURCE_LABELS[credit.source] || credit.source}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-brand-muted text-right">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Claimed {new Date(credit.claimed_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-12"><Footer /></div>
      </div>
    </div>
  );
};

export default RewardsPage;
