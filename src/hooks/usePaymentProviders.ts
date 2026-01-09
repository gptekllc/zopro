import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PaymentProvider {
  id: string;
  provider_key: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  is_coming_soon: boolean;
  webhook_url: string | null;
  docs_url: string | null;
  icon_bg_color: string | null;
  icon_text: string | null;
  created_at: string;
  updated_at: string;
}

export function usePaymentProviders() {
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading, error } = useQuery({
    queryKey: ['payment-providers'],
    queryFn: async () => {
      // Using type assertion since payment_providers may not be in generated types yet
      const { data, error } = await (supabase as any)
        .from('payment_providers')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as PaymentProvider[];
    },
    staleTime: 60000, // 1 minute
  });

  const updateProviderMutation = useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: string; 
      updates: Partial<Pick<PaymentProvider, 'is_enabled' | 'is_coming_soon' | 'webhook_url'>> 
    }) => {
      // Using type assertion since payment_providers may not be in generated types yet
      const { data, error } = await (supabase as any)
        .from('payment_providers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as PaymentProvider;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-providers'] });
      toast.success(`${data.name} updated successfully`);
    },
    onError: (error) => {
      console.error('Error updating payment provider:', error);
      toast.error('Failed to update payment provider');
    },
  });

  const enabledProviders = providers.filter(p => p.is_enabled && !p.is_coming_soon);
  const comingSoonProviders = providers.filter(p => p.is_coming_soon);
  const availableProviders = providers.filter(p => p.is_enabled || p.is_coming_soon);

  return {
    providers,
    enabledProviders,
    comingSoonProviders,
    availableProviders,
    isLoading,
    error,
    updateProvider: updateProviderMutation.mutate,
    isUpdating: updateProviderMutation.isPending,
  };
}
