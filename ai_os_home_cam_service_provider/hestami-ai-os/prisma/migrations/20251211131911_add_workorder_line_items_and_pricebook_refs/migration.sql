/*
  Warnings:

  - You are about to drop the column `body_template` on the `notice_templates` table. All the data in the column will be lost.
  - You are about to drop the column `default_cure_period_days` on the `notice_templates` table. All the data in the column will be lost.
  - You are about to drop the column `notice_type` on the `notice_templates` table. All the data in the column will be lost.
  - You are about to drop the column `from_status` on the `violation_status_history` table. All the data in the column will be lost.
  - You are about to drop the column `to_status` on the `violation_status_history` table. All the data in the column will be lost.
  - You are about to drop the column `assigned_technician_branch_id` on the `work_orders` table. All the data in the column will be lost.
  - You are about to drop the column `scheduled_end` on the `work_orders` table. All the data in the column will be lost.
  - You are about to drop the column `scheduled_start` on the `work_orders` table. All the data in the column will be lost.
  - You are about to drop the `notice_sequence_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notice_sequence_steps` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `violation_appeals` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `body` to the `notice_templates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `toStatus` to the `violation_status_history` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "notice_sequence_configs" DROP CONSTRAINT "notice_sequence_configs_violation_type_id_fkey";

-- DropForeignKey
ALTER TABLE "notice_sequence_steps" DROP CONSTRAINT "notice_sequence_steps_sequence_id_fkey";

-- DropForeignKey
ALTER TABLE "notice_sequence_steps" DROP CONSTRAINT "notice_sequence_steps_template_id_fkey";

-- DropForeignKey
ALTER TABLE "violation_appeals" DROP CONSTRAINT "violation_appeals_hearing_id_fkey";

-- DropIndex
DROP INDEX "notice_templates_association_id_name_key";

-- DropIndex
DROP INDEX "notice_templates_notice_type_idx";

-- DropIndex
DROP INDEX "violation_types_category_idx";

-- AlterTable
ALTER TABLE "notice_templates" DROP COLUMN "body_template",
DROP COLUMN "default_cure_period_days",
DROP COLUMN "notice_type",
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "violation_status_history" DROP COLUMN "from_status",
DROP COLUMN "to_status",
ADD COLUMN     "fromStatus" "ViolationStatus",
ADD COLUMN     "toStatus" "ViolationStatus" NOT NULL;

-- AlterTable
ALTER TABLE "violations" ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "work_orders" DROP COLUMN "assigned_technician_branch_id",
DROP COLUMN "scheduled_end",
DROP COLUMN "scheduled_start",
ADD COLUMN     "job_template_id" TEXT,
ADD COLUMN     "pricebook_version_id" TEXT;

-- DropTable
DROP TABLE "notice_sequence_configs";

-- DropTable
DROP TABLE "notice_sequence_steps";

-- DropTable
DROP TABLE "violation_appeals";

-- CreateTable
CREATE TABLE "work_order_line_items" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "pricebook_item_id" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "line_number" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "itemCode" TEXT,
    "itemName" TEXT,
    "itemType" "PricebookItemType",
    "unitOfMeasure" TEXT,
    "trade" "ContractorTradeType",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_order_line_items_work_order_id_idx" ON "work_order_line_items"("work_order_id");

-- CreateIndex
CREATE INDEX "work_order_line_items_pricebook_item_id_idx" ON "work_order_line_items"("pricebook_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_line_items_work_order_id_line_number_key" ON "work_order_line_items"("work_order_id", "line_number");

-- CreateIndex
CREATE INDEX "work_orders_pricebook_version_id_idx" ON "work_orders"("pricebook_version_id");

-- CreateIndex
CREATE INDEX "work_orders_job_template_id_idx" ON "work_orders"("job_template_id");

-- AddForeignKey
ALTER TABLE "violation_types" ADD CONSTRAINT "violation_types_warning_template_id_fkey" FOREIGN KEY ("warning_template_id") REFERENCES "notice_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation_types" ADD CONSTRAINT "violation_types_notice_template_id_fkey" FOREIGN KEY ("notice_template_id") REFERENCES "notice_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_pricebook_version_id_fkey" FOREIGN KEY ("pricebook_version_id") REFERENCES "pricebook_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_job_template_id_fkey" FOREIGN KEY ("job_template_id") REFERENCES "job_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_line_items" ADD CONSTRAINT "work_order_line_items_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_line_items" ADD CONSTRAINT "work_order_line_items_pricebook_item_id_fkey" FOREIGN KEY ("pricebook_item_id") REFERENCES "pricebook_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
