

## Fix: Status Dropdown Not Working in Invoice Detail Dialog

### Root Cause
The status dropdown in `InvoiceDetailDialog.tsx` (line 437) explicitly sets `z-50` in the className, which overrides the dropdown component's default `z-[100]`. Since the dialog content renders at `z-[70]`, the dropdown menu appears behind the dialog and can't be interacted with.

### Fix
**File:** `src/components/invoices/InvoiceDetailDialog.tsx` (line 437)

Remove the `z-50` class from the `DropdownMenuContent`, letting it inherit the component's default `z-[100]` which is already higher than the dialog's `z-[70]`.

**Before:**
```tsx
<DropdownMenuContent align="end" className="bg-popover z-50 min-w-[120px]">
```

**After:**
```tsx
<DropdownMenuContent align="end" className="bg-popover min-w-[120px]">
```

This is a one-line change. The `bg-popover` class is also redundant (the component already has it), but keeping it is harmless.
