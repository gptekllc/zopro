-- Add archived_at column to jobs table for soft archiving
ALTER TABLE public.jobs 
  ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for efficient filtering of archived jobs
CREATE INDEX idx_jobs_archived_at ON public.jobs(archived_at);