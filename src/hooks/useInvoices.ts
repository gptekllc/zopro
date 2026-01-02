import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { invoiceSchema, itemSchema, sanitizeErrorMessage } from '@/lib/validation';
import { calculateDiscountAmount } from '@/components/ui/discount-input';

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  company_id: string;
  customer_id: string;
  quote_id: string | null;
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  tax: number;
  total: number;
  discount_type: 'amount' | 'percentage' | null;
  discount_value: number | null;
  late_fee_amount: number | null;
  late_fee_applied_at: string | null;
  notes: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
  customer?: { name: string; email?: string | null };
  creator?: { full_name: string | null };
  assigned_technician?: { full_name: string | null };
  quote?: { 
    job?: { 
      assigned_technician?: { full_name: string | null } | null 
    } | null 
  } | null;
}

// Helper to check if invoice is overdue
export function isInvoiceOverdue(invoice: Invoice): boolean {
  if (invoice.status === 'paid' || invoice.status === 'cancelled') return false;
  if (!invoice.due_date) return false;
  return new Date(invoice.due_date) < new Date();
}

// Calculate late fee for an invoice
export function calculateLateFee(invoice: Invoice, lateFeePercentage: number): number {
  if (!isInvoiceOverdue(invoice)) return 0;
  if (lateFeePercentage <= 0) return 0;
  return Number(invoice.total) * (lateFeePercentage / 100);
}

// Get total amount due including late fee
export function getTotalWithLateFee(invoice: Invoice): number {
  return Number(invoice.total) + Number(invoice.late_fee_amount || 0);
}

export function useInvoices(includeArchived: boolean = false) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['invoices', profile?.company_id, includeArchived],
    queryFn: async () => {
      let query = (supabase as any)
        .from('invoices')
        .select(`
          *,
          customer:customers(name, email),
          creator:profiles!invoices_created_by_fkey(full_name),
          assigned_technician:profiles!invoices_assigned_to_fkey(full_name),
          items:invoice_items(*),
          quote:quotes(
            job:jobs!quotes_job_id_fkey(
              assigned_technician:profiles!jobs_assigned_to_fkey(full_name)
            )
          )
        `)
        .order('created_at', { ascending: false });
      
      if (!includeArchived) {
        query = query.is('archived_at', null);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!profile?.company_id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      items, 
      ...invoice 
    }: Omit<Invoice, 'id' | 'company_id' | 'invoice_number' | 'created_at' | 'updated_at'> & { items: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>[] }) => {
      if (!profile?.company_id) throw new Error('No company associated');
      
      // Validate invoice data
      const invoiceValidation = invoiceSchema.safeParse(invoice);
      if (!invoiceValidation.success) {
        const firstError = invoiceValidation.error.errors[0];
        throw new Error(firstError?.message || 'Validation failed');
      }
      
      // Validate each item
      for (const item of items) {
        const itemValidation = itemSchema.safeParse(item);
        if (!itemValidation.success) {
          const firstError = itemValidation.error.errors[0];
          throw new Error(firstError?.message || 'Item validation failed');
        }
      }
      
      // Generate invoice number using database function
      const { data: invoiceNumberData, error: invoiceNumberError } = await (supabase as any)
        .rpc('generate_invoice_number', { _company_id: profile.company_id });
      
      if (invoiceNumberError) throw invoiceNumberError;
      const invoiceNumber = invoiceNumberData;
      
      // Fetch company tax rate
      const { data: company } = await (supabase as any)
        .from('companies')
        .select('tax_rate')
        .eq('id', profile.company_id)
        .single();
      
      const taxRate = (company?.tax_rate ?? 8.25) / 100;
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const discountAmount = calculateDiscountAmount(subtotal, (invoiceValidation.data as any).discount_type, (invoiceValidation.data as any).discount_value);
      const afterDiscount = subtotal - discountAmount;
      const tax = afterDiscount * taxRate;
      const total = afterDiscount + tax;
      
      // Create invoice
      const { data: invoiceData, error: invoiceError } = await (supabase as any)
        .from('invoices')
        .insert({
          ...invoiceValidation.data,
          company_id: profile.company_id,
          invoice_number: invoiceNumber,
          subtotal,
          tax,
          total,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (invoiceError) throw invoiceError;
      
      // Create invoice items
      if (items.length > 0) {
        const { error: itemsError } = await (supabase as any)
          .from('invoice_items')
          .insert(
            items.map(item => ({
              invoice_id: invoiceData.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.quantity * item.unit_price,
            }))
          );
        
        if (itemsError) throw itemsError;
      }
      
      return invoiceData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice created successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to create invoice: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, items, ...data }: Partial<Invoice> & { id: string; items?: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>[] }) => {
      // Update invoice
      const { error: invoiceError } = await (supabase as any)
        .from('invoices')
        .update(data)
        .eq('id', id);
      
      if (invoiceError) throw invoiceError;
      
      // Update items if provided
      if (items) {
        // Delete existing items
        await (supabase as any)
          .from('invoice_items')
          .delete()
          .eq('invoice_id', id);
        
        // Insert new items
        if (items.length > 0) {
          const { error: itemsError } = await (supabase as any)
            .from('invoice_items')
            .insert(
              items.map(item => ({
                invoice_id: id,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: item.quantity * item.unit_price,
              }))
            );
          
          if (itemsError) throw itemsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice updated successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to update invoice: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('invoices')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice deleted');
    },
    onError: (error: unknown) => {
      toast.error('Failed to delete invoice: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useArchiveInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('invoices')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice archived');
    },
    onError: (error: unknown) => {
      toast.error('Failed to archive invoice: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useUnarchiveInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('invoices')
        .update({ archived_at: null })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice restored');
    },
    onError: (error: unknown) => {
      toast.error('Failed to restore invoice: ' + sanitizeErrorMessage(error));
    },
  });
}

// Apply late fee to an overdue invoice
export function useApplyLateFee() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ invoiceId, lateFeePercentage }: { invoiceId: string; lateFeePercentage: number }) => {
      // Get the invoice with customer and company info
      const { data: invoice, error: fetchError } = await (supabase as any)
        .from('invoices')
        .select(`
          total, status, due_date, late_fee_amount, invoice_number, company_id,
          customer:customers(name, email),
          company:companies(name, email)
        `)
        .eq('id', invoiceId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Check if already has late fee
      if (invoice.late_fee_amount && invoice.late_fee_amount > 0) {
        throw new Error('Late fee already applied');
      }
      
      // Check if overdue
      if (invoice.status === 'paid' || invoice.status === 'cancelled') {
        throw new Error('Cannot apply late fee to paid or cancelled invoice');
      }
      
      if (!invoice.due_date || new Date(invoice.due_date) >= new Date()) {
        throw new Error('Invoice is not overdue');
      }
      
      // Calculate late fee
      const lateFeeAmount = Number(invoice.total) * (lateFeePercentage / 100);
      const newTotal = Number(invoice.total) + lateFeeAmount;
      
      // Update invoice with late fee
      const { error: updateError } = await (supabase as any)
        .from('invoices')
        .update({
          late_fee_amount: lateFeeAmount,
          late_fee_applied_at: new Date().toISOString(),
          status: 'overdue',
        })
        .eq('id', invoiceId);
      
      if (updateError) throw updateError;
      
      // Send email notification if customer has email
      if (invoice.customer?.email && invoice.company?.email) {
        try {
          await supabase.functions.invoke('send-payment-notification', {
            body: {
              type: 'late_fee_applied',
              invoiceNumber: invoice.invoice_number,
              customerName: invoice.customer.name || 'Customer',
              customerEmail: invoice.customer.email,
              companyName: invoice.company.name || 'Company',
              companyEmail: invoice.company.email,
              originalAmount: Number(invoice.total),
              lateFeeAmount: lateFeeAmount,
              lateFeePercentage: lateFeePercentage,
              amount: newTotal,
              dueDate: invoice.due_date,
            },
          });
        } catch (emailError) {
          console.error('Failed to send late fee notification email:', emailError);
          // Don't throw - the late fee was still applied successfully
        }
      }
      
      return { lateFeeAmount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(`Late fee of $${data.lateFeeAmount.toFixed(2)} applied and customer notified`);
    },
    onError: (error: unknown) => {
      toast.error('Failed to apply late fee: ' + sanitizeErrorMessage(error));
    },
  });
}

// Send payment reminder email
export function useSendPaymentReminder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      // Get the invoice with customer and company info
      const { data: invoice, error: fetchError } = await (supabase as any)
        .from('invoices')
        .select(`
          total, status, due_date, late_fee_amount, invoice_number, company_id,
          customer:customers(name, email),
          company:companies(name, email)
        `)
        .eq('id', invoiceId)
        .single();
      
      if (fetchError) throw fetchError;
      
      if (invoice.status === 'paid') {
        throw new Error('Invoice is already paid');
      }
      
      if (!invoice.customer?.email) {
        throw new Error('Customer does not have an email address');
      }
      
      if (!invoice.company?.email) {
        throw new Error('Company email is not configured');
      }
      
      const totalDue = Number(invoice.total) + Number(invoice.late_fee_amount || 0);
      
      // Send reminder email
      const { error: emailError } = await supabase.functions.invoke('send-payment-notification', {
        body: {
          type: 'payment_reminder',
          invoiceNumber: invoice.invoice_number,
          customerName: invoice.customer.name || 'Customer',
          customerEmail: invoice.customer.email,
          companyName: invoice.company.name || 'Company',
          companyEmail: invoice.company.email,
          amount: Number(invoice.total),
          lateFeeAmount: invoice.late_fee_amount ? Number(invoice.late_fee_amount) : undefined,
          dueDate: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : undefined,
        },
      });
      
      if (emailError) throw emailError;
      
      // Update invoice status to 'sent' if it's still in draft
      if (invoice.status === 'draft') {
        await (supabase as any)
          .from('invoices')
          .update({ status: 'sent' })
          .eq('id', invoiceId);
      }
      
      // Record the reminder in the database
      const { error: insertError } = await (supabase as any)
        .from('invoice_reminders')
        .insert({
          invoice_id: invoiceId,
          company_id: invoice.company_id,
          sent_by: user?.id,
          recipient_email: invoice.customer.email,
        });
      
      if (insertError) {
        console.error('Failed to record reminder:', insertError);
        // Don't throw - email was sent successfully
      }
      
      return { customerEmail: invoice.customer.email };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-reminders'] });
      toast.success(`Payment reminder sent to ${data.customerEmail}`);
    },
    onError: (error: unknown) => {
      toast.error('Failed to send reminder: ' + sanitizeErrorMessage(error));
    },
  });
}

// Fetch reminder history for an invoice
export function useInvoiceReminders(invoiceId: string | null) {
  return useQuery({
    queryKey: ['invoice-reminders', invoiceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('invoice_reminders')
        .select(`
          *,
          sent_by_profile:profiles!invoice_reminders_sent_by_fkey(full_name)
        `)
        .eq('invoice_id', invoiceId)
        .order('sent_at', { ascending: false });
      
      if (error) throw error;
      return data as Array<{
        id: string;
        invoice_id: string;
        sent_at: string;
        recipient_email: string;
        sent_by_profile?: { full_name: string | null };
      }>;
    },
    enabled: !!invoiceId,
  });
}
