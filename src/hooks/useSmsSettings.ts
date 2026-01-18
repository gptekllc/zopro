import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface SmsSettings {
  id: string;
  company_id: string;
  sms_enabled: boolean;
  auto_send_invoice_sms: boolean;
  auto_send_portal_link_sms: boolean;
  created_at: string;
  updated_at: string;
}

export interface SmsUsage {
  messages_sent: number;
  messages_limit: number | null;
  can_send: boolean;
}

export interface PlanSmsInfo {
  sms_enabled: boolean;
  sms_monthly_limit: number | null;
  plan_name: string;
}

export function useSmsSettings() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const queryClient = useQueryClient();

  // Fetch SMS settings for the company
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['sms-settings', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase
        .from('company_sms_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      
      if (error) throw error;
      return data as SmsSettings | null;
    },
    enabled: !!companyId,
  });

  // Fetch plan SMS info
  const { data: planInfo, isLoading: planLoading } = useQuery({
    queryKey: ['plan-sms-info', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase
        .from('company_subscriptions')
        .select(`
          subscription_plans (
            name,
            sms_enabled,
            sms_monthly_limit
          )
        `)
        .eq('company_id', companyId)
        .in('status', ['active', 'trialing'])
        .maybeSingle();
      
      if (error) throw error;
      
      const plan = (data?.subscription_plans as any);
      if (!plan) return null;
      
      return {
        sms_enabled: plan.sms_enabled ?? false,
        sms_monthly_limit: plan.sms_monthly_limit,
        plan_name: plan.name,
      } as PlanSmsInfo;
    },
    enabled: !!companyId,
  });

  // Fetch current usage
  const { data: usage, isLoading: usageLoading, refetch: refetchUsage } = useQuery({
    queryKey: ['sms-usage', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase.rpc('get_sms_usage_for_period', {
        p_company_id: companyId
      });
      
      if (error) throw error;
      
      const usageData = data?.[0];
      if (!usageData) return null;
      
      return {
        messages_sent: usageData.messages_sent,
        messages_limit: usageData.messages_limit,
        can_send: usageData.can_send,
      } as SmsUsage;
    },
    enabled: !!companyId,
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<Omit<SmsSettings, 'id' | 'company_id' | 'created_at' | 'updated_at'>>) => {
      if (!companyId) throw new Error('No company ID');
      
      // Check if settings exist
      const { data: existing } = await supabase
        .from('company_sms_settings')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle();
      
      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('company_sms_settings')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('company_sms_settings')
          .insert({ company_id: companyId, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-settings', companyId] });
      toast.success('SMS settings updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update SMS settings: ' + error.message);
    },
  });

  // Check if SMS is fully enabled (plan + company)
  const isSmsAvailable = planInfo?.sms_enabled ?? false;
  const isSmsEnabled = isSmsAvailable && (settings?.sms_enabled ?? false);

  return {
    settings,
    planInfo,
    usage,
    isLoading: settingsLoading || planLoading || usageLoading,
    isSmsAvailable,
    isSmsEnabled,
    updateSettings,
    refetchUsage,
  };
}

// Hook for sending SMS
export function useSendSms() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  return useMutation({
    mutationFn: async (params: {
      message_type: 'invoice' | 'portal_link' | 'technician_eta';
      recipient_phone: string;
      customer_id?: string;
      variables: Record<string, string>;
      metadata?: Record<string, any>;
    }) => {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: params,
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      // Refetch usage after sending
      queryClient.invalidateQueries({ queryKey: ['sms-usage', companyId] });
      queryClient.invalidateQueries({ queryKey: ['sms-logs', companyId] });
      toast.success('SMS sent successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send SMS');
    },
  });
}
