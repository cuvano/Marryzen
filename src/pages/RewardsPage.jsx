import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Gift, Clock, CheckCircle, Loader2, AlertCircle, Hourglass, Sparkles, XCircle, Crown } from 'lucide-react';
import Footer from '@/components/Footer';

const RewardsPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user profile for premium status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium, premium_expires_at')
        .eq('id', user.id)
        .maybeSingle();
      setUserProfile(profile);

      // Fetch all rewards
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

  const getRewardStatus = (reward) => {
    // Check if expired
    if (reward.expires_at && new Date(reward.expires_at) < new Date()) {
      return 'expired';
    }
    
    // Return the status from database
    return reward.status || 'pending_approval';
  };

  const handleClaimReward = async (reward) => {
    setProcessingId(reward.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "Please log in to claim rewards", variant: "destructive" });
        return;
      }

      // Check if reward is available
      const status = getRewardStatus(reward);
      if (status !== 'available' && status !== 'earned') {
        toast({ 
          title: "Cannot Claim", 
          description: `This reward is ${status.replace('_', ' ')} and cannot be claimed.`, 
          variant: "destructive" 
        });
        setProcessingId(null);
        return;
      }

      // If reward is premium time, activate it
      if (reward.reward_type === 'premium_time' || reward.reward_type === 'premium_month') {
        await activatePremiumReward(reward, user.id);
      } else {
        // For other reward types, just mark as claimed
        const { error: updateError } = await supabase
          .from('rewards')
          .update({ 
            status: 'claimed', 
            claimed_at: new Date().toISOString() 
          })
          .eq('id', reward.id);

        if (updateError) throw updateError;
      }

      toast({ 
        title: "Reward Claimed!", 
        description: "Your reward has been applied to your account." 
      });
      
      // Refresh rewards and profile
      await fetchRewards();

    } catch (err) {
      console.error(err);
      toast({ 
        title: "Claim Failed", 
        description: err.message || "Could not claim reward. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setProcessingId(null);
    }
  };

  const activatePremiumReward = async (reward, userId) => {
    // Parse the reward value (e.g., "1 month", "30 days")
    const value = reward.value || reward.reward_value || '1 month';
    const days = parsePremiumDays(value);
    
    if (!days) {
      throw new Error('Invalid premium reward value');
    }

    // Get current premium status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_premium, premium_expires_at')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    const now = new Date();
    let newExpiresAt;

    // If user already has premium and it hasn't expired, extend from current expiration
    if (profile.is_premium && profile.premium_expires_at) {
      const currentExpiry = new Date(profile.premium_expires_at);
      if (currentExpiry > now) {
        // Extend from current expiration
        newExpiresAt = new Date(currentExpiry);
        newExpiresAt.setDate(newExpiresAt.getDate() + days);
      } else {
        // Current premium expired, start from now
        newExpiresAt = new Date(now);
        newExpiresAt.setDate(newExpiresAt.getDate() + days);
      }
    } else {
      // No active premium, start from now
      newExpiresAt = new Date(now);
      newExpiresAt.setDate(newExpiresAt.getDate() + days);
    }

    // Update profile with premium status
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_premium: true,
        premium_expires_at: newExpiresAt.toISOString()
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Mark reward as claimed
    const { error: rewardError } = await supabase
      .from('rewards')
      .update({
        status: 'claimed',
        claimed_at: new Date().toISOString()
      })
      .eq('id', reward.id);

    if (rewardError) throw rewardError;
  };

  const parsePremiumDays = (value) => {
    if (!value) return 30; // Default to 30 days
    
    const lowerValue = value.toLowerCase();
    
    // Check for "month" or "months"
    const monthMatch = lowerValue.match(/(\d+)\s*month/i);
    if (monthMatch) {
      return parseInt(monthMatch[1]) * 30;
    }
    
    // Check for "day" or "days"
    const dayMatch = lowerValue.match(/(\d+)\s*day/i);
    if (dayMatch) {
      return parseInt(dayMatch[1]);
    }
    
    // Check for just a number (assume days)
    const numberMatch = lowerValue.match(/(\d+)/);
    if (numberMatch) {
      return parseInt(numberMatch[1]);
    }
    
    return 30; // Default fallback
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending_approval':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <Hourglass className="w-3 h-3 mr-1" />
            Pending Approval
          </Badge>
        );
      case 'available':
      case 'earned':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <Sparkles className="w-3 h-3 mr-1" />
            Available
          </Badge>
        );
      case 'claimed':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Claimed
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-gray-100 text-gray-600 border-gray-300">
            <XCircle className="w-3 h-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-600 border-gray-300">
            {status?.replace('_', ' ') || 'Unknown'}
          </Badge>
        );
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#E6B450]" /></div>;

  // Categorize rewards by status
  const categorizedRewards = {
    pending_approval: [],
    available: [],
    claimed: [],
    expired: []
  };

  rewards.forEach(reward => {
    const status = getRewardStatus(reward);
    if (categorizedRewards[status]) {
      categorizedRewards[status].push(reward);
    } else {
      // Handle 'earned' status as 'available'
      if (status === 'earned') {
        categorizedRewards.available.push(reward);
      } else {
        categorizedRewards.available.push(reward);
      }
    }
  });

  const renderRewardCard = (reward) => {
    const status = getRewardStatus(reward);
    const isPremiumReward = reward.reward_type === 'premium_time' || reward.reward_type === 'premium_month';
    
    return (
      <Card 
        key={reward.id} 
        className={`bg-white shadow-md relative overflow-hidden ${
          status === 'available' || status === 'earned' 
            ? 'border-[#E6B450] border-2' 
            : 'border-[#E6DCD2]'
        }`}
      >
        {status === 'available' || status === 'earned' ? (
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#E6B450] rotate-45 transform translate-x-8 -translate-y-8"></div>
        ) : null}
        
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg text-[#1F1F1F] flex items-center gap-2">
                {isPremiumReward && <Crown className="w-5 h-5 text-[#E6B450]" />}
                {reward.value || reward.reward_value || 'Premium Reward'}
              </CardTitle>
              <p className="text-sm text-[#706B67] capitalize mt-1">
                {reward.reward_type?.replace(/_/g, ' ') || 'Premium Time'}
              </p>
            </div>
            {getStatusBadge(status)}
          </div>
        </CardHeader>
        
        <CardContent>
          {reward.description && (
            <p className="text-sm text-[#706B67] mb-3">{reward.description}</p>
          )}
          
          {reward.expires_at && (
            <p className={`text-xs flex items-center gap-1 font-medium ${
              status === 'expired' ? 'text-red-500' : 'text-[#706B67]'
            }`}>
              <Clock className="w-3 h-3" /> 
              {status === 'expired' ? 'Expired: ' : 'Expires: '}
              {new Date(reward.expires_at).toLocaleDateString()}
            </p>
          )}
          
          {reward.created_at && (
            <p className="text-xs text-[#706B67] mt-2">
              Earned: {new Date(reward.created_at).toLocaleDateString()}
            </p>
          )}
        </CardContent>
        
        {(status === 'available' || status === 'earned') && (
          <CardFooter>
            <Button 
              className="w-full bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold"
              onClick={() => handleClaimReward(reward)}
              disabled={processingId === reward.id}
            >
              {processingId === reward.id ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  Claiming...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Claim Now
                </>
              )}
            </Button>
          </CardFooter>
        )}
        
        {status === 'claimed' && reward.claimed_at && (
          <CardFooter>
            <div className="w-full text-center text-sm text-green-600 font-medium">
              <CheckCircle className="w-4 h-4 inline mr-1" />
              Claimed on {new Date(reward.claimed_at).toLocaleDateString()}
            </div>
          </CardFooter>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-[#1F1F1F] mb-2 flex items-center gap-2">
          <Gift className="text-[#C85A72]"/> My Rewards
        </h1>
        <p className="text-[#706B67] mb-8">Manage and claim your referral rewards</p>

        {/* Available Rewards */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-[#1F1F1F] mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-green-600" />
            Available to Claim ({categorizedRewards.available.length})
          </h2>
          {categorizedRewards.available.length === 0 ? (
            <Card className="bg-white border-dashed border-[#E6DCD2]">
              <CardContent className="p-8 text-center">
                <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No available rewards</h3>
                <p className="text-gray-500 mb-4">Invite friends to earn premium perks!</p>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/referrals')}
                  className="border-[#E6B450] text-[#E6B450] hover:bg-[#FFFBEB]"
                >
                  Go to Referrals
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categorizedRewards.available.map(renderRewardCard)}
            </div>
          )}
        </div>

        {/* Pending Approval Rewards */}
        {categorizedRewards.pending_approval.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-4 flex items-center gap-2">
              <Hourglass className="w-5 h-5 text-yellow-600" />
              Pending Approval ({categorizedRewards.pending_approval.length})
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categorizedRewards.pending_approval.map(renderRewardCard)}
            </div>
            <p className="text-sm text-[#706B67] mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <strong>Note:</strong> These rewards are waiting for your referred friend's profile to be approved. 
              Once approved, they will move to "Available to Claim".
            </p>
          </div>
        )}

        {/* Claimed Rewards */}
        {categorizedRewards.claimed.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              Claimed Rewards ({categorizedRewards.claimed.length})
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categorizedRewards.claimed.map(renderRewardCard)}
            </div>
          </div>
        )}

        {/* Expired Rewards */}
        {categorizedRewards.expired.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-gray-500" />
              Expired Rewards ({categorizedRewards.expired.length})
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categorizedRewards.expired.map(renderRewardCard)}
            </div>
          </div>
        )}

        {/* All Rewards History Table */}
        {rewards.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">All Rewards History</h2>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                      <tr>
                        <th className="px-6 py-3">Reward</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Earned On</th>
                        <th className="px-6 py-3">Claimed On</th>
                        <th className="px-6 py-3">Expires</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rewards.map(reward => {
                        const status = getRewardStatus(reward);
                        return (
                          <tr key={reward.id} className="bg-white hover:bg-gray-50">
                            <td className="px-6 py-4 font-medium">{reward.value || reward.reward_value}</td>
                            <td className="px-6 py-4 text-[#706B67] capitalize">
                              {reward.reward_type?.replace(/_/g, ' ') || 'Premium'}
                            </td>
                            <td className="px-6 py-4">
                              {getStatusBadge(status)}
                            </td>
                            <td className="px-6 py-4 text-gray-500">
                              {new Date(reward.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-gray-500">
                              {reward.claimed_at ? new Date(reward.claimed_at).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-6 py-4 text-gray-500">
                              {reward.expires_at ? new Date(reward.expires_at).toLocaleDateString() : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State - No Rewards at All */}
        {rewards.length === 0 && (
          <Card className="bg-white border-dashed border-[#E6DCD2]">
            <CardContent className="p-12 text-center">
              <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No rewards yet</h3>
              <p className="text-gray-500 mb-6">Start inviting friends to earn premium rewards!</p>
              <Button 
                onClick={() => navigate('/referrals')}
                className="bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold"
              >
                <Gift className="w-4 h-4 mr-2" />
                Invite Friends
              </Button>
            </CardContent>
          </Card>
        )}
        
        <div className="mt-12"><Footer /></div>
      </div>
    </div>
  );
};

export default RewardsPage;