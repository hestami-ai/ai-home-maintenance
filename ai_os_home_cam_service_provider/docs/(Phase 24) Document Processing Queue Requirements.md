# Document Processing Queue - Requirements Specification

**Version:** 1.0  
**Date:** December 30, 2025  
**Status:** Draft  
**Related:** Phase 24 - File Ingestion, Security and Media Processing

---

## 1. Overview

### 1.1 Purpose
This document defines the requirements for a Document Processing Queue (DPQ) system that provides visibility, reliability, and administrative control over the document upload and processing pipeline. The system implements a Dead Letter Queue (DLQ) pattern to handle processing failures gracefully and ensure no uploaded documents are lost.

### 1.2 Scope
- Document upload lifecycle management
- Processing failure handling and retry mechanisms
- Malware detection and quarantine workflow
- Platform user visibility into processing status
- Organization admin visibility into their documents
- Hestami staff administrative interface
- Rate limiting for fair resource allocation

### 1.3 Goals
1. **Reliability**: No uploaded document should be silently lost due to transient failures
2. **Visibility**: Users and admins can see processing status at appropriate levels
3. **Recoverability**: Failed processing can be retried manually or automatically
4. **Security**: Infected files are quarantined and handled appropriately
5. **Fairness**: Processing resources are allocated fairly across organizations

---

## 2. User Personas

### 2.1 Platform User
- **Examples**: Concierge (Individual), CAM Company staff, Service Provider staff
- **Needs**: Upload documents, see processing status, receive notifications on completion/failure
- **Access Level**: Own documents and organization documents (based on role)

### 2.2 Organization Admin
- **Examples**: CAM Company admin, Service Provider owner
- **Needs**: View processing status for all documents in their organization
- **Access Level**: All documents within their organization

### 2.3 Hestami Staff/Admin
- **Examples**: Platform operations team, support staff
- **Needs**: Monitor system health, resolve processing issues, manage quarantined files
- **Access Level**: All documents across all organizations (read), administrative actions

---

## 3. Document Status Model

### 3.1 Status Enum
The `DocumentStatus` enum shall be extended with the following values:

| Status | Description | Visible to User | Editable |
|--------|-------------|-----------------|----------|
| `PENDING_UPLOAD` | Document record created, awaiting file upload via TUS | Yes | No |
| `PROCESSING` | File uploaded, worker is processing (scan, metadata, derivatives) | Yes | No |
| `PROCESSING_FAILED` | Processing failed, in retry queue or awaiting intervention | Yes (limited) | No |
| `INFECTED` | Malware detected, file quarantined | Yes | No |
| `ACTIVE` | Successfully processed, available for use | Yes | Yes |
| `SUPERSEDED` | Replaced by a newer version | Yes | No |
| `ARCHIVED` | Soft-deleted by user | No (hidden) | No |

### 3.2 Status Transitions

```
PENDING_UPLOAD ──[TUS upload complete]──> PROCESSING
PROCESSING ──[success]──> ACTIVE
PROCESSING ──[malware detected]──> INFECTED
PROCESSING ──[transient error]──> PROCESSING_FAILED (auto-retry)
PROCESSING ──[permanent error]──> PROCESSING_FAILED (needs attention)
PROCESSING_FAILED ──[retry success]──> ACTIVE
PROCESSING_FAILED ──[retry infected]──> INFECTED
PROCESSING_FAILED ──[admin resolves]──> ARCHIVED (with user notification)
ACTIVE ──[new version uploaded]──> SUPERSEDED
ACTIVE ──[user deletes]──> ARCHIVED
INFECTED ──[admin deletes]──> (hard delete)
INFECTED ──[admin approves false positive]──> PROCESSING (re-scan)
```

### 3.3 Processing Metadata
Documents in `PROCESSING_FAILED` or `INFECTED` status shall store additional metadata:

```typescript
interface ProcessingMetadata {
  errorType: 'TRANSIENT' | 'PERMANENT' | 'INFECTED';
  errorCode: string;
  errorMessage: string;
  errorStack?: string;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptAt: Date;
  nextRetryAt?: Date;
  malwareInfo?: {
    signature: string;
    engine: string;
    detectedAt: Date;
  };
}
```

---

## 4. Error Classification

### 4.1 Error Categories

| Error Type | Category | Auto-Retry | Max Attempts | User Message |
|------------|----------|------------|--------------|--------------|
| Worker unavailable (HTTP 500, 502, 503) | Transient | Yes | 3 | Hidden during retry |
| Worker timeout | Transient | Yes | 3 | Hidden during retry |
| S3 download failed | Transient | Yes | 3 | Hidden during retry |
| ClamAV service unavailable | Transient | Yes | 3 | Hidden during retry |
| Network error | Transient | Yes | 3 | Hidden during retry |
| File corrupted / unreadable | Permanent | No | 1 | "Unable to process this file" |
| Unsupported file format | Permanent | No | 1 | "File format not supported" |
| File exceeds size limit | Permanent | No | 1 | "File exceeds maximum size" |
| Malware detected | Infected | No | 1 | "File flagged as potentially harmful" |

### 4.2 Retry Configuration
Retry behavior shall be configurable via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DPQ_AUTO_RETRY_ENABLED` | `true` | Enable automatic retry of transient failures |
| `DPQ_MAX_RETRY_ATTEMPTS` | `3` | Maximum retry attempts before escalation |
| `DPQ_RETRY_INTERVAL_SECONDS` | `300` | Initial retry interval (5 minutes) |
| `DPQ_RETRY_BACKOFF_MULTIPLIER` | `2` | Exponential backoff multiplier |
| `DPQ_INFECTED_RETENTION_DAYS` | `30` | Days to retain quarantined files before auto-deletion |

---

## 5. Platform User Experience

### 5.1 Upload Flow

#### 5.1.1 Immediate Feedback
During the upload process, users shall see:

| Stage | UI Element | User Action |
|-------|------------|-------------|
| Selecting file | File picker | Select file(s) |
| Uploading | Progress bar with percentage | Can cancel |
| Upload complete | Spinner: "Scanning for security..." | Wait |
| Processing | Spinner: "Processing..." | Can navigate away |

#### 5.1.2 Upload Failure (Before Save)
If the upload fails before the file is saved to S3:
- **Immediate error toast**: "Upload failed. Please try again."
- **Retry button** in the upload UI
- Document record is NOT created (or is cleaned up)

#### 5.1.3 Processing Success
- **Toast notification**: "Document processed successfully"
- Document appears in document list with `ACTIVE` status
- Thumbnail/preview available (if applicable)

#### 5.1.4 Processing Failure (Transient - Auto-Retry)
- User is NOT notified during auto-retry attempts
- Document appears in list with "Processing" indicator
- If user views document detail: "Processing is taking longer than expected"

#### 5.1.5 Processing Failure (Permanent/Exhausted Retries)
- **Toast notification** (if user online): "Unable to process [filename]"
- **Email notification** (if enabled in user preferences)
- Document appears in list with error indicator
- Document detail shows: "This file could not be processed. Please try uploading again or contact support."
- User can delete the failed document

#### 5.1.6 Infected File
- **Immediate toast**: "This file was flagged as potentially harmful and has been rejected."
- File is NOT added to user's document list
- Document record exists in `INFECTED` status (for admin review)
- User must upload a different file

### 5.2 Document List View (`/app/concierge/documents`, etc.)

#### 5.2.1 Status Indicators
Each document in the list shall display a status indicator:

| Status | Icon | Color | Tooltip |
|--------|------|-------|---------|
| `PROCESSING` | Spinner | Blue | "Processing..." |
| `PROCESSING_FAILED` (retrying) | Clock | Yellow | "Processing delayed, retrying..." |
| `PROCESSING_FAILED` (exhausted) | Warning triangle | Red | "Processing failed" |
| `ACTIVE` | Checkmark | Green | "Ready" |
| `SUPERSEDED` | Archive | Gray | "Superseded by newer version" |

#### 5.2.2 Filtering
Document list shall support filtering by status:
- "All" (default, excludes `ARCHIVED` and `INFECTED`)
- "Processing" (includes `PROCESSING` and `PROCESSING_FAILED`)
- "Ready" (`ACTIVE` only)
- "Failed" (`PROCESSING_FAILED` with exhausted retries)

#### 5.2.3 Actions
| Status | Available Actions |
|--------|-------------------|
| `PROCESSING` | View (limited), Cancel upload |
| `PROCESSING_FAILED` | View details, Delete, Contact support |
| `ACTIVE` | View, Download, Edit metadata, Delete, Upload new version |
| `SUPERSEDED` | View, Download |

### 5.3 User Notifications

#### 5.3.1 In-App Notifications
- Processing complete (success)
- Processing failed (after retries exhausted)
- File rejected (infected)

#### 5.3.2 Email Notifications (User Preference)
Users can opt-in to email notifications for:
- Document processing complete
- Document processing failed
- File rejected (infected) - always sent regardless of preference

---

## 6. Organization Admin Experience

### 6.1 Visibility
Organization admins shall have visibility into processing status for all documents within their organization.

### 6.2 Document List Enhancements
The organization-level document view shall include:
- Filter by processing status
- Filter by uploader (user)
- Bulk actions (where applicable)

### 6.3 Dashboard Widget (Optional)
Organization dashboard may include a widget showing:
- Documents currently processing: N
- Documents with issues: N (link to filtered list)

---

## 7. Hestami Staff Admin Experience

### 7.1 New Admin Page: `/app/admin/document-processing`

#### 7.1.1 Access Control
- Required role: `STAFF` with `ADMIN` or `SUPPORT` role
- Required pillar access: `PLATFORM_OPERATIONS` or `ALL`

#### 7.1.2 Dashboard Overview
Top section displays real-time metrics:

| Metric | Display | Alert Threshold |
|--------|---------|-----------------|
| Currently Processing | Count | None |
| Failed - Awaiting Retry | Count | > 50 |
| Failed - Needs Attention | Count (red badge) | > 0 |
| Infected - Quarantined | Count (orange badge) | > 0 |
| Processed Today | Count | None |
| Processing Success Rate (24h) | Percentage | < 95% |

#### 7.1.3 Alert Banner
When "Failed - Needs Attention" > 0, display prominent alert:

> ⚠️ **{N} documents require manual intervention.**  
> Most common error: {error_type} ({count})  
> [View Details] [Bulk Retry All]

#### 7.1.4 Queue Tabs

**Tab 1: Processing**
Real-time view of documents currently being processed.

| Column | Description |
|--------|-------------|
| Document ID | Link to document detail |
| Organization | Organization name |
| User | Uploader name/email |
| File Name | Original filename |
| File Size | Size in human-readable format |
| Started At | Timestamp |
| Duration | Elapsed time |
| Stage | Current processing stage (downloading, scanning, extracting, etc.) |

Actions: None (monitoring only)

**Tab 2: Failed - Auto-Retry**
Documents that failed but are eligible for automatic retry.

| Column | Description |
|--------|-------------|
| Document ID | Link to document detail |
| Organization | Organization name |
| User | Uploader name/email |
| File Name | Original filename |
| Error | Error type/message (truncated) |
| Attempts | X of Y |
| Last Attempt | Timestamp |
| Next Retry | Timestamp or "Scheduled" |

Actions:
- **Retry Now**: Trigger immediate retry (individual)
- **Cancel Retry**: Move to "Needs Attention" queue
- **View Error**: Expand row to show full error details

**Tab 3: Failed - Needs Attention** ⚠️
Documents that exhausted retries or have permanent errors.

| Column | Description |
|--------|-------------|
| Document ID | Link to document detail |
| Organization | Organization name |
| User | Uploader name/email |
| File Name | Original filename |
| Error Type | TRANSIENT_EXHAUSTED, PERMANENT, etc. |
| Error Details | Error message (truncated) |
| Failed At | Timestamp |
| S3 Key | Storage path (for debugging) |

Actions:
- **Retry**: Attempt processing again (resets attempt count)
- **Bulk Retry**: Retry all selected documents
- **Mark Resolved**: Remove from queue, set status to ARCHIVED, notify user
- **View Error Details**: Expandable row with full error stack trace
- **View in S3**: Link to S3 object (if accessible)

**Tab 4: Infected - Quarantined** 🔴
Documents flagged by malware scanner.

| Column | Description |
|--------|-------------|
| Document ID | Link to document detail |
| Organization | Organization name |
| User | Uploader name/email |
| File Name | Original filename |
| Malware Signature | ClamAV signature name |
| Detected At | Timestamp |
| Retention Until | Auto-delete date |

Actions:
- **View Details**: Full malware scan results, file metadata
- **Delete Permanently**: Hard delete from S3 and database (requires confirmation)
- **False Positive - Reprocess**: Override scan result, resubmit for processing (requires confirmation + reason)
- **Notify User**: Send notification to uploader about infected file
- **Extend Retention**: Add 30 days to retention period

**Tab 5: History**
Completed processing events (success and resolved failures).

| Column | Description |
|--------|-------------|
| Document ID | Link to document detail |
| Organization | Organization name |
| User | Uploader name/email |
| File Name | Original filename |
| Final Status | ACTIVE, ARCHIVED, DELETED |
| Processing Duration | Total time from upload to completion |
| Attempts | Number of processing attempts |
| Completed At | Timestamp |

Filters:
- Date range
- Status (Success, Failed-Resolved, Deleted)
- Organization
- Error type (for failures)

Actions:
- **Export CSV**: Download filtered results

#### 7.1.5 Settings Panel
Accessible via gear icon, allows configuration of:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Auto-retry enabled | Toggle | ON | Enable/disable automatic retries |
| Max retry attempts | Number | 3 | Attempts before escalation |
| Retry interval (seconds) | Number | 300 | Initial retry delay |
| Retry backoff multiplier | Number | 2 | Exponential backoff factor |
| Infected retention (days) | Number | 30 | Days before auto-deletion |
| Email alerts enabled | Toggle | ON | Send email to ops team on issues |
| Alert email recipients | Text | (configured) | Comma-separated emails |

Note: These settings map to environment variables and may require restart to take effect, or can be stored in database for dynamic configuration.

### 7.2 Audit Logging
All administrative actions shall be logged:

| Action | Logged Data |
|--------|-------------|
| Retry document | Admin user, document ID, timestamp |
| Bulk retry | Admin user, document IDs, count, timestamp |
| Mark resolved | Admin user, document ID, resolution reason, timestamp |
| Delete infected | Admin user, document ID, malware info, timestamp |
| False positive override | Admin user, document ID, reason, timestamp |
| Settings change | Admin user, setting name, old value, new value, timestamp |

Audit logs shall be:
- Stored in the `activity_events` table
- Visible in the admin audit log UI
- Retained for compliance period (configurable)

---

## 8. Rate Limiting and Fairness

### 8.1 Purpose
Processing resources (CPU, memory) are constrained. Rate limiting ensures fair allocation across organizations and prevents any single organization from monopolizing the processing queue.

### 8.2 Limits

| Limit | Default | Configurable |
|-------|---------|--------------|
| Max concurrent processing per organization | 5 | Yes (env var) |
| Max queued documents per organization | 50 | Yes (env var) |
| Global max concurrent processing | 20 | Yes (env var) |

### 8.3 Behavior When Limit Reached
- **Per-org concurrent limit**: New uploads are queued, processed in FIFO order when slot available
- **Per-org queue limit**: Upload rejected with error "Too many documents pending processing. Please wait."
- **Global limit**: All orgs share the pool; fair scheduling ensures no org starves

### 8.4 Priority (Future Enhancement)
Future versions may support priority tiers:
- Standard: Default processing priority
- Priority: Faster processing for premium organizations
- Bulk: Lower priority for batch uploads

---

## 9. Scheduled Jobs

### 9.1 Retry Job
A DBOS scheduled workflow shall run periodically to:
1. Query documents with `status = PROCESSING_FAILED` and `nextRetryAt <= NOW()`
2. For each document (up to batch limit):
   - Start a new processing workflow
   - Update attempt count and next retry time
3. Respect rate limits

Configuration:
- **Interval**: Every 1 minute (checks for due retries)
- **Batch size**: 10 documents per run
- **Distributed lock**: Ensure only one instance runs

### 9.2 Cleanup Job
A scheduled job shall run daily to:
1. Delete quarantined files past retention period
2. Clean up orphaned S3 objects (files without document records)
3. Archive old processing history (> 90 days)

### 9.3 Metrics Job
A scheduled job shall run every 5 minutes to:
1. Calculate processing success rate
2. Update dashboard metrics
3. Trigger alerts if thresholds exceeded

---

## 10. API Endpoints

### 10.1 Admin API - Document Processing Queue Router

A new `documentProcessingRouter` will be added to the API, accessible at `/api/v1/rpc/documentProcessing/*`.

**URL Pattern**: `POST /api/v1/rpc/documentProcessing/{method}`

| Method | Type | Description |
|--------|------|-------------|
| `getQueueStats` | Query | Get dashboard metrics |
| `listProcessing` | Query | List currently processing documents |
| `listFailed` | Query | List failed documents (with filters) |
| `listInfected` | Query | List quarantined documents |
| `listHistory` | Query | List processing history (with filters) |
| `retryDocument` | Mutation | Retry a single failed document |
| `bulkRetry` | Mutation | Retry multiple failed documents |
| `resolveDocument` | Mutation | Mark failed document as resolved |
| `deleteInfected` | Mutation | Permanently delete infected document |
| `overrideInfected` | Mutation | Mark infected as false positive, reprocess |
| `getSettings` | Query | Get current DPQ settings |
| `updateSettings` | Mutation | Update DPQ settings |

**Access Control**: All endpoints require `STAFF` role with `ADMIN` or `SUPPORT` role and `PLATFORM_OPERATIONS` pillar access.

### 10.2 User API Enhancements (Document Router)

Existing `documentRouter` at `/api/v1/rpc/document/*` will be enhanced:

| Method | Change |
|--------|--------|
| `list` | Add `status` filter, include processing status in response |
| `get` | Include processing metadata for failed documents |
| `cancelUpload` | New method to cancel pending upload |

---

## 11. Database Schema Changes

### 11.1 DocumentStatus Enum
Add new values to `DocumentStatus` enum:
- `PENDING_UPLOAD`
- `PROCESSING`
- `PROCESSING_FAILED`
- `INFECTED`

### 11.2 Document Table
Add columns to `documents` table:

| Column | Type | Description |
|--------|------|-------------|
| `processing_started_at` | TIMESTAMPTZ | When processing began |
| `processing_completed_at` | TIMESTAMPTZ | When processing finished |
| `processing_attempt_count` | INTEGER | Number of processing attempts |
| `processing_next_retry_at` | TIMESTAMPTZ | Scheduled next retry time |
| `processing_error_type` | TEXT | Error category |
| `processing_error_message` | TEXT | Error message |
| `processing_error_details` | JSONB | Full error details |

### 11.3 Indexes
Add indexes for efficient querying:
- `idx_documents_status` on `status`
- `idx_documents_processing_retry` on `status, processing_next_retry_at`
- `idx_documents_org_status` on `organization_id, status`

---

## 12. Security Considerations

### 12.1 Access Control
- Platform users can only see their own documents and org documents (based on role)
- Organization admins can see all documents in their organization
- Hestami staff can see all documents but actions are audited
- Infected file content is never exposed to users

### 12.2 Data Protection
- Error details may contain sensitive information; sanitize before displaying to users
- S3 keys and internal paths are only visible to Hestami staff
- Malware signatures are logged but file content is not exposed

### 12.3 Audit Trail
- All admin actions are logged with user identity and timestamp
- Logs are immutable and retained for compliance period

---

## 13. Monitoring and Alerting

### 13.1 Metrics (OpenTelemetry)
| Metric | Type | Description |
|--------|------|-------------|
| `document.processing.started` | Counter | Documents started processing |
| `document.processing.completed` | Counter | Documents completed (success) |
| `document.processing.failed` | Counter | Documents failed processing |
| `document.processing.infected` | Counter | Documents flagged as infected |
| `document.processing.duration` | Histogram | Processing duration |
| `document.processing.queue_depth` | Gauge | Documents awaiting processing |
| `document.processing.retry_queue_depth` | Gauge | Documents awaiting retry |

### 13.2 Alerts
| Condition | Severity | Action |
|-----------|----------|--------|
| Failed - Needs Attention > 0 | Warning | Dashboard badge, optional email |
| Failed - Needs Attention > 10 | Critical | Email to ops team |
| Processing success rate < 95% (1h) | Warning | Dashboard indicator |
| Processing success rate < 80% (1h) | Critical | Email to ops team |
| Infected documents > 5 (24h) | Warning | Email to security team |
| Worker unavailable > 5 min | Critical | PagerDuty/on-call alert |

---

## 14. Testing Requirements

### 14.1 Unit Tests
- Error classification logic
- Retry scheduling logic
- Rate limiting logic
- Status transition validation

### 14.2 Integration Tests
- Full upload → processing → success flow
- Upload → processing → transient failure → retry → success
- Upload → processing → permanent failure → admin resolution
- Upload → processing → infected → quarantine → admin delete
- Rate limiting enforcement
- Concurrent processing limits

### 14.3 E2E Tests
- Platform user upload and status visibility
- Admin queue management UI
- Bulk retry functionality
- Settings configuration

---

## 15. Rollout Plan

### 15.1 Phase 1: Schema and Backend
1. Add new DocumentStatus enum values (migration)
2. Add processing metadata columns (migration)
3. Update documentWorkflow with new status transitions
4. Implement error classification
5. Implement SECURITY DEFINER functions for status updates

### 15.2 Phase 2: Retry Infrastructure
1. Implement retry scheduling logic
2. Create retry scheduled job
3. Add rate limiting
4. Update existing documents to appropriate status

### 15.3 Phase 3: User Experience
1. Update document list UI with status indicators
2. Add processing status to document detail view
3. Implement user notifications
4. Update upload flow with proper error handling

### 15.4 Phase 4: Admin UI
1. Create `/app/admin/document-processing` page
2. Implement dashboard metrics
3. Implement queue tabs and actions
4. Add settings panel
5. Implement audit logging

### 15.5 Phase 5: Monitoring and Cleanup
1. Add OpenTelemetry metrics
2. Configure alerts
3. Implement cleanup scheduled job
4. Documentation and training

---

## 16. Open Items / Future Enhancements

1. **Priority processing tiers** for premium organizations
2. **Webhook notifications** for processing events
3. **Processing SLA tracking** and reporting
4. **Batch upload optimization** for large document sets
5. **Preview generation** progress tracking
6. **Integration with ticketing system** for escalated issues

---

## 17. Implementation Guidance for AI Developer Agent

This section provides specific guidance for implementing this feature following Hestami development patterns.

### 17.1 Files to Create/Modify

#### New Files
| File | Purpose |
|------|---------|
| `prisma/migrations/YYYYMMDDHHMMSS_document_processing_queue/migration.sql` | Add new enum values, columns, indexes, SECURITY DEFINER functions |
| `src/lib/server/api/routes/documentProcessing.ts` | New oRPC router for admin DPQ endpoints |
| `src/lib/server/workflows/documentProcessingRetryWorkflow.ts` | DBOS workflow for scheduled retries |
| `src/routes/app/admin/document-processing/+page.svelte` | Admin UI page |
| `src/routes/app/admin/document-processing/+page.server.ts` | Server-side data loading for admin page |
| `cerbos/policies/resource/document_processing.yaml` | Cerbos policy for DPQ admin actions |

#### Modified Files
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add new `DocumentStatus` enum values, add processing metadata columns to `Document` model |
| `src/lib/server/api/index.ts` | Register `documentProcessingRouter` in `appRouter` |
| `src/lib/server/api/schemas.ts` | Re-export new enum values, add response schemas for DPQ endpoints |
| `src/lib/server/workflows/schemas.ts` | Re-export `DocumentStatus` enum if not already present |
| `src/lib/server/workflows/documentWorkflow.ts` | Update status transitions, add error classification, use new statuses |
| `src/lib/server/api/routes/document.ts` | Add `status` filter to `list`, add `cancelUpload` method |
| `src/routes/app/concierge/documents/+page.svelte` | Add status indicators to document list |

### 17.2 Prisma Schema Changes

```prisma
// Add to DocumentStatus enum
enum DocumentStatus {
  DRAFT
  PENDING_UPLOAD    // NEW: Awaiting TUS upload
  PROCESSING        // NEW: Worker processing
  PROCESSING_FAILED // NEW: Failed, in retry queue
  INFECTED          // NEW: Malware detected
  ACTIVE
  SUPERSEDED
  ARCHIVED
}

// Add to Document model
model Document {
  // ... existing fields ...
  
  // Processing metadata (NEW)
  processingStartedAt    DateTime?
  processingCompletedAt  DateTime?
  processingAttemptCount Int       @default(0)
  processingNextRetryAt  DateTime?
  processingErrorType    String?   // 'TRANSIENT' | 'PERMANENT' | 'INFECTED'
  processingErrorMessage String?
  processingErrorDetails Json?
}
```

### 17.3 SECURITY DEFINER Functions Required

The following functions must bypass RLS for system-level operations:

1. **`update_document_processing_status`**: Update document status from workflow (already partially implemented as `update_document_status_system`)
2. **`list_documents_by_processing_status`**: Admin query for DPQ dashboard (cross-org visibility)
3. **`get_processing_queue_stats`**: Aggregate counts for dashboard metrics

### 17.4 oRPC Router Pattern

```typescript
// src/lib/server/api/routes/documentProcessing.ts
import { adminProcedure } from '../router.js';
import { z } from 'zod';

export const documentProcessingRouter = {
  getQueueStats: adminProcedure
    .errors({
      FORBIDDEN: { message: 'Access denied' }
    })
    .output(z.object({
      processing: z.number(),
      failedAwaitingRetry: z.number(),
      failedNeedsAttention: z.number(),
      infected: z.number(),
      processedToday: z.number(),
      successRate24h: z.number()
    }))
    .handler(async ({ context }) => {
      // Use SECURITY DEFINER function for cross-org stats
      const stats = await prisma.$queryRaw`SELECT * FROM get_processing_queue_stats()`;
      return { data: stats };
    }),
    
  retryDocument: adminProcedure
    .input(z.object({
      documentId: z.string(),
      idempotencyKey: z.string().uuid()
    }))
    .errors({
      NOT_FOUND: { message: 'Document not found' },
      BAD_REQUEST: { message: 'Document not eligible for retry' }
    })
    .handler(async ({ input, context }) => {
      // Start retry workflow with idempotencyKey as workflowID
      const handle = await DBOS.startWorkflow(documentProcessingRetryWorkflow_v1, {
        workflowID: input.idempotencyKey
      })({
        documentId: input.documentId,
        triggeredBy: context.user.id
      });
      return { data: { workflowId: input.idempotencyKey } };
    })
};
```

### 17.5 Workflow Error Classification

```typescript
// In documentWorkflow.ts
function classifyError(error: Error): { type: 'TRANSIENT' | 'PERMANENT'; code: string } {
  const message = error.message.toLowerCase();
  
  // Transient errors (auto-retry eligible)
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return { type: 'TRANSIENT', code: 'WORKER_ERROR' };
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return { type: 'TRANSIENT', code: 'TIMEOUT' };
  }
  if (message.includes('connection') || message.includes('network')) {
    return { type: 'TRANSIENT', code: 'NETWORK_ERROR' };
  }
  
  // Permanent errors (no auto-retry)
  if (message.includes('corrupt') || message.includes('invalid')) {
    return { type: 'PERMANENT', code: 'CORRUPT_FILE' };
  }
  if (message.includes('unsupported') || message.includes('format')) {
    return { type: 'PERMANENT', code: 'UNSUPPORTED_FORMAT' };
  }
  
  // Default to transient (safer - allows retry)
  return { type: 'TRANSIENT', code: 'UNKNOWN' };
}
```

### 17.6 Admin Page Server Load Pattern

```typescript
// src/routes/app/admin/document-processing/+page.server.ts
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
  const { staff, memberships } = await parent();
  
  // Require staff with appropriate role
  if (!staff || staff.status !== 'ACTIVE') {
    throw redirect(303, '/app');
  }
  
  const hasAccess = staff.roles.includes('ADMIN') || staff.roles.includes('SUPPORT');
  if (!hasAccess) {
    throw redirect(303, '/app/admin');
  }
  
  const staffRoles = staff.roles ?? [];
  const pillarAccess = staff.pillarAccess ?? [];
  const orgRoles: Record<string, string> = {};
  for (const m of memberships ?? []) {
    orgRoles[m.organization.id] = m.role;
  }
  
  const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess });
  const client = createDirectClient(context);
  
  const [statsResponse, processingResponse, failedResponse] = await Promise.all([
    client.documentProcessing.getQueueStats({}),
    client.documentProcessing.listProcessing({ limit: 50 }),
    client.documentProcessing.listFailed({ limit: 50 })
  ]);
  
  return {
    stats: statsResponse.data,
    processing: processingResponse.data.documents,
    failed: failedResponse.data.documents
  };
};
```

### 17.7 Cerbos Policy

```yaml
# cerbos/policies/resource/document_processing.yaml
apiVersion: api.cerbos.dev/v1
resourcePolicy:
  version: "default"
  resource: "document_processing"
  rules:
    - actions: ["view_queue", "view_stats"]
      effect: EFFECT_ALLOW
      roles: ["staff_admin", "staff_support"]
      
    - actions: ["retry", "bulk_retry", "resolve"]
      effect: EFFECT_ALLOW
      roles: ["staff_admin", "staff_support"]
      
    - actions: ["delete_infected", "override_infected"]
      effect: EFFECT_ALLOW
      roles: ["staff_admin"]
      
    - actions: ["update_settings"]
      effect: EFFECT_ALLOW
      roles: ["staff_admin"]
```

### 17.8 Activity Event Types

Add to activity event types for audit logging:

| Entity Type | Action | Description |
|-------------|--------|-------------|
| `DOCUMENT` | `PROCESSING_STARTED` | Worker began processing |
| `DOCUMENT` | `PROCESSING_COMPLETED` | Worker finished successfully |
| `DOCUMENT` | `PROCESSING_FAILED` | Worker returned error |
| `DOCUMENT` | `MALWARE_DETECTED` | ClamAV flagged file |
| `DOCUMENT` | `RETRY_TRIGGERED` | Admin or system triggered retry |
| `DOCUMENT` | `RETRY_SCHEDULED` | Automatic retry scheduled |
| `DOCUMENT` | `RESOLVED_BY_ADMIN` | Admin marked as resolved |
| `DOCUMENT` | `QUARANTINE_DELETED` | Admin deleted infected file |
| `DOCUMENT` | `FALSE_POSITIVE_OVERRIDE` | Admin overrode malware detection |

---

## Appendix A: Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DPQ_AUTO_RETRY_ENABLED` | `true` | Enable automatic retry |
| `DPQ_MAX_RETRY_ATTEMPTS` | `3` | Max attempts before escalation |
| `DPQ_RETRY_INTERVAL_SECONDS` | `300` | Initial retry interval |
| `DPQ_RETRY_BACKOFF_MULTIPLIER` | `2` | Backoff multiplier |
| `DPQ_INFECTED_RETENTION_DAYS` | `30` | Quarantine retention period |
| `DPQ_MAX_CONCURRENT_PER_ORG` | `5` | Per-org concurrent limit |
| `DPQ_MAX_QUEUED_PER_ORG` | `50` | Per-org queue limit |
| `DPQ_GLOBAL_MAX_CONCURRENT` | `20` | Global concurrent limit |
| `DPQ_ALERT_EMAIL_ENABLED` | `true` | Enable email alerts |
| `DPQ_ALERT_EMAIL_RECIPIENTS` | `` | Alert email recipients |

---

## Appendix B: Status Transitions (Structured Format)

### B.1 Valid Status Transitions

Each transition is defined as: `FROM_STATUS` → `TO_STATUS` : `trigger` : `actor`

| From | To | Trigger | Actor |
|------|----|---------|-------|
| `PENDING_UPLOAD` | `PROCESSING` | TUS upload completes, post-finish hook fires | System |
| `PROCESSING` | `ACTIVE` | Worker returns success, malware scan clean | System |
| `PROCESSING` | `PROCESSING_FAILED` | Worker returns transient error (HTTP 500, timeout) | System |
| `PROCESSING` | `PROCESSING_FAILED` | Worker returns permanent error (corrupt file, unsupported format) | System |
| `PROCESSING` | `INFECTED` | ClamAV detects malware | System |
| `PROCESSING_FAILED` | `PROCESSING` | Admin or scheduled job triggers retry | Admin/System |
| `PROCESSING_FAILED` | `ACTIVE` | Retry succeeds | System |
| `PROCESSING_FAILED` | `INFECTED` | Retry detects malware | System |
| `PROCESSING_FAILED` | `ARCHIVED` | Admin marks as resolved (notifies user of failure) | Admin |
| `ACTIVE` | `SUPERSEDED` | User uploads new version of document | User |
| `ACTIVE` | `ARCHIVED` | User deletes document | User |
| `SUPERSEDED` | `ARCHIVED` | User deletes superseded version | User |
| `INFECTED` | `PROCESSING` | Admin marks as false positive, triggers re-scan | Admin |
| `INFECTED` | `(hard delete)` | Admin permanently deletes quarantined file | Admin |

### B.2 Terminal States

- **`ACTIVE`**: Document is available for use. Can transition to `SUPERSEDED` or `ARCHIVED`.
- **`SUPERSEDED`**: Replaced by newer version. Read-only, can transition to `ARCHIVED`.
- **`ARCHIVED`**: Soft-deleted. Hidden from normal views. No further transitions.
- **`(hard delete)`**: Record and file permanently removed from system.

### B.3 Retry-Eligible States

Only `PROCESSING_FAILED` documents are eligible for retry. The system distinguishes:
- **Auto-retry eligible**: `errorType = 'TRANSIENT'` AND `attemptCount < maxAttempts`
- **Needs attention**: `errorType = 'PERMANENT'` OR `attemptCount >= maxAttempts`

### B.4 State Invariants

1. A document can only be in ONE status at a time.
2. `PROCESSING` status implies an active worker task; timeout after 5 minutes triggers transition to `PROCESSING_FAILED`.
3. `INFECTED` documents retain their S3 object for `DPQ_INFECTED_RETENTION_DAYS` before auto-deletion.
4. `ARCHIVED` documents retain metadata but may have S3 object deleted per retention policy.
5. Only `ACTIVE` documents are visible in standard user document lists.
