-- Set unlimited storage for all subscription plans
UPDATE subscription_plans
SET storage_limit_bytes = NULL,
    updated_at = NOW()
WHERE name IN ('starter', 'professional', 'enterprise');