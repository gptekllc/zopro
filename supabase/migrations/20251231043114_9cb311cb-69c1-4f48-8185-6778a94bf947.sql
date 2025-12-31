-- Secure bootstrap for first-time company creation.
-- This avoids requiring broad INSERT permissions/policies and prevents users from self-assigning roles freely.

CREATE OR REPLACE FUNCTION public.create_company_and_set_admin(
  _name text,
  _email text,
  _phone text,
  _address text,
  _city text,
  _state text,
  _zip text
)
RETURNS TABLE(company_id uuid, join_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_join_code text;
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

  -- Link profile to company and mark as admin (kept for compatibility with existing RLS that checks profiles.role)
  UPDATE public.profiles
  SET company_id = v_company_id,
      role = 'admin',
      updated_at = now()
  WHERE id = auth.uid();

  -- Assign admin role in roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin')
  ON CONFLICT DO NOTHING;

  -- Create a default join code
  v_join_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  INSERT INTO public.company_join_codes (company_id, code, created_by, is_active)
  VALUES (v_company_id, v_join_code, auth.uid(), true);

  RETURN QUERY SELECT v_company_id, v_join_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_and_set_admin(text, text, text, text, text, text, text) TO authenticated;