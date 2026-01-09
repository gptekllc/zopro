
-- 1. LOGIN_ATTEMPTS: Remove SELECT policy to prevent email enumeration
-- Only service role should read login attempts (used by backend functions)
DROP POLICY IF EXISTS "Users can read attempts for their email" ON public.login_attempts;

-- 2. COMPANIES: Create a view/function approach to hide Stripe credentials from non-admins
-- First, drop existing SELECT policies and recreate with column-level security logic
-- Since Postgres RLS doesn't support column-level policies, we use a security definer function

-- Create a function to get company data with sensitive fields hidden for non-admins
CREATE OR REPLACE FUNCTION public.get_company_for_user(_company_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  website text,
  logo_url text,
  brand_primary_color text,
  tax_rate numeric,
  payment_terms_days integer,
  late_fee_percentage numeric,
  timezone text,
  business_hours jsonb,
  custom_domain text,
  customer_portal_welcome_message text,
  -- Settings
  default_job_duration integer,
  default_job_priority text,
  default_quote_validity_days integer,
  default_payment_method text,
  -- Email settings
  email_on_new_job boolean,
  email_on_payment_received boolean,
  email_invoice_body text,
  email_job_body text,
  email_quote_body text,
  -- PDF settings
  pdf_show_logo boolean,
  pdf_show_notes boolean,
  pdf_show_signature boolean,
  pdf_show_line_item_details boolean,
  pdf_footer_text text,
  pdf_terms_conditions text,
  pdf_show_job_photos boolean,
  pdf_show_quote_photos boolean,
  pdf_show_invoice_photos boolean,
  -- Automation settings
  auto_archive_days integer,
  auto_send_invoice_reminders boolean,
  invoice_reminder_days integer,
  auto_expire_quotes boolean,
  auto_apply_late_fees boolean,
  auto_send_job_scheduled_email boolean,
  -- Notification settings
  notify_on_job_assignment boolean,
  notify_on_automation_run boolean,
  send_weekly_summary boolean,
  -- Timeclock settings
  timeclock_require_job_selection boolean,
  timeclock_enforce_job_labor boolean,
  timeclock_allow_manual_labor_edit boolean,
  timeclock_auto_start_break_reminder integer,
  timeclock_max_shift_hours integer,
  -- Signature settings
  require_quote_signature boolean,
  require_job_completion_signature boolean,
  require_mfa boolean,
  -- Stripe fields (only for admins)
  stripe_account_id text,
  stripe_onboarding_complete boolean,
  stripe_charges_enabled boolean,
  stripe_payouts_enabled boolean,
  stripe_payments_enabled boolean,
  platform_fee_percentage numeric,
  -- Timestamps
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Check if current user is admin of this company
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.company_id = _company_id
    AND p.role = 'admin'
  ) OR has_role(auth.uid(), 'super_admin')
  INTO is_admin;

  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.email,
    c.phone,
    c.address,
    c.city,
    c.state,
    c.zip,
    c.website,
    c.logo_url,
    c.brand_primary_color,
    c.tax_rate,
    c.payment_terms_days,
    c.late_fee_percentage,
    c.timezone,
    c.business_hours,
    c.custom_domain,
    c.customer_portal_welcome_message,
    c.default_job_duration,
    c.default_job_priority,
    c.default_quote_validity_days,
    c.default_payment_method,
    c.email_on_new_job,
    c.email_on_payment_received,
    c.email_invoice_body,
    c.email_job_body,
    c.email_quote_body,
    c.pdf_show_logo,
    c.pdf_show_notes,
    c.pdf_show_signature,
    c.pdf_show_line_item_details,
    c.pdf_footer_text,
    c.pdf_terms_conditions,
    c.pdf_show_job_photos,
    c.pdf_show_quote_photos,
    c.pdf_show_invoice_photos,
    c.auto_archive_days,
    c.auto_send_invoice_reminders,
    c.invoice_reminder_days,
    c.auto_expire_quotes,
    c.auto_apply_late_fees,
    c.auto_send_job_scheduled_email,
    c.notify_on_job_assignment,
    c.notify_on_automation_run,
    c.send_weekly_summary,
    c.timeclock_require_job_selection,
    c.timeclock_enforce_job_labor,
    c.timeclock_allow_manual_labor_edit,
    c.timeclock_auto_start_break_reminder,
    c.timeclock_max_shift_hours,
    c.require_quote_signature,
    c.require_job_completion_signature,
    c.require_mfa,
    -- Hide Stripe fields for non-admins
    CASE WHEN is_admin THEN c.stripe_account_id ELSE NULL END,
    CASE WHEN is_admin THEN c.stripe_onboarding_complete ELSE NULL END,
    CASE WHEN is_admin THEN c.stripe_charges_enabled ELSE NULL END,
    CASE WHEN is_admin THEN c.stripe_payouts_enabled ELSE NULL END,
    CASE WHEN is_admin THEN c.stripe_payments_enabled ELSE NULL END,
    CASE WHEN is_admin THEN c.platform_fee_percentage ELSE NULL END,
    c.created_at,
    c.updated_at
  FROM companies c
  WHERE c.id = _company_id;
END;
$$;

-- 3. PROFILES: Ensure profiles are restricted to same-company access
-- The existing policies look correct, but let's verify there's no public access
-- Add explicit denial for users without a company trying to view other profiles

-- Drop and recreate the main SELECT policy to be more explicit
DROP POLICY IF EXISTS "Users can view active profiles in same company" ON public.profiles;

CREATE POLICY "Users can view active profiles in same company"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- User must have a company_id set
  get_user_company_id(auth.uid()) IS NOT NULL
  -- Profile must be in the same company
  AND company_id = get_user_company_id(auth.uid())
  -- Profile must not be deleted (unless it's the user's own profile)
  AND (deleted_at IS NULL OR id = auth.uid())
);
