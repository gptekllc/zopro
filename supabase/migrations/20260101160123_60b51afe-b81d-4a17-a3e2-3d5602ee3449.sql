-- Add job_id to quotes table for tracking child quotes created from jobs
ALTER TABLE quotes ADD COLUMN job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX idx_quotes_job_id ON quotes(job_id);