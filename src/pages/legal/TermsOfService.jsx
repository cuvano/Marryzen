import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, LayoutDashboard } from 'lucide-react';
import Footer from '@/components/Footer';
import { Helmet } from 'react-helmet';

/**
 * TermsOfService
 * --------------
 * The canonical Terms of Service lives in Termly and is auto-updated by
 * Termly's attorney team whenever applicable consumer-protection /
 * auto-renewal / arbitration laws change. This page embeds the live
 * Termly document inside the existing Marryzen page chrome.
 *
 * To edit the ToS itself: log into Termly →
 *   https://app.termly.io/dashboard/website/04874b92-554a-4fee-9d8f-2becf5ed2d06/terms-of-service
 * Changes propagate to this iframe automatically — no code redeploy needed.
 */
const TERMLY_URL =
  'https://app.termly.io/policy-viewer/policy.html?policyUUID=198b888b-02d9-4fa0-b9b0-53d69dac6e2c';

const TermsOfService = () => {
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem('userProfile');

  return (
    <div className="min-h-screen p-4 md:p-8 pb-20 bg-[#FAF7F2] text-[#333333]">
      <Helmet><title>Terms of Service — Marryzen</title></Helmet>
      <div className="max-w-4xl mx-auto">
        {/* Navigation Buttons */}
        <div className="flex justify-between items-center mb-8">
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-[#706B67] hover:text-[#1F1F1F] hover:bg-[#E6DCD2]/50 pl-0 font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/')} className="border-[#E6DCD2] text-[#333333] hover:bg-[#FFFFFF]">
              <Home className="w-4 h-4 mr-2" /> Home
            </Button>
            {isAuthenticated && (
              <Button variant="outline" onClick={() => navigate('/dashboard')} className="border-[#E6DCD2] text-[#333333] hover:bg-[#FFFFFF]">
                <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
              </Button>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-2">Terms of Service</h1>
          <p className="text-[#706B67] font-medium">Maintained and kept current by our compliance partner. See the effective date inside the document below.</p>
        </div>

        {/* Termly-hosted document */}
        <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-2xl shadow-sm overflow-hidden">
          <iframe
            src={TERMLY_URL}
            title="Marryzen Terms of Service"
            loading="lazy"
            className="w-full"
            style={{ height: '80vh', border: 'none', display: 'block' }}
          />
        </div>

        <div className="pt-6 text-[#706B67] text-sm space-y-1">
          <p>
            Can&apos;t see the terms? <a href={TERMLY_URL} target="_blank" rel="noopener noreferrer" className="text-[#E6B450] font-bold hover:underline">Open them in a new tab</a>.
          </p>
          <p>
            Questions? Contact us at <a href="mailto:admin@marryzen.com" className="text-[#E6B450] font-bold hover:underline">admin@marryzen.com</a>
          </p>
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default TermsOfService;
