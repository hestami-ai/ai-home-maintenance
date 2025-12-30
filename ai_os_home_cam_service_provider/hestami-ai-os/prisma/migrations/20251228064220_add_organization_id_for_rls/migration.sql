/*
  Phase 21: RLS Table Migration
  
  This migration adds organization_id columns to 15 tables for direct RLS enforcement.
  All these tables currently link to Organization indirectly via Association.
  
  Strategy:
  1. Add columns as nullable
  2. Backfill organization_id from the association's organization_id
  3. Make columns NOT NULL
  4. Add foreign keys and indexes
*/

-- =============================================================================
-- STEP 1: Add organization_id columns as NULLABLE
-- =============================================================================

-- Tables linked via association_id
ALTER TABLE "properties" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "units" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "violation_types" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "violations" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "gl_accounts" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "bank_accounts" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "assessment_types" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "vendors" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "assets" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "work_orders" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "arc_requests" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "arc_committees" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "boards" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "meetings" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "policy_documents" ADD COLUMN "organization_id" TEXT;

-- =============================================================================
-- STEP 2: Backfill organization_id from association's organization_id
-- =============================================================================

-- Properties: Get org from association
UPDATE "properties" p
SET "organization_id" = a."organization_id"
FROM "associations" a
WHERE p."association_id" = a."id";

-- Units: Get org from property's association
UPDATE "units" u
SET "organization_id" = a."organization_id"
FROM "properties" p
JOIN "associations" a ON p."association_id" = a."id"
WHERE u."property_id" = p."id";

-- Violation Types: Get org from association
UPDATE "violation_types" vt
SET "organization_id" = a."organization_id"
FROM "associations" a
WHERE vt."association_id" = a."id";

-- Violations: Get org from association
UPDATE "violations" v
SET "organization_id" = a."organization_id"
FROM "associations" a
WHERE v."association_id" = a."id";

-- GL Accounts: Get org from association
UPDATE "gl_accounts" gl
SET "organization_id" = a."organization_id"
FROM "associations" a
WHERE gl."association_id" = a."id";

-- Bank Accounts: Get org from association
UPDATE "bank_accounts" ba
SET "organization_id" = a."organization_id"
FROM "associations" a
WHERE ba."association_id" = a."id";

-- Assessment Types: Get org from association
UPDATE "assessment_types" at
SET "organization_id" = a."organization_id"
FROM "associations" a
WHERE at."association_id" = a."id";

-- Vendors: Get org from association
UPDATE "vendors" v
SET "organization_id" = a."organization_id"
FROM "associations" a
WHERE v."association_id" = a."id";

-- Assets: Get org from association
UPDATE "assets" ast
SET "organization_id" = a."organization_id"
FROM "associations" a
WHERE ast."association_id" = a."id";

-- Work Orders: Get org from association
UPDATE "work_orders" wo
SET "organization_id" = a."organization_id"
FROM "associations" a
WHERE wo."association_id" = a."id";

-- ARC Requests: Get org from association
UPDATE "arc_requests" ar
SET "organization_id" = a."organization_id"
FROM "associations" a
WHERE ar."association_id" = a."id";

-- ARC Committees: Get org from association
UPDATE "arc_committees" ac
SET "organization_id" = a."organization_id"
FROM "associations" a
WHERE ac."association_id" = a."id";

-- Boards: Get org from association
UPDATE "boards" b
SET "organization_id" = a."organization_id"
FROM "associations" a
WHERE b."association_id" = a."id";

-- Meetings: Get org from association
UPDATE "meetings" m
SET "organization_id" = a."organization_id"
FROM "associations" a
WHERE m."association_id" = a."id";

-- Policy Documents: Get org from association
UPDATE "policy_documents" pd
SET "organization_id" = a."organization_id"
FROM "associations" a
WHERE pd."association_id" = a."id";

-- =============================================================================
-- STEP 3: Make columns NOT NULL
-- =============================================================================

ALTER TABLE "properties" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "units" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "violation_types" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "violations" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "gl_accounts" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "bank_accounts" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "assessment_types" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "vendors" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "assets" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "work_orders" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "arc_requests" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "arc_committees" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "boards" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "meetings" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "policy_documents" ALTER COLUMN "organization_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "arc_committees_organization_id_idx" ON "arc_committees"("organization_id");

-- CreateIndex
CREATE INDEX "arc_requests_organization_id_idx" ON "arc_requests"("organization_id");

-- CreateIndex
CREATE INDEX "assessment_types_organization_id_idx" ON "assessment_types"("organization_id");

-- CreateIndex
CREATE INDEX "assets_organization_id_idx" ON "assets"("organization_id");

-- CreateIndex
CREATE INDEX "bank_accounts_organization_id_idx" ON "bank_accounts"("organization_id");

-- CreateIndex
CREATE INDEX "boards_organization_id_idx" ON "boards"("organization_id");

-- CreateIndex
CREATE INDEX "gl_accounts_organization_id_idx" ON "gl_accounts"("organization_id");

-- CreateIndex
CREATE INDEX "meetings_organization_id_idx" ON "meetings"("organization_id");

-- CreateIndex
CREATE INDEX "policy_documents_organization_id_idx" ON "policy_documents"("organization_id");

-- CreateIndex
CREATE INDEX "properties_organization_id_idx" ON "properties"("organization_id");

-- CreateIndex
CREATE INDEX "units_organization_id_idx" ON "units"("organization_id");

-- CreateIndex
CREATE INDEX "vendors_organization_id_idx" ON "vendors"("organization_id");

-- CreateIndex
CREATE INDEX "violation_types_organization_id_idx" ON "violation_types"("organization_id");

-- CreateIndex
CREATE INDEX "violations_organization_id_idx" ON "violations"("organization_id");

-- CreateIndex
CREATE INDEX "work_orders_organization_id_idx" ON "work_orders"("organization_id");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation_types" ADD CONSTRAINT "violation_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_types" ADD CONSTRAINT "assessment_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arc_requests" ADD CONSTRAINT "arc_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arc_committees" ADD CONSTRAINT "arc_committees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- STEP 4: Create RLS Policies for migrated tables
-- =============================================================================

-- Enable RLS on all migrated tables
ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "violation_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "violations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gl_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assessment_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "arc_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "arc_committees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "boards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meetings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "policy_documents" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies using direct organization_id column
-- Policy pattern: Allow access when current_setting('app.current_org_id') matches organization_id

-- Properties
CREATE POLICY "properties_org_isolation" ON "properties"
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));

-- Units
CREATE POLICY "units_org_isolation" ON "units"
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));

-- Violation Types
CREATE POLICY "violation_types_org_isolation" ON "violation_types"
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));

-- Violations
CREATE POLICY "violations_org_isolation" ON "violations"
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));

-- GL Accounts
CREATE POLICY "gl_accounts_org_isolation" ON "gl_accounts"
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));

-- Bank Accounts
CREATE POLICY "bank_accounts_org_isolation" ON "bank_accounts"
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));

-- Assessment Types
CREATE POLICY "assessment_types_org_isolation" ON "assessment_types"
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));

-- Vendors
CREATE POLICY "vendors_org_isolation" ON "vendors"
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));

-- Assets
CREATE POLICY "assets_org_isolation" ON "assets"
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));

-- Work Orders
CREATE POLICY "work_orders_org_isolation" ON "work_orders"
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));

-- ARC Requests
CREATE POLICY "arc_requests_org_isolation" ON "arc_requests"
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));

-- ARC Committees
CREATE POLICY "arc_committees_org_isolation" ON "arc_committees"
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));

-- Boards
CREATE POLICY "boards_org_isolation" ON "boards"
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));

-- Meetings
CREATE POLICY "meetings_org_isolation" ON "meetings"
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));

-- Policy Documents
CREATE POLICY "policy_documents_org_isolation" ON "policy_documents"
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));
