-- SECURITY DEFINER function to get document organization ID
-- Used by TUS hook workflow to look up document before org context is established
-- This bypasses RLS since the TUS hook runs as a system operation

CREATE OR REPLACE FUNCTION get_document_organization(p_document_id TEXT)
RETURNS TABLE (
  organization_id TEXT
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT d.organization_id::TEXT
  FROM documents d
  WHERE d.id = p_document_id
    AND d.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant execute to the RLS-enforced app user
GRANT EXECUTE ON FUNCTION get_document_organization(TEXT) TO hestami_app;
