-- Drop existing policies for company-logos bucket
DROP POLICY IF EXISTS "Users can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete company logos" ON storage.objects;

-- Create new policy: Upload to company-logos bucket
-- Allows authenticated users to upload:
-- 1. Company logos in their company folder: {company_id}/logo-*
-- 2. Avatars for profiles in their company: avatars/{profile_id}-*
CREATE POLICY "Users can upload to company-logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'company-logos'
  AND auth.uid() IS NOT NULL
  AND (
    -- Company logos: first folder is user's company_id
    (storage.foldername(name))[1] = (
      SELECT profiles.company_id::text 
      FROM profiles 
      WHERE profiles.id = auth.uid()
    )
    OR
    -- Avatars: path starts with 'avatars/' and target profile is in same company
    (
      (storage.foldername(name))[1] = 'avatars'
      AND EXISTS (
        SELECT 1 FROM profiles target_profile
        JOIN profiles current_user_profile ON target_profile.company_id = current_user_profile.company_id
        WHERE current_user_profile.id = auth.uid()
        AND target_profile.id::text = split_part(split_part(name, '/', 2), '-', 1)
      )
    )
  )
);

-- Create new policy: Update in company-logos bucket
CREATE POLICY "Users can update in company-logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'company-logos'
  AND auth.uid() IS NOT NULL
  AND (
    -- Company logos
    (storage.foldername(name))[1] = (
      SELECT profiles.company_id::text 
      FROM profiles 
      WHERE profiles.id = auth.uid()
    )
    OR
    -- Avatars for profiles in same company
    (
      (storage.foldername(name))[1] = 'avatars'
      AND EXISTS (
        SELECT 1 FROM profiles target_profile
        JOIN profiles current_user_profile ON target_profile.company_id = current_user_profile.company_id
        WHERE current_user_profile.id = auth.uid()
        AND target_profile.id::text = split_part(split_part(name, '/', 2), '-', 1)
      )
    )
  )
);

-- Create new policy: Delete from company-logos bucket
CREATE POLICY "Users can delete from company-logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'company-logos'
  AND auth.uid() IS NOT NULL
  AND (
    -- Company logos
    (storage.foldername(name))[1] = (
      SELECT profiles.company_id::text 
      FROM profiles 
      WHERE profiles.id = auth.uid()
    )
    OR
    -- Avatars for profiles in same company
    (
      (storage.foldername(name))[1] = 'avatars'
      AND EXISTS (
        SELECT 1 FROM profiles target_profile
        JOIN profiles current_user_profile ON target_profile.company_id = current_user_profile.company_id
        WHERE current_user_profile.id = auth.uid()
        AND target_profile.id::text = split_part(split_part(name, '/', 2), '-', 1)
      )
    )
  )
);