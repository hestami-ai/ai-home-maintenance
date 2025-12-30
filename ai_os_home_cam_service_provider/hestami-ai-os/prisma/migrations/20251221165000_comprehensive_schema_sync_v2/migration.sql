-- Comprehensive Schema Sync Migration v2
-- This migration creates tables and enums that were previously applied via db push
-- but not recorded in migration history.

-- ============================================================================
-- NEW ENUMS (if not exists)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE "AvailabilityType" AS ENUM ('FLEXIBLE', 'SPECIFIC');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'SMS', 'PHONE', 'IN_APP', 'PORTAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'BLOCKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MilestoneType" AS ENUM ('INTAKE_COMPLETE', 'ASSESSMENT_COMPLETE', 'SCOPE_DEFINED', 'VENDOR_SELECTED', 'WORK_STARTED', 'WORK_COMPLETE', 'INSPECTION_PASSED', 'PAYMENT_PROCESSED', 'CASE_CLOSED', 'CUSTOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PillarAccess" AS ENUM ('CAM', 'CONCIERGE', 'CONTRACTOR', 'VENDOR', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "StaffRole" AS ENUM ('CONCIERGE_OPERATOR', 'OPERATIONS_COORDINATOR', 'CAM_SPECIALIST', 'VENDOR_LIAISON', 'PLATFORM_ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "StaffStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "VendorCandidateStatus" AS ENUM ('IDENTIFIED', 'CONTACTED', 'RESPONDED', 'QUOTED', 'SELECTED', 'REJECTED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- ENUM VALUE ADDITIONS (safe - only adds if not exists)
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

-- StorageProvider additions
ALTER TYPE "StorageProvider" ADD VALUE IF NOT EXISTS 'SEAWEEDFS';

-- ============================================================================
-- NEW TABLES
-- ============================================================================

-- Staff table
CREATE TABLE IF NOT EXISTS "staff" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "title" TEXT,
    "status" "StaffStatus" NOT NULL DEFAULT 'PENDING',
    "activated_at" TIMESTAMP(3),
    "suspended_at" TIMESTAMP(3),
    "deactivated_at" TIMESTAMP(3),
    "suspension_reason" TEXT,
    "deactivation_reason" TEXT,
    "roles" "StaffRole"[],
    "pillar_access" "PillarAccess"[],
    "activation_code_encrypted" TEXT,
    "activation_code_expires_at" TIMESTAMP(3),
    "can_be_assigned_cases" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- Staff case assignments
CREATE TABLE IF NOT EXISTS "staff_case_assignments" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMP(3),
    "justification" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_case_assignments_pkey" PRIMARY KEY ("id")
);

-- Case availability slots
CREATE TABLE IF NOT EXISTS "case_availability_slots" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_availability_slots_pkey" PRIMARY KEY ("id")
);

-- Case communications
CREATE TABLE IF NOT EXISTS "case_communications" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "from_user_id" TEXT,
    "to_recipient" TEXT,
    "cc_recipients" TEXT,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "thread_id" TEXT,
    "external_message_id" TEXT,
    "attachment_ids" JSONB,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_communications_pkey" PRIMARY KEY ("id")
);

-- Case issues
CREATE TABLE IF NOT EXISTS "case_issues" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reported_by_user_id" TEXT NOT NULL,
    "assigned_to_user_id" TEXT,
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_issues_pkey" PRIMARY KEY ("id")
);

-- Case milestones
CREATE TABLE IF NOT EXISTS "case_milestones" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "milestoneType" "MilestoneType" NOT NULL,
    "custom_name" TEXT,
    "description" TEXT,
    "sequence_order" INTEGER NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "blocker_reason" TEXT,
    "target_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "completed_by_user_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_milestones_pkey" PRIMARY KEY ("id")
);

-- Case reviews
CREATE TABLE IF NOT EXISTS "case_reviews" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "overall_satisfaction" INTEGER,
    "communication_rating" INTEGER,
    "timeliness_rating" INTEGER,
    "vendor_rating" INTEGER,
    "vendor_performance_notes" TEXT,
    "outcome_summary" TEXT NOT NULL,
    "issues_encountered" TEXT,
    "lessons_learned" TEXT,
    "reusable_vendor" BOOLEAN NOT NULL DEFAULT false,
    "reusable_scope" BOOLEAN NOT NULL DEFAULT false,
    "reusable_process" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_user_id" TEXT NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_reviews_pkey" PRIMARY KEY ("id")
);

-- Vendor candidates
CREATE TABLE IF NOT EXISTS "vendor_candidates" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "linked_external_vendor_id" TEXT,
    "vendor_name" TEXT NOT NULL,
    "vendor_contact_name" TEXT,
    "vendor_contact_email" TEXT,
    "vendor_contact_phone" TEXT,
    "vendor_address" TEXT,
    "vendor_website" TEXT,
    "service_categories" JSONB,
    "coverage_area" TEXT,
    "licenses_and_certs" JSONB,
    "status" "VendorCandidateStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "status_changed_at" TIMESTAMP(3),
    "source_url" TEXT,
    "source_html" TEXT,
    "source_plain_text" TEXT,
    "extracted_at" TIMESTAMP(3),
    "extraction_confidence" DOUBLE PRECISION,
    "extraction_metadata" JSONB,
    "notes" TEXT,
    "risk_flags" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vendor_candidates_pkey" PRIMARY KEY ("id")
);

-- Vendor bids
CREATE TABLE IF NOT EXISTS "vendor_bids" (
    "id" TEXT NOT NULL,
    "vendor_candidate_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "scope_version" TEXT,
    "amount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "valid_until" TIMESTAMP(3),
    "labor_cost" DECIMAL(12,2),
    "materials_cost" DECIMAL(12,2),
    "other_costs" DECIMAL(12,2),
    "estimated_start_date" TIMESTAMP(3),
    "estimated_duration" INTEGER,
    "estimated_end_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "received_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "notes" TEXT,
    "attachment_ids" JSONB,
    "recommendation" TEXT,
    "recommendation_rationale" TEXT,
    "is_recommended" BOOLEAN,
    "is_customer_facing" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_bids_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- TABLE MODIFICATIONS (using IF NOT EXISTS for columns)
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
ALTER TABLE "concierge_cases" ADD COLUMN IF NOT EXISTS "availability_type" "AvailabilityType" NOT NULL DEFAULT 'FLEXIBLE';
ALTER TABLE "concierge_cases" ADD COLUMN IF NOT EXISTS "availability_notes" TEXT;

-- jobs additions
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "dispatched_at" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "invoiced_at" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);

-- ============================================================================
-- INDEXES (using IF NOT EXISTS)
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
-- FOREIGN KEYS (using DO blocks to handle existing constraints)
-- ============================================================================

DO $$ BEGIN
    ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "staff_case_assignments" ADD CONSTRAINT "staff_case_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "staff_case_assignments" ADD CONSTRAINT "staff_case_assignments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "case_availability_slots" ADD CONSTRAINT "case_availability_slots_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "case_communications" ADD CONSTRAINT "case_communications_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "case_communications" ADD CONSTRAINT "case_communications_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "case_issues" ADD CONSTRAINT "case_issues_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "case_issues" ADD CONSTRAINT "case_issues_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "case_issues" ADD CONSTRAINT "case_issues_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "case_issues" ADD CONSTRAINT "case_issues_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "case_milestones" ADD CONSTRAINT "case_milestones_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "case_milestones" ADD CONSTRAINT "case_milestones_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "case_reviews" ADD CONSTRAINT "case_reviews_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "case_reviews" ADD CONSTRAINT "case_reviews_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "vendor_candidates" ADD CONSTRAINT "vendor_candidates_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "vendor_candidates" ADD CONSTRAINT "vendor_candidates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "vendor_candidates" ADD CONSTRAINT "vendor_candidates_linked_external_vendor_id_fkey" FOREIGN KEY ("linked_external_vendor_id") REFERENCES "external_vendor_contexts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "vendor_bids" ADD CONSTRAINT "vendor_bids_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "concierge_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "vendor_bids" ADD CONSTRAINT "vendor_bids_vendor_candidate_id_fkey" FOREIGN KEY ("vendor_candidate_id") REFERENCES "vendor_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "case_attachments" ADD CONSTRAINT "case_attachments_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "case_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- CLEANUP: Remove tables that were dropped from schema
-- ============================================================================

-- org_context_audit_log was removed from the schema
DROP TABLE IF EXISTS "org_context_audit_log";
