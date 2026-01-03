-- Create job_feedbacks table for customer ratings after job completion
CREATE TABLE public.job_feedbacks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text text,
  is_negative boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_feedbacks ENABLE ROW LEVEL SECURITY;

-- Policies: Only managers and admins can view feedbacks (technicians cannot)
CREATE POLICY "Managers and admins can view feedbacks"
ON public.job_feedbacks
FOR SELECT
USING (
  company_id IN (
    SELECT p.company_id FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'manager')
  )
);

-- Allow inserts from customer portal (via service role) and regular users
CREATE POLICY "Service role can insert feedbacks"
ON public.job_feedbacks
FOR INSERT
WITH CHECK (true);

-- Add time clock preferences to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS timeclock_enforce_job_labor boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS timeclock_allow_manual_labor_edit boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS timeclock_require_job_selection boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS timeclock_auto_start_break_reminder integer DEFAULT 240,
ADD COLUMN IF NOT EXISTS timeclock_max_shift_hours integer DEFAULT 12;