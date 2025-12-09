-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('PROPOSED', 'ADOPTED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- AlterTable
ALTER TABLE "votes" ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "quorum_required" INTEGER;

-- CreateTable
CREATE TABLE "resolutions" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "board_id" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "ResolutionStatus" NOT NULL DEFAULT 'PROPOSED',
    "effective_date" TIMESTAMP(3),
    "superseded_by_id" TEXT,
    "adopted_at" TIMESTAMP(3),
    "proposed_by" TEXT,
    "adopted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_documents" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "resolution_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "current_version" TEXT,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" TEXT NOT NULL,
    "policy_document_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resolutions_association_id_idx" ON "resolutions"("association_id");

-- CreateIndex
CREATE INDEX "resolutions_board_id_idx" ON "resolutions"("board_id");

-- CreateIndex
CREATE INDEX "resolutions_status_idx" ON "resolutions"("status");

-- CreateIndex
CREATE INDEX "policy_documents_association_id_idx" ON "policy_documents"("association_id");

-- CreateIndex
CREATE INDEX "policy_documents_resolution_id_idx" ON "policy_documents"("resolution_id");

-- CreateIndex
CREATE INDEX "policy_documents_status_idx" ON "policy_documents"("status");

-- CreateIndex
CREATE INDEX "policy_versions_policy_document_id_idx" ON "policy_versions"("policy_document_id");

-- CreateIndex
CREATE INDEX "policy_versions_status_idx" ON "policy_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "policy_versions_policy_document_id_version_key" ON "policy_versions"("policy_document_id", "version");

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "resolutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_resolution_id_fkey" FOREIGN KEY ("resolution_id") REFERENCES "resolutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_document_id_fkey" FOREIGN KEY ("policy_document_id") REFERENCES "policy_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
