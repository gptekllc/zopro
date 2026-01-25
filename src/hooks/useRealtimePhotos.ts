import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface PhotoRecord {
  id: string;
  photo_url: string;
  photo_type: string;
  caption: string | null;
  display_order: number | null;
  uploaded_by: string | null;
  created_at: string;
  deleted_at: string | null;
  job_id?: string;
  quote_id?: string;
  invoice_id?: string;
}

/**
 * Hook to subscribe to real-time changes on job_photos table
 * Automatically updates the React Query cache when photos are added, updated, or deleted
 */
export function useRealtimeJobPhotos(jobId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`job-photos-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_photos',
          filter: `job_id=eq.${jobId}`,
        },
        (payload: RealtimePostgresChangesPayload<PhotoRecord>) => {
          handlePhotoChange(queryClient, 'job', jobId, payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, queryClient]);
}

/**
 * Hook to subscribe to real-time changes on quote_photos table
 */
export function useRealtimeQuotePhotos(quoteId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!quoteId) return;

    const channel = supabase
      .channel(`quote-photos-${quoteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quote_photos',
          filter: `quote_id=eq.${quoteId}`,
        },
        (payload: RealtimePostgresChangesPayload<PhotoRecord>) => {
          handlePhotoChange(queryClient, 'quote', quoteId, payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quoteId, queryClient]);
}

/**
 * Hook to subscribe to real-time changes on invoice_photos table
 */
export function useRealtimeInvoicePhotos(invoiceId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!invoiceId) return;

    const channel = supabase
      .channel(`invoice-photos-${invoiceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoice_photos',
          filter: `invoice_id=eq.${invoiceId}`,
        },
        (payload: RealtimePostgresChangesPayload<PhotoRecord>) => {
          handlePhotoChange(queryClient, 'invoice', invoiceId, payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [invoiceId, queryClient]);
}

/**
 * Handle photo changes from realtime subscription
 */
function handlePhotoChange(
  queryClient: ReturnType<typeof useQueryClient>,
  entityType: 'job' | 'quote' | 'invoice',
  entityId: string,
  payload: RealtimePostgresChangesPayload<PhotoRecord>
) {
  const queryKey = entityType === 'job' 
    ? ['job', entityId] 
    : [`${entityType}-photos`, entityId];

  if (payload.eventType === 'INSERT') {
    const newPhoto = payload.new;
    // Skip if soft-deleted
    if (newPhoto.deleted_at) return;

    if (entityType === 'job') {
      // For jobs, photos are nested in the job object
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        // Check if photo already exists (from optimistic update)
        const exists = old.photos?.some((p: any) => p.id === newPhoto.id);
        if (exists) return old;
        return {
          ...old,
          photos: [...(old.photos || []), newPhoto],
        };
      });
    } else {
      // For quotes/invoices, photos are in separate array
      queryClient.setQueryData(queryKey, (old: PhotoRecord[] | undefined) => {
        if (!old) return [newPhoto];
        const exists = old.some((p) => p.id === newPhoto.id);
        if (exists) return old;
        return [...old, newPhoto];
      });
    }
  } else if (payload.eventType === 'UPDATE') {
    const updatedPhoto = payload.new;
    
    // If photo was soft-deleted, remove it from the list
    if (updatedPhoto.deleted_at) {
      if (entityType === 'job') {
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            photos: old.photos?.filter((p: any) => p.id !== updatedPhoto.id) || [],
          };
        });
      } else {
        queryClient.setQueryData(queryKey, (old: PhotoRecord[] | undefined) => {
          if (!old) return old;
          return old.filter((p) => p.id !== updatedPhoto.id);
        });
      }
    } else {
      // Update the photo in place (e.g., category change)
      if (entityType === 'job') {
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            photos: old.photos?.map((p: any) =>
              p.id === updatedPhoto.id ? { ...p, ...updatedPhoto } : p
            ) || [],
          };
        });
      } else {
        queryClient.setQueryData(queryKey, (old: PhotoRecord[] | undefined) => {
          if (!old) return old;
          return old.map((p) =>
            p.id === updatedPhoto.id ? { ...p, ...updatedPhoto } : p
          );
        });
      }
    }
  } else if (payload.eventType === 'DELETE') {
    const deletedPhoto = payload.old;
    
    if (entityType === 'job') {
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          photos: old.photos?.filter((p: any) => p.id !== deletedPhoto.id) || [],
        };
      });
    } else {
      queryClient.setQueryData(queryKey, (old: PhotoRecord[] | undefined) => {
        if (!old) return old;
        return old.filter((p) => p.id !== deletedPhoto.id);
      });
    }
  }

  // Also invalidate photo count queries
  queryClient.invalidateQueries({ queryKey: ['photo-count', entityType, entityId] });
}
