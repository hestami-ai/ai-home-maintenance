-- CreateEnum
CREATE TYPE "ConciergeCaseStatus" AS ENUM ('INTAKE', 'ASSESSMENT', 'IN_PROGRESS', 'PENDING_EXTERNAL', 'PENDING_OWNER', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConciergeCasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT', 'EMERGENCY');

-- CreateTable
CREATE TABLE "concierge_cases" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "case_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ConciergeCaseStatus" NOT NULL DEFAULT 'INTAKE',
    "priority" "ConciergeCasePriority" NOT NULL DEFAULT 'NORMAL',
    "origin_intent_id" TEXT,
    "assigned_concierge_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "resolution_summary" TEXT,
    "resolved_by" TEXT,
    "cancel_reason" TEXT,
    "cancelled_by" TEXT,

    CONSTRAINT "concierge_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_status_history" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "from_status" "ConciergeCaseStatus",
    "to_status" "ConciergeCaseStatus" NOT NULL,
    "reason" TEXT,
    "changed_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_notes" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_attachments" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "description" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_participants" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "party_id" TEXT,
    "external_contact_name" TEXT,
    "external_contact_email" TEXT,
    "external_contact_phone" TEXT,
    "role" TEXT NOT NULL,
    "notes" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by" TEXT NOT NULL,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "case_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "concierge_cases_case_number_key" ON "concierge_cases"("case_number");

-- CreateIndex
CREATE INDEX "concierge_cases_organization_id_idx" ON "concierge_cases"("organization_id");

-- CreateIndex
CREATE INDEX "concierge_cases_property_id_idx" ON "concierge_cases"("property_id");

-- CreateIndex
CREATE INDEX "concierge_cases_status_idx" ON "concierge_cases"("status");

-- CreateIndex
CREATE INDEX "concierge_cases_priority_idx" ON "concierge_cases"("priority");

-- CreateIndex
CREATE INDEX "concierge_cases_assigned_concierge_user_id_idx" ON "concierge_cases"("assigned_concierge_user_id");

-- CreateIndex
CREATE INDEX "concierge_cases_case_number_idx" ON "concierge_cases"("case_number");

-- CreateIndex
CREATE INDEX "case_status_history_case_id_idx" ON "case_status_history"("case_id");

-- CreateIndex
CREATE INDEX "case_status_history_created_at_idx" ON "case_status_history"("created_at");

-- CreateIndex
CREATE INDEX "case_notes_case_id_idx" ON "case_notes"("case_id");

-- CreateIndex
CREATE INDEX "case_attachments_case_id_idx" ON "case_attachments"("case_id");

-- CreateIndex
CREATE INDEX "case_participants_case_id_idx" ON "case_participants"("case_id");

-- CreateIndex
CREATE INDEX "case_participants_party_id_idx" ON "case_participants"("party_id");

-- AddForeignKey
ALTER TABLE "concierge_cases" ADD CONSTRAINT "concierge_cases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concierge_cases" ADD CONSTRAINT "concierge_cases_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "individual_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concierge_cases" ADD CONSTRAINT "concierge_cases_assigned_concierge_user_id_fkey" FOREIGN KEY ("assigned_concierge_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_attachments" ADD CONSTRAINT "case_attachments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_participants" ADD CONSTRAINT "case_participants_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_participants" ADD CONSTRAINT "case_participants_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
