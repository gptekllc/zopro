

# Implementation Plan: Despia Push Notifications (All 3 Parts)

The secret will be auto-generated during the SQL migration -- you don't need to provide anything.

## Step 1: Generate INTERNAL_TRIGGER_SECRET via SQL Migration

A SQL migration will:
- Generate a random UUID as the secret
- Store it in `vault.secrets` with the name `internal_trigger_secret`
- Replace the `trigger_push_notification()` function to read this secret and send it as an `x-trigger-secret` header

No manual step required from you.

## Step 2: Update Edge Function (`send-push-notification/index.ts`)

- Add `x-trigger-secret` to CORS allowed headers
- Add trust check: if `x-trigger-secret` header matches `INTERNAL_TRIGGER_SECRET` env var, treat as trusted
- Modernize OneSignal API: replace `include_external_user_ids` with `include_aliases: { external_id: [...] }` and add `target_channel: "push"`

## Step 3: Add INTERNAL_TRIGGER_SECRET to Edge Function Secrets

Use the secrets tool to add the same UUID value. Since the migration generates it in the DB, we need to pick a value upfront and use it in both places. I'll use a pre-generated UUID.

## Step 4: Update Client Identity (`src/lib/despia.ts`)

Add vault-based identity resolution functions:
- `initializeDespiaIdentity()` -- vault read, purchase restore, install_id fallback, persist, OneSignal sync
- `handleDespiaLogin(userId)` -- persist Supabase user ID to vault + OneSignal
- `handleDespiaLogout()` -- generate anonymous ID, sync to OneSignal
- `processIdentityRetryQueue()` -- retry failed backend syncs

## Step 5: Update `src/hooks/useDespiaInit.ts`

- On mount: call `initializeDespiaIdentity()` + `processIdentityRetryQueue()`
- On login: call `handleDespiaLogin(user.id)`
- Keep existing device-linking and iapSuccess logic

## Step 6: Update `src/hooks/useAuth.tsx`

- Call `handleDespiaLogout()` inside the sign-out flow

## Step 7: Deploy and Verify

- Deploy the updated Edge Function
- Test by calling the function directly with curl to verify the `x-trigger-secret` path works
- Check Edge Function logs for "OneSignal API response" instead of 401 errors

---

## Technical: Secret Flow

The secret value `d7f3a1b2-9e4c-4d8f-b6a5-3c2e1f0d9a8b` (example) will be:
1. Inserted into `vault.secrets` via SQL migration (DB trigger reads it)
2. Added as `INTERNAL_TRIGGER_SECRET` Edge Function secret (function reads it)
3. Both sides compare the value -- match means trusted call

## Files Changed

| File | Action |
|---|---|
| `supabase/migrations/XXXX_fix_push_trigger_auth.sql` | New: vault secret + updated trigger function |
| `supabase/functions/send-push-notification/index.ts` | Edit: add trust check + modernize OneSignal API |
| `src/lib/despia.ts` | Edit: add identity resolution functions |
| `src/hooks/useDespiaInit.ts` | Edit: use new identity functions |
| `src/hooks/useAuth.tsx` | Edit: add logout identity cleanup |

