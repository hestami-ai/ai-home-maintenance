-- Fix get_staff_profile function to use correct timestamp types
DROP FUNCTION IF EXISTS get_staff_profile(TEXT);

CREATE OR REPLACE FUNCTION get_staff_profile(p_user_id TEXT)
RETURNS TABLE (
  id TEXT,
  user_id TEXT,
  display_name TEXT,
  title TEXT,
  status TEXT,
  activated_at TIMESTAMP(3),
  suspended_at TIMESTAMP(3),
  deactivated_at TIMESTAMP(3),
  suspension_reason TEXT,
  deactivation_reason TEXT,
  roles TEXT[],
  pillar_access TEXT[],
  can_be_assigned_cases BOOLEAN,
  created_at TIMESTAMP(3),
  updated_at TIMESTAMP(3)
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
    ARRAY(SELECT unnest(s.roles)::TEXT),
    ARRAY(SELECT unnest(s.pillar_access)::TEXT),
    s.can_be_assigned_cases,
    s.created_at,
    s.updated_at
  FROM staff s
  WHERE s.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_staff_profile(TEXT) TO hestami_app;
