import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface DocumentMinNumbers {
  job: number;
  quote: number;
  invoice: number;
}

export const useDocumentMinNumbers = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['document-min-numbers', user?.id],
    queryFn: async (): Promise<DocumentMinNumbers> => {
      // Get the user's profile to find their company
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user?.id ?? '')
        .single();

      if (!profile?.company_id) {
        return { job: 1, quote: 1, invoice: 1 };
      }

      // Get the highest sequence number for each document type
      const [jobsResult, quotesResult, invoicesResult] = await Promise.all([
        supabase
          .from('jobs')
          .select('job_number')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('quotes')
          .select('quote_number')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('invoices')
          .select('invoice_number')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      // Extract the sequence number from document numbers (the trailing digits)
      const extractSeq = (docNumber: string): number => {
        const match = docNumber.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      };

      const maxJobSeq = (jobsResult.data || [])
        .map(j => extractSeq(j.job_number))
        .reduce((max, seq) => Math.max(max, seq), 0);

      const maxQuoteSeq = (quotesResult.data || [])
        .map(q => extractSeq(q.quote_number))
        .reduce((max, seq) => Math.max(max, seq), 0);

      const maxInvoiceSeq = (invoicesResult.data || [])
        .map(i => extractSeq(i.invoice_number))
        .reduce((max, seq) => Math.max(max, seq), 0);

      // Next number must be at least max + 1
      return {
        job: maxJobSeq + 1,
        quote: maxQuoteSeq + 1,
        invoice: maxInvoiceSeq + 1,
      };
    },
    enabled: !!user?.id,
    staleTime: 30000, // Cache for 30 seconds
  });
};
