import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string;
  company_id: string | null;
  avatar_url: string | null;
  hourly_rate: number | null;
  employment_status: 'active' | 'on_leave' | 'terminated' | null;
  hire_date: string | null;
  termination_date: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  created_at: string;
  updated_at: string;
}

export const useProfiles = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Set up real-time subscription for profiles
  useEffect(() => {
    if (!profile?.company_id) return;

    const channel = supabase
      .channel('profiles-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `company_id=eq.${profile.company_id}`,
        },
        () => {
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['profiles'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, queryClient]);
  
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
