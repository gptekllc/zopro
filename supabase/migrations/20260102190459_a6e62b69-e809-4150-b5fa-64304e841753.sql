-- Add assigned_to column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN assigned_to uuid REFERENCES public.profiles(id);

-- Create index for better query performance
CREATE INDEX idx_invoices_assigned_to ON public.invoices(assigned_to);