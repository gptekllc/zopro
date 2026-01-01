-- Add billing settings columns to companies table
ALTER TABLE public.companies
ADD COLUMN payment_terms_days INTEGER DEFAULT 30,
ADD COLUMN late_fee_percentage NUMERIC DEFAULT 0,
ADD COLUMN default_payment_method TEXT DEFAULT 'any';

-- Add comments for clarity
COMMENT ON COLUMN public.companies.payment_terms_days IS 'Default payment terms in days (e.g., Net 30)';
COMMENT ON COLUMN public.companies.late_fee_percentage IS 'Late fee percentage applied to overdue invoices';
COMMENT ON COLUMN public.companies.default_payment_method IS 'Default payment method (any, cash, check, card, bank_transfer)';