-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityActionType" ADD VALUE 'REQUEST_INFO';
ALTER TYPE "ActivityActionType" ADD VALUE 'RESPOND';
ALTER TYPE "ActivityActionType" ADD VALUE 'LINK';

-- AlterTable
ALTER TABLE "concierge_cases" ADD COLUMN     "linked_arc_request_id" TEXT,
ADD COLUMN     "linked_work_order_id" TEXT;
