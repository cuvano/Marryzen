import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, Trash2, Lock, ZoomIn, Crop, Crown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];
const MAX_FREE_PHOTOS = 4;
const MAX_PREMIUM_PHOTOS = 12;

// Custom Lightweight Cropper Component
const ImageCropper = ({ imageSrc, onCropComplete, onCancel }) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const imageRef = useRef(null);

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
    const canvas = document.createElement('canvas');
    const size = 600; // Output size 600x600
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    
    // Draw white background first (for when image is zoomed out and doesn't fill frame)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    
    // Scale factor between display (300px) and output (600px)
    const scaleFactor = size / 300; 
    
    ctx.translate(size / 2, size / 2);
    ctx.translate(offset.x * scaleFactor, offset.y * scaleFactor);
    ctx.scale(zoom, zoom);
    ctx.translate(-size / 2, -size / 2);
    
    // Draw image centered
    const aspect = img.naturalWidth / img.naturalHeight;
    let drawW, drawH;
    if (aspect > 1) {
        drawH = size;
        drawW = size * aspect;
    } else {
        drawW = size;
        drawH = size / aspect;
    }
    
    ctx.drawImage(img, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);
    
    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    onCropComplete(base64);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div 
            className="w-[300px] h-[300px] bg-black overflow-hidden relative rounded-xl border-2 border-[#E6B450] cursor-move shadow-inner"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            ref={containerRef}
        >
            <img 
                ref={imageRef}
                src={imageSrc} 
                alt="Crop preview" 
                className="max-w-none absolute top-1/2 left-1/2 origin-center select-none pointer-events-none"
                style={{
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    // Initial sizing to cover the box loosely
                    minWidth: '100%',
                    minHeight: '100%'
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
            min={0.5} 
            max={3} 
            step={0.1} 
            onValueChange={(val) => setZoom(val[0])}
            className="w-full"
        />
        <p className="text-[10px] text-[#706B67] text-center mt-1">
            Drag to reposition. Zoom out to fit full photo.
        </p>
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
            <img 
                src={typeof photo === 'string' ? photo : URL.createObjectURL(photo)} 
                alt={`User upload ${index}`} 
                className="w-full h-full object-cover object-center" 
            />
             <div className="absolute top-1 right-1 bg-white/80 p-1.5 rounded-full cursor-pointer hover:bg-white hover:text-red-500 z-10 shadow-sm transition-colors" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
                <Trash2 className="w-4 h-4" />
            </div>
            {isMain && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] py-1 font-bold">
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

  // Determine user status (Default to Free for onboarding unless specified)
  const isPremium = formData.isPremium === true;
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

  const handleCropComplete = (croppedBase64) => {
      const newPhotos = [...currentPhotos];
      // If we are replacing or adding at a specific index
      // If it's a new photo at the end of the array (or a sparse slot fill)
      newPhotos[pendingIndex] = croppedBase64;
      
      // Filter out empty slots if any to keep array clean, but we used indexed assignment above
      // Let's just update photos. We need to make sure we don't have holes if that matters.
      // But indexed assignment is fine as long as we map correctly.
      
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
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
           {/* Render slots based on MAX_PREMIUM_PHOTOS (12) to show total capacity */}
           {[...Array(MAX_PREMIUM_PHOTOS)].map((_, i) => {
               // Index 0 is Main
               const isMain = i === 0;
               const isLocked = i >= maxPhotos; // 0,1,2,3 are free (4 total). 4+ (5th slot) are locked.
               
               // Show slot if:
               // 1. It has a photo
               // 2. It is the next available empty slot AND not locked
               // 3. It is locked (show lock icon)
               // 4. Always show at least first 4 slots for layout
               
               const hasPhoto = !!currentPhotos[i];
               const isNextEmpty = i === currentPhotos.length;
               
               // We render all slots up to max limit for layout consistency, 
               // but hide empty slots that are far ahead unless they are locked or "next"
               
               // Simplify: Render all 12. 
               // If locked -> Lock UI.
               // If free and empty -> Upload UI (if previous are full or it's one of the initial 4).
               
               const shouldRender = isLocked || hasPhoto || i < 4 || isNextEmpty;
               
               if (!shouldRender) return null;

               return (
                   <PhotoUploadBox 
                        key={i}
                        index={i}
                        isMain={isMain}
                        isLocked={isLocked}
                        photo={currentPhotos[i]}
                        onUpload={(file) => handleFileSelect(file, i)}
                        onRemove={() => handleRemovePhoto(i)}
                   />
               )
           })}
        </div>
        
        <div className="bg-[#EAF2F7] p-6 rounded-xl border border-[#E6DCD2] mt-8">
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
                    Your photos are private and only visible to users you are matched with. We never sell or publicly display private profile photos.
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