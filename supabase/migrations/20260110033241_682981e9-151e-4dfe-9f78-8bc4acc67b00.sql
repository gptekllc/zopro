-- =====================================================
-- GRANULAR USER PERMISSIONS SYSTEM
-- =====================================================

-- 1. Permission Definitions Table
-- Stores all available permissions with metadata
CREATE TABLE public.permission_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  permission_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  allowed_roles JSONB NOT NULL DEFAULT '["admin", "manager", "technician"]'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Role Default Permissions Table
-- Defines which permissions are enabled by default for each role
CREATE TABLE public.role_default_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  permission_key TEXT NOT NULL REFERENCES public.permission_definitions(permission_key) ON DELETE CASCADE,
  default_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role, permission_key)
);

-- 3. User Permissions Table
-- Stores per-user permission overrides
CREATE TABLE public.user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permission_definitions(permission_key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  set_by UUID REFERENCES public.profiles(id),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_key)
);

-- Enable RLS
ALTER TABLE public.permission_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_default_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for permission_definitions (read-only for all authenticated users)
CREATE POLICY "Anyone can read permission definitions"
ON public.permission_definitions
FOR SELECT
TO authenticated
USING (true);

-- RLS Policies for role_default_permissions (read-only for all authenticated users)
CREATE POLICY "Anyone can read role default permissions"
ON public.role_default_permissions
FOR SELECT
TO authenticated
USING (true);

-- RLS Policies for user_permissions
CREATE POLICY "Users can view permissions in their company"
ON public.user_permissions
FOR SELECT
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can manage user permissions in their company"
ON public.user_permissions
FOR ALL
USING (
  company_id IN (
    SELECT p.company_id 
    FROM public.profiles p
    JOIN public.user_roles ur ON p.id = ur.user_id
    WHERE p.id = auth.uid() AND ur.role = 'admin'
  )
)
WITH CHECK (
  company_id IN (
    SELECT p.company_id 
    FROM public.profiles p
    JOIN public.user_roles ur ON p.id = ur.user_id
    WHERE p.id = auth.uid() AND ur.role = 'admin'
  )
);

CREATE POLICY "Managers can manage technician permissions"
ON public.user_permissions
FOR ALL
USING (
  company_id IN (
    SELECT p.company_id 
    FROM public.profiles p
    JOIN public.user_roles ur ON p.id = ur.user_id
    WHERE p.id = auth.uid() AND ur.role = 'manager'
  )
  AND user_id IN (
    SELECT p.id FROM public.profiles p
    JOIN public.user_roles ur ON p.id = ur.user_id
    WHERE ur.role = 'technician'
  )
)
WITH CHECK (
  company_id IN (
    SELECT p.company_id 
    FROM public.profiles p
    JOIN public.user_roles ur ON p.id = ur.user_id
    WHERE p.id = auth.uid() AND ur.role = 'manager'
  )
  AND user_id IN (
    SELECT p.id FROM public.profiles p
    JOIN public.user_roles ur ON p.id = ur.user_id
    WHERE ur.role = 'technician'
  )
);

-- Trigger for updated_at on user_permissions
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- SEED PERMISSION DEFINITIONS
-- =====================================================

INSERT INTO public.permission_definitions (permission_key, display_name, description, category, allowed_roles, display_order) VALUES
-- Team permissions
('edit_own_hourly_rate', 'Edit Own Hourly Rate', 'Allow user to edit their own hourly rate', 'Team', '["admin", "manager", "technician"]', 10),
('edit_tech_hourly_rates', 'Edit Technician Rates', 'Allow user to edit technician hourly rates', 'Team', '["admin", "manager"]', 20),
('edit_manager_hourly_rates', 'Edit Manager Rates', 'Allow user to edit manager hourly rates', 'Team', '["admin"]', 30),
('manage_team', 'Manage Team Members', 'Allow user to view and edit team member profiles', 'Team', '["admin", "manager"]', 40),
('invite_members', 'Invite Team Members', 'Allow user to invite new team members', 'Team', '["admin", "manager"]', 50),
('terminate_members', 'Terminate Team Members', 'Allow user to terminate team members', 'Team', '["admin"]', 60),

-- Jobs permissions
('create_jobs', 'Create Jobs', 'Allow user to create new jobs', 'Jobs', '["admin", "manager", "technician"]', 100),
('edit_jobs', 'Edit Jobs', 'Allow user to edit job details', 'Jobs', '["admin", "manager", "technician"]', 110),
('delete_jobs', 'Delete Jobs', 'Allow user to delete jobs', 'Jobs', '["admin", "manager"]', 120),
('assign_jobs', 'Assign Jobs', 'Allow user to assign jobs to team members', 'Jobs', '["admin", "manager"]', 130),
('complete_jobs', 'Complete Jobs', 'Allow user to mark jobs as complete', 'Jobs', '["admin", "manager", "technician"]', 140),

-- Quotes permissions
('create_quotes', 'Create Quotes', 'Allow user to create new quotes', 'Quotes', '["admin", "manager", "technician"]', 200),
('edit_quotes', 'Edit Quotes', 'Allow user to edit quote details', 'Quotes', '["admin", "manager", "technician"]', 210),
('delete_quotes', 'Delete Quotes', 'Allow user to delete quotes', 'Quotes', '["admin", "manager"]', 220),
('send_quotes', 'Send Quotes', 'Allow user to send quotes to customers', 'Quotes', '["admin", "manager"]', 230),
('approve_quotes', 'Approve Quotes', 'Allow user to approve quotes', 'Quotes', '["admin", "manager"]', 240),

-- Billing permissions
('create_invoices', 'Create Invoices', 'Allow user to create new invoices', 'Billing', '["admin", "manager"]', 300),
('edit_invoices', 'Edit Invoices', 'Allow user to edit invoice details', 'Billing', '["admin", "manager"]', 310),
('void_invoices', 'Void Invoices', 'Allow user to void invoices', 'Billing', '["admin", "manager"]', 320),
('record_payments', 'Record Payments', 'Allow user to record payments', 'Billing', '["admin", "manager", "technician"]', 330),
('refund_payments', 'Refund Payments', 'Allow user to refund payments', 'Billing', '["admin", "manager"]', 340),
('view_payment_history', 'View Payment History', 'Allow user to view payment history', 'Billing', '["admin", "manager", "technician"]', 350),

-- Customers permissions
('create_customers', 'Create Customers', 'Allow user to create new customers', 'Customers', '["admin", "manager", "technician"]', 400),
('edit_customers', 'Edit Customers', 'Allow user to edit customer details', 'Customers', '["admin", "manager", "technician"]', 410),
('delete_customers', 'Delete Customers', 'Allow user to delete customers', 'Customers', '["admin", "manager"]', 420),

-- Reports permissions
('view_reports', 'View Reports', 'Allow user to view reports and analytics', 'Reports', '["admin", "manager"]', 500),
('export_data', 'Export Data', 'Allow user to export data from reports', 'Reports', '["admin", "manager"]', 510),
('view_team_timesheets', 'View Team Timesheets', 'Allow user to view other team members'' timesheets', 'Reports', '["admin", "manager"]', 520),

-- Settings permissions
('manage_company_settings', 'Manage Company Settings', 'Allow user to manage company settings', 'Settings', '["admin"]', 600),
('manage_stripe_connect', 'Manage Stripe Connect', 'Allow user to manage Stripe Connect settings', 'Settings', '["admin"]', 610),
('manage_templates', 'Manage Templates', 'Allow user to manage job and email templates', 'Settings', '["admin", "manager"]', 620),
('manage_items_catalog', 'Manage Items Catalog', 'Allow user to manage the items catalog', 'Settings', '["admin", "manager"]', 630);

-- =====================================================
-- SEED ROLE DEFAULT PERMISSIONS
-- =====================================================

-- Admin defaults (all true)
INSERT INTO public.role_default_permissions (role, permission_key, default_enabled)
SELECT 'admin', permission_key, true FROM public.permission_definitions;

-- Manager defaults
INSERT INTO public.role_default_permissions (role, permission_key, default_enabled) VALUES
-- Team
('manager', 'edit_own_hourly_rate', false),
('manager', 'edit_tech_hourly_rates', true),
('manager', 'edit_manager_hourly_rates', false),
('manager', 'manage_team', true),
('manager', 'invite_members', false),
('manager', 'terminate_members', false),
-- Jobs
('manager', 'create_jobs', true),
('manager', 'edit_jobs', true),
('manager', 'delete_jobs', true),
('manager', 'assign_jobs', true),
('manager', 'complete_jobs', true),
-- Quotes
('manager', 'create_quotes', true),
('manager', 'edit_quotes', true),
('manager', 'delete_quotes', true),
('manager', 'send_quotes', true),
('manager', 'approve_quotes', true),
-- Billing
('manager', 'create_invoices', true),
('manager', 'edit_invoices', true),
('manager', 'void_invoices', true),
('manager', 'record_payments', true),
('manager', 'refund_payments', true),
('manager', 'view_payment_history', true),
-- Customers
('manager', 'create_customers', true),
('manager', 'edit_customers', true),
('manager', 'delete_customers', true),
-- Reports
('manager', 'view_reports', true),
('manager', 'export_data', true),
('manager', 'view_team_timesheets', true),
-- Settings
('manager', 'manage_company_settings', false),
('manager', 'manage_stripe_connect', false),
('manager', 'manage_templates', true),
('manager', 'manage_items_catalog', true);

-- Technician defaults
INSERT INTO public.role_default_permissions (role, permission_key, default_enabled) VALUES
-- Team
('technician', 'edit_own_hourly_rate', false),
('technician', 'edit_tech_hourly_rates', false),
('technician', 'edit_manager_hourly_rates', false),
('technician', 'manage_team', false),
('technician', 'invite_members', false),
('technician', 'terminate_members', false),
-- Jobs
('technician', 'create_jobs', true),
('technician', 'edit_jobs', true),
('technician', 'delete_jobs', false),
('technician', 'assign_jobs', false),
('technician', 'complete_jobs', true),
-- Quotes
('technician', 'create_quotes', true),
('technician', 'edit_quotes', true),
('technician', 'delete_quotes', false),
('technician', 'send_quotes', false),
('technician', 'approve_quotes', false),
-- Billing
('technician', 'create_invoices', false),
('technician', 'edit_invoices', false),
('technician', 'void_invoices', false),
('technician', 'record_payments', true),
('technician', 'refund_payments', false),
('technician', 'view_payment_history', true),
-- Customers
('technician', 'create_customers', true),
('technician', 'edit_customers', true),
('technician', 'delete_customers', false),
-- Reports
('technician', 'view_reports', false),
('technician', 'export_data', false),
('technician', 'view_team_timesheets', false),
-- Settings
('technician', 'manage_company_settings', false),
('technician', 'manage_stripe_connect', false),
('technician', 'manage_templates', false),
('technician', 'manage_items_catalog', false);

-- =====================================================
-- HELPER FUNCTION TO CHECK PERMISSIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_user_permission(
  p_user_id UUID,
  p_permission_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_role TEXT;
  v_override_enabled BOOLEAN;
  v_default_enabled BOOLEAN;
BEGIN
  -- Get user's role from user_roles table
  SELECT role INTO v_user_role
  FROM public.user_roles
  WHERE user_id = p_user_id
  ORDER BY 
    CASE role 
      WHEN 'super_admin' THEN 1 
      WHEN 'admin' THEN 2 
      WHEN 'manager' THEN 3 
      WHEN 'technician' THEN 4 
      ELSE 5 
    END
  LIMIT 1;
  
  -- Super admins have all permissions
  IF v_user_role = 'super_admin' THEN
    RETURN true;
  END IF;
  
  -- Check for user-specific override
  SELECT enabled INTO v_override_enabled
  FROM public.user_permissions
  WHERE user_id = p_user_id AND permission_key = p_permission_key;
  
  IF v_override_enabled IS NOT NULL THEN
    RETURN v_override_enabled;
  END IF;
  
  -- Fall back to role default
  SELECT default_enabled INTO v_default_enabled
  FROM public.role_default_permissions
  WHERE role = v_user_role AND permission_key = p_permission_key;
  
  RETURN COALESCE(v_default_enabled, false);
END;
$$;