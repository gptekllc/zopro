-- Add pdf_show_photos preference to companies table
ALTER TABLE public.companies 
ADD COLUMN pdf_show_photos boolean NOT NULL DEFAULT true;