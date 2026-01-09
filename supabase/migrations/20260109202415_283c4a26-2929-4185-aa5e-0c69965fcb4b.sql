-- Create payment_providers table
CREATE TABLE public.payment_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT FALSE,
  is_coming_soon BOOLEAN DEFAULT TRUE,
  webhook_url TEXT,
  docs_url TEXT,
  icon_bg_color TEXT,
  icon_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with initial providers
INSERT INTO public.payment_providers (provider_key, name, description, is_enabled, is_coming_soon, docs_url, icon_bg_color, icon_text) VALUES
  ('stripe', 'Stripe Payments', 'Accept credit cards and bank transfers via Stripe Connect', TRUE, FALSE, 'https://dashboard.stripe.com/webhooks', '#635bff', 'S'),
  ('paypal', 'PayPal Payments', 'Accept payments via PayPal, Venmo, and Pay Later options', FALSE, TRUE, 'https://developer.paypal.com/docs/api/webhooks/v1/', '#003087', 'PP'),
  ('square', 'Square Payments', 'Accept in-person and online payments with Square', FALSE, TRUE, 'https://developer.squareup.com/docs/webhooks/overview', '#000000', '□');

-- Enable RLS
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;

-- Anyone can read payment providers
CREATE POLICY "Anyone can read payment providers"
  ON public.payment_providers FOR SELECT
  USING (true);

-- Super admins can manage payment providers
CREATE POLICY "Super admins can manage payment providers"
  ON public.payment_providers FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_payment_providers_updated_at
  BEFORE UPDATE ON public.payment_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();