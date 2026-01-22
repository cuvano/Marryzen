import React from 'react';
import { motion } from 'framer-motion';
import { Crown, MapPin, X, Heart, Shield } from 'lucide-react';
import VerificationBadge from '@/components/VerificationBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ProfileCard = ({ profile, onLike, onPass, onFavorite, isFavorite, onClick }) => {
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            
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
                 <VerificationBadge level={profile.is_verified ? 2 : 1} size="md" />
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`rounded-full h-8 w-8 backdrop-blur-md ${isFavorite ? 'bg-red-500 text-white' : 'bg-black/20 text-white hover:bg-black/40'}`}
                    onClick={(e) => { e.stopPropagation(); onFavorite(profile); }}
                 >
                    <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                 </Button>
            </div>

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <div className="mb-2">
                    <h3 className="text-2xl font-bold leading-tight">{profile.full_name}, {profile.age}</h3>
                    <div className="flex items-center gap-1.5 text-sm text-gray-200 mt-1 font-medium">
                        <MapPin className="w-3.5 h-3.5" /> {profile.location_city || 'Unknown City'}
                        {profile.distance !== undefined && <span>• {Math.round(profile.distance)} km away</span>}
                    </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-4">
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