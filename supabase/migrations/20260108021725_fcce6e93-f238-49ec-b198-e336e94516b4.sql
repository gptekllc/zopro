-- Create table to track login attempts for rate limiting
CREATE TABLE public.login_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_login_attempts_email_created ON login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_ip_created ON login_attempts(ip_address, created_at DESC);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anyone (needed for tracking failed attempts before auth)
CREATE POLICY "Allow insert login attempts"
ON public.login_attempts
FOR INSERT
WITH CHECK (true);

-- Only allow reading own attempts (after authenticated)
CREATE POLICY "Users can read attempts for their email"
ON public.login_attempts
FOR SELECT
USING (auth.jwt() ->> 'email' = email);

-- Create function to check if account is locked
CREATE OR REPLACE FUNCTION public.check_account_lockout(check_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  failed_count INTEGER;
  lockout_until TIMESTAMP WITH TIME ZONE;
  last_failed_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Count failed attempts in the last 15 minutes
  SELECT COUNT(*), MAX(created_at)
  INTO failed_count, last_failed_at
  FROM login_attempts
  WHERE email = LOWER(check_email)
    AND success = false
    AND created_at > NOW() - INTERVAL '15 minutes';

  -- If 5+ failed attempts, account is locked
  IF failed_count >= 5 THEN
    -- Calculate lockout end time (15 minutes from last failed attempt)
    lockout_until := last_failed_at + INTERVAL '15 minutes';
    
    IF lockout_until > NOW() THEN
      RETURN json_build_object(
        'locked', true,
        'failed_attempts', failed_count,
        'lockout_until', lockout_until,
        'minutes_remaining', CEIL(EXTRACT(EPOCH FROM (lockout_until - NOW())) / 60)
      );
    END IF;
  END IF;

  RETURN json_build_object(
    'locked', false,
    'failed_attempts', failed_count,
    'attempts_remaining', 5 - failed_count
  );
END;
$$;

-- Create function to record login attempt
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  attempt_email TEXT,
  attempt_success BOOLEAN,
  attempt_ip TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO login_attempts (email, success, ip_address)
  VALUES (LOWER(attempt_email), attempt_success, attempt_ip);
  
  -- If successful login, clear old failed attempts for this email
  IF attempt_success THEN
    DELETE FROM login_attempts
    WHERE email = LOWER(attempt_email)
      AND success = false
      AND created_at < NOW() - INTERVAL '1 hour';
  END IF;
END;
$$;

-- Auto-cleanup old login attempts (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM login_attempts
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;