-- Fix the overly permissive RLS policy on sms_logs
-- Drop the permissive policy and replace with a proper one
DROP POLICY IF EXISTS "Service role can insert SMS logs" ON public.sms_logs;

-- Allow inserts only for users in the same company (edge function uses service role which bypasses RLS anyway)
CREATE POLICY "Users can insert own company SMS logs" 
ON public.sms_logs FOR INSERT 
WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));