-- CreateFunction: record_activity_event_system
-- This SECURITY DEFINER function allows system-level operations (like DBOS workflows)
-- to record activity events bypassing RLS policies.

CREATE OR REPLACE FUNCTION record_activity_event_system(
  p_organization_id TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_action TEXT,
  p_event_category TEXT,
  p_summary TEXT,
  p_performed_by_id TEXT DEFAULT NULL,
  p_performed_by_type TEXT DEFAULT 'SYSTEM',
  p_previous_state JSONB DEFAULT '{}'::JSONB,
  p_new_state JSONB DEFAULT '{}'::JSONB,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_case_id TEXT DEFAULT NULL,
  p_intent_id TEXT DEFAULT NULL,
  p_property_id TEXT DEFAULT NULL,
  p_decision_id TEXT DEFAULT NULL,
  p_job_id TEXT DEFAULT NULL,
  p_work_order_id TEXT DEFAULT NULL,
  p_technician_id TEXT DEFAULT NULL,
  p_association_id TEXT DEFAULT NULL,
  p_unit_id TEXT DEFAULT NULL,
  p_violation_id TEXT DEFAULT NULL,
  p_arc_request_id TEXT DEFAULT NULL
)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id TEXT;
BEGIN
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
    previous_state,
    new_state,
    metadata,
    case_id,
    intent_id,
    property_id,
    decision_id,
    job_id,
    work_order_id,
    technician_id,
    association_id,
    unit_id,
    violation_id,
    arc_request_id,
    performed_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid()::TEXT,
    p_organization_id,
    p_entity_type::"EntityType",
    p_entity_id,
    p_action::"ActivityAction",
    p_event_category::"EventCategory",
    p_summary,
    p_performed_by_id,
    p_performed_by_type::"ActorType",
    p_previous_state,
    p_new_state,
    p_metadata,
    p_case_id,
    p_intent_id,
    p_property_id,
    p_decision_id,
    p_job_id,
    p_work_order_id,
    p_technician_id,
    p_association_id,
    p_unit_id,
    p_violation_id,
    p_arc_request_id,
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to the application user
GRANT EXECUTE ON FUNCTION record_activity_event_system(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO hestami_app;
