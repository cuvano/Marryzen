import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * VerificationCTAModal
 * --------------------
 * Context-rich verification gate. Opens when an unverified (or pending /
 * rejected / name-mismatched) user attempts a value action (like, send
 * message). Shows them the person they were trying to engage with so the
 * ask has a face attached to it — much stronger conversion lever than a
 * generic banner.
 *
 * Props:
 *   open           — boolean, controls visibility
 *   onClose        — () => void, called when user dismisses
 *   targetProfile  — the profile object they were trying to act on. Shape:
 *                    { full_name, photos } — both optional, modal degrades
 *                    gracefully if either is missing.
 *   action         — 'like' | 'message' (drives the headline verb)
 *   status         — 'unverified' | 'pending' | 'rejected' | 'name_mismatch'
 *                    Selects the right CTA copy + destination URL. Default
 *                    is 'unverified' (Didit start flow).
 *
 * Routing:
 *   unverified / rejected → /profile?openVerify=1 (starts/restarts Didit)
 *   pending               → /profile (no action — copy explains waiting)
 *   name_mismatch         → /profile (no Didit re-burn — copy says rename)
 *
 * Designed to match ReportUserModal's framer-motion overlay style so the
 * design language stays consistent across the app.
 */
const VerificationCTAModal = ({
  open,
  onClose,
  targetProfile,
  action = 'like',
  status = 'unverified',
}) => {
  const navigate = useNavigate();
  const ctaButtonRef = useRef(null);

  // Move focus into the modal on open + close on Escape.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => ctaButtonRef.current?.focus(), 60);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  // First-name pull. Marryzen schema stores the canonical name as `full_name`;
  // `first_name` / `name` are tolerated as defensive fallbacks but normally
  // unused.
  const firstName =
    targetProfile?.full_name?.split(' ')[0] ||
    targetProfile?.first_name ||
    targetProfile?.name?.split(' ')[0] ||
    null;
  const photo = targetProfile?.photos?.[0] || null;
  const verbCopy = action === 'message' ? 'message' : 'like';

  // Per-status copy + routing. `unverified` and `rejected` both go to the
  // Didit start flow; `pending` and `name_mismatch` route to /profile with
  // explanatory copy so we don't burn a fresh Didit session unnecessarily.
  const copy = (() => {
    if (status === 'pending') {
      return {
        Icon: ShieldCheck,
        headline: 'Your verification is being reviewed',
        body: `We're still reviewing your ID. Once it's approved you'll be able to ${verbCopy} ${firstName || 'other members'} — this usually finishes within a few minutes.`,
        cta: 'View profile',
        target: '/profile',
      };
    }
    if (status === 'name_mismatch') {
      return {
        Icon: ShieldAlert,
        headline: 'Update your profile name to finish verifying',
        body: "Your ID verified, but the name on your document doesn't match your profile. Update your profile name to your legal first name (last initial is fine) and your verification will complete automatically.",
        cta: 'Update profile name',
        target: '/profile',
      };
    }
    if (status === 'rejected') {
      return {
        Icon: ShieldAlert,
        headline: 'Verification needs another try',
        body: `Your last verification attempt didn't go through. You can restart it in about 60 seconds${firstName ? ` and then ${verbCopy} ${firstName}` : ''}.`,
        cta: 'Restart verification',
        target: '/profile?openVerify=1',
      };
    }
    // default: unverified
    return {
      Icon: ShieldCheck,
      headline: firstName
        ? `Verify your identity to ${verbCopy} ${firstName}`
        : 'Verify your identity to keep going',
      body: `Marryzen is the verified marriage app. Every member completes a quick ID check before they can ${verbCopy} or appear in search. It takes about 60 seconds.`,
      cta: 'Verify my identity',
      target: '/profile?openVerify=1',
    };
  })();

  const { Icon } = copy;

  const handleCTA = () => {
    onClose();
    navigate(copy.target);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 max-h-[calc(100vh-2rem)] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="verify-cta-headline"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 text-[#706B67] hover:text-[#1F1F1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E6B450] rounded-full p-1 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center">
              {photo ? (
                <div className="relative mb-4">
                  <img
                    src={photo}
                    alt={firstName ? `${firstName}'s photo` : 'Profile photo'}
                    className="w-24 h-24 rounded-full object-cover ring-4 ring-[#F3E8D9]"
                  />
                  <div className="absolute -bottom-1 -right-1 w-9 h-9 bg-[#E6B450] rounded-full flex items-center justify-center ring-4 ring-white">
                    <Icon size={18} className="text-[#1F1F1F]" />
                  </div>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#FFF7E1] flex items-center justify-center mb-4">
                  <Icon size={32} className="text-[#8a6c1e]" />
                </div>
              )}

              <h2
                id="verify-cta-headline"
                className="text-2xl font-bold text-[#1F1F1F] mb-2 leading-snug"
              >
                {copy.headline}
              </h2>

              <p className="text-sm text-[#5e4e1f] leading-relaxed mb-6 px-2">
                {copy.body}
              </p>

              <Button
                ref={ctaButtonRef}
                onClick={handleCTA}
                className="w-full bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold py-6 text-base rounded-xl shadow-md focus-visible:ring-2 focus-visible:ring-[#1F1F1F]"
              >
                {copy.cta}
              </Button>

              <button
                onClick={onClose}
                className="mt-4 text-sm text-[#706B67] hover:text-[#1F1F1F] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E6B450] rounded px-2 py-1 transition-colors"
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VerificationCTAModal;
