-- =============================================================================
-- Fix Staff Concierge Cases List Function - Complete Fix
-- =============================================================================
-- Fixes:
-- 1. Enum casts for status comparison
-- 2. Timestamp types (TIMESTAMP instead of TIMESTAMPTZ to match database)
-- =============================================================================

-- Drop and recreate the function with all fixes
DROP FUNCTION IF EXISTS get_staff_concierge_cases_list(TEXT, INT);

CREATE OR REPLACE FUNCTION get_staff_concierge_cases_list(
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id TEXT,
  case_number TEXT,
  title TEXT,
  status TEXT,
  priority TEXT,
  organization_id TEXT,
  organization_name TEXT,
  property_id TEXT,
  property_name TEXT,
  assigned_concierge_user_id TEXT,
  assigned_concierge_name TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.id::TEXT,
    cc.case_number::TEXT,
    cc.title::TEXT,
    cc.status::TEXT,
    cc.priority::TEXT,
    cc.organization_id::TEXT,
    o.name::TEXT,
    cc.property_id::TEXT,
    p.name::TEXT,
    cc.assigned_concierge_user_id::TEXT,
    u.name::TEXT,
    cc.created_at,
    cc.updated_at
  FROM concierge_cases cc
  LEFT JOIN organizations o ON o.id = cc.organization_id
  LEFT JOIN individual_properties p ON p.id = cc.property_id
  LEFT JOIN users u ON u.id = cc.assigned_concierge_user_id
  WHERE cc.deleted_at IS NULL
    AND (p_status IS NULL OR cc.status::TEXT = p_status)
    AND cc.status::TEXT NOT IN ('CLOSED', 'CANCELLED')
  ORDER BY cc.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION get_staff_concierge_cases_list(TEXT, INT) TO hestami_app;

-- Add comment for documentation
COMMENT ON FUNCTION get_staff_concierge_cases_list(TEXT, INT) IS 
  'SECURITY DEFINER function that bypasses RLS to return concierge cases for staff listing (Pattern C)';
