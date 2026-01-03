-- Add auto_send_job_scheduled_email setting to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS auto_send_job_scheduled_email boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.companies.auto_send_job_scheduled_email IS 'Automatically send email to customer when job status changes to scheduled';