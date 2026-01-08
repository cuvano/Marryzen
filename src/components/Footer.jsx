import React from 'react';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = ({ isProfileFooter = false }) => {
  if (isProfileFooter) {
    return (
        <footer className="w-full mt-8 py-4 bg-[#FAF7F2] border-t border-[#E6DCD2] rounded-b-lg">
             <div className="max-w-6xl mx-auto px-4 text-center text-[#706B67]">
                 <p className="text-xs font-medium">
                    Marryzen is a private, values-based marriage platform. Always communicate respectfully and report inappropriate behavior immediately.
                 </p>
             </div>
        </footer>
    );
  }

  return (
    <footer className="w-full mt-12 py-12 bg-[#FFFFFF] border-t border-[#E6DCD2]">
      <div className="max-w-6xl mx-auto px-4 text-center text-[#333333]">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Shield size={20} className="text-[#E6B450]" />
          <p className="text-base font-bold text-[#1F1F1F]">A Platform for Serious Marriage</p>
        </div>
        <p className="text-sm max-w-2xl mx-auto mb-8 text-[#706B67] leading-relaxed">
          Marryzen is a private, values-based platform created strictly for serious marriage and long-term commitment. Casual dating, hookups, and inappropriate behavior are not permitted.
        </p>
        <div className="flex justify-center gap-6 text-sm mb-8 flex-wrap font-medium">
            <Link to="/terms" className="text-[#E6B450] hover:text-[#D0A23D] hover:underline">Terms of Service</Link>
            <Link to="/privacy" className="text-[#E6B450] hover:text-[#D0A23D] hover:underline">Privacy Policy</Link>
            <Link to="/community-guidelines" className="text-[#E6B450] hover:text-[#D0A23D] hover:underline">Community Guidelines</Link>
            <Link to="/safety" className="text-[#E6B450] hover:text-[#D0A23D] hover:underline">Safety</Link>
            <Link to="/billing" className="text-[#E6B450] hover:text-[#D0A23D] hover:underline">Billing Terms</Link>
            <Link to="/cookie-policy" className="text-[#E6B450] hover:text-[#D0A23D] hover:underline">Cookie Policy</Link>
        </div>
        <p className="text-xs text-[#706B67]">
          © {new Date().getFullYear()} Marryzen. All rights reserved. Users are responsible for their own conduct. We facilitate introductions; we are not responsible for offline interactions. You must be 18+ to use this service.
        </p>
      </div>
    </footer>
  );
};

export default Footer;