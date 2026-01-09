import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Slider } from '@/components/ui/slider';
import { Camera, Loader2, Upload, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface LogoUploadProps {
  companyId: string;
  currentLogoUrl: string | null;
  companyName: string;
  onUploadSuccess: (url: string) => void;
}

const LogoUpload = ({ companyId, currentLogoUrl, companyName, onUploadSuccess }: LogoUploadProps) => {
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

      // The image is displayed at its natural size * zoom, centered in the container
      const displayedWidth = naturalWidth * zoom;
      const displayedHeight = naturalHeight * zoom;

      // The center of the image in the container (before position offset)
      // Image is centered via CSS: left: 50%, top: 50%, marginLeft: -50%, marginTop: -50%
      // This means the image's center is at the container's center initially
      
      // Calculate where the top-left of the image is in container coordinates
      const imgLeft = (containerSize - displayedWidth) / 2 + position.x;
      const imgTop = (containerSize - displayedHeight) / 2 + position.y;

      // The visible crop area is the container itself (0,0 to containerSize,containerSize)
      // We need to find what part of the original image corresponds to this area

      // Convert container coordinates to image natural coordinates
      const scaleRatio = 1 / zoom;
      
      // Source rectangle in natural image coordinates
      const sourceX = -imgLeft * scaleRatio;
      const sourceY = -imgTop * scaleRatio;
      const sourceWidth = containerSize * scaleRatio;
      const sourceHeight = containerSize * scaleRatio;

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
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Logo
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
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
            {/* Crop area */}
            <div
              ref={containerRef}
              className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden cursor-move border-2 border-dashed border-border"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {previewUrl && (
                <img
                  ref={imageRef}
                  src={previewUrl}
                  alt="Preview"
                  className="absolute select-none pointer-events-none"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                    transformOrigin: 'center',
                    left: '50%',
                    top: '50%',
                    marginLeft: '-50%',
                    marginTop: '-50%',
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