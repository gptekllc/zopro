-- Create trigger function to log job priority changes
CREATE OR REPLACE FUNCTION public.log_job_priority_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if priority actually changed
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO public.job_activities (
      job_id,
      company_id,
      activity_type,
      old_value,
      new_value,
      performed_by
    ) VALUES (
      NEW.id,
      NEW.company_id,
      'priority_change',
      OLD.priority::text,
      NEW.priority::text,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for priority changes
CREATE TRIGGER log_job_priority_change_trigger
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  WHEN (OLD.priority IS DISTINCT FROM NEW.priority)
  EXECUTE FUNCTION public.log_job_priority_change();