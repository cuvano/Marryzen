import React from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const Step3 = ({ formData, updateFormData, cultures, coreValues }) => {

  const handleCultureToggle = (culture) => {
    const currentCultures = formData.cultures || [];
    const newCultures = currentCultures.includes(culture)
      ? currentCultures.filter(c => c !== culture)
      : [...currentCultures, culture];
    updateFormData('cultures', newCultures);
  };
  
  const handleValueToggle = (value) => {
    const currentValues = formData.coreValues || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    updateFormData('coreValues', newValues);
  };

  const isOtherCultureSelected = formData.cultures?.includes('Other');
  const isOtherReligionSelected = formData.religiousAffiliation === 'Other';

  const religiousAffiliations = ['Islam', 'Christianity', 'Judaism', 'Hinduism', 'Buddhism', 'Sikhism', 'Atheist', 'Spiritual but not religious', 'Other', 'Prefer not to say'];
  const faithLifestyles = ['Very religious / practicing', 'Moderately practicing', 'Cultural faith only', 'Spiritual but not religious', 'Not religious / Not practicing', 'Prefer not to say'];

  return (
    <>
      <div className="space-y-10">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-4">Cultural Background & Heritage</h2>
          <p className="text-[#706B67] text-lg">Match with someone who truly shares your values and lifestyle.</p>
        </div>
        
        <div>
          <Label className="text-[#333333] font-semibold text-base mb-4 block">Select all cultures you identify with:</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cultures.map((culture) => {
              const isSelected = formData.cultures?.includes(culture);
              return (
                <div
                  key={culture}
                  className={`p-4 rounded-xl cursor-pointer transition-all text-center border text-sm font-medium ${
                    isSelected
                      ? 'bg-[#E6B450] text-white border-[#E6B450] shadow-md'
                      : 'bg-white text-[#333333] border-[#E6DCD2] hover:border-[#C85A72]'
                  }`}
                  onClick={() => handleCultureToggle(culture)}
                >
                  {culture}
                </div>
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
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                            formData.hasChildren === true
                                ? 'bg-[#E6B450] text-white border-[#E6B450]'
                                : 'bg-white text-[#333333] border-[#E6DCD2]'
                        }`}
                    >
                        Yes
                    </button>
                    <button
                        type="button"
                        onClick={() => updateFormData('hasChildren', false)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                            formData.hasChildren === false
                                ? 'bg-[#E6B450] text-white border-[#E6B450]'
                                : 'bg-white text-[#333333] border-[#E6DCD2]'
                        }`}
                    >
                        No
                    </button>
                </div>
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

        {/* Faith & Lifestyle */}
        <div>
            <Label className="text-[#333333] font-semibold text-base mb-4 block">Faith & Lifestyle</Label>
            <div className="grid grid-cols-1 gap-3">
                {faithLifestyles.map((option) => {
                    const isSelected = formData.faithLifestyle === option;
                    return (
                        <div 
                            key={option}
                            className={`p-4 rounded-xl cursor-pointer transition-all border text-sm font-medium flex items-center gap-3 ${
                                isSelected
                                ? 'bg-[#E6B450] text-white border-[#E6B450] shadow-md'
                                : 'bg-white text-[#333333] border-[#E6DCD2] hover:border-[#C85A72]'
                            }`}
                            onClick={() => updateFormData('faithLifestyle', option)}
                        >
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-white' : 'border-[#CFC6BA]'}`}>
                                {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                            {option}
                        </div>
                    )
                })}
            </div>
        </div>

        {/* Religious Affiliation */}
        <div>
             <Label htmlFor="religiousAffiliation" className="text-[#333333] font-semibold text-base mb-2 block">Religious Affiliation (Optional)</Label>
             <p className="text-[#706B67] text-sm mb-3">This helps us suggest more compatible matches.</p>
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
        
        <div>
          <Label className="text-[#333333] font-semibold text-base mb-4 block">What Matters Most To You? (Select all that apply):</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {coreValues.map((value) => (
              <div key={value} className={`flex items-center space-x-3 p-3 rounded-xl transition-colors ${formData.coreValues?.includes(value) ? 'bg-[#FAF7F2] border border-[#E6DCD2]' : 'bg-white border border-transparent hover:bg-[#FAF7F2]'}`}>
                <Checkbox
                  id={value}
                  checked={formData.coreValues?.includes(value)}
                  onCheckedChange={() => handleValueToggle(value)}
                  className="border-[#C85A72] data-[state=checked]:bg-[#E6B450] data-[state=checked]:border-[#E6B450] w-5 h-5"
                />
                <Label htmlFor={value} className="text-[#1F1F1F] text-sm font-medium cursor-pointer">
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

export default Step3;