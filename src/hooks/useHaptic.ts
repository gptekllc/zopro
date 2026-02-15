import { useCallback } from 'react';
import { useUserSettings } from './useUserSettings';
import { triggerDespiaHaptic, isDespiaNative, type DespiaHapticType } from '@/lib/despia';

type HapticStyle = 'light' | 'medium' | 'heavy';

const STYLE_TO_DESPIA: Record<HapticStyle, DespiaHapticType> = {
  light: 'light',
  medium: 'success', // medium maps to success-level feedback
  heavy: 'heavy',
};

export function useHaptic() {
  const { settings } = useUserSettings();

  const triggerHaptic = useCallback((style: HapticStyle = 'light') => {
    if (!settings?.haptic_feedback_enabled) return;
    triggerDespiaHaptic(STYLE_TO_DESPIA[style]);
  }, [settings?.haptic_feedback_enabled]);

  const triggerNavigationHaptic = useCallback(() => {
    if (!settings?.haptic_navigation_enabled) return;
    if (!settings?.haptic_feedback_enabled) return;
    triggerDespiaHaptic('light');
  }, [settings?.haptic_navigation_enabled, settings?.haptic_feedback_enabled]);

  const triggerNotificationHaptic = useCallback(() => {
    if (!settings?.haptic_feedback_enabled) return;
    triggerDespiaHaptic('success');
  }, [settings?.haptic_feedback_enabled]);

  return {
    triggerHaptic,
    triggerNavigationHaptic,
    triggerNotificationHaptic,
    isHapticSupported: isDespiaNative() || 'vibrate' in navigator,
  };
}
