-- =============================================================================
-- Staff Concierge Cases List Function (Pattern C: Staff Listing Across All Orgs)
-- =============================================================================
-- This SECURITY DEFINER function allows staff with cross-org access to list 
-- concierge cases across all organizations without being restricted by RLS.
--
-- Per Phase 21 RLS Enforcement Requirements:
-- - SECURITY DEFINER functions run as the owner (hestami = BYPASSRLS)
-- - This allows the hestami_app user to access cross-org data for staff views
-- =============================================================================

-- Create the function for staff to list cases across all orgs (bypasses RLS)
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
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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
    o.name::TEXT AS organization_name,
    cc.property_id::TEXT,
    p.name::TEXT AS property_name,
    cc.assigned_concierge_user_id::TEXT,
    u.name::TEXT AS assigned_concierge_name,
    cc.created_at,
    cc.updated_at
  FROM concierge_cases cc
  LEFT JOIN organizations o ON o.id = cc.organization_id
  LEFT JOIN individual_properties p ON p.id = cc.property_id
  LEFT JOIN users u ON u.id = cc.assigned_concierge_user_id
  WHERE cc.deleted_at IS NULL
    AND (p_status IS NULL OR cc.status = p_status)
    AND cc.status NOT IN ('CLOSED', 'CANCELLED')
  ORDER BY 
    CASE cc.priority 
      WHEN 'EMERGENCY' THEN 1 
      WHEN 'URGENT' THEN 2 
      WHEN 'HIGH' THEN 3 
      WHEN 'NORMAL' THEN 4 
      WHEN 'LOW' THEN 5 
      ELSE 6 
    END,
    cc.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION get_staff_concierge_cases_list(TEXT, INT) TO hestami_app;

-- Add comment for documentation
COMMENT ON FUNCTION get_staff_concierge_cases_list(TEXT, INT) IS 
  'SECURITY DEFINER function that bypasses RLS to return concierge cases for staff listing (Pattern C)';
