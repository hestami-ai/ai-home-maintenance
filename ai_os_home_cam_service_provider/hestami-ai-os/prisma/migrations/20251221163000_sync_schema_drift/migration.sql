-- Catch-up migration to sync migration history with database state
-- The database already has these changes applied via prisma db push
-- This migration is marked as applied to reconcile the migration history

-- Add PHOTO and VIDEO to DocumentCategory enum (already exists in DB)
-- These were added manually and via db push
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'PHOTO';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'VIDEO';

-- Note: JOB_PHOTO and JOB_VIDEO already exist from previous migration
-- All other schema changes were applied via db push and are now tracked
