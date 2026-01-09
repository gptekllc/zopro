-- Add deleted_at column to jobs, quotes, and invoices tables for soft delete
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create indexes for efficient filtering of non-deleted items
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON public.jobs (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_deleted_at ON public.quotes (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON public.invoices (deleted_at) WHERE deleted_at IS NULL;

-- Create function to permanently delete items older than 6 months
CREATE OR REPLACE FUNCTION public.permanent_delete_old_soft_deleted_records()
RETURNS TABLE(jobs_deleted INT, quotes_deleted INT, invoices_deleted INT, customers_deleted INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff_date TIMESTAMP WITH TIME ZONE;
  v_jobs_deleted INT := 0;
  v_quotes_deleted INT := 0;
  v_invoices_deleted INT := 0;
  v_customers_deleted INT := 0;
BEGIN
  -- Set cutoff to 6 months ago
  cutoff_date := now() - INTERVAL '6 months';
  
  -- Permanently delete old soft-deleted jobs (and their related items via cascade)
  DELETE FROM public.jobs
  WHERE deleted_at IS NOT NULL AND deleted_at < cutoff_date;
  GET DIAGNOSTICS v_jobs_deleted = ROW_COUNT;
  
  -- Permanently delete old soft-deleted quotes
  DELETE FROM public.quotes
  WHERE deleted_at IS NOT NULL AND deleted_at < cutoff_date;
  GET DIAGNOSTICS v_quotes_deleted = ROW_COUNT;
  
  -- Permanently delete old soft-deleted invoices
  DELETE FROM public.invoices
  WHERE deleted_at IS NOT NULL AND deleted_at < cutoff_date;
  GET DIAGNOSTICS v_invoices_deleted = ROW_COUNT;
  
  -- Permanently delete old soft-deleted customers
  DELETE FROM public.customers
  WHERE deleted_at IS NOT NULL AND deleted_at < cutoff_date;
  GET DIAGNOSTICS v_customers_deleted = ROW_COUNT;
  
  RETURN QUERY SELECT v_jobs_deleted, v_quotes_deleted, v_invoices_deleted, v_customers_deleted;
END;
$$;

-- Create function for super admin to restore deleted documents
CREATE OR REPLACE FUNCTION public.restore_deleted_document(
  p_table_name TEXT,
  p_document_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  -- Check if current user is super admin
  SELECT public.has_role(auth.uid(), 'super_admin') INTO v_is_super_admin;
  
  IF NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Only super admins can restore deleted documents';
  END IF;
  
  -- Restore based on table name
  IF p_table_name = 'jobs' THEN
    UPDATE public.jobs SET deleted_at = NULL WHERE id = p_document_id;
  ELSIF p_table_name = 'quotes' THEN
    UPDATE public.quotes SET deleted_at = NULL WHERE id = p_document_id;
  ELSIF p_table_name = 'invoices' THEN
    UPDATE public.invoices SET deleted_at = NULL WHERE id = p_document_id;
  ELSIF p_table_name = 'customers' THEN
    UPDATE public.customers SET deleted_at = NULL WHERE id = p_document_id;
  ELSE
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;
  
  RETURN FOUND;
END;
$$;

-- Create function for super admin to fetch deleted documents for a company
CREATE OR REPLACE FUNCTION public.get_deleted_documents(p_company_id UUID)
RETURNS TABLE(
  id UUID,
  document_type TEXT,
  document_number TEXT,
  title TEXT,
  customer_name TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  permanent_delete_at TIMESTAMP WITH TIME ZONE,
  total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  SELECT public.has_role(auth.uid(), 'super_admin') INTO v_is_super_admin;
  
  IF NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Only super admins can view deleted documents';
  END IF;
  
  RETURN QUERY
  -- Deleted jobs
  SELECT 
    j.id,
    'job'::TEXT as document_type,
    j.job_number as document_number,
    j.title,
    c.name as customer_name,
    j.deleted_at,
    (j.deleted_at + INTERVAL '6 months') as permanent_delete_at,
    j.total
  FROM public.jobs j
  LEFT JOIN public.customers c ON j.customer_id = c.id
  WHERE j.company_id = p_company_id AND j.deleted_at IS NOT NULL
  
  UNION ALL
  
  -- Deleted quotes
  SELECT 
    q.id,
    'quote'::TEXT as document_type,
    q.quote_number as document_number,
    NULL as title,
    c.name as customer_name,
    q.deleted_at,
    (q.deleted_at + INTERVAL '6 months') as permanent_delete_at,
    q.total
  FROM public.quotes q
  LEFT JOIN public.customers c ON q.customer_id = c.id
  WHERE q.company_id = p_company_id AND q.deleted_at IS NOT NULL
  
  UNION ALL
  
  -- Deleted invoices
  SELECT 
    i.id,
    'invoice'::TEXT as document_type,
    i.invoice_number as document_number,
    NULL as title,
    c.name as customer_name,
    i.deleted_at,
    (i.deleted_at + INTERVAL '6 months') as permanent_delete_at,
    i.total
  FROM public.invoices i
  LEFT JOIN public.customers c ON i.customer_id = c.id
  WHERE i.company_id = p_company_id AND i.deleted_at IS NOT NULL
  
  ORDER BY deleted_at DESC;
END;
$$;