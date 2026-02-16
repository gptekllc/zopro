

## Fix Dropdown Menus in Detail Dialogs

### Problem
The dropdown menus in Job and Quote detail dialogs are invisible when clicked. Two issues combine to cause this:

1. The `z-50` class added to the dropdown overrides the built-in `z-[100]`, making the dropdown render behind the dialog (which sits at z-[70]).
2. Radix's collision detection combined with `side="top"` inside a CSS-transformed dialog container miscalculates position, applying `transform: translate(0px, -200%)` to the dropdown wrapper -- pushing it completely off-screen.

### Solution
- Remove `side="top"` -- let Radix auto-detect the best direction (it will naturally open upward if there's no room below).
- Remove the `z-50` override so the dropdown keeps its default `z-[100]`, which is higher than the dialog's `z-[70]`.
- Keep `bg-popover` for solid background.

### Files to Change

**1. `src/components/jobs/JobDetailDialog.tsx` (line 1179)**
Change:
```
className="w-48 bg-popover z-50"  side="top"
```
To:
```
className="w-48 bg-popover"
```
(Remove `side="top"` prop and `z-50` class)

**2. `src/components/quotes/QuoteDetailDialog.tsx` (line 443)**
Same change -- remove `side="top"` and `z-50` from the DropdownMenuContent.

