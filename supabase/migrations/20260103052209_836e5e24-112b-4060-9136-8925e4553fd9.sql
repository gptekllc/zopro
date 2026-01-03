-- Migrate existing social media URLs from companies table to company_social_links table
-- Only migrate non-null, non-empty URLs

-- Migrate Facebook URLs
INSERT INTO public.company_social_links (company_id, platform_name, url, icon_url, show_on_invoice, show_on_quote, show_on_job, show_on_email, display_order)
SELECT 
  id,
  'Facebook',
  facebook_url,
  NULL,
  true,
  true,
  true,
  true,
  0
FROM public.companies
WHERE facebook_url IS NOT NULL AND facebook_url != '';

-- Migrate Instagram URLs
INSERT INTO public.company_social_links (company_id, platform_name, url, icon_url, show_on_invoice, show_on_quote, show_on_job, show_on_email, display_order)
SELECT 
  id,
  'Instagram',
  instagram_url,
  NULL,
  true,
  true,
  true,
  true,
  1
FROM public.companies
WHERE instagram_url IS NOT NULL AND instagram_url != '';

-- Migrate LinkedIn URLs
INSERT INTO public.company_social_links (company_id, platform_name, url, icon_url, show_on_invoice, show_on_quote, show_on_job, show_on_email, display_order)
SELECT 
  id,
  'LinkedIn',
  linkedin_url,
  NULL,
  true,
  true,
  true,
  true,
  2
FROM public.companies
WHERE linkedin_url IS NOT NULL AND linkedin_url != '';