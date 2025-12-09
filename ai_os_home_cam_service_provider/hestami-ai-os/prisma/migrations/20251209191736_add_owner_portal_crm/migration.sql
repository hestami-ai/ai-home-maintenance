-- CreateEnum
CREATE TYPE "ContactPreferenceChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'MAIL', 'PORTAL');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('GENERAL', 'BILLING', 'MAINTENANCE', 'GOVERNANCE', 'ARC', 'VIOLATION', 'COMMUNICATION');

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "preferred_name" TEXT,
    "profile_photo_url" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "mailing_address" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_preferences" (
    "id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "channel" "ContactPreferenceChannel" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "allow_transactional" BOOLEAN NOT NULL DEFAULT true,
    "allow_marketing" BOOLEAN NOT NULL DEFAULT false,
    "allow_emergency" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "channel" "ContactPreferenceChannel" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_party_id_key" ON "user_profiles"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_preferences_party_id_channel_key" ON "contact_preferences"("party_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_party_id_category_channel_key" ON "notification_settings"("party_id", "category", "channel");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_preferences" ADD CONSTRAINT "contact_preferences_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
