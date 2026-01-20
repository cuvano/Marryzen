import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Lock, Crown, ChevronDown, ChevronUp } from 'lucide-react';

// Full list of countries (matching onboarding)
const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "East Timor (Timor-Leste)", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar (formerly Burma)",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Türkiye", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe"
].sort();

const FilterPanel = ({ filters, setFilters, isPremium, onApply, onClose, resultsCount, onClear, onSave, onPremiumFeatureClick }) => {
  const [expandedLanguages, setExpandedLanguages] = useState(false);

  const handleChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleMultiSelectToggle = (key, value) => {
    const current = filters[key] || [];
    const newValue = current.includes(value)
      ? current.filter(item => item !== value)
      : [...current, value];
    handleChange(key, newValue);
  };

  const handleClearAll = () => {
    const defaultFilters = {
      ageRange: [18, 65],
      distance: 50,
      city: '',
      faith: '',
      faithLifestyle: '',
      smoking: '',
      drinking: '',
      maritalStatus: '',
      hasChildren: '',
      educationLevel: '',
      relationshipGoal: '',
      languages: [],
      zodiacSign: '',
      countries: [],
      recentActive: false,
      verifiedOnly: false
    };
    setFilters(defaultFilters);
    if (onClear) {
      onClear(defaultFilters);
    }
    // Also trigger apply to refresh results immediately
    if (onApply) {
      onApply();
    }
  };

  const PremiumLock = ({ children, label, feature }) => {
    if (isPremium) return children;
    return (
      <div className="relative group">
        <div className="opacity-40 pointer-events-none filter blur-[1px] select-none">
          {children}
        </div>
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={() => onPremiumFeatureClick && onPremiumFeatureClick(feature || 'advanced_filters')}
        >
            <div className="bg-[#1F1F1F] text-[#E6B450] text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg border border-[#E6B450]/30 font-bold z-10 hover:bg-[#2a2a2a] transition-colors">
                <Lock size={10} /> Premium: {label}
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-[#E6DCD2]">
      <div className="p-5 border-b border-[#E6DCD2] flex justify-between items-center bg-[#FAF7F2]">
        <h2 className="font-bold text-lg text-[#1F1F1F]">Filters</h2>
        <Button variant="ghost" size="sm" onClick={onClose} className="md:hidden">Close</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <Accordion type="multiple" defaultValue={["basic", "lifestyle"]} className="space-y-4">
          
          {/* Basic Filters Section */}
          <AccordionItem value="basic" className="border-b-0">
            <AccordionTrigger className="hover:no-underline font-bold text-[#1F1F1F]">Basic Filters</AccordionTrigger>
            <AccordionContent className="space-y-6 pt-2">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Age Range</Label>
                  <span className="text-sm font-semibold text-[#1F1F1F]">{filters.ageRange[0]} - {filters.ageRange[1]}</span>
                </div>
                <Slider 
                  value={filters.ageRange} 
                  min={18} 
                  max={70} 
                  step={1} 
                  minStepsBetweenThumbs={1}
                  onValueChange={(v) => handleChange('ageRange', v)} 
                />
              </div>

              <div className="space-y-2">
                <Label>Religious Affiliation</Label>
                <select 
                    className="w-full border border-[#E6DCD2] rounded-md px-3 py-2 text-sm bg-white"
                    value={filters.faith || ''}
                    onChange={(e) => handleChange('faith', e.target.value)}
                >
                    <option value="">Any</option>
                    <option value="Islam">Islam</option>
                    <option value="Christianity">Christianity</option>
                    <option value="Judaism">Judaism</option>
                    <option value="Hinduism">Hinduism</option>
                    <option value="Sikhism">Sikhism</option>
                    <option value="Buddhism">Buddhism</option>
                    <option value="Spiritual but not religious">Spiritual but not religious</option>
                    <option value="Atheist">Atheist</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Faith Lifestyle</Label>
                <select 
                    className="w-full border border-[#E6DCD2] rounded-md px-3 py-2 text-sm bg-white"
                    value={filters.faithLifestyle || ''}
                    onChange={(e) => handleChange('faithLifestyle', e.target.value)}
                >
                    <option value="">Any</option>
                    <option value="Very religious / practicing">Very religious / practicing</option>
                    <option value="Moderately practicing">Moderately practicing</option>
                    <option value="Cultural faith only">Cultural faith only</option>
                    <option value="Spiritual but not religious">Spiritual but not religious</option>
                    <option value="Not religious / Not practicing">Not religious / Not practicing</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Marital History</Label>
                <select className="w-full border border-[#E6DCD2] rounded-md px-3 py-2 text-sm bg-white" value={filters.maritalStatus || ''} onChange={(e) => handleChange('maritalStatus', e.target.value)}>
                  <option value="">Any</option>
                  <option value="Never Married">Never Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Annulled">Annulled</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label>Children</Label>
                <select className="w-full border border-[#E6DCD2] rounded-md px-3 py-2 text-sm bg-white" value={filters.hasChildren || ''} onChange={(e) => handleChange('hasChildren', e.target.value)}>
                  <option value="">Any</option>
                  <option value="false">No Children</option>
                  <option value="true">Has Children</option>
                </select>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Premium Filters Section */}
          <AccordionItem value="premium" className="border-b-0">
             <AccordionTrigger className="hover:no-underline font-bold text-[#1F1F1F] flex items-center gap-2">
                Premium Filters <Crown className="w-3 h-3 text-[#E6B450]" />
             </AccordionTrigger>
             <AccordionContent className="space-y-4 pt-2">
                <PremiumLock label="Activity" feature="advanced_filters">
                    <div className="flex items-center justify-between space-x-2">
                        <Label>Recently Active (Last 30 Days)</Label>
                        <Switch checked={filters.recentActive || false} onCheckedChange={(v) => handleChange('recentActive', v)} />
                    </div>
                </PremiumLock>
                
                <PremiumLock label="Verification" feature="advanced_filters">
                    <div className="flex items-center justify-between space-x-2">
                        <Label>Verified Profiles Only</Label>
                        <Switch checked={filters.verifiedOnly || false} onCheckedChange={(v) => handleChange('verifiedOnly', v)} />
                    </div>
                </PremiumLock>

                <PremiumLock label="Distance" feature="advanced_filters">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Distance (km)</Label>
                      <span className="text-xs font-medium text-[#706B67]">{filters.distance || 50} km</span>
                    </div>
                    <Slider 
                      value={[filters.distance || 50]} 
                      min={5} max={500} step={5} 
                      onValueChange={(v) => handleChange('distance', v[0])} 
                    />
                  </div>
                </PremiumLock>

                <PremiumLock label="Location" feature="advanced_filters">
                  <div className="space-y-2">
                    <Label>Countries (Multiple Selection)</Label>
                    <div className="border border-[#E6DCD2] rounded-md bg-white max-h-[200px] overflow-y-auto p-2">
                      <div className="grid grid-cols-1 gap-2">
                        {COUNTRIES.map(country => (
                          <label
                            key={country}
                            className="flex items-center space-x-2 p-2 rounded hover:bg-[#FAF7F2] cursor-pointer"
                          >
                            <Checkbox
                              checked={(filters.countries || []).includes(country)}
                              onCheckedChange={() => handleMultiSelectToggle('countries', country)}
                              className="border-[#E6DCD2] data-[state=checked]:bg-[#E6B450] data-[state=checked]:border-[#E6B450]"
                            />
                            <span className="text-sm text-[#1F1F1F]">{country}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {filters.countries && filters.countries.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {filters.countries.map(country => (
                          <Badge key={country} variant="secondary" className="text-xs">
                            {country}
                            <button 
                              onClick={() => handleChange('countries', filters.countries.filter(c => c !== country))}
                              className="ml-1 hover:text-red-500"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </PremiumLock>

                <PremiumLock label="Education" feature="advanced_filters">
                  <div className="space-y-2">
                    <Label>Education Level</Label>
                    <select className="w-full border border-[#E6DCD2] rounded-md px-3 py-2 text-sm bg-white" value={filters.educationLevel || ''} onChange={(e) => handleChange('educationLevel', e.target.value)}>
                      <option value="">Any</option>
                      <option value="High School">High School</option>
                      <option value="Some College">Some College</option>
                      <option value="Bachelor's Degree">Bachelor's Degree</option>
                      <option value="Master's Degree">Master's Degree</option>
                      <option value="Doctorate">Doctorate</option>
                      <option value="Professional Degree">Professional Degree</option>
                    </select>
                  </div>
                </PremiumLock>

                <PremiumLock label="Languages" feature="advanced_filters">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Languages (Multiple Selection)</Label>
                      <button
                        onClick={() => setExpandedLanguages(!expandedLanguages)}
                        className="text-xs text-[#E6B450] hover:text-[#D0A23D] flex items-center gap-1"
                      >
                        {expandedLanguages ? (
                          <>Show Less <ChevronUp className="w-3 h-3" /></>
                        ) : (
                          <>Show All <ChevronDown className="w-3 h-3" /></>
                        )}
                      </button>
                    </div>
                    <div className="border border-[#E6DCD2] rounded-md bg-white max-h-[200px] overflow-y-auto p-2">
                      <div className="grid grid-cols-1 gap-2">
                        {(() => {
                          const allLanguages = [
                            'English', 'Spanish', 'French', 'Arabic', 'Turkish', 'Hindi', 'Portuguese',
                            'Russian', 'Mandarin (Chinese)', 'Japanese', 'Korean', 'Urdu', 'German',
                            'Italian', 'Persian (Farsi)', 'Bengali', 'Polish', 'Dutch', 'Swahili',
                            'Indonesian', 'Other'
                          ];
                          return expandedLanguages ? allLanguages : allLanguages.slice(0, 10);
                        })().map(lang => (
                          <label
                            key={lang}
                            className="flex items-center space-x-2 p-2 rounded hover:bg-[#FAF7F2] cursor-pointer"
                          >
                            <Checkbox
                              checked={(filters.languages || []).includes(lang)}
                              onCheckedChange={() => handleMultiSelectToggle('languages', lang)}
                              className="border-[#E6DCD2] data-[state=checked]:bg-[#E6B450] data-[state=checked]:border-[#E6B450]"
                            />
                            <span className="text-sm text-[#1F1F1F]">{lang}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {filters.languages && filters.languages.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {filters.languages.map(lang => (
                          <Badge key={lang} variant="secondary" className="text-xs">
                            {lang}
                            <button 
                              onClick={() => handleChange('languages', filters.languages.filter(l => l !== lang))}
                              className="ml-1 hover:text-red-500"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </PremiumLock>

                <PremiumLock label="Zodiac" feature="advanced_filters">
                  <div className="space-y-2">
                    <Label>Zodiac Sign</Label>
                    <select className="w-full border border-[#E6DCD2] rounded-md px-3 py-2 text-sm bg-white" value={filters.zodiacSign || ''} onChange={(e) => handleChange('zodiacSign', e.target.value)}>
                      <option value="">Any</option>
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
                </PremiumLock>
             </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>

      <div className="p-5 border-t border-[#E6DCD2] bg-[#FAF7F2] space-y-3">
         <div className="flex justify-between items-center text-sm">
             <span className="text-[#706B67] font-medium">{resultsCount} {resultsCount === 1 ? 'profile' : 'profiles'} match</span>
             <Button 
               variant="link" 
               className="text-[#C85A72] h-auto p-0 hover:text-[#9F4758] font-medium" 
               onClick={handleClearAll}
             >
               Clear All
             </Button>
         </div>
         <div className="flex gap-2">
           {onSave && (
             <Button 
               variant="outline" 
               onClick={onSave} 
               className="flex-1 border-[#E6B450] text-[#E6B450] hover:bg-[#FFFBEB]"
             >
               Save Search
             </Button>
           )}
           <Button onClick={onApply} className={`${onSave ? 'flex-1' : 'w-full'} bg-[#1F1F1F] text-white hover:bg-[#333333]`}>
             Apply Filters
           </Button>
         </div>
      </div>
    </div>
  );
};

export default FilterPanel;