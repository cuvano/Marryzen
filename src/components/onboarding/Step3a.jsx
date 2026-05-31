import React from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Step 3a — Your Identity & Faith
 * --------------------------------
 * Phase 2E split of the old monolithic Step 3 (which asked 51 decisions on
 * one screen — Maya's #1 conversion cliff). This screen owns the identity-
 * sensitive fields (GDPR Article 9 special-category data) and dedicates
 * the visual real estate they deserve.
 *
 * Fields:
 *   - Cultural Heritage & Ethnicity (multi-select up to MAX_CULTURES, with Art.9 disclosure)
 *   - Faith & Lifestyle (single-select level-of-practice radio group)
 *   - Religious Affiliation (optional dropdown, with Art.9 disclosure)
 */

// Phase 2G: cap on simultaneous culture selections. Module-scope const so
// it's not recreated on every render, and easy to find / tune.
const MAX_CULTURES = 3;
const Step3a = ({ formData, updateFormData, cultures }) => {

  // Cultures multi-select with cap of MAX_CULTURES (module const).
  // Per VP DEI (Priya) board verdict: single-select with 'Mixed Heritage'
  // catch-all is inadequate for users who actually live a mixed identity
  // (e.g. half South Asian + half Middle Eastern). Cap at 3 to keep the
  // primary self-identification meaningful and the matching signal clear.
  const selectedCultures = formData.cultures || [];

  const handleCultureToggle = (culture) => {
    const isSelected = selectedCultures.includes(culture);
    if (isSelected) {
      // Deselect
      const next = selectedCultures.filter((c) => c !== culture);
      updateFormData('cultures', next);
      // If we just removed 'Other', clear its free-text companion.
      if (culture === 'Other') {
        updateFormData('otherCultureText', '');
      }
    } else {
      // Select — but enforce the cap. If already at max, do nothing
      // (the UI also disables un-selected options at the cap, so this is a backstop).
      if (selectedCultures.length >= MAX_CULTURES) return;
      const next = [...selectedCultures, culture];
      updateFormData('cultures', next);
    }
  };

  const isOtherCultureSelected = selectedCultures.includes('Other');
  const isOtherReligionSelected = formData.religiousAffiliation === 'Other';

  // Religion list — Phase 2C expansion (DB CHECK constraint relaxed to match).
  const religiousAffiliations = [
    'Islam',
    'Christianity',
    'Christianity (Eastern Orthodox)',
    'Christianity (Catholic)',
    'Christianity (Protestant)',
    'Christianity (LDS / Mormon)',
    "Christianity (Jehovah's Witness)",
    'Judaism',
    'Hinduism',
    'Buddhism',
    'Sikhism',
    "Baha'i",
    'Zoroastrian / Parsi',
    'Non-religious',
    'Spiritual but not religious',
    'Other',
    'Prefer not to say'
  ];
  const faithLifestyles = ['Very religious / practicing', 'Moderately practicing', 'Cultural faith only', 'Spiritual but not religious', 'Not religious / Not practicing', 'Prefer not to say'];

  return (
    <>
      <div className="space-y-10">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-4">Your Identity &amp; Faith</h2>
          <p className="text-[#706B67] text-lg">Who you are culturally and spiritually — the foundation for finding a true match.</p>
        </div>

        {/* Cultural Heritage & Ethnicity */}
        <div>
          <Label className="text-[#333333] font-semibold text-base mb-2 block">Which best describes your heritage?</Label>
          <p className="text-[#8A857D] text-xs mb-3 leading-relaxed">
            <span className="font-semibold">Privacy:</span> Cultural heritage and ethnic background are sensitive personal data under data-protection law (GDPR Article 9). We process this solely to suggest more compatible matches, never share it with third parties, and you may choose "Prefer not to say." See our <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline text-[#C85A72]">Privacy Policy</a>.
          </p>
          {/* Phase 2G: counter shows progress against the 3-cap. */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-[#706B67] text-xs font-medium">Select up to {MAX_CULTURES}. Mix &amp; match if you identify with several.</p>
            <span className={`text-xs font-semibold tabular-nums ${selectedCultures.length === MAX_CULTURES ? 'text-[#C85A72]' : 'text-[#706B67]'}`} aria-live="polite">
              {selectedCultures.length} / {MAX_CULTURES}
            </span>
          </div>
          {/* role=group (not radiogroup) since this is now multi-select. Each item
              behaves like a checkbox — aria-checked + aria-disabled at the cap. */}
          <div role="group" aria-label="Cultural heritage and ethnicity (multi-select)" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cultures.map((culture) => {
              const isSelected = selectedCultures.includes(culture);
              const isAtCap = !isSelected && selectedCultures.length >= MAX_CULTURES;
              return (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-disabled={isAtCap}
                  disabled={isAtCap}
                  key={culture}
                  className={`p-4 rounded-xl transition-all border text-sm font-medium flex items-center gap-3 text-left w-full focus:outline-none focus:ring-2 focus:ring-[#E6B450] focus:ring-offset-1 ${
                    isSelected
                      ? 'bg-[#E6B450] text-white border-[#E6B450] shadow-md cursor-pointer'
                      : isAtCap
                        ? 'bg-[#FAF7F2] text-[#8A857D] border-[#E6DCD2] cursor-not-allowed opacity-60'
                        : 'bg-white text-[#333333] border-[#E6DCD2] hover:border-[#C85A72] cursor-pointer'
                  }`}
                  onClick={() => handleCultureToggle(culture)}
                >
                  <div aria-hidden="true" className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${isSelected ? 'bg-white border-white' : 'border-[#CFC6BA]'}`}>
                    {isSelected && (
                      <svg viewBox="0 0 12 12" className="w-3 h-3 text-[#E6B450]" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M2 6.5 L5 9.5 L10 3.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span>{culture}</span>
                </button>
              );
            })}
          </div>
          {isOtherCultureSelected && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <Input
                type="text"
                placeholder="Please specify your culture"
                value={formData.otherCultureText || ''}
                onChange={(e) => updateFormData('otherCultureText', e.target.value)}
                className="bg-white border-[#CFC6BA] text-[#1F1F1F] placeholder:text-[#8A857D] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl h-12 px-4"
              />
            </motion.div>
          )}
        </div>

        {/* Faith & Lifestyle */}
        <div>
            <Label className="text-[#333333] font-semibold text-base mb-4 block">Faith &amp; Lifestyle</Label>
            <div role="radiogroup" aria-label="Faith lifestyle" className="grid grid-cols-1 gap-3">
                {faithLifestyles.map((option) => {
                    const isSelected = formData.faithLifestyle === option;
                    return (
                        <button
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            key={option}
                            className={`p-4 rounded-xl cursor-pointer transition-all border text-sm font-medium flex items-center gap-3 text-left w-full focus:outline-none focus:ring-2 focus:ring-[#E6B450] focus:ring-offset-1 ${
                                isSelected
                                ? 'bg-[#E6B450] text-white border-[#E6B450] shadow-md'
                                : 'bg-white text-[#333333] border-[#E6DCD2] hover:border-[#C85A72]'
                            }`}
                            onClick={() => updateFormData('faithLifestyle', option)}
                        >
                            <div aria-hidden="true" className={`w-4 h-4 shrink-0 rounded-full border flex items-center justify-center ${isSelected ? 'border-white' : 'border-[#CFC6BA]'}`}>
                                {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                            <span>{option}</span>
                        </button>
                    )
                })}
            </div>
        </div>

        {/* Religious Affiliation */}
        <div>
             <Label htmlFor="religiousAffiliation" className="text-[#333333] font-semibold text-base mb-2 block">Religious Affiliation (Optional)</Label>
             <p className="text-[#706B67] text-sm mb-2">This helps us suggest more compatible matches.</p>
             <p className="text-[#8A857D] text-xs mb-3 leading-relaxed">
               <span className="font-semibold">Privacy:</span> Religious affiliation and your level of religious practice (selected above) are sensitive personal data under data-protection law (GDPR Article 9). We process this solely for matching, never share it with third parties, and you may leave this blank or choose "Prefer not to say." See our <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline text-[#C85A72]">Privacy Policy</a> for details.
             </p>
             <select
                id="religiousAffiliation"
                value={formData.religiousAffiliation || ''}
                onChange={(e) => updateFormData('religiousAffiliation', e.target.value)}
                className="flex h-12 w-full rounded-xl border border-[#CFC6BA] bg-white px-3 py-2 text-base text-[#1F1F1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6B450]"
              >
                <option value="">Select Affiliation...</option>
                {religiousAffiliations.map(rel => (
                    <option key={rel} value={rel}>{rel}</option>
                ))}
              </select>

              {isOtherReligionSelected && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3"
                >
                  <Input
                    type="text"
                    placeholder="Please specify your religious affiliation"
                    value={formData.otherReligiousAffiliation || ''}
                    onChange={(e) => updateFormData('otherReligiousAffiliation', e.target.value)}
                    className="bg-white border-[#CFC6BA] text-[#1F1F1F] placeholder:text-[#8A857D] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl h-12 px-4"
                  />
                </motion.div>
              )}
        </div>
      </div>
    </>
  );
};

export default Step3a;
