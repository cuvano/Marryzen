import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { funnel } from '@/lib/analytics';
import { executeRecaptcha, isRecaptchaEnabled } from '@/lib/recaptcha';
import { SANCTIONED_RESIDENCE } from '@/lib/sanctionedJurisdictions';
import { checkRateLimit } from '@/lib/rateLimit';

import ProgressIndicator from '@/components/onboarding/ProgressIndicator';
import Step1a from '@/components/onboarding/Step1a';
import Step1b from '@/components/onboarding/Step1b';
import Step1c from '@/components/onboarding/Step1c';
import Step2 from '@/components/onboarding/Step2';
import Step3a from '@/components/onboarding/Step3a';
import Step3b from '@/components/onboarding/Step3b';
import Step4 from '@/components/onboarding/Step4';
import Step5 from '@/components/onboarding/Step5';

// L3 hardening 2026-06-09: persist consent acceptance timestamps on profiles.
// Bump these strings when the corresponding legal text changes; OnboardingPage
// then writes the new version + new timestamp on the next user save. Schema:
// 20260609020000_persist_consent_timestamps.sql.
const TERMS_VERSION = '2026-06-08';                  // Termly-hosted ToS — last republish date
const COMMUNITY_PLEDGE_VERSION = '2026-06-06';       // Community Guidelines v2.0
const MARRIAGE_PROMISE_VERSION = '2026-06-08';       // Step5 wording effective date
import PremiumTeaserModal from '@/components/onboarding/PremiumTeaserModal';

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const refFromUrl = searchParams.get('ref');
  const rawEditParam = searchParams.get('edit');
  const wantsProfileEdit =
    rawEditParam === '1' || rawEditParam?.toLowerCase() === 'true';

  const [currentStep, setCurrentStep] = useState(1);
  // Phase 2F: Step 1 has 3 internal sub-screens (Step1a Create account,
  // Step1b About you, Step1c Commitments). Sub-step state is local — it
  // doesn't change totalSteps or onboarding_step. auth.signUp only fires
  // at the end of Step1c when subStep transitions from 2 -> next currentStep.
  const [step1SubStep, setStep1SubStep] = useState(0);  // 0=a, 1=b, 2=c

  // Phase 2F: when leaving Step 1 (forward or back), reset sub-step so the
  // next time we render Step 1 we start at Step1a, not whatever the user
  // was last on.
  useEffect(() => {
    if (currentStep !== 1) setStep1SubStep(0);
  }, [currentStep]);
  const [showPremiumTeaser, setShowPremiumTeaser] = useState(false);
  const [postOnboardingNav, setPostOnboardingNav] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  /** Logged-in user already has a profiles row ... never show "create password" on step 1 (use Account settings). */
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [sessionProfileReady, setSessionProfileReady] = useState(false);
  const [step1Errors, setStep1Errors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [referralCode, setReferralCode] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    locationCity: '',
    locationCountry: '',
    locationState: '',
    // City structured-selection fields (added with CitySelect — see Step1b.jsx).
    // cityGeonameId is the stable GeoNames ID for the picked city; cityLat/Lng are
    // the denormalized coordinates that feed the matchmaking.js Haversine scorer.
    // cityUnverified=true means user typed a city not in our dataset (free-text
    // fallback for small towns) — matching falls back to country-equality only.
    cityGeonameId: null,
    cityLat: null,
    cityLng: null,
    cityUnverified: false,
    countryOfOrigin: '',
    countryOfResidence: '',
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
    smoking: '',
    drinking: '',
    maritalHistory: '',
    hasChildren: false,
    childrenLiveWithYou: undefined,
    education: '',
    educationLevel: '',
    job: '',
    zodiacSign: '',
  });

  const totalSteps = 6;  // Phase 2E: Step 3 split into 3a (Identity/Faith) + 3b (Lifestyle). Steps 4/5 became 5/6.

  // Initialize and check for existing session/profile
  useEffect(() => {
    // Check for referral code in URL
    const refCode = refFromUrl;
    if (refCode) {
      setReferralCode(refCode);
      // Store in localStorage to persist across page refreshes
      localStorage.setItem('referral_code', refCode);
    } else {
      // Check localStorage for saved referral code
      const savedRefCode = localStorage.getItem('referral_code');
      if (savedRefCode) {
        setReferralCode(savedRefCode);
      }
    }

    const initSession = async () => {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        setSession(existingSession);

        if (!existingSession?.user) {
            setHasExistingProfile(false);
            setSessionProfileReady(true);
            return;
        }

        // When user opens join via referral link (?ref=), show empty form for new signup (don't pre-fill with their data)
        const isReferralLink = !!refCode;
        if (isReferralLink) {
            setHasExistingProfile(false);
            setSessionProfileReady(true);
            return;
        }

        // Fetch existing profile data to resume or edit
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', existingSession.user.id)
            .maybeSingle();

        if (profile) {
            setHasExistingProfile(true);
                const stepNum =
                    profile.onboarding_step == null || profile.onboarding_step === ''
                        ? null
                        : Number(profile.onboarding_step);
                const step =
                    stepNum != null && !Number.isNaN(stepNum) ? stepNum : null;
                // Edit flow: finished onboarding, explicit ?edit=1, or live member with inconsistent step (e.g. step 2...4 but already approved)
                const isLiveMemberBadStep =
                    !isReferralLink &&
                    step != null &&
                    step > 1 &&
                    step < totalSteps &&
                    (profile.status === 'approved' || profile.status === 'pending_review');
                const isEditModeProfile =
                    step === totalSteps ||
                    (wantsProfileEdit && !isReferralLink) ||
                    isLiveMemberBadStep;
                if (isEditModeProfile) {
                    setIsEditMode(true);
                    setCurrentStep(1);
                }

                // Map DB fields back to formData
                setFormData(prev => ({
                    ...prev,
                    agreeToTerms: isEditModeProfile ? true : prev.agreeToTerms,
                    agreeToTermsV2: isEditModeProfile ? true : prev.agreeToTermsV2,
                    confirmMarriageIntent: isEditModeProfile ? true : prev.confirmMarriageIntent,
                    name: profile.full_name || '',
                    email: profile.email || prev.email,
                    dateOfBirth: profile.date_of_birth || '',
                    locationCity: profile.location_city || '',
                    locationCountry: profile.location_country || '',
                    locationState: profile.location_state || '',
                    cityGeonameId: profile.city_geoname_id || null,
                    cityLat: profile.latitude ?? null,
                    cityLng: profile.longitude ?? null,
                    cityUnverified: profile.city_unverified || false,
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
                    isPremium: profile.is_premium || false,
                    smoking: profile.smoking || '',
                    drinking: profile.drinking || '',
                    maritalHistory: profile.marital_status || '',
                    hasChildren: profile.has_children || false,
                    childrenLiveWithYou: profile.children_live_with_you,
                    // Phase 2C: education column collision fixed via DB migration.
                    // `profiles.education` now stores ONLY the level enum.
                    // `profiles.field_of_study` (new column) stores the free-text field of study.
                    education: profile.field_of_study || '',  // free-text (e.g. 'Computer Science')
                    educationLevel: profile.education || '',  // enum level (e.g. "Bachelor's Degree")
                    job: profile.occupation || profile.job || '', // Try occupation first, fallback to job
                    zodiacSign: profile.zodiac_sign || '',
                    countryOfOrigin: profile.country_of_origin || '',
                    countryOfResidence: profile.country_of_residence || profile.location_country || '',
                }));

                // Resume at correct step (only for incomplete profiles, not edit mode)
                if (!isEditModeProfile) {
                    // Phase 2E: legacy step values had range 1..5. New flow uses
                    // 1..6 because Step 3 split into 3a/3b. SQL migration bumps
                    // existing rows 4->5 and 5->6; this in-memory mapping is the
                    // safety net for any straggler row not yet migrated.
                    // Phase 2E shim — only fires for pre-SQL stragglers at value 4.
                    // SQL migration bumps 4->5 and 5->6 server-side. After SQL
                    // runs no row has value 4, so this becomes dead code and is
                    // safe to remove in a future cleanup. Critical that the shim
                    // is NOT >=4 && <=5 — that would double-bump migrated rows.
                    let resolvedStep = step;
                    if (typeof step === 'number' && step === 4) {
                        resolvedStep = 5;
                    }
                    if (resolvedStep === totalSteps) {
                        navigate('/dashboard');
                    } else if (resolvedStep != null && resolvedStep > 1 && resolvedStep < totalSteps) {
                        setCurrentStep(resolvedStep);
                    } else {
                        // Step null, 1, or unknown ... stay on step 1 (do not skip to photos)
                        setCurrentStep(1);
                    }
                }
        } else {
            setHasExistingProfile(false);
        }
        setSessionProfileReady(true);
    };
    initSession();
  }, [navigate, refFromUrl, rawEditParam]);

  // Scroll to top whenever the step changes (e.g. after Continue or Back)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  // Cultural Heritage & Ethnicity — comprehensive global list per VP DEI
  // (Priya Narayanan) board audit. Single-select for now (multi-select
  // deferred to Phase 2 pending DB column-type review and matching-logic
  // changes). The list is roughly alphabetical with diaspora groupings
  // adjacent. GDPR Article 9 explicit-consent disclosure is rendered in
  // Step3 above this control.
  const cultures = [
    'Arab / Middle Eastern',
    'Black / African Diaspora (Caribbean, Americas, Europe)',
    'Caribbean (non-Hispanic)',
    'Caucasus (Armenian, Georgian, Azerbaijani)',
    'Central African',
    'Central Asian (Kazakh, Uzbek, Tajik, Kyrgyz, Turkmen)',
    'East African',
    'East Asian (Chinese, Japanese, Korean, Mongolian)',
    'Eastern European / Slavic',
    'European',
    'Hispanic / Latino (Latin America)',
    'Indigenous / First Nations',
    'Iranian / Persian',
    'Jewish Heritage (Ashkenazi, Sephardi, Mizrahi)',
    'Kurdish',
    'North African / Amazigh (Berber)',
    'Pakistani / Afghan',
    'Pacific Islander / Maori',
    'Roma / Romani',
    'South Asian (Indian, Sri Lankan, Bangladeshi, Nepali)',
    'Southeast Asian (Indonesian, Malaysian, Filipino, Vietnamese, Thai)',
    'Southern African',
    'Turkish / Turkic',
    'West African',
    'Mixed Heritage',
    'Prefer not to say',
    'Other'
  ];
  
  // Core Values — board verdict (session 11):
  // - removed redundant 'Serious Marriage Intent' (already captured in Step1
  //   required checkbox + Step5 marriage timeline).
  // - renamed 'Traditional Gender Roles' to 'Defined Family Roles' (less
  //   loaded for progressive Muslim/Reform Jewish/Christian-egalitarian users).
  // - renamed 'Community Reputation' to 'Family & Community Standing' (more
  //   neutral globally; "reputation" can read as social anxiety in Western
  //   English).
  // - added Faith Community Involvement, Charitable Service, Hospitality,
  //   Educational Ambition (per Priya audit — missing values that core
  //   user base actively wants).
  const coreValues = [
    'Religious Practices',
    'Faith Community Involvement',
    'Family-Centered Lifestyle',
    'Family Involvement in Marriage',
    'Defined Family Roles',
    'Modest Living',
    'Charitable Service / Giving',
    'Hospitality & Generosity',
    'Educational Ambition',
    'Cultural Festivals',
    'Traditional Cuisine',
    'Music & Dance',
    'Language Preservation',
    'Family & Community Standing',
    'Raising Children in the Same Culture'
  ];

  // Languages — expanded per VP DEI board audit to cover gaps for the
  // app's core demographics: Pashto/Dari (Afghanistan), Somali (East African
  // Muslim diaspora), Amharic/Tigrinya (Ethiopian/Eritrean), Hausa/Yoruba
  // (West African), Cantonese (separate from Mandarin), Tagalog (clarified),
  // Greek/Romanian (Orthodox/Eastern Europe).
  const languages = [
    'English', 'Spanish', 'French', 'Arabic', 'Turkish', 'Hindi', 'Portuguese',
    'Russian', 'Mandarin (Chinese)', 'Cantonese (Chinese)', 'Japanese', 'Korean',
    'Urdu', 'German', 'Italian', 'Persian (Farsi)', 'Dari (Afghan Persian)',
    'Pashto', 'Bengali', 'Polish', 'Dutch', 'Swahili', 'Somali', 'Amharic',
    'Tigrinya', 'Hausa', 'Yoruba', 'Indonesian', 'Ukrainian', 'Punjabi',
    'Tagalog (Filipino)', 'Vietnamese', 'Thai', 'Tamil', 'Telugu', 'Hebrew',
    'Malay', 'Nepali', 'Greek', 'Romanian', 'Kazakh', 'Uzbek', 'Other'
  ].sort((a, b) => {
    // Sort alphabetically but keep "Other" at the end
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });

  /** Create-password fields only for true sign-up (no session yet, or session but no profile row). */
  const showPasswordFieldsOnStep1 =
    !session?.user || (sessionProfileReady && !hasExistingProfile);
  const showPasswordSettingsLink = Boolean(
    session?.user && sessionProfileReady && hasExistingProfile
  );

  // --- Validation Logic ---
  const validateStep1 = () => {
    const errors = {};
    let isValid = true;
    if (!formData.name.trim()) { errors.name = "Full Name is required."; isValid = false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) { errors.email = "Please enter a valid email address."; isValid = false; }
    
    if (showPasswordFieldsOnStep1) {
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
      if (!formData.password || !passwordRegex.test(formData.password)) { errors.password = "Password must be at least 8 characters, with at least 1 letter and 1 number."; isValid = false; }
      if (formData.password !== formData.confirmPassword) { errors.confirmPassword = "Passwords do not match."; isValid = false; }
    }
    if (!formData.dateOfBirth) isValid = false;
    if (!formData.locationCountry) isValid = false;
    if (formData.locationCountry === 'United States' && !formData.locationState) isValid = false;
    // City is now required for ALL countries (used to be non-US only). City is
    // captured via CitySelect; if user typed a small town not in the dataset, the
    // free-text fallback path still populates locationCity (with cityUnverified=true).
    if (formData.locationCountry && !formData.locationCity) isValid = false;
    if (!formData.identifyAs) isValid = false;
    if (!formData.seriousRelationship) isValid = false;
    if (!isEditMode && !formData.agreeToTerms) isValid = false;
    if (formData.dateOfBirth) {
        const birthDate = new Date(formData.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        if (age < 18) isValid = false;
    }
    // Geographic eligibility block on Country of Residence. Covers OFAC
    // sanctions + countries where Marryzen hasn't yet appointed a local
    // data-protection representative. Lift conditions per BLOCKED_COUNTRIES.md.
    if (formData.locationCountry && SANCTIONED_RESIDENCE.includes(formData.locationCountry)) {
      errors.locationCountry = "Marryzen is growing carefully and isn't yet available in your country. Email admin@marryzen.com with your country and we'll let you know the moment we arrive.";
      isValid = false;
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
        // STEP 1: Account Creation (Phase 2F sub-step state machine)
        // Sub-steps 0 (Step1a Create account) and 1 (Step1b About you) just
        // advance the sub-step locally. Sub-step 2 (Step1c Commitments)
        // runs full validateStep1() + reCAPTCHA + auth.signUp.
        if (currentStep === 1) {
          // Sub-steps 0 and 1 — light gate, just advance.
          if (step1SubStep < 2) {
            if (step1SubStep === 0 && !isStep1aComplete) {
              toast({ title: "Almost there", description: "Please complete the account details before continuing.", variant: "destructive" });
              setIsLoading(false);
              return;
            }
            if (step1SubStep === 1 && !isStep1bComplete) {
              toast({ title: "Almost there", description: "Please complete your basic info before continuing.", variant: "destructive" });
              setIsLoading(false);
              return;
            }
            setStep1SubStep(step1SubStep + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setIsLoading(false);
            return;
          }

          // Sub-step 2 — full validation + account creation.
          const validation = validateStep1();
          if (!validation.isValid) {
            toast({ title: "Please fix errors", description: "Check the form for details.", variant: "destructive" });
            setIsLoading(false);
            return;
          }

          // Check if user is already authenticated (editing profile vs new signup)
          let userId = session?.user?.id;
          let currentSession = session;

          // Only execute reCAPTCHA for new signups (not for authenticated users editing their profile)
          let recaptchaTokenValue = '';
          if (!userId) {
            // Execute reCAPTCHA v3 only when configured.
            // If not configured, we skip it (signup should not hard-fail due to missing config).
            if (isRecaptchaEnabled) {
              try {
                recaptchaTokenValue = await executeRecaptcha('signup');

                // If token is empty and we're in production (with reCAPTCHA enabled), show error
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
            } else if (import.meta.env.PROD) {
              // Keep this as a soft warning in production so onboarding doesn't break for end-users.
              console.warn('reCAPTCHA is not configured in production. Set VITE_RECAPTCHA_SITE_KEY to enable it.');
            }
          }

          if (!userId) {
              // Server-side rate-limit gate on signup (anti-spam-account).
              // SIGNUP_ATTEMPTS: 5/hr per IP, 10/hr per user. Fails OPEN if infra down.
              const gate = await checkRateLimit('SIGNUP_ATTEMPTS', { toast });
              if (!gate.allowed) {
                setIsLoading(false);
                return;
              }

              // Include reCAPTCHA token in metadata for server-side verification
              const { data, error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                  data: {
                    recaptcha_token: recaptchaTokenValue,
                    referral_code: referralCode || undefined,
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

              // Meta Pixel Lead event + PostHog signup_completed. Fires once,
              // regardless of whether email confirmation is still required.
              // (We consider account creation = "lead generated" for ad attribution.)
              try {
                funnel.signupCompleted({
                  user_id: userId,
                  has_referral: !!referralCode,
                });
              } catch (_) { /* never block onboarding on analytics */ }
              
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
                          description: "We've sent you a confirmation email. Confirm your email to be approved ... then click the link and return here to continue.",
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
                  .select('id, onboarding_step')
                  .eq('id', authenticatedUserId)
                  .maybeSingle(); // Use maybeSingle() instead of single() to avoid PGRST116
              
              let profileError = null;
              const isExistingProfile = existingProfile && !checkError;
              
              if (isExistingProfile) {
                  // Profile exists, update it
                  const updateData = {
                      email: formData.email,
                      full_name: formData.name,
                      date_of_birth: formData.dateOfBirth,
                      location_city: formData.locationCity,
                      location_country: formData.locationCountry,
                      location_state: formData.locationState,
                      // Structured city fields — populated by CitySelect. NULLs when
                      // user typed a small town not in our dataset (cityUnverified=true).
                      city_geoname_id: formData.cityGeonameId,
                      latitude: formData.cityLat,
                      longitude: formData.cityLng,
                      city_unverified: !!formData.cityUnverified,
                      country_of_origin: formData.countryOfOrigin,
                      country_of_residence: formData.locationCountry, // Same as location_country
                      identify_as: formData.identifyAs,
                      looking_for_gender: formData.lookingForGender,
                      serious_relationship: formData.seriousRelationship,
                      updated_at: new Date().toISOString()
                  };

                  // L3: only stamp consent on FIRST acceptance, never overwrite.
                  // Per Art. 7(1) GDPR the demonstrable timestamp is the moment
                  // consent was first given, not the last re-save during a
                  // re-entrant Step1. existingProfile is the row we just SELECTed;
                  // a NULL means the consent has never been stamped.
                  if (!isEditMode &&
                      formData.agreeToTerms &&
                      !existingProfile?.terms_accepted_at) {
                      updateData.terms_accepted_at = new Date().toISOString();
                      updateData.terms_accepted_version = TERMS_VERSION;
                  }

                  // Only update onboarding_step and status if not in edit mode (use state variable)
                  if (!isEditMode) {
                      updateData.onboarding_step = 2;
                      updateData.status = 'pending_review';
                  }
                  
                  const { error: updateError } = await supabase
                      .from('profiles')
                      .update(updateData)
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
                  // Structured city fields (CitySelect) — see updateData above for context.
                  city_geoname_id: formData.cityGeonameId,
                  latitude: formData.cityLat,
                  longitude: formData.cityLng,
                  city_unverified: !!formData.cityUnverified,
                  identify_as: formData.identifyAs,
                  looking_for_gender: formData.lookingForGender,
                  serious_relationship: formData.seriousRelationship,
                  // L3 2026-06-09: stamp Terms acceptance at signup row creation
                  terms_accepted_at: formData.agreeToTerms ? new Date().toISOString() : null,
                  terms_accepted_version: formData.agreeToTerms ? TERMS_VERSION : null,
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
                          description: "RLS policy not configured. Please run the SQL in Supabase Dashboard ... SQL Editor. See SUPABASE_SETUP_COMPLETE.sql file.",
                          variant: "destructive",
                          duration: 10000
                      });
                  } else if (profileError.code === 'PGRST116') {
                      // This shouldn't happen now with maybeSingle(), but handle it anyway
                      console.warn('Profile check returned no rows, but this is expected for new users');
                  } else {
                      toast({ 
                          title: "Profile Update Failed", 
                          description: profileError.message || "Please try again or contact support.",
                          variant: "destructive"
                      });
                  }
                  setIsLoading(false);
                  return;
              }
              
              // Create referral record if referral code exists (only for new signups)
              if (!isEditMode && referralCode) {
                try {
                  // Find the referrer by referral code
                  const { data: referrerProfile, error: referrerError } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('referral_code', referralCode)
                    .maybeSingle();

                  if (referrerError && referrerError.code !== 'PGRST116' && referrerError.code !== 'NOT_FOUND') {
                    console.error('Error finding referrer:', referrerError);
                  }

                  // Only create referral if referrer exists and it's not self-referral
                  if (referrerProfile && referrerProfile.id !== authenticatedUserId) {
                    const { error: referralError } = await supabase
                      .from('referrals')
                      .insert({
                        referrer_id: referrerProfile.id,
                        referred_user_id: authenticatedUserId,
                        status: 'pending' // Will be updated to 'completed' when profile is approved
                      });

                    if (referralError) {
                      console.error('Error creating referral:', referralError);
                      // Don't block signup if referral creation fails
                    } else {
                      console.log('Referral created successfully');
                      // Clear referral code from localStorage after successful creation
                      localStorage.removeItem('referral_code');
                    }
                  } else if (referrerProfile && referrerProfile.id === authenticatedUserId) {
                    console.warn('Self-referral detected, skipping');
                    localStorage.removeItem('referral_code');
                  } else {
                    console.warn('Referral code not found:', referralCode);
                    localStorage.removeItem('referral_code');
                  }
                } catch (refErr) {
                  console.error('Error processing referral:', refErr);
                  // Don't block signup if referral processing fails
                }
              }

              // Only show "Account Created!" for new signups, not when editing existing profile
              // Use the state variable isEditMode, not the local one
              if (!isEditMode) {
                  toast({ title: "Account Created!", description: "Let's build your profile." });
              }
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

        // STEP 3a: Identity & Faith (Phase 2E split)
        // Saves cultures + faith lifestyle + religion. Lifestyle saves at 3b.
        else if (currentStep === 3) {
            const updateData = {
                cultures: formData.cultures || [],
                other_culture_text: formData.otherCultureText || null,
                faith_lifestyle: formData.faithLifestyle || null,
                religious_affiliation: formData.religiousAffiliation || null,
                other_religious_affiliation: formData.otherReligiousAffiliation || null,
                onboarding_step: 4
            };
            const { error } = await supabase.from('profiles').update(updateData).eq('id', session.user.id);
            if (error) throw error;
            setCurrentStep(4);
        }

        // STEP 3b: Lifestyle & Values (Phase 2E split)
        // Saves habits, family, education/job, zodiac, core values.
        else if (currentStep === 4) {
            const updateData = {
                smoking: formData.smoking || null,
                drinking: formData.drinking || null,
                marital_status: formData.maritalHistory || null,
                has_children: formData.hasChildren || false,
                children_live_with_you: formData.hasChildren === true
                    ? (formData.childrenLiveWithYou !== undefined ? formData.childrenLiveWithYou : null)
                    : null,
                core_values: formData.coreValues || [],
                onboarding_step: 5
            };
            // Phase 2C education column collision fix:
            // education LEVEL writes to profiles.education; free-text writes to profiles.field_of_study.
            if (formData.educationLevel) {
                updateData.education = formData.educationLevel;
            }
            updateData.field_of_study = formData.education || null;
            if (formData.job) updateData.occupation = formData.job;
            if (formData.zodiacSign) updateData.zodiac_sign = formData.zodiacSign;

            const { error } = await supabase.from('profiles').update(updateData).eq('id', session.user.id);
            if (error) throw error;
            setCurrentStep(5);
        }
        
        // STEP 5: Bio & Goals (Phase 2E: was Step 4 pre-split)
        else if (currentStep === 5) {
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
                onboarding_step: 6
            }).eq('id', session.user.id);

            if (error) throw error;
            setCurrentStep(6);
        }

        // STEP 6: Finalize (Marriage Intent — Phase 2E renumbered)
        else if (currentStep === totalSteps) {
             // L3 hardening 2026-06-09: stamp Community Pledge + Marriage
             // Promise acceptance timestamps. Per Art. 7(1) GDPR the
             // demonstrable timestamp is the moment consent was FIRST given;
             // never overwrite an existing stamp on re-entrant saves.
             // Edit-mode preserves the originals (a version-bump re-prompt
             // flow can re-stamp via a separate code path later).
             const step6Update = {
                 relationship_goal: formData.relationshipGoal,
                 onboarding_step: 6,
             };

             // Read current consent stamps so we only fire on first-time.
             const { data: priorConsent } = await supabase
                 .from('profiles')
                 .select('community_pledge_accepted_at, marriage_promise_accepted_at')
                 .eq('id', session.user.id)
                 .maybeSingle();

             if (!isEditMode &&
                 formData.agreeToTermsV2 &&
                 !priorConsent?.community_pledge_accepted_at) {
                 step6Update.community_pledge_accepted_at = new Date().toISOString();
                 step6Update.community_pledge_version = COMMUNITY_PLEDGE_VERSION;
             }
             if (!isEditMode &&
                 formData.confirmMarriageIntent &&
                 !priorConsent?.marriage_promise_accepted_at) {
                 step6Update.marriage_promise_accepted_at = new Date().toISOString();
                 step6Update.marriage_promise_version = MARRIAGE_PROMISE_VERSION;
             }
             const { error } = await supabase.from('profiles').update(step6Update).eq('id', session.user.id);

             if (error) throw error;

             // Store basic profile in local storage for quick access if needed, but primary is now Supabase
             try { localStorage.setItem('userProfile', JSON.stringify({ ...formData, id: session.user.id })); } catch {}
             
             // Show different messages for new signup vs editing
             if (isEditMode) {
                 toast({
                    title: "Profile Updated! ...",
                    description: "Your changes have been saved.",
                 });
             } else {
                 toast({
                    title: "Profile Activated! ...",
                    description: "Welcome to Marryzen!",
                 });
             }

             // Per session-11 board verdict (VP Growth — Riley):
             // The post-onboarding moment is the highest-intent conversion
             // window. Show PremiumTeaserModal to new (non-premium, non-edit)
             // users — once per account (localStorage flag). Suppressed for
             // premium members and edit-mode runs.
             const teaserSeen = (() => {
                 try { return localStorage.getItem('premium_teaser_seen') === '1'; }
                 catch { return false; }
             })();
             const shouldShowTeaser = !isEditMode
                 && !formData.isPremium
                 && !teaserSeen;

             if (shouldShowTeaser) {
                 setPostOnboardingNav('/dashboard');
                 setShowPremiumTeaser(true);
             } else {
                 navigate('/dashboard');
             }
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
    // Phase 2F: if we're on Step 1 with a sub-step in progress, back goes to
    // the previous sub-screen first. Only after sub-step 0 do we attempt to
    // navigate to a previous main step (which doesn't exist for Step 1).
    if (currentStep === 1 && step1SubStep > 0) {
      setStep1SubStep(step1SubStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
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
      case 1: {
        // Phase 2F: render the right sub-screen based on step1SubStep.
        if (step1SubStep === 0) {
          return (
            <Step1a
              formData={formData}
              updateFormData={updateFormData}
              errors={step1Errors}
              showPasswordFields={showPasswordFieldsOnStep1}
              showPasswordSettingsLink={showPasswordSettingsLink}
            />
          );
        }
        if (step1SubStep === 1) {
          return (
            <Step1b
              formData={formData}
              updateFormData={updateFormData}
              errors={step1Errors}
            />
          );
        }
        return (
          <Step1c
            formData={formData}
            updateFormData={updateFormData}
            errors={step1Errors}
            isEditMode={isEditMode}
          />
        );
      }
      case 2: return <Step2 formData={formData} updateFormData={updateFormData} />;
      case 3: return <Step3a formData={formData} updateFormData={updateFormData} cultures={cultures} />;
      case 4: return <Step3b formData={formData} updateFormData={updateFormData} coreValues={coreValues} />;
      case 5: return <Step4 formData={formData} updateFormData={updateFormData} languages={languages} />;
      case 6: return <Step5 formData={formData} updateFormData={updateFormData} isEditMode={isEditMode} />;
      default: return null;
    }
  };

  // Validations for button states (Visual Only)
  const isStep1Valid = () => {
    const locationOk =
      !!formData.locationCountry &&
      (formData.locationCountry !== 'United States' || !!formData.locationState) &&
      !!formData.locationCity?.trim(); // city now required for ALL countries (CitySelect)
    const baseFields =
      formData.name?.trim() &&
      formData.email &&
      formData.dateOfBirth &&
      locationOk &&
      formData.identifyAs &&
      formData.seriousRelationship &&
      (isEditMode || formData.agreeToTerms);

    if (showPasswordFieldsOnStep1) {
      return !!(baseFields && formData.password && formData.confirmPassword);
    }
    return !!baseFields;
  };
  // Phase 2F: per-sub-step completion checks for Continue button gating.
  // Each sub-step has a soft gate; the FULL validateStep1() runs only on
  // sub-step 2 (Step1c) when auth.signUp is about to fire.
  const isStep1aComplete = (() => {
    const base = formData.name?.trim() && formData.email?.trim();
    if (showPasswordFieldsOnStep1) {
      return !!(base && formData.password && formData.confirmPassword);
    }
    return !!base;
  })();
  const isStep1bComplete = (() => {
    const locationOk =
      !!formData.locationCountry &&
      (formData.locationCountry !== 'United States' || !!formData.locationState) &&
      !!formData.locationCity?.trim(); // city now required for ALL countries (CitySelect)
    return !!(formData.dateOfBirth && locationOk && formData.identifyAs);
  })();
  const isStep1cComplete = (() => {
    return !!(formData.seriousRelationship && (isEditMode || formData.agreeToTerms));
  })();

  const isStep2Complete = formData.photos && formData.photos.length > 0;
  // Phase 2E split: Step 3a requires identity (cultures + faith lifestyle).
  // Step 3b requires core values (the only field we currently soft-gate on).
  const isStep3aComplete = formData.cultures?.length > 0 && formData.faithLifestyle;
  const isStep3bComplete = formData.coreValues?.length > 0;
  const isStep4Complete = formData.bio?.length >= 50 && formData.willingToRelocate && formData.familyGoals;

  const isStep5Complete = formData.relationshipGoal && formData.confirmMarriageIntent && (isEditMode || formData.agreeToTermsV2);

  // Phase 2F: hint only mentions fields visible on the CURRENT sub-step,
  // so the user never sees a confusing reference to a field on a later screen.
  const step1ContinueHint = () => {
    if (currentStep !== 1) return null;
    const parts = [];
    if (step1SubStep === 0) {
      if (!formData.name?.trim()) parts.push('enter your full name');
      if (!formData.email?.trim()) parts.push('enter your email');
      if (showPasswordFieldsOnStep1 && (!formData.password || !formData.confirmPassword)) {
        parts.push('set a password');
      }
    } else if (step1SubStep === 1) {
      if (!formData.dateOfBirth) parts.push('add your date of birth');
      if (!formData.locationCountry) parts.push('select your country of residence');
      if (formData.locationCountry === 'United States' && !formData.locationState) parts.push('select your state');
      if (formData.locationCountry && !formData.locationCity?.trim()) {
        parts.push('select your city');
      }
      if (!formData.identifyAs) parts.push('choose how you identify');
    } else if (step1SubStep === 2) {
      if (!formData.seriousRelationship) parts.push('confirm you are seeking marriage');
      if (!isEditMode && !formData.agreeToTerms) parts.push('accept the terms');
    }
    if (parts.length === 0) return null;
    return `To continue: ${parts.slice(0, 4).join('; ')}${parts.length > 4 ? '...' : '.'}`;
  };

  const step1HintText = step1ContinueHint();

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#FAF7F2]">
      <Helmet>
        <title>Join Marryzen — A Platform for Serious Marriage</title>
        <link rel="canonical" href="https://www.marryzen.com/onboarding" />
      </Helmet>
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
            <div className="flex gap-3">
              {(currentStep > 1 || step1SubStep > 0) && (
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  className="text-[#C85A72] hover:bg-[#F9E7EB] hover:text-[#C85A72] font-semibold px-6"
                >
                  ← Back
                </Button>
              )}
              {isEditMode && (
                <Button
                  variant="ghost"
                  onClick={() => navigate('/profile')}
                  className="text-[#706B67] hover:bg-[#F3E8D9] hover:text-[#1F1F1F] font-semibold px-6"
                >
                  Cancel
                </Button>
              )}
            </div>
            
            <div className="flex flex-col items-end">
                {currentStep === totalSteps && (
                    <p className="text-xs text-[#706B67] mb-3 font-medium max-w-xs text-right">
                        You're about to join Marryzen, a serious community built for real marriage.
                    </p>
                )}
                {step1HintText && (
                  <p className="text-xs text-[#8B7355] mb-3 font-medium max-w-sm text-right leading-relaxed">
                    {step1HintText}
                  </p>
                )}
                <Button
                  onClick={handleNext}
                  className="bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] rounded-full px-10 py-6 text-lg font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={
                    isLoading ||
                    (currentStep === 1 && step1SubStep === 0 && !isStep1aComplete) ||
                    (currentStep === 1 && step1SubStep === 1 && !isStep1bComplete) ||
                    (currentStep === 1 && step1SubStep === 2 && (!isStep1cComplete || !isStep1Valid())) ||
                    (currentStep === 2 && !isStep2Complete) ||
                    (currentStep === 3 && !isStep3aComplete) ||
                    (currentStep === 4 && !isStep3bComplete) ||
                    (currentStep === 5 && !isStep4Complete) ||
                    (currentStep === totalSteps && !isStep5Complete)
                  }
                >
                  {isLoading
                    ? 'Processing...'
                    : currentStep === totalSteps
                      ? (isEditMode ? 'Save Changes' : 'Activate Profile')
                      : (currentStep === 1 && step1SubStep === 2 && !isEditMode)
                        ? 'Create my account'
                        : isEditMode
                          ? 'Save & continue'
                          : 'Continue'}
                </Button>
            </div>
          </div>
        </div>
      </div>
    
      <PremiumTeaserModal
        open={showPremiumTeaser}
        onUpgrade={() => {
          try { localStorage.setItem('premium_teaser_seen', '1'); } catch {}
          setShowPremiumTeaser(false);
          navigate('/premium');
        }}
        onSkip={() => {
          try { localStorage.setItem('premium_teaser_seen', '1'); } catch {}
          setShowPremiumTeaser(false);
          navigate(postOnboardingNav || '/dashboard');
        }}
      />
</main>
  );
};

export default OnboardingPage;
