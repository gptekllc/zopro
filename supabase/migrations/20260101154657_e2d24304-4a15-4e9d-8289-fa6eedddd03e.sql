-- Create job_items table (same structure as quote_items)
CREATE TABLE public.job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add subtotal, tax, total columns to jobs table
ALTER TABLE public.jobs ADD COLUMN subtotal NUMERIC DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN tax NUMERIC DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN total NUMERIC DEFAULT 0;

-- Enable RLS on job_items
ALTER TABLE public.job_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for job_items (same pattern as quote_items)
CREATE POLICY "Users can view job items" ON public.job_items FOR SELECT
  USING (job_id IN (SELECT id FROM public.jobs WHERE company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )));

CREATE POLICY "Users can insert job items" ON public.job_items FOR INSERT
  WITH CHECK (job_id IN (SELECT id FROM public.jobs WHERE company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )));

CREATE POLICY "Users can update job items" ON public.job_items FOR UPDATE
  USING (job_id IN (SELECT id FROM public.jobs WHERE company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )));

CREATE POLICY "Users can delete job items" ON public.job_items FOR DELETE
  USING (job_id IN (SELECT id FROM public.jobs WHERE company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )));