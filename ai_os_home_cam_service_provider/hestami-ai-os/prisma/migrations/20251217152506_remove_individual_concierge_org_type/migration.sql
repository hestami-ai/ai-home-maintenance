/*
  Warnings:

  - The values [INDIVIDUAL_CONCIERGE] on the enum `OrganizationType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OrganizationType_new" AS ENUM ('COMMUNITY_ASSOCIATION', 'MANAGEMENT_COMPANY', 'SERVICE_PROVIDER', 'EXTERNAL_SERVICE_PROVIDER', 'COMMERCIAL_CLIENT', 'INDIVIDUAL_PROPERTY_OWNER', 'TRUST_OR_LLC');
ALTER TABLE "organizations" ALTER COLUMN "type" TYPE "OrganizationType_new" USING ("type"::text::"OrganizationType_new");
ALTER TYPE "OrganizationType" RENAME TO "OrganizationType_old";
ALTER TYPE "OrganizationType_new" RENAME TO "OrganizationType";
DROP TYPE "public"."OrganizationType_old";
COMMIT;
