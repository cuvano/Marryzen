import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CreditCard, CheckCircle2, AlertCircle, Mail, Home, LayoutDashboard } from 'lucide-react';
import Footer from '@/components/Footer';

const RefundPolicy = () => {
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

        {/* Header */}
        <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-2">Refund Policy</h1>
            <p className="text-[#706B67] font-medium">Effective Date: June 3, 2026</p>
        </div>

        {/* Content */}
        <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-2xl p-8 md:p-12 shadow-sm space-y-8">

            <div className="p-6 rounded-2xl bg-[#FAF7F2] border border-[#E6DCD2]">
                <h2 className="text-xl font-bold text-[#1F1F1F] mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-[#E6B450]" /> 1. General Policy
                </h2>
                <p className="text-[#333333] leading-relaxed">
                    At Marryzen, we strive for customer satisfaction. Because Premium memberships are digital services that are delivered immediately upon activation, our default policy is non-refundable. Section 2 below lists the specific situations where we will issue a refund. If you are in the EU/EEA, your statutory right of withdrawal also applies in accordance with applicable law.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl border border-green-200 bg-green-50">
                    <h2 className="text-lg font-bold text-[#15803D] mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" /> 2. When Refunds Are Granted
                    </h2>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-[#333333]">
                        <li><strong>Technical Error:</strong> You were charged more than once for the same billing period due to a system glitch.</li>
                        <li><strong>Service Outage:</strong> Marryzen was completely inaccessible for more than 48 consecutive hours during a paid period.</li>
                        <li><strong>Accidental Upgrade:</strong> You request a refund within 24 hours of the initial upgrade <em>and</em> have not used any premium features (no premium messages sent, no "who liked you" view, no filters applied beyond the free tier).</li>
                        <li><strong>Statutory Right:</strong> Any refund required by your local consumer-protection law.</li>
                    </ul>
                </div>

                <div className="p-6 rounded-2xl border border-red-200 bg-red-50">
                    <h2 className="text-lg font-bold text-[#B91C1C] mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" /> 3. When Refunds Are NOT Granted
                    </h2>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-[#333333]">
                        <li><strong>Change of Mind:</strong> You decided you no longer want to use the service after the 24-hour window.</li>
                        <li><strong>Lack of Matches:</strong> You are dissatisfied with the quantity or quality of matches. We guarantee functionality, not marriage outcomes.</li>
                        <li><strong>Account Ban:</strong> Your account is terminated for violating our Community Standards (e.g., harassment, scamming, solicitation). You forfeit remaining subscription time and are not eligible for a refund.</li>
                        <li><strong>Forgot to Cancel:</strong> You did not cancel before the renewal date despite the 7-day and 24-hour reminder emails we send.</li>
                    </ul>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-bold text-[#1F1F1F]">4. Cancellation Stops Future Billing</h2>
                <p className="leading-relaxed text-[#333333]">
                    You may cancel your subscription at any time. Cancellation stops <strong>future</strong> billing but does not refund the current billing period. You continue to have access to Premium features until the end of your current billing cycle, then revert to the free tier with no further charges.
                </p>
                <h3 className="font-semibold text-[#1F1F1F] mt-4 mb-2">How to Cancel:</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-[#333333]">
                    <li>Sign in to Marryzen on the web.</li>
                    <li>Go to <strong>Settings → Billing → Manage Subscription</strong>.</li>
                    <li>Click <strong>Cancel</strong>. One click. No phone call or retention conversation required.</li>
                </ul>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-bold text-[#1F1F1F]">5. How to Request a Refund</h2>
                <p className="leading-relaxed text-[#333333]">
                    If you believe you qualify under Section 2, email <a href="mailto:support@marryzen.com" className="text-[#C85A72] underline">support@marryzen.com</a> within <strong>14 days</strong> of the charge with: your account email, the date and amount of the charge, and a brief explanation. We respond within 1–2 business days. Approved refunds are returned to the original payment method within 5–10 business days of approval.
                </p>
            </div>

             <div className="mt-8 pt-8 border-t border-[#E6DCD2] text-center">
                <h2 className="text-lg font-bold text-[#1F1F1F] mb-2">Need Assistance?</h2>
                <p className="text-sm text-[#706B67] mb-4">
                    If you believe you are eligible for a refund under Section 2, contact our support team.
                </p>
                <a href="mailto:support@marryzen.com" className="inline-block">
                  <Button className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-bold">
                      <Mail className="w-4 h-4 mr-2" /> Contact Support: support@marryzen.com
                  </Button>
                </a>
            </div>

        </div>
        <Footer />
      </div>
    </div>
  );
};

export default RefundPolicy;
