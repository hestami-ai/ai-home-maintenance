-- CreateEnum
CREATE TYPE "WorkOrderOriginType" AS ENUM ('VIOLATION_REMEDIATION', 'ARC_APPROVAL', 'PREVENTIVE_MAINTENANCE', 'BOARD_DIRECTIVE', 'EMERGENCY_ACTION', 'MANUAL');

-- CreateEnum
CREATE TYPE "BoardApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkOrderStatus" ADD VALUE 'AUTHORIZED';
ALTER TYPE "WorkOrderStatus" ADD VALUE 'REVIEW_REQUIRED';

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "approved_amount" DECIMAL(12,2),
ADD COLUMN     "arc_request_id" TEXT,
ADD COLUMN     "authorization_rationale" TEXT,
ADD COLUMN     "authorized_at" TIMESTAMP(3),
ADD COLUMN     "authorized_by" TEXT,
ADD COLUMN     "authorizing_role" TEXT,
ADD COLUMN     "board_approval_status" "BoardApprovalStatus",
ADD COLUMN     "board_approval_vote_id" TEXT,
ADD COLUMN     "budget_source" "FundType",
ADD COLUMN     "constraints" TEXT,
ADD COLUMN     "origin_notes" TEXT,
ADD COLUMN     "origin_type" "WorkOrderOriginType",
ADD COLUMN     "requires_board_approval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resolution_id" TEXT,
ADD COLUMN     "spend_to_date" DECIMAL(12,2),
ADD COLUMN     "violation_id" TEXT;

-- CreateIndex
CREATE INDEX "work_orders_origin_type_idx" ON "work_orders"("origin_type");

-- CreateIndex
CREATE INDEX "work_orders_violation_id_idx" ON "work_orders"("violation_id");

-- CreateIndex
CREATE INDEX "work_orders_arc_request_id_idx" ON "work_orders"("arc_request_id");

-- CreateIndex
CREATE INDEX "work_orders_resolution_id_idx" ON "work_orders"("resolution_id");

-- CreateIndex
CREATE INDEX "work_orders_board_approval_vote_id_idx" ON "work_orders"("board_approval_vote_id");

-- CreateIndex
CREATE INDEX "work_orders_requires_board_approval_idx" ON "work_orders"("requires_board_approval");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_violation_id_fkey" FOREIGN KEY ("violation_id") REFERENCES "violations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_arc_request_id_fkey" FOREIGN KEY ("arc_request_id") REFERENCES "arc_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_resolution_id_fkey" FOREIGN KEY ("resolution_id") REFERENCES "resolutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_board_approval_vote_id_fkey" FOREIGN KEY ("board_approval_vote_id") REFERENCES "votes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
