/**
 * Script to create random test accounts for Marryzen
 * 
 * Usage:
 * 1. Set your Supabase credentials in .env
 * 2. Run: node scripts/create-test-accounts.js [number_of_accounts]
 * 
 * Example: node scripts/create-test-accounts.js 10
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase credentials in .env file');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Sample data pools
const firstNames = [
  'Ahmed', 'Fatima', 'Mohammed', 'Aisha', 'Omar', 'Zainab', 'Ali', 'Mariam',
  'Hassan', 'Layla', 'Ibrahim', 'Sara', 'Yusuf', 'Amina', 'Khalid', 'Noor',
  'Malik', 'Hana', 'Tariq', 'Salma', 'Rashid', 'Lina', 'Jamal', 'Dina',
  'Nadia', 'Samir', 'Rania', 'Karim', 'Yara', 'Bilal'
];

const lastNames = [
  'Al-Ahmad', 'Hassan', 'Ibrahim', 'Khan', 'Ali', 'Ahmed', 'Malik', 'Rashid',
  'Hussein', 'Mahmoud', 'Omar', 'Salem', 'Farid', 'Nasser', 'Zaki', 'Hamid',
  'Tariq', 'Karim', 'Bilal', 'Jamal', 'Rashid', 'Yusuf', 'Khalid', 'Samir'
];

const cities = [
  'London', 'New York', 'Toronto', 'Sydney', 'Dubai', 'Istanbul', 'Cairo',
  'Karachi', 'Lahore', 'Dhaka', 'Mumbai', 'Delhi', 'Berlin', 'Paris', 'Madrid',
  'Amsterdam', 'Stockholm', 'Oslo', 'Copenhagen', 'Zurich', 'Brussels'
];

const countries = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'India', 'Pakistan',
  'Bangladesh', 'Egypt', 'Türkiye', 'Saudi Arabia', 'United Arab Emirates',
  'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Sweden', 'Norway'
];

const religions = ['Muslim', 'Christian', 'Jewish', 'Hindu', 'Sikh', 'Buddhist', 'Spiritual', 'Other'];
const faithLifestyles = [
  'Very religious / practicing', 'Moderately practicing', 'Cultural faith only',
  'Spiritual but not religious', 'Not religious / Not practicing'
];

const smokingOptions = ['No', 'Socially', 'Regularly'];
const drinkingOptions = ['No', 'Socially', 'Regularly'];
const maritalStatuses = ['Never Married', 'Divorced', 'Widowed', 'Annulled'];
const educationLevels = [
  'High School', 'Some College', "Bachelor's Degree", "Master's Degree",
  'Doctorate', 'Professional Degree'
];

const zodiacSigns = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

const languages = [
  'English', 'Arabic', 'Urdu', 'Hindi', 'Bengali', 'Turkish', 'French',
  'German', 'Spanish', 'Portuguese', 'Italian', 'Russian'
];

const relationshipGoals = [
  'Marriage Only (Primary Intent)',
  'Serious Relationship With Clear Path to Marriage',
  'Marriage Goal Within 1–2 Years'
];

const bios = [
  'Looking for a life partner who shares my values and faith. Family-oriented and committed to building a strong, loving relationship.',
  'Seeking a serious relationship leading to marriage. I value honesty, respect, and mutual understanding. Love traveling and exploring new cultures.',
  'Family is everything to me. Looking for someone who shares similar values and is ready for a committed relationship.',
  'Passionate about my faith and community. Seeking a partner who understands the importance of family and tradition.',
  'Professional with a heart for family. Looking for someone who values both career and family life equally.',
  'Love cooking, reading, and spending time with family. Seeking a partner who appreciates simple joys in life.',
  'Adventurous spirit with strong family values. Looking for someone to share life\'s journey with.',
  'Believe in building a strong foundation for marriage. Seeking someone who shares this commitment.',
  'Love learning about different cultures and traditions. Looking for a partner who values diversity and understanding.',
  'Family-oriented professional seeking a life partner. Value honesty, communication, and mutual respect.'
];

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomItems(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, array.length));
}

function randomDate(minAge = 22, maxAge = 45) {
  const age = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
  const year = new Date().getFullYear() - age;
  const month = Math.floor(Math.random() * 12);
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(year, month, day).toISOString().split('T')[0];
}

function generateEmail(firstName, lastName, index) {
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
  const domain = randomItem(domains);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@${domain}`;
}

async function createTestAccount(index) {
  const firstName = randomItem(firstNames);
  const lastName = randomItem(lastNames);
  const email = generateEmail(firstName, lastName, index);
  const password = 'Test1234!'; // Simple password for all test accounts
  const fullName = `${firstName} ${lastName}`;
  const dateOfBirth = randomDate(22, 45);
  const city = randomItem(cities);
  const country = randomItem(countries);
  const gender = Math.random() > 0.5 ? 'Male' : 'Female';
  const lookingFor = gender === 'Male' ? 'Female' : 'Male';

  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName
      }
    });

    if (authError) {
      console.error(`Error creating user ${email}:`, authError.message);
      return null;
    }

    const userId = authData.user.id;

    // Create profile
    const profileData = {
      id: userId,
      full_name: fullName,
      email,
      date_of_birth: dateOfBirth,
      location_city: city,
      location_country: country,
      identify_as: gender,
      looking_for_gender: lookingFor,
      religious_affiliation: randomItem(religions),
      faith_lifestyle: randomItem(faithLifestyles),
      smoking: randomItem(smokingOptions),
      drinking: randomItem(drinkingOptions),
      marital_history: randomItem(maritalStatuses),
      has_children: Math.random() > 0.7,
      education_level: randomItem(educationLevels),
      occupation: randomItem(['Engineer', 'Doctor', 'Teacher', 'Business Owner', 'Designer', 'Developer', 'Manager', 'Consultant']),
      country_of_origin: randomItem(countries),
      country_of_residence: country,
      zodiac_sign: randomItem(zodiacSigns),
      languages: randomItems(languages, Math.floor(Math.random() * 3) + 1),
      bio: randomItem(bios),
      relationship_goal: randomItem(relationshipGoals),
      serious_relationship: true,
      agree_to_terms: true,
      agree_to_terms_v2: true,
      confirm_marriage_intent: true,
      onboarding_step: 5,
      status: Math.random() > 0.3 ? 'approved' : 'pending_review', // 70% approved
      is_premium: Math.random() > 0.8, // 20% premium
      is_verified: Math.random() > 0.5, // 50% verified
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_active_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() // Active within last 7 days
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .insert(profileData);

    if (profileError) {
      console.error(`Error creating profile for ${email}:`, profileError.message);
      // Try to delete the auth user if profile creation failed
      await supabase.auth.admin.deleteUser(userId);
      return null;
    }

    console.log(`✓ Created account ${index + 1}: ${fullName} (${email})`);
    return { email, password, fullName };
  } catch (error) {
    console.error(`Error creating account ${index + 1}:`, error.message);
    return null;
  }
}

async function main() {
  const numAccounts = parseInt(process.argv[2]) || 10;
  
  console.log(`\n🚀 Creating ${numAccounts} test accounts...\n`);

  const accounts = [];
  for (let i = 0; i < numAccounts; i++) {
    const account = await createTestAccount(i);
    if (account) {
      accounts.push(account);
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n✅ Successfully created ${accounts.length} test accounts\n`);
  console.log('📋 Account Credentials:\n');
  console.log('Email | Password | Name');
  console.log('------|----------|------');
  accounts.forEach(acc => {
    console.log(`${acc.email} | ${acc.password} | ${acc.fullName}`);
  });
  console.log('\n💡 All accounts use password: Test1234!');
  console.log('💡 70% of accounts are approved, 20% are premium, 50% are verified\n');
}

main().catch(console.error);
