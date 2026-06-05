import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { SANCTIONED_RESIDENCE, filterResidenceCountries } from '@/lib/sanctionedJurisdictions';

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

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
  "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
];

/**
 * Step 1b — A little about you (Phase 2F split)
 * ----------------------------------------------
 * Identity + location. Owns: DOB (18+ check), Country of Residence
 * (with sanctions filter), Country of Origin, State (if US) + City,
 * Gender (Man/Woman with auto-flip on lookingForGender).
 */
const Step1b = ({ formData, updateFormData, errors = {} }) => {
  const [ageError, setAgeError] = useState(false);

  const checkAge = (dob) => {
    if (!dob) return;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    setAgeError(age < 18);
  };

  useEffect(() => {
    checkAge(formData.dateOfBirth);
  }, [formData.dateOfBirth]);

  const handleGenderChange = (gender) => {
    const lookingFor = gender === 'Man' ? 'Woman' : 'Man';
    updateFormData('identifyAs', gender);
    updateFormData('lookingForGender', lookingFor);
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-4">A little about you</h2>
        <p className="text-[#706B67] text-lg font-medium">Help us find members compatible with where you are in life.</p>
      </div>

      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth" className="text-[#333333] font-bold text-base">Date of Birth</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => updateFormData('dateOfBirth', e.target.value)}
            className={`bg-white border-[#CFC6BA] text-[#1F1F1F] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl h-12 px-4 ${ageError ? 'border-red-500 focus:border-red-500' : ''}`}
          />
          {ageError && (
            <p className="text-red-500 text-sm mt-1 flex items-center font-medium">
              <AlertCircle className="w-4 h-4 mr-1" />
              You must be 18 or older to use Marryzen.
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="locationCountry" className="text-[#333333] font-bold text-base">Country of Residence</Label>
            <select
              id="locationCountry"
              value={formData.locationCountry}
              onChange={(e) => updateFormData('locationCountry', e.target.value)}
              className="flex h-12 w-full rounded-xl border border-[#CFC6BA] bg-white px-3 py-2 text-base text-[#1F1F1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6B450]"
            >
              <option value="">Select Country...</option>
              {COUNTRIES.map(country => {
                const isBlocked = SANCTIONED_RESIDENCE.includes(country);
                return (
                  <option key={country} value={country} disabled={isBlocked}>
                    {country}{isBlocked ? ' — coming soon' : ''}
                  </option>
                );
              })}
            </select>
            <p className="text-[#706B67] text-xs mt-1 font-medium">
              Marryzen is growing carefully so we can serve every couple well. Countries marked "coming soon" aren't open yet — email <a href="mailto:admin@marryzen.com?subject=Marryzen%20waitlist%20-%20add%20my%20country" className="text-[#C85A72] underline">admin@marryzen.com</a> with your country and we'll let you know the moment we arrive.
            </p>
            {errors.locationCountry && (
              <p className="text-red-500 text-sm mt-1">{errors.locationCountry}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="countryOfOrigin" className="text-[#333333] font-bold text-base">Country of Origin</Label>
            <select
              id="countryOfOrigin"
              value={formData.countryOfOrigin || ''}
              onChange={(e) => updateFormData('countryOfOrigin', e.target.value)}
              className="flex h-12 w-full rounded-xl border border-[#CFC6BA] bg-white px-3 py-2 text-base text-[#1F1F1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6B450]"
            >
              <option value="">Select Country...</option>
              {COUNTRIES.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
            <p className="text-[#706B67] text-xs mt-1 font-medium">
              The country you most identify with culturally or where your family is from.
            </p>
          </div>

          {formData.locationCountry === 'United States' ? (
            <div className="space-y-2">
              <Label htmlFor="locationState" className="text-[#333333] font-bold text-base">State</Label>
              <select
                id="locationState"
                value={formData.locationState}
                onChange={(e) => updateFormData('locationState', e.target.value)}
                className="flex h-12 w-full rounded-xl border border-[#CFC6BA] bg-white px-3 py-2 text-base text-[#1F1F1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6B450]"
              >
                <option value="">Select State...</option>
                {US_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="locationCity" className="text-[#333333] font-bold text-base">City</Label>
              <Input
                id="locationCity"
                value={formData.locationCity}
                onChange={(e) => updateFormData('locationCity', e.target.value)}
                maxLength={120}
                className="bg-white border-[#CFC6BA] text-[#1F1F1F] placeholder:text-[#8A857D] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl h-12 px-4"
                placeholder="Enter City"
              />
            </div>
          )}
        </div>

        {formData.locationCountry === 'United States' && (
          <div className="space-y-2">
            <Label htmlFor="locationCity" className="text-[#333333] font-bold text-base">City</Label>
            <Input
              id="locationCity"
              value={formData.locationCity}
              onChange={(e) => updateFormData('locationCity', e.target.value)}
              maxLength={120}
              className="bg-white border-[#CFC6BA] text-[#1F1F1F] placeholder:text-[#8A857D] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl h-12 px-4"
              placeholder="Enter City"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label id="identifyAs" htmlFor="identifyAs" className="text-[#333333] font-bold text-base">I am a</Label>
          <p id="gender-disclosure" className="text-[#706B67] text-xs font-medium -mt-1">Marryzen connects men and women for marriage. We do not currently support same-sex matching.</p>
          <div role="radiogroup" aria-labelledby="identifyAs" aria-describedby="gender-disclosure" className="grid grid-cols-2 gap-4">
            <button
              type="button"
              role="radio"
              aria-checked={formData.identifyAs === 'Man'}
              onClick={() => handleGenderChange('Man')}
              className={`h-12 rounded-xl border text-base font-medium transition-all ${
                formData.identifyAs === 'Man'
                  ? 'border-[#E6B450] bg-[#E6B450] text-[#1F1F1F] shadow-sm'
                  : 'border-[#CFC6BA] bg-white text-[#333333] hover:border-[#E6B450]'
              }`}
            >
              Man
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={formData.identifyAs === 'Woman'}
              onClick={() => handleGenderChange('Woman')}
              className={`h-12 rounded-xl border text-base font-medium transition-all ${
                formData.identifyAs === 'Woman'
                  ? 'border-[#E6B450] bg-[#E6B450] text-[#1F1F1F] shadow-sm'
                  : 'border-[#CFC6BA] bg-white text-[#333333] hover:border-[#E6B450]'
              }`}
            >
              Woman
            </button>
          </div>
          {formData.identifyAs && (
            <p className="text-xs text-[#706B67] mt-1 font-medium">
              You will be matched with: <span className="font-bold">{formData.identifyAs === 'Man' ? 'Women' : 'Men'}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Step1b;
