-- Drop existing policies for company-logos bucket
DROP POLICY IF EXISTS "Users can upload to company-logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update in company-logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete from company-logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete company logos" ON storage.objects;

-- Create helper function to check if user is admin in their company
CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- Create helper function to check if two users are in the same company
CREATE OR REPLACE FUNCTION public.users_in_same_company(_user_id1 uuid, _user_id2 uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p1
    JOIN public.profiles p2 ON p1.company_id = p2.company_id
    WHERE p1.id = _user_id1
      AND p2.id = _user_id2
      AND p1.company_id IS NOT NULL
  )
$$;

-- Create new policy: Upload to company-logos bucket
-- Rules:
-- 1. Company logos: only admins can upload to their company folder
-- 2. Avatars: users can upload their own avatar, OR admins can upload for users in same company
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
        -- User uploading their own avatar
        split_part(split_part(name, '/', 2), '-', 1)::uuid = auth.uid()
        OR
        -- Admin uploading for someone in same company
        (
          public.is_company_admin(auth.uid())
          AND public.users_in_same_company(auth.uid(), split_part(split_part(name, '/', 2), '-', 1)::uuid)
        )
      )
    )
  )
);

-- Create new policy: Update in company-logos bucket
CREATE POLICY "Update in company-logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'company-logos'
  AND auth.uid() IS NOT NULL
  AND (
    -- Company logos
    (
      (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
      AND public.is_company_admin(auth.uid())
    )
    OR
    -- Avatars
    (
      (storage.foldername(name))[1] = 'avatars'
      AND (
        split_part(split_part(name, '/', 2), '-', 1)::uuid = auth.uid()
        OR
        (
          public.is_company_admin(auth.uid())
          AND public.users_in_same_company(auth.uid(), split_part(split_part(name, '/', 2), '-', 1)::uuid)
        )
      )
    )
  )
);

-- Create new policy: Delete from company-logos bucket
CREATE POLICY "Delete from company-logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'company-logos'
  AND auth.uid() IS NOT NULL
  AND (
    -- Company logos
    (
      (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
      AND public.is_company_admin(auth.uid())
    )
    OR
    -- Avatars
    (
      (storage.foldername(name))[1] = 'avatars'
      AND (
        split_part(split_part(name, '/', 2), '-', 1)::uuid = auth.uid()
        OR
        (
          public.is_company_admin(auth.uid())
          AND public.users_in_same_company(auth.uid(), split_part(split_part(name, '/', 2), '-', 1)::uuid)
        )
      )
    )
  )
);