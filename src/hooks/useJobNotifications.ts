import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface JobNotification {
  id: string;
  job_id: string;
  customer_id: string;
  company_id: string;
  notification_type: string;
  status_at_send: string | null;
  sent_at: string;
  sent_by: string | null;
  recipient_email: string;
  created_at: string;
}

export function useJobNotifications(jobId: string | null) {
  return useQuery({
    queryKey: ['job_notifications', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      
      const { data, error } = await (supabase as any)
        .from('job_notifications')
        .select('*')
        .eq('job_id', jobId)
        .order('sent_at', { ascending: false });
      
      if (error) throw error;
      return data as JobNotification[];
    },
    enabled: !!jobId,
  });
}

// Hook to get notification counts for all jobs in company
export function useJobNotificationCounts() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['job_notification_counts', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return new Map<string, number>();
      
      const { data, error } = await (supabase as any)
        .from('job_notifications')
        .select('job_id')
        .eq('company_id', profile.company_id);
      
      if (error) throw error;
      
      // Count notifications per job
      const counts = new Map<string, number>();
      (data || []).forEach((n: { job_id: string }) => {
        counts.set(n.job_id, (counts.get(n.job_id) || 0) + 1);
      });
      
      return counts;
    },
    enabled: !!profile?.company_id,
    staleTime: 30000, // Cache for 30 seconds
  });
}
