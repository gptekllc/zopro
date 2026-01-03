-- Add automation notification preference
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS notify_on_automation_run boolean NOT NULL DEFAULT true;