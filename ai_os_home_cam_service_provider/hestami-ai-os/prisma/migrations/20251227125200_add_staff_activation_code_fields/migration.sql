-- Phase 19: Staff Onboarding Flow - Add activation code fields
-- This migration adds secure activation code storage for staff self-service onboarding

-- Add activation code columns to staff table
ALTER TABLE "staff" ADD COLUMN "activation_code_encrypted" TEXT;
ALTER TABLE "staff" ADD COLUMN "activation_code_expires_at" TIMESTAMP(3);
