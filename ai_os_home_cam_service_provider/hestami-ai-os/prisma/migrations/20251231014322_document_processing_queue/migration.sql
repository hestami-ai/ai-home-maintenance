-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentStatus" ADD VALUE 'PENDING_UPLOAD';
ALTER TYPE "DocumentStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "DocumentStatus" ADD VALUE 'PROCESSING_FAILED';
ALTER TYPE "DocumentStatus" ADD VALUE 'INFECTED';

-- AlterTable
ALTER TABLE "ap_invoices" ALTER COLUMN "invoice_date" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "due_date" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "assessment_charges" ALTER COLUMN "charge_date" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "due_date" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "period_start" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "period_end" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "asset_maintenance_logs" ALTER COLUMN "maintenance_date" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "assets" ALTER COLUMN "purchase_date" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "install_date" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "warranty_expires" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "last_maintenance_date" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "next_maintenance_date" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "association_service_providers" ALTER COLUMN "contract_start_date" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "contract_end_date" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "contract_renewals" ALTER COLUMN "previous_end_date" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "new_end_date" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "contract_schedules" ALTER COLUMN "start_date" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "end_date" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "contract_sla_records" ALTER COLUMN "period_start" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "period_end" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "processing_attempt_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "processing_error_details" JSONB,
ADD COLUMN     "processing_error_message" TEXT,
ADD COLUMN     "processing_error_type" TEXT,
ADD COLUMN     "processing_next_retry_at" TIMESTAMPTZ(3),
ADD COLUMN     "processing_started_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "journal_entries" ALTER COLUMN "entry_date" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "payment_date" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "route_plans" ALTER COLUMN "route_date" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "scheduled_visits" ALTER COLUMN "scheduled_date" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "service_contracts" ALTER COLUMN "start_date" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "end_date" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "next_billing_date" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "service_provider_profiles" ALTER COLUMN "insurance_expires" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "license_expires" SET DATA TYPE TIMESTAMPTZ(3);
