-- Create table to track invoice payment reminders
CREATE TABLE public.invoice_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_by UUID REFERENCES public.profiles(id),
  recipient_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_reminders ENABLE ROW LEVEL SECURITY;

-- Users can view reminders for invoices in their company
CREATE POLICY "Users can view reminders in their company"
ON public.invoice_reminders
FOR SELECT
USING (company_id IN (
  SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()
));

-- Users can insert reminders for invoices in their company
CREATE POLICY "Users can insert reminders in their company"
ON public.invoice_reminders
FOR INSERT
WITH CHECK (company_id IN (
  SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()
));

-- Create index for faster lookups
CREATE INDEX idx_invoice_reminders_invoice_id ON public.invoice_reminders(invoice_id);
CREATE INDEX idx_invoice_reminders_company_id ON public.invoice_reminders(company_id);