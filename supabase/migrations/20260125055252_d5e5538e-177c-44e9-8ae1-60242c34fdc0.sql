-- Enable Realtime for photo tables
-- This allows clients to subscribe to INSERT, UPDATE, DELETE events

-- Enable realtime for job_photos table
ALTER PUBLICATION supabase_realtime ADD TABLE job_photos;

-- Enable realtime for quote_photos table
ALTER PUBLICATION supabase_realtime ADD TABLE quote_photos;

-- Enable realtime for invoice_photos table
ALTER PUBLICATION supabase_realtime ADD TABLE invoice_photos;