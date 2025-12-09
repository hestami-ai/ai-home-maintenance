-- CreateTable
CREATE TABLE "board_history" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "detail" JSONB,
    "changed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "board_history_board_id_idx" ON "board_history"("board_id");

-- AddForeignKey
ALTER TABLE "board_history" ADD CONSTRAINT "board_history_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
