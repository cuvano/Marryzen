import React from 'react';
import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Step 3b — Your Lifestyle
 * ------------------------
 * Phase 2E split of the old monolithic Step 3. This screen owns the
 * practical day-to-day compatibility data: habits, family situation,
 * education, work, and core values.
 *
 * Fields:
 *   - Smoking / Drinking (dropdowns)
 *   - Marital History (dropdown)
 *   - Do you have children? + conditional "Do they live with you?"
 *   - Education Level (enum dropdown — writes to profiles.education)
 *   - Zodiac Sign (dropdown)
 *   - Education / Field of Study (free text — writes to profiles.field_of_study after Phase 2C migration)
 *   - Job / Profession (free text)
 *   - Core Values multi-select checkboxes
 */
const Step3b = ({ formData, updateFormData, coreValues }) => {

  const handleValueToggle = (value) => {
    const currentValues = formData.coreValues || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    updateFormData('coreValues', newValues);
  };

  return (
    <>
      <div className="space-y-10">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-4">Your Lifestyle</h2>
          <p className="text-[#706B67] text-lg">The everyday context for the life you want to build together.</p>
        </div>

        {/* Lifestyle Details */}
        <div className="p-6 bg-[#FAF7F2] rounded-xl border border-[#E6DCD2] space-y-6">
            <h3 className="font-bold text-[#1F1F1F] text-lg border-b border-[#E6DCD2] pb-2">Lifestyle Details</h3>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-[#333333] font-semibold text-sm">Smoking</Label>
                    <select
                        value={formData.smoking || ''}
                        onChange={(e) => updateFormData('smoking', e.target.value)}
                        className="w-full border border-[#E6DCD2] rounded-lg px-3 py-2 text-sm bg-white"
                    >
                        <option value="">Select...</option>
                        <option value="No">No</option>
                        <option value="Socially">Socially</option>
                        <option value="Regularly">Regularly</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <Label className="text-[#333333] font-semibold text-sm">Drinking</Label>
                    <select
                        value={formData.drinking || ''}
                        onChange={(e) => updateFormData('drinking', e.target.value)}
                        className="w-full border border-[#E6DCD2] rounded-lg px-3 py-2 text-sm bg-white"
                    >
                        <option value="">Select...</option>
                        <option value="No">No</option>
                        <option value="Socially">Socially</option>
                        <option value="Regularly">Regularly</option>
                    </select>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-[#333333] font-semibold text-sm">Marital History</Label>
                <select
                    value={formData.maritalHistory || ''}
                    onChange={(e) => updateFormData('maritalHistory', e.target.value)}
                    className="w-full border border-[#E6DCD2] rounded-lg px-3 py-2 text-sm bg-white"
                >
                    <option value="">Select...</option>
                    <option value="Never Married">Never Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Annulled">Annulled</option>
                </select>
            </div>

            <div className="space-y-2">
                <Label className="text-[#333333] font-semibold text-sm">Do you have children?</Label>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => updateFormData('hasChildren', true)}
                        className={`flex-1 py-3 rounded-lg border text-sm font-medium min-h-[44px] ${
                            formData.hasChildren === true
                                ? 'bg-[#E6B450] text-white border-[#E6B450]'
                                : 'bg-white text-[#333333] border-[#E6DCD2]'
                        }`}
                    >
                        Yes
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            updateFormData('hasChildren', false);
                            updateFormData('childrenLiveWithYou', undefined);
                        }}
                        className={`flex-1 py-3 rounded-lg border text-sm font-medium min-h-[44px] ${
                            formData.hasChildren === false
                                ? 'bg-[#E6B450] text-white border-[#E6B450]'
                                : 'bg-white text-[#333333] border-[#E6DCD2]'
                        }`}
                    >
                        No
                    </button>
                </div>
                {formData.hasChildren === true && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4"
                    >
                        <Label className="text-[#333333] font-semibold text-sm mb-2 block">Do they live with you?</Label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => updateFormData('childrenLiveWithYou', true)}
                                className={`flex-1 py-3 rounded-lg border text-sm font-medium min-h-[44px] ${
                                    formData.childrenLiveWithYou === true
                                        ? 'bg-[#E6B450] text-white border-[#E6B450]'
                                        : 'bg-white text-[#333333] border-[#E6DCD2]'
                                }`}
                            >
                                Yes
                            </button>
                            <button
                                type="button"
                                onClick={() => updateFormData('childrenLiveWithYou', false)}
                                className={`flex-1 py-3 rounded-lg border text-sm font-medium min-h-[44px] ${
                                    formData.childrenLiveWithYou === false
                                        ? 'bg-[#E6B450] text-white border-[#E6B450]'
                                        : 'bg-white text-[#333333] border-[#E6DCD2]'
                                }`}
                            >
                                No
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-[#333333] font-semibold text-sm">Education Level</Label>
                    <select
                        value={formData.educationLevel || ''}
                        onChange={(e) => updateFormData('educationLevel', e.target.value)}
                        className="w-full border border-[#E6DCD2] rounded-lg px-3 py-2 text-sm bg-white"
                    >
                        <option value="">Select...</option>
                        <option value="High School">High School</option>
                        <option value="Some College">Some College</option>
                        <option value="Bachelor's Degree">Bachelor's Degree</option>
                        <option value="Master's Degree">Master's Degree</option>
                        <option value="Doctorate">Doctorate</option>
                        <option value="Professional Degree">Professional Degree</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <Label className="text-[#333333] font-semibold text-sm">Zodiac Sign</Label>
                    <select
                        value={formData.zodiacSign || ''}
                        onChange={(e) => updateFormData('zodiacSign', e.target.value)}
                        className="w-full border border-[#E6DCD2] rounded-lg px-3 py-2 text-sm bg-white"
                    >
                        <option value="">Select...</option>
                        <option value="Aries">Aries</option>
                        <option value="Taurus">Taurus</option>
                        <option value="Gemini">Gemini</option>
                        <option value="Cancer">Cancer</option>
                        <option value="Leo">Leo</option>
                        <option value="Virgo">Virgo</option>
                        <option value="Libra">Libra</option>
                        <option value="Scorpio">Scorpio</option>
                        <option value="Sagittarius">Sagittarius</option>
                        <option value="Capricorn">Capricorn</option>
                        <option value="Aquarius">Aquarius</option>
                        <option value="Pisces">Pisces</option>
                    </select>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-[#333333] font-semibold text-sm">Education / Field of Study</Label>
                <input
                    type="text"
                    value={formData.education || ''}
                    onChange={(e) => updateFormData('education', e.target.value)}
                    placeholder="e.g., Computer Science, Business Administration"
                    className="w-full border border-[#E6DCD2] rounded-lg px-3 py-2 text-sm bg-white"
                />
            </div>

            <div className="space-y-2">
                <Label className="text-[#333333] font-semibold text-sm">Job / Profession</Label>
                <input
                    type="text"
                    value={formData.job || ''}
                    onChange={(e) => updateFormData('job', e.target.value)}
                    placeholder="e.g., Software Engineer, Teacher, Doctor"
                    className="w-full border border-[#E6DCD2] rounded-lg px-3 py-2 text-sm bg-white"
                />
            </div>
        </div>

        {/* Core Values */}
        <div>
          <Label className="text-[#333333] font-semibold text-base mb-4 block">What Matters Most To You? (Select all that apply):</Label>
          <div className="grid grid-cols-1 gap-3">
            {coreValues.map((value) => (
              <div key={value} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${formData.coreValues?.includes(value) ? 'bg-[#FAF7F2] border border-[#E6DCD2]' : 'bg-white border border-transparent hover:bg-[#FAF7F2]'}`}>
                <Checkbox
                  id={value}
                  checked={formData.coreValues?.includes(value)}
                  onCheckedChange={() => handleValueToggle(value)}
                  className="shrink-0 border-[#C85A72] data-[state=checked]:bg-[#E6B450] data-[state=checked]:border-[#E6B450] w-5 h-5"
                />
                <Label htmlFor={value} className="text-[#1F1F1F] text-sm font-medium cursor-pointer text-left flex-1">
                  {value}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Step3b;
