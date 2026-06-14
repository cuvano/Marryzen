// src/components/onboarding/FaithAlignedInterstitial.jsx
//
// Phase 41d (2026-06-13) — Strong-default faith-aligned matchmaking interstitial.
// Board-approved P2 path. Decision doc: Muslim_Women_Filter_Decision_2026-06-13.md
//
// Renders ONLY when:
//   - The user has selected religious_affiliation = 'Islam' AND identify_as = 'Woman'
//   - AND the user has not yet acknowledged the interstitial (faith_align_acknowledged_at IS NULL)
//
// Two buttons:
//   - "Continue with faith-aligned matches" (primary, glowing, default)
//     -> sets dealbreaker_faith = true + faith_align_acknowledged_at = now()
//   - "Show me all faiths" (secondary, smaller)
//     -> sets dealbreaker_faith = false + faith_align_acknowledged_at = now()
//
// Either choice writes the acknowledgment timestamp — the audit trail proves
// (to a DSR / regulator) that the user made a deliberate choice, not a
// default-without-disclosure.
//
// Voice rules (CLAUDE.md): institutional "Marryzen" (no "our team", no
// founder voice). Copy reviewed by the 3-agent board.
//
// Props:
//   formData     — { religiousAffiliation, identifyAs } reads from the
//                  onboarding form state to gate visibility.
//   onComplete   — optional callback fired after a successful write so the
//                  parent step can hide/dismiss the interstitial.

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Heart } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { funnel } from '@/lib/analytics';

const FaithAlignedInterstitial = ({ formData, onComplete }) => {
  const [acknowledged, setAcknowledged] = useState(null); // null = unknown, true/false = loaded
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Gate visibility on the exact (Islam + Woman) combination. Matches the
  // canonical stored values per CLAUDE.md (the religion CHECK constraint
  // enforces 'Islam'; identify_as has 'Man' / 'Woman' with legacy 'Male' /
  // 'Female' tolerated via the DiscoveryPage gender expand — we accept
  // both legacy tokens for forward-compatibility).
  const isMuslimWoman =
    formData?.religiousAffiliation === 'Islam' &&
    (formData?.identifyAs === 'Woman' || formData?.identifyAs === 'Female');

  // Load the existing acknowledgment state so we don't re-prompt a user who
  // has already chosen.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;
        const { data, error: e } = await supabase
          .from('profiles')
          .select('faith_align_acknowledged_at')
          .eq('id', session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (e) {
          // PGRST116 = no rows. Not an error for new accounts mid-onboarding.
          if (e.code && e.code !== 'PGRST116') console.error('Faith-align load error:', e);
          setAcknowledged(false);
          return;
        }
        setAcknowledged(!!(data && data.faith_align_acknowledged_at));
      } catch (err) {
        if (!cancelled) {
          console.error('Faith-align load exception:', err);
          setAcknowledged(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleChoice = async (faithAligned) => {
    setSaving(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to continue.');
        setSaving(false);
        return;
      }
      const nowIso = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          dealbreaker_faith: !!faithAligned,
          faith_align_acknowledged_at: nowIso,
        })
        .eq('id', session.user.id);
      if (updateErr) throw updateErr;
      // Telemetry — PostHog + Sentry breadcrumb.
      try {
        funnel.dealbreakersChanged({
          trigger: 'faith_aligned_interstitial',
          choice: faithAligned ? 'faith_aligned' : 'show_all_faiths',
          religion: 'Islam',
          gender: formData?.identifyAs || 'Woman',
        });
      } catch (_) {}
      setAcknowledged(true);
      if (typeof onComplete === 'function') onComplete(faithAligned);
    } catch (err) {
      console.error('Faith-align save error:', err);
      setError(err.message || 'Could not save your choice. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Don't render for users this doesn't apply to.
  if (!isMuslimWoman) return null;
  // Don't re-prompt users who already chose.
  if (acknowledged === null) return null;     // still loading
  if (acknowledged === true) return null;     // already chose

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white border-2 border-[#C85A72] rounded-[14px] p-6 sm:p-8 shadow-md mb-8"
      role="region"
      aria-label="Faith-aligned matchmaking"
    >
      <div className="flex items-start gap-3 mb-4">
        <Shield className="w-6 h-6 text-[#C85A72] mt-1 shrink-0" />
        <div>
          <h3 className="text-xl font-bold text-[#1F1F1F] leading-tight">
            Faith-aligned matches <span className="text-sm font-medium text-[#C85A72] ml-1">(recommended)</span>
          </h3>
          <p className="text-sm text-[#706B67] mt-1 font-medium">
            For Muslim sisters following classical guidance.
          </p>
        </div>
      </div>

      <p className="text-[#1F1F1F] text-base leading-relaxed mb-3">
        Marryzen aligns with classical Islamic guidance: by default, your matches will be Muslim brothers only.
      </p>
      <p className="text-[#706B67] text-sm leading-relaxed mb-6">
        You can change this in Settings any time, and you can email <a href="mailto:admin@marryzen.com" className="text-[#C85A72] hover:underline">admin@marryzen.com</a> if your situation calls for a different approach. Whatever you choose now, you stay in control.
      </p>

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => handleChoice(true)}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold rounded-full shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#E6B450] focus:ring-offset-2 focus:ring-offset-white disabled:opacity-60 disabled:cursor-wait"
        >
          <Heart className="w-4 h-4" />
          {saving ? 'Saving…' : 'Continue with faith-aligned matches'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => handleChoice(false)}
          className="flex-1 sm:flex-none px-6 py-3.5 bg-white hover:bg-[#FAFAF7] text-[#1F1F1F] font-bold rounded-full border border-[#E6DCD2] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C85A72] focus:ring-offset-2 focus:ring-offset-white disabled:opacity-60 disabled:cursor-wait"
        >
          Show me all faiths
        </button>
      </div>

      <p className="text-xs text-[#706B67] mt-4 leading-relaxed">
        We record your choice (date and time) so we can show it to you if you ever ask. We do not share this choice with anyone else.
      </p>
    </motion.div>
  );
};

export default FaithAlignedInterstitial;
