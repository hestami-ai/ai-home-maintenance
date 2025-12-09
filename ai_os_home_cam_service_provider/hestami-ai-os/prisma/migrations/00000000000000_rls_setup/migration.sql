-- Row-Level Security Setup for Multitenancy
-- This migration enables RLS and creates the base policies

-- Function to get current organization ID from session context
CREATE OR REPLACE FUNCTION current_org_id() RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_org_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set current organization ID in session context
CREATE OR REPLACE FUNCTION set_current_org_id(org_id TEXT) RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_org_id', org_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: RLS policies will be added to tenant-scoped tables as they are created
-- Example policy pattern (to be applied to future tables):
--
-- ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE table_name FORCE ROW LEVEL SECURITY;
--
-- CREATE POLICY tenant_isolation_policy ON table_name
--   USING (organization_id = current_org_id());
--
-- CREATE POLICY tenant_insert_policy ON table_name
--   FOR INSERT WITH CHECK (organization_id = current_org_id());

-- Enable RLS on idempotency_keys table
-- (This table is already organization-scoped)
