-- Add column to enable/disable online card payments per company
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS stripe_payments_enabled boolean DEFAULT true;