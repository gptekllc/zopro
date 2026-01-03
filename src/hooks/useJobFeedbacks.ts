import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompany';

export interface JobFeedback {
  id: string;
  job_id: string;
  customer_id: string;
  company_id: string;
  rating: number;
  feedback_text: string | null;
  is_negative: boolean;
  created_at: string;
  customer?: {
    name: string;
  };
}

export const useJobFeedbacks = (jobId: string | null) => {
  const { data: company } = useCompany();

  return useQuery({
    queryKey: ['job-feedbacks', jobId],
    queryFn: async () => {
      if (!jobId) return [];

      const { data, error } = await supabase
        .from('job_feedbacks')
        .select('*, customer:customers(name)')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as JobFeedback[];
    },
    enabled: !!jobId && !!company?.id,
  });
};
