import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/validation';

interface SendSignatureRequestParams {
  documentType: 'quote' | 'invoice' | 'job';
  documentId: string;
  recipientEmail: string;
  recipientName: string;
  companyName: string;
  documentNumber: string;
  customerId: string;
}

export function useSendSignatureRequest() {
  return useMutation({
    mutationFn: async (params: SendSignatureRequestParams) => {
      if (!params.recipientEmail) {
        throw new Error('Customer does not have an email address on file');
      }

      const { data, error } = await supabase.functions.invoke('send-signature-request', {
        body: params,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, variables) => {
      const typeLabels = {
        quote: 'quote',
        invoice: 'invoice',
        job: 'job completion',
      };
      toast.success(`Signature request sent for ${typeLabels[variables.documentType]}`);
    },
    onError: (error: unknown) => {
      toast.error('Failed to send signature request: ' + sanitizeErrorMessage(error));
    },
  });
}
