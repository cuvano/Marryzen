import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart, ShieldCheck, Home, LayoutDashboard } from 'lucide-react';
import Footer from '@/components/Footer';

const CommunityGuidelines = () => {
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
            <h1 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-2">Community Guidelines</h1>
            <p className="text-[#706B67] font-medium">Marryzen is built on Respect, Honesty, and Intent.</p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-2xl p-8 md:p-12 shadow-sm space-y-8">
            
            <div className="p-6 bg-[#F9E7EB] rounded-xl border border-[#E6B450]/20 mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Heart className="text-[#C85A72] w-6 h-6" />
                    <h2 className="text-xl font-bold text-[#1F1F1F]">Our Core Pledge</h2>
                </div>
                <p className="text-[#333333]">
                    Every member of Marryzen is here for one reason: to find a spouse. We expect every interaction to be dignified, polite, and conducted with serious intent.
                </p>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#1F1F1F]">✅ Do:</h3>
                <ul className="list-disc pl-5 space-y-2 text-[#333333]">
                    <li><strong>Be Honest:</strong> Accurately represent your age, height, job, and family status.</li>
                    <li><strong>Be Respectful:</strong> Treat matches with kindness, even if they aren't the right fit.</li>
                    <li><strong>Be Clear:</strong> Communicate your intentions and timelines early.</li>
                    <li><strong>Report Issues:</strong> Help us keep the community safe by reporting suspicious behavior.</li>
                </ul>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#1F1F1F]">❌ Do Not:</h3>
                <ul className="list-disc pl-5 space-y-2 text-[#333333]">
                    <li><strong>Harass or Bully:</strong> Zero tolerance for abusive language or threats.</li>
                    <li><strong>Solicit Money:</strong> Never ask for financial assistance or promote businesses.</li>
                    <li><strong>Seek Hookups:</strong> This is not a casual dating app. Sexual advances are grounds for immediate ban.</li>
                    <li><strong>Impersonate:</strong> Creating fake profiles (catfishing) is prohibited.</li>
                </ul>
            </div>

             <div className="pt-6 border-t border-[#E6DCD2]">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="text-[#E6B450] w-5 h-5" />
                    <p className="text-sm text-[#706B67]">Violations of these guidelines result in permanent account removal.</p>
                </div>
            </div>

        </div>
        <Footer />
      </div>
    </div>
  );
};

export default CommunityGuidelines;