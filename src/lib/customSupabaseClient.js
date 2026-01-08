import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://adufstvmmzpqdcmpinqd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdWZzdHZtbXpwcWRjbXBpbnFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NTI3MTEsImV4cCI6MjA4MTQyODcxMX0.AtKLJ-33Oivu9DSbzKLd19O-fOPOeTtkwg9BD_vF4-w';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
