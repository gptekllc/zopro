-- Add website column to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS website text;