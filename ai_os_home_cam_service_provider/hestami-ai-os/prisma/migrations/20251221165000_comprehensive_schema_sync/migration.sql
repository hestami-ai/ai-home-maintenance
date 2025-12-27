-- Comprehensive Schema Sync Migration
-- This migration documents all schema changes that were applied via prisma db push
-- but not recorded in migration history. The database already has these changes.
-- This migration is marked as applied to reconcile the migration history.

-- ============================================================================
-- NEW ENUMS
-- ============================================================================

CREATE TYPE "AvailabilityType" AS ENUM ('FLEXIBLE', 'SPECIFIC_TIMES', 'URGENT', 'SCHEDULED');
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');
CREATE TYPE "MilestoneType" AS ENUM ('CASE_CREATED', 'VENDOR_ASSIGNED', 'ESTIMATE_RECEIVED', 'ESTIMATE_APPROVED', 'WORK_SCHEDULED', 'WORK_STARTED', 'WORK_COMPLETED', 'INVOICE_RECEIVED', 'PAYMENT_PROCESSED', 'CASE_CLOSED');
CREATE TYPE "PillarAccess" AS ENUM ('CAM', 'OWNER', 'CONTRACTOR');
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'MANAGER', 'COORDINATOR', 'AGENT', 'SUPPORT');
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED');
CREATE TYPE "VendorCandidateStatus" AS ENUM ('SUGGESTED', 'CONTACTED', 'INTERESTED', 'DECLINED', 'SELECTED', 'REJECTED');

-- ============================================================================
-- ENUM MODIFICATIONS
-- ============================================================================

-- ActivityEntityType additions
ALTER TYPE "ActivityEntityType" ADD VALUE IF NOT EXISTS 'STAFF';
ALTER TYPE "ActivityEntityType" ADD VALUE IF NOT EXISTS 'STAFF_ASSIGNMENT';
ALTER TYPE "ActivityEntityType" ADD VALUE IF NOT EXISTS 'VENDOR_CANDIDATE';
ALTER TYPE "ActivityEntityType" ADD VALUE IF NOT EXISTS 'VENDOR_BID';

-- JobStatus additions
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'ESTIMATE_SENT';
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'ESTIMATE_APPROVED';
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'DISPATCHED';
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'INVOICED';
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'PAID';

-- ============================================================================
-- NEW TABLES
-- ============================================================================

-- Staff table
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'AGENT',
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "department" TEXT,
    "phone_extension" TEXT,
    "can_be_assigned_cases" BOOLEAN NOT NULL DEFAULT true,
    "max_active_cases" INTEGER,
    "specializations" TEXT[],
    "notes" TEXT,
    "hired_at" TIMESTAMP(3),
    "terminated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- Staff case assignments
CREATE TABLE "staff_case_assignments" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "staff_case_assignments_pkey" PRIMARY KEY ("id")
);

-- Case availability slots
CREATE TABLE "case_availability_slots" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_availability_slots_pkey" PRIMARY KEY ("id")
);

-- Case communications
CREATE TABLE "case_communications" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "channel" TEXT NOT NULL,
    "from_user_id" TEXT,
    "to_contact" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "thread_id" TEXT,
    "external_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_communications_pkey" PRIMARY KEY ("id")
);

-- Case issues
CREATE TABLE "case_issues" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reported_by_user_id" TEXT,
    "assigned_to_user_id" TEXT,
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_issues_pkey" PRIMARY KEY ("id")
);

-- Case milestones
CREATE TABLE "case_milestones" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "milestoneType" "MilestoneType" NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "target_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "completed_by_user_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_milestones_pkey" PRIMARY KEY ("id")
);

-- Case reviews
CREATE TABLE "case_reviews" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "overall_rating" INTEGER NOT NULL,
    "communication_rating" INTEGER,
    "quality_rating" INTEGER,
    "timeliness_rating" INTEGER,
    "value_rating" INTEGER,
    "review_text" TEXT,
    "reviewed_by_user_id" TEXT NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_public" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "case_reviews_pkey" PRIMARY KEY ("id")
);

-- Vendor candidates
CREATE TABLE "vendor_candidates" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "linked_external_vendor_id" TEXT,
    "vendor_name" TEXT NOT NULL,
    "vendor_email" TEXT,
    "vendor_phone" TEXT,
    "status" "VendorCandidateStatus" NOT NULL DEFAULT 'SUGGESTED',
    "source" TEXT,
    "notes" TEXT,
    "contacted_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_candidates_pkey" PRIMARY KEY ("id")
);

-- Vendor bids
CREATE TABLE "vendor_bids" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "vendor_candidate_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "valid_until" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" TEXT,
    "notes" TEXT,

    CONSTRAINT "vendor_bids_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- TABLE MODIFICATIONS
-- ============================================================================

-- case_attachments additions
ALTER TABLE "case_attachments" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "case_attachments" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "case_attachments" ADD COLUMN IF NOT EXISTS "version_notes" TEXT;
ALTER TABLE "case_attachments" ADD COLUMN IF NOT EXISTS "previous_version_id" TEXT;
ALTER TABLE "case_attachments" ADD COLUMN IF NOT EXISTS "is_latest" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "case_attachments" ADD COLUMN IF NOT EXISTS "locked_at" TIMESTAMP(3);
ALTER TABLE "case_attachments" ADD COLUMN IF NOT EXISTS "locked_by_user_id" TEXT;

-- concierge_cases additions
ALTER TABLE "concierge_cases" ADD COLUMN IF NOT EXISTS "availability_type" "AvailabilityType";
ALTER TABLE "concierge_cases" ADD COLUMN IF NOT EXISTS "availability_notes" TEXT;

-- jobs additions
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "dispatched_at" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "invoiced_at" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS "staff_user_id_idx" ON "staff"("user_id");
CREATE INDEX IF NOT EXISTS "staff_status_idx" ON "staff"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "staff_user_id_key" ON "staff"("user_id");

CREATE INDEX IF NOT EXISTS "staff_case_assignments_staff_id_idx" ON "staff_case_assignments"("staff_id");
CREATE INDEX IF NOT EXISTS "staff_case_assignments_case_id_idx" ON "staff_case_assignments"("case_id");
CREATE INDEX IF NOT EXISTS "staff_case_assignments_is_primary_idx" ON "staff_case_assignments"("is_primary");

CREATE INDEX IF NOT EXISTS "case_availability_slots_case_id_idx" ON "case_availability_slots"("case_id");
CREATE INDEX IF NOT EXISTS "case_availability_slots_start_time_idx" ON "case_availability_slots"("start_time");

CREATE INDEX IF NOT EXISTS "case_communications_case_id_idx" ON "case_communications"("case_id");
CREATE INDEX IF NOT EXISTS "case_communications_direction_idx" ON "case_communications"("direction");
CREATE INDEX IF NOT EXISTS "case_communications_channel_idx" ON "case_communications"("channel");
CREATE INDEX IF NOT EXISTS "case_communications_thread_id_idx" ON "case_communications"("thread_id");

CREATE INDEX IF NOT EXISTS "case_issues_case_id_idx" ON "case_issues"("case_id");
CREATE INDEX IF NOT EXISTS "case_issues_severity_idx" ON "case_issues"("severity");
CREATE INDEX IF NOT EXISTS "case_issues_status_idx" ON "case_issues"("status");

CREATE INDEX IF NOT EXISTS "case_milestones_case_id_idx" ON "case_milestones"("case_id");
CREATE INDEX IF NOT EXISTS "case_milestones_milestoneType_idx" ON "case_milestones"("milestoneType");
CREATE INDEX IF NOT EXISTS "case_milestones_status_idx" ON "case_milestones"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "case_reviews_case_id_key" ON "case_reviews"("case_id");
CREATE INDEX IF NOT EXISTS "case_reviews_reviewed_by_user_id_idx" ON "case_reviews"("reviewed_by_user_id");

CREATE INDEX IF NOT EXISTS "vendor_candidates_case_id_idx" ON "vendor_candidates"("case_id");
CREATE INDEX IF NOT EXISTS "vendor_candidates_organization_id_idx" ON "vendor_candidates"("organization_id");
CREATE INDEX IF NOT EXISTS "vendor_candidates_linked_external_vendor_id_idx" ON "vendor_candidates"("linked_external_vendor_id");
CREATE INDEX IF NOT EXISTS "vendor_candidates_status_idx" ON "vendor_candidates"("status");

CREATE INDEX IF NOT EXISTS "vendor_bids_case_id_idx" ON "vendor_bids"("case_id");
CREATE INDEX IF NOT EXISTS "vendor_bids_vendor_candidate_id_idx" ON "vendor_bids"("vendor_candidate_id");
CREATE INDEX IF NOT EXISTS "vendor_bids_status_idx" ON "vendor_bids"("status");

CREATE INDEX IF NOT EXISTS "case_attachments_is_latest_idx" ON "case_attachments"("is_latest");
CREATE INDEX IF NOT EXISTS "case_attachments_previous_version_id_idx" ON "case_attachments"("previous_version_id");

-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staff_case_assignments" ADD CONSTRAINT "staff_case_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_case_assignments" ADD CONSTRAINT "staff_case_assignments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "case_availability_slots" ADD CONSTRAINT "case_availability_slots_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "case_communications" ADD CONSTRAINT "case_communications_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_communications" ADD CONSTRAINT "case_communications_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "case_issues" ADD CONSTRAINT "case_issues_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_issues" ADD CONSTRAINT "case_issues_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "case_issues" ADD CONSTRAINT "case_issues_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "case_issues" ADD CONSTRAINT "case_issues_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "case_milestones" ADD CONSTRAINT "case_milestones_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_milestones" ADD CONSTRAINT "case_milestones_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "case_reviews" ADD CONSTRAINT "case_reviews_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_reviews" ADD CONSTRAINT "case_reviews_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_candidates" ADD CONSTRAINT "vendor_candidates_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vendor_candidates" ADD CONSTRAINT "vendor_candidates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vendor_candidates" ADD CONSTRAINT "vendor_candidates_linked_external_vendor_id_fkey" FOREIGN KEY ("linked_external_vendor_id") REFERENCES "external_vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vendor_bids" ADD CONSTRAINT "vendor_bids_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vendor_bids" ADD CONSTRAINT "vendor_bids_vendor_candidate_id_fkey" FOREIGN KEY ("vendor_candidate_id") REFERENCES "vendor_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "case_attachments" ADD CONSTRAINT "case_attachments_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "case_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- REMOVED TABLES (already dropped from DB)
-- ============================================================================
-- org_context_audit_log was removed from the schema and database
