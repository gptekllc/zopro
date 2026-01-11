import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { quoteSchema, itemSchema, sanitizeErrorMessage } from '@/lib/validation';
import { calculateDiscountAmount } from '@/components/ui/discount-input';

export interface QuoteItem {
  id: string;
  quote_id: string;
  description: string;
  item_description?: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  type?: 'product' | 'service';
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
  discount_type: 'amount' | 'percentage' | null;
  discount_value: number | null;
  notes: string | null;
  valid_until: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  job_id: string | null; // Reference to parent job (for child/upsell quotes)
  signature_id: string | null;
  signed_at: string | null;
  items?: QuoteItem[];
  customer?: { name: string; email?: string | null };
  creator?: { full_name: string | null };
}

export function useQuotes(includeArchived: boolean = false) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Set up real-time subscription for quotes
  useEffect(() => {
    if (!profile?.company_id) return;

    const channel = supabase
      .channel('quotes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
          filter: `company_id=eq.${profile.company_id}`,
        },
        () => {
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['quotes'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quote_items',
        },
        () => {
          // Also refresh quotes when items change
          queryClient.invalidateQueries({ queryKey: ['quotes'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quote_photos',
        },
        () => {
          // Also refresh quotes when photos change
          queryClient.invalidateQueries({ queryKey: ['quotes'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, queryClient]);
  
  return useQuery({
    queryKey: ['quotes', profile?.company_id, includeArchived],
    queryFn: async () => {
      let query = (supabase as any)
        .from('quotes')
        .select(`
          *,
          customer:customers(name, email),
          creator:profiles!quotes_created_by_fkey(full_name, avatar_url),
          items:quote_items(*)
        `)
        .is('deleted_at', null) // Exclude soft-deleted items
        .order('created_at', { ascending: false });
      
      if (!includeArchived) {
        query = query.is('archived_at', null);
      }
      
      const { data, error } = await query;
      
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
      
      // Generate quote number using database function
      const { data: quoteNumberData, error: quoteNumberError } = await (supabase as any)
        .rpc('generate_quote_number', { p_company_id: profile.company_id });
      
      if (quoteNumberError) throw quoteNumberError;
      const quoteNumber = quoteNumberData;
      
      // Fetch company tax rate
      const { data: company } = await (supabase as any)
        .from('companies')
        .select('tax_rate')
        .eq('id', profile.company_id)
        .single();
      
      const taxRate = (company?.tax_rate ?? 8.25) / 100;
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const discountAmount = calculateDiscountAmount(subtotal, (quoteValidation.data as any).discount_type, (quoteValidation.data as any).discount_value);
      const afterDiscount = subtotal - discountAmount;
      const tax = afterDiscount * taxRate;
      const total = afterDiscount + tax;
      
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
              item_description: (item as any).item_description || null,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.quantity * item.unit_price,
              type: (item as any).type || 'service',
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
                item_description: (item as any).item_description || null,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: item.quantity * item.unit_price,
                type: (item as any).type || 'service',
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
      // Soft delete - set deleted_at timestamp
      const { error } = await (supabase as any)
        .from('quotes')
        .update({ deleted_at: new Date().toISOString() })
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

export function useArchiveQuote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('quotes')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote archived');
    },
    onError: (error: unknown) => {
      toast.error('Failed to archive quote: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useUnarchiveQuote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('quotes')
        .update({ archived_at: null })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote restored');
    },
    onError: (error: unknown) => {
      toast.error('Failed to restore quote: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useAutoArchiveOldQuotes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc('auto_archive_old_records');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
