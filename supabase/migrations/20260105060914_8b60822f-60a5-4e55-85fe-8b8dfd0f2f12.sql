-- Add status column to payments table for tracking refunds/voids
ALTER TABLE public.payments 
ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';

-- Add refund-related columns
ALTER TABLE public.payments
ADD COLUMN refunded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN refunded_by UUID REFERENCES public.profiles(id),
ADD COLUMN refund_reason TEXT;

-- Create index for status filtering
CREATE INDEX idx_payments_status ON public.payments(status);