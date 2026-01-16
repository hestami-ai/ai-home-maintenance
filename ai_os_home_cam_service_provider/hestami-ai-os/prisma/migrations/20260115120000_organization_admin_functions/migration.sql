-- =============================================================================
-- Phase 37: Organization Admin SECURITY DEFINER Functions
-- =============================================================================
-- These functions allow hestami_app (RLS-enforced user) to query cross-org
-- organization data for staff portal by running with the privileges of the
-- function owner (hestami who has BYPASSRLS).
--
-- SECURITY DEFINER means the function runs as the owner, not the caller.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. List All Organizations for Staff
-- Returns all orgs with member count, case count, and property count
-- Supports filtering by type, status, search term with cursor pagination
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
    (SELECT COUNT(*) FROM individual_properties ip WHERE ip.owner_org_id = o.id AND ip.deleted_at IS NULL)::BIGINT AS property_count,
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

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION get_all_organizations_for_staff(TEXT, TEXT, TEXT, INT, TEXT) TO hestami_app;

COMMENT ON FUNCTION get_all_organizations_for_staff(TEXT, TEXT, TEXT, INT, TEXT) IS
  'SECURITY DEFINER function that bypasses RLS to return all organizations for staff portal with optional filtering';

-- -----------------------------------------------------------------------------
-- 2. Get Organization Details for Staff
-- Returns full org details with aggregated stats and type-specific data
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
    (SELECT COUNT(*) FROM individual_properties ip WHERE ip.owner_org_id = o.id AND ip.deleted_at IS NULL)::BIGINT,
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

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION get_organization_details_for_staff(TEXT) TO hestami_app;

COMMENT ON FUNCTION get_organization_details_for_staff(TEXT) IS
  'SECURITY DEFINER function that returns comprehensive organization details for staff portal';

-- -----------------------------------------------------------------------------
-- 3. Get Organization Members for Staff
-- Returns all members of an organization with user details
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_organization_members_for_staff(
  p_org_id TEXT,
  p_limit INT DEFAULT 50,
  p_cursor TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  user_id TEXT,
  user_email TEXT,
  user_name TEXT,
  role TEXT,
  is_default BOOLEAN,
  joined_at TIMESTAMPTZ(3)
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    uo.id::TEXT,
    uo.user_id::TEXT,
    u.email::TEXT,
    u.name::TEXT,
    uo.role::TEXT,
    uo.is_default,
    uo.created_at AS joined_at
  FROM user_organizations uo
  JOIN users u ON u.id = uo.user_id
  WHERE uo.organization_id = p_org_id
    AND (p_cursor IS NULL OR uo.created_at < (SELECT uo2.created_at FROM user_organizations uo2 WHERE uo2.id = p_cursor) OR (uo.created_at = (SELECT uo2.created_at FROM user_organizations uo2 WHERE uo2.id = p_cursor) AND uo.id < p_cursor))
  ORDER BY uo.created_at DESC, uo.id DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION get_organization_members_for_staff(TEXT, INT, TEXT) TO hestami_app;

COMMENT ON FUNCTION get_organization_members_for_staff(TEXT, INT, TEXT) IS
  'SECURITY DEFINER function that returns organization members for staff portal';

-- -----------------------------------------------------------------------------
-- 4. Get Organization Summary Counts for Staff
-- Returns counts by type and status for dashboard stats
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_organization_summary_for_staff()
RETURNS TABLE (
  total_count BIGINT,
  active_count BIGINT,
  suspended_count BIGINT,
  inactive_count BIGINT,
  community_association_count BIGINT,
  management_company_count BIGINT,
  service_provider_count BIGINT,
  individual_property_owner_count BIGINT,
  trust_or_llc_count BIGINT,
  commercial_client_count BIGINT,
  external_service_provider_count BIGINT,
  platform_operator_count BIGINT
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_count,
    COUNT(*) FILTER (WHERE status = 'ACTIVE')::BIGINT AS active_count,
    COUNT(*) FILTER (WHERE status = 'SUSPENDED')::BIGINT AS suspended_count,
    COUNT(*) FILTER (WHERE status = 'INACTIVE')::BIGINT AS inactive_count,
    COUNT(*) FILTER (WHERE type = 'COMMUNITY_ASSOCIATION')::BIGINT AS community_association_count,
    COUNT(*) FILTER (WHERE type = 'MANAGEMENT_COMPANY')::BIGINT AS management_company_count,
    COUNT(*) FILTER (WHERE type = 'SERVICE_PROVIDER')::BIGINT AS service_provider_count,
    COUNT(*) FILTER (WHERE type = 'INDIVIDUAL_PROPERTY_OWNER')::BIGINT AS individual_property_owner_count,
    COUNT(*) FILTER (WHERE type = 'TRUST_OR_LLC')::BIGINT AS trust_or_llc_count,
    COUNT(*) FILTER (WHERE type = 'COMMERCIAL_CLIENT')::BIGINT AS commercial_client_count,
    COUNT(*) FILTER (WHERE type = 'EXTERNAL_SERVICE_PROVIDER')::BIGINT AS external_service_provider_count,
    COUNT(*) FILTER (WHERE type = 'PLATFORM_OPERATOR')::BIGINT AS platform_operator_count
  FROM organizations
  WHERE deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION get_organization_summary_for_staff() TO hestami_app;

COMMENT ON FUNCTION get_organization_summary_for_staff() IS
  'SECURITY DEFINER function that returns organization counts by type and status for staff dashboard';

-- -----------------------------------------------------------------------------
-- 5. Update Organization Status for Staff
-- Changes org status and records activity event
-- Returns success/failure with previous and new values
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_organization_status_for_staff(
  p_org_id TEXT,
  p_new_status TEXT,
  p_reason TEXT,
  p_performed_by_id TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  previous_status TEXT,
  new_status TEXT,
  updated_at TIMESTAMPTZ(3)
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status TEXT;
  v_updated_at TIMESTAMPTZ(3);
  v_org_name TEXT;
BEGIN
  -- Get current status and name
  SELECT o.status::TEXT, o.name INTO v_old_status, v_org_name
  FROM organizations o
  WHERE o.id = p_org_id AND o.deleted_at IS NULL;

  IF v_old_status IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ(3);
    RETURN;
  END IF;

  -- Don't update if same status
  IF v_old_status = p_new_status THEN
    RETURN QUERY SELECT TRUE, v_old_status, v_old_status, NOW()::TIMESTAMPTZ(3);
    RETURN;
  END IF;

  -- Update status
  UPDATE organizations
  SET status = p_new_status::organization_status,
      updated_at = NOW()
  WHERE id = p_org_id
  RETURNING organizations.updated_at INTO v_updated_at;

  -- Record activity event
  INSERT INTO activity_events (
    id,
    organization_id,
    entity_type,
    entity_id,
    action,
    event_category,
    summary,
    performed_by_id,
    performed_by_type,
    performed_at,
    details
  ) VALUES (
    gen_random_uuid()::TEXT,
    p_org_id,
    'ORGANIZATION',
    p_org_id,
    'STATUS_CHANGE',
    'ADMINISTRATIVE',
    'Organization status changed from ' || v_old_status || ' to ' || p_new_status || ' for ' || v_org_name,
    p_performed_by_id,
    'HUMAN',
    NOW(),
    jsonb_build_object(
      'previousStatus', v_old_status,
      'newStatus', p_new_status,
      'reason', p_reason,
      'changedBy', 'staff_portal'
    )
  );

  RETURN QUERY SELECT TRUE, v_old_status, p_new_status, v_updated_at;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION update_organization_status_for_staff(TEXT, TEXT, TEXT, TEXT) TO hestami_app;

COMMENT ON FUNCTION update_organization_status_for_staff(TEXT, TEXT, TEXT, TEXT) IS
  'SECURITY DEFINER function that updates organization status and records activity event';

-- -----------------------------------------------------------------------------
-- 6. Update Organization Info for Staff
-- Updates name and contact information, records activity event
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_organization_info_for_staff(
  p_org_id TEXT,
  p_name TEXT DEFAULT NULL,
  p_external_contact_name TEXT DEFAULT NULL,
  p_external_contact_email TEXT DEFAULT NULL,
  p_external_contact_phone TEXT DEFAULT NULL,
  p_performed_by_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  id TEXT,
  name TEXT,
  external_contact_name TEXT,
  external_contact_email TEXT,
  external_contact_phone TEXT,
  updated_at TIMESTAMPTZ(3)
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_name TEXT;
  v_old_contact_name TEXT;
  v_old_contact_email TEXT;
  v_old_contact_phone TEXT;
  v_updated_at TIMESTAMPTZ(3);
  v_changes JSONB;
BEGIN
  -- Get current values for audit
  SELECT o.name, o.external_contact_name, o.external_contact_email, o.external_contact_phone
  INTO v_old_name, v_old_contact_name, v_old_contact_email, v_old_contact_phone
  FROM organizations o
  WHERE o.id = p_org_id AND o.deleted_at IS NULL;

  IF v_old_name IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ(3);
    RETURN;
  END IF;

  -- Build changes object for audit
  v_changes := '{}'::JSONB;
  IF p_name IS NOT NULL AND p_name != v_old_name THEN
    v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('from', v_old_name, 'to', p_name));
  END IF;
  IF p_external_contact_name IS NOT NULL AND COALESCE(p_external_contact_name, '') != COALESCE(v_old_contact_name, '') THEN
    v_changes := v_changes || jsonb_build_object('externalContactName', jsonb_build_object('from', v_old_contact_name, 'to', p_external_contact_name));
  END IF;
  IF p_external_contact_email IS NOT NULL AND COALESCE(p_external_contact_email, '') != COALESCE(v_old_contact_email, '') THEN
    v_changes := v_changes || jsonb_build_object('externalContactEmail', jsonb_build_object('from', v_old_contact_email, 'to', p_external_contact_email));
  END IF;
  IF p_external_contact_phone IS NOT NULL AND COALESCE(p_external_contact_phone, '') != COALESCE(v_old_contact_phone, '') THEN
    v_changes := v_changes || jsonb_build_object('externalContactPhone', jsonb_build_object('from', v_old_contact_phone, 'to', p_external_contact_phone));
  END IF;

  -- Update organization
  UPDATE organizations o
  SET
    name = COALESCE(p_name, o.name),
    external_contact_name = CASE WHEN p_external_contact_name IS NOT NULL THEN p_external_contact_name ELSE o.external_contact_name END,
    external_contact_email = CASE WHEN p_external_contact_email IS NOT NULL THEN p_external_contact_email ELSE o.external_contact_email END,
    external_contact_phone = CASE WHEN p_external_contact_phone IS NOT NULL THEN p_external_contact_phone ELSE o.external_contact_phone END,
    updated_at = NOW()
  WHERE o.id = p_org_id
  RETURNING o.updated_at INTO v_updated_at;

  -- Record activity event if there were changes
  IF v_changes != '{}'::JSONB THEN
    INSERT INTO activity_events (
      id,
      organization_id,
      entity_type,
      entity_id,
      action,
      event_category,
      summary,
      performed_by_id,
      performed_by_type,
      performed_at,
      details
    ) VALUES (
      gen_random_uuid()::TEXT,
      p_org_id,
      'ORGANIZATION',
      p_org_id,
      'UPDATE',
      'ADMINISTRATIVE',
      'Organization information updated for ' || COALESCE(p_name, v_old_name),
      p_performed_by_id,
      'HUMAN',
      NOW(),
      jsonb_build_object(
        'changes', v_changes,
        'changedBy', 'staff_portal'
      )
    );
  END IF;

  RETURN QUERY
  SELECT TRUE, o.id::TEXT, o.name::TEXT, o.external_contact_name::TEXT,
         o.external_contact_email::TEXT, o.external_contact_phone::TEXT, o.updated_at
  FROM organizations o
  WHERE o.id = p_org_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to app user
GRANT EXECUTE ON FUNCTION update_organization_info_for_staff(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO hestami_app;

COMMENT ON FUNCTION update_organization_info_for_staff(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'SECURITY DEFINER function that updates organization info and records activity event';
