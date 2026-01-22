import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import Footer from '@/components/Footer';

const ReferralTerms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/referrals')}
          className="mb-6 text-[#706B67] hover:text-[#1F1F1F]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Referrals
        </Button>

        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-[#E6B450]" />
              <CardTitle className="text-3xl">Referral Program Terms & Conditions</CardTitle>
            </div>
            <p className="text-sm text-[#706B67] mt-2">Last updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <div className="space-y-6 text-[#1F1F1F]">
              <section>
                <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  How the Referral Program Works
                </h2>
                <p className="text-[#706B67] mb-4">
                  The Marryzen Referral Program allows you to earn rewards by inviting friends to join our platform. 
                  When a friend you refer signs up and gets their profile approved, both you and your friend receive 
                  7 days of Premium membership free.
                </p>
                <ol className="list-decimal list-inside space-y-2 text-[#706B67] ml-4">
                  <li>Share your unique referral link or code with friends</li>
                  <li>Your friend signs up using your referral link/code</li>
                  <li>Your friend completes their profile and gets approved</li>
                  <li>Both you and your friend receive 7 days of Premium free</li>
                </ol>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#C85A72]" />
                  Tracking Integrity
                </h2>
                <p className="text-[#706B67] mb-4">
                  We track all referrals with the following information to ensure program integrity:
                </p>
                <ul className="list-disc list-inside space-y-2 text-[#706B67] ml-4">
                  <li><strong>Referrer:</strong> The user who shared the referral (you)</li>
                  <li><strong>Referee:</strong> The user who signed up using your referral</li>
                  <li><strong>Timestamp:</strong> Exact date and time when the referral was created</li>
                  <li><strong>Status:</strong> Current status of the referral (pending, completed, expired)</li>
                </ul>
                <p className="text-[#706B67] mt-4">
                  All referral data is stored securely and can be viewed in your Referral History.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  Anti-Abuse Rules
                </h2>
                <p className="text-[#706B67] mb-4">
                  To maintain the integrity of our referral program and prevent abuse, the following rules apply:
                </p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                  <ul className="list-disc list-inside space-y-2 text-[#706B67]">
                    <li><strong>One Account Per Person:</strong> Each user can only have one account. Creating multiple accounts to refer yourself is strictly prohibited.</li>
                    <li><strong>One Device Limit:</strong> Referrals must come from legitimate, separate users. Using multiple devices to create fake referrals is not allowed.</li>
                    <li><strong>One Payout Per Referral:</strong> Each successful referral can only result in one reward payout. Duplicate referrals will be rejected.</li>
                    <li><strong>Valid Email Addresses:</strong> Referred users must use valid, unique email addresses. Using temporary or fake email addresses is prohibited.</li>
                    <li><strong>Profile Approval Required:</strong> Rewards are only issued when the referred friend's profile is approved by our moderation team.</li>
                    <li><strong>No Self-Referrals:</strong> You cannot refer yourself using a different email or device.</li>
                    <li><strong>No Bot or Automated Referrals:</strong> All referrals must come from real, human users.</li>
                  </ul>
                </div>
                <p className="text-[#706B67] font-semibold">
                  Violation of these rules may result in:
                </p>
                <ul className="list-disc list-inside space-y-2 text-[#706B67] ml-4">
                  <li>Immediate suspension of your referral rewards</li>
                  <li>Permanent ban from the referral program</li>
                  <li>Account suspension or termination</li>
                  <li>Legal action in cases of fraud</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-3">Reward Eligibility</h2>
                <ul className="list-disc list-inside space-y-2 text-[#706B67] ml-4">
                  <li>Rewards are issued automatically within 24 hours of the referred friend's profile approval</li>
                  <li>Both the referrer and referee receive 7 days of Premium membership</li>
                  <li>Premium rewards are added directly to your account</li>
                  <li>Rewards cannot be transferred, sold, or exchanged for cash</li>
                  <li>Rewards expire if not used within 90 days of issuance</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-3">Referral Status</h2>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 mt-1">Pending</span>
                    <p className="text-[#706B67] flex-1">Your friend has signed up but their profile is not yet approved. Reward is locked until approval.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 mt-1">Completed</span>
                    <p className="text-[#706B67] flex-1">Your friend's profile has been approved. Reward has been issued to both accounts.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 mt-1">Expired</span>
                    <p className="text-[#706B67] flex-1">The referral did not result in a completed signup or the friend's profile was rejected.</p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-3">Program Modifications</h2>
                <p className="text-[#706B67]">
                  Marryzen reserves the right to modify, suspend, or terminate the referral program at any time. 
                  We may also change reward amounts, eligibility criteria, or program rules with reasonable notice. 
                  Existing referrals will be honored according to the terms in effect at the time they were created.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-3">Contact</h2>
                <p className="text-[#706B67]">
                  If you have questions about the referral program or believe there is an error with your referrals, 
                  please contact our support team through the app or email support@marryzen.com.
                </p>
              </section>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
                <p className="text-sm text-blue-800">
                  <strong>By participating in the Marryzen Referral Program, you agree to these terms and conditions.</strong> 
                  We reserve the right to investigate and take action against any suspected abuse of the program.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center gap-4 mb-8">
          <Button 
            onClick={() => navigate('/referrals')}
            className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D]"
          >
            Return to Referrals
          </Button>
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default ReferralTerms;
