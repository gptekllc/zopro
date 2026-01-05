import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Payment {
  id: string;
  invoice_id: string;
  company_id: string;
  amount: number;
  method: string;
  payment_date: string;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  recorded_by_profile?: { full_name: string | null } | null;
}

export function usePayments(invoiceId: string | null) {
  return useQuery({
    queryKey: ['payments', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      
      const { data, error } = await (supabase as any)
        .from('payments')
        .select(`
          *,
          recorded_by_profile:profiles!payments_recorded_by_fkey(full_name)
        `)
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!invoiceId,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      invoiceId, 
      amount, 
      method, 
      paymentDate, 
      notes,
      sendNotification = true 
    }: { 
      invoiceId: string; 
      amount: number; 
      method: string; 
      paymentDate: Date; 
      notes?: string;
      sendNotification?: boolean;
    }) => {
      if (!profile?.company_id) throw new Error('No company associated');
      
      // Create payment record
      const { data: payment, error: paymentError } = await (supabase as any)
        .from('payments')
        .insert({
          invoice_id: invoiceId,
          company_id: profile.company_id,
          amount,
          method,
          payment_date: paymentDate.toISOString(),
          notes: notes || null,
          recorded_by: user?.id,
        })
        .select()
        .single();
      
      if (paymentError) throw paymentError;
      
      // Get invoice with totals to check if fully paid
      const { data: invoice, error: invoiceError } = await (supabase as any)
        .from('invoices')
        .select(`
          total, late_fee_amount, invoice_number, company_id,
          customer:customers(name, email),
          company:companies(name, email)
        `)
        .eq('id', invoiceId)
        .single();
      
      if (invoiceError) throw invoiceError;
      
      // Get all payments for this invoice to calculate total paid
      const { data: allPayments, error: paymentsError } = await (supabase as any)
        .from('payments')
        .select('amount')
        .eq('invoice_id', invoiceId);
      
      if (paymentsError) throw paymentsError;
      
      const totalPaid = allPayments.reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0);
      const totalDue = Number(invoice.total) + Number(invoice.late_fee_amount || 0);
      const isFullyPaid = totalPaid >= totalDue;
      
      // Update invoice status if fully paid
      if (isFullyPaid) {
        await (supabase as any)
          .from('invoices')
          .update({ 
            status: 'paid',
            paid_at: paymentDate.toISOString()
          })
          .eq('id', invoiceId);
      }
      
      // Send email notification if customer has email
      if (sendNotification && invoice.customer?.email && invoice.company?.email) {
        try {
          await supabase.functions.invoke('send-payment-notification', {
            body: {
              type: 'payment_recorded',
              invoiceNumber: invoice.invoice_number,
              customerName: invoice.customer.name || 'Customer',
              customerEmail: invoice.customer.email,
              companyName: invoice.company.name || 'Company',
              companyEmail: invoice.company.email,
              paymentAmount: amount,
              paymentMethod: method,
              totalPaid,
              totalDue,
              remainingBalance: Math.max(0, totalDue - totalPaid),
              isFullyPaid,
            },
          });
        } catch (emailError) {
          console.error('Failed to send payment notification email:', emailError);
          // Don't throw - the payment was still recorded successfully
        }
      }
      
      return { payment, isFullyPaid, totalPaid, totalDue };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (data.isFullyPaid) {
        toast.success('Payment recorded - Invoice fully paid!');
      } else {
        const remaining = data.totalDue - data.totalPaid;
        toast.success(`Payment recorded - $${remaining.toFixed(2)} remaining`);
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to record payment: ' + message);
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ paymentId, invoiceId }: { paymentId: string; invoiceId: string }) => {
      const { error } = await (supabase as any)
        .from('payments')
        .delete()
        .eq('id', paymentId);
      
      if (error) throw error;
      
      // Check remaining payments and update invoice status
      const { data: remainingPayments } = await (supabase as any)
        .from('payments')
        .select('amount')
        .eq('invoice_id', invoiceId);
      
      const { data: invoice } = await (supabase as any)
        .from('invoices')
        .select('total, late_fee_amount, status')
        .eq('id', invoiceId)
        .single();
      
      if (invoice) {
        const totalPaid = (remainingPayments || []).reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0);
        const totalDue = Number(invoice.total) + Number(invoice.late_fee_amount || 0);
        
        // If was paid but now has remaining balance, update status
        if (invoice.status === 'paid' && totalPaid < totalDue) {
          await (supabase as any)
            .from('invoices')
            .update({ 
              status: 'sent',
              paid_at: null
            })
            .eq('id', invoiceId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Payment deleted');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to delete payment: ' + message);
    },
  });
}

// Get remaining balance for an invoice
export function useInvoiceBalance(invoiceId: string | null) {
  const { data: payments = [] } = usePayments(invoiceId);
  
  return useQuery({
    queryKey: ['invoice-balance', invoiceId, payments],
    queryFn: async () => {
      if (!invoiceId) return { totalDue: 0, totalPaid: 0, remaining: 0 };
      
      const { data: invoice } = await (supabase as any)
        .from('invoices')
        .select('total, late_fee_amount')
        .eq('id', invoiceId)
        .single();
      
      if (!invoice) return { totalDue: 0, totalPaid: 0, remaining: 0 };
      
      const totalDue = Number(invoice.total) + Number(invoice.late_fee_amount || 0);
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const remaining = Math.max(0, totalDue - totalPaid);
      
      return { totalDue, totalPaid, remaining };
    },
    enabled: !!invoiceId,
  });
}
