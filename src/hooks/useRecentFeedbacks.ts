import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompany';

export interface RecentFeedback {
  id: string;
  job_id: string;
  customer_id: string;
  company_id: string;
  rating: number;
  feedback_text: string | null;
  is_negative: boolean;
  created_at: string;
  job: {
    job_number: string;
    title: string;
    assignees?: {
      profile: {
        id: string;
        full_name: string | null;
      };
    }[];
  };
  customer: {
    name: string;
  };
}

export const useRecentFeedbacks = (limit: number = 5) => {
  const { data: company } = useCompany();

  return useQuery({
    queryKey: ['recent-feedbacks', company?.id, limit],
    queryFn: async () => {
      if (!company?.id) return [];

      const { data, error } = await supabase
        .from('job_feedbacks')
        .select(`
          *,
          job:jobs(
            job_number,
            title,
            assignees:job_assignees(
              profile:profiles(id, full_name)
            )
          ),
          customer:customers(name)
        `)
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as RecentFeedback[];
    },
    enabled: !!company?.id,
  });
};
