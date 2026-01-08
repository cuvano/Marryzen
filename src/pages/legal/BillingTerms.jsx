import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CreditCard, Home, LayoutDashboard } from 'lucide-react';
import Footer from '@/components/Footer';

const BillingTerms = () => {
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem('userProfile');

  return (
    <div className="min-h-screen p-4 md:p-8 pb-20 bg-[#FAF7F2] text-[#333333]">
      <div className="max-w-4xl mx-auto">
         {/* Navigation Buttons */}
        <div className="flex justify-between items-center mb-8">
             <Button variant="ghost" onClick={() => navigate(-1)} className="text-[#706B67] hover:text-[#1F1F1F] hover:bg-[#E6DCD2]/50 pl-0 font-medium">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/')} className="border-[#E6DCD2] text-[#333333] hover:bg-[#FFFFFF]">
                    <Home className="w-4 h-4 mr-2" /> Home
                </Button>
                 {isAuthenticated && (
                     <Button variant="outline" onClick={() => navigate('/dashboard')} className="border-[#E6DCD2] text-[#333333] hover:bg-[#FFFFFF]">
                        <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
                    </Button>
                )}
            </div>
        </div>

        <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-2">Premium Billing Terms</h1>
            <p className="text-[#706B67] font-medium">Understanding your subscription.</p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-2xl p-8 md:p-12 shadow-sm space-y-8">
            
            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-[#1F1F1F] flex items-center gap-2">
                    <CreditCard className="w-6 h-6 text-[#E6B450]" /> Subscriptions & Renewals
                </h2>
                <p className="leading-relaxed text-[#333333]">
                    Marryzen Premium is an auto-renewing subscription service. By purchasing a subscription, you authorize us to charge your chosen payment method on a recurring basis (monthly, every 6 months, or annually) until you cancel.
                </p>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#1F1F1F]">Cancellation</h3>
                <p className="leading-relaxed text-[#333333]">
                    You may cancel your subscription at any time through your account settings (or App Store/Google Play settings if purchased via mobile). 
                    <strong> Cancellation must be done at least 24 hours before the end of the current billing period to avoid being charged for the next period.</strong>
                </p>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#1F1F1F]">No Refunds</h3>
                <p className="leading-relaxed text-[#333333]">
                    All charges for in-app purchases and subscriptions are non-refundable, and there are no refunds or credits for partially used periods, except as required by applicable law or our specific Refund Policy.
                </p>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#1F1F1F]">Price Changes</h3>
                <p className="leading-relaxed text-[#333333]">
                    We reserve the right to adjust pricing for our service or any components thereof in any manner and at any time as we may determine in our sole discretion. Any price changes will take effect following notice to you.
                </p>
            </div>

        </div>
        <Footer />
      </div>
    </div>
  );
};

export default BillingTerms;