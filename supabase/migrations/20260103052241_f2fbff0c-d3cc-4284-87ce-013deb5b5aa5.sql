-- Remove old social media columns from companies table (data already migrated to company_social_links)
ALTER TABLE public.companies DROP COLUMN IF EXISTS facebook_url;
ALTER TABLE public.companies DROP COLUMN IF EXISTS instagram_url;
ALTER TABLE public.companies DROP COLUMN IF EXISTS linkedin_url;