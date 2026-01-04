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
    }: {
      quoteId: string;
      file: File;
      photoType: 'before' | 'after' | 'other';
      caption?: string;
    }) => {
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
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quote-photos', variables.quoteId] });
      toast.success('Photo uploaded');
    },
    onError: (error) => {
      console.error('Failed to upload photo:', error);
      toast.error('Failed to upload photo');
    },
  });
}

export function useDeleteQuotePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId, photoUrl, quoteId }: { photoId: string; photoUrl: string; quoteId: string }) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('quote-photos')
        .remove([photoUrl]);

      if (storageError) {
        console.warn('Failed to delete from storage:', storageError);
      }

      // Delete record
      const { error } = await supabase
        .from('quote_photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;
      return quoteId;
    },
    onSuccess: (quoteId) => {
      queryClient.invalidateQueries({ queryKey: ['quote-photos', quoteId] });
      toast.success('Photo deleted');
    },
    onError: (error) => {
      console.error('Failed to delete photo:', error);
      toast.error('Failed to delete photo');
    },
  });
}
