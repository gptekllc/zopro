import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const DEVICE_TOKEN_KEY = 'mfa_trusted_device_token';
const TRUST_DURATION_DAYS = 90;

// Generate a unique device token
const generateDeviceToken = (): string => {
  return crypto.randomUUID();
};

// Get browser/device info for display purposes
const getDeviceName = (): string => {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  // Detect browser
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';

  // Detect OS
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
};

export function useTrustedDevice() {
  // Get stored device token from localStorage
  const getStoredToken = useCallback((): string | null => {
    try {
      return localStorage.getItem(DEVICE_TOKEN_KEY);
    } catch {
      return null;
    }
  }, []);

  // Store device token in localStorage
  const storeToken = useCallback((token: string) => {
    try {
      localStorage.setItem(DEVICE_TOKEN_KEY, token);
    } catch (e) {
      console.error('Failed to store device token:', e);
    }
  }, []);

  // Remove device token from localStorage
  const clearStoredToken = useCallback(() => {
    try {
      localStorage.removeItem(DEVICE_TOKEN_KEY);
    } catch (e) {
      console.error('Failed to clear device token:', e);
    }
  }, []);

  // Check if current device is trusted for a user
  const checkTrustedDevice = useCallback(async (userId: string): Promise<boolean> => {
    const storedToken = getStoredToken();
    if (!storedToken) return false;

    try {
      const { data, error } = await supabase.rpc('check_trusted_device', {
        p_user_id: userId,
        p_device_token: storedToken,
      });

      if (error) {
        console.error('Error checking trusted device:', error);
        return false;
      }

      return data === true;
    } catch (e) {
      console.error('Error checking trusted device:', e);
      return false;
    }
  }, [getStoredToken]);

  // Trust the current device for MFA bypass
  const trustDevice = useCallback(async (userId: string): Promise<boolean> => {
    const token = generateDeviceToken();
    const deviceName = getDeviceName();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TRUST_DURATION_DAYS);

    try {
      const { error } = await supabase.from('trusted_devices').insert({
        user_id: userId,
        device_token: token,
        device_name: deviceName,
        expires_at: expiresAt.toISOString(),
      });

      if (error) {
        console.error('Error trusting device:', error);
        return false;
      }

      storeToken(token);
      return true;
    } catch (e) {
      console.error('Error trusting device:', e);
      return false;
    }
  }, [storeToken]);

  // Revoke trust for current device
  const revokeCurrentDevice = useCallback(async (userId: string): Promise<boolean> => {
    const storedToken = getStoredToken();
    if (!storedToken) return true;

    try {
      const { error } = await supabase
        .from('trusted_devices')
        .delete()
        .eq('user_id', userId)
        .eq('device_token', storedToken);

      if (error) {
        console.error('Error revoking device:', error);
        return false;
      }

      clearStoredToken();
      return true;
    } catch (e) {
      console.error('Error revoking device:', e);
      return false;
    }
  }, [getStoredToken, clearStoredToken]);

  // Revoke all trusted devices for a user
  const revokeAllDevices = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('trusted_devices')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error revoking all devices:', error);
        return false;
      }

      clearStoredToken();
      return true;
    } catch (e) {
      console.error('Error revoking all devices:', e);
      return false;
    }
  }, [clearStoredToken]);

  return {
    getStoredToken,
    checkTrustedDevice,
    trustDevice,
    revokeCurrentDevice,
    revokeAllDevices,
    clearStoredToken,
  };
}
