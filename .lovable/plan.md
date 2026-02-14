

## Fix Pull-to-Refresh and Dialog Persistence Issues

### Problem 1: Pull-to-Refresh Not Working / Double Pull Gesture
The `PullToRefresh` component uses `container.scrollTop` to detect if the user is at the top of the page. However, the actual scrolling happens at the body/window level (the `<main>` element in `AppLayout` does not have `overflow: auto`), so the PullToRefresh container's `scrollTop` is always `0`. This causes gesture conflicts and the "double pull" behavior.

**Fix**: On the Jobs, Quotes, and Invoices pages, change the `PullToRefresh` component to use `window.scrollY` instead of `container.scrollTop` when detecting scroll position. This aligns with how the pages actually scroll.

### Problem 2: Dialogs Closing When Switching Apps
When you leave the app (switch to another app on your phone) and return, the PWA service worker detects a potential update and may trigger a page reload via the `onNeedRefresh` callback in `main.tsx`. The current code shows a `confirm()` dialog, but on mobile PWA this can behave unpredictably, and the visibility change event can cause React to re-render and reset state.

**Fix**: Update `main.tsx` to NOT auto-prompt for updates immediately on regaining focus. Instead, defer the update prompt or use a non-intrusive toast notification so dialogs and form state are preserved.

### Changes

**1. `src/components/ui/pull-to-refresh.tsx` -- Fix scroll detection**

Update `handleTouchStart` to check `window.scrollY` instead of `container.scrollTop`:

```tsx
const handleTouchStart = useCallback((e: React.TouchEvent) => {
  if (isRefreshing) return;
  // Check window scroll position instead of container
  if (window.scrollY > 0) return;
  startY.current = e.touches[0].clientY;
  setIsPulling(true);
}, [isRefreshing]);
```

Similarly update `handleTouchMove`:
```tsx
if (window.scrollY > 0) {
  setPullDistance(0);
  return;
}
```

Remove the `overflow-auto` class from the container div since the page scrolls at the body level, not within this container.

**2. `src/main.tsx` -- Prevent dialog-closing reload**

Replace the `confirm()` call with a deferred, non-destructive approach:

```tsx
const updateSW = registerSW({
  onNeedRefresh() {
    // Don't use confirm() which blocks and can cause issues on mobile
    // Instead, store the update and apply it on next navigation
    console.log("New version available - will update on next navigation");
    // Store update function for later use
    (window as any).__pendingSWUpdate = () => updateSW(true);
  },
  // ... rest unchanged
});
```

This prevents the page from reloading while a dialog is open, preserving all entered form data.

**3. Remove duplicate pull-to-refresh from Jobs, Quotes, Invoices (as requested)**

Since the user explicitly asked to remove the pull-to-refresh on these three pages in mobile view, we will:

- **`src/pages/Jobs.tsx`**: Remove the `PullToRefresh` wrapper, render `PageContainer` directly
- **`src/pages/Quotes.tsx`**: Remove the `PullToRefresh` wrapper, render `PageContainer` directly
- **`src/pages/Invoices.tsx`**: Remove the `PullToRefresh` wrapper, render `PageContainer` directly

The Dashboard page will keep pull-to-refresh since the user confirmed it works there.

### Summary

| File | Change |
|------|--------|
| `src/pages/Jobs.tsx` | Remove PullToRefresh wrapper |
| `src/pages/Quotes.tsx` | Remove PullToRefresh wrapper |
| `src/pages/Invoices.tsx` | Remove PullToRefresh wrapper |
| `src/components/ui/pull-to-refresh.tsx` | Fix scroll detection to use `window.scrollY` instead of `container.scrollTop` |
| `src/main.tsx` | Replace `confirm()` update prompt with deferred non-destructive approach to prevent dialog state loss |

