-- Drop existing problematic policies on profiles
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

-- Create policy using security definer function to avoid recursion
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Users can view profiles in same company"
ON public.profiles
FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

-- Fix admin insert policy
CREATE POLICY "Admins can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid()) 
  AND public.has_role(auth.uid(), 'admin')
);