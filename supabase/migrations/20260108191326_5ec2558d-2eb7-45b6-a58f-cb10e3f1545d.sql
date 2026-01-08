-- Create job_feedback_history table to track editing and deletion activities
CREATE TABLE public.job_feedback_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID REFERENCES public.job_feedbacks(id) ON DELETE SET NULL,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('created', 'edited', 'deleted')),
  old_rating INTEGER,
  new_rating INTEGER,
  old_feedback_text TEXT,
  new_feedback_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_feedback_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view feedback history for their company's jobs
CREATE POLICY "Users can view feedback history for their company"
ON public.job_feedback_history
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Add updated_at column to job_feedbacks table to track when feedback was last updated
ALTER TABLE public.job_feedbacks 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create index for faster queries
CREATE INDEX idx_job_feedback_history_job_id ON public.job_feedback_history(job_id);
CREATE INDEX idx_job_feedback_history_feedback_id ON public.job_feedback_history(feedback_id);
CREATE INDEX idx_job_feedbacks_updated_at ON public.job_feedbacks(updated_at);