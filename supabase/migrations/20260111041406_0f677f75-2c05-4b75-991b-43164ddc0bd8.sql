-- Create function to hard delete a user from auth.users
-- This allows re-signup with the same email after permanent deletion
CREATE OR REPLACE FUNCTION public.hard_delete_auth_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete from auth.users (this cascades to profiles via FK)
  DELETE FROM auth.users WHERE id = target_user_id;
  RETURN FOUND;
END;
$$;

-- Grant execute to service role only (called from edge functions or super admin)
REVOKE ALL ON FUNCTION public.hard_delete_auth_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hard_delete_auth_user(UUID) TO service_role;