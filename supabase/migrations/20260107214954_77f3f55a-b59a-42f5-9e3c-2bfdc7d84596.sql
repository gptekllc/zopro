-- Add custom_domain column to companies table for portal link configuration
ALTER TABLE public.companies 
ADD COLUMN custom_domain text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.companies.custom_domain IS 'Custom domain URL for customer portal links (e.g., https://zopro.app)';