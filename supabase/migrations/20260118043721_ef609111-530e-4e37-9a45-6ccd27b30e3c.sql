-- =============================================
-- SMS INTEGRATION SCHEMA
-- =============================================

-- 1. Company SMS Settings - Per-company SMS preferences
CREATE TABLE public.company_sms_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  sms_enabled BOOLEAN DEFAULT false,
  auto_send_invoice_sms BOOLEAN DEFAULT false,
  auto_send_portal_link_sms BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_sms_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_sms_settings
CREATE POLICY "Users can view own company SMS settings" 
ON public.company_sms_settings FOR SELECT 
USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert own company SMS settings" 
ON public.company_sms_settings FOR INSERT 
WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "Admins can update own company SMS settings" 
ON public.company_sms_settings FOR UPDATE 
USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

-- 2. SMS Usage - Tracks metered SMS usage per company per billing period
CREATE TABLE public.sms_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  messages_sent INTEGER DEFAULT 0,
  messages_limit INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, period_start)
);

-- Enable RLS
ALTER TABLE public.sms_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sms_usage
CREATE POLICY "Users can view own company SMS usage" 
ON public.sms_usage FOR SELECT 
USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- 3. SMS Logs - Audit trail for all SMS attempts
CREATE TABLE public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id),
  recipient_phone TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('invoice', 'portal_link', 'technician_eta')),
  template_name TEXT NOT NULL,
  message_body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'blocked')),
  twilio_sid TEXT,
  error_message TEXT,
  error_code TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sms_logs
CREATE POLICY "Users can view own company SMS logs" 
ON public.sms_logs FOR SELECT 
USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Service role can insert logs (from edge function)
CREATE POLICY "Service role can insert SMS logs" 
ON public.sms_logs FOR INSERT 
WITH CHECK (true);

-- 4. Add SMS columns to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_monthly_limit INTEGER DEFAULT 0;

-- Update existing plans with SMS settings
UPDATE public.subscription_plans SET sms_enabled = false, sms_monthly_limit = 0 WHERE name = 'free';
UPDATE public.subscription_plans SET sms_enabled = false, sms_monthly_limit = 50 WHERE name = 'starter';
UPDATE public.subscription_plans SET sms_enabled = true, sms_monthly_limit = 200 WHERE name = 'professional';
UPDATE public.subscription_plans SET sms_enabled = true, sms_monthly_limit = NULL WHERE name = 'enterprise';

-- 5. App Settings table for global settings like SMS kill switch
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read app settings
CREATE POLICY "Anyone can read app settings" 
ON public.app_settings FOR SELECT 
USING (true);

-- Only super admins can modify (checked in edge function)
CREATE POLICY "Super admins can modify app settings" 
ON public.app_settings FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Insert global SMS enabled setting
INSERT INTO public.app_settings (key, value) 
VALUES ('sms_global_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 6. Function to get SMS usage for current period
CREATE OR REPLACE FUNCTION public.get_sms_usage_for_period(p_company_id UUID)
RETURNS TABLE (messages_sent INTEGER, messages_limit INTEGER, can_send BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_period_start DATE;
  v_limit INTEGER;
BEGIN
  -- Get period start (1st of current month)
  v_period_start := date_trunc('month', CURRENT_DATE)::DATE;
  
  -- Get plan limit
  SELECT sp.sms_monthly_limit INTO v_limit
  FROM company_subscriptions cs
  JOIN subscription_plans sp ON cs.plan_id = sp.id
  WHERE cs.company_id = p_company_id AND cs.status IN ('active', 'trialing');
  
  -- Get or create usage record
  INSERT INTO sms_usage (company_id, period_start, period_end, messages_limit)
  VALUES (p_company_id, v_period_start, (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE, v_limit)
  ON CONFLICT (company_id, period_start) DO UPDATE SET messages_limit = v_limit;
  
  RETURN QUERY
  SELECT 
    su.messages_sent,
    su.messages_limit,
    (su.messages_limit IS NULL OR su.messages_sent < su.messages_limit)
  FROM sms_usage su
  WHERE su.company_id = p_company_id AND su.period_start = v_period_start;
END;
$$;

-- 7. Function to increment SMS usage atomically
CREATE OR REPLACE FUNCTION public.increment_sms_usage(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  UPDATE sms_usage
  SET messages_sent = messages_sent + 1, updated_at = now()
  WHERE company_id = p_company_id 
    AND period_start = date_trunc('month', CURRENT_DATE)::DATE;
END;
$$;

-- 8. Trigger for updated_at on company_sms_settings
CREATE TRIGGER update_company_sms_settings_updated_at
BEFORE UPDATE ON public.company_sms_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Trigger for updated_at on sms_usage
CREATE TRIGGER update_sms_usage_updated_at
BEFORE UPDATE ON public.sms_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Create index for faster lookups
CREATE INDEX idx_sms_logs_company_id ON public.sms_logs(company_id);
CREATE INDEX idx_sms_logs_created_at ON public.sms_logs(created_at DESC);
CREATE INDEX idx_sms_usage_company_period ON public.sms_usage(company_id, period_start);