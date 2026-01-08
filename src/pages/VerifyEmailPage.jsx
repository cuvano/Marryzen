import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

const VerifyEmailPage = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('pending'); // pending, sent, verified, error
  const [email, setEmail] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (user) {
            setEmail(user.email);
            
            // Check if email is verified
            if (user.email_confirmed_at || session) {
                setStatus('verified');
                
                // Check if there's pending onboarding data
                const pendingData = localStorage.getItem('onboarding_pending');
                if (pendingData) {
                    try {
                        const pending = JSON.parse(pendingData);
                        // User just confirmed email, redirect back to onboarding
                        localStorage.removeItem('onboarding_pending');
                        navigate('/onboarding');
                        return;
                    } catch (e) {
                        console.error('Error parsing pending data:', e);
                    }
                }
            } else {
                setStatus('pending');
            }
        } else {
            // Check if there's pending onboarding (user signed up but not confirmed)
            const pendingData = localStorage.getItem('onboarding_pending');
            if (pendingData) {
                try {
                    const pending = JSON.parse(pendingData);
                    setEmail(pending.email);
                    setStatus('pending');
                } catch (e) {
                    navigate('/login');
                }
            } else {
                navigate('/login');
            }
        }
    };
    getUser();
    
    // Listen for auth state changes (when user confirms email)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            setStatus('verified');
            // Check for pending onboarding
            const pendingData = localStorage.getItem('onboarding_pending');
            if (pendingData) {
                localStorage.removeItem('onboarding_pending');
                navigate('/onboarding');
            }
        }
    });
    
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleResend = async () => {
      setLoading(true);
      try {
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
              // User exists, resend confirmation email
              const { error } = await supabase.auth.resend({
                  type: 'signup',
                  email: user.email
              });
              
              if (error) throw error;
              
              setStatus('sent');
              toast({ title: "Email Sent", description: "Check your inbox for the verification link." });
          } else {
              // No user session, try to resend using email from pending data
              const pendingData = localStorage.getItem('onboarding_pending');
              if (pendingData) {
                  const pending = JSON.parse(pendingData);
                  // Note: Supabase doesn't have a direct resend for unconfirmed users
                  // User needs to sign up again or check their email
                  toast({ 
                      title: "Check Your Email", 
                      description: "If you didn't receive the email, please check your spam folder or try signing up again.",
                      duration: 6000
                  });
              } else {
                  throw new Error("No user found");
              }
          }
      } catch (err) {
          console.error('Resend error:', err);
          toast({ 
              title: "Error", 
              description: err.message || "Could not send email. Please try signing up again.",
              variant: "destructive" 
          });
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] p-4">
        <Card className="w-full max-w-md bg-white border-[#E6DCD2]">
            <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                    {status === 'verified' ? <CheckCircle className="text-green-500" /> : <Mail className="text-blue-500" />}
                </div>
                <CardTitle>Verify your Email</CardTitle>
                <CardDescription>
                    {status === 'verified' ? "Your email has been successfully verified." : `We need to verify ${email} to secure your account.`}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {status === 'verified' ? (
                    <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => navigate('/dashboard')}>
                        Continue to Dashboard
                    </Button>
                ) : (
                    <>
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded text-sm text-yellow-800 flex gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <p>You won't be able to send messages or upgrade until verified.</p>
                        </div>
                        <Button 
                            className="w-full bg-[#1F1F1F] text-white" 
                            onClick={handleResend}
                            disabled={loading || status === 'sent'}
                        >
                            {loading ? <Loader2 className="animate-spin mr-2" /> : null}
                            {status === 'sent' ? 'Email Sent' : 'Send Verification Link'}
                        </Button>
                        <Button variant="ghost" className="w-full" onClick={() => navigate('/dashboard')}>
                            Skip for now
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    </div>
  );
};

export default VerifyEmailPage;