import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Cookie, Settings, Lock, Home, LayoutDashboard } from 'lucide-react';
import Footer from '@/components/Footer';

const CookiePolicy = () => {
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
            <h1 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-2">Cookie Policy</h1>
            <p className="text-[#706B67] font-medium">Effective Date: November 30, 2025</p>
        </div>

        {/* Content */}
        <div className="bg-[#FFFFFF] border border-[#E6DCD2] rounded-2xl p-8 md:p-12 shadow-sm space-y-8">
            
            <div className="p-6 rounded-2xl bg-[#FAF7F2] border border-[#E6DCD2]">
                 <div className="flex items-center gap-3 mb-4">
                    <Cookie className="w-8 h-8 text-[#E6B450]" />
                    <h2 className="text-xl font-bold text-[#1F1F1F]">1. What Are Cookies?</h2>
                </div>
                <p className="text-[#333333] leading-relaxed">
                    Cookies are small text files that are stored on your device (computer, smartphone, tablet) when you visit a website. 
                    They are widely used to make websites work more efficiently and provide information to the owners of the site. 
                    At Marryzen, we use cookies to distinguish you from other users, which helps us provide you with a seamless experience 
                    when you browse our Platform and also allows us to improve our site.
                </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#FFFFFF]">
                <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">2. How We Use Cookies</h2>
                <p className="mb-4 text-[#333333]">We use the following types of cookies on the Marryzen Platform:</p>
                
                <div className="space-y-4">
                    <div className="bg-[#FAF7F2] p-4 rounded-lg border border-[#E6DCD2]">
                        <h3 className="font-bold text-[#1F1F1F] text-sm flex items-center gap-2"><Lock className="w-3 h-3 text-[#706B67]"/> Strictly Necessary Cookies</h3>
                        <p className="text-xs mt-1 text-[#333333]">
                            These are essential for the operation of our website. They include, for example, cookies that enable you to log into secure areas of our website, 
                            process payments, or verify your identity.
                        </p>
                    </div>
                     <div className="bg-[#FAF7F2] p-4 rounded-lg border border-[#E6DCD2]">
                        <h3 className="font-bold text-[#1F1F1F] text-sm flex items-center gap-2"><Settings className="w-3 h-3 text-[#706B67]"/> Functionality Cookies</h3>
                        <p className="text-xs mt-1 text-[#333333]">
                            These are used to recognize you when you return to our website. This enables us to personalize our content for you, 
                            greet you by name, and remember your preferences (for example, your choice of language or region).
                        </p>
                    </div>
                     <div className="bg-[#FAF7F2] p-4 rounded-lg border border-[#E6DCD2]">
                        <h3 className="font-bold text-[#1F1F1F] text-sm">Analytical/Performance Cookies</h3>
                        <p className="text-xs mt-1 text-[#333333]">
                            They allow us to recognize and count the number of visitors and to see how visitors move around our website when they are using it. 
                            This helps us to improve the way our website works, for example, by ensuring that users are finding what they are looking for easily.
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#FFFFFF]">
                <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">3. Third-Party Cookies</h2>
                <p className="text-[#333333] leading-relaxed">
                    Please note that third parties (including, for example, advertising networks and providers of external services like web traffic analysis services) 
                    may also use cookies, over which we have no control. These cookies are likely to be analytical/performance cookies or targeting cookies.
                    Marryzen does not sell your data to third-party advertisers.
                </p>
            </div>

             <div className="p-6 rounded-2xl bg-[#FFFFFF]">
                <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">4. Managing Cookies</h2>
                <p className="text-[#333333] leading-relaxed">
                    You can block cookies by activating the setting on your browser that allows you to refuse the setting of all or some cookies. 
                    However, if you use your browser settings to block all cookies (including essential cookies), you may not be able to access all or parts of our site.
                </p>
                 <div className="mt-4 text-sm">
                    <p className="text-[#333333]">To find out more about cookies, including how to see what cookies have been set and how to manage and delete them, visit <a href="https://www.allaboutcookies.org" target="_blank" rel="noreferrer" className="text-[#E6B450] font-bold hover:underline">www.allaboutcookies.org</a>.</p>
                </div>
            </div>

        </div>
        <Footer />
      </div>
    </div>
  );
};

export default CookiePolicy;