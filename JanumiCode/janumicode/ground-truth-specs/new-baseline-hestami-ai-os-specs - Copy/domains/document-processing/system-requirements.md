# Document Processing - System Requirements

## 1. Core Principles
- **Control vs Data Plane Separation:** DBOS workflows handle orchestration (Control Plane). TUS, SeaweedFS, and Workers handle binary streams (Data Plane). DBOS MUST NEVER carry large binary payloads.
- **Streaming-First Architecture:** No shared POSIX filesystem. No NFS. Assets are streamed via HTTP/S3 native interfaces.
- **Immutability:** Original uploads are immutable. Derived assets (thumbnails, transcodes) are stored separately.
- **Fail-Safe Processing:** No document is silently lost. The Document Processing Queue (DPQ) ensures that transient errors are retried, and permanent errors are visible and resolvable.

## 2. Infrastructure Deployment
- **Ingress:** Cloudflare CDN -> Traefik -> origin services.
- **Firewall:** Host-level (Ubuntu) allows TCP/443 *only* from Cloudflare IPs.
- **Upload Protocol:** TUS protocol via `tusd` for resumable, chunked 1GB uploads.
- **Storage:** SeaweedFS (accessed natively internally, or via S3 gateway for presigned URLs).
- **Processing Engine:** DBOS Workflows orchestration.

## 3. Upload and Processing Flow
### 3.1 Upload Entry
1. Client requests upload capability via DBOS control-plane API (`documentRouter`).
2. DBOS validates tenant, user, size limits, and initial MIME type.
3. DBOS provisions a TUS endpoint or S3 presigned URL.

### 3.2 TUS Upload
1. Client streams the file to `tusd`.
2. Upon completion, `tusd` notifies DBOS via webhook.
3. DBOS marks Document as `PROCESSING` and triggers background DBOS Workflow.

### 3.3 DBOS Processing Workflow
The workflow orchestrates asynchronous workers for:
1. **Security Scan:** ClamAV malware scan.
2. **Metadata Extraction:** ExifTool (GPS, camera data).
3. **Media Generation:**
   - Image: libcvids (thumbnails, downscaled previews).
   - Video: ffmpeg (keyframe extraction, poster generation).
4. **Conclusion:** Mark Document as `ACTIVE` (or `PROCESSING_FAILED` / `INFECTED`).

## 4. Document Processing Queue (DPQ) & DLQ Pattern
### 4.1 Document Statuses
- `PENDING_UPLOAD`: Created, waiting for TUS.
- `PROCESSING`: File uploaded, scanning/derivatives in progress.
- `PROCESSING_FAILED`: Error occurred. Includes metadata (`errorType`, `attemptCount`, `nextRetryAt`).
- `INFECTED`: Malware detected. Quarantined.
- `ACTIVE`: Successful processing.
- `SUPERSEDED`: Replaced by newer version.
- `ARCHIVED`: Deleted by user.

### 4.2 Error Classification & Retries
- **Transient Errors:** (HTTP 5xx, timeouts, network issues). Auto-retry enabled. Default: 3 attempts, exponential backoff starting at 5m (`DPQ_RETRY_BACKOFF_MULTIPLIER = 2`).
- **Permanent Errors:** (Corrupt file, unsupported format, size limit). No auto-retry. Requires manual intervention or user re-upload.
- **Infected:** Malware detected. Quarantined for 30 days (`DPQ_INFECTED_RETENTION_DAYS = 30`).

### 4.3 Automated Jobs
- **Retry Job:** Runs every 1 minute to check for `nextRetryAt <= NOW()` on `PROCESSING_FAILED` documents.
- **Cleanup Job:** Runs daily to delete expired `INFECTED` files, orphan S3 objects, and old history.
- **Metrics Job:** Runs every 5 minutes for monitoring.

## 5. Staff Admin DPQ UX (`/app/admin/document-processing`)
Platform Admins have a dashboard to manage the DPQ globally (requires `STAFF` with `ADMIN/SUPPORT` and `PLATFORM_OPERATIONS` pillar access).
- **Tabs:** Processing, Failed (Auto-Retry), Failed (Needs Attention), Infected, History.
- **Actions:** Individual Retry, Bulk Retry, Mark Resolved, Delete Permanently, Override False Positive, Configure DPQ Settings.
- **Database Access:** Uses SECURITY DEFINER functions (e.g., `list_documents_by_processing_status`, `get_processing_queue_stats`) to query cross-organization status.

## 6. Rate Limiting (Fairness)
- Configurable limits via ENV vars to prevent single-org queue monopoly.
- Example defaults: Max 5 concurrent processing per org, max 50 queued per org, max 20 global concurrent processing.

## 7. Delivery
- Authorized users receive Time-Limited Presigned GET URLs from the SeaweedFS S3 gateway. No direct exposure of object paths.
