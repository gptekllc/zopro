import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface ConvertToInvoiceParams {
  quoteId: string;
  dueDate?: string;
  copyPhotos?: boolean;
}

export function useConvertQuoteToInvoice() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();

  return useMutation({
    mutationFn: async ({ quoteId, dueDate, copyPhotos = true }: ConvertToInvoiceParams) => {
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

      // Generate invoice number using database function
      const { data: invoiceNumberData, error: invoiceNumberError } = await (supabase as any)
        .rpc('generate_invoice_number', { p_company_id: profile.company_id });

      if (invoiceNumberError) throw invoiceNumberError;
      const invoiceNumber = invoiceNumberData;

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

      // Copy quote photos to invoice using media asset linking (no file duplication!)
      if (copyPhotos) {
        // Use the database function to copy links - this only duplicates link records, not files
        await supabase.rpc('copy_document_media_links', {
          p_source_entity_type: 'quote',
          p_source_entity_id: quoteId,
          p_target_entity_type: 'invoice',
          p_target_entity_id: invoice.id,
        });
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
  type: 'quote' | 'invoice' | 'job';
  documentId: string;
  recipientEmail: string;
  recipientEmails?: string[];
  customSubject?: string;
  customMessage?: string;
  ccEmails?: string[];
  bccEmails?: string[];
  senderName?: string;
}

export function useEmailDocument() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ type, documentId, recipientEmail, recipientEmails, customSubject, customMessage, ccEmails, bccEmails, senderName }: EmailDocumentParams) => {
      // Use recipientEmails array if provided, otherwise fall back to single recipientEmail
      const emails = recipientEmails && recipientEmails.length > 0 
        ? recipientEmails 
        : [recipientEmail].filter(Boolean);
      
      // Use provided senderName or fall back to current user's name
      const actualSenderName = senderName || profile?.full_name || '';
      
      // Send to each recipient
      const results = await Promise.all(
        emails.map(async (email) => {
          const { data, error } = await supabase.functions.invoke('generate-pdf', {
            body: {
              type,
              documentId,
              action: 'email',
              recipientEmail: email,
              customSubject,
              customMessage,
              ccEmails,
              bccEmails,
              senderName: actualSenderName,
            },
          });

          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          
          return { email, success: true };
        })
      );
      
      return { emails, count: results.length };
    },
    onSuccess: (data, variables) => {
      const queryKey = variables.type === 'quote' ? 'quotes' : variables.type === 'invoice' ? 'invoices' : 'jobs';
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(`Email sent to ${data.count} recipient${data.count > 1 ? 's' : ''}`);
    },
    onError: (error: any) => {
      toast.error('Failed to send email: ' + error.message);
    },
  });
}

interface DownloadDocumentParams {
  type: 'quote' | 'invoice' | 'job';
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
      if (data?.error) throw new Error(data.error);

      // Convert base64 PDF to blob and trigger download
      const binaryString = atob(data.pdfBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      // Create a link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data.documentNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return data;
    },
    onError: (error: any) => {
      toast.error('Failed to generate document: ' + error.message);
    },
  });
}
