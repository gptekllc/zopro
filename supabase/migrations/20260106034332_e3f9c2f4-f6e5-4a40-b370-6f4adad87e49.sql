-- Expand allowed invoice statuses to include partial payments and voided

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
ADD CONSTRAINT invoices_status_check
CHECK (
  status = ANY (
    ARRAY[
      'draft'::text,
      'sent'::text,
      'partially_paid'::text,
      'paid'::text,
      'overdue'::text,
      'voided'::text,
      'cancelled'::text
    ]
  )
);