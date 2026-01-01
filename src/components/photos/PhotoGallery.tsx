import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Camera, Loader2 } from 'lucide-react';
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

  if (photos.length === 0) {
    return null;
  }

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
  };

  const closeLightbox = () => setLightboxIndex(null);

  const goToNext = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex + 1) % allPhotosFlat.length);
    }
  };

  const goToPrev = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex - 1 + allPhotosFlat.length) % allPhotosFlat.length);
    }
  };

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

      {/* Lightbox */}
      <Dialog open={lightboxIndex !== null} onOpenChange={() => closeLightbox()}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          {lightboxIndex !== null && allPhotosFlat[lightboxIndex] && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
                onClick={closeLightbox}
              >
                <X className="w-5 h-5" />
              </Button>

              {allPhotosFlat.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                    onClick={goToPrev}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                    onClick={goToNext}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </Button>
                </>
              )}

              <div className="flex items-center justify-center min-h-[50vh] max-h-[80vh]">
                {signedUrls[allPhotosFlat[lightboxIndex].id] ? (
                  <img
                    src={signedUrls[allPhotosFlat[lightboxIndex].id]}
                    alt={allPhotosFlat[lightboxIndex].caption || 'Photo'}
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                ) : (
                  <div className="text-white text-center">
                    <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Unable to load photo</p>
                  </div>
                )}
              </div>

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
                  <span className="text-sm text-white/70">
                    {lightboxIndex + 1} / {allPhotosFlat.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
