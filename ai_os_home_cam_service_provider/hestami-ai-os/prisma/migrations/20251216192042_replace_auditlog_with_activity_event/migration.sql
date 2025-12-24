/*
  Warnings:

  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ActivityEntityType" AS ENUM ('ASSOCIATION', 'UNIT', 'OWNER', 'VIOLATION', 'ARC_REQUEST', 'ASSESSMENT', 'GOVERNING_DOCUMENT', 'BOARD_ACTION', 'JOB', 'WORK_ORDER', 'ESTIMATE', 'INVOICE', 'TECHNICIAN', 'CONTRACTOR', 'INVENTORY', 'CONCIERGE_CASE', 'OWNER_INTENT', 'INDIVIDUAL_PROPERTY', 'PROPERTY_DOCUMENT', 'MATERIAL_DECISION', 'EXTERNAL_HOA', 'EXTERNAL_VENDOR', 'CONCIERGE_ACTION', 'USER', 'USER_ROLE', 'ORGANIZATION', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ActivityActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'APPROVE', 'DENY', 'ASSIGN', 'UNASSIGN', 'SUBMIT', 'CANCEL', 'COMPLETE', 'SCHEDULE', 'DISPATCH', 'CLOSE', 'REOPEN', 'ESCALATE', 'ROLE_CHANGE', 'LOGIN', 'LOGOUT', 'WORKFLOW_INITIATED', 'WORKFLOW_COMPLETED', 'WORKFLOW_FAILED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ActivityActorType" AS ENUM ('HUMAN', 'AI', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActivityEventCategory" AS ENUM ('INTENT', 'DECISION', 'EXECUTION', 'SYSTEM');

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_organization_id_fkey";

-- DropTable
DROP TABLE "audit_logs";

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entity_type" "ActivityEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "ActivityActionType" NOT NULL,
    "event_category" "ActivityEventCategory" NOT NULL,
    "summary" TEXT NOT NULL,
    "performed_by_id" TEXT,
    "performed_by_type" "ActivityActorType" NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "association_id" TEXT,
    "unit_id" TEXT,
    "violation_id" TEXT,
    "arc_request_id" TEXT,
    "job_id" TEXT,
    "work_order_id" TEXT,
    "technician_id" TEXT,
    "case_id" TEXT,
    "intent_id" TEXT,
    "property_id" TEXT,
    "decision_id" TEXT,
    "previous_state" JSONB,
    "new_state" JSONB,
    "metadata" JSONB,
    "trace_id" TEXT,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_events_organization_id_performed_at_idx" ON "activity_events"("organization_id", "performed_at");

-- CreateIndex
CREATE INDEX "activity_events_organization_id_entity_type_entity_id_idx" ON "activity_events"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "activity_events_organization_id_event_category_idx" ON "activity_events"("organization_id", "event_category");

-- CreateIndex
CREATE INDEX "activity_events_organization_id_performed_by_type_idx" ON "activity_events"("organization_id", "performed_by_type");

-- CreateIndex
CREATE INDEX "activity_events_association_id_idx" ON "activity_events"("association_id");

-- CreateIndex
CREATE INDEX "activity_events_case_id_idx" ON "activity_events"("case_id");

-- CreateIndex
CREATE INDEX "activity_events_job_id_idx" ON "activity_events"("job_id");

-- CreateIndex
CREATE INDEX "activity_events_work_order_id_idx" ON "activity_events"("work_order_id");

-- CreateIndex
CREATE INDEX "activity_events_intent_id_idx" ON "activity_events"("intent_id");

-- CreateIndex
CREATE INDEX "activity_events_property_id_idx" ON "activity_events"("property_id");

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
