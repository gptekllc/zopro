

## Fix Double Pull-to-Refresh Arrows, Dialog Closing Without Warning, and App-Switch Dialog Loss

### Issue 1: Double Pull-to-Refresh Arrows

**Root Cause**: There are TWO nested `PullToRefresh` wrappers on Jobs, Quotes, and Invoices pages. One wraps the entire page (in `Jobs.tsx`, `Quotes.tsx`, `Invoices.tsx`) and another wraps just the list inside `JobListManager.tsx`, `QuoteListManager.tsx`, and `InvoiceListManager.tsx`. Each renders its own arrow indicator, causing the two arrows you see in the screenshot.

**Fix**: Remove `PullToRefresh` from the three ListManager components (`JobListManager.tsx`, `QuoteListManager.tsx`, `InvoiceListManager.tsx`). Keep only the page-level one. This ensures a single pull indicator at the top of the page.

### Issue 2: Dialog Closes Without Warning When Tapping Bottom Nav

**Root Cause**: The bottom nav sits at `z-index: 90`, which is above the dialog overlay (`z-index: 65`) and dialog content (`z-index: 70`). When the user taps a bottom nav item while a dialog is open, two things happen simultaneously:
1. The Radix Dialog detects a click outside its content area and fires `onOpenChange(false)`, closing the dialog
2. The nav click handler fires `guardedNavigate`, but by the time it checks `__hasUnsavedChanges`, the dialog's `onOpenChange` has already set `isDialogOpen = false`, which clears the flag

**Fix**: 
- On the Create/Edit dialog (Radix `Dialog`), add `onInteractOutside={(e) => e.preventDefault()}` to prevent Radix from closing the dialog when clicking outside. This means the dialog can only be closed via the Cancel button or X button -- not by accidentally tapping the nav.
- On the Detail view dialog (JobDetailDialog, QuoteDetailDialog, InvoiceDetailDialog), apply the same treatment so viewing a record isn't lost by accidental nav taps.

### Issue 3: Dialog Lost After Switching Apps (PWA)

**Root Cause**: When the user switches away from the PWA on mobile, the OS may put the webview to sleep. When returning, the browser may re-render the page. The `refetchOnWindowFocus: false` fix helps prevent TanStack Query from causing re-renders, but the real issue on PWA is that iOS/Android can discard the webview's JavaScript heap entirely and reload the page from scratch when memory is low. There is no way to fully prevent this at the application level -- it's an OS-level behavior.

However, we can mitigate the most common scenario (short app switches that don't kill the page) by ensuring `visibilitychange` events don't trigger any state resets. The current code should already handle this with `refetchOnWindowFocus: false`. For the cases where the OS kills the page, the dialog state is inherently lost.

**Fix**: No additional code changes needed beyond what's already in place (`refetchOnWindowFocus: false`). If the OS kills the PWA process, there's nothing the app can do -- this is expected mobile behavior.

---

### Technical Changes

**1. Remove inner PullToRefresh from ListManagers**

Files: `src/components/jobs/JobListManager.tsx`, `src/components/quotes/QuoteListManager.tsx`, `src/components/invoices/InvoiceListManager.tsx`

- Remove the `PullToRefresh` import
- Remove the `PullToRefresh` wrapper around the job/quote/invoice list, keeping only the inner `<div>` content

**2. Prevent dialog from closing on outside click**

File: `src/pages/Jobs.tsx`
- Add `onInteractOutside={(e) => e.preventDefault()}` to the `<DialogContent>` of the Create/Edit Job dialog

File: `src/pages/Quotes.tsx`
- Same change for the Create/Edit Quote dialog

File: `src/pages/Invoices.tsx`  
- Same change for the Create/Edit Invoice dialog

File: `src/components/jobs/JobDetailDialog.tsx`
- Add `onInteractOutside={(e) => e.preventDefault()}` to prevent detail view from closing on outside clicks

File: `src/components/quotes/QuoteDetailDialog.tsx`
- Same change

File: `src/components/invoices/InvoiceDetailDialog.tsx`
- Same change

### Summary

| File | Change |
|------|--------|
| `src/components/jobs/JobListManager.tsx` | Remove inner `PullToRefresh` wrapper |
| `src/components/quotes/QuoteListManager.tsx` | Remove inner `PullToRefresh` wrapper |
| `src/components/invoices/InvoiceListManager.tsx` | Remove inner `PullToRefresh` wrapper |
| `src/pages/Jobs.tsx` | Add `onInteractOutside` to prevent outside-click close |
| `src/pages/Quotes.tsx` | Add `onInteractOutside` to prevent outside-click close |
| `src/pages/Invoices.tsx` | Add `onInteractOutside` to prevent outside-click close |
| `src/components/jobs/JobDetailDialog.tsx` | Add `onInteractOutside` to prevent outside-click close |
| `src/components/quotes/QuoteDetailDialog.tsx` | Add `onInteractOutside` to prevent outside-click close |
| `src/components/invoices/InvoiceDetailDialog.tsx` | Add `onInteractOutside` to prevent outside-click close |
