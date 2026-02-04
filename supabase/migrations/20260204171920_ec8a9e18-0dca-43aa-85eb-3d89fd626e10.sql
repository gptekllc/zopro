-- Add PayPal Connect columns
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS paypal_merchant_id text,
ADD COLUMN IF NOT EXISTS paypal_onboarding_complete boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS paypal_payments_enabled boolean DEFAULT true;

-- Add Square Connect columns
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS square_merchant_id text,
ADD COLUMN IF NOT EXISTS square_location_id text,
ADD COLUMN IF NOT EXISTS square_onboarding_complete boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS square_payments_enabled boolean DEFAULT true;

COMMENT ON COLUMN public.companies.paypal_merchant_id IS 'PayPal Merchant ID from PayPal Connect';
COMMENT ON COLUMN public.companies.paypal_onboarding_complete IS 'Whether PayPal onboarding is complete';
COMMENT ON COLUMN public.companies.paypal_payments_enabled IS 'Whether PayPal payments are enabled';
COMMENT ON COLUMN public.companies.square_merchant_id IS 'Square Merchant ID from Square OAuth';
COMMENT ON COLUMN public.companies.square_location_id IS 'Square Location ID for payments';
COMMENT ON COLUMN public.companies.square_onboarding_complete IS 'Whether Square onboarding is complete';
COMMENT ON COLUMN public.companies.square_payments_enabled IS 'Whether Square payments are enabled';