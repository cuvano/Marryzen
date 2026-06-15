// src/components/AgePreferencesCard.jsx
//
// Phase 41f (2026-06-13) — UI surface for `preferred_age_min` /
// `preferred_age_max` columns added in Phase 41e migration.
//
// Closes the 1b loop: the scorer already reads these columns; this card lets
// users actually set them. Two number inputs + a Clear button to revert to
// the symmetric tier scoring (NULL = no preference).
//
// Persists directly via supabase (same pattern as MatchPreferencesCard).
// No dependence on OnboardingPage formData write path.
//
// Voice rules: institutional Marryzen, no founder voice.

import React, { useEffect, useState } from 'react';
import { Cake, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

// CHECK constraint mirror — keep in lockstep with
// 20260613060000_phase41e_age_preference_columns.sql
const MIN_AGE = 18;
const MAX_AGE = 99;

const AgePreferencesCard = () => {
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;
        const { data, error: e } = await supabase
          .from('profiles')
          .select('preferred_age_min, preferred_age_max')
          .eq('id', session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (e && e.code && e.code !== 'PGRST116') {
          console.error('Age preferences load error:', e);
        }
        if (data) {
          setMin(typeof data.preferred_age_min === 'number' ? String(data.preferred_age_min) : '');
          setMax(typeof data.preferred_age_max === 'number' ? String(data.preferred_age_max) : '');
        }
      } catch (err) {
        if (!cancelled) console.error('Age preferences load exception:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const validate = (minVal, maxVal) => {
    // Both empty is valid — means "no preference" (clear).
    if (minVal === '' && maxVal === '') return null;
    // If one is set the other must be too.
    if (minVal === '' || maxVal === '') {
      return 'Set both a minimum and a maximum, or leave both empty for no preference.';
    }
    const mn = parseInt(minVal, 10);
    const mx = parseInt(maxVal, 10);
    if (!Number.isInteger(mn) || !Number.isInteger(mx)) {
      return 'Use whole numbers only.';
    }
    if (mn < MIN_AGE || mn > MAX_AGE || mx < MIN_AGE || mx > MAX_AGE) {
      return `Ages must be between ${MIN_AGE} and ${MAX_AGE}.`;
    }
    if (mn > mx) {
      return 'Minimum must be less than or equal to maximum.';
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate(min, max);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to save your preferences.');
        return;
      }
      const payload = (min === '' && max === '')
        ? { preferred_age_min: null, preferred_age_max: null }
        : { preferred_age_min: parseInt(min, 10), preferred_age_max: parseInt(max, 10) };
      const { error: e } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', session.user.id);
      if (e) throw e;
      setSavedAt(new Date());
    } catch (err) {
      console.error('Age preferences save error:', err);
      setError(err.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setMin('');
    setMax('');
    setError(null);
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error: e } = await supabase
        .from('profiles')
        .update({ preferred_age_min: null, preferred_age_max: null })
        .eq('id', session.user.id);
      if (e) throw e;
      setSavedAt(new Date());
    } catch (err) {
      console.error('Age preferences clear error:', err);
      setError(err.message || 'Could not clear. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const hasValue = min !== '' || max !== '';

  return (
    <div className="bg-white border border-[#E6DCD2] rounded-[14px] p-6 sm:p-8 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <Cake className="w-5 h-5 text-[#E6B450] mt-0.5 shrink-0" />
        <div>
          <h3 className="text-lg font-bold text-[#1F1F1F] leading-tight">
            Preferred age range
          </h3>
          <p className="text-sm text-brand-muted mt-1">
            Set the ages you&rsquo;d most like to meet. Profiles in this range score highest. Leave blank for no preference — the algorithm scores by closeness in age either way.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-brand-muted">Loading&hellip;</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="preferred_age_min" className="block text-sm font-semibold text-[#1F1F1F] mb-1">
                Minimum age
              </label>
              <input
                id="preferred_age_min"
                type="number"
                inputMode="numeric"
                min={MIN_AGE}
                max={MAX_AGE}
                placeholder="—"
                value={min}
                onChange={(e) => { setMin(e.target.value); setError(null); }}
                className="w-full border border-[#E6DCD2] rounded-lg px-3 py-2 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#E6B450] focus:border-[#E6B450]"
                disabled={saving}
              />
            </div>
            <div>
              <label htmlFor="preferred_age_max" className="block text-sm font-semibold text-[#1F1F1F] mb-1">
                Maximum age
              </label>
              <input
                id="preferred_age_max"
                type="number"
                inputMode="numeric"
                min={MIN_AGE}
                max={MAX_AGE}
                placeholder="—"
                value={max}
                onChange={(e) => { setMax(e.target.value); setError(null); }}
                className="w-full border border-[#E6DCD2] rounded-lg px-3 py-2 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#E6B450] focus:border-[#E6B450]"
                disabled={saving}
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center px-6 py-2.5 bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#E6B450] focus:ring-offset-2 focus:ring-offset-white disabled:opacity-60 disabled:cursor-wait"
            >
              {saving ? 'Saving…' : 'Save preference'}
            </button>
            {hasValue && (
              <button
                type="button"
                onClick={handleClear}
                disabled={saving}
                className="inline-flex items-center justify-center px-6 py-2.5 bg-white hover:bg-[#FAFAF7] text-brand-muted hover:text-[#1F1F1F] font-medium rounded-full border border-[#E6DCD2] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C85A72] focus:ring-offset-2 focus:ring-offset-white disabled:opacity-60 disabled:cursor-wait"
              >
                Clear (no preference)
              </button>
            )}
          </div>

          {savedAt && !error && (
            <p className="mt-3 text-xs text-brand-muted">
              Saved {savedAt.toLocaleTimeString()}.
            </p>
          )}

          <p className="mt-5 pt-4 border-t border-[#FAF7F2] text-xs text-brand-muted leading-relaxed">
            <strong className="text-[#1F1F1F]">How this is used:</strong> the matchmaking algorithm gives full age credit to profiles inside your range. Candidates outside the range still appear, scored by how far outside they fall. We never silently exclude anyone based on age — for that, use the deal-breaker toggles below.
          </p>
        </>
      )}
    </div>
  );
};

export default AgePreferencesCard;
