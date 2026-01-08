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
        if (user) {
            setEmail(user.email);
            // Check if already verified in profile
            const { data } = await supabase.from('profiles').select('email_verified').eq('id', user.id).single();
            if (data?.email_verified) setStatus('verified');
        } else {
            navigate('/login');
        }
    };
    getUser();
  }, [navigate]);

  const handleResend = async () => {
      setLoading(true);
      // In a real implementation, this would call an Edge Function to generate token & send email
      // For this demo, we simulate the API call
      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("No user");

          // Simulate Edge Function Call
          // await supabase.functions.invoke('send-verification-email', { body: { email } });
          
          await new Promise(r => setTimeout(r, 1000)); 
          
          setStatus('sent');
          toast({ title: "Email Sent", description: "Check your inbox for the verification link." });
      } catch (err) {
          toast({ title: "Error", description: "Could not send email.", variant: "destructive" });
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