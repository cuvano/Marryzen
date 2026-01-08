import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, LayoutDashboard } from 'lucide-react';
import Footer from '@/components/Footer';

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem('userProfile');

  return (
    <div className="min-h-screen p-4 md:p-8 pb-20 bg-[#FAF7F2] text-[#333333]">
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

        <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-2">Privacy Policy</h1>
            <p className="text-[#706B67] font-medium">Effective Date: December 4, 2025</p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-2xl p-8 md:p-12 shadow-sm space-y-8">
            
            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-[#1F1F1F]">1. Information We Collect</h2>
                <p className="leading-relaxed text-[#333333]">
                    To help you find a spouse, we collect personal information you voluntarily provide, including:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-[#333333]">
                    <li><strong>Account Data:</strong> Name, email address, date of birth, gender, location.</li>
                    <li><strong>Profile Data:</strong> Photos, cultural background, religious practices, family values, marriage timeline.</li>
                    <li><strong>Verification Data:</strong> Photo ID or other documents used for identity verification (processed by secure third parties).</li>
                </ul>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-[#1F1F1F]">2. How We Use Your Information</h2>
                <p className="leading-relaxed text-[#333333]">
                    We use your data strictly to:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-[#333333]">
                    <li>Provide and improve the matchmaking service.</li>
                    <li>Ensure community safety through moderation and verification.</li>
                    <li>Process subscription payments.</li>
                    <li>Communicate with you about your account.</li>
                </ul>
                <p className="font-bold text-[#1F1F1F] mt-2">We do NOT sell your personal data to third-party advertisers.</p>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-[#1F1F1F]">3. Data Security</h2>
                <p className="leading-relaxed text-[#333333]">
                    We implement robust security measures including encryption and access controls to protect your personal information. However, no system is 100% secure, and we cannot guarantee the absolute security of your data.
                </p>
            </div>

             <div className="space-y-4">
                <h2 className="text-2xl font-bold text-[#1F1F1F]">4. Your Rights</h2>
                <p className="leading-relaxed text-[#333333]">
                    Depending on your jurisdiction, you may have the right to access, correct, or delete your personal data. You can manage most settings directly within the app. To request full deletion, contact privacy@marryzen.com.
                </p>
            </div>

        </div>
        <Footer />
      </div>
    </div>
  );
};

export default PrivacyPolicy;