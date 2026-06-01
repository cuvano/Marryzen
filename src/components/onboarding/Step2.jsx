import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, Trash2, Lock, ZoomIn, Crop, Crown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { uploadPhotoToStorage } from '@/lib/uploadPhoto';
import { PhotoBlockedError } from '@/lib/photoModeration';
import { detectFacesInImage, warmUpFaceDetector } from '@/lib/faceDetection';

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];
const MAX_FREE_PHOTOS = 4;
const MAX_PREMIUM_PHOTOS = 12;

// Helper to get client position from mouse or touch event
const getClientPos = (e) => {
  if (e.touches?.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches?.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
};

// Custom Lightweight Cropper Component
const ImageCropper = ({ imageSrc, onCropComplete, onCancel }) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const handleDragStart = (e) => {
    if (e.touches?.length) e.preventDefault();
    const pos = getClientPos(e);
    dragStartRef.current = { x: pos.x - offset.x, y: pos.y - offset.y };
    isDraggingRef.current = true;
    setIsDragging(true);
  };

  const handleDragMove = (e) => {
    if (!isDraggingRef.current) return;
    if (e.cancelable) e.preventDefault();
    const pos = getClientPos(e);
    setOffset({
      x: pos.x - dragStartRef.current.x,
      y: pos.y - dragStartRef.current.y
    });
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const calculateImageDisplaySize = (img, containerSize) => {
    if (!img || !containerSize) return { width: 0, height: 0 };
    
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
    if (!imageRef.current || !containerRef.current) return;
    
    const img = imageRef.current;
    const container = containerRef.current;
    const containerSize = container.offsetWidth || 300;
    
    // Wait for image to load
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      img.onload = () => cropImage();
      return;
    }
    
    const canvas = document.createElement('canvas');
    const outputSize = 800; // High quality output
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    
    // Draw white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outputSize, outputSize);
    
    // Calculate displayed image dimensions (at zoom = 1, before scaling)
    const displaySize = calculateImageDisplaySize(img, containerSize);
    const displayedWidth = displaySize.width;
    const displayedHeight = displaySize.height;
    
    // The displayed image is scaled by zoom, so actual displayed size is:
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
    
    // Crop area bounds in container coordinates (the visible container)
    const cropLeft = 0;
    const cropTop = 0;
    const cropRight = containerSize;
    const cropBottom = containerSize;
    
    // Convert crop area bounds to displayed image coordinates
    // Image center is at (imageCenterInContainerX, imageCenterInContainerY)
    // Image top-left in container coordinates:
    const imageTopLeftX = imageCenterInContainerX - scaledDisplayWidth / 2;
    const imageTopLeftY = imageCenterInContainerY - scaledDisplayHeight / 2;
    
    // Crop area top-left relative to image top-left
    const cropRelativeLeft = cropLeft - imageTopLeftX;
    const cropRelativeTop = cropTop - imageTopLeftY;
    
    // Convert to actual image coordinates
    let sourceX = cropRelativeLeft * scaleX;
    let sourceY = cropRelativeTop * scaleY;
    const sourceSize = containerSize * scaleX; // Crop size in actual image coordinates
    
    // Ensure we don't go out of bounds
    sourceX = Math.max(0, Math.min(sourceX, img.naturalWidth - sourceSize));
    sourceY = Math.max(0, Math.min(sourceY, img.naturalHeight - sourceSize));
    const finalSourceSize = Math.min(sourceSize, img.naturalWidth - sourceX, img.naturalHeight - sourceY);
    
    // Draw the cropped portion to canvas (square output)
    ctx.drawImage(
      img,
      sourceX, sourceY, finalSourceSize, finalSourceSize,
      0, 0, outputSize, outputSize
    );
    
    // Compress and return
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    onCropComplete(base64);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div 
            className="w-[300px] h-[300px] bg-black overflow-hidden relative rounded-xl border-2 border-[#E6B450] cursor-move shadow-inner touch-none"
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
            onTouchCancel={handleDragEnd}
            ref={containerRef}
        >
            <img loading="lazy" decoding="async" 
                ref={imageRef}
                src={imageSrc} 
                alt="Crop preview" 
                className="max-w-none absolute top-1/2 left-1/2 origin-center select-none pointer-events-none"
                style={{
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    width: imageSize.width || 'auto',
                    height: imageSize.height || 'auto',
                    maxWidth: 'none',
                    maxHeight: 'none'
                }}
                onLoad={() => {
                  // Calculate and set initial image display size
                  if (imageRef.current && containerRef.current) {
                    const img = imageRef.current;
                    const container = containerRef.current;
                    const containerSize = container.offsetWidth || 300;
                    const imgAspect = img.naturalWidth / img.naturalHeight;
                    
                    let displayedWidth, displayedHeight;
                    if (imgAspect > 1) {
                      // Wider image - fit to container height
                      displayedHeight = containerSize;
                      displayedWidth = displayedHeight * imgAspect;
                    } else {
                      // Taller image - fit to container width
                      displayedWidth = containerSize;
                      displayedHeight = displayedWidth / imgAspect;
                    }
                    
                    setImageSize({ width: displayedWidth, height: displayedHeight });
                    
                    // Set initial zoom to slightly larger than fit (110%)
                    const fitZoom = Math.min(containerSize / displayedWidth, containerSize / displayedHeight);
                    setZoom(Math.max(1, fitZoom * 1.1));
                    setOffset({ x: 0, y: 0 });
                  }
                }}
            />
            {/* Overlay Grid */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                {[...Array(9)].map((_, i) => (
                    <div key={i} className="border border-white/20"></div>
                ))}
            </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-[#706B67] font-medium">
            <span className="flex items-center gap-1"><ZoomIn size={14}/> Zoom / Fit</span>
            <span>{Math.round(zoom * 100)}%</span>
        </div>
        <Slider 
            value={[zoom]} 
            min={0.1} 
            max={3} 
            step={0.05} 
            onValueChange={(val) => setZoom(val[0])}
            className="w-full"
        />
        <div className="flex justify-between items-center mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
            className="text-xs h-7"
          >
            Reset
          </Button>
          <p className="text-[10px] text-[#706B67] text-center">
            Drag to reposition â¢ Zoom to adjust
          </p>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onCancel} className="border-[#E6DCD2]">Cancel</Button>
        <Button onClick={cropImage} className="bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold">
            <Crop className="w-4 h-4 mr-2"/> Apply Crop
        </Button>
      </DialogFooter>
    </div>
  );
};


const PhotoUploadBox = ({ index, photo, onUpload, onRemove, isMain, isLocked }) => {
  if (isLocked) {
      return (
        <div className="flex flex-col items-center text-center opacity-70">
            <div className="aspect-square w-full rounded-2xl flex flex-col items-center justify-center bg-[#F3F4F6] border border-[#E5E7EB] relative">
                <Lock className="w-6 h-6 text-[#9CA3AF] mb-2" />
                <span className="text-xs font-bold text-[#6B7280]">Locked</span>
                <div className="absolute top-2 right-2">
                    <Crown className="w-4 h-4 text-[#E6B450] fill-[#E6B450]" />
                </div>
            </div>
             <span className="text-xs mt-2 font-medium text-[#E6B450] flex items-center gap-1">
                 Unlock with Premium
             </span>
        </div>
      )
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={`aspect-square w-full rounded-2xl flex flex-col items-center justify-center overflow-hidden shadow-sm transition-all relative
          ${photo ? 'bg-white border border-[#E6DCD2]' : 'bg-white border-2 border-dashed border-[#E6DCD2] hover:border-[#C85A72] hover:bg-[#F9E7EB]/10 cursor-pointer'}
        `}
        onClick={!photo ? () => document.getElementById(`file-upload-${index}`).click() : undefined}
      >
        {photo ? (
          <>
            <img loading="lazy" decoding="async" 
                src={typeof photo === 'string' ? photo : URL.createObjectURL(photo)} 
                alt={`User upload ${index}`} 
                className="w-full h-full object-cover object-center rounded-2xl" 
                style={{ imageRendering: 'high-quality' }}
            />
             <div className="absolute top-1 right-1 bg-white/90 backdrop-blur-sm p-1.5 rounded-full cursor-pointer hover:bg-white hover:text-red-500 z-10 shadow-md transition-all hover:scale-110" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
                <Trash2 className="w-4 h-4" />
            </div>
            {isMain && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] py-1.5 px-2 font-bold rounded-b-2xl">
                    Main Photo
                </div>
            )}
          </>
        ) : (
           <>
            {isMain ? (
                <div className="w-12 h-12 bg-[#F9E7EB] rounded-full flex items-center justify-center mb-2">
                  <Camera className="w-6 h-6 text-[#C85A72]" />
                </div>
              ) : (
                <div className="w-12 h-12 bg-[#FAF7F2] rounded-full flex items-center justify-center mb-2">
                   <Upload className="w-6 h-6 text-[#C85A72]" />
                </div>
              )}
              <span className={`font-bold text-sm mt-2 ${isMain ? 'text-[#C85A72]' : 'text-[#333333]'}`}>
                {isMain ? 'Main Photo *' : `Photo ${index + 1}`}
              </span>
           </>
        )}
        <input 
            id={`file-upload-${index}`} 
            type="file" 
            accept={ALLOWED_TYPES.join(',')} 
            className="hidden" 
            onChange={(e) => onUpload(e.target.files[0])} 
        />
      </div>
      {photo && (
        <button 
            onClick={() => document.getElementById(`file-upload-${index}`).click()} 
            className="text-[#E6B450] text-xs mt-2 font-medium hover:underline flex items-center gap-1"
        >
            <Crop className="w-3 h-3"/> Replace / Crop
        </button>
      )}
    </div>
  );
};

const Step2 = ({ formData = {}, updateFormData = () => {} }) => {
  const { toast } = useToast();
  const currentPhotos = formData.photos || [];
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [tempImage, setTempImage] = useState(null);
  const [pendingIndex, setPendingIndex] = useState(null);
  const [isPremium, setIsPremium] = useState(false);

  // Fetch premium status from database
  useEffect(() => {
    const fetchPremiumStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_premium')
            .eq('id', user.id)
            .maybeSingle();
          
          // Use database value if available, otherwise fall back to formData
          const premiumStatus = profile?.is_premium || formData.isPremium === true;
          setIsPremium(premiumStatus);
        } else {
          // Fallback to formData if no user session
          setIsPremium(formData.isPremium === true);
        }
      } catch (error) {
        console.error('Error fetching premium status:', error);
        // Fallback to formData on error
        setIsPremium(formData.isPremium === true);
      }
    };

    fetchPremiumStatus();
  }, [formData.isPremium]);

  const maxPhotos = isPremium ? MAX_PREMIUM_PHOTOS : MAX_FREE_PHOTOS;

  const handleFileSelect = (file, index) => {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
         toast({ title: "Invalid File Type", description: "Please upload a JPG or PNG image.", variant: "destructive" });
         return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast({ title: "File Too Large", description: "Please upload an image under 10 MB.", variant: "destructive" });
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        setTempImage(reader.result);
        setPendingIndex(index);
        setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    // Pre-load face-detection model while user is selecting a photo, so the
    // check feels instant when they finish cropping. No-op after first run.
    warmUpFaceDetector();
  }, []);

  const handleCropComplete = async (croppedBase64) => {
      // Client-side face check before upload. Lazy-loaded face-api.js model.
      // Fails OPEN on infra issues (older browsers, CDN outage, etc.) so legit
      // users aren't blocked — the SafetyPanel + report flow catches what slips.
      const faceCheck = await detectFacesInImage(croppedBase64);
      if (!faceCheck.failOpen) {
        if (faceCheck.faces === 0) {
          toast({
            title: "No face detected",
            description: "We couldn't find a face in this photo. Please upload a clear photo where your face is visible.",
            variant: "destructive",
          });
          setCropModalOpen(false);
          setTempImage(null);
          setPendingIndex(null);
          return;
        }
        if (faceCheck.faces > 1) {
          toast({
            title: "Multiple people in photo",
            description: "Please upload a photo of just yourself. Group photos make it hard for matches to know who you are.",
            variant: "destructive",
          });
          setCropModalOpen(false);
          setTempImage(null);
          setPendingIndex(null);
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      let finalValue;
      try {
        finalValue = user?.id
          ? await uploadPhotoToStorage(croppedBase64, user.id, 'photo')
          : croppedBase64;
      } catch (err) {
        if (err?.code === 'PHOTO_BLOCKED' || err instanceof PhotoBlockedError) {
          // B6 — NSFW/CSAM/violence scan rejected the photo.
          toast({
            title: 'Photo not allowed',
            description: err.message || 'This photo violates our Community Guidelines. Please choose a different photo.',
            variant: 'destructive',
            duration: 8000,
          });
          return; // keep crop modal open so user can pick a different photo
        }
        throw err; // unexpected error — let outer handler deal with it
      }
      const newPhotos = [...currentPhotos];
      newPhotos[pendingIndex] = finalValue;
      updateFormData('photos', newPhotos);
      setCropModalOpen(false);
      setTempImage(null);
      setPendingIndex(null);
  };

  const handleRemovePhoto = (index) => {
      const newPhotos = [...currentPhotos];
      newPhotos.splice(index, 1);
      updateFormData('photos', newPhotos);
  };
  
  return (
    <>
      <div className="space-y-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-4">Add Your Photos</h2>
          <p className="text-[#706B67] text-lg">Clear, modest photos help build trust and lead to better matches.</p>
        </div>

        {/* GDPR Article 9 biometric-data consent disclosure. Face detection
            runs locally on uploaded photos to verify a clearly visible face.
            This is special-category data under GDPR Article 9; explicit
            consent is captured by proceeding with upload. */}
        <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E6DCD2] mb-4">
          <p className="text-[#706B67] text-xs leading-relaxed">
            <span className="font-semibold text-[#1F1F1F]">Privacy:</span> Marryzen uses automated face detection on uploaded photos to confirm your main photo contains a visible face. This is biometric data under data-protection law (GDPR Article 9). By uploading a photo, you consent to this processing solely for profile verification. Face data is not retained beyond the verification check. See our <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline text-[#C85A72]">Privacy Policy</a>.
          </p>
        </div>

        {/* Slot rendering — session-11 board verdict (Riley):
            DO NOT render the locked premium slots until the user has uploaded
            at least photo[0]. Locks on an empty grid prime the user with
            "this app is paywalled" before they experience any value.
            After they upload their first photo, surface a SINGLE friendly
            upsell card (not 8 individual lock icons). */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {/* Always render the free slots (0..maxPhotos-1) for layout consistency.
              Empty slots beyond the next-available are hidden until needed. */}
          {[...Array(maxPhotos)].map((_, i) => {
            const isMain = i === 0;
            const hasPhoto = !!currentPhotos[i];
            const isNextEmpty = i === currentPhotos.length;
            const shouldRender = hasPhoto || i < MAX_FREE_PHOTOS || isNextEmpty;
            if (!shouldRender) return null;
            return (
              <PhotoUploadBox
                key={i}
                index={i}
                isMain={isMain}
                isLocked={false}
                photo={currentPhotos[i]}
                onUpload={(file) => handleFileSelect(file, i)}
                onRemove={() => handleRemovePhoto(i)}
              />
            );
          })}
          {/* Single friendly upsell card — only appears AFTER user has uploaded
              photo[0] and is on a free plan. No more wall-of-locks. */}
          {!isPremium && currentPhotos.length >= 1 && currentPhotos.length >= MAX_FREE_PHOTOS && (
            <div className="aspect-square w-full rounded-2xl flex flex-col items-center justify-center bg-gradient-to-br from-[#FAF7F2] to-[#F9E7EB]/40 border-2 border-dashed border-[#E6B450] p-3 text-center">
              <Crown className="w-8 h-8 text-[#E6B450] fill-[#E6B450] mb-2" />
              <span className="text-sm font-bold text-[#1F1F1F]">Add up to {MAX_PREMIUM_PHOTOS - MAX_FREE_PHOTOS} more</span>
              <span className="text-xs text-[#706B67] mt-1">with Premium</span>
            </div>
          )}
        </div>
        
        <div className="bg-[#FAF7F2] p-6 rounded-xl border border-[#E6DCD2] mt-8">
            <h3 className="text-[#1F1F1F] font-bold mb-3">Photo Guidelines:</h3>
            <ul className="text-sm text-[#333333] list-disc pl-5 space-y-1 font-medium">
                <li>Your face should be clearly visible (no heavy filters or sunglasses).</li>
                <li>You should be the only person in the photo (no group photos).</li>
                <li>Clothing must be modest. No underwear, swimwear, or sexually explicit photos.</li>
                <li>No photos of children alone, weapons, drugs, or offensive gestures.</li>
                <li>Allowed formats: JPG, PNG, HEIC. Max size: 10MB.</li>
            </ul>
            
            <div className="mt-4 pt-4 border-t border-[#CFC6BA]/30 flex items-start gap-2 text-xs text-[#706B67]">
                <Lock className="w-3 h-3 mt-0.5 text-[#C85A72]" />
                <p className="font-medium">
                    Your photos are visible only to other verified Marryzen members during discovery and matching. We never sell your photos or display them publicly outside the platform.
                </p>
            </div>
        </div>
      </div>

      <Dialog open={cropModalOpen} onOpenChange={setCropModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border-[#E6DCD2]">
          <DialogHeader>
            <DialogTitle className="text-[#1F1F1F]">Edit Photo</DialogTitle>
          </DialogHeader>
          {tempImage && (
              <ImageCropper 
                imageSrc={tempImage} 
                onCropComplete={handleCropComplete} 
                onCancel={() => { setCropModalOpen(false); setTempImage(null); }}
              />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Step2;
