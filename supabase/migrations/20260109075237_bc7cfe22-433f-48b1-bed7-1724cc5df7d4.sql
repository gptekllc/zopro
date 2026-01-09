-- Create function to permanently delete a specific document
CREATE OR REPLACE FUNCTION public.permanent_delete_document(p_table_name text, p_document_id uuid)
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
    RAISE EXCEPTION 'Only super admins can permanently delete documents';
  END IF;
  
  IF p_table_name = 'jobs' THEN
    DELETE FROM public.jobs WHERE id = p_document_id AND deleted_at IS NOT NULL;
  ELSIF p_table_name = 'quotes' THEN
    DELETE FROM public.quotes WHERE id = p_document_id AND deleted_at IS NOT NULL;
  ELSIF p_table_name = 'invoices' THEN
    DELETE FROM public.invoices WHERE id = p_document_id AND deleted_at IS NOT NULL;
  ELSIF p_table_name = 'customers' THEN
    DELETE FROM public.customers WHERE id = p_document_id AND deleted_at IS NOT NULL;
  ELSIF p_table_name = 'profiles' THEN
    DELETE FROM public.profiles WHERE id = p_document_id AND deleted_at IS NOT NULL;
  ELSIF p_table_name = 'job_photos' THEN
    DELETE FROM public.job_photos WHERE id = p_document_id AND deleted_at IS NOT NULL;
  ELSIF p_table_name = 'quote_photos' THEN
    DELETE FROM public.quote_photos WHERE id = p_document_id AND deleted_at IS NOT NULL;
  ELSIF p_table_name = 'invoice_photos' THEN
    DELETE FROM public.invoice_photos WHERE id = p_document_id AND deleted_at IS NOT NULL;
  ELSE
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;
  
  RETURN FOUND;
END;
$function$;