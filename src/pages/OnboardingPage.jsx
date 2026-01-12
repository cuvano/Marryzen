import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { executeRecaptcha } from '@/lib/recaptcha';

import ProgressIndicator from '@/components/onboarding/ProgressIndicator';
import Step1 from '@/components/onboarding/Step1';
import Step2 from '@/components/onboarding/Step2';
import Step3 from '@/components/onboarding/Step3';
import Step4 from '@/components/onboarding/Step4';
import Step5 from '@/components/onboarding/Step5';

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [step1Errors, setStep1Errors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    locationCity: '',
    locationCountry: '',
    locationState: '',
    identifyAs: '',
    lookingForGender: '',
    seriousRelationship: false,
    agreeToTerms: false,
    photos: [],
    cultures: [],
    otherCultureText: '',
    faithLifestyle: '',
    religiousAffiliation: '',
    otherReligiousAffiliation: '', 
    coreValues: [],
    languages: [],
    otherLanguageText: '',
    bio: '',
    communicationPreference: [], 
    willingToRelocate: '',
    familyGoals: '',
    relationshipGoal: '',
    confirmMarriageIntent: false,
    agreeToTermsV2: false,
    isPremium: false,
  });

  const totalSteps = 5;

  // Initialize and check for existing session/profile
  useEffect(() => {
    const initSession = async () => {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        setSession(existingSession);

        if (existingSession?.user) {
            // Fetch existing profile data to resume
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', existingSession.user.id)
                .maybeSingle(); // Use maybeSingle() to handle case where profile doesn't exist yet
            
            if (profile) {
                // Map DB fields back to formData
                setFormData(prev => ({
                    ...prev,
                    name: profile.full_name || '',
                    email: profile.email || prev.email,
                    dateOfBirth: profile.date_of_birth || '',
                    locationCity: profile.location_city || '',
                    locationCountry: profile.location_country || '',
                    locationState: profile.location_state || '',
                    identifyAs: profile.identify_as || '',
                    lookingForGender: profile.looking_for_gender || '',
                    seriousRelationship: profile.serious_relationship || false,
                    photos: profile.photos || [],
                    cultures: profile.cultures || [],
                    otherCultureText: profile.other_culture_text || '',
                    faithLifestyle: profile.faith_lifestyle || '',
                    religiousAffiliation: profile.religious_affiliation || '',
                    otherReligiousAffiliation: profile.other_religious_affiliation || '',
                    coreValues: profile.core_values || [],
                    languages: profile.languages || [],
                    otherLanguageText: profile.other_language_text || '',
                    bio: profile.bio || '',
                    communicationPreference: profile.communication_preference || [],
                    willingToRelocate: profile.willing_to_relocate || '',
                    familyGoals: profile.family_goals || '',
                    relationshipGoal: profile.relationship_goal || '',
                }));

                // Resume at correct step
                if (profile.onboarding_step && profile.onboarding_step > 1 && profile.onboarding_step <= totalSteps) {
                    setCurrentStep(profile.onboarding_step);
                } else if (profile.onboarding_step === totalSteps) {
                     navigate('/dashboard');
                } else {
                    setCurrentStep(2); // Default to 2 if step 1 data exists but step not saved
                }
            }
        }
    };
    initSession();
  }, [navigate]);

  const cultures = [
    'African', 'Asian', 'European / White', 'Middle Eastern', 'Latin American', 
    'Native American', 'Pacific Islander', 'Mixed Heritage', 'Other'
  ];
  
  const coreValues = [
    'Religious Practices', 'Family-Centered Lifestyle', 'Serious Marriage Intent (Not Casual Dating)', 
    'Modest Living', 'Traditional Gender Roles', 'Family Involvement in Marriage', 
    'Cultural Festivals', 'Traditional Cuisine', 'Music & Dance', 'Language Preservation', 
    'Community Reputation', 'Raising Children in the Same Culture'
  ];

  const languages = [
    'English', 'Spanish', 'French', 'Arabic', 'Turkish', 'Hindi', 'Portuguese', 
    'Russian', 'Mandarin (Chinese)', 'Japanese', 'Korean', 'Urdu', 'German', 
    'Italian', 'Persian (Farsi)', 'Bengali', 'Polish', 'Dutch', 'Swahili', 
    'Indonesian', 'Other'
  ].sort();

  // --- Validation Logic ---
  const validateStep1 = () => {
    const errors = {};
    let isValid = true;
    if (!formData.name.trim()) { errors.name = "Full Name is required."; isValid = false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) { errors.email = "Please enter a valid email address."; isValid = false; }
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!formData.password || !passwordRegex.test(formData.password)) { errors.password = "Password must be at least 8 characters, with at least 1 letter and 1 number."; isValid = false; }
    if (formData.password !== formData.confirmPassword) { errors.confirmPassword = "Passwords do not match."; isValid = false; }
    if (!formData.dateOfBirth) isValid = false;
    if (!formData.locationCountry) isValid = false;
    if (formData.locationCountry === 'United States' && !formData.locationState) isValid = false;
    if (formData.locationCountry !== 'United States' && !formData.locationCity) isValid = false;
    if (!formData.identifyAs) isValid = false;
    if (!formData.seriousRelationship || !formData.agreeToTerms) isValid = false;
    if (formData.dateOfBirth) {
        const birthDate = new Date(formData.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        if (age < 18) isValid = false;
    }
    // reCAPTCHA validation will be done in handleNext before signup
    setStep1Errors(errors);
    return { isValid, errors };
  };
  
  const validateStep2 = () => {
      if (!formData.photos || formData.photos.length === 0 || !formData.photos[0]) {
          return { isValid: false, message: "Please upload at least one clear photo of yourself to continue." };
      }
      return { isValid: true };
  };

  const validateStep4 = () => {
      if (!formData.bio || formData.bio.length < 50) {
          return { isValid: false, message: "Please share a bit more about yourself (minimum 50 characters)." };
      }
      if (!formData.willingToRelocate) {
          return { isValid: false, message: "Please select your willingness to relocate." };
      }
      if (!formData.familyGoals) {
          return { isValid: false, message: "Please select your long-term family goals." };
      }
      return { isValid: true };
  };

  // --- Main Action Handler ---
  const handleNext = async () => {
    setIsLoading(true);

    try {
        // STEP 1: Account Creation
        if (currentStep === 1) {
          const validation = validateStep1();
          if (!validation.isValid) {
            toast({ title: "Please fix errors", description: "Check the form for details.", variant: "destructive" });
            setIsLoading(false);
            return;
          }

          // Execute reCAPTCHA v3
          let recaptchaTokenValue = '';
          try {
            recaptchaTokenValue = await executeRecaptcha('signup');
            
            // If token is empty and we're in production, show error
            if (!recaptchaTokenValue && import.meta.env.PROD) {
              toast({ 
                title: "Security Check Failed", 
                description: "Unable to verify your request. Please refresh the page and try again.",
                variant: "destructive" 
              });
              setIsLoading(false);
              return;
            }
          } catch (error) {
            console.error('reCAPTCHA error:', error);
            // In development, allow signup to continue
            if (import.meta.env.PROD) {
              toast({ 
                title: "Security Check Failed", 
                description: "Unable to verify your request. Please try again.",
                variant: "destructive" 
              });
              setIsLoading(false);
              return;
            }
          }

          // Check if user is already authenticated (resuming step 1?)
          let userId = session?.user?.id;
          let currentSession = session;

          if (!userId) {
              // Include reCAPTCHA token in metadata for server-side verification
              const { data, error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                  data: {
                    recaptcha_token: recaptchaTokenValue,
                  }
                }
              });

              if (error) {
                  if (error.message.includes('already registered')) {
                      setStep1Errors(prev => ({ ...prev, email: "This email is already registered. Please log in instead." }));
                  }
                  // Handle Rate Limit Error
                  if (error.code === 'over_email_send_rate_limit' || error.message.includes('rate limit')) {
                      toast({ 
                          title: "Too many attempts", 
                          description: "Please wait about a minute before trying to sign up again.", 
                          variant: "destructive" 
                      });
                      setIsLoading(false);
                      return;
                  }
                  throw error;
              }
              
              userId = data.user?.id;
              currentSession = data.session;
              
              // If no session (email confirmation required), wait a moment and check again
              if (!currentSession && userId) {
                  // Wait for session to be established
                  await new Promise(resolve => setTimeout(resolve, 500));
                  const { data: { session: newSession } } = await supabase.auth.getSession();
                  currentSession = newSession;
                  setSession(newSession);
              } else {
                  setSession(currentSession);
              }
          }
          
          if (userId) {
              // Ensure we have an authenticated session for RLS
              // RLS requires the user to be authenticated
              if (!currentSession) {
                  // Try to get session one more time
                  const { data: { session: retrySession } } = await supabase.auth.getSession();
                  if (retrySession) {
                      currentSession = retrySession;
                      setSession(retrySession);
                  } else {
                      // Email confirmation is required - save form data and redirect
                      toast({ 
                          title: "Check Your Email", 
                          description: "We've sent you a confirmation email. Please click the link to verify your account, then return here to continue.",
                          duration: 8000
                      });
                      
                      // Store form data temporarily so user can resume after email confirmation
                      localStorage.setItem('onboarding_pending', JSON.stringify({
                          userId: userId,
                          email: formData.email,
                          step: 1,
                          formData: formData
                      }));
                      
                      // Redirect to email verification page
                      navigate('/verify-email');
                      setIsLoading(false);
                      return;
                  }
              }
              
              const authenticatedUserId = currentSession.user.id;
              
              // Wait a moment for database trigger to create profile (if trigger exists)
              await new Promise(resolve => setTimeout(resolve, 300));
              
              // Check if profile exists (handle PGRST116 gracefully)
              const { data: existingProfile, error: checkError } = await supabase
                  .from('profiles')
                  .select('id')
                  .eq('id', authenticatedUserId)
                  .maybeSingle(); // Use maybeSingle() instead of single() to avoid PGRST116
              
              let profileError = null;
              
              if (existingProfile && !checkError) {
                  // Profile exists, update it
                  const { error: updateError } = await supabase
                      .from('profiles')
                      .update({
                          email: formData.email,
                          full_name: formData.name,
                          date_of_birth: formData.dateOfBirth,
                          location_city: formData.locationCity,
                          location_country: formData.locationCountry,
                          location_state: formData.locationState,
                          identify_as: formData.identifyAs,
                          looking_for_gender: formData.lookingForGender,
                          serious_relationship: formData.seriousRelationship,
                          onboarding_step: 2,
                          status: 'pending_review',
                          updated_at: new Date().toISOString()
                      })
                      .eq('id', authenticatedUserId);
                  profileError = updateError;
              } else {
                  // Profile doesn't exist, try to create it
                  // Make sure we're authenticated before inserting
                  const { error: insertError } = await supabase
                      .from('profiles')
                      .insert({
                          id: authenticatedUserId,
                  email: formData.email,
                  full_name: formData.name,
                  date_of_birth: formData.dateOfBirth,
                  location_city: formData.locationCity,
                  location_country: formData.locationCountry,
                  location_state: formData.locationState,
                  identify_as: formData.identifyAs,
                  looking_for_gender: formData.lookingForGender,
                  serious_relationship: formData.seriousRelationship,
                          onboarding_step: 2,
                          status: 'pending_review'
                      });
                  profileError = insertError;
              }
              
              if (profileError) {
                  console.error('Profile creation/update error:', profileError);
                  
                  // Handle specific error codes
                  if (profileError.code === '42501') {
                      toast({ 
                          title: "Profile Creation Failed", 
                          description: "RLS policy not configured. Please run the SQL in Supabase Dashboard → SQL Editor. See SUPABASE_SETUP_COMPLETE.sql file.",
                          variant: "destructive",
                          duration: 10000
                      });
                  } else if (profileError.code === 'PGRST116') {
                      // This shouldn't happen now with maybeSingle(), but handle it anyway
                      console.warn('Profile check returned no rows, but this is expected for new users');
                  } else {
                      toast({ 
                          title: "Profile Creation Failed", 
                          description: profileError.message || "Please try again or contact support.",
                          variant: "destructive"
                      });
                  }
                  setIsLoading(false);
                  return;
              }
              
              toast({ title: "Account Created!", description: "Let's build your profile." });
              setCurrentStep(2);
          }
        }
        
        // STEP 2: Photos
        else if (currentStep === 2) {
            const validation = validateStep2();
            if (!validation.isValid) {
                 toast({ title: "Photo Required", description: validation.message, variant: "destructive" });
                 setIsLoading(false);
                 return;
            }
            
            // Save photos to DB
            const { error } = await supabase.from('profiles').update({
                photos: formData.photos,
                onboarding_step: 3
            }).eq('id', session.user.id);
            
            if (error) throw error;
            setCurrentStep(3);
        }

        // STEP 3: Culture & Values
        else if (currentStep === 3) {
            const { error } = await supabase.from('profiles').update({
                cultures: formData.cultures,
                other_culture_text: formData.otherCultureText,
                faith_lifestyle: formData.faithLifestyle,
                religious_affiliation: formData.religiousAffiliation,
                other_religious_affiliation: formData.otherReligiousAffiliation,
                core_values: formData.coreValues,
                onboarding_step: 4
            }).eq('id', session.user.id);

            if (error) throw error;
            setCurrentStep(4);
        }
        
        // STEP 4: Bio & Goals
        else if (currentStep === 4) {
            const validation = validateStep4();
            if (!validation.isValid) {
                 toast({ title: "Missing Information", description: validation.message, variant: "destructive" });
                 setIsLoading(false);
                 return;
            }

            const { error } = await supabase.from('profiles').update({
                languages: formData.languages,
                other_language_text: formData.otherLanguageText,
                bio: formData.bio,
                willing_to_relocate: formData.willingToRelocate,
                family_goals: formData.familyGoals,
                communication_preference: formData.communicationPreference,
                onboarding_step: 5
            }).eq('id', session.user.id);

            if (error) throw error;
            setCurrentStep(5);
        }

        // STEP 5: Finalize
        else if (currentStep === totalSteps) {
             const { error } = await supabase.from('profiles').update({
                 relationship_goal: formData.relationshipGoal,
                 // We could set a 'status' field here like 'active'
                 onboarding_step: 5 
             }).eq('id', session.user.id);

             if (error) throw error;

             // Store basic profile in local storage for quick access if needed, but primary is now Supabase
             localStorage.setItem('userProfile', JSON.stringify({ ...formData, id: session.user.id }));
             
             toast({
                title: "Profile Activated! 🎉",
                description: "Welcome to Marryzen!",
             });
             navigate('/dashboard');
        }

    } catch (error) {
        console.error("Onboarding Error:", error);
        toast({ 
            title: "Something went wrong", 
            description: error.message || "Please try again.", 
            variant: "destructive" 
        });
    } finally {
        setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (currentStep === 1 && step1Errors[field]) {
        setStep1Errors(prev => ({ ...prev, [field]: null }));
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: return (
        <Step1 
          formData={formData} 
          updateFormData={updateFormData} 
          errors={step1Errors}
        />
      );
      case 2: return <Step2 formData={formData} updateFormData={updateFormData} />;
      case 3: return <Step3 formData={formData} updateFormData={updateFormData} cultures={cultures} coreValues={coreValues} />;
      case 4: return <Step4 formData={formData} updateFormData={updateFormData} languages={languages} />;
      case 5: return <Step5 formData={formData} updateFormData={updateFormData} />;
      default: return null;
    }
  };

  // Validations for button states (Visual Only)
  const isStep1Valid = () => {
       return formData.name && formData.email && formData.password && formData.confirmPassword && 
              formData.dateOfBirth && formData.locationCountry && formData.identifyAs && 
              formData.seriousRelationship && formData.agreeToTerms;
  };
  const isStep2Complete = formData.photos && formData.photos.length > 0;
  const isStep3Complete = formData.cultures?.length > 0 && formData.coreValues?.length > 0 && formData.faithLifestyle;
  const isStep4Complete = formData.bio?.length >= 50 && formData.willingToRelocate && formData.familyGoals;
  const isStep5Complete = formData.relationshipGoal && formData.confirmMarriageIntent && formData.agreeToTermsV2;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FAF7F2]">
      <div className="w-full max-w-3xl py-10">
        <ProgressIndicator currentStep={currentStep} totalSteps={totalSteps} />

        <div className="bg-[#FFFFFF] rounded-2xl p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#E6DCD2]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between items-center mt-12 pt-6 border-t border-[#F3E8D9]">
            {currentStep > 1 ? (
              <Button
                variant="ghost"
                onClick={handleBack}
                className="text-[#C85A72] hover:bg-[#F9E7EB] hover:text-[#C85A72] font-semibold px-6"
              >
                ← Back
              </Button>
            ) : ( <div /> )}
            
            <div className="flex flex-col items-end">
                {currentStep === totalSteps && (
                    <p className="text-xs text-[#706B67] mb-3 font-medium max-w-xs text-right">
                        You're about to join Marryzen, a serious community built for real marriage.
                    </p>
                )}
                <Button
                  onClick={handleNext}
                  className="bg-[#E6B450] hover:bg-[#D0A23D] text-white rounded-full px-10 py-6 text-lg font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={
                    isLoading ||
                    (currentStep === 1 && !isStep1Valid()) || 
                    (currentStep === 2 && !isStep2Complete) ||
                    (currentStep === 3 && !isStep3Complete) ||
                    (currentStep === 4 && !isStep4Complete) ||
                    (currentStep === totalSteps && !isStep5Complete)
                  }
                >
                  {isLoading ? 'Processing...' : (currentStep === totalSteps ? 'Activate Profile' : 'Continue')}
                </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;