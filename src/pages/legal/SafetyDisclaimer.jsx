import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Home, LayoutDashboard } from 'lucide-react';
import Footer from '@/components/Footer';

const SafetyDisclaimer = () => {
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
            <h1 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-2">Safety Disclaimer</h1>
            <p className="text-[#706B67] font-medium">Important information for your safety.</p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-2xl p-8 md:p-12 shadow-sm space-y-8">
            
            <div className="flex items-start gap-4">
                <AlertTriangle className="w-8 h-8 text-[#E6B450] shrink-0 mt-1" />
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-[#1F1F1F]">User Responsibility</h2>
                    <p className="leading-relaxed text-[#333333]">
                        Marryzen conducts basic identity verification checks, but we do not conduct criminal background checks. You are solely responsible for your interactions with other users.
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#1F1F1F]">Essential Safety Tips</h3>
                <ul className="list-disc pl-5 space-y-2 text-[#333333]">
                    <li><strong>Keep communication on the platform</strong> until you feel completely comfortable.</li>
                    <li><strong>Never send money</strong> to anyone you meet online, for any reason.</li>
                    <li><strong>Protect your personal info:</strong> Don't share your home address, SSN, or financial details.</li>
                    <li><strong>Meet in public:</strong> For first meetings, always choose a busy public place and tell a friend or family member where you are going.</li>
                    <li><strong>Trust your gut:</strong> If something feels off, end the interaction and block the user.</li>
                </ul>
            </div>

        </div>
        <Footer />
      </div>
    </div>
  );
};

export default SafetyDisclaimer;