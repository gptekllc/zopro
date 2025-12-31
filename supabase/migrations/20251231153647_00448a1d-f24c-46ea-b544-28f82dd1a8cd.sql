-- Add break tracking columns to time_entries table
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS break_start timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_on_break boolean DEFAULT false;

-- Update default for break_minutes if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'time_entries' AND column_name = 'break_minutes'
  ) THEN
    ALTER TABLE public.time_entries ADD COLUMN break_minutes integer DEFAULT 0;
  END IF;
END $$;