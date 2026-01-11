-- Add paid_online column to track invoices paid via online payment
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_online BOOLEAN DEFAULT FALSE;