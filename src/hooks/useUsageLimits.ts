import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { startOfMonth, endOfMonth } from 'date-fns';

interface UsageLimits {
  // Current usage
  currentUsers: number;
  currentJobsThisMonth: number;
  
  // Limits from plan
  maxUsers: number | null; // null = unlimited
  maxJobsPerMonth: number | null; // null = unlimited
  
  // Computed
  usersRemaining: number | null;
  jobsRemaining: number | null;
  isNearUserLimit: boolean;
  isNearJobLimit: boolean;
  isAtUserLimit: boolean;
  isAtJobLimit: boolean;
  
  // Plan info
  planName: string | null;
  isLoading: boolean;
}

export function useUsageLimits(): UsageLimits {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  
  // Fetch subscription plan limits
  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: ['plan-limits', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase
        .from('company_subscriptions')
        .select(`
          subscription_plans (
            name,
            display_name,
            max_users,
            max_jobs_per_month
          )
        `)
        .eq('company_id', companyId)
        .in('status', ['active', 'trialing'])
        .maybeSingle();
      
      if (error) throw error;
      return data?.subscription_plans as {
        name: string;
        display_name: string;
        max_users: number | null;
        max_jobs_per_month: number | null;
      } | null;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
  
  // Count current team members
  const { data: userCount = 0, isLoading: usersLoading } = useQuery({
    queryKey: ['team-count', companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .in('role', ['admin', 'manager', 'technician'])
        .is('deleted_at', null);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
  
  // Count jobs this month
  const { data: jobCount = 0, isLoading: jobsLoading } = useQuery({
    queryKey: ['monthly-job-count', companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();
      
      const { count, error } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
  
  const maxUsers = planData?.max_users ?? null;
  const maxJobs = planData?.max_jobs_per_month ?? null;
  
  const usersRemaining = maxUsers !== null ? Math.max(0, maxUsers - userCount) : null;
  const jobsRemaining = maxJobs !== null ? Math.max(0, maxJobs - jobCount) : null;
  
  // Near limit = 80% or higher usage
  const isNearUserLimit = maxUsers !== null && userCount >= maxUsers * 0.8;
  const isNearJobLimit = maxJobs !== null && jobCount >= maxJobs * 0.8;
  
  const isAtUserLimit = maxUsers !== null && userCount >= maxUsers;
  const isAtJobLimit = maxJobs !== null && jobCount >= maxJobs;
  
  return {
    currentUsers: userCount,
    currentJobsThisMonth: jobCount,
    maxUsers,
    maxJobsPerMonth: maxJobs,
    usersRemaining,
    jobsRemaining,
    isNearUserLimit,
    isNearJobLimit,
    isAtUserLimit,
    isAtJobLimit,
    planName: planData?.display_name ?? null,
    isLoading: planLoading || usersLoading || jobsLoading,
  };
}
