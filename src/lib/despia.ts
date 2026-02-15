/**
 * Despia Native Integration Utilities
 * 
 * Source: https://setup.despia.com/lovable/native-features/user-agent
 * Source: https://setup.despia.com/lovable/native-features/device-indexing
 */
import despia from 'despia-native';

/** Check if the app is running inside the Despia native runtime */
export function isDespiaNative(): boolean {
  return typeof navigator !== 'undefined' && /Despia/i.test(navigator.userAgent);
}

/** Check if the platform is iOS inside Despia */
export function isDespiaIOS(): boolean {
  return isDespiaNative() && /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Check if the platform is Android inside Despia */
export function isDespiaAndroid(): boolean {
  return isDespiaNative() && /Android/i.test(navigator.userAgent);
}

/** Get the Despia device UUID (only available in native runtime) */
export function getDespiaUUID(): string | undefined {
  try {
    return (despia as any).uuid;
  } catch {
    return undefined;
  }
}

/**
 * Trigger a Despia haptic effect. Falls back to navigator.vibrate on web.
 * 
 * Source: https://setup.despia.com/lovable/native-features/haptic-feedback
 */
export type DespiaHapticType = 'light' | 'heavy' | 'success' | 'warning' | 'error';

const HAPTIC_SCHEMES: Record<DespiaHapticType, string> = {
  light: 'lighthaptic://',
  heavy: 'heavyhaptic://',
  success: 'successhaptic://',
  warning: 'warninghaptic://',
  error: 'errorhaptic://',
};

const WEB_VIBRATE_MS: Record<DespiaHapticType, number> = {
  light: 10,
  heavy: 50,
  success: 25,
  warning: 30,
  error: 40,
};

export function triggerDespiaHaptic(type: DespiaHapticType = 'light'): void {
  if (isDespiaNative()) {
    try {
      despia(HAPTIC_SCHEMES[type]);
    } catch {
      // silently fail
    }
  } else if ('vibrate' in navigator) {
    try {
      navigator.vibrate(WEB_VIBRATE_MS[type]);
    } catch {
      // vibration not supported
    }
  }
}

/**
 * Set the OneSignal external user ID so push notifications target the right user.
 * Call this after every successful login.
 * 
 * Source: https://setup.despia.com/lovable/native-features/onesignal
 */
export function setOneSignalPlayerId(userId: string): void {
  if (!isDespiaNative() || !userId) return;
  try {
    despia(`setonesignalplayerid://?user_id=${encodeURIComponent(userId)}`);
  } catch (err) {
    console.error('Failed to set OneSignal player ID:', err);
  }
}

/**
 * RevenueCat: Start a native in-app purchase.
 * 
 * Source: https://setup.despia.com/lovable/native-features/paywalls
 */
export async function startNativePurchase(productId: string, userId: string): Promise<void> {
  if (!isDespiaNative()) {
    console.warn('Native purchase is only available in Despia runtime');
    return;
  }

  // Optional: check store location for UI policy decisions
  try {
    await despia('getstorelocation://', ['storeLocation']);
  } catch {
    // not critical
  }

  await despia(
    `revenuecat://purchase?external_id=${encodeURIComponent(userId)}&product=${encodeURIComponent(productId)}`
  );
}

/**
 * iapSuccess handler — bind once at app boot.
 * The server is the authority for entitlement; this only triggers a recheck.
 */
type IapSuccessPayload = {
  planID: string;
  transactionID: string;
  subreceipts: unknown;
};

declare global {
  interface Window {
    iapSuccess?: (p: IapSuccessPayload) => void;
  }
}

let _iapBound = false;

export function bindIapSuccessOnce(
  getEntitlements: () => Promise<{ active?: boolean } | null>
): void {
  if (_iapBound) return;
  _iapBound = true;

  window.iapSuccess = async ({ planID, transactionID, subreceipts }) => {
    try {
      const current = await getEntitlements();
      if (current?.active) return; // already entitled

      // Poll server for confirmation (webhook may take a moment)
      const confirmed = await waitForSubscriptionConfirm(getEntitlements, {
        timeoutMs: 15000,
        intervalMs: 1500,
      });

      if (!confirmed) {
        console.warn('IAP success hint received but server has not confirmed entitlement yet');
      }
    } catch (err) {
      console.error('iapSuccess handler error', err);
    }
  };
}

async function waitForSubscriptionConfirm(
  getEntitlements: () => Promise<{ active?: boolean } | null>,
  opts: { timeoutMs: number; intervalMs: number }
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < opts.timeoutMs) {
    const ent = await getEntitlements();
    if (ent?.active) return true;
    await new Promise((r) => setTimeout(r, opts.intervalMs));
  }
  return false;
}

export { despia };
