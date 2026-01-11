-- Add first_name and last_name columns to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Migrate existing customer data: split "name" into first_name and last_name
UPDATE customers 
SET 
  first_name = SPLIT_PART(name, ' ', 1),
  last_name = CASE 
    WHEN POSITION(' ' IN name) > 0 
    THEN TRIM(SUBSTRING(name FROM POSITION(' ' IN name) + 1))
    ELSE NULL 
  END
WHERE first_name IS NULL AND name IS NOT NULL;

-- Add first_name and last_name columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Migrate existing profile data: split "full_name" into first_name and last_name
UPDATE profiles 
SET 
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE 
    WHEN POSITION(' ' IN full_name) > 0 
    THEN TRIM(SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1))
    ELSE NULL 
  END
WHERE first_name IS NULL AND full_name IS NOT NULL;