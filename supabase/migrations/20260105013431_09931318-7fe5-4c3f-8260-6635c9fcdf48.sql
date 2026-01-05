-- Add item_description column to job_items
ALTER TABLE public.job_items 
ADD COLUMN item_description text;

-- Add item_description column to quote_items
ALTER TABLE public.quote_items 
ADD COLUMN item_description text;

-- Add item_description column to invoice_items
ALTER TABLE public.invoice_items 
ADD COLUMN item_description text;

-- Add item_description column to job_template_items
ALTER TABLE public.job_template_items 
ADD COLUMN item_description text;

-- Add item_description column to quote_template_items
ALTER TABLE public.quote_template_items 
ADD COLUMN item_description text;