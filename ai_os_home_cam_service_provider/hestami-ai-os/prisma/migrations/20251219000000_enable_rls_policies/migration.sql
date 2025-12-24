-- Row-Level Security Policies for Multi-Tenant Isolation
-- This migration enables RLS on all tenant-scoped tables
--
-- Design Principles:
-- 1. NO BYPASS MODE - All queries require org context to be set
-- 2. Staff must explicitly set org context when working on an org's data
-- 3. Tables without organizationId are either:
--    a) Platform-level (Organization, User, Staff) - no RLS
--    b) Association-scoped - RLS via join to associations table
--
-- Context Functions (from 00000000000000_rls_setup):
-- - current_org_id() - Returns current session's organization ID
-- - set_current_org_id(org_id) - Sets the organization context

-- =============================================================================
-- PART 1: DIRECT ORG-SCOPED TABLES
-- Tables with organization_id column get simple equality policies
-- =============================================================================

-- Helper function to create standard RLS policies for org-scoped tables
-- We'll apply policies manually to ensure proper handling

-- -----------------------------------------------------------------------------
-- Core Tables
-- -----------------------------------------------------------------------------

-- activity_events
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_activity_events_select ON activity_events FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_activity_events_insert ON activity_events FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_activity_events_update ON activity_events FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_activity_events_delete ON activity_events FOR DELETE USING (organization_id = current_org_id());

-- idempotency_keys
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_idempotency_keys_select ON idempotency_keys FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_idempotency_keys_insert ON idempotency_keys FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_idempotency_keys_update ON idempotency_keys FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_idempotency_keys_delete ON idempotency_keys FOR DELETE USING (organization_id = current_org_id());

-- user_organizations (junction table - users can belong to multiple orgs)
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_user_organizations_select ON user_organizations FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_user_organizations_insert ON user_organizations FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_user_organizations_update ON user_organizations FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_user_organizations_delete ON user_organizations FOR DELETE USING (organization_id = current_org_id());

-- -----------------------------------------------------------------------------
-- HOA/Association Tables
-- -----------------------------------------------------------------------------

-- associations
ALTER TABLE associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE associations FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_associations_select ON associations FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_associations_insert ON associations FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_associations_update ON associations FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_associations_delete ON associations FOR DELETE USING (organization_id = current_org_id());

-- parties
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_parties_select ON parties FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_parties_insert ON parties FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_parties_update ON parties FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_parties_delete ON parties FOR DELETE USING (organization_id = current_org_id());

-- -----------------------------------------------------------------------------
-- Contractor/Service Provider Tables
-- -----------------------------------------------------------------------------

-- contractor_profiles
ALTER TABLE contractor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_contractor_profiles_select ON contractor_profiles FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_contractor_profiles_insert ON contractor_profiles FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_contractor_profiles_update ON contractor_profiles FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_contractor_profiles_delete ON contractor_profiles FOR DELETE USING (organization_id = current_org_id());

-- contractor_branches
ALTER TABLE contractor_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_branches FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_contractor_branches_select ON contractor_branches FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_contractor_branches_insert ON contractor_branches FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_contractor_branches_update ON contractor_branches FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_contractor_branches_delete ON contractor_branches FOR DELETE USING (organization_id = current_org_id());

-- technicians
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_technicians_select ON technicians FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_technicians_insert ON technicians FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_technicians_update ON technicians FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_technicians_delete ON technicians FOR DELETE USING (organization_id = current_org_id());

-- service_contracts
ALTER TABLE service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_contracts FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_service_contracts_select ON service_contracts FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_service_contracts_insert ON service_contracts FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_service_contracts_update ON service_contracts FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_service_contracts_delete ON service_contracts FOR DELETE USING (organization_id = current_org_id());

-- -----------------------------------------------------------------------------
-- Job Lifecycle Tables
-- -----------------------------------------------------------------------------

-- customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_customers_select ON customers FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_customers_insert ON customers FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_customers_update ON customers FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_customers_delete ON customers FOR DELETE USING (organization_id = current_org_id());

-- jobs
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_jobs_select ON jobs FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_jobs_insert ON jobs FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_jobs_update ON jobs FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_jobs_delete ON jobs FOR DELETE USING (organization_id = current_org_id());

-- job_templates
ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_job_templates_select ON job_templates FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_job_templates_insert ON job_templates FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_job_templates_update ON job_templates FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_job_templates_delete ON job_templates FOR DELETE USING (organization_id = current_org_id());

-- job_checklists
ALTER TABLE job_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_checklists FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_job_checklists_select ON job_checklists FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_job_checklists_insert ON job_checklists FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_job_checklists_update ON job_checklists FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_job_checklists_delete ON job_checklists FOR DELETE USING (organization_id = current_org_id());

-- job_media
ALTER TABLE job_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_media FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_job_media_select ON job_media FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_job_media_insert ON job_media FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_job_media_update ON job_media FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_job_media_delete ON job_media FOR DELETE USING (organization_id = current_org_id());

-- job_signatures
ALTER TABLE job_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_signatures FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_job_signatures_select ON job_signatures FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_job_signatures_insert ON job_signatures FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_job_signatures_update ON job_signatures FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_job_signatures_delete ON job_signatures FOR DELETE USING (organization_id = current_org_id());

-- job_time_entries
ALTER TABLE job_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_time_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_job_time_entries_select ON job_time_entries FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_job_time_entries_insert ON job_time_entries FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_job_time_entries_update ON job_time_entries FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_job_time_entries_delete ON job_time_entries FOR DELETE USING (organization_id = current_org_id());

-- -----------------------------------------------------------------------------
-- Billing Tables
-- -----------------------------------------------------------------------------

-- estimates
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_estimates_select ON estimates FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_estimates_insert ON estimates FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_estimates_update ON estimates FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_estimates_delete ON estimates FOR DELETE USING (organization_id = current_org_id());

-- proposals
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_proposals_select ON proposals FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_proposals_insert ON proposals FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_proposals_update ON proposals FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_proposals_delete ON proposals FOR DELETE USING (organization_id = current_org_id());

-- job_invoices
ALTER TABLE job_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_job_invoices_select ON job_invoices FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_job_invoices_insert ON job_invoices FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_job_invoices_update ON job_invoices FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_job_invoices_delete ON job_invoices FOR DELETE USING (organization_id = current_org_id());

-- payment_intents
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_payment_intents_select ON payment_intents FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_payment_intents_insert ON payment_intents FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_payment_intents_update ON payment_intents FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_payment_intents_delete ON payment_intents FOR DELETE USING (organization_id = current_org_id());

-- pricebooks
ALTER TABLE pricebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricebooks FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_pricebooks_select ON pricebooks FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_pricebooks_insert ON pricebooks FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_pricebooks_update ON pricebooks FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_pricebooks_delete ON pricebooks FOR DELETE USING (organization_id = current_org_id());

-- -----------------------------------------------------------------------------
-- Dispatch/Scheduling Tables
-- -----------------------------------------------------------------------------

-- dispatch_assignments
ALTER TABLE dispatch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_dispatch_assignments_select ON dispatch_assignments FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_dispatch_assignments_insert ON dispatch_assignments FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_dispatch_assignments_update ON dispatch_assignments FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_dispatch_assignments_delete ON dispatch_assignments FOR DELETE USING (organization_id = current_org_id());

-- route_plans
ALTER TABLE route_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_route_plans_select ON route_plans FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_route_plans_insert ON route_plans FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_route_plans_update ON route_plans FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_route_plans_delete ON route_plans FOR DELETE USING (organization_id = current_org_id());

-- schedule_slots
ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_slots FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_schedule_slots_select ON schedule_slots FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_schedule_slots_insert ON schedule_slots FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_schedule_slots_update ON schedule_slots FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_schedule_slots_delete ON schedule_slots FOR DELETE USING (organization_id = current_org_id());

-- sla_records
ALTER TABLE sla_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_records FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_sla_records_select ON sla_records FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_sla_records_insert ON sla_records FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_sla_records_update ON sla_records FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_sla_records_delete ON sla_records FOR DELETE USING (organization_id = current_org_id());

-- sla_windows
ALTER TABLE sla_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_windows FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_sla_windows_select ON sla_windows FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_sla_windows_insert ON sla_windows FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_sla_windows_update ON sla_windows FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_sla_windows_delete ON sla_windows FOR DELETE USING (organization_id = current_org_id());

-- -----------------------------------------------------------------------------
-- Inventory Tables
-- -----------------------------------------------------------------------------

-- inventory_locations
ALTER TABLE inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_locations FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_inventory_locations_select ON inventory_locations FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_inventory_locations_insert ON inventory_locations FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_inventory_locations_update ON inventory_locations FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_inventory_locations_delete ON inventory_locations FOR DELETE USING (organization_id = current_org_id());

-- inventory_items
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_inventory_items_select ON inventory_items FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_inventory_items_insert ON inventory_items FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_inventory_items_update ON inventory_items FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_inventory_items_delete ON inventory_items FOR DELETE USING (organization_id = current_org_id());

-- inventory_transfers
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_inventory_transfers_select ON inventory_transfers FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_inventory_transfers_insert ON inventory_transfers FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_inventory_transfers_update ON inventory_transfers FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_inventory_transfers_delete ON inventory_transfers FOR DELETE USING (organization_id = current_org_id());

-- material_usages
ALTER TABLE material_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_usages FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_material_usages_select ON material_usages FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_material_usages_insert ON material_usages FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_material_usages_update ON material_usages FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_material_usages_delete ON material_usages FOR DELETE USING (organization_id = current_org_id());

-- -----------------------------------------------------------------------------
-- Procurement Tables
-- -----------------------------------------------------------------------------

-- suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_suppliers_select ON suppliers FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_suppliers_insert ON suppliers FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_suppliers_update ON suppliers FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_suppliers_delete ON suppliers FOR DELETE USING (organization_id = current_org_id());

-- purchase_orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_purchase_orders_select ON purchase_orders FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_purchase_orders_insert ON purchase_orders FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_purchase_orders_update ON purchase_orders FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_purchase_orders_delete ON purchase_orders FOR DELETE USING (organization_id = current_org_id());

-- -----------------------------------------------------------------------------
-- Document Tables
-- -----------------------------------------------------------------------------

-- documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_documents_select ON documents FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_documents_insert ON documents FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_documents_update ON documents FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_documents_delete ON documents FOR DELETE USING (organization_id = current_org_id());

-- compliance_requirements
ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_requirements FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_compliance_requirements_select ON compliance_requirements FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_compliance_requirements_insert ON compliance_requirements FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_compliance_requirements_update ON compliance_requirements FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_compliance_requirements_delete ON compliance_requirements FOR DELETE USING (organization_id = current_org_id());

-- -----------------------------------------------------------------------------
-- Concierge/Phase 3 Tables
-- -----------------------------------------------------------------------------

-- property_portfolios
ALTER TABLE property_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_portfolios FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_property_portfolios_select ON property_portfolios FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_property_portfolios_insert ON property_portfolios FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_property_portfolios_update ON property_portfolios FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_property_portfolios_delete ON property_portfolios FOR DELETE USING (organization_id = current_org_id());

-- owner_intents
ALTER TABLE owner_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_intents FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_owner_intents_select ON owner_intents FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_owner_intents_insert ON owner_intents FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_owner_intents_update ON owner_intents FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_owner_intents_delete ON owner_intents FOR DELETE USING (organization_id = current_org_id());

-- concierge_cases
ALTER TABLE concierge_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_cases FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_concierge_cases_select ON concierge_cases FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_concierge_cases_insert ON concierge_cases FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_concierge_cases_update ON concierge_cases FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_concierge_cases_delete ON concierge_cases FOR DELETE USING (organization_id = current_org_id());

-- material_decisions
ALTER TABLE material_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_decisions FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_material_decisions_select ON material_decisions FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_material_decisions_insert ON material_decisions FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_material_decisions_update ON material_decisions FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_material_decisions_delete ON material_decisions FOR DELETE USING (organization_id = current_org_id());

-- external_hoa_contexts
ALTER TABLE external_hoa_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_hoa_contexts FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_external_hoa_contexts_select ON external_hoa_contexts FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_external_hoa_contexts_insert ON external_hoa_contexts FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_external_hoa_contexts_update ON external_hoa_contexts FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_external_hoa_contexts_delete ON external_hoa_contexts FOR DELETE USING (organization_id = current_org_id());

-- external_vendor_contexts
ALTER TABLE external_vendor_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_vendor_contexts FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_external_vendor_contexts_select ON external_vendor_contexts FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_external_vendor_contexts_insert ON external_vendor_contexts FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_external_vendor_contexts_update ON external_vendor_contexts FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_external_vendor_contexts_delete ON external_vendor_contexts FOR DELETE USING (organization_id = current_org_id());

-- -----------------------------------------------------------------------------
-- Other Tables
-- -----------------------------------------------------------------------------

-- offline_sync_queue
ALTER TABLE offline_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_sync_queue FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_offline_sync_queue_select ON offline_sync_queue FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY rls_offline_sync_queue_insert ON offline_sync_queue FOR INSERT WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_offline_sync_queue_update ON offline_sync_queue FOR UPDATE USING (organization_id = current_org_id());
CREATE POLICY rls_offline_sync_queue_delete ON offline_sync_queue FOR DELETE USING (organization_id = current_org_id());

-- =============================================================================
-- PART 2: ASSOCIATION-SCOPED TABLES
-- Tables scoped via association_id need join-based policies
-- =============================================================================

-- work_orders (via association)
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_work_orders_select ON work_orders FOR SELECT 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = work_orders.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_work_orders_insert ON work_orders FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM associations a WHERE a.id = work_orders.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_work_orders_update ON work_orders FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = work_orders.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_work_orders_delete ON work_orders FOR DELETE 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = work_orders.association_id AND a.organization_id = current_org_id()));

-- violations (via association)
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_violations_select ON violations FOR SELECT 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = violations.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_violations_insert ON violations FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM associations a WHERE a.id = violations.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_violations_update ON violations FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = violations.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_violations_delete ON violations FOR DELETE 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = violations.association_id AND a.organization_id = current_org_id()));

-- arc_requests (via association)
ALTER TABLE arc_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE arc_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_arc_requests_select ON arc_requests FOR SELECT 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = arc_requests.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_arc_requests_insert ON arc_requests FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM associations a WHERE a.id = arc_requests.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_arc_requests_update ON arc_requests FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = arc_requests.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_arc_requests_delete ON arc_requests FOR DELETE 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = arc_requests.association_id AND a.organization_id = current_org_id()));

-- announcements (via association)
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_announcements_select ON announcements FOR SELECT 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = announcements.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_announcements_insert ON announcements FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM associations a WHERE a.id = announcements.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_announcements_update ON announcements FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = announcements.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_announcements_delete ON announcements FOR DELETE 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = announcements.association_id AND a.organization_id = current_org_id()));

-- boards (via association)
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_boards_select ON boards FOR SELECT 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = boards.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_boards_insert ON boards FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM associations a WHERE a.id = boards.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_boards_update ON boards FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = boards.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_boards_delete ON boards FOR DELETE 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = boards.association_id AND a.organization_id = current_org_id()));

-- meetings (via association)
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_meetings_select ON meetings FOR SELECT 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = meetings.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_meetings_insert ON meetings FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM associations a WHERE a.id = meetings.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_meetings_update ON meetings FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = meetings.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_meetings_delete ON meetings FOR DELETE 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = meetings.association_id AND a.organization_id = current_org_id()));

-- gl_accounts (via association)
ALTER TABLE gl_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_gl_accounts_select ON gl_accounts FOR SELECT 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = gl_accounts.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_gl_accounts_insert ON gl_accounts FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM associations a WHERE a.id = gl_accounts.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_gl_accounts_update ON gl_accounts FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = gl_accounts.association_id AND a.organization_id = current_org_id()));
CREATE POLICY rls_gl_accounts_delete ON gl_accounts FOR DELETE 
  USING (EXISTS (SELECT 1 FROM associations a WHERE a.id = gl_accounts.association_id AND a.organization_id = current_org_id()));

-- =============================================================================
-- PART 3: STAFF WORK QUEUE LOOKUP VIEW
-- Minimal view for staff to determine org context before setting it
-- This view does NOT have RLS - it only exposes ID mappings
-- =============================================================================

CREATE OR REPLACE VIEW staff_work_queue_org_lookup AS
SELECT 
  'CONCIERGE_CASE' as item_type,
  id as item_id,
  organization_id
FROM concierge_cases
WHERE deleted_at IS NULL

UNION ALL

SELECT 
  'WORK_ORDER' as item_type,
  wo.id as item_id,
  a.organization_id
FROM work_orders wo
JOIN associations a ON a.id = wo.association_id

UNION ALL

SELECT 
  'VIOLATION' as item_type,
  v.id as item_id,
  a.organization_id
FROM violations v
JOIN associations a ON a.id = v.association_id
WHERE v.deleted_at IS NULL

UNION ALL

SELECT 
  'ARC_REQUEST' as item_type,
  ar.id as item_id,
  a.organization_id
FROM arc_requests ar
JOIN associations a ON a.id = ar.association_id;

-- Grant access to the lookup view (no RLS)
-- Note: Actual role grants depend on your PostgreSQL user setup

COMMENT ON VIEW staff_work_queue_org_lookup IS 
  'Minimal lookup view for staff to determine organization context. No RLS - only exposes item_type, item_id, and organization_id mappings.';

-- =============================================================================
-- PART 4: ORG CONTEXT AUDIT LOGGING
-- Function to log organization context switches for audit trail
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_context_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'SET' or 'CLEAR'
  reason TEXT, -- Optional reason/context for the switch
  item_type TEXT, -- e.g., 'CONCIERGE_CASE', 'WORK_ORDER'
  item_id TEXT, -- The item being accessed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_context_audit_user ON org_context_audit_log(user_id);
CREATE INDEX idx_org_context_audit_org ON org_context_audit_log(organization_id);
CREATE INDEX idx_org_context_audit_time ON org_context_audit_log(created_at);

-- Function to set org context with audit logging
CREATE OR REPLACE FUNCTION set_org_context_audited(
  p_user_id TEXT,
  p_org_id TEXT,
  p_reason TEXT DEFAULT NULL,
  p_item_type TEXT DEFAULT NULL,
  p_item_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Log the context switch
  INSERT INTO org_context_audit_log (user_id, organization_id, action, reason, item_type, item_id)
  VALUES (p_user_id, p_org_id, 'SET', p_reason, p_item_type, p_item_id);
  
  -- Set the context
  PERFORM set_current_org_id(p_org_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear org context with audit logging
CREATE OR REPLACE FUNCTION clear_org_context_audited(p_user_id TEXT) RETURNS VOID AS $$
DECLARE
  v_current_org TEXT;
BEGIN
  -- Get current org before clearing
  v_current_org := current_org_id();
  
  IF v_current_org IS NOT NULL THEN
    -- Log the context clear
    INSERT INTO org_context_audit_log (user_id, organization_id, action)
    VALUES (p_user_id, v_current_org, 'CLEAR');
  END IF;
  
  -- Clear the context
  PERFORM set_current_org_id(NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE org_context_audit_log IS 
  'Audit trail for organization context switches. Used to track when staff access different organizations data.';
