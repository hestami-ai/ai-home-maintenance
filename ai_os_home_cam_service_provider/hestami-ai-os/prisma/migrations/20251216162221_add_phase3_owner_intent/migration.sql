-- CreateEnum
CREATE TYPE "OwnerIntentCategory" AS ENUM ('MAINTENANCE', 'IMPROVEMENT', 'COMPLIANCE', 'DISPUTE', 'INQUIRY', 'EMERGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "OwnerIntentPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "OwnerIntentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'CONVERTED_TO_CASE', 'DECLINED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "owner_intents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "OwnerIntentCategory" NOT NULL,
    "priority" "OwnerIntentPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "OwnerIntentStatus" NOT NULL DEFAULT 'DRAFT',
    "constraints" JSONB,
    "attachments" JSONB,
    "submitted_by_party_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "converted_case_id" TEXT,
    "converted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "declined_by" TEXT,
    "decline_reason" TEXT,
    "withdrawn_at" TIMESTAMP(3),
    "withdraw_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "owner_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intent_notes" (
    "id" TEXT NOT NULL,
    "intent_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intent_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owner_intents_organization_id_idx" ON "owner_intents"("organization_id");

-- CreateIndex
CREATE INDEX "owner_intents_property_id_idx" ON "owner_intents"("property_id");

-- CreateIndex
CREATE INDEX "owner_intents_status_idx" ON "owner_intents"("status");

-- CreateIndex
CREATE INDEX "owner_intents_category_idx" ON "owner_intents"("category");

-- CreateIndex
CREATE INDEX "owner_intents_priority_idx" ON "owner_intents"("priority");

-- CreateIndex
CREATE INDEX "intent_notes_intent_id_idx" ON "intent_notes"("intent_id");

-- AddForeignKey
ALTER TABLE "owner_intents" ADD CONSTRAINT "owner_intents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_intents" ADD CONSTRAINT "owner_intents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "individual_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_intents" ADD CONSTRAINT "owner_intents_submitted_by_party_id_fkey" FOREIGN KEY ("submitted_by_party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intent_notes" ADD CONSTRAINT "intent_notes_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "owner_intents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
