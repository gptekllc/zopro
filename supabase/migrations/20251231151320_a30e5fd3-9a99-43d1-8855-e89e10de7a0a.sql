-- Add timezone column to companies table
ALTER TABLE public.companies 
ADD COLUMN timezone text DEFAULT 'America/New_York';

-- Update RLS policies for time_entries to allow managers to update
CREATE POLICY "Managers can update time entries in their company"
ON public.time_entries
FOR UPDATE
USING (
  company_id IN (
    SELECT p.company_id 
    FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')
  )
);

-- Allow admins and managers to delete time entries
DROP POLICY IF EXISTS "Admins can delete time entries" ON public.time_entries;
CREATE POLICY "Admins and managers can delete time entries"
ON public.time_entries
FOR DELETE
USING (
  company_id IN (
    SELECT p.company_id 
    FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')
  )
);