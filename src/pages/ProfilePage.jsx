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
import { supabase } from '@/lib/customSupabaseClient';
import { 
  MapPin, User, Heart, Star, ShieldCheck, Edit, Crown, AlertCircle, 
  CheckCircle, XCircle, Eye, Camera, Upload, Trash2, Crop, Loader2,
  Mail, Lock, Award, Languages, Users, Target, Home, Sparkles, FileText
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
  const [tempImage, setTempImage] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [emailVerified, setEmailVerified] = useState(false);

  const isOwnProfile = !userId;

  useEffect(() => {
    fetchProfile();
    fetchAuthInfo();
  }, [userId]);

  const fetchAuthInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email);
      setEmailVerified(user.email_confirmed_at !== null);
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
        .single();

      if (error) {
        toast({ title: "Error", description: "Could not load profile", variant: "destructive" });
      } else {
        setProfile(data);
        setEditBio(data.bio || '');
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load profile", variant: "destructive" });
    } finally {
      setLoading(false);
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

        {/* Profile Completeness Card */}
        {isOwnProfile && !isPreviewMode && (
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
          <div className="h-48 bg-gradient-to-r from-[#F3E8D9] to-[#F9E7EB] relative">
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
                    <img src={mainPhoto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-full h-full p-6 text-[#C85A72]" />
                  )}
                </div>
                {profile.is_premium && (
                  <div className="absolute bottom-1 right-1 bg-[#E6B450] text-white p-1 rounded-full border-2 border-white shadow-sm">
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
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {profile.photos?.map((p, i) => (
                    <div key={i} className="relative aspect-square rounded-md overflow-hidden group">
                      <img src={p} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      {isOwnProfile && !isPreviewMode && (
                        <button
                          onClick={() => handleRemovePhoto(i)}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      {i === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] py-1 text-center font-bold">
                          Main Photo
                        </div>
                      )}
                    </div>
                  ))}
                  {Array.from({ length: photoLimit - currentPhotoCount }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square rounded-md border-2 border-dashed border-[#E6DCD2] flex items-center justify-center bg-[#FAF7F2]">
                      {isOwnProfile && !isPreviewMode && (
                        <label className="cursor-pointer w-full h-full flex items-center justify-center">
                          <Upload className="w-6 h-6 text-[#706B67]" />
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#706B67]" />
                      <span className="text-sm text-[#1F1F1F]">Email Verified</span>
                    </div>
                    {emailVerified ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-yellow-300 text-yellow-700">
                        <AlertCircle className="w-3 h-3 mr-1" /> Pending
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-[#706B67]" />
                      <span className="text-sm text-[#1F1F1F]">Photo Verified</span>
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#706B67]" />
                      <span className="text-sm text-[#1F1F1F]">Identity Verified</span>
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
                <CardContent className="space-y-3">
                  {profile.religious_affiliation && (
                    <div>
                      <span className="text-sm font-medium text-[#706B67]">Religious Affiliation:</span>
                      <p className="text-[#1F1F1F]">{profile.religious_affiliation}</p>
                    </div>
                  )}
                  {profile.faith_lifestyle && (
                    <div>
                      <span className="text-sm font-medium text-[#706B67]">Faith Lifestyle:</span>
                      <p className="text-[#1F1F1F]">{profile.faith_lifestyle}</p>
                    </div>
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
                  <div className="flex flex-wrap gap-2">
                    {profile.core_values.map((value, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-[#FAF7F2] text-[#1F1F1F]">
                        {value}
                      </Badge>
                    ))}
                  </div>
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
                  <div className="flex flex-wrap gap-2">
                    {profile.languages.map((lang, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-[#FAF7F2] text-[#1F1F1F]">
                        {lang}
                      </Badge>
                    ))}
                  </div>
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
                  <div className="flex flex-wrap gap-2">
                    {profile.cultures.map((culture, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-[#FAF7F2] text-[#1F1F1F]">
                        {culture}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Goals Card */}
            {(profile.relationship_goal || profile.family_goals) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#C85A72]" />
                    Goals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {profile.relationship_goal && (
                    <div>
                      <span className="text-sm font-medium text-[#706B67]">Relationship Goal:</span>
                      <p className="text-[#1F1F1F]">{profile.relationship_goal}</p>
                    </div>
                  )}
                  {profile.family_goals && (
                    <div>
                      <span className="text-sm font-medium text-[#706B67]">Family Goals:</span>
                      <p className="text-[#1F1F1F]">{profile.family_goals}</p>
                    </div>
                  )}
                  {profile.willing_to_relocate && (
                    <div>
                      <span className="text-sm font-medium text-[#706B67]">Willing to Relocate:</span>
                      <p className="text-[#1F1F1F]">{profile.willing_to_relocate}</p>
                    </div>
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
    </div>
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

  const cropImage = () => {
    // Enforce 1:1 aspect ratio (square)
    const size = 800;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.onload = () => {
      // Calculate scale to fit the crop area (400x400 container)
      const containerSize = 400;
      const scale = Math.max(img.width / containerSize, img.height / containerSize);
      
      // Calculate source coordinates (enforcing square crop)
      const cropSize = (containerSize / zoom) * scale;
      const sourceX = (-offset.x * scale) + (img.width - cropSize) / 2;
      const sourceY = (-offset.y * scale) + (img.height - cropSize) / 2;
      
      // Draw cropped and resized image to canvas (square output)
      ctx.drawImage(
        img,
        sourceX, sourceY, cropSize, cropSize,
        0, 0, size, size
      );
      
      // Compress and return
      onCropComplete(canvas.toDataURL('image/jpeg', 0.85));
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
            className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4"
            style={{ height: '400px' }}
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
                className="absolute"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  cursor: isDragging ? 'grabbing' : 'grab'
                }}
                draggable={false}
              />
            )}
            <div className="absolute inset-0 border-4 border-[#E6B450] pointer-events-none" />
          </div>
          <div className="space-y-2">
            <Label>Zoom</Label>
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
          <p className="text-xs text-[#706B67] mt-2">
            Drag to reposition, adjust zoom, then click "Crop & Save"
          </p>
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
