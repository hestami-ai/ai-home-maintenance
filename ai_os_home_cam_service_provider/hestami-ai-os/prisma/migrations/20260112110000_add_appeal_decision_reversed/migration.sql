-- Add REVERSED as an alias value in AppealDecision enum
-- Some code uses REVERSED, some uses OVERTURNED - both are valid
ALTER TYPE "AppealDecision" ADD VALUE 'REVERSED';
