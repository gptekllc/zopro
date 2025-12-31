-- Fix join_requests uniqueness constraint to prevent approval conflicts
-- The existing unique constraint on (user_id, company_id, status) prevents multiple historical requests
-- from being approved (e.g., approving a second request creates a second 'approved' row).
-- We replace it with a partial unique index that only enforces a single PENDING request per user/company.

BEGIN;

-- Drop the existing unique constraint if it exists
ALTER TABLE public.join_requests
  DROP CONSTRAINT IF EXISTS join_requests_user_id_company_id_status_key;

-- Ensure no duplicate pending rows exist before creating the unique partial index
-- (Keep the most recent pending request; mark older ones as 'rejected')
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id, company_id ORDER BY requested_at DESC) AS rn
  FROM public.join_requests
  WHERE status = 'pending'
)
UPDATE public.join_requests jr
SET status = 'rejected',
    responded_at = COALESCE(jr.responded_at, now()),
    notes = COALESCE(jr.notes, '') || CASE WHEN COALESCE(jr.notes, '') = '' THEN '' ELSE E'\n' END || 'Auto-rejected duplicate pending request.'
FROM ranked r
WHERE jr.id = r.id
  AND r.rn > 1;

-- Create partial unique index: only one pending request per user/company
CREATE UNIQUE INDEX IF NOT EXISTS join_requests_unique_pending_per_company
  ON public.join_requests (user_id, company_id)
  WHERE status = 'pending';

COMMIT;