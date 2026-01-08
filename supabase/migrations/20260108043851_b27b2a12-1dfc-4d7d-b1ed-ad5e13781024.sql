-- Subscription plans table
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  price_monthly NUMERIC DEFAULT 0,
  price_yearly NUMERIC DEFAULT 0,
  max_users INTEGER,
  max_jobs_per_month INTEGER,
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Company subscriptions table
CREATE TABLE public.company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id)
);

-- Super admin audit log
CREATE TABLE public.super_admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admin_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans
CREATE POLICY "Super admins can manage subscription plans"
ON public.subscription_plans
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated users can view active plans"
ON public.subscription_plans
FOR SELECT
USING (is_active = true AND auth.role() = 'authenticated');

-- RLS Policies for company_subscriptions
CREATE POLICY "Super admins can manage all subscriptions"
ON public.company_subscriptions
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Company admins can view their subscription"
ON public.company_subscriptions
FOR SELECT
USING (company_id IN (
  SELECT company_id FROM profiles WHERE id = auth.uid()
));

-- RLS Policies for super_admin_audit_log
CREATE POLICY "Super admins can view audit log"
ON public.super_admin_audit_log
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can insert audit log"
ON public.super_admin_audit_log
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, display_name, price_monthly, price_yearly, max_users, max_jobs_per_month, features) VALUES
('free', 'Free', 0, 0, 1, 10, '{"basic_invoicing": true}'),
('starter', 'Starter', 29, 290, 3, 50, '{"basic_invoicing": true, "quotes": true, "email_templates": true}'),
('professional', 'Professional', 79, 790, 10, 200, '{"basic_invoicing": true, "quotes": true, "email_templates": true, "scheduling": true, "reports": true}'),
('enterprise', 'Enterprise', 199, 1990, NULL, NULL, '{"basic_invoicing": true, "quotes": true, "email_templates": true, "scheduling": true, "reports": true, "api_access": true, "priority_support": true}');

-- Create indexes
CREATE INDEX idx_company_subscriptions_company_id ON public.company_subscriptions(company_id);
CREATE INDEX idx_company_subscriptions_status ON public.company_subscriptions(status);
CREATE INDEX idx_super_admin_audit_log_admin_id ON public.super_admin_audit_log(admin_id);
CREATE INDEX idx_super_admin_audit_log_created_at ON public.super_admin_audit_log(created_at DESC);