/*
  Warnings:

  - You are about to drop the `association_documents` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DocumentContextType" AS ENUM ('ASSOCIATION', 'PROPERTY', 'UNIT', 'JOB', 'CASE', 'WORK_ORDER', 'TECHNICIAN', 'CONTRACTOR', 'VENDOR', 'PARTY', 'OWNER_INTENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentCategory" ADD VALUE 'CC_AND_RS';
ALTER TYPE "DocumentCategory" ADD VALUE 'PERMIT';
ALTER TYPE "DocumentCategory" ADD VALUE 'APPROVAL';
ALTER TYPE "DocumentCategory" ADD VALUE 'CORRESPONDENCE';
ALTER TYPE "DocumentCategory" ADD VALUE 'TITLE_DEED';
ALTER TYPE "DocumentCategory" ADD VALUE 'SURVEY';
ALTER TYPE "DocumentCategory" ADD VALUE 'WARRANTY';
ALTER TYPE "DocumentCategory" ADD VALUE 'LICENSE';
ALTER TYPE "DocumentCategory" ADD VALUE 'CERTIFICATION';
ALTER TYPE "DocumentCategory" ADD VALUE 'BOND';
ALTER TYPE "DocumentCategory" ADD VALUE 'PROPOSAL';
ALTER TYPE "DocumentCategory" ADD VALUE 'ESTIMATE';
ALTER TYPE "DocumentCategory" ADD VALUE 'INVOICE';
ALTER TYPE "DocumentCategory" ADD VALUE 'WORK_ORDER';
ALTER TYPE "DocumentCategory" ADD VALUE 'JOB_PHOTO';
ALTER TYPE "DocumentCategory" ADD VALUE 'JOB_VIDEO';
ALTER TYPE "DocumentCategory" ADD VALUE 'VOICE_NOTE';
ALTER TYPE "DocumentCategory" ADD VALUE 'SIGNATURE';
ALTER TYPE "DocumentCategory" ADD VALUE 'CHECKLIST';

-- DropForeignKey
ALTER TABLE "association_documents" DROP CONSTRAINT "association_documents_association_id_fkey";

-- DropForeignKey
ALTER TABLE "association_documents" DROP CONSTRAINT "association_documents_parent_document_id_fkey";

-- DropForeignKey
ALTER TABLE "association_documents" DROP CONSTRAINT "association_documents_superseded_by_id_fkey";

-- DropForeignKey
ALTER TABLE "document_access_grants" DROP CONSTRAINT "document_access_grants_document_id_fkey";

-- DropForeignKey
ALTER TABLE "document_download_logs" DROP CONSTRAINT "document_download_logs_document_id_fkey";

-- DropTable
DROP TABLE "association_documents";

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "DocumentCategory" NOT NULL,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "storage_provider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
    "storage_path" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "checksum" TEXT,
    "page_count" INTEGER,
    "thumbnail_url" TEXT,
    "extracted_text" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_document_id" TEXT,
    "superseded_by_id" TEXT,
    "effective_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "uploaded_by" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "archived_at" TIMESTAMP(3),
    "archived_by" TEXT,
    "archive_reason" TEXT,
    "malware_scan_status" TEXT,
    "content_moderation_status" TEXT,
    "processing_completed_at" TIMESTAMP(3),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "captured_at" TIMESTAMP(3),
    "transcription" TEXT,
    "is_transcribed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_context_bindings" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "context_type" "DocumentContextType" NOT NULL,
    "context_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "binding_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "document_context_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_organization_id_idx" ON "documents"("organization_id");

-- CreateIndex
CREATE INDEX "documents_category_idx" ON "documents"("category");

-- CreateIndex
CREATE INDEX "documents_visibility_idx" ON "documents"("visibility");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_malware_scan_status_idx" ON "documents"("malware_scan_status");

-- CreateIndex
CREATE INDEX "document_context_bindings_context_type_context_id_idx" ON "document_context_bindings"("context_type", "context_id");

-- CreateIndex
CREATE INDEX "document_context_bindings_document_id_idx" ON "document_context_bindings"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_context_bindings_document_id_context_type_context__key" ON "document_context_bindings"("document_id", "context_type", "context_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_document_id_fkey" FOREIGN KEY ("parent_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_context_bindings" ADD CONSTRAINT "document_context_bindings_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_download_logs" ADD CONSTRAINT "document_download_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
