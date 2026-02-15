

# Fix: Stop Auto-Refresh on App Open / Preserve Dialogs When Switching Apps

## Problem

Every time you open the app (or return to it after switching to another app), the page automatically refreshes. This causes any open create/edit dialog to close, losing your unsaved work.

## Root Cause

The PWA service worker is configured with `registerType: "autoUpdate"`, which automatically activates new service worker versions in the background. When the service worker updates (which happens frequently during development/deployment), it calls `skipWaiting()` and `clients.claim()`, which can trigger a full page reload -- closing any open dialogs.

Additionally, there is a second service worker (`public/sw.js`) for push notifications that also calls `self.skipWaiting()` on install, creating a conflict with the Workbox-managed service worker.

## Solution

### 1. Change PWA register type from `autoUpdate` to `prompt`

In `vite.config.ts`, switch from `autoUpdate` to `prompt`. This prevents the new service worker from auto-activating and reloading the page. Instead, the app stores the update function and only applies it when the user explicitly navigates (not when returning from another app).

### 2. Remove `skipWaiting()` from `public/sw.js`

The custom push notification service worker should not call `self.skipWaiting()` on install, as this conflicts with the Workbox SW lifecycle. Instead, let it wait for the natural activation cycle.

### 3. Update `main.tsx` registration

Adjust the `registerSW` call to match the `prompt` behavior -- the `onNeedRefresh` callback already defers the update correctly, but the registration type needs to match.

## Files Changed

| File | Change |
|---|---|
| `vite.config.ts` | Change `registerType` from `"autoUpdate"` to `"prompt"` |
| `public/sw.js` | Remove `self.skipWaiting()` from install handler |
| `src/main.tsx` | No change needed (already defers updates correctly) |

## Technical Details

**`vite.config.ts`** -- line 20:
```
registerType: "prompt"    // was: "autoUpdate"
```

**`public/sw.js`** -- install handler:
```javascript
self.addEventListener('install', function(event) {
  console.log('[Service Worker] Installing...');
  // Removed: self.skipWaiting() -- let Workbox control the lifecycle
});
```

With `prompt` mode, the `onNeedRefresh` callback in `main.tsx` fires when a new version is available, but the update is only applied when `updateSW(true)` is explicitly called (currently stored as `__pendingSWUpdate` for the next navigation). The page will never reload automatically just because a new deployment happened.

