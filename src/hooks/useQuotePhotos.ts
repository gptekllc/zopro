import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';

export interface QuotePhoto {
  id: string;
  quote_id: string;
  photo_url: string;
  photo_type: 'before' | 'after' | 'other';
  caption: string | null;
  display_order: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export function useQuotePhotos(quoteId: string | null) {
  return useQuery({
    queryKey: ['quote-photos', quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      
      const { data, error } = await supabase
        .from('quote_photos')
        .select('*')
        .eq('quote_id', quoteId)
        .is('deleted_at', null) // Exclude soft-deleted photos
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as QuotePhoto[];
    },
    enabled: !!quoteId,
  });
}

export function useUploadQuotePhoto() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      quoteId,
      file,
      photoType,
      caption,
      companyId,
    }: {
      quoteId: string;
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
            .from('quote_photos')
            .select('*', { count: 'exact', head: true })
            .eq('quote_id', quoteId);
          
          if ((count || 0) >= limit) {
            throw new Error(`Photo limit reached (${limit} per quote). Upgrade your plan for more.`);
          }
        }
      }

      // Compress the image to 300KB
      const compressedFile = await compressImage(file, 300);
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${quoteId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('quote-photos')
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

      // Get signed URL for immediate display
      const { data: signedData } = await supabase.storage
        .from('quote-photos')
        .createSignedUrl(fileName, 3600 * 24 * 7);

      // Get current max display order
      const { data: existingPhotos } = await supabase
        .from('quote_photos')
        .select('display_order')
        .eq('quote_id', quoteId)
        .order('display_order', { ascending: false })
        .limit(1);

      const nextOrder = (existingPhotos?.[0]?.display_order ?? -1) + 1;

      // Create photo record
      const { data, error } = await supabase
        .from('quote_photos')
        .insert({
          quote_id: quoteId,
          photo_url: fileName,
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
          p_type: 'quote_photos'
        });
        queryClient.invalidateQueries({ queryKey: ['storage-usage', companyId] });
      }

      return { ...data, quoteId, photo_url: signedData?.signedUrl || fileName };
    },
    onMutate: async ({ quoteId, file, photoType }) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['quote-photos', quoteId] });
      
      // Create a temporary local URL for immediate display
      const tempUrl = URL.createObjectURL(file);
      const tempId = `temp-${Date.now()}`;
      
      // Save previous state for rollback
      const previousPhotos = queryClient.getQueryData(['quote-photos', quoteId]);
      
      // Optimistically add the photo with temp URL for instant feedback
      queryClient.setQueryData(['quote-photos', quoteId], (old: QuotePhoto[] | undefined) => {
        const newPhoto: QuotePhoto = {
          id: tempId,
          quote_id: quoteId,
          photo_url: tempUrl,
          photo_type: photoType,
          caption: null,
          display_order: (old?.length ?? 0),
          uploaded_by: null,
          created_at: new Date().toISOString(),
        };
        if (!old) return [newPhoto];
        return [...old, newPhoto];
      });
      
      return { previousPhotos, tempId, tempUrl, quoteId };
    },
    onSuccess: (result, variables, context) => {
      // Replace temporary photo with real one from server
      queryClient.setQueryData(['quote-photos', result.quoteId], (old: QuotePhoto[] | undefined) => {
        if (!old) return [result];
        return old.map((p) => 
          p.id === context?.tempId 
            ? {
                id: result.id,
                quote_id: result.quote_id,
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
      
      queryClient.invalidateQueries({ queryKey: ['quote-photos', variables.quoteId] });
      queryClient.invalidateQueries({ queryKey: ['photo-count', 'quote', variables.quoteId] });
      toast.success('Photo uploaded');
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousPhotos && context?.quoteId) {
        queryClient.setQueryData(['quote-photos', context.quoteId], context.previousPhotos);
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

export function useDeleteQuotePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId, quoteId }: { photoId: string; photoUrl?: string; quoteId: string }) => {
      // Soft delete - set deleted_at timestamp (keep file in storage for recovery)
      const { error } = await supabase
        .from('quote_photos')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', photoId);

      if (error) throw error;
      return { photoId, quoteId };
    },
    onMutate: async ({ photoId, quoteId }) => {
      await queryClient.cancelQueries({ queryKey: ['quote-photos', quoteId] });
      
      const previousPhotos = queryClient.getQueryData(['quote-photos', quoteId]);
      
      // Optimistically remove photo
      queryClient.setQueryData(['quote-photos', quoteId], (old: QuotePhoto[] | undefined) => {
        if (!old) return old;
        return old.filter(p => p.id !== photoId);
      });
      
      return { previousPhotos, quoteId };
    },
    onError: (err, variables, context) => {
      if (context?.previousPhotos) {
        queryClient.setQueryData(['quote-photos', context.quoteId], context.previousPhotos);
      }
      console.error('Failed to delete photo:', err);
      toast.error('Failed to delete photo');
    },
    onSuccess: () => {
      toast.success('Photo deleted');
      // Trust optimistic update - no invalidation to prevent revert
    },
  });
}

export function useUpdateQuotePhotoType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId, photoType, quoteId }: { photoId: string; photoType: 'before' | 'after' | 'other'; quoteId: string }) => {
      const { error } = await supabase
        .from('quote_photos')
        .update({ photo_type: photoType })
        .eq('id', photoId);

      if (error) throw error;
      return { photoId, photoType, quoteId };
    },
    onMutate: async ({ photoId, photoType, quoteId }) => {
      await queryClient.cancelQueries({ queryKey: ['quote-photos', quoteId] });
      
      const previousPhotos = queryClient.getQueryData(['quote-photos', quoteId]);
      
      // Optimistically update photo type
      queryClient.setQueryData(['quote-photos', quoteId], (old: QuotePhoto[] | undefined) => {
        if (!old) return old;
        return old.map(p => p.id === photoId ? { ...p, photo_type: photoType } : p);
      });
      
      return { previousPhotos, quoteId };
    },
    onError: (err, variables, context) => {
      if (context?.previousPhotos) {
        queryClient.setQueryData(['quote-photos', context.quoteId], context.previousPhotos);
      }
      console.error('Failed to update photo category:', err);
      toast.error('Failed to update photo category');
    },
    onSuccess: () => {
      toast.success('Photo category updated');
      // Trust optimistic update - no invalidation to prevent revert
    },
  });
}
