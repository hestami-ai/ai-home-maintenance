-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('COMMUNITY_ASSOCIATION', 'MANAGEMENT_COMPANY', 'SERVICE_PROVIDER', 'INDIVIDUAL_CONCIERGE', 'COMMERCIAL_CLIENT');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'TENANT', 'MANAGER', 'VENDOR', 'BOARD_MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AssociationStatus" AS ENUM ('ACTIVE', 'ONBOARDING', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('SINGLE_FAMILY', 'CONDOMINIUM', 'TOWNHOUSE', 'COOPERATIVE', 'MIXED_USE', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('SINGLE_FAMILY_HOME', 'CONDO_UNIT', 'TOWNHOUSE', 'LOT', 'COMMERCIAL_UNIT');

-- CreateEnum
CREATE TYPE "AmenityType" AS ENUM ('POOL', 'CLUBHOUSE', 'GYM', 'TENNIS_COURT', 'PLAYGROUND', 'PARK', 'GATE', 'PARKING', 'OTHER');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('INDIVIDUAL', 'TRUST', 'CORPORATION', 'LLC', 'PARTNERSHIP', 'ESTATE');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('FEE_SIMPLE', 'JOINT_TENANCY', 'TENANCY_IN_COMMON', 'COMMUNITY_PROPERTY', 'TRUST');

-- CreateEnum
CREATE TYPE "ManagerAssignmentType" AS ENUM ('COMMUNITY_MANAGER', 'PORTFOLIO_MANAGER', 'ASSISTANT_MANAGER');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_organizations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OWNER',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "id_token" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "response" JSONB,
    "status_code" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "associations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "tax_id" TEXT,
    "status" "AssociationStatus" NOT NULL DEFAULT 'ONBOARDING',
    "incorporation_date" TIMESTAMP(3),
    "fiscal_year_end" INTEGER NOT NULL DEFAULT 12,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "property_type" "PropertyType" NOT NULL,
    "address_line_1" TEXT NOT NULL,
    "address_line_2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "year_built" INTEGER,
    "total_units" INTEGER NOT NULL DEFAULT 0,
    "total_acres" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "unit_number" TEXT NOT NULL,
    "unit_type" "UnitType" NOT NULL,
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "square_feet" INTEGER,
    "lot_square_feet" INTEGER,
    "parking_spaces" INTEGER NOT NULL DEFAULT 0,
    "assessment_class" TEXT,
    "voting_weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "common_areas" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amenity_type" "AmenityType" NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "reservable" BOOLEAN NOT NULL DEFAULT false,
    "max_capacity" INTEGER,
    "operating_hours" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "common_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "party_type" "PartyType" NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "entity_name" TEXT,
    "email" CITEXT,
    "phone" TEXT,
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT DEFAULT 'US',
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownerships" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "ownership_type" "OwnershipType" NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "mailing_address" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenancies" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "lease_start" TIMESTAMP(3) NOT NULL,
    "lease_end" TIMESTAMP(3),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_contracts" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "management_company_id" TEXT NOT NULL,
    "contract_number" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "monthly_fee" DECIMAL(10,2),
    "terms" JSONB,
    "service_levels" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "management_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "assignment_type" "ManagerAssignmentType" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "max_units" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manager_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_organizations_organization_id_idx" ON "user_organizations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_organizations_user_id_organization_id_key" ON "user_organizations"("user_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_id_account_id_key" ON "accounts"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_organization_id_key" ON "idempotency_keys"("key", "organization_id");

-- CreateIndex
CREATE INDEX "associations_organization_id_idx" ON "associations"("organization_id");

-- CreateIndex
CREATE INDEX "properties_association_id_idx" ON "properties"("association_id");

-- CreateIndex
CREATE INDEX "units_property_id_idx" ON "units"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "units_property_id_unit_number_key" ON "units"("property_id", "unit_number");

-- CreateIndex
CREATE INDEX "common_areas_property_id_idx" ON "common_areas"("property_id");

-- CreateIndex
CREATE INDEX "parties_organization_id_idx" ON "parties"("organization_id");

-- CreateIndex
CREATE INDEX "parties_user_id_idx" ON "parties"("user_id");

-- CreateIndex
CREATE INDEX "parties_email_idx" ON "parties"("email");

-- CreateIndex
CREATE INDEX "ownerships_unit_id_idx" ON "ownerships"("unit_id");

-- CreateIndex
CREATE INDEX "ownerships_party_id_idx" ON "ownerships"("party_id");

-- CreateIndex
CREATE INDEX "ownerships_end_date_idx" ON "ownerships"("end_date");

-- CreateIndex
CREATE INDEX "tenancies_unit_id_idx" ON "tenancies"("unit_id");

-- CreateIndex
CREATE INDEX "tenancies_party_id_idx" ON "tenancies"("party_id");

-- CreateIndex
CREATE INDEX "tenancies_lease_end_idx" ON "tenancies"("lease_end");

-- CreateIndex
CREATE INDEX "management_contracts_association_id_idx" ON "management_contracts"("association_id");

-- CreateIndex
CREATE INDEX "management_contracts_management_company_id_idx" ON "management_contracts"("management_company_id");

-- CreateIndex
CREATE INDEX "manager_assignments_user_id_idx" ON "manager_assignments"("user_id");

-- CreateIndex
CREATE INDEX "manager_assignments_association_id_idx" ON "manager_assignments"("association_id");

-- CreateIndex
CREATE INDEX "manager_assignments_end_date_idx" ON "manager_assignments"("end_date");

-- CreateIndex
CREATE UNIQUE INDEX "manager_assignments_user_id_association_id_assignment_type_key" ON "manager_assignments"("user_id", "association_id", "assignment_type");

-- AddForeignKey
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "associations" ADD CONSTRAINT "associations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "common_areas" ADD CONSTRAINT "common_areas_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownerships" ADD CONSTRAINT "ownerships_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownerships" ADD CONSTRAINT "ownerships_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_contracts" ADD CONSTRAINT "management_contracts_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_contracts" ADD CONSTRAINT "management_contracts_management_company_id_fkey" FOREIGN KEY ("management_company_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_assignments" ADD CONSTRAINT "manager_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_assignments" ADD CONSTRAINT "manager_assignments_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
