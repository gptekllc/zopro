-- Update handle_new_user function to extract first/last name from social auth providers (Google OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
BEGIN
  -- Extract first name: check for email signup fields first, then OAuth provider fields
  v_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',    -- Email signup
    NEW.raw_user_meta_data->>'given_name'     -- Google OAuth
  );
  
  -- Extract last name: check for email signup fields first, then OAuth provider fields
  v_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',     -- Email signup
    NEW.raw_user_meta_data->>'family_name'    -- Google OAuth
  );
  
  -- Extract or construct full name
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',     -- Email signup
    NEW.raw_user_meta_data->>'name',          -- Google OAuth
    NULLIF(TRIM(COALESCE(v_first_name, '') || ' ' || COALESCE(v_last_name, '')), '')
  );
  
  -- Insert the profile with all name fields
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name)
  VALUES (NEW.id, NEW.email, v_full_name, v_first_name, v_last_name);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';