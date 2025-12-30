-- Fix get_user_memberships function to use correct timestamp types
DROP FUNCTION IF EXISTS get_user_memberships(TEXT);

CREATE OR REPLACE FUNCTION get_user_memberships(p_user_id TEXT)
RETURNS TABLE (
  id TEXT,
  user_id TEXT,
  organization_id TEXT,
  role TEXT,
  is_default BOOLEAN,
  created_at TIMESTAMP(3),
  updated_at TIMESTAMP(3),
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

GRANT EXECUTE ON FUNCTION get_user_memberships(TEXT) TO hestami_app;
