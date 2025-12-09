-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('PUBLIC', 'OWNERS_ONLY', 'BOARD_ONLY', 'STAFF_ONLY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('GOVERNING_DOCS', 'FINANCIAL', 'MEETING', 'LEGAL', 'INSURANCE', 'MAINTENANCE', 'ARCHITECTURAL', 'GENERAL');

-- CreateTable
CREATE TABLE "association_documents" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "DocumentCategory" NOT NULL,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'PUBLIC',
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_document_id" TEXT,
    "effective_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "uploaded_by" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "association_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_access_grants" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "granted_by" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "document_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_download_logs" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "party_id" TEXT,
    "user_id" TEXT NOT NULL,
    "downloaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "document_download_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "association_documents_association_id_idx" ON "association_documents"("association_id");

-- CreateIndex
CREATE INDEX "association_documents_category_idx" ON "association_documents"("category");

-- CreateIndex
CREATE INDEX "association_documents_visibility_idx" ON "association_documents"("visibility");

-- CreateIndex
CREATE INDEX "document_access_grants_party_id_idx" ON "document_access_grants"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_access_grants_document_id_party_id_key" ON "document_access_grants"("document_id", "party_id");

-- CreateIndex
CREATE INDEX "document_download_logs_document_id_idx" ON "document_download_logs"("document_id");

-- CreateIndex
CREATE INDEX "document_download_logs_party_id_idx" ON "document_download_logs"("party_id");

-- CreateIndex
CREATE INDEX "document_download_logs_downloaded_at_idx" ON "document_download_logs"("downloaded_at");

-- AddForeignKey
ALTER TABLE "association_documents" ADD CONSTRAINT "association_documents_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_documents" ADD CONSTRAINT "association_documents_parent_document_id_fkey" FOREIGN KEY ("parent_document_id") REFERENCES "association_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "association_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_download_logs" ADD CONSTRAINT "document_download_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "association_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_download_logs" ADD CONSTRAINT "document_download_logs_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
