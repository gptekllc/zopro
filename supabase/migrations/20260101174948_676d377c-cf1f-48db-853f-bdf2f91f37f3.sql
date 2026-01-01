-- Allow authenticated users to delete their own uploaded job photos from storage
CREATE POLICY "Users can delete their own job photos from storage"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'job-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);