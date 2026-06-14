import React, { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import {
  RELATIONSHIP_GOAL_LABELS,
  RELATIONSHIP_GOAL_DESCRIPTIONS,
  RELATIONSHIP_GOALS_ORDERED,
} from '@/lib/relationshipGoals';
import FaithAlignedInterstitial from '@/components/onboarding/FaithAlignedInterstitial';
import MatchPreferencesCard from '@/components/MatchPreferencesCard';
import { funnel } from '@/lib/analytics';

// Phase 41b (2026-06-13) — marriage intent options now driven by the
// canonical constants file. TMM display label updated from "Marriage First
// — No Dating Period" to "Marriage-bound, family-introduced" per board
// verdict. Stored values unchanged (CHECK-constraint locked).
//
// Phase 41c (2026-06-13) — full deal-breaker integration during onboarding.
// MatchPreferencesCard mounts below the marriage intent radio. It loads
// the user's current dealbreakers from supabase on mount and persists
// changes via direct supabase writes (NOT via OnboardingPage's formData
// flow). This avoids the B2 reviewer flag from Phase 41a where toggles
// would silently fail to persist if OnboardingPage's step6Update didn't
// include the columns.
//
// Phase 41d (2026-06-13) — Muslim women see a Faith-aligned matchmaking
// interstitial at the top of Step5. The interstitial sets dealbreaker_faith
// for them; the MatchPreferencesCard below shows the resulting state.
// See Muslim_Women_Filter_Decision_2026-06-13.md.

const Step5 = ({ formData, updateFormData, isEditMode = false }) => {
  const marriageIntents = RELATIONSHIP_GOALS_ORDERED.map((value) => ({
    value,
    label: RELATIONSHIP_GOAL_LABELS[value],
    description: RELATIONSHIP_GOAL_DESCRIPTIONS[value],
  }));

  // Phase 41c — local state for the 4 dealbreaker toggles. Initial values
  // are all false (matches the migration column defaults); they get
  // overwritten by the supabase load if the user already chose values
  // (e.g. via the faith-aligned interstitial, or in a prior session).
  const [dealbreakers, setDealbreakers] = useState({
    dealbreaker_faith: false,
    dealbreaker_marital_status: false,
    dealbreaker_has_children: false,
    dealbreaker_relationship_goal: false,
  });
  const [dealbreakersSaving, setDealbreakersSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;
        const { data, error } = await supabase
          .from('profiles')
          .select('dealbreaker_faith, dealbreaker_marital_status, dealbreaker_has_children, dealbreaker_relationship_goal')
          .eq('id', session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error && error.code && error.code !== 'PGRST116') {
          console.error('Step5 dealbreakers load error:', error);
          return;
        }
        if (data) {
          setDealbreakers({
            dealbreaker_faith: !!data.dealbreaker_faith,
            dealbreaker_marital_status: !!data.dealbreaker_marital_status,
            dealbreaker_has_children: !!data.dealbreaker_has_children,
            dealbreaker_relationship_goal: !!data.dealbreaker_relationship_goal,
          });
        }
      } catch (err) {
        if (!cancelled) console.error('Step5 dealbreakers load exception:', err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // After the Faith-aligned interstitial completes, it has written
  // dealbreaker_faith to profiles directly. Re-sync our local state so
  // the MatchPreferencesCard reflects that.
  const handleFaithAlignedComplete = async (chosenAligned) => {
    setDealbreakers((prev) => ({ ...prev, dealbreaker_faith: !!chosenAligned }));
  };

  const handleDealbreakersChange = async (next) => {
    const prev = dealbreakers;
    setDealbreakers(next);
    setDealbreakersSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setDealbreakers(prev);
        return;
      }
      const { error } = await supabase
        .from('profiles')
        .update(next)
        .eq('id', session.user.id);
      if (error) {
        setDealbreakers(prev);
        console.error('Step5 dealbreakers save error:', error);
        return;
      }
      try {
        const activeCount = Object.values(next).filter(Boolean).length;
        funnel.dealbreakersChanged({
          from: prev,
          to: next,
          trigger: 'onboarding_step5',
          active_count: activeCount,
        });
      } catch (_) {}
    } finally {
      setDealbreakersSaving(false);
    }
  };

  // Profile context for the MatchPreferencesCard "Currently: X" hints.
  // OnboardingPage's formData uses camelCase keys + writes maritalHistory
  // for the marital_status column — map both forms here.
  const profileContext = {
    religious_affiliation: formData.religiousAffiliation,
    marital_status: formData.maritalHistory,    // Phase 41a H1 fix — was maritalStatus
    has_children: formData.hasChildren,
    relationship_goal: formData.relationshipGoal,
  };

  return (
    <>
      <div className="space-y-10">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-4">Your Marriage Promise</h2>
          <p className="text-[#706B67] text-lg font-medium">Marryzen is strictly for people seeking serious marriage and lifelong partnership.</p>
          <p className="text-[#1F1F1F] text-sm mt-3 inline-flex items-center justify-center gap-2 font-semibold bg-[#FAF7F2] border border-[#E6DCD2] rounded-full px-4 py-1.5">
            <Shield size={14} className="text-[#C85A72]"/>
            Verified Safe Space. Zero tolerance for harassment.
          </p>
        </div>

        {/* Phase 41d — Faith-aligned interstitial (Muslim + Woman only,
            renders itself; no-op for everyone else). */}
        <FaithAlignedInterstitial formData={formData} onComplete={handleFaithAlignedComplete} />

        <div>
          <Label className="text-[#333333] font-bold text-base mb-4 block">What is your marriage timeline? (Required)</Label>
          <div role="radiogroup" aria-label="Marriage timeline" className="space-y-3">
            {marriageIntents.map((goal) => {
              const isSelected = formData.relationshipGoal === goal.value;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  key={goal.value}
                  className={`p-5 rounded-xl cursor-pointer transition-all border text-left w-full focus:outline-none focus:ring-2 focus:ring-[#E6B450] focus:ring-offset-1 ${
                    isSelected
                      ? 'bg-[#E6B450] text-[#1F1F1F] border-[#E6B450] shadow-md'
                      : 'bg-white text-[#1F1F1F] border-[#E6DCD2] hover:border-[#C85A72]'
                  }`}
                  onClick={() => updateFormData('relationshipGoal', goal.value)}
                >
                  <div className="flex items-start gap-3">
                    <div aria-hidden="true" className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? 'border-[#1F1F1F]' : 'border-[#C85A72]'}`}>
                        {isSelected && <div className="w-2.5 h-2.5 bg-[#1F1F1F] rounded-full" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-base mb-1">{goal.label}</div>
                      <div className={`text-sm ${isSelected ? 'text-[#1F1F1F]/80' : 'text-[#706B67]'}`}>{goal.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6 pt-6 border-t border-[#F3E8D9]">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="confirmMarriageIntent"
              checked={formData.confirmMarriageIntent}
              onCheckedChange={(checked) => updateFormData('confirmMarriageIntent', checked)}
              className="border-[#C85A72] data-[state=checked]:bg-[#E6B450] data-[state=checked]:border-[#E6B450] w-5 h-5 mt-0.5"
            />
            <Label htmlFor="confirmMarriageIntent" className="text-[#1F1F1F] text-sm font-medium cursor-pointer leading-relaxed">
              I confirm that I am joining Marryzen with the <span className="font-bold text-[#C85A72]">Serious Intention of Marriage</span>, not casual dating or hookups.
            </Label>
          </div>

          {!isEditMode && (
            <div className="flex items-start space-x-3 p-5 bg-[#F9E7EB]/30 rounded-xl border border-[#F9E7EB]">
              <Checkbox
                id="agreeToTermsV2"
                checked={formData.agreeToTermsV2}
                onCheckedChange={(checked) => updateFormData('agreeToTermsV2', checked)}
                className="border-[#C85A72] data-[state=checked]:bg-[#E6B450] data-[state=checked]:border-[#E6B450] w-5 h-5 mt-0.5"
              />
              <Label htmlFor="agreeToTermsV2" className="text-[#1F1F1F] text-sm font-normal cursor-pointer leading-relaxed">
                 <span className="font-bold text-[#C85A72]">Community Pledge:</span> I will treat every member with respect and honor the spirit of the <Link to="/community-guidelines" className="text-[#E6B450] hover:underline" target="_blank">Community Guidelines</Link>. I understand that violations may result in temporary suspension or permanent removal, with written notice and a right to appeal.
              </Label>
            </div>
          )}
        </div>

        {/* Phase 41c — Optional deal-breaker toggles. All defaults off.
            Card persists changes directly to supabase via its onChange
            handler — no dependence on OnboardingPage's step6Update write
            path. */}
        <MatchPreferencesCard
          value={dealbreakers}
          onChange={handleDealbreakersChange}
          profile={profileContext}
          compact={true}
        />
        {dealbreakersSaving && (
          <p className="text-xs text-[#706B67] mt-2 ml-2 text-center">Saving your preferences&hellip;</p>
        )}

      </div>

    </>
  );
};

export default Step5;
