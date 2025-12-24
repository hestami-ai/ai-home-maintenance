-- CreateEnum
CREATE TYPE "ServiceContractStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED', 'RENEWED');

-- CreateEnum
CREATE TYPE "ServiceContractType" AS ENUM ('PREVENTIVE_MAINTENANCE', 'FULL_SERVICE', 'INSPECTION_ONLY', 'ON_CALL', 'SEASONAL');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ScheduledVisitStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'MISSED');

-- CreateTable
CREATE TABLE "service_contracts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contract_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ServiceContractType" NOT NULL,
    "status" "ServiceContractStatus" NOT NULL DEFAULT 'DRAFT',
    "customer_id" TEXT,
    "association_id" TEXT,
    "property_id" TEXT,
    "unit_id" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "renewal_term_days" INTEGER,
    "renewal_notice_at" TIMESTAMP(3),
    "contract_value" DECIMAL(12,2) NOT NULL,
    "billing_frequency" "RecurrenceFrequency" NOT NULL,
    "billing_amount" DECIMAL(12,2) NOT NULL,
    "next_billing_date" DATE,
    "description" TEXT,
    "scope_of_work" TEXT,
    "exclusions" TEXT,
    "service_area_notes" TEXT,
    "response_time_hours" INTEGER,
    "resolution_time_hours" INTEGER,
    "coverage_hours_json" TEXT,
    "emergency_coverage" BOOLEAN NOT NULL DEFAULT false,
    "primary_technician_id" TEXT,
    "assigned_branch_id" TEXT,
    "document_url" TEXT,
    "signed_at" TIMESTAMP(3),
    "signed_by" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "service_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_service_items" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pricebook_item_id" TEXT,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "visits_per_period" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "line_total" DECIMAL(12,2) NOT NULL,
    "estimated_duration_minutes" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_service_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_schedules" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "preferred_day_of_week" INTEGER,
    "preferred_day_of_month" INTEGER,
    "preferred_time_start" TEXT,
    "preferred_time_end" TEXT,
    "last_generated_at" TIMESTAMP(3),
    "next_generate_at" TIMESTAMP(3),
    "technician_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_visits" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "schedule_id" TEXT,
    "visit_number" INTEGER NOT NULL,
    "status" "ScheduledVisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_date" DATE NOT NULL,
    "scheduled_start" TIMESTAMP(3),
    "scheduled_end" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "technician_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "job_id" TEXT,
    "service_notes" TEXT,
    "customer_notes" TEXT,
    "completion_notes" TEXT,
    "rescheduled_from" TEXT,
    "reschedule_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_renewals" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "renewal_number" INTEGER NOT NULL,
    "previous_end_date" DATE NOT NULL,
    "new_end_date" DATE NOT NULL,
    "previous_value" DECIMAL(12,2) NOT NULL,
    "new_value" DECIMAL(12,2) NOT NULL,
    "change_percent" DECIMAL(5,2),
    "renewed_at" TIMESTAMP(3) NOT NULL,
    "renewed_by" TEXT NOT NULL,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_renewals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_sla_records" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "total_requests" INTEGER NOT NULL DEFAULT 0,
    "on_time_responses" INTEGER NOT NULL DEFAULT 0,
    "on_time_resolutions" INTEGER NOT NULL DEFAULT 0,
    "missed_slas" INTEGER NOT NULL DEFAULT 0,
    "response_compliance_percent" DECIMAL(5,2),
    "resolution_compliance_percent" DECIMAL(5,2),
    "avg_response_time_minutes" INTEGER,
    "avg_resolution_time_minutes" INTEGER,
    "scheduled_visits" INTEGER NOT NULL DEFAULT 0,
    "completed_visits" INTEGER NOT NULL DEFAULT 0,
    "missed_visits" INTEGER NOT NULL DEFAULT 0,
    "visit_compliance_percent" DECIMAL(5,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_sla_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_contracts_organization_id_idx" ON "service_contracts"("organization_id");

-- CreateIndex
CREATE INDEX "service_contracts_customer_id_idx" ON "service_contracts"("customer_id");

-- CreateIndex
CREATE INDEX "service_contracts_association_id_idx" ON "service_contracts"("association_id");

-- CreateIndex
CREATE INDEX "service_contracts_status_idx" ON "service_contracts"("status");

-- CreateIndex
CREATE INDEX "service_contracts_end_date_idx" ON "service_contracts"("end_date");

-- CreateIndex
CREATE UNIQUE INDEX "service_contracts_organization_id_contract_number_key" ON "service_contracts"("organization_id", "contract_number");

-- CreateIndex
CREATE INDEX "contract_service_items_contract_id_idx" ON "contract_service_items"("contract_id");

-- CreateIndex
CREATE INDEX "contract_schedules_contract_id_idx" ON "contract_schedules"("contract_id");

-- CreateIndex
CREATE INDEX "contract_schedules_next_generate_at_idx" ON "contract_schedules"("next_generate_at");

-- CreateIndex
CREATE INDEX "scheduled_visits_contract_id_idx" ON "scheduled_visits"("contract_id");

-- CreateIndex
CREATE INDEX "scheduled_visits_schedule_id_idx" ON "scheduled_visits"("schedule_id");

-- CreateIndex
CREATE INDEX "scheduled_visits_technician_id_idx" ON "scheduled_visits"("technician_id");

-- CreateIndex
CREATE INDEX "scheduled_visits_scheduled_date_idx" ON "scheduled_visits"("scheduled_date");

-- CreateIndex
CREATE INDEX "scheduled_visits_status_idx" ON "scheduled_visits"("status");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_visits_contract_id_visit_number_key" ON "scheduled_visits"("contract_id", "visit_number");

-- CreateIndex
CREATE INDEX "contract_renewals_contract_id_idx" ON "contract_renewals"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_renewals_contract_id_renewal_number_key" ON "contract_renewals"("contract_id", "renewal_number");

-- CreateIndex
CREATE INDEX "contract_sla_records_contract_id_idx" ON "contract_sla_records"("contract_id");

-- CreateIndex
CREATE INDEX "contract_sla_records_period_start_idx" ON "contract_sla_records"("period_start");

-- CreateIndex
CREATE UNIQUE INDEX "contract_sla_records_contract_id_period_start_period_end_key" ON "contract_sla_records"("contract_id", "period_start", "period_end");

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_primary_technician_id_fkey" FOREIGN KEY ("primary_technician_id") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_assigned_branch_id_fkey" FOREIGN KEY ("assigned_branch_id") REFERENCES "contractor_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_service_items" ADD CONSTRAINT "contract_service_items_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "service_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_service_items" ADD CONSTRAINT "contract_service_items_pricebook_item_id_fkey" FOREIGN KEY ("pricebook_item_id") REFERENCES "pricebook_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_schedules" ADD CONSTRAINT "contract_schedules_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "service_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_visits" ADD CONSTRAINT "scheduled_visits_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "service_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_visits" ADD CONSTRAINT "scheduled_visits_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "contract_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_visits" ADD CONSTRAINT "scheduled_visits_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_visits" ADD CONSTRAINT "scheduled_visits_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_renewals" ADD CONSTRAINT "contract_renewals_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "service_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_sla_records" ADD CONSTRAINT "contract_sla_records_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "service_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
