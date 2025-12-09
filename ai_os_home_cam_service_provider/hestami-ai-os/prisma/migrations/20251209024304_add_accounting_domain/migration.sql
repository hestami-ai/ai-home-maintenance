-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AccountCategory" AS ENUM ('CASH', 'ACCOUNTS_RECEIVABLE', 'PREPAID', 'FIXED_ASSET', 'OTHER_ASSET', 'ACCOUNTS_PAYABLE', 'ACCRUED_LIABILITY', 'DEFERRED_REVENUE', 'LONG_TERM_LIABILITY', 'OTHER_LIABILITY', 'RETAINED_EARNINGS', 'FUND_BALANCE', 'RESERVE_FUND', 'ASSESSMENT_INCOME', 'LATE_FEE_INCOME', 'INTEREST_INCOME', 'OTHER_INCOME', 'ADMINISTRATIVE', 'UTILITIES', 'MAINTENANCE', 'INSURANCE', 'PROFESSIONAL_FEES', 'RESERVE_CONTRIBUTION', 'OTHER_EXPENSE');

-- CreateEnum
CREATE TYPE "FundType" AS ENUM ('OPERATING', 'RESERVE', 'SPECIAL');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "AssessmentFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('PENDING', 'BILLED', 'PARTIALLY_PAID', 'PAID', 'WRITTEN_OFF', 'CREDITED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CHECK', 'ACH', 'CREDIT_CARD', 'CASH', 'WIRE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CLEARED', 'BOUNCED', 'REFUNDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'VOIDED');

-- CreateTable
CREATE TABLE "gl_accounts" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "account_type" "AccountType" NOT NULL,
    "category" "AccountCategory" NOT NULL,
    "fund_type" "FundType" NOT NULL DEFAULT 'OPERATING',
    "parent_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system_account" BOOLEAN NOT NULL DEFAULT false,
    "normal_debit" BOOLEAN NOT NULL DEFAULT true,
    "current_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "entry_number" TEXT NOT NULL,
    "entry_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "memo" TEXT,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "source_type" TEXT,
    "source_id" TEXT,
    "is_reversal" BOOLEAN NOT NULL DEFAULT false,
    "reversed_entry_id" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "debit_amount" DECIMAL(15,2),
    "credit_amount" DECIMAL(15,2),
    "description" TEXT,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "line_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "gl_account_id" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "routing_number" TEXT,
    "account_type" TEXT NOT NULL,
    "fund_type" "FundType" NOT NULL DEFAULT 'OPERATING',
    "book_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "bank_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "last_reconciled" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_types" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "frequency" "AssessmentFrequency" NOT NULL,
    "default_amount" DECIMAL(10,2) NOT NULL,
    "revenue_account_id" TEXT NOT NULL,
    "late_fee_account_id" TEXT,
    "late_fee_amount" DECIMAL(10,2),
    "late_fee_percent" DECIMAL(5,2),
    "grace_period_days" INTEGER NOT NULL DEFAULT 15,
    "prorate_on_transfer" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_charges" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "assessment_type_id" TEXT NOT NULL,
    "charge_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "period_start" DATE,
    "period_end" DATE,
    "amount" DECIMAL(10,2) NOT NULL,
    "late_fee_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(10,2) NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'PENDING',
    "late_fee_applied" BOOLEAN NOT NULL DEFAULT false,
    "late_fee_date" TIMESTAMP(3),
    "journal_entry_id" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "payment_date" DATE NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "reference_number" TEXT,
    "bank_account_id" TEXT,
    "payer_name" TEXT,
    "payer_party_id" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "applied_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unapplied_amount" DECIMAL(10,2) NOT NULL,
    "journal_entry_id" TEXT,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_applications" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dba" TEXT,
    "contact_name" TEXT,
    "email" CITEXT,
    "phone" TEXT,
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "tax_id" TEXT,
    "w9_on_file" BOOLEAN NOT NULL DEFAULT false,
    "is_1099_eligible" BOOLEAN NOT NULL DEFAULT false,
    "payment_terms" INTEGER NOT NULL DEFAULT 30,
    "default_gl_account_id" TEXT,
    "service_provider_org_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ap_invoices" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(10,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "journal_entry_id" TEXT,
    "description" TEXT,
    "memo" TEXT,
    "work_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ap_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ap_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "gl_account_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ap_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gl_accounts_association_id_idx" ON "gl_accounts"("association_id");

-- CreateIndex
CREATE INDEX "gl_accounts_parent_id_idx" ON "gl_accounts"("parent_id");

-- CreateIndex
CREATE INDEX "gl_accounts_account_type_idx" ON "gl_accounts"("account_type");

-- CreateIndex
CREATE UNIQUE INDEX "gl_accounts_association_id_account_number_key" ON "gl_accounts"("association_id", "account_number");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversed_entry_id_key" ON "journal_entries"("reversed_entry_id");

-- CreateIndex
CREATE INDEX "journal_entries_association_id_idx" ON "journal_entries"("association_id");

-- CreateIndex
CREATE INDEX "journal_entries_entry_date_idx" ON "journal_entries"("entry_date");

-- CreateIndex
CREATE INDEX "journal_entries_status_idx" ON "journal_entries"("status");

-- CreateIndex
CREATE INDEX "journal_entries_source_type_source_id_idx" ON "journal_entries"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_association_id_entry_number_key" ON "journal_entries"("association_id", "entry_number");

-- CreateIndex
CREATE INDEX "journal_entry_lines_journal_entry_id_idx" ON "journal_entry_lines"("journal_entry_id");

-- CreateIndex
CREATE INDEX "journal_entry_lines_account_id_idx" ON "journal_entry_lines"("account_id");

-- CreateIndex
CREATE INDEX "journal_entry_lines_reference_type_reference_id_idx" ON "journal_entry_lines"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "bank_accounts_association_id_idx" ON "bank_accounts"("association_id");

-- CreateIndex
CREATE INDEX "bank_accounts_gl_account_id_idx" ON "bank_accounts"("gl_account_id");

-- CreateIndex
CREATE INDEX "assessment_types_association_id_idx" ON "assessment_types"("association_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_types_association_id_code_key" ON "assessment_types"("association_id", "code");

-- CreateIndex
CREATE INDEX "assessment_charges_association_id_idx" ON "assessment_charges"("association_id");

-- CreateIndex
CREATE INDEX "assessment_charges_unit_id_idx" ON "assessment_charges"("unit_id");

-- CreateIndex
CREATE INDEX "assessment_charges_assessment_type_id_idx" ON "assessment_charges"("assessment_type_id");

-- CreateIndex
CREATE INDEX "assessment_charges_due_date_idx" ON "assessment_charges"("due_date");

-- CreateIndex
CREATE INDEX "assessment_charges_status_idx" ON "assessment_charges"("status");

-- CreateIndex
CREATE INDEX "payments_association_id_idx" ON "payments"("association_id");

-- CreateIndex
CREATE INDEX "payments_unit_id_idx" ON "payments"("unit_id");

-- CreateIndex
CREATE INDEX "payments_payment_date_idx" ON "payments"("payment_date");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payment_applications_payment_id_idx" ON "payment_applications"("payment_id");

-- CreateIndex
CREATE INDEX "payment_applications_charge_id_idx" ON "payment_applications"("charge_id");

-- CreateIndex
CREATE INDEX "vendors_association_id_idx" ON "vendors"("association_id");

-- CreateIndex
CREATE INDEX "vendors_email_idx" ON "vendors"("email");

-- CreateIndex
CREATE INDEX "ap_invoices_association_id_idx" ON "ap_invoices"("association_id");

-- CreateIndex
CREATE INDEX "ap_invoices_vendor_id_idx" ON "ap_invoices"("vendor_id");

-- CreateIndex
CREATE INDEX "ap_invoices_due_date_idx" ON "ap_invoices"("due_date");

-- CreateIndex
CREATE INDEX "ap_invoices_status_idx" ON "ap_invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ap_invoices_association_id_vendor_id_invoice_number_key" ON "ap_invoices"("association_id", "vendor_id", "invoice_number");

-- CreateIndex
CREATE INDEX "ap_invoice_lines_invoice_id_idx" ON "ap_invoice_lines"("invoice_id");

-- AddForeignKey
ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversed_entry_id_fkey" FOREIGN KEY ("reversed_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_types" ADD CONSTRAINT "assessment_types_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_types" ADD CONSTRAINT "assessment_types_revenue_account_id_fkey" FOREIGN KEY ("revenue_account_id") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_types" ADD CONSTRAINT "assessment_types_late_fee_account_id_fkey" FOREIGN KEY ("late_fee_account_id") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_charges" ADD CONSTRAINT "assessment_charges_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_charges" ADD CONSTRAINT "assessment_charges_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_charges" ADD CONSTRAINT "assessment_charges_assessment_type_id_fkey" FOREIGN KEY ("assessment_type_id") REFERENCES "assessment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_party_id_fkey" FOREIGN KEY ("payer_party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "assessment_charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ap_invoices" ADD CONSTRAINT "ap_invoices_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ap_invoices" ADD CONSTRAINT "ap_invoices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ap_invoice_lines" ADD CONSTRAINT "ap_invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "ap_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
