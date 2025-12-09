-- CreateEnum
CREATE TYPE "ARCCategory" AS ENUM ('FENCE', 'ROOF', 'PAINT', 'ADDITION', 'LANDSCAPING', 'WINDOWS', 'DOORS', 'DRIVEWAY', 'GARAGE', 'SOLAR', 'HVAC', 'OTHER');

-- CreateEnum
CREATE TYPE "ARCRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'CHANGES_REQUESTED', 'TABLED', 'WITHDRAWN', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ARCReviewAction" AS ENUM ('APPROVE', 'DENY', 'REQUEST_CHANGES', 'TABLE');

-- CreateEnum
CREATE TYPE "ARCDocumentType" AS ENUM ('PLANS', 'SPECS', 'PHOTO', 'PERMIT', 'RENDERING', 'SURVEY', 'OTHER');

-- CreateTable
CREATE TABLE "arc_requests" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "committee_id" TEXT,
    "unit_id" TEXT,
    "requester_party_id" TEXT NOT NULL,
    "request_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ARCCategory" NOT NULL,
    "status" "ARCRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "estimated_cost" DECIMAL(12,2),
    "proposed_start_date" TIMESTAMP(3),
    "proposed_end_date" TIMESTAMP(3),
    "conditions" TEXT,
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "decision_date" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arc_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arc_documents" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "document_type" "ARCDocumentType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "description" TEXT,
    "version" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arc_committees" (
    "id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "approval_threshold" DECIMAL(5,2) NOT NULL,
    "quorum" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arc_committees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arc_committee_members" (
    "id" TEXT NOT NULL,
    "committee_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "role" TEXT,
    "is_chair" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "arc_committee_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arc_reviews" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "action" "ARCReviewAction" NOT NULL,
    "notes" TEXT,
    "conditions" TEXT,
    "expires_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arc_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "arc_requests_association_id_idx" ON "arc_requests"("association_id");

-- CreateIndex
CREATE INDEX "arc_requests_committee_id_idx" ON "arc_requests"("committee_id");

-- CreateIndex
CREATE INDEX "arc_requests_unit_id_idx" ON "arc_requests"("unit_id");

-- CreateIndex
CREATE INDEX "arc_requests_requester_party_id_idx" ON "arc_requests"("requester_party_id");

-- CreateIndex
CREATE INDEX "arc_requests_status_idx" ON "arc_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "arc_requests_association_id_request_number_key" ON "arc_requests"("association_id", "request_number");

-- CreateIndex
CREATE INDEX "arc_documents_request_id_idx" ON "arc_documents"("request_id");

-- CreateIndex
CREATE INDEX "arc_committees_association_id_idx" ON "arc_committees"("association_id");

-- CreateIndex
CREATE INDEX "arc_committee_members_party_id_idx" ON "arc_committee_members"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "arc_committee_members_committee_id_party_id_key" ON "arc_committee_members"("committee_id", "party_id");

-- CreateIndex
CREATE INDEX "arc_reviews_request_id_idx" ON "arc_reviews"("request_id");

-- CreateIndex
CREATE INDEX "arc_reviews_reviewer_id_idx" ON "arc_reviews"("reviewer_id");

-- AddForeignKey
ALTER TABLE "arc_requests" ADD CONSTRAINT "arc_requests_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arc_requests" ADD CONSTRAINT "arc_requests_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "arc_committees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arc_requests" ADD CONSTRAINT "arc_requests_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arc_requests" ADD CONSTRAINT "arc_requests_requester_party_id_fkey" FOREIGN KEY ("requester_party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arc_documents" ADD CONSTRAINT "arc_documents_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "arc_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arc_committees" ADD CONSTRAINT "arc_committees_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arc_committee_members" ADD CONSTRAINT "arc_committee_members_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "arc_committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arc_committee_members" ADD CONSTRAINT "arc_committee_members_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arc_reviews" ADD CONSTRAINT "arc_reviews_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "arc_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arc_reviews" ADD CONSTRAINT "arc_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
