import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompany';

export interface FeedbackHistoryEntry {
  id: string;
  feedback_id: string | null;
  job_id: string;
  customer_id: string;
  company_id: string;
  action_type: 'created' | 'edited' | 'deleted';
  old_rating: number | null;
  new_rating: number | null;
  old_feedback_text: string | null;
  new_feedback_text: string | null;
  created_at: string;
  customer?: {
    name: string;
  };
}

export const useFeedbackHistory = (jobId: string | null) => {
  const { data: company } = useCompany();

  return useQuery({
    queryKey: ['feedback-history', jobId],
    queryFn: async () => {
      if (!jobId) return [];

      const { data, error } = await supabase
        .from('job_feedback_history')
        .select('*, customer:customers(name)')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as FeedbackHistoryEntry[];
    },
    enabled: !!jobId && !!company?.id,
  });
};
