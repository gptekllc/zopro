-- Add avatar_url column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create storage bucket for customer avatars if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('customer-avatars', 'customer-avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for customer-avatars bucket
CREATE POLICY "Company members can upload customer avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'customer-avatars' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND company_id IS NOT NULL
  )
);

CREATE POLICY "Company members can update their customer avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'customer-avatars'
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND company_id IS NOT NULL
  )
);

CREATE POLICY "Company members can delete their customer avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'customer-avatars'
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND company_id IS NOT NULL
  )
);

CREATE POLICY "Public can view customer avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'customer-avatars');