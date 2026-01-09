import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Slider } from '@/components/ui/slider';
import { Camera, Loader2, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { extractStoragePath } from '@/components/company/LogoUpload';

interface AvatarUploadProps {
  entityId: string;
  currentAvatarUrl: string | null;
  name: string;
  onUploadSuccess: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

const AvatarUpload = ({ entityId, currentAvatarUrl, name, onUploadSuccess, size = 'lg' }: AvatarUploadProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
  };

  const buttonSizeClasses = {
    sm: 'h-6 w-6 -bottom-0.5 -right-0.5',
    md: 'h-7 w-7 -bottom-1 -right-1',
    lg: 'h-8 w-8 -bottom-1 -right-1',
  };

  const iconSizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

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

  // Touch support
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleTouchEnd = () => {
    setIsDragging(false);
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

      const outputSize = 400;
      canvas.width = outputSize;
      canvas.height = outputSize;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outputSize, outputSize);

      const img = imageRef.current;
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const containerSize = containerRect.width;

      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;

      const displayedWidth = naturalWidth * zoom;
      const displayedHeight = naturalHeight * zoom;

      const imgCenterX = containerSize / 2 + position.x;
      const imgCenterY = containerSize / 2 + position.y;

      const imgLeft = imgCenterX - displayedWidth / 2;
      const imgTop = imgCenterY - displayedHeight / 2;

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

      const compressImage = (quality: number): Promise<Blob> => {
        return new Promise((res) => {
          canvas.toBlob((blob) => res(blob!), 'image/jpeg', quality);
        });
      };

      const findOptimalQuality = async () => {
        let minQuality = 0.1;
        let maxQuality = 0.95;
        let targetBlob: Blob | null = null;

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

        resolve(targetBlob!);
      };

      findOptimalQuality();
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      // Delete old avatar from storage if it exists
      const oldPath = extractStoragePath(currentAvatarUrl, 'company-logos');
      if (oldPath) {
        await supabase.storage.from('company-logos').remove([oldPath]);
      }

      const croppedBlob = await cropAndCompress();
      const fileName = `avatars/${entityId}-${Date.now()}.jpg`;

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

      onUploadSuccess(publicUrl);
      toast.success('Photo updated successfully');
      setIsDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      <div className="relative">
        <Avatar className={sizeClasses[size]}>
          <AvatarImage src={currentAvatarUrl || undefined} alt={name} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={`absolute rounded-full ${buttonSizeClasses[size]}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className={iconSizeClasses[size]} />
        </Button>
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
            <DialogTitle>Crop Photo</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div
              ref={containerRef}
              className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden cursor-move border-2 border-dashed border-border"
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
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 border-4 border-primary/50 rounded-full" />
              </div>
            </div>

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
              Drag to position, use slider to zoom. Image will be compressed to 50-70 KB.
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
                  'Save Photo'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AvatarUpload;
