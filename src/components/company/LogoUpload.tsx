import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Slider } from '@/components/ui/slider';
import { Camera, Loader2, Upload, ZoomIn, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Helper to extract storage path from Supabase public URL
export const extractStoragePath = (url: string | null, bucket: string): string | null => {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.substring(index + marker.length);
};

interface LogoUploadProps {
  companyId: string;
  currentLogoUrl: string | null;
  companyName: string;
  onUploadSuccess: (url: string) => void;
  showRemoveButton?: boolean;
}

const LogoUpload = ({ companyId, currentLogoUrl, companyName, onUploadSuccess, showRemoveButton = true }: LogoUploadProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Pinch-to-zoom state
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState(1);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setIsDialogOpen(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Calculate distance between two touch points
  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Touch support with pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch gesture start
      e.preventDefault();
      const distance = getTouchDistance(e.touches);
      setInitialPinchDistance(distance);
      setInitialZoom(zoom);
    } else if (e.touches.length === 1) {
      // Single finger drag
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance !== null) {
      // Pinch-to-zoom
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      const scale = currentDistance / initialPinchDistance;
      const newZoom = Math.min(Math.max(initialZoom * scale, 0.1), 3);
      setZoom(newZoom);
    } else if (e.touches.length === 1 && isDragging) {
      // Single finger drag
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, initialPinchDistance, initialZoom]);

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setInitialPinchDistance(null);
    }
    if (e.touches.length === 0) {
      setIsDragging(false);
    }
  };

  const cropAndCompress = async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!imageRef.current || !containerRef.current) {
        reject(new Error('Image not loaded'));
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const outputSize = 400; // Output 400x400 for good quality
      canvas.width = outputSize;
      canvas.height = outputSize;

      // Fill with white background (prevents black areas)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outputSize, outputSize);

      const img = imageRef.current;
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const containerSize = containerRect.width; // Container is square (aspect-square)

      // Get the natural dimensions of the image
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;

      // The image is displayed with:
      // - left: 50%, top: 50% positions image's top-left at container center
      // - transform: translate(-50%, -50%) moves image so its center is at container center
      // - translate(position.x, position.y) applies user drag offset
      // - scale(zoom) scales from the center
      
      const displayedWidth = naturalWidth * zoom;
      const displayedHeight = naturalHeight * zoom;

      // After all transforms, the image center is at:
      // Container center (containerSize/2, containerSize/2) + position offset
      const imgCenterX = containerSize / 2 + position.x;
      const imgCenterY = containerSize / 2 + position.y;

      // The top-left of the displayed (scaled) image
      const imgLeft = imgCenterX - displayedWidth / 2;
      const imgTop = imgCenterY - displayedHeight / 2;

      // The visible crop area is the container (0,0 to containerSize,containerSize)
      // Convert to source image coordinates (before zoom)
      // Source coordinates = (container coord - imgLeft) / zoom
      const sourceX = (0 - imgLeft) / zoom;
      const sourceY = (0 - imgTop) / zoom;
      const sourceWidth = containerSize / zoom;
      const sourceHeight = containerSize / zoom;

      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outputSize,
        outputSize
      );

      // Compress to target size (50-70kb)
      const compressImage = (quality: number): Promise<Blob> => {
        return new Promise((res) => {
          canvas.toBlob((blob) => res(blob!), 'image/jpeg', quality);
        });
      };

      const findOptimalQuality = async () => {
        let minQuality = 0.1;
        let maxQuality = 0.95;
        let targetBlob: Blob | null = null;

        // Binary search for optimal quality
        for (let i = 0; i < 8; i++) {
          const midQuality = (minQuality + maxQuality) / 2;
          const blob = await compressImage(midQuality);
          const sizeKB = blob.size / 1024;

          if (sizeKB >= 50 && sizeKB <= 70) {
            resolve(blob);
            return;
          } else if (sizeKB > 70) {
            maxQuality = midQuality;
          } else {
            minQuality = midQuality;
          }
          targetBlob = blob;
        }

        // If we couldn't hit the exact range, return closest result
        resolve(targetBlob!);
      };

      findOptimalQuality();
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      // Delete old logo from storage if it exists
      const oldPath = extractStoragePath(currentLogoUrl, 'company-logos');
      if (oldPath) {
        await supabase.storage.from('company-logos').remove([oldPath]);
      }

      const croppedBlob = await cropAndCompress();
      const fileName = `${companyId}/logo-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, croppedBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      // Update company record
      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: publicUrl })
        .eq('id', companyId);

      if (updateError) throw updateError;

      onUploadSuccess(publicUrl);
      toast.success('Logo uploaded successfully');
      setIsDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentLogoUrl) return;

    setIsRemoving(true);
    try {
      // Delete from storage
      const oldPath = extractStoragePath(currentLogoUrl, 'company-logos');
      if (oldPath) {
        await supabase.storage.from('company-logos').remove([oldPath]);
      }

      // Update company record to remove logo
      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: null })
        .eq('id', companyId);

      if (updateError) throw updateError;

      onUploadSuccess('');
      toast.success('Logo removed successfully');
    } catch (error: any) {
      console.error('Remove error:', error);
      toast.error(error.message || 'Failed to remove logo');
    } finally {
      setIsRemoving(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="relative group">
          <Avatar className="w-20 h-20 border-2 border-border">
            {currentLogoUrl ? (
              <AvatarImage src={currentLogoUrl} alt={companyName} />
            ) : null}
            <AvatarFallback className="text-xl bg-primary/10 text-primary">
              {getInitials(companyName)}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Camera className="w-6 h-6 text-white" />
          </button>
        </div>
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Logo
          </Button>
          {showRemoveButton && currentLogoUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full justify-start"
              onClick={handleRemoveLogo}
              disabled={isRemoving}
            >
              {isRemoving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Remove Logo
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Recommended: Square image, will be cropped to 1:1
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crop Logo</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Crop area with touch support */}
            <div
              ref={containerRef}
              className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden cursor-move border-2 border-dashed border-border touch-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {previewUrl && (
                <img
                  ref={imageRef}
                  src={previewUrl}
                  alt="Preview"
                  className="absolute select-none pointer-events-none"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                    transformOrigin: 'center',
                    maxWidth: 'none',
                    maxHeight: 'none',
                  }}
                  draggable={false}
                />
              )}
              {/* Crop overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 border-4 border-primary/50 rounded-full" />
              </div>
            </div>

            {/* Zoom control */}
            <div className="flex items-center gap-3">
              <ZoomIn className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={[zoom]}
                onValueChange={([val]) => setZoom(val)}
                min={0.1}
                max={3}
                step={0.1}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground w-12">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Drag to position, use slider or pinch to zoom. Image will be compressed to 50-70 KB.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsDialogOpen(false);
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Save Logo'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LogoUpload;