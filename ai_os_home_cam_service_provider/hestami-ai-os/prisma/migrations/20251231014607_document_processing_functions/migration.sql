-- =============================================================================
-- Document Processing Queue Security Definer Functions
-- =============================================================================
-- These functions run with SECURITY DEFINER to bypass RLS for system operations
-- and staff-level monitoring across all organizations.
-- =============================================================================

-- 1. Update document processing status (for DPQ worker/workflow)
CREATE OR REPLACE FUNCTION update_document_processing_status(
  p_document_id TEXT,
  p_status TEXT,
  p_error_type TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_error_details JSONB DEFAULT NULL,
  p_next_retry_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Update the document record
  UPDATE documents
  SET 
    status = p_status::"DocumentStatus",
    processing_error_type = p_error_type,
    processing_error_message = p_error_message,
    processing_error_details = p_error_details,
    processing_next_retry_at = p_next_retry_at,
    processing_attempt_count = CASE 
      WHEN p_status = 'PROCESSING' THEN processing_attempt_count + 1 
      ELSE processing_attempt_count 
    END,
    processing_started_at = CASE 
      WHEN p_status = 'PROCESSING' THEN NOW() 
      ELSE processing_started_at 
    END,
    processing_completed_at = CASE 
      WHEN p_status IN ('ACTIVE', 'INFECTED', 'PROCESSING_FAILED') THEN NOW() 
      ELSE processing_completed_at 
    END,
    updated_at = NOW()
  WHERE id = p_document_id;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION update_document_processing_status(TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO hestami_app;

-- 2. List documents by processing status (for staff/admin monitoring)
CREATE OR REPLACE FUNCTION list_documents_by_processing_status(
  p_status TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id TEXT,
  organization_id TEXT,
  organization_name TEXT,
  title TEXT,
  status TEXT,
  processing_attempt_count INTEGER,
  processing_error_type TEXT,
  processing_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id::TEXT,
    d.organization_id::TEXT,
    o.name::TEXT AS organization_name,
    d.title::TEXT,
    d.status::TEXT,
    d.processing_attempt_count,
    d.processing_error_type,
    d.processing_started_at,
    d.created_at
  FROM documents d
  JOIN organizations o ON o.id = d.organization_id
  WHERE d.status::TEXT = p_status
    AND d.deleted_at IS NULL
  ORDER BY d.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION list_documents_by_processing_status(TEXT, INTEGER, INTEGER) TO hestami_app;

-- 3. Get processing queue stats (for dashboard metrics)
CREATE OR REPLACE FUNCTION get_processing_queue_stats()
RETURNS TABLE (
  status TEXT,
  count BIGINT
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.status::TEXT,
    COUNT(*)::BIGINT
  FROM documents d
  WHERE d.status::TEXT IN ('PENDING_UPLOAD', 'PROCESSING', 'PROCESSING_FAILED')
    AND d.deleted_at IS NULL
  GROUP BY d.status;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_processing_queue_stats() TO hestami_app;