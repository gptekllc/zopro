-- Update the create_company_and_set_admin function to also create a 30-day trial subscription
CREATE OR REPLACE FUNCTION public.create_company_and_set_admin(
  _name text,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _city text DEFAULT NULL,
  _state text DEFAULT NULL,
  _zip text DEFAULT NULL
)
RETURNS TABLE(company_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _company_id uuid;
  _free_plan_id uuid;
  _trial_end timestamptz;
BEGIN
  -- Create company
  INSERT INTO companies (name, email, phone, address, city, state, zip)
  VALUES (_name, _email, _phone, _address, _city, _state, _zip)
  RETURNING id INTO _company_id;

  -- Set profile company + admin role
  UPDATE profiles
  SET company_id = _company_id, role = 'admin'
  WHERE id = _user_id;

  -- Grant admin role in user_roles table
  INSERT INTO user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT DO NOTHING;

  -- Create default email templates
  PERFORM create_default_email_templates(_company_id, _user_id);

  -- Get the free plan ID
  SELECT id INTO _free_plan_id 
  FROM subscription_plans 
  WHERE name = 'free' AND is_active = true 
  LIMIT 1;

  -- Create 30-day trial subscription if free plan exists
  IF _free_plan_id IS NOT NULL THEN
    _trial_end := now() + interval '30 days';
    
    INSERT INTO company_subscriptions (
      company_id,
      plan_id,
      status,
      current_period_start,
      current_period_end,
      trial_ends_at
    ) VALUES (
      _company_id,
      _free_plan_id,
      'trialing',
      now(),
      _trial_end,
      _trial_end
    );
  END IF;

  RETURN QUERY SELECT _company_id;
END;
$$;