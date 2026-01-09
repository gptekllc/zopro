-- Drop existing functions first (they have different parameter names)
DROP FUNCTION IF EXISTS public.generate_job_number(UUID);
DROP FUNCTION IF EXISTS public.generate_quote_number(UUID);
DROP FUNCTION IF EXISTS public.generate_invoice_number(UUID);

-- Add next_number columns to companies table for custom starting numbers
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS job_next_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS quote_next_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS invoice_next_number INTEGER DEFAULT 1;

-- Add check constraints (only if they don't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_next_number_positive') THEN
    ALTER TABLE public.companies ADD CONSTRAINT job_next_number_positive CHECK (job_next_number >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_next_number_positive') THEN
    ALTER TABLE public.companies ADD CONSTRAINT quote_next_number_positive CHECK (quote_next_number >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_next_number_positive') THEN
    ALTER TABLE public.companies ADD CONSTRAINT invoice_next_number_positive CHECK (invoice_next_number >= 1);
  END IF;
END $$;

-- Recreate generate_job_number function with next_number support
CREATE OR REPLACE FUNCTION public.generate_job_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_seq INT;
  prefix TEXT;
  padding INT;
  include_year BOOLEAN;
  formatted_number TEXT;
  year_part TEXT;
  new_next_number INT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Get company settings
  SELECT 
    COALESCE(job_number_prefix, 'J'),
    COALESCE(job_number_padding, 3),
    COALESCE(job_number_include_year, true),
    COALESCE(job_next_number, 1)
  INTO prefix, padding, include_year, next_seq
  FROM companies WHERE id = p_company_id;
  
  -- Build year part
  year_part := CASE WHEN include_year THEN current_year || '-' ELSE '' END;
  
  -- Check if this number already exists, if so find the max
  LOOP
    formatted_number := prefix || '-' || year_part || LPAD(next_seq::TEXT, padding, '0');
    
    -- Check if this number exists
    IF NOT EXISTS (
      SELECT 1 FROM jobs WHERE company_id = p_company_id AND job_number = formatted_number
    ) THEN
      EXIT;
    END IF;
    
    next_seq := next_seq + 1;
  END LOOP;
  
  -- Update the next_number for subsequent jobs
  new_next_number := next_seq + 1;
  UPDATE companies SET job_next_number = new_next_number WHERE id = p_company_id;
  
  RETURN formatted_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate generate_quote_number function with next_number support
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_seq INT;
  prefix TEXT;
  padding INT;
  include_year BOOLEAN;
  formatted_number TEXT;
  year_part TEXT;
  new_next_number INT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Get company settings
  SELECT 
    COALESCE(quote_number_prefix, 'Q'),
    COALESCE(quote_number_padding, 4),
    COALESCE(quote_number_include_year, true),
    COALESCE(quote_next_number, 1)
  INTO prefix, padding, include_year, next_seq
  FROM companies WHERE id = p_company_id;
  
  -- Build year part
  year_part := CASE WHEN include_year THEN current_year || '-' ELSE '' END;
  
  -- Check if this number already exists, if so find the max
  LOOP
    formatted_number := prefix || '-' || year_part || LPAD(next_seq::TEXT, padding, '0');
    
    -- Check if this number exists
    IF NOT EXISTS (
      SELECT 1 FROM quotes WHERE company_id = p_company_id AND quote_number = formatted_number
    ) THEN
      EXIT;
    END IF;
    
    next_seq := next_seq + 1;
  END LOOP;
  
  -- Update the next_number for subsequent quotes
  new_next_number := next_seq + 1;
  UPDATE companies SET quote_next_number = new_next_number WHERE id = p_company_id;
  
  RETURN formatted_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate generate_invoice_number function with next_number support
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_seq INT;
  prefix TEXT;
  padding INT;
  include_year BOOLEAN;
  formatted_number TEXT;
  year_part TEXT;
  new_next_number INT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Get company settings
  SELECT 
    COALESCE(invoice_number_prefix, 'I'),
    COALESCE(invoice_number_padding, 4),
    COALESCE(invoice_number_include_year, true),
    COALESCE(invoice_next_number, 1)
  INTO prefix, padding, include_year, next_seq
  FROM companies WHERE id = p_company_id;
  
  -- Build year part
  year_part := CASE WHEN include_year THEN current_year || '-' ELSE '' END;
  
  -- Check if this number already exists, if so find the max
  LOOP
    formatted_number := prefix || '-' || year_part || LPAD(next_seq::TEXT, padding, '0');
    
    -- Check if this number exists
    IF NOT EXISTS (
      SELECT 1 FROM invoices WHERE company_id = p_company_id AND invoice_number = formatted_number
    ) THEN
      EXIT;
    END IF;
    
    next_seq := next_seq + 1;
  END LOOP;
  
  -- Update the next_number for subsequent invoices
  new_next_number := next_seq + 1;
  UPDATE companies SET invoice_next_number = new_next_number WHERE id = p_company_id;
  
  RETURN formatted_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;