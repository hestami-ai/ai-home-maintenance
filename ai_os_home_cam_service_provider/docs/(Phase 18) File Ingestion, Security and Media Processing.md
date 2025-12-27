# **Hestami AI OS**

## **File Ingestion, Security, and Media Processing**

### **System Requirements Document (SRD)**

---

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

## **1\. Purpose**

This document defines the **system requirements, architecture, and operational constraints** for the file ingestion, security, malware scanning, and post‑processing pipeline within the **Hestami AI OS** platform.

The SRD is intended to:

* Guide **AI software engineering agents** implementing the system  
* Provide a **single source of truth** for architectural decisions  
* Establish **security‑first constraints** for large file uploads/downloads (up to 1 GB)  
* Minimize filesystem coupling and operational risk

This document is descriptive, not prescriptive at the code level.

---

## **2\. Scope**

The system covers:

* User uploads (PDF, images, video, ProRes, HEIC, etc.)  
* Malware scanning and content safety checks  
* Media metadata extraction and derivative generation  
* Secure, scalable delivery of stored assets  
* Origin security behind Cloudflare CDN

Out of scope:

* Business‑specific authorization logic  
* UI/UX design  
* AI model training or fine‑tuning

---

## **3\. Design Principles**

### **3.1 Control Plane vs Data Plane Separation**

* **Control Plane**: DBOS workflows and APIs  
* **Data Plane**: Streaming uploads/downloads via specialized services

DBOS must never carry large binary payloads.

### **3.2 Capability‑Based Access**

* Access to large assets is granted via **temporary, cryptographically verifiable capabilities** (presigned URLs or resumable upload sessions)  
* No long‑lived credentials are exposed to clients

### **3.3 Streaming‑First Architecture**

* No shared POSIX filesystem across containers  
* No NFS dependency  
* Large files are streamed end‑to‑end

### **3.4 Defense in Depth**

* Cloudflare CDN as outer perimeter  
* Host‑level firewall enforcement  
* Traefik for routing and TLS termination  
* Application‑level validation inside DBOS

---

## **4\. High‑Level Architecture**

### **4.1 Ingress and Network Security**

* **Cloudflare CDN** is the only public entry point  
* Cloudflare connects to the origin over TLS  
* No direct client access to the origin IP is permitted

### **4.2 Origin Host**

* Ubuntu Linux virtual machine  
* Docker Compose runtime  
* Traefik as the sole ingress proxy

### **4.3 Core Services**

NOTE: Traefik and DBOS already exist and are configured in the existing docker-compose.yml file.

| Component | Responsibility |
| ----- | ----- |
| Traefik | TLS termination, SNI routing, request forwarding |
| DBOS | Workflow orchestration, control‑plane APIs |
| tusd | Resumable uploads (TUS protocol) |
| SeaweedFS | Object storage and retrieval |
| ClamAV | Malware scanning |
| ffmpeg | Video processing |
| libcvids | Image derivatives |
| ExifTool | Metadata extraction |

---

## **5\. Upload Pipeline Requirements**

### **5.1 Upload Entry**

* All uploads are initiated via a **DBOS control‑plane API**  
* DBOS validates:  
  * Tenant  
  * User  
  * File size limits  
  * Declared MIME type

### **5.2 Upload Mechanism**

#### **Primary Mechanism**

* **TUS protocol** via `tusd`  
* Supports resumable, chunked uploads  
* Handles unreliable mobile and long‑running transfers

#### **Constraints**

* Uploads up to **1 GB** must be supported  
* Upload traffic must stream through Traefik  
* No buffering of full payloads in DBOS or reverse proxies

### **5.3 Upload Finalization**

* DBOS is notified when upload completes  
* File is marked immutable  
* Post‑processing pipeline is triggered asynchronously

---

## **6\. Storage Requirements**

### **6.1 Storage Backend**

* **SeaweedFS** is the canonical object store  
* Storage accessed via:  
  * Native APIs for internal workers  
  * S3‑compatible gateway for presigned URLs

### **6.2 Object Immutability**

* Original uploads are never modified  
* Derived assets are stored separately

### **6.3 Metadata Preservation**

* EXIF, GPS, and camera metadata must be retained for originals  
* Metadata extraction occurs post‑upload

---

## **7\. Malware and Content Safety Pipeline**

### **7.1 Malware Scanning**

* **ClamAV** scans all completed uploads  
* Scanning occurs before assets are marked usable

### **7.2 Content Moderation (Extensible)**

* Optional image/video moderation using multimodal models  
* Results are advisory and recorded as metadata

### **7.3 Failure Handling**

* Failed scans:  
  * Asset quarantined  
  * Not exposed via download links  
  * Operator visibility required

---

## **8\. Media Post‑Processing**

### **8.1 Image Processing**

* Thumbnail generation  
* Down‑scaled previews  
* Format normalization when required

### **8.2 Video Processing**

* Keyframe extraction  
* Poster frame generation  
* Optional transcoding for previews

### **8.3 Processing Model**

* Workers stream objects from SeaweedFS  
* Intermediate files use local ephemeral storage  
* Results written back to SeaweedFS

---

## **9\. Download and Access Model**

### **9.1 Default Download Strategy**

* **Presigned GET URLs** via SeaweedFS S3 gateway  
* URLs are:  
  * Time‑limited  
  * Capability‑based  
  * Bound to specific object paths

### **9.2 Unified Download Gateway (Optional)**

* NGINX‑based gateway MAY be added later for:  
  * Compliance‑driven audit logging  
  * On‑the‑fly transformations  
  * Watermarking

Not required for initial implementation.

---

## **10\. Traefik Requirements**

### **10.1 Routing**

* Host‑based routing only (no path rewriting)  
* Dedicated subdomains:  
  * `app.*` → DBOS  
  * `uploads.*` → tusd  
  * `s3.*` → SeaweedFS S3 gateway

### **10.2 Timeouts**

* Read/write timeouts must support long‑lived transfers  
* Streaming behavior preserved end‑to‑end

### **10.3 Header Trust**

* Forwarded headers trusted **only** from Cloudflare IP ranges

---

## **11\. Cloudflare Integration Requirements**

### **11.1 CDN Role**

* Cloudflare terminates client TLS  
* Cloudflare forwards requests to origin over TLS

### **11.2 Origin Lockdown**

* Direct origin access must be blocked  
* No reliance on browser trust errors for security

### **11.3 Upload Constraints**

* Cloudflare proxy limits must be considered  
* Large uploads may bypass proxy limits using resumable protocols

---

## **12\. Firewall Requirements (Ubuntu VM)**

### **12.1 Scope**

* Firewall enforcement occurs on the **Ubuntu VM host**  
* Not inside containers

### **12.2 Rule Requirement**

* TCP/443 inbound traffic must be accepted **only** from Cloudflare IP ranges  
* All other TCP/443 traffic must be dropped

### **12.3 nftables Implementation**

* Cloudflare IPv4 and IPv6 ranges stored in nftables sets  
* Narrow rule scope (443 only)  
* No global default‑drop required

### **12.4 IP Range Updates**

* Cloudflare IP ranges must be refreshed periodically  
* Updates must be fail‑safe:  
  * If fetch fails, existing rules remain intact

---

## **13\. Operational Requirements**

### **13.1 Observability**

* Logging for upload lifecycle  
* Malware scan results recorded  
* Processing errors surfaced to operators

### **13.2 Reliability**

* Upload resume supported across app restarts  
* Partial uploads never exposed

### **13.3 Security**

* No shared writable volumes between services  
* No long‑lived credentials on clients

---

## **14\. Non‑Functional Requirements**

| Category | Requirement |
| ----- | ----- |
| Max upload size | ≥ 1 GB |
| Availability | Upload resume required |
| Scalability | Horizontal worker scaling |
| Security | Cloudflare‑locked origin |
| Extensibility | Future moderation models |

---

## **15\. Future Considerations**

* Optional Cloudflare Tunnel for control‑plane endpoints  
* CDN caching for derived assets  
* Automated retention policies  
* Policy‑driven download mediation

---

## **16\. Summary**

This design prioritizes:

* Streaming correctness  
* Security by construction  
* Operational simplicity  
* Mobile‑friendly reliability

It deliberately avoids shared filesystems, inline proxy authorization, and monolithic upload handling in favor of proven, specialized components orchestrated by DBOS.

