import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { quoteSchema, itemSchema, sanitizeErrorMessage } from '@/lib/validation';

export interface QuoteItem {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

export interface Quote {
  id: string;
  company_id: string;
  customer_id: string;
  quote_number: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  valid_until: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: QuoteItem[];
  customer?: { name: string };
}

export function useQuotes() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['quotes', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('quotes')
        .select(`
          *,
          customer:customers(name),
          items:quote_items(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!profile?.company_id,
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      items, 
      ...quote 
    }: Omit<Quote, 'id' | 'company_id' | 'quote_number' | 'created_at' | 'updated_at'> & { items: Omit<QuoteItem, 'id' | 'quote_id' | 'created_at'>[] }) => {
      if (!profile?.company_id) throw new Error('No company associated');
      
      // Validate quote data
      const quoteValidation = quoteSchema.safeParse(quote);
      if (!quoteValidation.success) {
        const firstError = quoteValidation.error.errors[0];
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
      
      // Get next quote number
      const { count } = await (supabase as any)
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id);
      
      const quoteNumber = `Q-${String((count || 0) + 1).padStart(3, '0')}`;
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const tax = subtotal * 0.0825; // 8.25% tax
      const total = subtotal + tax;
      
      // Create quote
      const { data: quoteData, error: quoteError } = await (supabase as any)
        .from('quotes')
        .insert({
          ...quoteValidation.data,
          company_id: profile.company_id,
          quote_number: quoteNumber,
          subtotal,
          tax,
          total,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (quoteError) throw quoteError;
      
      // Create quote items
      if (items.length > 0) {
        const { error: itemsError } = await (supabase as any)
          .from('quote_items')
          .insert(
            items.map(item => ({
              quote_id: quoteData.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.quantity * item.unit_price,
            }))
          );
        
        if (itemsError) throw itemsError;
      }
      
      return quoteData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote created successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to create quote: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, items, ...data }: Partial<Quote> & { id: string; items?: Omit<QuoteItem, 'id' | 'quote_id' | 'created_at'>[] }) => {
      // Update quote
      const { error: quoteError } = await (supabase as any)
        .from('quotes')
        .update(data)
        .eq('id', id);
      
      if (quoteError) throw quoteError;
      
      // Update items if provided
      if (items) {
        // Delete existing items
        await (supabase as any)
          .from('quote_items')
          .delete()
          .eq('quote_id', id);
        
        // Insert new items
        if (items.length > 0) {
          const { error: itemsError } = await (supabase as any)
            .from('quote_items')
            .insert(
              items.map(item => ({
                quote_id: id,
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
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote updated successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to update quote: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('quotes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote deleted');
    },
    onError: (error: unknown) => {
      toast.error('Failed to delete quote: ' + sanitizeErrorMessage(error));
    },
  });
}
