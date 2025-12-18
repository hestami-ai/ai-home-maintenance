-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityActionType" ADD VALUE 'START_SESSION';
ALTER TYPE "ActivityActionType" ADD VALUE 'ADJOURN';
ALTER TYPE "ActivityActionType" ADD VALUE 'APPROVE_MINUTES';
ALTER TYPE "ActivityActionType" ADD VALUE 'ARCHIVE';
ALTER TYPE "ActivityActionType" ADD VALUE 'PROPOSE';
ALTER TYPE "ActivityActionType" ADD VALUE 'SECOND';
ALTER TYPE "ActivityActionType" ADD VALUE 'OPEN_VOTING';
ALTER TYPE "ActivityActionType" ADD VALUE 'CLOSE_VOTING';
ALTER TYPE "ActivityActionType" ADD VALUE 'TABLE';
ALTER TYPE "ActivityActionType" ADD VALUE 'WITHDRAW';
ALTER TYPE "ActivityActionType" ADD VALUE 'CAST_BALLOT';
ALTER TYPE "ActivityActionType" ADD VALUE 'ADOPT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEntityType" ADD VALUE 'MEETING';
ALTER TYPE "ActivityEntityType" ADD VALUE 'MOTION';
ALTER TYPE "ActivityEntityType" ADD VALUE 'VOTE';
ALTER TYPE "ActivityEntityType" ADD VALUE 'RESOLUTION';
