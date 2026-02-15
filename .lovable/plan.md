

# Despia Push Notification Integration (Per Official Docs)

This plan updates the push notification system to follow the Despia User Session documentation exactly, fixing the 401 trigger auth bug and modernizing the OneSignal API usage.

## Changes Overview

There are three areas of work:

1. **Client-side identity resolution** -- Update `src/lib/despia.ts` and `src/hooks/useDespiaInit.ts` to implement the full vault-based identity flow (read vault, restore purchases, fallback to install ID, persist, sync to OneSignal on every launch)
2. **OneSignal API modernization** -- Update `send-push-notification` Edge Function to use `include_aliases: { external_id: [...] }` with `target_channel: "push"` instead of the deprecated `include_external_user_ids`
3. **Fix 401 trigger auth** -- Update the `trigger_push_notification()` database function and Edge Function to use a shared `INTERNAL_TRIGGER_SECRET` header for trusted internal calls

---

## Part 1: Client-Side Identity Resolution

### File: `src/lib/despia.ts`

Add new functions following the Despia docs:

- `initializeDespiaIdentity()` -- Full identity resolution: vault read, purchase history restore, install_id fallback, vault persist, OneSignal sync
- `handleDespiaLogin(supabaseUserId)` -- After Supabase auth, sync the user's Supabase ID as the `app_user_id` to vault and OneSignal
- `handleDespiaLogout()` -- Generate anonymous ID, clear vault lock, sync to OneSignal
- `checkNativePushPermission()` -- Check push permission status
- `requestNativePushPermission()` -- Manually request push permission
- `processIdentityRetryQueue()` -- Retry failed syncs from localStorage queue

### File: `src/hooks/useDespiaInit.ts`

Rewrite to use the new identity functions:

- On app launch (mount): call `initializeDespiaIdentity()` + `processIdentityRetryQueue()`
- On login (when `user.id` changes from null to value): call `handleDespiaLogin(user.id)` which persists to vault and calls `setonesignalplayerid://`
- On logout: the `signOut` in `useAuth.tsx` will call `handleDespiaLogout()`
- Keep existing device-linking logic (save `despia_device_uuid` to profiles table)
- Keep existing `bindIapSuccessOnce` logic

### File: `src/hooks/useAuth.tsx`

Add `handleDespiaLogout()` call inside the `signOut` function to generate a new anonymous identity on logout (per docs: "Do not reuse the device's install_id to prevent identity collision").

---

## Part 2: Fix OneSignal API Call (Edge Function)

### File: `supabase/functions/send-push-notification/index.ts`

Update the `sendOneSignalNotifications` function:

**Before (deprecated):**
```javascript
include_external_user_ids: externalUserIds,
```

**After (current API per Despia docs):**
```javascript
include_aliases: { external_id: externalUserIds },
target_channel: 'push',
```

---

## Part 3: Fix 401 Trigger Authentication

### Secret: `INTERNAL_TRIGGER_SECRET`

Generate a random UUID value. Store it in:
- Supabase Edge Function secrets (via the secrets tool)
- Database vault (`vault.secrets`) via a SQL migration

### File: `supabase/functions/send-push-notification/index.ts`

Add a check at the top of the auth logic:

```javascript
const triggerSecret = req.headers.get("x-trigger-secret");
const expectedSecret = Deno.env.get("INTERNAL_TRIGGER_SECRET");
const isTrustedTrigger = triggerSecret && expectedSecret && triggerSecret === expectedSecret;
const isServiceRoleCall = isTrustedTrigger || token === supabaseServiceKey || token === supabaseAnonKey;
```

Also update CORS headers to allow `x-trigger-secret`.

### SQL Migration: Update `trigger_push_notification()` function

Replace the current function that tries to read `service_role_key` from vault. Instead:

- Read `INTERNAL_TRIGGER_SECRET` from `vault.decrypted_secrets`
- Send it in `x-trigger-secret` header
- Use the anon key for the `Authorization` header (required by Supabase gateway)
- Send `skipInAppNotification: true` in the body to avoid duplicate in-app notifications

---

## Technical Summary

| Component | Change | Why |
|---|---|---|
| `src/lib/despia.ts` | Add vault-based identity resolution, login/logout handlers | Follow Despia docs exactly |
| `src/hooks/useDespiaInit.ts` | Use new identity functions on mount/login | Proper lifecycle |
| `src/hooks/useAuth.tsx` | Call `handleDespiaLogout()` on sign out | Prevent identity collision |
| Edge Function | Use `include_aliases` + `x-trigger-secret` auth | Fix deprecated API + fix 401 |
| SQL migration | Store secret in vault, update trigger function | Enable trusted internal calls |

## Sequence After Fix

```text
App Launch --> initializeDespiaIdentity()
  --> Read vault for app_user_id
  --> Fallback to despia.uuid
  --> setonesignalplayerid://?user_id=<app_user_id>

User Login --> handleDespiaLogin(supabase_user_id)
  --> setvault://?key=app_user_id&value=<supabase_uid>
  --> setonesignalplayerid://?user_id=<supabase_uid>
  --> Save device UUID to profiles table

Job Assigned --> DB trigger fires
  --> trigger_push_notification() reads INTERNAL_TRIGGER_SECRET from vault
  --> POST /send-push-notification with x-trigger-secret header
  --> Edge Function: secret matches = trusted
  --> OneSignal API: include_aliases: { external_id: [user_id] }
  --> Native push delivered

User Logout --> handleDespiaLogout()
  --> Generate anonymous ID
  --> setonesignalplayerid://?user_id=<anonymous_id>
```
