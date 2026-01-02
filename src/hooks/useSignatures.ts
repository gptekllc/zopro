import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/validation';

interface SaveSignatureParams {
  documentType: 'quote' | 'invoice' | 'job';
  documentId: string;
  signatureData: string;
  signerName: string;
  customerId: string;
}

// Hook to approve a quote with signature (in-person)
export function useApproveQuoteWithSignature() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ quoteId, signatureData, signerName, customerId }: {
      quoteId: string;
      signatureData: string;
      signerName: string;
      customerId: string;
    }) => {
      if (!profile?.company_id) throw new Error('No company ID');

      // Create signature record
      const { data: signature, error: sigError } = await (supabase as any)
        .from('signatures')
        .insert({
          company_id: profile.company_id,
          customer_id: customerId,
          document_type: 'quote',
          document_id: quoteId,
          signature_data: signatureData,
          signer_name: signerName,
          signed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sigError) throw sigError;

      // Update quote with signature and set status to accepted
      const { error: quoteError } = await (supabase as any)
        .from('quotes')
        .update({
          signature_id: signature.id,
          signed_at: new Date().toISOString(),
          status: 'accepted',
        })
        .eq('id', quoteId);

      if (quoteError) throw quoteError;

      return signature;
    },
    onSuccess: (signature) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['signature', signature.id] });
      toast.success('Quote approved with signature');
    },
    onError: (error: unknown) => {
      toast.error('Failed to save signature: ' + sanitizeErrorMessage(error));
    },
  });
}

// Hook to sign an invoice (in-person)
export function useSignInvoice() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ invoiceId, signatureData, signerName, customerId }: {
      invoiceId: string;
      signatureData: string;
      signerName: string;
      customerId: string;
    }) => {
      if (!profile?.company_id) throw new Error('No company ID');

      // Create signature record
      const { data: signature, error: sigError } = await (supabase as any)
        .from('signatures')
        .insert({
          company_id: profile.company_id,
          customer_id: customerId,
          document_type: 'invoice',
          document_id: invoiceId,
          signature_data: signatureData,
          signer_name: signerName,
          signed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sigError) throw sigError;

      // Update invoice with signature
      const { error: invoiceError } = await (supabase as any)
        .from('invoices')
        .update({
          signature_id: signature.id,
          signed_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

      return signature;
    },
    onSuccess: (signature) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['signature', signature.id] });
      toast.success('Invoice signed successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to save signature: ' + sanitizeErrorMessage(error));
    },
  });
}

// Hook to sign job completion (in-person)
export function useSignJobCompletion() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ jobId, signatureData, signerName, customerId }: {
      jobId: string;
      signatureData: string;
      signerName: string;
      customerId: string;
    }) => {
      if (!profile?.company_id) throw new Error('No company ID');

      // Create signature record
      const { data: signature, error: sigError } = await (supabase as any)
        .from('signatures')
        .insert({
          company_id: profile.company_id,
          customer_id: customerId,
          document_type: 'job',
          document_id: jobId,
          signature_data: signatureData,
          signer_name: signerName,
          signed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sigError) throw sigError;

      // Update job with completion signature
      const { error: jobError } = await (supabase as any)
        .from('jobs')
        .update({
          completion_signature_id: signature.id,
          completion_signed_at: new Date().toISOString(),
          completion_signed_by: signerName,
        })
        .eq('id', jobId);

      if (jobError) throw jobError;

      return signature;
    },
    onSuccess: (signature) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
      queryClient.invalidateQueries({ queryKey: ['signature', signature.id] });
      toast.success('Job completion signed successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to save signature: ' + sanitizeErrorMessage(error));
    },
  });
}
