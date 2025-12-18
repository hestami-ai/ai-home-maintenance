/*
  Warnings:

  - The values [VOTING,DECIDED] on the enum `BoardMotionStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [HELD] on the enum `MeetingStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BoardMotionStatus_new" AS ENUM ('PROPOSED', 'SECONDED', 'UNDER_DISCUSSION', 'UNDER_VOTE', 'TABLED', 'APPROVED', 'DENIED', 'WITHDRAWN');
ALTER TABLE "public"."board_motions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "board_motions" ALTER COLUMN "status" TYPE "BoardMotionStatus_new" USING ("status"::text::"BoardMotionStatus_new");
ALTER TYPE "BoardMotionStatus" RENAME TO "BoardMotionStatus_old";
ALTER TYPE "BoardMotionStatus_new" RENAME TO "BoardMotionStatus";
DROP TYPE "public"."BoardMotionStatus_old";
ALTER TABLE "board_motions" ALTER COLUMN "status" SET DEFAULT 'PROPOSED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "MeetingStatus_new" AS ENUM ('SCHEDULED', 'IN_SESSION', 'ADJOURNED', 'MINUTES_DRAFT', 'MINUTES_APPROVED', 'ARCHIVED', 'CANCELLED');
ALTER TABLE "public"."meetings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "meetings" ALTER COLUMN "status" TYPE "MeetingStatus_new" USING ("status"::text::"MeetingStatus_new");
ALTER TYPE "MeetingStatus" RENAME TO "MeetingStatus_old";
ALTER TYPE "MeetingStatus_new" RENAME TO "MeetingStatus";
DROP TYPE "public"."MeetingStatus_old";
ALTER TABLE "meetings" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
COMMIT;

-- AlterTable
ALTER TABLE "meeting_agenda_items" ADD COLUMN     "arc_request_id" TEXT,
ADD COLUMN     "policy_document_id" TEXT,
ADD COLUMN     "time_allotment" INTEGER,
ADD COLUMN     "violation_id" TEXT,
ADD COLUMN     "work_order_id" TEXT;

-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "quorum_required" INTEGER,
ADD COLUMN     "virtual_link" TEXT;

-- AlterTable
ALTER TABLE "votes" ADD COLUMN     "motion_id" TEXT;

-- CreateIndex
CREATE INDEX "meeting_agenda_items_arc_request_id_idx" ON "meeting_agenda_items"("arc_request_id");

-- CreateIndex
CREATE INDEX "meeting_agenda_items_violation_id_idx" ON "meeting_agenda_items"("violation_id");

-- CreateIndex
CREATE INDEX "meeting_agenda_items_work_order_id_idx" ON "meeting_agenda_items"("work_order_id");

-- CreateIndex
CREATE INDEX "meeting_agenda_items_policy_document_id_idx" ON "meeting_agenda_items"("policy_document_id");

-- CreateIndex
CREATE INDEX "votes_motion_id_idx" ON "votes"("motion_id");

-- AddForeignKey
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_arc_request_id_fkey" FOREIGN KEY ("arc_request_id") REFERENCES "arc_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_violation_id_fkey" FOREIGN KEY ("violation_id") REFERENCES "violations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_policy_document_id_fkey" FOREIGN KEY ("policy_document_id") REFERENCES "policy_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_motion_id_fkey" FOREIGN KEY ("motion_id") REFERENCES "board_motions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
