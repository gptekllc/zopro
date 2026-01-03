-- Create job_notifications table to track sent notifications
CREATE TABLE public.job_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  notification_type text NOT NULL DEFAULT 'status_update',
  status_at_send text,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES auth.users(id),
  recipient_email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view job notifications in their company"
ON public.job_notifications
FOR SELECT
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert job notifications in their company"
ON public.job_notifications
FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Service role can also insert (for edge function)
CREATE POLICY "Service role can insert notifications"
ON public.job_notifications
FOR INSERT
WITH CHECK (true);

-- Index for quick duplicate checks
CREATE INDEX idx_job_notifications_job_status ON public.job_notifications(job_id, status_at_send);
CREATE INDEX idx_job_notifications_company ON public.job_notifications(company_id);