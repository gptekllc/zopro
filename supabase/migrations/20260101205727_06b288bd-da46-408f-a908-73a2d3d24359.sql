-- Add tax_rate column to companies table
ALTER TABLE public.companies
ADD COLUMN tax_rate NUMERIC DEFAULT 8.25;

-- Add comment for clarity
COMMENT ON COLUMN public.companies.tax_rate IS 'Default tax rate percentage applied to quotes, invoices, and jobs';