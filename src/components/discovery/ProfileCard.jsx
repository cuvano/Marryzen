import React from 'react';
import { motion } from 'framer-motion';
import { Crown, MapPin, X, Heart } from 'lucide-react';
import VerificationBadge from '@/components/VerificationBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isIdVerifiedPublic } from '@/lib/identityVerification';

const ProfileCard = ({ profile, onLike, onPass, onFavorite, isFavorite, onClick }) => {
  const genderLabel = profile.identify_as === 'Man' || profile.identify_as === 'Male' ? 'Male' : profile.identify_as === 'Woman' || profile.identify_as === 'Female' ? 'Female' : profile.identify_as || null;

  return (
    <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ 
            opacity: 1, 
            scale: 1,
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 30,
                mass: 0.5
            }
        }}
        exit={{ 
            opacity: 0, 
            scale: 0.94,
            transition: {
                type: "spring",
                stiffness: 500,
                damping: 35,
                duration: 0.3,
                ease: [0.25, 0.1, 0.25, 1]
            }
        }}
        whileHover={{ 
            scale: 1.015,
            y: -4,
            transition: { 
                type: "spring",
                stiffness: 400,
                damping: 25,
                duration: 0.2
            }
        }}
        className="bg-white border border-[#E6DCD2] rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all group relative"
    >
        <div className="relative aspect-[3/4] overflow-hidden cursor-pointer" onClick={onClick}>
            <img 
                src={profile.photos?.[0] || 'https://via.placeholder.com/400x500'} 
                alt={profile.full_name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Bottom-only scrim (Tinder-style): keeps face / upper photo clear */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[46%] bg-gradient-to-t from-black via-black/70 via-25% to-transparent" />
            <div className="pointer-events-none absolute left-0 right-0 top-0 h-20 bg-gradient-to-b from-black/35 to-transparent" />
            
            {/* Top Badges */}
            <div className="absolute top-3 left-3 flex gap-2">
                {profile.is_premium && (
                    <div className="bg-[#E6B450]/90 backdrop-blur-sm p-1.5 rounded-full shadow-lg">
                        <Crown className="w-4 h-4 text-white fill-white" />
                    </div>
                )}
                {profile.matchLabel && typeof profile.compatibilityScore === 'number' && !isNaN(profile.compatibilityScore) && (
                     <Badge variant="secondary" className="bg-green-500/90 text-white border-0 font-bold backdrop-blur-sm shadow-md">
                        {Math.round(profile.compatibilityScore)}% Match
                     </Badge>
                )}
            </div>

            <div className="absolute top-3 right-3 flex flex-col gap-2">
                 {isIdVerifiedPublic(profile) && (
                   <VerificationBadge level={2} size="md" />
                 )}
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`rounded-full h-8 w-8 backdrop-blur-md ${isFavorite ? 'bg-red-500 text-white' : 'bg-black/20 text-white hover:bg-black/40'}`}
                    onClick={(e) => { e.stopPropagation(); onFavorite(profile); }}
                 >
                    <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                 </Button>
            </div>

            {/* Content — typography on bottom gradient only; no mid-photo panel */}
            <div className="absolute bottom-0 left-0 right-0 p-5 pt-12 text-white">
                <div className="mb-3">
                    <h3 className="text-2xl sm:text-[1.65rem] font-bold leading-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,1),0_2px_12px_rgba(0,0,0,.85),0_0_1px_rgba(0,0,0,1)]">
                      {profile.full_name}, {profile.age}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-medium text-white [text-shadow:0_1px_3px_rgba(0,0,0,1),0_0_12px_rgba(0,0,0,.6)]">
                        {genderLabel && (
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs text-white ring-1 ring-white/25">{genderLabel}</span>
                        )}
                        <span className="flex items-center gap-1 text-white">
                          <MapPin className="w-3.5 h-3.5 shrink-0 opacity-95" />
                          {profile.location_city || 'Unknown City'}
                        </span>
                        {profile.distance !== undefined && (
                          <span className="text-white/90">• {Math.round(profile.distance)} km</span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                     {profile.religious_affiliation && (
                         <span className="text-xs bg-white/20 px-2 py-0.5 rounded text-white border border-white/10">{profile.religious_affiliation}</span>
                     )}
                     {profile.occupation && (
                         <span className="text-xs bg-white/20 px-2 py-0.5 rounded text-white border border-white/10">{profile.occupation}</span>
                     )}
                     {profile.height && (
                         <span className="text-xs bg-white/20 px-2 py-0.5 rounded text-white border border-white/10">{Math.floor(profile.height/30.48)}'{Math.round((profile.height%30.48)/2.54)}"</span>
                     )}
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-2">
                    <Button 
                        variant="outline" 
                        className="bg-white/10 hover:bg-white/20 backdrop-blur-md border-white/20 text-white hover:text-white border-2 rounded-xl h-12" 
                        onClick={(e) => { e.stopPropagation(); onPass(profile); }}
                    >
                        <X className="w-6 h-6" />
                    </Button>
                    <Button 
                        className="bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] border-none rounded-xl h-12 shadow-lg" 
                        onClick={(e) => { e.stopPropagation(); onLike(profile); }}
                    >
                        <Heart className="w-6 h-6 fill-black/20" />
                    </Button>
                </div>
            </div>
        </div>
    </motion.div>
  );
};

export default ProfileCard;