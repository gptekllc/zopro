import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface ConvertToInvoiceParams {
  quoteId: string;
  dueDate?: string;
}

export function useConvertQuoteToInvoice() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();

  return useMutation({
    mutationFn: async ({ quoteId, dueDate }: ConvertToInvoiceParams) => {
      if (!profile?.company_id) throw new Error('No company associated');

      // Fetch the quote with items
      const { data: quote, error: quoteError } = await (supabase as any)
        .from('quotes')
        .select('*, items:quote_items(*)')
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;

      if (quote.status !== 'accepted' && quote.status !== 'approved') {
        throw new Error('Only approved/accepted quotes can be converted to invoices');
      }

      // Get next invoice number
      const { count } = await (supabase as any)
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id);

      const invoiceNumber = `INV-${String((count || 0) + 1).padStart(3, '0')}`;

      // Create invoice
      const { data: invoice, error: invoiceError } = await (supabase as any)
        .from('invoices')
        .insert({
          company_id: profile.company_id,
          customer_id: quote.customer_id,
          quote_id: quoteId,
          invoice_number: invoiceNumber,
          status: 'draft',
          subtotal: quote.subtotal,
          tax: quote.tax,
          total: quote.total,
          notes: quote.notes,
          due_date: dueDate || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items from quote items
      if (quote.items && quote.items.length > 0) {
        const { error: itemsError } = await (supabase as any)
          .from('invoice_items')
          .insert(
            quote.items.map((item: any) => ({
              invoice_id: invoice.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.total,
            }))
          );

        if (itemsError) throw itemsError;
      }

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Invoice created from quote successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to convert quote: ' + error.message);
    },
  });
}

interface EmailDocumentParams {
  type: 'quote' | 'invoice';
  documentId: string;
  recipientEmail: string;
}

export function useEmailDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ type, documentId, recipientEmail }: EmailDocumentParams) => {
      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: {
          type,
          documentId,
          action: 'email',
          recipientEmail,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.type === 'quote' ? 'quotes' : 'invoices'] });
      toast.success('Email sent successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to send email: ' + error.message);
    },
  });
}

interface DownloadDocumentParams {
  type: 'quote' | 'invoice';
  documentId: string;
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: async ({ type, documentId }: DownloadDocumentParams) => {
      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: {
          type,
          documentId,
          action: 'download',
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Open HTML in new window for printing/saving as PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
        };
      }

      return data;
    },
    onError: (error: any) => {
      toast.error('Failed to generate document: ' + error.message);
    },
  });
}
