-- CreateEnum
CREATE TYPE "ViolationStatus" AS ENUM ('DRAFT', 'OPEN', 'NOTICE_SENT', 'CURE_PERIOD', 'CURED', 'ESCALATED', 'HEARING_SCHEDULED', 'HEARING_HELD', 'FINE_ASSESSED', 'APPEALED', 'CLOSED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ViolationSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NoticeType" AS ENUM ('WARNING', 'FIRST_NOTICE', 'SECOND_NOTICE', 'FINAL_NOTICE', 'FINE_NOTICE', 'HEARING_NOTICE', 'CURE_CONFIRMATION');

-- CreateEnum
CREATE TYPE "NoticeDeliveryMethod" AS ENUM ('EMAIL', 'MAIL', 'CERTIFIED_MAIL', 'POSTED', 'HAND_DELIVERED', 'PORTAL');

-- CreateEnum
CREATE TYPE "HearingOutcome" AS ENUM ('PENDING', 'UPHELD', 'MODIFIED', 'DISMISSED', 'CONTINUED');

-- CreateTable
CREATE TABLE "violation_types" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "ccnr_section" TEXT,
    "rule_reference" TEXT,
    "default_severity" "ViolationSeverity" NOT NULL DEFAULT 'MODERATE',
    "default_cure_period_days" INTEGER NOT NULL DEFAULT 14,
    "first_fine_amount" DECIMAL(10,2),
    "second_fine_amount" DECIMAL(10,2),
    "subsequent_fine_amount" DECIMAL(10,2),
    "max_fine_amount" DECIMAL(10,2),
    "warning_template_id" TEXT,
    "notice_template_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "violation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violations" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "violation_number" TEXT NOT NULL,
    "violation_type_id" TEXT NOT NULL,
    "unit_id" TEXT,
    "common_area_name" TEXT,
    "location_details" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "ViolationSeverity" NOT NULL,
    "status" "ViolationStatus" NOT NULL DEFAULT 'DRAFT',
    "observed_date" TIMESTAMP(3) NOT NULL,
    "reported_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cure_period_ends" TIMESTAMP(3),
    "cured_date" TIMESTAMP(3),
    "closed_date" TIMESTAMP(3),
    "responsible_party_id" TEXT,
    "reported_by" TEXT NOT NULL,
    "reporter_type" TEXT,
    "total_fines_assessed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_fines_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_fines_waived" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notice_count" INTEGER NOT NULL DEFAULT 0,
    "last_notice_date" TIMESTAMP(3),
    "last_notice_type" "NoticeType",
    "resolution_notes" TEXT,
    "closed_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violation_evidence" (
    "id" TEXT NOT NULL,
    "violation_id" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "description" TEXT,
    "captured_at" TIMESTAMP(3),
    "captured_by" TEXT,
    "gps_latitude" DECIMAL(10,8),
    "gps_longitude" DECIMAL(11,8),
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "violation_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violation_notices" (
    "id" TEXT NOT NULL,
    "violation_id" TEXT NOT NULL,
    "notice_type" "NoticeType" NOT NULL,
    "notice_number" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "delivery_method" "NoticeDeliveryMethod" NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "recipient_address" TEXT,
    "recipient_email" TEXT,
    "sent_date" TIMESTAMP(3) NOT NULL,
    "delivered_date" TIMESTAMP(3),
    "cure_period_days" INTEGER,
    "cure_period_ends" TIMESTAMP(3),
    "tracking_number" TEXT,
    "delivery_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "sent_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "violation_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violation_hearings" (
    "id" TEXT NOT NULL,
    "violation_id" TEXT NOT NULL,
    "hearing_date" TIMESTAMP(3) NOT NULL,
    "hearing_time" TEXT,
    "location" TEXT,
    "hearing_officer" TEXT,
    "attendees" TEXT,
    "outcome" "HearingOutcome" NOT NULL DEFAULT 'PENDING',
    "outcome_notes" TEXT,
    "fine_assessed" DECIMAL(10,2),
    "fine_waived" DECIMAL(10,2),
    "appeal_deadline" TIMESTAMP(3),
    "appeal_filed" BOOLEAN NOT NULL DEFAULT false,
    "appeal_date" TIMESTAMP(3),
    "recorded_by" TEXT,
    "recorded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "violation_hearings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violation_fines" (
    "id" TEXT NOT NULL,
    "violation_id" TEXT NOT NULL,
    "fine_number" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "assessed_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "waived_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(10,2) NOT NULL,
    "waived_by" TEXT,
    "waived_date" TIMESTAMP(3),
    "waiver_reason" TEXT,
    "assessment_charge_id" TEXT,
    "gl_posted" BOOLEAN NOT NULL DEFAULT false,
    "assessed_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "violation_fines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violation_status_history" (
    "id" TEXT NOT NULL,
    "violation_id" TEXT NOT NULL,
    "from_status" "ViolationStatus",
    "to_status" "ViolationStatus" NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "violation_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "violation_types_association_id_idx" ON "violation_types"("association_id");

-- CreateIndex
CREATE INDEX "violation_types_category_idx" ON "violation_types"("category");

-- CreateIndex
CREATE UNIQUE INDEX "violation_types_association_id_code_key" ON "violation_types"("association_id", "code");

-- CreateIndex
CREATE INDEX "violations_association_id_idx" ON "violations"("association_id");

-- CreateIndex
CREATE INDEX "violations_violation_type_id_idx" ON "violations"("violation_type_id");

-- CreateIndex
CREATE INDEX "violations_unit_id_idx" ON "violations"("unit_id");

-- CreateIndex
CREATE INDEX "violations_status_idx" ON "violations"("status");

-- CreateIndex
CREATE INDEX "violations_observed_date_idx" ON "violations"("observed_date");

-- CreateIndex
CREATE INDEX "violations_responsible_party_id_idx" ON "violations"("responsible_party_id");

-- CreateIndex
CREATE INDEX "violation_evidence_violation_id_idx" ON "violation_evidence"("violation_id");

-- CreateIndex
CREATE INDEX "violation_notices_violation_id_idx" ON "violation_notices"("violation_id");

-- CreateIndex
CREATE INDEX "violation_notices_notice_type_idx" ON "violation_notices"("notice_type");

-- CreateIndex
CREATE INDEX "violation_hearings_violation_id_idx" ON "violation_hearings"("violation_id");

-- CreateIndex
CREATE INDEX "violation_hearings_hearing_date_idx" ON "violation_hearings"("hearing_date");

-- CreateIndex
CREATE INDEX "violation_fines_violation_id_idx" ON "violation_fines"("violation_id");

-- CreateIndex
CREATE INDEX "violation_fines_assessed_date_idx" ON "violation_fines"("assessed_date");

-- CreateIndex
CREATE INDEX "violation_status_history_violation_id_idx" ON "violation_status_history"("violation_id");

-- AddForeignKey
ALTER TABLE "violation_types" ADD CONSTRAINT "violation_types_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_violation_type_id_fkey" FOREIGN KEY ("violation_type_id") REFERENCES "violation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_responsible_party_id_fkey" FOREIGN KEY ("responsible_party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation_evidence" ADD CONSTRAINT "violation_evidence_violation_id_fkey" FOREIGN KEY ("violation_id") REFERENCES "violations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation_notices" ADD CONSTRAINT "violation_notices_violation_id_fkey" FOREIGN KEY ("violation_id") REFERENCES "violations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation_hearings" ADD CONSTRAINT "violation_hearings_violation_id_fkey" FOREIGN KEY ("violation_id") REFERENCES "violations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation_fines" ADD CONSTRAINT "violation_fines_violation_id_fkey" FOREIGN KEY ("violation_id") REFERENCES "violations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation_status_history" ADD CONSTRAINT "violation_status_history_violation_id_fkey" FOREIGN KEY ("violation_id") REFERENCES "violations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
