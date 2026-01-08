-- Function to assign super_admin role by email (reusable)
CREATE OR REPLACE FUNCTION public.assign_super_admin_by_email(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  -- Look up user ID from auth.users
  SELECT id INTO _user_id
  FROM auth.users
  WHERE email = _email;
  
  IF _user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found', _email;
    RETURN;
  END IF;
  
  -- Insert super_admin role (ignore if already exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RAISE NOTICE 'Super admin role assigned to %', _email;
END;
$$;

-- Assign super_admin to your email
SELECT public.assign_super_admin_by_email('gptekusa@gmail.com');