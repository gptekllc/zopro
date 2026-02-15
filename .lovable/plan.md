
## Fix Detail Dialog Outside-Click and Add Unsaved Changes Warning on Close

### Change 1: Remove `onInteractOutside` from Detail Dialogs

The detail dialogs (JobDetailDialog, QuoteDetailDialog, InvoiceDetailDialog) should allow closing by clicking outside -- they are read-only views, not forms with unsaved data.

**Files:**
- `src/components/jobs/JobDetailDialog.tsx` -- Remove `onInteractOutside={(e) => e.preventDefault()}`
- `src/components/quotes/QuoteDetailDialog.tsx` -- Remove `onInteractOutside={(e) => e.preventDefault()}`
- `src/components/invoices/InvoiceDetailDialog.tsx` -- Remove `onInteractOutside={(e) => e.preventDefault()}`

### Change 2: Add Unsaved Changes Confirmation on Create/Edit Dialog Close

When the user clicks the X button or Cancel on a create/edit dialog, check if any form fields have been modified from their initial state. If changes exist, show a `window.confirm()` prompt before closing.

**Approach:**
- Store the initial form state when the dialog opens (using a `useRef`)
- On close attempt (via `onOpenChange(false)` or Cancel button), compare current form data to the initial snapshot
- If different, show `window.confirm('You have unsaved changes. Discard and close?')`
- If confirmed or no changes, close the dialog and reset form
- Keep `onInteractOutside={(e) => e.preventDefault()}` to prevent accidental background taps from triggering the close flow

**Files:**
- `src/pages/Jobs.tsx` -- Add `initialFormRef`, dirty check in `onOpenChange` and Cancel button
- `src/pages/Quotes.tsx` -- Same pattern
- `src/pages/Invoices.tsx` -- Same pattern

### Technical Detail

For each page, the implementation will:

1. Add a `useRef` to capture the initial form state when the dialog opens:
```tsx
const initialFormRef = useRef<string>('');
```

2. When dialog opens, snapshot the form:
```tsx
useEffect(() => {
  if (isDialogOpen) {
    initialFormRef.current = JSON.stringify(formData);
  }
}, [isDialogOpen]);
```

3. Create a `handleDialogClose` function:
```tsx
const handleDialogClose = () => {
  const isDirty = JSON.stringify(formData) !== initialFormRef.current;
  if (isDirty) {
    if (!window.confirm('You have unsaved changes. Discard and close?')) {
      return;
    }
  }
  openEditDialog(false);
  resetForm();
};
```

4. Wire it to `onOpenChange` and the Cancel button:
```tsx
<Dialog open={isDialogOpen} onOpenChange={(open) => {
  if (!open) { handleDialogClose(); return; }
  openEditDialog(open);
}}>
```

### Summary

| File | Change |
|------|--------|
| `src/components/jobs/JobDetailDialog.tsx` | Remove `onInteractOutside` |
| `src/components/quotes/QuoteDetailDialog.tsx` | Remove `onInteractOutside` |
| `src/components/invoices/InvoiceDetailDialog.tsx` | Remove `onInteractOutside` |
| `src/pages/Jobs.tsx` | Add dirty-check confirmation on close |
| `src/pages/Quotes.tsx` | Add dirty-check confirmation on close |
| `src/pages/Invoices.tsx` | Add dirty-check confirmation on close |
