-- Drop join_requests table first (has FK to company_join_codes)
DROP TABLE IF EXISTS public.join_requests CASCADE;

-- Drop company_join_codes table
DROP TABLE IF EXISTS public.company_join_codes CASCADE;

-- Drop the old function first since we're changing the return type
DROP FUNCTION IF EXISTS public.create_company_and_set_admin(text, text, text, text, text, text, text);

-- Recreate function without join code logic
CREATE OR REPLACE FUNCTION public.create_company_and_set_admin(
  _name text,
  _email text,
  _phone text,
  _address text,
  _city text,
  _state text,
  _zip text
)
RETURNS TABLE(company_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Prevent creating multiple companies from the same account
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.company_id IS NOT NULL) THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;

  INSERT INTO public.companies (name, email, phone, address, city, state, zip)
  VALUES (
    _name,
    NULLIF(_email, ''),
    NULLIF(_phone, ''),
    NULLIF(_address, ''),
    NULLIF(_city, ''),
    NULLIF(_state, ''),
    NULLIF(_zip, '')
  )
  RETURNING id INTO v_company_id;

  -- Link profile to company and mark as admin
  UPDATE public.profiles
  SET company_id = v_company_id,
      role = 'admin',
      updated_at = now()
  WHERE id = auth.uid();

  -- Assign admin role in roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin')
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT v_company_id;
END;
$function$;