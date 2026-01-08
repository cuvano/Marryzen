import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  MapPin, User, Heart, Star, ShieldCheck, Edit, Crown, AlertCircle
} from 'lucide-react';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) {
        toast({ title: "Error", description: "Could not load profile", variant: "destructive" });
      } else {
        setProfile(data);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [navigate, toast]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!profile) return null;

  const age = profile.date_of_birth ? new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear() : 'N/A';
  const mainPhoto = profile.photos?.[0];
  const photoLimit = profile.is_premium ? 12 : 4;
  const currentPhotoCount = profile.photos?.length || 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="bg-white rounded-2xl shadow-sm border border-[#E6DCD2] overflow-hidden mb-8">
        <div className="h-48 bg-gradient-to-r from-[#F3E8D9] to-[#F9E7EB] relative">
             <div className="absolute top-4 right-4 flex gap-2">
                 {!profile.is_premium && (
                    <Button onClick={() => navigate('/premium')} className="bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] gap-2">
                        <Crown size={16} /> Upgrade to Premium
                    </Button>
                 )}
                 <Button variant="outline" className="bg-white/80 border-[#E6DCD2] text-[#333333] hover:bg-white gap-2">
                       <Edit size={16} /> Edit
                 </Button>
             </div>
        </div>
        <div className="px-8 pb-8">
            <div className="relative -mt-16 mb-4 flex justify-between items-end">
                <div className="relative">
                     <div className="w-32 h-32 rounded-full border-4 border-white shadow-md bg-[#FAF7F2] overflow-hidden relative group">
                         {mainPhoto ? <img src={mainPhoto} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-full h-full p-6 text-[#C85A72]" />}
                     </div>
                     {profile.is_premium && (
                        <div className="absolute bottom-1 right-1 bg-[#E6B450] text-white p-1 rounded-full border-2 border-white shadow-sm" title="Premium Member">
                             <Crown size={16} />
                        </div>
                     )}
                </div>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#1F1F1F] flex items-center gap-2">
                        {profile.full_name}, {age}
                    </h1>
                    <p className="text-[#706B67] flex items-center gap-2 mt-1">
                        <MapPin size={16} /> {profile.location_city}, {profile.location_country}
                    </p>
                </div>
                {profile.is_premium && <Badge className="bg-[#E6B450] text-[#1F1F1F]">Premium Member</Badge>}
            </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="space-y-6">
            <Card>
                <CardHeader><CardTitle>Photos</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        {profile.photos?.map((p, i) => (
                            <img key={i} src={p} className="w-full aspect-square object-cover rounded-md" />
                        ))}
                    </div>
                    <div className="flex justify-between items-center text-sm text-[#706B67] mb-2">
                        <span>{currentPhotoCount} / {photoLimit} photos</span>
                    </div>
                    {currentPhotoCount >= photoLimit && !profile.is_premium && (
                         <div className="bg-yellow-50 text-yellow-800 p-2 rounded text-xs flex gap-2 items-center mb-2">
                             <AlertCircle size={14} /> Limit reached. Upgrade to add more.
                         </div>
                    )}
                    <Button variant="outline" className="w-full" disabled={currentPhotoCount >= photoLimit}>Add Photo</Button>
                </CardContent>
            </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
            <Card>
                <CardHeader><CardTitle>About Me</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-[#333333] whitespace-pre-wrap">{profile.bio || "No bio added."}</p>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;