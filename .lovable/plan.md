

## Fix Page Crashes and Add Real-Time Updates

### Problem: Pages Crash
The Jobs, Quotes, and Invoices pages crash because `useBlocker` from react-router-dom v7 requires a data router (`createBrowserRouter`), but the app uses the legacy `BrowserRouter`. This is a known incompatibility.

### Fix 1: Replace useBlocker with a Compatible Approach

Since migrating the entire app to `createBrowserRouter` is a large refactor, we will replace the blocker with a simpler, compatible approach:

- **Remove** `useNavigationBlocker` hook usage from Jobs, Quotes, and Invoices pages
- **Remove** the `UnsavedChangesDialog` component usage from those pages
- **Add `window.onbeforeunload`** protection when dialogs are open -- this catches browser back button, tab close, and accidental refresh
- **Wrap navigation links** with an `onBeforeNavigate` check in `MobileBottomNav` and sidebar that checks a global state flag before navigating

**Simplified approach**: Use a global Zustand flag (`hasUnsavedChanges`) that the dialog sets when opened. The `MobileBottomNav` and `AppLayout` sidebar links check this flag and show a `confirm()` before navigating.

### Changes

**1. `src/hooks/useNavigationBlocker.ts` -- Rewrite without useBlocker**

Replace the hook to use `window.onbeforeunload` and expose a global flag:

```tsx
import { useEffect } from 'react';

export function useNavigationBlocker(shouldBlock: boolean) {
  useEffect(() => {
    if (!shouldBlock) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldBlock]);

  // Set a global flag for in-app navigation guards
  useEffect(() => {
    (window as any).__hasUnsavedChanges = shouldBlock;
    return () => { (window as any).__hasUnsavedChanges = false; };
  }, [shouldBlock]);
}
```

**2. `src/components/layout/MobileBottomNav.tsx` -- Add navigation guard**

Before navigating, check `window.__hasUnsavedChanges` and show a confirm dialog:

```tsx
const handleNavClick = (path: string) => {
  if ((window as any).__hasUnsavedChanges) {
    if (!window.confirm('You have unsaved changes. Leave this page?')) {
      return;
    }
  }
  navigate(path);
};
```

**3. `src/components/layout/AppLayout.tsx` -- Add navigation guard to sidebar links**

Same pattern for desktop sidebar navigation links.

**4. `src/pages/Jobs.tsx`, `src/pages/Quotes.tsx`, `src/pages/Invoices.tsx`**

- Remove `UnsavedChangesDialog` import and rendering
- Keep `useNavigationBlocker(isDialogOpen)` call (now using the rewritten hook)
- Remove blocker state/reset/proceed references

**5. Remove `src/components/common/UnsavedChangesDialog.tsx`** (no longer needed)

### Fix 2: Real-Time Updates Across Devices

TanStack Query already refetches data when the browser tab regains focus. For automatic real-time sync, add Supabase Realtime subscriptions to the main data hooks:

**Update `src/hooks/useJobs.ts`, `src/hooks/useQuotes.ts`, `src/hooks/useInvoices.ts`**

Add a `useEffect` in each hook that subscribes to Supabase Realtime changes on the respective table and invalidates the TanStack Query cache when changes are detected:

```tsx
useEffect(() => {
  const channel = supabase
    .channel('jobs-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'jobs' },
      () => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [queryClient]);
```

This ensures all users see new/updated items automatically without manual refresh.

### Summary

| File | Change |
|------|--------|
| `src/hooks/useNavigationBlocker.ts` | Rewrite to use `beforeunload` + global flag (no `useBlocker`) |
| `src/components/layout/MobileBottomNav.tsx` | Add navigation guard check before navigating |
| `src/components/layout/AppLayout.tsx` | Add navigation guard check to sidebar links |
| `src/pages/Jobs.tsx` | Remove `UnsavedChangesDialog`, keep rewritten blocker hook |
| `src/pages/Quotes.tsx` | Remove `UnsavedChangesDialog`, keep rewritten blocker hook |
| `src/pages/Invoices.tsx` | Remove `UnsavedChangesDialog`, keep rewritten blocker hook |
| `src/hooks/useJobs.ts` | Add Supabase Realtime subscription for auto-refresh |
| `src/hooks/useQuotes.ts` | Add Supabase Realtime subscription for auto-refresh |
| `src/hooks/useInvoices.ts` | Add Supabase Realtime subscription for auto-refresh |
| `src/components/common/UnsavedChangesDialog.tsx` | Remove (no longer needed) |

