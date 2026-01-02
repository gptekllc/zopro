-- Add RLS policy for admins to update profiles in their company
CREATE POLICY "Admins can update profiles in their company" 
ON public.profiles 
FOR UPDATE 
USING (
  company_id = get_user_company_id(auth.uid()) 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Add RLS policy for managers to update technician profiles in their company
CREATE POLICY "Managers can update technician profiles in their company" 
ON public.profiles 
FOR UPDATE 
USING (
  company_id = get_user_company_id(auth.uid()) 
  AND has_role(auth.uid(), 'manager'::app_role)
  AND role = 'technician'
);