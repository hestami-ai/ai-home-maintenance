/*
  Warnings:

  - You are about to drop the column `deleted_at` on the `associations` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "associations" DROP COLUMN "deleted_at";

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "notify_at" TIMESTAMP(3),
ADD COLUMN     "recurrence_rule" TEXT;

-- CreateTable
CREATE TABLE "mass_communication_deliveries" (
    "id" TEXT NOT NULL,
    "mass_communication_id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mass_communication_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "id" TEXT NOT NULL,
    "announcement_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mass_communication_deliveries_mass_communication_id_idx" ON "mass_communication_deliveries"("mass_communication_id");

-- CreateIndex
CREATE INDEX "mass_communication_deliveries_status_idx" ON "mass_communication_deliveries"("status");

-- CreateIndex
CREATE INDEX "announcement_reads_party_id_idx" ON "announcement_reads"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_reads_announcement_id_party_id_key" ON "announcement_reads"("announcement_id", "party_id");

-- AddForeignKey
ALTER TABLE "mass_communication_deliveries" ADD CONSTRAINT "mass_communication_deliveries_mass_communication_id_fkey" FOREIGN KEY ("mass_communication_id") REFERENCES "mass_communications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
