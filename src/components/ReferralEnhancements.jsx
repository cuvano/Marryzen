import React, { useEffect, useState } from 'react';
import { Share2, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

/**
 * Referral page enhancements - native share CTA, "Your invites" tracker,
 * trust line, and FAQ accordion. Styled to match the rest of /referral
 * (cream card backgrounds, gold border accents).
 *
 * Reward economics (v1.1, per user feedback):
 *   - 1 month free when referee completes Didit verification
 *   - 1 more month when referee upgrades to a paid plan
 *   - Cap: 12 free months per rolling year
 *
 * Props: { referralLink, shareCopy }
 */
const ReferralEnhancements = ({ referralLink, shareCopy }) => {
  const { user } = useAuth();
  const [counts, setCounts] = useState({ invited: 0, verified: 0, paid: 0 });
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('referrals')
          .select('status, reward_claimed, referred_user_id')
          .eq('referrer_id', user.id);
        if (cancelled) return;
        if (error || !data) { setLoading(false); return; }
        const invited = data.length;
        const referredIds = data.map(r => r.referred_user_id).filter(Boolean);
        let verified = 0;
        let paid = 0;
        if (referredIds.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, is_verified, is_premium')
            .in('id', referredIds);
          if (profs) {
            verified = profs.filter(p => p.is_verified).length;
            paid = profs.filter(p => p.is_premium).length;
          }
        }
        if (!cancelled) {
          setCounts({ invited, verified, paid });
          setLoading(false);
        }
      } catch (_) {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleNativeShare = async () => {
    const text = shareCopy || `I've been on Marryzen - a dating app where everyone is ID-verified and actually looking for marriage. Thought of you. Here's a month free if you want to check it out: ${referralLink}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Marryzen', text, url: referralLink });
      } catch (_) {}
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        alert('Invite copied to clipboard. Paste it into your favourite app to send.');
      } catch (_) {}
    }
  };

  // 1 month per verified + 1 month per paid (capped at 12/year)
  const monthsEarned = Math.min(counts.verified + counts.paid, 12);
  const nextMilestone = monthsEarned < 1 ? 1 : monthsEarned < 6 ? 6 : monthsEarned < 12 ? 12 : null;

  const faqs = [
    {
      q: 'How do I know when my friend joins?',
      a: 'The "Your invites" tracker above updates automatically. We will also email you when a friend completes verification or upgrades to Premium so you can celebrate together.',
    },
    {
      q: 'What counts as "verified"?',
      a: 'Your friend has completed Marryzen ID verification with a government-issued document. Only verified friends count toward your reward.',
    },
    {
      q: 'When does my free month start?',
      a: 'The first month is credited as soon as your friend completes verification. One more month is credited if they upgrade to a paid plan. Free months stack on top of any plan you already have.',
    },
    {
      q: 'Is there a limit?',
      a: 'You can earn up to 12 free months per rolling year. The cap resets at your account anniversary.',
    },
    {
      q: 'What if my friend already has a Marryzen account?',
      a: 'Existing accounts cannot be re-attributed. Your link only works for people creating a brand new account.',
    },
  ];

  return (
    <div className="space-y-6 mb-8">
      {/* Native share - primary CTA, styled to match brand */}
      <Button
        onClick={handleNativeShare}
        className="w-full bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold py-6 text-base rounded-lg"
      >
        <Share2 className="w-5 h-5 mr-2" />
        Invite a friend
      </Button>

      {/* "Your invites" tracker - matches Card style used elsewhere on the page */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[#E6B450]"/> Your invites
          </CardTitle>
          <CardDescription>See who signed up, verified, and upgraded - updates automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-[#706B67]">Loading...</p>
          ) : counts.invited === 0 ? (
            <div className="text-center py-8 bg-[#FAF7F2] rounded-lg border border-dashed border-[#E6DCD2]">
              <p className="text-[#1F1F1F] font-medium mb-1">Your invites will appear here.</p>
              <p className="text-sm text-[#706B67]">Send your first one - it takes 10 seconds.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-4 bg-[#FAF7F2] rounded-lg border border-[#E6DCD2]">
                  <div className="text-3xl font-bold text-[#1F1F1F]">{counts.invited}</div>
                  <div className="text-xs text-[#706B67] uppercase tracking-wide font-medium mt-1">Invited</div>
                </div>
                <div className="text-center p-4 bg-[#FAF7F2] rounded-lg border border-[#E6DCD2]">
                  <div className="text-3xl font-bold text-[#1F1F1F]">{counts.verified}</div>
                  <div className="text-xs text-[#706B67] uppercase tracking-wide font-medium mt-1">Verified</div>
                </div>
                <div className="text-center p-4 bg-[#FAF7F2] rounded-lg border border-[#E6DCD2]">
                  <div className="text-3xl font-bold text-[#1F1F1F]">{counts.paid}</div>
                  <div className="text-xs text-[#706B67] uppercase tracking-wide font-medium mt-1">Subscribed</div>
                </div>
              </div>
              <div className="bg-[#FFFBEB] border border-[#E6B450] rounded-lg p-4">
                <p className="text-sm font-semibold text-[#1F1F1F]">
                  {monthsEarned > 0
                    ? `${monthsEarned} free month${monthsEarned === 1 ? '' : 's'} of Premium earned.`
                    : 'No rewards yet - keep sharing.'}
                </p>
                {nextMilestone && (
                  <p className="text-xs text-[#706B67] mt-1">
                    Next milestone: {nextMilestone} month{nextMilestone === 1 ? '' : 's'}.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Trust line - bigger and more visible per user feedback */}
      <div className="bg-[#FAF7F2] border border-[#E6DCD2] rounded-lg p-4 flex items-start gap-3">
        <Lock className="w-5 h-5 text-[#E6B450] flex-shrink-0 mt-0.5" />
        <p className="text-sm text-[#1F1F1F] leading-relaxed">
          Your friends will never know who invited them unless you tell them. We never post anywhere on your behalf.
        </p>
      </div>

      {/* FAQ accordion - matches Card style */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently asked questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {faqs.map((item, i) => (
              <div key={i} className="border-b border-[#E6DCD2] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between py-4 text-left hover:bg-[#FAF7F2] -mx-2 px-2 rounded transition-colors"
                >
                  <span className="font-semibold text-sm text-[#1F1F1F] pr-3">{item.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-4 h-4 text-[#706B67] flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#706B67] flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <p className="text-sm text-[#706B67] leading-relaxed pb-4 px-2">{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReferralEnhancements;
