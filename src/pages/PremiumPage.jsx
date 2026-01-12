import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Crown, Check, X, ShieldCheck, Lock, Star, ShieldAlert, Loader2, AlertCircle, UserCheck, FileText } from 'lucide-react';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/customSupabaseClient';

const PremiumPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profileStatus, setProfileStatus] = useState(null);
  const [profileCheckLoading, setProfileCheckLoading] = useState(true);

  useEffect(() => {
    checkProfileStatus();
  }, []);

  const checkProfileStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfileCheckLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('status, onboarding_step, full_name')
        .eq('id', user.id)
        .maybeSingle();

      setProfileStatus(profile || null);
    } catch (error) {
      console.error('Error checking profile status:', error);
    } finally {
      setProfileCheckLoading(false);
    }
  };

  const handleSubscribe = async (priceId) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Please Log In",
          description: "You need to be logged in to subscribe to premium.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Check if user is approved
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('status, onboarding_step')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      // Double-check status before proceeding
      if (!profile || profile.status !== 'approved') {
        setLoading(false);
        // Status should already be checked via UI, but just in case
        return;
      }

      const { data, error } = await supabase.functions.invoke('stripe-api', {
        body: { 
            action: 'create_checkout_session', 
            priceId, 
            returnUrl: window.location.origin + '/billing' 
        }
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Could not create checkout session");
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Subscription Error",
        description: err.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isApproved = profileStatus?.status === 'approved';
  const isPending = profileStatus?.status === 'pending_review';
  const isRejected = profileStatus?.status === 'rejected';
  const hasIncompleteProfile = !profileStatus || profileStatus.onboarding_step < 5;

  // Mock Price IDs (replace with real Stripe Price IDs in production)
  const plans = [
    {
      id: 'price_monthly_mock', // Replace with real price_xxx
      name: 'Monthly Plan',
      duration: '1 month',
      price: '$29.99',
      description: 'Flexible commitment',
      buttonText: 'Start Monthly Premium',
      isPopular: false
    },
    {
      id: 'price_6month_mock',
      name: '6-Month Plan',
      duration: '6 months',
      price: '$119.94',
      description: 'Good Value - Save 33%',
      buttonText: 'Choose 6-Month Plan',
      isPopular: false,
      badge: 'Good Value'
    },
    {
      id: 'price_12month_mock',
      name: '12-Month Plan',
      duration: '12 months',
      price: '$179.94',
      description: 'Best Value - Save 50%',
      buttonText: 'Choose 12-Month Plan',
      isPopular: true,
      badge: 'Best Value'
    }
  ];

  const features = [
    { name: 'Profile Photos', free: 'Max 4 Photos', premium: 'Max 12 Photos' },
    { name: 'Messaging', free: '10 / day', premium: 'Unlimited' },
    { name: 'Matching Filters', free: 'Basic', premium: 'Advanced (Faith, Values)' },
    { name: 'Verified Badge', free: false, premium: true },
    { name: 'Read Receipts', free: false, premium: true },
    { name: 'See Who Liked You', free: false, premium: true },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8 pb-20 bg-[#FAF7F2]">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
            <Button variant="ghost" onClick={() => navigate(-1)} className="text-[#706B67] hover:text-[#1F1F1F] mb-4 pl-0">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <div className="text-center max-w-3xl mx-auto">
                <h1 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-3">Upgrade to Marryzen Premium</h1>
                <p className="text-xl text-[#706B67] mb-4 font-medium">Unlock advanced tools designed for serious marriage-focused members.</p>
            </div>
        </div>

        {/* Profile Status Banner */}
        {!profileCheckLoading && !isApproved && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className={`border-2 ${isPending ? 'border-yellow-300 bg-yellow-50' : isRejected ? 'border-red-300 bg-red-50' : 'border-orange-300 bg-orange-50'}`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-full ${isPending ? 'bg-yellow-200' : isRejected ? 'bg-red-200' : 'bg-orange-200'}`}>
                    <AlertCircle className={`w-6 h-6 ${isPending ? 'text-yellow-700' : isRejected ? 'text-red-700' : 'text-orange-700'}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-bold text-lg mb-2 ${isPending ? 'text-yellow-900' : isRejected ? 'text-red-900' : 'text-orange-900'}`}>
                      {isPending 
                        ? "Your profile is pending approval" 
                        : isRejected
                        ? "Profile update required"
                        : "Complete your profile to unlock Premium"}
                    </h3>
                    <p className={`text-sm mb-4 ${isPending ? 'text-yellow-800' : isRejected ? 'text-red-800' : 'text-orange-800'}`}>
                      {isPending
                        ? "Your profile is currently under review. Once approved, you'll be able to subscribe to Premium and unlock all features."
                        : isRejected
                        ? "Your profile needs to be updated to meet our guidelines. Please review and resubmit for approval."
                        : "To subscribe to Premium, please complete your profile first. Premium unlocks after your profile is approved."}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {hasIncompleteProfile && (
                        <Button
                          onClick={() => navigate('/onboarding')}
                          className={`${isPending ? 'bg-yellow-600 hover:bg-yellow-700' : isRejected ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'} text-white`}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Complete Profile
                        </Button>
                      )}
                      {!hasIncompleteProfile && (
                        <Button
                          onClick={() => navigate('/profile')}
                          className={`${isRejected ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'} text-white`}
                        >
                          <UserCheck className="w-4 h-4 mr-2" />
                          {isRejected ? 'Update Profile' : 'Check Approval Status'}
                        </Button>
                      )}
                      {isPending && (
                        <Button
                          variant="outline"
                          onClick={() => navigate('/profile')}
                          className="border-yellow-600 text-yellow-700 hover:bg-yellow-100"
                        >
                          View Profile
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Feature Comparison */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl overflow-hidden mb-12 border border-[#E6DCD2] shadow-sm">
            <div className="grid grid-cols-3 p-4 border-b border-[#E6DCD2] bg-[#FAF7F2]">
                <div className="text-[#706B67] font-bold text-sm uppercase tracking-wider flex items-center">Features</div>
                <div className="text-center font-bold text-[#1F1F1F]">Free</div>
                <div className="text-center font-bold text-[#E6B450]">Premium</div>
            </div>
            <div className="divide-y divide-[#E6DCD2]">
                {features.map((feature, idx) => (
                    <div key={idx} className="grid grid-cols-3 p-4 items-center hover:bg-[#FAF7F2]/50 transition-colors">
                        <div className="text-[#333333] text-sm font-semibold">{feature.name}</div>
                        <div className="text-center text-[#706B67] text-sm flex justify-center font-medium">
                            {feature.free === false ? <X className="w-5 h-5 text-gray-300" /> : feature.free}
                        </div>
                        <div className="text-center text-[#1F1F1F] font-semibold text-sm flex justify-center">
                             {feature.premium === true ? <Check className="w-5 h-5 text-[#E6B450]" /> : feature.premium}
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {plans.map((plan, index) => (
                <motion.div 
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`relative rounded-2xl p-6 flex flex-col ${plan.isPopular ? 'bg-white border-2 border-[#E6B450] shadow-lg' : 'bg-white border border-[#E6DCD2] shadow-sm'}`}
                >
                    {plan.isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#E6B450] text-[#1F1F1F] text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                            {plan.badge}
                        </div>
                    )}
                    <div className="text-center mb-6">
                        <h3 className="text-lg font-bold text-[#1F1F1F] mb-1">{plan.name}</h3>
                        <p className="text-[#706B67] text-sm font-medium">{plan.description}</p>
                        <div className="mt-4 text-3xl font-bold text-[#1F1F1F]">{plan.price}</div>
                        <div className="text-[#706B67] text-xs font-medium">billed every {plan.duration}</div>
                    </div>
                    <div className="mt-auto">
                        {!isApproved ? (
                          <div className="w-full py-6 px-4 text-center bg-gray-100 border border-gray-300 rounded-lg">
                            <p className="text-sm text-gray-600 font-medium">
                              {isPending 
                                ? "Unlocks after approval" 
                                : isRejected
                                ? "Update profile to continue"
                                : "Complete profile first"}
                            </p>
                          </div>
                        ) : (
                          <Button 
                            disabled={loading}
                            onClick={() => handleSubscribe(plan.id)} 
                            className={`w-full py-6 text-base font-bold ${plan.isPopular ? 'bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F]' : 'bg-[#FAF7F2] border border-[#E6DCD2] hover:bg-[#E6DCD2] text-[#333333]'}`}
                          >
                            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : plan.buttonText}
                          </Button>
                        )}
                    </div>
                </motion.div>
            ))}
        </div>

        {/* Footer info */}
        <div className="text-center text-[#706B67] text-xs max-w-xl mx-auto font-medium mb-12">
            <div className="flex justify-center gap-4 mb-4">
                <span className="flex items-center gap-1"><Lock className="w-3 h-3"/> Secure Payment via Stripe</span>
                <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Cancel Anytime</span>
            </div>
            <p>By subscribing, you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/billing-terms" className="underline">Billing Policy</Link>.</p>
        </div>
        <Footer />
      </div>
    </div>
  );
};

export default PremiumPage;