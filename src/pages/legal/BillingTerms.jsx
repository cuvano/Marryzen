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
            <p className="text-[#706B67] font-medium">Effective Date: June 3, 2026</p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-2xl p-8 md:p-12 shadow-sm space-y-8">

            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-[#1F1F1F] flex items-center gap-2">
                    <CreditCard className="w-6 h-6 text-[#E6B450]" /> Subscriptions &amp; Renewals
                </h2>
                <p className="leading-relaxed text-[#333333]">
                    Marryzen Premium is an auto-renewing subscription service. By purchasing a subscription, you authorize us to charge your chosen payment method on a recurring basis at the plan interval you selected — <strong>monthly, quarterly (every 3 months), or annually</strong> — until you cancel. Plan prices in effect at the time of purchase are: Monthly $24.99, Quarterly $59.97, Annual $179.88. All charges are processed in <strong>US Dollars (USD)</strong>.
                </p>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#1F1F1F]">Auto-Renewal Disclosure</h3>
                <p className="leading-relaxed text-[#333333]">
                    Your subscription will <strong>automatically renew at the same plan price</strong> until you cancel. We will send you a reminder email <strong>7 days</strong> and <strong>24 hours</strong> before each renewal so the charge is never a surprise. You can cancel at any time from your <strong>Billing</strong> page in one click — no phone call or retention conversation required.
                </p>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#1F1F1F]">Cancellation</h3>
                <p className="leading-relaxed text-[#333333]">
                    You may cancel your subscription at any time from your account settings (<strong>Settings → Billing → Manage Subscription</strong>). To avoid being charged for the next billing period, cancel at least 24 hours before your renewal date. After you cancel, you continue to enjoy Premium features until the end of your current billing period; no further charges will be made.
                </p>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#1F1F1F]">No Refunds (Except as Stated in Our Refund Policy)</h3>
                <p className="leading-relaxed text-[#333333]">
                    All charges for Premium subscriptions are non-refundable, and there are no refunds or credits for partially used periods, except in the specific cases described in our <a href="/refund-policy" className="text-[#C85A72] underline">Refund Policy</a> (technical errors, extended service outage, or accidental upgrades within 24 hours) or as required by applicable law.
                </p>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#1F1F1F]">Price Changes</h3>
                <p className="leading-relaxed text-[#333333]">
                    We may change Premium plan prices from time to time. If we do, we will notify you by email at least <strong>15 days before</strong> the new price takes effect for your next renewal, giving you a full opportunity to cancel before the new price is charged. Continuing your subscription past the notice period means you accept the new price.
                </p>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#1F1F1F]">Payment Method</h3>
                <p className="leading-relaxed text-[#333333]">
                    We accept major credit and debit cards. Payments are processed by our third-party payment processor; Marryzen does not store full card numbers on our own servers. If your payment fails (expired card, insufficient funds, etc.), we will email you and attempt to retry the charge over the following days before pausing your subscription.
                </p>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#1F1F1F]">Questions</h3>
                <p className="leading-relaxed text-[#333333]">
                    Email <a href="mailto:admin@marryzen.com" className="text-[#C85A72] underline">admin@marryzen.com</a> with any billing question. We respond within 1–2 business days.
                </p>
            </div>

        </div>
        <Footer />
      </div>
    </div>
  );
};

export default BillingTerms;
