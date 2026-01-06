-- Phase 30: Association-Level Document Isolation RLS Setup

-- 1. Helper to get current association ID
CREATE OR REPLACE FUNCTION current_assoc_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_assoc_id', true), '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Helper to check if user is Hestami staff
CREATE OR REPLACE FUNCTION is_org_staff() RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(current_setting('app.is_org_staff', true) = 'true', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Helper to get current user ID
CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update set_org_context_audited to include association and is_staff
DROP FUNCTION IF EXISTS set_org_context_audited(TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS set_org_context_audited(TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION set_org_context_audited(
  p_user_id TEXT,
  p_org_id TEXT,
  p_assoc_id TEXT DEFAULT NULL,
  p_is_staff BOOLEAN DEFAULT false,
  p_reason TEXT DEFAULT NULL,
  p_item_type TEXT DEFAULT NULL,
  p_item_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_org_id', COALESCE(p_org_id, ''), false);
  PERFORM set_config('app.current_assoc_id', COALESCE(p_assoc_id, ''), false);
  PERFORM set_config('app.current_user_id', COALESCE(p_user_id, ''), false);
  PERFORM set_config('app.is_org_staff', p_is_staff::TEXT, false);
  
  RAISE DEBUG 'RLS context set: user=%, org=%, assoc=%, is_staff=%, reason=%',
    p_user_id, p_org_id, p_assoc_id, p_is_staff, p_reason;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Updated version of clear context
DROP FUNCTION IF EXISTS clear_org_context_audited(TEXT);
CREATE OR REPLACE FUNCTION clear_org_context_audited(p_user_id TEXT) RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_org_id', '', false);
  PERFORM set_config('app.current_assoc_id', '', false);
  PERFORM set_config('app.current_user_id', '', false);
  PERFORM set_config('app.is_org_staff', 'false', false);
  RAISE DEBUG 'RLS context cleared by user=%', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. SECURITY DEFINER to get user's associations within an organization
CREATE OR REPLACE FUNCTION get_user_associations(p_user_id TEXT, p_org_id TEXT)
RETURNS TABLE (
  association_id TEXT,
  association_name TEXT,
  role TEXT
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id::TEXT,
    a.name::TEXT,
    uo.role::TEXT
  FROM associations a
  JOIN user_organizations uo ON uo.organization_id = a.organization_id
  WHERE uo.user_id = p_user_id
    AND a.organization_id = p_org_id
    AND a.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_user_associations(TEXT, TEXT) TO hestami_app;

-- 7. Updated get_document_organization to handle association_id
DROP FUNCTION IF EXISTS get_document_organization(TEXT);
CREATE OR REPLACE FUNCTION get_document_organization(p_document_id TEXT)
RETURNS TABLE (
  organization_id TEXT,
  association_id TEXT
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.organization_id::TEXT,
    d.association_id::TEXT
  FROM documents d
  WHERE d.id = p_document_id
    AND d.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_document_organization(TEXT) TO hestami_app;

-- 8. Helper to check document assignment for Service Providers / Owners
CREATE OR REPLACE FUNCTION check_document_assignment(p_doc_id TEXT, p_user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Placeholder for assignment-based access logic
  -- In a future phase, this will join through DocumentContextBinding
  -- to verify if the user has an active assignment (Work Order / Case)
  -- that grants them visibility to this document.
  RETURN false; 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Update RLS Policies for Documents
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_documents_tiered_isolation ON "documents";
DROP POLICY IF EXISTS rls_documents_select ON "documents";
DROP POLICY IF EXISTS rls_documents_insert ON "documents";
DROP POLICY IF EXISTS rls_documents_update ON "documents";
DROP POLICY IF EXISTS rls_documents_delete ON "documents";

CREATE POLICY rls_documents_tiered_isolation ON "documents"
FOR ALL
USING (
  organization_id = current_org_id() 
  AND (
    is_org_staff() 
    OR association_id = current_assoc_id() 
    OR (association_id IS NULL AND current_assoc_id() IS NULL)
    OR check_document_assignment(id, current_user_id())
  )
);

-- 10. Update RLS Policies for Violations
ALTER TABLE "violations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_violations_select ON "violations";
DROP POLICY IF EXISTS rls_violations_insert ON "violations";
DROP POLICY IF EXISTS rls_violations_update ON "violations";
DROP POLICY IF EXISTS rls_violations_delete ON "violations";

CREATE POLICY rls_violations_tiered_isolation ON "violations"
FOR ALL
USING (
  organization_id = current_org_id()
  AND (
    is_org_staff()
    OR association_id = current_assoc_id()
  )
);

-- 11. Update RLS Policies for ARC Requests
ALTER TABLE "arc_requests" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_arc_requests_select ON "arc_requests";
DROP POLICY IF EXISTS rls_arc_requests_insert ON "arc_requests";
DROP POLICY IF EXISTS rls_arc_requests_update ON "arc_requests";
DROP POLICY IF EXISTS rls_arc_requests_delete ON "arc_requests";

CREATE POLICY rls_arc_requests_tiered_isolation ON "arc_requests"
FOR ALL
USING (
  organization_id = current_org_id()
  AND (
    is_org_staff()
    OR association_id = current_assoc_id()
  )
);

-- 12. Update RLS Policies for Activity Events
ALTER TABLE "activity_events" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_activity_events_select ON "activity_events";

CREATE POLICY rls_activity_events_tiered_isolation ON "activity_events"
FOR SELECT
USING (
  organization_id = current_org_id()
  AND (
    is_org_staff()
    OR association_id = current_assoc_id()
  )
);
