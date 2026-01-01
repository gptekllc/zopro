import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Camera, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface JobPhoto {
  id: string;
  photo_url: string;
  photo_type: 'before' | 'after' | 'other';
  caption: string | null;
  created_at: string;
}

interface PhotoGalleryProps {
  photos: JobPhoto[];
  className?: string;
}

export function PhotoGallery({ photos, className }: PhotoGalleryProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    async function loadSignedUrls() {
      if (photos.length === 0) {
        setLoadingUrls(false);
        return;
      }

      const urls: Record<string, string> = {};
      
      await Promise.all(
        photos.map(async (photo) => {
          // Extract the path from the photo_url (remove bucket prefix if present)
          const path = photo.photo_url.replace(/^job-photos\//, '');
          
          const { data } = await supabase.storage
            .from('job-photos')
            .createSignedUrl(path, 3600); // 1 hour expiry
          
          if (data?.signedUrl) {
            urls[photo.id] = data.signedUrl;
          }
        })
      );

      setSignedUrls(urls);
      setLoadingUrls(false);
    }

    loadSignedUrls();
  }, [photos]);

  const beforePhotos = photos.filter(p => p.photo_type === 'before');
  const afterPhotos = photos.filter(p => p.photo_type === 'after');
  const otherPhotos = photos.filter(p => p.photo_type === 'other');

  const photosByType = [
    { type: 'before', label: 'Before', photos: beforePhotos, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
    { type: 'after', label: 'After', photos: afterPhotos, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    { type: 'other', label: 'Other', photos: otherPhotos, color: 'bg-muted text-muted-foreground' },
  ].filter(g => g.photos.length > 0);

  const allPhotosFlat = [...beforePhotos, ...afterPhotos, ...otherPhotos];

  const openLightbox = (photo: JobPhoto) => {
    const index = allPhotosFlat.findIndex(p => p.id === photo.id);
    setLightboxIndex(index);
    resetZoom();
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    resetZoom();
  };

  const goToNext = useCallback(() => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex + 1) % allPhotosFlat.length);
      resetZoom();
    }
  }, [lightboxIndex, allPhotosFlat.length]);

  const goToPrev = useCallback(() => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex - 1 + allPhotosFlat.length) % allPhotosFlat.length);
      resetZoom();
    }
  }, [lightboxIndex, allPhotosFlat.length]);

  const resetZoom = () => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) {
        setPanPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomLevel > 1 && e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ 
        x: e.touches[0].clientX - panPosition.x, 
        y: e.touches[0].clientY - panPosition.y 
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && zoomLevel > 1 && e.touches.length === 1) {
      setPanPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      
      if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, goToNext, goToPrev]);

  if (photos.length === 0) {
    return null;
  }

  if (loadingUrls) {
    return (
      <div className={`flex items-center justify-center py-4 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading photos...</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        <Camera className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium text-sm">Photos ({photos.length})</span>
      </div>

      <div className="space-y-4">
        {photosByType.map((group) => (
          <div key={group.type}>
            <Badge className={`mb-2 ${group.color}`} variant="secondary">
              {group.label} ({group.photos.length})
            </Badge>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {group.photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => openLightbox(photo)}
                  className="relative aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {signedUrls[photo.id] ? (
                    <img
                      src={signedUrls[photo.id]}
                      alt={photo.caption || `${photo.photo_type} photo`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox with Zoom */}
      <Dialog open={lightboxIndex !== null} onOpenChange={() => closeLightbox()}>
        <DialogContent className="max-w-[100vw] sm:max-w-4xl h-[100dvh] sm:h-auto p-0 bg-black/95 border-none">
          {lightboxIndex !== null && allPhotosFlat[lightboxIndex] && (
            <div className="relative h-full">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-20 text-white hover:bg-white/20"
                onClick={closeLightbox}
              >
                <X className="w-5 h-5" />
              </Button>

              {/* Zoom controls */}
              <div className="absolute top-2 left-2 z-20 flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 4}
                >
                  <ZoomIn className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 1}
                >
                  <ZoomOut className="w-5 h-5" />
                </Button>
                {zoomLevel > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={resetZoom}
                  >
                    <RotateCcw className="w-5 h-5" />
                  </Button>
                )}
                <span className="text-white text-sm flex items-center px-2">
                  {Math.round(zoomLevel * 100)}%
                </span>
              </div>

              {/* Navigation arrows */}
              {allPhotosFlat.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 text-white hover:bg-white/20 h-12 w-12"
                    onClick={goToPrev}
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 text-white hover:bg-white/20 h-12 w-12"
                    onClick={goToNext}
                  >
                    <ChevronRight className="w-8 h-8" />
                  </Button>
                </>
              )}

              {/* Image container */}
              <div 
                className="flex items-center justify-center min-h-[50vh] max-h-[80vh] sm:max-h-[80vh] h-full overflow-hidden cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {signedUrls[allPhotosFlat[lightboxIndex].id] ? (
                  <img
                    src={signedUrls[allPhotosFlat[lightboxIndex].id]}
                    alt={allPhotosFlat[lightboxIndex].caption || 'Photo'}
                    className="max-w-full max-h-[80vh] object-contain transition-transform duration-200 select-none"
                    style={{
                      transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                    }}
                    draggable={false}
                  />
                ) : (
                  <div className="text-white text-center">
                    <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Unable to load photo</p>
                  </div>
                )}
              </div>

              {/* Bottom info bar */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <Badge className={
                      allPhotosFlat[lightboxIndex].photo_type === 'before' 
                        ? 'bg-orange-500' 
                        : allPhotosFlat[lightboxIndex].photo_type === 'after'
                        ? 'bg-green-500'
                        : 'bg-gray-500'
                    }>
                      {allPhotosFlat[lightboxIndex].photo_type}
                    </Badge>
                    {allPhotosFlat[lightboxIndex].caption && (
                      <p className="mt-1 text-sm">{allPhotosFlat[lightboxIndex].caption}</p>
                    )}
                    <p className="text-xs text-white/70 mt-1">
                      {format(new Date(allPhotosFlat[lightboxIndex].created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm text-white/70">
                      {lightboxIndex + 1} / {allPhotosFlat.length}
                    </span>
                    <span className="text-xs text-white/50">
                      Use ←/→ keys or swipe
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
