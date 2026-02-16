

## Prevent Bottom Nav from Blocking Dialog Action Buttons

### Problem
When opening Job, Quote, or Invoice detail dialogs on mobile, the footer action buttons (Edit, dropdown menus, Payment, etc.) sit at the bottom of the dialog content and get obscured by the floating bottom navigation bar.

### Solution
Add bottom padding to the footer action sections inside all three detail dialogs so the buttons remain fully visible and tappable above the bottom nav bar on mobile. The padding will only apply on mobile (below `sm` breakpoint) since the desktop layout centers dialogs differently.

### Changes

**1. `src/components/jobs/JobDetailDialog.tsx`**
- Update the footer `<div>` (line ~1123) from `p-4` to include mobile-specific bottom padding: `p-4 pb-20 sm:pb-4 sm:px-6`

**2. `src/components/quotes/QuoteDetailDialog.tsx`**
- Update the footer `<div>` (line ~404) from `p-4` to include mobile-specific bottom padding: `p-4 pb-20 sm:pb-4 sm:px-6`

**3. `src/components/invoices/InvoiceDetailDialog.tsx`**
- Update the footer `<div>` (line ~837) from `p-4` to include mobile-specific bottom padding: `p-4 pb-20 sm:pb-4 sm:px-6`

### Why `pb-20`
The floating bottom nav has a height of roughly `4.375rem + 5px` plus a `1.25rem` offset from the bottom. Using `pb-20` (5rem) provides enough clearance so action buttons are not blocked, consistent with the existing pattern used elsewhere in the app for bottom-nav-aware spacing.
