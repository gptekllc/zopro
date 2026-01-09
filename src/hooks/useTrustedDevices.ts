import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface TrustedDevice {
  id: string;
  device_name: string | null;
  created_at: string;
  expires_at: string;
  last_used_at: string;
}

export function useTrustedDevices() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['trusted-devices', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from('trusted_devices')
        .select('id, device_name, created_at, expires_at, last_used_at')
        .eq('user_id', profile.id)
        .gt('expires_at', new Date().toISOString())
        .order('last_used_at', { ascending: false });

      if (error) throw error;
      return data as TrustedDevice[];
    },
    enabled: !!profile?.id,
  });

  const revokeDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await supabase
        .from('trusted_devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trusted-devices'] });
    },
  });

  const revokeAllDevicesMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('trusted_devices')
        .delete()
        .eq('user_id', profile.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trusted-devices'] });
    },
  });

  return {
    devices,
    isLoading,
    revokeDevice: revokeDeviceMutation.mutate,
    revokeAllDevices: revokeAllDevicesMutation.mutate,
    isRevoking: revokeDeviceMutation.isPending,
    isRevokingAll: revokeAllDevicesMutation.isPending,
  };
}
