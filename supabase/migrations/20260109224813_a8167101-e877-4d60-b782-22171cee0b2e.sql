-- Fix avatar target user id parsing (UUID contains hyphens)
-- We must extract the first 36 chars after 'avatars/' to get a full UUID.

DROP POLICY IF EXISTS "Upload to company-logos" ON storage.objects;
DROP POLICY IF EXISTS "Update in company-logos" ON storage.objects;
DROP POLICY IF EXISTS "Delete from company-logos" ON storage.objects;

CREATE POLICY "Upload to company-logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'company-logos'
  AND auth.uid() IS NOT NULL
  AND (
    -- Company logos: first folder is user's company_id and user is admin
    (
      (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
      AND public.is_company_admin(auth.uid())
    )
    OR
    -- Avatars: path starts with 'avatars/'
    (
      (storage.foldername(name))[1] = 'avatars'
      AND (
        -- Extract full UUID from the filename
        substring(split_part(name, '/', 2) from 1 for 36)::uuid = auth.uid()
        OR
        (
          public.is_company_admin(auth.uid())
          AND public.users_in_same_company(
            auth.uid(),
            substring(split_part(name, '/', 2) from 1 for 36)::uuid
          )
        )
      )
    )
  )
);

CREATE POLICY "Update in company-logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'company-logos'
  AND auth.uid() IS NOT NULL
  AND (
    (
      (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
      AND public.is_company_admin(auth.uid())
    )
    OR
    (
      (storage.foldername(name))[1] = 'avatars'
      AND (
        substring(split_part(name, '/', 2) from 1 for 36)::uuid = auth.uid()
        OR
        (
          public.is_company_admin(auth.uid())
          AND public.users_in_same_company(
            auth.uid(),
            substring(split_part(name, '/', 2) from 1 for 36)::uuid
          )
        )
      )
    )
  )
);

CREATE POLICY "Delete from company-logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'company-logos'
  AND auth.uid() IS NOT NULL
  AND (
    (
      (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
      AND public.is_company_admin(auth.uid())
    )
    OR
    (
      (storage.foldername(name))[1] = 'avatars'
      AND (
        substring(split_part(name, '/', 2) from 1 for 36)::uuid = auth.uid()
        OR
        (
          public.is_company_admin(auth.uid())
          AND public.users_in_same_company(
            auth.uid(),
            substring(split_part(name, '/', 2) from 1 for 36)::uuid
          )
        )
      )
    )
  )
);
