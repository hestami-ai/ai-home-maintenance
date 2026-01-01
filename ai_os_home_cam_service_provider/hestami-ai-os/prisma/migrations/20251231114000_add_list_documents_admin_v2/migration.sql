-- Enhanced list function for admin Phase 8
DROP FUNCTION IF EXISTS list_documents_admin_v2(TEXT, TEXT, TEXT, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION list_documents_admin_v2(
  p_status TEXT DEFAULT NULL,
  p_view TEXT DEFAULT NULL,
  p_org_id TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id TEXT,
  organization_id TEXT,
  organization_name TEXT,
  title TEXT,
  status TEXT,
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  processing_attempt_count INTEGER,
  processing_error_type TEXT,
  processing_error_message TEXT,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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
    d.file_name::TEXT,
    d.file_size::BIGINT,
    d.mime_type::TEXT,
    d.processing_attempt_count,
    d.processing_error_type,
    d.processing_error_message,
    d.processing_started_at,
    d.processing_completed_at,
    d.processing_next_retry_at,
    d.created_at,
    d.updated_at
  FROM documents d
  JOIN organizations o ON o.id = d.organization_id
  WHERE d.deleted_at IS NULL
    AND (p_org_id IS NULL OR d.organization_id = p_org_id)
    AND (
      CASE 
        WHEN p_view = 'processing' THEN d.status = 'PROCESSING'
        WHEN p_view = 'infected' THEN d.status = 'INFECTED'
        WHEN p_view = 'history' THEN d.status IN ('ACTIVE', 'SUPERSEDED')
        WHEN p_view = 'auto-retry' THEN 
          d.status = 'PROCESSING_FAILED' 
          AND d.processing_error_type = 'TRANSIENT' 
          AND d.processing_attempt_count < 3
        WHEN p_view = 'needs-attention' THEN 
          d.status = 'PROCESSING_FAILED' 
          AND (d.processing_error_type = 'PERMANENT' OR d.processing_attempt_count >= 3)
        ELSE (p_status IS NULL OR d.status::TEXT = p_status)
      END
    )
  ORDER BY d.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION list_documents_admin_v2(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO hestami_app;
