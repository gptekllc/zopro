-- Drop and recreate get_deleted_documents to include users
DROP FUNCTION IF EXISTS public.get_deleted_documents(uuid);

CREATE FUNCTION public.get_deleted_documents(p_company_id uuid)
 RETURNS TABLE(id uuid, document_type text, document_number text, title text, customer_name text, deleted_at timestamp with time zone, permanent_delete_at timestamp with time zone, total numeric, photo_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    j.total,
    NULL::TEXT as photo_url
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
    q.total,
    NULL::TEXT as photo_url
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
    i.total,
    NULL::TEXT as photo_url
  FROM public.invoices i
  LEFT JOIN public.customers c ON i.customer_id = c.id
  WHERE i.company_id = p_company_id AND i.deleted_at IS NOT NULL
  
  UNION ALL
  
  -- Deleted users (profiles)
  SELECT 
    p.id,
    'user'::TEXT as document_type,
    p.email as document_number,
    p.full_name as title,
    p.role as customer_name,
    p.deleted_at,
    (p.deleted_at + INTERVAL '6 months') as permanent_delete_at,
    NULL::NUMERIC as total,
    p.avatar_url as photo_url
  FROM public.profiles p
  WHERE p.company_id = p_company_id AND p.deleted_at IS NOT NULL
  
  UNION ALL
  
  -- Deleted job photos
  SELECT 
    jp.id,
    'job_photo'::TEXT as document_type,
    j.job_number as document_number,
    jp.caption as title,
    c.name as customer_name,
    jp.deleted_at,
    (jp.deleted_at + INTERVAL '6 months') as permanent_delete_at,
    NULL::NUMERIC as total,
    jp.photo_url
  FROM public.job_photos jp
  JOIN public.jobs j ON jp.job_id = j.id
  LEFT JOIN public.customers c ON j.customer_id = c.id
  WHERE j.company_id = p_company_id AND jp.deleted_at IS NOT NULL
  
  UNION ALL
  
  -- Deleted quote photos
  SELECT 
    qp.id,
    'quote_photo'::TEXT as document_type,
    q.quote_number as document_number,
    qp.caption as title,
    c.name as customer_name,
    qp.deleted_at,
    (qp.deleted_at + INTERVAL '6 months') as permanent_delete_at,
    NULL::NUMERIC as total,
    qp.photo_url
  FROM public.quote_photos qp
  JOIN public.quotes q ON qp.quote_id = q.id
  LEFT JOIN public.customers c ON q.customer_id = c.id
  WHERE q.company_id = p_company_id AND qp.deleted_at IS NOT NULL
  
  UNION ALL
  
  -- Deleted invoice photos
  SELECT 
    ip.id,
    'invoice_photo'::TEXT as document_type,
    i.invoice_number as document_number,
    ip.caption as title,
    c.name as customer_name,
    ip.deleted_at,
    (ip.deleted_at + INTERVAL '6 months') as permanent_delete_at,
    NULL::NUMERIC as total,
    ip.photo_url
  FROM public.invoice_photos ip
  JOIN public.invoices i ON ip.invoice_id = i.id
  LEFT JOIN public.customers c ON i.customer_id = c.id
  WHERE i.company_id = p_company_id AND ip.deleted_at IS NOT NULL
  
  ORDER BY deleted_at DESC;
END;
$function$;

-- Update restore function to handle profiles
CREATE OR REPLACE FUNCTION public.restore_deleted_document(p_table_name text, p_document_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  SELECT public.has_role(auth.uid(), 'super_admin') INTO v_is_super_admin;
  
  IF NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Only super admins can restore deleted documents';
  END IF;
  
  IF p_table_name = 'jobs' THEN
    UPDATE public.jobs SET deleted_at = NULL WHERE id = p_document_id;
  ELSIF p_table_name = 'quotes' THEN
    UPDATE public.quotes SET deleted_at = NULL WHERE id = p_document_id;
  ELSIF p_table_name = 'invoices' THEN
    UPDATE public.invoices SET deleted_at = NULL WHERE id = p_document_id;
  ELSIF p_table_name = 'customers' THEN
    UPDATE public.customers SET deleted_at = NULL WHERE id = p_document_id;
  ELSIF p_table_name = 'profiles' THEN
    UPDATE public.profiles SET deleted_at = NULL WHERE id = p_document_id;
  ELSIF p_table_name = 'job_photos' THEN
    UPDATE public.job_photos SET deleted_at = NULL WHERE id = p_document_id;
  ELSIF p_table_name = 'quote_photos' THEN
    UPDATE public.quote_photos SET deleted_at = NULL WHERE id = p_document_id;
  ELSIF p_table_name = 'invoice_photos' THEN
    UPDATE public.invoice_photos SET deleted_at = NULL WHERE id = p_document_id;
  ELSE
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;
  
  RETURN FOUND;
END;
$function$;

-- Update permanent delete function to include profiles
DROP FUNCTION IF EXISTS public.permanent_delete_old_soft_deleted_records();

CREATE FUNCTION public.permanent_delete_old_soft_deleted_records()
 RETURNS TABLE(jobs_deleted integer, quotes_deleted integer, invoices_deleted integer, customers_deleted integer, photos_deleted integer, users_deleted integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cutoff_date TIMESTAMP WITH TIME ZONE;
  v_jobs_deleted INT := 0;
  v_quotes_deleted INT := 0;
  v_invoices_deleted INT := 0;
  v_customers_deleted INT := 0;
  v_photos_deleted INT := 0;
  v_users_deleted INT := 0;
  v_temp INT;
BEGIN
  cutoff_date := now() - INTERVAL '6 months';
  
  -- Delete old soft-deleted photos first
  DELETE FROM public.job_photos WHERE deleted_at IS NOT NULL AND deleted_at < cutoff_date;
  GET DIAGNOSTICS v_temp = ROW_COUNT;
  v_photos_deleted := v_photos_deleted + v_temp;
  
  DELETE FROM public.quote_photos WHERE deleted_at IS NOT NULL AND deleted_at < cutoff_date;
  GET DIAGNOSTICS v_temp = ROW_COUNT;
  v_photos_deleted := v_photos_deleted + v_temp;
  
  DELETE FROM public.invoice_photos WHERE deleted_at IS NOT NULL AND deleted_at < cutoff_date;
  GET DIAGNOSTICS v_temp = ROW_COUNT;
  v_photos_deleted := v_photos_deleted + v_temp;
  
  -- Delete documents
  DELETE FROM public.jobs WHERE deleted_at IS NOT NULL AND deleted_at < cutoff_date;
  GET DIAGNOSTICS v_jobs_deleted = ROW_COUNT;
  
  DELETE FROM public.quotes WHERE deleted_at IS NOT NULL AND deleted_at < cutoff_date;
  GET DIAGNOSTICS v_quotes_deleted = ROW_COUNT;
  
  DELETE FROM public.invoices WHERE deleted_at IS NOT NULL AND deleted_at < cutoff_date;
  GET DIAGNOSTICS v_invoices_deleted = ROW_COUNT;
  
  DELETE FROM public.customers WHERE deleted_at IS NOT NULL AND deleted_at < cutoff_date;
  GET DIAGNOSTICS v_customers_deleted = ROW_COUNT;
  
  -- Delete old soft-deleted profiles (users)
  DELETE FROM public.profiles WHERE deleted_at IS NOT NULL AND deleted_at < cutoff_date;
  GET DIAGNOSTICS v_users_deleted = ROW_COUNT;
  
  RETURN QUERY SELECT v_jobs_deleted, v_quotes_deleted, v_invoices_deleted, v_customers_deleted, v_photos_deleted, v_users_deleted;
END;
$function$;