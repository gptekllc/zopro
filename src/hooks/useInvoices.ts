import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { invoiceSchema, itemSchema, sanitizeErrorMessage } from '@/lib/validation';

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
  notes: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
  customer?: { name: string };
}

export function useInvoices() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['invoices', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('invoices')
        .select(`
          *,
          customer:customers(name),
          items:invoice_items(*)
        `)
        .order('created_at', { ascending: false });
      
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
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const tax = subtotal * 0.0825; // 8.25% tax
      const total = subtotal + tax;
      
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
