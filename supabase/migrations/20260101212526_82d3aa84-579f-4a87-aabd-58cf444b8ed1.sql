-- Feature 1: Team Member Employment Status
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS employment_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS hire_date date,
ADD COLUMN IF NOT EXISTS termination_date date;

-- Add check constraint for employment_status values
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_employment_status_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_employment_status_check 
    CHECK (employment_status IN ('active', 'on_leave', 'terminated'));
  END IF;
END $$;

-- Feature 2: Customer Stripe Accounts for saved payment methods
CREATE TABLE IF NOT EXISTS public.customer_stripe_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  has_saved_payment_method boolean DEFAULT false,
  default_payment_method_last4 text,
  default_payment_method_type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, company_id)
);

-- Enable RLS
ALTER TABLE public.customer_stripe_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_stripe_accounts
CREATE POLICY "Users can view customer stripe accounts in their company"
ON public.customer_stripe_accounts FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert customer stripe accounts"
ON public.customer_stripe_accounts FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update customer stripe accounts"
ON public.customer_stripe_accounts FOR UPDATE
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete customer stripe accounts"
ON public.customer_stripe_accounts FOR DELETE
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Add trigger for updated_at
CREATE OR REPLACE TRIGGER update_customer_stripe_accounts_updated_at
BEFORE UPDATE ON public.customer_stripe_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();