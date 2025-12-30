-- Phase 19: Staff Onboarding Flow - Add activation code fields
-- This migration adds secure activation code storage for staff self-service onboarding

-- Add activation code columns to staff table (using IF NOT EXISTS for idempotency)
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "activation_code_encrypted" TEXT;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "activation_code_expires_at" TIMESTAMP(3);
