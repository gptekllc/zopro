-- Add max_storage_gb column to subscription_plans table
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS max_storage_gb integer DEFAULT NULL;

-- Set default storage limits for existing plans
UPDATE public.subscription_plans SET max_storage_gb = 1 WHERE name = 'free';
UPDATE public.subscription_plans SET max_storage_gb = 5 WHERE name = 'starter';
UPDATE public.subscription_plans SET max_storage_gb = 25 WHERE name = 'professional';
UPDATE public.subscription_plans SET max_storage_gb = NULL WHERE name = 'enterprise';