-- Create signatures table to store customer signatures
CREATE TABLE public.signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  
  -- What was signed
  document_type TEXT NOT NULL, -- 'quote', 'invoice', 'job_completion'
  document_id UUID NOT NULL,
  
  -- Signature data
  signature_data TEXT NOT NULL, -- Base64 encoded signature image
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  signer_name TEXT NOT NULL,
  signer_ip TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

-- Policies: Company users can view signatures
CREATE POLICY "Users can view signatures in their company"
ON public.signatures FOR SELECT
USING (company_id IN (
  SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()
));

-- Allow insert via service role (edge functions)
CREATE POLICY "Service role can insert signatures"
ON public.signatures FOR INSERT
WITH CHECK (true);

-- Add signature reference columns to quotes
ALTER TABLE public.quotes 
ADD COLUMN signature_id UUID REFERENCES public.signatures(id),
ADD COLUMN signed_at TIMESTAMP WITH TIME ZONE;

-- Add signature reference columns to invoices
ALTER TABLE public.invoices 
ADD COLUMN signature_id UUID REFERENCES public.signatures(id),
ADD COLUMN signed_at TIMESTAMP WITH TIME ZONE;

-- Add signature reference columns to jobs for completion confirmation
ALTER TABLE public.jobs 
ADD COLUMN completion_signature_id UUID REFERENCES public.signatures(id),
ADD COLUMN completion_signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN completion_signed_by TEXT;

-- Create index for faster lookups
CREATE INDEX idx_signatures_document ON public.signatures(document_type, document_id);
CREATE INDEX idx_signatures_customer ON public.signatures(customer_id);