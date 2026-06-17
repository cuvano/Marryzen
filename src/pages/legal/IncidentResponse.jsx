import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, LayoutDashboard, ShieldAlert, Mail, ExternalLink, Clock, Lock, Users } from 'lucide-react';
import Footer from '@/components/Footer';
import { Helmet } from 'react-helmet';

/**
 * IncidentResponse — public Trust & Safety incident response page.
 *
 * Purpose: pre-launch insurance against the worst-case PR scenario in the
 * first weeks (a founding-500 member has an off-platform issue with another
 * member and posts about it). T&S board sign-off 2026-06-15 named this the
 * single most important comms surface to ship before invite #1.
 *
 * Route: /trust/incident (wired in App.jsx)
 * Contact: safety@marryzen.com (Hostinger alias forwards to admin@marryzen.com)
 * SLA: 24h acknowledgment, 72h initial assessment, 7d resolution communication
 */
const IncidentResponse = () => {
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem('userProfile');

  return (
    <div className="min-h-screen p-4 md:p-8 pb-20 bg-[#FAF7F2] text-[#333333]">
      <Helmet>
        <title>Trust & Safety — Report an Incident — Marryzen</title>
        <meta name="description" content="If something has happened on or through Marryzen that needs our attention, this is the fastest path to a human review." />
        <link rel="canonical" href="https://www.marryzen.com/trust/incident" />
      </Helmet>

      <div className="max-w-3xl mx-auto">
        {/* Navigation */}
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

        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#F9E7EB] mb-4">
            <ShieldAlert className="w-7 h-7 text-brand-pink-strong" aria-hidden="true" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-3">Report an Incident</h1>
          <p className="text-brand-muted leading-relaxed">
            If something has happened on or through Marryzen that needs our attention &mdash; harassment, a fraudulent profile, a safety concern, a data question, or anything else &mdash; this is the fastest path to a human review.
          </p>
        </div>

        {/* The primary contact card */}
        <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-2xl shadow-sm p-6 md:p-8 mb-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 rounded-full bg-[#FDF6E8] flex items-center justify-center">
              <Mail className="w-6 h-6 text-brand-gold" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[#1F1F1F] mb-2">Write to us at <a href="mailto:safety@marryzen.com" className="text-brand-pink-strong font-bold underline hover:no-underline">safety@marryzen.com</a></h2>
              <p className="text-brand-muted leading-relaxed mb-4">
                One inbox. A real person reads it. Include as much detail as you&rsquo;re comfortable sharing &mdash; what happened, when, the profile name or URL if relevant, any screenshots. If you&rsquo;re reporting on behalf of someone else, please say so.
              </p>
              <p className="text-sm text-brand-muted">
                Already inside Marryzen? You can also use the <strong className="text-[#333333]">Report</strong> button on any profile or message. Reports route to the same human review queue.
              </p>
            </div>
          </div>
        </div>

        {/* What happens after you report */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[#1F1F1F] mb-4">What happens after you report</h2>
          <div className="space-y-4">
            <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-xl p-5 flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-[#FDF6E8] flex items-center justify-center">
                <Clock className="w-5 h-5 text-brand-gold" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-bold text-[#1F1F1F] mb-1">Within 24 hours &mdash; Acknowledgment</h3>
                <p className="text-brand-muted leading-relaxed text-sm">You receive a written acknowledgment from a human at Marryzen confirming we&rsquo;ve received your report and assigned it a case reference.</p>
              </div>
            </div>
            <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-xl p-5 flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-[#FDF6E8] flex items-center justify-center">
                <Users className="w-5 h-5 text-brand-gold" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-bold text-[#1F1F1F] mb-1">Within 72 hours &mdash; Initial assessment</h3>
                <p className="text-brand-muted leading-relaxed text-sm">We review the facts available to us. If immediate protective action is warranted &mdash; suspending the other account, removing content, escalating &mdash; we take it in this window and let you know.</p>
              </div>
            </div>
            <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-xl p-5 flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-[#FDF6E8] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-brand-gold" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-bold text-[#1F1F1F] mb-1">Within 7 days &mdash; Resolution communication</h3>
                <p className="text-brand-muted leading-relaxed text-sm">You receive a written update on what we found, what we did, and what (if anything) you can expect from us going forward. If the matter is complex and needs longer, we&rsquo;ll tell you and give a revised timeline.</p>
              </div>
            </div>
          </div>
        </div>

        {/* What we can and cannot do */}
        <div className="bg-[#FAF7F2] border border-[#E6DCD2] rounded-2xl p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">Honest scope &mdash; what we can and can&rsquo;t do</h2>
          <div className="space-y-3 text-brand-muted leading-relaxed">
            <p>
              <strong className="text-[#333333]">We can:</strong> review reports against another Marryzen member, take protective action inside the platform (suspend, ban, remove content), preserve evidence if law enforcement asks for it under proper legal process, refund Premium fees within our <a href="/refund-policy" className="text-brand-pink-strong font-bold underline hover:no-underline">Refund Policy</a> if the incident affects your ability to use the service safely, and connect you with our independent EU/UK data protection representative if your concern is about your personal data.
            </p>
            <p>
              <strong className="text-[#333333]">We can&rsquo;t:</strong> investigate things that happened entirely off-platform without any Marryzen connection, override the legal process if a court orders disclosure, provide medical or psychological support (we&rsquo;ll point you to professional resources where helpful), or act as a substitute for emergency services. <strong className="text-[#333333]">If you are in immediate danger, call your local emergency number first. We are not a substitute for 911 / 999 / 112.</strong>
            </p>
          </div>
        </div>

        {/* Data-protection-specific channel */}
        <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-2xl shadow-sm p-6 md:p-8 mb-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 rounded-full bg-[#F9E7EB] flex items-center justify-center">
              <Lock className="w-6 h-6 text-brand-pink-strong" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[#1F1F1F] mb-2">Reporting a data protection concern</h2>
              <p className="text-brand-muted leading-relaxed mb-3">
                If your concern is specifically about how your personal data has been handled &mdash; access, deletion, correction, or a suspected breach &mdash; the fastest route is our Trust Center, which is operated by our independent Article&nbsp;27 representative:
              </p>
              <p className="mb-3">
                <a
                  href="https://app.prighter.com/portal/marryzen"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-brand-pink-strong font-bold underline hover:no-underline"
                >
                  Open the Marryzen Trust Center <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </a>
              </p>
              <p className="text-sm text-brand-muted">
                The Trust Center is the supervisory-authority-aligned channel for GDPR / UK GDPR data subject requests and breach inquiries. You can also write to <a href="mailto:safety@marryzen.com" className="text-brand-pink-strong font-bold underline hover:no-underline">safety@marryzen.com</a> and we&rsquo;ll route it appropriately.
              </p>
            </div>
          </div>
        </div>

        {/* Anti-retaliation + good-faith */}
        <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-2xl shadow-sm p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1F1F1F] mb-3">No retaliation. Good-faith reports protected.</h2>
          <p className="text-brand-muted leading-relaxed">
            Filing a report in good faith never counts against your account, your match standing, or your Premium benefits. We don&rsquo;t share your identity with the reported party unless we&rsquo;re legally required to. If a report turns out to be wrong but was made in good faith, that&rsquo;s fine &mdash; we&rsquo;d rather see one too many than one too few.
          </p>
        </div>

        {/* Related */}
        <div className="text-brand-muted text-sm space-y-2 pt-2">
          <p>Related: <a href="/community-guidelines" className="text-brand-pink-strong font-bold hover:underline">Community Guidelines</a> &middot; <a href="/safety" className="text-brand-pink-strong font-bold hover:underline">Safety Disclaimer</a> &middot; <a href="/privacy" className="text-brand-pink-strong font-bold hover:underline">Privacy Policy</a></p>
          <p>For everything else: <a href="mailto:admin@marryzen.com" className="text-brand-pink-strong font-bold hover:underline">admin@marryzen.com</a></p>
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default IncidentResponse;
