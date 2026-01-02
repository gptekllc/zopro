-- Add job_id column to invoices table for direct job-invoice linking
ALTER TABLE public.invoices 
ADD COLUMN job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_invoices_job_id ON public.invoices(job_id);

-- Backfill existing invoices that were created from jobs (based on notes pattern)
UPDATE public.invoices i
SET job_id = j.id
FROM public.jobs j
WHERE i.notes LIKE 'Invoice for Job ' || j.job_number || '%'
  AND i.job_id IS NULL;