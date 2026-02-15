import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { setOneSignalPlayerId, bindIapSuccessOnce, isDespiaNative } from '@/lib/despia';
import { useCurrentSubscription } from '@/hooks/useSubscription';

/**
 * Hook that initializes Despia native integrations after auth:
 * - Sets OneSignal external user ID for push targeting
 * - Binds iapSuccess handler for RevenueCat purchase flow
 */
export function useDespiaInit() {
  const { user } = useAuth();
  const { data: subscription, refetch: refetchSubscription } = useCurrentSubscription();
  const initialized = useRef(false);

  // Set OneSignal player ID after login
  useEffect(() => {
    if (user?.id) {
      setOneSignalPlayerId(user.id);
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
