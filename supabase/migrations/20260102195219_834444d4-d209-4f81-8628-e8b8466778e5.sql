-- Add discount fields to jobs table
ALTER TABLE public.jobs
ADD COLUMN discount_type text DEFAULT 'amount' CHECK (discount_type IN ('amount', 'percentage')),
ADD COLUMN discount_value numeric DEFAULT 0;

-- Add discount fields to quotes table
ALTER TABLE public.quotes
ADD COLUMN discount_type text DEFAULT 'amount' CHECK (discount_type IN ('amount', 'percentage')),
ADD COLUMN discount_value numeric DEFAULT 0;

-- Add discount fields to invoices table
ALTER TABLE public.invoices
ADD COLUMN discount_type text DEFAULT 'amount' CHECK (discount_type IN ('amount', 'percentage')),
ADD COLUMN discount_value numeric DEFAULT 0;