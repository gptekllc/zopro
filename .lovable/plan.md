

## Floating Frosted Glass Bottom Navigation Bar

### Overview
Restyle the mobile bottom navigation bar into a floating frosted glass pill with a liquid glass aesthetic. The "More" dropdown menu will also receive the same frosted glass treatment.

### Changes

**File: `src/components/layout/MobileBottomNav.tsx`**

1. **Nav container** (lines 83-90) -- Replace `bg-card border-t` full-width bar with a floating pill:
   - Add `mx-4 rounded-full` for pill shape with side margins
   - Remove `border-t`, add thin semi-transparent border: `1px solid rgba(255, 255, 255, 0.15)`
   - Apply `backdrop-filter: blur(10px)` and `-webkit-backdrop-filter: blur(10px)`
   - Set background to `rgba(255, 255, 255, 0.1)`
   - Add shadow: `0 4px 30px rgba(0, 0, 0, 0.15)`
   - Change bottom offset from `0` to `max(0.75rem, calc(var(--safe-area-bottom) * 0.5 + 0.75rem))`
   - Remove the old `paddingBottom` safe-area approach (pill has its own margin now)

2. **Icon/label colors** (lines 97-101, 113-117) -- Switch to white-based palette:
   - Active state: `text-white` with soft glow via `filter: drop-shadow(0 0 6px rgba(255,255,255,0.5))`
   - Inactive state: `text-white/60` with hover `text-white/90`

3. **"More" dropdown tray** (line 124) -- Apply matching glass effect:
   - Override className to use `backdrop-blur-md bg-white/10 border border-white/15 text-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.15)]`
   - Menu items: `text-white hover:bg-white/10 focus:bg-white/10`
   - Separators: `bg-white/15`

### Technical Details

```text
Nav outer element styles:
  className: "lg:hidden fixed left-0 right-0 z-[90] mx-4"
  style:
    bottom: 'max(0.75rem, calc(var(--safe-area-bottom) * 0.5 + 0.75rem))'
    background: 'rgba(255, 255, 255, 0.1)'
    backdropFilter: 'blur(10px)'
    WebkitBackdropFilter: 'blur(10px)'
    borderRadius: '9999px'
    border: '1px solid rgba(255, 255, 255, 0.15)'
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.15)'

Active nav item:
  className: "text-white"
  style: { filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.5))' }

Inactive nav item:
  className: "text-white/60 hover:text-white/90"

DropdownMenuContent:
  className: "mb-2 w-56 p-2 backdrop-blur-md border-white/15 
    rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.15)]"
  style: { background: 'rgba(255,255,255,0.1)' }

DropdownMenuItem:
  className: "py-3 px-3 min-h-[44px] cursor-pointer text-white 
    hover:bg-white/10 focus:bg-white/10 focus:text-white"

DropdownMenuSeparator:
  className: "my-2 bg-white/15"
```

### Files Modified
- `src/components/layout/MobileBottomNav.tsx` -- All styling changes contained in this single file

