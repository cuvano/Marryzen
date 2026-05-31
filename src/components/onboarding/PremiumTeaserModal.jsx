import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Heart, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * PremiumTeaserModal
 * ------------------
 * Post-onboarding conversion moment. Per VP Growth (Riley) board audit:
 * the instant a user finishes Step 5 is the SINGLE highest-intent moment
 * in their Marryzen lifetime. Currently we waste it by redirecting them
 * straight to /dashboard with no upsell. This modal sits in that window:
 * shows three teaser/blurred "members who match you" cards + a Premium CTA.
 *
 * Notes:
 * - This is NOT a gate — both buttons advance the user. Premium routes to
 *   /premium, secondary routes to /dashboard. Either way, onboarding is
 *   considered complete.
 * - Shown ONCE per account using localStorage flag `premium_teaser_seen`.
 * - Suppressed for premium members + suppressed in isEditMode (don't pitch
 *   existing users mid-edit).
 *
 * Props:
 *   open       — boolean, controls visibility
 *   onSkip     — () => void, secondary action ("Continue to Discovery")
 *   onUpgrade  — () => void, primary action ("See Premium")
 */
const PremiumTeaserModal = ({ open, onSkip, onUpgrade }) => {
  const primaryRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => primaryRef.current?.focus(), 80);
    const onKey = (e) => { if (e.key === 'Escape') onSkip?.(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [open, onSkip]);

  // Generic teaser cards — kept intentionally vague so we never imply these
  // are real matches before the matching engine has run. Names/ages are
  // placeholder-realistic; photos are CSS gradients (no real users shown).
  const teaserCards = [
    { initials: 'S', accent: 'from-[#F9E7EB] to-[#E6B450]/30' },
    { initials: 'A', accent: 'from-[#EAF2F7] to-[#C85A72]/20' },
    { initials: 'M', accent: 'from-[#FAF7F2] to-[#E6B450]/40' },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="premium-teaser-title"
        >
          <motion.div
            initial={{ y: 24, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 pt-7 pb-4 text-center bg-gradient-to-b from-[#FAF7F2] to-white">
              <div className="inline-flex items-center justify-center gap-2 mb-3 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold">
                <Sparkles size={12} className="text-amber-700" />
                You're in.
              </div>
              <h2 id="premium-teaser-title" className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#1F1F1F] leading-tight">
                Members already match your profile.
              </h2>
              <p className="mt-2 text-[15px] text-[#706B67] leading-relaxed">
                Unlock unlimited messaging, see who liked you, and meet them today.
              </p>
            </div>

            {/* Teaser cards row — generic placeholders, no real-user data */}
            <div className="px-6 pb-2 pt-1 flex justify-center gap-3" aria-hidden="true">
              {teaserCards.map((c, i) => (
                <div
                  key={i}
                  className={`relative w-20 h-24 sm:w-24 sm:h-28 rounded-2xl bg-gradient-to-br ${c.accent} border border-white shadow-md flex items-center justify-center overflow-hidden`}
                >
                  <span className="text-[#1F1F1F]/40 text-2xl font-bold blur-[1.5px] select-none">{c.initials}</span>
                  <div className="absolute inset-0 backdrop-blur-[2px] bg-white/10" />
                  <Heart size={14} className="absolute top-1.5 right-1.5 text-[#C85A72] fill-[#C85A72]" />
                </div>
              ))}
            </div>

            {/* Value bullets */}
            <div className="px-6 py-4">
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2.5 text-[14px] text-[#1F1F1F]">
                  <Crown size={16} className="shrink-0 mt-0.5 text-[#E6B450] fill-[#E6B450]" />
                  <span><strong>See everyone who liked you</strong> — no waiting for a mutual match</span>
                </li>
                <li className="flex items-start gap-2.5 text-[14px] text-[#1F1F1F]">
                  <Crown size={16} className="shrink-0 mt-0.5 text-[#E6B450] fill-[#E6B450]" />
                  <span><strong>Unlimited likes &amp; messaging</strong> — never hit the daily cap</span>
                </li>
                <li className="flex items-start gap-2.5 text-[14px] text-[#1F1F1F]">
                  <Crown size={16} className="shrink-0 mt-0.5 text-[#E6B450] fill-[#E6B450]" />
                  <span><strong>Up to 12 photos</strong> — show every side of you</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 pt-2 space-y-2.5 bg-gradient-to-b from-transparent to-[#FAF7F2]/60">
              <Button
                ref={primaryRef}
                type="button"
                onClick={onUpgrade}
                className="w-full h-12 bg-[#1F1F1F] hover:bg-[#333] text-white text-base font-semibold rounded-xl shadow-md transition-transform active:scale-[0.98]"
              >
                See Premium
                <ArrowRight size={16} className="ml-2" />
              </Button>
              <button
                type="button"
                onClick={onSkip}
                className="w-full h-11 text-[#706B67] hover:text-[#1F1F1F] text-sm font-medium rounded-xl hover:bg-[#FAF7F2] transition-colors"
              >
                Continue to Discovery
              </button>
            </div>

            {/* Trust footer */}
            <div className="px-6 pb-5 text-center">
              <p className="text-[11px] text-[#8A857D]">
                Cancel anytime. No commitment required.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PremiumTeaserModal;
