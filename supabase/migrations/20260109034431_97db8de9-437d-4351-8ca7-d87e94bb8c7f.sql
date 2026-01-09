-- Create table to store trusted device tokens for MFA bypass
CREATE TABLE public.trusted_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  device_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on user_id + device_token
CREATE UNIQUE INDEX idx_trusted_devices_user_token ON public.trusted_devices(user_id, device_token);

-- Create index for cleanup queries
CREATE INDEX idx_trusted_devices_expires_at ON public.trusted_devices(expires_at);

-- Enable RLS
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

-- Users can view their own trusted devices
CREATE POLICY "Users can view their own trusted devices"
ON public.trusted_devices
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own trusted devices
CREATE POLICY "Users can insert their own trusted devices"
ON public.trusted_devices
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own trusted devices
CREATE POLICY "Users can delete their own trusted devices"
ON public.trusted_devices
FOR DELETE
USING (auth.uid() = user_id);

-- Users can update their own trusted devices (for last_used_at)
CREATE POLICY "Users can update their own trusted devices"
ON public.trusted_devices
FOR UPDATE
USING (auth.uid() = user_id);

-- Function to check if a device is trusted (can be called after basic auth)
CREATE OR REPLACE FUNCTION public.check_trusted_device(p_user_id UUID, p_device_token TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update last_used_at and return true if valid
  UPDATE public.trusted_devices
  SET last_used_at = now()
  WHERE user_id = p_user_id 
    AND device_token = p_device_token 
    AND expires_at > now();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired trusted devices (can be called by scheduled job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_trusted_devices()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.trusted_devices WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;