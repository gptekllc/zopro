

## Add PermissionGate Wrappers for Payment Actions

Wrap all "Record Payment", "Pay Online", and related payment action buttons with the `PermissionGate` component using the `record_payments` permission. This ensures only users with the appropriate permission can access these actions, while users without permission see a disabled button with a tooltip.

### Files to Change

**1. `src/components/invoices/InvoiceDetailDialog.tsx`**
- Wrap the "Payment" button (line 847) and "Pay Online" button (line 851) with `PermissionGate` using `permission="record_payments"` and a descriptive `deniedMessage`.
- Add import for `PermissionGate`.

**2. `src/components/invoices/InvoiceListManager.tsx`**
- Find the trigger point(s) where "Record Payment" is initiated from the invoice list (e.g., swipe actions or context menus that call `initiateRecordPayment`) and wrap with `PermissionGate`.
- Add import for `PermissionGate`.

**3. `src/components/reports/TransactionsReport.tsx`**
- Wrap all three "Record Payment" / "Add Record" buttons (mobile at line 396, tablet at line 425, desktop at line 454) with `PermissionGate`.
- Add import for `PermissionGate`.

### Behavior
- Users **with** `record_payments` permission: no change, buttons work as before.
- Users **without** permission: buttons appear disabled (grayed out) with a tooltip: "You don't have permission to record payments".
- No `hideWhenDenied` -- buttons remain visible but disabled so users know the feature exists.

### Technical Details

Each wrapper looks like:
```tsx
<PermissionGate permission="record_payments" deniedMessage="You don't have permission to record payments">
  <Button ...>Payment</Button>
</PermissionGate>
```

The `PermissionGate` component already handles the disabled overlay and tooltip. No new dependencies or database changes are needed.

