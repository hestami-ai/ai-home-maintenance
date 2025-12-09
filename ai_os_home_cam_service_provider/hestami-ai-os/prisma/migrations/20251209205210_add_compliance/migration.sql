-- CreateEnum
CREATE TYPE "ComplianceRequirementType" AS ENUM ('STATUTORY_DEADLINE', 'NOTICE_REQUIREMENT', 'VOTING_RULE', 'FINANCIAL_AUDIT', 'RESALE_PACKET', 'INSURANCE', 'MEETING', 'FILING', 'RECORD_RETENTION', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'WAIVED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "RecurrencePattern" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

-- CreateTable
CREATE TABLE "compliance_requirements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ComplianceRequirementType" NOT NULL,
    "jurisdiction" TEXT,
    "recurrence" "RecurrencePattern" NOT NULL DEFAULT 'ANNUAL',
    "default_due_day_of_year" INTEGER,
    "default_lead_days" INTEGER NOT NULL DEFAULT 30,
    "requires_evidence" BOOLEAN NOT NULL DEFAULT false,
    "evidence_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "statutory_reference" TEXT,
    "penalty_description" TEXT,
    "checklist_template" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "compliance_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_deadlines" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMP(3) NOT NULL,
    "reminder_date" TIMESTAMP(3),
    "status" "ComplianceStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "evidence_document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "fiscal_year" INTEGER,
    "recurrence_index" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_checklist_items" (
    "id" TEXT NOT NULL,
    "deadline_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "evidence_document_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compliance_requirements_organization_id_idx" ON "compliance_requirements"("organization_id");

-- CreateIndex
CREATE INDEX "compliance_requirements_type_idx" ON "compliance_requirements"("type");

-- CreateIndex
CREATE INDEX "compliance_requirements_jurisdiction_idx" ON "compliance_requirements"("jurisdiction");

-- CreateIndex
CREATE INDEX "compliance_deadlines_association_id_idx" ON "compliance_deadlines"("association_id");

-- CreateIndex
CREATE INDEX "compliance_deadlines_requirement_id_idx" ON "compliance_deadlines"("requirement_id");

-- CreateIndex
CREATE INDEX "compliance_deadlines_due_date_idx" ON "compliance_deadlines"("due_date");

-- CreateIndex
CREATE INDEX "compliance_deadlines_status_idx" ON "compliance_deadlines"("status");

-- CreateIndex
CREATE INDEX "compliance_checklist_items_deadline_id_idx" ON "compliance_checklist_items"("deadline_id");

-- AddForeignKey
ALTER TABLE "compliance_requirements" ADD CONSTRAINT "compliance_requirements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_deadlines" ADD CONSTRAINT "compliance_deadlines_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_deadlines" ADD CONSTRAINT "compliance_deadlines_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "compliance_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_checklist_items" ADD CONSTRAINT "compliance_checklist_items_deadline_id_fkey" FOREIGN KEY ("deadline_id") REFERENCES "compliance_deadlines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
