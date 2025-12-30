-- Restore get_staff_work_queue with correct structure and TIMESTAMPTZ
DROP FUNCTION IF EXISTS get_staff_work_queue();

CREATE OR REPLACE FUNCTION get_staff_work_queue()
RETURNS TABLE (
  item_type TEXT,
  item_id TEXT,
  item_number TEXT,
  organization_id TEXT,
  organization_name TEXT,
  title TEXT,
  status TEXT,
  priority TEXT,
  property_name TEXT,
  association_name TEXT,
  assigned_to_id TEXT,
  assigned_to_name TEXT,
  created_at TIMESTAMPTZ(3),
  updated_at TIMESTAMPTZ(3)
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Concierge Cases
  SELECT 
    'CONCIERGE_CASE'::TEXT AS item_type,
    cc.id::TEXT AS item_id,
    cc.case_number::TEXT AS item_number,
    cc.organization_id::TEXT,
    o.name::TEXT AS organization_name,
    cc.title::TEXT,
    cc.status::TEXT,
    cc.priority::TEXT,
    p.name::TEXT AS property_name,
    NULL::TEXT AS association_name,
    cc.assigned_concierge_user_id::TEXT AS assigned_to_id,
    u.name::TEXT AS assigned_to_name,
    cc.created_at,
    cc.updated_at
  FROM concierge_cases cc
  LEFT JOIN organizations o ON o.id = cc.organization_id
  LEFT JOIN individual_properties p ON p.id = cc.property_id
  LEFT JOIN users u ON u.id = cc.assigned_concierge_user_id
  WHERE cc.deleted_at IS NULL
    AND cc.status NOT IN ('CLOSED', 'CANCELLED')
  
  UNION ALL
  
  -- Work Orders
  SELECT 
    'WORK_ORDER'::TEXT AS item_type,
    wo.id::TEXT AS item_id,
    wo.work_order_number::TEXT AS item_number,
    wo.organization_id::TEXT,
    o.name::TEXT AS organization_name,
    wo.title::TEXT,
    wo.status::TEXT,
    wo.priority::TEXT,
    COALESCE(un.unit_number, 'N/A')::TEXT AS property_name,
    a.name::TEXT AS association_name,
    NULL::TEXT AS assigned_to_id,
    NULL::TEXT AS assigned_to_name,
    wo.created_at,
    wo.updated_at
  FROM work_orders wo
  LEFT JOIN organizations o ON o.id = wo.organization_id
  LEFT JOIN associations a ON a.id = wo.association_id
  LEFT JOIN units un ON un.id = wo.unit_id
  WHERE wo.status NOT IN ('CLOSED', 'CANCELLED')
  
  UNION ALL
  
  -- Violations
  SELECT 
    'VIOLATION'::TEXT AS item_type,
    v.id::TEXT AS item_id,
    v.violation_number::TEXT AS item_number,
    v.organization_id::TEXT,
    o.name::TEXT AS organization_name,
    v.title::TEXT,
    v.status::TEXT,
    v.severity::TEXT AS priority,
    COALESCE(un.unit_number, 'N/A')::TEXT AS property_name,
    a.name::TEXT AS association_name,
    NULL::TEXT AS assigned_to_id,
    NULL::TEXT AS assigned_to_name,
    v.created_at,
    v.updated_at
  FROM violations v
  LEFT JOIN organizations o ON o.id = v.organization_id
  LEFT JOIN associations a ON a.id = v.association_id
  LEFT JOIN units un ON un.id = v.unit_id
  WHERE v.deleted_at IS NULL
    AND v.status NOT IN ('CLOSED', 'DISMISSED')
  
  UNION ALL
  
  -- ARC Requests
  SELECT 
    'ARC_REQUEST'::TEXT AS item_type,
    ar.id::TEXT AS item_id,
    ar.request_number::TEXT AS item_number,
    ar.organization_id::TEXT,
    o.name::TEXT AS organization_name,
    ar.title::TEXT,
    ar.status::TEXT,
    'NORMAL'::TEXT AS priority,
    COALESCE(un.unit_number, 'N/A')::TEXT AS property_name,
    a.name::TEXT AS association_name,
    NULL::TEXT AS assigned_to_id,
    NULL::TEXT AS assigned_to_name,
    ar.created_at,
    ar.updated_at
  FROM arc_requests ar
  LEFT JOIN organizations o ON o.id = ar.organization_id
  LEFT JOIN associations a ON a.id = ar.association_id
  LEFT JOIN units un ON un.id = ar.unit_id
  WHERE ar.status NOT IN ('APPROVED', 'DENIED', 'WITHDRAWN');
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_staff_work_queue() TO hestami_app;

-- Restore get_work_item_org with correct signature
DROP FUNCTION IF EXISTS get_work_item_org(TEXT);
DROP FUNCTION IF EXISTS get_work_item_org(TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_work_item_org(
  p_item_type TEXT,
  p_item_id TEXT
)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id TEXT;
BEGIN
  CASE p_item_type
    WHEN 'CONCIERGE_CASE' THEN
      SELECT organization_id INTO v_org_id FROM concierge_cases WHERE id = p_item_id;
    WHEN 'WORK_ORDER' THEN
      SELECT organization_id INTO v_org_id FROM work_orders WHERE id = p_item_id;
    WHEN 'VIOLATION' THEN
      SELECT organization_id INTO v_org_id FROM violations WHERE id = p_item_id;
    WHEN 'ARC_REQUEST' THEN
      SELECT organization_id INTO v_org_id FROM arc_requests WHERE id = p_item_id;
    ELSE
      v_org_id := NULL;
  END CASE;
  
  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_work_item_org(TEXT, TEXT) TO hestami_app;

-- Restore get_staff_work_queue_summary
DROP FUNCTION IF EXISTS get_staff_work_queue_summary();

CREATE OR REPLACE FUNCTION get_staff_work_queue_summary()
RETURNS TABLE (
  concierge_intake INT,
  concierge_in_progress INT,
  concierge_pending_external INT,
  concierge_pending_owner INT,
  work_orders_open INT,
  violations_open INT,
  arc_requests_pending INT
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INT FROM concierge_cases WHERE deleted_at IS NULL AND status = 'INTAKE'),
    (SELECT COUNT(*)::INT FROM concierge_cases WHERE deleted_at IS NULL AND status = 'IN_PROGRESS'),
    (SELECT COUNT(*)::INT FROM concierge_cases WHERE deleted_at IS NULL AND status = 'PENDING_EXTERNAL'),
    (SELECT COUNT(*)::INT FROM concierge_cases WHERE deleted_at IS NULL AND status = 'PENDING_OWNER'),
    (SELECT COUNT(*)::INT FROM work_orders WHERE status NOT IN ('CLOSED', 'CANCELLED')),
    (SELECT COUNT(*)::INT FROM violations WHERE deleted_at IS NULL AND status NOT IN ('CLOSED', 'DISMISSED')),
    (SELECT COUNT(*)::INT FROM arc_requests WHERE status NOT IN ('APPROVED', 'DENIED', 'WITHDRAWN'));
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_staff_work_queue_summary() TO hestami_app;
