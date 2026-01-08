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