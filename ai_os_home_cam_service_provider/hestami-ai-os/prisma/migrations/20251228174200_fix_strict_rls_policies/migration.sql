-- =============================================================================
-- Fix RLS Strict Enforcement
-- =============================================================================
-- Remove the permissive "OR current_org_id() IS NULL" fallback from SELECT policies.
-- This ensures queries WITHOUT organization context return EMPTY results,
-- enforcing strict tenant isolation.
--
-- Before: organization_id = current_org_id() OR current_org_id() IS NULL
-- After:  organization_id = current_org_id()
-- =============================================================================

-- properties
DROP POLICY IF EXISTS rls_properties_select ON "properties";
CREATE POLICY rls_properties_select ON "properties" FOR SELECT
  USING (organization_id = current_org_id());

-- units
DROP POLICY IF EXISTS rls_units_select ON "units";
CREATE POLICY rls_units_select ON "units" FOR SELECT
  USING (organization_id = current_org_id());

-- work_orders
DROP POLICY IF EXISTS rls_work_orders_select ON "work_orders";
CREATE POLICY rls_work_orders_select ON "work_orders" FOR SELECT
  USING (organization_id = current_org_id());

-- assets
DROP POLICY IF EXISTS rls_assets_select ON "assets";
CREATE POLICY rls_assets_select ON "assets" FOR SELECT
  USING (organization_id = current_org_id());

-- vendors
DROP POLICY IF EXISTS rls_vendors_select ON "vendors";
CREATE POLICY rls_vendors_select ON "vendors" FOR SELECT
  USING (organization_id = current_org_id());

-- gl_accounts
DROP POLICY IF EXISTS rls_gl_accounts_select ON "gl_accounts";
CREATE POLICY rls_gl_accounts_select ON "gl_accounts" FOR SELECT
  USING (organization_id = current_org_id());

-- bank_accounts
DROP POLICY IF EXISTS rls_bank_accounts_select ON "bank_accounts";
CREATE POLICY rls_bank_accounts_select ON "bank_accounts" FOR SELECT
  USING (organization_id = current_org_id());

-- assessment_types
DROP POLICY IF EXISTS rls_assessment_types_select ON "assessment_types";
CREATE POLICY rls_assessment_types_select ON "assessment_types" FOR SELECT
  USING (organization_id = current_org_id());

-- violations
DROP POLICY IF EXISTS rls_violations_select ON "violations";
CREATE POLICY rls_violations_select ON "violations" FOR SELECT
  USING (organization_id = current_org_id());

-- violation_types
DROP POLICY IF EXISTS rls_violation_types_select ON "violation_types";
CREATE POLICY rls_violation_types_select ON "violation_types" FOR SELECT
  USING (organization_id = current_org_id());

-- arc_requests
DROP POLICY IF EXISTS rls_arc_requests_select ON "arc_requests";
CREATE POLICY rls_arc_requests_select ON "arc_requests" FOR SELECT
  USING (organization_id = current_org_id());

-- boards
DROP POLICY IF EXISTS rls_boards_select ON "boards";
CREATE POLICY rls_boards_select ON "boards" FOR SELECT
  USING (organization_id = current_org_id());

-- meetings
DROP POLICY IF EXISTS rls_meetings_select ON "meetings";
CREATE POLICY rls_meetings_select ON "meetings" FOR SELECT
  USING (organization_id = current_org_id());

-- policy_documents
DROP POLICY IF EXISTS rls_policy_documents_select ON "policy_documents";
CREATE POLICY rls_policy_documents_select ON "policy_documents" FOR SELECT
  USING (organization_id = current_org_id());

-- concierge_cases
DROP POLICY IF EXISTS rls_concierge_cases_select ON "concierge_cases";
CREATE POLICY rls_concierge_cases_select ON "concierge_cases" FOR SELECT
  USING (organization_id = current_org_id());
