-- Add columns for Despia device linking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS despia_device_uuid TEXT,
  ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT;