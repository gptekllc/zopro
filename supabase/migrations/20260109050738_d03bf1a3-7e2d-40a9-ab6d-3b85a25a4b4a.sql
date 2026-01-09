-- Add document numbering customization columns to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS job_number_prefix TEXT DEFAULT 'J' NOT NULL,
ADD COLUMN IF NOT EXISTS job_number_padding INTEGER DEFAULT 3 NOT NULL,
ADD COLUMN IF NOT EXISTS job_number_include_year BOOLEAN DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS quote_number_prefix TEXT DEFAULT 'Q' NOT NULL,
ADD COLUMN IF NOT EXISTS quote_number_padding INTEGER DEFAULT 4 NOT NULL,
ADD COLUMN IF NOT EXISTS quote_number_include_year BOOLEAN DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS invoice_number_prefix TEXT DEFAULT 'I' NOT NULL,
ADD COLUMN IF NOT EXISTS invoice_number_padding INTEGER DEFAULT 4 NOT NULL,
ADD COLUMN IF NOT EXISTS invoice_number_include_year BOOLEAN DEFAULT true NOT NULL;

-- Add constraints for padding (2-6 digits) - use IF NOT EXISTS pattern
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_number_padding_check') THEN
    ALTER TABLE public.companies ADD CONSTRAINT job_number_padding_check CHECK (job_number_padding >= 2 AND job_number_padding <= 6);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_number_padding_check') THEN
    ALTER TABLE public.companies ADD CONSTRAINT quote_number_padding_check CHECK (quote_number_padding >= 2 AND quote_number_padding <= 6);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_number_padding_check') THEN
    ALTER TABLE public.companies ADD CONSTRAINT invoice_number_padding_check CHECK (invoice_number_padding >= 2 AND invoice_number_padding <= 6);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_number_prefix_check') THEN
    ALTER TABLE public.companies ADD CONSTRAINT job_number_prefix_check CHECK (job_number_prefix ~ '^[A-Za-z0-9]{1,10}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_number_prefix_check') THEN
    ALTER TABLE public.companies ADD CONSTRAINT quote_number_prefix_check CHECK (quote_number_prefix ~ '^[A-Za-z0-9]{1,10}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_number_prefix_check') THEN
    ALTER TABLE public.companies ADD CONSTRAINT invoice_number_prefix_check CHECK (invoice_number_prefix ~ '^[A-Za-z0-9]{1,10}$');
  END IF;
END $$;

-- Update generate_job_number function to use company settings
CREATE OR REPLACE FUNCTION public.generate_job_number(_company_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_year text;
  next_number integer;
  v_prefix text;
  v_padding integer;
  v_include_year boolean;
  search_pattern text;
  result text;
BEGIN
  current_year := to_char(now(), 'YYYY');
  
  -- Get company settings
  SELECT 
    COALESCE(job_number_prefix, 'J'),
    COALESCE(job_number_padding, 3),
    COALESCE(job_number_include_year, true)
  INTO v_prefix, v_padding, v_include_year
  FROM public.companies
  WHERE id = _company_id;
  
  -- Default values if company not found
  IF v_prefix IS NULL THEN
    v_prefix := 'J';
    v_padding := 3;
    v_include_year := true;
  END IF;
  
  -- Build search pattern based on whether year is included
  IF v_include_year THEN
    search_pattern := v_prefix || '-' || current_year || '-%';
    
    -- Find next number
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(job_number FROM v_prefix || '-' || current_year || '-(\d+)') AS integer)
    ), 0) + 1
    INTO next_number
    FROM public.jobs
    WHERE company_id = _company_id
      AND job_number LIKE search_pattern;
    
    result := v_prefix || '-' || current_year || '-' || LPAD(next_number::text, v_padding, '0');
  ELSE
    search_pattern := v_prefix || '-%';
    
    -- Find next number (without year filter)
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(job_number FROM v_prefix || '-(\d+)$') AS integer)
    ), 0) + 1
    INTO next_number
    FROM public.jobs
    WHERE company_id = _company_id
      AND job_number ~ ('^' || v_prefix || '-\d+$');
    
    result := v_prefix || '-' || LPAD(next_number::text, v_padding, '0');
  END IF;
  
  RETURN result;
END;
$function$;

-- Update generate_quote_number function to use company settings
CREATE OR REPLACE FUNCTION public.generate_quote_number(_company_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_year text;
  next_number integer;
  v_prefix text;
  v_padding integer;
  v_include_year boolean;
  search_pattern text;
  result text;
BEGIN
  current_year := to_char(now(), 'YYYY');
  
  -- Get company settings
  SELECT 
    COALESCE(quote_number_prefix, 'Q'),
    COALESCE(quote_number_padding, 4),
    COALESCE(quote_number_include_year, true)
  INTO v_prefix, v_padding, v_include_year
  FROM public.companies
  WHERE id = _company_id;
  
  -- Default values if company not found
  IF v_prefix IS NULL THEN
    v_prefix := 'Q';
    v_padding := 4;
    v_include_year := true;
  END IF;
  
  -- Build search pattern based on whether year is included
  IF v_include_year THEN
    search_pattern := v_prefix || '-' || current_year || '-%';
    
    -- Find next number
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(quote_number FROM v_prefix || '-' || current_year || '-(\d+)') AS integer)
    ), 0) + 1
    INTO next_number
    FROM public.quotes
    WHERE company_id = _company_id
      AND quote_number LIKE search_pattern;
    
    result := v_prefix || '-' || current_year || '-' || LPAD(next_number::text, v_padding, '0');
  ELSE
    search_pattern := v_prefix || '-%';
    
    -- Find next number (without year filter)
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(quote_number FROM v_prefix || '-(\d+)$') AS integer)
    ), 0) + 1
    INTO next_number
    FROM public.quotes
    WHERE company_id = _company_id
      AND quote_number ~ ('^' || v_prefix || '-\d+$');
    
    result := v_prefix || '-' || LPAD(next_number::text, v_padding, '0');
  END IF;
  
  RETURN result;
END;
$function$;

-- Update generate_invoice_number function to use company settings
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_company_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_year text;
  next_number integer;
  v_prefix text;
  v_padding integer;
  v_include_year boolean;
  search_pattern text;
  result text;
BEGIN
  current_year := to_char(now(), 'YYYY');
  
  -- Get company settings
  SELECT 
    COALESCE(invoice_number_prefix, 'I'),
    COALESCE(invoice_number_padding, 4),
    COALESCE(invoice_number_include_year, true)
  INTO v_prefix, v_padding, v_include_year
  FROM public.companies
  WHERE id = _company_id;
  
  -- Default values if company not found
  IF v_prefix IS NULL THEN
    v_prefix := 'I';
    v_padding := 4;
    v_include_year := true;
  END IF;
  
  -- Build search pattern based on whether year is included
  IF v_include_year THEN
    search_pattern := v_prefix || '-' || current_year || '-%';
    
    -- Find next number
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(invoice_number FROM v_prefix || '-' || current_year || '-(\d+)') AS integer)
    ), 0) + 1
    INTO next_number
    FROM public.invoices
    WHERE company_id = _company_id
      AND invoice_number LIKE search_pattern;
    
    result := v_prefix || '-' || current_year || '-' || LPAD(next_number::text, v_padding, '0');
  ELSE
    search_pattern := v_prefix || '-%';
    
    -- Find next number (without year filter)
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(invoice_number FROM v_prefix || '-(\d+)$') AS integer)
    ), 0) + 1
    INTO next_number
    FROM public.invoices
    WHERE company_id = _company_id
      AND invoice_number ~ ('^' || v_prefix || '-\d+$');
    
    result := v_prefix || '-' || LPAD(next_number::text, v_padding, '0');
  END IF;
  
  RETURN result;
END;
$function$;