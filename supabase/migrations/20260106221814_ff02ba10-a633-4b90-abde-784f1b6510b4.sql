-- Create job_activities table to track status changes and document creation
CREATE TABLE public.job_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'status_change', 'quote_created', 'invoice_created'
  old_value TEXT, -- For status changes: previous status
  new_value TEXT, -- For status changes: new status; for doc creation: document number
  related_document_id UUID, -- Quote or invoice ID if applicable
  performed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view job activities for their company"
ON public.job_activities
FOR SELECT
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create job activities for their company"
ON public.job_activities
FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_job_activities_job_id ON public.job_activities(job_id);
CREATE INDEX idx_job_activities_company_id ON public.job_activities(company_id);

-- Create trigger function to automatically log status changes
CREATE OR REPLACE FUNCTION public.log_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.job_activities (
      job_id,
      company_id,
      activity_type,
      old_value,
      new_value,
      performed_by
    ) VALUES (
      NEW.id,
      NEW.company_id,
      'status_change',
      OLD.status::text,
      NEW.status::text,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on jobs table
CREATE TRIGGER job_status_change_trigger
AFTER UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.log_job_status_change();