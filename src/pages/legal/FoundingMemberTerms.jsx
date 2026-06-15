import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BadgeCheck, Calendar, CreditCard, Home, LayoutDashboard, ShieldCheck, X } from 'lucide-react';
import Footer from '@/components/Footer';

// ===========================================================================
// B15 — Promo T&Cs standalone page for the Founding-Member 500/2-month offer
// ===========================================================================
// Required content (from launch-blocker checklist + FTC negative-option +
// CA AB-390 guidance baked into Termly templates):
//
//   1. Free period + end date logic
//   2. Price after the free period
//   3. Billing frequency
//   4. Cancel mechanism (in-app, one click, no phone-tree)
//   5. The "Founding Member" cap (500 spots) + counting method
//   6. What happens at #501
//   7. Verified-only gate (T&S exec mandate — promo doesn't activate until
//      Didit verification is complete)
//   8. 50 msg/day soft cap for first 14 days (T&S exec mandate)
//   9. Founding Member permanent badge — what it grants + doesn't grant
//  10. Eligibility (no auto-rolling free-trial farming via multiple accounts)
//  11. Contact for questions: admin@marryzen.com
//
// This page is intentionally readable in 90 seconds. Anything longer is the
// general Billing Terms / Refund Policy / Terms of Service.
// ===========================================================================

const FoundingMemberTerms = () => {
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem('userProfile');

  return (
    <div className="min-h-screen p-4 md:p-8 pb-20 bg-[#FAF7F2] text-[#333333]">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <div className="flex justify-between items-center mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-brand-muted hover:text-[#1F1F1F] hover:bg-[#E6DCD2]/50 pl-0 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="border-[#E6DCD2] text-[#333333] hover:bg-[#FFFFFF]"
            >
              <Home className="w-4 h-4 mr-2" /> Home
            </Button>
            {isAuthenticated && (
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="border-[#E6DCD2] text-[#333333] hover:bg-[#FFFFFF]"
              >
                <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
              </Button>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-[#FFF3D1] border border-[#E6B450] text-[#7A5A1A] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-3">
            <BadgeCheck className="w-3 h-3" /> Founding Member Offer
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-2">
            Founding Member Terms & Conditions
          </h1>
          <p className="text-brand-muted font-medium">
            500 founding members · 2 months free Premium · Verified-only.
          </p>
          <p className="text-xs text-[#8A857D] mt-3">
            Effective: August 15, 2026 · Read time: under 2 minutes
          </p>
        </div>

        {/* Body */}
        <div className="bg-white border border-[#E6DCD2] rounded-2xl p-6 md:p-10 shadow-sm space-y-10">

          {/* 1. The offer in plain language */}
          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-[#1F1F1F] flex items-center gap-2">
              <BadgeCheck className="w-6 h-6 text-[#E6B450]" /> The offer in plain language
            </h2>
            <p>
              The first <strong>500 people</strong> who complete identity verification on Marryzen
              receive <strong>2 months of Marryzen Premium for free</strong>, after which their
              subscription automatically renews at the standard Premium price of
              <strong> $24.99 per month</strong> unless they cancel.
            </p>
            <p>
              You also receive a permanent <strong>&quot;Founding Member&quot;</strong> badge on your
              profile that stays with your account for as long as your account remains in good
              standing — even if you later cancel Premium.
            </p>
          </section>

          {/* 2. How to claim it */}
          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-[#1F1F1F] flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-[#E6B450]" /> How to claim it
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-[#333333]">
              <li>Create your Marryzen account and complete onboarding.</li>
              <li>Complete identity verification through Didit (ID + selfie + liveness).</li>
              <li>
                If you&apos;re among the first 500 verified members, your Founding Member status and
                free Premium activate automatically — no promo code required.
              </li>
            </ol>
            <div className="bg-[#FFF8EC] border border-[#E6B450]/40 rounded-xl p-4 text-sm">
              <p className="font-bold text-[#7A5A1A] mb-1">Important — verified-only.</p>
              <p className="text-[#5C4519]">
                The free Premium does not activate until your verification is approved. We do this
                to keep the community safe and to prevent abuse of the free-trial via fake or
                duplicate accounts.
              </p>
            </div>
          </section>

          {/* 3. The cap + counting */}
          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-[#1F1F1F] flex items-center gap-2">
              <BadgeCheck className="w-6 h-6 text-[#E6B450]" /> The 500-member cap
            </h2>
            <p>
              We will accept the first 500 members ordered by{' '}
              <strong>the timestamp at which identity verification is approved</strong> (not the
              signup timestamp). Members who sign up early but never complete verification do not
              hold a spot.
            </p>
            <p>
              A live public counter on our homepage shows how many founding-member spots remain.
              Once the counter reaches zero, the offer ends. Members who reach verification after
              the cap is filled receive a standard account at the regular Premium price.
            </p>
            <p className="text-sm text-brand-muted">
              <strong>What happens at #501:</strong> the offer simply closes. No partial
              free-period, no waitlist for a re-opening. Premium remains available at the standard
              $24.99/month price.
            </p>
          </section>

          {/* 4. The free period */}
          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-[#1F1F1F] flex items-center gap-2">
              <Calendar className="w-6 h-6 text-[#E6B450]" /> The 2-month free period
            </h2>
            <p>
              Your 2-month free Premium begins on the day your identity verification is approved
              and ends exactly 60 days later. The exact end date is shown on your account billing
              page once Premium activates.
            </p>
            <p>
              <strong>You will receive two pre-renewal emails:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 text-[#333333]">
              <li>One <strong>7 days before</strong> the free period ends.</li>
              <li>One <strong>24 hours before</strong> the free period ends.</li>
            </ul>
            <p>
              These emails confirm the upcoming renewal price, the renewal date, and a one-click
              cancel link.
            </p>
            <div className="bg-[#FFF8EC] border border-[#E6B450]/40 rounded-xl p-4 text-sm">
              <p className="font-bold text-[#7A5A1A] mb-1">First 14 days — message cap.</p>
              <p className="text-[#5C4519]">
                During the first 14 days after your verification is approved, a soft cap of 50
                messages per day applies regardless of Premium status. This is a temporary safety
                measure for new members and lifts automatically after day 14.
              </p>
            </div>
          </section>

          {/* 5. Auto-renewal + cancellation */}
          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-[#1F1F1F] flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-[#E6B450]" /> Auto-renewal and cancellation
            </h2>
            <p>
              <strong>Auto-renewal disclosure (FTC):</strong> Unless you cancel before the free
              period ends, your Marryzen Premium subscription will automatically renew at{' '}
              <strong>$24.99 per month</strong>, billed monthly to the payment method you provide
              at the time of activation. The renewal continues every month thereafter until you
              cancel.
            </p>
            <p>
              <strong>Cancellation:</strong> You can cancel at any time — including during the
              free period — from your Marryzen account billing page in two clicks:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[#333333] ml-4">
              <li>
                Open <strong>Account → Billing</strong> from your dashboard.
              </li>
              <li>
                Click <strong>&quot;Cancel subscription&quot;</strong> and confirm.
              </li>
            </ol>
            <p className="text-sm">
              Cancellation is immediate for billing purposes — you keep Premium access through the
              end of the period you&apos;ve already paid for (or the end of the free period, if you
              cancel during the free period) and are not billed again.
            </p>
            <div className="bg-[#FFF0F0] border border-red-200 rounded-xl p-4 text-sm">
              <p className="font-bold text-red-800 mb-1 flex items-center gap-2">
                <X className="w-4 h-4" /> No phone tree. No call required.
              </p>
              <p className="text-red-900">
                We never require a phone call, email exchange, or retention conversation to
                cancel. If you ever encounter any friction during cancellation, please report it
                to admin@marryzen.com and we will refund the charge in question.
              </p>
            </div>
          </section>

          {/* 6. Eligibility + abuse */}
          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-[#1F1F1F] flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-[#E6B450]" /> Eligibility and abuse
            </h2>
            <ul className="list-disc list-inside space-y-2 text-[#333333]">
              <li>You must be at least 18 years old.</li>
              <li>
                One Founding Member offer per person. Multiple accounts created by the same person
                (detected via Didit document hash, device fingerprint, or other anti-farming
                signals) will not stack the offer.
              </li>
              <li>
                Accounts that are suspended or banned for violating our{' '}
                <a href="/community-guidelines" className="text-[#E6B450] underline">
                  Community Guidelines
                </a>{' '}
                lose Founding Member status, including the badge.
              </li>
              <li>
                The offer is non-transferable. Free Premium cannot be gifted, traded, or
                converted to account credit.
              </li>
            </ul>
          </section>

          {/* 7. Founding Member badge */}
          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-[#1F1F1F] flex items-center gap-2">
              <BadgeCheck className="w-6 h-6 text-[#E6B450]" /> What the Founding Member badge does
            </h2>
            <p>
              The badge is a visual mark on your profile recognizing you as part of Marryzen&apos;s
              first 500 verified members. It does <strong>not</strong> grant additional Premium
              features, search priority, or boost your discoverability — Premium features
              themselves are governed by the standard{' '}
              <a href="/billing-terms" className="text-[#E6B450] underline">
                Billing Terms
              </a>
              .
            </p>
            <p>
              You retain the badge whether or not you continue Premium after the free period,
              as long as your account remains in good standing.
            </p>
          </section>

          {/* 8. Questions */}
          <section className="space-y-3 pt-4 border-t border-[#E6DCD2]">
            <h2 className="text-xl font-bold text-[#1F1F1F]">Questions?</h2>
            <p>
              Email <a href="mailto:admin@marryzen.com" className="text-[#E6B450] underline">admin@marryzen.com</a>{' '}
              and a human will respond within one business day.
            </p>
            <p className="text-xs text-[#8A857D] pt-4">
              These Founding Member terms supplement, and do not replace, our{' '}
              <a href="/terms" className="text-brand-muted underline">Terms of Service</a>,{' '}
              <a href="/billing-terms" className="text-brand-muted underline">Billing Terms</a>, and{' '}
              <a href="/refund-policy" className="text-brand-muted underline">Refund Policy</a>.
              In the event of any conflict, those documents control on all matters except the
              specific terms of this Founding Member offer.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default FoundingMemberTerms;
