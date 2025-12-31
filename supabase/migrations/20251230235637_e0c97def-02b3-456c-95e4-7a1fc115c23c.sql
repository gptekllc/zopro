-- Update app_role enum to add new roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer';

-- Create company_join_codes table for join codes
CREATE TABLE public.company_join_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id),
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.company_join_codes ENABLE ROW LEVEL SECURITY;

-- RLS for join codes
CREATE POLICY "Admins can manage their company join codes"
  ON public.company_join_codes
  FOR ALL
  USING (company_id IN (
    SELECT profiles.company_id FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Super admins can manage all join codes"
  ON public.company_join_codes
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Anyone can read active join codes by code"
  ON public.company_join_codes
  FOR SELECT
  USING (is_active = true);

-- Create join_requests table
CREATE TABLE public.join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  join_code_id uuid REFERENCES public.company_join_codes(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  responded_by uuid REFERENCES auth.users(id),
  assigned_role text,
  notes text,
  UNIQUE(user_id, company_id, status)
);

ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

-- RLS for join requests
CREATE POLICY "Users can view their own requests"
  ON public.join_requests
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own requests"
  ON public.join_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view requests for their company"
  ON public.join_requests
  FOR SELECT
  USING (company_id IN (
    SELECT profiles.company_id FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Admins can update requests for their company"
  ON public.join_requests
  FOR UPDATE
  USING (company_id IN (
    SELECT profiles.company_id FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Super admins can manage all requests"
  ON public.join_requests
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create notifications table for in-app notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_join_codes_code ON public.company_join_codes(code);
CREATE INDEX idx_join_requests_company ON public.join_requests(company_id);
CREATE INDEX idx_join_requests_user ON public.join_requests(user_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE is_read = false;