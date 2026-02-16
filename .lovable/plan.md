

## Fix FAB Positioning Above Floating Bottom Navigation Bar

### Problem
The bottom navigation bar is now a floating pill with bottom margin (~0.75rem + safe area), so FABs need increased bottom offsets to avoid being covered. Currently:
- **MobileFAB** (Jobs, Quotes, Invoices): uses `6.5rem` -- needs a bump to ~`7.5rem` to account for the floating gap
- **Customers FAB**: uses `5rem` -- significantly too low, needs to match ~`7.5rem`
- **Items page**: has no FAB, no changes needed

### Changes

**1. `src/components/layout/MobileFAB.tsx`**
- Update the bottom offset from `6.5rem` to `7.5rem` to clear the floating pill nav bar plus its bottom margin

**2. `src/pages/Customers.tsx`**
- Update the inline FAB bottom offset from `5rem` to `7.5rem` to match the same clearance as MobileFAB

### Technical Details

Both FABs will use the same formula:

```text
bottom: calc(env(safe-area-inset-bottom, 0px) + 7.5rem)
```

This accounts for:
- Nav bar height (~4.375rem + 5px)
- Nav bar bottom margin (~0.75rem + safe area offset)
- Extra breathing room above the pill

### Files Modified
- `src/components/layout/MobileFAB.tsx` -- line 53, update bottom offset
- `src/pages/Customers.tsx` -- line 457, update bottom offset

