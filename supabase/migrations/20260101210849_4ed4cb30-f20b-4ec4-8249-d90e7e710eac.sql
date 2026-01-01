-- Add late fee tracking columns to invoices table
ALTER TABLE public.invoices
ADD COLUMN late_fee_amount NUMERIC DEFAULT 0,
ADD COLUMN late_fee_applied_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comments for clarity
COMMENT ON COLUMN public.invoices.late_fee_amount IS 'Late fee amount applied to overdue invoices';
COMMENT ON COLUMN public.invoices.late_fee_applied_at IS 'Timestamp when late fee was applied';