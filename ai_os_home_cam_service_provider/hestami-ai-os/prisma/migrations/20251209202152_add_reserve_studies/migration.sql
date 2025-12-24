-- CreateEnum
CREATE TYPE "ReserveComponentCategory" AS ENUM ('ROOFING', 'PAVING', 'PAINTING', 'PLUMBING', 'ELECTRICAL', 'HVAC', 'POOL_SPA', 'LANDSCAPING', 'FENCING', 'STRUCTURAL', 'ELEVATOR', 'COMMON_AREA', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReserveStudyType" AS ENUM ('FULL', 'UPDATE_WITH_SITE', 'UPDATE_NO_SITE');

-- CreateEnum
CREATE TYPE "FundingPlanType" AS ENUM ('BASELINE', 'THRESHOLD', 'FULL_FUNDING', 'STATUTORY');

-- CreateTable
CREATE TABLE "reserve_components" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ReserveComponentCategory" NOT NULL,
    "location" TEXT,
    "useful_life" INTEGER NOT NULL,
    "remaining_life" INTEGER NOT NULL,
    "placed_in_service_date" TIMESTAMP(3),
    "current_replacement_cost" DECIMAL(12,2) NOT NULL,
    "future_replacement_cost" DECIMAL(12,2),
    "inflation_rate" DECIMAL(5,2) NOT NULL DEFAULT 3.0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_of_measure" TEXT,
    "condition_rating" INTEGER,
    "last_inspection_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reserve_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserve_studies" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "study_type" "ReserveStudyType" NOT NULL,
    "study_date" TIMESTAMP(3) NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "expiration_date" TIMESTAMP(3),
    "preparer_name" TEXT NOT NULL,
    "preparer_company" TEXT,
    "preparer_credentials" TEXT,
    "reserve_balance" DECIMAL(12,2) NOT NULL,
    "percent_funded" DECIMAL(5,2) NOT NULL,
    "fully_funded_balance" DECIMAL(12,2) NOT NULL,
    "recommended_contribution" DECIMAL(12,2) NOT NULL,
    "funding_plan_type" "FundingPlanType" NOT NULL,
    "document_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reserve_studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserve_study_components" (
    "id" TEXT NOT NULL,
    "study_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "useful_life" INTEGER NOT NULL,
    "remaining_life" INTEGER NOT NULL,
    "current_cost" DECIMAL(12,2) NOT NULL,
    "future_cost" DECIMAL(12,2) NOT NULL,
    "condition_rating" INTEGER,
    "funded_amount" DECIMAL(12,2) NOT NULL,
    "percent_funded" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reserve_study_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserve_funding_schedules" (
    "id" TEXT NOT NULL,
    "study_id" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "projected_balance" DECIMAL(12,2) NOT NULL,
    "recommended_contribution" DECIMAL(12,2) NOT NULL,
    "projected_expenditures" DECIMAL(12,2) NOT NULL,
    "percent_funded" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reserve_funding_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reserve_components_association_id_idx" ON "reserve_components"("association_id");

-- CreateIndex
CREATE INDEX "reserve_components_category_idx" ON "reserve_components"("category");

-- CreateIndex
CREATE INDEX "reserve_studies_association_id_idx" ON "reserve_studies"("association_id");

-- CreateIndex
CREATE INDEX "reserve_studies_study_date_idx" ON "reserve_studies"("study_date");

-- CreateIndex
CREATE INDEX "reserve_study_components_component_id_idx" ON "reserve_study_components"("component_id");

-- CreateIndex
CREATE UNIQUE INDEX "reserve_study_components_study_id_component_id_key" ON "reserve_study_components"("study_id", "component_id");

-- CreateIndex
CREATE INDEX "reserve_funding_schedules_study_id_idx" ON "reserve_funding_schedules"("study_id");

-- CreateIndex
CREATE UNIQUE INDEX "reserve_funding_schedules_study_id_fiscal_year_key" ON "reserve_funding_schedules"("study_id", "fiscal_year");

-- AddForeignKey
ALTER TABLE "reserve_components" ADD CONSTRAINT "reserve_components_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserve_studies" ADD CONSTRAINT "reserve_studies_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserve_study_components" ADD CONSTRAINT "reserve_study_components_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "reserve_studies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserve_study_components" ADD CONSTRAINT "reserve_study_components_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "reserve_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserve_funding_schedules" ADD CONSTRAINT "reserve_funding_schedules_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "reserve_studies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
