-- Add business hours to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS business_hours jsonb DEFAULT '{
  "monday": {"open": "09:00", "close": "17:00", "closed": false},
  "tuesday": {"open": "09:00", "close": "17:00", "closed": false},
  "wednesday": {"open": "09:00", "close": "17:00", "closed": false},
  "thursday": {"open": "09:00", "close": "17:00", "closed": false},
  "friday": {"open": "09:00", "close": "17:00", "closed": false},
  "saturday": {"open": "09:00", "close": "13:00", "closed": true},
  "sunday": {"open": "09:00", "close": "13:00", "closed": true}
}'::jsonb;