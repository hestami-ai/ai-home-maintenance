-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "association_id" TEXT;

-- CreateIndex
CREATE INDEX "documents_organization_id_association_id_idx" ON "documents"("organization_id", "association_id");

-- CreateIndex
CREATE INDEX "documents_organization_id_association_id_status_idx" ON "documents"("organization_id", "association_id", "status");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
