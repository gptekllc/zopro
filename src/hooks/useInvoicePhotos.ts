import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { compressImage, createThumbnail } from '@/lib/imageCompression';

export interface InvoicePhoto {
  id: string;
  invoice_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  photo_type: 'before' | 'after' | 'other';
  caption: string | null;
  display_order: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export function useInvoicePhotos(invoiceId: string | null) {
  return useQuery({
    queryKey: ['invoice-photos', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      
      const { data, error } = await supabase
        .from('invoice_photos')
        .select('*')
        .eq('invoice_id', invoiceId)
        .is('deleted_at', null) // Exclude soft-deleted photos
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as InvoicePhoto[];
    },
    enabled: !!invoiceId,
  });
}

export function useUploadInvoicePhoto() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      file,
      photoType,
      caption,
      companyId,
    }: {
      invoiceId: string;
      file: File;
      photoType: 'before' | 'after' | 'other';
      caption?: string;
      companyId?: string;
    }) => {
      // Check photo limit before upload
      if (companyId) {
        const { data: limit } = await supabase.rpc('get_effective_limit', {
          p_company_id: companyId,
          p_limit_key: 'max_photos_per_document'
        });
        
        if (limit !== null) {
          const { count } = await supabase
            .from('invoice_photos')
            .select('*', { count: 'exact', head: true })
            .eq('invoice_id', invoiceId);
          
          if ((count || 0) >= limit) {
            throw new Error(`Photo limit reached (${limit} per invoice). Upgrade your plan for more.`);
          }
        }
      }

      // Compress the image to 300KB
      const compressedBlob = await compressImage(file, 300);
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
      
      // Generate thumbnail (200px, ~15KB)
      const thumbnailBlob = await createThumbnail(file, 200, 0.6);
      const thumbnailFile = new File([thumbnailBlob], `thumb_${file.name}`, { type: 'image/jpeg' });
      
      // Generate unique filenames
      const baseName = `${invoiceId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fileName = `${baseName}.jpg`;
      const thumbFileName = `${baseName}_thumb.jpg`;
      
      // Upload both files in parallel
      const [uploadResult, thumbUploadResult] = await Promise.all([
        supabase.storage.from('invoice-photos').upload(fileName, compressedFile),
        supabase.storage.from('invoice-photos').upload(thumbFileName, thumbnailFile)
      ]);

      if (uploadResult.error) throw uploadResult.error;
      // Thumbnail upload failure is non-critical
      const thumbnailPath = thumbUploadResult.error ? null : thumbFileName;

      // Get signed URL for immediate display
      const { data: signedData } = await supabase.storage
        .from('invoice-photos')
        .createSignedUrl(fileName, 3600 * 24 * 7);

      // Get current max display order
      const { data: existingPhotos } = await supabase
        .from('invoice_photos')
        .select('display_order')
        .eq('invoice_id', invoiceId)
        .order('display_order', { ascending: false })
        .limit(1);

      const nextOrder = (existingPhotos?.[0]?.display_order ?? -1) + 1;

      // Create photo record
      const { data, error } = await supabase
        .from('invoice_photos')
        .insert({
          invoice_id: invoiceId,
          photo_url: fileName,
          thumbnail_url: thumbnailPath,
          photo_type: photoType,
          caption: caption || null,
          display_order: nextOrder,
          uploaded_by: profile?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Track storage usage
      if (companyId) {
        await supabase.rpc('increment_storage_usage', {
          p_company_id: companyId,
          p_bytes: compressedFile.size,
          p_type: 'invoice_photos'
        });
        queryClient.invalidateQueries({ queryKey: ['storage-usage', companyId] });
      }

      return { ...data, invoiceId, photo_url: signedData?.signedUrl || fileName };
    },
    onMutate: async ({ invoiceId, file, photoType }) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['invoice-photos', invoiceId] });
      
      // Create a temporary local URL for immediate display
      const tempUrl = URL.createObjectURL(file);
      const tempId = `temp-${Date.now()}`;
      
      // Save previous state for rollback
      const previousPhotos = queryClient.getQueryData(['invoice-photos', invoiceId]);
      
      // Optimistically add the photo with temp URL for instant feedback
      queryClient.setQueryData(['invoice-photos', invoiceId], (old: InvoicePhoto[] | undefined) => {
        const newPhoto: InvoicePhoto = {
          id: tempId,
          invoice_id: invoiceId,
          photo_url: tempUrl,
          thumbnail_url: tempUrl, // Use same URL for temp thumbnail
          photo_type: photoType,
          caption: null,
          display_order: (old?.length ?? 0),
          uploaded_by: null,
          created_at: new Date().toISOString(),
        };
        if (!old) return [newPhoto];
        return [...old, newPhoto];
      });
      
      return { previousPhotos, tempId, tempUrl, invoiceId };
    },
    onSuccess: (result, variables, context) => {
      // Replace temporary photo with real one from server
      queryClient.setQueryData(['invoice-photos', result.invoiceId], (old: InvoicePhoto[] | undefined) => {
        if (!old) return [result];
        return old.map((p) => 
          p.id === context?.tempId 
            ? {
                id: result.id,
                invoice_id: result.invoice_id,
                photo_url: result.photo_url,
                photo_type: result.photo_type,
                caption: result.caption,
                display_order: result.display_order,
                uploaded_by: result.uploaded_by,
                created_at: result.created_at,
              }
            : p
        );
      });
      
      // Revoke the temporary object URL to free memory
      if (context?.tempUrl) {
        URL.revokeObjectURL(context.tempUrl);
      }
      
      queryClient.invalidateQueries({ queryKey: ['invoice-photos', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['photo-count', 'invoice', variables.invoiceId] });
      toast.success('Photo uploaded');
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousPhotos && context?.invoiceId) {
        queryClient.setQueryData(['invoice-photos', context.invoiceId], context.previousPhotos);
      }
      // Revoke temp URL on error too
      if (context?.tempUrl) {
        URL.revokeObjectURL(context.tempUrl);
      }
      console.error('Failed to upload photo:', error);
      toast.error(error.message || 'Failed to upload photo');
    },
  });
}

export function useDeleteInvoicePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId, invoiceId }: { photoId: string; photoUrl?: string; invoiceId: string }) => {
      // Soft delete - set deleted_at timestamp (keep file in storage for recovery)
      const { error } = await supabase
        .from('invoice_photos')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', photoId);

      if (error) throw error;
      return { photoId, invoiceId };
    },
    onMutate: async ({ photoId, invoiceId }) => {
      await queryClient.cancelQueries({ queryKey: ['invoice-photos', invoiceId] });
      
      const previousPhotos = queryClient.getQueryData(['invoice-photos', invoiceId]);
      
      // Optimistically remove photo
      queryClient.setQueryData(['invoice-photos', invoiceId], (old: InvoicePhoto[] | undefined) => {
        if (!old) return old;
        return old.filter(p => p.id !== photoId);
      });
      
      return { previousPhotos, invoiceId };
    },
    onError: (err, variables, context) => {
      if (context?.previousPhotos) {
        queryClient.setQueryData(['invoice-photos', context.invoiceId], context.previousPhotos);
      }
      console.error('Failed to delete photo:', err);
      toast.error('Failed to delete photo');
    },
    onSuccess: () => {
      toast.success('Photo deleted');
      // Realtime subscription handles cache updates - no invalidation needed
    },
  });
}

export function useUpdateInvoicePhotoType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId, photoType, invoiceId }: { photoId: string; photoType: 'before' | 'after' | 'other'; invoiceId: string }) => {
      const { error } = await supabase
        .from('invoice_photos')
        .update({ photo_type: photoType })
        .eq('id', photoId);

      if (error) throw error;
      return { photoId, photoType, invoiceId };
    },
    onMutate: async ({ photoId, photoType, invoiceId }) => {
      await queryClient.cancelQueries({ queryKey: ['invoice-photos', invoiceId] });
      
      const previousPhotos = queryClient.getQueryData(['invoice-photos', invoiceId]);
      
      // Optimistically update photo type
      queryClient.setQueryData(['invoice-photos', invoiceId], (old: InvoicePhoto[] | undefined) => {
        if (!old) return old;
        return old.map(p => p.id === photoId ? { ...p, photo_type: photoType } : p);
      });
      
      return { previousPhotos, invoiceId };
    },
    onError: (err, variables, context) => {
      if (context?.previousPhotos) {
        queryClient.setQueryData(['invoice-photos', context.invoiceId], context.previousPhotos);
      }
      console.error('Failed to update photo category:', err);
      toast.error('Failed to update photo category');
    },
    onSuccess: () => {
      toast.success('Photo category updated');
      // Realtime subscription handles cache updates - no invalidation needed
    },
  });
}
