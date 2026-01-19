-- Add assigned_to column to quotes table
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_quotes_assigned_to ON public.quotes(assigned_to);

-- Create trigger function for assignment notifications (jobs, invoices, quotes with assigned_to column)
CREATE OR REPLACE FUNCTION public.notify_technician_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_record_type TEXT;
  v_record_number TEXT;
  v_title_text TEXT;
BEGIN
  -- Determine record type and number based on table
  IF TG_TABLE_NAME = 'jobs' THEN
    v_record_type := 'job';
    v_record_number := NEW.job_number;
    v_title_text := COALESCE(NEW.title, '');
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    v_record_type := 'invoice';
    v_record_number := NEW.invoice_number;
    v_title_text := '';
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    v_record_type := 'quote';
    v_record_number := NEW.quote_number;
    v_title_text := '';
  END IF;
  
  -- Only notify if assigned_to changed and is not null
  IF (TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL) THEN
    
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger function for job_assignees table (multi-technician jobs)
CREATE OR REPLACE FUNCTION public.notify_job_assignee()
RETURNS TRIGGER AS $$
DECLARE
  v_job_number TEXT;
  v_job_title TEXT;
BEGIN
  -- Get job details
  SELECT job_number, title INTO v_job_number, v_job_title
  FROM public.jobs WHERE id = NEW.job_id;
  
  -- Create notification for the newly assigned technician
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for assignment notifications
-- Drop existing triggers if they exist to avoid errors
DROP TRIGGER IF EXISTS trigger_job_assignment_notification ON public.jobs;
DROP TRIGGER IF EXISTS trigger_invoice_assignment_notification ON public.invoices;
DROP TRIGGER IF EXISTS trigger_quote_assignment_notification ON public.quotes;
DROP TRIGGER IF EXISTS trigger_job_assignee_notification ON public.job_assignees;

-- Trigger for jobs.assigned_to
CREATE TRIGGER trigger_job_assignment_notification
  AFTER INSERT OR UPDATE OF assigned_to ON public.jobs
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NULL)
  EXECUTE FUNCTION public.notify_technician_assignment();

-- Trigger for invoices.assigned_to
CREATE TRIGGER trigger_invoice_assignment_notification
  AFTER INSERT OR UPDATE OF assigned_to ON public.invoices
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NULL)
  EXECUTE FUNCTION public.notify_technician_assignment();

-- Trigger for quotes.assigned_to
CREATE TRIGGER trigger_quote_assignment_notification
  AFTER INSERT OR UPDATE OF assigned_to ON public.quotes
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NULL)
  EXECUTE FUNCTION public.notify_technician_assignment();

-- Trigger for job_assignees (multi-technician jobs)
CREATE TRIGGER trigger_job_assignee_notification
  AFTER INSERT ON public.job_assignees
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_job_assignee();