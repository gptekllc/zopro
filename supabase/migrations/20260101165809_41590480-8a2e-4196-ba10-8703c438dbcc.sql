-- Add estimated_duration column to jobs table for scheduling
ALTER TABLE public.jobs ADD COLUMN estimated_duration INTEGER DEFAULT 60;

-- Add comment for documentation
COMMENT ON COLUMN public.jobs.estimated_duration IS 'Estimated job duration in minutes, used for calendar scheduling';