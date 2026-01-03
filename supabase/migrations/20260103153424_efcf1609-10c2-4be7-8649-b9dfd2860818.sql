-- Add labor_hourly_rate column to jobs table for job-specific rate overrides
ALTER TABLE public.jobs 
ADD COLUMN labor_hourly_rate numeric NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.jobs.labor_hourly_rate IS 'Optional job-specific hourly rate override for labor. When null, uses technician default rate.';