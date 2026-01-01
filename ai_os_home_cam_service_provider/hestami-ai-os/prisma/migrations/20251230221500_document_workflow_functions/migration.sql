-- =============================================================================
-- Document Workflow SECURITY DEFINER Functions
-- =============================================================================
-- These functions allow the document workflow (running as system context) to
-- update documents that belong to any organization. This is needed because:
-- 1. TUS hooks run without user/org context (they're system events)
-- 2. The workflow needs to update document status after upload completes
-- 3. RLS would block these updates since there's no org context set
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Update Document Status (for TUS hook workflow)
-- Updates document status and optionally malware scan status
-- Bypasses RLS to allow system-level updates
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_document_status_system(
  p_document_id TEXT,
  p_status TEXT,
  p_malware_scan_status TEXT DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  UPDATE documents
  SET 
    status = p_status::"DocumentStatus",
    malware_scan_status = COALESCE(p_malware_scan_status, malware_scan_status),
    updated_at = NOW()
  WHERE id = p_document_id;
  
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION update_document_status_system(TEXT, TEXT, TEXT) TO hestami_app;

-- -----------------------------------------------------------------------------
-- Finalize Document Processing (for TUS hook workflow)
-- Updates document with processing results from worker
-- Bypasses RLS to allow system-level updates
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finalize_document_processing_system(
  p_document_id TEXT,
  p_status TEXT,
  p_malware_scan_status TEXT,
  p_storage_path TEXT,
  p_file_url TEXT,
  p_thumbnail_url TEXT DEFAULT NULL,
  p_file_name TEXT DEFAULT NULL,
  p_file_size BIGINT DEFAULT NULL,
  p_mime_type TEXT DEFAULT NULL,
  p_checksum TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  UPDATE documents
  SET 
    status = p_status::"DocumentStatus",
    malware_scan_status = p_malware_scan_status,
    storage_path = COALESCE(p_storage_path, storage_path),
    file_url = COALESCE(p_file_url, file_url),
    thumbnail_url = COALESCE(p_thumbnail_url, thumbnail_url),
    file_name = COALESCE(p_file_name, file_name),
    file_size = COALESCE(p_file_size, file_size),
    mime_type = COALESCE(p_mime_type, mime_type),
    checksum = COALESCE(p_checksum, checksum),
    metadata = COALESCE(p_metadata, metadata),
    updated_at = NOW()
  WHERE id = p_document_id;
  
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION finalize_document_processing_system(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, JSONB) TO hestami_app;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON FUNCTION update_document_status_system(TEXT, TEXT, TEXT) IS 
  'SECURITY DEFINER function that bypasses RLS to update document status from system workflows (e.g., TUS hooks)';

COMMENT ON FUNCTION finalize_document_processing_system(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, JSONB) IS 
  'SECURITY DEFINER function that bypasses RLS to finalize document processing from system workflows';
