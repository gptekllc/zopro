-- Create job_templates table
CREATE TABLE public.job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority job_priority NOT NULL DEFAULT 'medium',
  estimated_duration INTEGER DEFAULT 60,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create job_template_items table
CREATE TABLE public.job_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.job_templates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_template_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for job_templates
CREATE POLICY "Users can view templates in their company"
ON public.job_templates FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert templates in their company"
ON public.job_templates FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update templates in their company"
ON public.job_templates FOR UPDATE
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can delete templates"
ON public.job_templates FOR DELETE
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- RLS policies for job_template_items
CREATE POLICY "Users can view template items"
ON public.job_template_items FOR SELECT
USING (template_id IN (SELECT id FROM job_templates WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert template items"
ON public.job_template_items FOR INSERT
WITH CHECK (template_id IN (SELECT id FROM job_templates WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update template items"
ON public.job_template_items FOR UPDATE
USING (template_id IN (SELECT id FROM job_templates WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete template items"
ON public.job_template_items FOR DELETE
USING (template_id IN (SELECT id FROM job_templates WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

-- Add trigger for updated_at
CREATE TRIGGER update_job_templates_updated_at
BEFORE UPDATE ON public.job_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();