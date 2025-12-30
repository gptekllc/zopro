-- Allow authenticated users to create companies (for onboarding)
CREATE POLICY "Authenticated users can create companies" 
ON public.companies 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Super admins can view all companies
CREATE POLICY "Super admins can view all companies" 
ON public.companies 
FOR SELECT 
USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admins can update any company
CREATE POLICY "Super admins can update any company" 
ON public.companies 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admins can delete companies
CREATE POLICY "Super admins can delete companies" 
ON public.companies 
FOR DELETE 
USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admins can update any profile (to assign companies)
CREATE POLICY "Super admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'super_admin'));