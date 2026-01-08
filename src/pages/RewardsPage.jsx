import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Gift, Clock, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import Footer from '@/components/Footer';

const RewardsPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRewards(data || []);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load rewards", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async (rewardId) => {
    setProcessingId(rewardId);
    try {
        const { data, error } = await supabase.functions.invoke('referral-rewards', {
            body: { action: 'claim_reward', rewardId }
        });

        if (error) throw error;
        
        toast({ title: "Reward Claimed!", description: "Your reward has been applied to your account." });
        
        // Update local state
        setRewards(prev => prev.map(r => r.id === rewardId ? { ...r, status: 'claimed', claimed_at: new Date().toISOString() } : r));

    } catch (err) {
        console.error(err);
        toast({ title: "Claim Failed", description: err.message || "Could not claim reward.", variant: "destructive" });
    } finally {
        setProcessingId(null);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#E6B450]" /></div>;

  const activeRewards = rewards.filter(r => r.status === 'earned' && new Date(r.expires_at) > new Date());
  const historyRewards = rewards.filter(r => r.status !== 'earned' || new Date(r.expires_at) <= new Date());

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-[#1F1F1F] mb-6 flex items-center gap-2"><Gift className="text-[#C85A72]"/> My Rewards</h1>

        <div className="mb-10">
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Available to Claim</h2>
            {activeRewards.length === 0 ? (
                <div className="bg-white p-8 rounded-xl border border-dashed border-gray-300 text-center">
                    <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">No active rewards</h3>
                    <p className="text-gray-500 mb-4">Invite friends to earn premium perks!</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeRewards.map(reward => (
                        <Card key={reward.id} className="border-[#E6B450] bg-white shadow-md relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-16 h-16 bg-[#E6B450] rotate-45 transform translate-x-8 -translate-y-8"></div>
                             <CardHeader>
                                 <CardTitle className="text-lg text-[#1F1F1F]">{reward.value}</CardTitle>
                                 <p className="text-sm text-[#706B67] capitalize">{reward.reward_type.replace(/_/g, ' ')}</p>
                             </CardHeader>
                             <CardContent>
                                 <p className="text-xs text-red-500 flex items-center gap-1 font-medium">
                                     <Clock className="w-3 h-3" /> Expires: {new Date(reward.expires_at).toLocaleDateString()}
                                 </p>
                             </CardContent>
                             <CardFooter>
                                 <Button 
                                    className="w-full bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold"
                                    onClick={() => handleClaimReward(reward.id)}
                                    disabled={processingId === reward.id}
                                 >
                                     {processingId === reward.id ? <Loader2 className="animate-spin w-4 h-4" /> : "Claim Now"}
                                 </Button>
                             </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>

        <div>
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Reward History</h2>
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-3">Reward</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Earned On</th>
                                    <th className="px-6 py-3">Processed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {historyRewards.map(reward => (
                                    <tr key={reward.id} className="bg-white">
                                        <td className="px-6 py-4 font-medium">{reward.value}</td>
                                        <td className="px-6 py-4">
                                            {reward.status === 'claimed' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Claimed</span>}
                                            {reward.status === 'expired' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500"><AlertCircle className="w-3 h-3" /> Expired</span>}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">{new Date(reward.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {reward.claimed_at ? new Date(reward.claimed_at).toLocaleDateString() : '-'}
                                        </td>
                                    </tr>
                                ))}
                                {historyRewards.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No past rewards found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
        
        <div className="mt-12"><Footer /></div>
      </div>
    </div>
  );
};

export default RewardsPage;