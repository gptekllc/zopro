import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Company {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useCompany() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['company', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      
      const { data, error } = await (supabase as any)
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Company | null;
    },
    enabled: !!profile?.company_id,
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Company> & { id: string }) => {
      const { error } = await (supabase as any)
        .from('companies')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      toast.success('Company updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update company: ' + error.message);
    },
  });
}

export function useTeamMembers() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['team_members', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select(`
          *,
          roles:user_roles(role)
        `)
        .eq('company_id', profile.company_id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id,
  });
}
