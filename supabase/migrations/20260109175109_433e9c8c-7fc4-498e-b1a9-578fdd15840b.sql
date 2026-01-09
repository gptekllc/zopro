-- Create webhook_event_logs table for tracking all payment provider webhooks
CREATE TABLE public.webhook_event_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL, -- 'stripe', 'paypal', 'square'
  event_type TEXT NOT NULL,
  event_id TEXT, -- Provider's event ID
  status TEXT NOT NULL DEFAULT 'received', -- 'received', 'processing', 'processed', 'failed'
  payload JSONB,
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quick lookups
CREATE INDEX idx_webhook_logs_provider ON public.webhook_event_logs(provider);
CREATE INDEX idx_webhook_logs_status ON public.webhook_event_logs(status);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_event_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_event_id ON public.webhook_event_logs(event_id);

-- Enable RLS
ALTER TABLE public.webhook_event_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view webhook logs
CREATE POLICY "Super admins can view webhook logs"
  ON public.webhook_event_logs
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin')
  );

-- Only super admins can insert (for test webhooks)
CREATE POLICY "Super admins can insert webhook logs"
  ON public.webhook_event_logs
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
  );

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access"
  ON public.webhook_event_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');