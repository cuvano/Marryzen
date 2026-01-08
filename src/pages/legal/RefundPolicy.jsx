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
            <p className="text-[#706B67] font-medium">Effective Date: November 30, 2025</p>
        </div>

        {/* Content */}
        <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-2xl p-8 md:p-12 shadow-sm space-y-8">
            
            <div className="p-6 rounded-2xl bg-[#FAF7F2] border border-[#E6DCD2]">
                <h2 className="text-xl font-bold text-[#1F1F1F] mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-[#E6B450]" /> 1. General Policy
                </h2>
                <p className="text-[#333333] leading-relaxed">
                    At Marryzen ("the Platform operated by the Company"), we strive to ensure customer satisfaction. 
                    However, because our services (Premium Memberships) are digital goods that are consumed immediately upon activation, 
                    we generally maintain a strict refund policy. By subscribing, you acknowledge that you lose your right of withdrawal 
                    once the digital content delivery has begun.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl border border-green-200 bg-green-50">
                    <h2 className="text-lg font-bold text-[#15803D] mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" /> 2. When Refunds Are Granted
                    </h2>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-[#333333]">
                        <li><strong>Technical Error:</strong> If you were charged multiple times for the same billing period due to a technical glitch.</li>
                        <li><strong>Service unavailability:</strong> If the Marryzen platform was completely inaccessible for more than 48 consecutive hours.</li>
                        <li><strong>Accidental Upgrade:</strong> If you request a refund within 24 hours of the initial upgrade and have not used any premium features (e.g., sent messages, viewed unlocked photos).</li>
                    </ul>
                </div>

                <div className="p-6 rounded-2xl border border-red-200 bg-red-50">
                    <h2 className="text-lg font-bold text-[#B91C1C] mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" /> 3. When Refunds Are NOT Granted
                    </h2>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-[#333333]">
                        <li><strong>Change of Mind:</strong> You decided you no longer want to use the service after 24 hours.</li>
                        <li><strong>Lack of Matches:</strong> You are dissatisfied with the quantity or quality of matches. We guarantee functionality, not marriage outcomes.</li>
                        <li><strong>Account Ban:</strong> If your account is terminated for violating our Community Standards (e.g., harassment, scamming, solicitation), you forfeit all remaining subscription time and are not eligible for a refund.</li>
                        <li><strong>Forgetting to Cancel:</strong> If you fail to cancel a recurring subscription before the renewal date.</li>
                    </ul>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-bold text-[#1F1F1F]">4. Cancellation Policy</h2>
                <p className="leading-relaxed text-[#333333]">
                    You may cancel your subscription at any time. Cancellation stops future billing but does not refund the current billing period.
                    You will continue to have access to Premium features until the end of your current billing cycle.
                </p>
                <h3 className="font-semibold text-[#1F1F1F] mt-4 mb-2">How to Cancel:</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-[#333333]">
                    <li><strong>Web:</strong> Go to Settings &gt; Billing &gt; Manage Subscription.</li>
                    <li><strong>iOS:</strong> Go to iPhone Settings &gt; Apple ID &gt; Subscriptions.</li>
                    <li><strong>Android:</strong> Go to Google Play Store &gt; My Subscriptions.</li>
                </ul>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-bold text-[#1F1F1F]">5. Third-Party Payment Processors</h2>
                <p className="leading-relaxed text-[#333333]">
                    If you purchased your subscription via the Apple App Store or Google Play Store, Marryzen does not have the ability to process refunds directly.
                    You must contact Apple or Google support directly to request a refund, subject to their respective policies.
                </p>
            </div>

             <div className="mt-8 pt-8 border-t border-[#E6DCD2] text-center">
                <h2 className="text-lg font-bold text-[#1F1F1F] mb-2">Need Assistance?</h2>
                <p className="text-sm text-[#706B67] mb-4">
                    If you believe you are eligible for a refund under Section 2, please contact our support team.
                </p>
                <Button className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-bold">
                    <Mail className="w-4 h-4 mr-2" /> Contact Support: support@marryzen.com
                </Button>
            </div>

        </div>
        <Footer />
      </div>
    </div>
  );
};

export default RefundPolicy;