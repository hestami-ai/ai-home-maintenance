-- CreateEnum
CREATE TYPE "VendorApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'CONDITIONAL', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContractorTradeType" AS ENUM ('PLUMBING', 'ELECTRICAL', 'HVAC', 'ROOFING', 'LANDSCAPING', 'PAINTING', 'FLOORING', 'CARPENTRY', 'MASONRY', 'GENERAL_CONTRACTOR', 'POOL_SPA', 'PEST_CONTROL', 'CLEANING', 'SECURITY', 'FIRE_SAFETY', 'ELEVATOR', 'APPLIANCE_REPAIR', 'LOCKSMITH', 'GLASS_WINDOW', 'FENCING', 'CONCRETE', 'DEMOLITION', 'EXCAVATION', 'WATERPROOFING', 'INSULATION', 'DRYWALL', 'SIDING', 'GUTTERS', 'GARAGE_DOOR', 'OTHER');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED', 'PENDING_RENEWAL');

-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('GENERAL_LIABILITY', 'WORKERS_COMPENSATION', 'PROFESSIONAL_LIABILITY', 'AUTO_LIABILITY', 'UMBRELLA', 'BONDING');

-- CreateEnum
CREATE TYPE "InsuranceStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'PENDING_VERIFICATION', 'CANCELLED');

-- AlterEnum
ALTER TYPE "OrganizationType" ADD VALUE 'EXTERNAL_SERVICE_PROVIDER';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "external_contact_email" CITEXT,
ADD COLUMN     "external_contact_name" TEXT,
ADD COLUMN     "external_contact_phone" TEXT;

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "approval_status" "VendorApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" TEXT,
ADD COLUMN     "compliance_notes" TEXT,
ADD COLUMN     "insurance_expires_at" TIMESTAMP(3),
ADD COLUMN     "insurance_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "license_expires_at" TIMESTAMP(3),
ADD COLUMN     "license_verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "contractor_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "dba" TEXT,
    "tax_id" TEXT,
    "primary_contact_name" TEXT,
    "primary_contact_email" CITEXT,
    "primary_contact_phone" TEXT,
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "operating_hours_json" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "max_technicians" INTEGER,
    "max_service_radius" INTEGER,
    "compliance_score" INTEGER,
    "last_compliance_check" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_branches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "contact_name" TEXT,
    "contact_email" CITEXT,
    "contact_phone" TEXT,
    "address_line_1" TEXT NOT NULL,
    "address_line_2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "operating_hours_json" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "service_radius_miles" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractor_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_trades" (
    "id" TEXT NOT NULL,
    "contractor_profile_id" TEXT NOT NULL,
    "trade_type" "ContractorTradeType" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "years_experience" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractor_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_licenses" (
    "id" TEXT NOT NULL,
    "contractor_profile_id" TEXT NOT NULL,
    "license_type" TEXT NOT NULL,
    "license_number" TEXT NOT NULL,
    "issuing_authority" TEXT NOT NULL,
    "issuing_state" TEXT,
    "issue_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "document_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractor_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_insurances" (
    "id" TEXT NOT NULL,
    "contractor_profile_id" TEXT NOT NULL,
    "insurance_type" "InsuranceType" NOT NULL,
    "policy_number" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "coverage_amount" DECIMAL(12,2) NOT NULL,
    "deductible" DECIMAL(10,2),
    "effective_date" TIMESTAMP(3) NOT NULL,
    "expiration_date" TIMESTAMP(3) NOT NULL,
    "status" "InsuranceStatus" NOT NULL DEFAULT 'ACTIVE',
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "coi_document_url" TEXT,
    "additional_insured_json" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractor_insurances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_compliance_statuses" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "is_compliant" BOOLEAN NOT NULL DEFAULT false,
    "compliance_score" INTEGER NOT NULL DEFAULT 0,
    "has_valid_license" BOOLEAN NOT NULL DEFAULT false,
    "has_valid_insurance" BOOLEAN NOT NULL DEFAULT false,
    "has_w9_on_file" BOOLEAN NOT NULL DEFAULT false,
    "meets_min_coverage" BOOLEAN NOT NULL DEFAULT false,
    "earliest_license_expiry" TIMESTAMP(3),
    "earliest_insurance_expiry" TIMESTAMP(3),
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "block_reason" TEXT,
    "blocked_at" TIMESTAMP(3),
    "blocked_by" TEXT,
    "last_checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractor_compliance_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contractor_profiles_organization_id_key" ON "contractor_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "contractor_profiles_organization_id_idx" ON "contractor_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "contractor_branches_organization_id_idx" ON "contractor_branches"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "contractor_branches_organization_id_code_key" ON "contractor_branches"("organization_id", "code");

-- CreateIndex
CREATE INDEX "contractor_trades_contractor_profile_id_idx" ON "contractor_trades"("contractor_profile_id");

-- CreateIndex
CREATE INDEX "contractor_trades_trade_type_idx" ON "contractor_trades"("trade_type");

-- CreateIndex
CREATE UNIQUE INDEX "contractor_trades_contractor_profile_id_trade_type_key" ON "contractor_trades"("contractor_profile_id", "trade_type");

-- CreateIndex
CREATE INDEX "contractor_licenses_contractor_profile_id_idx" ON "contractor_licenses"("contractor_profile_id");

-- CreateIndex
CREATE INDEX "contractor_licenses_expiration_date_idx" ON "contractor_licenses"("expiration_date");

-- CreateIndex
CREATE INDEX "contractor_licenses_status_idx" ON "contractor_licenses"("status");

-- CreateIndex
CREATE INDEX "contractor_insurances_contractor_profile_id_idx" ON "contractor_insurances"("contractor_profile_id");

-- CreateIndex
CREATE INDEX "contractor_insurances_expiration_date_idx" ON "contractor_insurances"("expiration_date");

-- CreateIndex
CREATE INDEX "contractor_insurances_status_idx" ON "contractor_insurances"("status");

-- CreateIndex
CREATE INDEX "contractor_compliance_statuses_is_compliant_idx" ON "contractor_compliance_statuses"("is_compliant");

-- CreateIndex
CREATE INDEX "contractor_compliance_statuses_is_blocked_idx" ON "contractor_compliance_statuses"("is_blocked");

-- CreateIndex
CREATE INDEX "contractor_compliance_statuses_earliest_license_expiry_idx" ON "contractor_compliance_statuses"("earliest_license_expiry");

-- CreateIndex
CREATE INDEX "contractor_compliance_statuses_earliest_insurance_expiry_idx" ON "contractor_compliance_statuses"("earliest_insurance_expiry");

-- CreateIndex
CREATE UNIQUE INDEX "contractor_compliance_statuses_vendor_id_key" ON "contractor_compliance_statuses"("vendor_id");

-- CreateIndex
CREATE INDEX "vendors_approval_status_idx" ON "vendors"("approval_status");

-- AddForeignKey
ALTER TABLE "contractor_profiles" ADD CONSTRAINT "contractor_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_branches" ADD CONSTRAINT "contractor_branches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_trades" ADD CONSTRAINT "contractor_trades_contractor_profile_id_fkey" FOREIGN KEY ("contractor_profile_id") REFERENCES "contractor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_licenses" ADD CONSTRAINT "contractor_licenses_contractor_profile_id_fkey" FOREIGN KEY ("contractor_profile_id") REFERENCES "contractor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_insurances" ADD CONSTRAINT "contractor_insurances_contractor_profile_id_fkey" FOREIGN KEY ("contractor_profile_id") REFERENCES "contractor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
