-- =============================================================================
-- Fix Staff Work Queue Function Column Aliases
-- =============================================================================
-- The original function was missing explicit column aliases, causing
-- 'structure of query does not match function result type' errors.
-- =============================================================================

-- Drop and recreate with proper aliases
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
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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
    cc.organization_id::TEXT AS organization_id,
    o.name::TEXT AS organization_name,
    cc.title::TEXT AS title,
    cc.status::TEXT AS status,
    cc.priority::TEXT AS priority,
    p.name::TEXT AS property_name,
    NULL::TEXT AS association_name,
    cc.assigned_concierge_user_id::TEXT AS assigned_to_id,
    u.name::TEXT AS assigned_to_name,
    cc.created_at AS created_at,
    cc.updated_at AS updated_at
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
    wo.organization_id::TEXT AS organization_id,
    o.name::TEXT AS organization_name,
    wo.title::TEXT AS title,
    wo.status::TEXT AS status,
    wo.priority::TEXT AS priority,
    COALESCE(u.unit_number, 'N/A')::TEXT AS property_name,
    a.name::TEXT AS association_name,
    NULL::TEXT AS assigned_to_id,
    NULL::TEXT AS assigned_to_name,
    wo.created_at AS created_at,
    wo.updated_at AS updated_at
  FROM work_orders wo
  LEFT JOIN organizations o ON o.id = wo.organization_id
  LEFT JOIN associations a ON a.id = wo.association_id
  LEFT JOIN units u ON u.id = wo.unit_id
  WHERE wo.status NOT IN ('CLOSED', 'CANCELLED')
  
  UNION ALL
  
  -- Violations
  SELECT 
    'VIOLATION'::TEXT AS item_type,
    v.id::TEXT AS item_id,
    v.violation_number::TEXT AS item_number,
    v.organization_id::TEXT AS organization_id,
    o.name::TEXT AS organization_name,
    v.title::TEXT AS title,
    v.status::TEXT AS status,
    v.severity::TEXT AS priority,
    COALESCE(u.unit_number, 'N/A')::TEXT AS property_name,
    a.name::TEXT AS association_name,
    NULL::TEXT AS assigned_to_id,
    NULL::TEXT AS assigned_to_name,
    v.created_at AS created_at,
    v.updated_at AS updated_at
  FROM violations v
  LEFT JOIN organizations o ON o.id = v.organization_id
  LEFT JOIN associations a ON a.id = v.association_id
  LEFT JOIN units u ON u.id = v.unit_id
  WHERE v.deleted_at IS NULL
    AND v.status NOT IN ('CLOSED', 'DISMISSED')
  
  UNION ALL
  
  -- ARC Requests
  SELECT 
    'ARC_REQUEST'::TEXT AS item_type,
    ar.id::TEXT AS item_id,
    ar.request_number::TEXT AS item_number,
    ar.organization_id::TEXT AS organization_id,
    o.name::TEXT AS organization_name,
    ar.title::TEXT AS title,
    ar.status::TEXT AS status,
    'NORMAL'::TEXT AS priority,
    COALESCE(u.unit_number, 'N/A')::TEXT AS property_name,
    a.name::TEXT AS association_name,
    NULL::TEXT AS assigned_to_id,
    NULL::TEXT AS assigned_to_name,
    ar.created_at AS created_at,
    ar.updated_at AS updated_at
  FROM arc_requests ar
  LEFT JOIN organizations o ON o.id = ar.organization_id
  LEFT JOIN associations a ON a.id = ar.association_id
  LEFT JOIN units u ON u.id = ar.unit_id
  WHERE ar.status NOT IN ('APPROVED', 'DENIED', 'WITHDRAWN');
END;
$$ LANGUAGE plpgsql;
