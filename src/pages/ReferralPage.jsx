import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Users, CheckCircle, Gift, Loader2, Share2, Check, UserPlus, Shield, Award, MessageSquare, FileText, ExternalLink } from 'lucide-react';
import Footer from '@/components/Footer';

const ReferralPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, rewards: 0 });
  const [referrals, setReferrals] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData, error: profileError } = await supabase.from('profiles').select('referral_code, full_name').eq('id', user.id).maybeSingle();
      if (profileError && profileError.code !== 'PGRST116' && profileError.code !== 'NOT_FOUND') {
        console.error('Profile fetch error:', profileError);
      }
      if (profileData) {
        setProfile(profileData);
      }

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
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast({ title: "Copied!", description: "Referral link copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast({ title: "Failed to copy", description: "Please try again.", variant: "destructive" });
    });
  };

  const copyCodeToClipboard = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast({ title: "Copied!", description: "Referral code copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast({ title: "Failed to copy", description: "Please try again.", variant: "destructive" });
    });
  };

  const referralLink = profile ? `${window.location.origin}/join?ref=${profile.referral_code}` : '';
  
  // Share functions with proper deep links
  const shareViaWhatsApp = () => {
    const message = encodeURIComponent(`Join me on Marryzen - a serious marriage matchmaking platform! Use my referral link: ${referralLink}`);
    // WhatsApp Web/App deep link
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      window.open(`whatsapp://send?text=${message}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${message}`, '_blank');
    }
  };

  const shareViaFacebook = () => {
    const url = encodeURIComponent(referralLink);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
  };

  const shareViaTwitter = () => {
    const text = encodeURIComponent(`Join me on Marryzen - a serious marriage matchmaking platform!`);
    const url = encodeURIComponent(referralLink);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'width=600,height=400');
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent('Join me on Marryzen');
    const body = encodeURIComponent(`Hi!\n\nI'd like to invite you to join Marryzen, a serious marriage matchmaking platform.\n\nUse my referral link: ${referralLink}\n\nWhen you sign up and get approved, we both get 7 days of Premium free!\n\nLooking forward to seeing you there!`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

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
                <CardDescription>Share this link. When friends sign up and get approved, you both get 7 days of Premium free!</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 flex gap-2">
                        <input readOnly value={referralLink} className="flex-1 bg-white border border-[#E6DCD2] rounded px-3 py-2 text-sm text-[#333333]" />
                        <Button 
                            variant="outline" 
                            onClick={() => copyToClipboard(referralLink)}
                            className={copied ? "bg-green-50 border-green-300 text-green-700" : ""}
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
                <div className="mt-4 text-sm text-[#706B67] font-medium">
                    Your Referral Code: 
                    <span 
                        className="font-bold text-[#1F1F1F] bg-white px-2 py-1 rounded border border-[#E6DCD2] ml-1 select-all cursor-pointer hover:bg-[#FAF7F2]"
                        onClick={() => copyCodeToClipboard(profile.referral_code)}
                    >
                        {profile.referral_code}
                    </span>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="ml-2 h-6 px-2"
                        onClick={() => copyCodeToClipboard(profile.referral_code)}
                    >
                        <Copy className="w-3 h-3" />
                    </Button>
                </div>
                
                {/* Share Via Section */}
                <div className="mt-6 pt-6 border-t border-[#E6DCD2]">
                    <p className="text-sm font-medium text-[#706B67] mb-3">Share via:</p>
                    <div className="flex flex-wrap gap-2">
                        <Button 
                            size="sm"
                            className="bg-[#25D366] hover:bg-[#128C7E] text-white" 
                            onClick={shareViaWhatsApp}
                        >
                            <MessageSquare className="w-4 h-4 mr-2" /> WhatsApp
                        </Button>
                        <Button 
                            size="sm"
                            className="bg-[#1877F2] hover:bg-[#166FE5] text-white" 
                            onClick={shareViaFacebook}
                        >
                            <Share2 className="w-4 h-4 mr-2" /> Facebook
                        </Button>
                        <Button 
                            size="sm"
                            variant="outline"
                            className="border-[#000000] text-[#000000] hover:bg-[#000000]/10" 
                            onClick={shareViaTwitter}
                        >
                            <Share2 className="w-4 h-4 mr-2" /> X
                        </Button>
                        <Button 
                            size="sm"
                            variant="outline"
                            className="border-[#706B67] text-[#706B67] hover:bg-[#FAF7F2]" 
                            onClick={shareViaEmail}
                        >
                            <MessageSquare className="w-4 h-4 mr-2" /> Email
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* How It Works Section */}
        <Card className="mb-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#E6B450]"/> How Referrals Work
                </CardTitle>
                <CardDescription>Simple steps to earn rewards by inviting friends</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="text-center p-6 bg-[#FAF7F2] rounded-lg border border-[#E6DCD2]">
                        <div className="w-16 h-16 bg-[#E6B450] rounded-full flex items-center justify-center mx-auto mb-4">
                            <UserPlus className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="font-bold text-lg text-[#1F1F1F] mb-2">1. Friend Signs Up</h3>
                        <p className="text-sm text-[#706B67]">Your friend uses your referral link or code to create their account</p>
                    </div>
                    <div className="text-center p-6 bg-[#FAF7F2] rounded-lg border border-[#E6DCD2]">
                        <div className="w-16 h-16 bg-[#C85A72] rounded-full flex items-center justify-center mx-auto mb-4">
                            <Shield className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="font-bold text-lg text-[#1F1F1F] mb-2">2. Friend Gets Approved</h3>
                        <p className="text-sm text-[#706B67]">Their profile is reviewed and approved by our team</p>
                    </div>
                    <div className="text-center p-6 bg-[#FAF7F2] rounded-lg border border-[#E6DCD2]">
                        <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Gift className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="font-bold text-lg text-[#1F1F1F] mb-2">3. Reward Issued</h3>
                        <p className="text-sm text-[#706B67]">You both receive 7 days of Premium free! Rewards are automatically added to your account</p>
                    </div>
                </div>
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                        <strong>Note:</strong> Referrals are tracked automatically when your friend signs up. 
                        The referral status updates to "Completed" once their profile is approved. 
                        Rewards are issued within 24 hours of approval.
                    </p>
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
                                    <th className="px-4 py-3">Friend (Referee)</th>
                                    <th className="px-4 py-3">Date Invited</th>
                                    <th className="px-4 py-3">Timestamp</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Reward</th>
                                </tr>
                            </thead>
                            <tbody>
                                {referrals.map((ref) => (
                                    <tr key={ref.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {ref.referred?.full_name || 'Pending User'}
                                            {ref.referred_user_id && (
                                                <span className="text-xs text-gray-500 block mt-1">ID: {ref.referred_user_id.substring(0, 8)}...</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">{new Date(ref.created_at).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {new Date(ref.created_at).toLocaleTimeString()}
                                        </td>
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

        {/* Referral Terms Link */}
        <div className="mb-8 text-center">
            <Button 
                variant="link" 
                className="text-[#706B67] hover:text-[#1F1F1F]"
                onClick={() => navigate('/referral-terms')}
            >
                <FileText className="w-4 h-4 mr-2" />
                Referral Terms & Conditions
                <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
        </div>
        
        <div className="mt-12"><Footer /></div>
      </div>
    </div>
  );
};

export default ReferralPage;