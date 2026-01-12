import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Heart, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const LoginPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in (only redirect if onboarding is explicitly incomplete)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // User is already logged in, check onboarding status
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_step')
          .eq('id', session.user.id)
          .maybeSingle();
        
        // Only redirect to onboarding if onboarding_step is explicitly set and less than 5
        // If null/undefined or >= 5, go to dashboard
        if (profile) {
          const onboardingStep = profile.onboarding_step;
          if (onboardingStep !== null && onboardingStep !== undefined && onboardingStep < 5) {
            navigate('/onboarding', { replace: true });
          } else {
            // onboarding_step is null, undefined, or >= 5, go to dashboard
            navigate('/dashboard', { replace: true });
          }
        } else {
          // Profile doesn't exist yet, allow user to stay on login or go to onboarding
          // Don't auto-redirect - let them choose
        }
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        // Store session info in localStorage for quick access (optional, but helps)
        localStorage.setItem('userProfile', JSON.stringify({
          id: data.session.user.id,
          email: data.session.user.email
        }));

        // Check if profile exists and onboarding status
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('onboarding_step')
          .eq('id', data.session.user.id)
          .maybeSingle(); // Use maybeSingle to handle case where profile doesn't exist

        if (profileError && profileError.code !== 'PGRST116') {
           console.error("Profile fetch error:", profileError);
        }

        toast({ title: "Welcome back!", description: "Successfully logged in." });
        
        // Wait for auth state to propagate and session to be fully established
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Double-check session is still valid before navigating
        const { data: { session: verifySession } } = await supabase.auth.getSession();
        if (!verifySession) {
          toast({
            title: "Session Error",
            description: "Please try logging in again.",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
        
        // If profile is incomplete (e.g. step < 5), redirect to onboarding
        if (profile && profile.onboarding_step && profile.onboarding_step < 5) {
             navigate('/onboarding', { replace: true });
        } else {
             navigate('/dashboard', { replace: true });
        }
      }
    } catch (error) {
      toast({ 
        title: "Login Failed", 
        description: error.message || "Invalid credentials. Please try again.",
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#E6DCD2] p-8 md:p-10">
        <div className="text-center mb-10">
            <div className="w-16 h-16 bg-[#F9E7EB] rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-[#C85A72] fill-current" />
            </div>
            <h1 className="text-3xl font-bold text-[#1F1F1F]">Welcome Back</h1>
            <p className="text-[#706B67] mt-2">Log in to continue your journey.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                    id="email" 
                    type="email" 
                    placeholder="you@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12"
                />
            </div>
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label htmlFor="password">Password</Label>
                    <a href="#" className="text-xs text-[#C85A72] font-medium hover:underline">Forgot password?</a>
                </div>
                <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12"
                />
            </div>

            <Button type="submit" className="w-full h-12 text-lg font-bold bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F]" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Log In'} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
        </form>

        <div className="mt-8 text-center text-sm text-[#706B67]">
            Don't have an account yet?{' '}
            <button onClick={() => navigate('/onboarding')} className="text-[#C85A72] font-bold hover:underline">
                Create Profile
            </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;