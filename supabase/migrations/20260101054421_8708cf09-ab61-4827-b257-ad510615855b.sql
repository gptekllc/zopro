-- Add job_id column to time_entries table
ALTER TABLE public.time_entries 
ADD COLUMN job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL;

-- Create an index for faster lookups
CREATE INDEX idx_time_entries_job_id ON public.time_entries(job_id);

-- Add RLS policy for job-linked time entries (uses existing company-based policies)