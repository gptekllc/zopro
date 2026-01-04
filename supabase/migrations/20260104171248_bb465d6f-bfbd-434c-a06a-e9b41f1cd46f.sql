-- Add email template fields to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS email_job_body TEXT DEFAULT 'Please find your job summary attached. We appreciate your business and look forward to serving you.',
ADD COLUMN IF NOT EXISTS email_quote_body TEXT DEFAULT 'Please find your quote attached. We appreciate the opportunity to serve you. This quote is valid for the period indicated.',
ADD COLUMN IF NOT EXISTS email_invoice_body TEXT DEFAULT 'Please find your invoice attached. We appreciate your business. Payment is due by the date indicated on the invoice.';