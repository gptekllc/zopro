import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmailLog {
  id: string;
  recipient_email: string;
  sender_email: string;
  subject: string;
  email_type: string;
  status: string;
  resend_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  company_id: string | null;
  customer_id: string | null;
  created_at: string;
}

interface UseEmailLogsOptions {
  emailType?: string;
  status?: string;
  companyId?: string;
  limit?: number;
}

export function useEmailLogs(options?: UseEmailLogsOptions) {
  return useQuery({
    queryKey: ['email-logs', options],
    queryFn: async () => {
      let query = supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(options?.limit || 100);

      if (options?.emailType) {
        query = query.eq('email_type', options.emailType);
      }

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.companyId) {
        query = query.eq('company_id', options.companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmailLog[];
    },
  });
}

export function useEmailStats() {
  return useQuery({
    queryKey: ['email-stats'],
    queryFn: async () => {
      // Get last 24 hours of logs
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('email_logs')
        .select('email_type, status, created_at')
        .gte('created_at', oneDayAgo);

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        sent: data?.filter(d => d.status === 'sent').length || 0,
        delivered: data?.filter(d => d.status === 'delivered').length || 0,
        failed: data?.filter(d => d.status === 'failed').length || 0,
        bounced: data?.filter(d => d.status === 'bounced').length || 0,
        byType: {} as Record<string, number>,
        lastEmailAt: data?.[0]?.created_at || null,
      };

      data?.forEach(log => {
        stats.byType[log.email_type] = (stats.byType[log.email_type] || 0) + 1;
      });

      return stats;
    },
  });
}
