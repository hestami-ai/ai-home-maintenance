-- =============================================================================
-- Fix Organization Admin Functions
-- =============================================================================
-- The individual_properties table does not have a deleted_at column.
-- Update the functions to use is_active instead.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fix get_all_organizations_for_staff
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_all_organizations_for_staff(
  p_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_cursor TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  slug TEXT,
  type TEXT,
  status TEXT,
  external_contact_name TEXT,
  external_contact_email TEXT,
  external_contact_phone TEXT,
  member_count BIGINT,
  active_case_count BIGINT,
  property_count BIGINT,
  created_at TIMESTAMPTZ(3),
  updated_at TIMESTAMPTZ(3)
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id::TEXT,
    o.name::TEXT,
    o.slug::TEXT,
    o.type::TEXT,
    o.status::TEXT,
    o.external_contact_name::TEXT,
    o.external_contact_email::TEXT,
    o.external_contact_phone::TEXT,
    (SELECT COUNT(*) FROM user_organizations uo WHERE uo.organization_id = o.id)::BIGINT AS member_count,
    (SELECT COUNT(*) FROM concierge_cases cc WHERE cc.organization_id = o.id AND cc.status NOT IN ('CLOSED', 'CANCELLED') AND cc.deleted_at IS NULL)::BIGINT AS active_case_count,
    (SELECT COUNT(*) FROM individual_properties ip WHERE ip.owner_org_id = o.id AND ip.is_active = true)::BIGINT AS property_count,
    o.created_at,
    o.updated_at
  FROM organizations o
  WHERE o.deleted_at IS NULL
    AND (p_type IS NULL OR o.type::TEXT = p_type)
    AND (p_status IS NULL OR o.status::TEXT = p_status)
    AND (p_search IS NULL OR o.name ILIKE '%' || p_search || '%' OR o.slug ILIKE '%' || p_search || '%' OR o.external_contact_email ILIKE '%' || p_search || '%')
    AND (p_cursor IS NULL OR o.created_at < (SELECT o2.created_at FROM organizations o2 WHERE o2.id = p_cursor) OR (o.created_at = (SELECT o2.created_at FROM organizations o2 WHERE o2.id = p_cursor) AND o.id < p_cursor))
  ORDER BY o.created_at DESC, o.id DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 2. Fix get_organization_details_for_staff
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_organization_details_for_staff(p_org_id TEXT)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  slug TEXT,
  type TEXT,
  status TEXT,
  settings JSONB,
  external_contact_name TEXT,
  external_contact_email TEXT,
  external_contact_phone TEXT,
  created_at TIMESTAMPTZ(3),
  updated_at TIMESTAMPTZ(3),
  -- Aggregated stats
  member_count BIGINT,
  active_case_count BIGINT,
  total_case_count BIGINT,
  property_count BIGINT,
  association_count BIGINT,
  work_order_count BIGINT,
  -- Type-specific (SERVICE_PROVIDER)
  contractor_profile_id TEXT,
  contractor_legal_name TEXT,
  contractor_is_active BOOLEAN
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id::TEXT,
    o.name::TEXT,
    o.slug::TEXT,
    o.type::TEXT,
    o.status::TEXT,
    o.settings,
    o.external_contact_name::TEXT,
    o.external_contact_email::TEXT,
    o.external_contact_phone::TEXT,
    o.created_at,
    o.updated_at,
    -- Stats
    (SELECT COUNT(*) FROM user_organizations uo WHERE uo.organization_id = o.id)::BIGINT,
    (SELECT COUNT(*) FROM concierge_cases cc WHERE cc.organization_id = o.id AND cc.status NOT IN ('CLOSED', 'CANCELLED') AND cc.deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM concierge_cases cc WHERE cc.organization_id = o.id AND cc.deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM individual_properties ip WHERE ip.owner_org_id = o.id AND ip.is_active = true)::BIGINT,
    (SELECT COUNT(*) FROM associations a WHERE a.organization_id = o.id AND a.deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM work_orders wo WHERE wo.organization_id = o.id)::BIGINT,
    -- Contractor-specific
    cp.id::TEXT,
    cp.legal_name::TEXT,
    cp.is_active
  FROM organizations o
  LEFT JOIN contractor_profiles cp ON cp.organization_id = o.id
  WHERE o.id = p_org_id AND o.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;
