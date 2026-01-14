/*
  Warnings:

  - You are about to drop the `arc_documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `violation_evidence` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentCategory" ADD VALUE 'ARC_ATTACHMENT';
ALTER TYPE "DocumentCategory" ADD VALUE 'VIOLATION_EVIDENCE';
ALTER TYPE "DocumentCategory" ADD VALUE 'AUDIO';

-- DropForeignKey
ALTER TABLE "arc_documents" DROP CONSTRAINT "arc_documents_request_id_fkey";

-- DropForeignKey
ALTER TABLE "violation_evidence" DROP CONSTRAINT "violation_evidence_violation_id_fkey";

-- DropTable
DROP TABLE "arc_documents";

-- DropTable
DROP TABLE "violation_evidence";

-- CreateTable
CREATE TABLE "user_association_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_association_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_association_preferences_user_id_idx" ON "user_association_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_association_preferences_organization_id_idx" ON "user_association_preferences"("organization_id");

-- CreateIndex
CREATE INDEX "user_association_preferences_association_id_idx" ON "user_association_preferences"("association_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_association_preferences_user_id_organization_id_key" ON "user_association_preferences"("user_id", "organization_id");

-- AddForeignKey
ALTER TABLE "user_association_preferences" ADD CONSTRAINT "user_association_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_association_preferences" ADD CONSTRAINT "user_association_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_association_preferences" ADD CONSTRAINT "user_association_preferences_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
