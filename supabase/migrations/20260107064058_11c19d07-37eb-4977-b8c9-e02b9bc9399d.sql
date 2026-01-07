-- Create job_assignees junction table for multiple technician assignments
CREATE TABLE public.job_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, profile_id)
);

-- Enable RLS
ALTER TABLE public.job_assignees ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can see assignees for jobs in their company
CREATE POLICY "Users can view job assignees in their company"
ON public.job_assignees
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_id
    AND j.company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Users can insert job assignees in their company"
ON public.job_assignees
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_id
    AND j.company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Users can delete job assignees in their company"
ON public.job_assignees
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_id
    AND j.company_id = public.get_user_company_id(auth.uid())
  )
);

-- Migrate existing assigned_to data to the new table
INSERT INTO public.job_assignees (job_id, profile_id)
SELECT id, assigned_to
FROM public.jobs
WHERE assigned_to IS NOT NULL;

-- Create index for performance
CREATE INDEX idx_job_assignees_job_id ON public.job_assignees(job_id);
CREATE INDEX idx_job_assignees_profile_id ON public.job_assignees(profile_id);