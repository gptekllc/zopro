import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number | null;
  price_yearly: number | null;
  max_users: number | null;
  max_jobs_per_month: number | null;
  max_storage_gb?: number | null;
  storage_limit_bytes?: number | null;
  features: Record<string, boolean> | null;
  stripe_product_id?: string | null;
  stripe_price_id_monthly?: string | null;
  stripe_price_id_yearly?: string | null;
}

interface CompanySubscription {
  id: string;
  plan_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  trial_ends_at: string | null;
  subscription_plans: SubscriptionPlan;
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });
      
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
}

export function useCurrentSubscription() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  return useQuery({
    queryKey: ['company-subscription', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase
        .from('company_subscriptions')
        .select(`
          id,
          plan_id,
          status,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          trial_ends_at,
          subscription_plans (
            id,
            name,
            display_name,
            price_monthly,
            price_yearly,
            max_users,
            max_jobs_per_month,
            features,
            stripe_product_id,
            stripe_price_id_monthly,
            stripe_price_id_yearly
          )
        `)
        .eq('company_id', companyId)
        .in('status', ['active', 'trialing'])
        .maybeSingle();
      
      if (error) throw error;
      return data as CompanySubscription | null;
    },
    enabled: !!companyId,
    staleTime: 60 * 1000, // Cache for 1 minute
  });
}

export function useSubscriptionActions() {
  const startCheckout = async (priceId: string) => {
    const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
      body: { priceId },
    });
    
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, '_blank');
    }
    return data;
  };

  const openCustomerPortal = async () => {
    const { data, error } = await supabase.functions.invoke('customer-portal');
    
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, '_blank');
    }
    return data;
  };

  return { startCheckout, openCustomerPortal };
}
