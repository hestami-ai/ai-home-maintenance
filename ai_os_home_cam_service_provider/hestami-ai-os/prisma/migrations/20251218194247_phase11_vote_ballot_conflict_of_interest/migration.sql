-- AlterTable
ALTER TABLE "vote_ballots" ADD COLUMN     "conflict_notes" TEXT,
ADD COLUMN     "has_conflict_of_interest" BOOLEAN NOT NULL DEFAULT false;
