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
 *   - Cultural Heritage & Ethnicity (single-select, with Art.9 disclosure)
 *   - Faith & Lifestyle (single-select level-of-practice radio group)
 *   - Religious Affiliation (optional dropdown, with Art.9 disclosure)
 */
const Step3a = ({ formData, updateFormData, cultures }) => {

  const handleCultureToggle = (culture) => {
    const currentCulture = formData.cultures?.[0];
    if (currentCulture === culture) {
      updateFormData('cultures', []);
      updateFormData('otherCultureText', '');
    } else {
      updateFormData('cultures', [culture]);
      if (culture !== 'Other') {
        updateFormData('otherCultureText', '');
      }
    }
  };

  const isOtherCultureSelected = formData.cultures?.[0] === 'Other';
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
          <div role="radiogroup" aria-label="Cultural heritage and ethnicity" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cultures.map((culture) => {
              const isSelected = formData.cultures?.[0] === culture;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  key={culture}
                  className={`p-4 rounded-xl cursor-pointer transition-all border text-sm font-medium flex items-center gap-3 text-left w-full focus:outline-none focus:ring-2 focus:ring-[#E6B450] focus:ring-offset-1 ${
                    isSelected
                      ? 'bg-[#E6B450] text-white border-[#E6B450] shadow-md'
                      : 'bg-white text-[#333333] border-[#E6DCD2] hover:border-[#C85A72]'
                  }`}
                  onClick={() => handleCultureToggle(culture)}
                >
                  <div aria-hidden="true" className={`w-4 h-4 shrink-0 rounded-full border flex items-center justify-center ${isSelected ? 'border-white' : 'border-[#CFC6BA]'}`}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
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
