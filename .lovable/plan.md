
# Push Notification Enhancement for Despia Native

## Summary
The OneSignal push integration via Despia is already wired up -- `setonesignalplayerid://` is called on every login. The main improvement needed is making the UI **platform-aware**: when running inside Despia, push is handled natively via OneSignal (no user opt-in needed), so the PWA push toggle and prompt should be replaced with a native-appropriate display.

## What Already Works
- `src/lib/despia.ts` calls `despia('setonesignalplayerid://?user_id=...')` correctly
- `useDespiaInit` hook fires this on every login inside `AuthedLayout`
- Deep links (AASA/assetlinks) are hosted
- PWA push works for web users via service worker

## Changes

### 1. Update PushNotificationToggle to be platform-aware
**File:** `src/components/notifications/PushNotificationToggle.tsx`

When inside Despia native runtime:
- Show a card confirming "Native push notifications are active via OneSignal"
- Display the platform (iOS / Android)
- No toggle needed -- push is managed at the OS level
- Provide guidance to manage in device Settings if needed

When on web (not Despia):
- Keep the existing PWA push toggle behavior unchanged

### 2. Update PushNotificationPrompt to skip in Despia
**File:** `src/components/notifications/PushNotificationPrompt.tsx`

When inside Despia, return `null` immediately -- native push is automatic, no prompt needed.

### 3. Update useDespiaInit to also send device UUID
**File:** `src/hooks/useDespiaInit.ts`

After login, also read `despia.uuid` and `despia.onesignalplayerid` and post them to the backend to link the device identity with the user. This enables server-side targeted push via OneSignal REST API.

### 4. Add device linking helper
**File:** `src/lib/despia.ts`

Add a `getDespiaOneSignalPlayerId()` helper to read the OneSignal player ID variable from the Despia runtime.

### 5. Update DESPIA_README.md
Log the source URL for this feature implementation.

## Technical Details

- Detection uses `isDespiaNative()` which checks `navigator.userAgent` for "despia" (case-insensitive)
- The `setonesignalplayerid://` scheme call maps the app's `user.id` to the OneSignal player, enabling targeted push from the backend
- No new dependencies needed -- `despia-native` is already installed
- The existing `send-push-notification` Edge Function can be extended later to also call OneSignal REST API for native users alongside the existing web push logic
