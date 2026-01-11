-- Update Starter plan
UPDATE subscription_plans 
SET 
  price_monthly = 29,
  price_yearly = 278,
  stripe_product_id = 'prod_TlmLpd953jEW6o',
  stripe_price_id_monthly = 'price_1SoEnDL8wVvTroZcneV96Iow',
  stripe_price_id_yearly = 'price_1SoEnPL8wVvTroZciMfmEoUn',
  updated_at = now()
WHERE id = 'e3349fd9-b365-4f97-aea6-e4a8e8eebcae';

-- Update Professional plan
UPDATE subscription_plans 
SET 
  price_monthly = 69,
  price_yearly = 662,
  stripe_product_id = 'prod_TlmMqV7Y4l8KWS',
  stripe_price_id_monthly = 'price_1SoEnlL8wVvTroZcvDjSxFec',
  stripe_price_id_yearly = 'price_1SoEnsL8wVvTroZcqSYNA2HC',
  updated_at = now()
WHERE id = '93183351-ad00-47aa-b23d-dc13db4c18f1';

-- Update Enterprise plan
UPDATE subscription_plans 
SET 
  price_monthly = 199,
  price_yearly = 1910,
  stripe_product_id = 'prod_TlmM31JJHpzXut',
  stripe_price_id_monthly = 'price_1SoEnwL8wVvTroZcjo3a4psJ',
  stripe_price_id_yearly = 'price_1SoEnxL8wVvTroZc4OmOIOxM',
  updated_at = now()
WHERE id = 'e62491d3-a3f5-4747-95f7-878d1e431b5e';