import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, X, Camera, Loader2, ZoomIn, ZoomOut, RotateCcw, Upload, FolderInput } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { compressImageToFile } from '@/lib/imageCompression';
import { toast } from 'sonner';

export interface JobPhoto {
  id: string;
  photo_url: string;
  photo_type: 'before' | 'after' | 'other';
  caption: string | null;
  created_at: string;
}

interface JobPhotoGalleryProps {
  photos: JobPhoto[];
  onUpload?: (file: File, photoType: 'before' | 'after' | 'other') => Promise<void>;
  onDelete?: (photoId: string) => Promise<void>;
  onUpdateType?: (photoId: string, photoType: 'before' | 'after' | 'other') => void;
  isUploading?: boolean;
  editable?: boolean;
  className?: string;
}

export function JobPhotoGallery({ 
  photos, 
  onUpload,
  onDelete,
  onUpdateType,
  isUploading = false,
  editable = true,
  className 
}: JobPhotoGalleryProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<JobPhoto | null>(null);
  const [selectedPhotoType, setSelectedPhotoType] = useState<'before' | 'after' | 'other'>('other');
  const [changeCategoryOpen, setChangeCategoryOpen] = useState(false);
  const [photoToChangeCategory, setPhotoToChangeCategory] = useState<JobPhoto | null>(null);
  const [newCategory, setNewCategory] = useState<'before' | 'after' | 'other'>('other');
  const [draggedPhoto, setDraggedPhoto] = useState<JobPhoto | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<'before' | 'after' | 'other' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadSignedUrls() {
      if (photos.length === 0) {
        setLoadingUrls(false);
        return;
      }

      const urls: Record<string, string> = {};
      
      await Promise.all(
        photos.map(async (photo) => {
          if (photo.photo_url.startsWith('http')) {
            urls[photo.id] = photo.photo_url;
            return;
          }
          
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

  const beforePhotos = photos.filter(p => p.photo_type === 'before');
  const afterPhotos = photos.filter(p => p.photo_type === 'after');
  const otherPhotos = photos.filter(p => p.photo_type === 'other');

  const allCategories = [
    { type: 'before', label: 'Before', photos: beforePhotos, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
    { type: 'after', label: 'After', photos: afterPhotos, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    { type: 'other', label: 'Other', photos: otherPhotos, color: 'bg-muted text-muted-foreground' },
  ];

  const photosByType = draggedPhoto 
    ? allCategories 
    : allCategories.filter(g => g.photos.length > 0);

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

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) setPanPosition({ x: 0, y: 0 });
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
      setPanPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      try {
        setIsProcessing(true);
        // Compress image before upload (300kb max, supports HEIF/HEIC)
        const compressedFile = await compressImageToFile(file, 300);
        setIsProcessing(false);
        await onUpload(compressedFile, selectedPhotoType);
      } catch (error) {
        console.error('Failed to compress image:', error);
        toast.error('Failed to process image. Please try a different file.');
        setIsProcessing(false);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (photoToDelete && onDelete) {
      await onDelete(photoToDelete.id);
    }
    setDeleteConfirmOpen(false);
    setPhotoToDelete(null);
  };

  const handleCategoryDragOver = (e: React.DragEvent, category: 'before' | 'after' | 'other') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCategory(category);
  };

  const handleDragLeave = () => {
    setDragOverCategory(null);
  };

  const handleCategoryDrop = (e: React.DragEvent, targetCategory: 'before' | 'after' | 'other') => {
    e.preventDefault();
    setDragOverCategory(null);
    
    if (!draggedPhoto) return;

    if (draggedPhoto.photo_type !== targetCategory && onUpdateType) {
      onUpdateType(draggedPhoto.id, targetCategory);
    }

    setDraggedPhoto(null);
  };

  const handleDragEnd = () => {
    setDraggedPhoto(null);
    setDragOverCategory(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'ArrowRight') goToNext();
      else if (e.key === 'ArrowLeft') goToPrev();
      else if (e.key === 'Escape') closeLightbox();
      else if (e.key === '+' || e.key === '=') handleZoomIn();
      else if (e.key === '-') handleZoomOut();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, goToNext, goToPrev]);

  if (loadingUrls) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading photos...</span>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Upload Section */}
      {editable && onUpload && (
        <div className="mb-4 p-4 border-2 border-dashed rounded-lg">
          <div className="flex flex-row items-center gap-3">
            <Select value={selectedPhotoType} onValueChange={(v) => setSelectedPhotoType(v as 'before' | 'after' | 'other')}>
              <SelectTrigger className="w-28 sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before</SelectItem>
                <SelectItem value="after">After</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              onClick={() => cameraInputRef.current?.click()}
              disabled={isUploading || isProcessing}
              className="sm:hidden"
              title="Take Photo"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isProcessing}
              className="flex-1 sm:flex-none sm:w-auto"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Preparing...
                </>
              ) : isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Photos Display */}
      {photos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No photos yet</p>
          {editable && onUpload && (
            <p className="text-xs mt-1">Upload photos using the button above</p>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Photos ({photos.length})</span>
            </div>
            {editable && onUpdateType && (
              <span className="text-xs text-muted-foreground">Drag to move between categories</span>
            )}
          </div>

          <div className="space-y-4">
            {photosByType.map((group) => (
              <div 
                key={group.type}
                onDragOver={(e) => handleCategoryDragOver(e, group.type as 'before' | 'after' | 'other')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleCategoryDrop(e, group.type as 'before' | 'after' | 'other')}
              >
                <Badge 
                  className={`mb-2 ${group.color} ${draggedPhoto && dragOverCategory === group.type && draggedPhoto.photo_type !== group.type ? 'ring-2 ring-primary ring-offset-2' : ''}`} 
                  variant="secondary"
                >
                  {group.label} ({group.photos.length})
                </Badge>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {group.photos.map((photo) => (
                    <div 
                      key={photo.id} 
                      className={`relative group ${draggedPhoto?.id === photo.id ? 'opacity-50' : ''}`}
                      draggable={editable && !!onUpdateType}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggedPhoto(photo);
                      }}
                      onDragEnd={handleDragEnd}
                    >
                      {editable && onUpdateType && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoToChangeCategory(photo);
                            setNewCategory(photo.photo_type);
                            setChangeCategoryOpen(true);
                          }}
                          className="absolute bottom-1 left-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-primary/80 rounded p-1 hover:bg-primary"
                          title="Change category"
                        >
                          <FolderInput className="w-4 h-4 text-white" />
                        </button>
                      )}
                      {editable && onDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoToDelete(photo);
                            setDeleteConfirmOpen(true);
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
                  {group.photos.length === 0 && draggedPhoto && draggedPhoto.photo_type !== group.type && (
                    <div 
                      className={`aspect-square rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground ${
                        dragOverCategory === group.type ? 'border-primary bg-primary/10' : 'border-muted-foreground/30'
                      }`}
                    >
                      <span className="text-xs">Drop here</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Lightbox */}
      <Dialog open={lightboxIndex !== null} onOpenChange={() => closeLightbox()}>
        <DialogContent className="max-w-[100vw] sm:max-w-4xl h-[100dvh] sm:h-auto p-0 bg-black/95 border-none">
          {lightboxIndex !== null && allPhotosFlat[lightboxIndex] && (
            <div className="relative h-full">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-20 text-white hover:bg-white/20"
                onClick={closeLightbox}
              >
                <X className="w-5 h-5" />
              </Button>

              <div className="absolute top-2 left-2 z-20 flex gap-1">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={handleZoomIn} disabled={zoomLevel >= 4}>
                  <ZoomIn className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={handleZoomOut} disabled={zoomLevel <= 1}>
                  <ZoomOut className="w-5 h-5" />
                </Button>
                {zoomLevel > 1 && (
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={resetZoom}>
                    <RotateCcw className="w-5 h-5" />
                  </Button>
                )}
                <span className="text-white text-sm flex items-center px-2">{Math.round(zoomLevel * 100)}%</span>
              </div>

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

              <div 
                className="flex items-center justify-center min-h-[50vh] max-h-[80vh] h-full overflow-hidden cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  src={signedUrls[allPhotosFlat[lightboxIndex].id]}
                  alt={allPhotosFlat[lightboxIndex].caption || 'Photo'}
                  className="max-w-full max-h-full object-contain select-none"
                  style={{
                    transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                    transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                  }}
                  draggable={false}
                />
              </div>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 bg-black/50 rounded-full px-3 py-1">
                <span className="text-white text-sm">
                  {lightboxIndex + 1} / {allPhotosFlat.length}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this photo? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Category Dialog */}
      <AlertDialog open={changeCategoryOpen} onOpenChange={setChangeCategoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Photo Category</AlertDialogTitle>
            <AlertDialogDescription>
              Select a new category for this photo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={newCategory} onValueChange={(v) => setNewCategory(v as 'before' | 'after' | 'other')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before</SelectItem>
                <SelectItem value="after">After</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (photoToChangeCategory && onUpdateType) {
                onUpdateType(photoToChangeCategory.id, newCategory);
              }
              setChangeCategoryOpen(false);
              setPhotoToChangeCategory(null);
            }}>
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}