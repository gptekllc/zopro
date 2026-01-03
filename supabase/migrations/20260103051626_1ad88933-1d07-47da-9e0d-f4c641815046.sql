-- Create company_social_links table for flexible social media management
CREATE TABLE public.company_social_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  platform_name TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_url TEXT,
  show_on_invoice BOOLEAN NOT NULL DEFAULT true,
  show_on_quote BOOLEAN NOT NULL DEFAULT true,
  show_on_job BOOLEAN NOT NULL DEFAULT true,
  show_on_email BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_social_links ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view social links in their company"
  ON public.company_social_links
  FOR SELECT
  USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Admins can insert social links"
  ON public.company_social_links
  FOR INSERT
  WITH CHECK (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can update social links"
  ON public.company_social_links
  FOR UPDATE
  USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can delete social links"
  ON public.company_social_links
  FOR DELETE
  USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Create updated_at trigger
CREATE TRIGGER update_company_social_links_updated_at
  BEFORE UPDATE ON public.company_social_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for social icons
INSERT INTO storage.buckets (id, name, public) VALUES ('social-icons', 'social-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for social icons
CREATE POLICY "Social icons are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'social-icons');

CREATE POLICY "Admins can upload social icons"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'social-icons' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update social icons"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'social-icons' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete social icons"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'social-icons' AND auth.uid() IS NOT NULL);