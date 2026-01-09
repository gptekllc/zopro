-- Update get_deleted_documents to include customers
CREATE OR REPLACE FUNCTION public.get_deleted_documents(p_company_id uuid)
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
  
  -- Deleted customers
  SELECT 
    cu.id,
    'customer'::TEXT as document_type,
    cu.email as document_number,
    cu.name as title,
    cu.phone as customer_name,
    cu.deleted_at,
    (cu.deleted_at + INTERVAL '6 months') as permanent_delete_at,
    NULL::NUMERIC as total,
    NULL::TEXT as photo_url
  FROM public.customers cu
  WHERE cu.company_id = p_company_id AND cu.deleted_at IS NOT NULL
  
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