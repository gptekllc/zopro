-- Company-specific feature overrides (can enable/disable features beyond plan defaults)
CREATE TABLE public.company_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  reason TEXT, -- Why was this override applied
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, feature_key)
);

-- Create index for fast lookups
CREATE INDEX idx_company_feature_overrides_company ON company_feature_overrides(company_id);

-- Enable RLS
ALTER TABLE public.company_feature_overrides ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all overrides
CREATE POLICY "Super admins can manage feature overrides"
ON public.company_feature_overrides
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  )
);

-- Companies can read their own overrides
CREATE POLICY "Companies can read their own feature overrides"
ON public.company_feature_overrides
FOR SELECT
USING (
  company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- Add trigger for updated_at
CREATE TRIGGER update_company_feature_overrides_updated_at
BEFORE UPDATE ON public.company_feature_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update subscription_plans with default feature flags (add to existing plans)
UPDATE public.subscription_plans SET features = 
  CASE name
    WHEN 'free' THEN '{"jobs":true,"quotes":true,"invoices":true,"time_clock":false,"reports":false,"team_members":false,"customer_portal":false,"email_templates":false,"stripe_payments":false,"photo_uploads":false,"signatures":false}'::jsonb
    WHEN 'starter' THEN '{"jobs":true,"quotes":true,"invoices":true,"time_clock":true,"reports":true,"team_members":false,"customer_portal":true,"email_templates":false,"stripe_payments":false,"photo_uploads":true,"signatures":false}'::jsonb
    WHEN 'professional' THEN '{"jobs":true,"quotes":true,"invoices":true,"time_clock":true,"reports":true,"team_members":true,"customer_portal":true,"email_templates":true,"stripe_payments":true,"photo_uploads":true,"signatures":true}'::jsonb
    WHEN 'enterprise' THEN '{"jobs":true,"quotes":true,"invoices":true,"time_clock":true,"reports":true,"team_members":true,"customer_portal":true,"email_templates":true,"stripe_payments":true,"photo_uploads":true,"signatures":true,"api_access":true,"white_label":true}'::jsonb
    ELSE features
  END
WHERE features IS NULL OR features = '{}'::jsonb;