-- Allow authenticated users in the same company as the job to view (SELECT) job photo objects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Company members can view job photos'
  ) THEN
    CREATE POLICY "Company members can view job photos"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'job-photos'
      AND EXISTS (
        SELECT 1
        FROM public.jobs j
        JOIN public.profiles p ON p.company_id = j.company_id
        WHERE p.id = auth.uid()
          AND j.id::text = (storage.foldername(name))[2]
      )
    );
  END IF;
END$$;

-- (Optional) allow company admins/managers to delete job photo objects if they have DB access to delete records
-- NOTE: DB currently deletes from public.job_photos; storage object cleanup is not implemented here.
