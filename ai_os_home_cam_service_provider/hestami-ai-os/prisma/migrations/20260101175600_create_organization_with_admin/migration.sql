-- Create a SECURITY DEFINER function that bypasses RLS to create an organization
-- with its initial admin membership atomically.
-- 
-- This is needed because:
-- 1. The user_organizations table has RLS requiring organization_id = current_org_id()
-- 2. During org creation, no org context exists yet (chicken-and-egg problem)
-- 3. SECURITY DEFINER runs as the function owner (hestami), bypassing RLS

CREATE OR REPLACE FUNCTION create_organization_with_admin(
    p_name TEXT,
    p_slug TEXT,
    p_type TEXT,
    p_user_id TEXT
) RETURNS TABLE (
    id TEXT,
    name TEXT,
    slug TEXT,
    type TEXT,
    status TEXT,
    created_at TIMESTAMPTZ(3),
    updated_at TIMESTAMPTZ(3)
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id TEXT;
    v_membership_id TEXT;
    v_now TIMESTAMPTZ(3);
BEGIN
    -- Generate IDs (using gen_random_uuid for compatibility)
    v_org_id := gen_random_uuid()::text;
    v_membership_id := gen_random_uuid()::text;
    v_now := NOW();
    
    -- Create the organization
    INSERT INTO organizations (id, name, slug, type, status, settings, created_at, updated_at)
    VALUES (
        v_org_id, 
        p_name, 
        p_slug, 
        p_type::"OrganizationType", 
        'ACTIVE'::"OrganizationStatus",
        '{}'::jsonb,
        v_now, 
        v_now
    );
    
    -- Create the admin membership (bypasses RLS since SECURITY DEFINER)
    INSERT INTO user_organizations (id, user_id, organization_id, role, is_default, created_at, updated_at)
    VALUES (
        v_membership_id, 
        p_user_id, 
        v_org_id, 
        'ADMIN', 
        true, 
        v_now, 
        v_now
    );
    
    -- Return the new organization
    RETURN QUERY
    SELECT 
        o.id::TEXT,
        o.name::TEXT,
        o.slug::TEXT,
        o.type::TEXT,
        o.status::TEXT,
        o.created_at,
        o.updated_at
    FROM organizations o
    WHERE o.id = v_org_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute to the RLS-enforced app user
GRANT EXECUTE ON FUNCTION create_organization_with_admin(TEXT, TEXT, TEXT, TEXT) TO hestami_app;

COMMENT ON FUNCTION create_organization_with_admin IS 
    'Creates a new organization with the specified user as ADMIN. Uses SECURITY DEFINER to bypass RLS during the initial membership creation.';
