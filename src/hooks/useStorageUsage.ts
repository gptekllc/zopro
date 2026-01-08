import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface StorageUsage {
  totalBytesUsed: number;
  jobPhotosBytes: number;
  quotePhotosBytes: number;
  invoicePhotosBytes: number;
  limitBytes: number | null;
  remainingBytes: number | null;
  percentageUsed: number;
  isNearLimit: boolean; // 80%+
  isCritical: boolean; // 95%+
  isAtLimit: boolean; // 100%
  canUpload: boolean;
  addonPricePerGb: number | null;
  isLoading: boolean;
}

export function useStorageUsage(): StorageUsage {
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  // Fetch storage usage
  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['storage-usage', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase
        .from('company_storage_usage')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });

  // Fetch storage limit
  const { data: limitData, isLoading: limitLoading } = useQuery({
    queryKey: ['storage-limit', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      // Get effective limit (checks override first, then plan)
      const { data: limit, error: limitError } = await supabase.rpc('get_effective_limit', {
        p_company_id: companyId,
        p_limit_key: 'storage_limit_bytes'
      });
      
      if (limitError) throw limitError;

      // Get addon price from plan
      const { data: planData, error: planError } = await supabase
        .from('company_subscriptions')
        .select('subscription_plans(storage_addon_price_per_gb)')
        .eq('company_id', companyId)
        .in('status', ['active', 'trialing'])
        .maybeSingle();
      
      if (planError) throw planError;

      return {
        limit: limit as number | null,
        addonPrice: (planData?.subscription_plans as { storage_addon_price_per_gb: number | null } | null)?.storage_addon_price_per_gb ?? null
      };
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const totalBytesUsed = usage?.total_bytes_used ?? 0;
  const limitBytes = limitData?.limit ?? null;
  const remainingBytes = limitBytes !== null ? Math.max(0, limitBytes - totalBytesUsed) : null;
  const percentageUsed = limitBytes ? (totalBytesUsed / limitBytes) * 100 : 0;

  return {
    totalBytesUsed,
    jobPhotosBytes: usage?.job_photos_bytes ?? 0,
    quotePhotosBytes: usage?.quote_photos_bytes ?? 0,
    invoicePhotosBytes: usage?.invoice_photos_bytes ?? 0,
    limitBytes,
    remainingBytes,
    percentageUsed,
    isNearLimit: percentageUsed >= 80,
    isCritical: percentageUsed >= 95,
    isAtLimit: percentageUsed >= 100,
    canUpload: limitBytes === null || totalBytesUsed < limitBytes,
    addonPricePerGb: limitData?.addonPrice ?? null,
    isLoading: usageLoading || limitLoading,
  };
}

// Helper function to format bytes
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
