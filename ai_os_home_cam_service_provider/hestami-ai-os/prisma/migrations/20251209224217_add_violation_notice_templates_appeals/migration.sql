-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'SCHEDULED', 'UPHELD', 'MODIFIED', 'REVERSED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "notice_templates" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notice_type" "NoticeType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body_template" TEXT NOT NULL,
    "default_cure_period_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_sequence_configs" (
    "id" TEXT NOT NULL,
    "violation_type_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notice_sequence_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_sequence_steps" (
    "id" TEXT NOT NULL,
    "sequence_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "days_after_previous" INTEGER NOT NULL DEFAULT 0,
    "requires_cure" BOOLEAN NOT NULL DEFAULT true,
    "auto_send" BOOLEAN NOT NULL DEFAULT false,
    "assess_fine" BOOLEAN NOT NULL DEFAULT false,
    "fine_amount" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_sequence_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violation_appeals" (
    "id" TEXT NOT NULL,
    "hearing_id" TEXT NOT NULL,
    "filed_date" TIMESTAMP(3) NOT NULL,
    "filed_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "documents_json" TEXT,
    "appeal_hearing_date" TIMESTAMP(3),
    "appeal_hearing_location" TEXT,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "decision_date" TIMESTAMP(3),
    "decision_by" TEXT,
    "decision_notes" TEXT,
    "original_fine_amount" DECIMAL(10,2),
    "revised_fine_amount" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "violation_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notice_templates_association_id_idx" ON "notice_templates"("association_id");

-- CreateIndex
CREATE INDEX "notice_templates_notice_type_idx" ON "notice_templates"("notice_type");

-- CreateIndex
CREATE UNIQUE INDEX "notice_templates_association_id_name_key" ON "notice_templates"("association_id", "name");

-- CreateIndex
CREATE INDEX "notice_sequence_configs_violation_type_id_idx" ON "notice_sequence_configs"("violation_type_id");

-- CreateIndex
CREATE INDEX "notice_sequence_steps_sequence_id_idx" ON "notice_sequence_steps"("sequence_id");

-- CreateIndex
CREATE UNIQUE INDEX "notice_sequence_steps_sequence_id_step_order_key" ON "notice_sequence_steps"("sequence_id", "step_order");

-- CreateIndex
CREATE INDEX "violation_appeals_hearing_id_idx" ON "violation_appeals"("hearing_id");

-- CreateIndex
CREATE INDEX "violation_appeals_status_idx" ON "violation_appeals"("status");

-- AddForeignKey
ALTER TABLE "notice_templates" ADD CONSTRAINT "notice_templates_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_sequence_configs" ADD CONSTRAINT "notice_sequence_configs_violation_type_id_fkey" FOREIGN KEY ("violation_type_id") REFERENCES "violation_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_sequence_steps" ADD CONSTRAINT "notice_sequence_steps_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "notice_sequence_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_sequence_steps" ADD CONSTRAINT "notice_sequence_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notice_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation_appeals" ADD CONSTRAINT "violation_appeals_hearing_id_fkey" FOREIGN KEY ("hearing_id") REFERENCES "violation_hearings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
