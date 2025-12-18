-- AlterTable
ALTER TABLE "resolutions" ADD COLUMN     "motion_id" TEXT;

-- CreateIndex
CREATE INDEX "resolutions_motion_id_idx" ON "resolutions"("motion_id");

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_motion_id_fkey" FOREIGN KEY ("motion_id") REFERENCES "board_motions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
