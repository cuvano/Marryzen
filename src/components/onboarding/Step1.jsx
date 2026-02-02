import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { isRecaptchaEnabled } from '@/lib/recaptcha';

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

const Step1 = ({ formData, updateFormData, errors = {}, isEditMode = false }) => {
  const navigate = useNavigate();
  const [ageError, setAgeError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    // Automatically set lookingFor based on gender
    const lookingFor = gender === 'Man' ? 'Woman' : 'Man';
    updateFormData('identifyAs', gender);
    updateFormData('lookingForGender', lookingFor);
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-4">Tell Us About Yourself</h2>
        <p className="text-[#706B67] text-lg font-medium">We'll start with a few basics to find matches that truly fit you.</p>
      </div>
      
      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-[#333333] font-bold text-base">Full Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateFormData('name', e.target.value)}
            className={`bg-white border-[#CFC6BA] text-[#1F1F1F] placeholder:text-[#8A857D] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl h-12 px-4 ${errors.name ? 'border-red-500 focus:border-red-500' : ''}`}
            placeholder="Enter your full name"
          />
          {errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[#333333] font-bold text-base">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => updateFormData('email', e.target.value)}
            className={`bg-white border-[#CFC6BA] text-[#1F1F1F] placeholder:text-[#8A857D] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl h-12 px-4 ${errors.email ? 'border-red-500 focus:border-red-500' : ''}`}
            placeholder="your@email.com"
          />
          {errors.email ? (
              <div className="flex flex-col gap-1">
                  <p className="text-red-500 text-sm">{errors.email}</p>
                  {errors.email.includes("already registered") && (
                      <button onClick={() => navigate('/login')} className="text-[#C85A72] text-sm font-bold hover:underline self-start">
                          Go to Login
                      </button>
                  )}
              </div>
          ) : (
            <p className="text-[#706B67] text-xs mt-1 font-medium">We'll never share your email with other members.</p>
          )}
        </div>
        
        {/* Password Fields - Only show for new signups, optional for edit mode */}
        {!isEditMode && (
          <>
            <div className="space-y-2">
                <Label htmlFor="password" className={`text-[#333333] font-bold text-base`}>Password</Label>
                <div className="relative">
                    <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password || ''}
                        onChange={(e) => updateFormData('password', e.target.value)}
                        className={`bg-white border-[#CFC6BA] text-[#1F1F1F] placeholder:text-[#8A857D] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl h-12 px-4 pr-10 ${errors.password ? 'border-red-500 focus:border-red-500' : ''}`}
                        placeholder="Create a password"
                    />
                     <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#706B67] hover:text-[#1F1F1F]"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
                {errors.password && <p className="text-red-500 text-sm">{errors.password}</p>}
                {!errors.password && (
                     <p className="text-[#706B67] text-xs font-medium">
                        Minimum 8 characters, at least 1 letter and 1 number. Special characters are allowed.
                     </p>
                )}
            </div>

            <div className="space-y-2">
                 <Label htmlFor="confirmPassword" className={`text-[#333333] font-bold text-base`}>Confirm Password</Label>
                 <div className="relative">
                    <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={formData.confirmPassword || ''}
                        onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                        className={`bg-white border-[#CFC6BA] text-[#1F1F1F] placeholder:text-[#8A857D] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl h-12 px-4 pr-10 ${errors.confirmPassword ? 'border-red-500 focus:border-red-500' : ''}`}
                        placeholder="Confirm password"
                    />
                     <button 
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#706B67] hover:text-[#1F1F1F]"
                    >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
                 {errors.confirmPassword && <p className="text-red-500 text-sm">{errors.confirmPassword}</p>}
            </div>
          </>
        )}

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
                {COUNTRIES.map(country => (
                    <option key={country} value={country}>{country}</option>
                ))}
              </select>
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
                    className="bg-white border-[#CFC6BA] text-[#1F1F1F] placeholder:text-[#8A857D] focus:border-[#E6B450] focus:ring-[#E6B450] rounded-xl h-12 px-4"
                    placeholder="Enter City"
                />
            </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="identifyAs" className="text-[#333333] font-bold text-base">I am a</Label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
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

        <div className="space-y-4 pt-4 bg-[#FAF7F2] p-6 rounded-xl border border-[#E6DCD2]">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="seriousRelationship"
              checked={formData.seriousRelationship}
              onCheckedChange={(checked) => updateFormData('seriousRelationship', checked)}
              className="border-[#C85A72] data-[state=checked]:bg-[#E6B450] data-[state=checked]:border-[#E6B450] mt-1"
            />
            <Label htmlFor="seriousRelationship" className="text-[#1F1F1F] text-sm leading-relaxed cursor-pointer font-bold">
              I am looking for a serious, long-term relationship leading to marriage.
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="agreeToTerms"
              checked={formData.agreeToTerms}
              onCheckedChange={(checked) => updateFormData('agreeToTerms', checked)}
              className="border-[#C85A72] data-[state=checked]:bg-[#E6B450] data-[state=checked]:border-[#E6B450] mt-1"
            />
            <Label htmlFor="agreeToTerms" className="text-[#1F1F1F] text-sm leading-relaxed cursor-pointer font-medium">
              I agree to the <Link to="/terms" className="text-[#E6B450] hover:underline" target="_blank">Terms of Service</Link>, <Link to="/privacy" className="text-[#E6B450] hover:underline" target="_blank">Privacy Policy</Link>, and <Link to="/community-guidelines" className="text-[#E6B450] hover:underline" target="_blank">Community Guidelines</Link> of Marryzen.
            </Label>
          </div>
        </div>

        {/* reCAPTCHA v3 runs invisibly in the background */}
        {errors.captcha && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-600 text-sm font-medium">{errors.captcha}</p>
          </div>
        )}
        
        {/* Privacy/security notice - only show when reCAPTCHA is actually enabled */}
        {isRecaptchaEnabled && (
          <div className="text-xs text-[#706B67] text-center pt-2 pb-2 flex items-center justify-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>Protected by reCAPTCHA</span>
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E6B450] hover:underline"
            >
              Privacy
            </a>
            <span>•</span>
            <a
              href="https://policies.google.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E6B450] hover:underline"
            >
              Terms
            </a>
          </div>
        )}
      </div>

      <p className="text-[#706B67] text-sm text-center pt-4 font-medium">
        You can update these details later in your profile settings.
      </p>
    </div>
  );
};

export default Step1;