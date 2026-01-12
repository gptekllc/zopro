import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';

export interface MediaAsset {
  id: string;
  company_id: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string | null;
  file_size_bytes: number | null;
  content_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface DocumentMedia {
  id: string;
  media_asset_id: string;
  entity_type: 'job' | 'quote' | 'invoice';
  entity_id: string;
  photo_type: 'before' | 'after' | 'other';
  caption: string | null;
  display_order: number;
  created_at: string;
  media_asset?: MediaAsset;
  signed_url?: string;
}

// Fetch document media with signed URLs
export function useDocumentMedia(entityType: 'job' | 'quote' | 'invoice', entityId: string | null) {
  return useQuery({
    queryKey: ['document-media', entityType, entityId],
    queryFn: async () => {
      if (!entityId) return [];
      
      const { data, error } = await supabase
        .from('document_media')
        .select(`
          *,
          media_asset:media_assets(*)
        `)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      
      // Generate signed URLs for each media asset
      const withUrls = await Promise.all(
        (data as any[]).map(async (dm) => {
          if (!dm.media_asset) return dm;
          
          const { data: signedData } = await supabase.storage
            .from(dm.media_asset.storage_bucket)
            .createSignedUrl(dm.media_asset.storage_path, 3600 * 24); // 24 hours
          
          return {
            ...dm,
            signed_url: signedData?.signedUrl || null,
          };
        })
      );
      
      return withUrls as DocumentMedia[];
    },
    enabled: !!entityId,
  });
}

// Upload a new media asset and link it to a document
export function useUploadMediaAsset() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      file,
      photoType,
      caption,
    }: {
      entityType: 'job' | 'quote' | 'invoice';
      entityId: string;
      file: File;
      photoType: 'before' | 'after' | 'other';
      caption?: string;
    }) => {
      if (!profile?.company_id) throw new Error('No company ID');
      
      // Determine bucket based on entity type
      const bucketMap = {
        job: 'job-photos',
        quote: 'quote-photos',
        invoice: 'invoice-photos',
      };
      const bucket = bucketMap[entityType];
      
      // Check photo limit
      const { data: limit } = await supabase.rpc('get_effective_limit', {
        p_company_id: profile.company_id,
        p_limit_key: 'max_photos_per_document'
      });
      
      if (limit !== null) {
        const { count } = await supabase
          .from('document_media')
          .select('*', { count: 'exact', head: true })
          .eq('entity_type', entityType)
          .eq('entity_id', entityId);
        
        if ((count || 0) >= limit) {
          throw new Error(`Photo limit reached (${limit} per document). Upgrade your plan for more.`);
        }
      }
      
      // Compress the image
      const compressedFile = await compressImage(file);
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${entityId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, compressedFile);
      
      if (uploadError) throw uploadError;
      
      // Create media_asset record
      const { data: mediaAsset, error: assetError } = await supabase
        .from('media_assets')
        .insert({
          company_id: profile.company_id,
          storage_bucket: bucket,
          storage_path: fileName,
          original_filename: file.name,
          file_size_bytes: compressedFile.size,
          content_type: 'image/jpeg',
          uploaded_by: user?.id || null,
        })
        .select()
        .single();
      
      if (assetError) throw assetError;
      
      // Get current max display order
      const { data: existingMedia } = await supabase
        .from('document_media')
        .select('display_order')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('display_order', { ascending: false })
        .limit(1);
      
      const nextOrder = (existingMedia?.[0]?.display_order ?? -1) + 1;
      
      // Create document_media link
      const { data: docMedia, error: linkError } = await supabase
        .from('document_media')
        .insert({
          media_asset_id: mediaAsset.id,
          entity_type: entityType,
          entity_id: entityId,
          photo_type: photoType,
          caption: caption || null,
          display_order: nextOrder,
        })
        .select()
        .single();
      
      if (linkError) throw linkError;
      
      // Track storage usage
      await supabase.rpc('increment_storage_usage', {
        p_company_id: profile.company_id,
        p_bytes: compressedFile.size,
        p_type: `${entityType}_photos`
      });
      
      queryClient.invalidateQueries({ queryKey: ['storage-usage', profile.company_id] });
      
      return { mediaAsset, docMedia };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['document-media', variables.entityType, variables.entityId] });
      // Also invalidate legacy photo queries for backwards compatibility
      queryClient.invalidateQueries({ queryKey: [`${variables.entityType}-photos`, variables.entityId] });
      toast.success('Photo uploaded');
    },
    onError: (error: any) => {
      console.error('Failed to upload photo:', error);
      toast.error(error.message || 'Failed to upload photo');
    },
  });
}

// Copy media links from one document to another (no file duplication!)
export function useCopyMediaLinks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sourceType,
      sourceId,
      targetType,
      targetId,
    }: {
      sourceType: 'job' | 'quote' | 'invoice';
      sourceId: string;
      targetType: 'job' | 'quote' | 'invoice';
      targetId: string;
    }) => {
      // Use the database function to copy links
      const { data, error } = await supabase.rpc('copy_document_media_links', {
        p_source_entity_type: sourceType,
        p_source_entity_id: sourceId,
        p_target_entity_type: targetType,
        p_target_entity_id: targetId,
      });
      
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count, variables) => {
      queryClient.invalidateQueries({ queryKey: ['document-media', variables.targetType, variables.targetId] });
      if (count > 0) {
        toast.success(`Linked ${count} photo${count > 1 ? 's' : ''} to ${variables.targetType}`);
      }
    },
    onError: (error: any) => {
      console.error('Failed to copy media links:', error);
      toast.error(error.message || 'Failed to copy photos');
    },
  });
}

// Delete a document media link (soft delete the media asset if no other links exist)
export function useDeleteDocumentMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      documentMediaId, 
      entityType, 
      entityId 
    }: { 
      documentMediaId: string; 
      entityType: 'job' | 'quote' | 'invoice';
      entityId: string;
    }) => {
      // Get the media_asset_id before deletion
      const { data: docMedia } = await supabase
        .from('document_media')
        .select('media_asset_id')
        .eq('id', documentMediaId)
        .single();
      
      if (!docMedia) throw new Error('Document media not found');
      
      // Delete the link
      const { error: deleteError } = await supabase
        .from('document_media')
        .delete()
        .eq('id', documentMediaId);
      
      if (deleteError) throw deleteError;
      
      // Check if any other links exist for this media asset
      const { count } = await supabase
        .from('document_media')
        .select('*', { count: 'exact', head: true })
        .eq('media_asset_id', docMedia.media_asset_id);
      
      // If no other links, soft delete the media asset
      if (count === 0) {
        await supabase
          .from('media_assets')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', docMedia.media_asset_id);
      }
      
      return { entityType, entityId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['document-media', result.entityType, result.entityId] });
      toast.success('Photo removed');
    },
    onError: (error: any) => {
      console.error('Failed to delete photo:', error);
      toast.error(error.message || 'Failed to delete photo');
    },
  });
}

// Update document media metadata (photo type, caption)
export function useUpdateDocumentMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentMediaId,
      entityType,
      entityId,
      photoType,
      caption,
    }: {
      documentMediaId: string;
      entityType: 'job' | 'quote' | 'invoice';
      entityId: string;
      photoType?: 'before' | 'after' | 'other';
      caption?: string;
    }) => {
      const updates: any = {};
      if (photoType !== undefined) updates.photo_type = photoType;
      if (caption !== undefined) updates.caption = caption;
      
      const { error } = await supabase
        .from('document_media')
        .update(updates)
        .eq('id', documentMediaId);
      
      if (error) throw error;
      return { entityType, entityId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['document-media', result.entityType, result.entityId] });
      toast.success('Photo updated');
    },
    onError: (error: any) => {
      console.error('Failed to update photo:', error);
      toast.error(error.message || 'Failed to update photo');
    },
  });
}
