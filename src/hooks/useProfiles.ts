import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  company_id: string | null;
  avatar_url: string | null;
  hourly_rate: number | null;
  created_at: string;
  updated_at: string;
}

export const useProfiles = () => {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['profiles', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('company_id', profile.company_id);
      
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!profile?.company_id,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Profile> & { id: string }) => {
      const { data: result, error } = await (supabase as any)
        .from('profiles')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
};
