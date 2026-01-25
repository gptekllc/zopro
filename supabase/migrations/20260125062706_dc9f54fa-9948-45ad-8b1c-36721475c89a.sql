-- Update handle_new_user function to better extract names from various OAuth providers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_name_parts TEXT[];
BEGIN
  -- Extract first name: check multiple possible sources
  v_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',           -- Email signup
    NEW.raw_user_meta_data->>'given_name',           -- Google OAuth
    (NEW.raw_user_meta_data->'user_metadata'->>'given_name'),  -- Nested structure
    NULL
  );
  
  -- Extract last name: check multiple possible sources
  v_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',            -- Email signup
    NEW.raw_user_meta_data->>'family_name',          -- Google OAuth
    (NEW.raw_user_meta_data->'user_metadata'->>'family_name'), -- Nested structure
    NULL
  );
  
  -- Extract or construct full name
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',            -- Email signup
    NEW.raw_user_meta_data->>'name',                 -- Google OAuth
    (NEW.raw_user_meta_data->'user_metadata'->>'name'),        -- Nested structure
    NULLIF(TRIM(COALESCE(v_first_name, '') || ' ' || COALESCE(v_last_name, '')), '')
  );
  
  -- If we still don't have first/last name but have full_name, split it
  IF v_first_name IS NULL AND v_last_name IS NULL AND v_full_name IS NOT NULL THEN
    v_name_parts := string_to_array(v_full_name, ' ');
    IF array_length(v_name_parts, 1) >= 1 THEN
      v_first_name := v_name_parts[1];
    END IF;
    IF array_length(v_name_parts, 1) >= 2 THEN
      v_last_name := array_to_string(v_name_parts[2:], ' ');
    END IF;
  END IF;
  
  -- Insert the profile with all name fields
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name)
  VALUES (NEW.id, NEW.email, v_full_name, v_first_name, v_last_name);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Backfill existing profiles: split full_name into first_name and last_name where missing
UPDATE profiles
SET 
  first_name = COALESCE(first_name, split_part(full_name, ' ', 1)),
  last_name = COALESCE(last_name, 
    CASE 
      WHEN position(' ' in full_name) > 0 
      THEN substring(full_name from position(' ' in full_name) + 1)
      ELSE NULL
    END
  )
WHERE full_name IS NOT NULL 
  AND (first_name IS NULL OR last_name IS NULL);