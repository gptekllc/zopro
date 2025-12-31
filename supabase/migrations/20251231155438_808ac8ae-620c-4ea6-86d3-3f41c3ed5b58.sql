-- Create job status enum
CREATE TYPE public.job_status AS ENUM ('draft', 'scheduled', 'in_progress', 'completed', 'invoiced', 'paid');

-- Create job priority enum
CREATE TYPE public.job_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create jobs table
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text NOT NULL UNIQUE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status job_status NOT NULL DEFAULT 'draft',
  priority job_priority NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  description text,
  scheduled_start timestamp with time zone,
  scheduled_end timestamp with time zone,
  actual_start timestamp with time zone,
  actual_end timestamp with time zone,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create job_photos table for before/after photos
CREATE TABLE public.job_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  photo_type text NOT NULL CHECK (photo_type IN ('before', 'after', 'other')),
  caption text,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create storage bucket for job photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on jobs table
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on job_photos table
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

-- Jobs RLS policies
CREATE POLICY "Users can view jobs in their company"
ON public.jobs FOR SELECT
USING (company_id IN (
  SELECT company_id FROM profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can insert jobs in their company"
ON public.jobs FOR INSERT
WITH CHECK (company_id IN (
  SELECT company_id FROM profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can update jobs in their company"
ON public.jobs FOR UPDATE
USING (company_id IN (
  SELECT company_id FROM profiles WHERE id = auth.uid()
));

CREATE POLICY "Admins can delete jobs"
ON public.jobs FOR DELETE
USING (company_id IN (
  SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'
));

-- Job photos RLS policies
CREATE POLICY "Users can view job photos in their company"
ON public.job_photos FOR SELECT
USING (job_id IN (
  SELECT id FROM jobs WHERE company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
));

CREATE POLICY "Users can insert job photos"
ON public.job_photos FOR INSERT
WITH CHECK (job_id IN (
  SELECT id FROM jobs WHERE company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
));

CREATE POLICY "Users can delete their own photos"
ON public.job_photos FOR DELETE
USING (uploaded_by = auth.uid());

-- Storage policies for job-photos bucket
CREATE POLICY "Users can view job photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'job-photos');

CREATE POLICY "Authenticated users can upload job photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'job-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own job photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'job-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own job photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'job-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create trigger for updated_at
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate job number
CREATE OR REPLACE FUNCTION public.generate_job_number(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year text;
  next_number integer;
BEGIN
  current_year := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(job_number FROM 'J-' || current_year || '-(\d+)') AS integer)
  ), 0) + 1
  INTO next_number
  FROM public.jobs
  WHERE company_id = _company_id
    AND job_number LIKE 'J-' || current_year || '-%';
  
  RETURN 'J-' || current_year || '-' || LPAD(next_number::text, 3, '0');
END;
$$;