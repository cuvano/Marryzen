import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

const Step5 = ({ formData, updateFormData, isEditMode = false }) => {
  // Marriage intent — reframed per session-11 board verdict.
  // IMPORTANT: `value` is the DB-stored string (back-compat with existing
  // profiles). `label` is the warmer display string (new). Reviewer caught
  // the breaking-rename risk — we use the display-label pattern instead.
  // The 4th option ('Family-Supervised Courtship') is genuinely new but its
  // value string is stable from launch.
  const marriageIntents = [
    {
      value: 'Traditional Marriage Mindset',
      label: 'Marriage First — No Dating Period',
      description: 'I am only interested in communication that leads directly to marriage.'
    },
    {
      value: 'Marriage Within 1–2 Years',
      label: 'Marriage Within 1 to 2 Years',
      description: 'I am actively preparing for marriage within the next 1 to 2 years.'
    },
    {
      value: 'Family-Supervised Courtship',
      label: 'Family-Supervised Courtship',
      description: 'I want my family involved during a longer courtship that leads to marriage.'
    },
    {
      value: 'Serious Relationship → Marriage',
      label: 'Serious Relationship Leading to Marriage',
      description: 'I want to build a serious relationship that leads to marriage at the right time.'
    }
  ];

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

      </div>
      
    </>
  );
};

export default Step5;
