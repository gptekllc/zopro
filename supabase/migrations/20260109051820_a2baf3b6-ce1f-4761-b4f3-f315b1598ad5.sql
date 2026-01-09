-- Fix search_path for generate_job_number
CREATE OR REPLACE FUNCTION public.generate_job_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_year TEXT;
  next_seq INT;
  prefix TEXT;
  padding INT;
  include_year BOOLEAN;
  use_hyphens BOOLEAN;
  formatted_number TEXT;
  year_part TEXT;
  new_next_number INT;
  separator TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  SELECT 
    COALESCE(job_number_prefix, 'J'),
    COALESCE(job_number_padding, 3),
    COALESCE(job_number_include_year, true),
    COALESCE(job_next_number, 1),
    COALESCE(job_number_use_hyphens, true)
  INTO prefix, padding, include_year, next_seq, use_hyphens
  FROM companies WHERE id = p_company_id;
  
  separator := CASE WHEN use_hyphens THEN '-' ELSE '' END;
  year_part := CASE WHEN include_year THEN current_year || separator ELSE '' END;
  
  LOOP
    formatted_number := prefix || separator || year_part || LPAD(next_seq::TEXT, padding, '0');
    
    IF NOT EXISTS (
      SELECT 1 FROM jobs WHERE company_id = p_company_id AND job_number = formatted_number
    ) THEN
      EXIT;
    END IF;
    
    next_seq := next_seq + 1;
  END LOOP;
  
  new_next_number := next_seq + 1;
  UPDATE companies SET job_next_number = new_next_number WHERE id = p_company_id;
  
  RETURN formatted_number;
END;
$function$;

-- Fix search_path for generate_quote_number
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_year TEXT;
  next_seq INT;
  prefix TEXT;
  padding INT;
  include_year BOOLEAN;
  use_hyphens BOOLEAN;
  formatted_number TEXT;
  year_part TEXT;
  new_next_number INT;
  separator TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  SELECT 
    COALESCE(quote_number_prefix, 'Q'),
    COALESCE(quote_number_padding, 4),
    COALESCE(quote_number_include_year, true),
    COALESCE(quote_next_number, 1),
    COALESCE(quote_number_use_hyphens, true)
  INTO prefix, padding, include_year, next_seq, use_hyphens
  FROM companies WHERE id = p_company_id;
  
  separator := CASE WHEN use_hyphens THEN '-' ELSE '' END;
  year_part := CASE WHEN include_year THEN current_year || separator ELSE '' END;
  
  LOOP
    formatted_number := prefix || separator || year_part || LPAD(next_seq::TEXT, padding, '0');
    
    IF NOT EXISTS (
      SELECT 1 FROM quotes WHERE company_id = p_company_id AND quote_number = formatted_number
    ) THEN
      EXIT;
    END IF;
    
    next_seq := next_seq + 1;
  END LOOP;
  
  new_next_number := next_seq + 1;
  UPDATE companies SET quote_next_number = new_next_number WHERE id = p_company_id;
  
  RETURN formatted_number;
END;
$function$;

-- Fix search_path for generate_invoice_number
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_year TEXT;
  next_seq INT;
  prefix TEXT;
  padding INT;
  include_year BOOLEAN;
  use_hyphens BOOLEAN;
  formatted_number TEXT;
  year_part TEXT;
  new_next_number INT;
  separator TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  SELECT 
    COALESCE(invoice_number_prefix, 'I'),
    COALESCE(invoice_number_padding, 4),
    COALESCE(invoice_number_include_year, true),
    COALESCE(invoice_next_number, 1),
    COALESCE(invoice_number_use_hyphens, true)
  INTO prefix, padding, include_year, next_seq, use_hyphens
  FROM companies WHERE id = p_company_id;
  
  separator := CASE WHEN use_hyphens THEN '-' ELSE '' END;
  year_part := CASE WHEN include_year THEN current_year || separator ELSE '' END;
  
  LOOP
    formatted_number := prefix || separator || year_part || LPAD(next_seq::TEXT, padding, '0');
    
    IF NOT EXISTS (
      SELECT 1 FROM invoices WHERE company_id = p_company_id AND invoice_number = formatted_number
    ) THEN
      EXIT;
    END IF;
    
    next_seq := next_seq + 1;
  END LOOP;
  
  new_next_number := next_seq + 1;
  UPDATE companies SET invoice_next_number = new_next_number WHERE id = p_company_id;
  
  RETURN formatted_number;
END;
$function$;