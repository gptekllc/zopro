-- Make job-photos bucket private (security fix)
UPDATE storage.buckets 
SET public = false 
WHERE id = 'job-photos';

-- Add RLS policy for authenticated users to view job photos from their company
CREATE POLICY "Company users can view job photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'job-photos' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.profiles p ON p.company_id = j.company_id
    WHERE p.id = auth.uid()
    AND j.id = (
      CASE 
        WHEN array_length(string_to_array(name, '/'), 1) >= 2 
        THEN (string_to_array(name, '/'))[2]::uuid
        ELSE NULL
      END
    )
  )
);