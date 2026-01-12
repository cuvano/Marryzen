import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, ExternalLink, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import Footer from '@/components/Footer';

const BillingPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/login');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116' && error.code !== 'NOT_FOUND') {
        throw error;
      }
      if (!data) {
        throw new Error('Profile not found');
      }
      setProfile(data);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load billing info", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
        const { data, error } = await supabase.functions.invoke('stripe-api', {
            body: { 
                action: 'create_portal_session', 
                returnUrl: window.location.href 
            }
        });

        if (error) throw error;
        if (data?.url) {
            window.location.href = data.url;
        } else {
            throw new Error("Could not create portal session");
        }
    } catch (err) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
        setPortalLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-[#1F1F1F] mb-6">Billing & Subscription</h1>

        <div className="grid gap-6">
          {/* Current Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Current Plan</span>
                {profile.is_premium ? (
                    <Badge className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#E6B450]">Premium Active</Badge>
                ) : (
                    <Badge variant="outline">Free Plan</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {profile.is_premium 
                    ? `Your premium subscription is active.` 
                    : "You are currently on the free plan with limited features."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profile.is_premium ? (
                  <div className="space-y-4">
                      <div className="flex items-center gap-2 text-green-600 font-medium">
                          <CheckCircle className="w-5 h-5" />
                          All Premium Features Unlocked
                      </div>
                      {profile.subscription_end_date && (
                          <p className="text-sm text-[#706B67]">
                              Next billing / renewal date: <span className="font-semibold text-[#1F1F1F]">{new Date(profile.subscription_end_date).toLocaleDateString()}</span>
                          </p>
                      )}
                  </div>
              ) : (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                          <h4 className="font-bold text-yellow-800">Missing out on features?</h4>
                          <p className="text-sm text-yellow-700 mt-1">Upgrade to get unlimited messages, advanced filters, and more.</p>
                          <Button 
                              size="sm" 
                              className="mt-3 bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D]"
                              onClick={() => navigate('/premium')}
                          >
                              Upgrade Now
                          </Button>
                      </div>
                  </div>
              )}
            </CardContent>
          </Card>

          {/* Management Actions */}
          <Card>
            <CardHeader>
                <CardTitle>Manage Subscription</CardTitle>
                <CardDescription>Update payment methods, download invoices, or cancel plan.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                    <Button 
                        onClick={handleManageSubscription} 
                        disabled={portalLoading || !profile.stripe_customer_id}
                        className="flex items-center gap-2"
                    >
                        {portalLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                        Open Billing Portal
                    </Button>
                    {!profile.stripe_customer_id && (
                        <p className="text-sm text-[#706B67] self-center">
                            No billing history found.
                        </p>
                    )}
                </div>
                <p className="text-xs text-[#706B67] mt-4">
                    You will be redirected to our secure payment partner, Stripe, to manage your details.
                </p>
            </CardContent>
          </Card>
        </div>
        
        <div className="mt-12">
            <Footer />
        </div>
      </div>
    </div>
  );
};

export default BillingPage;