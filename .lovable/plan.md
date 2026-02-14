

## Ensure Items Button Visibility for All Roles

### Problem
The "Items" button in the Products/Services sections of Edit Job, Edit Quote, and Edit Invoice forms is sometimes invisible because:
1. The `ItemsPicker` component hides itself entirely when there are no catalog items of that type (`filteredItems.length === 0`). If a company has no products or no services in the catalog, the button disappears completely.
2. The Items page navigation in `AppLayout.tsx` only allows `['admin', 'technician']` roles -- missing `'manager'`.

### Changes

**1. `src/components/line-items/ItemsPicker.tsx`**
- Remove the early `return null` when `filteredItems.length === 0`. Instead, always show the "Items" button and display "No items found" in the dropdown when the catalog is empty. This way users always know the feature exists and can add items to the catalog.

**2. `src/components/layout/AppLayout.tsx`**
- Add `'manager'` to the Items navigation route roles: change from `['admin', 'technician']` to `['admin', 'manager', 'technician']`.

### Technical Details

In `ItemsPicker.tsx`, remove lines 21-23:
```tsx
// REMOVE this block:
if (filteredItems.length === 0) {
  return null;
}
```

The existing `CommandEmpty` component (line 41) already handles the empty state inside the dropdown with "No products/services found in items."

In `AppLayout.tsx`, update the Items route roles (around line 67):
```tsx
// From:
roles: ['admin', 'technician']
// To:
roles: ['admin', 'manager', 'technician']
```

No database or RLS changes needed -- all authenticated company members already have SELECT access to `catalog_items`.
