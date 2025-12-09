/*
  Warnings:

  - Added the required column `storage_path` to the `association_documents` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'S3', 'AZURE_BLOB', 'GCS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentCategory" ADD VALUE 'RESERVE_STUDY';
ALTER TYPE "DocumentCategory" ADD VALUE 'INSPECTION';
ALTER TYPE "DocumentCategory" ADD VALUE 'CONTRACT';

-- AlterTable
ALTER TABLE "association_documents" ADD COLUMN     "archive_reason" TEXT,
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "archived_by" TEXT,
ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "extracted_text" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "page_count" INTEGER,
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "storage_path" TEXT NOT NULL,
ADD COLUMN     "storage_provider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "superseded_by_id" TEXT,
ADD COLUMN     "thumbnail_url" TEXT;

-- CreateIndex
CREATE INDEX "association_documents_status_idx" ON "association_documents"("status");

-- AddForeignKey
ALTER TABLE "association_documents" ADD CONSTRAINT "association_documents_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "association_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
