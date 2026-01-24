import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, X, Camera, Loader2, ZoomIn, ZoomOut, RotateCcw, Upload, FolderInput } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { compressImageToFile } from '@/lib/imageCompression';

export interface DocumentPhoto {
  id: string;
  photo_url: string;
  photo_type: 'before' | 'after' | 'other';
  caption: string | null;
  created_at: string;
  display_order?: number;
}

interface DocumentPhotoGalleryProps {
  photos: DocumentPhoto[];
  bucketName: 'quote-photos' | 'invoice-photos';
  documentId: string;
  onUpload?: (file: File, photoType: 'before' | 'after' | 'other') => Promise<void>;
  onDelete?: (photoId: string, photoUrl: string) => Promise<void>;
  onUpdateType?: (photoId: string, photoType: 'before' | 'after' | 'other') => void;
  isUploading?: boolean;
  editable?: boolean;
  className?: string;
}

export function DocumentPhotoGallery({ 
  photos, 
  bucketName,
  documentId,
  onUpload,
  onDelete,
  onUpdateType,
  isUploading = false,
  editable = true,
  className 
}: DocumentPhotoGalleryProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<DocumentPhoto | null>(null);
  const [selectedPhotoType, setSelectedPhotoType] = useState<'before' | 'after' | 'other'>('other');
  const [changeCategoryOpen, setChangeCategoryOpen] = useState(false);
  const [photoToChangeCategory, setPhotoToChangeCategory] = useState<DocumentPhoto | null>(null);
  const [newCategory, setNewCategory] = useState<'before' | 'after' | 'other'>('other');
  const [draggedPhoto, setDraggedPhoto] = useState<DocumentPhoto | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<'before' | 'after' | 'other' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Sort photos by display_order
  const orderedPhotos = [...photos].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  // Cache signed URLs - only fetch for photos that don't have URLs yet
  useEffect(() => {
    async function loadSignedUrls() {
      if (photos.length === 0) {
        setLoadingUrls(false);
        return;
      }

      // Preserve existing signed URLs
      const urls: Record<string, string> = { ...signedUrls };
      
      // Filter to photos that need signed URLs
      const photosNeedingUrls = photos.filter(photo => 
        !urls[photo.id] && !photo.photo_url.startsWith('http')
      );
      
      // Also check for photos with existing http URLs (already signed)
      photos.forEach(photo => {
        if (photo.photo_url.startsWith('http') && !urls[photo.id]) {
          urls[photo.id] = photo.photo_url;
        }
      });
      
      if (photosNeedingUrls.length === 0) {
        setSignedUrls(urls);
        setLoadingUrls(false);
        return;
      }
      
      await Promise.all(
        photosNeedingUrls.map(async (photo) => {
          const { data } = await supabase.storage
            .from(bucketName)
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
  }, [photos, bucketName]);

  const beforePhotos = orderedPhotos.filter(p => p.photo_type === 'before');
  const afterPhotos = orderedPhotos.filter(p => p.photo_type === 'after');
  const otherPhotos = orderedPhotos.filter(p => p.photo_type === 'other');

  const allCategories = [
    { type: 'before', label: 'Before', photos: beforePhotos, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
    { type: 'after', label: 'After', photos: afterPhotos, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    { type: 'other', label: 'Other', photos: otherPhotos, color: 'bg-muted text-muted-foreground' },
  ];

  // Show only non-empty categories, but show all when dragging to allow dropping in empty categories
  const photosByType = draggedPhoto 
    ? allCategories 
    : allCategories.filter(g => g.photos.length > 0);

  const allPhotosFlat = [...beforePhotos, ...afterPhotos, ...otherPhotos];

  const openLightbox = (photo: DocumentPhoto) => {
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

  // Process files for upload (shared by file input and drag-drop)
  const processFilesForUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0 || !onUpload) return;

    const fileArray = Array.from(files);
    // Filter to only image files
    const imageFiles = fileArray.filter(file => 
      file.type.startsWith('image/') || 
      file.name.toLowerCase().endsWith('.heic') || 
      file.name.toLowerCase().endsWith('.heif')
    );

    if (imageFiles.length === 0) {
      toast.error('Please select image files only');
      return;
    }

    if (imageFiles.length < fileArray.length) {
      toast.warning(`${fileArray.length - imageFiles.length} non-image file(s) were skipped`);
    }

    const totalFiles = imageFiles.length;
    setUploadProgress({ current: 0, total: totalFiles });
    setIsProcessing(true);
    
    let successCount = 0;
    
    // Process all images
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      try {
        // Check if it's an image file that needs compression
        const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
        const isCompressibleImage = imageTypes.includes(file.type.toLowerCase());
        const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
        
        let fileToUpload = file;
        if (isCompressibleImage || isHeic) {
          try {
            fileToUpload = await compressImageToFile(file, 300);
          } catch (compressionError) {
            console.warn('Image compression failed, uploading original:', compressionError);
            fileToUpload = file;
          }
        }
        
        await onUpload(fileToUpload, selectedPhotoType);
        successCount++;
        setUploadProgress({ current: i + 1, total: totalFiles });
      } catch (error) {
        console.error(`Failed to upload image ${file.name}:`, error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    
    if (successCount > 0) {
      toast.success(`${successCount} image${successCount > 1 ? 's' : ''} uploaded`);
    }
    
    setIsProcessing(false);
    setUploadProgress({ current: 0, total: 0 });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    await processFilesForUpload(files);
  };

  const handleDropZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading && !isProcessing) {
      setIsDragOver(true);
    }
  };

  const handleDropZoneDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDropZoneDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (isUploading || isProcessing) return;
    
    const files = e.dataTransfer.files;
    await processFilesForUpload(files);
  };

  const handleDeleteConfirm = async () => {
    if (photoToDelete && onDelete) {
      await onDelete(photoToDelete.id, photoToDelete.photo_url);
    }
    setDeleteConfirmOpen(false);
    setPhotoToDelete(null);
  };

  // Drag and drop handlers for moving between categories
  const handleDragStart = (e: React.DragEvent, photo: DocumentPhoto) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedPhoto(photo);
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
      {/* Upload Section with Drag & Drop */}
      {editable && onUpload && (
        <div 
          className={`mb-4 p-4 border-2 border-dashed rounded-lg transition-colors ${
            isDragOver 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/30 hover:border-muted-foreground/50'
          }`}
          onDragOver={handleDropZoneDragOver}
          onDragLeave={handleDropZoneDragLeave}
          onDrop={handleDropZoneDrop}
        >
          {isDragOver ? (
            <div className="py-6 text-center">
              <Upload className="w-10 h-10 mx-auto mb-2 text-primary animate-bounce" />
              <p className="text-sm font-medium text-primary">Drop images here</p>
              <p className="text-xs text-muted-foreground mt-1">
                They will be added to "{selectedPhotoType}" category
              </p>
            </div>
          ) : (
            <>
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
                      {uploadProgress.total > 1 
                        ? `${uploadProgress.current}/${uploadProgress.total}`
                        : 'Processing...'}
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
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center hidden sm:block">
                or drag and drop images here
              </p>
            </>
          )}
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
                      onDragStart={(e) => handleDragStart(e, photo)}
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
                  {/* Empty category drop zone */}
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

              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-3 flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  {allPhotosFlat[lightboxIndex].photo_type}
                </Badge>
                <span className="text-sm">{lightboxIndex + 1} / {allPhotosFlat.length}</span>
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
      <Dialog open={changeCategoryOpen} onOpenChange={setChangeCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Change Photo Category</h3>
              <p className="text-sm text-muted-foreground">
                Move this photo to a different category
              </p>
            </div>
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
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setChangeCategoryOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (photoToChangeCategory && onUpdateType && newCategory !== photoToChangeCategory.photo_type) {
                    onUpdateType(photoToChangeCategory.id, newCategory);
                  }
                  setChangeCategoryOpen(false);
                  setPhotoToChangeCategory(null);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
