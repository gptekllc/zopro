import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { NOTIFICATION_TYPES } from '@/lib/notificationTypes';

export interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: string;
  enabled: boolean;
  sound_enabled: boolean;
  haptic_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await (supabase as any)
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as NotificationPreference[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getPreferenceForType = (type: string): NotificationPreference | null => {
    return preferences.find(p => p.notification_type === type) || null;
  };

  const isTypeEnabled = (type: string): boolean => {
    const pref = getPreferenceForType(type);
    return pref?.enabled ?? true; // Default to enabled
  };

  const isSoundEnabled = (type: string): boolean => {
    const pref = getPreferenceForType(type);
    return pref?.sound_enabled ?? true;
  };

  const isHapticEnabled = (type: string): boolean => {
    const pref = getPreferenceForType(type);
    return pref?.haptic_enabled ?? true;
  };

  const updatePreference = useMutation({
    mutationFn: async ({ 
      notificationType, 
      updates 
    }: { 
      notificationType: string; 
      updates: Partial<Pick<NotificationPreference, 'enabled' | 'sound_enabled' | 'haptic_enabled'>> 
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Upsert the preference
      const { data, error } = await (supabase as any)
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          notification_type: notificationType,
          enabled: updates.enabled ?? true,
          sound_enabled: updates.sound_enabled ?? true,
          haptic_enabled: updates.haptic_enabled ?? true,
        }, {
          onConflict: 'user_id,notification_type',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as NotificationPreference;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', user?.id] });
    },
  });

  const toggleTypeEnabled = (type: string) => {
    const current = isTypeEnabled(type);
    updatePreference.mutate({
      notificationType: type,
      updates: { 
        enabled: !current,
        sound_enabled: isSoundEnabled(type),
        haptic_enabled: isHapticEnabled(type),
      },
    });
  };

  const toggleSoundEnabled = (type: string) => {
    const current = isSoundEnabled(type);
    updatePreference.mutate({
      notificationType: type,
      updates: { 
        enabled: isTypeEnabled(type),
        sound_enabled: !current,
        haptic_enabled: isHapticEnabled(type),
      },
    });
  };

  const toggleHapticEnabled = (type: string) => {
    const current = isHapticEnabled(type);
    updatePreference.mutate({
      notificationType: type,
      updates: { 
        enabled: isTypeEnabled(type),
        sound_enabled: isSoundEnabled(type),
        haptic_enabled: !current,
      },
    });
  };

  // Get all preferences merged with defaults
  const getAllPreferences = () => {
    return NOTIFICATION_TYPES.map(typeConfig => {
      const pref = getPreferenceForType(typeConfig.type);
      return {
        ...typeConfig,
        enabled: pref?.enabled ?? true,
        sound_enabled: pref?.sound_enabled ?? true,
        haptic_enabled: pref?.haptic_enabled ?? true,
      };
    });
  };

  return {
    preferences,
    isLoading,
    getPreferenceForType,
    isTypeEnabled,
    isSoundEnabled,
    isHapticEnabled,
    updatePreference,
    toggleTypeEnabled,
    toggleSoundEnabled,
    toggleHapticEnabled,
    getAllPreferences,
  };
}
