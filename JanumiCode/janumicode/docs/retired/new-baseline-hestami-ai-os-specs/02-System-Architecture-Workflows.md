# Hestami OS: System Architecture, Workflows & Constraints

*Every system requirement added below MUST include a `[Source: Phase X]` citation.*

## Phase 18: File Ingestion & Security
- **Cloudflare CDN:** Primary entry point, host-level firewall (nftables) dropping TCP/443 except Cloudflare IPs. [Source: Phase 18]
- **Traefik Routing:** Routing to DBOS (`app.*`), tusd (`uploads.*`), and SeaweedFS S3 gateway (`s3.*`). [Source: Phase 18]
- **Storage Backend:** SeaweedFS as the canonical object store, accessed via native APIs for workers and S3 gateway for clients. [Source: Phase 18]
- **Upload Protocol:** TUS protocol via `tusd` for resumable chunked uploads up to 1 GB. [Source: Phase 18]
- **DBOS Global Success Hook:** Webhook (`/api/internal/tus-hook`) triggered by `tusd` upon completion to calculate hash, record metadata, and start processing. [Source: Phase 18]
- **Unified Processing Worker:** Isolated worker runs ClamAV (malware), ExifTool (metadata), ffmpeg/libcvids (derivatives). [Source: Phase 18]
- **Capability-Based Access:** Presigned GET URLs (1-hour expiry) via SeaweedFS S3 gateway for downloading assets. [Source: Phase 18]

## Experimental: Photorealistic 3D Scanning SDK
- **Architecture:** iOS SDK combining SfM (Structure from Motion), MVS (Multi-View Stereo), AI Edge/Plane Detection, and RealityKit for 3D model generation. [Source: Experimental Hackathon]
- **Accuracy:** Millimeter-accurate measurements using SuperPoint/SuperGlue and Ceres Solver bundle adjustments. [Source: Experimental Hackathon]

## Phase 19: Staff Onboarding Backend Logic
- **Encryption Utils:** Implement AES-256-GCM encryption/decryption using `crypto` passing `HESTAMI_ACTIVATION_KEY` from env. [Source: Phase 19]
- **Create Staff API:** `staff.create` mutated to take `email`. Looks up user, creates PENDING staff record. Generates 8-char alphanumeric code, encrypts, saves with 8-hour expiry. Returns plain code. [Source: Phase 19]
- **Self-Activation API:** `staff.activateWithCode` allows user to input code. Decrypts DB code, matches, sets to ACTIVE, and adds user to Hestami Staff org as `PLATFORM_OPERATOR` with `ADMIN` role. [Source: Phase 19]
- **Regenerate API:** `staff.regenerateActivationCode` admin endpoint to bypass expired 8-hour codes. [Source: Phase 19]

## Phase 20: Strict API Typing
- **Zod Schemas:** Replace all usage of `z.any()` with strict types. Use `DecimalSchema` (strings/numbers coerced to string) and a recursive `JsonSchema`. [Source: Phase 20]

## Phase 21: RLS Enforcement
- **Database User Separation:** Runtime operations connect using `hestami_app` (NO BYPASSRLS privilege), forced to execute row-level policies. Prisma migrations connect using `hestami` (with BYPASSRLS) via `directUrl`. [Source: Phase 21]
- **DBOS RLS Context Management:** DBOS workflows must wrap database steps with `orgTransaction` (from `rls.ts`) to explicitly set `app.current_org_id` per-transaction, and MUST clear the context in a `finally` block to prevent cross-tenant connection pooling leaks. [Source: Phase 21]
- **Staff Cross-Org Views:** Staff members listing multi-tenant items hit bypass views (`staff_concierge_cases_list`, `staff_work_queue_org_lookup`) explicitly granted to `hestami_app` without RLS execution. [Source: Phase 21]
- **Staff Specific Reads:** Staff reading specific out-of-tenant items triggers an audited context switch using `setOrgContextForWorkItem`. [Source: Phase 21]

## Phase 22: Admin Permissions and Settings Backend
- **Permissions API:** `permissionsAdmin.ts` oRPC router handling cross-org stats and audit queries via `ActivityEvent`. Requires derived `hestami_staff` Cerbos roles. [Source: Phase 22]

## Phase 23: TIMESTAMPTZ Logic
- **Server DB Timezone:** Database timezone dictates the fallback conversion for older scripts. No backend TypeScript code needs modification as standard `Date` converts implicitly. [Source: Phase 23]

## Phase 24: Document Processing Queue (DPQ) Backend
- **Error Classification Map:** `documentWorkflow.ts` handles transient (HTTP 5xx, timeout, network) vs permanent (corrupt, unreadable). [Source: Phase 24]
- **DBOS Retry Scheduled Workflow:** A DBOS scheduled job polls `PROCESSING_FAILED` with exponential backoff calculation checking rate limits against `.env` variables (`DPQ_MAX_CONCURRENT_PER_ORG`, `DPQ_GLOBAL_MAX_CONCURRENT`). [Source: Phase 24]
- **Admin Document API:** `documentProcessingRouter` at `/api/v1/rpc/documentProcessing/*` executes bulk retries and overrides. Requires `PLATFORM_OPERATIONS` pillar access. [Source: Phase 24]
- **OpenTelemetry Logs:** Emits spans and counts for `document.processing.started`, `document.processing.completed`, `document.processing.failed`, `document.processing.infected`, and `document.processing.queue_depth`. [Source: Phase 24]

## Phase 25: Node to Bun Migration
- **Bun Runtime:** Replaces Node.js. Uses `@sveltejs/adapter-bun`. Drops PM2 in favor of 1-process per container with native Docker Compose replica scaling. [Source: Phase 25]
- **Process Supervision:** Graceful shutdown handles `SIGTERM`/`SIGINT` via `shutdown.ts`. Health endpoints `/api/health` and `/api/ready` exposed for Traefik and Docker healthchecks. [Source: Phase 25]

## Phase 26: Pooling Configuration
- **Deterministic Limits:** Explicit bounds for connection pools set via `PRISMA_POOL_MAX` (default 3) and `DBOS_POOL_MAX` (default 3) environment variables. Prisma uses `pg.Pool` with `@prisma/adapter-pg`. DBOS system database uses explicit pool via config. [Source: Phase 26]
- **DBOS Executor Identity:** Exactly one DBOS executor per PM2/Container process. `executorID` dynamically derived (e.g., `web-${PM2_INSTANCE_ID}`) to avoid collisions. [Source: Phase 26]

## Phase 27: Association Management Backend
- **Creation Workflow:** `CREATE_MANAGED_ASSOCIATION_v1` in `associationWorkflow.ts` durably orchestrates creating the association, creating the management contract, and seeding the default Chart of Accounts (with template support). Requires Cerbos `org_admin` permissions and an `idempotencyKey`. [Source: Phase 27]

## Phase 28: Governance & Staff Backend
- **Org Staff Router:** `orgStaffRouter` enforces CAM pillar access ONLY for `MANAGEMENT_COMPANY` and `COMMUNITY_ASSOCIATION` types. Requires `orgProcedure`. [Source: Phase 28]
- **Committees DBOS:** `CREATE_COMMITTEE`, `UPDATE_COMMITTEE`, and Member addition/removal wrapped in durable workflows. [Source: Phase 28]

## Phase 29: Observability Enhancements (OTel)
- **Manual Instrumentation (Bun Check):** Because Node auto-instrumentation fails in Bun, specific manual middlewares are used. [Source: Phase 29]
- **Trace Contexts:** `user.id`, `org.id`, `rpc.method`, `cerbos.action`, `workflow.id` are manually appended to spans. Prisma is instrumented via `$extends` to add `db.operation` and `db.table`. [Source: Phase 29]
- **Error Spans:** HTTP 4xx/5xx and Superforms failure responses (HTTP 200 with error payload) explicitly set the OTel span status to ERROR. [Source: Phase 29]

## Phase 30: Tiered Context RLS
- **SQL Session Variables:** `app.current_assoc_id` populated from `X-Assoc-Id` header to enable tiered filtering in RLS. [Source: Phase 30]
- **Assignment-Based Bypass:** SQL function `check_document_assignment(doc_id, user_id)` evaluates whether a Service Provider or Owner has access to a document via linked WorkOrder/ConciergeCase. [Source: Phase 30]
- **Management Company Pseudo-Association:** Org-wide documents belong to a "pseudo-association" matching the company to maintain consistent non-null `associationId` checking. [Source: Phase 30]

## Phase 31: Global Deployment & Data Residency
- **Global Control Plane:** Routes requests via `X-Org-Id` to specific residency zones. Stores opaque IDs only (no PII). [Source: Phase 31]
- **Zone Data Planes:** Each residency zone operates a full standalone application stack, DB, and document storage. Tenant PII never leaves its assigned zone. [Source: Phase 31]

## Phase 32: Reserve Studies Backend
- **Core Endpoints:** Uses `reserve.createComponent`, `reserve.createStudy`, `reserve.addStudyComponent`, `reserve.setFundingSchedule` API routes. [Source: Phase 32]
- **Permissions:** Cerbos policies required for `reserveComponent` and `reserveStudy`. [Source: Phase 32]

## Phase 33: Statutory Compliance Backend
- **Core Endpoints:** Uses `compliance.createRequirement`, `compliance.createDeadline`, `compliance.updateChecklistItem`, `compliance.addEvidenceDocument`. [Source: Phase 33]
- **Overdue Logic:** System dynamically calculates `OVERDUE` status for deadlines where `dueDate < now` and status is NOT_STARTED or IN_PROGRESS. [Source: Phase 33]

## Phase 34: Durable Queues & Scheduled Workflows
- **Native Implementation:** Leverage built-in DBOS queue and scheduled workflows rather than external dependencies like Redis/RabbitMQ. [Source: Phase 34]
- **Worker Coordination:** Enables container replicas (Bun) to act as a shared worker pool, with scheduled tasks executing exactly-once per interval. Uses idempotency for safe retries and fan-out workloads. [Source: Phase 34]
- **Defined Queues:** Predefined durable queues for `background-processing`, `reports`, `cleanup`, and `notifications`, with concurrency limits to protect Postgres. [Source: Phase 34]

## Phase 35: Fix RLS Connection Pooling
- **Transactional Context:** The `setOrgContext` raw SQL MUST be executed within the same `prisma.$transaction()` block as the data queries to prevent race conditions caused by Prisma connection pooling (e.g., zero counts on Concierge dashboard). [Source: Phase 35]
- **Defense in Depth:** Even with RLS enabled, all tenant-scoped queries MUST include an explicit `organizationId` filter in the Prisma `WHERE` clause. [Source: Phase 35]

## Phase 36: Telemetry & Tracing improvements
- **Bun Preload:** OTel initialization moves from SvelteKit hooks (`telemetry-init.ts`) to a Bun preload script (`--preload ./telemetry.ts`) to ensure full instrumentation (including `pg` and `http`) before any code runs. [Source: Phase 36]
- **Granular Spans:** Introduces `withSpan` and `addSpanEvent` helpers around workflow steps instead of just relying on bulk logging. [Source: Phase 36]

## Phase 37: Staff Portal Organization Rules
- **View vs Edit Auth:** Staff members can generally `view`/`list`, but only Platform Admins can update status, relying on `hestami_staff` and `hestami_platform_admin` derived Cerbos roles. [Source: Phase 37]

## Phase 38: Unified Invitation & Auth Workflow
- **Cross-Pillar Invitations:** Unified API (`invitation.*`) handles join codes (8 characters, encrypted at rest) and emits Magic Links. On accept, the system maps the `OrganizationInvitation` role to the pillar-specific relation (e.g., `CommunityMember`, `PropertyAccess`). [Source: Phase 38]

## Phase 39: i18n via Paraglide-js
- **Compiler-based Translation:** Uses `@inlang/paraglide-js` Vite plugin. Message keys follow `domain_action` notation. Default language `en`, targets `es`, `fr`, `de`, `pt`. Output is tree-shaken and used like `{m.common_save_changes()}`. [Source: Phase 39]
- **Build Impact:** `project.inlang` and `messages/` must be copied in Docker builds. [Source: Phase 39]

## Phase 40: LibreChat Architecture
- **Auth Federation:** Authentik manages OIDC. Better-Auth for web, and Authorization Code + PKCE for native Mobile UIs. LibreChat runs as a confidential OIDC client. [Source: Phase 40]
- **DBOS Orchestration:** The backend service handles creating LibreChat conversations. A resilient `createChatWorkflow` maps Hestami entities to `conversationId` records synchronously. Exposes `chat.create` via oRPC for the Mobile UI Native View. [Source: Phase 40]

## Generalized System Architecture, Logging, & Error Handling
- **SSR Data Fetching (oRPC):** Do NOT use the default `orpc` client in `+page.server.ts` because it uses relative URLs, which fail on the server. Always use `createDirectClient(buildServerContext(locals, { orgRoles... }))` to mock an in-memory direct invocation for Server-Side Rendering data loading. Never fetch using Prisma directly if the operation requires an active RLS org context, rely instead on parent layout loads and SECURITY DEFINER scopes. [Source: Agent Onboarding]
- **Agent Output Data Pipeline:** `prisma/schema.prisma` -> `bunx prisma generate` -> `generated/zod` -> `oRPC Routes` -> `bun run openapi:generate && bun run types:generate` -> `src/lib/api/types.generated.ts`. Frontend must extract from `types.generated.ts` using mapped utility types to prevent Svelte memory crashes (Do NOT import Prisma models or the entirety of `types.generated.ts` directly in `.svelte` files). [Source: Agent Onboarding]
- **TUS Document Upload Architecture**: Uploads use `upload-document/v1/init`, generating a secure token. Front-end uses `@uppy/tus` and fetches token metadata via header `Upload-Metadata`. TUS server validates token and executes server logic post-upload.
- **SECURITY DEFINER Functions**: Used only as targeted, explicit RLS bypasses (for instance, reading `Organization` logic inside auth callbacks or tenant seeding). They execute with table owner privileges, guaranteeing internal data pipelines work securely around RLS context without exposing access directly.
- **oRPC Errors**: `ApiException` class will be deprecated and migrated to oRPC-provided type-safe error handling logic `throw new ProcedureError({...})`.
- **Logging Subsystem**: OpenTelemetry integration required with logging. Logs output as JSON with `{ "timestamp", "level", "message", "trace_id", "span_id", "attributes" }`. Context must propagate strictly alongside auth states. No console logs. Redact sensitive user data. Winston integration recommended for robust formatting over OpenTelemetry streams.
- **Event Errors**: Calls to OpenTelemetry `recordSpanError()` within API/oRPC handlers must be executed manually to catch blocks setting status code `span.setStatus({ code: SpanStatusCode.ERROR, message: e.message })` alongside any unhandled thrown errors.
- **Mobile Client**: Think of mobile clients strictly as stateless, thin UI orchestrators communicating through typed TRPC/oRPC queries. Business validation rests securely decoupled exclusively on backend services/Database workflows.
- **Governance System Constraints:** The `R2-R3` internal governance tool checks whether all Prisma modifications reside within DBOS robust workflows. Legitimate, false-positive exemptions apply to raw DB calls explicitly bypassing RLS limits (`$executeRaw` context tracking), the Idempotency engine itself (`src/lib/server/api/middleware/idempotency.ts`), and Fire-and-Forget internal sub-routines (e.g., `activityEvent.create`). [Source: Governance FP]
- **Prisma Schema Drift:** Address `drift` caused by non-migration DB edits by creating a baseline schema SQL backup (`prisma migrate diff --from-migrations ... --script`), applying it as a blank catch-up migration in `prisma/migrations/`, and registering it as resolved. Use `prisma migrate deploy` on production—never `prisma db push`. [Source: Drift Procedures]

## Subsystem Architecture (Phase 2, 3, 4, 5 additions)

### Phase 2: Contractor Operations (Service Provider Subsystem)
- **Namespacing**: `contractor.profile.*`, `job.*`, `dispatch.*`, `estimate.*`, `invoice.*`, `maintenance.*` etc.
- **Routing**: Same oRPC patterns with forward slashes (`/api/v1/rpc/job/v1/create`).
- **Data Model**: `OrganizationType` includes `SERVICE_PROVIDER` and `EXTERNAL_SERVICE_PROVIDER`. Cross-tenant relationships link `WorkOrder` to `Job` via `ServiceArea`, `Technician`, and `JobTemplate`.
- **Workflows**: `job_lifecycle_v1`, `estimate_generation_v1`, `dispatch_assignment_v1`, `inventory_workflow_v1`. MUST use idempotency keys.
- **Observability**: Include `organization_id`, `job_id`, `technician_id` in traces.

### Phase 3: Concierge Property Owner Platform
- **Concept**: Translates owner intent into outcomes across fragmented ecosystems, bridging gaps via tracking `ExternalHOAContext` and `ExternalVendorContext`.
- **Core Entities**: `PropertyPortfolio`, `OwnerIntent`, `ConciergeCase`, `MaterialDecision`. Unified `Document` model replaces `AssociationDocument` to serve all pillars contextually.
- **Authorization**: Cerbos policies must be called for all single-resource requests (`authorize()`) and list endpoints (`queryFilter()`) before workflow execution. Postgres RLS is the final fallback.
- **Workflows**: `case_lifecycle_v1`, `concierge_action_execution_v1`, `resolution_closeout_v1`.

### Phase 4: Activity & Audit Subsystem
- **Core Principle**: Maintains a business-level historical ledger, separate from application telemetry/logs. The target model is `ActivityEvent`.
- **Actor Semantics**: Each action distinguishes between `HUMAN`, `AI`, and `SYSTEM` actors.
- **Intent vs. Execution**: Captures and categorizes events explicitly as `INTENT`, `DECISION`, or `EXECUTION` to establish proper chains of liability.
- **Integration**: Audit records MUST be created alongside data modifications WITHIN the same DBOS workflow (`recordActivityEvent()`). AI actions must generate a `agentReasoningSummary`.

### Phase 5: Platform UX Requirements
- **Authentication**: Uses Better Auth. Identity !== Authority. Registration yields Identity, while Organization matching yields Authority.
- **Context Management**: The active organization scope (`organization_id`) must remain explicitly set and visible in headers. Data views strictly prevent cross-org bleed.
- **Entry Vectors**: Intent-driven onboarding funnels users into their correct dashboard/pillar: (1) Owns property -> Concierge, (2) Manages HOA -> CAM, (3) Runs business -> Service Provider.

### Phases 6-12: CAM Workflows & Subsystems (Violations, ARC, WO, Governance, Docs, Dashboard)
- **Violations Framework**: Drives state transitions (DETECTED -> REVIEW -> NOTICE -> RESPOND -> ESCALATE -> REMEDIATE -> RESOLVE/CLOSE). Enforcement requires artifacts and explicitly creates associated accountability payloads (`ActivityEvent`).
- **ARC Lifecycle**: Extends states up through `BOARD_REVIEW` utilizing granular approval voting schemas (Threshold/Quorum logic via `arcReview` models). Output generates Work Orders.
- **Work Orders vs Phase 2 Execution**: A CAM Work Order functions purely as an Authorization and Budget artifact. It restricts CAM users from editing physical execution times/states (which are managed via Phase 2 `Job` pipelines by Service Providers). A Work Order traces back structurally to an Origin (`violationId`, `arcRequestId`, `resolutionId`).
- **Documents**: Categorized at upload (`DocumentContextType` -> GOVERNING_DOCS, etc). Heavily used for audit trailing. Used across other subsystems to justify decisions.
- **Governance**: Source of truth for Association Authority. Involves `Meeting`, `BoardMotion`, `Vote`, `Resolution`. Decisions made here cross-link and authorize activity in ARC, WO, and Policies.
- **Dashboard**: A read-only aggregation layer designed solely to route users elsewhere. No inline editing. Filterable via date-range and association ID context.

## Architectural Patterns & Operations

- **Strict Type Alignment**: Prisma Schema is the absolute source of truth. The application implements an explicit code-generation architecture: `Prisma -> generated Zod Input Types -> OpenAPI spec -> types.generated.ts`. Backend Workflows and Frontend UI explicitly consume from this strict chain, removing all `as any` casting and local-duplicate Enums.
- **API Routing**: Uses `oRPC` everywhere as a standard over legacy raw HTTP `apiCall` patterns. 
- **Operational Alerts Framework**: DPQ (Document Processing Queue) uses heavily defined alerting mechanisms triggering on metrics `document_processing_failed_total` (exhausted retries), `document_processing_queue_depth`, and rate limits dropping below 80% success.
---
