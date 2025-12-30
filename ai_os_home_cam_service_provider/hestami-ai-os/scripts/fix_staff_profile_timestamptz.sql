-- Fix get_staff_profile function to cast enum arrays to TEXT[]
DROP FUNCTION IF EXISTS get_staff_profile(TEXT);

CREATE OR REPLACE FUNCTION get_staff_profile(p_user_id TEXT)
RETURNS TABLE (
  id TEXT,
  user_id TEXT,
  status TEXT,
  roles TEXT[],
  pillar_access TEXT[],
  activated_at TIMESTAMPTZ(3),
  suspended_at TIMESTAMPTZ(3),
  deactivated_at TIMESTAMPTZ(3),
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
    s.status::TEXT,
    ARRAY(SELECT unnest(s.roles)::TEXT)::TEXT[],
    ARRAY(SELECT unnest(s.pillar_access)::TEXT)::TEXT[],
    s.activated_at,
    s.suspended_at,
    s.deactivated_at,
    s.created_at,
    s.updated_at
  FROM staff s
  WHERE s.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_staff_profile(TEXT) TO hestami_app;
