-- CreateTable
CREATE TABLE "technicians" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" CITEXT,
    "phone" TEXT,
    "employee_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "hire_date" TIMESTAMP(3),
    "termination_date" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "branch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_skills" (
    "id" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "trade" "ContractorTradeType" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_certifications" (
    "id" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "authority" TEXT,
    "certification_id" TEXT,
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "document_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_availability" (
    "id" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "monday" JSONB,
    "tuesday" JSONB,
    "wednesday" JSONB,
    "thursday" JSONB,
    "friday" JSONB,
    "saturday" JSONB,
    "sunday" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_time_off" (
    "id" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_time_off_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_territories" (
    "id" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "service_area_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_territories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_kpis" (
    "id" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "jobs_completed" INTEGER NOT NULL DEFAULT 0,
    "on_time_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "callback_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "labor_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_kpis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "technicians_organization_id_idx" ON "technicians"("organization_id");

-- CreateIndex
CREATE INDEX "technicians_branch_id_idx" ON "technicians"("branch_id");

-- CreateIndex
CREATE INDEX "technicians_is_active_idx" ON "technicians"("is_active");

-- CreateIndex
CREATE INDEX "technician_skills_technician_id_idx" ON "technician_skills"("technician_id");

-- CreateIndex
CREATE UNIQUE INDEX "technician_skills_technician_id_trade_key" ON "technician_skills"("technician_id", "trade");

-- CreateIndex
CREATE INDEX "technician_certifications_technician_id_idx" ON "technician_certifications"("technician_id");

-- CreateIndex
CREATE INDEX "technician_certifications_expires_at_idx" ON "technician_certifications"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "technician_availability_technician_id_key" ON "technician_availability"("technician_id");

-- CreateIndex
CREATE INDEX "technician_time_off_technician_id_idx" ON "technician_time_off"("technician_id");

-- CreateIndex
CREATE INDEX "technician_time_off_starts_at_idx" ON "technician_time_off"("starts_at");

-- CreateIndex
CREATE INDEX "technician_time_off_ends_at_idx" ON "technician_time_off"("ends_at");

-- CreateIndex
CREATE INDEX "technician_territories_technician_id_idx" ON "technician_territories"("technician_id");

-- CreateIndex
CREATE INDEX "technician_territories_service_area_id_idx" ON "technician_territories"("service_area_id");

-- CreateIndex
CREATE UNIQUE INDEX "technician_territories_technician_id_service_area_id_key" ON "technician_territories"("technician_id", "service_area_id");

-- CreateIndex
CREATE INDEX "technician_kpis_technician_id_idx" ON "technician_kpis"("technician_id");

-- CreateIndex
CREATE INDEX "technician_kpis_period_start_period_end_idx" ON "technician_kpis"("period_start", "period_end");

-- AddForeignKey
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "contractor_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_skills" ADD CONSTRAINT "technician_skills_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_certifications" ADD CONSTRAINT "technician_certifications_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_availability" ADD CONSTRAINT "technician_availability_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_time_off" ADD CONSTRAINT "technician_time_off_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_territories" ADD CONSTRAINT "technician_territories_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_territories" ADD CONSTRAINT "technician_territories_service_area_id_fkey" FOREIGN KEY ("service_area_id") REFERENCES "service_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_kpis" ADD CONSTRAINT "technician_kpis_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;
