import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Home, LayoutDashboard } from 'lucide-react';
import Footer from '@/components/Footer';

const TermsOfService = () => {
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

        {/* Header */}
        <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-2">Terms of Service</h1>
            <p className="text-[#706B67] font-medium">Last Updated: December 4, 2025</p>
        </div>

        {/* Content */}
        <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-2xl p-8 md:p-12 shadow-sm space-y-8">
            
            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-[#1F1F1F]">1. Introduction</h2>
                <p className="leading-relaxed text-[#333333]">
                    Welcome to Marryzen ("Company," "we," "our," "us"). These Terms of Service ("Terms") govern your use of our website, mobile application, and services (collectively, the "Service"). By accessing or using Marryzen, you agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, please do not use the Service.
                </p>
                <p className="leading-relaxed text-[#333333]">
                    Marryzen is strictly a platform for users seeking serious marriage and long-term commitment. Casual dating, hookups, and solicitation are strictly prohibited.
                </p>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-[#1F1F1F]">2. Eligibility</h2>
                <p className="leading-relaxed text-[#333333]">
                    You must be at least 18 years of age to create an account on Marryzen. By creating an account, you represent and warrant that:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-[#333333]">
                    <li>You are legally capable of entering into a binding contract.</li>
                    <li>You are not a person barred from using the Service under the laws of the United States or other applicable jurisdiction.</li>
                    <li>You have never been convicted of a felony or required to register as a sex offender.</li>
                    <li>You are single or legally separated and seeking marriage.</li>
                </ul>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-[#1F1F1F]">3. User Conduct</h2>
                <p className="leading-relaxed text-[#333333]">
                    We are a values-first community. You agree NOT to:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-[#333333]">
                    <li>Use the Service for any purpose that is illegal or prohibited by these Terms.</li>
                    <li>Harass, bully, stalk, intimidate, assault, defame, harm or otherwise mistreat any person.</li>
                    <li>Post any content that violates or infringes anyone's rights, including rights of publicity, privacy, copyright, trademark or other intellectual property or contract right.</li>
                    <li>Solicit money, passwords, or personal identifying information from other users for commercial or unlawful purposes.</li>
                    <li>Use the Service for "sugar dating," hookups, or prostitution.</li>
                </ul>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-[#1F1F1F]">4. Account Termination</h2>
                <p className="leading-relaxed text-[#333333]">
                    We reserve the right to suspend or terminate your account at any time, without notice, if we believe you have violated these Terms or for any other reason. If your account is terminated for a violation of these Terms, you will not be entitled to a refund of any unused subscription fees.
                </p>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-[#1F1F1F]">5. Disclaimers</h2>
                <p className="leading-relaxed text-[#333333]">
                    THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. WE DO NOT GUARANTEE THAT YOU WILL FIND A MARRIAGE PARTNER. YOU ARE SOLELY RESPONSIBLE FOR YOUR INTERACTIONS WITH OTHER USERS.
                </p>
            </div>

            <div className="pt-8 border-t border-[#E6DCD2]">
                <p className="text-[#706B67] text-sm">
                    Questions? Contact us at <a href="mailto:legal@marryzen.com" className="text-[#E6B450] font-bold hover:underline">legal@marryzen.com</a>
                </p>
            </div>

        </div>
        <Footer />
      </div>
    </div>
  );
};

export default TermsOfService;