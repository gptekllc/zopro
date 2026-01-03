-- Add comprehensive company preferences columns

-- PDF Preferences
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS pdf_show_logo boolean NOT NULL DEFAULT true;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS pdf_show_line_item_details boolean NOT NULL DEFAULT true;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS pdf_footer_text text;

-- Job Settings
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_job_duration integer NOT NULL DEFAULT 60;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_job_priority text NOT NULL DEFAULT 'medium';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS auto_archive_days integer NOT NULL DEFAULT 365;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS notify_on_job_assignment boolean NOT NULL DEFAULT true;

-- Quote Settings
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_quote_validity_days integer NOT NULL DEFAULT 30;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS auto_expire_quotes boolean NOT NULL DEFAULT true;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS require_quote_signature boolean NOT NULL DEFAULT false;

-- Invoice Settings
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS auto_send_invoice_reminders boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS invoice_reminder_days integer NOT NULL DEFAULT 7;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS auto_apply_late_fees boolean NOT NULL DEFAULT false;

-- Notification Preferences
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS email_on_new_job boolean NOT NULL DEFAULT true;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS email_on_payment_received boolean NOT NULL DEFAULT true;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS send_weekly_summary boolean NOT NULL DEFAULT false;

-- Branding
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS brand_primary_color text NOT NULL DEFAULT '#0066CC';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS customer_portal_welcome_message text;