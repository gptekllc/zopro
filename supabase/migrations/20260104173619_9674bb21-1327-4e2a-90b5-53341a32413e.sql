-- Add separate photo toggles for each document type
ALTER TABLE public.companies 
ADD COLUMN pdf_show_job_photos boolean NOT NULL DEFAULT true,
ADD COLUMN pdf_show_quote_photos boolean NOT NULL DEFAULT false,
ADD COLUMN pdf_show_invoice_photos boolean NOT NULL DEFAULT false;

-- Remove the generic pdf_show_photos column since we now have specific ones
ALTER TABLE public.companies DROP COLUMN IF EXISTS pdf_show_photos;