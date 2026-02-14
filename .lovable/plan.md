

## Add Manager Role to Missing Navigation Items

### Problem
The `manager` role is missing from most navigation items in both the desktop sidebar (`AppLayout.tsx`) and the mobile bottom nav (`MobileBottomNav.tsx`). Managers currently can only see Invoices, Reports, Items, and Notifications in the sidebar, and are completely locked out of the mobile bottom nav.

### Changes

**1. `src/components/layout/AppLayout.tsx` -- Sidebar nav roles**

Add `'manager'` to the following routes:

| Route | Current Roles | Updated Roles |
|-------|--------------|---------------|
| Dashboard | admin, technician, super_admin | admin, **manager**, technician, super_admin |
| Customers | admin, technician | admin, **manager**, technician |
| Jobs | admin, technician | admin, **manager**, technician |
| Quotes | admin, technician | admin, **manager**, technician |
| Time Clock | admin, technician | admin, **manager**, technician |
| Technicians | admin, technician | admin, **manager**, technician |

Routes already correct (no change): Invoices, Reports, Items, Notifications, Company (admin-only), Super Admin.

**2. `src/components/layout/MobileBottomNav.tsx` -- Mobile nav access**

- Update the `hasAccess` check (line 36) to include `manager`:
  ```tsx
  const isManager = userRoles.includes('manager');
  const hasAccess = isAdmin || isManager || isTechnician || userRoles.length === 0;
  ```
- Update `filteredMoreItems` filter (line 58) to also grant `showFor: 'admin'` items to managers (Reports, Technicians, Company access for managers is debatable -- only Reports and Technicians make sense):
  - Change Reports `showFor` from `'admin'` to `'admin_manager'`
  - Add a condition: `(item.showFor === 'admin_manager' && (isAdmin || isManager))`
  - Technicians stays `'admin'` only since managers may not need to manage technician settings

Alternatively, a simpler approach: add a `'manager'` showFor value and handle it, or change Reports to `showFor: 'all'` since page-level permission gating already restricts content.

**Simplest approach for MobileBottomNav**: Since the Reports page already has its own permission check (`view_reports`), change Reports to `showFor: 'all'` and let the page handle access. For Technicians, keep `showFor: 'admin'` since managers don't need technician management. For Company, keep `showFor: 'admin'`.

### Summary of File Changes

- **`src/components/layout/AppLayout.tsx`**: Add `'manager'` to 6 nav item role arrays
- **`src/components/layout/MobileBottomNav.tsx`**: Add `isManager` check to `hasAccess`, change Reports `showFor` to `'all'`

