-- CreateEnum
CREATE TYPE "ConciergeActionType" AS ENUM ('PHONE_CALL', 'EMAIL', 'DOCUMENT_REVIEW', 'RESEARCH', 'VENDOR_CONTACT', 'HOA_CONTACT', 'SCHEDULING', 'APPROVAL_REQUEST', 'FOLLOW_UP', 'ESCALATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ConciergeActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'BLOCKED');

-- CreateTable
CREATE TABLE "concierge_actions" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "actionType" "ConciergeActionType" NOT NULL,
    "status" "ConciergeActionStatus" NOT NULL DEFAULT 'PLANNED',
    "description" TEXT NOT NULL,
    "planned_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "performed_by_user_id" TEXT NOT NULL,
    "outcome" TEXT,
    "notes" TEXT,
    "related_document_ids" JSONB,
    "related_external_contact_ids" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "concierge_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concierge_action_logs" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "from_status" "ConciergeActionStatus",
    "to_status" "ConciergeActionStatus",
    "description" TEXT,
    "changed_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concierge_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "concierge_actions_case_id_idx" ON "concierge_actions"("case_id");

-- CreateIndex
CREATE INDEX "concierge_actions_performed_by_user_id_idx" ON "concierge_actions"("performed_by_user_id");

-- CreateIndex
CREATE INDEX "concierge_actions_status_idx" ON "concierge_actions"("status");

-- CreateIndex
CREATE INDEX "concierge_actions_actionType_idx" ON "concierge_actions"("actionType");

-- CreateIndex
CREATE INDEX "concierge_action_logs_action_id_idx" ON "concierge_action_logs"("action_id");

-- CreateIndex
CREATE INDEX "concierge_action_logs_created_at_idx" ON "concierge_action_logs"("created_at");

-- AddForeignKey
ALTER TABLE "concierge_actions" ADD CONSTRAINT "concierge_actions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concierge_actions" ADD CONSTRAINT "concierge_actions_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concierge_action_logs" ADD CONSTRAINT "concierge_action_logs_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "concierge_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
