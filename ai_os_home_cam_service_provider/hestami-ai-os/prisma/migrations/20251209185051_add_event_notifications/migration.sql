-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "calendar_event_notifications" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "notify_at" TIMESTAMP(3) NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "CommunicationChannel",
    "payload" JSONB,
    "sent_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_event_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_event_notifications_association_id_idx" ON "calendar_event_notifications"("association_id");

-- CreateIndex
CREATE INDEX "calendar_event_notifications_event_id_idx" ON "calendar_event_notifications"("event_id");

-- CreateIndex
CREATE INDEX "calendar_event_notifications_status_idx" ON "calendar_event_notifications"("status");

-- AddForeignKey
ALTER TABLE "calendar_event_notifications" ADD CONSTRAINT "calendar_event_notifications_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_notifications" ADD CONSTRAINT "calendar_event_notifications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
