import React from 'react';
import { ShieldCheck, ShieldAlert, BadgeCheck, CheckCircle } from 'lucide-react';

const verificationLevels = {
  3: {
    text: "Serious Marriage Verified",
    icon: <BadgeCheck className="w-full h-full text-white" />,
    badgeColor: 'bg-purple-600',
    textColor: 'text-purple-300',
    description: "Highest level of verification, indicating a complete profile and serious marriage intent.",
  },
  2: {
    text: "Identity Verified",
    icon: <ShieldCheck className="w-full h-full text-white" />,
    badgeColor: 'bg-yellow-500',
    textColor: 'text-yellow-300',
    description: "Identity confirmed via government ID and live selfie. Unlocks unlimited messaging.",
  },
  1: {
    text: "Basic Verified",
    icon: <CheckCircle className="w-full h-full text-white" />,
    badgeColor: 'bg-blue-500',
    textColor: 'text-blue-300',
    description: "Profile essentials are complete. Required to message and be seen in Discovery.",
  },
  0: {
    text: "Unverified",
    icon: <ShieldAlert className="w-full h-full text-white" />,
    badgeColor: 'bg-gray-500',
    textColor: 'text-gray-300',
    description: "Profile is incomplete. Verification is required to access core features.",
  },
};


const VerificationBadge = ({ level, size = 'sm', showText = false, className = '' }) => {
  const config = verificationLevels[level] || verificationLevels[0];

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  if (showText) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`${sizeClasses[size]} ${config.badgeColor} rounded-full p-[2px]`}>
            {config.icon}
        </div>
        <span className={`font-semibold ${config.textColor}`}>{config.text}</span>
      </div>
    );
  }
  
  return (
    <div className={`${sizeClasses[size]} ${config.badgeColor} rounded-full p-[2px] ${className}`}>
      {config.icon}
    </div>
  );
};

export default VerificationBadge;