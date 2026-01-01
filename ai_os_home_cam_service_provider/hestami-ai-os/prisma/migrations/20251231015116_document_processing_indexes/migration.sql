-- CreateIndex
CREATE INDEX "documents_status_processing_next_retry_at_idx" ON "documents"("status", "processing_next_retry_at");

-- CreateIndex
CREATE INDEX "documents_organization_id_status_idx" ON "documents"("organization_id", "status");
