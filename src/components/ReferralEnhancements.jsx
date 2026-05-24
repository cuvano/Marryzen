import React, { useEffect, useState } from 'react';
import { Share2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

/**
 * Referral page enhancements — pipeline funnel, native share button, FAQ accordion.
 * Drops in below the existing How It Works section without touching it.
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
        // Pull all referrals by this user, count by status
        const { data, error } = await supabase
          .from('referrals')
          .select('status, reward_claimed, referred_user_id')
          .eq('referrer_id', user.id);
        if (cancelled) return;
        if (error || !data) { setLoading(false); return; }
        const invited = data.length;
        // For verified + paid counts, join against profiles
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
    const text = shareCopy || `I've been on Marryzen — it's a dating app where everyone is ID-verified and actually looking for marriage. Thought of you. Here's a month free if you want to check it out: ${referralLink}`;
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

  const monthsEarned = counts.verified + (counts.paid * 2);
  const nextMilestone = monthsEarned < 1 ? 1 : monthsEarned < 6 ? 6 : monthsEarned < 12 ? 12 : null;

  const faqs = [
    {
      q: 'How do I know when my friend joins?',
      a: 'Your pipeline above updates automatically. We will also email you when a friend completes verification or upgrades to Premium so you can celebrate together.',
    },
    {
      q: 'What counts as "verified"?',
      a: 'Your friend has completed Marryzen ID verification with a government-issued document. Only verified friends count toward your reward.',
    },
    {
      q: 'When does my free month start?',
      a: 'The first month is credited as soon as your friend completes verification. Two more months are added when they upgrade to a paid plan. Free months stack on top of any plan you already have.',
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
    <div className="space-y-6 max-w-3xl mx-auto px-4 pb-12">
      {/* Native share — primary CTA for mobile users */}
      <Button
        onClick={handleNativeShare}
        className="w-full bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold py-6 text-base"
      >
        <Share2 className="w-5 h-5 mr-2" />
        Invite a friend
      </Button>

      {/* Pipeline funnel */}
      <Card className="bg-white border-[#E6DCD2]">
        <CardContent className="p-5">
          <h3 className="font-bold text-[#1F1F1F] mb-4">Your invites</h3>
          {loading ? (
            <p className="text-sm text-[#706B67]">Loading...</p>
          ) : counts.invited === 0 ? (
            <div className="text-center py-6">
              <p className="text-[#706B67] mb-1">Your invites will appear here.</p>
              <p className="text-sm text-[#9CA3AF]">Send your first one — it takes 10 seconds.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#1F1F1F]">{counts.invited}</div>
                  <div className="text-xs text-[#706B67] uppercase tracking-wide mt-1">Invited</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#1F1F1F]">{counts.verified}</div>
                  <div className="text-xs text-[#706B67] uppercase tracking-wide mt-1">Verified</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#1F1F1F]">{counts.paid}</div>
                  <div className="text-xs text-[#706B67] uppercase tracking-wide mt-1">Subscribed</div>
                </div>
              </div>
              <div className="bg-[#FFFBEB] border border-[#E6B450] rounded-lg p-3">
                <p className="text-sm font-semibold text-[#1F1F1F]">
                  {monthsEarned > 0
                    ? `${monthsEarned} free month${monthsEarned === 1 ? '' : 's'} of Premium earned.`
                    : 'No rewards yet — keep sharing.'}
                </p>
                {nextMilestone && (
                  <p className="text-xs text-[#706B67] mt-1">
                    Next milestone: {nextMilestone} months.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Trust line */}
      <p className="text-xs text-[#706B67] text-center px-4">
        Your friends will never know who invited them unless you tell them. We never post anywhere on your behalf.
      </p>

      {/* FAQ accordion */}
      <Card className="bg-white border-[#E6DCD2]">
        <CardContent className="p-5">
          <h3 className="font-bold text-[#1F1F1F] mb-3">Frequently asked questions</h3>
          <div className="space-y-2">
            {faqs.map((item, i) => (
              <div key={i} className="border-b border-[#E6DCD2] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between py-3 text-left"
                >
                  <span className="font-semibold text-sm text-[#1F1F1F] pr-3">{item.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-4 h-4 text-[#706B67] flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#706B67] flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <p className="text-sm text-[#706B67] leading-relaxed pb-3">{item.a}</p>
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
