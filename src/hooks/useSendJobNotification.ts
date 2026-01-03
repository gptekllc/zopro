import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SendJobNotificationParams {
  jobId: string;
  customerId: string;
}

export function useSendJobNotification() {
  return useMutation({
    mutationFn: async ({ jobId, customerId }: SendJobNotificationParams) => {
      const { data, error } = await supabase.functions.invoke('send-job-notification', {
        body: { jobId, customerId },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || 'Notification sent to customer');
    },
    onError: (error: Error) => {
      console.error('Failed to send job notification:', error);
      toast.error('Failed to send notification: ' + error.message);
    },
  });
}
