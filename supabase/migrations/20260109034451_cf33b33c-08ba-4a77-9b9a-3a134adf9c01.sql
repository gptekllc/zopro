-- Fix function search_path for security
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.cleanup_expired_trusted_devices()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.trusted_devices WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;