-- Create team_invitations table to track pending invitations
CREATE TABLE public.team_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'technician',
  invited_by uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '7 days'),
  accepted_at timestamp with time zone,
  UNIQUE(company_id, email)
);

-- Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- RLS policies for team_invitations
CREATE POLICY "Admins can view invitations for their company" 
ON public.team_invitations 
FOR SELECT 
USING (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert invitations for their company" 
ON public.team_invitations 
FOR INSERT 
WITH CHECK (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update invitations for their company" 
ON public.team_invitations 
FOR UPDATE 
USING (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invitations for their company" 
ON public.team_invitations 
FOR DELETE 
USING (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- Add deleted_at columns for soft delete
ALTER TABLE public.customers ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Update customers RLS to exclude soft-deleted by default
DROP POLICY IF EXISTS "Users can view customers in their company" ON public.customers;
CREATE POLICY "Users can view active customers in their company" 
ON public.customers 
FOR SELECT 
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()) AND deleted_at IS NULL);

-- Add policy for admins/managers to view deleted customers
CREATE POLICY "Admins can view deleted customers" 
ON public.customers 
FOR SELECT 
USING (
  company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()) 
  AND deleted_at IS NOT NULL 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
);

-- Update profiles RLS to handle soft delete
DROP POLICY IF EXISTS "Users can view profiles in same company" ON public.profiles;
CREATE POLICY "Users can view active profiles in same company" 
ON public.profiles 
FOR SELECT 
USING (company_id = get_user_company_id(auth.uid()) AND (deleted_at IS NULL OR id = auth.uid()));

-- Allow admins to view deleted profiles
CREATE POLICY "Admins can view deleted profiles" 
ON public.profiles 
FOR SELECT 
USING (
  company_id = get_user_company_id(auth.uid()) 
  AND deleted_at IS NOT NULL 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
);