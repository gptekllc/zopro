-- Add social media columns to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS facebook_url text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS instagram_url text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS linkedin_url text;