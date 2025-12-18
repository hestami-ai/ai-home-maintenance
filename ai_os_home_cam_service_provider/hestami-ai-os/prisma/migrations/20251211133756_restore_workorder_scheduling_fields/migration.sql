-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "assigned_technician_branch_id" TEXT,
ADD COLUMN     "scheduled_end" TIMESTAMP(3),
ADD COLUMN     "scheduled_start" TIMESTAMP(3);
