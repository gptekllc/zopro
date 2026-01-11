-- Create RPC function to create a customer from an authenticated user
-- This is used during customer onboarding when a user selects "Continue as Customer"
CREATE OR REPLACE FUNCTION public.create_customer_from_auth_user(
  _name TEXT,
  _email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _customer_id UUID;
  _existing_customer_id UUID;
BEGIN
  -- Check if a customer with this email already exists (across all companies or unassigned)
  SELECT id INTO _existing_customer_id
  FROM customers
  WHERE email = LOWER(_email)
  LIMIT 1;
  
  IF _existing_customer_id IS NOT NULL THEN
    -- Customer already exists, return existing ID
    RETURN _existing_customer_id;
  END IF;
  
  -- Create a new customer record with NULL company_id (unassigned)
  -- This allows the customer to access the portal before being claimed by a company
  INSERT INTO customers (
    id,
    name,
    email,
    company_id,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    _name,
    LOWER(_email),
    NULL, -- Unassigned - will be linked when a company adds them
    NOW(),
    NOW()
  )
  RETURNING id INTO _customer_id;
  
  RETURN _customer_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_customer_from_auth_user(TEXT, TEXT) TO authenticated;