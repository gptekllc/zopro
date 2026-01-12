-- Media Assets - Central table for all uploaded media files
-- This prevents file duplication when converting between jobs, quotes, and invoices
CREATE TABLE public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL, -- 'job-photos', 'quote-photos', 'invoice-photos'
  storage_path TEXT NOT NULL,   -- The actual file path in storage
  original_filename TEXT,
  file_size_bytes BIGINT,
  content_type TEXT DEFAULT 'image/jpeg',
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(storage_bucket, storage_path)
);

-- Linking table that associates media assets to jobs, quotes, or invoices
CREATE TABLE public.document_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'quote', 'invoice')),
  entity_id UUID NOT NULL,
  photo_type TEXT DEFAULT 'other' CHECK (photo_type IN ('before', 'after', 'other')),
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(media_asset_id, entity_type, entity_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_document_media_entity ON document_media(entity_type, entity_id);
CREATE INDEX idx_document_media_asset ON document_media(media_asset_id);
CREATE INDEX idx_media_assets_company ON media_assets(company_id);
CREATE INDEX idx_media_assets_bucket_path ON media_assets(storage_bucket, storage_path);

-- Enable RLS
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies for media_assets
CREATE POLICY "Users can view media assets for their company" ON public.media_assets
FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert media assets for their company" ON public.media_assets
FOR INSERT WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update media assets for their company" ON public.media_assets
FOR UPDATE USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete media assets for their company" ON public.media_assets
FOR DELETE USING (company_id = public.get_user_company_id(auth.uid()));

-- RLS Policies for document_media
-- Users can view document_media if they can view the linked entity
CREATE POLICY "Users can view document_media for their company entities" ON public.document_media
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM media_assets ma 
    WHERE ma.id = media_asset_id 
    AND ma.company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Users can insert document_media for their company entities" ON public.document_media
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM media_assets ma 
    WHERE ma.id = media_asset_id 
    AND ma.company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Users can update document_media for their company entities" ON public.document_media
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM media_assets ma 
    WHERE ma.id = media_asset_id 
    AND ma.company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Users can delete document_media for their company entities" ON public.document_media
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM media_assets ma 
    WHERE ma.id = media_asset_id 
    AND ma.company_id = public.get_user_company_id(auth.uid())
  )
);

-- Helper function to copy media links from one document to another
CREATE OR REPLACE FUNCTION public.copy_document_media_links(
  p_source_entity_type TEXT,
  p_source_entity_id UUID,
  p_target_entity_type TEXT,
  p_target_entity_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_copied_count INTEGER := 0;
BEGIN
  -- Copy document_media links from source to target
  INSERT INTO document_media (media_asset_id, entity_type, entity_id, photo_type, caption, display_order)
  SELECT media_asset_id, p_target_entity_type, p_target_entity_id, photo_type, caption, display_order
  FROM document_media
  WHERE entity_type = p_source_entity_type AND entity_id = p_source_entity_id
  ON CONFLICT (media_asset_id, entity_type, entity_id) DO NOTHING;
  
  GET DIAGNOSTICS v_copied_count = ROW_COUNT;
  RETURN v_copied_count;
END;
$$;