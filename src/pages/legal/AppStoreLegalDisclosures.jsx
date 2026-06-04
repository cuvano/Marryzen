import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Smartphone, ShieldCheck, AlertTriangle, Scale, Info } from 'lucide-react';

const AppStoreLegalDisclosures = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-4 md:p-8 pb-20 bg-slate-950">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
            <Button variant="ghost" onClick={() => navigate(-1)} className="text-white/70 hover:text-white hover:bg-white/10 mb-4 pl-0">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">App Store Legal Disclosures – Marryzen</h1>
            <p className="text-white/60">Document Version: 2.0 • Last Updated: June 3, 2026</p>
        </div>

        {/* Status banner — current reality */}
        <div className="mb-8 bg-amber-900/30 border border-amber-700 rounded-2xl p-6 flex items-start gap-4">
            <Info className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
            <div className="text-amber-100">
                <h2 className="font-bold text-amber-200 mb-1">Current Status: Web Platform Only</h2>
                <p className="text-sm leading-relaxed">
                    Marryzen is currently a web platform accessed at <strong>www.marryzen.com</strong>. Native iOS and Google Play apps are planned for a future release. The disclosures below describe the policies that will apply <strong>once mobile apps are published</strong>. They are documented here in advance for the benefit of our future app-store reviewers and any users who arrive expecting an app. The policies do not currently apply to billing on the web.
                </p>
            </div>
        </div>

        {/* Content */}
        <div className="space-y-8 text-white/80 leading-relaxed">

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <Smartphone className="w-6 h-6 text-blue-400" />
                    <h2 className="text-xl font-bold text-white">1. Platform Purpose &amp; Classification</h2>
                </div>
                <p className="mb-4">
                    <strong>App Name:</strong> Marryzen<br/>
                    <strong>Category:</strong> Lifestyle / Social Networking<br/>
                    <strong>Primary Function:</strong> Marriage Matching Service
                </p>
                <p>
                    Marryzen is explicitly marketed and designed as a service for serious relationship seekers intending to marry. It is NOT a casual dating app, "hookup" app, or adult entertainment platform. All marketing assets and metadata reflect this positioning.
                </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" /> 2. Age Requirement &amp; Content Rating
                </h2>
                <p>
                    <strong>Minimum Age (planned):</strong> 17+ (Apple App Store) / PEGI 18 (Google Play Store)<br/>
                    <strong>Justification:</strong> While our content is strictly non-sexual, the platform facilitates meetings between adults for the purpose of marriage. Interaction with strangers carries inherent risks unsuitable for minors.
                    <br/><br/>
                    Strict 18+ age gating is currently enforced on the web during onboarding via Date of Birth selection and third-party ID verification.
                </p>
            </div>

             <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Scale className="w-5 h-5 text-purple-400" /> 3. Premium &amp; Subscriptions
                </h2>
                <p className="mb-4 text-sm italic opacity-80">
                    <strong>Today (web):</strong> Premium subscriptions are billed on the web via our payment processor in US Dollars. See the <a href="/billing-terms" className="text-amber-300 underline">Billing Terms</a> and <a href="/refund-policy" className="text-amber-300 underline">Refund Policy</a> for the policies that apply now.
                </p>
                <p className="mb-2"><strong>When mobile apps launch:</strong> Auto-renewable subscriptions purchased inside an iOS or Android app will follow the app-store rules below.</p>
                <ul className="list-disc pl-5 space-y-1 text-sm mb-4">
                    <li><strong>Payment:</strong> Charged to iTunes / Google Play Account at confirmation of purchase.</li>
                    <li><strong>Renewal:</strong> Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period.</li>
                    <li><strong>Management:</strong> Subscriptions managed in the user's App Store / Google Play account settings after purchase.</li>
                </ul>
                <p className="text-xs italic opacity-70">
                    Full details for web subscriptions are in our <a href="/terms" className="text-amber-300 underline">Terms of Service</a> and <a href="/billing-terms" className="text-amber-300 underline">Billing Terms</a>.
                </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                 <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-green-400" /> 4. User Safety &amp; Moderation (UGC)
                </h2>
                <p className="mb-4">
                    Marryzen includes User Generated Content (UGC). To meet App Store guidelines (when mobile apps publish) and our own standards (today on web), we implement:
                </p>
                 <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li><strong>EULA Agreement:</strong> Users must agree to Terms requiring respectful behavior and prohibiting objectionable content.</li>
                    <li><strong>Reporting Mechanism:</strong> Users can flag or block any member from any profile or chat surface. Reports route to <strong>admin@marryzen.com</strong> via our notify-admin-report pipeline and are reviewed in the admin Reports queue.</li>
                    <li><strong>Moderation:</strong> AI moderation on photos (NSFW + CSAM detection) and text (scam-pattern filter) runs at upload and message-send time. Human moderation triages flagged accounts.</li>
                    <li><strong>Verification:</strong> All members complete government-ID verification, selfie + liveness, and face-match before they can browse, like, or message.</li>
                    <li><strong>Removal:</strong> Users who violate standards are warned, suspended, or permanently banned. Repeat offenders are blocked from re-registering by device and identity signals.</li>
                </ul>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-4">5. Liability Disclaimer</h2>
                <p>
                    Marryzen is not responsible for the conduct of any user on or off of the Service. You agree to use caution in all interactions with other users, particularly if you decide to communicate off the Service or meet in person. Marryzen does not conduct criminal background checks on its users (third-party ID verification is used for identity confirmation only).
                </p>
            </div>

        </div>
      </div>
    </div>
  );
};

export default AppStoreLegalDisclosures;
