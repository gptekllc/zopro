/**
 * Despia Native Integration Utilities
 * 
 * Source: https://setup.despia.com/lovable/native-features/user-agent
 * Source: https://setup.despia.com/lovable/native-features/device-indexing
 * Source: https://setup.despia.com/lovable/native-features/onesignal
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
 * Get the OneSignal player ID from the Despia runtime
 */
export function getDespiaOneSignalPlayerId(): string | undefined {
  try {
    return (despia as any).onesignalplayerid;
  } catch {
    return undefined;
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

// ─── Vault-Based Identity Resolution ────────────────────────────────
// Source: https://setup.despia.com/lovable/native-features/onesignal

const IDENTITY_RETRY_KEY = 'despia_identity_retry_queue';

/**
 * Initialize Despia identity on app launch.
 * Priority: 1) Vault (synced via iCloud/Google) 2) Purchase restore 3) Install ID fallback
 */
export async function initializeDespiaIdentity(): Promise<string | null> {
  if (!isDespiaNative()) return null;

  try {
    // 1. Try reading app_user_id from vault
    let appUserId: string | null = null;
    try {
      const result = await despia('getvault://?key=app_user_id', ['app_user_id']);
      appUserId = (result as any)?.app_user_id || null;
    } catch {
      // Vault read failed or key doesn't exist
    }

    // 2. If no vault value, try purchase restore to get externalUserId
    if (!appUserId) {
      try {
        const restoreResult = await despia('revenuecat://restore', ['externalUserId']);
        appUserId = (restoreResult as any)?.externalUserId || null;
      } catch {
        // Restore failed — not critical
      }
    }

    // 3. Fallback to install ID (despia.uuid)
    if (!appUserId) {
      appUserId = getDespiaUUID() || `anon_${crypto.randomUUID()}`;
      // Persist to vault so it syncs across reinstalls
      try {
        await despia(`setvault://?key=app_user_id&value=${encodeURIComponent(appUserId)}`);
      } catch {
        // Vault write failed — continue with in-memory value
      }
    }

    // 4. Sync to OneSignal
    setOneSignalPlayerId(appUserId);

    console.log('[Despia] Identity initialized:', appUserId);
    return appUserId;
  } catch (err) {
    console.error('[Despia] Identity initialization error:', err);
    return null;
  }
}

/**
 * After Supabase login, persist the user's Supabase ID as the canonical app_user_id.
 * This ensures OneSignal targets the right user.
 */
export async function handleDespiaLogin(supabaseUserId: string): Promise<void> {
  if (!isDespiaNative() || !supabaseUserId) return;

  try {
    // Persist to vault (syncs across iCloud/Google)
    await despia(`setvault://?key=app_user_id&value=${encodeURIComponent(supabaseUserId)}`);
  } catch (err) {
    console.error('[Despia] Failed to persist login identity to vault:', err);
    // Queue for retry
    queueIdentityRetry({ action: 'login', userId: supabaseUserId });
  }

  // Always sync to OneSignal immediately
  setOneSignalPlayerId(supabaseUserId);
}

/**
 * On logout, generate a new anonymous identity to prevent identity collision on shared devices.
 * Per Despia docs: "Do not reuse the device's install_id"
 */
export async function handleDespiaLogout(): Promise<void> {
  if (!isDespiaNative()) return;

  const anonymousId = `anon_${crypto.randomUUID()}`;

  try {
    await despia(`setvault://?key=app_user_id&value=${encodeURIComponent(anonymousId)}`);
  } catch (err) {
    console.error('[Despia] Failed to persist logout identity to vault:', err);
  }

  // Sync anonymous ID to OneSignal so push doesn't target old user
  setOneSignalPlayerId(anonymousId);
  console.log('[Despia] Logout identity set:', anonymousId);
}

/**
 * Queue a failed identity sync for retry
 */
function queueIdentityRetry(entry: { action: string; userId: string }): void {
  try {
    const queue = JSON.parse(localStorage.getItem(IDENTITY_RETRY_KEY) || '[]');
    queue.push({ ...entry, timestamp: Date.now() });
    // Keep only last 10 entries
    localStorage.setItem(IDENTITY_RETRY_KEY, JSON.stringify(queue.slice(-10)));
  } catch {
    // localStorage not available
  }
}

/**
 * Process any queued identity retries (call on app launch)
 */
export async function processIdentityRetryQueue(): Promise<void> {
  if (!isDespiaNative()) return;

  try {
    const queue = JSON.parse(localStorage.getItem(IDENTITY_RETRY_KEY) || '[]');
    if (queue.length === 0) return;

    const remaining: typeof queue = [];

    for (const entry of queue) {
      try {
        if (entry.action === 'login' && entry.userId) {
          await despia(`setvault://?key=app_user_id&value=${encodeURIComponent(entry.userId)}`);
          setOneSignalPlayerId(entry.userId);
        }
      } catch {
        // Still failing — keep in queue if less than 24h old
        if (Date.now() - entry.timestamp < 86400000) {
          remaining.push(entry);
        }
      }
    }

    localStorage.setItem(IDENTITY_RETRY_KEY, JSON.stringify(remaining));
  } catch {
    // localStorage not available
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
