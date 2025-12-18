-- AlterTable
ALTER TABLE "concierge_cases" ADD COLUMN     "linked_job_id" TEXT,
ADD COLUMN     "linked_unit_id" TEXT;

-- AlterTable
ALTER TABLE "individual_properties" ADD COLUMN     "linked_unit_id" TEXT;
