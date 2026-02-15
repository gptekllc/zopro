import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { setOneSignalPlayerId, bindIapSuccessOnce, isDespiaNative, getDespiaUUID, getDespiaOneSignalPlayerId } from '@/lib/despia';
import { useCurrentSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook that initializes Despia native integrations after auth:
 * - Sets OneSignal external user ID for push targeting
 * - Links device UUID and OneSignal player ID to the user profile
 * - Binds iapSuccess handler for RevenueCat purchase flow
 */
export function useDespiaInit() {
  const { user } = useAuth();
  const { data: subscription, refetch: refetchSubscription } = useCurrentSubscription();
  const initialized = useRef(false);
  const deviceLinked = useRef(false);

  // Set OneSignal player ID after login
  useEffect(() => {
    if (user?.id) {
      setOneSignalPlayerId(user.id);
    }
  }, [user?.id]);

  // Link device UUID and OneSignal player ID to backend
  useEffect(() => {
    if (!user?.id || !isDespiaNative() || deviceLinked.current) return;
    deviceLinked.current = true;

    const uuid = getDespiaUUID();
    const playerId = getDespiaOneSignalPlayerId();

    if (uuid || playerId) {
      supabase
        .from('profiles')
        .update({
          ...(uuid ? { despia_device_uuid: uuid } : {}),
          ...(playerId ? { onesignal_player_id: playerId } : {}),
        })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.error('Failed to link Despia device:', error);
        });
    }
  }, [user?.id]);

  // Bind iapSuccess once at boot
  useEffect(() => {
    if (initialized.current) return;
    if (!isDespiaNative()) return;
    initialized.current = true;

    bindIapSuccessOnce(async () => {
      const result = await refetchSubscription();
      const sub = result.data;
      return sub ? { active: sub.status === 'active' || sub.status === 'trialing' } : null;
    });
  }, [refetchSubscription]);
}
