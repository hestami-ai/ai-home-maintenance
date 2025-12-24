-- CreateEnum
CREATE TYPE "OwnerRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OwnerRequestCategory" AS ENUM ('GENERAL_INQUIRY', 'MAINTENANCE', 'BILLING', 'ARCHITECTURAL', 'VIOLATION', 'GOVERNANCE', 'AMENITY', 'OTHER');

-- CreateTable
CREATE TABLE "owner_requests" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "unit_id" TEXT,
    "party_id" TEXT NOT NULL,
    "request_number" TEXT NOT NULL,
    "category" "OwnerRequestCategory" NOT NULL,
    "status" "OwnerRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachments" JSONB,
    "submitted_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "assigned_to_user_id" TEXT,
    "resolution_notes" TEXT,
    "work_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "owner_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_request_history" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previous_status" TEXT,
    "new_status" TEXT,
    "notes" TEXT,
    "performed_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_request_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owner_requests_party_id_idx" ON "owner_requests"("party_id");

-- CreateIndex
CREATE INDEX "owner_requests_unit_id_idx" ON "owner_requests"("unit_id");

-- CreateIndex
CREATE INDEX "owner_requests_status_idx" ON "owner_requests"("status");

-- CreateIndex
CREATE INDEX "owner_requests_category_idx" ON "owner_requests"("category");

-- CreateIndex
CREATE UNIQUE INDEX "owner_requests_association_id_request_number_key" ON "owner_requests"("association_id", "request_number");

-- CreateIndex
CREATE INDEX "owner_request_history_request_id_idx" ON "owner_request_history"("request_id");

-- AddForeignKey
ALTER TABLE "owner_requests" ADD CONSTRAINT "owner_requests_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_requests" ADD CONSTRAINT "owner_requests_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_requests" ADD CONSTRAINT "owner_requests_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_requests" ADD CONSTRAINT "owner_requests_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_request_history" ADD CONSTRAINT "owner_request_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "owner_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
