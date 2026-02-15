

## Fix Pull-to-Refresh, Dialog Persistence, and Navigation Guard Issues

### Issue 1: Pull-to-Refresh Not Working on Most Pages

**Root Cause**: The pull-to-refresh actually works correctly on Dashboard, Customers, Technicians, Notifications, Items, TimeClock, and Reports pages -- all pages that have the `PullToRefresh` wrapper. However, it was intentionally removed from Jobs, Quotes, and Invoices in a previous change. The user reports it doesn't work on the other pages either, which likely means the gesture feels unresponsive because there's a conflict with the browser's native pull-to-refresh or the touch events are being consumed by scrollable content within the page.

**Fix**: Add `overscroll-behavior-y: contain` to the PullToRefresh container to prevent the browser's native pull-to-refresh from competing with the custom one. Also add `touch-action: pan-y` to ensure vertical touch events are properly captured.

### Issue 2: Dialogs Closing When Switching Apps

**Root Cause**: The current `main.tsx` no longer force-reloads on SW update (that was fixed). However, TanStack Query's `refetchOnWindowFocus` is enabled by default. When you switch back, all queries refetch, which can cause the page to re-render and reset local state (including dialog open state) if the data shape changes or triggers loading states.

**Fix**: Disable `refetchOnWindowFocus` globally in the QueryClient config. The app already has Supabase Realtime subscriptions for live updates, so window-focus refetching is redundant and harmful to dialog state.

### Issue 3: Navigation Guard Not Prompting on Bottom Nav Taps

**Root Cause**: The `guardedNavigate` function in `MobileBottomNav.tsx` correctly checks `__hasUnsavedChanges` and shows `window.confirm()`. However, when the user taps the same page they're already on (e.g., tapping "Jobs" while on `/jobs`), the navigation still fires and can reset the page state. Also, the `DropdownMenuItem` in the "More" menu uses `onClick` which may not properly prevent the default behavior when the confirm is cancelled.

**Fix**: 
- Skip navigation if already on the target page
- Ensure the confirm dialog actually blocks navigation in all code paths
- Clear the `__hasUnsavedChanges` flag only after confirmed leave

### Technical Changes

**1. `src/components/ui/pull-to-refresh.tsx`**
- Add `overscroll-behavior-y: contain` style to the container to prevent browser native pull-to-refresh from competing
- Add `touch-action: pan-y` to improve gesture reliability

**2. `src/App.tsx`**
- Add `refetchOnWindowFocus: false` to the global QueryClient config to prevent background refetches from resetting dialog state when returning from another app

**3. `src/components/layout/MobileBottomNav.tsx`**
- Fix `guardedNavigate` to skip navigation when already on the target path
- Ensure the navigation guard works correctly for all nav items including the "More" dropdown items

**4. `src/components/layout/AppLayout.tsx`**
- Same fix for desktop sidebar: skip navigation to current page

| File | Change |
|------|--------|
| `src/components/ui/pull-to-refresh.tsx` | Add `overscroll-behavior-y: contain` and `touch-action: pan-y` |
| `src/App.tsx` | Add `refetchOnWindowFocus: false` to QueryClient defaults |
| `src/components/layout/MobileBottomNav.tsx` | Skip same-page navigation, fix guard logic |
| `src/components/layout/AppLayout.tsx` | Skip same-page navigation in sidebar |

