import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/validation';

export interface SignatureHistoryEvent {
  id: string;
  signature_id: string | null;
  document_type: string;
  document_id: string;
  company_id: string;
  customer_id: string | null;
  event_type: 'signed' | 'cleared';
  signer_name: string | null;
  performed_by: string | null;
  created_at: string;
  performer?: {
    full_name: string | null;
  } | null;
}

export function useSignatureHistory(documentType: string, documentId: string | null) {
  return useQuery({
    queryKey: ['signature-history', documentType, documentId],
    queryFn: async () => {
      if (!documentId) return [];
      
      const { data, error } = await supabase
        .from('signature_history')
        .select(`
          *,
          performer:profiles!signature_history_performed_by_fkey(full_name)
        `)
        .eq('document_type', documentType)
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SignatureHistoryEvent[];
    },
    enabled: !!documentId,
  });
}

export function useClearJobSignature() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ jobId, signatureId, customerId }: {
      jobId: string;
      signatureId: string;
      customerId: string;
    }) => {
      if (!profile?.company_id) throw new Error('No company ID');

      // Get signature details before clearing
      const { data: signature } = await supabase
        .from('signatures')
        .select('signer_name')
        .eq('id', signatureId)
        .single();

      // Record the cleared event in history
      const { error: historyError } = await supabase
        .from('signature_history')
        .insert({
          signature_id: signatureId,
          document_type: 'job',
          document_id: jobId,
          company_id: profile.company_id,
          customer_id: customerId,
          event_type: 'cleared',
          signer_name: signature?.signer_name || null,
          performed_by: profile.id,
        });

      if (historyError) throw historyError;

      // Clear the signature from the job
      const { error: jobError } = await supabase
        .from('jobs')
        .update({
          completion_signature_id: null,
          completion_signed_at: null,
          completion_signed_by: null,
        })
        .eq('id', jobId);

      if (jobError) throw jobError;

      return { jobId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
      queryClient.invalidateQueries({ queryKey: ['signature-history'] });
      toast.success('Signature cleared successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to clear signature: ' + sanitizeErrorMessage(error));
    },
  });
}

// Record signature event when a signature is collected
export function useRecordSignatureEvent() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      signatureId,
      documentType,
      documentId,
      customerId,
      signerName,
    }: {
      signatureId: string;
      documentType: string;
      documentId: string;
      customerId: string;
      signerName: string;
    }) => {
      if (!profile?.company_id) throw new Error('No company ID');

      const { error } = await supabase
        .from('signature_history')
        .insert({
          signature_id: signatureId,
          document_type: documentType,
          document_id: documentId,
          company_id: profile.company_id,
          customer_id: customerId,
          event_type: 'signed',
          signer_name: signerName,
          performed_by: profile.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signature-history'] });
    },
  });
}
