-- Drop the restrictive INSERT policy and create a permissive one
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;

-- Create a PERMISSIVE policy for authenticated users to create companies
CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (true);