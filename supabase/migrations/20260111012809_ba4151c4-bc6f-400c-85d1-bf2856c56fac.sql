-- Add Stripe price ID columns to subscription_plans table
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_id_monthly TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_id_yearly TEXT;

-- Update Starter plan with live Stripe IDs
UPDATE subscription_plans SET 
  stripe_product_id = 'prod_TlRz31R65FRJV4',
  stripe_price_id_monthly = 'price_1Snv5sLZYvL9yzDj7DgbG4nA',
  stripe_price_id_yearly = 'price_1Snv6jLZYvL9yzDjKmN6NzPm'
WHERE name = 'starter';

-- Update Professional plan with live Stripe IDs
UPDATE subscription_plans SET 
  stripe_product_id = 'prod_TlS1ngp4YpWTyO',
  stripe_price_id_monthly = 'price_1Snv7ALZYvL9yzDjYI56o0tA',
  stripe_price_id_yearly = 'price_1Snv7KLZYvL9yzDjmifUM0Au'
WHERE name = 'professional';

-- Update Enterprise plan with live Stripe IDs
UPDATE subscription_plans SET 
  stripe_product_id = 'prod_TlS1kefv19ikbd',
  stripe_price_id_monthly = 'price_1Snv7nLZYvL9yzDjzmwacrwT',
  stripe_price_id_yearly = 'price_1Snv7zLZYvL9yzDjhTJpThB1'
WHERE name = 'enterprise';