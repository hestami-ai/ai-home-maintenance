-- CreateEnum
CREATE TYPE "BoardMotionCategory" AS ENUM ('POLICY', 'BUDGET', 'ASSESSMENT', 'ENFORCEMENT', 'CONTRACT', 'CAPITAL_PROJECT', 'RULE_CHANGE', 'ELECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "BoardMotionStatus" AS ENUM ('PROPOSED', 'SECONDED', 'UNDER_DISCUSSION', 'TABLED', 'VOTING', 'DECIDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "BoardMotionOutcome" AS ENUM ('PASSED', 'FAILED', 'TABLED', 'WITHDRAWN', 'AMENDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentContextType" ADD VALUE 'BOARD_MOTION';
ALTER TYPE "DocumentContextType" ADD VALUE 'RESOLUTION';
ALTER TYPE "DocumentContextType" ADD VALUE 'MEETING';

-- CreateTable
CREATE TABLE "board_motions" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "meeting_id" TEXT,
    "vote_id" TEXT,
    "motion_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "BoardMotionCategory" NOT NULL,
    "status" "BoardMotionStatus" NOT NULL DEFAULT 'PROPOSED',
    "moved_by_id" TEXT,
    "seconded_by_id" TEXT,
    "rationale" TEXT,
    "outcome" "BoardMotionOutcome",
    "outcome_notes" TEXT,
    "decided_at" TIMESTAMP(3),
    "effective_date" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_motions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "board_motions_association_id_idx" ON "board_motions"("association_id");

-- CreateIndex
CREATE INDEX "board_motions_meeting_id_idx" ON "board_motions"("meeting_id");

-- CreateIndex
CREATE INDEX "board_motions_status_idx" ON "board_motions"("status");

-- CreateIndex
CREATE INDEX "board_motions_category_idx" ON "board_motions"("category");

-- CreateIndex
CREATE UNIQUE INDEX "board_motions_association_id_motion_number_key" ON "board_motions"("association_id", "motion_number");

-- AddForeignKey
ALTER TABLE "board_motions" ADD CONSTRAINT "board_motions_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_motions" ADD CONSTRAINT "board_motions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
