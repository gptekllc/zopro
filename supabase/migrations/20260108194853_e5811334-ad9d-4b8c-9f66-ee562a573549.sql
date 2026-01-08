-- Create customer notifications table
CREATE TABLE public.customer_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for customer notifications
CREATE POLICY "Users can view notifications for their company"
ON public.customer_notifications
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert notifications for their company"
ON public.customer_notifications
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update notifications for their company"
ON public.customer_notifications
FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete notifications for their company"
ON public.customer_notifications
FOR DELETE
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_customer_notifications_customer_id ON public.customer_notifications(customer_id);
CREATE INDEX idx_customer_notifications_company_id ON public.customer_notifications(company_id);
CREATE INDEX idx_customer_notifications_is_read ON public.customer_notifications(is_read);
CREATE INDEX idx_customer_notifications_created_at ON public.customer_notifications(created_at DESC);