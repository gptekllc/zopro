

## Add Manager Role to Invoices Navigation

A one-line change in `src/components/layout/AppLayout.tsx` at line 57.

**Current:**
```
roles: ['admin', 'technician', 'customer']
```

**Updated:**
```
roles: ['admin', 'manager', 'technician', 'customer']
```

This ensures users with the `manager` role can see and access the Invoices page from the navigation menu.

