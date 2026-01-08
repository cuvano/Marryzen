import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Smartphone, ShieldCheck, AlertTriangle, Scale } from 'lucide-react';
import { adminStore } from '@/lib/admin-store';

const AppStoreLegalDisclosures = () => {
  const navigate = useNavigate();
  
  // Check admin access (optional, but good practice if this is mainly for internal review before submission)
  // For now, we allow viewing via direct link or admin panel
  
  return (
    <div className="min-h-screen p-4 md:p-8 pb-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
            <Button variant="ghost" onClick={() => navigate(-1)} className="text-white/70 hover:text-white hover:bg-white/10 mb-4 pl-0">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">App Store Legal Disclosures – Marryzen</h1>
            <p className="text-white/60">Document Version: 1.0 • Last Updated: November 30, 2025</p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-white/80 leading-relaxed">
            
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <Smartphone className="w-6 h-6 text-blue-400" />
                    <h2 className="text-xl font-bold text-white">1. Platform Purpose & Classification</h2>
                </div>
                <p className="mb-4">
                    <strong>App Name:</strong> Marryzen<br/>
                    <strong>Category:</strong> Lifestyle / Social Networking<br/>
                    <strong>Primary Function:</strong> Marriage Matching Service
                </p>
                <p>
                    Marryzen is explicitly marketed and designed as a service for serious relationship seekers intending to marry. 
                    It is NOT a casual dating app, "hookup" app, or adult entertainment platform. 
                    All marketing assets and metadata reflect this positioning.
                </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" /> 2. Age Requirement & Content Rating
                </h2>
                <p>
                    <strong>Minimum Age:</strong> 17+ (Apple App Store) / PEGI 18 (Google Play Store)<br/>
                    <strong>Justification:</strong> While our content is strictly non-sexual, the platform facilitates meetings between adults for the purpose of marriage.
                    Interaction with strangers carries inherent risks unsuitable for minors.
                    <br/><br/>
                    Strict 18+ age gating is enforced during onboarding via Date of Birth selection and ID Verification checks.
                </p>
            </div>

             <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Scale className="w-5 h-5 text-purple-400" /> 3. Premium & Subscriptions
                </h2>
                <p className="mb-2"><strong>Subscription Model:</strong> Auto-renewable subscriptions.</p>
                <ul className="list-disc pl-5 space-y-1 text-sm mb-4">
                    <li><strong>Payment:</strong> Charged to iTunes/Google Play Account at confirmation of purchase.</li>
                    <li><strong>Renewal:</strong> Subscription automatically renews unless auto-renew is turned off at least 24-hours before the end of the current period.</li>
                    <li><strong>Management:</strong> Subscriptions may be managed by the user and auto-renewal may be turned off by going to the user's Account Settings after purchase.</li>
                </ul>
                <p className="text-xs italic opacity-70">
                    Full details are available in the Marryzen Terms of Service.
                </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                 <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-green-400" /> 4. User Safety & Moderation (UGC)
                </h2>
                <p className="mb-4">
                    Marryzen includes User Generated Content (UGC). To comply with App Store guidelines, we implement:
                </p>
                 <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li><strong>EULA Agreement:</strong> Users must agree to Terms requiring respectful behavior and no objectionable content.</li>
                    <li><strong>Reporting Mechanism:</strong> A method for filtering objectionable content and a mechanism for users to flag and block abusive users immediately (24/7 support response).</li>
                    <li><strong>Moderation:</strong> Proactive monitoring of text and images via AI filters and human moderators.</li>
                    <li><strong>Removal:</strong> Users who violate standards are ejected from the platform.</li>
                </ul>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-4">5. Liability Disclaimer</h2>
                <p>
                    The Company is not responsible for the conduct of any user on or off of the Service. 
                    You agree to use caution in all interactions with other users, particularly if you decide to communicate off the Service or meet in person. 
                    The Company does not conduct criminal background checks on its users (though ID verification is used for identity confirmation).
                </p>
            </div>

        </div>
      </div>
    </div>
  );
};

export default AppStoreLegalDisclosures;