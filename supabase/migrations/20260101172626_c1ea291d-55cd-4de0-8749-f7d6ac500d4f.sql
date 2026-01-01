-- Add display_order column to job_photos for drag-and-drop reordering
ALTER TABLE job_photos ADD COLUMN display_order INTEGER DEFAULT 0;

-- Update existing photos with sequential order based on created_at
WITH ordered_photos AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY created_at) - 1 as new_order
  FROM job_photos
)
UPDATE job_photos
SET display_order = ordered_photos.new_order
FROM ordered_photos
WHERE job_photos.id = ordered_photos.id;

-- Allow users to update job photos (needed for reordering)
CREATE POLICY "Users can update job photos in their company" 
ON job_photos 
FOR UPDATE 
USING (job_id IN (
  SELECT jobs.id FROM jobs
  WHERE jobs.company_id IN (
    SELECT profiles.company_id FROM profiles
    WHERE profiles.id = auth.uid()
  )
));