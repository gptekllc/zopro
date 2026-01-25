-- Add thumbnail_url column to job_photos
ALTER TABLE job_photos ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add thumbnail_url column to quote_photos  
ALTER TABLE quote_photos ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add thumbnail_url column to invoice_photos
ALTER TABLE invoice_photos ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;