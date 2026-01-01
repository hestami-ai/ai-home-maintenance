-- =============================================================================
-- Fix DPQ Rate Limiting Functions - Remove incorrect UUID cast
-- Organization IDs are CUIDs (TEXT), not UUIDs
-- =============================================================================

-- 1. Fix get_org_processing_count - remove ::UUID cast
CREATE OR REPLACE FUNCTION get_org_processing_count(p_organization_id TEXT)
RETURNS BIGINT
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::BIGINT
    FROM documents
    WHERE organization_id = p_organization_id
      AND status = 'PROCESSING'
      AND deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql;

-- 2. Fix get_org_queue_depth - remove ::UUID cast
CREATE OR REPLACE FUNCTION get_org_queue_depth(p_organization_id TEXT)
RETURNS BIGINT
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::BIGINT
    FROM documents
    WHERE organization_id = p_organization_id
      AND status IN ('PENDING_UPLOAD', 'PROCESSING', 'PROCESSING_FAILED')
      AND deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql;
