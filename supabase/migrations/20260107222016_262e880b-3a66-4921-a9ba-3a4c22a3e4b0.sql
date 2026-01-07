-- =============================================
-- SECURITY FIXES FOR CRITICAL VULNERABILITIES
-- =============================================

-- 1. Fix Notifications Table - Remove dangerous open INSERT policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Allow service role only to insert notifications (for edge functions)
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (true);

-- Allow authenticated users to insert only their OWN notifications
CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 2. Block anonymous access to profiles (PII protection)
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- 3. Block anonymous access to customers (PII protection)
CREATE POLICY "Block anonymous access to customers"
ON public.customers
FOR SELECT
TO anon
USING (false);

-- 4. Fix Companies INSERT - only allow users without a company to create one
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;

CREATE POLICY "Users without company can create one"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND company_id IS NOT NULL
  )
);