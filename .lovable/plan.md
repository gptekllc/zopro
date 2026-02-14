

## Prevent Accidental Navigation When Dialogs Are Open

### The Problem
When you have a Create/Edit Job, Quote, or Invoice dialog open and accidentally tap a navigation item (bottom nav, sidebar, etc.), React Router navigates to the new page, unmounting the current page and destroying all dialog state and form data.

### The Solution
Use React Router v7's `useBlocker` hook to block navigation when a dialog with form data is open. When blocked, show a confirmation alert asking "You have unsaved changes. Are you sure you want to leave?" with Stay/Leave options.

### Changes

**1. Create a reusable `useNavigationBlocker` hook (`src/hooks/useNavigationBlocker.ts`)**

A simple hook that wraps `useBlocker` from `react-router-dom`. It accepts a `shouldBlock` boolean (true when a dialog is open) and shows an `AlertDialog` when the user tries to navigate away.

**2. Create an `UnsavedChangesDialog` component (`src/components/common/UnsavedChangesDialog.tsx`)**

A small `AlertDialog` component that displays "You have unsaved changes" with "Stay" and "Leave" buttons. It calls `blocker.reset()` on Stay and `blocker.proceed()` on Leave.

**3. Update `src/pages/Jobs.tsx`**

- Import and use `useNavigationBlocker` with `shouldBlock = isDialogOpen`
- Render the `UnsavedChangesDialog` component

**4. Update `src/pages/Quotes.tsx`**

- Same pattern: block navigation when the create/edit dialog is open

**5. Update `src/pages/Invoices.tsx`**

- Same pattern: block navigation when the create/edit dialog is open

### How It Works

When a dialog is open:
- Tapping a nav item triggers React Router navigation
- `useBlocker` intercepts it and prevents the route change
- The confirmation dialog appears on top of the form
- "Stay" keeps the user on the page with the dialog still open
- "Leave" proceeds with navigation (dialog and data are lost)

This does not affect closing the dialog normally via its Cancel button or the X button -- those still work as before.
