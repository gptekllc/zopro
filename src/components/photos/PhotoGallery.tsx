import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Camera, Loader2, ZoomIn, ZoomOut, RotateCcw, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

export interface JobPhoto {
  id: string;
  photo_url: string;
  photo_type: 'before' | 'after' | 'other';
  caption: string | null;
  created_at: string;
  display_order?: number;
}

interface PhotoGalleryProps {
  photos: JobPhoto[];
  className?: string;
  onReorder?: (photos: JobPhoto[]) => void;
  onDelete?: (photoId: string) => void;
  editable?: boolean;
  deletable?: boolean;
}

export function PhotoGallery({ photos, className, onReorder, onDelete, editable = true, deletable = false }: PhotoGalleryProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Drag and drop state
  const [draggedPhoto, setDraggedPhoto] = useState<JobPhoto | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [orderedPhotos, setOrderedPhotos] = useState<JobPhoto[]>([]);

  // Sort photos by display_order when photos prop changes
  useEffect(() => {
    const sorted = [...photos].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    setOrderedPhotos(sorted);
  }, [photos]);

  useEffect(() => {
    async function loadSignedUrls() {
      if (photos.length === 0) {
        setLoadingUrls(false);
        return;
      }

      const urls: Record<string, string> = {};
      
      await Promise.all(
        photos.map(async (photo) => {
          // Check if photo_url is already a signed URL or full URL
          if (photo.photo_url.startsWith('http')) {
            urls[photo.id] = photo.photo_url;
            return;
          }
          
          // photo_url is a storage path - get signed URL
          const { data } = await supabase.storage
            .from('job-photos')
            .createSignedUrl(photo.photo_url, 3600);
          
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

  const beforePhotos = orderedPhotos.filter(p => p.photo_type === 'before');
  const afterPhotos = orderedPhotos.filter(p => p.photo_type === 'after');
  const otherPhotos = orderedPhotos.filter(p => p.photo_type === 'other');

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

  // Drag and drop handlers for reordering
  const handleDragStart = (e: React.DragEvent, photo: JobPhoto, groupPhotos: JobPhoto[]) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedPhoto(photo);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetPhoto: JobPhoto, groupPhotos: JobPhoto[]) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    if (!draggedPhoto || draggedPhoto.id === targetPhoto.id) {
      setDraggedPhoto(null);
      return;
    }

    // Only allow reordering within the same photo type
    if (draggedPhoto.photo_type !== targetPhoto.photo_type) {
      toast.error('Can only reorder within the same category');
      setDraggedPhoto(null);
      return;
    }

    const fromIndex = groupPhotos.findIndex(p => p.id === draggedPhoto.id);
    const toIndex = groupPhotos.findIndex(p => p.id === targetPhoto.id);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedPhoto(null);
      return;
    }

    // Create new order for this group
    const newGroupOrder = [...groupPhotos];
    const [movedPhoto] = newGroupOrder.splice(fromIndex, 1);
    newGroupOrder.splice(toIndex, 0, movedPhoto);

    // Update display_order for all photos in this group
    const updates = newGroupOrder.map((photo, idx) => ({
      id: photo.id,
      display_order: idx,
    }));

    try {
      // Update in database
      await Promise.all(
        updates.map(update =>
          supabase
            .from('job_photos')
            .update({ display_order: update.display_order })
            .eq('id', update.id)
        )
      );

      // Update local state
      const updatedPhotos = orderedPhotos.map(photo => {
        const update = updates.find(u => u.id === photo.id);
        return update ? { ...photo, display_order: update.display_order } : photo;
      });

      setOrderedPhotos(updatedPhotos.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)));
      
      if (onReorder) {
        onReorder(updatedPhotos);
      }
      
      toast.success('Photos reordered');
    } catch (error) {
      console.error('Failed to reorder photos:', error);
      toast.error('Failed to reorder photos');
    }

    setDraggedPhoto(null);
  };

  const handleDragEnd = () => {
    setDraggedPhoto(null);
    setDragOverIndex(null);
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Photos ({photos.length})</span>
        </div>
        {editable && photos.length > 1 && (
          <span className="text-xs text-muted-foreground">Drag to reorder</span>
        )}
      </div>

      <div className="space-y-4">
        {photosByType.map((group) => (
          <div key={group.type}>
            <Badge className={`mb-2 ${group.color}`} variant="secondary">
              {group.label} ({group.photos.length})
            </Badge>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {group.photos.map((photo, index) => (
                <div
                  key={photo.id}
                  draggable={editable && group.photos.length > 1}
                  onDragStart={(e) => handleDragStart(e, photo, group.photos)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, photo, group.photos)}
                  onDragEnd={handleDragEnd}
                  className={`relative group ${
                    draggedPhoto?.id === photo.id ? 'opacity-50' : ''
                  } ${
                    dragOverIndex === index && draggedPhoto?.photo_type === photo.photo_type && draggedPhoto?.id !== photo.id
                      ? 'ring-2 ring-primary ring-offset-2'
                      : ''
                  }`}
                >
                  {editable && group.photos.length > 1 && (
                    <div className="absolute top-1 left-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                      <div className="bg-black/50 rounded p-0.5">
                        <GripVertical className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                  {deletable && onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(photo.id);
                      }}
                      className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive rounded p-1 hover:bg-destructive/90"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  )}
                  <button
                    onClick={() => openLightbox(photo)}
                    className="w-full relative aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {signedUrls[photo.id] ? (
                      <img
                        src={signedUrls[photo.id]}
                        alt={photo.caption || `${photo.photo_type} photo`}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </button>
                </div>
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
