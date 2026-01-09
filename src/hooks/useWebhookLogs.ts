import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WebhookLog {
  id: string;
  provider: string;
  event_type: string;
  event_id: string | null;
  status: string;
  payload: Record<string, unknown> | null;
  error_message: string | null;
  processing_time_ms: number | null;
  created_at: string;
}

interface UseWebhookLogsOptions {
  provider?: string;
  status?: string;
  limit?: number;
}

export function useWebhookLogs(options?: UseWebhookLogsOptions) {
  return useQuery({
    queryKey: ['webhook-logs', options],
    queryFn: async () => {
      let query = supabase
        .from('webhook_event_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(options?.limit || 50);

      if (options?.provider) {
        query = query.eq('provider', options.provider);
      }

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WebhookLog[];
    },
  });
}

export function useWebhookStats() {
  return useQuery({
    queryKey: ['webhook-stats'],
    queryFn: async () => {
      // Get last 24 hours of logs
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('webhook_event_logs')
        .select('provider, status, created_at')
        .gte('created_at', oneDayAgo);

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        processed: data?.filter(d => d.status === 'processed').length || 0,
        failed: data?.filter(d => d.status === 'failed').length || 0,
        byProvider: {} as Record<string, number>,
        lastEventAt: data?.[0]?.created_at || null,
      };

      data?.forEach(log => {
        stats.byProvider[log.provider] = (stats.byProvider[log.provider] || 0) + 1;
      });

      return stats;
    },
  });
}
