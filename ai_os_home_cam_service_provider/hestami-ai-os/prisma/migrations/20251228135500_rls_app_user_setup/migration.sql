-- =============================================================================
-- RLS Application User Setup
-- =============================================================================
-- This migration creates the RLS-enabled application user and configures
-- proper permissions for multi-tenant isolation.
--
-- The application uses two database users:
-- 1. hestami (owner) - Full access, bypasses RLS, used for migrations/admin
-- 2. hestami_app - RLS-enabled, used for runtime application queries
-- =============================================================================

-- Create the application user if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'hestami_app') THEN
    CREATE ROLE hestami_app WITH LOGIN PASSWORD 'hestami_app_dev_password';
  END IF;
END
$$;

-- Grant connect permission to the database
GRANT CONNECT ON DATABASE hestami TO hestami_app;

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO hestami_app;

-- Grant SELECT, INSERT, UPDATE, DELETE on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hestami_app;

-- Grant USAGE, SELECT on all sequences (for auto-increment IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hestami_app;

-- Grant EXECUTE on all functions (including RLS helper functions)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO hestami_app;

-- Set default privileges for future tables created by hestami (owner)
ALTER DEFAULT PRIVILEGES FOR ROLE hestami IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hestami_app;

ALTER DEFAULT PRIVILEGES FOR ROLE hestami IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO hestami_app;

ALTER DEFAULT PRIVILEGES FOR ROLE hestami IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO hestami_app;

-- =============================================================================
-- RLS Policy Configuration
-- =============================================================================
-- RLS policies are enforced for the hestami_app user but NOT for the owner.
-- The owner (hestami) bypasses RLS by default as the table owner.
--
-- For each RLS-enabled table, we use:
-- - ENABLE ROW LEVEL SECURITY: Activates RLS
-- - FORCE ROW LEVEL SECURITY: Ensures RLS applies even to table owner
--   (We don't use FORCE because we want owner to bypass for admin tasks)
-- =============================================================================

-- Update the current_org_id function to handle null gracefully
CREATE OR REPLACE FUNCTION current_org_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_org_id', true), '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audited version of set_current_org_id with logging
CREATE OR REPLACE FUNCTION set_org_context_audited(
  p_user_id TEXT,
  p_org_id TEXT,
  p_reason TEXT DEFAULT NULL,
  p_item_type TEXT DEFAULT NULL,
  p_item_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_org_id', p_org_id, false);
  PERFORM set_config('app.current_user_id', p_user_id, false);
  -- Log the context switch for audit purposes
  -- In production, this could write to an audit table
  RAISE DEBUG 'RLS context set: user=%, org=%, reason=%, item_type=%, item_id=%',
    p_user_id, p_org_id, p_reason, p_item_type, p_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audited version of clear context
CREATE OR REPLACE FUNCTION clear_org_context_audited(p_user_id TEXT) RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_org_id', '', false);
  PERFORM set_config('app.current_user_id', '', false);
  RAISE DEBUG 'RLS context cleared by user=%', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Enable RLS on the 15 migrated tables
-- =============================================================================
-- These tables have organization_id and need tenant isolation
-- Table names use snake_case as defined by @@map in schema.prisma

-- properties (Property model)
ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_properties_select ON "properties";
DROP POLICY IF EXISTS rls_properties_insert ON "properties";
DROP POLICY IF EXISTS rls_properties_update ON "properties";
DROP POLICY IF EXISTS rls_properties_delete ON "properties";

CREATE POLICY rls_properties_select ON "properties" FOR SELECT
  USING (organization_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY rls_properties_insert ON "properties" FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_properties_update ON "properties" FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_properties_delete ON "properties" FOR DELETE
  USING (organization_id = current_org_id());

-- units (Unit model)
ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_units_select ON "units";
DROP POLICY IF EXISTS rls_units_insert ON "units";
DROP POLICY IF EXISTS rls_units_update ON "units";
DROP POLICY IF EXISTS rls_units_delete ON "units";

CREATE POLICY rls_units_select ON "units" FOR SELECT
  USING (organization_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY rls_units_insert ON "units" FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_units_update ON "units" FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_units_delete ON "units" FOR DELETE
  USING (organization_id = current_org_id());

-- work_orders (WorkOrder model)
ALTER TABLE "work_orders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_work_orders_select ON "work_orders";
DROP POLICY IF EXISTS rls_work_orders_insert ON "work_orders";
DROP POLICY IF EXISTS rls_work_orders_update ON "work_orders";
DROP POLICY IF EXISTS rls_work_orders_delete ON "work_orders";

CREATE POLICY rls_work_orders_select ON "work_orders" FOR SELECT
  USING (organization_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY rls_work_orders_insert ON "work_orders" FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_work_orders_update ON "work_orders" FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_work_orders_delete ON "work_orders" FOR DELETE
  USING (organization_id = current_org_id());

-- assets (Asset model)
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_assets_select ON "assets";
DROP POLICY IF EXISTS rls_assets_insert ON "assets";
DROP POLICY IF EXISTS rls_assets_update ON "assets";
DROP POLICY IF EXISTS rls_assets_delete ON "assets";

CREATE POLICY rls_assets_select ON "assets" FOR SELECT
  USING (organization_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY rls_assets_insert ON "assets" FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_assets_update ON "assets" FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_assets_delete ON "assets" FOR DELETE
  USING (organization_id = current_org_id());

-- vendors (Vendor model)
ALTER TABLE "vendors" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_vendors_select ON "vendors";
DROP POLICY IF EXISTS rls_vendors_insert ON "vendors";
DROP POLICY IF EXISTS rls_vendors_update ON "vendors";
DROP POLICY IF EXISTS rls_vendors_delete ON "vendors";

CREATE POLICY rls_vendors_select ON "vendors" FOR SELECT
  USING (organization_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY rls_vendors_insert ON "vendors" FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_vendors_update ON "vendors" FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_vendors_delete ON "vendors" FOR DELETE
  USING (organization_id = current_org_id());

-- gl_accounts (GLAccount model)
ALTER TABLE "gl_accounts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_gl_accounts_select ON "gl_accounts";
DROP POLICY IF EXISTS rls_gl_accounts_insert ON "gl_accounts";
DROP POLICY IF EXISTS rls_gl_accounts_update ON "gl_accounts";
DROP POLICY IF EXISTS rls_gl_accounts_delete ON "gl_accounts";

CREATE POLICY rls_gl_accounts_select ON "gl_accounts" FOR SELECT
  USING (organization_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY rls_gl_accounts_insert ON "gl_accounts" FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_gl_accounts_update ON "gl_accounts" FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_gl_accounts_delete ON "gl_accounts" FOR DELETE
  USING (organization_id = current_org_id());

-- bank_accounts (BankAccount model)
ALTER TABLE "bank_accounts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_bank_accounts_select ON "bank_accounts";
DROP POLICY IF EXISTS rls_bank_accounts_insert ON "bank_accounts";
DROP POLICY IF EXISTS rls_bank_accounts_update ON "bank_accounts";
DROP POLICY IF EXISTS rls_bank_accounts_delete ON "bank_accounts";

CREATE POLICY rls_bank_accounts_select ON "bank_accounts" FOR SELECT
  USING (organization_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY rls_bank_accounts_insert ON "bank_accounts" FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_bank_accounts_update ON "bank_accounts" FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_bank_accounts_delete ON "bank_accounts" FOR DELETE
  USING (organization_id = current_org_id());

-- assessment_types (AssessmentType model)
ALTER TABLE "assessment_types" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_assessment_types_select ON "assessment_types";
DROP POLICY IF EXISTS rls_assessment_types_insert ON "assessment_types";
DROP POLICY IF EXISTS rls_assessment_types_update ON "assessment_types";
DROP POLICY IF EXISTS rls_assessment_types_delete ON "assessment_types";

CREATE POLICY rls_assessment_types_select ON "assessment_types" FOR SELECT
  USING (organization_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY rls_assessment_types_insert ON "assessment_types" FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_assessment_types_update ON "assessment_types" FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_assessment_types_delete ON "assessment_types" FOR DELETE
  USING (organization_id = current_org_id());

-- violations (Violation model)
ALTER TABLE "violations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_violations_select ON "violations";
DROP POLICY IF EXISTS rls_violations_insert ON "violations";
DROP POLICY IF EXISTS rls_violations_update ON "violations";
DROP POLICY IF EXISTS rls_violations_delete ON "violations";

CREATE POLICY rls_violations_select ON "violations" FOR SELECT
  USING (organization_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY rls_violations_insert ON "violations" FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_violations_update ON "violations" FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_violations_delete ON "violations" FOR DELETE
  USING (organization_id = current_org_id());

-- violation_types (ViolationType model)
ALTER TABLE "violation_types" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_violation_types_select ON "violation_types";
DROP POLICY IF EXISTS rls_violation_types_insert ON "violation_types";
DROP POLICY IF EXISTS rls_violation_types_update ON "violation_types";
DROP POLICY IF EXISTS rls_violation_types_delete ON "violation_types";

CREATE POLICY rls_violation_types_select ON "violation_types" FOR SELECT
  USING (organization_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY rls_violation_types_insert ON "violation_types" FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_violation_types_update ON "violation_types" FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_violation_types_delete ON "violation_types" FOR DELETE
  USING (organization_id = current_org_id());

-- arc_requests (ARCRequest model)
ALTER TABLE "arc_requests" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_arc_requests_select ON "arc_requests";
DROP POLICY IF EXISTS rls_arc_requests_insert ON "arc_requests";
DROP POLICY IF EXISTS rls_arc_requests_update ON "arc_requests";
DROP POLICY IF EXISTS rls_arc_requests_delete ON "arc_requests";

CREATE POLICY rls_arc_requests_select ON "arc_requests" FOR SELECT
  USING (organization_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY rls_arc_requests_insert ON "arc_requests" FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_arc_requests_update ON "arc_requests" FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_arc_requests_delete ON "arc_requests" FOR DELETE
  USING (organization_id = current_org_id());

-- boards (Board model)
ALTER TABLE "boards" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_boards_select ON "boards";
DROP POLICY IF EXISTS rls_boards_insert ON "boards";
DROP POLICY IF EXISTS rls_boards_update ON "boards";
DROP POLICY IF EXISTS rls_boards_delete ON "boards";

CREATE POLICY rls_boards_select ON "boards" FOR SELECT
  USING (organization_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY rls_boards_insert ON "boards" FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_boards_update ON "boards" FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_boards_delete ON "boards" FOR DELETE
  USING (organization_id = current_org_id());

-- meetings (Meeting model)
ALTER TABLE "meetings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_meetings_select ON "meetings";
DROP POLICY IF EXISTS rls_meetings_insert ON "meetings";
DROP POLICY IF EXISTS rls_meetings_update ON "meetings";
DROP POLICY IF EXISTS rls_meetings_delete ON "meetings";

CREATE POLICY rls_meetings_select ON "meetings" FOR SELECT
  USING (organization_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY rls_meetings_insert ON "meetings" FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_meetings_update ON "meetings" FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_meetings_delete ON "meetings" FOR DELETE
  USING (organization_id = current_org_id());

-- policy_documents (PolicyDocument model)
ALTER TABLE "policy_documents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_policy_documents_select ON "policy_documents";
DROP POLICY IF EXISTS rls_policy_documents_insert ON "policy_documents";
DROP POLICY IF EXISTS rls_policy_documents_update ON "policy_documents";
DROP POLICY IF EXISTS rls_policy_documents_delete ON "policy_documents";

CREATE POLICY rls_policy_documents_select ON "policy_documents" FOR SELECT
  USING (organization_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY rls_policy_documents_insert ON "policy_documents" FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_policy_documents_update ON "policy_documents" FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_policy_documents_delete ON "policy_documents" FOR DELETE
  USING (organization_id = current_org_id());

-- concierge_cases (ConciergeCase model)
ALTER TABLE "concierge_cases" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_concierge_cases_select ON "concierge_cases";
DROP POLICY IF EXISTS rls_concierge_cases_insert ON "concierge_cases";
DROP POLICY IF EXISTS rls_concierge_cases_update ON "concierge_cases";
DROP POLICY IF EXISTS rls_concierge_cases_delete ON "concierge_cases";

CREATE POLICY rls_concierge_cases_select ON "concierge_cases" FOR SELECT
  USING (organization_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY rls_concierge_cases_insert ON "concierge_cases" FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_concierge_cases_update ON "concierge_cases" FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_concierge_cases_delete ON "concierge_cases" FOR DELETE
  USING (organization_id = current_org_id());

-- =============================================================================
-- Staff work queue lookup view (for context determination)
-- =============================================================================
CREATE OR REPLACE VIEW staff_work_queue_org_lookup AS
SELECT 'CONCIERGE_CASE' AS item_type, id AS item_id, organization_id FROM concierge_cases
UNION ALL
SELECT 'WORK_ORDER' AS item_type, id AS item_id, organization_id FROM work_orders
UNION ALL
SELECT 'VIOLATION' AS item_type, id AS item_id, organization_id FROM violations
UNION ALL
SELECT 'ARC_REQUEST' AS item_type, id AS item_id, organization_id FROM arc_requests;

-- Grant SELECT on the lookup view to the app user
GRANT SELECT ON staff_work_queue_org_lookup TO hestami_app;

-- =============================================================================
-- Verification query (run manually to verify setup)
-- =============================================================================
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('properties', 'units', 'work_orders', 'assets', 'vendors', 
--                     'gl_accounts', 'bank_accounts', 'assessment_types', 'violations',
--                     'violation_types', 'arc_requests', 'boards', 'meetings', 
--                     'policy_documents', 'concierge_cases');
