-- Fix get_staff_concierge_cases_list function to use TIMESTAMPTZ(3)
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
  created_at TIMESTAMPTZ(3),
  updated_at TIMESTAMPTZ(3)
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

GRANT EXECUTE ON FUNCTION get_staff_concierge_cases_list(TEXT, INT) TO hestami_app;
