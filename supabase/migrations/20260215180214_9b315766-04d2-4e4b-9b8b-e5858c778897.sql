
-- Replace trigger_push_notification() to use a shared secret header
-- The secret is hardcoded here (SECURITY DEFINER hides source from non-superusers)
-- and matched against the INTERNAL_TRIGGER_SECRET Edge Function env var
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  supabase_url TEXT;
  anon_key TEXT;
  request_id BIGINT;
BEGIN
  supabase_url := 'https://emscfiinctuysscrarlg.supabase.co';
  anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtc2NmaWluY3R1eXNzY3JhcmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMjY5MDgsImV4cCI6MjA4MjcwMjkwOH0.1aafbewM1sOsq8TftjfgyEtTIdC0JumFuiKvuvsyqvA';

  -- Make async HTTP request with the shared trigger secret
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'x-trigger-secret', 'd7f3a1b2-9e4c-4d8f-b6a5-3c2e1f0d9a8b'
    ),
    body := jsonb_build_object(
      'userId', NEW.user_id,
      'title', NEW.title,
      'body', NEW.message,
      'tag', NEW.type,
      'url', COALESCE(NEW.data->>'url', '/notifications'),
      'skipInAppNotification', true
    )
  ) INTO request_id;

  RETURN NEW;
END;
$function$;
