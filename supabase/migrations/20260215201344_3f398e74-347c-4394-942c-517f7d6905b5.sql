
-- 1. Update notify_technician_assignment to also send email via edge function
CREATE OR REPLACE FUNCTION public.notify_technician_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_record_type TEXT;
  v_record_number TEXT;
  v_title_text TEXT;
  v_company_id UUID;
  supabase_url TEXT;
  anon_key TEXT;
  request_id BIGINT;
BEGIN
  -- Determine record type and number based on table
  IF TG_TABLE_NAME = 'jobs' THEN
    v_record_type := 'job';
    v_record_number := NEW.job_number;
    v_title_text := COALESCE(NEW.title, '');
    v_company_id := NEW.company_id;
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    v_record_type := 'invoice';
    v_record_number := NEW.invoice_number;
    v_title_text := '';
    v_company_id := NEW.company_id;
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    v_record_type := 'quote';
    v_record_number := NEW.quote_number;
    v_title_text := '';
    v_company_id := NEW.company_id;
  END IF;
  
  -- Only notify if assigned_to changed and is not null
  IF (TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL) THEN
    
    -- In-app notification (existing behavior)
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.assigned_to,
      'assignment',
      'New Assignment',
      CASE 
        WHEN v_title_text != '' THEN format('You have been assigned to %s #%s: %s', initcap(v_record_type), v_record_number, v_title_text)
        ELSE format('You have been assigned to %s #%s', initcap(v_record_type), v_record_number)
      END,
      jsonb_build_object(
        'record_type', v_record_type,
        'record_id', NEW.id,
        'record_number', v_record_number
      )
    );

    -- Send email notification via edge function
    supabase_url := 'https://emscfiinctuysscrarlg.supabase.co';
    anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtc2NmaWluY3R1eXNzY3JhcmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMjY5MDgsImV4cCI6MjA4MjcwMjkwOH0.1aafbewM1sOsq8TftjfgyEtTIdC0JumFuiKvuvsyqvA';

    SELECT net.http_post(
      url := supabase_url || '/functions/v1/send-assignment-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key,
        'x-trigger-secret', 'd7f3a1b2-9e4c-4d8f-b6a5-3c2e1f0d9a8b'
      ),
      body := jsonb_build_object(
        'technicianId', NEW.assigned_to,
        'recordType', v_record_type,
        'recordId', NEW.id,
        'recordNumber', v_record_number,
        'companyId', v_company_id
      )
    ) INTO request_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- 2. Update notify_job_assignee to also send email for multi-technician jobs
CREATE OR REPLACE FUNCTION public.notify_job_assignee()
RETURNS TRIGGER AS $$
DECLARE
  v_job_number TEXT;
  v_job_title TEXT;
  v_company_id UUID;
  supabase_url TEXT;
  anon_key TEXT;
  request_id BIGINT;
BEGIN
  -- Get job details
  SELECT job_number, title, company_id INTO v_job_number, v_job_title, v_company_id
  FROM public.jobs WHERE id = NEW.job_id;
  
  -- Create in-app notification
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    NEW.profile_id,
    'assignment',
    'New Job Assignment',
    format('You have been assigned to Job #%s: %s', v_job_number, COALESCE(v_job_title, 'Untitled')),
    jsonb_build_object(
      'record_type', 'job',
      'record_id', NEW.job_id,
      'record_number', v_job_number
    )
  );

  -- Send email notification via edge function
  supabase_url := 'https://emscfiinctuysscrarlg.supabase.co';
  anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtc2NmaWluY3R1eXNzY3JhcmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMjY5MDgsImV4cCI6MjA4MjcwMjkwOH0.1aafbewM1sOsq8TftjfgyEtTIdC0JumFuiKvuvsyqvA';

  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-assignment-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'x-trigger-secret', 'd7f3a1b2-9e4c-4d8f-b6a5-3c2e1f0d9a8b'
    ),
    body := jsonb_build_object(
      'technicianId', NEW.profile_id,
      'recordType', 'job',
      'recordId', NEW.job_id,
      'recordNumber', v_job_number,
      'companyId', v_company_id
    )
  ) INTO request_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- 3. Create trigger function for priority change notifications on jobs
CREATE OR REPLACE FUNCTION public.notify_priority_change()
RETURNS TRIGGER AS $$
DECLARE
  v_assignee_id UUID;
  v_old_priority TEXT;
  v_new_priority TEXT;
BEGIN
  v_old_priority := OLD.priority::TEXT;
  v_new_priority := NEW.priority::TEXT;
  v_assignee_id := NEW.assigned_to;

  -- Notify the primary assignee
  IF v_assignee_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      v_assignee_id,
      'priority_change',
      'Priority Updated',
      format('Job #%s priority changed: %s → %s', NEW.job_number, initcap(v_old_priority), initcap(v_new_priority)),
      jsonb_build_object(
        'record_type', 'job',
        'record_id', NEW.id,
        'record_number', NEW.job_number,
        'old_priority', v_old_priority,
        'new_priority', v_new_priority
      )
    );
  END IF;

  -- Also notify all technicians in job_assignees (excluding primary)
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT 
    ja.profile_id,
    'priority_change',
    'Priority Updated',
    format('Job #%s priority changed: %s → %s', NEW.job_number, initcap(v_old_priority), initcap(v_new_priority)),
    jsonb_build_object(
      'record_type', 'job',
      'record_id', NEW.id,
      'record_number', NEW.job_number,
      'old_priority', v_old_priority,
      'new_priority', v_new_priority
    )
  FROM public.job_assignees ja
  WHERE ja.job_id = NEW.id
    AND ja.profile_id != COALESCE(v_assignee_id, '00000000-0000-0000-0000-000000000000'::uuid);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for job priority changes
DROP TRIGGER IF EXISTS job_priority_notify_trigger ON public.jobs;
CREATE TRIGGER job_priority_notify_trigger
  AFTER UPDATE OF priority ON public.jobs
  FOR EACH ROW
  WHEN (OLD.priority IS DISTINCT FROM NEW.priority)
  EXECUTE FUNCTION public.notify_priority_change();
