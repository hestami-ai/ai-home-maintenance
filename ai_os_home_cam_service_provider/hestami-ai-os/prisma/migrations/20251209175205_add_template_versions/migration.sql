-- CreateEnum
CREATE TYPE "TemplateVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- AlterTable
ALTER TABLE "communication_templates" ADD COLUMN     "current_version" TEXT;

-- CreateTable
CREATE TABLE "communication_template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "status" "TemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "communication_template_versions_template_id_idx" ON "communication_template_versions"("template_id");

-- CreateIndex
CREATE INDEX "communication_template_versions_status_idx" ON "communication_template_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "communication_template_versions_template_id_version_key" ON "communication_template_versions"("template_id", "version");

-- AddForeignKey
ALTER TABLE "communication_template_versions" ADD CONSTRAINT "communication_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "communication_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
