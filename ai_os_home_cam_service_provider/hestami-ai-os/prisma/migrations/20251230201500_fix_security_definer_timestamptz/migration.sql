-- =============================================================================
-- Fix SECURITY DEFINER Functions to use TIMESTAMPTZ(3)
-- =============================================================================
-- After the TIMESTAMPTZ migration (20251230030000), all timestamp columns are
-- now TIMESTAMPTZ(3). The SECURITY DEFINER functions created before that
-- migration still use TIMESTAMP(3) return types, causing type mismatches.
--
-- This migration updates all SECURITY DEFINER functions to use TIMESTAMPTZ(3).
-- PostgreSQL requires DROP FUNCTION before changing return types.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Drop existing functions (required to change return types)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_user_memberships(TEXT);
DROP FUNCTION IF EXISTS get_staff_profile(TEXT);
DROP FUNCTION IF EXISTS get_staff_work_queue_items(TEXT, TEXT, TEXT, INT, INT);

-- -----------------------------------------------------------------------------
-- Get User Organization Memberships (Updated for TIMESTAMPTZ)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_memberships(p_user_id TEXT)
RETURNS TABLE (
  id TEXT,
  user_id TEXT,
  organization_id TEXT,
  role TEXT,
  is_default BOOLEAN,
  created_at TIMESTAMPTZ(3),
  updated_at TIMESTAMPTZ(3),
  org_id TEXT,
  org_name TEXT,
  org_slug TEXT,
  org_type TEXT,
  org_status TEXT
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uo.id::TEXT,
    uo.user_id::TEXT,
    uo.organization_id::TEXT,
    uo.role::TEXT,
    uo.is_default,
    uo.created_at,
    uo.updated_at,
    o.id::TEXT AS org_id,
    o.name::TEXT AS org_name,
    o.slug::TEXT AS org_slug,
    o.type::TEXT AS org_type,
    o.status::TEXT AS org_status
  FROM user_organizations uo
  JOIN organizations o ON o.id = uo.organization_id
  WHERE uo.user_id = p_user_id
    AND o.deleted_at IS NULL
  ORDER BY uo.is_default DESC, uo.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION get_user_memberships(TEXT) TO hestami_app;

-- -----------------------------------------------------------------------------
-- Get Staff Profile (Updated for TIMESTAMPTZ)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_staff_profile(p_user_id TEXT)
RETURNS TABLE (
  id TEXT,
  user_id TEXT,
  display_name TEXT,
  title TEXT,
  status TEXT,
  activated_at TIMESTAMPTZ(3),
  suspended_at TIMESTAMPTZ(3),
  deactivated_at TIMESTAMPTZ(3),
  suspension_reason TEXT,
  deactivation_reason TEXT,
  roles TEXT[],
  pillar_access TEXT[],
  can_be_assigned_cases BOOLEAN,
  created_at TIMESTAMPTZ(3),
  updated_at TIMESTAMPTZ(3)
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id::TEXT,
    s.user_id::TEXT,
    s.display_name::TEXT,
    s.title::TEXT,
    s.status::TEXT,
    s.activated_at,
    s.suspended_at,
    s.deactivated_at,
    s.suspension_reason::TEXT,
    s.deactivation_reason::TEXT,
    ARRAY(SELECT unnest(s.roles)::TEXT)::TEXT[],
    ARRAY(SELECT unnest(s.pillar_access)::TEXT)::TEXT[],
    s.can_be_assigned_cases,
    s.created_at,
    s.updated_at
  FROM staff s
  WHERE s.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION get_staff_profile(TEXT) TO hestami_app;

-- -----------------------------------------------------------------------------
-- Get Staff Work Queue Items (Updated for TIMESTAMPTZ)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_staff_work_queue_items(
  p_staff_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id TEXT,
  case_id TEXT,
  staff_id TEXT,
  status TEXT,
  priority TEXT,
  assigned_at TIMESTAMPTZ(3),
  due_at TIMESTAMPTZ(3),
  started_at TIMESTAMPTZ(3),
  completed_at TIMESTAMPTZ(3),
  notes TEXT,
  created_at TIMESTAMPTZ(3),
  updated_at TIMESTAMPTZ(3),
  case_title TEXT,
  case_status TEXT,
  case_priority TEXT,
  case_type TEXT,
  case_created_at TIMESTAMPTZ(3),
  org_id TEXT,
  org_name TEXT,
  org_slug TEXT,
  staff_display_name TEXT,
  staff_title TEXT
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wqi.id::TEXT,
    wqi.case_id::TEXT,
    wqi.staff_id::TEXT,
    wqi.status::TEXT,
    wqi.priority::TEXT,
    wqi.assigned_at,
    wqi.due_at,
    wqi.started_at,
    wqi.completed_at,
    wqi.notes::TEXT,
    wqi.created_at,
    wqi.updated_at,
    cc.title::TEXT AS case_title,
    cc.status::TEXT AS case_status,
    cc.priority::TEXT AS case_priority,
    cc.case_type::TEXT AS case_type,
    cc.created_at AS case_created_at,
    o.id::TEXT AS org_id,
    o.name::TEXT AS org_name,
    o.slug::TEXT AS org_slug,
    s.display_name::TEXT AS staff_display_name,
    s.title::TEXT AS staff_title
  FROM work_queue_items wqi
  JOIN concierge_cases cc ON cc.id = wqi.case_id
  JOIN organizations o ON o.id = cc.organization_id
  JOIN staff s ON s.id = wqi.staff_id
  WHERE (p_staff_id IS NULL OR wqi.staff_id = p_staff_id)
    AND (p_status IS NULL OR wqi.status::TEXT = p_status)
    AND (p_priority IS NULL OR wqi.priority::TEXT = p_priority)
  ORDER BY 
    CASE wqi.priority 
      WHEN 'URGENT' THEN 1 
      WHEN 'HIGH' THEN 2 
      WHEN 'MEDIUM' THEN 3 
      WHEN 'LOW' THEN 4 
      ELSE 5 
    END,
    wqi.due_at ASC NULLS LAST,
    wqi.created_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION get_staff_work_queue_items(TEXT, TEXT, TEXT, INT, INT) TO hestami_app;

-- -----------------------------------------------------------------------------
-- Update Document Status System (Updated for TIMESTAMPTZ)
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
  v_rows_affected INTEGER;
BEGIN
  UPDATE documents
  SET 
    status = p_status::"DocumentStatus",
    malware_scan_status = COALESCE(p_malware_scan_status, malware_scan_status),
    updated_at = NOW()
  WHERE id = p_document_id;
  
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  
  IF v_rows_affected = 0 THEN
    RAISE EXCEPTION 'Document not found: %', p_document_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION update_document_status_system(TEXT, TEXT, TEXT) TO hestami_app;

-- -----------------------------------------------------------------------------
-- Finalize Document Processing System (Updated for TIMESTAMPTZ)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finalize_document_processing_system(
  p_document_id TEXT,
  p_status TEXT,
  p_storage_path TEXT,
  p_file_url TEXT,
  p_file_name TEXT,
  p_file_size BIGINT,
  p_mime_type TEXT,
  p_checksum TEXT,
  p_malware_scan_status TEXT,
  p_malware_scan_result JSONB,
  p_metadata JSONB
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_affected INTEGER;
BEGIN
  UPDATE documents
  SET 
    status = p_status::"DocumentStatus",
    storage_path = COALESCE(p_storage_path, storage_path),
    file_url = COALESCE(p_file_url, file_url),
    file_name = COALESCE(p_file_name, file_name),
    file_size = COALESCE(p_file_size, file_size),
    mime_type = COALESCE(p_mime_type, mime_type),
    checksum = COALESCE(p_checksum, checksum),
    malware_scan_status = COALESCE(p_malware_scan_status, malware_scan_status),
    malware_scan_result = COALESCE(p_malware_scan_result, malware_scan_result),
    metadata = COALESCE(p_metadata, metadata),
    updated_at = NOW()
  WHERE id = p_document_id;
  
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  
  IF v_rows_affected = 0 THEN
    RAISE EXCEPTION 'Document not found: %', p_document_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION finalize_document_processing_system(TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, JSONB, JSONB) TO hestami_app;
