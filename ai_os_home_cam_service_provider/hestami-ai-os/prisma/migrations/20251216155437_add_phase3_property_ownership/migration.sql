-- CreateEnum
CREATE TYPE "PropertyOwnershipRole" AS ENUM ('OWNER', 'CO_OWNER', 'TRUSTEE_MANAGER', 'DELEGATED_AGENT');

-- CreateEnum
CREATE TYPE "PropertyOwnershipStatus" AS ENUM ('ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "DelegatedAuthorityType" AS ENUM ('MAINTENANCE_APPROVAL', 'VENDOR_SELECTION', 'DOCUMENT_ACCESS', 'CASE_MANAGEMENT', 'FINANCIAL_DECISIONS', 'FULL_AUTHORITY');

-- CreateEnum
CREATE TYPE "DelegatedAuthorityStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'PENDING_ACCEPTANCE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrganizationType" ADD VALUE 'INDIVIDUAL_PROPERTY_OWNER';
ALTER TYPE "OrganizationType" ADD VALUE 'TRUST_OR_LLC';

-- CreateTable
CREATE TABLE "property_ownerships" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "role" "PropertyOwnershipRole" NOT NULL,
    "status" "PropertyOwnershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownership_percentage" DECIMAL(5,2),
    "is_primary_contact" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "property_ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegated_authorities" (
    "id" TEXT NOT NULL,
    "property_ownership_id" TEXT NOT NULL,
    "delegate_party_id" TEXT NOT NULL,
    "authorityType" "DelegatedAuthorityType" NOT NULL,
    "status" "DelegatedAuthorityStatus" NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
    "monetary_limit" DECIMAL(12,2),
    "scope_description" TEXT,
    "scope_restrictions" JSONB,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoked_by" TEXT,
    "revoke_reason" TEXT,
    "granted_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delegated_authorities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_ownerships_property_id_idx" ON "property_ownerships"("property_id");

-- CreateIndex
CREATE INDEX "property_ownerships_party_id_idx" ON "property_ownerships"("party_id");

-- CreateIndex
CREATE INDEX "property_ownerships_status_idx" ON "property_ownerships"("status");

-- CreateIndex
CREATE UNIQUE INDEX "property_ownerships_property_id_party_id_role_key" ON "property_ownerships"("property_id", "party_id", "role");

-- CreateIndex
CREATE INDEX "delegated_authorities_property_ownership_id_idx" ON "delegated_authorities"("property_ownership_id");

-- CreateIndex
CREATE INDEX "delegated_authorities_delegate_party_id_idx" ON "delegated_authorities"("delegate_party_id");

-- CreateIndex
CREATE INDEX "delegated_authorities_status_idx" ON "delegated_authorities"("status");

-- CreateIndex
CREATE INDEX "delegated_authorities_authorityType_idx" ON "delegated_authorities"("authorityType");

-- AddForeignKey
ALTER TABLE "property_ownerships" ADD CONSTRAINT "property_ownerships_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "individual_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_ownerships" ADD CONSTRAINT "property_ownerships_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegated_authorities" ADD CONSTRAINT "delegated_authorities_property_ownership_id_fkey" FOREIGN KEY ("property_ownership_id") REFERENCES "property_ownerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegated_authorities" ADD CONSTRAINT "delegated_authorities_delegate_party_id_fkey" FOREIGN KEY ("delegate_party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
