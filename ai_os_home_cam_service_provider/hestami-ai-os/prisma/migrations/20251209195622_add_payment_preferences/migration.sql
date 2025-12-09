-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('BANK_ACCOUNT', 'CREDIT_CARD', 'DEBIT_CARD');

-- CreateEnum
CREATE TYPE "AutoPayFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY', 'ON_DUE_DATE');

-- CreateTable
CREATE TABLE "stored_payment_methods" (
    "id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "method_type" "PaymentMethodType" NOT NULL,
    "nickname" TEXT,
    "last_four" TEXT NOT NULL,
    "expiration_month" INTEGER,
    "expiration_year" INTEGER,
    "bank_name" TEXT,
    "processor_token" TEXT NOT NULL,
    "processor_type" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "stored_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_pay_settings" (
    "id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "payment_method_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "AutoPayFrequency" NOT NULL,
    "day_of_month" INTEGER,
    "max_amount" DECIMAL(10,2),
    "association_id" TEXT,
    "assessment_type_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "auto_pay_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stored_payment_methods_party_id_idx" ON "stored_payment_methods"("party_id");

-- CreateIndex
CREATE INDEX "auto_pay_settings_party_id_idx" ON "auto_pay_settings"("party_id");

-- CreateIndex
CREATE INDEX "auto_pay_settings_payment_method_id_idx" ON "auto_pay_settings"("payment_method_id");

-- CreateIndex
CREATE UNIQUE INDEX "auto_pay_settings_party_id_association_id_assessment_type_i_key" ON "auto_pay_settings"("party_id", "association_id", "assessment_type_id");

-- AddForeignKey
ALTER TABLE "stored_payment_methods" ADD CONSTRAINT "stored_payment_methods_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_pay_settings" ADD CONSTRAINT "auto_pay_settings_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_pay_settings" ADD CONSTRAINT "auto_pay_settings_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "stored_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
