import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface JobActivity {
  id: string;
  job_id: string;
  company_id: string;
  activity_type: 'status_change' | 'priority_change' | 'quote_created' | 'invoice_created';
  old_value: string | null;
  new_value: string | null;
  related_document_id: string | null;
  performed_by: string | null;
  created_at: string;
  performer?: {
    full_name: string | null;
  } | null;
}

export function useJobActivities(jobId: string | null) {
  return useQuery({
    queryKey: ['job_activities', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      
      const { data, error } = await supabase
        .from('job_activities')
        .select(`
          *,
          performer:profiles!job_activities_performed_by_fkey(full_name)
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as JobActivity[];
    },
    enabled: !!jobId,
    staleTime: 30000, // Cache for 30 seconds to reduce refetches
  });
}

export function useRecordJobActivity() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      jobId,
      activityType,
      oldValue,
      newValue,
      relatedDocumentId,
    }: {
      jobId: string;
      activityType: 'status_change' | 'priority_change' | 'quote_created' | 'invoice_created';
      oldValue?: string;
      newValue?: string;
      relatedDocumentId?: string;
    }) => {
      if (!profile?.company_id) throw new Error('No company ID');

      const { error } = await supabase
        .from('job_activities')
        .insert({
          job_id: jobId,
          company_id: profile.company_id,
          activity_type: activityType,
          old_value: oldValue || null,
          new_value: newValue || null,
          related_document_id: relatedDocumentId || null,
          performed_by: profile.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job_activities'] });
    },
  });
}
