

# Fix: Stop Page Refresh When Reopening the App

## Problem
When you switch away from the app and come back, the entire page refreshes, closing any open dialogs and losing unsaved work. The previous service worker fix was necessary but didn't solve the issue completely.

## Root Cause
When you return to the app, Supabase automatically refreshes the authentication token and fires a `TOKEN_REFRESHED` event. The current code in `useAuth.tsx` treats this event the same as a fresh login -- it re-fetches the profile, roles, and MFA status. Critically, `refreshMFAStatus()` sets `isMFALoading = true`, which causes `ProtectedRoute` to unmount the entire page and show a "Loading..." screen. When it finishes, the page re-renders from scratch and any open dialog is gone.

## Solution

Two changes in a single file (`src/hooks/useAuth.tsx`):

### 1. Skip full re-fetch on TOKEN_REFRESHED events
Add an early return in the `onAuthStateChange` handler for `TOKEN_REFRESHED` events. A token refresh doesn't change the user's profile, roles, or MFA status -- it just extends the session. There's no reason to re-fetch everything.

### 2. Only show MFA loading screen on initial app boot
Add a `useRef` flag (`initialLoadComplete`) so that `refreshMFAStatus` only sets `isMFALoading = true` during the very first load. After that, MFA checks still run (for enroll/verify actions) but they update state silently without triggering the full-page loading screen in `ProtectedRoute`.

## Files Changed

| File | Change |
|---|---|
| `src/hooks/useAuth.tsx` | Filter out `TOKEN_REFRESHED` in auth listener; guard `isMFALoading` with initial-load ref |

## Technical Details

**Change 1** -- `onAuthStateChange` handler (around line 233):
```typescript
supabase.auth.onAuthStateChange((event, session) => {
  setSession(session);
  setUser(session?.user ?? null);

  // Token refresh happens on every app resume -- skip full re-fetch
  // to prevent unmounting the page and closing open dialogs
  if (event === 'TOKEN_REFRESHED') return;

  if (session?.user) {
    // ... existing profile/roles/MFA fetch
  } else {
    // ... existing cleanup
  }
});
```

**Change 2** -- `refreshMFAStatus` function (around line 121):
```typescript
const initialLoadComplete = useRef(false);

const refreshMFAStatus = async (userId?: string) => {
  // Only show the full loading screen during initial app boot
  if (!initialLoadComplete.current) {
    setIsMFALoading(true);
  }
  try {
    // ... existing MFA + trusted device logic (unchanged)
  } finally {
    setIsMFALoading(false);
    initialLoadComplete.current = true;
  }
};
```

These two changes ensure:
- Returning to the app after switching never triggers a full-page reload
- Open dialogs and unsaved work are preserved
- MFA security is still enforced on initial login
- Explicit MFA actions (enroll, verify, unenroll) still work correctly

