-- CreateEnum
CREATE TYPE "PricebookItemType" AS ENUM ('SERVICE', 'LABOR', 'MATERIAL', 'BUNDLE');

-- CreateEnum
CREATE TYPE "PricebookVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PriceRuleType" AS ENUM ('HOA', 'SEASONAL', 'VOLUME', 'CONTRACTOR_OVERRIDE', 'OTHER');

-- CreateTable
CREATE TABLE "pricebooks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricebooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricebook_versions" (
    "id" TEXT NOT NULL,
    "pricebook_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "PricebookVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_start" TIMESTAMP(3),
    "effective_end" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "published_at" TIMESTAMP(3),
    "published_by" TEXT,
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricebook_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricebook_items" (
    "id" TEXT NOT NULL,
    "pricebook_version_id" TEXT NOT NULL,
    "type" "PricebookItemType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trade" "ContractorTradeType",
    "unit_of_measure" TEXT,
    "base_price" DECIMAL(12,2) NOT NULL,
    "cost" DECIMAL(12,2),
    "is_taxable" BOOLEAN NOT NULL DEFAULT true,
    "service_area_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricebook_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_rules" (
    "id" TEXT NOT NULL,
    "pricebook_version_id" TEXT NOT NULL,
    "pricebook_item_id" TEXT,
    "ruleType" "PriceRuleType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "association_id" TEXT,
    "service_area_id" TEXT,
    "min_quantity" DECIMAL(10,2),
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "conditionJson" JSONB,
    "percentage_adjustment" DECIMAL(7,4),
    "amount_adjustment" DECIMAL(12,2),
    "adjustmentJson" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "pricebook_version_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "defaultTrade" "ContractorTradeType",
    "default_service_area_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_template_items" (
    "id" TEXT NOT NULL,
    "job_template_id" TEXT NOT NULL,
    "pricebook_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "line_number" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pricebooks_organization_id_idx" ON "pricebooks"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricebooks_organization_id_name_key" ON "pricebooks"("organization_id", "name");

-- CreateIndex
CREATE INDEX "pricebook_versions_pricebook_id_idx" ON "pricebook_versions"("pricebook_id");

-- CreateIndex
CREATE INDEX "pricebook_versions_status_idx" ON "pricebook_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "pricebook_versions_pricebook_id_version_number_key" ON "pricebook_versions"("pricebook_id", "version_number");

-- CreateIndex
CREATE INDEX "pricebook_items_pricebook_version_id_idx" ON "pricebook_items"("pricebook_version_id");

-- CreateIndex
CREATE INDEX "pricebook_items_service_area_id_idx" ON "pricebook_items"("service_area_id");

-- CreateIndex
CREATE INDEX "pricebook_items_trade_idx" ON "pricebook_items"("trade");

-- CreateIndex
CREATE UNIQUE INDEX "pricebook_items_pricebook_version_id_code_key" ON "pricebook_items"("pricebook_version_id", "code");

-- CreateIndex
CREATE INDEX "price_rules_pricebook_version_id_idx" ON "price_rules"("pricebook_version_id");

-- CreateIndex
CREATE INDEX "price_rules_pricebook_item_id_idx" ON "price_rules"("pricebook_item_id");

-- CreateIndex
CREATE INDEX "price_rules_association_id_idx" ON "price_rules"("association_id");

-- CreateIndex
CREATE INDEX "price_rules_service_area_id_idx" ON "price_rules"("service_area_id");

-- CreateIndex
CREATE INDEX "price_rules_ruleType_idx" ON "price_rules"("ruleType");

-- CreateIndex
CREATE INDEX "job_templates_organization_id_idx" ON "job_templates"("organization_id");

-- CreateIndex
CREATE INDEX "job_templates_pricebook_version_id_idx" ON "job_templates"("pricebook_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_templates_organization_id_name_key" ON "job_templates"("organization_id", "name");

-- CreateIndex
CREATE INDEX "job_template_items_pricebook_item_id_idx" ON "job_template_items"("pricebook_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_template_items_job_template_id_line_number_key" ON "job_template_items"("job_template_id", "line_number");

-- AddForeignKey
ALTER TABLE "pricebooks" ADD CONSTRAINT "pricebooks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricebook_versions" ADD CONSTRAINT "pricebook_versions_pricebook_id_fkey" FOREIGN KEY ("pricebook_id") REFERENCES "pricebooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricebook_items" ADD CONSTRAINT "pricebook_items_pricebook_version_id_fkey" FOREIGN KEY ("pricebook_version_id") REFERENCES "pricebook_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricebook_items" ADD CONSTRAINT "pricebook_items_service_area_id_fkey" FOREIGN KEY ("service_area_id") REFERENCES "service_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_pricebook_version_id_fkey" FOREIGN KEY ("pricebook_version_id") REFERENCES "pricebook_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_pricebook_item_id_fkey" FOREIGN KEY ("pricebook_item_id") REFERENCES "pricebook_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_service_area_id_fkey" FOREIGN KEY ("service_area_id") REFERENCES "service_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_templates" ADD CONSTRAINT "job_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_templates" ADD CONSTRAINT "job_templates_pricebook_version_id_fkey" FOREIGN KEY ("pricebook_version_id") REFERENCES "pricebook_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_templates" ADD CONSTRAINT "job_templates_default_service_area_id_fkey" FOREIGN KEY ("default_service_area_id") REFERENCES "service_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_template_items" ADD CONSTRAINT "job_template_items_job_template_id_fkey" FOREIGN KEY ("job_template_id") REFERENCES "job_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_template_items" ADD CONSTRAINT "job_template_items_pricebook_item_id_fkey" FOREIGN KEY ("pricebook_item_id") REFERENCES "pricebook_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
