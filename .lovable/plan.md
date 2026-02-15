
# Add 5px Safe Area Below Bottom Navigation Bar

## What This Does
Adds 5px of extra padding at the very bottom of the screen, below the mobile bottom navigation bar. This prevents the nav bar from sitting flush against the device edge, giving it a small visual buffer.

## Changes

| File | Change |
|---|---|
| `src/components/layout/MobileBottomNav.tsx` | Increase the bottom padding from `max(0.25rem, calc(var(--safe-area-bottom) * 0.5))` to `max(calc(0.25rem + 5px), calc(var(--safe-area-bottom) * 0.5 + 5px))` to add 5px below the nav bar |

## Technical Detail

In the `<nav>` element's inline `style`, the `paddingBottom` value will be updated to always include an additional 5px:

```
// Before
paddingBottom: 'max(0.25rem, calc(var(--safe-area-bottom) * 0.5))'

// After
paddingBottom: 'max(calc(0.25rem + 5px), calc(var(--safe-area-bottom) * 0.5 + 5px))'
```

This ensures the 5px is added regardless of whether the device has a home indicator (safe area) or not.
