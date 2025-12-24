-- CreateTable
CREATE TABLE "property_portfolios" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "property_portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_properties" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "display_order" INTEGER,
    "notes" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by" TEXT NOT NULL,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "portfolio_properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_portfolios_organization_id_idx" ON "property_portfolios"("organization_id");

-- CreateIndex
CREATE INDEX "property_portfolios_is_active_idx" ON "property_portfolios"("is_active");

-- CreateIndex
CREATE INDEX "portfolio_properties_portfolio_id_idx" ON "portfolio_properties"("portfolio_id");

-- CreateIndex
CREATE INDEX "portfolio_properties_property_id_idx" ON "portfolio_properties"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_properties_portfolio_id_property_id_key" ON "portfolio_properties"("portfolio_id", "property_id");

-- AddForeignKey
ALTER TABLE "property_portfolios" ADD CONSTRAINT "property_portfolios_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_properties" ADD CONSTRAINT "portfolio_properties_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "property_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_properties" ADD CONSTRAINT "portfolio_properties_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "individual_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
