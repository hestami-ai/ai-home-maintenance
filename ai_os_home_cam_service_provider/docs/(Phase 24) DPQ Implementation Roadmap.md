# Phase 24: Document Processing Queue - Implementation Roadmap

**Related Requirements**: `(Phase 24) Document Processing Queue Requirements.md`  
**Status**: In Progress (Phase 10 Completed)  
**Last Updated**: December 31, 2025

---

## Overview

This roadmap breaks down the Document Processing Queue (DPQ) implementation into discrete, trackable tasks organized by phase. Each task includes acceptance criteria and dependencies.

---

## Phase 1: Schema and Backend Foundation

**Goal**: Establish database schema changes and core backend infrastructure.

### 1.1 Database Migration

- [x] **1.1.1** Create migration file `prisma/migrations/20251231014322_document_processing_queue/migration.sql`
- [x] **1.1.2** Add new `DocumentStatus` enum values:
  - [x] `PENDING_UPLOAD`
  - [x] `PROCESSING`
  - [x] `PROCESSING_FAILED`
  - [x] `INFECTED`
- [x] **1.1.3** Add processing metadata columns to `Document` model:
  - [x] `processing_started_at TIMESTAMPTZ(3)`
  - [x] `processing_completed_at TIMESTAMPTZ(3)`
  - [x] `processing_attempt_count INT DEFAULT 0`
  - [x] `processing_next_retry_at TIMESTAMPTZ(3)`
  - [x] `processing_error_type TEXT`
  - [x] `processing_error_message TEXT`
  - [x] `processing_error_details JSONB`
- [x] **1.1.4** Add database indexes:
  - [x] `idx_documents_status` on `status`
  - [x] `idx_documents_processing_retry` on `(status, processing_next_retry_at)`
  - [x] `idx_documents_org_status` on `(organization_id, status)`
- [x] **1.1.5** Run `npx prisma generate` to update Prisma client and Zod schemas
- [x] **1.1.6** Verify migration applies cleanly in dev environment

**Acceptance Criteria**:
- Migration runs without errors
- `npx prisma generate` completes successfully
- New enum values available in `generated/prisma/` and `generated/zod/`

### 1.2 SECURITY DEFINER Functions

- [x] **1.2.1** Create `update_document_processing_status(p_document_id TEXT, p_status TEXT, p_error_type TEXT, p_error_message TEXT, p_error_details JSONB, p_attempt_count INT, p_next_retry_at TIMESTAMPTZ)` function
- [x] **1.2.2** Create `list_documents_by_processing_status(p_status TEXT, p_limit INT, p_offset INT)` function for admin cross-org queries
- [x] **1.2.3** Create `get_processing_queue_stats()` function returning aggregate counts
- [x] **1.2.4** Grant EXECUTE permissions to `hestami_app` user for all functions
- [x] **1.2.5** Test functions bypass RLS correctly

**Acceptance Criteria**:
- Functions execute successfully when called via `prisma.$queryRaw`
- Functions return correct data across all organizations
- RLS does not block function execution

### 1.3 Schema Re-exports

- [x] **1.3.1** Update `src/lib/server/api/schemas.ts`:
  - [x] Re-export `DocumentStatusSchema` if not already present
  - [x] Add any new response schemas for DPQ endpoints
- [x] **1.3.2** Update `src/lib/server/workflows/schemas.ts`:
  - [x] Re-export `DocumentStatus` enum
  - [x] Add `ProcessingMetadata` interface
- [x] **1.3.3** Run `npm run check` - must pass with 0 errors (Verified generated types)

**Acceptance Criteria**:
- All new enum values importable from schema files
- TypeScript compilation passes

---

## Phase 2: Workflow Updates

**Goal**: Update document workflow to use new statuses and implement error classification.

### 2.1 Error Classification

- [x] **2.1.1** Add `classifyError(error: Error)` function to `documentWorkflow.ts`
- [x] **2.1.2** Implement transient error detection (HTTP 500/502/503, timeout, network)
- [x] **2.1.3** Implement permanent error detection (corrupt file, unsupported format)
- [x] **2.1.4** Add unit tests for error classification (DEFERRED)

**Acceptance Criteria**:
- Function correctly categorizes known error types
- Unknown errors default to `TRANSIENT` (safer for retry)

### 2.2 Status Transitions in HANDLE_TUS_HOOK

- [x] **2.2.1** Update workflow to set `PROCESSING` status when TUS hook fires
- [x] **2.2.2** Set `processing_started_at` timestamp
- [x] **2.2.3** On success: transition to `ACTIVE`, set `processing_completed_at`
- [x] **2.2.4** On malware detected: transition to `INFECTED`, store malware info
- [x] **2.2.5** On transient error: transition to `PROCESSING_FAILED`, calculate `next_retry_at`
- [x] **2.2.6** On permanent error: transition to `PROCESSING_FAILED`, set `error_type = 'PERMANENT'`
- [x] **2.2.7** Increment `processing_attempt_count` on each attempt
- [x] **2.2.8** Use SECURITY DEFINER functions for all status updates

**Acceptance Criteria**:
- Workflow correctly transitions through all status states
- Processing metadata is populated correctly
- No RLS errors during status updates

### 2.3 Activity Events

- [x] **2.3.1** Add activity event for `PROCESSING_STARTED`
- [x] **2.3.2** Add activity event for `PROCESSING_COMPLETED`
- [x] **2.3.3** Add activity event for `PROCESSING_FAILED`
- [x] **2.3.4** Add activity event for `MALWARE_DETECTED`
- [x] **2.3.5** Verify events appear in activity timeline

**Acceptance Criteria**:
- All processing events recorded in `activity_events` table
- Events include relevant metadata (document ID, error info, etc.)

---

## Phase 3: Retry Infrastructure

**Goal**: Implement automatic retry scheduling and execution.

### 3.1 Retry Scheduling Logic

- [x] **3.1.1** Add `calculateNextRetryTime(attemptCount: number)` function
- [x] **3.1.2** Implement exponential backoff: `interval * (backoff ^ attemptCount)`
- [x] **3.1.3** Read configuration from environment variables:
  - [x] `DPQ_RETRY_INTERVAL_SECONDS`
  - [x] `DPQ_RETRY_BACKOFF_MULTIPLIER`
  - [x] `DPQ_MAX_RETRY_ATTEMPTS`
- [x] **3.1.4** Update workflow to schedule retry on transient failure

**Acceptance Criteria**:
- Retry times calculated correctly with backoff
- Configuration read from environment

### 3.2 Retry Workflow

- [x] **3.2.1** Create `src/lib/server/workflows/documentProcessingRetryWorkflow.ts`
- [x] **3.2.2** Implement `RETRY_DOCUMENT` action
- [x] **3.2.3** Query document, verify eligible for retry (status, attempts)
- [x] **3.2.4** Reset status to `PROCESSING`, dispatch to worker
- [x] **3.2.5** Handle success/failure same as original workflow
- [x] **3.2.6** Add activity event for `RETRY_TRIGGERED` (using `DISPATCH` action)
- [x] **3.2.7** Register workflow with version suffix `_v1`

**Acceptance Criteria**:
- Retry workflow successfully reprocesses failed documents
- Attempt count incremented correctly
- Activity events recorded

### 3.3 Scheduled Retry Job

- [x] **3.3.1** Create DBOS scheduled workflow for retry polling
- [x] **3.3.2** Query documents where `status = 'PROCESSING_FAILED'` AND `processing_next_retry_at <= NOW()` AND `processing_error_type = 'TRANSIENT'` AND `processing_attempt_count < max_attempts`
- [x] **3.3.3** Batch process up to 10 documents per run
- [x] **3.3.4** Use distributed lock to prevent concurrent runs (handled by DBOS)
- [x] **3.3.5** Configure schedule interval (every 1 minute)
- [x] **3.3.6** Add activity event for `RETRY_SCHEDULED` (using `SCHEDULE` action)

**Acceptance Criteria**:
- Job runs on schedule
- Only eligible documents are retried
- No duplicate retries (distributed lock works)

---

## Phase 4: Rate Limiting

**Goal**: Implement fair resource allocation across organizations.

### 4.1 Concurrent Processing Limits

- [x] **4.1.1** Add `get_org_processing_count(p_org_id TEXT)` SECURITY DEFINER function
- [x] **4.1.2** Add `get_global_processing_count()` SECURITY DEFINER function
- [x] **4.1.3** Read limits from environment:
  - [x] `DPQ_MAX_CONCURRENT_PER_ORG`
  - [x] `DPQ_GLOBAL_MAX_CONCURRENT`
- [x] **4.1.4** Check limits before starting processing in workflow
- [x] **4.1.5** If limit reached, keep document in `PENDING_UPLOAD` or queue state

**Acceptance Criteria**:
- Processing respects per-org and global limits
- Documents queue when limits reached

### 4.2 Queue Depth Limits

- [x] **4.2.1** Add `get_org_queue_depth(p_org_id TEXT)` function
- [x] **4.2.2** Read limit from `DPQ_MAX_QUEUED_PER_ORG`
- [x] **4.2.3** Reject new uploads if queue depth exceeded
- [x] **4.2.4** Return appropriate error message to user

**Acceptance Criteria**:
- Uploads rejected with clear error when queue full
- Existing queued documents not affected

---

## Phase 5: Admin API

**Goal**: Create oRPC endpoints for admin DPQ management.

### 5.1 Router Setup
- [x] **5.1.1** Create `src/lib/server/api/routes/documentProcessing.ts`
- [x] **5.1.2** Define router using `adminProcedure` base (Updated to use global Cerbos check)
- [x] **5.1.3** Register in `src/lib/server/api/index.ts` as `documentProcessing: documentProcessingRouter`
- [x] **5.1.4** Run `npm run openapi:generate && npm run types:generate`

**Acceptance Criteria**:
- Router registered and accessible at `/api/v1/rpc/documentProcessing/*`
- OpenAPI spec updated

### 5.2 Query Endpoints
- [x] **5.2.1** Implement `getQueueStats` - dashboard metrics
- [x] **5.2.2** Implement `listQueue` - list documents with various status filters (Combined listProcessing, listFailed, listInfected)
- [x] **5.2.3** Implement `getSettings` - current DPQ configuration
- [x] **5.2.4** Add pagination to list endpoints

**Acceptance Criteria**:
- All endpoints return correct data
- Pagination works correctly
- Type-safe errors used

### 5.3 Mutation Endpoints
- [x] **5.3.1** Implement `retryDocument` - retry single document
- [x] **5.3.2** Implement `updateSettings` - update DPQ configuration in DB

**Acceptance Criteria**:
- Mutations work correctly
- Activity events recorded for audit

### 5.4 Cerbos Policy
- [x] **5.4.1** Create `cerbos/policies/resource/document_processing.yaml`
- [x] **5.4.2** Define actions for platform admins and staff
- [x] **5.4.3** Test policy

**Acceptance Criteria**:
- Policy loads without errors
- Authorization works correctly

---

## Phase 6: User API Enhancements

**Goal**: Update existing document API for user-facing status visibility.

### 6.1 Document List Enhancements

- [x] **6.1.1** Add `status` filter to `document.list` endpoint
- [x] **6.1.2** Include processing status fields in list response
- [x] **6.1.3** Exclude `ARCHIVED` and `INFECTED` from default list
- [x] **6.1.4** Add `includeProcessing` filter option

**Acceptance Criteria**:
- Users can filter by status
- Processing documents visible with appropriate indicators

### 6.2 Document Detail Enhancements

- [x] **6.2.1** Include processing metadata in `document.get` response for failed documents
- [x] **6.2.2** Sanitize error details (remove internal info) before returning to user
- [x] **6.2.3** Include user-friendly error message

**Acceptance Criteria**:
- Users see appropriate error information
- No internal details leaked

### 6.3 Cancel Upload

- [x] **6.3.1** Implement `document.cancelUpload` endpoint
- [x] **6.3.2** Only allow cancel for `PENDING_UPLOAD` or `PROCESSING` status
- [x] **6.3.3** Clean up S3 object if exists
- [x] **6.3.4** Set status to `ARCHIVED`

**Acceptance Criteria**:
- Users can cancel in-progress uploads
- S3 storage cleaned up

---

## Phase 7: User Interface - Document List

**Goal**: Update document list UI with status indicators.

### 7.1 Status Indicators

- [x] **7.1.1** Create `DocumentStatusBadge.svelte` component
- [x] **7.1.2** Implement status-specific icons (spinner, clock, warning, checkmark, archive)
- [x] **7.1.3** Implement status-specific colors (blue, yellow, red, green, gray)
- [x] **7.1.4** Add tooltips with status descriptions
- [x] **7.1.5** Integrate into document list views:
  - [x] `/app/concierge/documents` (List and Detail)

**Acceptance Criteria**:
- Status clearly visible in document lists
- Tooltips provide helpful context

### 7.2 Processing Feedback

- [x] **7.2.1** Show spinner during `PROCESSING` status
- [x] **7.2.2** Show "Processing delayed" message for `PROCESSING_FAILED` with retries remaining
- [x] **7.2.3** Show error indicator for `PROCESSING_FAILED` with exhausted retries
- [x] **7.2.4** Add "Delete" action for failed documents

**Acceptance Criteria**:
- Users understand document processing state
- Users can take appropriate action on failed documents

### 7.3 Upload Flow Updates

- [x] **7.3.1** Update upload component to show "Scanning for security..." during processing
- [x] **7.3.2** Show success feedback on `ACTIVE` status (via Detail page Alert)
- [x] **7.3.3** Show error feedback on permanent failure (via Detail page Alert)
- [x] **7.3.4** Show rejection feedback on `INFECTED` status (via Detail page Alert)
- [x] **7.3.5** Handle upload failure before save (immediate error display)

**Acceptance Criteria**:
- Users receive appropriate feedback at each stage
- Error messages are clear and actionable

---

## Phase 8: Admin UI

**Goal**: Create dedicated admin page for DPQ management.

### 8.1 Page Setup

- [x] **8.1.1** Create `src/routes/app/admin/document-processing/+page.svelte`
- [x] **8.1.2** Create `src/routes/app/admin/document-processing/+page.server.ts`
- [x] **8.1.3** Implement access control (require `STAFF` with `ADMIN` or `SUPPORT` role)
- [x] **8.1.4** Use `createDirectClient` with `buildServerContext` for SSR
- [x] **8.1.5** Add navigation link in admin sidebar

**Acceptance Criteria**:
- Page accessible at `/app/admin/document-processing`
- Non-authorized users redirected

### 8.2 Dashboard Metrics

- [x] **8.2.1** Display "Currently Processing" count
- [x] **8.2.2** Display "Failed - Awaiting Retry" count
- [x] **8.2.3** Display "Failed - Needs Attention" count with red badge
- [x] **8.2.4** Display "Infected - Quarantined" count with orange badge
- [x] **8.2.5** Display "Processed Today" count
- [x] **8.2.6** Display "Success Rate (24h)" percentage
- [x] **8.2.7** Auto-refresh metrics every 30 seconds

**Acceptance Criteria**:
- Metrics display correctly
- Badges highlight items needing attention

### 8.3 Alert Banner

- [x] **8.3.1** Show alert when "Failed - Needs Attention" > 0
- [x] **8.3.2** Display count and most common error type
- [x] **8.3.3** Include "View Details" link to failed tab
- [x] **8.3.4** Include "Bulk Retry All" action button (Placeholder implemented)

**Acceptance Criteria**:
- Alert prominently displayed when issues exist
- Quick actions available

### 8.4 Queue Tabs

- [x] **8.4.1** Implement tab navigation (Processing, Auto-Retry, Needs Attention, Infected, History)
- [x] **8.4.2** **Processing Tab**:
  - [x] Display document ID, org, user, filename, started at, duration
  - [x] Real-time updates
- [x] **8.4.3** **Auto-Retry Tab**:
  - [x] Display document ID, org, user, filename, error, attempts, next retry
  - [x] "Retry Now" action
  - [ ] "Cancel Retry" action (Deferred) -- *Requires DBOS workflow cancellation infrastructure.*
- [x] **8.4.4** **Needs Attention Tab**:
  - [x] Display document ID, org, user, filename, error type, error details, failed at
  - [x] "Retry" action
  - [ ] "Mark Resolved" action (Deferred) -- *Requires a new 'MARK_RESOLVED' workflow and endpoint.*
  - [x] Bulk selection and bulk retry (UI implemented)
  - [x] Expandable error details (Placeholder handled by status badge)
- [x] **8.4.5** **Infected Tab**:
  - [x] Display document ID, org, user, filename, malware signature, detected at
  - [x] "View Details" action
  - [ ] "Delete Permanently" action with confirmation (Deferred) -- *Requires file disposal service.*
  - [ ] "False Positive - Reprocess" action with confirmation (Deferred) -- *Requires bypass workflow.*
  - [ ] "Notify User" action (Deferred) -- *Requires Phase 9 notification integration.*
- [x] **8.4.6** **History Tab**:
  - [x] Display document ID, org, user, filename, status, duration, completed at
  - [ ] Date range filter (Deferred) -- *Reporting enhancement.*
  - [ ] Status filter (Deferred) -- *Reporting enhancement.*
  - [ ] Organization filter (Deferred) -- *Reporting enhancement.*
  - [ ] Export to CSV (Deferred) -- *Reporting enhancement.*

**Acceptance Criteria**:
- All tabs functional with correct data
- Actions work correctly
- Bulk operations work

### 8.5 Settings Panel

- [x] **8.5.1** Create settings modal or panel
- [x] **8.5.2** Display current configuration values
- [x] **8.5.3** Allow editing (admin only):
  - [x] Auto-retry enabled toggle
  - [x] Max retry attempts
  - [x] Retry interval
  - [x] Backoff multiplier
  - [x] Infected retention days
- [x] **8.5.4** Save settings via `updateSettings` endpoint
- [ ] **8.5.5** Show restart notice if settings require restart (Deferred) -- *Worker currently hot-swaps config.*

**Acceptance Criteria**:
- Settings viewable and editable
- Changes persist correctly

---

## Phase 9: Notifications

**Goal**: Implement user notifications for processing events.

### 9.1 In-App Notifications

- [x] **9.1.1** Create notification on processing complete (success)
- [x] **9.1.2** Create notification on processing failed (exhausted retries)
- [x] **9.1.3** Create notification on file rejected (infected)
- [x] **9.1.4** Integrate with existing notification system

**Acceptance Criteria**:
- Users receive in-app notifications
- Notifications link to relevant document

### 9.2 Email Notifications (Optional)

- [x] **9.2.1** Add user preference for processing email notifications (Leveraged NotificationCategory.DOCUMENT_PROCESSING)
- [x] **9.2.2** Send email on processing complete (if opted in)
- [x] **9.2.3** Send email on processing failed (if opted in)
- [x] **9.2.4** Always send email on infected file (security notification)

**Acceptance Criteria**:
- Emails sent according to preferences
- Email content is clear and actionable

---

## Phase 10: Monitoring and Cleanup

**Goal**: Implement observability and maintenance jobs.

### 10.1 OpenTelemetry Metrics

- [x] **10.1.1** Add counter: `document.processing.started`
- [x] **10.1.2** Add counter: `document.processing.completed`
- [x] **10.1.3** Add counter: `document.processing.failed`
- [x] **10.1.4** Add counter: `document.processing.infected`
- [x] **10.1.5** Add histogram: `document.processing.duration`
- [x] **10.1.6** Add gauge: `document.processing.queue_depth`
- [x] **10.1.7** Add gauge: `document.processing.retry_queue_depth`
- [x] **10.1.8** Verify metrics visible in SigNoz

**Acceptance Criteria**:
- All metrics exported correctly
- Metrics visible in observability dashboard

### 10.2 Alerts

- [x] **10.2.1** Configure alert: Failed - Needs Attention > 10 (Critical)
- [x] **10.2.2** Configure alert: Success rate < 80% (1h) (Critical)
- [x] **10.2.3** Configure alert: Worker unavailable > 5 min (Critical)
- [x] **10.2.4** Configure alert: Infected documents > 5 (24h) (Warning)

**Acceptance Criteria**:
- Alerts trigger correctly
- Notifications sent to appropriate channels

### 10.3 Cleanup Job

- [x] **10.3.1** Create scheduled job for cleanup tasks
- [x] **10.3.2** Delete quarantined files past retention period (`DPQ_INFECTED_RETENTION_DAYS`)
- [x] **10.3.3** Clean up orphaned S3 objects (files without document records)
- [x] **10.3.4** Archive old processing history (> 90 days)
- [x] **10.3.5** Schedule daily execution

**Acceptance Criteria**:
- Cleanup runs on schedule
- Old data removed correctly
- No data loss for active documents

---

## Phase 11: Testing - Deferred

**Goal**: Comprehensive test coverage.

### 11.1 Unit Tests

- [ ] **11.1.1** Test error classification logic
- [ ] **11.1.2** Test retry scheduling logic
- [ ] **11.1.3** Test rate limiting logic
- [ ] **11.1.4** Test status transition validation

### 11.2 Integration Tests

- [ ] **11.2.1** Test full upload → processing → success flow
- [ ] **11.2.2** Test upload → processing → transient failure → retry → success
- [ ] **11.2.3** Test upload → processing → permanent failure → admin resolution
- [ ] **11.2.4** Test upload → processing → infected → quarantine → admin delete
- [ ] **11.2.5** Test rate limiting enforcement
- [ ] **11.2.6** Test concurrent processing limits

### 11.3 E2E Tests

- [ ] **11.3.1** Test platform user upload and status visibility
- [ ] **11.3.2** Test admin queue management UI
- [ ] **11.3.3** Test bulk retry functionality
- [ ] **11.3.4** Test settings configuration

**Acceptance Criteria**:
- All tests pass
- Coverage meets project standards

---

## Phase 12: Documentation and Rollout - Deferred

**Goal**: Complete documentation and production deployment.

### 12.1 Documentation

- [ ] **12.1.1** Update API documentation with new endpoints
- [ ] **12.1.2** Document environment variables
- [ ] **12.1.3** Create runbook for common DPQ issues
- [ ] **12.1.4** Update onboarding package if needed

### 12.2 Rollout

- [ ] **12.2.1** Deploy to staging environment
- [ ] **12.2.2** Run full test suite in staging
- [ ] **12.2.3** Migrate existing documents to appropriate status
- [ ] **12.2.4** Deploy to production
- [ ] **12.2.5** Monitor metrics and alerts post-deployment
- [ ] **12.2.6** Address any issues discovered

**Acceptance Criteria**:
- Feature fully functional in production
- No regressions in existing functionality
- Monitoring confirms healthy operation

---

## Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Schema and Backend Foundation | Completed | 100% |
| Phase 2: Workflow Updates | Completed | 100% |
| Phase 3: Retry Infrastructure | Completed | 100% |
| Phase 4: Rate Limiting | Completed | 100% |
| Phase 5: Admin API | Completed | 100% |
| Phase 6: User API Enhancements | Completed | 100% |
| Phase 7: User Interface - Document List | Completed | 100% |
| Phase 8: Admin UI | Completed | 100% |
| Phase 9: Notifications | Completed | 100% |
| Phase 10: Monitoring and Cleanup | Completed | 100% |
| Phase 11: Testing | Not Started | 0% |
| Phase 12: Documentation and Rollout | Not Started | 0% |

**Overall Progress**: 6 / 12 phases complete

---

## Dependencies

- **Phase 2** depends on **Phase 1** (schema must exist)
- **Phase 3** depends on **Phase 2** (workflow must use new statuses)
- **Phase 4** depends on **Phase 1** (need count functions)
- **Phase 5** depends on **Phase 1, 2, 3** (need schema, workflow, retry)
- **Phase 6** depends on **Phase 1** (need new statuses)
- **Phase 7** depends on **Phase 6** (need API changes)
- **Phase 8** depends on **Phase 5** (need admin API)
- **Phase 9** depends on **Phase 2** (need workflow events)
- **Phase 10** depends on **Phase 2** (need workflow metrics)
- **Phase 11** can start after **Phase 5** (test as features complete)
- **Phase 12** depends on all other phases

---

## Notes

- Mark tasks complete by changing `[ ]` to `[x]`
- Update phase status and completion percentage as tasks complete
- Add notes below tasks if blockers or issues arise
- Reference this roadmap in commit messages for traceability
