# Implementation Roadmap: (Phase 18) File Ingestion, Security, and Media Processing

This document provides a prescriptive, step-by-step implementation guide for Phase 18 of the Hestami AI OS. It focuses on secure, scalable file handling using SeaweedFS, `tusd`, and unified processing workers.

## Key Technologies

| Layer | Technology |
|-------|------------|
| Frontend Framework | SvelteKit 5 with Runes |
| UI Framework | Skeleton UI + Flowbite Svelte |
| Form Handling | Superforms |
| Icons | Lucide Svelte |
| Styling | TailwindCSS |
| Authentication | Better Auth (self-hosted) |
| API | oRPC (existing backend) |
| Authorization | Cerbos |

## Naming Harmonization Reference

NOTE: The following table is used to ensure consistency across the system. However, the names are not final and may change based on the final implementation and thus should not be used as a reference for the final implementation.

| Logic Component | Subdomain (Cloudflare) | Container Name (Origin) | Service Internal Port |
| :--- | :--- | :--- | :--- |
| **Control Plane** | `app.hestami.ai` | `hestami-app` | `3000` |
| **Upload Gateway** | `uploads.hestami.ai` | `hestami-tusd` | `8080` (Standard) |
| **S3 Gateway (Read)** | `s3.hestami.ai` | `hestami-seaweedfs-s3` | `8333` (Standard) |

---

## 1. Infrastructure & Network Security

### 1.1 Host-Level Firewall (nftables)
- [ ] Generate `scripts/setup-nftables.sh` to check for `nftables` installation.
- [ ] Implement Cloudflare IP range fetching logic (IPv4/IPv6).
- [ ] Configure `nftables` to drop all TCP/443 traffic EXCEPT from Cloudflare ranges.
- [ ] Setup cron job (`/etc/cron.daily/update-cloudflare-ips`) to refresh ranges.

### 1.2 Traefik Configuration Update
- [x] Increase `readTimeout` and `writeTimeout` to `3600s` (1 hour) for large uploads.
- [x] Update `upload-limit` middleware to `100MB` (Updated from 10MB).
- [x] Configure Host-based routing for `tusd` and `seaweedfs` subdomains.

---

## 2. Storage Backend: SeaweedFS Setup

### 2.1 Container Configuration
- [x] Integrate SeaweedFS Master, Volume, and S3 Gateway into `docker-compose.yml`.
- [x] Use a single-node setup for initial production (Single Filer/Volume).
- [x] Configure volumes for persistent storage (SeaweedFS Data).

### 2.2 S3 Gateway Initialization
- [x] Configure access keys and secret keys (stored in `.env`).
- [x] Create initial buckets (e.g., `user-media`, `system-assets`).
    - docker exec -it hestami-seaweedfs-master weed shell
    - Inside the shell:
        s3.bucket.create -name uploads
        s3.bucket.create -name system-assets
    - [x] `uploads`: For tusd uploads.
    - [x] `user-media`: For user-uploaded media files.
    - [x] `system-assets`: For system assets (e.g., thumbnails, icons).
- [x] Verify presigned URL compatibility via SeaweedFS S3.

---

## 3. Upload Infrastructure: tusd Integration

### 3.1 tusd Deployment
- [x] Add `tusd` (TUS protocol server) to `docker-compose.yml`.
- [x] Configure `tusd` to use SeaweedFS S3 as the storage backend.
- [x] Set `tusd` to listen on the `uploads.*` subdomain via Traefik.

### 3.2 Global Success Hook (DBOS)
- [x] Configure `tusd` with a `--hooks-http` endpoint pointing to a DBOS Control Plane internal route.
- [x] Implement `POST /api/internal/tus-hook` in DBOS to:
    - [x] Calculate final file hash (if not provided).
    - [x] Record file metadata in Postgres.
    - [x] Mark file status as `ACTIVE` -> `PENDING`.
    - [x] Trigger the **Unified Processing Worker** workflow.

---

## 4. Unified Processing Worker

### 4.1 "Hestami Processing" Container
- [x] Create a custom Dockerfile for `hestami-worker-media`.
- [x] Bundle dependencies: `ClamAV`, `ffmpeg`, `libvips`, `ExifTool`.
- [x] Implement a lightweight Node.js or Python task runner to execute processing jobs (Python/FastAPI implemented).

### 4.2 Malware & Metadata Workflow
- [x] **Step 1: Malware Scan**: Run `clamscan` on the asset.
- [x] **Step 2: Metadata Extraction**: Run `exiftool` to extract GPS/EXIF data; store in Postgres.
- [x] **Step 3: Derivative Generation**:
    - [x] Images: Generate thumbnails/mobile-previews (WebP implemented).
    - [x] Videos: Extract keyframes and poster frame (Poster frame implemented).
- [x] **Step 4: Finalization**: Mark asset as `AVAILABLE` or `QUARANTINED` in DB.

---

## 5. Control Plane & Authorization

### 5.1 Capability-Based Access (Presigned URLs)
- [x] Implement `document.getDownloadUrl` oRPC procedure.
- [x] **Logic**:
    1. Verify requester identity (JWT).
    2. Check Cerbos policy for the specific resource/organization.
    3. If authorized, generate an S3 presigned GET URL with 1-hour expiry.
    4. Return URL to the mobile/web client.

### 5.2 Upload Initiation
- [x] Implement `document.initiateUpload` oRPC procedure.
- [x] **Logic**:
    1. Validate tenant quota (Checked via Cerbos/Prisma).
    2. Create a placeholder record in Postgres (`DRAFT` status).
    3. Return TUS endpoint and metadata headers needed by the client.

---

## 6. Verification Plan - Deferred for now

### 6.1 Automated Tests - Deferred for now
- [ ] Test resumable upload (simulated disconnect/resume).
- [ ] Test 1GB upload throughput.
- [ ] Verify malware detection (using EICAR test file).
- [ ] Verify metadata RLS (Row Level Security) prevents unauthorized access to GPS data.

### 6.2 Manual Verification - Deferred for now
- [ ] Verify "Origin Lockdown": Attempt to curl origin IP on port 443 from a non-Cloudflare IP (should be dropped).
- [ ] Verify mobile client playback of transcoded video previews.
- [ ] Inspect Cloudflare audit logs for TUS traffic patterns.
