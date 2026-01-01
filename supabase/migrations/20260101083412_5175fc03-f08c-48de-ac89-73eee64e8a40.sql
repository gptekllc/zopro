-- Create function to generate quote number (Q-YYYY-001 format)
CREATE OR REPLACE FUNCTION public.generate_quote_number(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year text;
  next_number integer;
BEGIN
  current_year := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(quote_number FROM 'Q-' || current_year || '-(\d+)') AS integer)
  ), 0) + 1
  INTO next_number
  FROM public.quotes
  WHERE company_id = _company_id
    AND quote_number LIKE 'Q-' || current_year || '-%';
  
  RETURN 'Q-' || current_year || '-' || LPAD(next_number::text, 4, '0');
END;
$$;

-- Create function to generate invoice number (I-YYYY-0001 format)
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year text;
  next_number integer;
BEGIN
  current_year := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 'I-' || current_year || '-(\d+)') AS integer)
  ), 0) + 1
  INTO next_number
  FROM public.invoices
  WHERE company_id = _company_id
    AND invoice_number LIKE 'I-' || current_year || '-%';
  
  RETURN 'I-' || current_year || '-' || LPAD(next_number::text, 4, '0');
END;
$$;