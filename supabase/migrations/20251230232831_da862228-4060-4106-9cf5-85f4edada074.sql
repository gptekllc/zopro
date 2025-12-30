-- Super admins can view all user roles
CREATE POLICY "Super admins can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admins can insert any role
CREATE POLICY "Super admins can insert any role" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Super admins can delete any role
CREATE POLICY "Super admins can delete any role" 
ON public.user_roles 
FOR DELETE 
USING (public.has_role(auth.uid(), 'super_admin'));