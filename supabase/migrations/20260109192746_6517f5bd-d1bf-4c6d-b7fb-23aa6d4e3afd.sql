-- Create email_logs table for tracking email delivery
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  sender_email TEXT NOT NULL DEFAULT 'noreply@email.zopro.app',
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  resend_id TEXT,
  error_message TEXT,
  metadata JSONB,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for email_logs
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX idx_email_logs_company ON public.email_logs(company_id);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_email_type ON public.email_logs(email_type);

-- Enable RLS for email_logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can view all email logs
CREATE POLICY "Super admins can view all email logs"
  ON public.email_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'super_admin'
  ));

-- Company admins can view their company's email logs
CREATE POLICY "Company admins can view company email logs"
  ON public.email_logs FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'manager')
    )
  );

-- Add retry columns to webhook_event_logs
ALTER TABLE public.webhook_event_logs 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_event_id UUID REFERENCES public.webhook_event_logs(id);