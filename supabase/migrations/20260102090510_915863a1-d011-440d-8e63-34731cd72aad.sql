-- Add company setting for requiring job completion signatures
ALTER TABLE public.companies
ADD COLUMN require_job_completion_signature boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.companies.require_job_completion_signature IS 'When true, jobs cannot be marked as completed without a customer signature';