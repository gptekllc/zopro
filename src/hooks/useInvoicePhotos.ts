import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';

export interface InvoicePhoto {
  id: string;
  invoice_id: string;
  photo_url: string;
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

      // Compress the image
      const compressedFile = await compressImage(file);
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${invoiceId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('invoice-photos')
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

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

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-photos', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['photo-count', 'invoice', variables.invoiceId] });
      toast.success('Photo uploaded');
    },
    onError: (error: any) => {
      console.error('Failed to upload photo:', error);
      toast.error(error.message || 'Failed to upload photo');
    },
  });
}

export function useDeleteInvoicePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId, photoUrl, invoiceId }: { photoId: string; photoUrl: string; invoiceId: string }) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('invoice-photos')
        .remove([photoUrl]);

      if (storageError) {
        console.warn('Failed to delete from storage:', storageError);
      }

      // Delete record
      const { error } = await supabase
        .from('invoice_photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;
      return invoiceId;
    },
    onSuccess: (invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-photos', invoiceId] });
      toast.success('Photo deleted');
    },
    onError: (error) => {
      console.error('Failed to delete photo:', error);
      toast.error('Failed to delete photo');
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
      return invoiceId;
    },
    onSuccess: (invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-photos', invoiceId] });
      toast.success('Photo category updated');
    },
    onError: (error) => {
      console.error('Failed to update photo category:', error);
      toast.error('Failed to update photo category');
    },
  });
}
