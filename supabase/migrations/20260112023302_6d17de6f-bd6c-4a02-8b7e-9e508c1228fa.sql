-- Drop the existing check constraint
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_template_type_check;

-- Add new check constraint with all allowed template types
ALTER TABLE email_templates ADD CONSTRAINT email_templates_template_type_check 
CHECK (template_type = ANY (ARRAY['invoice'::text, 'reminder'::text, 'quote'::text, 'job'::text, 'general'::text]));