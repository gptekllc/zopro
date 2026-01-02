-- Add Stripe Connect fields to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS stripe_account_id text,
ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS platform_fee_percentage numeric DEFAULT 0;