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

      // Compress the image
      const compressedFile = await compressImage(file);
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${quoteId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('quote-photos')
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

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

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quote-photos', variables.quoteId] });
      queryClient.invalidateQueries({ queryKey: ['photo-count', 'quote', variables.quoteId] });
      toast.success('Photo uploaded');
    },
    onError: (error: any) => {
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
      return quoteId;
    },
    onSuccess: (quoteId) => {
      queryClient.invalidateQueries({ queryKey: ['quote-photos', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Photo deleted');
    },
    onError: (error) => {
      console.error('Failed to delete photo:', error);
      toast.error('Failed to delete photo');
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
      return quoteId;
    },
    onSuccess: (quoteId) => {
      queryClient.invalidateQueries({ queryKey: ['quote-photos', quoteId] });
      toast.success('Photo category updated');
    },
    onError: (error) => {
      console.error('Failed to update photo category:', error);
      toast.error('Failed to update photo category');
    },
  });
}
