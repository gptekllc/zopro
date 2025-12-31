-- First, let's drop ALL existing INSERT policies on companies and recreate properly
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;

-- Recreate with explicit PERMISSIVE
CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (true);