import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface PhotoLimits {
  canUpload: boolean;
  currentCount: number;
  limit: number | null;
  remaining: number | null;
  isLoading: boolean;
  planName: string | null;
}

type DocumentType = 'job' | 'quote' | 'invoice';

export function usePhotoLimits(
  documentType: DocumentType,
  documentId: string | null
): PhotoLimits {
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  // Fetch effective photo limit
  const { data: limit, isLoading: limitLoading } = useQuery({
    queryKey: ['photo-limit', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase.rpc('get_effective_limit', {
        p_company_id: companyId,
        p_limit_key: 'max_photos_per_document'
      });
      
      if (error) throw error;
      return data as number | null;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch current photo count for this document
  const { data: currentCount = 0, isLoading: countLoading } = useQuery({
    queryKey: ['photo-count', documentType, documentId],
    queryFn: async () => {
      if (!documentId) return 0;
      
      let count = 0;
      if (documentType === 'job') {
        const { count: c, error } = await supabase
          .from('job_photos')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', documentId);
        if (error) throw error;
        count = c || 0;
      } else if (documentType === 'quote') {
        const { count: c, error } = await supabase
          .from('quote_photos')
          .select('*', { count: 'exact', head: true })
          .eq('quote_id', documentId);
        if (error) throw error;
        count = c || 0;
      } else if (documentType === 'invoice') {
        const { count: c, error } = await supabase
          .from('invoice_photos')
          .select('*', { count: 'exact', head: true })
          .eq('invoice_id', documentId);
        if (error) throw error;
        count = c || 0;
      }
      
      return count;
    },
    enabled: !!documentId,
    staleTime: 30 * 1000,
  });

  // Fetch plan name for display
  const { data: planName } = useQuery({
    queryKey: ['plan-name', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase
        .from('company_subscriptions')
        .select('subscription_plans(display_name)')
        .eq('company_id', companyId)
        .in('status', ['active', 'trialing'])
        .maybeSingle();
      
      if (error) throw error;
      return (data?.subscription_plans as { display_name: string } | null)?.display_name ?? null;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = limitLoading || countLoading;
  const remaining = limit !== null ? Math.max(0, limit - currentCount) : null;
  const canUpload = limit === null || currentCount < limit;

  return {
    canUpload,
    currentCount,
    limit,
    remaining,
    isLoading,
    planName,
  };
}
