-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityActionType" ADD VALUE 'CLASSIFY';
ALTER TYPE "ActivityActionType" ADD VALUE 'VERSION';
ALTER TYPE "ActivityActionType" ADD VALUE 'SUPERSEDE';
ALTER TYPE "ActivityActionType" ADD VALUE 'REFERENCED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentContextType" ADD VALUE 'VIOLATION';
ALTER TYPE "DocumentContextType" ADD VALUE 'ARC_REQUEST';
