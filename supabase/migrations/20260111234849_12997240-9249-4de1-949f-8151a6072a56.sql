-- Create software_versions table for version management
CREATE TABLE IF NOT EXISTS public.software_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL UNIQUE,
  release_date TIMESTAMPTZ DEFAULT NOW(),
  title VARCHAR(100),
  features TEXT[] DEFAULT '{}',
  bug_fixes TEXT[] DEFAULT '{}',
  notes TEXT,
  is_current BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.software_versions ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins can manage software versions"
ON public.software_versions
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- All authenticated users can read current version
CREATE POLICY "Authenticated users can view versions"
ON public.software_versions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Insert initial version
INSERT INTO public.software_versions (version, title, features, bug_fixes, is_current)
VALUES ('1.0.0', 'Initial Release', 
  ARRAY['Separate first and last name fields for customers and technicians', 'Time clock management system', 'Software version tracking', 'Customer portal', 'Job, Quote, and Invoice management'],
  ARRAY['Fixed time clock UI update issue', 'Improved query performance'],
  true
);

-- Cleanup: Close all but the most recent open time entry for each user
WITH ranked_entries AS (
  SELECT id, user_id, clock_in,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY clock_in DESC) as rn
  FROM public.time_entries
  WHERE clock_out IS NULL
)
UPDATE public.time_entries
SET clock_out = NOW(), updated_at = NOW()
WHERE id IN (
  SELECT id FROM ranked_entries WHERE rn > 1
);

-- Create trigger for updated_at on software_versions
CREATE TRIGGER update_software_versions_updated_at
BEFORE UPDATE ON public.software_versions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();