import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { customerSchema, sanitizeErrorMessage } from '@/lib/validation';


export interface Customer {
  id: string;
  company_id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  avatar_url: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCustomers() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Set up real-time subscription for customers
  useEffect(() => {
    if (!profile?.company_id) return;

    const channel = supabase
      .channel('customers-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers',
          filter: `company_id=eq.${profile.company_id}`,
        },
        () => {
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          queryClient.invalidateQueries({ queryKey: ['deleted-customers'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, queryClient]);
  
  return useQuery({
    queryKey: ['customers', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('customers')
        .select('*')
        .is('deleted_at', null)
        .order('name');
      
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!profile?.company_id,
  });
}

export function useDeletedCustomers() {
  const { profile, isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ['deleted-customers', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('customers')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('name');
      
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!profile?.company_id && isAdmin,
  });
}

export function useSoftDeleteCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('customers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-customers'] });
      toast.success('Customer deleted');
    },
    onError: (error: unknown) => {
      toast.error('Failed to delete customer: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useRestoreCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('customers')
        .update({ deleted_at: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-customers'] });
      toast.success('Customer restored');
    },
    onError: (error: unknown) => {
      toast.error('Failed to restore customer: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (customer: Omit<Customer, 'id' | 'company_id' | 'created_at' | 'updated_at' | 'deleted_at'>) => {
      if (!profile?.company_id) throw new Error('No company associated');
      
      // Validate customer data
      const validation = customerSchema.safeParse(customer);
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        throw new Error(firstError?.message || 'Validation failed');
      }
      
      const { data, error } = await (supabase as any)
        .from('customers')
        .insert({ ...validation.data, company_id: profile.company_id })
        .select()
        .single();
      
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: (result) => {
      // Optimistically add the new customer to the cache immediately
      queryClient.setQueryData(['customers', profile?.company_id], (old: Customer[] | undefined) => {
        if (!old) return [result];
        // Add and sort alphabetically
        return [...old, result].sort((a, b) => a.name.localeCompare(b.name));
      });
      
      // Background refresh for consistency
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer added successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to add customer: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Customer> & { id: string }) => {
      const { error } = await (supabase as any)
        .from('customers')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer updated successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to update customer: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('customers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted');
    },
    onError: (error: unknown) => {
      toast.error('Failed to delete customer: ' + sanitizeErrorMessage(error));
    },
  });
}
