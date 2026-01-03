import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
