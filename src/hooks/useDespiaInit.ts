import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  bindIapSuccessOnce,
  isDespiaNative,
  getDespiaUUID,
  getDespiaOneSignalPlayerId,
  initializeDespiaIdentity,
  handleDespiaLogin,
  processIdentityRetryQueue,
} from '@/lib/despia';
import { useCurrentSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook that initializes Despia native integrations after auth:
 * - Runs vault-based identity resolution on mount
 * - Syncs Supabase user ID to vault + OneSignal on login
 * - Links device UUID and OneSignal player ID to the user profile
 * - Binds iapSuccess handler for RevenueCat purchase flow
 */
export function useDespiaInit() {
  const { user } = useAuth();
  const { data: subscription, refetch: refetchSubscription } = useCurrentSubscription();
  const identityInitialized = useRef(false);
  const deviceLinked = useRef(false);
  const prevUserId = useRef<string | null>(null);

  // Initialize identity + retry queue on first mount
  useEffect(() => {
    if (identityInitialized.current) return;
    if (!isDespiaNative()) return;
    identityInitialized.current = true;

    initializeDespiaIdentity();
    processIdentityRetryQueue();
  }, []);

  // On login (user.id transitions from null to a value), sync identity
  useEffect(() => {
    if (!user?.id || !isDespiaNative()) return;

    // Only call handleDespiaLogin when user actually logs in (not on every render)
    if (prevUserId.current !== user.id) {
      prevUserId.current = user.id;
      handleDespiaLogin(user.id);
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
    if (!isDespiaNative()) return;

    bindIapSuccessOnce(async () => {
      const result = await refetchSubscription();
      const sub = result.data;
      return sub ? { active: sub.status === 'active' || sub.status === 'trialing' } : null;
    });
  }, [refetchSubscription]);
}
