

# Fix: OneSignal Push Notifications Not Delivering on Despia Native App

## Problem
Push notifications are not being delivered to the native app. The edge function calls OneSignal successfully, but OneSignal returns the error **"All included players are not subscribed"**, meaning it cannot find any device registered under the targeted external_id.

## Root Causes

### 1. OneSignal API mismatch (primary)
The edge function uses the **modern** OneSignal API field `include_aliases: { external_id: [...] }`, which requires specific OneSignal dashboard configuration (User Model enabled). The Despia SDK registers external IDs via the legacy `setonesignalplayerid://` scheme, which maps to the legacy `include_external_user_ids` field. If the OneSignal app was created with the legacy model, `include_aliases` won't find any matching devices.

### 2. Identity race condition on app launch
`initializeDespiaIdentity()` runs immediately on mount -- before auth is restored. It sets OneSignal's external_id to a vault value or anonymous fallback (`anon_xxx`). Then when auth resolves, `handleDespiaLogin` sets it to the Supabase user ID. But there's a window where the anonymous ID gets registered, and the final Supabase ID may not "stick" depending on OneSignal SDK timing.

## Solution

### Change 1: Use legacy `include_external_user_ids` in the edge function
Switch the OneSignal API call from the modern `include_aliases` to the legacy `include_external_user_ids` field, which is what the Despia native SDK supports.

**File:** `supabase/functions/send-push-notification/index.ts`

Replace the payload construction:
```typescript
// BEFORE (modern API - not compatible with Despia's SDK registration)
const payload = {
  app_id: appId,
  include_aliases: { external_id: externalUserIds },
  target_channel: "push",
  headings: { en: title },
  contents: { en: body },
};

// AFTER (legacy API - matches Despia's setonesignalplayerid:// scheme)
const payload = {
  app_id: appId,
  include_external_user_ids: externalUserIds,
  headings: { en: title },
  contents: { en: body },
};
```

### Change 2: Skip early anonymous identity initialization
Remove the `initializeDespiaIdentity()` call on first mount (which can set an anonymous external_id before auth resolves). Instead, only set OneSignal's external_id when we have the actual Supabase user ID. This prevents the wrong ID from being registered.

**File:** `src/hooks/useDespiaInit.ts`

Remove or skip the `initializeDespiaIdentity()` call in the mount effect. The login effect already calls `handleDespiaLogin(user.id)` which sets the correct external_id via `setOneSignalPlayerId`.

### Change 3: Ensure `handleDespiaLogin` always runs on app resume with existing session
Currently `handleDespiaLogin` only runs when `user.id` transitions from null. But on a cold start with a cached session, `user.id` may already be set from the initial auth check -- meaning `prevUserId.current` is already equal and the call is skipped. Add logic to always call `setOneSignalPlayerId` on mount when a session exists.

**File:** `src/hooks/useDespiaInit.ts`

Update the login effect to always sync on first mount when user is already logged in.

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/send-push-notification/index.ts` | Replace `include_aliases` with `include_external_user_ids` in OneSignal payload |
| `src/hooks/useDespiaInit.ts` | Remove early anonymous identity init; ensure login sync runs on cold start |
| `src/lib/despia.ts` | No changes needed (scheme is correct per Despia docs) |

## Technical Details

**`supabase/functions/send-push-notification/index.ts`** (lines 43-50):
```typescript
const payload: Record<string, unknown> = {
  app_id: appId,
  include_external_user_ids: externalUserIds,
  headings: { en: title },
  contents: { en: body },
};
```

**`src/hooks/useDespiaInit.ts`** -- mount effect:
```typescript
// Remove initializeDespiaIdentity() from mount effect
// Only process retry queue (which replays failed login syncs)
useEffect(() => {
  if (identityInitialized.current) return;
  if (!isDespiaNative()) return;
  identityInitialized.current = true;
  processIdentityRetryQueue();
}, []);
```

**`src/hooks/useDespiaInit.ts`** -- login effect:
```typescript
// Always sync on first render when user exists (cold start with cached session)
useEffect(() => {
  if (!user?.id || !isDespiaNative()) return;
  
  if (prevUserId.current !== user.id) {
    prevUserId.current = user.id;
    handleDespiaLogin(user.id);
  }
}, [user?.id]);
```

This is already correct -- `prevUserId` starts as `null`, so on first render with an existing session, it will call `handleDespiaLogin`. No change needed here.

## Verification
After deploying, trigger a test notification and check the edge function logs for:
- `OneSignal API response: {"id":"some-id",...}` (success, not errors)
- No more "All included players are not subscribed" errors

