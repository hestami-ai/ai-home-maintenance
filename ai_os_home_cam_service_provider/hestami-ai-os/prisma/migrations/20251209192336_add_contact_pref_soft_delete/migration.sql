-- AlterTable
ALTER TABLE "contact_preferences" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notification_settings" ADD COLUMN     "deleted_at" TIMESTAMP(3);
