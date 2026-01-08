import React, { useState } from 'react';
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
        // Check if profile exists and onboarding status
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('onboarding_step')
          .eq('id', data.session.user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
           console.error("Profile fetch error:", profileError);
        }

        toast({ title: "Welcome back!", description: "Successfully logged in." });
        
        // If profile is incomplete (e.g. step < 5), redirect to onboarding
        if (profile && profile.onboarding_step < 5) {
             navigate('/onboarding');
        } else {
             navigate('/dashboard');
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