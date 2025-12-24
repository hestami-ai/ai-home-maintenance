-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVISED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "JobInvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "JobPaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "estimate_number" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "title" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "terms" TEXT,
    "previous_version_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_lines" (
    "id" TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "pricebook_item_id" TEXT,
    "is_taxable" BOOLEAN NOT NULL DEFAULT true,
    "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "option_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_options" (
    "id" TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimate_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "estimate_id" TEXT,
    "proposal_number" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "title" TEXT,
    "cover_letter" TEXT,
    "terms" TEXT,
    "signature_data" TEXT,
    "signed_at" TIMESTAMP(3),
    "signed_by_name" TEXT,
    "signed_by_email" TEXT,
    "selected_option_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "status" "JobInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "estimate_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "pricebook_item_id" TEXT,
    "is_taxable" BOOLEAN NOT NULL DEFAULT true,
    "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "JobPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" TEXT,
    "external_id" TEXT,
    "external_provider" TEXT,
    "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "error_code" TEXT,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "estimates_organization_id_idx" ON "estimates"("organization_id");

-- CreateIndex
CREATE INDEX "estimates_job_id_idx" ON "estimates"("job_id");

-- CreateIndex
CREATE INDEX "estimates_customer_id_idx" ON "estimates"("customer_id");

-- CreateIndex
CREATE INDEX "estimates_status_idx" ON "estimates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_organization_id_estimate_number_version_key" ON "estimates"("organization_id", "estimate_number", "version");

-- CreateIndex
CREATE INDEX "estimate_lines_estimate_id_idx" ON "estimate_lines"("estimate_id");

-- CreateIndex
CREATE INDEX "estimate_lines_pricebook_item_id_idx" ON "estimate_lines"("pricebook_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_lines_estimate_id_line_number_key" ON "estimate_lines"("estimate_id", "line_number");

-- CreateIndex
CREATE INDEX "estimate_options_estimate_id_idx" ON "estimate_options"("estimate_id");

-- CreateIndex
CREATE INDEX "proposals_organization_id_idx" ON "proposals"("organization_id");

-- CreateIndex
CREATE INDEX "proposals_customer_id_idx" ON "proposals"("customer_id");

-- CreateIndex
CREATE INDEX "proposals_estimate_id_idx" ON "proposals"("estimate_id");

-- CreateIndex
CREATE INDEX "proposals_status_idx" ON "proposals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_organization_id_proposal_number_key" ON "proposals"("organization_id", "proposal_number");

-- CreateIndex
CREATE INDEX "job_invoices_organization_id_idx" ON "job_invoices"("organization_id");

-- CreateIndex
CREATE INDEX "job_invoices_job_id_idx" ON "job_invoices"("job_id");

-- CreateIndex
CREATE INDEX "job_invoices_customer_id_idx" ON "job_invoices"("customer_id");

-- CreateIndex
CREATE INDEX "job_invoices_status_idx" ON "job_invoices"("status");

-- CreateIndex
CREATE INDEX "job_invoices_due_date_idx" ON "job_invoices"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "job_invoices_organization_id_invoice_number_key" ON "job_invoices"("organization_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_invoice_id_line_number_key" ON "invoice_lines"("invoice_id", "line_number");

-- CreateIndex
CREATE INDEX "payment_intents_organization_id_idx" ON "payment_intents"("organization_id");

-- CreateIndex
CREATE INDEX "payment_intents_invoice_id_idx" ON "payment_intents"("invoice_id");

-- CreateIndex
CREATE INDEX "payment_intents_customer_id_idx" ON "payment_intents"("customer_id");

-- CreateIndex
CREATE INDEX "payment_intents_status_idx" ON "payment_intents"("status");

-- CreateIndex
CREATE INDEX "payment_intents_external_id_idx" ON "payment_intents"("external_id");

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "estimates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_pricebook_item_id_fkey" FOREIGN KEY ("pricebook_item_id") REFERENCES "pricebook_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "estimate_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_options" ADD CONSTRAINT "estimate_options_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_invoices" ADD CONSTRAINT "job_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_invoices" ADD CONSTRAINT "job_invoices_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_invoices" ADD CONSTRAINT "job_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "job_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_pricebook_item_id_fkey" FOREIGN KEY ("pricebook_item_id") REFERENCES "pricebook_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "job_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
