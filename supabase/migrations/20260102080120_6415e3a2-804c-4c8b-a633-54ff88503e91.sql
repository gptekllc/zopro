-- Create quote templates table
CREATE TABLE public.quote_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id),
  name text NOT NULL,
  notes text,
  valid_days integer DEFAULT 30,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create quote template items table
CREATE TABLE public.quote_template_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.quote_templates(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_template_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quote_templates
CREATE POLICY "Users can view templates in their company"
ON public.quote_templates FOR SELECT
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert templates in their company"
ON public.quote_templates FOR INSERT
WITH CHECK (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update templates in their company"
ON public.quote_templates FOR UPDATE
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Admins can delete templates"
ON public.quote_templates FOR DELETE
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- RLS Policies for quote_template_items
CREATE POLICY "Users can view template items"
ON public.quote_template_items FOR SELECT
USING (template_id IN (SELECT quote_templates.id FROM quote_templates WHERE quote_templates.company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())));

CREATE POLICY "Users can insert template items"
ON public.quote_template_items FOR INSERT
WITH CHECK (template_id IN (SELECT quote_templates.id FROM quote_templates WHERE quote_templates.company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())));

CREATE POLICY "Users can update template items"
ON public.quote_template_items FOR UPDATE
USING (template_id IN (SELECT quote_templates.id FROM quote_templates WHERE quote_templates.company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())));

CREATE POLICY "Users can delete template items"
ON public.quote_template_items FOR DELETE
USING (template_id IN (SELECT quote_templates.id FROM quote_templates WHERE quote_templates.company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())));