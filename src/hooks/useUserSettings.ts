import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserSettings {
  id: string;
  user_id: string;
  haptic_navigation_enabled: boolean;
  haptic_feedback_enabled: boolean;
  sound_enabled: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SETTINGS: Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  haptic_navigation_enabled: true,
  haptic_feedback_enabled: true,
  sound_enabled: true,
};

export function useUserSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await (supabase as any)
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      
      // Return existing settings or create default
      if (data) return data as UserSettings;
      
      // Create default settings for new user
      const { data: newSettings, error: insertError } = await (supabase as any)
        .from('user_settings')
        .insert({
          user_id: user.id,
          ...DEFAULT_SETTINGS,
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      return newSettings as UserSettings;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await (supabase as any)
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as UserSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings', user?.id] });
    },
  });

  return {
    settings: settings || { ...DEFAULT_SETTINGS } as UserSettings,
    isLoading,
    updateSettings,
  };
}
