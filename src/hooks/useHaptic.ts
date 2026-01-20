import { useCallback } from 'react';
import { useUserSettings } from './useUserSettings';

type HapticStyle = 'light' | 'medium' | 'heavy';

const HAPTIC_DURATIONS: Record<HapticStyle, number> = {
  light: 10,
  medium: 25,
  heavy: 50,
};

export function useHaptic() {
  const { settings } = useUserSettings();

  const triggerHaptic = useCallback((style: HapticStyle = 'light') => {
    // Check if haptic feedback is enabled globally
    if (!settings?.haptic_feedback_enabled) return;
    
    // Check if vibration API is available
    if (!('vibrate' in navigator)) return;
    
    try {
      const duration = HAPTIC_DURATIONS[style];
      navigator.vibrate(duration);
    } catch {
      // Vibration not supported or failed
    }
  }, [settings?.haptic_feedback_enabled]);

  const triggerNavigationHaptic = useCallback(() => {
    // Check if navigation haptic is enabled
    if (!settings?.haptic_navigation_enabled) return;
    if (!settings?.haptic_feedback_enabled) return;
    
    if (!('vibrate' in navigator)) return;
    
    try {
      navigator.vibrate(HAPTIC_DURATIONS.light);
    } catch {
      // Vibration not supported or failed
    }
  }, [settings?.haptic_navigation_enabled, settings?.haptic_feedback_enabled]);

  const triggerNotificationHaptic = useCallback(() => {
    // This is for general notification haptic
    // Individual notification types may override via preferences
    if (!settings?.haptic_feedback_enabled) return;
    
    if (!('vibrate' in navigator)) return;
    
    try {
      navigator.vibrate(HAPTIC_DURATIONS.medium);
    } catch {
      // Vibration not supported or failed
    }
  }, [settings?.haptic_feedback_enabled]);

  return {
    triggerHaptic,
    triggerNavigationHaptic,
    triggerNotificationHaptic,
    isHapticSupported: 'vibrate' in navigator,
  };
}
