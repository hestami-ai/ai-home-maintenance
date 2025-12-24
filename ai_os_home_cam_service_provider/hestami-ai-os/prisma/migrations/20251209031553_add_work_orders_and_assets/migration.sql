-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNDER_REPAIR', 'DISPOSED');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('HVAC', 'PLUMBING', 'ELECTRICAL', 'STRUCTURAL', 'LANDSCAPING', 'POOL_SPA', 'ELEVATOR', 'SECURITY', 'FIRE_SAFETY', 'COMMON_AREA', 'EQUIPMENT', 'VEHICLE', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'TRIAGED', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'INVOICED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderPriority" AS ENUM ('EMERGENCY', 'HIGH', 'MEDIUM', 'LOW', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "WorkOrderCategory" AS ENUM ('MAINTENANCE', 'REPAIR', 'INSPECTION', 'INSTALLATION', 'REPLACEMENT', 'EMERGENCY', 'PREVENTIVE', 'LANDSCAPING', 'CLEANING', 'SECURITY', 'OTHER');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('REQUESTED', 'PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "asset_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "AssetCategory" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "unit_id" TEXT,
    "common_area_name" TEXT,
    "location_details" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "purchase_date" DATE,
    "install_date" DATE,
    "warranty_expires" DATE,
    "warranty_details" TEXT,
    "purchase_cost" DECIMAL(10,2),
    "current_value" DECIMAL(10,2),
    "maintenance_frequency_days" INTEGER,
    "last_maintenance_date" DATE,
    "next_maintenance_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_maintenance_logs" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "maintenance_date" DATE NOT NULL,
    "maintenance_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "performed_by" TEXT,
    "cost" DECIMAL(10,2),
    "work_order_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "asset_maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_provider_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "description" TEXT,
    "service_categories" TEXT[],
    "service_area_radius" INTEGER,
    "service_zip_codes" TEXT[],
    "insurance_expires" DATE,
    "insurance_amount" DECIMAL(12,2),
    "license_number" TEXT,
    "license_expires" DATE,
    "bonded_amount" DECIMAL(12,2),
    "average_rating" DECIMAL(2,1),
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_provider_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "association_service_providers" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "service_provider_id" TEXT NOT NULL,
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "is_approved" BOOLEAN NOT NULL DEFAULT true,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "contract_start_date" DATE,
    "contract_end_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "association_service_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "work_order_number" TEXT NOT NULL,
    "category" "WorkOrderCategory" NOT NULL,
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit_id" TEXT,
    "common_area_name" TEXT,
    "asset_id" TEXT,
    "location_details" TEXT,
    "requested_by" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_vendor_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "assigned_by" TEXT,
    "scheduled_start" TIMESTAMP(3),
    "scheduled_end" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "estimated_cost" DECIMAL(10,2),
    "actual_cost" DECIMAL(10,2),
    "estimated_hours" DECIMAL(5,2),
    "actual_hours" DECIMAL(5,2),
    "resolution_notes" TEXT,
    "invoice_id" TEXT,
    "sla_deadline" TIMESTAMP(3),
    "sla_met" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_status_history" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "from_status" "WorkOrderStatus",
    "to_status" "WorkOrderStatus" NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "work_order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_comments" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_attachments" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "description" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attachment_type" TEXT NOT NULL,

    CONSTRAINT "work_order_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_bids" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'REQUESTED',
    "labor_cost" DECIMAL(10,2),
    "materials_cost" DECIMAL(10,2),
    "total_amount" DECIMAL(10,2),
    "estimated_hours" DECIMAL(5,2),
    "proposed_start_date" TIMESTAMP(3),
    "proposed_end_date" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "notes" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "responded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_bids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assets_association_id_idx" ON "assets"("association_id");

-- CreateIndex
CREATE INDEX "assets_unit_id_idx" ON "assets"("unit_id");

-- CreateIndex
CREATE INDEX "assets_category_idx" ON "assets"("category");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "assets_association_id_asset_number_key" ON "assets"("association_id", "asset_number");

-- CreateIndex
CREATE INDEX "asset_maintenance_logs_asset_id_idx" ON "asset_maintenance_logs"("asset_id");

-- CreateIndex
CREATE INDEX "asset_maintenance_logs_maintenance_date_idx" ON "asset_maintenance_logs"("maintenance_date");

-- CreateIndex
CREATE UNIQUE INDEX "service_provider_profiles_organization_id_key" ON "service_provider_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "service_provider_profiles_service_categories_idx" ON "service_provider_profiles"("service_categories");

-- CreateIndex
CREATE INDEX "association_service_providers_association_id_idx" ON "association_service_providers"("association_id");

-- CreateIndex
CREATE INDEX "association_service_providers_service_provider_id_idx" ON "association_service_providers"("service_provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "association_service_providers_association_id_service_provid_key" ON "association_service_providers"("association_id", "service_provider_id");

-- CreateIndex
CREATE INDEX "work_orders_association_id_idx" ON "work_orders"("association_id");

-- CreateIndex
CREATE INDEX "work_orders_unit_id_idx" ON "work_orders"("unit_id");

-- CreateIndex
CREATE INDEX "work_orders_asset_id_idx" ON "work_orders"("asset_id");

-- CreateIndex
CREATE INDEX "work_orders_assigned_vendor_id_idx" ON "work_orders"("assigned_vendor_id");

-- CreateIndex
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");

-- CreateIndex
CREATE INDEX "work_orders_priority_idx" ON "work_orders"("priority");

-- CreateIndex
CREATE INDEX "work_orders_requested_at_idx" ON "work_orders"("requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_association_id_work_order_number_key" ON "work_orders"("association_id", "work_order_number");

-- CreateIndex
CREATE INDEX "work_order_status_history_work_order_id_idx" ON "work_order_status_history"("work_order_id");

-- CreateIndex
CREATE INDEX "work_order_status_history_changed_at_idx" ON "work_order_status_history"("changed_at");

-- CreateIndex
CREATE INDEX "work_order_comments_work_order_id_idx" ON "work_order_comments"("work_order_id");

-- CreateIndex
CREATE INDEX "work_order_attachments_work_order_id_idx" ON "work_order_attachments"("work_order_id");

-- CreateIndex
CREATE INDEX "work_order_bids_work_order_id_idx" ON "work_order_bids"("work_order_id");

-- CreateIndex
CREATE INDEX "work_order_bids_vendor_id_idx" ON "work_order_bids"("vendor_id");

-- CreateIndex
CREATE INDEX "work_order_bids_status_idx" ON "work_order_bids"("status");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_bids_work_order_id_vendor_id_key" ON "work_order_bids"("work_order_id", "vendor_id");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenance_logs" ADD CONSTRAINT "asset_maintenance_logs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenance_logs" ADD CONSTRAINT "asset_maintenance_logs_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_service_providers" ADD CONSTRAINT "association_service_providers_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_service_providers" ADD CONSTRAINT "association_service_providers_service_provider_id_fkey" FOREIGN KEY ("service_provider_id") REFERENCES "service_provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_vendor_id_fkey" FOREIGN KEY ("assigned_vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_status_history" ADD CONSTRAINT "work_order_status_history_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_comments" ADD CONSTRAINT "work_order_comments_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_attachments" ADD CONSTRAINT "work_order_attachments_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_bids" ADD CONSTRAINT "work_order_bids_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_bids" ADD CONSTRAINT "work_order_bids_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
