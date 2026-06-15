// src/components/MatchPreferencesCard.jsx
//
// Phase 41a — Reusable "Your must-haves" card. Used by:
//   - AccountSettingsPage.jsx (post-onboarding settings, primary surface)
//   - Step5.jsx (onboarding sub-section, optional discoverability)
//
// 4 user-controlled deal-breaker toggles, all default false. When enabled,
// Discovery hides candidates whose corresponding field doesn't exactly match
// the user's own. Pre-launch behavior is unchanged unless the user opts in.
//
// Voice rules (CLAUDE.md): institutional — "we / Marryzen", never "our team".
// Copy framed as opt-in ("Must match exactly").
//
// Props:
//   value      — { dealbreaker_faith: bool, dealbreaker_marital_status: bool,
//                  dealbreaker_has_children: bool, dealbreaker_relationship_goal: bool }
//   onChange   — (nextValue) => void  -- called with full updated object
//   profile    — partial profile { religious_affiliation, marital_status,
//                                  has_children, relationship_goal } for context
//                strings. Optional — if absent, toggles still work but the
//                "(currently: X)" hint is omitted.
//   compact    — boolean. true = onboarding inline style; false = Settings card.

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Lock } from 'lucide-react';

const FIELDS = [
  {
    key: 'dealbreaker_faith',
    label: 'Same faith only',
    explainer: 'Hide profiles whose religious affiliation does not exactly match yours.',
    sourceField: 'religious_affiliation',
  },
  {
    key: 'dealbreaker_marital_status',
    label: 'Same marital history only',
    explainer: 'Hide profiles whose marital status does not exactly match yours (Never Married / Divorced / Widowed / Annulled).',
    sourceField: 'marital_status',
  },
  {
    key: 'dealbreaker_has_children',
    label: 'Same parental status only',
    explainer: 'Hide profiles whose answer to "Do you have children?" does not match yours.',
    sourceField: 'has_children',
    formatValue: (v) => (v === true ? 'Yes' : v === false ? 'No' : null),
  },
  {
    key: 'dealbreaker_relationship_goal',
    label: 'Same marriage timeline only',
    explainer: 'Hide profiles whose marriage intent / timeline does not exactly match yours.',
    sourceField: 'relationship_goal',
  },
];

const MatchPreferencesCard = ({ value, onChange, profile, compact = false }) => {
  const safeValue = value || {};

  const handleToggle = (key) => (checked) => {
    if (typeof onChange === 'function') {
      onChange({ ...safeValue, [key]: !!checked });
    }
  };

  const activeCount = FIELDS.reduce((n, f) => n + (safeValue[f.key] ? 1 : 0), 0);

  return (
    <div
      className={
        compact
          ? 'mt-8 pt-8 border-t border-[#E6DCD2]'
          : 'bg-white border border-[#E6DCD2] rounded-[14px] p-6 sm:p-8 shadow-sm'
      }
    >
      <div className="mb-4">
        <div className="flex items-start gap-3 mb-2">
          <Lock className="w-5 h-5 text-brand-pink-strong mt-0.5 shrink-0" />
          <div>
            <h3 className="text-lg font-bold text-[#1F1F1F] leading-tight">
              Your must-haves
              {activeCount > 0 && (
                <span className="ml-2 text-sm font-semibold text-brand-pink-strong">
                  {activeCount} active
                </span>
              )}
            </h3>
            <p className="text-sm text-brand-muted mt-1">
              Some things matter so much you can&rsquo;t compromise. Tell us which ones &mdash; Marryzen will skip profiles that don&rsquo;t match. You can change this any time.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {FIELDS.map((field) => {
          const enabled = !!safeValue[field.key];
          const profileValue = profile && profile[field.sourceField];
          const formattedValue = field.formatValue ? field.formatValue(profileValue) : profileValue;
          const hint = formattedValue ? `Currently: ${formattedValue}` : 'Set your own value in your profile first';

          return (
            <div
              key={field.key}
              className="flex items-start justify-between gap-4 py-2"
            >
              <div className="flex-1 min-w-0">
                <label
                  htmlFor={field.key}
                  className="block text-base font-semibold text-[#1F1F1F] cursor-pointer"
                >
                  {field.label}
                </label>
                <p className="text-sm text-brand-muted mt-1 leading-relaxed">
                  {field.explainer}
                </p>
                <p className={`text-xs mt-1 ${formattedValue ? 'text-brand-muted' : 'text-brand-pink-strong'}`}>
                  {hint}
                </p>
              </div>
              <div className="shrink-0 pt-1">
                <Switch
                  id={field.key}
                  checked={enabled}
                  onCheckedChange={handleToggle(field.key)}
                  aria-label={field.label}
                />
              </div>
            </div>
          );
        })}
      </div>

      {activeCount > 0 && (
        <div className="mt-6 pt-5 border-t border-[#FAF7F2] text-sm text-brand-muted">
          <strong className="text-[#1F1F1F]">Heads-up:</strong> the more must-haves you set, the smaller your match feed becomes. If your feed feels empty, try turning one off here.
        </div>
      )}
    </div>
  );
};

export default MatchPreferencesCard;
