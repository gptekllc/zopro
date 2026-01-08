-- Add MFA requirement setting to companies table
ALTER TABLE companies 
ADD COLUMN require_mfa boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN companies.require_mfa IS 'When true, all team members must enable MFA to access the app';