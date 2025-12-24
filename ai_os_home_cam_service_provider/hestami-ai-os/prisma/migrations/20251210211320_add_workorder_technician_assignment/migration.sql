-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "assigned_technician_branch_id" TEXT,
ADD COLUMN     "assigned_technician_id" TEXT;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_technician_id_fkey" FOREIGN KEY ("assigned_technician_id") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;
