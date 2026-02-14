

## Fix: Signature Save Failing Due to RLS Policy

### Problem
The `signatures` table only allows inserts via the **service role**. The app uses the regular client (anon/authenticated role), so all signature inserts are blocked by Row-Level Security.

The same table is also missing UPDATE and DELETE policies, which will be needed for the "clear signature" feature.

### Solution
Add RLS policies to allow authenticated users to insert, update, and delete signatures within their own company.

### Steps

1. **Database Migration** -- Add RLS policies to the `signatures` table:
   - INSERT policy: users can insert signatures for their own company
   - UPDATE policy: users can update signatures in their company
   - DELETE policy: admins can delete signatures in their company

2. **No code changes needed** -- The hooks (`useSignatures.ts`) and UI components are already correct. The only blocker is the missing database policies.

### Technical Details

The migration will add these policies:

```sql
-- Allow authenticated users to insert signatures for their company
CREATE POLICY "Users can insert signatures for their company"
  ON signatures FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- Allow authenticated users to update signatures in their company
CREATE POLICY "Users can update signatures in their company"
  ON signatures FOR UPDATE
  USING (company_id IN (
    SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()
  ));

-- Allow admins to delete signatures in their company
CREATE POLICY "Admins can delete signatures in their company"
  ON signatures FOR DELETE
  USING (company_id IN (
    SELECT profiles.company_id FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));
```

