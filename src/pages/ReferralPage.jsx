import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Users, CheckCircle, Gift, Loader2, Share2 } from 'lucide-react';
import Footer from '@/components/Footer';

const ReferralPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, rewards: 0 });
  const [referrals, setReferrals] = useState([]);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase.from('profiles').select('referral_code, full_name').eq('id', user.id).single();
      setProfile(profileData);

      // Fetch referrals made by this user
      const { data: referralData, error: refError } = await supabase
        .from('referrals')
        .select(`
            *,
            referred:referred_user_id(full_name)
        `)
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      if (refError) throw refError;
      setReferrals(referralData || []);

      // Calculate Stats
      const total = referralData?.length || 0;
      const completed = referralData?.filter(r => r.status === 'completed').length || 0;
      const pending = referralData?.filter(r => r.status === 'pending').length || 0;
      
      const { count: rewardsCount } = await supabase.from('rewards').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'earned');

      setStats({ total, completed, pending, rewards: rewardsCount || 0 });

    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load referral data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Referral code copied to clipboard." });
  };

  const referralLink = profile ? `${window.location.origin}/join?ref=${profile.referral_code}` : '';

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#E6B450]" /></div>;

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-[#1F1F1F] mb-2">Invite Friends</h1>
        <p className="text-[#706B67] mb-8">Help friends find serious partners and earn premium rewards.</p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
                <Users className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-gray-500 font-medium">Total Friends Invited</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
                <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-2" />
                <div className="text-2xl font-bold">{stats.completed}</div>
                <div className="text-xs text-gray-500 font-medium">Approved Profiles</div>
            </CardContent>
          </Card>
           <Card>
            <CardContent className="p-6 text-center">
                <Loader2 className="w-8 h-8 mx-auto text-yellow-500 mb-2" />
                <div className="text-2xl font-bold">{stats.pending}</div>
                <div className="text-xs text-gray-500 font-medium">Pending Approval</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
                <Gift className="w-8 h-8 mx-auto text-[#C85A72] mb-2" />
                <div className="text-2xl font-bold">{stats.rewards}</div>
                <div className="text-xs text-gray-500 font-medium">Rewards Available</div>
            </CardContent>
          </Card>
        </div>

        {/* Share Section */}
        <Card className="mb-8 border-[#E6B450] bg-[#FFFBEB]">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Share2 className="w-5 h-5"/> Your Unique Referral Link</CardTitle>
                <CardDescription>Share this link. When friends sign up and get approved, you both get 1 month of Premium free!</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 flex gap-2">
                        <input readOnly value={referralLink} className="flex-1 bg-white border border-[#E6DCD2] rounded px-3 py-2 text-sm text-[#333333]" />
                        <Button variant="outline" onClick={() => copyToClipboard(referralLink)}><Copy className="w-4 h-4" /></Button>
                    </div>
                    <div className="flex gap-2">
                        <Button className="bg-[#25D366] hover:bg-[#128C7E] text-white" onClick={() => window.open(`https://wa.me/?text=Join me on Marryzen! ${referralLink}`)}>WhatsApp</Button>
                        <Button className="bg-[#1877F2] hover:bg-[#166FE5] text-white" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${referralLink}`)}>Facebook</Button>
                    </div>
                </div>
                 <div className="mt-4 text-sm text-[#706B67] font-medium">
                     Your Referral Code: <span className="font-bold text-[#1F1F1F] bg-white px-2 py-1 rounded border border-[#E6DCD2] ml-1 select-all">{profile.referral_code}</span>
                 </div>
            </CardContent>
        </Card>

        {/* History Table */}
        <Card>
            <CardHeader><CardTitle>Referral History</CardTitle></CardHeader>
            <CardContent>
                {referrals.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No referrals yet. Share your link to get started!</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3">Friend</th>
                                    <th className="px-4 py-3">Date Invited</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Reward</th>
                                </tr>
                            </thead>
                            <tbody>
                                {referrals.map((ref) => (
                                    <tr key={ref.id} className="bg-white border-b">
                                        <td className="px-4 py-3 font-medium text-gray-900">{ref.referred?.full_name || 'Pending User'}</td>
                                        <td className="px-4 py-3">{new Date(ref.created_at).toLocaleDateString()}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                ref.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                ref.status === 'expired' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {ref.status.charAt(0).toUpperCase() + ref.status.slice(1)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {ref.status === 'completed' ? (
                                                <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Earned</span>
                                            ) : (
                                                <span className="text-gray-400">Locked</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
        
        <div className="mt-12"><Footer /></div>
      </div>
    </div>
  );
};

export default ReferralPage;