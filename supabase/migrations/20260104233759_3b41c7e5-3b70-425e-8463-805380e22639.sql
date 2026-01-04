-- Create quote_photos table
CREATE TABLE public.quote_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_type TEXT NOT NULL DEFAULT 'other' CHECK (photo_type IN ('before', 'after', 'other')),
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoice_photos table
CREATE TABLE public.invoice_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_type TEXT NOT NULL DEFAULT 'other' CHECK (photo_type IN ('before', 'after', 'other')),
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quote_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies for quote_photos
CREATE POLICY "Users can view quote photos from their company" 
ON public.quote_photos 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.profiles p ON p.company_id = q.company_id
    WHERE q.id = quote_photos.quote_id
    AND p.id = auth.uid()
  )
);

CREATE POLICY "Users can insert quote photos for their company" 
ON public.quote_photos 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.profiles p ON p.company_id = q.company_id
    WHERE q.id = quote_photos.quote_id
    AND p.id = auth.uid()
  )
);

CREATE POLICY "Users can update quote photos from their company" 
ON public.quote_photos 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.profiles p ON p.company_id = q.company_id
    WHERE q.id = quote_photos.quote_id
    AND p.id = auth.uid()
  )
);

CREATE POLICY "Users can delete quote photos from their company" 
ON public.quote_photos 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.profiles p ON p.company_id = q.company_id
    WHERE q.id = quote_photos.quote_id
    AND p.id = auth.uid()
  )
);

-- RLS policies for invoice_photos
CREATE POLICY "Users can view invoice photos from their company" 
ON public.invoice_photos 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.profiles p ON p.company_id = i.company_id
    WHERE i.id = invoice_photos.invoice_id
    AND p.id = auth.uid()
  )
);

CREATE POLICY "Users can insert invoice photos for their company" 
ON public.invoice_photos 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.profiles p ON p.company_id = i.company_id
    WHERE i.id = invoice_photos.invoice_id
    AND p.id = auth.uid()
  )
);

CREATE POLICY "Users can update invoice photos from their company" 
ON public.invoice_photos 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.profiles p ON p.company_id = i.company_id
    WHERE i.id = invoice_photos.invoice_id
    AND p.id = auth.uid()
  )
);

CREATE POLICY "Users can delete invoice photos from their company" 
ON public.invoice_photos 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.profiles p ON p.company_id = i.company_id
    WHERE i.id = invoice_photos.invoice_id
    AND p.id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX idx_quote_photos_quote_id ON public.quote_photos(quote_id);
CREATE INDEX idx_invoice_photos_invoice_id ON public.invoice_photos(invoice_id);

-- Create storage buckets for quote and invoice photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('quote-photos', 'quote-photos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoice-photos', 'invoice-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for quote-photos bucket
CREATE POLICY "Users can upload quote photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'quote-photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view quote photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'quote-photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete quote photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'quote-photos' 
  AND auth.role() = 'authenticated'
);

-- Storage policies for invoice-photos bucket
CREATE POLICY "Users can upload invoice photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoice-photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view invoice photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoice-photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete invoice photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'invoice-photos' 
  AND auth.role() = 'authenticated'
);