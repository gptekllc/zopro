

# Fix Push Notification Trigger Auth (401 Bug)

## Problem Found

The database trigger `trigger_push_notification()` calls the `send-push-notification` Edge Function, but **every call returns 401**. Root cause:

1. The trigger tries to read `service_role_key` from `vault.decrypted_secrets` -- it does not exist there
2. It falls back to a **hardcoded anon key** that does not match the actual `SUPABASE_ANON_KEY` on the Edge Function side (Lovable Cloud uses different keys than what was hardcoded)
3. The Edge Function compares the token against its own `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` env vars -- neither matches, so `isServiceRoleCall = false`
4. It then tries user-auth validation, which fails because the token is not a user JWT

## Fix

### Step 1: Store the service role key in vault

Run a SQL migration to insert the actual service role key into `vault.secrets` so the trigger can retrieve it. The key will be obtained from the Edge Function environment.

### Step 2: Alternative approach -- bypass auth for trigger calls

Since the DB trigger runs server-side and is trusted, a simpler fix is to add a shared secret header that the Edge Function checks. This avoids vault dependency:

1. Add a secret (e.g., `PUSH_TRIGGER_SECRET`) to both the DB function and Edge Function secrets
2. The trigger sends it as a custom header
3. The Edge Function recognizes it and treats the call as trusted

### Step 3 (Recommended): Simplest fix -- use `skipInAppNotification` flag as trust signal

Since the trigger always sends `skipInAppNotification: true` implicitly (via the `isServiceRoleCall` path), we can instead restructure: have the Edge Function accept calls with the anon key by passing the actual project anon key dynamically rather than hardcoding it in the trigger.

**Chosen approach**: Update the `trigger_push_notification()` DB function to use the correct Supabase URL and anon key dynamically, and update the Edge Function to also accept a shared internal secret header.

## Technical Details

### A. Update `trigger_push_notification()` SQL function
- Remove the hardcoded anon key fallback
- Instead, pass a custom header `x-trigger-secret` with a value from a new vault secret
- Keep using `net.http_post` to call the Edge Function

### B. Add `INTERNAL_TRIGGER_SECRET` to Edge Function secrets
- Generate a random secret value
- Store it in Supabase secrets for Edge Functions
- Store the same value in `vault.secrets` for the DB trigger to read

### C. Update `send-push-notification` Edge Function
- Add a check: if `x-trigger-secret` header matches `INTERNAL_TRIGGER_SECRET` env var, treat as trusted (service-role equivalent)
- Keep existing auth checks for user-initiated calls unchanged

### D. Test end-to-end
- Assign a technician to a job from the dashboard
- Verify the notification trigger fires
- Verify the Edge Function logs show "OneSignal API response" (not 401)
- Verify the native push arrives on the Despia device

## Expected Flow After Fix

```text
Job assigned --> DB trigger fires
     |
     v
trigger_push_notification() reads secret from vault
     |
     v
POST /send-push-notification with x-trigger-secret header
     |
     v
Edge Function: secret matches --> trusted call
     |
     v
Skip in-app insert (already created by trigger)
Query badge count --> Call OneSignal API
     |
     v
Native push delivered to device
```

