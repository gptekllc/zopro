-- Add archived_at column to quotes table
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

-- Add archived_at column to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

-- Create function to auto-archive old records
CREATE OR REPLACE FUNCTION public.auto_archive_old_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cutoff_date timestamp with time zone;
BEGIN
  -- Set cutoff date to 3 years ago
  cutoff_date := now() - interval '3 years';
  
  -- Archive old jobs that are completed, invoiced, or paid
  UPDATE public.jobs
  SET archived_at = now()
  WHERE archived_at IS NULL
    AND created_at < cutoff_date
    AND status IN ('completed', 'invoiced', 'paid');
  
  -- Archive old quotes that are not draft
  UPDATE public.quotes
  SET archived_at = now()
  WHERE archived_at IS NULL
    AND created_at < cutoff_date
    AND status IN ('sent', 'accepted', 'rejected', 'expired', 'approved');
  
  -- Archive old invoices that are paid
  UPDATE public.invoices
  SET archived_at = now()
  WHERE archived_at IS NULL
    AND created_at < cutoff_date
    AND status IN ('paid', 'cancelled');
END;
$$;