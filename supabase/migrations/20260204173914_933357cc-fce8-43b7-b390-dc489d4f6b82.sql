-- Add explicit policy to block anonymous access to companies table
-- This ensures only authenticated users can access the table

-- First, let's add a restrictive policy requiring authentication
CREATE POLICY "Require authentication for companies access"
ON public.companies
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);

-- Also add similar protection to payments table (flagged in security scan)
CREATE POLICY "Require authentication for payments access"
ON public.payments
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);