import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, LayoutDashboard } from 'lucide-react';
import Footer from '@/components/Footer';
import { Helmet } from 'react-helmet';

/**
 * CookiePolicy
 * ------------
 * The canonical Cookie Policy lives in Termly. Termly's automated weekly
 * cookie scan keeps the cookie inventory current; the legal language is
 * auto-updated by Termly's attorney team when regulations change.
 *
 * To edit / re-scan: log into Termly →
 *   https://app.termly.io/dashboard/website/04874b92-554a-4fee-9d8f-2becf5ed2d06/cookie-policy
 */
const TERMLY_URL =
  'https://app.termly.io/policy-viewer/policy.html?policyUUID=508e7c0c-53e4-4dbb-85d8-3cdb92b46d89';

const CookiePolicy = () => {
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem('userProfile');

  return (
    <div className="min-h-screen p-4 md:p-8 pb-20 bg-[#FAF7F2] text-[#333333]">
      <Helmet><title>Cookie Policy — Marryzen</title></Helmet>
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
          <h1 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-2">Cookie Policy</h1>
          <p className="text-[#706B67] font-medium">Maintained and kept current by our compliance partner. See the effective date inside the document below.</p>
        </div>

        {/* Termly-hosted document */}
        <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-2xl shadow-sm overflow-hidden">
          <iframe
            src={TERMLY_URL}
            title="Marryzen Cookie Policy"
            loading="lazy"
            className="w-full"
            style={{ height: '80vh', border: 'none', display: 'block' }}
          />
        </div>

        <div className="pt-6 text-[#706B67] text-sm space-y-1">
          <p>
            Can&apos;t see the policy? <a href={TERMLY_URL} target="_blank" rel="noopener noreferrer" className="text-[#E6B450] font-bold hover:underline">Open it in a new tab</a>.
          </p>
          <p>
            Questions about cookies? Contact us at <a href="mailto:admin@marryzen.com" className="text-[#E6B450] font-bold hover:underline">admin@marryzen.com</a>
          </p>
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default CookiePolicy;
