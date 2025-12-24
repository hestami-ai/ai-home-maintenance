-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('PENDING', 'ASSIGNED', 'ACCEPTED', 'DECLINED', 'EN_ROUTE', 'ON_SITE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SLAPriority" AS ENUM ('EMERGENCY', 'URGENT', 'HIGH', 'STANDARD', 'LOW');

-- CreateTable
CREATE TABLE "dispatch_assignments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "job_visit_id" TEXT,
    "technician_id" TEXT NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "decline_reason" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "scheduled_end" TIMESTAMP(3) NOT NULL,
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "estimated_travel_minutes" INTEGER,
    "actual_travel_minutes" INTEGER,
    "distance_miles" DECIMAL(8,2),
    "dispatch_notes" TEXT,
    "tech_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_slots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "slot_type" TEXT NOT NULL,
    "job_id" TEXT,
    "job_visit_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "route_date" DATE NOT NULL,
    "is_optimized" BOOLEAN NOT NULL DEFAULT false,
    "optimized_at" TIMESTAMP(3),
    "total_distance_miles" DECIMAL(10,2),
    "total_travel_minutes" INTEGER,
    "total_job_minutes" INTEGER,
    "start_address" TEXT,
    "start_lat" DECIMAL(10,7),
    "start_lng" DECIMAL(10,7),
    "end_address" TEXT,
    "end_lat" DECIMAL(10,7),
    "end_lng" DECIMAL(10,7),
    "stops_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_windows" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" "SLAPriority" NOT NULL,
    "response_time_minutes" INTEGER NOT NULL,
    "resolution_time_minutes" INTEGER NOT NULL,
    "business_hours_only" BOOLEAN NOT NULL DEFAULT true,
    "job_category" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "sla_window_id" TEXT NOT NULL,
    "response_due" TIMESTAMP(3) NOT NULL,
    "resolution_due" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "response_breached" BOOLEAN NOT NULL DEFAULT false,
    "resolution_breached" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispatch_assignments_organization_id_idx" ON "dispatch_assignments"("organization_id");

-- CreateIndex
CREATE INDEX "dispatch_assignments_job_id_idx" ON "dispatch_assignments"("job_id");

-- CreateIndex
CREATE INDEX "dispatch_assignments_technician_id_idx" ON "dispatch_assignments"("technician_id");

-- CreateIndex
CREATE INDEX "dispatch_assignments_status_idx" ON "dispatch_assignments"("status");

-- CreateIndex
CREATE INDEX "dispatch_assignments_scheduled_start_idx" ON "dispatch_assignments"("scheduled_start");

-- CreateIndex
CREATE INDEX "schedule_slots_organization_id_idx" ON "schedule_slots"("organization_id");

-- CreateIndex
CREATE INDEX "schedule_slots_technician_id_idx" ON "schedule_slots"("technician_id");

-- CreateIndex
CREATE INDEX "schedule_slots_start_time_idx" ON "schedule_slots"("start_time");

-- CreateIndex
CREATE INDEX "schedule_slots_slot_type_idx" ON "schedule_slots"("slot_type");

-- CreateIndex
CREATE INDEX "route_plans_organization_id_idx" ON "route_plans"("organization_id");

-- CreateIndex
CREATE INDEX "route_plans_technician_id_idx" ON "route_plans"("technician_id");

-- CreateIndex
CREATE INDEX "route_plans_route_date_idx" ON "route_plans"("route_date");

-- CreateIndex
CREATE UNIQUE INDEX "route_plans_technician_id_route_date_key" ON "route_plans"("technician_id", "route_date");

-- CreateIndex
CREATE INDEX "sla_windows_organization_id_idx" ON "sla_windows"("organization_id");

-- CreateIndex
CREATE INDEX "sla_windows_priority_idx" ON "sla_windows"("priority");

-- CreateIndex
CREATE INDEX "sla_records_organization_id_idx" ON "sla_records"("organization_id");

-- CreateIndex
CREATE INDEX "sla_records_sla_window_id_idx" ON "sla_records"("sla_window_id");

-- CreateIndex
CREATE INDEX "sla_records_response_due_idx" ON "sla_records"("response_due");

-- CreateIndex
CREATE INDEX "sla_records_resolution_due_idx" ON "sla_records"("resolution_due");

-- CreateIndex
CREATE UNIQUE INDEX "sla_records_job_id_key" ON "sla_records"("job_id");

-- AddForeignKey
ALTER TABLE "dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_plans" ADD CONSTRAINT "route_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_plans" ADD CONSTRAINT "route_plans_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_windows" ADD CONSTRAINT "sla_windows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_records" ADD CONSTRAINT "sla_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_records" ADD CONSTRAINT "sla_records_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_records" ADD CONSTRAINT "sla_records_sla_window_id_fkey" FOREIGN KEY ("sla_window_id") REFERENCES "sla_windows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
