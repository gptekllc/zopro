-- Add PDF preferences columns to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS pdf_show_notes boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS pdf_show_signature boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS pdf_terms_conditions text DEFAULT NULL;