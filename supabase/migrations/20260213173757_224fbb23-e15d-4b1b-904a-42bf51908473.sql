
-- Add taxable column to job_items (default true so existing items are taxable)
ALTER TABLE public.job_items ADD COLUMN taxable boolean NOT NULL DEFAULT true;

-- Add taxable column to quote_items
ALTER TABLE public.quote_items ADD COLUMN taxable boolean NOT NULL DEFAULT true;

-- Add taxable column to invoice_items
ALTER TABLE public.invoice_items ADD COLUMN taxable boolean NOT NULL DEFAULT true;
