-- CreateEnum
CREATE TYPE "ServiceProviderLinkStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "IndividualRequestStatus" AS ENUM ('SUBMITTED', 'REVIEWING', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "service_areas" (
    "id" TEXT NOT NULL,
    "service_provider_org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zip_codes" TEXT[],
    "radius" INTEGER,
    "center_lat" DOUBLE PRECISION,
    "center_lng" DOUBLE PRECISION,
    "service_categories" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_provider_links" (
    "id" TEXT NOT NULL,
    "service_provider_org_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "status" "ServiceProviderLinkStatus" NOT NULL DEFAULT 'PENDING',
    "linked_at" TIMESTAMP(3),
    "linked_by" TEXT,
    "verification_code" TEXT,
    "verification_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_provider_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "individual_properties" (
    "id" TEXT NOT NULL,
    "owner_org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "property_type" "PropertyType" NOT NULL,
    "address_line_1" TEXT NOT NULL,
    "address_line_2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "year_built" INTEGER,
    "square_feet" INTEGER,
    "lot_square_feet" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "individual_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "individual_assets" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "install_date" TIMESTAMP(3),
    "warranty_expires" TIMESTAMP(3),
    "last_service_date" TIMESTAMP(3),
    "condition" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "individual_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "individual_maintenance_requests" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "request_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" "IndividualRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "preferred_date" TIMESTAMP(3),
    "scheduled_date" TIMESTAMP(3),
    "completed_date" TIMESTAMP(3),
    "assigned_vendor_org_id" TEXT,
    "estimated_cost" DECIMAL(10,2),
    "actual_cost" DECIMAL(10,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "individual_maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_areas_service_provider_org_id_idx" ON "service_areas"("service_provider_org_id");

-- CreateIndex
CREATE INDEX "service_provider_links_service_provider_org_id_idx" ON "service_provider_links"("service_provider_org_id");

-- CreateIndex
CREATE INDEX "service_provider_links_vendor_id_idx" ON "service_provider_links"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_provider_links_service_provider_org_id_vendor_id_key" ON "service_provider_links"("service_provider_org_id", "vendor_id");

-- CreateIndex
CREATE INDEX "individual_properties_owner_org_id_idx" ON "individual_properties"("owner_org_id");

-- CreateIndex
CREATE INDEX "individual_assets_property_id_idx" ON "individual_assets"("property_id");

-- CreateIndex
CREATE INDEX "individual_maintenance_requests_property_id_idx" ON "individual_maintenance_requests"("property_id");

-- CreateIndex
CREATE INDEX "individual_maintenance_requests_status_idx" ON "individual_maintenance_requests"("status");

-- CreateIndex
CREATE INDEX "individual_maintenance_requests_assigned_vendor_org_id_idx" ON "individual_maintenance_requests"("assigned_vendor_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "individual_maintenance_requests_property_id_request_number_key" ON "individual_maintenance_requests"("property_id", "request_number");

-- AddForeignKey
ALTER TABLE "service_areas" ADD CONSTRAINT "service_areas_service_provider_org_id_fkey" FOREIGN KEY ("service_provider_org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_provider_links" ADD CONSTRAINT "service_provider_links_service_provider_org_id_fkey" FOREIGN KEY ("service_provider_org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_provider_links" ADD CONSTRAINT "service_provider_links_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "individual_properties" ADD CONSTRAINT "individual_properties_owner_org_id_fkey" FOREIGN KEY ("owner_org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "individual_assets" ADD CONSTRAINT "individual_assets_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "individual_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "individual_maintenance_requests" ADD CONSTRAINT "individual_maintenance_requests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "individual_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "individual_maintenance_requests" ADD CONSTRAINT "individual_maintenance_requests_assigned_vendor_org_id_fkey" FOREIGN KEY ("assigned_vendor_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
