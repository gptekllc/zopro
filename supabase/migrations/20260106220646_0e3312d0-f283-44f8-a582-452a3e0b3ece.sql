-- Create signature_history table to track signature events
CREATE TABLE public.signature_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signature_id UUID REFERENCES public.signatures(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  document_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('signed', 'cleared')),
  signer_name TEXT,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signature_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view signature history for their company"
ON public.signature_history
FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert signature history for their company"
ON public.signature_history
FOR INSERT
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_signature_history_document ON public.signature_history(document_type, document_id);
CREATE INDEX idx_signature_history_company ON public.signature_history(company_id);