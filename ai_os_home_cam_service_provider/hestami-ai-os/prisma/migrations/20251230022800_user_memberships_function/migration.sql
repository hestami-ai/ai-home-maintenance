-- =============================================================================
-- User Memberships SECURITY DEFINER Function
-- =============================================================================
-- This function allows hestami_app (RLS-enforced user) to query a user's
-- organization memberships by running with the privileges of the function owner.
--
-- SECURITY DEFINER means the function runs as the owner, not the caller.
-- Since hestami has BYPASSRLS, this function bypasses RLS policies.
--
-- This is needed because:
-- 1. user_organizations table has RLS requiring organization_id = current_org_id()
-- 2. But we need to fetch memberships BEFORE we know which org the user belongs to
-- 3. This is a chicken-and-egg problem that SECURITY DEFINER solves
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Get User Organization Memberships
-- Returns all organization memberships for a given user ID
-- Used for bootstrapping user context in the root layout
-- Note: Uses TIMESTAMP(3) to match Prisma's default timestamp precision
-- -----------------------------------------------------------------------------
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

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION get_user_memberships(TEXT) TO hestami_app;

-- -----------------------------------------------------------------------------
-- Get Staff Profile
-- Returns staff profile for a given user ID
-- Used for bootstrapping user context in the root layout
-- Note: Uses TIMESTAMP(3) to match Prisma's default timestamp precision
-- -----------------------------------------------------------------------------
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

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION get_staff_profile(TEXT) TO hestami_app;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON FUNCTION get_user_memberships(TEXT) IS 
  'SECURITY DEFINER function that bypasses RLS to return user organization memberships for context bootstrapping';

COMMENT ON FUNCTION get_staff_profile(TEXT) IS 
  'SECURITY DEFINER function that bypasses RLS to return staff profile for context bootstrapping';
