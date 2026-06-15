// src/components/EmailPreferencesCard.jsx
//
// 2026-06-14 — CAN-SPAM + GDPR Art. 21 self-service marketing-email opt-out.
//
// Self-contained card (like AgePreferencesCard). Reads + writes
// profiles.marketing_emails_opt_out on the current user's row.
//
// Voice rules (CLAUDE.md): institutional — "we / Marryzen", never "our team".
// Copy clearly separates marketing (suppressible) from transactional emails
// (verification, password reset — always sent regardless of opt-out).

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Mail } from 'lucide-react';

const EmailPreferencesCard = () => {
  const { toast } = useToast();
  const [optOut, setOptOut] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        if (!cancelled) setLoaded(true);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('marketing_emails_opt_out')
        .eq('id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        setOptOut(data.marketing_emails_opt_out === true);
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleToggle = async (checked) => {
    // `checked === true` means "Receive marketing emails" is ON,
    // so the opt_out flag should be FALSE.
    const nextOptOut = !checked;
    setSaving(true);
    setOptOut(nextOptOut);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('no_session');
      const { error } = await supabase
        .from('profiles')
        .update({
          marketing_emails_opt_out: nextOptOut,
          marketing_emails_opt_out_at: nextOptOut ? new Date().toISOString() : null,
        })
        .eq('id', session.user.id);
      if (error) throw error;
      toast({
        title: nextOptOut ? 'Marketing emails turned off' : 'Marketing emails turned on',
        description: nextOptOut
          ? "You'll still receive important account messages like verification results and password resets."
          : "You'll receive Marryzen tips, nudges, and product updates.",
      });
    } catch (e) {
      // Revert optimistic state
      setOptOut(!nextOptOut);
      toast({
        title: 'Could not save preference',
        description: 'Please try again, or email admin@marryzen.com if it keeps failing.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-6 border-[#E6DCD2]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#1F1F1F]">
          <Mail className="w-5 h-5 text-[#C85A72]" />
          Email preferences
        </CardTitle>
        <CardDescription>
          Marryzen sends two kinds of emails. You can turn marketing emails on or off here. Account messages (verification, password reset, billing) are always sent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4 py-2">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-[#1F1F1F]">Marketing emails</div>
            <div className="text-sm text-[#706B67] mt-1">
              Welcome series, profile nudges, verification reminders, and product updates. Turning this off does not affect account or billing messages.
            </div>
          </div>
          <Switch
            checked={!optOut}
            onCheckedChange={handleToggle}
            disabled={!loaded || saving}
            aria-label="Receive marketing emails"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default EmailPreferencesCard;
