-- Add type column to all line item tables
ALTER TABLE public.job_items ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'service';
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'service';
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'service';
ALTER TABLE public.job_template_items ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'service';
ALTER TABLE public.quote_template_items ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'service';

-- Create catalog_items table for products and services library
CREATE TABLE public.catalog_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'service' CHECK (type IN ('product', 'service')),
  unit_price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view catalog items in their company" 
ON public.catalog_items 
FOR SELECT 
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert catalog items in their company" 
ON public.catalog_items 
FOR INSERT 
WITH CHECK (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update catalog items in their company" 
ON public.catalog_items 
FOR UPDATE 
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Admins can delete catalog items" 
ON public.catalog_items 
FOR DELETE 
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Create index for faster lookups
CREATE INDEX idx_catalog_items_company_id ON public.catalog_items(company_id);
CREATE INDEX idx_catalog_items_type ON public.catalog_items(type);

-- Create trigger for updated_at
CREATE TRIGGER update_catalog_items_updated_at
BEFORE UPDATE ON public.catalog_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();