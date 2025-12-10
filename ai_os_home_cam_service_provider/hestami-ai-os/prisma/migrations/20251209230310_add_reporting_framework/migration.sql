-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('FINANCIAL', 'RECEIVABLES', 'PAYABLES', 'OPERATIONAL', 'COMPLIANCE', 'GOVERNANCE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'EXCEL', 'CSV', 'JSON', 'HTML');

-- CreateEnum
CREATE TYPE "ScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReportDeliveryMethod" AS ENUM ('EMAIL', 'PORTAL', 'BOTH');

-- CreateEnum
CREATE TYPE "ReportExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WidgetType" AS ENUM ('CHART_BAR', 'CHART_LINE', 'CHART_PIE', 'CHART_DONUT', 'METRIC_CARD', 'TABLE', 'LIST', 'CALENDAR', 'MAP');

-- CreateTable
CREATE TABLE "report_definitions" (
    "id" TEXT NOT NULL,
    "association_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ReportCategory" NOT NULL,
    "query_template" TEXT NOT NULL,
    "parameters_json" TEXT,
    "columns_json" TEXT,
    "default_format" "ReportFormat" NOT NULL DEFAULT 'PDF',
    "allowed_formats" "ReportFormat"[],
    "is_system_report" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "ScheduleFrequency" NOT NULL,
    "cron_expression" TEXT,
    "parameters_json" TEXT,
    "format" "ReportFormat" NOT NULL DEFAULT 'PDF',
    "delivery_method" "ReportDeliveryMethod" NOT NULL DEFAULT 'EMAIL',
    "recipients_json" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_executions" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "schedule_id" TEXT,
    "association_id" TEXT NOT NULL,
    "status" "ReportExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "parameters_json" TEXT,
    "format" "ReportFormat" NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "output_url" TEXT,
    "output_size" INTEGER,
    "row_count" INTEGER,
    "error_message" TEXT,
    "executed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_widgets" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "user_id" TEXT,
    "widget_type" "WidgetType" NOT NULL,
    "title" TEXT NOT NULL,
    "config_json" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 1,
    "height" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_definitions_association_id_idx" ON "report_definitions"("association_id");

-- CreateIndex
CREATE INDEX "report_definitions_category_idx" ON "report_definitions"("category");

-- CreateIndex
CREATE UNIQUE INDEX "report_definitions_association_id_code_key" ON "report_definitions"("association_id", "code");

-- CreateIndex
CREATE INDEX "report_schedules_report_id_idx" ON "report_schedules"("report_id");

-- CreateIndex
CREATE INDEX "report_schedules_association_id_idx" ON "report_schedules"("association_id");

-- CreateIndex
CREATE INDEX "report_schedules_next_run_at_idx" ON "report_schedules"("next_run_at");

-- CreateIndex
CREATE INDEX "report_executions_report_id_idx" ON "report_executions"("report_id");

-- CreateIndex
CREATE INDEX "report_executions_schedule_id_idx" ON "report_executions"("schedule_id");

-- CreateIndex
CREATE INDEX "report_executions_association_id_idx" ON "report_executions"("association_id");

-- CreateIndex
CREATE INDEX "report_executions_status_idx" ON "report_executions"("status");

-- CreateIndex
CREATE INDEX "report_executions_created_at_idx" ON "report_executions"("created_at");

-- CreateIndex
CREATE INDEX "dashboard_widgets_association_id_idx" ON "dashboard_widgets"("association_id");

-- CreateIndex
CREATE INDEX "dashboard_widgets_user_id_idx" ON "dashboard_widgets"("user_id");

-- AddForeignKey
ALTER TABLE "report_definitions" ADD CONSTRAINT "report_definitions_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "report_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "report_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "report_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
