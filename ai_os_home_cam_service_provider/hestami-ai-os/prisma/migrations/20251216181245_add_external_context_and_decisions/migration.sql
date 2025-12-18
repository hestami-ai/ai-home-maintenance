-- CreateEnum
CREATE TYPE "ExternalApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'SUBMITTED', 'APPROVED', 'DENIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DecisionCategory" AS ENUM ('VENDOR_SELECTION', 'APPROVAL', 'COST_AUTHORIZATION', 'SCHEDULING', 'ESCALATION', 'RESOLUTION', 'OTHER');

-- CreateTable
CREATE TABLE "external_hoa_contexts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "hoa_name" TEXT NOT NULL,
    "hoa_contact_name" TEXT,
    "hoa_contact_email" TEXT,
    "hoa_contact_phone" TEXT,
    "hoa_address" TEXT,
    "notes" TEXT,
    "documents_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "external_hoa_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_hoa_approvals" (
    "id" TEXT NOT NULL,
    "external_hoa_context_id" TEXT NOT NULL,
    "case_id" TEXT,
    "approvalType" TEXT NOT NULL,
    "status" "ExternalApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3),
    "response_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "approval_reference" TEXT,
    "notes" TEXT,
    "related_document_ids" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "external_hoa_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_hoa_rules" (
    "id" TEXT NOT NULL,
    "external_hoa_context_id" TEXT NOT NULL,
    "rule_category" TEXT NOT NULL,
    "rule_description" TEXT NOT NULL,
    "source_document_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "external_hoa_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_vendor_contexts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "property_id" TEXT,
    "vendor_name" TEXT NOT NULL,
    "vendor_contact_name" TEXT,
    "vendor_contact_email" TEXT,
    "vendor_contact_phone" TEXT,
    "vendor_address" TEXT,
    "trade_categories" JSONB,
    "notes" TEXT,
    "linked_service_provider_org_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "external_vendor_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_vendor_interactions" (
    "id" TEXT NOT NULL,
    "external_vendor_context_id" TEXT NOT NULL,
    "case_id" TEXT,
    "interactionType" TEXT NOT NULL,
    "interaction_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "notes" TEXT,
    "related_document_ids" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_vendor_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_decisions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "case_id" TEXT,
    "category" "DecisionCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "decided_by_user_id" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL,
    "options_considered" JSONB,
    "estimated_impact" TEXT,
    "actual_outcome" TEXT,
    "outcome_recorded_at" TIMESTAMP(3),
    "related_document_ids" JSONB,
    "related_action_ids" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "material_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_hoa_contexts_organization_id_idx" ON "external_hoa_contexts"("organization_id");

-- CreateIndex
CREATE INDEX "external_hoa_contexts_property_id_idx" ON "external_hoa_contexts"("property_id");

-- CreateIndex
CREATE INDEX "external_hoa_approvals_external_hoa_context_id_idx" ON "external_hoa_approvals"("external_hoa_context_id");

-- CreateIndex
CREATE INDEX "external_hoa_approvals_case_id_idx" ON "external_hoa_approvals"("case_id");

-- CreateIndex
CREATE INDEX "external_hoa_approvals_status_idx" ON "external_hoa_approvals"("status");

-- CreateIndex
CREATE INDEX "external_hoa_rules_external_hoa_context_id_idx" ON "external_hoa_rules"("external_hoa_context_id");

-- CreateIndex
CREATE INDEX "external_hoa_rules_rule_category_idx" ON "external_hoa_rules"("rule_category");

-- CreateIndex
CREATE INDEX "external_vendor_contexts_organization_id_idx" ON "external_vendor_contexts"("organization_id");

-- CreateIndex
CREATE INDEX "external_vendor_contexts_property_id_idx" ON "external_vendor_contexts"("property_id");

-- CreateIndex
CREATE INDEX "external_vendor_contexts_linked_service_provider_org_id_idx" ON "external_vendor_contexts"("linked_service_provider_org_id");

-- CreateIndex
CREATE INDEX "external_vendor_interactions_external_vendor_context_id_idx" ON "external_vendor_interactions"("external_vendor_context_id");

-- CreateIndex
CREATE INDEX "external_vendor_interactions_case_id_idx" ON "external_vendor_interactions"("case_id");

-- CreateIndex
CREATE INDEX "external_vendor_interactions_interactionType_idx" ON "external_vendor_interactions"("interactionType");

-- CreateIndex
CREATE INDEX "material_decisions_organization_id_idx" ON "material_decisions"("organization_id");

-- CreateIndex
CREATE INDEX "material_decisions_case_id_idx" ON "material_decisions"("case_id");

-- CreateIndex
CREATE INDEX "material_decisions_category_idx" ON "material_decisions"("category");

-- CreateIndex
CREATE INDEX "material_decisions_decided_by_user_id_idx" ON "material_decisions"("decided_by_user_id");

-- AddForeignKey
ALTER TABLE "external_hoa_contexts" ADD CONSTRAINT "external_hoa_contexts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_hoa_contexts" ADD CONSTRAINT "external_hoa_contexts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "individual_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_hoa_approvals" ADD CONSTRAINT "external_hoa_approvals_external_hoa_context_id_fkey" FOREIGN KEY ("external_hoa_context_id") REFERENCES "external_hoa_contexts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_hoa_approvals" ADD CONSTRAINT "external_hoa_approvals_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_hoa_rules" ADD CONSTRAINT "external_hoa_rules_external_hoa_context_id_fkey" FOREIGN KEY ("external_hoa_context_id") REFERENCES "external_hoa_contexts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_vendor_contexts" ADD CONSTRAINT "external_vendor_contexts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_vendor_contexts" ADD CONSTRAINT "external_vendor_contexts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "individual_properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_vendor_contexts" ADD CONSTRAINT "external_vendor_contexts_linked_service_provider_org_id_fkey" FOREIGN KEY ("linked_service_provider_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_vendor_interactions" ADD CONSTRAINT "external_vendor_interactions_external_vendor_context_id_fkey" FOREIGN KEY ("external_vendor_context_id") REFERENCES "external_vendor_contexts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_vendor_interactions" ADD CONSTRAINT "external_vendor_interactions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_decisions" ADD CONSTRAINT "material_decisions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_decisions" ADD CONSTRAINT "material_decisions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_decisions" ADD CONSTRAINT "material_decisions_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
