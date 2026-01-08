import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// All available feature flags
export const FEATURE_FLAGS = {
  jobs: 'Create and manage jobs',
  quotes: 'Create and send quotes',
  invoices: 'Create and send invoices',
  time_clock: 'Time tracking and clock in/out',
  reports: 'View business reports',
  team_members: 'Manage team members',
  customer_portal: 'Customer self-service portal',
  email_templates: 'Custom email templates',
  stripe_payments: 'Accept online payments via Stripe',
  photo_uploads: 'Upload photos to jobs/invoices',
  signatures: 'Capture customer signatures',
  api_access: 'API access for integrations',
  white_label: 'White-label branding',
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

interface FeatureOverride {
  feature_key: string;
  enabled: boolean;
  reason?: string;
}

interface PlanFeatures {
  [key: string]: boolean;
}

export function useFeatureFlags() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  // Fetch company's subscription plan features
  const { data: planFeatures } = useQuery({
    queryKey: ['plan-features', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase
        .from('company_subscriptions')
        .select(`
          subscription_plans (features)
        `)
        .eq('company_id', companyId)
        .eq('status', 'active')
        .maybeSingle();
      
      if (error) throw error;
      
      // Also check trialing status
      if (!data) {
        const { data: trialData } = await supabase
          .from('company_subscriptions')
          .select(`subscription_plans (features)`)
          .eq('company_id', companyId)
          .eq('status', 'trialing')
          .maybeSingle();
        return (trialData?.subscription_plans as any)?.features as PlanFeatures || null;
      }
      
      return (data?.subscription_plans as any)?.features as PlanFeatures || null;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch company-specific overrides
  const { data: overrides = [] } = useQuery({
    queryKey: ['feature-overrides', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('company_feature_overrides')
        .select('feature_key, enabled, reason')
        .eq('company_id', companyId);
      
      if (error) throw error;
      return data as FeatureOverride[];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  // Check if a specific feature is enabled
  const isFeatureEnabled = (feature: FeatureFlag): boolean => {
    // Check for company-specific override first
    const override = overrides.find(o => o.feature_key === feature);
    if (override) {
      return override.enabled;
    }
    
    // Fall back to plan features
    if (planFeatures && feature in planFeatures) {
      return planFeatures[feature];
    }
    
    // Default: if no plan, assume free tier (basic features only)
    return ['jobs', 'quotes', 'invoices'].includes(feature);
  };

  // Get all features with their status
  const getAllFeatures = (): Record<FeatureFlag, boolean> => {
    const result = {} as Record<FeatureFlag, boolean>;
    for (const key of Object.keys(FEATURE_FLAGS) as FeatureFlag[]) {
      result[key] = isFeatureEnabled(key);
    }
    return result;
  };

  return {
    isFeatureEnabled,
    getAllFeatures,
    planFeatures,
    overrides,
    isLoading: !planFeatures && !!companyId,
  };
}

// Simple hook for checking a single feature
export function useFeature(feature: FeatureFlag): boolean {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled(feature);
}
