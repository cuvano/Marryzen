import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart, ShieldCheck, Home, LayoutDashboard, Camera, MessageCircle, Lock, Flag, Gavel, Mail } from 'lucide-react';
import Footer from '@/components/Footer';

import { Helmet } from 'react-helmet';
const CommunityGuidelines = () => {
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem('userProfile');

  return (
    <div className="min-h-screen p-4 md:p-8 pb-20 bg-[#FAF7F2] text-[#333333]">
      <Helmet><title>Community Guidelines â€” Marryzen</title></Helmet>
      <div className="max-w-4xl mx-auto">
         {/* Navigation Buttons */}
        <div className="flex justify-between items-center mb-8">
             <Button variant="ghost" onClick={() => navigate(-1)} className="text-brand-muted hover:text-[#1F1F1F] hover:bg-[#E6DCD2]/50 pl-0 font-medium">
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
            <h1 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-2">Community Guidelines</h1>
            <p className="text-brand-muted font-medium">Marryzen is built on Respect, Honesty, and Intent.</p>
            <p className="text-xs text-brand-muted mt-2">Version 2.0 &bull; Last updated June 6, 2026</p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-2xl p-8 md:p-12 shadow-sm space-y-10">

            {/* Core Pledge */}
            <div className="p-6 bg-[#F9E7EB] rounded-xl border border-[#E6B450]/20">
                <div className="flex items-center gap-3 mb-2">
                    <Heart className="text-brand-pink-strong w-6 h-6" />
                    <h2 className="text-xl font-bold text-[#1F1F1F]">Our Core Pledge</h2>
                </div>
                <p className="text-[#333333]">
                    Every member of Marryzen is here for one reason: to find a spouse. We expect every interaction to be dignified, polite, and conducted with serious intent. These guidelines describe the standards every member commits to when they join. Reading them is part of joining; following them is part of staying.
                </p>
            </div>

            {/* Do */}
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#1F1F1F]">&#9989; Do</h3>
                <ul className="list-disc pl-5 space-y-2 text-[#333333]">
                    <li><strong>Be honest about who you are.</strong> Your age, height, marital history, children, occupation, education, and city should match reality. Identity verification is required and we check.</li>
                    <li><strong>Be honest about your faith.</strong> If you say you&apos;re practicing, practice. If you&apos;re learning, say &ldquo;learning.&rdquo; Misrepresenting religious commitment to attract a partner is dishonest and grounds for removal.</li>
                    <li><strong>Be respectful.</strong> Treat every match with kindness, even if they aren&apos;t the right fit. A short, polite &ldquo;no, but I wish you well&rdquo; is always acceptable.</li>
                    <li><strong>Be clear about intent.</strong> Communicate your relationship timeline and family expectations early. Wasting time is unkind.</li>
                    <li><strong>Be patient.</strong> Real introductions take time. Don&apos;t rush, don&apos;t pressure, don&apos;t ghost.</li>
                    <li><strong>Report concerns.</strong> Help us keep the community safe by reporting suspicious or harmful behavior. Anonymous reports are welcome &mdash; see &sect;4.</li>
                </ul>
            </div>

            {/* Do Not */}
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#1F1F1F]">&#10060; Do Not</h3>
                <ul className="list-disc pl-5 space-y-2 text-[#333333]">
                    <li><strong>Harass or bully.</strong> Zero tolerance for abusive language, slurs, repeated unwanted contact after a clear &ldquo;no,&rdquo; or threats of any kind.</li>
                    <li><strong>Solicit money.</strong> Never ask for financial assistance, send investment opportunities, promote businesses, or recruit for MLMs. Romance scams are a permanent ban.</li>
                    <li><strong>Seek hookups or casual encounters.</strong> Marryzen is not a casual dating platform. Sexual advances, suggestive messaging, and requests for explicit content are immediate grounds for removal.</li>
                    <li><strong>Impersonate.</strong> Catfishing &mdash; using someone else&apos;s photos or identity &mdash; is a permanent ban and may be reported to authorities.</li>
                    <li><strong>Lie about marital status.</strong> Listing yourself as &ldquo;never married&rdquo; when separated/divorced, or &ldquo;divorced&rdquo; when still legally married, is grounds for removal.</li>
                    <li><strong>Discriminate.</strong> Harassment based on race, ethnicity, national origin, disability, or other protected characteristics has no place here. Stating preferences is fine; demeaning others is not.</li>
                    <li><strong>Share members&apos; private information.</strong> Do not screenshot, forward, or post any other member&apos;s photos, messages, or profile details outside Marryzen.</li>
                    <li><strong>Use Marryzen for political or commercial campaigns.</strong> This is a platform for marriage, not a soapbox or a sales channel.</li>
                </ul>
            </div>

            {/* Photo Standards */}
            <div className="space-y-4 pt-6 border-t border-[#E6DCD2]">
                <h3 className="text-xl font-bold text-[#1F1F1F] flex items-center gap-2">
                    <Camera className="text-[#E6B450] w-5 h-5" /> 1. Photo Standards
                </h3>
                <p className="text-[#333333]">Photos build trust before words do. Every profile photo must meet the standards below. Photos that fail are removed automatically or by moderators; repeat violations affect account standing.</p>
                <ul className="list-disc pl-5 space-y-2 text-[#333333]">
                    <li><strong>Be visible.</strong> Your face must be clearly visible in your primary photo. No sunglasses, masks, or heavy filters that obscure your features.</li>
                    <li><strong>Be alone.</strong> Group photos are fine as secondary photos, but your primary photo must be of you alone so matches know who they&apos;re talking to.</li>
                    <li><strong>Be recent.</strong> Photos should be from the last 18 months and reflect your current appearance.</li>
                    <li><strong>Be modest.</strong> No nudity, no semi-nudity, no swimwear-as-primary-photo, no overtly suggestive poses. Faith-first matchmaking calls for modest presentation.</li>
                    <li><strong>Be you.</strong> No celebrities, no AI-generated faces, no model agency headshots, no photos of children as primary (a single family photo as a secondary is fine).</li>
                    <li><strong>No screenshots, no contact info.</strong> Phone numbers, social handles, or messaging IDs embedded in photos will be removed.</li>
                </ul>
            </div>

            {/* Communication Standards */}
            <div className="space-y-4 pt-6 border-t border-[#E6DCD2]">
                <h3 className="text-xl font-bold text-[#1F1F1F] flex items-center gap-2">
                    <MessageCircle className="text-brand-pink-strong w-5 h-5" /> 2. Communication Standards
                </h3>
                <p className="text-[#333333]">Disagreement is allowed. Disrespect is not. Use the line below as your guide.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-[#F0F9F0] border border-green-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-green-900 mb-2">Respectful disagreement (OK)</p>
                        <ul className="list-disc pl-5 text-sm text-[#333333] space-y-1">
                            <li>&ldquo;I&apos;m looking for someone more practicing, but I appreciate you reaching out.&rdquo;</li>
                            <li>&ldquo;Our family expectations don&apos;t match &mdash; I wish you the best.&rdquo;</li>
                            <li>&ldquo;I&apos;d rather not continue. Take care.&rdquo;</li>
                        </ul>
                    </div>
                    <div className="bg-[#FCE7E7] border border-red-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-red-900 mb-2">Harassment (not OK)</p>
                        <ul className="list-disc pl-5 text-sm text-[#333333] space-y-1">
                            <li>Repeated messages after a clear &ldquo;no.&rdquo;</li>
                            <li>Insulting someone&apos;s faith, culture, family, body, or income.</li>
                            <li>Aggressive demands for contact info, photos, or video calls.</li>
                        </ul>
                    </div>
                </div>
                <p className="text-sm text-brand-muted">If a match doesn&apos;t respond, don&apos;t follow up more than once. Silence is an answer.</p>
            </div>

            {/* Privacy */}
            <div className="space-y-4 pt-6 border-t border-[#E6DCD2]">
                <h3 className="text-xl font-bold text-[#1F1F1F] flex items-center gap-2">
                    <Lock className="text-brand-muted w-5 h-5" /> 3. Privacy of Other Members
                </h3>
                <p className="text-[#333333]">Everything other members share with you on Marryzen is private and stays on Marryzen.</p>
                <ul className="list-disc pl-5 space-y-2 text-[#333333]">
                    <li>Do not screenshot profiles, photos, or conversations.</li>
                    <li>Do not share another member&apos;s name, photo, or details with friends, family, or on social media.</li>
                    <li>Do not reverse-image-search or otherwise dig into someone&apos;s identity without their consent.</li>
                    <li>Do not contact members off-platform until you have a mutual agreement to do so.</li>
                </ul>
                <p className="text-sm text-brand-muted">For details on how Marryzen handles your data, see our <a href="/privacy-policy" className="text-brand-pink-strong underline">Privacy Policy</a>.</p>
            </div>

            {/* Reporting & Safety */}
            <div className="space-y-4 pt-6 border-t border-[#E6DCD2]">
                <h3 className="text-xl font-bold text-[#1F1F1F] flex items-center gap-2">
                    <Flag className="text-[#E6B450] w-5 h-5" /> 4. Reporting &amp; Safety
                </h3>
                <p className="text-[#333333]">If someone violates these guidelines, report them. Reports are reviewed by our team and acted on quickly.</p>
                <div className="bg-[#FFF8E1] border border-[#E6B450]/30 rounded-lg p-4">
                    <p className="text-sm font-semibold text-[#1F1F1F] mb-2">How to report</p>
                    <ul className="list-disc pl-5 text-sm text-[#333333] space-y-1">
                        <li>Tap the &ldquo;Report&rdquo; or &ldquo;Block&rdquo; button on the member&apos;s profile or in your chat.</li>
                        <li>Tell us briefly what happened &mdash; the more specific, the faster we can act.</li>
                        <li>You can also email <a href="mailto:admin@marryzen.com" className="text-brand-pink-strong underline">admin@marryzen.com</a> with details and screenshots.</li>
                    </ul>
                </div>
                <p className="text-sm text-brand-muted">Reports are confidential. The person you report will not see who reported them. False reports submitted in bad faith may themselves be a violation.</p>
                <p className="text-sm text-brand-muted"><strong>If you are in immediate danger</strong> &mdash; physical threat, blackmail, exploitation of a minor &mdash; contact your local emergency services first. Then notify us so we can preserve evidence and remove the account.</p>
            </div>

            {/* Enforcement & Appeals */}
            <div className="space-y-4 pt-6 border-t border-[#E6DCD2]">
                <h3 className="text-xl font-bold text-[#1F1F1F] flex items-center gap-2">
                    <Gavel className="text-[#1F1F1F] w-5 h-5" /> 5. Enforcement &amp; Appeals
                </h3>
                <p className="text-[#333333]">When we find a violation, the response is proportionate to the harm:</p>
                <ul className="list-disc pl-5 space-y-2 text-[#333333]">
                    <li><strong>Warning.</strong> First-time minor violations (e.g., a single tone-policed message) receive a written warning and the offending content is removed.</li>
                    <li><strong>Temporary suspension.</strong> Repeat violations or moderate-severity issues (e.g., off-platform contact pressure) result in 7&ndash;30 day suspensions.</li>
                    <li><strong>Permanent ban.</strong> Severe violations &mdash; harassment, scams, catfishing, sexual content requests, threats &mdash; result in immediate permanent removal. Banned accounts are not reinstated.</li>
                </ul>
                <p className="text-[#333333]"><strong>Appeals.</strong> If you believe your account was removed or restricted in error, email <a href="mailto:admin@marryzen.com" className="text-brand-pink-strong underline">admin@marryzen.com</a> with your registered email address and a brief explanation. We review every appeal personally and respond within 5 business days. Decisions on appeals are final.</p>
            </div>

            {/* Contact */}
            <div className="space-y-4 pt-6 border-t border-[#E6DCD2]">
                <h3 className="text-xl font-bold text-[#1F1F1F] flex items-center gap-2">
                    <Mail className="text-brand-pink-strong w-5 h-5" /> 6. Contact
                </h3>
                <p className="text-[#333333]">Questions, safety concerns, suggestions: <a href="mailto:admin@marryzen.com" className="text-brand-pink-strong underline">admin@marryzen.com</a>.</p>
                <p className="text-sm text-brand-muted">Marryzen is operated by CUVAN LLC (Florida, USA). For data protection inquiries from EU/UK residents, our Article 27 representative is Prighter Group GmbH (Vienna, Austria) &mdash; contact details are in our <a href="/privacy-policy" className="text-brand-pink-strong underline">Privacy Policy</a>.</p>
            </div>

            {/* Closing */}
            <div className="pt-6 border-t border-[#E6DCD2]">
                <div className="flex items-start gap-3">
                    <ShieldCheck className="text-[#E6B450] w-5 h-5 mt-0.5 shrink-0" />
                    <p className="text-sm text-brand-muted">
                        These guidelines exist because what you share here matters and what you do here matters. We will keep updating them as the community grows. Members will be notified when material changes take effect.
                    </p>
                </div>
            </div>

        </div>
        <Footer />
      </div>
    </div>
  );
};

export default CommunityGuidelines;
