
-- Fix: Change companies SELECT policies to require authentication
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Super admins can view all companies" ON public.companies;

-- Recreate with authenticated role
CREATE POLICY "Users can view their company"
ON public.companies
FOR SELECT
TO authenticated
USING (id = get_user_company_id(auth.uid()));

CREATE POLICY "Super admins can view all companies"
ON public.companies
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- Also fix UPDATE policies to use authenticated role
DROP POLICY IF EXISTS "Admins can update their company" ON public.companies;
DROP POLICY IF EXISTS "Super admins can update any company" ON public.companies;
DROP POLICY IF EXISTS "Super admins can delete companies" ON public.companies;

CREATE POLICY "Admins can update their company"
ON public.companies
FOR UPDATE
TO authenticated
USING (
  id = get_user_company_id(auth.uid()) 
  AND has_role(auth.uid(), 'admin')
);

CREATE POLICY "Super admins can update any company"
ON public.companies
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete companies"
ON public.companies
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));
