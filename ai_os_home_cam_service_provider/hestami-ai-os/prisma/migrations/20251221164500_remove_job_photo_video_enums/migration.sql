-- Remove deprecated JOB_PHOTO and JOB_VIDEO enum values from DocumentCategory
-- PostgreSQL doesn't support DROP VALUE, so we recreate the enum type

BEGIN;

-- Create new enum without JOB_PHOTO and JOB_VIDEO
CREATE TYPE "DocumentCategory_new" AS ENUM (
  'GOVERNING_DOCS',
  'FINANCIAL',
  'MEETING',
  'LEGAL',
  'INSURANCE',
  'MAINTENANCE',
  'ARCHITECTURAL',
  'RESERVE_STUDY',
  'INSPECTION',
  'CONTRACT',
  'CC_AND_RS',
  'PERMIT',
  'APPROVAL',
  'CORRESPONDENCE',
  'TITLE_DEED',
  'SURVEY',
  'WARRANTY',
  'LICENSE',
  'CERTIFICATION',
  'BOND',
  'PROPOSAL',
  'ESTIMATE',
  'INVOICE',
  'WORK_ORDER',
  'VOICE_NOTE',
  'SIGNATURE',
  'CHECKLIST',
  'PHOTO',
  'VIDEO',
  'GENERAL'
);

-- Update the column to use the new enum type
ALTER TABLE "documents" ALTER COLUMN "category" TYPE "DocumentCategory_new" 
  USING ("category"::text::"DocumentCategory_new");

-- Drop old enum and rename new one
ALTER TYPE "DocumentCategory" RENAME TO "DocumentCategory_old";
ALTER TYPE "DocumentCategory_new" RENAME TO "DocumentCategory";
DROP TYPE "DocumentCategory_old";

COMMIT;
