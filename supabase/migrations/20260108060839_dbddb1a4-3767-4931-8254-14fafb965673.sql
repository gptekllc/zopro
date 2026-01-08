-- Add new columns to subscription_plans for photo and storage limits
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_photos_per_document integer;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS storage_limit_bytes bigint;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS storage_addon_price_per_gb numeric(10,2);

-- Update existing plans with photo and storage limits
UPDATE subscription_plans SET 
  max_photos_per_document = 0,
  storage_limit_bytes = 262144000, -- 250 MB
  storage_addon_price_per_gb = NULL
WHERE name = 'free';

UPDATE subscription_plans SET 
  max_photos_per_document = 5,
  storage_limit_bytes = 26843545600, -- 25 GB
  storage_addon_price_per_gb = 2.00
WHERE name = 'starter';

UPDATE subscription_plans SET 
  max_photos_per_document = 10,
  storage_limit_bytes = 107374182400, -- 100 GB
  storage_addon_price_per_gb = 1.00
WHERE name = 'professional';

UPDATE subscription_plans SET 
  max_photos_per_document = 25,
  storage_limit_bytes = 536870912000, -- 500 GB
  storage_addon_price_per_gb = 0.50
WHERE name = 'enterprise';

-- Create company_usage_limits table for flexible per-company overrides
CREATE TABLE IF NOT EXISTS public.company_usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  limit_key text NOT NULL,
  limit_value bigint NOT NULL,
  reason text,
  set_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, limit_key)
);

-- Create company_storage_usage table for tracking storage
CREATE TABLE IF NOT EXISTS public.company_storage_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  total_bytes_used bigint NOT NULL DEFAULT 0,
  job_photos_bytes bigint NOT NULL DEFAULT 0,
  quote_photos_bytes bigint NOT NULL DEFAULT 0,
  invoice_photos_bytes bigint NOT NULL DEFAULT 0,
  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_storage_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_usage_limits
CREATE POLICY "Users can view their company usage limits"
ON public.company_usage_limits FOR SELECT
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Super admins can manage all usage limits"
ON public.company_usage_limits FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- RLS policies for company_storage_usage
CREATE POLICY "Users can view their company storage usage"
ON public.company_storage_usage FOR SELECT
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "System can update storage usage"
ON public.company_storage_usage FOR ALL
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- Function to increment storage usage
CREATE OR REPLACE FUNCTION public.increment_storage_usage(
  p_company_id uuid,
  p_bytes bigint,
  p_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO company_storage_usage (company_id, total_bytes_used, job_photos_bytes, quote_photos_bytes, invoice_photos_bytes)
  VALUES (
    p_company_id,
    CASE WHEN p_bytes > 0 THEN p_bytes ELSE 0 END,
    CASE WHEN p_type = 'job_photos' THEN p_bytes ELSE 0 END,
    CASE WHEN p_type = 'quote_photos' THEN p_bytes ELSE 0 END,
    CASE WHEN p_type = 'invoice_photos' THEN p_bytes ELSE 0 END
  )
  ON CONFLICT (company_id) DO UPDATE SET
    total_bytes_used = company_storage_usage.total_bytes_used + p_bytes,
    job_photos_bytes = company_storage_usage.job_photos_bytes + CASE WHEN p_type = 'job_photos' THEN p_bytes ELSE 0 END,
    quote_photos_bytes = company_storage_usage.quote_photos_bytes + CASE WHEN p_type = 'quote_photos' THEN p_bytes ELSE 0 END,
    invoice_photos_bytes = company_storage_usage.invoice_photos_bytes + CASE WHEN p_type = 'invoice_photos' THEN p_bytes ELSE 0 END,
    updated_at = now();
END;
$$;

-- Function to get effective limit (checks override first, then plan default)
CREATE OR REPLACE FUNCTION public.get_effective_limit(
  p_company_id uuid,
  p_limit_key text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override_value bigint;
  v_plan_value bigint;
BEGIN
  -- Check for company-specific override first
  SELECT limit_value INTO v_override_value
  FROM company_usage_limits
  WHERE company_id = p_company_id AND limit_key = p_limit_key;
  
  IF v_override_value IS NOT NULL THEN
    RETURN v_override_value;
  END IF;
  
  -- Fall back to plan default
  SELECT 
    CASE p_limit_key
      WHEN 'max_photos_per_document' THEN sp.max_photos_per_document::bigint
      WHEN 'storage_limit_bytes' THEN sp.storage_limit_bytes
      WHEN 'max_jobs_per_month' THEN sp.max_jobs_per_month::bigint
      WHEN 'max_users' THEN sp.max_users::bigint
      ELSE NULL
    END INTO v_plan_value
  FROM company_subscriptions cs
  JOIN subscription_plans sp ON cs.plan_id = sp.id
  WHERE cs.company_id = p_company_id
  AND cs.status IN ('active', 'trialing');
  
  RETURN v_plan_value;
END;
$$;

-- Function to recalculate company storage (for admin use)
CREATE OR REPLACE FUNCTION public.recalculate_company_storage(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_bytes bigint;
  v_quote_bytes bigint;
  v_invoice_bytes bigint;
BEGIN
  -- This is a placeholder - actual calculation would need file size data from storage
  -- For now, we'll count photos and estimate 500KB each
  SELECT COALESCE(COUNT(*) * 512000, 0) INTO v_job_bytes
  FROM job_photos jp
  JOIN jobs j ON jp.job_id = j.id
  WHERE j.company_id = p_company_id;
  
  SELECT COALESCE(COUNT(*) * 512000, 0) INTO v_quote_bytes
  FROM quote_photos qp
  JOIN quotes q ON qp.quote_id = q.id
  WHERE q.company_id = p_company_id;
  
  SELECT COALESCE(COUNT(*) * 512000, 0) INTO v_invoice_bytes
  FROM invoice_photos ip
  JOIN invoices i ON ip.invoice_id = i.id
  WHERE i.company_id = p_company_id;
  
  INSERT INTO company_storage_usage (company_id, total_bytes_used, job_photos_bytes, quote_photos_bytes, invoice_photos_bytes, last_calculated_at)
  VALUES (p_company_id, v_job_bytes + v_quote_bytes + v_invoice_bytes, v_job_bytes, v_quote_bytes, v_invoice_bytes, now())
  ON CONFLICT (company_id) DO UPDATE SET
    total_bytes_used = v_job_bytes + v_quote_bytes + v_invoice_bytes,
    job_photos_bytes = v_job_bytes,
    quote_photos_bytes = v_quote_bytes,
    invoice_photos_bytes = v_invoice_bytes,
    last_calculated_at = now(),
    updated_at = now();
END;
$$;

-- Create updated_at trigger for new tables
CREATE TRIGGER update_company_usage_limits_updated_at
BEFORE UPDATE ON public.company_usage_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_storage_usage_updated_at
BEFORE UPDATE ON public.company_storage_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();