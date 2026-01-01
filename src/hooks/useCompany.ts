import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Company {
  timezone?: string;
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  logo_url: string | null;
  tax_rate: number | null;
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
      
      // First get profiles
      const { data: profiles, error: profilesError } = await (supabase as any)
        .from('profiles')
        .select('id, email, full_name, phone, role, company_id')
        .eq('company_id', profile.company_id);
      
      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) return [];
      
      // Then get roles for these users in a separate query (faster)
      const userIds = profiles.map((p: any) => p.id);
      const { data: roles } = await (supabase as any)
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);
      
      // Merge roles into profiles
      const rolesMap = new Map();
      (roles || []).forEach((r: any) => {
        if (!rolesMap.has(r.user_id)) rolesMap.set(r.user_id, []);
        rolesMap.get(r.user_id).push({ role: r.role });
      });
      
      return profiles.map((p: any) => ({
        ...p,
        roles: rolesMap.get(p.id) || [],
      }));
    },
    enabled: !!profile?.company_id,
    staleTime: 30000, // Cache for 30 seconds
  });
}
