-- Enable the pg_net extension for making HTTP requests from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to send push notification via edge function
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  request_id BIGINT;
BEGIN
  -- Get Supabase URL and service role key from vault or use defaults
  supabase_url := 'https://emscfiinctuysscrarlg.supabase.co';
  
  -- Get the service role key from vault
  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;
  
  -- If no service role key in vault, we can't make authenticated requests
  -- The edge function will need to handle this gracefully
  IF service_role_key IS NULL THEN
    -- Use anon key as fallback (edge function will validate)
    service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtc2NmaWluY3R1eXNzY3JhcmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMjY5MDgsImV4cCI6MjA4MjcwMjkwOH0.1aafbewM1sOsq8TftjfgyEtTIdC0JumFuiKvuvsyqvA';
  END IF;

  -- Make async HTTP request to the edge function
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'userId', NEW.user_id,
      'title', NEW.title,
      'body', NEW.message,
      'tag', NEW.type,
      'url', COALESCE(NEW.data->>'url', '/notifications')
    )
  ) INTO request_id;

  RETURN NEW;
END;
$$;

-- Create trigger that fires after a new notification is inserted
DROP TRIGGER IF EXISTS on_notification_created_send_push ON public.notifications;

CREATE TRIGGER on_notification_created_send_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();