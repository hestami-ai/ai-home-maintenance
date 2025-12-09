-- CreateEnum
CREATE TYPE "BoardRole" AS ENUM ('PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'TREASURER', 'DIRECTOR', 'MEMBER_AT_LARGE');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('BOARD', 'ANNUAL', 'SPECIAL');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'HELD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeetingAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "VoteMethod" AS ENUM ('IN_PERSON', 'PROXY', 'ELECTRONIC');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('YES', 'NO', 'ABSTAIN');

-- CreateTable
CREATE TABLE "boards" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_members" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "role" "BoardRole" NOT NULL,
    "term_start" TIMESTAMP(3) NOT NULL,
    "term_end" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "board_id" TEXT,
    "type" "MeetingType" NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_agenda_items" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_agenda_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_minutes" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_minutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_attendance" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "status" "MeetingAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "proxy_for_party_id" TEXT,
    "checked_in_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "agenda_item_id" TEXT,
    "question" TEXT NOT NULL,
    "method" "VoteMethod" NOT NULL DEFAULT 'IN_PERSON',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote_ballots" (
    "id" TEXT NOT NULL,
    "vote_id" TEXT NOT NULL,
    "voter_party_id" TEXT NOT NULL,
    "choice" "VoteChoice" NOT NULL,
    "cast_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_ballots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boards_association_id_idx" ON "boards"("association_id");

-- CreateIndex
CREATE INDEX "board_members_party_id_idx" ON "board_members"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_members_board_id_party_id_term_start_key" ON "board_members"("board_id", "party_id", "term_start");

-- CreateIndex
CREATE INDEX "meetings_association_id_idx" ON "meetings"("association_id");

-- CreateIndex
CREATE INDEX "meetings_board_id_idx" ON "meetings"("board_id");

-- CreateIndex
CREATE INDEX "meetings_scheduled_for_idx" ON "meetings"("scheduled_for");

-- CreateIndex
CREATE INDEX "meeting_agenda_items_meeting_id_idx" ON "meeting_agenda_items"("meeting_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_minutes_meeting_id_key" ON "meeting_minutes"("meeting_id");

-- CreateIndex
CREATE INDEX "meeting_attendance_proxy_for_party_id_idx" ON "meeting_attendance"("proxy_for_party_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_attendance_meeting_id_party_id_key" ON "meeting_attendance"("meeting_id", "party_id");

-- CreateIndex
CREATE INDEX "votes_meeting_id_idx" ON "votes"("meeting_id");

-- CreateIndex
CREATE INDEX "votes_agenda_item_id_idx" ON "votes"("agenda_item_id");

-- CreateIndex
CREATE INDEX "vote_ballots_voter_party_id_idx" ON "vote_ballots"("voter_party_id");

-- CreateIndex
CREATE UNIQUE INDEX "vote_ballots_vote_id_voter_party_id_key" ON "vote_ballots"("vote_id", "voter_party_id");

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_agenda_item_id_fkey" FOREIGN KEY ("agenda_item_id") REFERENCES "meeting_agenda_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_ballots" ADD CONSTRAINT "vote_ballots_vote_id_fkey" FOREIGN KEY ("vote_id") REFERENCES "votes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_ballots" ADD CONSTRAINT "vote_ballots_voter_party_id_fkey" FOREIGN KEY ("voter_party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
