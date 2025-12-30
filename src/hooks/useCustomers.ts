import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useCustomers() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['customers', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('customers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!profile?.company_id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (customer: Omit<Customer, 'id' | 'company_id' | 'created_at' | 'updated_at'>) => {
      if (!profile?.company_id) throw new Error('No company associated');
      
      const { data, error } = await (supabase as any)
        .from('customers')
        .insert({ ...customer, company_id: profile.company_id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer added successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to add customer: ' + error.message);
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
    onError: (error: any) => {
      toast.error('Failed to update customer: ' + error.message);
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
    onError: (error: any) => {
      toast.error('Failed to delete customer: ' + error.message);
    },
  });
}
