-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "TimeEntryType" AS ENUM ('TRAVEL', 'WORK', 'BREAK', 'WAITING');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHOTO', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- CreateTable
CREATE TABLE "job_checklists" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "template_id" TEXT,
    "job_id" TEXT,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_steps" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "status" "ChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "notes" TEXT,
    "requires_photo" BOOLEAN NOT NULL DEFAULT false,
    "requires_signature" BOOLEAN NOT NULL DEFAULT false,
    "requires_notes" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_media" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "job_visit_id" TEXT,
    "mediaType" "MediaType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "storage_url" TEXT,
    "caption" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "captured_at" TIMESTAMP(3),
    "transcription" TEXT,
    "is_transcribed" BOOLEAN NOT NULL DEFAULT false,
    "is_uploaded" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_at" TIMESTAMP(3),
    "upload_retries" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_time_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "job_visit_id" TEXT,
    "technician_id" TEXT NOT NULL,
    "entry_type" "TimeEntryType" NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "notes" TEXT,
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "hourly_rate" DECIMAL(10,2),
    "is_synced" BOOLEAN NOT NULL DEFAULT true,
    "synced_at" TIMESTAMP(3),
    "local_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_signatures" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "job_visit_id" TEXT,
    "signer_name" TEXT NOT NULL,
    "signer_email" TEXT,
    "signer_role" TEXT NOT NULL,
    "signature_data" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "document_type" TEXT NOT NULL,
    "document_id" TEXT,
    "ip_address" TEXT,
    "device_info" TEXT,
    "captured_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_sync_queue" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "error_message" TEXT,
    "is_synced" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" TIMESTAMP(3),
    "synced_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offline_sync_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_checklists_organization_id_idx" ON "job_checklists"("organization_id");

-- CreateIndex
CREATE INDEX "job_checklists_job_id_idx" ON "job_checklists"("job_id");

-- CreateIndex
CREATE INDEX "job_checklists_is_template_idx" ON "job_checklists"("is_template");

-- CreateIndex
CREATE INDEX "job_steps_checklist_id_idx" ON "job_steps"("checklist_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_steps_checklist_id_step_number_key" ON "job_steps"("checklist_id", "step_number");

-- CreateIndex
CREATE INDEX "job_media_organization_id_idx" ON "job_media"("organization_id");

-- CreateIndex
CREATE INDEX "job_media_job_id_idx" ON "job_media"("job_id");

-- CreateIndex
CREATE INDEX "job_media_job_visit_id_idx" ON "job_media"("job_visit_id");

-- CreateIndex
CREATE INDEX "job_media_mediaType_idx" ON "job_media"("mediaType");

-- CreateIndex
CREATE INDEX "job_time_entries_organization_id_idx" ON "job_time_entries"("organization_id");

-- CreateIndex
CREATE INDEX "job_time_entries_job_id_idx" ON "job_time_entries"("job_id");

-- CreateIndex
CREATE INDEX "job_time_entries_technician_id_idx" ON "job_time_entries"("technician_id");

-- CreateIndex
CREATE INDEX "job_time_entries_start_time_idx" ON "job_time_entries"("start_time");

-- CreateIndex
CREATE INDEX "job_signatures_organization_id_idx" ON "job_signatures"("organization_id");

-- CreateIndex
CREATE INDEX "job_signatures_job_id_idx" ON "job_signatures"("job_id");

-- CreateIndex
CREATE INDEX "job_signatures_job_visit_id_idx" ON "job_signatures"("job_visit_id");

-- CreateIndex
CREATE INDEX "offline_sync_queue_organization_id_idx" ON "offline_sync_queue"("organization_id");

-- CreateIndex
CREATE INDEX "offline_sync_queue_technician_id_idx" ON "offline_sync_queue"("technician_id");

-- CreateIndex
CREATE INDEX "offline_sync_queue_is_synced_idx" ON "offline_sync_queue"("is_synced");

-- CreateIndex
CREATE INDEX "offline_sync_queue_entity_type_idx" ON "offline_sync_queue"("entity_type");

-- AddForeignKey
ALTER TABLE "job_checklists" ADD CONSTRAINT "job_checklists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_checklists" ADD CONSTRAINT "job_checklists_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_checklists" ADD CONSTRAINT "job_checklists_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "job_checklists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_steps" ADD CONSTRAINT "job_steps_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "job_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_media" ADD CONSTRAINT "job_media_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_media" ADD CONSTRAINT "job_media_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_time_entries" ADD CONSTRAINT "job_time_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_time_entries" ADD CONSTRAINT "job_time_entries_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_time_entries" ADD CONSTRAINT "job_time_entries_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_signatures" ADD CONSTRAINT "job_signatures_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_signatures" ADD CONSTRAINT "job_signatures_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_sync_queue" ADD CONSTRAINT "offline_sync_queue_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_sync_queue" ADD CONSTRAINT "offline_sync_queue_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;
