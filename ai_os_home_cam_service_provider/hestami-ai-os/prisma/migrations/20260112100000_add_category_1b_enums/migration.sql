-- Add Category 1b enums for R8 violations fix
-- These enums replace String fields that were previously storing enum-like values

-- CreateEnum
CREATE TYPE "ReporterType" AS ENUM ('STAFF', 'RESIDENT', 'ANONYMOUS');

-- CreateEnum
CREATE TYPE "AppealDecision" AS ENUM ('UPHELD', 'MODIFIED', 'OVERTURNED');

-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'MONEY_MARKET');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('EMERGENCY', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "JobVisitStatus" AS ENUM ('SCHEDULED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VendorInteractionType" AS ENUM ('QUOTE', 'SCHEDULE', 'WORK', 'INVOICE', 'OTHER');

-- DropIndex (will be recreated with new column name)
DROP INDEX IF EXISTS "external_vendor_interactions_interactionType_idx";

-- AlterTable: bank_accounts - Convert String to Enum
ALTER TABLE "bank_accounts"
  ALTER COLUMN "account_type" TYPE "BankAccountType" USING "account_type"::"BankAccountType";

-- AlterTable: violations - Convert String to Enum (nullable)
ALTER TABLE "violations"
  ALTER COLUMN "reporter_type" TYPE "ReporterType" USING "reporter_type"::"ReporterType";

-- AlterTable: jobs - Convert String to Enum with default
-- Need to drop default first, convert, then set default
ALTER TABLE "jobs" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "jobs"
  ALTER COLUMN "priority" TYPE "JobPriority" USING "priority"::"JobPriority";
ALTER TABLE "jobs" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM'::"JobPriority";

-- AlterTable: job_visits - Convert String to Enum with default
-- Need to drop default first, convert, then set default
ALTER TABLE "job_visits" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "job_visits"
  ALTER COLUMN "status" TYPE "JobVisitStatus" USING "status"::"JobVisitStatus";
ALTER TABLE "job_visits" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED'::"JobVisitStatus";

-- AlterTable: external_vendor_interactions - Rename and convert column
ALTER TABLE "external_vendor_interactions"
  RENAME COLUMN "interactionType" TO "interaction_type";
ALTER TABLE "external_vendor_interactions"
  ALTER COLUMN "interaction_type" TYPE "VendorInteractionType" USING "interaction_type"::"VendorInteractionType";

-- CreateIndex (with new column name)
CREATE INDEX "external_vendor_interactions_interaction_type_idx" ON "external_vendor_interactions"("interaction_type");
