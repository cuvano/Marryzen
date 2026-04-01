import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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
import { recordProfileView } from '@/lib/profileViews';
import { 
  MapPin, User, Heart, Star, ShieldCheck, Edit, Crown, AlertCircle, 
  CheckCircle, XCircle, Eye, Camera, Upload, Trash2, Crop, Loader2,
  Mail, Lock, Award, Languages, Users, Target, Home, Sparkles, FileText, ArrowLeft, Flag, BadgeCheck, ExternalLink
} from 'lucide-react';
import Footer from '@/components/Footer';
import ReportUserModal from '@/components/ReportUserModal';

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-4">
    <span className="text-sm text-[#666]">{label}</span>
    <span className="text-sm text-[#111] text-right font-medium">{value}</span>
  </div>
);

const ProfilePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [isBioDialogOpen, setIsBioDialogOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhotoIndex, setDeletingPhotoIndex] = useState(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [coverCropModalOpen, setCoverCropModalOpen] = useState(false);
  const [tempImage, setTempImage] = useState(null);
  const [tempCoverImage, setTempCoverImage] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [isSelfieDialogOpen, setIsSelfieDialogOpen] = useState(false);
  const [selfieImage, setSelfieImage] = useState(null);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [referralInfo, setReferralInfo] = useState(null);
  const profilePhotoInputRef = useRef(null);
  const latestPhotosRef = useRef([]);

  const isOwnProfile = !userId;

  // Keep ref in sync so crop complete always has latest photos (avoids stale closure)
  useEffect(() => {
    latestPhotosRef.current = profile?.photos ?? [];
  }, [profile?.photos]);

  useEffect(() => {
    fetchProfile();
    fetchAuthInfo();
    if (isOwnProfile) {
      fetchReferralInfo();
    }
    
    // Refresh email verification status periodically and on focus
    const interval = setInterval(fetchAuthInfo, 5000); // Check every 5 seconds
    const handleFocus = () => fetchAuthInfo();
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [userId, isOwnProfile]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('verification') === 'done') {
      toast({ title: 'Verification submitted', description: "We're checking your details. You'll be notified when the result is ready." });
      fetchProfile();
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  const fetchAuthInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email);
      const isVerified = user.email_confirmed_at !== null;
      setEmailVerified(isVerified);
    }
  };

  const fetchReferralInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if this user was referred by someone
      const { data: referral, error } = await supabase
        .from('referrals')
        .select(`
          *,
          referrer:referrer_id(referral_code, full_name)
        `)
        .eq('referred_user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching referral info:', error);
        return;
      }

      if (referral && referral.referrer) {
        setReferralInfo({
          referralCode: referral.referrer.referral_code,
          referrerName: referral.referrer.full_name,
          status: referral.status,
          createdAt: referral.created_at
        });
      }
    } catch (error) {
      console.error('Error fetching referral info:', error);
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
        
        if (userId && session && session.user.id !== userId) {
          recordProfileView(supabase, session.user.id, userId);
        }
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

  const [verificationStarting, setVerificationStarting] = useState(false);

  const startVerification = async () => {
    if (!isOwnProfile) return;
    setVerificationStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-verification-session');
      if (error) {
        let msg = data?.error || error?.message || 'Verification service error.';
        let details = data?.details ?? '';
        if (error?.context && typeof error.context?.json === 'function') {
          try {
            const body = await error.context.json();
            if (body?.error) msg = body.error;
            if (body?.details) details = body.details;
          } catch (_) {}
        }
        toast({
          title: 'Verification unavailable',
          description: details ? `${msg} ${details}` : msg,
          variant: 'destructive',
        });
        return;
      }
      const url = data?.url;
      if (url) {
        setIsSelfieDialogOpen(false);
        window.location.href = url;
        return;
      }
      toast({
        title: 'Verification unavailable',
        description: data?.error || 'No verification URL returned.',
        variant: 'destructive',
      });
    } catch (err) {
      console.error('Verification start error', err);
      toast({
        title: 'Verification unavailable',
        description: err?.message || 'Could not start verification. Please try again or contact support.',
        variant: 'destructive',
      });
    } finally {
      setVerificationStarting(false);
    }
  };

  const handleUploadSelfie = async () => {
    if (!selfieImage || !isOwnProfile) return;
    setUploadingSelfie(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setUploadingSelfie(false); return; }
      const compressed = await compressImage(selfieImage, 800, 0.85);
      const { error } = await supabase.from('profiles').update({ selfie_url: compressed, identity_verification_status: 'pending' }).eq('id', user.id);
      if (error) throw error;
      setProfile(prev => ({ ...prev, selfie_url: compressed, identity_verification_status: 'pending' }));
      setIsSelfieDialogOpen(false);
      setSelfieImage(null);
      toast({ title: "Selfie Submitted", description: "Your selfie has been submitted for admin review. You'll be notified once it's verified." });
    } catch (error) {
      console.error('Selfie upload error:', error);
      toast({ title: "Error", description: error.message || "Failed to upload selfie. Please try again.", variant: "destructive" });
    } finally {
      setUploadingSelfie(false);
    }
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

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid File", description: "Please select an image file", variant: "destructive" });
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Please select an image under 10MB", variant: "destructive" });
      e.target.value = '';
      return;
    }

    // Open crop modal (same flow as edit/onboarding page)
    const reader = new FileReader();
    reader.onload = () => {
      setTempImage(reader.result);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset so same file can be selected again
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
      if (!user) {
        setUploadingPhoto(false);
        return;
      }

      const compressed = await compressImage(croppedBase64);
      // Use ref so we always append to latest photos (avoids stale state when dialog was open)
      const currentPhotos = latestPhotosRef.current ?? [];
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

    setDeletingPhotoIndex(index);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDeletingPhotoIndex(null);
        return;
      }

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
    } finally {
      setDeletingPhotoIndex(null);
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

  // Trait chips for hero (scannable like Hinge/Bumble)
  const traitChips = [
    ...(profile.religious_affiliation ? [{ label: profile.religious_affiliation, icon: Heart }] : []),
    ...(profile.relationship_goal ? [{ label: profile.relationship_goal, icon: Target }] : []),
    ...(profile.family_goals ? [{ label: profile.family_goals, icon: Home }] : []),
    ...(profile.languages?.length ? [{ label: profile.languages.slice(0, 2).join(' · '), icon: Languages }] : []),
  ].slice(0, 4);

  return (
    <div className="min-h-screen bg-[#F5F5F3]">
      {/* Top bar — full width, content aligned */}
      <div className="w-full border-b border-[#E8E6E4] bg-white/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-10 py-4 flex items-center justify-between">
          {!isOwnProfile ? (
            <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#555] hover:text-[#111] text-sm font-medium transition-colors py-2 px-1 rounded-lg hover:bg-[#F0EFEC]">
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          ) : (
            <div />
          )}
          {isOwnProfile && (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setIsPreviewMode(!isPreviewMode)} className="text-sm font-medium text-[#555] hover:text-[#111] py-2.5 px-4 rounded-lg hover:bg-[#F0EFEC] border border-[#E8E6E4]">
                {isPreviewMode ? 'Exit preview' : 'Preview'}
              </button>
              <button type="button" onClick={() => navigate('/onboarding?edit=1')} className="text-sm font-semibold text-white bg-[#1a1a1a] hover:bg-[#333] py-2.5 px-5 rounded-lg transition-colors">
                Edit profile
              </button>
            </div>
          )}
          {!isOwnProfile && (
            <button type="button" onClick={() => setIsReportModalOpen(true)} className="text-sm font-medium text-[#C53030] hover:text-[#9B2C2C] transition-colors py-2 px-1">
              Report
            </button>
          )}
        </div>
      </div>

      {/* Full-width hero — edge to edge cover, content in wide container */}
      <div className="w-full bg-[#E8E6E4]">
        <div className="relative h-[280px] sm:h-[320px] lg:h-[380px] w-full overflow-hidden group">
          {profile.cover_photo ? (
            <img src={profile.cover_photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#E0DDD9] to-[#D4D1CC]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 from-0% via-black/20 via-40% to-transparent" />
          {isOwnProfile && !isPreviewMode && (
            <label className="absolute inset-0 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
              <span className="bg-white text-[#111] px-5 py-2.5 rounded-lg text-sm font-medium shadow-lg">
                {profile.cover_photo ? 'Change cover' : 'Add cover photo'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleCoverPhotoSelect} />
            </label>
          )}
          {isOwnProfile && !isPreviewMode && !profile.is_premium && (
            <button type="button" onClick={() => navigate('/premium')} className="absolute top-6 right-6 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-lg">
              Go Premium
            </button>
          )}
        </div>
        {/* Hero content — avatar + name in wide container */}
        <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <div className="relative -mt-20 sm:-mt-24 flex flex-col sm:flex-row sm:items-end gap-6 pb-8">
            <div className="relative shrink-0">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-white shadow-2xl bg-[#E8E6E4] overflow-hidden">
                {mainPhoto ? (
                  <img src={mainPhoto} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling?.classList.remove('hidden'); }} />
                ) : null}
                {!mainPhoto && <User className="w-full h-full p-10 text-[#AAA]" />}
              </div>
              {profile.is_premium && (
                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-2 rounded-full border-2 border-white shadow-lg">
                  <Crown size={16} />
                </div>
              )}
              {profile.is_verified && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white p-2 rounded-full border-2 border-white shadow-lg">
                  <ShieldCheck size={14} />
                </div>
              )}
            </div>
            <div className="min-w-0 [text-shadow:0_1px_2px_rgba(0,0,0,0.8),0_2px_8px_rgba(0,0,0,0.6)]">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                {profile.full_name}, {age}
              </h1>
              <p className="text-white text-base sm:text-lg mt-1 flex items-center gap-2">
                <MapPin size={18} className="shrink-0" />
                {[profile.location_city, profile.location_country].filter(Boolean).join(', ') || 'Location not set'}
              </p>
              {traitChips.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
                  {traitChips.map((t, i) => (
                    <span key={i} className="inline-block px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white text-sm font-medium border border-white/30">
                      {t.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Wide content area — two columns on large screens */}
      <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-10 py-8 lg:py-10">
        {/* Profile strength — full width strip when incomplete */}
        {isOwnProfile && !isPreviewMode && completeness < 100 && (
          <div className="mb-8 rounded-xl bg-white border border-[#E8E6E4] px-6 py-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-[15px] text-[#333]">
                Profile strength: <strong>{completeness}%</strong> — {checklist.filter(c => !c.completed).length} items to complete
              </p>
              <Progress value={completeness} className="h-2 w-48 rounded-full" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Left column — Photos + Account status */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-6">
            {/* Photos */}
            <section className="rounded-xl bg-white border border-[#E8E6E4] overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-[#E8E6E4] flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#111]">Photos</h2>
                <span className="text-sm text-[#666]">{currentPhotoCount} of {photoLimit}</span>
              </div>
              <div className="p-6">
            <div className="grid grid-cols-2 gap-2">
              {(profile.photos?.length > 0) ? (
                (profile.photos.slice(0, photoLimit)).map((p, i) => (
                  <div key={`photo-${i}`} className={`relative aspect-square rounded-lg overflow-hidden bg-[#E8E6E4] group ${i === 0 ? 'col-span-2' : ''}`}>
                    <img src={p} alt="" className="w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} onError={(e) => { e.target.style.display = 'none'; }} />
                    {deletingPhotoIndex === i && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                        <span className="text-xs font-medium text-white">Removing...</span>
                      </div>
                    )}
                    {isOwnProfile && !isPreviewMode && deletingPhotoIndex === null && (
                      <button type="button" onClick={() => handleRemovePhoto(i)} className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-2 aspect-[4/3] rounded-lg border-2 border-dashed border-[#D4D2CE] flex items-center justify-center bg-[#F5F5F3]">
                  {isOwnProfile && !isPreviewMode ? (
                    <label className="cursor-pointer flex flex-col items-center gap-2 p-4 text-center">
                      <Camera className="w-10 h-10 text-[#AAA]" />
                      <span className="text-sm text-[#666]">Add main photo</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                    </label>
                  ) : (
                    <User className="w-12 h-12 text-[#D4D2CE]" />
                  )}
                </div>
              )}
              {Array.from({ length: currentPhotoCount === 0 ? Math.max(0, photoLimit - 1) : Math.max(0, photoLimit - currentPhotoCount) }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square rounded-lg border-2 border-dashed border-[#D4D2CE] flex items-center justify-center bg-[#F5F5F3]">
                  {isOwnProfile && !isPreviewMode && (
                    <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-1">
                      <Upload className="w-5 h-5 text-[#AAA]" />
                      <span className="text-[11px] text-[#666]">Add</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                    </label>
                  )}
                </div>
              ))}
            </div>
                {currentPhotoCount >= photoLimit && !profile.is_premium && (
                  <p className="mt-3 text-xs text-[#666]">Limit reached. Upgrade for more.</p>
                )}
                {isOwnProfile && !isPreviewMode && currentPhotoCount < photoLimit && (
                  <>
                    <input ref={profilePhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                    <button type="button" onClick={() => profilePhotoInputRef.current?.click()} className="mt-3 w-full py-2.5 rounded-lg border border-[#E8E6E4] text-sm font-medium text-[#333] hover:bg-[#F5F5F3] transition-colors">
                      Add photo
                    </button>
                  </>
                )}
              </div>
            </section>

            {/* Account status — left column */}
            {isOwnProfile && (
              <section className="rounded-xl bg-white border border-[#E8E6E4] overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-[#E8E6E4]">
                  <h2 className="text-base font-semibold text-[#111]">Account status</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-[#666]">Profile</span>
                    <span className={`text-sm font-medium ${profile.status === 'approved' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {profile.status === 'approved' ? 'Approved' : profile.status === 'pending_review' ? 'Pending' : 'Not approved'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[#666]">Identity</span>
                    {profile.identity_verification_status === 'verified' ? (
                      <span className="text-sm font-medium text-emerald-600">Verified</span>
                    ) : profile.identity_verification_status === 'pending' ? (
                      <span className="text-sm font-medium text-amber-600">Pending</span>
                    ) : profile.identity_verification_status === 'rejected' ? (
                      <span className="text-sm font-medium text-red-600">Rejected</span>
                    ) : (
                      <button type="button" onClick={() => setIsSelfieDialogOpen(true)} className="text-sm font-medium text-[#111] hover:underline">Verify</button>
                    )}
                  </div>
                  {(profile.identity_verification_status === 'pending' || profile.identity_verification_status === 'rejected') && profile.selfie_url && (
                    <div className="pt-3 border-t border-[#E8E6E4] flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#E8E6E4] shrink-0">
                        <img src={profile.selfie_url} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-[#666]">{profile.identity_verification_status === 'rejected' ? 'Rejected.' : 'Under review.'}</p>
                        <button type="button" onClick={() => setIsSelfieDialogOpen(true)} className="text-xs font-medium text-[#111] hover:underline mt-0.5">
                          {profile.identity_verification_status === 'rejected' ? 'Resubmit' : 'View'}
                        </button>
                      </div>
                    </div>
                  )}
                  {referralInfo && (
                    <div className="border-t border-[#E8E6E4] pt-3">
                      <p className="text-xs text-[#666]">Referred by <strong className="text-[#111]">{referralInfo.referrerName}</strong></p>
                      <p className="text-xs text-[#666] mt-0.5 font-mono">{referralInfo.referralCode}</p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Right column — About + details (wider) */}
          <div className="lg:col-span-8 xl:col-span-8 space-y-6">
            <section className="rounded-xl bg-white border border-[#E8E6E4] overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-[#E8E6E4] flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#111]">About me</h2>
                {isOwnProfile && !isPreviewMode && (
                  <button type="button" onClick={() => setIsBioDialogOpen(true)} className="text-sm font-medium text-[#555] hover:text-[#111]">
                    {profile.bio ? 'Edit' : 'Add'}
                  </button>
                )}
              </div>
              <div className="p-6">
                {profile.bio ? (
                  <p className="text-[#333] text-[15px] leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
                ) : (
                  <div className="text-center py-10 text-[#666]">
                    <p className="text-sm">No bio yet.</p>
                    {isOwnProfile && !isPreviewMode && (
                      <button type="button" onClick={() => setIsBioDialogOpen(true)} className="mt-3 text-sm font-medium text-[#111] hover:underline">
                        Add bio
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>

            {(profile.religious_affiliation || profile.faith_lifestyle) && (
              <section className="rounded-xl bg-white border border-[#E8E6E4] overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-[#E8E6E4]">
                  <h2 className="text-base font-semibold text-[#111]">Faith & lifestyle</h2>
                </div>
                <div className="p-6 space-y-3">
                  {profile.religious_affiliation && <Row label="Religion" value={profile.religious_affiliation} />}
                  {profile.faith_lifestyle && <Row label="Practice" value={profile.faith_lifestyle} />}
                </div>
              </section>
            )}

            {profile.core_values && profile.core_values.length > 0 && (
              <section className="rounded-xl bg-white border border-[#E8E6E4] overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-[#E8E6E4]">
                  <h2 className="text-base font-semibold text-[#111]">Core values</h2>
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap gap-2">
                    {profile.core_values.map((v, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-[#F5F5F3] text-sm text-[#333]">{v}</span>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {profile.languages && profile.languages.length > 0 && (
              <section className="rounded-xl bg-white border border-[#E8E6E4] overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-[#E8E6E4]">
                  <h2 className="text-base font-semibold text-[#111]">Languages</h2>
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap gap-2">
                    {profile.languages.map((lang, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-[#F5F5F3] text-sm text-[#333]">{lang}</span>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {profile.cultures && profile.cultures.length > 0 && (
              <section className="rounded-xl bg-white border border-[#E8E6E4] overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-[#E8E6E4]">
                  <h2 className="text-base font-semibold text-[#111]">Cultures</h2>
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap gap-2">
                    {profile.cultures.map((c, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-[#F5F5F3] text-sm text-[#333]">{c}</span>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {(profile.smoking || profile.drinking || profile.marital_status || profile.has_children !== undefined || profile.education || profile.occupation || profile.zodiac_sign || profile.country_of_origin) && (
              <section className="rounded-xl bg-white border border-[#E8E6E4] overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-[#E8E6E4]">
                  <h2 className="text-base font-semibold text-[#111]">Lifestyle & background</h2>
                </div>
                <div className="p-6 space-y-3">
                  {profile.smoking && <Row label="Smoking" value={profile.smoking} />}
                  {profile.drinking && <Row label="Drinking" value={profile.drinking} />}
                  {profile.marital_status && <Row label="Marital status" value={profile.marital_status} />}
                  {profile.has_children !== undefined && <Row label="Children" value={profile.has_children ? 'Yes' : 'No'} />}
                  {profile.education && <Row label="Education" value={profile.education} />}
                  {profile.occupation && <Row label="Occupation" value={profile.occupation} />}
                  {profile.zodiac_sign && <Row label="Zodiac" value={profile.zodiac_sign} />}
                  {profile.country_of_origin && <Row label="Origin" value={profile.country_of_origin} />}
                </div>
              </section>
            )}

            {(profile.relationship_goal || profile.family_goals || profile.willing_to_relocate) && (
              <section className="rounded-xl bg-white border border-[#E8E6E4] overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-[#E8E6E4]">
                  <h2 className="text-base font-semibold text-[#111]">Goals</h2>
                </div>
                <div className="p-6 space-y-3">
                  {profile.relationship_goal && <Row label="Relationship" value={profile.relationship_goal} />}
                  {profile.family_goals && <Row label="Family" value={profile.family_goals} />}
                  {profile.willing_to_relocate && <Row label="Relocate" value={profile.willing_to_relocate} />}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <Footer />

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
          if (!uploadingPhoto) {
            setCropModalOpen(false);
            setTempImage(null);
          }
        }}
        uploading={uploadingPhoto}
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

      {/* Identity Verification Dialog (Didit) */}
      <Dialog open={isSelfieDialogOpen} onOpenChange={setIsSelfieDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-[#E6B450]" />
              Identity Verification
            </DialogTitle>
            <CardDescription>
              Verify your identity with our secure partner Didit. You'll need an ID document and a short selfie. The process takes about 2 minutes.
            </CardDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="rounded-lg bg-[#FAF7F2] border border-[#E6DCD2] p-4 text-sm text-[#706B67]">
              <p className="font-medium text-[#1F1F1F] mb-1">What happens next:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>You'll be redirected to Didit's secure page</li>
                <li>Take a photo of your ID and a quick selfie</li>
                <li>We'll update your verification status automatically</li>
              </ul>
            </div>
            <Button
              onClick={startVerification}
              disabled={verificationStarting}
              className="w-full bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-semibold"
            >
              {verificationStarting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting...</>
              ) : (
                <><ExternalLink className="w-4 h-4 mr-2" /> Start verification</>
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSelfieDialogOpen(false)} disabled={verificationStarting}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Report User Modal */}
      {!isOwnProfile && profile && (
        <ReportUserModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          reportedUserName={profile.full_name}
          reportedUserId={profile.id}
        />
      )}
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

// Image Crop Dialog Component — matches onboarding Step2 cropper so crop result = what you see
const CONTAINER_SIZE = 400;

const ImageCropDialog = ({ open, imageSrc, onCropComplete, onCancel, uploading = false }) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imageDisplaySize, setImageDisplaySize] = useState({ width: 0, height: 0 });
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
    if (!img || !containerSize) return { width: 0, height: 0 };
    const imgAspect = img.naturalWidth / img.naturalHeight;
    let displayedWidth, displayedHeight;
    if (imgAspect > 1) {
      displayedHeight = containerSize;
      displayedWidth = displayedHeight * imgAspect;
    } else {
      displayedWidth = containerSize;
      displayedHeight = displayedWidth / imgAspect;
    }
    return { width: displayedWidth, height: displayedHeight };
  };

  const cropImage = () => {
    if (!imageRef.current || !containerRef.current || uploading) return;
    const img = imageRef.current;
    const container = containerRef.current;
    const containerSize = container.offsetWidth || CONTAINER_SIZE;
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return;

    const outputSize = 800;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outputSize, outputSize);

    // Use same logic as onboarding: displayed size is the fitted size we set on the img
    const displaySize = calculateImageDisplaySize(img, containerSize);
    const displayedWidth = displaySize.width;
    const displayedHeight = displaySize.height;
    const scaledDisplayWidth = displayedWidth * zoom;
    const scaledDisplayHeight = displayedHeight * zoom;
    const scaleX = img.naturalWidth / scaledDisplayWidth;
    const scaleY = img.naturalHeight / scaledDisplayHeight;
    const containerCenterX = containerSize / 2;
    const containerCenterY = containerSize / 2;
    const imageCenterInContainerX = containerCenterX + offset.x;
    const imageCenterInContainerY = containerCenterY + offset.y;
    const imageTopLeftX = imageCenterInContainerX - scaledDisplayWidth / 2;
    const imageTopLeftY = imageCenterInContainerY - scaledDisplayHeight / 2;
    const cropRelativeLeft = 0 - imageTopLeftX;
    const cropRelativeTop = 0 - imageTopLeftY;
    let sourceX = cropRelativeLeft * scaleX;
    let sourceY = cropRelativeTop * scaleY;
    const sourceSize = containerSize * scaleX;
    sourceX = Math.max(0, Math.min(sourceX, img.naturalWidth - sourceSize));
    sourceY = Math.max(0, Math.min(sourceY, img.naturalHeight - sourceSize));
    const finalSourceSize = Math.min(sourceSize, img.naturalWidth - sourceX, img.naturalHeight - sourceY);
    ctx.drawImage(img, sourceX, sourceY, finalSourceSize, finalSourceSize, 0, 0, outputSize, outputSize);
    onCropComplete(canvas.toDataURL('image/jpeg', 0.85));
  };

  React.useEffect(() => {
    if (open && imageSrc) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setImageDisplaySize({ width: 0, height: 0 });
    }
  }, [open, imageSrc]);

  return (
    <Dialog open={open} onOpenChange={uploading ? undefined : onCancel}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crop & Adjust Photo</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div
            ref={containerRef}
            className="relative bg-gray-200 rounded-lg overflow-hidden mb-4 border-2 border-gray-300 mx-auto"
            style={{ width: CONTAINER_SIZE, height: CONTAINER_SIZE }}
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
                className="absolute top-1/2 left-1/2 origin-center select-none pointer-events-none max-w-none"
                style={{
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  width: imageDisplaySize.width || 'auto',
                  height: imageDisplaySize.height || 'auto',
                  maxWidth: 'none',
                  maxHeight: 'none'
                }}
                draggable={false}
                onLoad={() => {
                  if (!imageRef.current || !containerRef.current) return;
                  const img = imageRef.current;
                  const containerSize = containerRef.current.offsetWidth || CONTAINER_SIZE;
                  if (img.naturalWidth === 0 || img.naturalHeight === 0) return;
                  const displaySize = calculateImageDisplaySize(img, containerSize);
                  setImageDisplaySize({ width: displaySize.width, height: displaySize.height });
                  const fitZoom = Math.min(containerSize / displaySize.width, containerSize / displaySize.height);
                  setZoom(Math.max(1, Math.min(fitZoom * 1.1, 2)));
                  setOffset({ x: 0, y: 0 });
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
                  disabled={uploading}
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
                disabled={uploading}
              />
            </div>
            <p className="text-xs text-[#706B67] text-center">
              Drag the image to reposition, adjust zoom, then click "Crop & Save"
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={uploading}>Cancel</Button>
          <Button onClick={cropImage} disabled={uploading} className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D]">
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Crop className="w-4 h-4 mr-2" />
                Crop & Save
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProfilePage;
