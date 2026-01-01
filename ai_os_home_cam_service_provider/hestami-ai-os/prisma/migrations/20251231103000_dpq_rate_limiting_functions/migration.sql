-- =============================================================================
-- DPQ Rate Limiting Security Definer Functions
-- =============================================================================

-- 1. Get count of documents currently processing for an organization
CREATE OR REPLACE FUNCTION get_org_processing_count(p_organization_id TEXT)
RETURNS BIGINT
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::BIGINT
    FROM documents
    WHERE organization_id = p_organization_id::UUID
      AND status = 'PROCESSING'
      AND deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_org_processing_count(TEXT) TO hestami_app;

-- 2. Get global count of documents currently processing
CREATE OR REPLACE FUNCTION get_global_processing_count()
RETURNS BIGINT
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::BIGINT
    FROM documents
    WHERE status = 'PROCESSING'
      AND deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_global_processing_count() TO hestami_app;

-- 3. Get organization queue depth (Pending, Processing, or Failed)
-- This is used to prevent over-uploading per organization.
CREATE OR REPLACE FUNCTION get_org_queue_depth(p_organization_id TEXT)
RETURNS BIGINT
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::BIGINT
    FROM documents
    WHERE organization_id = p_organization_id::UUID
      AND status IN ('PENDING_UPLOAD', 'PROCESSING', 'PROCESSING_FAILED')
      AND deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_org_queue_depth(TEXT) TO hestami_app;
