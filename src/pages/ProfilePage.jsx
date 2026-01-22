import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  MapPin, User, Heart, Star, ShieldCheck, Edit, Crown, AlertCircle, 
  CheckCircle, XCircle, Eye, Camera, Upload, Trash2, Crop, Loader2,
  Mail, Lock, Award, Languages, Users, Target, Home, Sparkles, FileText, ArrowLeft
} from 'lucide-react';
import Footer from '@/components/Footer';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [isBioDialogOpen, setIsBioDialogOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [coverCropModalOpen, setCoverCropModalOpen] = useState(false);
  const [tempImage, setTempImage] = useState(null);
  const [tempCoverImage, setTempCoverImage] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [emailVerified, setEmailVerified] = useState(false);

  const isOwnProfile = !userId;

  useEffect(() => {
    fetchProfile();
    fetchAuthInfo();
    
    // Refresh email verification status periodically and on focus
    const interval = setInterval(fetchAuthInfo, 5000); // Check every 5 seconds
    const handleFocus = () => fetchAuthInfo();
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [userId]);

  const fetchAuthInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email);
      const isVerified = user.email_confirmed_at !== null;
      setEmailVerified(isVerified);
    }
  };

    const fetchProfile = async () => {
      setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && !userId) { 
        navigate('/login'); 
        return; 
      }

      const targetUserId = userId || session.user.id;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116' && error.code !== 'NOT_FOUND') {
        toast({ title: "Error", description: "Could not load profile", variant: "destructive" });
      } else if (data) {
        setProfile(data);
        setEditBio(data.bio || '');
        
        // Track profile view (if viewing someone else's profile)
        if (userId && session && session.user.id !== userId) {
          console.log('Tracking profile view:', { viewedProfileId: userId, viewerId: session.user.id });
          trackProfileView(userId, session.user.id);
        } else {
          console.log('Skipping profile view tracking:', { userId, hasSession: !!session, currentUserId: session?.user?.id });
        }
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load profile", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const trackProfileView = async (viewedProfileId, viewerId) => {
    try {
      // Track profile view (only if viewing someone else's profile)
      const { data, error } = await supabase.from('profile_views').insert({
        viewer_id: viewerId,
        viewed_profile_id: viewedProfileId,
        viewed_at: new Date().toISOString()
      }).select().maybeSingle();
      
      if (error) {
        console.error('Profile view tracking error:', error);
        // Don't show error to user - view tracking is not critical
      } else {
        console.log('Profile view tracked successfully:', data);
      }
    } catch (error) {
      // Silently fail - view tracking is not critical
      console.error('Profile view tracking exception:', error);
    }
  };

  const calculateCompleteness = () => {
    if (!profile) return 0;
    
    const fields = {
      full_name: profile.full_name,
      date_of_birth: profile.date_of_birth,
      location_city: profile.location_city,
      location_country: profile.location_country,
      identify_as: profile.identify_as,
      photos: profile.photos?.length > 0,
      bio: profile.bio && profile.bio.length >= 50,
      religious_affiliation: profile.religious_affiliation,
      faith_lifestyle: profile.faith_lifestyle,
      cultures: profile.cultures?.length > 0,
      core_values: profile.core_values?.length > 0,
      languages: profile.languages?.length > 0,
      relationship_goal: profile.relationship_goal,
      family_goals: profile.family_goals,
      willing_to_relocate: profile.willing_to_relocate,
    };

    const totalFields = Object.keys(fields).length;
    const completedFields = Object.values(fields).filter(Boolean).length;
    
    return Math.round((completedFields / totalFields) * 100);
  };

  const getCompletenessChecklist = () => {
    if (!profile) return [];
    
    return [
      { label: 'Profile Photo', completed: profile.photos?.length > 0, required: true },
      { label: 'Full Name', completed: !!profile.full_name, required: true },
      { label: 'Date of Birth', completed: !!profile.date_of_birth, required: true },
      { label: 'Location', completed: !!(profile.location_city && profile.location_country), required: true },
      { label: 'About Me (50+ chars)', completed: !!(profile.bio && profile.bio.length >= 50), required: true },
      { label: 'Religious Affiliation', completed: !!profile.religious_affiliation, required: false },
      { label: 'Faith Lifestyle', completed: !!profile.faith_lifestyle, required: false },
      { label: 'Cultures', completed: !!(profile.cultures?.length > 0), required: false },
      { label: 'Core Values', completed: !!(profile.core_values?.length > 0), required: false },
      { label: 'Languages', completed: !!(profile.languages?.length > 0), required: false },
      { label: 'Relationship Goal', completed: !!profile.relationship_goal, required: false },
      { label: 'Family Goals', completed: !!profile.family_goals, required: false },
    ];
  };

  const handleSaveBio = async () => {
    if (!isOwnProfile) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ bio: editBio })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev, bio: editBio }));
      setIsBioDialogOpen(false);
      toast({ title: "Success", description: "Bio updated successfully!" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to update bio", variant: "destructive" });
    }
  };

  const handleCoverPhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid File", description: "Please select an image file", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Please select an image under 10MB", variant: "destructive" });
      return;
    }

    // Read file and open crop modal for cover photo (wide aspect ratio)
    const reader = new FileReader();
    reader.onload = () => {
      setTempCoverImage(reader.result);
      setCoverCropModalOpen(true);
    };
    reader.onerror = () => {
      toast({ title: "Error", description: "Failed to read image file", variant: "destructive" });
    };
    reader.readAsDataURL(file);
  };

  const handleCoverCropComplete = async (croppedBase64) => {
    if (!isOwnProfile) return;

    setUploadingPhoto(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUploadingPhoto(false);
        return;
      }

      // Compress the cropped cover photo
      const compressed = await compressImage(croppedBase64, 1920, 0.85);
      
      const { error } = await supabase
        .from('profiles')
        .update({ cover_photo: compressed })
        .eq('id', user.id);

      if (error) {
        console.error('Cover photo upload error:', error);
        throw error;
      }

      setProfile(prev => ({ ...prev, cover_photo: compressed }));
      setCoverCropModalOpen(false);
      setTempCoverImage(null);
      toast({ title: "Success", description: "Cover photo uploaded successfully!" });
    } catch (error) {
      console.error('Cover photo upload error:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to upload cover photo. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid File", description: "Please select an image file", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Please select an image under 10MB", variant: "destructive" });
      return;
    }

    // Compress and show crop modal
    const reader = new FileReader();
    reader.onload = () => {
      setTempImage(reader.result);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const compressImage = (base64, maxWidth = 1200, quality = 0.8) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = base64;
    });
  };

  const handleCropComplete = async (croppedBase64) => {
    if (!isOwnProfile) return;

    setUploadingPhoto(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Compress the image
      const compressed = await compressImage(croppedBase64);

      // Convert base64 to blob
      const response = await fetch(compressed);
      const blob = await response.blob();

      // Upload to Supabase Storage (or use base64 directly if storing in DB)
      // For now, we'll store as base64 in the photos array
      const currentPhotos = profile.photos || [];
      const newPhotos = [...currentPhotos, compressed];

      const { error } = await supabase
        .from('profiles')
        .update({ photos: newPhotos })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev, photos: newPhotos }));
      setCropModalOpen(false);
      setTempImage(null);
      toast({ title: "Success", description: "Photo uploaded successfully!" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to upload photo", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async (index) => {
    if (!isOwnProfile) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newPhotos = profile.photos.filter((_, i) => i !== index);
      const { error } = await supabase
        .from('profiles')
        .update({ photos: newPhotos })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev, photos: newPhotos }));
      toast({ title: "Success", description: "Photo removed successfully!" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to remove photo", variant: "destructive" });
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#E6B450]" /></div>;
  if (!profile) return null;

  const age = profile.date_of_birth ? new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear() : 'N/A';
  const mainPhoto = profile.photos?.[0];
  const photoLimit = profile.is_premium ? 12 : 4;
  const currentPhotoCount = profile.photos?.length || 0;
  const completeness = calculateCompleteness();
  const checklist = getCompletenessChecklist();

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
    <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Back button for viewing other profiles */}
        {!isOwnProfile && (
          <div className="mb-4">
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="bg-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        )}
        
        {/* Header with Edit/Preview buttons */}
        {isOwnProfile && (
          <div className="flex justify-end gap-2 mb-4">
            <Button 
              variant="outline" 
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className="bg-white"
            >
              <Eye className="w-4 h-4 mr-2" />
              {isPreviewMode ? 'Edit Mode' : 'Preview Profile'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/onboarding')}
              className="bg-white"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          </div>
        )}

        {/* Profile Completeness Card - Only show if not 100% */}
        {isOwnProfile && !isPreviewMode && completeness < 100 && (
          <Card className="mb-6 border-[#E6B450] bg-[#FFFBEB]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#E6B450]" />
                Profile Completeness
              </CardTitle>
              <CardDescription>Complete your profile to get better matches</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-[#1F1F1F]">{completeness}% Complete</span>
                  <span className="text-xs text-[#706B67]">{checklist.filter(c => c.completed).length} / {checklist.length} items</span>
                </div>
                <Progress value={completeness} className="h-2" />
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    {item.completed ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={item.completed ? 'text-[#1F1F1F]' : 'text-[#706B67]'}>
                      {item.label}
                      {item.required && <span className="text-red-500 ml-1">*</span>}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E6DCD2] overflow-hidden mb-8">
          <div className="h-48 bg-gradient-to-r from-[#F3E8D9] to-[#F9E7EB] relative overflow-hidden group">
            {profile.cover_photo ? (
              <img 
                src={profile.cover_photo} 
                alt="Cover" 
                className="w-full h-full object-cover"
              />
            ) : null}
            {isOwnProfile && !isPreviewMode && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <label className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
                  <Camera className="w-4 h-4" />
                  {profile.cover_photo ? 'Change Cover Photo' : 'Add Cover Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverPhotoSelect}
                  />
                </label>
              </div>
            )}
            {isOwnProfile && !isPreviewMode && !profile.is_premium && (
              <div className="absolute top-4 right-4">
                    <Button onClick={() => navigate('/premium')} className="bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] gap-2">
                        <Crown size={16} /> Upgrade to Premium
                    </Button>
              </div>
                 )}
        </div>
        <div className="px-8 pb-8">
            <div className="relative -mt-16 mb-4 flex justify-between items-end">
                <div className="relative">
                     <div className="w-32 h-32 rounded-full border-4 border-white shadow-md bg-[#FAF7F2] overflow-hidden relative group">
                  {mainPhoto ? (
                    <img 
                      src={mainPhoto} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                      style={{ imageRendering: 'high-quality' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  {!mainPhoto && (
                    <User className="w-full h-full p-6 text-[#C85A72]" />
                  )}
                     </div>
                     {profile.is_premium && (
                  <div className="absolute bottom-1 right-1 bg-[#E6B450] text-white p-1 rounded-full border-2 border-white shadow-sm">
                             <Crown size={16} />
                        </div>
                     )}
                {profile.is_verified && (
                  <div className="absolute top-1 right-1 bg-green-500 text-white p-1 rounded-full border-2 border-white shadow-sm">
                    <ShieldCheck size={14} />
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
                  <MapPin size={16} /> {profile.location_city || 'Not set'}, {profile.location_country || 'Not set'}
                    </p>
                </div>
                {profile.is_premium && <Badge className="bg-[#E6B450] text-[#1F1F1F]">Premium Member</Badge>}
            </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
          {/* Left Column */}
        <div className="space-y-6">
            {/* Photos Card */}
            <Card>
              <CardHeader>
                <CardTitle>Photos</CardTitle>
                <CardDescription>{currentPhotoCount} / {photoLimit} photos</CardDescription>
              </CardHeader>
                <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                        {profile.photos?.map((p, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden group bg-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <img 
                        src={p} 
                        alt={`Photo ${i + 1}`} 
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        style={{ imageRendering: 'high-quality' }}
                        loading="lazy"
                        onError={(e) => {
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23f3f4f6" width="400" height="400"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="20" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3EFailed to load%3C/text%3E%3C/svg%3E';
                        }}
                      />
                      {isOwnProfile && !isPreviewMode && (
                        <button
                          onClick={() => handleRemovePhoto(i)}
                          className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg backdrop-blur-sm hover:scale-110"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {i === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent text-white text-[10px] py-1.5 px-2 text-center font-semibold">
                          Main Photo
                        </div>
                      )}
                    </div>
                  ))}
                  {Array.from({ length: photoLimit - currentPhotoCount }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square rounded-lg border-2 border-dashed border-[#E6DCD2] flex items-center justify-center bg-[#FAF7F2] hover:border-[#E6B450] transition-colors">
                      {isOwnProfile && !isPreviewMode && (
                        <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-2">
                          <Upload className="w-8 h-8 text-[#706B67]" />
                          <span className="text-xs text-[#706B67]">Add Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileSelect}
                          />
                        </label>
                      )}
                    </div>
                        ))}
                    </div>
                    {currentPhotoCount >= photoLimit && !profile.is_premium && (
                         <div className="bg-yellow-50 text-yellow-800 p-2 rounded text-xs flex gap-2 items-center mb-2">
                             <AlertCircle size={14} /> Limit reached. Upgrade to add more.
                         </div>
                    )}
                {isOwnProfile && !isPreviewMode && currentPhotoCount < photoLimit && (
                  <Button variant="outline" className="w-full" onClick={() => document.querySelector('input[type="file"]')?.click()}>
                    <Camera className="w-4 h-4 mr-2" /> Add Photo
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Safety & Verification Card */}
            {isOwnProfile && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#C85A72]" />
                    Safety & Verification
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Only show email verification section if not verified */}
                  {!emailVerified && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-[#706B67]" />
                        <span className="text-sm text-[#1F1F1F]">Email Verified</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-yellow-300 text-yellow-700">
                          <AlertCircle className="w-3 h-3 mr-1" /> Pending
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate('/verify-email')}
                          className="text-xs"
                        >
                          Verify Now
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#706B67]" />
                      <span className="text-sm text-[#1F1F1F]">Profile Verified</span>
                    </div>
                    {profile.is_verified ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-gray-300 text-gray-600">
                        Not Verified
                      </Badge>
                    )}
                  </div>
                </CardContent>
            </Card>
            )}
        </div>

          {/* Right Column */}
        <div className="md:col-span-2 space-y-6">
            {/* About Me Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>About Me</CardTitle>
                  {isOwnProfile && !isPreviewMode && (
                    <Button variant="ghost" size="sm" onClick={() => setIsBioDialogOpen(true)}>
                      <Edit className="w-4 h-4 mr-2" /> {profile.bio ? 'Edit' : 'Add'} Bio
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {profile.bio ? (
                  <p className="text-[#333333] whitespace-pre-wrap">{profile.bio}</p>
                ) : (
                  <div className="text-center py-8 text-[#706B67]">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No bio added yet.</p>
                    {isOwnProfile && !isPreviewMode && (
                      <Button variant="outline" className="mt-4" onClick={() => setIsBioDialogOpen(true)}>
                        Add Your Bio
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Faith & Lifestyle Card */}
            {(profile.religious_affiliation || profile.faith_lifestyle) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-[#C85A72]" />
                    Faith & Lifestyle
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {profile.religious_affiliation && (
                    <p className="text-[#1F1F1F]">
                      <span className="text-sm font-medium text-[#706B67]">Religious Affiliation: </span>
                      {profile.religious_affiliation}
                    </p>
                  )}
                  {profile.faith_lifestyle && (
                    <p className="text-[#1F1F1F]">
                      <span className="text-sm font-medium text-[#706B67]">Faith Lifestyle: </span>
                      {profile.faith_lifestyle}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Values Card */}
            {profile.core_values && profile.core_values.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#E6B450]" />
                    Core Values
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[#1F1F1F]">
                    <span className="text-sm font-medium text-[#706B67]">Core Values: </span>
                    {profile.core_values.join(', ')}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Languages Card */}
            {profile.languages && profile.languages.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Languages className="w-5 h-5 text-[#C85A72]" />
                    Languages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[#1F1F1F]">
                    <span className="text-sm font-medium text-[#706B67]">Languages: </span>
                    {profile.languages.join(', ')}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Cultures Card */}
            {profile.cultures && profile.cultures.length > 0 && (
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#E6B450]" />
                    Cultures
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[#1F1F1F]">
                    <span className="text-sm font-medium text-[#706B67]">Cultures: </span>
                    {profile.cultures.join(', ')}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Lifestyle Details Card */}
            {(profile.smoking || profile.drinking || profile.marital_status || profile.has_children !== undefined || profile.education || profile.occupation || profile.zodiac_sign || profile.country_of_origin) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-[#C85A72]" />
                    Lifestyle & Background
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {profile.smoking && (
                    <p className="text-[#1F1F1F]">
                      <span className="text-sm font-medium text-[#706B67]">Smoking: </span>
                      {profile.smoking}
                    </p>
                  )}
                  {profile.drinking && (
                    <p className="text-[#1F1F1F]">
                      <span className="text-sm font-medium text-[#706B67]">Drinking: </span>
                      {profile.drinking}
                    </p>
                  )}
                  {profile.marital_status && (
                    <p className="text-[#1F1F1F]">
                      <span className="text-sm font-medium text-[#706B67]">Marital Status: </span>
                      {profile.marital_status}
                    </p>
                  )}
                  {profile.has_children !== undefined && (
                    <p className="text-[#1F1F1F]">
                      <span className="text-sm font-medium text-[#706B67]">Children?: </span>
                      {profile.has_children ? 'Yes' : 'No'}
                    </p>
                  )}
                  {profile.education && (
                    <p className="text-[#1F1F1F]">
                      <span className="text-sm font-medium text-[#706B67]">Education: </span>
                      {profile.education}
                    </p>
                  )}
                  {profile.occupation && (
                    <p className="text-[#1F1F1F]">
                      <span className="text-sm font-medium text-[#706B67]">Occupation: </span>
                      {profile.occupation}
                    </p>
                  )}
                  {profile.zodiac_sign && (
                    <p className="text-[#1F1F1F]">
                      <span className="text-sm font-medium text-[#706B67]">Zodiac Sign: </span>
                      {profile.zodiac_sign}
                    </p>
                  )}
                  {profile.country_of_origin && (
                    <p className="text-[#1F1F1F]">
                      <span className="text-sm font-medium text-[#706B67]">Country of Origin: </span>
                      {profile.country_of_origin}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Goals Card */}
            {(profile.relationship_goal || profile.family_goals || profile.willing_to_relocate) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#C85A72]" />
                    Goals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {profile.relationship_goal && (
                    <p className="text-[#1F1F1F]">
                      <span className="text-sm font-medium text-[#706B67]">Relationship Goal: </span>
                      {profile.relationship_goal}
                    </p>
                  )}
                  {profile.family_goals && (
                    <p className="text-[#1F1F1F]">
                      <span className="text-sm font-medium text-[#706B67]">Family Goals: </span>
                      {profile.family_goals}
                    </p>
                  )}
                  {profile.willing_to_relocate && (
                    <p className="text-[#1F1F1F]">
                      <span className="text-sm font-medium text-[#706B67]">Willing to Relocate: </span>
                      {profile.willing_to_relocate}
                    </p>
                  )}
                </CardContent>
            </Card>
            )}
        </div>
      </div>

        <Footer />
      </div>

      {/* Bio Edit Dialog */}
      <Dialog open={isBioDialogOpen} onOpenChange={setIsBioDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit About Me</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="bio">Bio (Minimum 50 characters)</Label>
            <Textarea
              id="bio"
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="Tell others about yourself..."
              className="mt-2 min-h-[150px]"
              maxLength={1000}
            />
            <p className="text-xs text-[#706B67] mt-2">
              {editBio.length} / 1000 characters {editBio.length < 50 && '(Minimum 50 required)'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBioDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveBio} 
              disabled={editBio.length < 50}
              className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D]"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Crop Dialog */}
      <ImageCropDialog
        open={cropModalOpen}
        imageSrc={tempImage}
        onCropComplete={handleCropComplete}
        onCancel={() => {
          setCropModalOpen(false);
          setTempImage(null);
        }}
      />

      {/* Cover Photo Crop Dialog */}
      <CoverPhotoCropDialog
        open={coverCropModalOpen}
        imageSrc={tempCoverImage}
        onCropComplete={handleCoverCropComplete}
        onCancel={() => {
          setCoverCropModalOpen(false);
          setTempCoverImage(null);
        }}
        uploading={uploadingPhoto}
      />
    </div>
  );
};

// Cover Photo Crop Dialog Component (Wide aspect ratio 16:5)
const CoverPhotoCropDialog = ({ open, imageSrc, onCropComplete, onCancel, uploading = false }) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = React.useRef(null);
  const imageRef = React.useRef(null);

  const handleMouseDown = (e) => {
    if (uploading) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || uploading) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const calculateCoverImageDisplaySize = (img, containerWidth, containerHeight) => {
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const containerAspect = containerWidth / containerHeight;
    let displayedWidth, displayedHeight;
    
    if (imgAspect > containerAspect) {
      // Image is wider - fit to container height
      displayedHeight = containerHeight;
      displayedWidth = displayedHeight * imgAspect;
    } else {
      // Image is taller - fit to container width
      displayedWidth = containerWidth;
      displayedHeight = displayedWidth / imgAspect;
    }
    
    return { width: displayedWidth, height: displayedHeight };
  };

  const cropImage = () => {
    if (!imageSrc || !containerRef.current || !imageRef.current || uploading) return;
    
    // Cover photo dimensions: 1920x600 (16:5 aspect ratio, good for cover photos)
    const outputWidth = 1920;
    const outputHeight = 600;
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        console.error('Invalid image dimensions');
        return;
      }

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width || 800;
      const containerHeight = containerRect.height || 300;
      
      // Calculate displayed image dimensions (at zoom = 1, before scaling)
      const displaySize = calculateCoverImageDisplaySize(img, containerWidth, containerHeight);
      const displayedWidth = displaySize.width;
      const displayedHeight = displaySize.height;
      
      // The displayed image is scaled by zoom
      const scaledDisplayWidth = displayedWidth * zoom;
      const scaledDisplayHeight = displayedHeight * zoom;
      
      // Calculate scale factors from displayed to actual image
      const scaleX = img.naturalWidth / scaledDisplayWidth;
      const scaleY = img.naturalHeight / scaledDisplayHeight;
      
      // Container center (where image is centered)
      const containerCenterX = containerWidth / 2;
      const containerCenterY = containerHeight / 2;
      
      // Image center position in container coordinates (after offset)
      const imageCenterInContainerX = containerCenterX + offset.x;
      const imageCenterInContainerY = containerCenterY + offset.y;
      
      // Crop area bounds in container coordinates
      const cropLeft = 0;
      const cropTop = 0;
      const cropRight = containerWidth;
      const cropBottom = containerHeight;
      
      // Image top-left in container coordinates
      const imageTopLeftX = imageCenterInContainerX - scaledDisplayWidth / 2;
      const imageTopLeftY = imageCenterInContainerY - scaledDisplayHeight / 2;
      
      // Crop area top-left relative to image top-left
      const cropRelativeLeft = cropLeft - imageTopLeftX;
      const cropRelativeTop = cropTop - imageTopLeftY;
      
      // Convert to actual image coordinates
      let sourceX = cropRelativeLeft * scaleX;
      let sourceY = cropRelativeTop * scaleY;
      const sourceWidth = containerWidth * scaleX;
      const sourceHeight = containerHeight * scaleY;
      
      // Ensure we don't go out of bounds
      sourceX = Math.max(0, Math.min(sourceX, img.naturalWidth - sourceWidth));
      sourceY = Math.max(0, Math.min(sourceY, img.naturalHeight - sourceHeight));
      const finalSourceWidth = Math.min(sourceWidth, img.naturalWidth - sourceX);
      const finalSourceHeight = Math.min(sourceHeight, img.naturalHeight - sourceY);
      
      // Draw cropped and resized image to canvas (wide output)
      ctx.drawImage(
        img,
        sourceX, sourceY, finalSourceWidth, finalSourceHeight,
        0, 0, outputWidth, outputHeight
      );
      
      // Compress and return
      onCropComplete(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      console.error('Failed to load image for cropping');
    };
    img.src = imageSrc;
  };

  React.useEffect(() => {
    if (open && imageSrc) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [open, imageSrc]);

  return (
    <Dialog open={open} onOpenChange={uploading ? undefined : onCancel}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Crop Cover Photo</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div
            ref={containerRef}
            className="relative w-full bg-gray-200 rounded-lg overflow-hidden mb-4 border-2 border-gray-300"
            style={{ height: '300px', maxWidth: '800px', margin: '0 auto', aspectRatio: '16/5' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {imageSrc && (
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop Cover"
                className="absolute top-1/2 left-1/2 origin-center select-none pointer-events-none"
                style={{
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  width: 'auto',
                  height: 'auto'
                }}
                draggable={false}
                onLoad={() => {
                  // Auto-fit image on load
                  if (imageRef.current && containerRef.current) {
                    const img = imageRef.current;
                    const container = containerRef.current;
                    const containerRect = container.getBoundingClientRect();
                    const containerWidth = containerRect.width || 800;
                    const containerHeight = containerRect.height || 300;
                    
                    if (img.naturalWidth === 0 || img.naturalHeight === 0) return;
                    
                    const displaySize = calculateCoverImageDisplaySize(img, containerWidth, containerHeight);
                    
                    // Set initial zoom to slightly larger than fit (110%)
                    const fitZoom = Math.min(containerWidth / displaySize.width, containerHeight / displaySize.height);
                    setZoom(Math.max(1, Math.min(fitZoom * 1.1, 2)));
                    setOffset({ x: 0, y: 0 });
                  }
                }}
              />
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Zoom</label>
              <Slider
                value={[zoom]}
                onValueChange={([value]) => setZoom(value)}
                min={0.5}
                max={3}
                step={0.1}
                disabled={uploading}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">{Math.round(zoom * 100)}%</div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={cropImage}
                disabled={uploading}
                className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D]"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Save Cover Photo'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Image Crop Dialog Component
const ImageCropDialog = ({ open, imageSrc, onCropComplete, onCancel }) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = React.useRef(null);
  const imageRef = React.useRef(null);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const calculateImageDisplaySize = (img, containerSize) => {
    const imgAspect = img.naturalWidth / img.naturalHeight;
    let displayedWidth, displayedHeight;
    
    if (imgAspect > 1) {
      // Image is wider - fit to container height
      displayedHeight = containerSize;
      displayedWidth = displayedHeight * imgAspect;
    } else {
      // Image is taller - fit to container width
      displayedWidth = containerSize;
      displayedHeight = displayedWidth / imgAspect;
    }
    
    return { width: displayedWidth, height: displayedHeight };
  };

  const cropImage = () => {
    if (!imageSrc || !containerRef.current || !imageRef.current) return;
    
    const outputSize = 800; // High quality square output
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        console.error('Invalid image dimensions');
        return;
      }

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const containerSize = containerRect.width || 400;
      
      // Calculate displayed image dimensions (at zoom = 1, before scaling)
      const displaySize = calculateImageDisplaySize(img, containerSize);
      const displayedWidth = displaySize.width;
      const displayedHeight = displaySize.height;
      
      // The displayed image is scaled by zoom
      const scaledDisplayWidth = displayedWidth * zoom;
      const scaledDisplayHeight = displayedHeight * zoom;
      
      // Calculate scale factor from displayed pixels to actual image pixels
      const scaleX = img.naturalWidth / scaledDisplayWidth;
      const scaleY = img.naturalHeight / scaledDisplayHeight;
      
      // Container center (where image is centered)
      const containerCenterX = containerSize / 2;
      const containerCenterY = containerSize / 2;
      
      // Image center position in container coordinates (after offset)
      const imageCenterInContainerX = containerCenterX + offset.x;
      const imageCenterInContainerY = containerCenterY + offset.y;
      
      // Crop area bounds in container coordinates
      const cropLeft = 0;
      const cropTop = 0;
      const cropRight = containerSize;
      const cropBottom = containerSize;
      
      // Image top-left in container coordinates
      const imageTopLeftX = imageCenterInContainerX - scaledDisplayWidth / 2;
      const imageTopLeftY = imageCenterInContainerY - scaledDisplayHeight / 2;
      
      // Crop area top-left relative to image top-left
      const cropRelativeLeft = cropLeft - imageTopLeftX;
      const cropRelativeTop = cropTop - imageTopLeftY;
      
      // Convert to actual image coordinates
      let sourceX = cropRelativeLeft * scaleX;
      let sourceY = cropRelativeTop * scaleY;
      const sourceSize = containerSize * scaleX;
      
      // Ensure we don't go out of bounds
      sourceX = Math.max(0, Math.min(sourceX, img.naturalWidth - sourceSize));
      sourceY = Math.max(0, Math.min(sourceY, img.naturalHeight - sourceSize));
      const finalSourceSize = Math.min(sourceSize, img.naturalWidth - sourceX, img.naturalHeight - sourceY);
      
      // Draw white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outputSize, outputSize);
      
      // Draw cropped and resized image to canvas (square output)
      ctx.drawImage(
        img,
        sourceX, sourceY, finalSourceSize, finalSourceSize,
        0, 0, outputSize, outputSize
      );
      
      // Compress and return
      onCropComplete(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      console.error('Failed to load image for cropping');
    };
    img.src = imageSrc;
  };

  React.useEffect(() => {
    if (open && imageSrc) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [open, imageSrc]);

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crop & Adjust Photo</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div
            ref={containerRef}
            className="relative w-full aspect-square bg-gray-200 rounded-lg overflow-hidden mb-4 border-2 border-gray-300"
            style={{ height: '400px', maxWidth: '400px', margin: '0 auto' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {imageSrc && (
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop"
                className="absolute top-1/2 left-1/2 origin-center select-none pointer-events-none"
                style={{
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  maxWidth: 'none',
                  width: 'auto',
                  height: 'auto',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  userSelect: 'none'
                }}
                draggable={false}
                onLoad={() => {
                  // Auto-fit image on load
                  if (imageRef.current && containerRef.current) {
                    const img = imageRef.current;
                    const container = containerRef.current;
                    const containerSize = container.offsetWidth || 400;
                    
                    if (img.naturalWidth === 0 || img.naturalHeight === 0) return;
                    
                    const displaySize = calculateImageDisplaySize(img, containerSize);
                    
                    // Set initial zoom to slightly larger than fit (110%)
                    const fitZoom = Math.min(containerSize / displaySize.width, containerSize / displaySize.height);
                    setZoom(Math.max(1, Math.min(fitZoom * 1.1, 2)));
                    setOffset({ x: 0, y: 0 });
                  }
                }}
              />
            )}
            <div className="absolute inset-0 border-4 border-[#E6B450] pointer-events-none shadow-lg" />
            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              Drag to move • Zoom to adjust
            </div>
          </div>
          <div className="space-y-3 max-w-md mx-auto">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Zoom: {zoom.toFixed(1)}x</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setZoom(1);
                    setOffset({ x: 0, y: 0 });
                  }}
                >
                  Reset
                </Button>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <p className="text-xs text-[#706B67] text-center">
              Drag the image to reposition, adjust zoom, then click "Crop & Save"
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={cropImage} className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D]">
            <Crop className="w-4 h-4 mr-2" />
            Crop & Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProfilePage;
