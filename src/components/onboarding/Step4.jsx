import React from 'react';
import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

const Step4 = ({ formData, updateFormData, languages }) => {
  const handleLanguageToggle = (language) => {
    const currentLanguages = formData.languages || [];
    const newLanguages = currentLanguages.includes(language)
      ? currentLanguages.filter(l => l !== language)
      : [...currentLanguages, language];
    updateFormData('languages', newLanguages);
  };
  
  const handleCommPrefToggle = (pref) => {
      // Ensure it's treated as an array if multiselect is desired, or keep as string?
      // Step 3 used toggle for multiselect. Previous Step 4 used string for single select.
      // Prompt says "Add Video calls to Preferred Communication Style".
      // Usually these are multiselect. Let's make it multiselect for better UX.
      // But we need to check if formData.communicationPreference is array or string.
      // In OnboardingPage init, it was string. I'll treat it as array now.
      
      const current = Array.isArray(formData.communicationPreference) ? formData.communicationPreference : (formData.communicationPreference ? [formData.communicationPreference] : []);
      const newPrefs = current.includes(pref) 
        ? current.filter(p => p !== pref) 
        : [...current, pref];
      updateFormData('communicationPreference', newPrefs);
  };

  const isOtherLanguageSelected = formData.languages?.includes('Other');
  
  const commPreferences = [
      'Text first', 
      'Voice call after matching', 
      'Video calls', // Added
      'Family-involved communication', 
      'Open to all'
  ];
  
  const relocationOptions = ['Yes', 'No', 'Maybe'];
  
  const familyGoalOptions = [
      'Want children (1-2)',
      'Want children (2-3)',
      'Want children (3-4)',
      'Want children (5+)',
      'Open to children',
      'Don\'t want children'
  ];

  return (
    <>
      <div className="space-y-10">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-4">Tell Your Story</h2>
          <p className="text-[#706B67] text-lg">Your story helps create deeper, more meaningful matches.</p>
        </div>
        
        {/* Bio Section */}
        <div className="space-y-3">
          <Label htmlFor="bio" className="text-[#333333] font-semibold text-base block">About You</Label>
          <Textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => updateFormData('bio', e.target.value)}
            className={`bg-white border text-[#1F1F1F] placeholder:text-[#8A857D] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl min-h-[160px] p-4 text-base leading-relaxed ${formData.bio && formData.bio.length < 50 ? 'border-red-400' : 'border-[#CFC6BA]'}`}
            placeholder="Share a little about your personality, lifestyle, values, family outlook, and what you are hoping to find in a life partner..."
          />
          <div className="flex justify-between text-sm mt-1">
             {formData.bio && formData.bio.length < 50 ? (
                 <p className="text-red-500 font-medium">Please enter at least 50 characters.</p>
             ) : (
                 <div />
             )}
             <p className="text-[#706B67]">{formData.bio ? formData.bio.length : 0} / 50 min</p>
          </div>
        </div>
        
        {/* Lifestyle & Future Goals Section - NEW */}
        <div className="p-6 bg-[#FAF7F2] rounded-xl border border-[#E6DCD2] space-y-6">
            <h3 className="font-bold text-[#1F1F1F] text-lg border-b border-[#E6DCD2] pb-2">Lifestyle & Future Goals</h3>
            
            {/* Relocation */}
            <div>
                <Label className="text-[#333333] font-semibold text-base mb-3 block">Willingness to Relocate</Label>
                <div className="flex flex-wrap gap-3">
                    {relocationOptions.map(opt => (
                        <div 
                            key={opt}
                            className={`px-4 py-2 rounded-lg cursor-pointer transition-all border text-sm font-medium ${
                                formData.willingToRelocate === opt
                                ? 'bg-[#E6B450] text-white border-[#E6B450]'
                                : 'bg-white text-[#333333] border-[#E6DCD2] hover:border-[#C85A72]'
                            }`}
                            onClick={() => updateFormData('willingToRelocate', opt)}
                        >
                            {opt}
                        </div>
                    ))}
                </div>
            </div>

            {/* Family Goals */}
             <div>
                <Label className="text-[#333333] font-semibold text-base mb-3 block">Long-Term Family Goals</Label>
                <div className="grid sm:grid-cols-2 gap-3">
                    {familyGoalOptions.map(opt => (
                        <div 
                            key={opt}
                            className={`px-4 py-3 rounded-lg cursor-pointer transition-all border text-sm font-medium flex items-center gap-2 ${
                                formData.familyGoals === opt
                                ? 'bg-[#E6B450] text-white border-[#E6B450]'
                                : 'bg-white text-[#333333] border-[#E6DCD2] hover:border-[#C85A72]'
                            }`}
                            onClick={() => updateFormData('familyGoals', opt)}
                        >
                             <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${formData.familyGoals === opt ? 'border-white' : 'border-[#CFC6BA]'}`}>
                                {formData.familyGoals === opt && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                            {opt}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Languages Section */}
        <div>
          <Label className="text-[#333333] font-semibold text-base mb-2 block">Languages You Can Communicate In</Label>
          <p className="text-[#706B67] text-sm mb-4">Select all languages you can comfortably communicate in.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {languages.map((language) => (
              <div key={language} className={`flex items-center space-x-3 p-3 rounded-xl transition-colors ${formData.languages?.includes(language) ? 'bg-[#FAF7F2] border border-[#E6DCD2]' : 'bg-white border border-transparent hover:bg-[#FAF7F2]'}`}>
                <Checkbox
                  id={language}
                  checked={formData.languages?.includes(language)}
                  onCheckedChange={() => handleLanguageToggle(language)}
                  className="border-[#C85A72] data-[state=checked]:bg-[#E6B450] data-[state=checked]:border-[#E6B450] w-5 h-5"
                />
                <Label htmlFor={language} className="text-[#1F1F1F] text-sm font-medium cursor-pointer">
                  {language}
                </Label>
              </div>
            ))}
          </div>
           {isOtherLanguageSelected && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <Input
                type="text"
                placeholder="Please specify language"
                value={formData.otherLanguageText || ''}
                onChange={(e) => updateFormData('otherLanguageText', e.target.value)}
                className="bg-white border-[#CFC6BA] text-[#1F1F1F] placeholder:text-[#8A857D] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl h-12 px-4"
              />
            </motion.div>
          )}
        </div>

        {/* Communication Preferences */}
        <div>
             <Label className="text-[#333333] font-semibold text-base mb-4 block">Communication Preference (Optional)</Label>
             <div className="grid sm:grid-cols-2 gap-4">
                {commPreferences.map((pref) => {
                    const current = Array.isArray(formData.communicationPreference) ? formData.communicationPreference : (formData.communicationPreference ? [formData.communicationPreference] : []);
                    const isSelected = current.includes(pref);
                    return (
                        <div 
                            key={pref}
                            className={`p-4 rounded-xl cursor-pointer transition-all border text-sm font-medium flex items-center gap-3 ${
                                isSelected
                                ? 'bg-[#E6B450] text-white border-[#E6B450] shadow-md'
                                : 'bg-white text-[#333333] border-[#E6DCD2] hover:border-[#C85A72]'
                            }`}
                            onClick={() => handleCommPrefToggle(pref)}
                        >
                           <Checkbox
                                id={pref}
                                checked={isSelected}
                                className={`border-[#C85A72] data-[state=checked]:bg-white data-[state=checked]:text-[#E6B450] data-[state=checked]:border-white pointer-events-none`}
                            />
                            {pref}
                        </div>
                    )
                })}
             </div>
        </div>

      </div>
    </>
  );
};

export default Step4;