import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SmsLog {
  id: string;
  company_id: string;
  customer_id: string | null;
  recipient_phone: string;
  message_type: string;
  template_name: string;
  message_body: string;
  status: 'sent' | 'failed' | 'blocked';
  twilio_sid: string | null;
  error_message: string | null;
  error_code: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  sent_by: string | null;
  // Joined data
  customer?: {
    name: string;
    email: string | null;
  };
  sender?: {
    full_name: string | null;
    email: string;
  };
}

interface UseSmsLogsOptions {
  limit?: number;
  status?: 'sent' | 'failed' | 'blocked';
  messageType?: 'invoice' | 'portal_link' | 'technician_eta';
}

export function useSmsLogs(options: UseSmsLogsOptions = {}) {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const { limit = 50, status, messageType } = options;

  return useQuery({
    queryKey: ['sms-logs', companyId, limit, status, messageType],
    queryFn: async () => {
      if (!companyId) return [];
      
      let query = supabase
        .from('sms_logs')
        .select(`
          *,
          customer:customers(name, email),
          sender:profiles!sms_logs_sent_by_fkey(full_name, email)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (status) {
        query = query.eq('status', status);
      }
      
      if (messageType) {
        query = query.eq('message_type', messageType);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as SmsLog[];
    },
    enabled: !!companyId,
  });
}

// Hook for super admin to view all SMS logs
export function useAllSmsLogs(options: UseSmsLogsOptions & { companyId?: string } = {}) {
  const { limit = 100, status, messageType, companyId: filterCompanyId } = options;

  return useQuery({
    queryKey: ['all-sms-logs', limit, status, messageType, filterCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('sms_logs')
        .select(`
          *,
          customer:customers(name, email),
          sender:profiles!sms_logs_sent_by_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (filterCompanyId) {
        query = query.eq('company_id', filterCompanyId);
      }
      
      if (status) {
        query = query.eq('status', status);
      }
      
      if (messageType) {
        query = query.eq('message_type', messageType);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as SmsLog[];
    },
  });
}

// Hook for super admin to get SMS usage by company
export function useAllSmsUsage() {
  return useQuery({
    queryKey: ['all-sms-usage'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sms_usage')
        .select(`
          *,
          company:companies(name)
        `)
        .order('period_start', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}
