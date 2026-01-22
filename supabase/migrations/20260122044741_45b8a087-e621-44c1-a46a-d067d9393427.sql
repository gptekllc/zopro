-- Function to notify assigned technicians when status changes on jobs, invoices, or quotes
CREATE OR REPLACE FUNCTION public.notify_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_record_type TEXT;
  v_record_number TEXT;
  v_title_text TEXT;
  v_assignee_id UUID;
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  -- Determine record type and details
  IF TG_TABLE_NAME = 'jobs' THEN
    v_record_type := 'job';
    v_record_number := NEW.job_number;
    v_title_text := COALESCE(NEW.title, '');
    v_assignee_id := NEW.assigned_to;
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    v_record_type := 'invoice';
    v_record_number := NEW.invoice_number;
    v_title_text := '';
    v_assignee_id := NEW.assigned_to;
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    v_record_type := 'quote';
    v_record_number := NEW.quote_number;
    v_title_text := '';
    v_assignee_id := NEW.assigned_to;
  END IF;
  
  v_old_status := OLD.status::TEXT;
  v_new_status := NEW.status::TEXT;
  
  -- Only notify if status changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Notify the primary assignee if exists
    IF v_assignee_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        v_assignee_id,
        'status_change',
        format('%s Status Updated', initcap(v_record_type)),
        format('%s #%s: %s → %s', 
          initcap(v_record_type), v_record_number, 
          initcap(replace(v_old_status, '_', ' ')),
          initcap(replace(v_new_status, '_', ' '))
        ),
        jsonb_build_object(
          'record_type', v_record_type,
          'record_id', NEW.id,
          'record_number', v_record_number,
          'old_status', v_old_status,
          'new_status', v_new_status
        )
      );
    END IF;
    
    -- For jobs, also notify all technicians in job_assignees (excluding primary)
    IF TG_TABLE_NAME = 'jobs' THEN
      INSERT INTO public.notifications (user_id, type, title, message, data)
      SELECT 
        ja.profile_id,
        'status_change',
        'Job Status Updated',
        format('Job #%s: %s → %s', 
          NEW.job_number, 
          initcap(replace(v_old_status, '_', ' ')),
          initcap(replace(v_new_status, '_', ' '))
        ),
        jsonb_build_object(
          'record_type', 'job',
          'record_id', NEW.id,
          'record_number', NEW.job_number,
          'old_status', v_old_status,
          'new_status', v_new_status
        )
      FROM public.job_assignees ja
      WHERE ja.job_id = NEW.id
        AND ja.profile_id != COALESCE(v_assignee_id, '00000000-0000-0000-0000-000000000000'::uuid);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for job status changes
DROP TRIGGER IF EXISTS job_status_notify_trigger ON public.jobs;
CREATE TRIGGER job_status_notify_trigger
AFTER UPDATE OF status ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.notify_status_change();

-- Trigger for invoice status changes
DROP TRIGGER IF EXISTS invoice_status_notify_trigger ON public.invoices;
CREATE TRIGGER invoice_status_notify_trigger
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.notify_status_change();

-- Trigger for quote status changes
DROP TRIGGER IF EXISTS quote_status_notify_trigger ON public.quotes;
CREATE TRIGGER quote_status_notify_trigger
AFTER UPDATE OF status ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.notify_status_change();