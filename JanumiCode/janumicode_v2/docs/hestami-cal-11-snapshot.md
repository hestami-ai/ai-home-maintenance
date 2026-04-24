# Requirements Decomposition — 781097ff

_Generated 2026-04-23 20:10Z · Run: 781097ff-aa90-4550-be86-e0750cef9e5e_
_Lens: product · Phase: 2 · Status: in_progress_
_Budget used: 0 calls · Max depth reached: 0_

## Business Context

### Release Plan (3 releases)
#### Release 1: Homeowner Service & Asset Management
This release enables homeowners to easily find and book service providers, schedule recurring maintenance, view property asset history and warranty information, and retrieve historical service documents. It establishes the core functionality for homeowners to manage their property needs.

**Rationale:** This is the minimum viable product (MVP) that provides immediate value to homeowners, who are a primary user base. It lays the foundation for the service marketplace by engaging property owners and initiating the flow of service requests.

**Journeys:** UJ-1, UJ-2, UJ-3, UJ-12
**Domains:** DOM-MARKETPLACE, DOM-ASSETS, DOM-DMS, DOM-COMMS

#### Release 2: Service Provider Operations Suite
This release equips service providers with comprehensive tools to manage their field operations, including executing work orders, generating estimates, submitting invoices, and integrating with accounting systems. It also incorporates essential compliance features like contractor insurance verification and permit tracking.

**Rationale:** Building upon the homeowner-initiated service requests from Release 1, this release enables service providers to efficiently manage their operations within the Hestami AI ecosystem. It ensures that the marketplace can scale by supporting the operational needs of contractors.

**Journeys:** UJ-4, UJ-5, UJ-6, UJ-7, UJ-8, UJ-14
**Domains:** DOM-FIELD-OPS, DOM-FINANCE, DOM-COMPLIANCE, DOM-INSURANCE, DOM-INTEGRATIONS

#### Release 3: Community Association Management Hub
This release delivers advanced tools for Community Association Managers (CAMs) and board members to handle governance, accounting, and compliance. It includes features for processing architectural review requests, secure voting on board motions, monitoring platform data integrity, reviewing financial health, and auditing community compliance.

**Rationale:** This phase expands the platform's reach to Community Associations, leveraging the established service marketplace and provider network. The complex governance and financial workflows for HOAs are best implemented once the core homeowner and service provider functionalities are stable.

**Journeys:** UJ-9, UJ-10, UJ-11, UJ-13, UJ-15
**Domains:** DOM-ASSOC-GOV, DOM-SECURITY, DOM-REPORTING, DOM-DMS, DOM-COMPLIANCE, DOM-FINANCE

### Intent Lens
**Lens:** product  
**Confidence:** 1.00  
**Rationale:** The intent directly references a 'Product Description' document for a 'new product, platform, or service'. The document includes 'Vision', 'Mission', 'Product Description', 'Pillars', 'Target Customers', 'Personas', 'User Journeys', and a 'Core Technological Infrastructure and Stack', all strong signals for the 'product' lens. The phrase 'prepare for implementation' indicates the start of a new product development cycle.

### Intent Statement
**Hestami AI Real Property OS is an AI-native operating system that unifies property owners, service providers, and community associations into a seamless digital ecosystem designed to minimize friction throughout the property lifecycle. We empower contractors with durable field workflows while equipping Community Association Managers with robust governance, accounting, and compliance tools.**

Hestami AI Real Property OS is a holistic platform connecting homeowners, service providers, and community associations into a unified ecosystem where property owners can request service, manage assets, and interact with contractors via an AI-assisted marketplace. Simultaneously, the system provides field service management tools for contractors to run their operations and a comprehensive administration suite for Community Association Managers to handle governance, accounting, and compliance. The platform leverages AI for asset exchange, workflow automation, and decision support across the entire property lifecycle, supported by secure integrations, document management, and regulatory compliance checks.

**Who it serves:** Homeowner / Property Owner — Individual residents or small landlords managing one or multiple residences who need to coordinate repairs and maintenance.  
**Problem:** Hestami AI Real Property OS is a holistic platform connecting homeowners, service providers, and community associations into a unified ecosystem where property owners can request service, manage assets, and interact with contractors via an AI-assisted marketplace. Simultaneously, the system provides field service management tools for contractors to run their operations and a comprehensive administration suite for Community Association Managers to handle governance, accounting, and compliance. The platform leverages AI for asset exchange, workflow automation, and decision support across the entire property lifecycle, supported by secure integrations, document management, and regulatory compliance checks.

#### Confirmed Assumptions
- **DEC-1** — The product is structured as a single integrated OS rather than siloed apps to ensure data consistency between owners, vendors, and HOAs.
- **DEC-2** — Mobile applications prioritize offline-first capabilities to support field technicians and residents in low-connectivity environments.
- **DEC-3** — AI agents are the primary mechanism for workflow automation, handling intake, matching, and compliance alerts.
- **DEC-4** — Digital assets (floorplans, images) are treated as persistent, versioned records that support the 'eternal perspective' of property data.
- **DEC-5** — Phase 1 prioritizes the Home Assistant Pillar to establish the vendor marketplace before implementing complex provider management.

#### Confirmed Constraints
- All client connections must ingress via Cloudflare CDN; direct IP access to the origin is prohibited.
- The system must enforce strict multi-tenant isolation at the database level for all tenant data.
- External integrations (e.g., Nextdoor, specific banking partners) are currently out-of-scope.
- The platform must handle statutory deadlines and notice requirements without manual intervention.

#### Out of Scope
- Determine primary monetization direction for Community Association Management Phase 3: SaaS licensing, transaction fees, or data insights.
- Decide ARC (Architectural Request) automation level: Fully automated decisions or AI-assisted recommendations requiring human review.
- Define initial marketplace onboarding strategy: Build direct onboarding or rely on external directory partnerships to populate vendor list.
- Clarify scope for Hestami Staff operations: Support remote customer support agents or only internal admin oversight.


## Functional Requirements (21 roots · 848 total nodes · 279 atomic leaves)

### Release 1: Homeowner Service & Asset Management (4 roots)
*This release enables homeowners to easily find and book service providers, schedule recurring maintenance, view property asset history and warranty information, and retrieve historical service documents. It establishes the core functionality for homeowners to manage their property needs.*

### FR US-001 `[pending]`

**As a** Homeowner, **I want** Search and book a service provider for a Service Call, **so that** Homeowner connects with a vetted provider to resolve property maintenance needs.

**Acceptance criteria:**
  - **AC-001** — Provider availability displayed
    - _Measurable:_ List of ENT-PROVIDER records with verified status loads within 3 seconds
  - **AC-002** — Booking notification sent
    - _Measurable:_ Notification triggers within 15 minutes of booking confirmation

_Status: pending · Priority: critical · Traces to: UJ-1, ENT-PROVIDER, ENT-CLIENT-LEAD, WF-1 · Pass: 0_

#### US-001-1.1 `[Tier C · pending]`

**As a** CAM operator, **I want** Render list of providers with verified status, **so that** Homeowner sees only providers whose verification records are valid.

**Acceptance criteria:**
  - **AC-001-C1** — Provider list loads within 3 seconds.
    - _Measurable:_ Time to render ENT-PROVIDER records <= 3000ms for the initial view

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-1, ENT-PROVIDER · Pass: 1_

_Decomposition rationale:_ Maps AC-001 directly to a specific system action (List Display). The performance constraint defines it as a Tier C implementation commitment.

_Surfaced assumptions:_ A-0001, A-0002

##### US-001-1.1-1 `[Tier C · pending]`

**As a** API Service, **I want** Filter ENT-PROVIDER records by valid verification status from WF-1, **so that** Return only providers where ENT-PROVIDER-PROFILE verification is valid and active.

**Acceptance criteria:**
  - **AC-101** — All returned providers have active verification status.
    - _Measurable:_ SELECT id FROM ENT-PROVIDER WHERE verification_status = 'valid' AND expiry_date > NOW()

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-1, ENT-PROVIDER, WF-1 · Pass: 2_

_Decomposition rationale:_ Core functionality. Must ensure only valid providers are returned, linking back to WF-1 completion status.

_Surfaced assumptions:_ A-0065, A-0066

  - **US-001-1.1-1.1** `[Tier C · pending]`
    **As a** Data Fetcher, **I want** Retrieve verification_status and expiry_date from ENT-PROVIDER table, **so that** Raw dataset of provider records with relevant status fields.

    **Acceptance criteria:**
      - **AC-101.1** — Status and expiry fields exist for queried IDs
        - _Measurable:_ SELECT status, expiry_date FROM ENT-PROVIDER WHERE id IN (list of IDs) returns rows for all requested IDs

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-PROVIDER, WF-1 · Pass: 3_

    _Decomposition rationale:_ This child isolates the physical data retrieval step required to enable filtering; without fetching these fields, filtering cannot occur.

    _Surfaced assumptions:_ A-0242, A-0243
  - **US-001-1.1-1.2** `[Tier C · pending]`
    **As a** Logic Engine, **I want** Evaluate active verification status against expiry timestamp, **so that** Boolean flags indicating active verification for each record.

    **Acceptance criteria:**
      - **AC-101.2** — Expiry comparison uses UTC time
        - _Measurable:_ expiry_date > NOW() interpreted in UTC timezone, not local system time

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-PROVIDER, UJ-1 · Pass: 3_

    _Decomposition rationale:_ This child defines the specific logic for determining 'validity' separate from raw fetch; the existing assumption A-0065 covers status definition, but expiry handling is a distinct implementation commitment.

    _Surfaced assumptions:_ A-0242, A-0243
  - **US-001-1.1-1.3** `[Tier D · atomic]`
    **As a** Output Formatter, **I want** Construct API response payload containing filtered list, **so that** JSON array of provider IDs.

    **Acceptance criteria:**
      - **AC-101.3** — No invalid providers are included
        - _Measurable:_ Length of returned array === COUNT(records where status='valid' AND expiry_date > NOW())

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-1 · Pass: 3_

    _Decomposition rationale:_ This is the leaf operation delivering the final observable result to the user journey UJ-1; all upstream logic must serve this output.

    _Surfaced assumptions:_ A-0242, A-0243
##### US-001-1.1-2 `[Tier C · pending]`

**As a** Frontend Optimization, **I want** Optimize UI rendering to meet 3-second SLO, **so that** Initial view of provider list completes rendering within 3000ms.

**Acceptance criteria:**
  - **AC-102** — First meaningful paint for list occurs within 3000ms.
    - _Measurable:_ measure_time_until_render_complete <= 3000ms

_Status: pending · Priority: high · Tier: C · Traces to: UJ-1, TECH-3, TECH-12 · Pass: 2_

_Decomposition rationale:_ Addresses AC-001-C1. Requires frontend (SvelteKit) and observability (OpenTelementry) to verify timing.

_Surfaced assumptions:_ A-0065, A-0066

  - **US-001-1.1-2.1** `[Tier C · pending]`
    **As a** Frontend Architect, **I want** Implement payload field projection for initial list request, **so that** API response payload contains only essential provider fields.

    **Acceptance criteria:**
      - **AC-102.1** — API response payload size is minimized to essential fields.
        - _Measurable:_ payload_bytes < 500000 for first request

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-1 · Pass: 3_

    _Decomposition rationale:_ Reducing initial payload size directly lowers network transfer time, contributing to the SLO.

    _Surfaced assumptions:_ A-0244, A-0245, A-0246, A-0247
  - **US-001-1.1-2.2** `[Tier C · pending]`
    **As a** Frontend Engineer, **I want** Inline critical CSS and minimal JS for initial view, **so that** Critical rendering path resources are embedded without external fetch delay.

    **Acceptance criteria:**
      - **AC-102.2** — Critical styles are inline, avoiding render-blocking external requests.
        - _Measurable:_ external_css_requests_in_critical_path === 0

    _Status: pending · Priority: high · Tier: C · Traces to: TECH-3 · Pass: 3_

    _Decomposition rationale:_ Inlining critical resources ensures the browser can parse layout immediately, reducing FCP.

    _Surfaced assumptions:_ A-0244, A-0245, A-0246, A-0247
  - **US-001-1.1-2.3** `[Tier C · pending]`
    **As a** Asset Engineer, **I want** Enforce modern image compression formats for provider listings, **so that** Initial list images load faster via optimized formats.

    **Acceptance criteria:**
      - **AC-102.3** — List images utilize modern compressed formats.
        - _Measurable:_ image_format_includes_webp

    _Status: pending · Priority: medium · Tier: C · Traces to: UJ-1, TECH-12 · Pass: 3_

    _Decomposition rationale:_ Smaller asset size reduces decode time and contributes to the 3-second SLO.

    _Surfaced assumptions:_ A-0244, A-0245, A-0246, A-0247
  - **US-001-1.1-2.4** `[Tier C · pending]`
    **As a** SRE, **I want** Configure First Meaningful Paint tracking in observability, **so that** FMP metrics are logged to verify SLO adherence.

    **Acceptance criteria:**
      - **AC-102.4** — FMP metric is emitted and available in traces.
        - _Measurable:_ metric_logged_for_first_paint

    _Status: pending · Priority: medium · Tier: C · Traces to: TECH-12, UJ-1 · Pass: 3_

    _Decomposition rationale:_ Observability enables verification that the 3-second SLO is consistently met.

    _Surfaced assumptions:_ A-0244, A-0245, A-0246, A-0247
##### US-001-1.1-3 `[Tier D · atomic]`

**As a** Data Filtering, **I want** Exclude providers with active compliance flags, **so that** List excludes providers with non-compliant status or active violations.

**Acceptance criteria:**
  - **AC-103** — No provider with active violation appears in list.
    - _Measurable:_ NOT EXISTS (SELECT 1 FROM ENT-COMPLIANCE-FLAG WHERE provider_id = p.id AND status = 'active')

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-1, ENT-PROVIDER, ENT-COMPLIANCE-FLAG, COMP-13 · Pass: 2_

_Decomposition rationale:_ Atomic check for each provider to ensure safety before display. Leaf operation regarding the specific exclusion logic.

_Surfaced assumptions:_ A-0065, A-0066

#### US-001-1.2 `[Tier C · pending]`

**As a** CAM operator, **I want** Process booking confirmation transaction, **so that** Booking state is persisted and workflow is triggered upon selection.

**Acceptance criteria:**
  - **AC-002-C1** — Booking state persists successfully.
    - _Measurable:_ System writes record to ENT-CLIENT-LEAD and triggers WF-1 upon confirmation click

_Status: pending · Priority: high · Tier: C · Traces to: WF-1, ENT-CLIENT-LEAD · Pass: 1_

_Decomposition rationale:_ Maps the 'booking' part of the parent story to the state-change action in the backend. Traces to the specific workflow for onboarding/verification logic.

_Surfaced assumptions:_ A-0001, A-0002

##### US-001-1.2-1 `[Tier C · pending]`

**As a** System, **I want** Persist booking state to ENT-CLIENT-LEAD, **so that** Record committed to storage with unique ID.

**Acceptance criteria:**
  - **AC-002-C1-1** — Row inserted into ENT-CLIENT-LEAD successfully
    - _Measurable:_ SELECT * FROM ENT-CLIENT-LEAD WHERE booking_id = [X] returns exactly one row

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-CLIENT-LEAD · Pass: 2_

_Decomposition rationale:_ Data persistence is the atomic storage consequence of the transaction. It defines the state change boundary.

_Surfaced assumptions:_ A-0067, A-0068, A-0069

  - **FR-ACCT-1.2-1.1** `[Tier C · pending]`
    **As a** Database Layer, **I want** Generate unique identifier for new booking, **so that** System produces a globally unique booking_id for the record.

    **Acceptance criteria:**
      - **AC-003** — Inserted record has a valid booking_id string.
        - _Measurable:_ booking_id length is 36 hex characters (UUID v4) and does not match any existing record in ENT-CLIENT-LEAD

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-CLIENT-LEAD · Pass: 3_

    _Decomposition rationale:_ Defines the specific engineering sub-strategy for ID generation (UUID v4) to satisfy the uniqueness requirement A-0069 without relying on application-level checks alone.

    _Surfaced assumptions:_ A-0248
  - **FR-ACCT-1.2-1.2** `[Tier D · atomic]`
    **As a** Storage Layer, **I want** Insert row into ENT-CLIENT-LEAD, **so that** Booking state persists in storage with a valid foreign key relationship.

    **Acceptance criteria:**
      - **AC-004** — Row persisted in ENT-CLIENT-LEAD.
        - _Measurable:_ SELECT COUNT(*) FROM ENT-CLIENT-LEAD WHERE booking_id = [X] returns 1 for any inserted [X]

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-CLIENT-LEAD · Pass: 3_

    _Decomposition rationale:_ Leaf operation representing the atomic write action; acceptance criteria matches the parent AC-002-C1-1.

    _Surfaced assumptions:_ A-0248
  - **FR-ACCT-1.2-1.3** `[Tier C · pending]`
    **As a** Transaction Engine, **I want** Enforce ACID transaction boundary, **so that** Booking persistence does not leak to other transactions or fail partially.

    **Acceptance criteria:**
      - **AC-005** — Read of ENT-CLIENT-LEAD sees inserted row.
        - _Measurable:_ SELECT * FROM ENT-CLIENT-LEAD WHERE booking_id = [X] succeeds immediately after commit in same session

    _Status: pending · Priority: high · Tier: C · Traces to: US-001-1.2-2, ENT-CLIENT-LEAD · Pass: 3_

    _Decomposition rationale:_ Commitment to transactional integrity required for Workflow engine (US-001-1.2-2) to read consistent state; uses DBOS transactional guarantees.

    _Surfaced assumptions:_ A-0248
  - **FR-ACCT-1.2-1.4** `[Tier C · pending]`
    **As a** Error Handler, **I want** Notify UI of persistence failure, **so that** User receives feedback on failed booking state persistence.

    **Acceptance criteria:**
      - **AC-006** — Error response sent to client on failure.
        - _Measurable:_ HTTP 500 response received by client when ENT-CLIENT-LEAD insert fails due to constraint violation

    _Status: pending · Priority: medium · Tier: C · Traces to: US-001-1.2-3, ENT-CLIENT-LEAD · Pass: 3_

    _Decomposition rationale:_ Implementation commitment to failure handling strategy that connects to the UI response sibling US-001-1.2-3.

    _Surfaced assumptions:_ A-0248
##### US-001-1.2-2 `[Tier C · pending]`

**As a** System, **I want** Trigger WF-1 workflow instance, **so that** Workflow chain launched with booking payload.

**Acceptance criteria:**
  - **AC-002-C1-2** — Workflow instance ID returned for booking
    - _Measurable:_ System returns workflow_instance_id for WF-1 associated with the booking_id

_Status: pending · Priority: high · Tier: C · Traces to: WF-1 · Pass: 2_

_Decomposition rationale:_ Triggering the workflow is the downstream side-effect commitment mandated by the AC. It defines the asynchronous process start.

_Surfaced assumptions:_ A-0067, A-0068, A-0069

  - **US-001-1.2-2.1** `[Tier C · pending]`
    **As a** API Handler, **I want** Validate booking payload against WF-1 schema definition, **so that** Trigger proceeds only if payload conforms to expected WF-1 structure.

    **Acceptance criteria:**
      - **AC-2-1** — Payload fields match WF-1 schema constraints.
        - _Measurable:_ JSON payload passed to engine === WF-1_SCHEMA_DEFINITION (v1)

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ Before invoking the engine, the input must be structurally valid; this prevents invalid workflow execution.

    _Surfaced assumptions:_ A-0249, A-0250, A-0251
  - **US-001-1.2-2.2** `[Tier C · pending]`
    **As a** Data Layer, **I want** Persist booking_id to workflow_instance_id mapping, **so that** Correlation record exists in workflow registry linking booking and workflow.

    **Acceptance criteria:**
      - **AC-2-2** — Correlation row persisted to workflow_registry table.
        - _Measurable:_ SELECT count(*) FROM workflow_registry WHERE booking_id = :booking_id AND status = 'triggered' returns 1

    _Status: pending · Priority: high · Tier: C · Traces to: WF-1, US-001-1.2-1 · Pass: 3_

    _Decomposition rationale:_ This step ensures the system can track the workflow execution state relative to the booking entity.

    _Surfaced assumptions:_ A-0249, A-0250, A-0251
  - **US-001-1.2-2.3** `[Tier C · pending]`
    **As a** Workflow Orchestrator, **I want** Invoke DBOS workflow engine with booking context, **so that** Workflow engine accepts and processes the payload.

    **Acceptance criteria:**
      - **AC-2-3** — Engine accepts invocation without timeout.
        - _Measurable:_ DBOS_accept_workflow(booking_id, payload) returns success_code

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-1, TECH-6 · Pass: 3_

    _Decomposition rationale:_ The specific implementation choice is to invoke DBOS directly as the engine, ensuring idempotency and durability.

    _Surfaced assumptions:_ A-0249, A-0250, A-0251
  - **US-001-1.2-2.4** `[Tier D · atomic]`
    **As a** Response Service, **I want** Return workflow_instance_id to caller, **so that** API response contains the newly assigned workflow instance ID.

    **Acceptance criteria:**
      - **AC-2-4** — HTTP 200 response includes workflow_instance_id field.
        - _Measurable:_ response.body.workflow_instance_id === engine_returned_id

    _Status: atomic · Priority: high · Tier: D · Traces to: US-001-1.2-3 · Pass: 3_

    _Decomposition rationale:_ This is the terminal operation for this transaction branch; the caller requires immediate feedback to continue.

    _Surfaced assumptions:_ A-0249, A-0250, A-0251
##### US-001-1.2-3 `[Tier D · atomic]`

**As a** User, **I want** Return transaction result to UI, **so that** User receives immediate feedback on success/failure.

**Acceptance criteria:**
  - **AC-002-C1-3** — Confirmation message displayed in UI
    - _Measurable:_ User interface renders success or error banner within 200ms of backend completion

_Status: atomic · Priority: medium · Tier: D · Traces to: US-001-1.3 · Pass: 2_

_Decomposition rationale:_ User feedback is the observable leaf outcome. It connects the backend transaction to the UI flow of sibling US-001-1.3 regarding notifications.

_Surfaced assumptions:_ A-0067, A-0068, A-0069

#### US-001-1.3 `[Tier D · atomic]`

**As a** CAM operator, **I want** Send booking notification message, **so that** User receives immediate alert after booking.

**Acceptance criteria:**
  - **AC-002-C2** — Notification sent within 15 minutes.
    - _Measurable:_ ENT-NOTIFICATION creation timestamp is within 15 mins of transaction commit time

_Status: atomic · Priority: high · Tier: D · Traces to: WF-9, ENT-NOTIFICATION · Pass: 1_

_Decomposition rationale:_ Maps AC-002 to the atomic delivery action. This is the leaf operation for notification delivery; further decomposition is unnecessary.

_Surfaced assumptions:_ A-0001, A-0002

### FR US-002 `[pending]`

**As a** Homeowner, **I want** Schedule recurring maintenance task, **so that** Homeowner establishes routine Service Calls to maintain property value.

**Acceptance criteria:**
  - **AC-003** — Recurring job respects calendar
    - _Measurable:_ SCHEDULE-JOB configuration aligns with ENT-PROVIDER availability calendar
  - **AC-004** — Recurrence reminder sent
    - _Measurable:_ Notification sent 48 hours prior to next scheduled execution

_Status: pending · Priority: high · Traces to: UJ-2, ENT-SCHEDULE-JOB, WF-9 · Pass: 0_

#### US-002-C-001 `[Tier C · pending]`

**As a** Scheduler, **I want** Persist recurrence rule with start/end dates and interval, **so that** The system creates a persistent record of the recurring job in the scheduler.

**Acceptance criteria:**
  - **AC-101** — Recurring job record exists in ENT-SCHEDULE-JOB table
    - _Measurable:_ A row exists in ENT-SCHEDULE-JOB where owner_id matches and next_run_date is calculated based on start_date + interval

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-2, ENT-SCHEDULE-JOB · Pass: 1_

_Decomposition rationale:_ Defines the core data contract for the recurring task. This commits the system to creating a specific entity type (ENT-SCHEDULE-JOB) and validates the atomic persistence action.

_Surfaced assumptions:_ A-0003, A-0004

##### US-002-C-001-01 `[Tier D · atomic]`

**As a** Data Validator, **I want** Validate recurrence interval and date bounds, **so that** Record is rejected if interval <= 0 or dates are invalid.

**Acceptance criteria:**
  - **AC-101-01** — Interval is strictly positive
    - _Measurable:_ interval > 0

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-2, US-002-C-002 · Pass: 2_

_Decomposition rationale:_ This is the first leaf operation; validation must occur before persistence to maintain data integrity. Traces to C-002 because invalid dates may conflict with provider window constraints.

_Surfaced assumptions:_ A-0070, A-0071

##### US-002-C-001-02 `[Tier D · atomic]`

**As a** Date Calculator, **I want** Calculate next_run_date using UTC arithmetic, **so that** next_run_date is derived from start_date + (interval * cycle_count).

**Acceptance criteria:**
  - **AC-101-02** — next_run_date matches formula
    - _Measurable:_ next_run_date === start_date + (interval * cycles)

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-2, US-002-C-004 · Pass: 2_

_Decomposition rationale:_ Calculation must be deterministic and timezone-independent to align with Sibling C-004's requirement for UTC storage.

_Surfaced assumptions:_ A-0070, A-0071

##### US-002-C-001-03 `[Tier D · atomic]`

**As a** Persistence Layer, **I want** Insert row into ENT-SCHEDULE-JOB table, **so that** Row exists with correct owner_id and calculated date.

**Acceptance criteria:**
  - **AC-101-03** — Row is persisted with unique schedule ID
    - _Measurable:_ SELECT COUNT(*) FROM ENT-SCHEDULE-JOB WHERE owner_id = ? > 0

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-2, US-002-C-003 · Pass: 2_

_Decomposition rationale:_ Final step of the requirement is the write operation. Traces to C-003 because the record must exist to trigger subsequent notifications.

_Surfaced assumptions:_ A-0070, A-0071

##### US-002-C-001-04 `[Tier D · atomic]`

**As a** Audit Emitter, **I want** Create audit log entry for schedule creation, **so that** Creation event is immutably recorded.

**Acceptance criteria:**
  - **AC-101-04** — Audit log entry created
    - _Measurable:_ COUNT(ENT-AUDIT-LOG-ENTRY) WHERE action='create_schedule' > 0

_Status: atomic · Priority: medium · Tier: D · Traces to: UJ-2, TECH-11 · Pass: 2_

_Decomposition rationale:_ Security compliance requires logging all scheduler state changes for audit trails.

_Surfaced assumptions:_ A-0070, A-0071

#### US-002-C-002 `[Tier C · pending]`

**As a** Calendar Validator, **I want** Enforce provider availability window during creation, **so that** Jobs are never scheduled outside the provider's operating hours.

**Acceptance criteria:**
  - **AC-102** — Scheduled time falls within ENT-PROVIDER available hours
    - _Measurable:_ next_run_date AND time falls between ENT-PROVIDER.min_work_hour AND ENT-PROVIDER.max_work_hour for that specific weekday

_Status: pending · Priority: high · Tier: C · Traces to: UJ-2, ENT-PROVIDER · Pass: 1_

_Decomposition rationale:_ Addresses AC-003 directly. This is an implementation commitment to validate against the provider entity's availability attributes before allowing persistence.

_Surfaced assumptions:_ A-0003, A-0004

##### US-002-C-002-C-001 `[Tier C · pending]`

**As a** Scheduler Validator, **I want** Fetch ENT-PROVIDER availability window for scheduled date, **so that** System retrieves min_work_hour, max_work_hour, and timezone for the specific weekday.

**Acceptance criteria:**
  - **AC-C001** — Provider work hours are retrieved for the target date's weekday.
    - _Measurable:_ ENT-PROVIDER.work_hours[weekday].exists for target next_run_date

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-2, ENT-PROVIDER · Pass: 2_

_Decomposition rationale:_ To validate availability, the system must first resolve the provider's specific window for the job's weekday. This is the prerequisite data retrieval step.

_Surfaced assumptions:_ A-0072, A-0073, A-0074

  - **US-002-C-002-C-001-C1** `[Tier C · pending]`
    **As a** Scheduler Validator, **I want** Resolve `next_run_date` to ISO weekday key (0-6), **so that** Weekday index is calculated deterministically from the target date.

    **Acceptance criteria:**
      - **AC-001** — Calculated weekday key matches standard ISO-8601 logic.
        - _Measurable:_ weekday_index === Date.getUTCDay(target_date) for all inputs

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-2, ENT-PROVIDER · Pass: 3_

    _Decomposition rationale:_ Separates temporal logic from data access; defines the specific algorithmic commitment for time normalization before data retrieval.

    _Surfaced assumptions:_ A-0252, A-0253, A-0254
  - **US-002-C-002-C-001-C2** `[Tier C · pending]`
    **As a** Scheduler Validator, **I want** Retrieve `work_hours` array from `ENT-PROVIDER` profile store, **so that** Work hours mapping is loaded into validation context.

    **Acceptance criteria:**
      - **AC-002** — Work hours array is populated from provider profile.
        - _Measurable:_ profile.work_hours[weekday_index] is non-null for valid profiles

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-2, ENT-PROVIDER · Pass: 3_

    _Decomposition rationale:_ Commits to reading from the specific entity store rather than caching or external APIs, ensuring data freshness for the validation step.

    _Surfaced assumptions:_ A-0252, A-0253, A-0254
  - **US-002-C-002-C-001-C3** `[Tier C · pending]`
    **As a** Scheduler Validator, **I want** Construct Availability Window payload object, **so that** Payload contains normalized min/max hours and timezone offset.

    **Acceptance criteria:**
      - **AC-003** — Availability Window object structure matches downstream schema.
        - _Measurable:_ payload.min_work_hour, payload.max_work_hour, payload.timezone exist and are numeric/string types

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-2, ENT-PROVIDER · Pass: 3_

    _Decomposition rationale:_ Defines the output contract for the sibling Compare and Timezone conversion steps, ensuring downstream modules receive consistent data.

    _Surfaced assumptions:_ A-0252, A-0253, A-0254
##### US-002-C-002-C-002 `[Tier C · pending]`

**As a** Scheduler Validator, **I want** Compare job schedule against provider working hours, **so that** System determines if job time falls within (min_work_hour AND max_work_hour).

**Acceptance criteria:**
  - **AC-C002** — Scheduled time is flagged as compliant or non-compliant.
    - _Measurable:_ job_start_time >= provider_min && job_start_time <= provider_max (normalized to UTC)

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-2, US-002-C-004 · Pass: 2_

_Decomposition rationale:_ This is the core logic step that implements the AC-102 verification against the fetched provider data, accounting for timezone normalization from sibling US-002-C-004.

_Surfaced assumptions:_ A-0072, A-0073, A-0074

  - **US-002-C-002-C-002-1** `[Tier D · atomic]`
    **As a** Validation Engine, **I want** Compare job_start_time against provider_min_work_hour, **so that** Job passes minimum boundary check if start_time >= min.

    **Acceptance criteria:**
      - **AC-002-1** — Returns true if start_time is greater than or equal to min boundary.
        - _Measurable:_ Boolean result: (job_start_time >= provider_min_work_hour) === true

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-2, US-002-C-002-C-004 · Pass: 3_

    _Decomposition rationale:_ This child isolates the lower-bound comparison logic. It is an atomic test case where only the minimum threshold is evaluated without the maximum constraint, allowing independent verification of the floor boundary.

    _Surfaced assumptions:_ A-0255, A-0256
  - **US-002-C-002-C-002-2** `[Tier D · atomic]`
    **As a** Validation Engine, **I want** Compare job_start_time against provider_max_work_hour, **so that** Job passes maximum boundary check if start_time <= max.

    **Acceptance criteria:**
      - **AC-002-2** — Returns true if start_time is less than or equal to max boundary.
        - _Measurable:_ Boolean result: (job_start_time <= provider_max_work_hour) === true

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-2, US-002-C-002-C-004 · Pass: 3_

    _Decomposition rationale:_ This child isolates the upper-bound comparison logic. It enables separate testing of the ceiling boundary to ensure jobs do not start after hours.

    _Surfaced assumptions:_ A-0255, A-0256
  - **US-002-C-002-C-002-3** `[Tier D · atomic]`
    **As a** State Manager, **I want** Aggregate boundary results to set compliance flag, **so that** Compliance flag set to true only if both min and max checks pass.

    **Acceptance criteria:**
      - **AC-002-3** — Compliance flag is set based on logical AND of individual boundary checks.
        - _Measurable:_ flag_is_compliant === (check_min AND check_max)

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-2, COMP-1 · Pass: 3_

    _Decomposition rationale:_ This child commits to the composite logic rule used to derive the final state. It binds the outputs of the individual boundary checks to the final system state variable.

    _Surfaced assumptions:_ A-0255, A-0256
  - **US-002-C-002-C-002-4** `[Tier D · atomic]`
    **As a** Auditor, **I want** Log compliance determination event to audit trail, **so that** Immutable record of comparison result created.

    **Acceptance criteria:**
      - **AC-002-4** — Audit entry contains timestamp, job ID, and boolean compliance status.
        - _Measurable:_ ENT-AUDIT-LOG-ENTRY exists in database with job_id and boolean_status fields immediately after check

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-2, COMP-17 · Pass: 3_

    _Decomposition rationale:_ This child ensures traceability for the validation decision. It is a leaf operation focused on the side-effect of recording the outcome, distinct from the logic check itself.

    _Surfaced assumptions:_ A-0255, A-0256
##### US-002-C-002-C-003 `[Tier C · pending]`

**As a** Scheduler Validator, **I want** Enforce creation failure on availability violation, **so that** Job creation is blocked and error returned to client if window mismatch.

**Acceptance criteria:**
  - **AC-C003** — Invalid job creation request results in an immediate error response.
    - _Measurable:_ HTTP 422 returned for all cases where comparison fails

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-2 · Pass: 2_

_Decomposition rationale:_ Enforcing the policy choice (Scope Commitment) requires a concrete system action (Blocking). This defines the downstream consequence of the validation logic.

_Surfaced assumptions:_ A-0072, A-0073, A-0074

  - **US-002-C-002-C-003-1.1** `[Tier D · atomic]`
    **As a** Validator, **I want** Validate job creation request against provider minimum work hour window, **so that** Job creation request is rejected if job schedule starts before provider_min_work_hour.

    **Acceptance criteria:**
      - **AC-C003-1.1** — Job creation fails when time is below minimum window
        - _Measurable:_ if job_time_utc < provider.min_work_hour_utc then reject

    _Status: atomic · Priority: high · Tier: D · Traces to: US-002-C-002-C-001, US-002-C-002-C-002, US-002-C-002-C-004 · Pass: 3_

    _Decomposition rationale:_ This atomic check identifies the specific boundary condition (minimum hour) that triggers the availability violation enforcement, derived from the comparison logic (C-002) and data retrieval (C-001/C-004).

    _Surfaced assumptions:_ A-0257
  - **US-002-C-002-C-003-1.2** `[Tier D · atomic]`
    **As a** Validator, **I want** Validate job creation request against provider maximum work hour window, **so that** Job creation request is rejected if job schedule starts after provider_max_work_hour.

    **Acceptance criteria:**
      - **AC-C003-1.2** — Job creation fails when time exceeds maximum window
        - _Measurable:_ if job_time_utc > provider.max_work_hour_utc then reject

    _Status: atomic · Priority: high · Tier: D · Traces to: US-002-C-002-C-001, US-002-C-002-C-002, US-002-C-002-C-004 · Pass: 3_

    _Decomposition rationale:_ This atomic check identifies the specific boundary condition (maximum hour) that triggers the availability violation enforcement, derived from the comparison logic (C-002) and data retrieval (C-001/C-004).

    _Surfaced assumptions:_ A-0257
  - **US-002-C-002-C-003-1.3** `[Tier D · atomic]`
    **As a** Responder, **I want** Return immediate HTTP 422 error response for validation failures, **so that** Client receives 422 Unprocessable Entity status immediately upon validation mismatch.

    **Acceptance criteria:**
      - **AC-C003-1.3** — HTTP 422 returned for any validation mismatch
        - _Measurable:_ response.status_code === 422

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-002-C-002-C-002 · Pass: 3_

    _Decomposition rationale:_ This atomic action executes the enforcement commitment by returning the specific HTTP status code required by the AC, dependent on the comparison outcome from C-002.

    _Surfaced assumptions:_ A-0257
##### US-002-C-002-C-004 `[Tier C · pending]`

**As a** Scheduler Validator, **I want** Handle timezone conversion for job vs provider hours, **so that** System normalizes both job time and provider hours to a common timezone (UTC) before comparison.

**Acceptance criteria:**
  - **AC-C004** — Validation prevents timezone-based false negatives.
    - _Measurable:_ job_start_time_utc === provider_min_utc && job_start_time_utc <= provider_max_utc

_Status: pending · Priority: high · Tier: C · Traces to: UJ-2, US-002-C-004 · Pass: 2_

_Decomposition rationale:_ Since US-002-C-004 enforces UTC storage, this child must handle the normalization logic explicitly to ensure the comparison is accurate regardless of local timezones.

_Surfaced assumptions:_ A-0072, A-0073, A-0074

  - **US-002-C-002-C-004-D001** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Fetch timezone identifier from ENT-PROVIDER-PROFILE, **so that** Provider timezone string (e.g. America/New_York) is retrieved for conversion.

    **Acceptance criteria:**
      - **AC-001** — Provider timezone is retrieved from stored profile.
        - _Measurable:_ ENT-PROVIDER-PROFILE.timezone_offset_field is populated for every provider record.

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-2 · Pass: 3_

    _Decomposition rationale:_ This is an atomic read operation required to establish the source context for the conversion logic.

    _Surfaced assumptions:_ A-0258, A-0259, A-0260
  - **US-002-C-002-C-004-D002** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Infer job input timezone from user context or default to UTC, **so that** Determine if job time input is naive or aware of a timezone offset.

    **Acceptance criteria:**
      - **AC-002** — Job input time is tagged with a timezone string or treated as UTC if untagged.
        - _Measurable:_ Every job_start_time entry has an associated timezone_id or explicit UTC flag.

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-2, US-002-C-002-C-004 · Pass: 3_

    _Decomposition rationale:_ Distinguishes between client-local input and UTC-standard input to perform the correct mathematical conversion.

    _Surfaced assumptions:_ A-0258, A-0259, A-0260
  - **US-002-C-002-C-004-D003** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Convert local timestamps to UTC epoch seconds, **so that** Both job time and provider hours are represented in a single timezone coordinate.

    **Acceptance criteria:**
      - **AC-003** — Converted timestamps match expected UTC value within millisecond tolerance.
        - _Measurable:_ absolute_value(job_time_utc - expected_utc_epoch) < 1ms for all conversions.

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-2, US-002-C-002-C-004 · Pass: 3_

    _Decomposition rationale:_ The core arithmetic operation that satisfies the parent's AC of preventing timezone-based false negatives.

    _Surfaced assumptions:_ A-0258, A-0259, A-0260
  - **US-002-C-002-C-004-D004** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Handle Daylight Saving Time transition offsets, **so that** Timestamp remains accurate during clock change events without double-counting or skipping hours.

    **Acceptance criteria:**
      - **AC-004** — Conversion preserves semantic time value during DST shifts.
        - _Measurable:_ Timestamp in UTC remains monotonically increasing; no duplicate timestamps generated for local hour skip.

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-2, US-002-C-002-C-004 · Pass: 3_

    _Decomposition rationale:_ Specific edge case within the conversion logic that requires atomic handling to prevent state inconsistency.

    _Surfaced assumptions:_ A-0258, A-0259, A-0260
#### US-002-C-003 `[Tier C · pending]`

**As a** Notification Dispatcher, **I want** Queue reminder notification 48 hours prior to execution, **so that** User receives a push/email reminder before the job runs.

**Acceptance criteria:**
  - **AC-103** — Notification triggers automatically 48h prior to next_run
    - _Measurable:_ WF-9 workflow triggers a notification event where timestamp = scheduled_job_start_time - (48 hours * 3600 seconds)

_Status: pending · Priority: high · Tier: C · Traces to: UJ-2, WF-9, ENT-NOTIFICATION · Pass: 1_

_Decomposition rationale:_ Addresses AC-004. Commits to the specific timing logic and triggers the WF-9 workflow for delivery.

_Surfaced assumptions:_ A-0003, A-0004

##### FR-REM-1.1 `[Tier C · pending]`

**As a** System, **I want** Calculate notification trigger timestamp using UTC offset logic, **so that** A valid scheduled timestamp is generated for the notification job queue.

**Acceptance criteria:**
  - **AC-REM-1.1** — Trigger timestamp is 48 hours before the next_run time in UTC.
    - _Measurable:_ trigger_timestamp === job_start_time - (48 * 3600) seconds

_Status: pending · Priority: high · Tier: C · Traces to: UJ-2, WF-9 · Pass: 2_

_Decomposition rationale:_ This child isolates the specific timing calculation logic required by AC-103. It separates the calculation from the storage or delivery, allowing the workflow engine to accept a pre-computed trigger time.

_Surfaced assumptions:_ A-0075, A-0076

  - **FR-REM-1.1.1** `[Tier D · atomic]`
    **As a** Scheduler, **I want** Apply 48-hour UTC offset delay calculation, **so that** Notification queue scheduled for exactly 48h prior to job_start_time.

    **Acceptance criteria:**
      - **AC-001** — Trigger timestamp matches calculation exactly
        - _Measurable:_ trigger_timestamp === (job_start_time - 48 * 3600)

    _Status: atomic · Priority: high · Tier: D · Traces to: WF-9 · Pass: 3_

    _Decomposition rationale:_ This child commits to the specific arithmetic formula and logic, separating this implementation choice from the workflow invocation (FR-REM-1.2) and persistence (FR-REM-1.3).

    _Surfaced assumptions:_ A-0261
##### FR-REM-1.2 `[Tier C · pending]`

**As a** System, **I want** Invoke WF-9 workflow for scheduled delivery attempt, **so that** The notification workflow instance is queued to process delivery at the calculated time.

**Acceptance criteria:**
  - **AC-REM-1.2** — WF-9 is initiated with the computed trigger time as its start time.
    - _Measurable:_ wf_instance.trigger_at === trigger_timestamp

_Status: pending · Priority: high · Tier: C · Traces to: WF-9, ENT-NOTIFICATION · Pass: 2_

_Decomposition rationale:_ This child represents the architectural choice to use the existing scheduled workflow engine (WF-9) rather than a custom polling mechanism. It commits to the use of the durable workflow engine for reliability.

_Surfaced assumptions:_ A-0075, A-0076

  - **FR-REM-1.2** `[Tier D · atomic]`
    **As a** Workflow Orchestrator, **I want** Initiate Workflow Instance WF-9 with trigger timestamp, **so that** Workflow instance created in DBOS queue with computed trigger time.

    **Acceptance criteria:**
      - **AC-001** — Workflow instance is triggered at the calculated time.
        - _Measurable:_ wf_instance.trigger_at === trigger_timestamp at the time of submission

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-9, ENT-NOTIFICATION · Pass: 3_

    _Decomposition rationale:_ This is the atomic action of invoking the workflow engine. Further decomposition would result in technical internals (e.g., HTTP request details) rather than functional scope.

    _Surfaced assumptions:_ A-0262
##### FR-REM-1.3 `[Tier D · atomic]`

**As a** System, **I want** Persist Notification Entity record for queue tracking, **so that** A row exists in the notification table with status 'scheduled' and the calculated trigger time.

**Acceptance criteria:**
  - **AC-REM-1.3** — Database contains an immutable record of the scheduled notification.
    - _Measurable:_ SELECT status, trigger_at FROM notifications WHERE job_id = ? LIMIT 1

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-NOTIFICATION · Pass: 2_

_Decomposition rationale:_ This is the atomic leaf operation that creates the state required for the queue. Once the record is persisted, no further decomposition is needed to verify the system state.

_Surfaced assumptions:_ A-0075, A-0076

#### US-002-C-004 `[Tier B · pending]`

**As a** Timezone Policy, **I want** Store schedule times in UTC, render in user local timezone, **so that** Schedule calculations are timezone-independent to prevent DST errors.

**Acceptance criteria:**
  - **AC-104** — System stores all recurring times in UTC, converts on display
    - _Measurable:_ ENT-SCHEDULE-JOB.utc_schedule_time is populated; UI converts UTC to ENT-USER.session_timezone

_Status: pending · Priority: medium · Tier: B · Traces to: ENT-USER, UJ-2 · Pass: 1_

_Decomposition rationale:_ Tier B Policy Choice. Defines a system-wide rule for how dates are stored vs. displayed. This is a 'Did we already decide X?' policy (UTC storage) rather than an implementation detail.

_Surfaced assumptions:_ A-0003, A-0004

##### FR-TZ-001 `[Tier C · pending]`

**As a** CAM operator, **I want** persist all schedule timestamps as UTC ISO 8601, **so that** No UTC offset or local time offsets are stored for recurring job times.

**Acceptance criteria:**
  - **AC-001** — Database column for job time contains only UTC offset.
    - _Measurable:_ datetime_utc field values have offset value of UTC (Z) or +00:00

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-2 · Pass: 2_

_Decomposition rationale:_ This is the foundational storage commitment; without this, rendering logic is impossible to guarantee against DST shifts.

_Surfaced assumptions:_ A-0204, A-0205

  - **FR-TZ-001-1** `[Tier C · pending]`
    **As a** Schema Architect, **I want** Define database column `schedule_time` as TIMESTAMP WITH TIME ZONE with UTC default, **so that** No non-UTC timestamps persist in the database schema.

    **Acceptance criteria:**
      - **AC-002** — Schema column type is TIMESTAMP WITH TIME ZONE.
        - _Measurable:_ SELECT pg_typeof(schedule_time) FROM schedule_jobs returns 'timestamp with time zone'

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-2 · Pass: 3_

    _Decomposition rationale:_ Committing to the specific SQL type ensures the database engine handles UTC semantics automatically, preventing application-level bugs.

    _Surfaced assumptions:_ A-0493, A-0494, A-0495
  - **FR-TZ-001-2** `[Tier C · pending]`
    **As a** API Gateway, **I want** Enforce UTC-only validation on all incoming schedule payloads, **so that** All API writes to job schedule are normalized to UTC before persistence.

    **Acceptance criteria:**
      - **AC-003** — API rejects or converts non-UTC offset strings in input.
        - _Measurable:_ API logs show no writes with offset != '00:00' after middleware transformation.

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-2 · Pass: 3_

    _Decomposition rationale:_ Input validation prevents dirty data from entering the system via human error or external API mismatches.

    _Surfaced assumptions:_ A-0493, A-0494, A-0495
  - **FR-TZ-001-3** `[Tier C · pending]`
    **As a** Data Migration, **I want** Execute one-time migration of existing records to UTC offset, **so that** Existing legacy records are converted to UTC before schema change.

    **Acceptance criteria:**
      - **AC-004** — Post-migration check confirms all rows have UTC offset.
        - _Measurable:_ SELECT COUNT(*) FROM schedule_jobs WHERE pg_timezone_name(schedule_time) IS NOT NULL AND zone != 'UTC' equals 0.

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-2 · Pass: 3_

    _Decomposition rationale:_ Handles the scope of the requirement to cover all schedule timestamps, ensuring clean history for the system lifecycle.

    _Surfaced assumptions:_ A-0493, A-0494, A-0495
##### FR-TZ-002 `[Tier C · pending]`

**As a** CAM operator, **I want** convert UTC timestamps to local time for UI rendering, **so that** UI displays time adjusted for the user's current session timezone.

**Acceptance criteria:**
  - **AC-002** — API response includes time formatted for session timezone.
    - _Measurable:_ datetime_display value equals datetime_utc + user_timezone_offset

_Status: pending · Priority: high · Tier: C · Traces to: UJ-2, ENT-USER · Pass: 2_

_Decomposition rationale:_ This is the consumer-facing behavior that prevents confusion for the homeowner; binds the storage policy to the presentation layer.

_Surfaced assumptions:_ A-0204, A-0205

  - **FR-TZ-002-C1** `[Tier D · atomic]`
    **As a** API Endpoint, **I want** Extract timezone string from user session state, **so that** session.timezone value is available for conversion.

    **Acceptance criteria:**
      - **AC-002-1** — System retrieves timezone string from ENT-SESSION object.
        - _Measurable:_ session.timezone field exists in ENT-SESSION state or returns a default value

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-SESSION, UJ-2 · Pass: 3_

    _Decomposition rationale:_ Retrieving the user's session timezone is the prerequisite for any time conversion; this is the first atomic action.

    _Surfaced assumptions:_ A-0496, A-0497, A-0498
  - **FR-TZ-002-C2** `[Tier D · atomic]`
    **As a** Backend Logic, **I want** Convert UTC timestamp to local datetime, **so that** Local datetime value is computed using session offset.

    **Acceptance criteria:**
      - **AC-002-2** — Output datetime equals UTC timestamp plus session offset.
        - _Measurable:_ datetime_display === datetime_utc + session.timezone_offset

    _Status: atomic · Priority: critical · Tier: D · Traces to: FR-TZ-001, FR-TZ-002 · Pass: 3_

    _Decomposition rationale:_ This performs the core transformation satisfying the parent's acceptance criteria; it relies on FR-TZ-001 for UTC input format.

    _Surfaced assumptions:_ A-0496, A-0497, A-0498
  - **FR-TZ-002-C3** `[Tier D · atomic]`
    **As a** Frontend Renderer, **I want** Format datetime for UI display, **so that** UI receives a human-readable string.

    **Acceptance criteria:**
      - **AC-002-3** — UI receives string formatted per session preference.
        - _Measurable:_ datetime_display matches UI standard format (e.g. 'MM/DD/YYYY h:mm a')

    _Status: atomic · Priority: medium · Tier: D · Traces to: ENT-USER, FR-TZ-002 · Pass: 3_

    _Decomposition rationale:_ Ensures the final output matches the UI rendering requirement; relies on ENT-USER for format context.

    _Surfaced assumptions:_ A-0496, A-0497, A-0498
##### FR-TZ-003 `[Tier C · pending]`

**As a** CAM operator, **I want** store user preference timezone as IANA string, **so that** System resolves local time using IANA rules, not static offsets.

**Acceptance criteria:**
  - **AC-003** — Session profile stores timezone name (e.g., America/New_York) not offset.
    - _Measurable:_ session_timezone field contains valid IANA timezone string in the IANA database

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-USER, ENT-SESSION · Pass: 2_

_Decomposition rationale:_ Using an IANA string prevents DST errors; a static offset would break during transitions.

_Surfaced assumptions:_ A-0204, A-0205

  - **FR-TZ-003-C01** `[Tier C · pending]`
    **As a** Backend Service, **I want** Validate timezone string against IANA database on write, **so that** Only valid IANA strings are persisted to the session profile.

    **Acceptance criteria:**
      - **AC-C01** — Invalid timezone strings are rejected on save.
        - _Measurable:_ API returns 400 error if string not found in IANA DB

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-USER, ENT-SESSION · Pass: 3_

    _Decomposition rationale:_ Ensures data integrity and prevents schema pollution with invalid formats; concrete verification step under the IANA strategy.

    _Surfaced assumptions:_ A-0499, A-0500
  - **FR-TZ-003-C02** `[Tier C · pending]`
    **As a** User Experience Logic, **I want** Default to device timezone when user profile is null, **so that** User session loads local device time if no preference set.

    **Acceptance criteria:**
      - **AC-C02** — System fetches device timezone on initial load.
        - _Measurable:_ Session timezone equals device reported offset on first request if profile is empty

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-USER · Pass: 3_

    _Decomposition rationale:_ Handles the missing state edge case without requiring manual setup for every new user.

    _Surfaced assumptions:_ A-0499, A-0500
  - **FR-TZ-003-C03** `[Tier C · pending]`
    **As a** Data Consistency Engine, **I want** Ensure user preference overrides inferred location, **so that** Stored preference takes precedence over device inference for scheduling.

    **Acceptance criteria:**
      - **AC-C03** — Saved preference is used for calculation even if device timezone differs.
        - _Measurable:_ Calculated job time uses stored preference, not GPS-derived timezone

    _Status: pending · Priority: medium · Tier: C · Traces to: FR-TZ-001, FR-TZ-002, ENT-SESSION · Pass: 3_

    _Decomposition rationale:_ Resolves the conflict between inferred location and explicit user preference; maintains consistency with sibling FR-TZ-001 (UTC persistence).

    _Surfaced assumptions:_ A-0499, A-0500
  - **FR-TZ-003-C04** `[Tier D · atomic]`
    **As a** Data Store, **I want** Persist timezone preference in session profile, **so that** User timezone preference is stored as VARCHAR.

    **Acceptance criteria:**
      - **AC-C04** — Session profile table contains timezone column.
        - _Measurable:_ Database column 'timezone' exists with length >= 50

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-USER · Pass: 3_

    _Decomposition rationale:_ Atomic database action that realizes the storage commitment; terminal node.

    _Surfaced assumptions:_ A-0499, A-0500
##### FR-TZ-004 `[Tier C · pending]`

**As a** CAM operator, **I want** handle DST transitions in calculation logic, **so that** Schedule logic accounts for offset changes without data corruption.

**Acceptance criteria:**
  - **AC-004** — System recalculates offsets when crossing DST boundaries.
    - _Measurable:_ datetime_utc remains constant, datetime_display shifts by +1 or -1 hour on DST transition

_Status: pending · Priority: high · Tier: C · Traces to: UJ-2 · Pass: 2_

_Decomposition rationale:_ Specific logic commitment derived from the storage policy to ensure correctness during daylight saving transitions.

_Surfaced assumptions:_ A-0204, A-0205

  - **FR-TZ-004.1** `[Tier B · pending]`
    **As a** Scope, **I want** Mandate DST transition handling as a required architectural constraint for all scheduling workflows., **so that** All schedule logic incorporates boundary awareness without exception.

    **Acceptance criteria:**
      - **AC-004.1** — All schedule configuration logic includes DST transition handling capabilities.
        - _Measurable:_ Any recurring job configuration includes a flag for DST transition handling

    _Status: pending · Priority: high · Tier: B · Traces to: UJ-2 · Pass: 3_

    _Decomposition rationale:_ Defines the boundary of the problem: DST handling must apply to all scheduling, not just specific edge cases. This is a scope/policy commitment (Tier B).
  - **FR-TZ-004.2** `[Tier C · pending]`
    **As a** System, **I want** Detect DST boundary crossings by comparing stored UTC datetime against IANA offset rules., **so that** System identifies the exact moment an event crosses a DST boundary.

    **Acceptance criteria:**
      - **AC-004.2** — System detects offset change event using IANA rules.
        - _Measurable:_ Event detection triggers when stored UTC differs from displayed local time by +1/-1 hour

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-2 · Pass: 3_

    _Decomposition rationale:_ Implementation commitment (Tier C) defining how the boundary crossing is detected. Relies on existing IANA assumption.
  - **FR-TZ-004.3** `[Tier C · pending]`
    **As a** System, **I want** Adjust display time by calculating `datetime_display` = `datetime_utc` + `current_local_offset`., **so that** UI shows correct local time with shifted offset.

    **Acceptance criteria:**
      - **AC-004.3** — Display offset matches user's IANA timezone rules.
        - _Measurable:_ Rendered time equals UTC plus the IANA offset at the time of display

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-13, FR-TZ-002 · Pass: 3_

    _Decomposition rationale:_ Implementation commitment (Tier C) detailing how the display shift is computed. Traces to UI rendering sibling (FR-TZ-002).
  - **FR-TZ-004.4** `[Tier D · atomic]`
    **As a** System, **I want** Verify job execution frequency matches schedule on transition dates (once per day)., **so that** No duplicate or missed executions due to hour gap.

    **Acceptance criteria:**
      - **AC-004.4** — Recurring job triggers exactly once per calendar day on transition.
        - _Measurable:_ Execution count for a day equals 1 regardless of offset change direction

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-4 · Pass: 3_

    _Decomposition rationale:_ Atomic verification (Tier D) ensuring the leaf operation (job execution) works correctly under the boundary condition. Field execution (UJ-4) is impacted.
#### US-002-C-005 `[Tier D · atomic]`

**As a** Cancel Recurring Job, **I want** Delete or disable active recurring job record, **so that** User can stop the recurring task immediately.

**Acceptance criteria:**
  - **AC-105** — Job is stopped and no new instances created after cancellation
    - _Measurable:_ Deleting ENT-SCHEDULE-JOB row removes it from WF-9 notification trigger list immediately

_Status: atomic · Priority: low · Tier: D · Traces to: ENT-SCHEDULE-JOB, UJ-2 · Pass: 1_

_Decomposition rationale:_ Atomic action (Leaf). While not in the original ACs, a recurring task must have a termination action. This is testable independently of the creation logic.

_Surfaced assumptions:_ A-0003, A-0004

### FR US-003 `[pending]`

**As a** Homeowner, **I want** View property asset history and warranty info, **so that** Homeowner retrieves accurate information for recent or potential Service Calls.

**Acceptance criteria:**
  - **AC-005** — Asset data current
    - _Measurable:_ GET /properties/{id} returns ENT-PROPERTY-ASSET and ENT-WARRANTY records with version less than 1 hour old

_Status: pending · Priority: critical · Traces to: UJ-3, ENT-PROPERTY-ASSET, ENT-WARRANTY, WF-7 · Pass: 0_

#### US-003-C-001 `[Tier B · pending]`

**As a** Policy Architect, **I want** Enforce asset data freshness SLA, **so that** All returned records satisfy the less-than-1-hour-old constraint.

**Acceptance criteria:**
  - **AC-1** — Returned records timestamp is within 1 hour of current system time
    - _Measurable:_ record.timestamp >= now() - 1 hour

_Status: pending · Priority: high · Tier: B · Traces to: UJ-3, WF-7 · Pass: 1_

_Decomposition rationale:_ Data freshness is a governing rule (Tier B) that dictates how the system retrieves and serves data, rather than a simple implementation detail.

_Surfaced assumptions:_ A-0005, A-0006

##### US-003-C-001.1 `[Tier C · pending]`

**As a** Backend Developer, **I want** Implement database query filter to exclude stale records, **so that** No record older than 1 hour is returned in response payload.

**Acceptance criteria:**
  - **AC-001** — Query execution enforces timestamp >= (now() - 1 hour)
    - _Measurable:_ SELECT count(*) FROM asset_records WHERE timestamp < (NOW() - INTERVAL '1 hour') AND tenant_id = ? AND tenant_isolation_enabled = true returns 0 for every valid query response

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-3, WF-7 · Pass: 2_

_Decomposition rationale:_ This binds the data retrieval layer directly to the freshness constraint, ruling out caching of stale assets without TTL checks.

_Surfaced assumptions:_ A-0206, A-0207, A-0208

  - **FR-AC-001.1-1** `[Tier D · atomic]`
    **As a** Backend developer, **I want** Construct SQL WHERE clause for timestamp freshness, **so that** Query returns only records meeting timestamp >= (now() - 1 hour).

    **Acceptance criteria:**
      - **AC-001.1** — Filter predicate is appended to all asset read queries
        - _Measurable:_ sql_query_text includes 'WHERE timestamp >= (NOW() - INTERVAL \'1 hour\')'

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-3, WF-7 · Pass: 3_

    _Decomposition rationale:_ The freshness predicate is the primary mechanism to satisfy the parent's '1 hour' constraint; decomposed to its atomic SQL implementation step.

    _Surfaced assumptions:_ A-0501, A-0502, A-0503
  - **FR-AC-001.1-2** `[Tier D · atomic]`
    **As a** Backend developer, **I want** Enforce tenant isolation within the same query scope, **so that** Query returns zero rows for requests with mismatched tenant_id.

    **Acceptance criteria:**
      - **AC-001.2** — Tenant isolation check occurs concurrently with freshness filter
        - _Measurable:_ sql_query_text includes 'AND tenant_id = ? AND tenant_isolation_enabled = true'

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-12, UJ-11 · Pass: 3_

    _Decomposition rationale:_ Tenant isolation is a required component of the parent's AC (`tenant_id = ?`); this child commits to the specific implementation of that condition.

    _Surfaced assumptions:_ A-0501, A-0502, A-0503
  - **FR-AC-001.1-3** `[Tier D · atomic]`
    **As a** Backend developer, **I want** Align database NOW() function with UTC timezone, **so that** Timestamp calculation yields consistent UTC-based freshness threshold.

    **Acceptance criteria:**
      - **AC-001.3** — Timestamp comparison treats stored timestamps and system time as UTC
        - _Measurable:_ timestamp_column_definition.timezone === 'UTC'

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-3, WF-10 · Pass: 3_

    _Decomposition rationale:_ Freshness calculation depends on time consistency; decomposed to ensure the schema and query functions align to prevent timezone skew errors.

    _Surfaced assumptions:_ A-0501, A-0502, A-0503
##### US-003-C-001.2 `[Tier C · pending]`

**As a** Data Architect, **I want** Configure replication cadence and source freshness SLA, **so that** Asset data in storage layer is refreshed within 15 minutes of source event.

**Acceptance criteria:**
  - **AC-002** — Ingestion pipeline refreshes asset state within 15 minutes of external trigger
    - _Measurable:_ Timestamp difference between external source event and internal record update <= 15 minutes at 99.9% confidence

_Status: pending · Priority: high · Tier: C · Traces to: WF-11, UJ-3 · Pass: 2_

_Decomposition rationale:_ Ensures the write path supports the read path requirement by guaranteeing data origin freshness before it hits the read layer.

_Surfaced assumptions:_ A-0206, A-0207, A-0208

  - **US-003-C-001.2.1** `[Tier C · pending]`
    **As a** Ingestion Handler, **I want** Enqueue ingestion job on external event or poll interval, **so that** External trigger or poll event is queued for processing within 1 second.

    **Acceptance criteria:**
      - **AC-201** — Job enqueued immediately after source event
        - _Measurable:_ timestamp(job_queue_event) - timestamp(source_event) <= 1 second

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-11, US-003-C-001.1 · Pass: 3_

    _Decomposition rationale:_ This child defines the trigger mechanism for the replication pipeline, binding the external source event to the internal workflow.

    _Surfaced assumptions:_ A-0504, A-0505, A-0506
  - **US-003-C-001.2.2** `[Tier D · atomic]`
    **As a** Freshness Validator, **I want** Calculate timestamp delta at commit time, **so that** Record update confirms freshness SLA met.

    **Acceptance criteria:**
      - **AC-202** — Delta between source and internal timestamp is within SLA
        - _Measurable:_ timestamp(internal_update) - timestamp(source_event) <= 15 minutes

    _Status: atomic · Priority: high · Tier: D · Traces to: WF-11, UJ-3 · Pass: 3_

    _Decomposition rationale:_ This child defines the atomic verification of the core SLA, reducing to a single arithmetic comparison.

    _Surfaced assumptions:_ A-0504, A-0505, A-0506
  - **US-003-C-001.2.3** `[Tier C · pending]`
    **As a** SLA Breach Reporter, **I want** Log and alert on SLA violation, **so that** DevOps notified if SLA missed at 99.9% confidence.

    **Acceptance criteria:**
      - **AC-203** — Alert triggered when confidence interval falls below threshold
        - _Measurable:_ confidence_interval < 99.9% triggers alert within 1 minute

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-3, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ This child handles the failure path, committing to notification behavior when the primary SLA is not met.

    _Surfaced assumptions:_ A-0504, A-0505, A-0506
  - **US-003-C-001.2.4** `[Tier C · pending]`
    **As a** Cadence Configurator, **I want** Store replication cadence settings in config store, **so that** Admin can modify cadence without code deploy.

    **Acceptance criteria:**
      - **AC-204** — Settings persisted and loaded by next cycle
        - _Measurable:_ settings.read() matches settings.write() after commit

    _Status: pending · Priority: medium · Tier: C · Traces to: WF-11 · Pass: 3_

    _Decomposition rationale:_ This child defines the configuration capability, allowing operational tuning of the replication strategy.

    _Surfaced assumptions:_ A-0504, A-0505, A-0506
##### US-003-C-001.3 `[Tier D · atomic]`

**As a** Test Engineer, **I want** Validate record timestamp against current system time on response, **so that** API Gateway response includes timestamp verification assertion.

**Acceptance criteria:**
  - **AC-003** — Response validation confirms record timestamp meets freshness threshold
    - _Measurable:_ JSON response.payload[assetId].timestamp >= (currentTime() - 1 hour) returns true

_Status: atomic · Priority: critical · Tier: D · Traces to: AC-1, UJ-3 · Pass: 2_

_Decomposition rationale:_ This is the terminal verification step ensuring the SLA is met at the edge of the user's interaction, allowing for auditability of freshness compliance.

_Surfaced assumptions:_ A-0206, A-0207, A-0208

#### US-003-C-002 `[Tier C · pending]`

**As a** API Developer, **I want** Return property asset record schema, **so that** JSON response contains asset identifiers and metadata.

**Acceptance criteria:**
  - **AC-2** — Response body includes 'id', 'status', and 'purchaseDate' fields
    - _Measurable:_ json.path($.id) && json.path($.status) && json.path($.purchaseDate)

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-PROPERTY-ASSET, UJ-3 · Pass: 1_

_Decomposition rationale:_ This commits to the specific data structure returned by the asset view operation, a concrete technical decision.

_Surfaced assumptions:_ A-0005, A-0006

##### FR-003-C-002-01 `[Tier C · pending]`

**As a** API Contract Engineer, **I want** Define 'id' field generation and format within the JSON response, **so that** Every asset record returned includes a unique identifier following the tenant-scoped UUID v4 strategy.

**Acceptance criteria:**
  - **AC-001** — The response body 'id' is a string matching UUID v4 format.
    - _Measurable:_ json.path($.id).match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) === true

_Status: pending · Priority: high · Tier: C · Traces to: ENT-PROPERTY-ASSET, TECH-8 · Pass: 2_

_Decomposition rationale:_ Defines the specific engineering sub-strategy for the identifier field, committing to UUID v4 and tenant scoping to align with isolation constraints.

_Surfaced assumptions:_ A-0077, A-0078, A-0079, A-0080

  - **FR-003-C-002-01-01** `[Tier C · pending]`
    **As a** CAM operator, **I want** Generate cryptographically secure UUID v4 for new asset records, **so that** Every new asset record receives a valid UUID v4 string immediately upon creation.

    **Acceptance criteria:**
      - **AC-001-1** — ID string matches UUID v4 regex pattern.
        - _Measurable:_ id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) === true for every created record

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-8 · Pass: 3_

    _Decomposition rationale:_ The core mechanism for uniqueness and format compliance is the generation algorithm. We commit to using the standard UUID v4 generator provided by oRPC to ensure entropy and format compliance.

    _Surfaced assumptions:_ A-0263, A-0264, A-0265
  - **FR-003-C-002-01-02** `[Tier C · pending]`
    **As a** CAM operator, **I want** Enforce tenant-scoped uniqueness during ID generation, **so that** IDs generated for different tenants remain distinct even if UUID collision occurs globally.

    **Acceptance criteria:**
      - **AC-001-2** — Tenant ID is incorporated or namespace logic is applied to prevent cross-tenant collision.
        - _Measurable:_ asset.id.namespace === request.tenant.id OR asset.id.collisions_within_tenant === 0

    _Status: pending · Priority: critical · Tier: C · Traces to: A-0077, ENT-TENANT · Pass: 3_

    _Decomposition rationale:_ The 'tenant-scoped' constraint requires specific handling to ensure isolation. Since A-0077 defines the policy of scoping, this child commits to the specific implementation strategy (e.g., prefixing or database namespace) ensuring the constraint holds.

    _Surfaced assumptions:_ A-0263, A-0264, A-0265
  - **FR-003-C-002-01-03** `[Tier C · pending]`
    **As a** CAM operator, **I want** Serialize ID field as a string in JSON response, **so that** The 'id' field in the API response is a JSON string, not a number or binary blob.

    **Acceptance criteria:**
      - **AC-001-3** — Response body 'id' is a string type in JSON.
        - _Measurable:_ typeof response.id === 'string' in the serialized JSON output

    _Status: pending · Priority: high · Tier: C · Traces to: FR-003-C-002-02 · Pass: 3_

    _Decomposition rationale:_ Serialization must strictly follow the response contract. This child binds the format of the ID to the JSON serialization layer defined in the API Gateway connection (oRPC).

    _Surfaced assumptions:_ A-0263, A-0264, A-0265
##### FR-003-C-002-02 `[Tier C · pending]`

**As a** API Contract Engineer, **I want** Define 'status' field enum values and lifecycle states, **so that** The 'status' field is restricted to values derived from the Asset Lifecycle States schema.

**Acceptance criteria:**
  - **AC-002** — The 'status' string must be one of the defined lifecycle states (e.g., 'PENDING', 'INSTALLED', 'DECOMMISSIONED').
    - _Measurable:_ json.path($.status).exists() === true && json.path($.status).in(['PENDING', 'ACTIVE', 'DECOMMISSIONED']) === true

_Status: pending · Priority: high · Tier: C · Traces to: ENT-PROPERTY-ASSET, UJ-3 · Pass: 2_

_Decomposition rationale:_ Commits to using a specific set of values that represent the current lifecycle state, ensuring consistency with the entity lifecycle workflow.

_Surfaced assumptions:_ A-0077, A-0078, A-0079, A-0080

  - **FR-003-C-002-02.1** `[Tier C · pending]`
    **As a** API Validator, **I want** Enforce strict input validation against canonical lifecycle states, **so that** Invalid status strings are rejected at the API boundary.

    **Acceptance criteria:**
      - **AC-002-1** — API returns 400 Bad Request for invalid status.
        - _Measurable:_ status in request NOT IN ['PENDING', 'INSTALLED', 'DECOMMISSIONED'] -> HTTP 400

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-3, ENT-PROPERTY-ASSET · Pass: 3_

    _Decomposition rationale:_ Enforcement logic is the primary consumer of the enum definition; must be defined as an implementation commitment to ensure API safety.

    _Surfaced assumptions:_ A-0266
  - **FR-003-C-002-02.2** `[Tier C · pending]`
    **As a** Serialization Handler, **I want** Normalize output status to canonical casing, **so that** All API responses use the canonical case from the lifecycle registry.

    **Acceptance criteria:**
      - **AC-002-2** — Output status string matches registry casing.
        - _Measurable:_ json.path($.status) === canonical_registry_value[status] for all responses

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-3, ENT-PROPERTY-ASSET · Pass: 3_

    _Decomposition rationale:_ Serialization ensures consistency in consumer integration; requires separate commitment from validation logic to handle internal state representation.

    _Surfaced assumptions:_ A-0266
  - **FR-003-C-002-02.3** `[Tier C · pending]`
    **As a** Audit Service, **I want** Log status state transitions in audit trail, **so that** Every status change is recorded immutably for compliance.

    **Acceptance criteria:**
      - **AC-002-3** — Status transition event written to immutable log.
        - _Measurable:_ COUNT(audit_entries WHERE asset_id = X AND action = 'status_change') > 0 ON transition

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-3, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Lifecycle management implies state changes; these must be audited for compliance and troubleshooting, constituting a concrete system behavior.

    _Surfaced assumptions:_ A-0266
##### FR-003-C-002-03 `[Tier C · pending]`

**As a** API Contract Engineer, **I want** Define 'purchaseDate' string format and timezone reference, **so that** The 'purchaseDate' field is a string formatted as ISO-8601 UTC timestamp.

**Acceptance criteria:**
  - **AC-003** — The 'purchaseDate' matches ISO-8601 date-time format in UTC.
    - _Measurable:_ json.path($.purchaseDate).match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/) === true

_Status: pending · Priority: medium · Tier: C · Traces to: ENT-PROPERTY-ASSET, UJ-3 · Pass: 2_

_Decomposition rationale:_ Commits to a specific serialization format to prevent timezone ambiguity in cross-region deployments.

_Surfaced assumptions:_ A-0077, A-0078, A-0079, A-0080

  - **FR-003-C-002-03.1** `[Tier C · pending]`
    **As a** Input Validation, **I want** Enforce strict ISO-8601 UTC ('Z') regex validation on incoming 'purchaseDate' payloads, **so that** API returns 400 Bad Request for payloads not matching the Z-suffix pattern.

    **Acceptance criteria:**
      - **AC-101** — Incoming 'purchaseDate' string matches regex.
        - _Measurable:_ payload.purchaseDate.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/) === true

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-3, ENT-PROPERTY-ASSET · Pass: 3_

    _Decomposition rationale:_ Input validation is a necessary implementation choice to ensure schema integrity and data consistency for asset history (UJ-3) before normalization.

    _Surfaced assumptions:_ A-0267
  - **FR-003-C-002-03.2** `[Tier C · pending]`
    **As a** Serialization Strategy, **I want** Serialize 'purchaseDate' to string using UTC offset 'Z' in all API responses, **so that** JSON response property always ends with 'Z' indicating UTC.

    **Acceptance criteria:**
      - **AC-102** — API response 'purchaseDate' ends with 'Z'.
        - _Measurable:_ json.response.purchaseDate.endsWith('Z')

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-3, ENT-PROPERTY-ASSET · Pass: 3_

    _Decomposition rationale:_ Serialization format must be committed to ensure downstream consumers (UJ-3) parse dates correctly for history views and sorting.

    _Surfaced assumptions:_ A-0267
  - **FR-003-C-002-03.3** `[Tier C · pending]`
    **As a** Storage Representation, **I want** Persist 'purchaseDate' internally as Postgres TIMESTAMPTZ in UTC timezone, **so that** Database stores timestamps normalized to UTC without local timezone offsets.

    **Acceptance criteria:**
      - **AC-103** — Database column stores UTC time.
        - _Measurable:_ SELECT pg_timezone(asset.purchase_date) = 'UTC'

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-3, ENT-PROPERTY-ASSET · Pass: 3_

    _Decomposition rationale:_ Internal storage must be UTC to support the serialization commitment and prevent DST ambiguity for asset history (UJ-3).

    _Surfaced assumptions:_ A-0267
##### FR-003-C-002-04 `[Tier C · pending]`

**As a** API Contract Engineer, **I want** Limit response metadata fields to non-sensitive attributes only, **so that** Metadata includes only 'assetName' and 'assetType', excluding internal IDs or owner details unless permissioned.

**Acceptance criteria:**
  - **AC-004** — Response payload does not contain fields outside of 'id', 'status', 'purchaseDate', 'assetName', 'assetType'.
    - _Measurable:_ json.path($.assetName).exists() === false || json.path($.assetType).exists() === false || json.path($.metadata).contains('internalId') === false

_Status: pending · Priority: medium · Tier: C · Traces to: US-003-C-004, ENT-PROPERTY-ASSET · Pass: 2_

_Decomposition rationale:_ Commits to scope boundaries for data exposure, ensuring no PII or internal IDs leak in standard responses.

_Surfaced assumptions:_ A-0077, A-0078, A-0079, A-0080

  - **FR-003-C-002-04-01** `[Tier C · pending]`
    **As a** CAM operator, **I want** Expose canonical asset metadata fields only, **so that** Payload includes assetName and assetType while omitting legacy internal identifiers.

    **Acceptance criteria:**
      - **AC-004.1** — Response contains only defined metadata fields.
        - _Measurable:_ json.path($.assetName).exists() && json.path($.assetType).exists() && !json.path($.metadata.internalId).exists() for standard user roles

    _Status: pending · Priority: high · Tier: C · Traces to: FR-003-C-002-04, FR-003-C-002-01, FR-003-C-002-02, FR-003-C-002-03 · Pass: 3_

    _Decomposition rationale:_ Binds the specific fields listed in the parent and leverages sibling definitions for id, status, and purchaseDate.

    _Surfaced assumptions:_ A-0268, A-0269, A-0270
  - **FR-003-C-002-04-02** `[Tier C · pending]`
    **As a** Security Engineer, **I want** Apply default redaction to owner-sensitive data, **so that** Internal IDs and owner details are not serialized unless explicitly permitted.

    **Acceptance criteria:**
      - **AC-004.2** — Sensitive fields are omitted from public payloads.
        - _Measurable:_ !json.path($.metadata.ownerId).exists() && !json.path($.metadata.internalId).exists()

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-003-C-002-04, ENT-PROPERTY-ASSET, ENT-USER · Pass: 3_

    _Decomposition rationale:_ Defines the specific sensitive fields and the baseline redaction logic enforced by default.

    _Surfaced assumptions:_ A-0268, A-0269, A-0270
  - **FR-003-C-002-04-03** `[Tier C · pending]`
    **As a** Authorization Engine, **I want** Evaluate RBAC permissions for metadata exposure, **so that** Conditional exposure of internal metadata when permissioned access is granted.

    **Acceptance criteria:**
      - **AC-004.3** — Internal metadata is exposed only to authorized roles.
        - _Measurable:_ if (hasPermission('asset.metadata.view')) then json.path($.metadata.internalId).exists() else !json.path($.metadata.internalId).exists()

    _Status: pending · Priority: high · Tier: C · Traces to: FR-003-C-002-04, ENT-PERMISSION-MAPPING, ENT-SESSION · Pass: 3_

    _Decomposition rationale:_ Addresses the 'unless permissioned' clause by committing to the specific authorization check mechanism.

    _Surfaced assumptions:_ A-0268, A-0269, A-0270
#### US-003-C-003 `[Tier C · pending]`

**As a** API Developer, **I want** Return warranty record schema, **so that** JSON response includes warranty coverage details.

**Acceptance criteria:**
  - **AC-3** — Response body includes 'provider', 'startDate', and 'endDate' fields
    - _Measurable:_ json.path($.provider) && json.path($.startDate) && json.path($.endDate)

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-WARRANTY, UJ-3 · Pass: 1_

_Decomposition rationale:_ This commits to the specific data structure returned by the warranty view operation, ensuring consistency with the warranty entity definition.

_Surfaced assumptions:_ A-0005, A-0006

##### US-003-C-003.1 `[Tier C · pending]`

**As a** API Developer, **I want** Map provider reference to response, **so that** Response includes non-null provider identifier.

**Acceptance criteria:**
  - **AC-3.1** — Provider field is present in the JSON payload.
    - _Measurable:_ json.path(\$.provider) returns a valid object ID referencing ENT-PROVIDER

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-PROVIDER, ENT-WARRANTY · Pass: 2_

_Decomposition rationale:_ The provider field is a distinct entity mapping that requires a specific integration commitment to resolve the provider identity from the warranty record.

_Surfaced assumptions:_ A-0081

  - **US-003-C-003.1-1** `[Tier C · pending]`
    **As a** API Schema Architect, **I want** Commit to include 'provider' field in the response JSON payload, **so that** API response contains the provider field key for every request mapping to a provider.

    **Acceptance criteria:**
      - **AC-1.1** — Response payload includes the 'provider' field.
        - _Measurable:_ response.provider !== undefined in the serialized JSON object

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-PROVIDER, US-003-C-003.3 · Pass: 3_

    _Decomposition rationale:_ This child isolates the structural decision to define the response schema, binding the requirement to the API contract and sibling schema integrity work.

    _Surfaced assumptions:_ A-0271, A-0272
  - **US-003-C-003.1-2** `[Tier C · pending]`
    **As a** Data Resolution Logic, **I want** Commit to resolve request context to a valid ENT-PROVIDER ID, **so that** Returned provider value references an active record in the provider registry.

    **Acceptance criteria:**
      - **AC-1.2** — Value of response.provider.id references an existing ENT-PROVIDER.
        - _Measurable:_ exists(entity in ENT-PROVIDER where entity.id == response.provider.id)

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-WARRANTY, ENT-PROVIDER · Pass: 3_

    _Decomposition rationale:_ This child isolates the data transformation logic required to ensure the ID resolves correctly, accounting for warranty-linked contexts.

    _Surfaced assumptions:_ A-0271, A-0272
##### US-003-C-003.2 `[Tier C · pending]`

**As a** API Developer, **I want** Map warranty date fields, **so that** Response includes valid start and end dates.

**Acceptance criteria:**
  - **AC-3.2** — Start and end date fields are present in the JSON payload.
    - _Measurable:_ json.path(\$.startDate) and json.path(\$.endDate) exist and contain ISO-8601 formatted strings

_Status: pending · Priority: high · Tier: C · Traces to: ENT-WARRANTY, UJ-3 · Pass: 2_

_Decomposition rationale:_ Warranty coverage periods are derived from the asset maintenance history entity; mapping them to the response is a specific implementation choice.

_Surfaced assumptions:_ A-0081

##### US-003-C-003.3 `[Tier C · pending]`

**As a** API Developer, **I want** Validate response schema integrity, **so that** Response adheres to warranty schema contract.

**Acceptance criteria:**
  - **AC-3.3** — No unexpected fields exist in the warranty response payload.
    - _Measurable:_ json.path(\$.*) === defined schema properties for warranty endpoint

_Status: pending · Priority: high · Tier: C · Traces to: UJ-3 · Pass: 2_

_Decomposition rationale:_ Schema integrity ensures the response matches the commitment made in the parent requirement without leaking unrelated data.

_Surfaced assumptions:_ A-0081

  - **US-003-C-003.3.1** `[Tier D · atomic]`
    **As a** validation_engine, **I want** emit error if response payload contains keys not present in the schema definition, **so that** Response is rejected by the API gateway or application layer if it contains unexpected fields.

    **Acceptance criteria:**
      - **AC-3.3.1** — Response object keys must be a subset of schema keys.
        - _Measurable:_ response.keys().isSubset(schema.properties.keys()) for every outgoing warranty response

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-3 · Pass: 3_

    _Decomposition rationale:_ Directly maps to the specific AC 'No unexpected fields exist' by implementing the atomic check against the schema definition at the serialization boundary.

    _Surfaced assumptions:_ A-0273, A-0274
  - **US-003-C-003.3.2** `[Tier D · atomic]`
    **As a** validation_engine, **I want** emit error if response payload omits required schema properties, **so that** Response is rejected if schema requires a field that is missing from the JSON output.

    **Acceptance criteria:**
      - **AC-3.3.2** — All schema properties marked 'required' must exist in the response.
        - _Measurable:_ schema.properties.required.every(f => response[f] !== undefined) for every outgoing warranty response

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-3 · Pass: 3_

    _Decomposition rationale:_ Expands the 'schema integrity' scope to include completeness checks, ensuring the response is not only clean but also fully populated according to the warranty contract.

    _Surfaced assumptions:_ A-0273, A-0274
  - **US-003-C-003.3.3** `[Tier D · atomic]`
    **As a** serialization_layer, **I want** strip any properties from the response object that are not defined in the schema, **so that** The response payload is mutated to remove unexpected fields before transmission.

    **Acceptance criteria:**
      - **AC-3.3.3** — Outgoing JSON excludes keys not defined in the schema.
        - _Measurable:_ JSON.stringify(response).keys().every(k => k in schema.properties) for every outgoing warranty response

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-3 · Pass: 3_

    _Decomposition rationale:_ Implements the enforcement by sanitizing the payload actively, preventing leakage of implementation details or debug data into the warranty contract.

    _Surfaced assumptions:_ A-0273, A-0274
#### US-003-C-004 `[Tier C · pending]`

**As a** Security Engineer, **I want** Validate user permission for viewing, **so that** Request is denied if user lacks 'VIEW_ASSET' role.

**Acceptance criteria:**
  - **AC-4** — 403 Forbidden returned if role not authorized
    - _Measurable:_ status_code === 403 && role_check_failed === true

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-3, ENT-USER, ENT-ROLE · Pass: 1_

_Decomposition rationale:_ This is an implementation commitment regarding authorization logic required to secure the view operation.

_Surfaced assumptions:_ A-0005, A-0006

##### US-003-C-004-1 `[Tier C · pending]`

**As a** Session Validator, **I want** Verify session validity against ENT-SESSION, **so that** Proceed to role check only if session is active and valid.

**Acceptance criteria:**
  - **AC-001** — Session token is valid and not expired.
    - _Measurable:_ session_expires_at > now && session_is_valid === true

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-SESSION, UJ-3, TECH-10 · Pass: 2_

_Decomposition rationale:_ Role checks are meaningless without a valid authentication context; this is a prerequisite implementation check before policy evaluation.

_Surfaced assumptions:_ A-0082, A-0083

  - **US-003-C-004-1.1** `[Tier C · pending]`
    **As a** Implementation Commitment, **I want** Validate session token expiration timestamp against current server time, **so that** Request proceeds only if token expiration time is greater than current UTC time.

    **Acceptance criteria:**
      - **AC-002** — Token expiration check returns true
        - _Measurable:_ session_expires_at > now && session_is_valid === true

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-SESSION, US-003-C-004-2 · Pass: 3_

    _Decomposition rationale:_ Expiration is the primary temporal constraint for session lifecycle; isolates this check from cryptographic integrity.

    _Surfaced assumptions:_ A-0275
  - **US-003-C-004-1.2** `[Tier C · pending]`
    **As a** Implementation Commitment, **I want** Verify cryptographic integrity of session token signature, **so that** Request proceeds only if token signature validates against public key.

    **Acceptance criteria:**
      - **AC-003** — Signature verification succeeds
        - _Measurable:_ crypto.verify_signature(token, payload) === true

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-10 · Pass: 3_

    _Decomposition rationale:_ Integrity check is distinct from validity check; relies on Better-Auth key management implementation.

    _Surfaced assumptions:_ A-0275
  - **US-003-C-004-1.3** `[Tier C · pending]`
    **As a** Implementation Commitment, **I want** Check session token revocation status against active list, **so that** Request proceeds only if token is not present in the revoked session list.

    **Acceptance criteria:**
      - **AC-004** — Token not found in revocation list
        - _Measurable:_ session_revoked_at === null || token_id not in revoked_set

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-SESSION · Pass: 3_

    _Decomposition rationale:_ Revocation status is a safety mechanism for logged-out or compromised sessions; requires separate lookup.

    _Surfaced assumptions:_ A-0275
  - **US-003-C-004-1.4** `[Tier C · pending]`
    **As a** Implementation Commitment, **I want** Validate session tenant affinity against request tenant context, **so that** Request proceeds only if session tenant matches the request's tenant context.

    **Acceptance criteria:**
      - **AC-005** — Tenant context matches
        - _Measurable:_ session_tenant_id === request_tenant_id

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-SESSION, US-003-C-004-3 · Pass: 3_

    _Decomposition rationale:_ Ensures data isolation boundaries are respected before role checks; prevents cross-tenant session misuse.

    _Surfaced assumptions:_ A-0275
##### US-003-C-004-2 `[Tier C · pending]`

**As a** Policy Engine, **I want** Query Cerbos for 'VIEW_ASSET' role binding, **so that** Receive decision object indicating whether the user role maps to the resource action.

**Acceptance criteria:**
  - **AC-002** — Cerbos API returns a decision object.
    - _Measurable:_ policy_decision.allowed is a boolean || policy_decision.error exists

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-ROLE, ENT-PERMISSION-MAPPING, TECH-9, UJ-3 · Pass: 2_

_Decomposition rationale:_ This commits to the specific policy engine (Cerbos) for authorization logic and ensures the decision is made by the designated system component.

_Surfaced assumptions:_ A-0082, A-0083

  - **US-003-C-004-2.1** `[Tier D · atomic]`
    **As a** Policy Engine, **I want** Extract 'allowed' boolean from decision object, **so that** System holds true/false state for request.

    **Acceptance criteria:**
      - **AC-002-1** — Boolean value extracted matches policy response.
        - _Measurable:_ decision.allowed === extracted.allowed

    _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-9 · Pass: 3_

    _Decomposition rationale:_ The boolean 'allowed' is the primary payload needed to determine access control outcome; this is the atomic data extraction operation.

    _Surfaced assumptions:_ A-0276, A-0277
  - **US-003-C-004-2.2** `[Tier D · atomic]`
    **As a** Policy Engine, **I want** Extract 'error' object if decision is missing allowed, **so that** System captures error message for logging or display.

    **Acceptance criteria:**
      - **AC-002-2** — Error object captured if allowed is absent.
        - _Measurable:_ if (error_exists) extract(error_code, error_message)

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-003-C-004-3 · Pass: 3_

    _Decomposition rationale:_ Differentiates between authorization failure and system error to route to the appropriate 403 response logic defined in sibling US-003-C-004-3.

    _Surfaced assumptions:_ A-0276, A-0277
  - **US-003-C-004-2.3** `[Tier D · atomic]`
    **As a** Policy Engine, **I want** Inject user and resource context into payload, **so that** Payload sent to Cerbos matches policy definition.

    **Acceptance criteria:**
      - **AC-002-3** — Request payload contains valid user_id and resource_id.
        - _Measurable:_ payload.user_id !== null && payload.resource_id !== null

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-USER, ENT-ROLE · Pass: 3_

    _Decomposition rationale:_ Cerbos requires specific context to evaluate policies; this is the data preparation step binding the request to the entities.

    _Surfaced assumptions:_ A-0276, A-0277
  - **US-003-C-004-2.4** `[Tier D · atomic]`
    **As a** Policy Engine, **I want** Abort operation if response exceeds 500ms, **so that** System fails safely if external dependency times out.

    **Acceptance criteria:**
      - **AC-002-4** — Request fails if Cerbos response time exceeds 500ms.
        - _Measurable:_ response_time > 500ms => raise_timeout_error()

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-SESSION · Pass: 3_

    _Decomposition rationale:_ Enforces synchronous constraint (A-0083) by defining a hard boundary for acceptable latency; prevents indefinite hangs on Cerbos.

    _Surfaced assumptions:_ A-0276, A-0277
##### US-003-C-004-3 `[Tier D · atomic]`

**As a** Response Handler, **I want** Construct and send 403 Forbidden response, **so that** Client receives status 403 with appropriate reason.

**Acceptance criteria:**
  - **AC-003** — HTTP response status is 403 Forbidden.
    - _Measurable:_ http_response.status_code === 403

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-NOTIFICATION, TECH-8, UJ-3 · Pass: 2_

_Decomposition rationale:_ This is the terminal action for denied requests, mapping directly to the parent's AC-4 regarding the 403 return requirement.

_Surfaced assumptions:_ A-0082, A-0083

##### US-003-C-004-4 `[Tier C · pending]`

**As a** Audit Logger, **I want** Create audit log entry for failed permission check, **so that** Immutable record exists of the denial attempt with user and resource details.

**Acceptance criteria:**
  - **AC-004** — Audit log entry is created and persisted.
    - _Measurable:_ audit_log_entry.action === 'PERMISSION_DENIED' && audit_log_entry.timestamp > 0

_Status: pending · Priority: high · Tier: C · Traces to: ENT-AUDIT-LOG-ENTRY, WF-13, UJ-3 · Pass: 2_

_Decomposition rationale:_ Security events must be logged for compliance and forensics; this is a mandatory side effect of the denial logic.

_Surfaced assumptions:_ A-0082, A-0083

  - **US-003-C-004-4-C-1** `[Tier C · pending]`
    **As a** Implementation Engineer, **I want** Populate the audit log entry with the authenticated user's identity, **so that** The log record contains a unique, non-null user identifier that matches the session subject.

    **Acceptance criteria:**
      - **AC-004-1** — The 'user_id' field in the audit log entry is populated and matches the authenticated subject.
        - _Measurable:_ log_entry.user_id === session.subject.id && log_entry.user_id is not null

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-AUDIT-LOG-ENTRY, WF-13, UJ-3 · Pass: 3_

    _Decomposition rationale:_ This child isolates the 'Who' aspect of the audit record, committing to capturing the actor. This prevents scope creep by defining exactly which identity field is required, distinct from the 'What' (Child 2) or 'When/Why' (Child 3).
  - **US-003-C-004-4-C-2** `[Tier C · pending]`
    **As a** Implementation Engineer, **I want** Populate the audit log entry with the resource context and action type, **so that** The log record contains the resource identifier and the action code that was denied.

    **Acceptance criteria:**
      - **AC-004-2** — The 'resource_id' and 'action' fields are populated to identify the protected asset and denied operation.
        - _Measurable:_ log_entry.resource_id === request.resource_id && log_entry.action === 'PERMISSION_DENIED'

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-AUDIT-LOG-ENTRY, WF-13, UJ-3 · Pass: 3_

    _Decomposition rationale:_ This child isolates the 'What' aspect of the denial (resource and action), binding the log content to the specific security event. This prevents ambiguity on what exactly was attempted, separate from identity or reason capture.
  - **US-003-C-004-4-C-3** `[Tier C · pending]`
    **As a** Implementation Engineer, **I want** Populate the audit log entry with the denial reason and trace correlation ID, **so that** The log record includes a non-null reason for denial and a trace ID linking to the request flow.

    **Acceptance criteria:**
      - **AC-004-3** — The 'denial_reason' and 'trace_id' fields are populated to support root cause analysis.
        - _Measurable:_ log_entry.denial_reason is not null && log_entry.trace_id exists and is not empty

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-AUDIT-LOG-ENTRY, WF-13, UJ-3 · Pass: 3_

    _Decomposition rationale:_ This child isolates the 'Why' and 'Traceability' aspect. It commits to recording the policy or state condition that caused the denial (e.g., 'role_missing'), enabling investigation without coupling this to the identity capture.
### FR US-012 `[pending]`

**As a** Homeowner, **I want** Search and retrieve historical service documents, **so that** Homeowner locates warranty or permit documents from past Service Calls.

**Acceptance criteria:**
  - **AC-022** — Search finds relevant docs
    - _Measurable:_ Search query returns ENT-DOCUMENT-ASSET with matching metadata within 1 second
  - **AC-023** — Documents readable
    - _Measurable:_ PDF/Image preview renders without corruption

_Status: pending · Priority: high · Traces to: UJ-12, ENT-DOCUMENT-ASSET, WF-6 · Pass: 0_

#### US-012-1.1 `[Tier C · pending]`

**As a** Performance Engineer, **I want** Enforce search query latency SLA, **so that** Search query returns ENT-DOCUMENT-ASSET within 1 second.

**Acceptance criteria:**
  - **AC-101** — Search results returned within threshold.
    - _Measurable:_ query_latency_ms <= 1000 for 95th percentile requests

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-12, AC-022 · Pass: 1_

_Decomposition rationale:_ Latency is a concrete implementation commitment derived from AC-022; requires infrastructure tuning and caching strategy decisions.

_Surfaced assumptions:_ A-0034, A-0035, A-0036, A-0037

##### US-012-1.1.1 `[Tier B · pending]`

**As a** Architectural Strategy, **I want** Route search queries to dedicated read replicas, **so that** Separate read load from write transactions to increase throughput.

**Acceptance criteria:**
  - **AC-101.1** — Search traffic is served from read replicas without interfering with write transactions.
    - _Measurable:_ Read queries are routed via DB connection pool routing logic to replica set.

_Status: pending · Priority: high · Tier: B · Traces to: UJ-12, TECH-7 · Pass: 2_

_Decomposition rationale:_ Read scaling is a primary architectural choice to reduce latency. This child defines the strategy for scaling read capacity without decomposing to database config details yet.

_Surfaced assumptions:_ A-0140, A-0141, A-0142

##### US-012-1.1.2 `[Tier C · pending]`

**As a** Implementation Config, **I want** Configure Redis cache TTL for search endpoints, **so that** Search results returned from cache to reduce database load.

**Acceptance criteria:**
  - **AC-101.2** — Cache entries expire or invalidate when source data updates.
    - _Measurable:_ Cache TTL set to 5 minutes; invalidation hook on document update workflow.

_Status: pending · Priority: high · Tier: C · Traces to: UJ-12, WF-6, TECH-12 · Pass: 2_

_Decomposition rationale:_ Caching is a concrete implementation choice to meet latency SLA. TTL and invalidation rules are specific implementation parameters under this strategy.

_Surfaced assumptions:_ A-0140, A-0141, A-0142

  - **US-012-1.1.2-1** `[Tier C · pending]`
    **As a** Configuration Commitment, **I want** Set fixed TTL on all cached search results, **so that** Search cache entries expire automatically after 300 seconds regardless of read volume.

    **Acceptance criteria:**
      - **AC-CACHE-TTL-01** — Cached search response is considered stale if > 300s old
        - _Measurable:_ cache_entry.expiry_timestamp === source_timestamp + 300000ms for all entries in search_cache table

    _Status: pending · Priority: high · Tier: C · Traces to: WF-6, UJ-12 · Pass: 3_

    _Decomposition rationale:_ Defines the specific numerical parameter for cache expiration, a concrete implementation choice required to satisfy AC-101.2's 'TTL set to 5 minutes' clause.

    _Surfaced assumptions:_ A-0370
  - **US-012-1.1.2-2** `[Tier C · pending]`
    **As a** Eventing Commitment, **I want** Trigger cache invalidation on document update workflow completion, **so that** No stale data persists in cache after WF-6 processes a document update.

    **Acceptance criteria:**
      - **AC-CACHE-INV-01** — Cache entry for updated document is purged immediately after workflow state changes to COMPLETE
        - _Measurable:_ search_cache.get(doc_id).status === PURGED within 10ms after WF-6 emits UPDATE_COMPLETE event

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-6 · Pass: 3_

    _Decomposition rationale:_ Defines the invalidation mechanism and dependency on WF-6, ensuring AC-101.2's 'invalidation hook' is technically realized via event emission.

    _Surfaced assumptions:_ A-0370
  - **US-012-1.1.2-3** `[Tier C · pending]`
    **As a** Scope Commitment, **I want** Enforce multi-tenant key isolation for cache entries, **so that** Search cache never returns another tenant's document data to a requesting tenant.

    **Acceptance criteria:**
      - **AC-CACHE-SCOPE-01** — Cache key includes tenant ID and document hash
        - _Measurable:_ cache_key === tenant_id:query_hash:doc_id for all entries

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-TENANT, UJ-12 · Pass: 3_

    _Decomposition rationale:_ Establishes the scope boundary (tenant isolation) for caching to ensure search results are scoped correctly within the multi-tenant system.

    _Surfaced assumptions:_ A-0370
##### US-012-1.1.3 `[Tier D · atomic]`

**As a** Leaf Operation, **I want** Abort HTTP request if backend latency exceeds 900ms, **so that** Protect client from hanging UI and prevent SLA breach from persisting.

**Acceptance criteria:**
  - **AC-101.3** — Client receives error response immediately after 900ms wait.
    - _Measurable:_ Response headers include 'X-Backend-Latency: 901' and status 504 after 900ms duration.

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-12, TECH-12 · Pass: 2_

_Decomposition rationale:_ Atomic action that defines the boundary of success/failure for the client. This is the leaf operation that directly verifies the parent AC.

_Surfaced assumptions:_ A-0140, A-0141, A-0142

#### US-012-1.2 `[Tier C · pending]`

**As a** Backend Developer, **I want** Configure document preview renderer, **so that** PDF/Image preview renders without corruption.

**Acceptance criteria:**
  - **AC-102** — Preview renders successfully on client.
    - _Measurable:_ preview_render_status === 'success' && file_checksum_matches_original

_Status: pending · Priority: high · Tier: C · Traces to: ENT-DOCUMENT-ASSET, AC-023 · Pass: 1_

_Decomposition rationale:_ Rendering integrity is an implementation decision involving specific libraries (e.g., PDF.js) and validation checks, not scope definition.

_Surfaced assumptions:_ A-0034, A-0035, A-0036, A-0037

##### US-012-1.2-1 `[Tier C · pending]`

**As a** Backend Developer, **I want** Implement PDF rendering pipeline, **so that** PDF previews are generated without layout corruption.

**Acceptance criteria:**
  - **AC-102-1** — Rendered PDF renders correctly on client.
    - _Measurable:_ preview_render_status === 'success' && file_checksum_matches_original for PDF mime_type

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-DOCUMENT-ASSET · Pass: 2_

_Decomposition rationale:_ Splitting the capability by document format is the minimal decomposition to address format-specific corruption risks.

_Surfaced assumptions:_ A-0143, A-0144

  - **US-012-1.2-1.1** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Fetch source PDF bytes from SeaweedFS object storage, **so that** Render process proceeds only if source bytes are successfully retrieved.

    **Acceptance criteria:**
      - **AC-102-1.1** — Source bytes fetched without mutation.
        - _Measurable:_ Buffer size > 0 && buffer_checksum_matches_source

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-DOCUMENT-ASSET, TECH-13 · Pass: 3_

    _Decomposition rationale:_ First step of the pipeline; requires isolation from mutation (A-0143). Fetches raw input.

    _Surfaced assumptions:_ A-0371
  - **US-012-1.2-1.2** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Render PDF to preview using rendering engine, **so that** Generated preview matches visual expectations and layout integrity.

    **Acceptance criteria:**
      - **AC-102-1.2** — Rendering completes without error.
        - _Measurable:_ preview_render_status === 'success' && file_checksum_matches_original

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-DOCUMENT-ASSET, TECH-16 · Pass: 3_

    _Decomposition rationale:_ Core transformation step; requires timeout handling.

    _Surfaced assumptions:_ A-0371
  - **US-012-1.2-1.3** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Store rendered preview in SeaweedFS for caching, **so that** Preview is persisted and retrievable for subsequent requests.

    **Acceptance criteria:**
      - **AC-102-1.3** — Preview stored at expected path.
        - _Measurable:_ preview_path_exists && preview_size > 0

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-DOCUMENT-ASSET, TECH-13 · Pass: 3_

    _Decomposition rationale:_ Stores result for delivery; must handle concurrent writes safely.

    _Surfaced assumptions:_ A-0371
  - **US-012-1.2-1.4** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Update ENT-DOCUMENT-ASSET metadata with preview reference, **so that** Asset record reflects presence of rendered preview.

    **Acceptance criteria:**
      - **AC-102-1.4** — Preview reference saved in asset record.
        - _Measurable:_ asset.preview_path is set && asset.preview_status is 'success'

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-DOCUMENT-ASSET · Pass: 3_

    _Decomposition rationale:_ Finalizes pipeline by updating the source of truth for the asset.

    _Surfaced assumptions:_ A-0371
##### US-012-1.2-2 `[Tier C · pending]`

**As a** Backend Developer, **I want** Implement Image rendering pipeline, **so that** Image previews are generated without corruption or artifacts.

**Acceptance criteria:**
  - **AC-102-2** — Rendered image previews render correctly on client.
    - _Measurable:_ preview_render_status === 'success' && file_checksum_matches_original for Image mime_type

_Status: pending · Priority: high · Tier: C · Traces to: ENT-DOCUMENT-ASSET · Pass: 2_

_Decomposition rationale:_ Separating image handling isolates format-specific encoding issues (e.g. JPG vs PNG) to the rendering layer.

_Surfaced assumptions:_ A-0143, A-0144

  - **US-012-1.2-2.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Select and integrate libcvids library for image processing, **so that** Images are processed using libcvids for high performance.

    **Acceptance criteria:**
      - **AC-001** — Rendering process invokes libcvids for image derivative generation
        - _Measurable:_ process.call('libcvids') is invoked in the rendering service

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-17 · Pass: 3_

    _Decomposition rationale:_ Binds the processing engine choice defined in TECH-17, committing to a specific library for image derivative generation rather than a generic solution.

    _Surfaced assumptions:_ A-0372, A-0373
  - **US-012-1.2-2.2** `[Tier C · pending]`
    **As a** CAM operator, **I want** Enforce malware scanning on all rendered previews, **so that** No malware-infected image is stored in the preview bucket.

    **Acceptance criteria:**
      - **AC-002** — Every rendered image passes ClamAV scan before storage
        - _Measurable:_ scan.status === 'clean' for every file in preview_bucket

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-15 · Pass: 3_

    _Decomposition rationale:_ Imposes a security compliance commitment (TECH-15) on the rendering pipeline, ensuring safe storage.

    _Surfaced assumptions:_ A-0372, A-0373
  - **US-012-1.2-2.3** `[Tier C · pending]`
    **As a** CAM operator, **I want** Store derivatives in dedicated storage prefix, **so that** Previews are stored in a distinct folder structure for cache invalidation.

    **Acceptance criteria:**
      - **AC-003** — Output file paths match storage prefix convention
        - _Measurable:_ file.path.startsWith('preview/') for all stored derivatives

    _Status: pending · Priority: high · Tier: C · Traces to: TECH-13 · Pass: 3_

    _Decomposition rationale:_ Defines the storage location commitment (TECH-13) required to isolate previews from source assets.

    _Surfaced assumptions:_ A-0372, A-0373
  - **US-012-1.2-2.4** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Validate file checksum after render, **so that** Rendered image byte-for-byte matches source hash.

    **Acceptance criteria:**
      - **AC-102-2** — Preview checksum matches original source checksum
        - _Measurable:_ sha256(rendered_file) === sha256(source_file)

    _Status: atomic · Priority: critical · Tier: D · Traces to: AC-102-2 · Pass: 3_

    _Decomposition rationale:_ Atomic verification operation (Tier D) addressing the primary AC-102-2 regarding file integrity and corruption.

    _Surfaced assumptions:_ A-0372, A-0373
##### US-012-1.2-3 `[Tier B · pending]`

**As a** Security Engineer, **I want** Enforce tenant access control on render jobs, **so that** Only authorized sessions trigger the rendering process for their tenant data.

**Acceptance criteria:**
  - **AC-102-3** — Unauthorized session fails to trigger render.
    - _Measurable:_ Access Denied response when session.tenant_id does not match document.tenant_id

_Status: pending · Priority: critical · Tier: B · Traces to: ENT-SESSION, TECH-9 · Pass: 2_

_Decomposition rationale:_ Security policy (Access Control) is a governing rule (Tier B) that dictates the implementation strategy for the rendering service, distinct from format handling.

_Surfaced assumptions:_ A-0143, A-0144

##### US-012-1.2-4 `[Tier C · pending]`

**As a** DevOps Engineer, **I want** Configure storage caching for previews, **so that** Previews are served from cache to prevent source mutation during reads.

**Acceptance criteria:**
  - **AC-102-4** — Preview request serves cached response without hitting source storage for write.
    - _Measurable:_ SeaweedFS request does not write to origin bucket for preview requests

_Status: pending · Priority: medium · Tier: C · Traces to: TECH-13, ENT-DOC-STORAGE-FOLDER · Pass: 2_

_Decomposition rationale:_ Storage configuration (caching strategy) is an implementation choice (Tier C) that directly affects the 'without corruption' acceptance criterion.

_Surfaced assumptions:_ A-0143, A-0144

  - **US-012-1.2-4.1** `[Tier C · pending]`
    **As a** system component, **I want** provision local disk volumes for preview cache storage, **so that** Preview assets are stored locally to reduce read latency and source strain.

    **Acceptance criteria:**
      - **AC-102-4.1** — Preview requests utilize local cache backend before source.
        - _Measurable:_ HTTP_REQUEST(source_storage) returns 404 or empty if cache_hit == true for preview endpoint

    _Status: pending · Priority: high · Tier: C · Traces to: TECH-13 · Pass: 3_

    _Decomposition rationale:_ Defines the physical storage mechanism required to satisfy the caching goal, distinguishing it from the primary object storage layer.

    _Surfaced assumptions:_ A-0374, A-0375
  - **US-012-1.2-4.2** `[Tier C · pending]`
    **As a** security operator, **I want** apply tenant-specific isolation metadata to cache keys, **so that** Previews from one tenant are never served from another tenant's cache entry.

    **Acceptance criteria:**
      - **AC-102-4.2** — Cache lookup returns empty if tenant ID mismatched.
        - _Measurable:_ GET_CACHE(tenant_X, doc_Y) === null when source belongs to tenant_Z

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-TENANT, WF-12 · Pass: 3_

    _Decomposition rationale:_ Enforces the multi-tenant security requirement on the caching layer, extending WF-12 isolation policies to read paths.

    _Surfaced assumptions:_ A-0374, A-0375
  - **US-012-1.2-4.3** `[Tier D · atomic]`
    **As a** system component, **I want** detect source mutation via write-lock or version check, **so that** Response is invalidated immediately if source state changes during read window.

    **Acceptance criteria:**
      - **AC-102-4.3** — Read path returns error or fresh data if source is mutating.
        - _Measurable:_ READ_SOURCE() returns version_new > cache_version if mutation detected

    _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-13, ENT-DOC-STORAGE-FOLDER · Pass: 3_

    _Decomposition rationale:_ Atomic verification of the 'prevent source mutation' requirement during the read path, treating it as a testable leaf operation.

    _Surfaced assumptions:_ A-0374, A-0375
#### US-012-1.3 `[Tier C · pending]`

**As a** Data Engineer, **I want** Index metadata from workflow completion, **so that** Search index populated with ExifTool metadata.

**Acceptance criteria:**
  - **AC-103** — Index searchable after ingestion.
    - _Measurable:_ document_in_index AND metadata_extracted_count >= 0

_Status: pending · Priority: medium · Tier: C · Traces to: WF-6, ENT-DOC-EXTRACT-INDEX · Pass: 1_

_Decomposition rationale:_ Relies on the completion of WF-6; commits to specific tooling (ExifTool) for extraction, a concrete technology choice.

_Surfaced assumptions:_ A-0034, A-0035, A-0036, A-0037

##### US-012-1.3-C-01 `[Tier D · atomic]`

**As a** System Agent, **I want** Invoke ExifTool binary for metadata extraction, **so that** ExifTool execution completes on supported files.

**Acceptance criteria:**
  - **AC-001** — ExifTool runs without runtime errors on target file.
    - _Measurable:_ exifTool_exit_code == 0

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-6 · Pass: 2_

_Decomposition rationale:_ Extraction is the atomic action required to populate the index; without this tool invocation, no data is available.

_Surfaced assumptions:_ A-0145, A-0146

##### US-012-1.3-C-02 `[Tier C · pending]`

**As a** System Agent, **I want** Map extracted tags to search index fields, **so that** Metadata keys normalized to schema fields.

**Acceptance criteria:**
  - **AC-002** — All valid extracted keys map to a defined search field.
    - _Measurable:_ mapped_keys.size() > 0 AND key_exists_in_schema == true

_Status: pending · Priority: critical · Tier: C · Traces to: WF-6, ENT-DOC-EXTRACT-INDEX · Pass: 2_

_Decomposition rationale:_ Mapping is the implementation decision that defines the relationship between extracted data and search functionality.

_Surfaced assumptions:_ A-0145, A-0146

  - **US-012-1.3-C-02.1** `[Tier D · atomic]`
    **As a** Field Processor, **I want** Verify extracted key against search schema registry before mapping, **so that** Mapping proceeds only if key is found in schema configuration.

    **Acceptance criteria:**
      - **AC-002.1** — Mapped key exists in schema registry.
        - _Measurable:_ schema_registry.exists(key) === true for every extracted tag at commit time

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-012-1.3-C-02, WF-6, ENT-DOC-EXTRACT-INDEX, US-012-1.3-C-03 · Pass: 3_

    _Decomposition rationale:_ Validates the existence constraint of AC-002; atomic check that can be tested independently against the schema registry.

    _Surfaced assumptions:_ A-0376, A-0377, A-0378
  - **US-012-1.3-C-02.2** `[Tier D · atomic]`
    **As a** Normalizer, **I want** Apply canonical normalization rules to key strings (lowercase, trim), **so that** Key string matches canonical schema field definition format.

    **Acceptance criteria:**
      - **AC-002.2** — Mapped key string matches canonical format.
        - _Measurable:_ key_normalized === key_canonical for every valid key at index write time

    _Status: atomic · Priority: high · Tier: D · Traces to: US-012-1.3-C-02, WF-6, US-012-1.3-C-03, ENT-DOC-EXTRACT-INDEX · Pass: 3_

    _Decomposition rationale:_ Implements the normalization aspect of the mapping behavior; ensures deterministic indexability.

    _Surfaced assumptions:_ A-0376, A-0377, A-0378
  - **US-012-1.3-C-02.3** `[Tier C · pending]`
    **As a** Error Policy, **I want** Route unrecognised keys to error queue for review instead of dropping, **so that** Unknown tags logged and flagged for manual schema review.

    **Acceptance criteria:**
      - **AC-002.3** — Unmapped keys are logged to error queue.
        - _Measurable:_ error_queue.contains(key) === true if key_not_in_schema at commit time

    _Status: pending · Priority: high · Tier: C · Traces to: US-012-1.3-C-02, US-012-1.3-C-04, WF-6 · Pass: 3_

    _Decomposition rationale:_ Defines the policy for handling unknown keys, connecting directly to sibling C-04 (Log extraction failure).

    _Surfaced assumptions:_ A-0376, A-0377, A-0378
  - **US-012-1.3-C-02.4** `[Tier D · atomic]`
    **As a** Type Enforcer, **I want** Convert extracted values to target schema types (string to JSONB, date to timestamp), **so that** Index field values conform to column type definitions.

    **Acceptance criteria:**
      - **AC-002.4** — Index field value type matches schema column type.
        - _Measurable:_ col.type(field) === expected_type for every mapped field at persist time

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-012-1.3-C-02, US-012-1.3-C-03, WF-6 · Pass: 3_

    _Decomposition rationale:_ Ensures data integrity during the persistence phase; validates type compatibility.

    _Surfaced assumptions:_ A-0376, A-0377, A-0378
##### US-012-1.3-C-03 `[Tier D · atomic]`

**As a** System Agent, **I want** Persist metadata to search index upon success, **so that** Search index state reflects extraction success.

**Acceptance criteria:**
  - **AC-003** — Index record count increases after write.
    - _Measurable:_ index_count_increased == true

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-6, ENT-DOC-EXTRACT-INDEX · Pass: 2_

_Decomposition rationale:_ This is the terminal leaf action that realizes the 'Index searchable after ingestion' acceptance criterion.

_Surfaced assumptions:_ A-0145, A-0146

##### US-012-1.3-C-04 `[Tier D · atomic]`

**As a** System Agent, **I want** Log extraction failure events to error queue, **so that** Failure state recorded for manual review.

**Acceptance criteria:**
  - **AC-004** — Log entry created for failed extraction attempt.
    - _Measurable:_ error_log_entry_id != null

_Status: atomic · Priority: medium · Tier: D · Traces to: WF-6 · Pass: 2_

_Decomposition rationale:_ Failure handling is required to maintain workflow idempotency and data integrity.

_Surfaced assumptions:_ A-0145, A-0146

#### US-012-1.4 `[downgraded]`

**As a** Scope Manager, **I want** Define searchable asset boundaries, **so that** Only ENT-DOCUMENT-ASSET from Service Calls are returned.

**Acceptance criteria:**
  - **AC-104** — Query results limited to valid scope.
    - _Measurable:_ search_results.source_type === 'SERVICE_CALL' OR 'ASSET_HISTORY'

_Status: downgraded · Priority: high · Traces to: UJ-12, ENT-DOCUMENT-ASSET · Pass: 2_

##### US-012-1.4.1 `[Tier C · pending]`

**As a** Search Engine Configurator, **I want** Enforce source type whitelist on every search query result set, **so that** No search result rows are returned where source_type is not in the whitelist.

**Acceptance criteria:**
  - **AC-001** — Search results contain only whitelisted sources.
    - _Measurable:_ search_results.source_type IN ('SERVICE_CALL', 'ASSET_HISTORY') for every row in result set

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-12, ENT-DOCUMENT-ASSET · Pass: 2_

_Decomposition rationale:_ Directly implements AC-104 by defining the query-layer filter behavior, ensuring the system adheres to the parent's 'so that' clause.

_Surfaced assumptions:_ A-0226, A-0227, A-0228

##### US-012-1.4.2 `[Tier C · pending]`

**As a** Data Hygiene Manager, **I want** Validate and populate source_type field during document ingestion, **so that** Every persisted ENT-DOCUMENT-ASSET record contains a non-null, valid source_type value.

**Acceptance criteria:**
  - **AC-002** — Ingested documents contain valid metadata.
    - _Measurable:_ document.source_type IS NOT NULL AND document.source_type IN ('SERVICE_CALL', 'ASSET_HISTORY') at commit time

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-12, ENT-DOCUMENT-ASSET, WF-6 · Pass: 2_

_Decomposition rationale:_ Ensures the prerequisite condition for Child 1 is met at the source. Prevents invalid data from entering the index that could bypass filters.

_Surfaced assumptions:_ A-0226, A-0227, A-0228

##### US-012-1.4.3 `[Tier B · pending]`

**As a** Scope Boundary Policy, **I want** Commitment to treat documents with unknown source_type as out of scope for search, **so that** Documents lacking a recognized source_type are permanently excluded from search retrieval capability.

**Acceptance criteria:**
  - **AC-003** — No documents with invalid or null source_type appear in search.
    - _Measurable:_ COUNT(*) WHERE source_type NOT IN ('SERVICE_CALL', 'ASSET_HISTORY') AND source_type IS NOT NULL = 0

_Status: pending · Priority: high · Tier: B · Traces to: UJ-12, ENT-DOCUMENT-ASSET · Pass: 2_

_Decomposition rationale:_ Defines the scope boundary for legacy or malformed assets. This is a policy choice (Tier B) rather than a verification, deciding that unknown types are out of scope.

_Surfaced assumptions:_ A-0226, A-0227, A-0228

### Release 2: Service Provider Operations Suite (6 roots)
*This release equips service providers with comprehensive tools to manage their field operations, including executing work orders, generating estimates, submitting invoices, and integrating with accounting systems. It also incorporates essential compliance features like contractor insurance verification and permit tracking.*

### FR US-004 `[pending]`

**As a** Technician, **I want** Execute Work Order in field mode, **so that** Technician completes job tasks and submits proof of completion.

**Acceptance criteria:**
  - **AC-006** — Offline functionality available
    - _Measurable:_ Application persists ENT-JOB-TICKET data locally when network connectivity is lost, syncing upon reconnection
  - **AC-007** — Geofencing accurate
    - _Measurable:_ Device sync token valid only within geofenced polygon, sync fails if user is outside boundaries

_Status: pending · Priority: critical · Traces to: UJ-4, ENT-WORK-ORDER, ENT-JOB-TICKET, WF-2, ENT-DEVICE-SYNC-TOKEN · Pass: 0_

#### FR-004-C-01 `[Tier C · pending]`

**As a** CAM operator, **I want** persist ENT-JOB-TICKET data to local storage device when network connectivity is lost, **so that** Local storage snapshot remains consistent with server state up to the point of disconnection.

**Acceptance criteria:**
  - **AC-101** — Local storage snapshot is retained immediately upon disconnection.
    - _Measurable:_ persisted_local_db_row_count === server_pending_jobs_count where device_state === 'offline' AND timestamp_now - last_sync_timestamp <= network_timeout_threshold

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, ENT-JOB-TICKET, WF-2 · Pass: 1_

_Decomposition rationale:_ This child commits to the specific engineering sub-strategy for offline persistence (local DB), separating it from the sync logic. It rules out server-side caching only.

_Surfaced assumptions:_ A-0007, A-0008, A-0009, A-0010

##### FR-004-C-01.1 `[Tier D · atomic]`

**As a** Network Monitor, **I want** Detect network connectivity loss event, **so that** Offline state is flagged and write trigger is raised.

**Acceptance criteria:**
  - **AC-101-1** — System flags offline state within system latency.
    - _Measurable:_ event_detected_time - network_loss_time <= 500ms

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-2, UJ-4 · Pass: 2_

_Decomposition rationale:_ Detecting the network event is the atomic trigger for the persistence process; must be isolated to ensure reliable write initiation.

_Surfaced assumptions:_ A-0084, A-0085, A-0086

##### FR-004-C-01.2 `[Tier D · atomic]`

**As a** Local Storage Engine, **I want** Persist current job ticket state to local queue, **so that** Job ticket is stored with timestamp and metadata in local DB.

**Acceptance criteria:**
  - **AC-101-2** — Data is written immediately upon trigger.
    - _Measurable:_ local_row_count_increment === 1

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-JOB-TICKET, UJ-4 · Pass: 2_

_Decomposition rationale:_ The actual data capture is the atomic storage operation; separated from the network event to handle concurrency.

_Surfaced assumptions:_ A-0084, A-0085, A-0086

##### FR-004-C-01.3 `[Tier D · atomic]`

**As a** Consistency Validator, **I want** Calculate and verify snapshot consistency against server, **so that** Consistency metric confirms local state matches server pending count.

**Acceptance criteria:**
  - **AC-101-3** — Snapshot matches server state within threshold.
    - _Measurable:_ abs(local_pending_count - server_pending_count) === 0 AND (timestamp_now - last_sync_timestamp) <= network_timeout_threshold

_Status: atomic · Priority: high · Tier: D · Traces to: WF-2, UJ-4 · Pass: 2_

_Decomposition rationale:_ Verifying the AC-101 condition is an atomic validation step that must pass before the system considers the snapshot consistent.

_Surfaced assumptions:_ A-0084, A-0085, A-0086

#### FR-004-C-02 `[Tier C · pending]`

**As a** CAM operator, **I want** validate device location against geofenced polygon before allowing sync or submission, **so that** Sync request is rejected with error code if coordinates fall outside the defined polygon.

**Acceptance criteria:**
  - **AC-102** — Device geolocation request returns failure if outside polygon.
    - _Measurable:_ sync_request.rejected === true AND (current_lat, current_lng) NOT IN geofenced_polygon AND sync_error_message === 'Outside_Geofence'

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, ENT-DEVICE-SYNC-TOKEN, WF-2 · Pass: 1_

_Decomposition rationale:_ This child commits to the geofencing validation logic. It binds the system to strict location verification, ruling out location-agnostic syncing.

_Surfaced assumptions:_ A-0007, A-0008, A-0009, A-0010

##### FR-004-C-02-D-001 `[Tier D · atomic]`

**As a** Field Technician, **I want** retrieve active device coordinates, **so that** Device current_lat and current_lng values populated for comparison.

**Acceptance criteria:**
  - **AC-001** — Device coordinates are retrieved and available for validation.
    - _Measurable:_ current_lat AND current_lng are defined on the request context before validation logic runs

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-JOB-TICKET, ENT-USER · Pass: 2_

_Decomposition rationale:_ Geofencing requires an input value (current location). Retrieving this data is the atomic input operation for the validation workflow.

_Surfaced assumptions:_ A-0087

##### FR-004-C-02-D-002 `[Tier D · atomic]`

**As a** Sync Engine, **I want** compare coordinates against geofence polygon, **so that** Boolean result (inside/outside) determined for sync eligibility.

**Acceptance criteria:**
  - **AC-002** — Validation yields a boolean result indicating polygon intersection.
    - _Measurable:_ is_inside_geofence === true OR is_inside_geofence === false for all polygon points

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-2, UJ-4 · Pass: 2_

_Decomposition rationale:_ The core logic of the requirement is the comparison. This child binds the validation algorithm to the system behavior, making it testable without further decomposition.

_Surfaced assumptions:_ A-0087

##### FR-004-C-02-D-003 `[Tier D · atomic]`

**As a** Sync Orchestrator, **I want** reject sync request and set error code, **so that** Sync request state updated to 'rejected' with specific error message.

**Acceptance criteria:**
  - **AC-003** — Rejection flag and error message are applied to the request object.
    - _Measurable:_ sync_request.rejected === true AND sync_error_message === 'Outside_Geofence' if comparison is false

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-JOB-TICKET, WF-2 · Pass: 2_

_Decomposition rationale:_ This child enforces the consequence defined in the parent AC (AC-102). It commits to the specific state transition (reject + message) required by the policy.

_Surfaced assumptions:_ A-0087

#### FR-004-B-01 `[Tier B · pending]`

**As a** CAM operator, **I want** adopt Last-Write-Wins conflict resolution strategy for offline data merging, **so that** Server data overwrites local data if timestamps conflict during reconnection.

**Acceptance criteria:**
  - **AC-103** — Server data overrides local draft after merge.
    - _Measurable:_ merged_record.server_timestamp > merged_record.local_timestamp implies final_record.server_timestamp === original_server_timestamp

_Status: pending · Priority: high · Tier: B · Traces to: UJ-4, ENT-JOB-TICKET, ENT-DEVICE-SYNC-TOKEN · Pass: 1_

_Decomposition rationale:_ This child expresses a policy choice (engineering sub-strategy) for handling offline conflicts. It is Tier B because it commits to a resolution strategy, not just a verification of correctness.

_Surfaced assumptions:_ A-0007, A-0008, A-0009, A-0010

##### FR-004-B-01-1 `[Tier C · pending]`

**As a** System Logic, **I want** validate monotonic timestamp consistency across client and server clocks, **so that** Timestamp comparison logic ignores drift exceeding system bound.

**Acceptance criteria:**
  - **AC-001** — Conflict is detected only when clocks are within tolerance.
    - _Measurable:_ abs(local_timestamp - server_timestamp) <= 100ms allows LWW comparison without skew correction

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-DEVICE-SYNC-TOKEN · Pass: 2_

_Decomposition rationale:_ LWW fails if clocks diverge significantly; this commitment bounds the operational constraint to system time synchronization.

_Surfaced assumptions:_ A-0209, A-0210

  - **FR-004-B-01-1.1** `[Tier D · atomic]`
    **As a** System Logic, **I want** Compute absolute timestamp delta between local device time and server sync token time, **so that** Numeric value representing time difference in milliseconds.

    **Acceptance criteria:**
      - **AC-001-1** — Delta value is calculated and cached before tolerance check
        - _Measurable:_ abs(local_timestamp - server_timestamp) is returned as a numeric float

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-DEVICE-SYNC-TOKEN · Pass: 3_

    _Decomposition rationale:_ Atomic calculation required to feed the tolerance comparison step; cannot pass without raw delta value.

    _Surfaced assumptions:_ A-0507, A-0508
  - **FR-004-B-01-1.2** `[Tier D · atomic]`
    **As a** System Logic, **I want** Evaluate delta against system bound threshold, **so that** Boolean status indicating tolerance compliance.

    **Acceptance criteria:**
      - **AC-001-2** — Delta is compared strictly against 100ms bound without rounding
        - _Measurable:_ delta_value <= 100ms evaluates to true/false

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-DEVICE-SYNC-TOKEN · Pass: 3_

    _Decomposition rationale:_ The core validation commitment; determines whether the LWW comparison logic applies or conflict handling triggers.

    _Surfaced assumptions:_ A-0507, A-0508
  - **FR-004-B-01-1.3** `[Tier D · atomic]`
    **As a** System Logic, **I want** Permit local persistence if tolerance check passes, **so that** Local record is saved to storage without conflict correction.

    **Acceptance criteria:**
      - **AC-001-3** — Write operation proceeds when tolerance is within bound
        - _Measurable:_ local_write_status is 'COMMITTED' when delta <= 100ms

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-CLIENT-LEDGER · Pass: 3_

    _Decomposition rationale:_ Positive branch of the comparison logic; ensures offline-first capability when drift is negligible.

    _Surfaced assumptions:_ A-0507, A-0508
  - **FR-004-B-01-1.4** `[Tier D · atomic]`
    **As a** System Logic, **I want** Invoke conflict resolution workflow when tolerance is exceeded, **so that** Local record is handled via discard or audit log per sibling policies.

    **Acceptance criteria:**
      - **AC-001-4** — Conflict event is raised when delta exceeds 100ms
        - _Measurable:_ trigger_conflict_workflow flag is set when delta > 100ms

    _Status: atomic · Priority: critical · Tier: D · Traces to: FR-004-B-01-2 · Pass: 3_

    _Decomposition rationale:_ Negative branch triggers the sibling requirement (FR-004-B-01-2) regarding discarding drafts or appending audit logs.

    _Surfaced assumptions:_ A-0507, A-0508
##### FR-004-B-01-2 `[Tier D · atomic]`

**As a** Write Operator, **I want** discard local draft and persist server state, **so that** Local record is replaced entirely with server record upon conflict resolution.

**Acceptance criteria:**
  - **AC-002** — Server record replaces local record in storage.
    - _Measurable:_ updated_record.content_hash === server_record.content_hash AND updated_record.source === 'SERVER'

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-WORK-ORDER, UJ-4 · Pass: 2_

_Decomposition rationale:_ This is the atomic execution of the overwrite policy; once the decision is made, the physical write is the terminal action.

_Surfaced assumptions:_ A-0209, A-0210

##### FR-004-B-01-3 `[Tier C · pending]`

**As a** Audit Writer, **I want** append merge event to immutable audit log, **so that** System logs evidence of override and the identity of the overwritten record.

**Acceptance criteria:**
  - **AC-003** — Audit entry records the overwrite event.
    - _Measurable:_ audit_log_entry.merge_reason === 'LWW_CONFLICT' AND audit_log_entry.new_record_id === server_record.id

_Status: pending · Priority: high · Tier: C · Traces to: ENT-AUDIT-LOG-ENTRY · Pass: 2_

_Decomposition rationale:_ Regulatory compliance requires traceability of who overwrote what data; this binds to the audit log entity.

_Surfaced assumptions:_ A-0209, A-0210

  - **FR-004-B-01-3-C-1** `[Tier C · pending]`
    **As a** System Architect, **I want** Define mandatory schema fields for conflict log entry, **so that** Log entry contains 'merge_reason' and 'new_record_id' values.

    **Acceptance criteria:**
      - **AC-004** — Log entry payload includes conflict metadata.
        - _Measurable:_ audit_log_entry.merge_reason exists AND audit_log_entry.merge_reason === 'LWW_CONFLICT' AND audit_log_entry.new_record_id !== null

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ AC-003 mandates specific values; this child binds the exact schema requirements to satisfy the AC without ambiguity.

    _Surfaced assumptions:_ A-0509, A-0510, A-0511
  - **FR-004-B-01-3-C-2** `[Tier C · pending]`
    **As a** Security Engineer, **I want** Enforce write-once guarantee on audit partition, **so that** Persisted entry cannot be altered after commit.

    **Acceptance criteria:**
      - **AC-005** — Log entry integrity is verified via hash comparison.
        - _Measurable:_ hash(current_entry) === hash(stored_entry)

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-AUDIT-LOG-ENTRY, WF-13 · Pass: 3_

    _Decomposition rationale:_ Immutability is the core requirement for an audit log; this child commits the specific storage strategy required to enforce the AC's implicit integrity constraints.

    _Surfaced assumptions:_ A-0509, A-0510, A-0511
  - **FR-004-B-01-3-C-3** `[Tier D · atomic]`
    **As a** Data Engineer, **I want** Append merge event to immutable log stream, **so that** New log entry created in audit stream.

    **Acceptance criteria:**
      - **AC-006** — Log entry appears in stream immediately.
        - _Measurable:_ SELECT COUNT(*) FROM audit_log WHERE timestamp > NOW() - INTERVAL '1s' AND merge_reason = 'LWW_CONFLICT' >= 1

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-AUDIT-LOG-ENTRY, WF-13 · Pass: 3_

    _Decomposition rationale:_ This is the atomic leaf operation that physically performs the logging action defined by the parent requirement.

    _Surfaced assumptions:_ A-0509, A-0510, A-0511
##### FR-004-B-01-4 `[Tier C · pending]`

**As a** Conflict Resolver, **I want** queue stale merge requests outside policy window, **so that** Requests older than 24 hours do not immediately overwrite but enter batch processing.

**Acceptance criteria:**
  - **AC-004** — Merge is delayed if outside window.
    - _Measurable:_ merge_request.status === 'QUEUED' AND current_timestamp - local_record.created > 24h

_Status: pending · Priority: medium · Tier: C · Traces to: FR-004-B-02 · Pass: 2_

_Decomposition rationale:_ This binds the LWW strategy to the existing 24-hour sync window policy defined in sibling FR-004-B-02 to prevent race conditions.

_Surfaced assumptions:_ A-0209, A-0210

  - **FR-004-B-01-4.1** `[Tier C · pending]`
    **As a** System, **I want** Calculate time delta between current server timestamp and record creation time, **so that** Determines if request qualifies for the 24-hour stale threshold.

    **Acceptance criteria:**
      - **AC-101** — System clock is used for current timestamp calculation
        - _Measurable:_ system_clock_time() - record_created_at >= 24h

    _Status: pending · Priority: high · Tier: C · Traces to: FR-004-B-02 · Pass: 3_

    _Decomposition rationale:_ Decomposes the 'delay' logic into a specific algorithmic check (timestamp delta) which is an implementation commitment.

    _Surfaced assumptions:_ A-0512, A-0513
  - **FR-004-B-01-4.2** `[Tier D · atomic]`
    **As a** System, **I want** Transition merge request status to QUEUED, **so that** Record enters the batch processing state instead of immediate overwrite.

    **Acceptance criteria:**
      - **AC-102** — Record status updates atomically to QUEUED
        - _Measurable:_ UPDATE merge_requests SET status = 'QUEUED' WHERE id = target_id AND current_timestamp - created > 24h

    _Status: atomic · Priority: critical · Tier: D · Traces to: FR-004-B-01-3, FR-004-B-02 · Pass: 3_

    _Decomposition rationale:_ Atomic state transition is a testable leaf operation that fulfills the outcome of the stale merge policy.

    _Surfaced assumptions:_ A-0512, A-0513
  - **FR-004-B-01-4.3** `[Tier C · pending]`
    **As a** System, **I want** Insert record into batch processing queue, **so that** Request is scheduled for delayed reconciliation batch job.

    **Acceptance criteria:**
      - **AC-103** — Record appears in the batch queue with correct priority flag
        - _Measurable:_ SELECT count(*) FROM batch_queue WHERE source_id = queued_id

    _Status: pending · Priority: high · Tier: C · Traces to: FR-004-B-01-3, FR-004-B-02 · Pass: 3_

    _Decomposition rationale:_ Defines the architectural mechanism (queue insertion) required to support the delayed overwrite commitment.

    _Surfaced assumptions:_ A-0512, A-0513
#### FR-004-D-01 `[Tier D · atomic]`

**As a** CAM operator, **I want** upload job evidence (photos/signature) to ENT-JOB-EVIDENCE bucket upon completion, **so that** Media files are stored and associated with the Job Ticket record.

**Acceptance criteria:**
  - **AC-104** — Evidence upload returns success hash upon network availability.
    - _Measurable:_ stored_evidence_hash === calculated_client_side_hash AND stored_evidence_location === SeaweedFS_bucket_path

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-4, ENT-JOB-EVIDENCE, ENT-JOB-TICKET · Pass: 1_

_Decomposition rationale:_ This child is an atomic action (Tier D) representing the terminal leaf operation of capturing proof. It is testable without further decomposition.

_Surfaced assumptions:_ A-0007, A-0008, A-0009, A-0010

#### FR-004-B-02 `[Tier B · pending]`

**As a** CAM operator, **I want** enforce 24-hour synchronization window policy for offline data submission, **so that** Sync attempts older than 24 hours queue for batch processing.

**Acceptance criteria:**
  - **AC-105** — Sync attempts are queued and prioritized based on age.
    - _Measurable:_ sync_queue_priority = 1 - min(offline_duration / 24h, 1) AND sync_window_limit_seconds === 96h

_Status: pending · Priority: medium · Tier: B · Traces to: UJ-4, ENT-DEVICE-SYNC-TOKEN, WF-2 · Pass: 1_

_Decomposition rationale:_ This child commits to a governing rule/constraint regarding data freshness. It defines the boundary of the offline window, not the technology used.

_Surfaced assumptions:_ A-0007, A-0008, A-0009, A-0010

##### FR-004-B-02.1 `[Tier C · pending]`

**As a** Offline Sync Validator, **I want** Compute sync age and apply queue priority formula, **so that** Sync request receives appropriate priority score for queuing.

**Acceptance criteria:**
  - **AC-105-1** — Priority score is calculated based on offline duration.
    - _Measurable:_ priority_score === 1 - min(offline_duration / 24h, 1) AND window_limit_seconds === 96h

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-DEVICE-SYNC-TOKEN · Pass: 2_

_Decomposition rationale:_ This child implements the specific algorithmic commitment defined in the parent AC regarding priority calculation.

_Surfaced assumptions:_ A-0211, A-0212

  - **FR-004-B-02.1.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Retrieve last_successful_sync_time from device token, **so that** Current offline duration is calculated based on token metadata.

    **Acceptance criteria:**
      - **AC-105-1.1** — Timestamp read from ENT-DEVICE-SYNC-TOKEN is valid.
        - _Measurable:_ last_sync_timestamp !== null AND last_sync_timestamp IS NOT NULL IN ENT-DEVICE-SYNC-TOKEN table

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-DEVICE-SYNC-TOKEN · Pass: 3_

    _Decomposition rationale:_ Calculation depends on reading the token; without the token data, duration cannot be computed.

    _Surfaced assumptions:_ A-0514, A-0515
  - **FR-004-B-02.1.2** `[Tier C · pending]`
    **As a** CAM operator, **I want** Apply priority score formula with duration cap, **so that** Normalized priority score calculated for queuing logic.

    **Acceptance criteria:**
      - **AC-105-1.2** — Score matches expected value within 0.01 tolerance.
        - _Measurable:_ abs(calculated_score - (1 - min(duration_seconds / 86400, 1))) <= 0.01

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-DEVICE-SYNC-TOKEN · Pass: 3_

    _Decomposition rationale:_ This binds the specific arithmetic operation defined in the ACs.

    _Surfaced assumptions:_ A-0514, A-0515
  - **FR-004-B-02.1.3** `[Tier C · pending]`
    **As a** CAM operator, **I want** Filter requests older than 96h limit, **so that** Expired sync requests are discarded before queuing.

    **Acceptance criteria:**
      - **AC-105-1.3** — Requests with duration > 96h are rejected.
        - _Measurable:_ rejected_count == count of requests where duration_seconds > 345600

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-DEVICE-SYNC-TOKEN · Pass: 3_

    _Decomposition rationale:_ Enforces the specific window_limit_seconds constraint from the parent ACs.

    _Surfaced assumptions:_ A-0514, A-0515
  - **FR-004-B-02.1.4** `[Tier D · atomic]`
    **As a** Queue processor, **I want** Insert request into offline sync queue with score, **so that** Queue item persists with computed priority_score.

    **Acceptance criteria:**
      - **AC-105-1.4** — Queue record contains priority_score.
        - _Measurable:_ queue_items.priority_score IS NOT NULL AND queue_items.priority_score >= 0 AND queue_items.priority_score <= 1

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-DEVICE-SYNC-TOKEN · Pass: 3_

    _Decomposition rationale:_ Atomic action to store the result of the calculation for downstream scheduling.

    _Surfaced assumptions:_ A-0514, A-0515
##### FR-004-B-02.2 `[Tier D · atomic]`

**As a** Queue Insertion Engine, **I want** Persist aged sync requests to offline sync queue, **so that** Older data is queued for batch processing without immediate dispatch.

**Acceptance criteria:**
  - **AC-105-2** — Queued items are persisted to the sync queue table upon validation.
    - _Measurable:_ sync_queue_count > 0 for items meeting age threshold AND timestamp === queue_timestamp

_Status: atomic · Priority: high · Tier: D · Traces to: WF-2 · Pass: 2_

_Decomposition rationale:_ This child represents the atomic action of persisting the data to the queue, which is the fundamental step for offline handling.

_Surfaced assumptions:_ A-0211, A-0212

##### FR-004-B-02.3 `[Tier D · atomic]`

**As a** Batch Process Trigger, **I want** Trigger batch processing job for oldest queued items, **so that** Batch job runs to push queued data to server.

**Acceptance criteria:**
  - **AC-105-3** — Batch processing initiates when oldest queued item exceeds limit.
    - _Measurable:_ triggered_at >= oldest_queued_timestamp AND sync_window_limit_seconds <= 96h

_Status: atomic · Priority: high · Tier: D · Traces to: WF-2, UJ-4 · Pass: 2_

_Decomposition rationale:_ This child decomposes the 'batch processing' clause of the parent into the atomic trigger event required to execute the workflow.

_Surfaced assumptions:_ A-0211, A-0212

### FR US-005 `[pending]`

**As a** Service Provider, **I want** Generate and send estimate for new Service Call, **so that** Provider submits cost proposal to close the deal quickly.

**Acceptance criteria:**
  - **AC-008** — Estimate accuracy
    - _Measurable:_ Estimate uses ENT-PRICE-BOOK rules and labor rates matching category
  - **AC-009** — Owner notified
    - _Measurable:_ Homeowner receives alert within 10 minutes of estimate submission

_Status: pending · Priority: high · Traces to: UJ-5, ENT-ESTIMATE, ENT-PRICE-BOOK, WF-3 · Pass: 0_

#### US-005-C-1 `[Tier C · pending]`

**As a** Estimate Calculator, **I want** Calculate line item costs by fetching labor rates and material prices from the active Price Book, **so that** Every estimate record contains accurate cost breakdowns derived from ENT-PRICE-BOOK.

**Acceptance criteria:**
  - **AC-1.1** — Line item cost matches Price Book definitions.
    - _Measurable:_ line_item.cost === ENT-PRICE-BOOK[labor_rate] * labor_hours + ENT-PRICE-BOOK[material_cost]

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, ENT-ESTIMATE, ENT-PRICE-BOOK · Pass: 1_

_Decomposition rationale:_ This is the core algorithmic commitment; accuracy depends on correct data sourcing and arithmetic.

_Surfaced assumptions:_ A-0011, A-0012, A-0013

##### US-005-C-1.1 `[Tier C · pending]`

**As a** Labor Rate Fetcher, **I want** Retrieve active labor rate from Price Book for the line item service category, **so that** System returns the validated labor rate from the tenant-specific Price Book entry.

**Acceptance criteria:**
  - **AC-1.1** — Labor rate retrieved matches current active version.
    - _Measurable:_ response.labor_rate === ENT-PRICE-BOOK[labor_rate] where labor_rate.tenant_id === estimate.tenant_id

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, ENT-PRICE-BOOK · Pass: 2_

_Decomposition rationale:_ This child binds the data source (ENT-PRICE-BOOK) and ensures the calculation uses the active tenant context, enforcing multi-tenant isolation (TECH-7).

_Surfaced assumptions:_ A-0088, A-0089, A-0090, A-0091

  - **US-005-C-1.1.1** `[Tier D · atomic]`
    **As a** Database Reader, **I want** Return validated labor rate from Price Book record, **so that** System returns the labor rate value associated with the matched tenant and service category.

    **Acceptance criteria:**
      - **AC-1.1.1** — Returned rate matches the active entry in Price Book.
        - _Measurable:_ response.labor_rate === ENT-PRICE-BOOK[labor_rate] AND labor_rate.tenant_id === estimate.tenant_id

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-5, ENT-PRICE-BOOK · Pass: 3_

    _Decomposition rationale:_ The operation is decomposed into a single leaf action because further decomposition into logical steps (Tenant Check, Status Check, Return) would violate the atomicity of the database operation and existing assumption A-0088 already covers tenant isolation.

    _Surfaced assumptions:_ A-0278
##### US-005-C-1.2 `[Tier C · pending]`

**As a** Material Cost Fetcher, **I want** Retrieve active material price from Price Book for the line item material SKU, **so that** System returns the validated material cost from the tenant-specific Price Book entry.

**Acceptance criteria:**
  - **AC-1.2** — Material cost retrieved matches current active version.
    - _Measurable:_ response.material_cost === ENT-PRICE-BOOK[material_cost] where material_cost.tenant_id === estimate.tenant_id

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, ENT-PRICE-BOOK · Pass: 2_

_Decomposition rationale:_ This child isolates the material data path, distinct from labor, to allow independent validation of each cost component before aggregation.

_Surfaced assumptions:_ A-0088, A-0089, A-0090, A-0091

  - **US-005-C-1.2.1** `[Tier C · pending]`
    **As a** Tenant Isolation Officer, **I want** Filter Price Book records by Tenant ID, **so that** Returns only records belonging to the estimating tenant.

    **Acceptance criteria:**
      - **AC-001** — Returned row tenant matches estimate tenant.
        - _Measurable:_ returned_rows.tenant_id === estimate.tenant_id

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, ENT-PRICE-BOOK · Pass: 3_

    _Decomposition rationale:_ Enforces multi-tenant security boundary by isolating the lookup to the specific tenant scope before any version or cost validation occurs.

    _Surfaced assumptions:_ A-0279
  - **US-005-C-1.2.2** `[Tier C · pending]`
    **As a** Version Resolver, **I want** Filter for row with status active or valid time range, **so that** Returns single cost entry covering the estimate time.

    **Acceptance criteria:**
      - **AC-002** — Selected entry is currently marked active.
        - _Measurable:_ returned_entry.status === 'active'

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-5, AC-1.2 · Pass: 3_

    _Decomposition rationale:_ Ensures the cost reflects the latest pricing policy applicable to the estimate by selecting the valid version.

    _Surfaced assumptions:_ A-0279
  - **US-005-C-1.2.3** `[Tier D · atomic]`
    **As a** Response Builder, **I want** Populate response material_cost field, **so that** System returns validated material cost value.

    **Acceptance criteria:**
      - **AC-003** — Response field contains the resolved cost.
        - _Measurable:_ response.material_cost !== undefined

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-5 · Pass: 3_

    _Decomposition rationale:_ Finalizes the retrieval action for the user workflow by assembling the data into the expected response shape.

    _Surfaced assumptions:_ A-0279
##### US-005-C-1.3 `[Tier C · pending]`

**As a** Cost Aggregator, **I want** Compute total line item cost by summing labor hours * rate and material cost, **so that** System produces a final cost value stored in the estimate record before persistence.

**Acceptance criteria:**
  - **AC-1.3** — Computed total equals sum of component costs.
    - _Measurable:_ estimate.line_item.cost === (labor_rate * labor_hours) + (material_cost * material_qty)

_Status: pending · Priority: high · Tier: C · Traces to: UJ-5, ENT-ESTIMATE · Pass: 2_

_Decomposition rationale:_ This child defines the arithmetic logic (C) that combines the fetched components. It ensures accuracy before persistence, aligning with the parent AC-1.1 requirement.

_Surfaced assumptions:_ A-0088, A-0089, A-0090, A-0091

  - **US-005-C-1.3.1** `[Tier C · pending]`
    **As a** Input Validator, **I want** Ensure component values (labor, material) are available from source records before calculation, **so that** Calculation proceeds with valid inputs or known defaults.

    **Acceptance criteria:**
      - **AC-1.3.1-1** — Input values for labor and material are retrieved from Price Book or default rules apply
        - _Measurable:_ Input values exist OR default_zero_flag is true for all missing Price Book entries

    _Status: pending · Priority: critical · Tier: C · Traces to: US-005-C-1.1, US-005-C-1.2, A-0089 · Pass: 3_

    _Decomposition rationale:_ Ensures the calculation (1.3) depends on valid inputs provided by siblings (1.1, 1.2). This binds the scope to the existence of source data or defaults, preventing runtime errors during math.

    _Surfaced assumptions:_ A-0280, A-0281, A-0282
  - **US-005-C-1.3.2** `[Tier C · pending]`
    **As a** Math Engine, **I want** Execute the summation formula for line item cost, **so that** Intermediate numeric result computed using high-precision arithmetic.

    **Acceptance criteria:**
      - **AC-1.3.2-1** — Result matches the algebraic sum of valid inputs
        - _Measurable:_ computed_value === (labor_rate * labor_hours) + (material_cost * material_qty) at commit time

    _Status: pending · Priority: critical · Tier: C · Traces to: US-005-C-1.1, US-005-C-1.2, UJ-5 · Pass: 3_

    _Decomposition rationale:_ Commits to the core functional operation. This child validates that the system actually performs the arithmetic logic defined in the parent's business rule.

    _Surfaced assumptions:_ A-0280, A-0281, A-0282
  - **US-005-C-1.3.3** `[Tier C · pending]`
    **As a** Precision Handler, **I want** Apply currency rounding rules to the computed result, **so that** Final cost value stored with correct decimal precision.

    **Acceptance criteria:**
      - **AC-1.3.3-1** — Result is rounded to two decimal places using standard half-up rounding
        - _Measurable:_ abs(rounded_value - intermediate_value) <= 0.005 and decimal_digits == 2

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-ESTIMATE, COMP-5 · Pass: 3_

    _Decomposition rationale:_ Ensures the financial value stored is consistent with accounting standards and does not introduce floating-point errors or precision drifts.

    _Surfaced assumptions:_ A-0280, A-0281, A-0282
  - **US-005-C-1.3.4** `[Tier C · pending]`
    **As a** Audit Logger, **I want** Record calculation event for audit trail, **so that** Irreversible record of the cost calculation exists in the audit log.

    **Acceptance criteria:**
      - **AC-1.3.4-1** — Audit entry created with inputs, formula, and result
        - _Measurable:_ count(ENT-AUDIT-LOG-ENTRY) > 0 after calculation completes

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-5, ENT-AUDIT-LOG-ENTRY, COMP-5 · Pass: 3_

    _Decomposition rationale:_ Satisfies compliance obligations for financial transactions (COMP-5) by logging the calculation state, ensuring auditability for future reconciliations.

    _Surfaced assumptions:_ A-0280, A-0281, A-0282
  - **US-005-C-1.3.5** `[Tier C · pending]`
    **As a** Transaction Coordinator, **I want** Coordinate calculation within a single transactional unit, **so that** Read and write of estimate state are atomic.

    **Acceptance criteria:**
      - **AC-1.3.5-1** — Reads and writes occur without concurrent interference or lost updates
        - _Measurable:_ Transaction isolation level ensures no other transaction modifies ENT-ESTIMATE during calculation window

    _Status: pending · Priority: medium · Tier: C · Traces to: ENT-ESTIMATE, ENT-CLIENT-LEDGER · Pass: 3_

    _Decomposition rationale:_ Protects the integrity of the estimate record before persistence (1.4), ensuring data consistency and preventing race conditions during the cost aggregation process.

    _Surfaced assumptions:_ A-0280, A-0281, A-0282
##### US-005-C-1.4 `[Tier D · atomic]`

**As a** Estimate Cost Persister, **I want** Save calculated cost line item to the Estimate record in the database, **so that** The Estimate record is updated with the finalized cost values in the journal.

**Acceptance criteria:**
  - **AC-1.4** — Cost data persisted matches calculated total.
    - _Measurable:_ estimated_row.cost === calculated_total AND estimated_row.updated_at === CURRENT_TIMESTAMP

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-5, ENT-ESTIMATE · Pass: 2_

_Decomposition rationale:_ This is a leaf operation (D) representing the terminal step of the calculation process. It is atomic and individually testable against the calculated state.

_Surfaced assumptions:_ A-0088, A-0089, A-0090, A-0091

#### US-005-C-2 `[Tier C · pending]`

**As a** Notification Trigger, **I want** Initiate delivery of estimate alert to Homeowner contact channel, **so that** Homeowner receives estimate details within the 10-minute window specified.

**Acceptance criteria:**
  - **AC-1.2** — Notification timestamp is within 10 minutes of estimate submission.
    - _Measurable:_ notification.sent_timestamp - estimate.created_timestamp <= 10 minutes

_Status: pending · Priority: high · Tier: C · Traces to: UJ-5, ENT-ESTIMATE, ENT-NOTIFICATION · Pass: 1_

_Decomposition rationale:_ AC-009 requires a system-side action; this child commits to the delivery mechanism and latency SLA.

_Surfaced assumptions:_ A-0011, A-0012, A-0013

##### FR-005-C-2-1 `[Tier C · pending]`

**As a** Trigger Listener, **I want** Detect estimate creation event, **so that** System identifies the moment the estimate status transitions to 'submitted'.

**Acceptance criteria:**
  - **AC-1.2-1** — System detects the 'submitted' state change.
    - _Measurable:_ Event emitter fires on `estimate.created_timestamp` update.

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, ENT-ESTIMATE · Pass: 2_

_Decomposition rationale:_ The parent requires detecting the specific event that triggers the notification; this child binds the system to the creation event source.

_Surfaced assumptions:_ A-0092, A-0093

  - **FR-005-C-2-1.1** `[Tier C · pending]`
    **As a** Listener Engine, **I want** subscribe to timestamp delta events on estimate entity, **so that** Event listener binds to database trigger on ENT-ESTIMATE.

    **Acceptance criteria:**
      - **AC-001** — Listener fires on every change to estimate.created_timestamp.
        - _Measurable:_ DBOS scheduler detects state delta for ENT-ESTIMATE at t+0ms

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, ENT-ESTIMATE, FR-005-C-2-2 · Pass: 3_

    _Decomposition rationale:_ Binding the listener directly to the trigger source ensures no latency between submission and detection; this commits the technical approach to change data capture.

    _Surfaced assumptions:_ A-0283, A-0284
  - **FR-005-C-2-1.2** `[Tier D · atomic]`
    **As a** Validation Logic, **I want** validate transition delta against 'submitted' constant, **so that** System confirms event represents valid status transition.

    **Acceptance criteria:**
      - **AC-002** — Only updates where new_status equals 'submitted' trigger the event.
        - _Measurable:_ if previous_status !== 'submitted' AND new_status == 'submitted' THEN fire_event()

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-5, ENT-ESTIMATE, FR-005-C-2-4 · Pass: 3_

    _Decomposition rationale:_ Leaf operation that defines the specific verification rule for the state change, preventing phantom triggers from draft updates or internal admin edits.

    _Surfaced assumptions:_ A-0283, A-0284
  - **FR-005-C-2-1.3** `[Tier C · pending]`
    **As a** Event Dispatcher, **I want** emit detection event to durable queue, **so that** Event object pushed to DBOS workflow engine.

    **Acceptance criteria:**
      - **AC-003** — Detection event is queued within system window.
        - _Measurable:_ Queue depth increases by 1 atomically on detection success

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, ENT-NOTIFICATION, FR-005-C-2-4 · Pass: 3_

    _Decomposition rationale:_ Commits the technical approach for fan-out; this decision impacts downstream scaling and ordering guarantees.

    _Surfaced assumptions:_ A-0283, A-0284
  - **FR-005-C-2-1.4** `[Tier D · atomic]`
    **As a** Audit Logger, **I want** record detection timestamp to audit trail, **so that** Audit entry created proving detection occurred.

    **Acceptance criteria:**
      - **AC-004** — Audit log entry contains detection_id and timestamp.
        - _Measurable:_ count(audit_logs WHERE event_type='detection') >= 1 for every successful event

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-AUDIT-LOG-ENTRY, FR-005-C-2-5 · Pass: 3_

    _Decomposition rationale:_ Atomic action required for forensic verification of system compliance and integrity.

    _Surfaced assumptions:_ A-0283, A-0284
  - **FR-005-C-2-1.5** `[Tier B · pending]`
    **As a** Scope Policy, **I want** filter events by active job status, **so that** System excludes inactive estimates from detection.

    **Acceptance criteria:**
      - **AC-005** — Detection scope limited to estimates in Phase 2.
        - _Measurable:_ filter(status == 'submitted') AND filter(job_status in ('active', 'in_progress'))

    _Status: pending · Priority: medium · Tier: B · Traces to: UJ-5, ENT-ESTIMATE, FR-005-C-2-3 · Pass: 3_

    _Decomposition rationale:_ Defines the boundary of what 'submitted' means for this listener, committing to exclude cancelled or draft estimates.

    _Surfaced assumptions:_ A-0283, A-0284
##### FR-005-C-2-2 `[Tier C · pending]`

**As a** Channel Resolvers, **I want** Resolve active contact channel for user, **so that** A valid channel identifier (Email/SMS/Push) is retrieved for the Homeowner.

**Acceptance criteria:**
  - **AC-1.2-2** — Valid channel ID is retrieved from user profile.
    - _Measurable:_ Query `ENT-USER.contact_channels` returns exactly one active provider before enqueue.

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, ENT-USER, ENT-NOTIFICATION · Pass: 2_

_Decomposition rationale:_ Before delivery, the system must determine where the notification is sent; this child commits to querying the user entity.

_Surfaced assumptions:_ A-0092, A-0093

  - **FR-005-C-2-2.1** `[Tier C · pending]`
    **As a** Database Layer, **I want** Query and filter ENT-USER.contact_channels for active status, **so that** Raw list of channel objects filtered by 'is_active' flag and token validity.

    **Acceptance criteria:**
      - **AC-001** — Query result excludes expired or deleted channel records.
        - _Measurable:_ SELECT * FROM ENT-USER.contact_channels WHERE status = 'active' AND token_expiry > NOW()

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-USER, UJ-5, FR-005-C-2-1 · Pass: 3_

    _Decomposition rationale:_ This child commits to the specific data access logic required to identify candidates, distinguishing it from the query intent in the parent.

    _Surfaced assumptions:_ A-0285, A-0286, A-0287
  - **FR-005-C-2-2.2** `[Tier B · pending]`
    **As a** Strategy, **I want** Apply channel preference priority ordering to resolved list, **so that** Single channel ID is selected from the filtered list based on configured preference.

    **Acceptance criteria:**
      - **AC-002** — System returns the highest priority channel if multiple are active.
        - _Measurable:_ SELECT channel_id FROM (SELECT channel_id, priority_rank FROM filtered_channels ORDER BY priority_rank LIMIT 1) AS ranked

    _Status: pending · Priority: high · Tier: B · Traces to: ENT-NOTIFICATION, FR-005-C-2-3 · Pass: 3_

    _Decomposition rationale:_ This child expresses a policy choice (how to pick 'one' provider) which is a commitment (Tier B) rather than a simple implementation detail.

    _Surfaced assumptions:_ A-0285, A-0286, A-0287
  - **FR-005-C-2-2.3** `[Tier C · pending]`
    **As a** Exception Handling, **I want** Raise workflow error when no active channel is found in profile, **so that** System does not enqueue notification and logs an audit failure for missing channel.

    **Acceptance criteria:**
      - **AC-003** — Notification is not enqueued if the selected list is empty.
        - _Measurable:_ IF resolved_channel_list IS EMPTY THEN return ERROR_CODE_MISSING_CONTACT

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-NOTIFICATION, FR-005-C-2-4 · Pass: 3_

    _Decomposition rationale:_ This child commits to the specific failure behavior required to satisfy the AC of returning 'a valid' channel, ensuring the parent outcome is met under edge cases.

    _Surfaced assumptions:_ A-0285, A-0286, A-0287
##### FR-005-C-2-3 `[Tier C · pending]`

**As a** Payload Builder, **I want** Compose notification message body, **so that** Message template is populated with estimate details and sent to queue.

**Acceptance criteria:**
  - **AC-1.2-3** — Message body matches template schema.
    - _Measurable:_ Generated JSON payload validates against `ENT-NOTIFICATION-TEMPLATE` schema.

_Status: pending · Priority: high · Tier: C · Traces to: UJ-5, ENT-NOTIFICATION · Pass: 2_

_Decomposition rationale:_ Content accuracy is required before dispatch; this child binds the data injection process.

_Surfaced assumptions:_ A-0092, A-0093

  - **FR-005-C-2-3.1** `[Tier C · pending]`
    **As a** Data Resoler, **I want** Fetch Estimate details and select template variant, **so that** Payload contains concrete values mapped to template placeholders.

    **Acceptance criteria:**
      - **AC-001** — Template ID and Estimate fields are resolved.
        - _Measurable:_ Payload.template_id === ENT-NOTIFICATION-TEMPLATE.id AND all estimated fields populated.

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-005-C-2-2, UJ-5 · Pass: 3_

    _Decomposition rationale:_ Binding the selection and resolution steps ensures data availability before schema validation occurs.

    _Surfaced assumptions:_ A-0288
  - **FR-005-C-2-3.2** `[Tier C · pending]`
    **As a** Schema Validator, **I want** Validate constructed payload against notification schema, **so that** Generated JSON payload validates against ENT-NOTIFICATION-TEMPLATE schema.

    **Acceptance criteria:**
      - **AC-002** — Payload passes schema validation.
        - _Measurable:_ JSON.parse(payload).structure === ENT-NOTIFICATION-TEMPLATE.schema

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-005-C-2-4 · Pass: 3_

    _Decomposition rationale:_ Schema validation is required before queuing to ensure downstream consumers (FR-005-C-2-4) do not reject messages.

    _Surfaced assumptions:_ A-0288
  - **FR-005-C-2-3.3** `[Tier D · atomic]`
    **As a** Serializer, **I want** Encode payload to UTF-8 JSON string, **so that** Message ready for transmission to the notification queue.

    **Acceptance criteria:**
      - **AC-003** — Payload is valid UTF-8 string.
        - _Measurable:_ Buffer.encoding(payload).charSet === 'utf-8'

    _Status: atomic · Priority: high · Tier: D · Traces to: FR-005-C-2-4 · Pass: 3_

    _Decomposition rationale:_ Serialization is the final preparation step for the queue consumer (FR-005-C-2-4), making this an atomic leaf operation.

    _Surfaced assumptions:_ A-0288
##### FR-005-C-2-4 `[Tier C · pending]`

**As a** Queue Dispatcher, **I want** Enqueue notification for async delivery, **so that** Delivery task is scheduled within the system queue.

**Acceptance criteria:**
  - **AC-1.2-4** — Notification entry exists in dispatch queue.
    - _Measurable:_ Row inserted into `notification_queue` table with `created_at` matching `estimate.created_timestamp`.

_Status: pending · Priority: high · Tier: C · Traces to: UJ-5, ENT-NOTIFICATION · Pass: 2_

_Decomposition rationale:_ This child commits to the architectural choice of async processing to ensure the 10-minute SLA is manageable.

_Surfaced assumptions:_ A-0092, A-0093

  - **FR-005-C-2-4.C-01** `[Tier C · pending]`
    **As a** Payload Validator, **I want** Validate notification payload schema and content, **so that** Ensures only structurally correct and valid notification messages enter the queue.

    **Acceptance criteria:**
      - **AC-001** — Payload matches ENT-NOTIFICATION schema
        - _Measurable:_ payload.schema_valid === true after schema validation

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-005-C-2-3, ENT-NOTIFICATION, UJ-5 · Pass: 3_

    _Decomposition rationale:_ Ensures data quality before persistence; ties directly to the composed message from sibling FR-005-C-2-3.

    _Surfaced assumptions:_ A-0289, A-0290
  - **FR-005-C-2-4.C-02** `[Tier D · atomic]`
    **As a** Queue Dispatcher, **I want** Insert notification record into dispatch queue table, **so that** A notification row is durably persisted in the queue.

    **Acceptance criteria:**
      - **AC-002** — Row inserted in notification_queue
        - _Measurable:_ NOT EXISTS(SELECT 1 FROM notification_queue WHERE id = generated_id)

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-NOTIFICATION, WF-9, A-0093 · Pass: 3_

    _Decomposition rationale:_ Defines the atomic action of the parent requirement; aligns with DBOS durability assumption A-0093.

    _Surfaced assumptions:_ A-0289, A-0290
  - **FR-005-C-2-4.C-03** `[Tier C · pending]`
    **As a** Lifecycle Manager, **I want** Configure message expiration and retry logic, **so that** Queue entries are cleaned up and retries are bounded.

    **Acceptance criteria:**
      - **AC-003** — Row contains expiration timestamp
        - _Measurable:_ expires_at IS NOT NULL AND expires_at >= NOW() - INTERVAL '24 hours'

    _Status: pending · Priority: high · Tier: C · Traces to: WF-9, TECH-6 · Pass: 3_

    _Decomposition rationale:_ Implements cleanup strategy to prevent system bloat; references DBOS workflow engine.

    _Surfaced assumptions:_ A-0289, A-0290
##### FR-005-C-2-5 `[Tier C · pending]`

**As a** Auditor, **I want** Log delivery attempt and outcome, **so that** System record created confirming whether the message was sent or failed.

**Acceptance criteria:**
  - **AC-1.2-5** — Audit entry exists for every delivery attempt.
    - _Measurable:_ Row exists in `ENT-MESSAGE-LOG` with `attempt_status` and `timestamp`.

_Status: pending · Priority: medium · Tier: C · Traces to: UJ-5, ENT-NOTIFICATION, ENT-MESSAGE-LOG · Pass: 2_

_Decomposition rationale:_ System must verify delivery compliance for audit trails; this child commits to logging behavior.

_Surfaced assumptions:_ A-0092, A-0093

  - **FR-005-C-2-5-1** `[Tier C · pending]`
    **As a** System, **I want** Record success status, **so that** Success status recorded.

    **Acceptance criteria:**
      - **AC-001** — Status field populated for success
        - _Measurable:_ status = 'sent'

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5 · Pass: 3_

    _Decomposition rationale:_ Defines specific field constraints for the audit log row.

    _Surfaced assumptions:_ A-0291, A-0292
  - **FR-005-C-2-5-2** `[Tier C · pending]`
    **As a** System, **I want** Record failure reason, **so that** Failure reason recorded.

    **Acceptance criteria:**
      - **AC-002** — Status field populated for failure
        - _Measurable:_ status = 'failed' AND error_code IS NOT NULL

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5 · Pass: 3_

    _Decomposition rationale:_ Defines specific field constraints for the audit log row.

    _Surfaced assumptions:_ A-0291, A-0292
  - **FR-005-C-2-5-3** `[Tier C · pending]`
    **As a** System, **I want** Normalize timestamp, **so that** Timestamp normalized.

    **Acceptance criteria:**
      - **AC-003** — Timestamp field normalized
        - _Measurable:_ timestamp::timestamp at time zone 'UTC'

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5 · Pass: 3_

    _Decomposition rationale:_ Defines specific field constraints for the audit log row.

    _Surfaced assumptions:_ A-0291, A-0292
  - **FR-005-C-2-5-4** `[Tier C · pending]`
    **As a** System, **I want** Persist retry count, **so that** Retry count recorded.

    **Acceptance criteria:**
      - **AC-004** — Retry count field populated
        - _Measurable:_ retry_count IS NOT NULL

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5 · Pass: 3_

    _Decomposition rationale:_ Defines specific field constraints for the audit log row.

    _Surfaced assumptions:_ A-0291, A-0292
#### US-005-D-1 `[Tier D · atomic]`

**As a** Persistence Operation, **I want** Persist the Estimate as a new record in the system, **so that** A unique ENT-ESTIMATE record is stored in the database with immutable header fields.

**Acceptance criteria:**
  - **AC-1.3** — Estimate record exists and is queryable immediately after generation.
    - _Measurable:_ SELECT COUNT(*) FROM estimates WHERE estimate_id = ? AND status = 'submitted' === 1

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-5, ENT-ESTIMATE · Pass: 1_

_Decomposition rationale:_ Atomic DB write operation. This is the leaf operation for storage; further decomposition is irrelevant for implementation.

_Surfaced assumptions:_ A-0011, A-0012, A-0013

#### US-005-B-1 `[Tier B · pending]`

**As a** Scope Boundary, **I want** Enforce that Estimates must reflect Provider-specific margin rules, **so that** System prevents estimates from using generic rates if the Provider has custom margin settings.

**Acceptance criteria:**
  - **AC-1.4** — Final quote respects configured provider margin policies.
    - _Measurable:_ final_price >= base_cost * (1 + provider_margin_config)

_Status: pending · Priority: high · Tier: B · Traces to: UJ-5, ENT-ESTIMATE, ENT-PROVIDER · Pass: 1_

_Decomposition rationale:_ This defines a policy choice (margin rules) rather than just a calculation. It dictates the rules of the estimate, not just how it is done.

_Surfaced assumptions:_ A-0011, A-0012, A-0013

##### US-005-B-1.1 `[Tier C · pending]`

**As a** Data Fetcher, **I want** Retrieve active margin configuration for requesting provider, **so that** System obtains the specific margin percentage or null if none exists.

**Acceptance criteria:**
  - **AC-B1-1** — Config is fetched successfully or null returned.
    - _Measurable:_ margin_config_value IS NOT NULL OR margin_config_value IS NULL based on ENT-PROVIDER state for UJ-5 context

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, ENT-PROVIDER, ENT-ESTIMATE · Pass: 2_

_Decomposition rationale:_ Fulfills the first step of the policy enforcement: determining what rule applies before calculation. This is a concrete implementation choice.

_Surfaced assumptions:_ A-0213, A-0214, A-0215

  - **US-005-B-1.1-A** `[Tier C · pending]`
    **As a** Validator, **I want** Validate provider active status before config fetch, **so that** Request proceeds only if provider is active or null returned.

    **Acceptance criteria:**
      - **AC-001** — Provider active state is verified.
        - _Measurable:_ ENT-PROVIDER.active_flag IS TRUE

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, ENT-PROVIDER · Pass: 3_

    _Decomposition rationale:_ Cannot fetch margin for an inactive provider; active state is a prerequisite constraint.

    _Surfaced assumptions:_ A-0516, A-0517
  - **US-005-B-1.1-B** `[Tier C · pending]`
    **As a** Data Fetcher, **I want** Read margin configuration column from provider record, **so that** Margin value retrieved or null if column absent.

    **Acceptance criteria:**
      - **AC-002** — Margin value is read from storage.
        - _Measurable:_ SELECT margin_config_value FROM ENT-PROVIDER WHERE id = ?

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-PROVIDER, ENT-ESTIMATE · Pass: 3_

    _Decomposition rationale:_ The core data retrieval step must be separated from validation logic for clear traceability.

    _Surfaced assumptions:_ A-0516, A-0517
  - **US-005-B-1.1-C** `[Tier D · atomic]`
    **As a** Response Formatter, **I want** Construct response payload with value or null, **so that** Response object contains margin_config_value field set correctly.

    **Acceptance criteria:**
      - **AC-003** — Response payload matches schema.
        - _Measurable:_ response.margin_config_value IS NOT NULL OR response.margin_config_value IS NULL

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-5, ENT-ESTIMATE · Pass: 3_

    _Decomposition rationale:_ Finalizes the operation by ensuring the consumer receives a consistent object structure.

    _Surfaced assumptions:_ A-0516, A-0517
##### US-005-B-1.2 `[Tier C · pending]`

**As a** Logic Enforcer, **I want** Apply provider-specific margin to base cost line items, **so that** Adjusted price reflects the custom margin or generic fallback.

**Acceptance criteria:**
  - **AC-B1-2** — Final price matches AC-1.4 constraint.
    - _Measurable:_ final_price >= base_cost * (1 + provider_margin_config) IF config exists ELSE final_price = generic_rate_calculation

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, US-005-C-1, ENT-ESTIMATE · Pass: 2_

_Decomposition rationale:_ Defines the core mathematical enforcement strategy. This binds the policy to specific arithmetic logic.

_Surfaced assumptions:_ A-0213, A-0214, A-0215

  - **FR-EST-MARG-1** `[Tier C · pending]`
    **As a** Logic Enforcer, **I want** Execute custom margin multiplication on base cost, **so that** Adjusted price equals base_cost multiplied by (1 + margin_config).

    **Acceptance criteria:**
      - **AC-001** — Price calculation follows provider margin formula when config is active.
        - _Measurable:_ final_price === base_cost * (1 + provider_margin_config) IF provider_margin_config IS NOT NULL

    _Status: pending · Priority: critical · Tier: C · Traces to: AC-B1-2, US-005-B-1.4, ENT-ESTIMATE · Pass: 3_

    _Decomposition rationale:_ Splits the positive path of the parent AC from the fallback path handled by sibling US-005-B-1.3; focuses on the arithmetic commitment.

    _Surfaced assumptions:_ A-0518, A-0519
  - **FR-EST-MARG-2** `[Tier C · pending]`
    **As a** Validator, **I want** Verify provider margin config availability, **so that** System determines if custom margin exists for current provider profile.

    **Acceptance criteria:**
      - **AC-002** — Null check performed before margin calculation to prevent arithmetic error.
        - _Measurable:_ provider_margin_config !== NULL AND provider_margin_config !== undefined

    _Status: pending · Priority: critical · Tier: C · Traces to: AC-B1-2, US-005-B-1.1, UJ-5 · Pass: 3_

    _Decomposition rationale:_ Implements the condition check (IF config exists) to route to either the child calculation logic or the sibling fallback logic.

    _Surfaced assumptions:_ A-0518, A-0519
  - **FR-EST-MARG-3** `[Tier C · pending]`
    **As a** Auditor, **I want** Log margin application decision in Estimate audit trail, **so that** Audit record contains margin source (custom vs generic) and config ID.

    **Acceptance criteria:**
      - **AC-003** — Margin decision metadata is persisted within the Estimate transaction.
        - _Measurable:_ audit_log_entries.count() >= 1 AND audit_log_entries[].source == 'margin_logic'

    _Status: pending · Priority: high · Tier: C · Traces to: AC-B1-2, US-005-B-1.4, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Separates the write/side-effect operation from the read/calculate logic to ensure audit integrity per existing assumption A-0011.

    _Surfaced assumptions:_ A-0518, A-0519
  - **FR-EST-MARG-4** `[Tier C · pending]`
    **As a** Constraint Enforcer, **I want** Validate margin data type and bounds before calculation, **so that** Rejects calculations using invalid margin configurations to prevent pricing anomalies.

    **Acceptance criteria:**
      - **AC-004** — Margin value must be a numeric type within expected range.
        - _Measurable:_ typeof provider_margin_config == 'number' AND provider_margin_config > -100

    _Status: pending · Priority: medium · Tier: C · Traces to: AC-B1-2, ENT-PRICE-BOOK, COMP-1 · Pass: 3_

    _Decomposition rationale:_ Implements data type safety and boundary constraints to ensure pricing stability under provider margin config variations.

    _Surfaced assumptions:_ A-0518, A-0519
##### US-005-B-1.3 `[Tier C · pending]`

**As a** Fallback Handler, **I want** Enforce generic rate fallback when custom margin is absent, **so that** System defaults to generic rate preventing generic rates from being ignored.

**Acceptance criteria:**
  - **AC-B1-3** — Uses default margin when custom is missing.
    - _Measurable:_ IF margin_config IS NULL THEN final_price = base_cost * (1 + default_generic_margin)

_Status: pending · Priority: high · Tier: C · Traces to: UJ-5, ENT-PROVIDER, ENT-ESTIMATE · Pass: 2_

_Decomposition rationale:_ Ensures the 'prevent generic rates' requirement holds even when the specific provider config is incomplete, handling the edge case.

_Surfaced assumptions:_ A-0213, A-0214, A-0215

  - **US-005-B-1.3.1** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Verify custom margin configuration absence, **so that** System confirms margin_config for the provider is NULL.

    **Acceptance criteria:**
      - **AC-001** — Custom margin configuration field is NULL for the requesting provider.
        - _Measurable:_ SELECT COUNT(*) FROM provider_margin_config WHERE provider_id = $id AND active = true returns 0

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-5, ENT-ESTIMATE, US-005-B-1.1, US-005-B-1.4 · Pass: 3_

    _Decomposition rationale:_ Atomic check to determine the condition for generic fallback; verifies the absence of a specific margin decision.

    _Surfaced assumptions:_ A-0520
  - **US-005-B-1.3.2** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Retrieve default generic margin constant, **so that** System obtains the system-wide default_generic_margin value.

    **Acceptance criteria:**
      - **AC-002** — System-wide default margin is fetched from configuration.
        - _Measurable:_ SELECT value FROM config_keys WHERE key = 'default_generic_margin' returns a non-null numeric value

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-5, ENT-ESTIMATE, US-005-B-1.1, US-005-B-1.4 · Pass: 3_

    _Decomposition rationale:_ Retrieval of the fallback value required to satisfy the fallback rule when custom is absent.

    _Surfaced assumptions:_ A-0520
  - **US-005-B-1.3.3** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Calculate final price using fallback formula, **so that** System sets final_price using the default margin arithmetic.

    **Acceptance criteria:**
      - **AC-003** — Final price matches the formula for fallback.
        - _Measurable:_ estimate.final_price == estimate.base_cost * (1 + default_generic_margin)

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-5, ENT-ESTIMATE, US-005-B-1.1, US-005-B-1.4 · Pass: 3_

    _Decomposition rationale:_ Executes the core mathematical operation mandated by the AC; the final arithmetic step before persistence.

    _Surfaced assumptions:_ A-0520
##### US-005-B-1.4 `[Tier D · atomic]`

**As a** Persistence, **I want** Persist Estimate record with applied margin metadata, **so that** Estimate stored in DB with margin decision logged.

**Acceptance criteria:**
  - **AC-B1-4** — Record saved matches calculated price.
    - _Measurable:_ stored_estimate.final_price === calculated_final_price from AC-B1-2

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-5, US-005-D-1, ENT-ESTIMATE · Pass: 2_

_Decomposition rationale:_ Atomic leaf operation ensuring the policy result is durable. Traces to sibling US-005-D-1 for persistence context.

_Surfaced assumptions:_ A-0213, A-0214, A-0215

### FR US-006 `[pending]`

**As a** Service Provider, **I want** Submit completed invoice and payment request, **so that** Provider initiates payment collection after finishing a Service Call.

**Acceptance criteria:**
  - **AC-010** — Invoice status updated
    - _Measurable:_ ENT-INVOICE status changes to submitted within 5 seconds of submission action
  - **AC-011** — Payment triggers
    - _Measurable:_ Payment request flows to ENT-PAYMENT-TRANSACTION workflow after approval

_Status: pending · Priority: high · Traces to: UJ-6, ENT-INVOICE, ENT-CLIENT-LEDGER, WF-3 · Pass: 0_

#### US-006-C-01 `[Tier C · pending]`

**As a** System Enforcer, **I want** Validate invoice data integrity before submission, **so that** Invoice data is scrubbed for required fields and math errors.

**Acceptance criteria:**
  - **AC-C01-01** — System rejects invoice with missing required fields.
    - _Measurable:_ if (invoice.requiredFields.length === 0) throw Error()

_Status: pending · Priority: high · Tier: C · Traces to: UJ-6, ENT-INVOICE · Pass: 1_

_Decomposition rationale:_ Validates data quality (UJ-6 Acceptance Criteria) before state transition, preventing downstream workflow corruption.

_Surfaced assumptions:_ A-0014, A-0015, A-0016

##### US-006-C-01.1 `[Tier C · pending]`

**As a** CAM operator, **I want** Enforce schema constraints on invoice payload, **so that** System rejects payload if any required field is missing or invalid type.

**Acceptance criteria:**
  - **AC-001.1.1** — Every field in the schema's required set is present.
    - _Measurable:_ invoice.requiredFields.every(field => invoice.data.hasOwnProperty(field)) === true

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-INVOICE, WF-3 · Pass: 2_

_Decomposition rationale:_ Schema enforcement is the foundational implementation decision for data integrity; defines the boundary of the 'Validate' commitment.

_Surfaced assumptions:_ A-0094

  - **US-006-C-01.1.1** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Check existence of fields listed in the schema's 'required' property, **so that** No invoice payload proceeds if any required field is missing from the data object.

    **Acceptance criteria:**
      - **AC-001.1.1.1** — Every field in the schema's required set is present in the payload.
        - _Measurable:_ invoice.requiredFields.every(field => invoice.data.hasOwnProperty(field)) === true

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-INVOICE, WF-3 · Pass: 3_

    _Decomposition rationale:_ Direct mapping to AC-001.1.1; defines the existence validation step distinct from type checking.

    _Surfaced assumptions:_ A-0293
  - **US-006-C-01.1.2** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Validate data type of each field against the schema's 'type' definition, **so that** No invoice payload proceeds if any field value does not match its declared type.

    **Acceptance criteria:**
      - **AC-001.1.1.2** — Every field value matches the schema's declared type (e.g., string, number, boolean).
        - _Measurable:_ typeof invoice.data[field] === schema[field].type for all non-undefined fields

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-INVOICE, WF-3 · Pass: 3_

    _Decomposition rationale:_ Distinguishes type validation from existence checks; covers the 'invalid type' clause in the parent description.

    _Surfaced assumptions:_ A-0293
  - **US-006-C-01.1.3** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Validate specific format constraints on string/date fields (e.g., length, regex, date format), **so that** No invoice payload proceeds if a field value fails specific format or length constraints.

    **Acceptance criteria:**
      - **AC-001.1.1.3** — String fields match regex patterns and length limits defined in the schema.
        - _Measurable:_ invoice.data[field].length <= schema[field].maxLength && invoice.data[field].match(schema[field].pattern)

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-INVOICE, WF-3 · Pass: 3_

    _Decomposition rationale:_ Captures advanced schema constraints (length, regex) that are distinct from basic type or existence checks.

    _Surfaced assumptions:_ A-0293
##### US-006-C-01.2 `[Tier C · pending]`

**As a** CAM operator, **I want** Enforce arithmetic invariants on financial totals, **so that** System rejects invoice if line item sum does not match calculated total.

**Acceptance criteria:**
  - **AC-001.2.1** — Line item sum matches total without rounding error.
    - _Measurable:_ Math.round(sum(lineItems)) === Math.round(invoice.total)

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-INVOICE, ENT-INVOICE-ITEM · Pass: 2_

_Decomposition rationale:_ Mathematical consistency is a distinct enforcement commitment separate from schema validation; requires high-precision arithmetic.

_Surfaced assumptions:_ A-0094

  - **US-006-C-01.2.1** `[Tier C · pending]`
    **As a** Financial Logic Commitment, **I want** Define rounding strategy for financial total aggregation, **so that** Invoice total is calculated using a deterministic rounding mode (e.g., Half-Even).

    **Acceptance criteria:**
      - **AC-001.2.1** — Aggregation uses specified rounding mode for all line item sums
        - _Measurable:_ Math.round(sum(lineItems)) === Math.round(invoice.total) where rounding mode is 'Half-Even'

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-3, ENT-INVOICE · Pass: 3_

    _Decomposition rationale:_ The parent AC uses 'Math.round', which implies a specific precision decision. This child commits to the exact algorithm to ensure consistent behavior across tenants.

    _Surfaced assumptions:_ A-0294, A-0295, A-0296, A-0297
  - **US-006-C-01.2.2** `[Tier C · pending]`
    **As a** Validation Boundary Commitment, **I want** Enforce validation timing relative to transaction commit, **so that** Validation check occurs before database write succeeds.

    **Acceptance criteria:**
      - **AC-001.2.2** — Validation completes within current DB transaction block
        - _Measurable:_ validation_timestamp <= write_timestamp in ENT-CLIENT-LEDGER for every invoice entry

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-3, ENT-CLIENT-LEDGER · Pass: 3_

    _Decomposition rationale:_ This child specifies the boundary of the invariant enforcement relative to the persistence layer, ensuring atomicity of the check and write.

    _Surfaced assumptions:_ A-0294, A-0295, A-0296, A-0297
  - **US-006-C-01.2.3** `[Tier C · pending]`
    **As a** Error Response Commitment, **I want** Generate structured rejection payload for validation failure, **so that** Client receives specific error code and correction guidance.

    **Acceptance criteria:**
      - **AC-001.2.3** — Rejection includes specific field-level error code
        - _Measurable:_ response.body.error.code === 'INV_TOTAL_MISMATCH' and response.body.error.field === 'total'

    _Status: pending · Priority: high · Tier: C · Traces to: US-006-C-01.4, ENT-NOTIFICATION · Pass: 3_

    _Decomposition rationale:_ This child implements the 'System rejects invoice' requirement by defining the exact error response structure, aligning with sibling US-006-C-01.4.

    _Surfaced assumptions:_ A-0294, A-0295, A-0296, A-0297
  - **US-006-C-01.2.4** `[Tier C · pending]`
    **As a** Audit Trace Commitment, **I want** Log validation check result to immutable audit trail, **so that** All validation failures are recorded for compliance review.

    **Acceptance criteria:**
      - **AC-001.2.4** — Audit entry created for every validation execution
        - _Measurable:_ ENT-AUDIT-LOG-ENTRY.count > 0 for every invoice validation attempt in ENT-AUDIT-LOG-ENTRY

    _Status: pending · Priority: high · Tier: C · Traces to: COMP-17, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ This child addresses the compliance and operational need to track enforcement decisions, ensuring the rejection is attributable and auditable.

    _Surfaced assumptions:_ A-0294, A-0295, A-0296, A-0297
##### US-006-C-01.3 `[Tier C · pending]`

**As a** CAM operator, **I want** Validate work order state dependencies, **so that** System rejects invoice if associated work order is not in 'Completed' state.

**Acceptance criteria:**
  - **AC-001.3.1** — Linked work order status is 'Completed'.
    - _Measurable:_ invoice.workOrderId ? workOrderRecord.status === 'Completed' : true

_Status: pending · Priority: high · Tier: C · Traces to: US-006-C-02, ENT-WORK-ORDER · Pass: 2_

_Decomposition rationale:_ Business rule consistency requires checking the lifecycle state of the parent work order; links validation to status persistence sibling.

_Surfaced assumptions:_ A-0094

  - **US-006-C-01.3.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Validate existence and linkage of Work Order Reference, **so that** No validation exception raised if workOrderId is null or resolves to existing entity.

    **Acceptance criteria:**
      - **AC-001.3.1-1** — invoice.workOrderId resolves to valid ENT-WORK-ORDER record.
        - _Measurable:_ SELECT EXISTS(1) FROM work_orders WHERE id = invoice.workOrderId returns TRUE OR invoice.workOrderId IS NULL

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-INVOICE, ENT-WORK-ORDER, TECH-6 · Pass: 3_

    _Decomposition rationale:_ Reference existence is a prerequisite to checking state; without a valid ID, state check is impossible. This commits to FK integrity logic within the validation function.

    _Surfaced assumptions:_ A-0298, A-0299, A-0300
  - **US-006-C-01.3.2** `[Tier C · pending]`
    **As a** CAM operator, **I want** Validate Work Order State Value, **so that** Validation fails if workOrder.status is not exactly 'Completed'.

    **Acceptance criteria:**
      - **AC-001.3.1-2** — workOrderRecord.status === 'Completed'
        - _Measurable:_ String equality check against persisted status field at read time: status === 'Completed' (case-sensitive)

    _Status: pending · Priority: critical · Tier: C · Traces to: US-006-C-01.4, ENT-WORK-ORDER, WF-3 · Pass: 3_

    _Decomposition rationale:_ State matching is the core policy enforcement logic. This commits to the specific string value required for valid invoicing and rules out pending or active states.

    _Surfaced assumptions:_ A-0298, A-0299, A-0300
  - **US-006-C-01.3.3** `[Tier D · atomic]`
    **As a** System Process, **I want** Execute Validation Failure Rejection, **so that** HTTP 400 or 422 returned with validation error message.

    **Acceptance criteria:**
      - **AC-001.3.1-3** — Client receives specific error payload indicating invalid work order state.
        - _Measurable:_ Response status code is 400 AND body contains field-level error for workOrderId or status

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-006-C-01.4, TECH-8 · Pass: 3_

    _Decomposition rationale:_ The action taken when validation fails is atomic. It delegates to sibling C-01.4 for the specific payload format while committing to the 4xx rejection semantics defined here.

    _Surfaced assumptions:_ A-0298, A-0299, A-0300
##### US-006-C-01.4 `[Tier C · pending]`

**As a** CAM operator, **I want** Return structured rejection response to client, **so that** Client receives specific error codes and field-level feedback for correction.

**Acceptance criteria:**
  - **AC-001.4.1** — API response returns 400 status with error schema.
    - _Measurable:_ response.status === 400 && response.errors.length > 0

_Status: pending · Priority: medium · Tier: C · Traces to: ENT-INVOICE, WF-3 · Pass: 2_

_Decomposition rationale:_ Error handling is an implementation commitment regarding API contract; ensures client can remediate specific validation failures.

_Surfaced assumptions:_ A-0094

  - **US-006-C-01.4.1** `[Tier D · atomic]`
    **As a** HTTP Controller, **I want** Set HTTP status code to 400 Bad Request, **so that** Client receives a 400 status indicating the request could not be processed.

    **Acceptance criteria:**
      - **AC-4.1.1** — Response status code is exactly 400.
        - _Measurable:_ response.status === 400

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-3 · Pass: 3_

    _Decomposition rationale:_ The HTTP status code is the immediate indicator of rejection status to the client; distinct from 500 server errors.

    _Surfaced assumptions:_ A-0301, A-0302
  - **US-006-C-01.4.2** `[Tier D · atomic]`
    **As a** Response Serializer, **I want** Generate error schema payload in JSON body, **so that** Response body contains an 'errors' array with validation details.

    **Acceptance criteria:**
      - **AC-4.1.2** — Response body is JSON and contains 'errors' array.
        - _Measurable:_ JSON.parse(response.body).errors instanceof Array

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-INVOICE · Pass: 3_

    _Decomposition rationale:_ The payload structure must be standardized to enable client-side parsing and error correlation.

    _Surfaced assumptions:_ A-0301, A-0302
  - **US-006-C-01.4.3** `[Tier D · atomic]`
    **As a** Error Content Generator, **I want** Include field-level feedback within errors array, **so that** Errors array entries specify the invalid field path and human-readable message.

    **Acceptance criteria:**
      - **AC-4.1.3** — Errors array contains objects with 'path' and 'message' properties.
        - _Measurable:_ response.errors.every(e => 'path' in e && 'message' in e)

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-INVOICE · Pass: 3_

    _Decomposition rationale:_ Field-level guidance enables the client to correct specific data issues rather than generic rejection.

    _Surfaced assumptions:_ A-0301, A-0302
#### US-006-C-02 `[Tier C · pending]`

**As a** State Manager, **I want** Persist invoice status change to submitted, **so that** Database row status updates to 'submitted'.

**Acceptance criteria:**
  - **AC-C02-01** — Status updates within 5 seconds of user action.
    - _Measurable:_ timestamp(status_update) - timestamp(submission_click) <= 5000ms

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-6, ENT-INVOICE · Pass: 1_

_Decomposition rationale:_ Directly implements AC-010 status change requirement defined in parent trace.

_Surfaced assumptions:_ A-0014, A-0015, A-0016

##### FR-US-006-C02-D01 `[Tier D · atomic]`

**As a** Persistence engine, **I want** Write status 'submitted' to ENT-INVOICE row, **so that** Invoice record status reflects 'submitted' immediately after transaction commit.

**Acceptance criteria:**
  - **AC-C02-D01-01** — Invoice status column equals 'submitted'.
    - _Measurable:_ status IN ('submitted') is true for the invoice_id referenced in the request

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-INVOICE, US-006-C-01 · Pass: 2_

_Decomposition rationale:_ Atomic write operation required to fulfill the 'submitted' state change requirement; links to sibling C-01 validation.

_Surfaced assumptions:_ A-0095, A-0096, A-0097

##### FR-US-006-C02-D02 `[Tier D · atomic]`

**As a** Audit engine, **I want** Log event to ENT-AUDIT-LOG-ENTRY, **so that** Immutable record of status change exists for compliance.

**Acceptance criteria:**
  - **AC-C02-D02-01** — Audit row created with event 'invoice_submitted'.
    - _Measurable:_ SELECT COUNT(*) FROM audit_log WHERE event_type = 'invoice_submitted' AND invoice_id = ?

_Status: atomic · Priority: high · Tier: D · Traces to: ENT-AUDIT-LOG-ENTRY, UJ-6 · Pass: 2_

_Decomposition rationale:_ Required for 'Financial audit requirements' (COMP-5) and 'Audit trail immutability' constraints; atomic append to log.

_Surfaced assumptions:_ A-0095, A-0096, A-0097

##### FR-US-006-C02-B01 `[Tier B · pending]`

**As a** Architecture commit, **I want** Enforce synchronous DBOS transaction commit, **so that** Status update persists before transaction block completion, guaranteeing 5s AC compliance.

**Acceptance criteria:**
  - **AC-C02-B01-01** — Transaction block completes without async queueing.
    - _Measurable:_ Database commit event happens before response sent to caller; no message queue buffer utilized.

_Status: pending · Priority: critical · Tier: B · Traces to: TECH-6, A-0016 · Pass: 2_

_Decomposition rationale:_ Architectural choice to honor A-0016 constraint; synchronous commit eliminates latency variance that would violate the 5s AC, distinguishing from async patterns in other workflows.

_Surfaced assumptions:_ A-0095, A-0096, A-0097

#### US-006-C-03 `[Tier C · pending]`

**As a** Workflow Orchestrator, **I want** Trigger ENT-PAYMENT-TRANSACTION workflow, **so that** Payment request enters ENT-PAYMENT-TRANSACTION state.

**Acceptance criteria:**
  - **AC-C03-01** — Workflow engine queues payment transaction request.
    - _Measurable:_ workflow_engine.queue_payment_request() returns success

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-6, WF-3, ENT-PAYMENT-TRANSACTION · Pass: 1_

_Decomposition rationale:_ Directly implements AC-011 payment trigger requirement defined in parent trace.

_Surfaced assumptions:_ A-0014, A-0015, A-0016

##### FR-US-006-C-03-1 `[Tier C · pending]`

**As a** Validation Logic, **I want** Verify payment method and gateway availability before queuing, **so that** Queue request only if payment instrument is active and gateway is reachable.

**Acceptance criteria:**
  - **AC-001** — Payment method status is active and gateway connection returns 200 OK.
    - _Measurable:_ payment_method.status === 'ACTIVE' && gateway_health.check() === true

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-6, WF-3 · Pass: 2_

_Decomposition rationale:_ Cannot trigger a payment workflow without verifying the instrument is valid; this implements the pre-condition policy.

_Surfaced assumptions:_ A-0098, A-0099

  - **FR-US-006-C-03-1.1** `[Tier C · pending]`
    **As a** Validator, **I want** Read and verify Payment Method status from Client Account, **so that** Determine if payment instrument is ACTIVE.

    **Acceptance criteria:**
      - **AC-001.1** — Payment method status matches 'ACTIVE' from authoritative source.
        - _Measurable:_ payment_method.status === 'ACTIVE' AND source === 'ENT-CLIENT-ACCOUNT'

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-6, ENT-PAYMENT-TRANSACTION · Pass: 3_

    _Decomposition rationale:_ Splits the composite validation requirement into the specific check for the payment instrument, the first prerequisite condition.

    _Surfaced assumptions:_ A-0303, A-0304, A-0305, A-0306
  - **FR-US-006-C-03-1.2** `[Tier C · pending]`
    **As a** Validator, **I want** Verify external gateway health and availability, **so that** Determine if gateway responds with 200 OK.

    **Acceptance criteria:**
      - **AC-001.2** — Gateway health check returns success status.
        - _Measurable:_ gateway_health.check() === true AND response_code === 200

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-6, WF-3, ENT-EXTERNAL-SOURCE · Pass: 3_

    _Decomposition rationale:_ Splits the composite validation requirement into the specific check for the payment gateway connectivity, the second prerequisite condition.

    _Surfaced assumptions:_ A-0303, A-0304, A-0305, A-0306
  - **FR-US-006-C-03-1.3** `[Tier C · pending]`
    **As a** State Manager, **I want** Persist validation result and eligibility flag, **so that** Update invoice/instrument state to reflect validation outcome.

    **Acceptance criteria:**
      - **AC-001.3** — Validation decision is recorded before workflow queuing.
        - _Measurable:_ state.validation_result_exists === true BEFORE workflow_queue()

    _Status: pending · Priority: high · Tier: C · Traces to: WF-3, ENT-CLIENT-LEDGER · Pass: 3_

    _Decomposition rationale:_ Complies with the constraint that status persistence occurs within a single transaction block; captures the outcome of the validation checks into a durable state before the next sibling commits.

    _Surfaced assumptions:_ A-0303, A-0304, A-0305, A-0306
##### FR-US-006-C-03-2 `[Tier D · atomic]`

**As a** Orchestration Action, **I want** Insert workflow instance into DBOS queue, **so that** Workflow engine instance created and acknowledged by DBOS.

**Acceptance criteria:**
  - **AC-002** — Workflow instance record exists in DBOS system table.
    - _Measurable:_ SELECT count(*) FROM dbos_workflows WHERE request_id = $id = 1

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-3, ENT-PAYMENT-TRANSACTION · Pass: 2_

_Decomposition rationale:_ This is the atomic action of the 'Trigger' command, representing the leaf operation of the workflow engine invocation.

_Surfaced assumptions:_ A-0098, A-0099

##### FR-US-006-C-03-3 `[Tier D · atomic]`

**As a** State Management, **I want** Persist payment request ID in invoice status, **so that** Invoice status transitions to 'PaymentInitiated' in the same transaction block.

**Acceptance criteria:**
  - **AC-003** — Invoice status updated to 'PaymentInitiated' and ID stored.
    - _Measurable:_ invoice.status === 'PaymentInitiated' && invoice.payment_request_id IS NOT NULL

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-6, US-006-C-02 · Pass: 2_

_Decomposition rationale:_ Reflects the immediate state consequence of triggering the workflow, adhering to existing constraint A-0016.

_Surfaced assumptions:_ A-0098, A-0099

##### FR-US-006-C-03-4 `[Tier D · atomic]`

**As a** Audit Logging, **I want** Write audit log entry for trigger event, **so that** Immutable audit record created for the payment transaction initiation.

**Acceptance criteria:**
  - **AC-004** — Audit log entry exists with correct initiator and timestamp.
    - _Measurable:_ SELECT count(*) FROM audit_logs WHERE event = 'payment_trigger' AND user_id = $user_id = 1

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-3 · Pass: 2_

_Decomposition rationale:_ Compliance requirement to record all state transitions; ensures forensic traceability per COMP-17.

_Surfaced assumptions:_ A-0098, A-0099

#### US-006-C-04 `[Tier C · pending]`

**As a** Accounting Interface, **I want** Create general ledger receivable entry, **so that** Client ledger reflects new receivable balance.

**Acceptance criteria:**
  - **AC-C04-01** — Ledger entry debits Client Ledger and credits Accounts Receivable.
    - _Measurable:_ sum(debits) in ledger_entries === sum(credits) in ledger_entries for the session

_Status: pending · Priority: high · Tier: C · Traces to: UJ-6, ENT-CLIENT-LEDGER · Pass: 1_

_Decomposition rationale:_ Addresses the ENT-CLIENT-LEDGER trace requirement to ensure financial integrity.

_Surfaced assumptions:_ A-0014, A-0015, A-0016

##### US-006-C-04.1 `[Tier D · atomic]`

**As a** Data Writer, **I want** Append debit entry to Client Ledger, **so that** Client Ledger balance updated with debit amount.

**Acceptance criteria:**
  - **AC-001-1** — Debit entry persists in Client Ledger table.
    - _Measurable:_ SELECT COUNT(*) FROM client_ledger WHERE type='DEBIT' AND amount=invoice_amount > 0

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-6, ENT-CLIENT-LEDGER · Pass: 2_

_Decomposition rationale:_ The parent commitment splits into specific table write operations; this child binds the debit path specifically to the Client Ledger entity, ensuring the outflow is recorded first.

_Surfaced assumptions:_ A-0100

##### US-006-C-04.2 `[Tier D · atomic]`

**As a** Data Writer, **I want** Append credit entry to Accounts Receivable, **so that** Accounts Receivable balance updated with credit amount.

**Acceptance criteria:**
  - **AC-001-2** — Credit entry persists in AR table.
    - _Measurable:_ SELECT COUNT(*) FROM accounts_receivable WHERE type='CREDIT' AND amount=invoice_amount > 0

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-6, ENT-INVOICE · Pass: 2_

_Decomposition rationale:_ The parent commitment splits into specific table write operations; this child binds the credit path specifically to the Accounts Receivable entity, ensuring the receivable liability is recorded in the second table.

_Surfaced assumptions:_ A-0100

##### US-006-C-04.3 `[Tier D · atomic]`

**As a** Validator, **I want** Verify Double-Entry Invariant, **so that** System rejects unbalanced entries or validates balance before commit.

**Acceptance criteria:**
  - **AC-001-3** — All posted debits sum equal all posted credits.
    - _Measurable:_ sum(client_ledger.debits) === sum(accounts_receivable.credits) within session

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-6 · Pass: 2_

_Decomposition rationale:_ This child implements the core accounting rule from the parent AC; it binds the verification logic that ensures the ledger remains balanced at commit time, preventing state corruption.

_Surfaced assumptions:_ A-0100

##### US-006-C-04.4 `[Tier D · atomic]`

**As a** Transaction Manager, **I want** Enforce Atomic Commit Block, **so that** Both entries persist or neither does within a single transaction.

**Acceptance criteria:**
  - **AC-001-4** — No partial persistence occurs for the GL entry.
    - _Measurable:_ Transaction rollback occurs if Child 1 or 2 fails; no orphan entries remain in journal table.

_Status: atomic · Priority: critical · Tier: D · Traces to: US-006-C-02 · Pass: 2_

_Decomposition rationale:_ This child binds the transaction boundary requirement from existing assumption A-0016; it ensures consistency by forcing atomicity, ruling out partial state writes that could lead to audit issues.

_Surfaced assumptions:_ A-0100

### FR US-007 `[pending]`

**As a** Risk Specialist, **I want** Verify contractor insurance coverage, **so that** System ensures provider meets liability requirements before dispatch.

**Acceptance criteria:**
  - **AC-012** — Insurance verification time
    - _Measurable:_ Verification completes within 24 hours of ENT-INSURANCE-POLICY upload
  - **AC-013** — Invalid insurance blocks jobs
    - _Measurable:_ Job creation fails if ENT-LIABILITY-CHECK status is invalid

_Status: pending · Priority: critical · Traces to: UJ-7, ENT-INSURANCE-POLICY, ENT-LIABILITY-CHECK, WF-4 · Pass: 0_

#### US-007-C-1 `[Tier C · pending]`

**As a** Risk Specialist, **I want** Parse uploaded insurance policy documents, **so that** Extract coverage details and expiration status into system records.

**Acceptance criteria:**
  - **AC-001** — Policy data fields are extracted accurately from uploaded files.
    - _Measurable:_ extracted_coverage_limit == policy_document.coverage_limit AND extracted_expiry_date == policy_document.expiry_date

_Status: pending · Priority: high · Tier: C · Traces to: ENT-INSURANCE-POLICY, WF-4, WF-6 · Pass: 1_

_Decomposition rationale:_ Ingestion is the primary entry point for verification data; this is a concrete implementation commitment distinct from the policy decision itself.

_Surfaced assumptions:_ A-0017, A-0018, A-0019

##### US-007-C-1-1 `[Tier B · pending]`

**As a** Engineering sub-strategy, **I want** Ingest and process documents via OCR and NLP pipelines, **so that** System supports parsing of scanned and digital policy documents.

**Acceptance criteria:**
  - **AC-101** — Uploaded files are successfully processed and text is made available for extraction.
    - _Measurable:_ Processing completes for supported formats (PDF, TIFF, PNG) within 60 seconds of upload.

_Status: pending · Priority: critical · Tier: B · Traces to: WF-6 · Pass: 2_

_Decomposition rationale:_ Defines the core ingestion strategy; without this commitment, extraction cannot proceed. Ties to WF-6 (Asset Document Ingestion).

_Surfaced assumptions:_ A-0101, A-0102, A-0103

##### US-007-C-1-2 `[Tier C · pending]`

**As a** CAM operator, **I want** Map extracted text fields to insurance policy schema, **so that** Extracted coverage limit and expiry date fields are normalized in the database.

**Acceptance criteria:**
  - **AC-102** — Extracted values match the canonical schema for insurance policies.
    - _Measurable:_ JSON output of extraction contains 'coverage_limit' and 'expiry_date' keys with correct types.

_Status: pending · Priority: high · Tier: C · Traces to: ENT-INSURANCE-POLICY · Pass: 2_

_Decomposition rationale:_ Implementation commitment to define the specific fields to extract (limit, expiry) as per AC-001. Relates to the schema of ENT-INSURANCE-POLICY.

_Surfaced assumptions:_ A-0101, A-0102, A-0103

  - **US-007-C-1-2.1** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Normalize 'coverage_limit' field to numeric type in canonical schema, **so that** Coverage limit is persisted as an integer or decimal number.

    **Acceptance criteria:**
      - **AC-102.1** — Persisted record for 'coverage_limit' is a valid number.
        - _Measurable:_ typeof record.coverage_limit === 'number' AND record.coverage_limit >= 0

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-INSURANCE-POLICY · Pass: 3_

    _Decomposition rationale:_ Decomposes the general 'Map fields' commitment into the atomic data transformation step for the coverage limit, which is an individually testable leaf operation.

    _Surfaced assumptions:_ A-0307, A-0308, A-0309
  - **US-007-C-1-2.2** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Normalize 'expiry_date' field to ISO-8601 string format, **so that** Expiry date is persisted as a standardized date string.

    **Acceptance criteria:**
      - **AC-102.2** — Persisted record for 'expiry_date' matches ISO 8601 pattern.
        - _Measurable:_ record.expiry_date matches regex '^\d{4}-\d{2}-\d{2}$' AND record.expiry_date is within valid date range

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-INSURANCE-POLICY · Pass: 3_

    _Decomposition rationale:_ Decomposes the mapping commitment into the atomic transformation step for the expiry date field, ensuring data integrity for time-series queries.

    _Surfaced assumptions:_ A-0307, A-0308, A-0309
  - **US-007-C-1-2.3** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Map extraction JSON keys to canonical schema key names, **so that** Output JSON keys match exactly 'coverage_limit' and 'expiry_date'.

    **Acceptance criteria:**
      - **AC-102.3** — Canonical keys are present in the output JSON.
        - _Measurable:_ Object.keys(record) contains 'coverage_limit' AND 'expiry_date'

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-INSURANCE-POLICY · Pass: 3_

    _Decomposition rationale:_ Ensures the structural requirement of the parent (matching the schema) is met by verifying key alignment at the leaf level.

    _Surfaced assumptions:_ A-0307, A-0308, A-0309
  - **US-007-C-1-2.4** `[Tier B · pending]`
    **As a** System Architect, **I want** Exclude unmapped or non-standard fields from canonical record persistence, **so that** Only schema-aligned fields are persisted; unknown fields are dropped or logged.

    **Acceptance criteria:**
      - **AC-102.4** — Database record contains only fields defined in the canonical insurance schema.
        - _Measurable:_ Record column set === Canonical Schema Column Set

    _Status: pending · Priority: high · Tier: B · Traces to: US-007-C-1-1, WF-6 · Pass: 3_

    _Decomposition rationale:_ This is an architectural choice regarding what constitutes a 'normalized' record. It defines the scope of persistence, distinguishing between 'valid' and 'unknown' data, which is a policy decision (Tier B) rather than a single atomic test (Tier D).

    _Surfaced assumptions:_ A-0307, A-0308, A-0309
##### US-007-C-1-3 `[Tier C · pending]`

**As a** CAM operator, **I want** Apply confidence threshold for automated acceptance, **so that** Low-confidence extractions are flagged for manual review rather than auto-storing.

**Acceptance criteria:**
  - **AC-103** — Fields below confidence threshold are excluded from auto-write to the policy record.
    - _Measurable:_ Extraction confidence score < 0.85 triggers 'manual_review' status flag.

_Status: pending · Priority: high · Tier: C · Traces to: US-007-C-2 · Pass: 2_

_Decomposition rationale:_ Connects extraction quality to the validation workflow handled by sibling US-007-C-2. Ensures low-confidence data doesn't corrupt records.

_Surfaced assumptions:_ A-0101, A-0102, A-0103

  - **US-007-C-1-3.1** `[Tier C · pending]`
    **As a** System Logic, **I want** Compare extraction confidence score against defined threshold, **so that** Binary decision determines whether to proceed with auto-write or trigger review.

    **Acceptance criteria:**
      - **AC-104** — System compares confidence score to 0.85
        - _Measurable:_ extraction_confidence >= 0.85 || extraction_confidence < 0.85

    _Status: pending · Priority: high · Tier: C · Traces to: US-007-C-2 · Pass: 3_

    _Decomposition rationale:_ This child binds the arithmetic logic of the gating mechanism, committing to the specific comparison operation required to evaluate the confidence state.

    _Surfaced assumptions:_ A-0310, A-0311
  - **US-007-C-1-3.2** `[Tier C · pending]`
    **As a** Data Integrity Guard, **I want** Suppress auto-write to policy record when confidence is low, **so that** Policy record remains unchanged pending manual review.

    **Acceptance criteria:**
      - **AC-105** — Auto-write is blocked for low confidence items
        - _Measurable:_ write_allowed == false if extraction_confidence < 0.85

    _Status: pending · Priority: critical · Tier: C · Traces to: US-007-C-2 · Pass: 3_

    _Decomposition rationale:_ This child commits to the negative constraint on database writes to ensure that potentially incorrect data is not committed to the source of record.

    _Surfaced assumptions:_ A-0310, A-0311
  - **US-007-C-1-3.3** `[Tier C · pending]`
    **As a** Workflow Dispatcher, **I want** Set status field to 'manual_review' on low confidence detection, **so that** Item is routed to the manual review queue.

    **Acceptance criteria:**
      - **AC-106** — Status flag is assigned 'manual_review' upon low confidence
        - _Measurable:_ record.status == 'manual_review' if extraction_confidence < 0.85

    _Status: pending · Priority: high · Tier: C · Traces to: US-007-C-2 · Pass: 3_

    _Decomposition rationale:_ This child commits to the specific state transition required to trigger the human intervention workflow and ensure the user sees the correct UI state.

    _Surfaced assumptions:_ A-0310, A-0311
#### US-007-C-2 `[Tier C · pending]`

**As a** Risk Specialist, **I want** Validate active status against carrier data, **so that** System records are marked 'active' only if carrier API confirms current validity.

**Acceptance criteria:**
  - **AC-002** — Status flag matches carrier API response or verified internal record.
    - _Measurable:_ recorded_status == 'active' === (carrier_response.status == 'Active' OR manual_review_approved == true)

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-INSURANCE-POLICY, WF-4, COMP-9 · Pass: 1_

_Decomposition rationale:_ Status validation is a technical implementation commitment required to satisfy the blocking logic; depends on API integration strategy.

_Surfaced assumptions:_ A-0017, A-0018, A-0019

##### US-007-C-2.1 `[Tier C · pending]`

**As a** API Integration Layer, **I want** Invoke carrier API endpoint with current policy ID, **so that** Obtains authoritative status from external source.

**Acceptance criteria:**
  - **AC-2.1-1** — API call returns status response within 30 seconds or triggers timeout sibling.
    - _Measurable:_ carrier_api_response_time <= 30000ms || triggers WF-04

_Status: pending · Priority: critical · Tier: C · Traces to: US-007-C-2, ENT-INSURANCE-POLICY, WF-4 · Pass: 2_

_Decomposition rationale:_ This child implements the primary 'carrier_response.status' branch of the parent's logic. It commits to the specific technical action of fetching data.

_Surfaced assumptions:_ A-0104, A-0105, A-0106

  - **FR-INS-2.1.1** `[Tier C · pending]`
    **As a** Request Composer, **I want** Construct request payload with policy ID and auth token, **so that** Valid carrier request is sent to external endpoint.

    **Acceptance criteria:**
      - **AC-001** — Request headers and body match carrier schema.
        - _Measurable:_ Carrier API response schema validates against payload structure at client time

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-INSURANCE-POLICY, WF-4 · Pass: 3_

    _Decomposition rationale:_ Before calling, the system must assemble the correct data (policy ID). This commits to the payload construction logic.

    _Surfaced assumptions:_ A-0312, A-0313, A-0314, A-0315
  - **FR-INS-2.1.2** `[Tier C · pending]`
    **As a** Timeout Enforcer, **I want** Enforce 30 second response time limit, **so that** Call terminates or sibling workflow triggers on expiry.

    **Acceptance criteria:**
      - **AC-002** — Call completes or fails within timeout window.
        - _Measurable:_ timestamp(response_received) - timestamp(request_sent) <= 30000ms

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-4, US-007-C-2.4 · Pass: 3_

    _Decomposition rationale:_ The parent AC explicitly defines a 30-second timeout constraint. This child commits to the verification of that time limit.

    _Surfaced assumptions:_ A-0312, A-0313, A-0314, A-0315
  - **FR-INS-2.1.3** `[Tier C · pending]`
    **As a** Resiliency Layer, **I want** Implement exponential backoff retry logic, **so that** Transient network failures are retried before failing.

    **Acceptance criteria:**
      - **AC-003** — Retry attempts do not exceed configured maximum.
        - _Measurable:_ retry_count <= 3 AND exponential_backoff_interval <= 1000ms

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-API-GATEWAY-CONN, US-007-C-2.2 · Pass: 3_

    _Decomposition rationale:_ API calls often fail transiently. This child commits to the specific retry strategy to ensure eventual consistency.

    _Surfaced assumptions:_ A-0312, A-0313, A-0314, A-0315
  - **FR-INS-2.1.4** `[Tier C · pending]`
    **As a** Status Transformer, **I want** Map carrier status codes to internal state, **so that** External 'ACTIVE' maps to internal 'verified' status.

    **Acceptance criteria:**
      - **AC-004** — Status mapping table is consistent.
        - _Measurable:_ carrier_code('ACTIVE') === internal_status('verified')

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-INSURANCE-POLICY, US-007-C-2.4 · Pass: 3_

    _Decomposition rationale:_ The response from the carrier must be translated into our internal vocabulary. This child commits to the transformation logic.

    _Surfaced assumptions:_ A-0312, A-0313, A-0314, A-0315
  - **FR-INS-2.1.5** `[Tier D · atomic]`
    **As a** Audit Scribe, **I want** Append request/response to audit log, **so that** Immutable record of the API interaction.

    **Acceptance criteria:**
      - **AC-005** — Log entry is written before response processing.
        - _Measurable:_ audit_log_timestamp <= system_timestamp

    _Status: atomic · Priority: medium · Tier: D · Traces to: ENT-AUDIT-LOG-ENTRY, WF-4 · Pass: 3_

    _Decomposition rationale:_ Security compliance requires logging every external call. This is a leaf operation verifying log integrity.

    _Surfaced assumptions:_ A-0312, A-0313, A-0314, A-0315
  - **FR-INS-2.1.6** `[Tier C · pending]`
    **As a** Error Handler, **I want** Catch 4xx and 5xx carrier errors, **so that** Errors are handled gracefully without crashing workflow.

    **Acceptance criteria:**
      - **AC-006** — Non-2xx responses trigger appropriate error state.
        - _Measurable:_ http_status_code > 200 AND http_status_code < 300 === false

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-API-GATEWAY-CONN, US-007-C-2.3 · Pass: 3_

    _Decomposition rationale:_ The system must respond correctly to carrier API failures. This child defines the classification and handling of those failures.

    _Surfaced assumptions:_ A-0312, A-0313, A-0314, A-0315
##### US-007-C-2.2 `[Tier C · pending]`

**As a** Internal State Cache Validator, **I want** Evaluate freshness and validity of existing internal record, **so that** Determines if internal record qualifies as 'verified internal record' without external call.

**Acceptance criteria:**
  - **AC-2.2-1** — Internal record accepted if last successful API sync was within 7 days (configurable).
    - _Measurable:_ timestamp(record.last_verified_at) + 7days >= timestamp(now())

_Status: pending · Priority: high · Tier: C · Traces to: US-007-C-2, US-007-C-4, ENT-INSURANCE-POLICY · Pass: 2_

_Decomposition rationale:_ This child implements the 'verified internal record' branch of the parent's logic. It defines the constraint on what constitutes a valid fallback to prevent stale data usage.

_Surfaced assumptions:_ A-0104, A-0105, A-0106

  - **US-007-C-2.2-1** `[Tier D · atomic]`
    **As a** data_reader, **I want** retrieve_last_verified_timestamp from internal storage, **so that** Current value of last_successful_api_sync timestamp retrieved.

    **Acceptance criteria:**
      - **AC-1.1** — Timestamp is retrieved from storage record.
        - _Measurable:_ Record.last_verified_at is a valid ISO-8601 datetime or null

    _Status: atomic · Priority: high · Tier: D · Traces to: US-007-C-2 · Pass: 3_

    _Decomposition rationale:_ Retrieving the stored state is the atomic prerequisite for any freshness calculation; must happen before comparison logic.

    _Surfaced assumptions:_ A-0316
  - **US-007-C-2.2-2** `[Tier D · atomic]`
    **As a** validator, **I want** compare_time_delta against configured threshold, **so that** Boolean result indicating record freshness status.

    **Acceptance criteria:**
      - **AC-1.2** — Time difference calculation matches defined rule.
        - _Measurable:_ Absolute value(now - last_verified_at) <= threshold_seconds where threshold is config value

    _Status: atomic · Priority: high · Tier: D · Traces to: US-007-C-4 · Pass: 3_

    _Decomposition rationale:_ This is the core business rule evaluation; it must be testable as a unit of logic before persistence.

    _Surfaced assumptions:_ A-0316
  - **US-007-C-2.2-3** `[Tier D · atomic]`
    **As a** writer, **I want** persist_verification_status in database, **so that** Record marked as 'verified' in internal record status.

    **Acceptance criteria:**
      - **AC-1.3** — Status flag reflects validation outcome.
        - _Measurable:_ Record.verification_status is 'verified' if check passed, else 'pending'

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-007-C-2.4 · Pass: 3_

    _Decomposition rationale:_ This is the terminal action that updates the system state to reflect the result of the validation logic; aligns with sibling 2.4's status column update.

    _Surfaced assumptions:_ A-0316
##### US-007-C-2.3 `[Tier C · pending]`

**As a** Risk Specialist Override Handler, **I want** Accept and persist manual_review_approved flag input, **so that** Status flag becomes 'active' regardless of API response when flag is set.

**Acceptance criteria:**
  - **AC-2.3-1** — Flag is valid only when authenticated Risk Specialist submits it via console.
    - _Measurable:_ actor.role === 'Risk_Specialist' && actor.permissions.include('override_status')

_Status: pending · Priority: critical · Tier: C · Traces to: US-007-C-2, WF-4, ENT-ROLE · Pass: 2_

_Decomposition rationale:_ This child implements the 'manual_review_approved == true' branch. It commits to the specific security and role access constraints required for this override path.

_Surfaced assumptions:_ A-0104, A-0105, A-0106

  - **US-007-C-2.3-1** `[Tier C · pending]`
    **As a** Security Gate, **I want** Validate Risk Specialist authorization before allowing override, **so that** System blocks access if user lacks 'override_status' permission.

    **Acceptance criteria:**
      - **AC-2.3-1** — Request is denied unless actor matches role criteria.
        - _Measurable:_ verify(actor.role === 'Risk_Specialist' && actor.permissions.include('override_status')) returns true before proceeding

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-ROLE, US-007-C-2 · Pass: 3_

    _Decomposition rationale:_ Enforces the security boundary (who) required before any state mutation can occur.

    _Surfaced assumptions:_ A-0317, A-0318
  - **US-007-C-2.3-2** `[Tier D · atomic]`
    **As a** State Mutation, **I want** Write manual_review_approved flag to storage, **so that** Flag state persists in the record regardless of external API response.

    **Acceptance criteria:**
      - **AC-2.3-2** — Record contains flag set to true.
        - _Measurable:_ record.manual_review_approved === true after commit

    _Status: atomic · Priority: high · Tier: D · Traces to: WF-4, ENT-WORK-ORDER · Pass: 3_

    _Decomposition rationale:_ Concrete data persistence action; the 'leaf' action of the override mechanism.

    _Surfaced assumptions:_ A-0317, A-0318
  - **US-007-C-2.3-3** `[Tier D · atomic]`
    **As a** Logic Branch, **I want** Update record status to 'active' when flag is set, **so that** Status flag becomes active to enable subsequent workflow steps.

    **Acceptance criteria:**
      - **AC-2.3-3** — Status field value matches active state.
        - _Measurable:_ record.status === 'active' when manual_review_approved is true

    _Status: atomic · Priority: high · Tier: D · Traces to: WF-4, ENT-CLIENT-LEDGER · Pass: 3_

    _Decomposition rationale:_ Direct implementation of the functional consequence requested in the parent requirement.

    _Surfaced assumptions:_ A-0317, A-0318
  - **US-007-C-2.3-4** `[Tier C · pending]`
    **As a** Audit Handler, **I want** Create immutable audit log entry for the override event, **so that** Audit trail documents user, timestamp, and reason for override.

    **Acceptance criteria:**
      - **AC-2.3-4** — Audit entry exists and is immutable.
        - _Measurable:_ ENT-AUDIT-LOG-ENTRY contains user_id, override_flag, and timestamp

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-12, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Ensures compliance and forensics for high-risk bypass actions.

    _Surfaced assumptions:_ A-0317, A-0318
##### US-007-C-2.4 `[Tier D · atomic]`

**As a** Record Persistence Agent, **I want** Update recorded_status column in database, **so that** System state reflects current validation outcome.

**Acceptance criteria:**
  - **AC-2.4-1** — Database write commits successfully or rolls back on constraint violation.
    - _Measurable:_ transaction.commit_result === SUCCESS || transaction.rollback_reason !== NULL

_Status: atomic · Priority: critical · Tier: D · Traces to: US-007-C-2, ENT-INSURANCE-POLICY · Pass: 2_

_Decomposition rationale:_ This is the terminal leaf operation where the validation outcome is stored. It is atomic and testable without further decomposition.

_Surfaced assumptions:_ A-0104, A-0105, A-0106

#### US-007-C-3 `[Tier C · pending]`

**As a** Risk Specialist, **I want** Enforce dispatch blocking on invalid records, **so that** Work order creation fails when insurance status is 'invalid' or missing.

**Acceptance criteria:**
  - **AC-003** — Job creation request returns error when insurance check fails.
    - _Measurable:_ job_creation_response == 'ERROR' === (ENT-LIABILITY-CHECK.status == 'invalid') AND (ENT-LIABILITY-CHECK.status == 'invalid' === (AC-013 is satisfied))

_Status: pending · Priority: critical · Tier: C · Traces to: WF-4, ENT-LIABILITY-CHECK, COMP-13 · Pass: 1_

_Decomposition rationale:_ This is the direct implementation of AC-013, translating the policy requirement into a concrete workflow gatekeeper behavior.

_Surfaced assumptions:_ A-0017, A-0018, A-0019

##### US-007-C-3-1 `[Tier C · pending]`

**As a** Service Layer Validator, **I want** Query ENT-LIABILITY-CHECK record synchronously before persisting work order, **so that** Work order insertion is rejected if record exists with status 'invalid' or null.

**Acceptance criteria:**
  - **AC-013-1** — Work order creation endpoint throws HTTP 400 if insurance check fails.
    - _Measurable:_ If (ENT-LIABILITY-CHECK.status == 'invalid' OR ENT-LIABILITY-CHECK.status == null) THEN response.status == 'ERROR' === true

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-LIABILITY-CHECK, WF-2 · Pass: 2_

_Decomposition rationale:_ Defines the specific service-layer validation hook that enforces the parent rule; distinguishes from C-2 (data extraction) by enforcing the blocking state.

_Surfaced assumptions:_ A-0107, A-0108, A-0109

  - **US-007-C-3-1.1** `[Tier C · pending]`
    **As a** Backend Validator, **I want** Execute synchronous query to retrieve ENT-LIABILITY-CHECK record, **so that** Obtain current status value or detect API failure/timeout.

    **Acceptance criteria:**
      - **AC-001** — Status value is retrieved or null is returned.
        - _Measurable:_ query_result.status is present OR query_result.status is null

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-LIABILITY-CHECK · Pass: 3_

    _Decomposition rationale:_ Specific API call to fetch the validation record; separates retrieval from logic evaluation.
  - **US-007-C-3-1.2** `[Tier C · pending]`
    **As a** Business Logic, **I want** Evaluate status values against blocking predicates, **so that** Generate boolean flag indicating whether request is blocked.

    **Acceptance criteria:**
      - **AC-002** — Block flag is true for invalid or null status.
        - _Measurable:_ if (status == 'invalid' OR status == null) then block_flag === true

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-2 · Pass: 3_

    _Decomposition rationale:_ Applies the business rule derived from parent AC-013-1 to determine enforcement status.
  - **US-007-C-3-1.3** `[Tier D · atomic]`
    **As a** Transaction Controller, **I want** Abort Work Order persistence operation, **so that** Database write transaction is cancelled, HTTP 400 response prepared.

    **Acceptance criteria:**
      - **AC-003** — Work order record is not persisted.
        - _Measurable:_ db_count(work_orders_new) increases by 0 if block_flag is true

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-2 · Pass: 3_

    _Decomposition rationale:_ Leaf operation representing the terminal enforcement action that prevents state mutation.
##### US-007-C-3-2 `[Tier C · pending]`

**As a** Error Response Composer, **I want** Construct error payload referencing compliance violation type, **so that** Response body contains specific error code (e.g., 'INS_INVALID') and human-readable message.

**Acceptance criteria:**
  - **AC-013-2** — Error payload structure matches error-schema v1.
    - _Measurable:_ response.body.errors[0].code === 'INS_INVALID' AND response.body.errors[0].message includes 'Insurance'

_Status: pending · Priority: high · Tier: C · Traces to: COMP-13, COMP-12 · Pass: 2_

_Decomposition rationale:_ Translates the internal invalid-state check into a standardized external signal for the client application; ensures API contract consistency.

_Surfaced assumptions:_ A-0107, A-0108, A-0109

  - **FR-ACCT-1.1** `[Tier C · pending]`
    **As a** error_code_writer, **I want** set the application error code to 'INS_INVALID' for insurance violations, **so that** Client receives specific error code 'INS_INVALID' when insurance validation fails.

    **Acceptance criteria:**
      - **AC-001** — If insurance check fails, response code is 'INS_INVALID'.
        - _Measurable:_ response.body.errors[0].code === 'INS_INVALID' for failed insurance validation requests

    _Status: pending · Priority: critical · Tier: C · Traces to: COMP-12 · Pass: 3_

    _Decomposition rationale:_ Maps the specific violation type (insurance) to a standardized error code string, enforcing a consistent API contract.

    _Surfaced assumptions:_ A-0319, A-0320
  - **FR-ACCT-1.2** `[Tier C · pending]`
    **As a** error_message_generator, **I want** compose human-readable message including 'Insurance' violation context, **so that** Client receives a clear explanation mentioning insurance in the error message.

    **Acceptance criteria:**
      - **AC-002** — Error message includes the word 'Insurance'.
        - _Measurable:_ response.body.errors[0].message.includes('Insurance') for failed insurance validation requests

    _Status: pending · Priority: high · Tier: C · Traces to: COMP-13 · Pass: 3_

    _Decomposition rationale:_ Ensures the error message provides actionable context to the operator regarding why the job was blocked, specifically referencing the insurance constraint.

    _Surfaced assumptions:_ A-0319, A-0320
  - **FR-ACCT-1.3** `[Tier C · pending]`
    **As a** schema_validator, **I want** validate response structure against error-schema v1, **so that** Response body strictly conforms to the defined error-schema v1 structure.

    **Acceptance criteria:**
      - **AC-003** — Response structure matches error-schema v1.
        - _Measurable:_ jsonschema.validate(response.body.errors, schema_v1) === true

    _Status: pending · Priority: critical · Tier: C · Traces to: US-007-C-3-2 · Pass: 3_

    _Decomposition rationale:_ Enforces consistency and compatibility with client expectations by pinning to a specific version of the error schema.

    _Surfaced assumptions:_ A-0319, A-0320
##### US-007-C-3-3 `[Tier D · atomic]`

**As a** Audit Event Writer, **I want** Write block event to ENT-AUDIT-LOG-ENTRY, **so that** Immutable log entry created with reason='insurance_check_failed' and timestamp.

**Acceptance criteria:**
  - **AC-013-3** — Audit log entry persists within 50ms of validation failure.
    - _Measurable:_ audit_log_entries[0].timestamp >= event_start_timestamp AND audit_log_entries[0].status === 'COMMIT'

_Status: atomic · Priority: medium · Tier: D · Traces to: ENT-AUDIT-LOG-ENTRY, WF-2 · Pass: 2_

_Decomposition rationale:_ Creates the atomic verification step ensuring the blocking decision is recorded for compliance reviews; distinguishes from C-2 which handles the data query.

_Surfaced assumptions:_ A-0107, A-0108, A-0109

#### US-007-C-4 `[Tier C · pending]`

**As a** System, **I want** Handle verification timeout scenarios, **so that** System defaults to blocking or alerts Staff when verification exceeds 24 hours.

**Acceptance criteria:**
  - **AC-004** — Staff notification is sent and status flags as 'timeout' after 24h.
    - _Measurable:_ NOTIFICATION.sent_time <= NOW + 24h AND ENT-LIABILITY-CHECK.status == 'timeout' === (timestamp - upload_time > 24h)

_Status: pending · Priority: medium · Tier: C · Traces to: COMP-2, ENT-NOTIFICATION, AC-012 · Pass: 1_

_Decomposition rationale:_ AC-012 requires a specific handling strategy for timeouts; this child commits to the behavior when the verification process takes too long.

_Surfaced assumptions:_ A-0017, A-0018, A-0019

##### FR-ACCT-T-001 `[Tier D · atomic]`

**As a** System Scheduler, **I want** Evaluate elapsed time since verification start for each liability check record, **so that** Each verification record is flagged for timeout if elapsed time exceeds 24 hours.

**Acceptance criteria:**
  - **AC-T-001** — Verification duration check triggers on every scheduled scan or event.
    - _Measurable:_ elapsed_time := timestamp - upload_time; flag == 'timeout' if elapsed_time > 24h

_Status: atomic · Priority: critical · Tier: D · Traces to: COMP-2, ENT-LIABILITY-CHECK · Pass: 2_

_Decomposition rationale:_ Time evaluation is the atomic condition check required to determine if the 24h threshold is met.

_Surfaced assumptions:_ A-0110

##### FR-ACCT-T-002 `[Tier D · atomic]`

**As a** Data Persistence, **I want** Update status field to 'timeout' on the liability check entity, **so that** System record state changes to 'timeout' for verification attempts over 24h.

**Acceptance criteria:**
  - **AC-T-002** — Status field contains 'timeout' value immediately after threshold check.
    - _Measurable:_ ENT-LIABILITY-CHECK.status == 'timeout' at commit time

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-LIABILITY-CHECK, COMP-2 · Pass: 2_

_Decomposition rationale:_ State persistence is the atomic write operation that reflects the timeout decision in the database.

_Surfaced assumptions:_ A-0110

##### FR-ACCT-T-003 `[Tier D · atomic]`

**As a** Communication Service, **I want** Trigger notification queue with timeout alert payload, **so that** Staff member receives alert message via configured channels for verification failure.

**Acceptance criteria:**
  - **AC-T-003** — Notification sent to Staff within system latency limits.
    - _Measurable:_ NOTIFICATION.sent_time <= NOW + 24h AND notification.template_id == 'timeout_alert'

_Status: atomic · Priority: high · Tier: D · Traces to: ENT-NOTIFICATION, UJ-7 · Pass: 2_

_Decomposition rationale:_ Notification delivery is the atomic service invocation required to inform Staff of the timeout state.

_Surfaced assumptions:_ A-0110

##### FR-ACCT-T-004 `[Tier D · atomic]`

**As a** Field Ops Logic, **I want** Apply dispatch blocking constraint on associated work orders, **so that** New work orders cannot be dispatched if parent liability check is 'timeout'.

**Acceptance criteria:**
  - **AC-T-004** — Work order dispatch fails if linked liability check status is 'timeout'.
    - _Measurable:_ WF-9.dispatch_blocked == true if ENT-LIABILITY-CHECK.status == 'timeout'

_Status: atomic · Priority: critical · Tier: D · Traces to: US-007-C-3, COMP-13 · Pass: 2_

_Decomposition rationale:_ Blocking logic is the atomic enforcement step to prevent execution on expired verification.

_Surfaced assumptions:_ A-0110

#### US-007-C-5 `[Tier C · pending]`

**As a** Auditor, **I want** Log verification event details to audit trail, **so that** Every verification attempt (success/fail) is recorded in immutable audit log.

**Acceptance criteria:**
  - **AC-005** — Audit entry is created immediately after verification logic executes.
    - _Measurable:_ count(ENT-AUDIT-LOG-ENTRY.filter(user_role == 'Risk Specialist' AND resource == 'US-007')) == verification_attempts

_Status: pending · Priority: high · Tier: C · Traces to: COMP-17, ENT-AUDIT-LOG-ENTRY, WF-4 · Pass: 1_

_Decomposition rationale:_ Compliance requires auditability of risk decisions; this commits to the implementation of the logging mechanism for this workflow.

_Surfaced assumptions:_ A-0017, A-0018, A-0019

##### US-007-C-5.1 `[Tier D · atomic]`

**As a** Audit Operator, **I want** Persist verification event record to audit log storage, **so that** A record exists in the audit log for every verification attempt.

**Acceptance criteria:**
  - **AC-001** — Audit entry is persisted within the verification transaction.
    - _Measurable:_ ENT-AUDIT-LOG-ENTRY exists with timestamp <= verification_execution_time + 1ms

_Status: atomic · Priority: critical · Tier: D · Traces to: COMP-17, ENT-AUDIT-LOG-ENTRY, WF-4 · Pass: 2_

_Decomposition rationale:_ This is the fundamental atomic action required to satisfy the logging requirement; without this operation the commitment cannot be verified.

_Surfaced assumptions:_ A-0111, A-0112

##### US-007-C-5.2 `[Tier C · pending]`

**As a** Database Architect, **I want** Enforce immutability constraint on audit log storage, **so that** Audit entries cannot be deleted or overwritten after creation.

**Acceptance criteria:**
  - **AC-002** — System rejects any write attempt to modify an existing audit entry.
    - _Measurable:_ UPDATE/AUPT-DELETE on ENT-AUDIT-LOG-ENTRY returns error 400/403 after write.

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-17, ENT-AUDIT-LOG-ENTRY · Pass: 2_

_Decomposition rationale:_ Immutability is a non-negotiable architectural choice required for the audit trail; this is a concrete implementation choice on how to enforce that policy.

_Surfaced assumptions:_ A-0111, A-0112

  - **US-007-C-5.2-1** `[Tier C · pending]`
    **As a** Architectural Strategy, **I want** Enforce append-only storage policy for audit log entries, **so that** Only new records can be appended; updates to existing rows fail at the storage engine level.

    **Acceptance criteria:**
      - **AC-002-1** — Append-only writes succeed, updates fail.
        - _Measurable:_ Write API endpoint returns 200 on append, 400/403 on UPDATE/DELETE for existing audit entry ID

    _Status: pending · Priority: critical · Tier: C · Traces to: US-007-C-5.3 · Pass: 3_

    _Decomposition rationale:_ Defines the physical mechanism (Append-Only) that enforces the immutability requirement independent of application logic.

    _Surfaced assumptions:_ A-0321, A-0322
  - **US-007-C-5.2-2** `[Tier C · pending]`
    **As a** Application Logic, **I want** Validate write permissions and log ID uniqueness before persistence, **so that** Application layer rejects any request attempting to modify or delete an existing audit ID.

    **Acceptance criteria:**
      - **AC-002-2** — Update requests are rejected before DB commit.
        - _Measurable:_ Application middleware returns 400 Bad Request when target audit ID exists in active log

    _Status: pending · Priority: critical · Tier: C · Traces to: US-007-C-5.1 · Pass: 3_

    _Decomposition rationale:_ Ensures logical immutability by intercepting unauthorized modifications prior to storage operation, supporting persistent record existence (US-007-C-5.1).

    _Surfaced assumptions:_ A-0321, A-0322
  - **US-007-C-5.2-3** `[Tier D · atomic]`
    **As a** Leaf Operation, **I want** Return standard HTTP error codes for immutability violations, **so that** Clients receive specific HTTP status codes and error messages for rejected write attempts.

    **Acceptance criteria:**
      - **AC-002-3** — Error response includes correct status code and message.
        - _Measurable:_ Response body contains 'Audit Entry Immutable' or 'Forbidden' and status 403/400 for modification attempts

    _Status: atomic · Priority: high · Tier: D · Traces to: US-007-C-5.4 · Pass: 3_

    _Decomposition rationale:_ Provides the specific observable behavior and interface contract (Error Response) that completes the immutability commitment.

    _Surfaced assumptions:_ A-0321, A-0322
##### US-007-C-5.3 `[Tier C · pending]`

**As a** Data Analyst, **I want** Define schema fields for verification event log entry, **so that** Log entry contains user_id, status, event_type, timestamp.

**Acceptance criteria:**
  - **AC-003** — Audit log entry schema includes mandatory fields for verification status and timestamp.
    - _Measurable:_ ENT-AUDIT-LOG-ENTRY contains columns: user_id, status, event_type, created_at.

_Status: pending · Priority: high · Tier: C · Traces to: COMP-17, ENT-AUDIT-LOG-ENTRY · Pass: 2_

_Decomposition rationale:_ The commitment to 'log details' requires defining what details constitute valid data; this is a concrete implementation choice on the schema.

_Surfaced assumptions:_ A-0111, A-0112

  - **US-007-C-5.3.1** `[Tier C · pending]`
    **As a** Database Designer, **I want** Define user_id column in audit log entity, **so that** The audit log entry table contains a user_id column.

    **Acceptance criteria:**
      - **AC-003.1** — The user_id column exists in the ENT-AUDIT-LOG-ENTRY schema.
        - _Measurable:_ SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_log_entry' AND column_name = 'user_id' returns true.

    _Status: pending · Priority: critical · Tier: C · Traces to: COMP-17, ENT-USER · Pass: 3_

    _Decomposition rationale:_ Decomposes the schema requirement into the foundational identity field. This column is critical for traceability and linking to ENT-USER.
  - **US-007-C-5.3.2** `[Tier C · pending]`
    **As a** Database Designer, **I want** Define status column with verification states, **so that** The audit log entry table contains a status column with valid verification state values.

    **Acceptance criteria:**
      - **AC-003.2** — The status column exists and accepts valid states like pending, verified, rejected.
        - _Measurable:_ The column data_type supports a string/enum, and application constraints validate 'pending'|'verified'|'rejected'.

    _Status: pending · Priority: critical · Tier: C · Traces to: COMP-17, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Defines the verification outcome field. The values are implementation choices that ensure the audit log captures the verification decision state.
  - **US-007-C-5.3.3** `[Tier C · pending]`
    **As a** Database Designer, **I want** Define event_type column for action classification, **so that** The audit log entry table contains an event_type column.

    **Acceptance criteria:**
      - **AC-003.3** — The event_type column exists and classifies the action performed.
        - _Measurable:_ SELECT COUNT(*) FROM audit_log_entry WHERE event_type IS NULL returns 0.

    _Status: pending · Priority: high · Tier: C · Traces to: COMP-17, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Adds the classification field to differentiate actions (e.g., login, verification, data access) within the immutable history.
  - **US-007-C-5.3.4** `[Tier C · pending]`
    **As a** Database Designer, **I want** Define timestamp column for audit trail ordering, **so that** The audit log entry table contains a created_at column with UTC timestamps.

    **Acceptance criteria:**
      - **AC-003.4** — The created_at column exists and is set to the current UTC time upon insertion.
        - _Measurable:_ TIMESTAMP(CREATED_AT) = NOW() AT TIME ZONE 'UTC' for every row inserted directly into the audit table.

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-AUDIT-LOG-ENTRY, COMP-17 · Pass: 3_

    _Decomposition rationale:_ Ensures temporal ordering and compliance with audit requirements (COMP-17). This is a leaf-level implementation detail.
##### US-007-C-5.4 `[Tier D · atomic]`

**As a** Security Engineer, **I want** Correlate verification attempt ID with log entry, **so that** Every log entry is linked to a specific verification workflow run.

**Acceptance criteria:**
  - **AC-004** — Log entry contains unique correlation ID matching verification workflow instance.
    - _Measurable:_ ENT-AUDIT-LOG-ENTRY.correlation_id == WF-4.instance_id

_Status: atomic · Priority: high · Tier: D · Traces to: WF-4, COMP-17 · Pass: 2_

_Decomposition rationale:_ To verify the 'Every verification attempt' AC, we must explicitly link the log row to the specific workflow attempt; this is a leaf operation.

_Surfaced assumptions:_ A-0111, A-0112

### FR US-008 `[pending]`

**As a** Permit Coordinator, **I want** Track permit compliance status, **so that** Jobs are dispatched only after regulatory compliance is met.

**Acceptance criteria:**
  - **AC-014** — Compliance checked before dispatch
    - _Measurable:_ System returns 403 error for dispatch if ENT-PERMIT status is not current
  - **AC-015** — Audit logging
    - _Measurable:_ API calls for compliance checks logged in ENT-AUDIT-LOG-ENTRY

_Status: pending · Priority: high · Traces to: UJ-8, ENT-PERMIT, ENT-CODE-REGULATION, COMP-2, WF-8 · Pass: 0_

#### FR-008-1 `[Tier C · pending]`

**As a** CAM operator, **I want** Query external permit registry API for current status before dispatch, **so that** System retrieves 'Current', 'Pending', 'Revoked' status from external source.

**Acceptance criteria:**
  - **AC-001** — API call returns permit status within SLA
    - _Measurable:_ GET /permit/{id} responds with status code 200 within 500ms and returns 'status' field

_Status: pending · Priority: high · Tier: C · Traces to: UJ-8, ENT-PERMIT, WF-8, ENT-EXTERNAL-SOURCE · Pass: 1_

_Decomposition rationale:_ External data retrieval is a concrete engineering commitment required to verify compliance; ties directly to User Journey UJ-8 and Workflow WF-8.

_Surfaced assumptions:_ A-0020, A-0021, A-0022

##### FR-008-1.1 `[Tier D · atomic]`

**As a** Field Operation, **I want** Construct and send HTTP GET request to external permit registry endpoint, **so that** Request headers and body are valid; connection established to ENT-EXTERNAL-SOURCE.

**Acceptance criteria:**
  - **AC-101** — HTTP Client initiates GET /permit/{id} call
    - _Measurable:_ outgoing_request.method === 'GET' && outgoing_request.url.includes('/permit/')

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-8, ENT-PERMIT, ENT-EXTERNAL-SOURCE · Pass: 2_

_Decomposition rationale:_ This is the first atomic step required to satisfy the parent requirement; no further decomposition is needed as the HTTP client operation is a single testable unit.

_Surfaced assumptions:_ A-0113, A-0114, A-0115

##### FR-008-1.2 `[Tier D · atomic]`

**As a** Field Operation, **I want** Measure and enforce response latency SLA, **so that** Response processing completes within 500ms window.

**Acceptance criteria:**
  - **AC-102** — System does not proceed to status logic if latency exceeds limit
    - _Measurable:_ timestamp.now() - timestamp.request_start <= 500 (milliseconds)

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-8, ENT-EXTERNAL-SOURCE · Pass: 2_

_Decomposition rationale:_ Latency is a distinct verification metric defined in the parent AC; separating it allows independent testing of the SLA enforcement logic.

_Surfaced assumptions:_ A-0113, A-0114, A-0115

##### FR-008-1.3 `[Tier D · atomic]`

**As a** Field Operation, **I want** Extract and map status field from response payload, **so that** Valid status string is assigned to permit entity record.

**Acceptance criteria:**
  - **AC-103** — Response contains 'status' key with valid enum value
    - _Measurable:_ response.status_code === 200 && 'status' in response.body && response.body.status in ['Current', 'Pending', 'Revoked']

_Status: atomic · Priority: high · Tier: D · Traces to: WF-8, ENT-PERMIT, ENT-EXTERNAL-SOURCE · Pass: 2_

_Decomposition rationale:_ Parsing the specific 'status' field is a distinct logic step from network handling; this ensures data integrity before downstream compliance checks use the value.

_Surfaced assumptions:_ A-0113, A-0114, A-0115

#### FR-008-2 `[Tier C · pending]`

**As a** System logic, **I want** Reject dispatch request if permit status is not 'Current', **so that** Dispatch flow terminates and returns error to scheduler if compliance check fails.

**Acceptance criteria:**
  - **AC-002** — Dispatch is blocked for non-compliant jobs
    - _Measurable:_ System returns 403 error if ENT-PERMIT.status != 'Current' at dispatch trigger time

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-8, COMP-2, ENT-COMPLIANCE-FLAG · Pass: 1_

_Decomposition rationale:_ Enforcement of the policy ('Jobs are dispatched only after regulatory compliance is met') is a concrete implementation commitment derived from AC-014.

_Surfaced assumptions:_ A-0020, A-0021, A-0022

##### FR-008-2-1 `[Tier D · atomic]`

**As a** Logic Gate, **I want** Validate permit status string against 'Current' threshold, **so that** System identifies non-matching status value.

**Acceptance criteria:**
  - **AC-002-1** — Status string comparison passes only for 'Current'.
    - _Measurable:_ permit.status === 'Current' implies validation_success === true

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-8, FR-008-1, ENT-PERMIT · Pass: 2_

_Decomposition rationale:_ Binds the specific value logic required to evaluate the compliance check; defines the only passing state.

_Surfaced assumptions:_ A-0116

##### FR-008-2-2 `[Tier D · atomic]`

**As a** Error Handler, **I want** Generate 403 Forbidden response on validation failure, **so that** Scheduler receives rejection signal.

**Acceptance criteria:**
  - **AC-002-2** — HTTP response code matches compliance failure policy.
    - _Measurable:_ http_response.status === 403 when validation_success === false

_Status: atomic · Priority: critical · Tier: D · Traces to: COMP-2, FR-008-3 · Pass: 2_

_Decomposition rationale:_ Commits to the specific HTTP contract required by the compliance check workflow and audit trail requirements.

_Surfaced assumptions:_ A-0116

##### FR-008-2-3 `[Tier D · atomic]`

**As a** Workflow Enforcer, **I want** Terminate job dispatch workflow immediately on block, **so that** Job ticket remains unassigned or enters error state.

**Acceptance criteria:**
  - **AC-002-3** — Dispatch workflow state transitions to blocked/failed.
    - _Measurable:_ dispatch_workflow.state === 'TERMINATED' within 50ms of validation failure

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-8, WF-2 · Pass: 2_

_Decomposition rationale:_ Ensures the system enforces the rejection by altering the operational state of the dispatch workflow.

_Surfaced assumptions:_ A-0116

#### FR-008-3 `[Tier C · pending]`

**As a** Audit system, **I want** Log all compliance check API calls and results in immutable audit trail, **so that** Every compliance check request and response is recorded in ENT-AUDIT-LOG-ENTRY.

**Acceptance criteria:**
  - **AC-003** — Audit log entry persists after dispatch decision
    - _Measurable:_ ENT-AUDIT-LOG-ENTRY contains timestamp, user, permit_id, and status for every check attempt

_Status: pending · Priority: high · Tier: C · Traces to: UJ-8, COMP-16, ENT-AUDIT-LOG-ENTRY · Pass: 1_

_Decomposition rationale:_ Satisfies AC-015 (Audit logging) and binds the system to the compliance requirement of maintaining an audit trail for verification.

_Surfaced assumptions:_ A-0020, A-0021, A-0022

##### FR-008-3.1 `[Tier C · pending]`

**As a** Audit Log Builder, **I want** capture request metadata fields into ENT-AUDIT-LOG-ENTRY, **so that** Log entry contains timestamp and user identity for every compliance check attempt.

**Acceptance criteria:**
  - **AC-003.1** — Every log entry records the exact timestamp of the check request.
    - _Measurable:_ log_entry.timestamp === request.received_at or system_clock_at_entry_create_time
  - **AC-003.2** — Every log entry records the requesting user identity.
    - _Measurable:_ log_entry.user_id !== null

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-8, ENT-AUDIT-LOG-ENTRY · Pass: 2_

_Decomposition rationale:_ AC-003 explicitly mandates timestamp and user fields; this child commits to the specific fields and capture logic.

_Surfaced assumptions:_ A-0117, A-0118, A-0119

  - **FR-008-3.1.1** `[Tier C · pending]`
    **As a** Backend Service, **I want** Determine log entry timestamp source, **so that** Log entry timestamp matches system clock or request received_at per requirement.

    **Acceptance criteria:**
      - **AC-003.1.1** — Timestamp matches system clock or request received_at
        - _Measurable:_ log_entry.timestamp === request.received_at OR log_entry.timestamp === system_clock_at_entry_create_time

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-8, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Splits the timestamp acceptance criteria into a specific logic decision to ensure AC-003.1 is met.

    _Surfaced assumptions:_ A-0323, A-0324
  - **FR-008-3.1.2** `[Tier C · pending]`
    **As a** Backend Service, **I want** Capture and hash user identity for audit entry, **so that** Log entry user_id is populated and transformed to protect privacy.

    **Acceptance criteria:**
      - **AC-003.2.1** — User identity is captured and non-null in log
        - _Measurable:_ log_entry.user_id != null

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-8, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Splits the user identity acceptance criteria to explicitly handle the existing constraint of hashing user data (A-0117).

    _Surfaced assumptions:_ A-0323, A-0324
##### FR-008-3.2 `[Tier C · pending]`

**As a** Audit Log Builder, **I want** capture compliance result metadata fields into ENT-AUDIT-LOG-ENTRY, **so that** Log entry contains permit_id and status for every compliance check attempt.

**Acceptance criteria:**
  - **AC-003.3** — Every log entry records the permit identifier checked.
    - _Measurable:_ log_entry.permit_id !== null
  - **AC-003.4** — Every log entry records the check outcome status.
    - _Measurable:_ log_entry.status in ['COMPLIANT', 'NON_COMPLIANT', 'PENDING', 'UNKNOWN']

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-8, ENT-AUDIT-LOG-ENTRY · Pass: 2_

_Decomposition rationale:_ AC-003 explicitly mandates permit_id and status fields; this child commits to capturing the result payload from the check logic.

_Surfaced assumptions:_ A-0117, A-0118, A-0119

  - **FR-008-3.2-1** `[Tier C · pending]`
    **As a** CAM operator, **I want** extract permit_id from source permit record into log_entry.permit_id, **so that** log_entry.permit_id matches ENT-PERMIT id for the checked permit.

    **Acceptance criteria:**
      - **AC-003.3** — Every persisted audit log entry containing a permit reference has a valid permit_id.
        - _Measurable:_ log_entry.permit_id === ENT-PERMIT.id WHERE log_entry.source_ref == ENT-PERMIT.id

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-8, ENT-PERMIT, WF-8 · Pass: 3_

    _Decomposition rationale:_ Defines the concrete mapping of the permit identifier from the upstream compliance entity to the audit log schema.

    _Surfaced assumptions:_ A-0325, A-0326, A-0327
  - **FR-008-3.2-2** `[Tier C · pending]`
    **As a** CAM operator, **I want** extract compliance_status string from source result into log_entry.status, **so that** log_entry.status is a valid enum value from the allowed list.

    **Acceptance criteria:**
      - **AC-003.4** — Every persisted audit log entry contains a status field matching the defined enumeration.
        - _Measurable:_ log_entry.status IN ['COMPLIANT', 'NON_COMPLIANT', 'PENDING', 'UNKNOWN']

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-8, ENT-COMPLIANCE-FLAG, WF-8 · Pass: 3_

    _Decomposition rationale:_ Defines the concrete mapping of the compliance status outcome into the standardized log status field.

    _Surfaced assumptions:_ A-0325, A-0326, A-0327
  - **FR-008-3.2-3** `[Tier C · pending]`
    **As a** CAM operator, **I want** link audit entry to the specific compliance check workflow instance, **so that** Audit entry is traceable back to the specific WF-8 execution event.

    **Acceptance criteria:**
      - **AC-003.5** — Every audit entry references the originating workflow execution ID.
        - _Measurable:_ log_entry.workflow_instance_id === WF-8.execution_id

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-8, WF-8, FR-008-3.1 · Pass: 3_

    _Decomposition rationale:_ Establishes the relationship between the audit record and the specific workflow instance that generated the compliance result.

    _Surfaced assumptions:_ A-0325, A-0326, A-0327
  - **FR-008-3.2-4** `[Tier B · pending]`
    **As a** Policy, **I want** define handling for non-permit jobs in audit context, **so that** System distinguishes between jobs with permits and jobs without permits in logs.

    **Acceptance criteria:**
      - **AC-003.6** — Jobs without permits record a status but permit_id remains null or populated with a generic reference.
        - _Measurable:_ IF ENT-PERMIT.id IS NULL THEN log_entry.permit_id = 'N/A' OR log_entry.permit_id = NULL

    _Status: pending · Priority: high · Tier: B · Traces to: UJ-8, FR-008-3.1 · Pass: 3_

    _Decomposition rationale:_ Policies the AC implies permit_id !== null for checked attempts, but defines the boundary for when the permit ID constraint applies to jobs lacking permits.

    _Surfaced assumptions:_ A-0325, A-0326, A-0327
##### FR-008-3.3 `[Tier B · pending]`

**As a** Storage Architect, **I want** enforce immutable storage constraint for ENT-AUDIT-LOG-ENTRY records, **so that** Record cannot be modified or deleted once persisted to the audit trail.

**Acceptance criteria:**
  - **AC-003.5** — Persisted records are read-only after commit.
    - _Measurable:_ update_count(log_entry.id) <= 1

_Status: pending · Priority: critical · Tier: B · Traces to: COMP-16, ENT-AUDIT-LOG-ENTRY · Pass: 2_

_Decomposition rationale:_ Immutability is an architectural strategy (Tier B) with downstream consequences for data integrity and compliance, distinct from simple implementation details.

_Surfaced assumptions:_ A-0117, A-0118, A-0119

##### FR-008-3.4 `[Tier C · pending]`

**As a** Compliance Engineer, **I want** apply data retention policy to ENT-AUDIT-LOG-ENTRY lifecycle, **so that** Audit entries are archived and moved to cold storage after retention period expires.

**Acceptance criteria:**
  - **AC-003.6** — Entries older than 7 years are moved to cold storage archive.
    - _Measurable:_ entry.created_at < (current_date - 7*365 days) implies archive_status == 'cold'

_Status: pending · Priority: high · Tier: C · Traces to: COMP-16, ENT-AUDIT-LOG-ENTRY · Pass: 2_

_Decomposition rationale:_ Retention is a concrete implementation choice regarding the lifecycle of the log records, distinct from the storage mechanism itself.

_Surfaced assumptions:_ A-0117, A-0118, A-0119

  - **FR-008-3.4.1** `[Tier D · atomic]`
    **As a** Retention Engine, **I want** Identify audit log entries exceeding retention age, **so that** Query returns list of log entries eligible for archival.

    **Acceptance criteria:**
      - **AC-003.7** — Identified entries must be strictly older than 7 years.
        - _Measurable:_ SELECT * FROM audit_log_entries WHERE created_at < (CURRENT_DATE - 7*365)

    _Status: atomic · Priority: medium · Tier: D · Traces to: FR-008-3.4, COMP-16, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ The age condition check is the discrete decision step that gates the migration process; atomic enough to test against a row set.
  - **FR-008-3.4.2** `[Tier D · atomic]`
    **As a** Data Mover, **I want** Migrate entry data to cold storage bucket, **so that** Entry content is copied to SeaweedFS cold storage bucket.

    **Acceptance criteria:**
      - **AC-003.8** — Source data is successfully transferred to cold storage destination.
        - _Measurable:_ GET /cold-storage/entries/{id} returns 200 and payload matches source hash

    _Status: atomic · Priority: critical · Tier: D · Traces to: FR-008-3.4, COMP-16, TECH-13 · Pass: 3_

    _Decomposition rationale:_ The actual transfer action is an atomic system operation; the storage technology is fixed by TECH-13, making the action testable.
  - **FR-008-3.4.3** `[Tier D · atomic]`
    **As a** State Manager, **I want** Update audit log entry archival status, **so that** entry.archive_status is set to 'cold'.

    **Acceptance criteria:**
      - **AC-003.9** — The row status field reflects the archival state immediately after migration.
        - _Measurable:_ SELECT archive_status FROM audit_log_entries WHERE id = X returns 'cold'

    _Status: atomic · Priority: critical · Tier: D · Traces to: FR-008-3.4, COMP-16, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Updating the metadata to reflect the new state is the final atomic step to complete the lifecycle transition.
### FR US-014 `[pending]`

**As a** Service Provider, **I want** Integrate with third party accounting tool, **so that** Provider syncs invoices to external ledgers like QuickBooks.

**Acceptance criteria:**
  - **AC-026** — Sync bi-directional
    - _Measurable:_ Changes to ENT-INVOICE reflected in external source within 1 hour
  - **AC-027** — Data matches external ledger
    - _Measurable:_ Financial reconciliation report shows 100% match

_Status: pending · Priority: medium · Traces to: UJ-14, ENT-EXTERNAL-SOURCE, WF-11, COMP-15 · Pass: 0_

#### FR-ACCT-1.1 `[Tier C · pending]`

**As a** CAM operator, **I want** establish bi-directional OAuth2 connection to external provider, **so that** Secure connection active and tokens refreshed before expiry.

**Acceptance criteria:**
  - **AC-030** — Authentication token valid and refreshed.
    - _Measurable:_ Connection status = 'active' AND token_expiry_time > current_time

_Status: pending · Priority: critical · Tier: C · Traces to: WF-11, ENT-EXTERNAL-SOURCE · Pass: 1_

_Decomposition rationale:_ Connection security is the prerequisite for any sync; must be an implementation commitment regarding auth protocols.

_Surfaced assumptions:_ A-0041, A-0042, A-0043, A-0044

##### FR-ACCT-1.1-001 `[Tier D · atomic]`

**As a** CAM operator, **I want** Schedule refresh logic execution prior to token expiry, **so that** Token is refreshed before expiration window closes.

**Acceptance criteria:**
  - **AC-030-1** — Refresh job triggers 30 minutes before expiry
    - _Measurable:_ refresh_job.scheduled_time <= current_time + 30 mins AND token_expiry_time > current_time

_Status: atomic · Priority: high · Tier: D · Traces to: WF-11, ENT-EXTERNAL-SOURCE · Pass: 2_

_Decomposition rationale:_ Defines the specific timing policy required to satisfy the parent's 'tokens refreshed before expiry' AC without ambiguity.

_Surfaced assumptions:_ A-0157, A-0158, A-0159

##### FR-ACCT-1.1-002 `[Tier D · atomic]`

**As a** CAM operator, **I want** Revoke local session state upon external token revocation, **so that** Local connection invalidated within 60 seconds of external revocation.

**Acceptance criteria:**
  - **AC-030-2** — Local session marked invalid after external revocation check
    - _Measurable:_ session.is_valid === false WHERE external_token_revoked_timestamp < now() - 60s

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-11, ENT-SESSION · Pass: 2_

_Decomposition rationale:_ Ensures data isolation and security by preventing stale usage when the external provider blocks access, satisfying security expectations.

_Surfaced assumptions:_ A-0157, A-0158, A-0159

##### FR-ACCT-1.1-003 `[Tier D · atomic]`

**As a** CAM operator, **I want** Validate external provider metadata on handshake, **so that** Connection established only if provider metadata is valid.

**Acceptance criteria:**
  - **AC-030-3** — Metadata endpoint reachable and scopes verified
    - _Measurable:_ metadata.is_accessible === true AND granted_scopes.includes(external_required_scope)

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-EXTERNAL-SOURCE, WF-11 · Pass: 2_

_Decomposition rationale:_ Prevents unauthorized access by verifying provider capabilities before establishing a persistent link.

_Surfaced assumptions:_ A-0157, A-0158, A-0159

##### FR-ACCT-1.1-004 `[Tier D · atomic]`

**As a** CAM operator, **I want** Store refresh tokens in encrypted database fields, **so that** Tokens persisted securely with tenant isolation enforced.

**Acceptance criteria:**
  - **AC-030-4** — Token stored in DB column with RLS tags
    - _Measurable:_ db_row.security_tag == 'encrypted_refresh' AND tenant_id == request.tenant

_Status: atomic · Priority: critical · Tier: D · Traces to: TECH-7, ENT-SESSION · Pass: 2_

_Decomposition rationale:_ Mitigates risk of token theft by binding storage to the Row-Level Security policy defined in the handoff context.

_Surfaced assumptions:_ A-0157, A-0158, A-0159

#### FR-ACCT-1.2 `[Tier C · pending]`

**As a** CAM operator, **I want** map internal invoice fields to external ledger schema, **so that** Data payloads match external ledger format on transmission.

**Acceptance criteria:**
  - **AC-031** — Field mapping validates schema compatibility.
    - _Measurable:_ All required invoice_line_item fields map to external schema keys with no null values

_Status: pending · Priority: high · Tier: C · Traces to: UJ-14, ENT-INVOICE, ENT-CLIENT-LEDGER · Pass: 1_

_Decomposition rationale:_ Data fidelity is the core requirement of AC-027; this is the implementation choice for how that fidelity is achieved.

_Surfaced assumptions:_ A-0041, A-0042, A-0043, A-0044

##### FR-ACCT-1.2.1 `[Tier C · pending]`

**As a** CAM operator, **I want** Transform internal invoice field names to external schema keys, **so that** Output payload JSON keys match external provider schema keys.

**Acceptance criteria:**
  - **AC-031-1** — Every mapped line item key matches the external ledger schema.
    - _Measurable:_ key_count(output) === key_count(external_schema_spec) AND key_set(output) === key_set(external_schema_spec) for all persisted entries

_Status: pending · Priority: high · Tier: C · Traces to: UJ-14 · Pass: 2_

_Decomposition rationale:_ Field renaming is the first concrete transformation step required to ensure data compatibility; this isolates the key mapping logic from value transformation.

_Surfaced assumptions:_ A-0160, A-0161

  - **FR-ACCT-1.2.1.C-1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Apply key mapping from runtime configuration store, **so that** Internal JSON keys are renamed to external schema keys using the active mapping config.

    **Acceptance criteria:**
      - **AC-031-1.1** — Mapping config is applied to output payload.
        - _Measurable:_ output.keys === external_schema.spec.keys for all persisted entries

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-14, ENT-EXTERNAL-SOURCE · Pass: 3_

    _Decomposition rationale:_ The transformation logic relies on external schema data; committing to use the config store ensures flexibility for schema changes.

    _Surfaced assumptions:_ A-0390, A-0391
  - **FR-ACCT-1.2.1.C-2** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Validate transformed output against external spec, **so that** System rejects payloads that fail to match the external schema definition.

    **Acceptance criteria:**
      - **AC-031-1.2** — Output payload conforms to external schema constraints.
        - _Measurable:_ external_schema_validator.validate(output_payload) === true at commit time

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-11, ENT-CLIENT-LEDGER · Pass: 3_

    _Decomposition rationale:_ This is an atomic verification step that ensures the mapping operation produced a compliant result before persistence.

    _Surfaced assumptions:_ A-0390, A-0391
  - **FR-ACCT-1.2.1.C-3** `[Tier C · pending]`
    **As a** CAM operator, **I want** Handle unmapped keys with default strategy, **so that** Keys not in mapping table are dropped or marked with legacy prefix.

    **Acceptance criteria:**
      - **AC-031-1.3** — Unmapped internal keys do not cause system failure.
        - _Measurable:_ response_status_code === 200 OR error_code === 'legacy_key_dropped' if key missing from mapping table

    _Status: pending · Priority: high · Tier: C · Traces to: WF-11, ENT-INVOICE · Pass: 3_

    _Decomposition rationale:_ Defines the behavior for schema drift or provider updates that haven't pushed a new schema version yet.

    _Surfaced assumptions:_ A-0390, A-0391
##### FR-ACCT-1.2.2 `[Tier C · pending]`

**As a** CAM operator, **I want** Enforce data type coercion for currency fields, **so that** Numeric values are cast to external precision standards.

**Acceptance criteria:**
  - **AC-031-2** — Currency fields use the external provider's required decimal precision.
    - _Measurable:_ decimal_places(output_currency) <= external_max_precision AND decimal_places(output_currency) >= external_min_precision

_Status: pending · Priority: high · Tier: C · Traces to: UJ-14 · Pass: 2_

_Decomposition rationale:_ Type coercion ensures that value semantics are preserved despite schema differences; this prevents data loss or parsing errors on the receiving end.

_Surfaced assumptions:_ A-0160, A-0161

  - **FR-ACCT-1.2.2.C1** `[Tier B · pending]`
    **As a** Architect, **I want** Adopt external source precision semantics, **so that** System does not enforce internal currency precision limits on fields mapped to external accounting tools.

    **Acceptance criteria:**
      - **AC-002** — System respects external maximum/minimum precision bounds regardless of internal storage type
        - _Measurable:_ Outgoing payload precision matches external provider config max_precision

    _Status: pending · Priority: critical · Tier: B · Traces to: UJ-14, FR-ACCT-1.2.1 · Pass: 3_

    _Decomposition rationale:_ Establishes the governing policy that external truth prevails over internal normalization. This prevents scope creep where internal engineering assumptions override external contract terms.

    _Surfaced assumptions:_ A-0392, A-0393, A-0394
  - **FR-ACCT-1.2.2.C2** `[Tier C · pending]`
    **As a** Developer, **I want** Reject inputs exceeding external bounds, **so that** Input payload is sanitized or rejected before serialization to external gateway.

    **Acceptance criteria:**
      - **AC-003** — API call returns 400 error if input value exceeds external precision config
        - _Measurable:_ HTTP Status 400 returned when decimal_places(input) > external_max_precision

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-14, FR-ACCT-1.2.2.C1 · Pass: 3_

    _Decomposition rationale:_ Concrete validation logic that prevents data corruption or contract violations at the serialization boundary.

    _Surfaced assumptions:_ A-0392, A-0393, A-0394
  - **FR-ACCT-1.2.2.C3** `[Tier C · pending]`
    **As a** Developer, **I want** Apply defined rounding rule for boundary values, **so that** Values within bounds but requiring cast are rounded consistently per config.

    **Acceptance criteria:**
      - **AC-004** — System applies half-even rounding when precision is exceeded by fraction
        - _Measurable:_ Round function output matches external provider spec (e.g., round(0.5, 0, half_even)

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-14, FR-ACCT-1.2.2.C2 · Pass: 3_

    _Decomposition rationale:_ Defines the deterministic behavior for edge cases where truncation/rounding must occur without losing the contract integrity.

    _Surfaced assumptions:_ A-0392, A-0393, A-0394
  - **FR-ACCT-1.2.2.C4** `[Tier D · atomic]`
    **As a** QA Engineer, **I want** Log precision coercion events, **so that** Every cast operation is recorded in the immutable audit log.

    **Acceptance criteria:**
      - **AC-005** — Audit log contains timestamp and source ID for every precision cast
        - _Measurable:_ Row exists in audit_log_entries table with action='PRECISION_CAST' and source_id matching external config

    _Status: atomic · Priority: medium · Tier: D · Traces to: UJ-14, FR-ACCT-1.2.2.C1 · Pass: 3_

    _Decomposition rationale:_ Terminal operation for compliance tracking. This is atomic and testable without further decomposition.

    _Surfaced assumptions:_ A-0392, A-0393, A-0394
##### FR-ACCT-1.2.3 `[Tier C · pending]`

**As a** CAM operator, **I want** Filter fields not present in target schema during serialization, **so that** Payload contains only fields defined in the external mapping config.

**Acceptance criteria:**
  - **AC-031-3** — No field exists in the output payload that is not defined in the external schema.
    - _Measurable:_ NOT EXISTS (f IN output_fields WHERE f NOT IN external_schema_fields)

_Status: pending · Priority: high · Tier: C · Traces to: UJ-14 · Pass: 2_

_Decomposition rationale:_ Removing unknown fields prevents transmission failures or compliance violations due to sending unsupported data attributes to the external provider.

_Surfaced assumptions:_ A-0160, A-0161

  - **FR-ACCT-1.2.3.1** `[Tier C · pending]`
    **As a** Serialization Guard, **I want** Compare output fields against external schema map, **so that** Ensure no schema violations in serialization.

    **Acceptance criteria:**
      - **AC-001** — Every output key matches a schema key.
        - _Measurable:_ output_field_keys.issubset(schema_config.keys()) === true

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-14 · Pass: 3_

    _Decomposition rationale:_ Binds the filtering logic to the specific data model of the integration, validating the payload against the target schema before write.

    _Surfaced assumptions:_ A-0395, A-0396, A-0397
  - **FR-ACCT-1.2.3.2** `[Tier C · pending]`
    **As a** Schema Resolver, **I want** Fetch active version of external schema config, **so that** Serialization uses the correct version of the external schema.

    **Acceptance criteria:**
      - **AC-002** — Schema version ID matches the active configuration version.
        - _Measurable:_ config_id_in_memory === schema_store.active_version_id

    _Status: pending · Priority: high · Tier: C · Traces to: A-0160 · Pass: 3_

    _Decomposition rationale:_ Ensures the schema used for filtering is consistent with the stored versioned config, grounding the logic in the constraint defined in existing assumption A-0160.

    _Surfaced assumptions:_ A-0395, A-0396, A-0397
  - **FR-ACCT-1.2.3.3** `[Tier D · atomic]`
    **As a** Field Filterer, **I want** Remove non-specified fields from JSON buffer, **so that** Payload is strictly limited to approved schema fields.

    **Acceptance criteria:**
      - **AC-003** — Output JSON contains only schema-defined keys.
        - _Measurable:_ serialized_payload_keys.length === filtered_schema_keys.length

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-14 · Pass: 3_

    _Decomposition rationale:_ This is the atomic operation that physically enforces the exclusion policy on the JSON structure.

    _Surfaced assumptions:_ A-0395, A-0396, A-0397
  - **FR-ACCT-1.2.3.4** `[Tier C · pending]`
    **As a** Audit Logger, **I want** Record dropped field IDs to audit log, **so that** Compliance officers can trace why fields were removed.

    **Acceptance criteria:**
      - **AC-004** — Drop event exists in audit log within 100ms of removal.
        - _Measurable:_ audit_log_timestamp - drop_timestamp <= 100ms

    _Status: pending · Priority: medium · Tier: C · Traces to: UJ-15 · Pass: 3_

    _Decomposition rationale:_ Audit logging is required for compliance reviews and UJ-8, ensuring transparency for dropped fields.

    _Surfaced assumptions:_ A-0395, A-0396, A-0397
#### FR-ACCT-1.3 `[Tier C · pending]`

**As a** CAM operator, **I want** process sync events within 1-hour latency SLA, **so that** External changes visible in Hestami within defined window.

**Acceptance criteria:**
  - **AC-032** — Latency threshold met under normal load.
    - _Measurable:_ timestamp(external_change_event) - timestamp(internal_sync_ack) <= 1 hour

_Status: pending · Priority: high · Tier: C · Traces to: WF-11, COMP-15 · Pass: 1_

_Decomposition rationale:_ AC-026 explicitly defines the latency constraint; this child commits to the engineering strategy to meet it.

_Surfaced assumptions:_ A-0041, A-0042, A-0043, A-0044

##### FR-ACCT-1.3.1 `[Tier C · pending]`

**As a** Integration Engineer, **I want** Configure DBOS workflow concurrency limits for external sync, **so that** Background workers process sync events without exhausting the API gateway or database connections.

**Acceptance criteria:**
  - **AC-032.1** — Workflow thread pool size is capped at 20 concurrent workers per tenant.
    - _Measurable:_ workflow_config.thread_pool.max_size === 20 for external sync group

_Status: pending · Priority: critical · Tier: C · Traces to: WF-11, ENT-SYNC-JOB · Pass: 2_

_Decomposition rationale:_ Defining concurrency is the first concrete technical decision required to manage the 1-hour SLA. Without a cap, a single bad external call could starve other sync events.

_Surfaced assumptions:_ A-0162, A-0163, A-0164

  - **FR-ACCT-1.3.1.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Initialize DBOS thread pool with tenant-specific max size of 20, **so that** System prevents new sync jobs from acquiring worker slots once the pool limit is reached.

    **Acceptance criteria:**
      - **AC-032.1-A** — Thread pool size is capped at 20 per tenant.
        - _Measurable:_ config[external_sync].thread_pool.max_size === 20 && config.tenant_id !== null for all sync groups

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-11, ENT-SYNC-JOB · Pass: 3_

    _Decomposition rationale:_ Direct decomposition of the parent AC into the specific runtime configuration parameter that enforces the cap.

    _Surfaced assumptions:_ A-0398, A-0399, A-0400
  - **FR-ACCT-1.3.1.2** `[Tier B · pending]`
    **As a** System Architect, **I want** Apply exponential backoff strategy for jobs rejected by worker pool saturation, **so that** Excess requests are queued or returned with 503 Service Unavailable to protect the API gateway.

    **Acceptance criteria:**
      - **AC-032.1-B** — Rejection response code and delay headers conform to backoff policy.
        - _Measurable:_ HTTP Status === 503 && Retry-After header >= initial_delay for every rejected job event

    _Status: pending · Priority: high · Tier: B · Traces to: WF-11, ENT-EXTERNAL-SOURCE · Pass: 3_

    _Decomposition rationale:_ Decomposes the 'without exhausting' part of the parent into an engineering sub-strategy for handling resource contention.

    _Surfaced assumptions:_ A-0398, A-0399, A-0400
  - **FR-ACCT-1.3.1.3** `[Tier C · pending]`
    **As a** Staff Engineer, **I want** Expose DBOS worker concurrency metrics to the observability pipeline, **so that** Operational dashboards can visualize active sync workers per tenant in real-time.

    **Acceptance criteria:**
      - **AC-032.1-C** — Metrics are available to the OpenTelemetry collector.
        - _Measurable:_ otlp.metrics[active_workers] > 0 for every tenant_id in the current batch

    _Status: pending · Priority: medium · Tier: C · Traces to: WF-11, UJ-11 · Pass: 3_

    _Decomposition rationale:_ Defines the monitoring commitment required to verify the implementation of the concurrency limits (verification of AC).

    _Surfaced assumptions:_ A-0398, A-0399, A-0400
  - **FR-ACCT-1.3.1.4** `[Tier C · pending]`
    **As a** Integration Engineer, **I want** Enforce logical tenant boundaries on thread pool configuration keys, **so that** Tenant A cannot access or influence the worker threads configured for Tenant B.

    **Acceptance criteria:**
      - **AC-032.1-D** — Configuration lookup scopes exclusively to tenant context.
        - _Measurable:_ worker_config.get(max_size) === tenant_config.tenant_id.limit_value

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-11, ENT-TENANT · Pass: 3_

    _Decomposition rationale:_ Decomposes the multi-tenant requirement into the architectural mechanism for isolating concurrency limits.

    _Surfaced assumptions:_ A-0398, A-0399, A-0400
##### FR-ACCT-1.3.2 `[Tier C · pending]`

**As a** Performance Engineer, **I want** Implement exponential backoff for failed external API calls, **so that** Sync attempts retry intelligently without overwhelming the external provider.

**Acceptance criteria:**
  - **AC-032.2** — Retry interval doubles after each failure up to 30 minutes.
    - _Measurable:_ retry_delay == min(2^n * base, 30 min) for n in [0..7]

_Status: pending · Priority: high · Tier: C · Traces to: WF-11, ENT-EXTERNAL-SOURCE · Pass: 2_

_Decomposition rationale:_ This is the primary mechanism to absorb external provider jitter and ensure the internal SLA is not missed by a single transient network fault.

_Surfaced assumptions:_ A-0162, A-0163, A-0164

  - **FR-ACCT-1.3.2.1** `[Tier C · pending]`
    **As a** Backend Engineer, **I want** Configure initial base delay for retry sequence, **so that** First retry occurs after fixed initial interval.

    **Acceptance criteria:**
      - **AC-032.2.1** — Initial retry delay matches configured base value.
        - _Measurable:_ retry_delay when failure_count=0 equals base_delay (e.g., 100ms)

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-11, ENT-EXTERNAL-SOURCE · Pass: 3_

    _Decomposition rationale:_ This child commits the specific starting point of the algorithm. Without this, the exponential curve has no anchor.

    _Surfaced assumptions:_ A-0401, A-0402
  - **FR-ACCT-1.3.2.2** `[Tier C · pending]`
    **As a** Backend Engineer, **I want** Enforce maximum delay cap on retry interval, **so that** Retry interval never exceeds 30 minutes regardless of failures.

    **Acceptance criteria:**
      - **AC-032.2.2** — Calculated delay is clamped to 30 minutes.
        - _Measurable:_ retry_delay <= 30 min (1800 seconds) for all n in [0..7]

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-11, ENT-EXTERNAL-SOURCE · Pass: 3_

    _Decomposition rationale:_ This child prevents infinite backoff causing system hang. It operationalizes the 30-minute constraint in the parent AC.

    _Surfaced assumptions:_ A-0401, A-0402
  - **FR-ACCT-1.3.2.3** `[Tier C · pending]`
    **As a** DBOS Workflow Engineer, **I want** Persist retry state and failure count in workflow state, **so that** System remembers how many times a specific sync job failed.

    **Acceptance criteria:**
      - **AC-032.2.3** — Failure count increments exactly once per failure event.
        - _Measurable:_ state.failure_count === failure_count_prev + 1 AND state.last_failure_timestamp is updated

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-11, ENT-EXTERNAL-SOURCE · Pass: 3_

    _Decomposition rationale:_ The backoff math requires a durable counter. This child commits to using workflow state (DBOS) for the counter to ensure consistency across retries.

    _Surfaced assumptions:_ A-0401, A-0402
  - **FR-ACCT-1.3.2.4** `[Tier C · pending]`
    **As a** Backend Engineer, **I want** Handle specific rate-limit (429) responses, **so that** 429 status triggers backoff potentially longer than standard formula.

    **Acceptance criteria:**
      - **AC-032.2.4** — 429 errors increment failure count and delay.
        - _Measurable:_ If status_code == 429 THEN failure_count increments AND delay uses RFC 6585 Retry-After header or defaults to base formula.

    _Status: pending · Priority: high · Tier: C · Traces to: WF-11, ENT-EXTERNAL-SOURCE · Pass: 3_

    _Decomposition rationale:_ Addresses the open question [A-0164] regarding 429 handling by committing to treat them as retryable (conservative) rather than immediate DLQ, aligning with 'smart retry' goal.

    _Surfaced assumptions:_ A-0401, A-0402
  - **FR-ACCT-1.3.2.5** `[Tier C · pending]`
    **As a** Backend Engineer, **I want** Apply jitter to calculated delay to reduce thundering herd, **so that** Retry intervals vary slightly around the calculated value.

    **Acceptance criteria:**
      - **AC-032.2.5** — Actual delay includes random variance.
        - _Measurable:_ actual_delay = min_cap + max(0, calculated_base * 0.9 + random(0, 0.2) * calculated_base)

    _Status: pending · Priority: medium · Tier: C · Traces to: WF-11, ENT-EXTERNAL-SOURCE · Pass: 3_

    _Decomposition rationale:_ Prevents all clients from retrying at the exact same nanosecond window, reducing simultaneous load spikes on the provider.

    _Surfaced assumptions:_ A-0401, A-0402
  - **FR-ACCT-1.3.2.6** `[Tier D · atomic]`
    **As a** Backend Engineer, **I want** Reset failure count on successful external sync, **so that** Retry logic clears for this specific sync job upon success.

    **Acceptance criteria:**
      - **AC-032.2.6** — Failure count is zeroed on success.
        - _Measurable:_ After successful write to ENT-EXTERNAL-SOURCE, state.failure_count == 0

    _Status: atomic · Priority: high · Tier: D · Traces to: WF-11, ENT-EXTERNAL-SOURCE · Pass: 3_

    _Decomposition rationale:_ Atomic reset operation ensuring the system treats the job as healthy again.

    _Surfaced assumptions:_ A-0401, A-0402
##### FR-ACCT-1.3.3 `[Tier C · pending]`

**As a** SRE, **I want** Define alerting thresholds for SLA breach monitoring, **so that** Team is notified if 90% of sync events exceed the 1-hour target.

**Acceptance criteria:**
  - **AC-032.3** — Alert fires when sync latency > 1 hour for > 90% of events in a 5-minute window.
    - _Measurable:_ if (count(latency > 1h) / total_events) > 0.9 then trigger_alert

_Status: pending · Priority: high · Tier: C · Traces to: WF-11, TECH-12 · Pass: 2_

_Decomposition rationale:_ Operational verification of the SLA requires concrete metrics and alerting logic. This binds the abstract SLA to actionable observability events.

_Surfaced assumptions:_ A-0162, A-0163, A-0164

  - **FR-ACCT-1.3.3.1** `[Tier C · pending]`
    **As a** SRE, **I want** Compute sync latency metric from Sync Job record timestamps, **so that** Latency value is derived from the Sync Timestamp stored in DBOS records.

    **Acceptance criteria:**
      - **AC-032.3.1** — Latency is computed using the Sync Timestamp, not Request Timestamp.
        - _Measurable:_ latency = (ingest_time - sync_timestamp) for every ENT-SYNC-JOB record

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-12 · Pass: 3_

    _Decomposition rationale:_ This binds the source of truth for latency calculation; prevents ambiguity between external response time and internal sync time.

    _Surfaced assumptions:_ A-0403, A-0404
  - **FR-ACCT-1.3.3.2** `[Tier C · pending]`
    **As a** SRE, **I want** Evaluate breach condition for latency distribution, **so that** Alert trigger logic activates when distribution exceeds 90% breach in window.

    **Acceptance criteria:**
      - **AC-032.3.2** — Alert condition logic compares breach count against threshold.
        - _Measurable:_ count(events where latency > 1h) / total_events > 0.9 implies trigger

    _Status: pending · Priority: high · Tier: C · Traces to: WF-11 · Pass: 3_

    _Decomposition rationale:_ This commits to the specific mathematical policy for triggering the alert, linking the metric aggregation to the external sync workflow.

    _Surfaced assumptions:_ A-0403, A-0404
  - **FR-ACCT-1.3.3.3** `[Tier D · atomic]`
    **As a** Notification Service, **I want** Dispatch alert notification to SRE channels, **so that** Team receives alert message via configured channel within SLA.

    **Acceptance criteria:**
      - **AC-032.3.3** — Alert message is pushed to configured channel.
        - _Measurable:_ Message sent to ENT-NOTIFICATION entity with status 'delivered' within 5 minutes of trigger

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-NOTIFICATION · Pass: 3_

    _Decomposition rationale:_ This is the atomic action (Leaf operation) that fulfills the goal of notifying the team, distinct from the logic of triggering.

    _Surfaced assumptions:_ A-0403, A-0404
##### FR-ACCT-1.3.4 `[Tier D · atomic]`

**As a** DBA, **I want** Persist sync acknowledgment timestamp on every commit, **so that** Internal system can calculate latency without relying on external clock.

**Acceptance criteria:**
  - **AC-032.4** — Every sync event record has a server-side generated `ack_timestamp` field.
    - _Measurable:_ SELECT COUNT(*) FROM sync_events WHERE ack_timestamp IS NULL === 0

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-SYNC-JOB, WF-11 · Pass: 2_

_Decomposition rationale:_ This is an atomic database operation required to validate the latency condition. Without this field, the AC cannot be tested independently.

_Surfaced assumptions:_ A-0162, A-0163, A-0164

#### FR-ACCT-1.4 `[Tier C · pending]`

**As a** CAM operator, **I want** generate reconciliation report for audit verification, **so that** System can produce report proving 100% data match.

**Acceptance criteria:**
  - **AC-033** — Reconciliation report generated on schedule.
    - _Measurable:_ Report contains 0 discrepancies between ENT-INVOICE and external source

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-15, ENT-AUDIT-LOG-ENTRY · Pass: 1_

_Decomposition rationale:_ AC-027 requires a mechanism to verify match; this is the commitment to the audit mechanism.

_Surfaced assumptions:_ A-0041, A-0042, A-0043, A-0044

##### FR-ACCT-1.4.1 `[Tier C · pending]`

**As a** Data Fetcher, **I want** Retrieve internal ledger records matching reconciliation scope, **so that** Set of ENT-INVOICE records fetched for current period.

**Acceptance criteria:**
  - **AC-001** — Internal invoice records are fetched successfully before comparison.
    - _Measurable:_ internal_ledger_batch_count >= expected_invoice_count

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-INVOICE, WF-3 · Pass: 2_

_Decomposition rationale:_ Reconciliation requires the primary dataset from the internal system; this commits the specific data retrieval operation.

_Surfaced assumptions:_ A-0165, A-0166, A-0167

  - **FR-ACCT-1.4.1.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Apply reconciliation scope filters to internal ledger, **so that** Only records within the defined reconciliation period are selected.

    **Acceptance criteria:**
      - **AC-001** — Only records matching period scope are returned.
        - _Measurable:_ query_result.scope_match === true

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-3, ENT-CLIENT-LEDGER · Pass: 3_

    _Decomposition rationale:_ Defines the scope boundaries of the fetch operation; filters data to match the specific reconciliation window before retrieval.

    _Surfaced assumptions:_ A-0405, A-0406
  - **FR-ACCT-1.4.1.2** `[Tier C · pending]`
    **As a** System, **I want** Execute internal ledger query against primary storage, **so that** Data retrieved from ENT-CLIENT-LEDGER without timing out.

    **Acceptance criteria:**
      - **AC-002** — Query completes within service level agreement.
        - _Measurable:_ query_duration_ms < TECH-5_timeout_threshold

    _Status: pending · Priority: high · Tier: C · Traces to: WF-3, TECH-7 · Pass: 3_

    _Decomposition rationale:_ Commits to the performance characteristics of the retrieval process using the primary storage engine.

    _Surfaced assumptions:_ A-0405, A-0406
  - **FR-ACCT-1.4.1.3** `[Tier D · atomic]`
    **As a** System, **I want** Persist fetched batch to staging table, **so that** Record set written to temporary staging area for comparison.

    **Acceptance criteria:**
      - **AC-003** — Persisted count equals fetched count.
        - _Measurable:_ staging_table_count == query_result_count

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-3 · Pass: 3_

    _Decomposition rationale:_ Atomic storage action required before comparison with external source; terminal node in the fetch chain.

    _Surfaced assumptions:_ A-0405, A-0406
  - **FR-ACCT-1.4.1.4** `[Tier C · pending]`
    **As a** System, **I want** Verify batch integrity and duplicate prevention, **so that** No duplicate invoice records exist in the batch.

    **Acceptance criteria:**
      - **AC-004** — Distinct count equals total count.
        - _Measurable:_ count(distinct invoice_id) == count(*)

    _Status: pending · Priority: high · Tier: C · Traces to: WF-3, ENT-CLIENT-LEDGER · Pass: 3_

    _Decomposition rationale:_ Ensures data quality prior to reconciliation; validates the implementation commitment of a consistent dataset.

    _Surfaced assumptions:_ A-0405, A-0406
##### FR-ACCT-1.4.2 `[Tier C · pending]`

**As a** External Syncer, **I want** Fetch corresponding data from external source, **so that** Set of external source records retrieved for comparison.

**Acceptance criteria:**
  - **AC-002** — External source data is available for matching without timeout.
    - _Measurable:_ external_api_response_time <= external_source_latency_sla

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-EXTERNAL-SOURCE, FR-ACCT-1.1 · Pass: 2_

_Decomposition rationale:_ To achieve 0 discrepancies, the system must successfully retrieve the counterpart data; this defines the external fetch commitment.

_Surfaced assumptions:_ A-0165, A-0166, A-0167

  - **FR-ACCT-1.4.2.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Poll external source using exponential backoff, **so that** Data is retrieved or an error is logged after max attempts.

    **Acceptance criteria:**
      - **AC-002-1** — Polling respects availability SLA.
        - _Measurable:_ polling_interval_ms <= external_source_latency_sla * 2

    _Status: pending · Priority: high · Tier: C · Traces to: WF-11 · Pass: 3_

    _Decomposition rationale:_ Defines the specific algorithm used to achieve 'available for matching' without blocking.

    _Surfaced assumptions:_ A-0407, A-0408
  - **FR-ACCT-1.4.2.2** `[Tier C · pending]`
    **As a** CAM operator, **I want** Map external record IDs to internal ledger keys, **so that** Fetch result is transformed into internal schema for comparison.

    **Acceptance criteria:**
      - **AC-002-2** — External ID matches internal mapping.
        - _Measurable:_ external_record_id === internal_entity_id after transformation

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.4.1 · Pass: 3_

    _Decomposition rationale:_ Comparison requires a common key space; this child defines the translation layer.

    _Surfaced assumptions:_ A-0407, A-0408
  - **FR-ACCT-1.4.2.3** `[Tier B · pending]`
    **As a** policy, **I want** Limit fetch scope to current reconciliation period, **so that** Only records within the defined date range are fetched.

    **Acceptance criteria:**
      - **AC-002-3** — Fetched records match date filter.
        - _Measurable:_ fetch_timestamp >= period_start AND fetch_timestamp <= period_end

    _Status: pending · Priority: high · Tier: B · Traces to: FR-ACCT-1.4.4 · Pass: 3_

    _Decomposition rationale:_ Commitment to the scope of data included in the 'set' defined by the report workflow.

    _Surfaced assumptions:_ A-0407, A-0408
  - **FR-ACCT-1.4.2.4** `[Tier C · pending]`
    **As a** CAM operator, **I want** Enforce OAuth token validity check before fetch, **so that** Fetch request aborted if connection not authenticated.

    **Acceptance criteria:**
      - **AC-002-4** — No fetch occurs without valid token.
        - _Measurable:_ token_expires_at >= current_time AND token_status == active

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.4.3, A-0166 · Pass: 3_

    _Decomposition rationale:_ Ensures external source access relies on the OAuth connection established in FR-ACCT-1.1.

    _Surfaced assumptions:_ A-0407, A-0408
##### FR-ACCT-1.4.3 `[Tier C · pending]`

**As a** Delta Calculator, **I want** Compare internal and external records for variance, **so that** List of discrepancies identified if any exist.

**Acceptance criteria:**
  - **AC-003** — Reconciliation logic correctly flags numeric mismatches.
    - _Measurable:_ discrepancy_count === 0 when report_status is 'verified'

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-15, WF-3 · Pass: 2_

_Decomposition rationale:_ The core logic enforcing the '100% match' acceptance criterion; this is the implementation of the matching algorithm.

_Surfaced assumptions:_ A-0165, A-0166, A-0167

  - **FR-ACCT-1.4.3.1** `[Tier D · atomic]`
    **As a** Calculator, **I want** Assert internal invoice amount equals external invoice amount after normalization, **so that** Discrepancy flag set to 'verified' if amounts match exactly or within tolerance.

    **Acceptance criteria:**
      - **AC-101** — Amounts match exactly or within tolerance after normalization.
        - _Measurable:_ abs(internal_amount - external_normalized_amount) <= 0.01

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-3, COMP-15, FR-ACCT-1.4.1, FR-ACCT-1.4.2 · Pass: 3_

    _Decomposition rationale:_ Numeric mismatch is the primary failure condition defined in the parent AC; decomposed into the core value comparison operation.

    _Surfaced assumptions:_ A-0409, A-0410
  - **FR-ACCT-1.4.3.2** `[Tier D · atomic]`
    **As a** Calculator, **I want** Assert invoice date fields match between internal and external records, **so that** Discrepancy flag set if date values differ beyond acceptable offset.

    **Acceptance criteria:**
      - **AC-102** — Date values are identical or within specified offset.
        - _Measurable:_ datetime_parse(internal_date) - datetime_parse(external_date) <= max_offset_days

    _Status: atomic · Priority: high · Tier: D · Traces to: WF-3, FR-ACCT-1.4.2 · Pass: 3_

    _Decomposition rationale:_ Date fields are separate data points within the invoice entity that must be validated independently from the amount.

    _Surfaced assumptions:_ A-0409, A-0410
  - **FR-ACCT-1.4.3.3** `[Tier D · atomic]`
    **As a** Calculator, **I want** Assert invoice status flags match between internal and external records, **so that** Discrepancy flag set if status (e.g., 'Paid', 'Pending') differs.

    **Acceptance criteria:**
      - **AC-103** — Status enum values are equivalent.
        - _Measurable:_ internal_status_map(internal_status) === external_status_map(external_status)

    _Status: atomic · Priority: medium · Tier: D · Traces to: WF-3, COMP-14 · Pass: 3_

    _Decomposition rationale:_ Status flags indicate compliance or payment state which are critical for workflow progression in WF-3.

    _Surfaced assumptions:_ A-0409, A-0410
  - **FR-ACCT-1.4.3.4** `[Tier C · pending]`
    **As a** Normalizer, **I want** Apply currency normalization to external values prior to amount comparison, **so that** External monetary values are converted to system standard for comparison.

    **Acceptance criteria:**
      - **AC-104** — Conversion uses exchange rate snapshot.
        - _Measurable:_ rate_source === 'live_exchange_api' and timestamp_within(1h)

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-3, FR-ACCT-1.4.2 · Pass: 3_

    _Decomposition rationale:_ Currency conversion is a pre-condition for amount comparison; treated as Tier C due to the implementation choice of exchange rate source.

    _Surfaced assumptions:_ A-0409, A-0410
##### FR-ACCT-1.4.4 `[Tier C · pending]`

**As a** Report Generator, **I want** Generate and store the final report file, **so that** Reconciliation report file persisted and available for download.

**Acceptance criteria:**
  - **AC-004** — Report file is created with correct content and metadata.
    - _Measurable:_ file_exists_at_storage_path && file_metadata.includes_report_id

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-REPORT-CONFIG, ENT-AUDIT-LOG-ENTRY · Pass: 2_

_Decomposition rationale:_ Final artifact creation and persistence; defines the output generation commitment required by the user request.

_Surfaced assumptions:_ A-0165, A-0166, A-0167

  - **FR-ACCT-1.4.4-01** `[Tier C · pending]`
    **As a** Data Aggregator, **I want** Aggregate internal and external records into a structured payload for report generation, **so that** Payload includes all discrepancies and metadata fields required by the report configuration.

    **Acceptance criteria:**
      - **AC-005** — Aggregated payload matches reconciliation scope data.
        - _Measurable:_ payload.discrepancies_count === total_discrepancies_from_comparison_step

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.4.3, ENT-REPORT-CONFIG · Pass: 3_

    _Decomposition rationale:_ This child breaks down the 'Generate' phase into the specific action of assembling the data structure before serialization.

    _Surfaced assumptions:_ A-0411, A-0412
  - **FR-ACCT-1.4.4-02** `[Tier C · pending]`
    **As a** Renderer, **I want** Serialize payload into the target document format (PDF or CSV) and compute integrity hash, **so that** Binary file is valid, readable, and includes report ID in metadata.

    **Acceptance criteria:**
      - **AC-006** — Output file is binary-valid and passes schema validation.
        - _Measurable:_ file_content_type === 'application/pdf' && file_metadata.report_id === 'REPORT-XXX'

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-REPORT-CONFIG, ENT-DOM-SECURITY · Pass: 3_

    _Decomposition rationale:_ Serialization is a distinct implementation decision (format selection, hashing) that must be committed before storage.

    _Surfaced assumptions:_ A-0411, A-0412
  - **FR-ACCT-1.4.4-03** `[Tier C · pending]`
    **As a** Storage Writer, **I want** Upload binary file to SeaweedFS object store bucket, **so that** File object exists at configured path with correct permissions.

    **Acceptance criteria:**
      - **AC-007** — File is physically persisted and accessible via path.
        - _Measurable:_ storage.get_object(file_path) !== null && storage.get_object_metadata(file_path).hash === computed_hash

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-DOC-STORAGE-FOLDER, ENT-DOM-SECURITY · Pass: 3_

    _Decomposition rationale:_ Storage persistence is a separate commitment from serialization, relying on the SeaweedFS technical constraint.

    _Surfaced assumptions:_ A-0411, A-0412
  - **FR-ACCT-1.4.4-04** `[Tier D · atomic]`
    **As a** Indexer, **I want** Persist metadata and generate download token for retrieval, **so that** Metadata is indexed for download, and download URL is retrievable.

    **Acceptance criteria:**
      - **AC-008** — Metadata is stored in file index and download URL is valid.
        - _Measurable:_ index.contains(report_id) && download_url.is_valid && download_url.expiry_hours <= 24

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-AUDIT-LOG-ENTRY, ENT-NOTIFICATION · Pass: 3_

    _Decomposition rationale:_ This is a terminal leaf operation where the system state is fully set for the user to download, making it atomic and testable.

    _Surfaced assumptions:_ A-0411, A-0412
### Release 3: Community Association Management Hub (5 roots)
*This release delivers advanced tools for Community Association Managers (CAMs) and board members to handle governance, accounting, and compliance. It includes features for processing architectural review requests, secure voting on board motions, monitoring platform data integrity, reviewing financial health, and auditing community compliance.*

### FR US-009 `[pending]`

**As a** CAM, **I want** Process an Architectural Review Committee (ARC) request, **so that** CAM reviews and records decision on modification request.

**Acceptance criteria:**
  - **AC-016** — Decision recorded in audit log
    - _Measurable:_ ENT-ARC-REQUEST status updates to decision within 1 hour of review
  - **AC-017** — Applicant notified
    - _Measurable:_ Notification sent to applicant via ENT-NOTIFICATION channel

_Status: pending · Priority: critical · Traces to: UJ-9, ENT-ARC-REQUEST, COMP-4, VOC-9, WF-5 · Pass: 0_

#### US-009-C-1 `[Tier C · pending]`

**As a** System, **I want** Persist decision state and update audit log, **so that** Audit entry exists with decision status timestamped.

**Acceptance criteria:**
  - **AC-016-01** — Audit log entry created for decision.
    - _Measurable:_ ENT-ARC-REQUEST status field equals 'DECISION' and row exists in audit_log at commit time

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-9 · Pass: 1_

_Decomposition rationale:_ This child binds the requirement to record the decision outcome and status in the audit log, satisfying AC-016.

_Surfaced assumptions:_ A-0023, A-0024, A-0025, A-0026

##### US-009-C-1.1 `[Tier D · atomic]`

**As a** System, **I want** Update ENT-ARC-REQUEST status field, **so that** ENT-ARC-REQUEST status field is set to 'DECISION'.

**Acceptance criteria:**
  - **AC-001** — Status field reflects decision.
    - _Measurable:_ ENT-ARC-REQUEST.status === 'DECISION' at commit time

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-9 · Pass: 2_

_Decomposition rationale:_ Separates the primary entity state update (business logic) from the side-effect audit trail, ensuring distinct verification for each atomic database operation.

_Surfaced assumptions:_ A-0120, A-0121

##### US-009-C-1.2 `[Tier D · atomic]`

**As a** System, **I want** Create ENT-AUDIT-LOG-ENTRY, **so that** Row exists in audit_log with decision status and timestamp.

**Acceptance criteria:**
  - **AC-002** — Audit row persists at commit.
    - _Measurable:_ ENT-AUDIT-LOG-ENTRY.row_exists === true at commit time AND ENT-AUDIT-LOG-ENTRY.status === 'DECISION'

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-9 · Pass: 2_

_Decomposition rationale:_ Captures the side-effect commitment regarding the immutable audit trail, which is a compliance constraint requiring distinct handling from the primary business object.

_Surfaced assumptions:_ A-0120, A-0121

#### US-009-C-2 `[Tier C · pending]`

**As a** System, **I want** Dispatch applicant notification, **so that** Applicant receives decision notice via channel.

**Acceptance criteria:**
  - **AC-017-01** — Notification sent via configured channel.
    - _Measurable:_ ENT-NOTIFICATION entry created with status 'SENT' containing decision details

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-9 · Pass: 1_

_Decomposition rationale:_ This child binds the requirement to communicate the outcome to the applicant, satisfying AC-017.

_Surfaced assumptions:_ A-0023, A-0024, A-0025, A-0026

##### US-009-C-2.1 `[Tier C · pending]`

**As a** System, **I want** Resolve delivery channel preference based on applicant profile, **so that** System selects the configured communication channel for the notification.

**Acceptance criteria:**
  - **AC-017-01.1** — Channel matches the applicant's configured contact preference
    - _Measurable:_ ENT-NOTIFICATION.channel_type matches user profile contact_type for ID: {applicant_id}

_Status: pending · Priority: high · Tier: C · Traces to: UJ-9 · Pass: 2_

_Decomposition rationale:_ Selecting the channel is a concrete implementation decision under the dispatch commitment; must happen before payload persistence.

  - **US-009-C-2.1a-1** `[Tier C · pending]`
    **As a** System Logic, **I want** Retrieve user profile record containing configured contact preferences, **so that** User profile data with contact_type field is available for selection logic.

    **Acceptance criteria:**
      - **AC-018-01** — Profile lookup returns populated contact_type for valid applicant_id
        - _Measurable:_ SELECT contact_type FROM ENT-USER WHERE id = {applicant_id} returns non-null value

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-9 · Pass: 3_

    _Decomposition rationale:_ This child binds the data-fetching responsibility to the system implementation, ensuring no data is used without prior retrieval.

    _Surfaced assumptions:_ A-0328, A-0329
  - **US-009-C-2.1a-2** `[Tier B · pending]`
    **As a** System Logic, **I want** Define channel selection priority hierarchy based on platform constraints, **so that** Static priority rules map channel types to selection precedence.

    **Acceptance criteria:**
      - **AC-018-02** — Priority rules are consistent across all tenant instances
        - _Measurable:_ channel_priority_map returned by function matches deployment configuration

    _Status: pending · Priority: high · Tier: B · Traces to: UJ-9, US-009-C-2.3 · Pass: 3_

    _Decomposition rationale:_ This child defines a governing rule (priority hierarchy) that dictates system behavior; without this policy, selection cannot occur deterministically.

    _Surfaced assumptions:_ A-0328, A-0329
  - **US-009-C-2.1a-3** `[Tier D · atomic]`
    **As a** System Logic, **I want** Select and return the single primary channel for delivery, **so that** Final channel_type is selected and persisted to notification record.

    **Acceptance criteria:**
      - **AC-018-03** — Exactly one channel_type is selected for notification
        - _Measurable:_ ENT-NOTIFICATION.channel_type holds exactly one valid value per record

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-009-C-2.2 · Pass: 3_

    _Decomposition rationale:_ This child represents the atomic leaf operation where the final decision is made and passed to the composition stage.

    _Surfaced assumptions:_ A-0328, A-0329
##### US-009-C-2.2 `[Tier C · pending]`

**As a** System, **I want** Compose notification content using decision decision template, **so that** Payload includes accurate decision details and decision ID.

**Acceptance criteria:**
  - **AC-017-01.2** — Payload contains accurate decision details
    - _Measurable:_ JSON payload.decision_status matches parent decision state AND payload.decision_date matches parent decision timestamp

_Status: pending · Priority: high · Tier: C · Traces to: UJ-9 · Pass: 2_

_Decomposition rationale:_ Content mapping is an implementation choice that must be committed before sending to ensure data integrity.

  - **US-009-C-2.2-001** `[Tier B · pending]`
    **As a** Template Selector, **I want** Select appropriate notification template based on decision status type, **so that** Notification content matches the semantic intent of the decision (approved/denied).

    **Acceptance criteria:**
      - **AC-001** — Template ID corresponds to decision outcome.
        - _Measurable:_ template_id == lookup(status_to_template(decision_status))

    _Status: pending · Priority: critical · Tier: B · Traces to: UJ-9 · Pass: 3_

    _Decomposition rationale:_ Establishes the governing rule for content selection before specific field mapping occurs. This is a strategy choice (Tier B), not a simple implementation call.

    _Surfaced assumptions:_ A-0330, A-0331
  - **US-009-C-2.2-002** `[Tier C · pending]`
    **As a** Field Mapper, **I want** Map decision record fields to JSON payload slots, **so that** JSON payload contains `decision_status` and `decision_date` keys populated from source.

    **Acceptance criteria:**
      - **AC-002** — Payload keys match decision source keys.
        - _Measurable:_ payload.decision_status == source.decision_status && payload.decision_date == source.decision_date

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-9 · Pass: 3_

    _Decomposition rationale:_ Concrete implementation choice defining specific data transformation rules under the scope commitment of the parent.

    _Surfaced assumptions:_ A-0330, A-0331
  - **US-009-C-2.2-003** `[Tier C · pending]`
    **As a** Validator, **I want** Validate payload against decision object before dispatch, **so that** Notification fails gracefully if payload data diverges from decision record.

    **Acceptance criteria:**
      - **AC-003** — Discrepancy detection logic executes.
        - _Measurable:_ validate(payload, decision_obj) -> true OR throw_error('data_mismatch')

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-9 · Pass: 3_

    _Decomposition rationale:_ Concrete verification logic (Tier C) to ensure the AC 'accurate decision details' is met before the parent completes.

    _Surfaced assumptions:_ A-0330, A-0331
##### US-009-C-2.3 `[Tier D · atomic]`

**As a** System, **I want** Persist notification event to database record, **so that** ENT-NOTIFICATION entry created with status 'SENT' and channel metadata.

**Acceptance criteria:**
  - **AC-017-01.3** — Database record created immediately
    - _Measurable:_ ENT-NOTIFICATION table row exists with status='SENT' within 1 second of dispatch trigger

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-9 · Pass: 2_

_Decomposition rationale:_ Persistence is an atomic action verifiable by testing the DB record; terminal node in the decomposition tree.

##### US-009-C-2.4 `[Tier D · atomic]`

**As a** System, **I want** Log delivery attempt result to audit trail, **so that** Delivery log updated with send success/failure and timestamp.

**Acceptance criteria:**
  - **AC-017-01.4** — Delivery outcome recorded permanently
    - _Measurable:_ ENT-MESSAGE-LOG entry exists with status matching external provider response code

_Status: atomic · Priority: medium · Tier: D · Traces to: UJ-9 · Pass: 2_

_Decomposition rationale:_ Logging is a separate atomic verification step required for compliance and debugging, independent of persistence.

#### US-009-C-3 `[Tier C · pending]`

**As a** System, **I want** Enforce review SLA compliance, **so that** Request flagged if review exceeds SLA.

**Acceptance criteria:**
  - **AC-016-02** — Decision logged within review window.
    - _Measurable:_ timestamp(audit_log_entry) - timestamp(status='IN_REVIEW') <= 1 hour

_Status: pending · Priority: high · Tier: C · Traces to: UJ-9 · Pass: 1_

_Decomposition rationale:_ This child binds the time-bound commitment of the acceptance criteria, ensuring the system enforces the 1-hour window.

_Surfaced assumptions:_ A-0023, A-0024, A-0025, A-0026

##### US-009-C-3.1 `[Tier C · pending]`

**As a** System Scheduler, **I want** Capture 'IN_REVIEW' status transition timestamp atomically, **so that** Start time for SLA window is recorded on status change.

**Acceptance criteria:**
  - **AC-001** — Transition event logged with monotonic clock source.
    - _Measurable:_ status_change_timestamp <= system_clock_at_commit_within_1ms

_Status: pending · Priority: critical · Tier: C · Traces to: US-009-C-3 · Pass: 2_

_Decomposition rationale:_ SLA enforcement requires a precise start time; the status transition must be the anchor point for the delta calculation.

_Surfaced assumptions:_ A-0122, A-0123

  - **US-009-C-3.1.C-01** `[Tier C · pending]`
    **As a** Database Engine, **I want** Execute status update and timestamp capture within a single transaction block, **so that** Status change and timestamp are recorded as a single atomic unit.

    **Acceptance criteria:**
      - **AC-001** — Timestamp recorded at exact moment of state change.
        - _Measurable:_ status_change_timestamp === COMMIT_TIMESTAMP for every row updated in status_change_status_table

    _Status: pending · Priority: critical · Tier: C · Traces to: US-009-C-3, US-009-C-3.2, US-009-C-3.3 · Pass: 3_

    _Decomposition rationale:_ Establishes the atomic boundary required by the AC. This binds the requirement to the database engine's ability to provide commit-time consistency.

    _Surfaced assumptions:_ A-0332, A-0333, A-0334
  - **US-009-C-3.1.C-02** `[Tier D · atomic]`
    **As a** Audit Logger, **I want** Insert immutable audit log entry for the status transition event, **so that** Log entry exists immediately after transaction commit with matching timestamp.

    **Acceptance criteria:**
      - **AC-002** — Audit log entry is written before transaction commit completes.
        - _Measurable:_ ENT-AUDIT-LOG-ENTRY exists in storage within 1ms of transaction_commit_timestamp

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-009-C-3, WF-13 · Pass: 3_

    _Decomposition rationale:_ Decomposes into the leaf operation that actually writes the audit trail. This is the terminal node for verification.

    _Surfaced assumptions:_ A-0332, A-0333, A-0334
  - **US-009-C-3.1.C-03** `[Tier C · pending]`
    **As a** SLA Timer, **I want** Initialize countdown timer using the captured timestamp as the start value, **so that** SLA window for 'IN_REVIEW' state begins counting from the committed timestamp.

    **Acceptance criteria:**
      - **AC-003** — Timer start time matches recorded status_change_timestamp.
        - _Measurable:_ timer_start_value === status_change_timestamp for work_order where status='IN_REVIEW'

    _Status: pending · Priority: high · Tier: C · Traces to: US-009-C-3.2 · Pass: 3_

    _Decomposition rationale:_ Connects the timestamp capture to the sibling requirement (US-009-C-3.2) that computes elapsed time, ensuring the start time is the reference for the duration calculation.

    _Surfaced assumptions:_ A-0332, A-0333, A-0334
##### US-009-C-3.2 `[Tier C · pending]`

**As a** SLA Validator, **I want** Compute elapsed time against UTC SLA threshold, **so that** Current elapsed time is compared to 1 hour limit.

**Acceptance criteria:**
  - **AC-002** — Delta calculation uses consistent timezone (UTC).
    - _Measurable:_ utc_now - status_change_timestamp <= 3600000 milliseconds

_Status: pending · Priority: high · Tier: C · Traces to: US-009-C-3 · Pass: 2_

_Decomposition rationale:_ Verifications must use a defined timezone to be deterministic; calculation happens before commit or in background.

_Surfaced assumptions:_ A-0122, A-0123

  - **US-009-C-3.2.1** `[Tier D · atomic]`
    **As a** Time Source Validator, **I want** Fetch status_change_timestamp from database record, **so that** Recorded UTC timestamp is retrieved for delta calculation.

    **Acceptance criteria:**
      - **AC-002-1** — Status change timestamp exists and is numeric.
        - _Measurable:_ status_change_timestamp is not null AND isInteger(status_change_timestamp / 1000) * 1000

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-009-C-3.1 · Pass: 3_

    _Decomposition rationale:_ The start time for SLA calculation must be extracted atomically from the status change event to ensure the window boundary is defined.

    _Surfaced assumptions:_ A-0335, A-0336
  - **US-009-C-3.2.2** `[Tier D · atomic]`
    **As a** Current Time Validator, **I want** Fetch current UTC wall clock time, **so that** Current system time in UTC is available for subtraction.

    **Acceptance criteria:**
      - **AC-002-2** — Current system time is synchronized.
        - _Measurable:_ abs(now() - wall_clock_utc) < 100 milliseconds

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-009-C-3 · Pass: 3_

    _Decomposition rationale:_ The end time must be obtained from a synchronized source to ensure accuracy, aligning with the wall clock constraint.

    _Surfaced assumptions:_ A-0335, A-0336
  - **US-009-C-3.2.3** `[Tier D · atomic]`
    **As a** SLA Threshold Evaluator, **I want** Compare delta against 3600000 millisecond limit, **so that** Boolean flag indicating SLA breach status is determined.

    **Acceptance criteria:**
      - **AC-002-3** — Delta comparison yields correct breach status.
        - _Measurable:_ delta_ms <= 3600000 ? is_breach_false : is_breach_true

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-009-C-3.3 · Pass: 3_

    _Decomposition rationale:_ The final evaluation step commits the decision logic that feeds the breach flag persistence.

    _Surfaced assumptions:_ A-0335, A-0336
##### US-009-C-3.3 `[Tier D · atomic]`

**As a** Auditor, **I want** Persist SLA breach flag in request record, **so that** Request record indicates 'overdue' status for UI/Alert.

**Acceptance criteria:**
  - **AC-003** — Overdue flag set when delta exceeds threshold.
    - _Measurable:_ is_sla_breach === true WHEN (utc_now - status_change_timestamp > 3600000)

_Status: atomic · Priority: critical · Tier: D · Traces to: US-009-C-3 · Pass: 2_

_Decomposition rationale:_ Flagging is a testable state change that does not require further decomposition; it is an atomic action.

_Surfaced assumptions:_ A-0122, A-0123

### FR US-010 `[pending]`

**As a** Board Member, **I want** Vote on a board motion securely, **so that** Board member casts encrypted vote during virtual meeting.

**Acceptance criteria:**
  - **AC-018** — Vote encrypted
    - _Measurable:_ Vote payload encrypted using standard TLS before reaching ENT-VOTE database
  - **AC-019** — Record immutable
    - _Measurable:_ ENT-VOTE-RESULT record hash remains constant after submission

_Status: pending · Priority: critical · Traces to: UJ-10, ENT-VOTE, ENT-VOTE-RESULT, COMP-4, VOC-16, WF-5 · Pass: 0_

#### US-010-C-001 `[Tier B · pending]`

**As a** Engineering sub-strategy, **I want** Mandate TLS 1.2+ for all vote payload transport, **so that** Vote data is encrypted in transit using industry standard TLS 1.2+.

**Acceptance criteria:**
  - **AC-020** — HTTPS connection required for vote submission.
    - _Measurable:_ Client connection to ENT-VOTE endpoint fails if SSL/TLS certificate validation or protocol version check fails (requires TLS >= 1.2)

_Status: pending · Priority: critical · Tier: B · Traces to: UJ-10, TECH-2 · Pass: 1_

_Decomposition rationale:_ Addresses AC-018 (Vote encrypted). This is an engineering sub-strategy defining the transport security architecture required to achieve the parent goal.

_Surfaced assumptions:_ A-0027, A-0028, A-0029, A-0030, A-0031

##### US-010-C-001.1 `[Tier C · pending]`

**As a** Infrastructure Engineer, **I want** Configure Traefik (TECH-2) to enforce minimum TLS version of 1.2, **so that** All vote requests over TLS 1.0 or 1.1 are rejected at the ingress layer.

**Acceptance criteria:**
  - **AC-021** — Ingress proxy terminates connections with TLS < 1.2
    - _Measurable:_ Traefik middleware 'minimumTLSVersion' set to '1.2' for path /vote

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-10, TECH-2, A-0027 · Pass: 2_

_Decomposition rationale:_ Defines the specific infrastructure configuration action required to satisfy the mandate; relies on existing assumptions about Traefik capabilities.

_Surfaced assumptions:_ A-0216, A-0217

  - **US-010-C-001.1-1** `[Tier D · atomic]`
    **As a** Infra Operator, **I want** Reject incoming TLS connections where min_version < 1.2, **so that** Connections are immediately closed and a 421 Misdirected/403 Forbidden response is sent to the client.

    **Acceptance criteria:**
      - **AC-021** — Ingress proxy terminates connections with TLS < 1.2
        - _Measurable:_ if(TLS_Version < 1.2) then drop_connection()

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10, TECH-2 · Pass: 3_

    _Decomposition rationale:_ The parent describes the configuration goal. This child defines the atomic system behavior (rejecting low-TLS) required to meet the goal. No further sub-actions exist within the rejection logic.
##### US-010-C-001.2 `[Tier C · pending]`

**As a** Security Engineer, **I want** Define cipher suite allowlist for vote endpoints, **so that** Only TLS 1.2+ compatible cipher suites (ECDHE) are permitted for vote transport.

**Acceptance criteria:**
  - **AC-022** — TLS handshake fails with legacy cipher suites
    - _Measurable:_ System returns 4xx or closes connection on TLS handshake offer of RC4, MD5, or NULL ciphers

_Status: pending · Priority: high · Tier: C · Traces to: UJ-10, TECH-1, TECH-2 · Pass: 2_

_Decomposition rationale:_ Ensures that even if TLS 1.2 is supported, weak cryptographic algorithms that do not meet 'industry standard' security expectations are ruled out.

_Surfaced assumptions:_ A-0216, A-0217

  - **US-010-C-001.2.1** `[Tier D · atomic]`
    **As a** Security Configurator, **I want** Configure Traefik TLS options to permit only ECDHE suites, **so that** Only connections using ECDHE key exchange succeed.

    **Acceptance criteria:**
      - **AC-022.1** — Traefik accepts connection only if Client Hello offers ECDHE
        - _Measurable:_ Traefik `tls.ciphers` config contains only suites with ECDHE, rejecting all others

    _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-2 · Pass: 3_

    _Decomposition rationale:_ Direct implementation of the 'ECDHE only' requirement at the ingress proxy where TLS terminates.

    _Surfaced assumptions:_ A-0521, A-0522, A-0523
  - **US-010-C-001.2.2** `[Tier D · atomic]`
    **As a** Security Configurator, **I want** Configure Traefik to disable legacy suites (RC4, MD5, NULL), **so that** Legacy cipher suites are rejected at the handshake.

    **Acceptance criteria:**
      - **AC-022.2** — System rejects RC4, MD5, or NULL ciphers immediately
        - _Measurable:_ Connection closes on offer of RC4, MD5, or NULL, returning 4xx

    _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-2 · Pass: 3_

    _Decomposition rationale:_ Explicitly addresses the 'fails with legacy cipher suites' AC by enumerating specific legacy protocols to block.

    _Surfaced assumptions:_ A-0521, A-0522, A-0523
  - **US-010-C-001.2.3** `[Tier D · atomic]`
    **As a** Security Validator, **I want** Validate non-ECDHE suites (e.g., Diffie-Hellman) are rejected, **so that** Non-ECDHE suites fail handshake validation.

    **Acceptance criteria:**
      - **AC-022.3** — System rejects non-ECDHE suites (DHE or RSA)
        - _Measurable:_ Handshake fails for any suite not matching ECDHE pattern in `tls.ciphers`

    _Status: atomic · Priority: high · Tier: D · Traces to: TECH-2 · Pass: 3_

    _Decomposition rationale:_ Ensures the 'ECDHE' constraint is strictly enforced, distinguishing it from version-only or TLS-only controls.

    _Surfaced assumptions:_ A-0521, A-0522, A-0523
##### US-010-C-001.3 `[Tier D · atomic]`

**As a** Backend Service, **I want** Log TLS handshake failures and downgrade attempts to audit trail, **so that** Security events regarding transport security violations are recorded in ENT-AUDIT-LOG-ENTRY.

**Acceptance criteria:**
  - **AC-023** — Audit log entry created for failed TLS handshake
    - _Measurable:_ ENT-AUDIT-LOG-ENTRY count increments on TLS 1.0/1.1 connect attempt, log immutable per ENT-CONSTRAINT

_Status: atomic · Priority: medium · Tier: D · Traces to: TECH-12, A-0027 · Pass: 2_

_Decomposition rationale:_ Atomic action for verifying compliance history; ensures that security incidents are captured for investigation without needing further architectural breakdown.

_Surfaced assumptions:_ A-0216, A-0217

##### US-010-C-001.4 `[Tier C · pending]`

**As a** DevOps Engineer, **I want** Implement certificate chain validation on vote path, **so that** Client receives error if certificate chain does not validate against trusted root.

**Acceptance criteria:**
  - **AC-024** — Certificate chain is verified before vote processing
    - _Measurable:_ TLS alert 'bad_certificate' returned if intermediate certificate is missing or expired

_Status: pending · Priority: high · Tier: C · Traces to: UJ-10, TECH-1, TECH-2 · Pass: 2_

_Decomposition rationale:_ Specific implementation commitment regarding trust store configuration; distinct from the minimum version requirement (Child 1).

_Surfaced assumptions:_ A-0216, A-0217

  - **FR-ACCT-4.1** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Configure Traefik TLS verification to require full chain validation, **so that** Requests are rejected immediately if the certificate chain presented by Cloudflare is incomplete or untrusted.

    **Acceptance criteria:**
      - **AC-001** — Traefik TLS configuration enforces chain depth validation.
        - _Measurable:_ tls.verify_depth === 2 (or equivalent) and tls.verify = true in Traefik configuration file for vote endpoint route

    _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-2 · Pass: 3_

    _Decomposition rationale:_ This is the atomic configuration action that binds the system to the validation requirement. It is verifiable by inspecting the Traefik YAML/Config.

    _Surfaced assumptions:_ A-0524, A-0525, A-0526
  - **FR-ACCT-4.2** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Map TLS handshake errors to standard HTTP status and alerts, **so that** Client receives appropriate TLS alert (e.g. 'bad_certificate') and HTTP status instead of raw connection drop.

    **Acceptance criteria:**
      - **AC-002** — HTTP response uses valid TLS alert codes for validation failures.
        - _Measurable:_ TLS alert code 'bad_certificate' is returned in response header or connection closure when validation fails per RFC 5246

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-10 · Pass: 3_

    _Decomposition rationale:_ This is a leaf operation defining the observable behavior for the client application when a validation failure occurs.

    _Surfaced assumptions:_ A-0524, A-0525, A-0526
  - **FR-ACCT-4.3** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Ensure Traefik trusted CA bundle is synchronized with upstream root store, **so that** System validates against current root CAs available at deployment time without service interruption.

    **Acceptance criteria:**
      - **AC-003** — Root CA bundle matches latest Mozilla Trust Store.
        - _Measurable:_ sha256sum(trusted_ca_bundle.pem) matches current Mozilla Root List at time of deployment

    _Status: atomic · Priority: high · Tier: D · Traces to: TECH-2 · Pass: 3_

    _Decomposition rationale:_ This is the maintenance commitment ensuring that the system continues to validate chains correctly as trust anchors rotate.

    _Surfaced assumptions:_ A-0524, A-0525, A-0526
#### US-010-C-004 `[Tier C · pending]`

**As a** Implementation commitment, **I want** Bind vote record to specific meeting instance ID, **so that** Vote is associated with the correct virtual meeting for tallies.

**Acceptance criteria:**
  - **AC-023** — Vote record must link to a valid meeting.
    - _Measurable:_ ENT-VOTE-RESULT 'meeting_id' field must exist and reference a row in ENT-MEETING

_Status: pending · Priority: high · Tier: C · Traces to: UJ-10, ENT-MEETING, WF-5 · Pass: 1_

_Decomposition rationale:_ Implementation detail for the 'Virtual Meeting' context. This binds the vote to the correct scope.

_Surfaced assumptions:_ A-0027, A-0028, A-0029, A-0030, A-0031

##### US-010-C-004.1 `[Tier C · pending]`

**As a** Data Integrity Commitment, **I want** Enforce foreign key constraint on ENT-VOTE-RESULT.meeting_id, **so that** No vote can be persisted unless a corresponding ENT-MEETING record exists.

**Acceptance criteria:**
  - **AC-024** — Foreign key constraint on meeting_id is active.
    - _Measurable:_ Database transaction fails if ENT-VOTE-RESULT.insert(meeting_id='invalid') is executed

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-MEETING, ENT-VOTE-RESULT, UJ-10 · Pass: 2_

_Decomposition rationale:_ This child enforces the core data model integrity defined in the parent AC-023. It translates the 'must link' requirement into a concrete schema constraint (Tier C).

_Surfaced assumptions:_ A-0124, A-0125

  - **US-010-C-004.1.1** `[Tier C · pending]`
    **As a** DB Architect, **I want** Define FK constraint in PostgreSQL schema for ENT-VOTE-RESULT.meeting_id, **so that** Database enforces referential integrity by rejecting inserts with non-existent meeting IDs.

    **Acceptance criteria:**
      - **AC-001** — Insert fails with error code for missing parent.
        - _Measurable:_ PostgreSQL constraint error raised when INSERT statement references invalid meeting_id

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-7 · Pass: 3_

    _Decomposition rationale:_ This is the direct implementation commitment required to enforce the parent. It commits to the database engine and schema strategy (DBOS/Postgres) rather than a functional area.

    _Surfaced assumptions:_ A-0337, A-0338
  - **US-010-C-004.1.2** `[Tier D · atomic]`
    **As a** API Handler, **I want** Return standardized 400 Bad Request when FK constraint is violated, **so that** Client receives clear error message indicating invalid meeting_id reference.

    **Acceptance criteria:**
      - **AC-002** — API returns HTTP 400 with message referencing valid meeting IDs.
        - _Measurable:_ Response status code is 400 and body includes 'invalid meeting_id' reference when FK check fails

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-10 · Pass: 3_

    _Decomposition rationale:_ This is a leaf operation defining the system's behavioral response to the implementation commitment defined in the parent. It is atomic and testable against the API layer.

    _Surfaced assumptions:_ A-0337, A-0338
  - **US-010-C-004.1.3** `[Tier C · pending]`
    **As a** Data Integrity Engineer, **I want** Perform pre-enforcement scan for existing orphaned votes, **so that** System identifies votes with invalid meeting_ids before constraint activation.

    **Acceptance criteria:**
      - **AC-003** — Scan query returns count of votes referencing non-existent meetings.
        - _Measurable:_ Query `SELECT COUNT(*) FROM ENT-VOTE-RESULT WHERE meeting_id NOT IN (SELECT id FROM ENT-MEETING)` returns non-zero only for pre-migration orphaned records

    _Status: pending · Priority: medium · Tier: C · Traces to: COMP-17 · Pass: 3_

    _Decomposition rationale:_ This child addresses the state of the system relative to the new commitment (existing data hygiene). It is an implementation commitment regarding how current state is reconciled with the new constraint.

    _Surfaced assumptions:_ A-0337, A-0338
##### US-010-C-004.2 `[Tier C · pending]`

**As a** Business Logic Commitment, **I want** Validate meeting status prior to vote submission, **so that** Vote is rejected if meeting is in invalid states (e.g., Deleted/Archived).

**Acceptance criteria:**
  - **AC-025** — Vote submission blocked for invalid meetings.
    - _Measurable:_ API returns 400 status if ENT-MEETING.status NOT IN ('ACTIVE', 'COMPLETED')

_Status: pending · Priority: high · Tier: C · Traces to: WF-5, ENT-MEETING, UJ-10 · Pass: 2_

_Decomposition rationale:_ This child binds the voting policy to the meeting lifecycle. It ensures the vote is associated with a 'correct' virtual meeting as per parent intent, filtering out historical or invalid meetings.

_Surfaced assumptions:_ A-0124, A-0125

  - **US-010-C-004.2-A** `[Tier C · pending]`
    **As a** Validation Logic, **I want** Enforce synchronous status check against allowed enum values, **so that** System rejects request and returns 400 status immediately if meeting status is outside ACTIVE/COMPLETED.

    **Acceptance criteria:**
      - **AC-026** — Invalid status requests are rejected.
        - _Measurable:_ If ENT-MEETING.status NOT IN ('ACTIVE', 'COMPLETED'), response.status_code === 400

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-5, UJ-10 · Pass: 3_

    _Decomposition rationale:_ Decomposes the validation logic into the specific strategy of synchronous enforcement before persistence, distinguishing it from database-level constraints.

    _Surfaced assumptions:_ A-0339, A-0340
  - **US-010-C-004.2-B** `[Tier D · atomic]`
    **As a** Error Handler, **I want** Construct and send 400 Bad Request response, **so that** Client receives 400 status with validation error message.

    **Acceptance criteria:**
      - **AC-027** — Response status code is 400 for failed validation.
        - _Measurable:_ response.status_code === 400 AND response.content_type === 'application/json'

    _Status: atomic · Priority: medium · Tier: D · Traces to: WF-5, UJ-10 · Pass: 3_

    _Decomposition rationale:_ Atomic action of generating the error payload and HTTP response upon validation failure.

    _Surfaced assumptions:_ A-0339, A-0340
##### US-010-C-004.3 `[Tier C · pending]`

**As a** Performance Commitment, **I want** Create composite index on ENT-VOTE-RESULT for meeting_id and status, **so that** Tallies can be aggregated efficiently by meeting instance.

**Acceptance criteria:**
  - **AC-026** — Index exists on meeting_id.
    - _Measurable:_ Database query plan shows index usage for aggregation queries on ENT-VOTE-RESULT.meeting_id

_Status: pending · Priority: medium · Tier: C · Traces to: ENT-VOTE-RESULT, WF-5 · Pass: 2_

_Decomposition rationale:_ This child addresses the downstream consequence of tallies (implied by AC-023 'for tallies'). It is an architectural/implementation choice (Tier C) that ensures the system performs correctly when AC-023 is tested.

_Surfaced assumptions:_ A-0124, A-0125

  - **US-010-C-004.3-C-1** `[Tier C · pending]`
    **As a** DB Architect, **I want** Define specific columns for composite index, **so that** PostgreSQL schema includes index on meeting_id and status.

    **Acceptance criteria:**
      - **AC-027** — Index includes both meeting_id and status columns.
        - _Measurable:_ pg_indexes view shows index name on meeting_id, status for ENT-VOTE-RESULT

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-VOTE-RESULT, US-010-C-004.1 · Pass: 3_

    _Decomposition rationale:_ Must specify which columns are indexed to ensure FK alignment with US-010-C-004.1 constraint and efficient filtering for WF-5 tallies.

    _Surfaced assumptions:_ A-0341, A-0342
  - **US-010-C-004.3-C-2** `[Tier C · pending]`
    **As a** Performance Engineer, **I want** Enforce index usage for aggregation, **so that** Query optimizer selects index for meeting_id grouping.

    **Acceptance criteria:**
      - **AC-028** — Aggregation queries scan via index.
        - _Measurable:_ EXPLAIN ANALYZE shows Index Scan on index path instead of Seq Scan for WHERE meeting_id IN queries

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-5, ENT-VOTE-RESULT · Pass: 3_

    _Decomposition rationale:_ Commit to ensure WF-5 aggregation queries use the new index rather than full table scans during tally aggregation.

    _Surfaced assumptions:_ A-0341, A-0342
  - **US-010-C-004.3-C-3** `[Tier D · atomic]`
    **As a** System Admin, **I want** Execute migration step for index creation, **so that** Index physically exists in database storage.

    **Acceptance criteria:**
      - **AC-029** — Migration script runs without error.
        - _Measurable:_ pg_stat_progress_migration shows completion of ENT-VOTE-RESULT index operation

    _Status: atomic · Priority: medium · Tier: D · Traces to: ENT-VOTE-RESULT, US-010-C-004.4 · Pass: 3_

    _Decomposition rationale:_ Atomic leaf operation representing the actual deployment step, tracing to atomic write commitment US-010-C-004.4 for consistency.

    _Surfaced assumptions:_ A-0341, A-0342
##### US-010-C-004.4 `[Tier D · atomic]`

**As a** Leaf Operation, **I want** Atomic Write Vote Record with Binding, **so that** Single row inserted into ENT-VOTE-RESULT containing valid meeting_id.

**Acceptance criteria:**
  - **AC-027** — Vote record created with binding in single transaction.
    - _Measurable:_ Transaction completes successfully and row is visible in ENT-VOTE-RESULT immediately

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-VOTE-RESULT, WF-5, UJ-10 · Pass: 2_

_Decomposition rationale:_ This is the terminal atomic action (Tier D) that physically realizes the commitment. Its acceptance criteria are individually testable without further decomposition (e.g., checking row count and ID).

_Surfaced assumptions:_ A-0124, A-0125

#### US-010-C-005 `[Tier C · pending]`

**As a** Implementation commitment, **I want** Create immutable audit log entry for vote cast event, **so that** Every vote cast is recorded in an append-only audit trail.

**Acceptance criteria:**
  - **AC-024** — Audit log entry written to ENT-AUDIT-LOG-ENTRY.
    - _Measurable:_ ENT-AUDIT-LOG-ENTRY must be populated with 'action', 'user_id', 'timestamp' and hash of the event

_Status: pending · Priority: high · Tier: C · Traces to: UJ-10, ENT-AUDIT-LOG-ENTRY, WF-13 · Pass: 1_

_Decomposition rationale:_ Implementation of the immutability and compliance requirements. Supports the audit trail commitment.

_Surfaced assumptions:_ A-0027, A-0028, A-0029, A-0030, A-0031

##### US-010-C-005.1 `[Tier C · pending]`

**As a** Security Engineer, **I want** Compute cryptographic hash of finalized vote event payload, **so that** Event integrity is verified against stored hash before commit.

**Acceptance criteria:**
  - **AC-030** — Stored hash matches computed hash of payload
    - _Measurable:_ stored_hash == sha256(json_payload) for every row

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-10, ENT-AUDIT-LOG-ENTRY, WF-13 · Pass: 2_

_Decomposition rationale:_ Hash computation is the concrete technical implementation choice required to satisfy the 'immutable' goal. This binds the system to a specific algorithm (SHA-256) and timing (payload finalization).

_Surfaced assumptions:_ A-0126, A-0127, A-0128

  - **US-010-C-005.1.1** `[Tier D · atomic]`
    **As a** Commit-Worker, **I want** Calculate and persist SHA-256 hash of vote payload before commit, **so that** Vote record row contains a correct hash in the stored_hash column.

    **Acceptance criteria:**
      - **AC-030** — Stored hash matches computed hash of payload
        - _Measurable:_ stored_hash column value equals SHA-256(json_payload) for every row at commit time

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10, ENT-AUDIT-LOG-ENTRY, WF-13 · Pass: 3_

    _Decomposition rationale:_ This action is the atomic leaf operation for the parent requirement. The parent is atomic because the acceptance criteria describe a single verification point that cannot be further subdivided into distinct functional areas without losing the verification's meaning.
##### US-010-C-005.2 `[Tier B · pending]`

**As a** System Architect, **I want** Enforce append-only storage strategy for audit logs, **so that** No row updates or deletes permitted on audit log table.

**Acceptance criteria:**
  - **AC-031** — UPDATE/DELETE on audit log table are rejected
    - _Measurable:_ database constraint 'NOT FOR REPLICATION' or similar applied to ENT-AUDIT-LOG-ENTRY

_Status: pending · Priority: critical · Tier: B · Traces to: UJ-10, ENT-AUDIT-LOG-ENTRY, WF-13 · Pass: 2_

_Decomposition rationale:_ Immutability is an architectural commitment. This child defines the storage policy (Append-Only) required to achieve the parent's goal. It is a Tier B Architectural Choice.

_Surfaced assumptions:_ A-0126, A-0127, A-0128

##### US-010-C-005.3 `[Tier C · pending]`

**As a** Frontend/Backend Developer, **I want** Resolve user identity for audit record from active session, **so that** user_id field correctly reflects the board member who cast the vote.

**Acceptance criteria:**
  - **AC-032** — user_id matches ENT-USER record linked to session
    - _Measurable:_ user_id === session.authenticated_user.id at time of write

_Status: pending · Priority: high · Tier: C · Traces to: UJ-10, ENT-AUDIT-LOG-ENTRY, WF-13 · Pass: 2_

_Decomposition rationale:_ Identity resolution is an implementation choice required to populate the audit record. It is individually verifiable.

_Surfaced assumptions:_ A-0126, A-0127, A-0128

  - **US-010-C-005.3.1** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Retrieve authenticated user ID from active session context, **so that** System extracts the user identifier associated with the current authentication token before the vote is processed.

    **Acceptance criteria:**
      - **AC-033** — Retrieved user ID exists in ENT-USER table.
        - _Measurable:_ ENT-USER.id === session.authenticated_user.id

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-10, ENT-SESSION, ENT-USER · Pass: 3_

    _Decomposition rationale:_ Decomposing the resolution process into the atomic action of fetching the identity from the session state, which is a distinct verification step from mapping it to the payload.

    _Surfaced assumptions:_ A-0343, A-0344
  - **US-010-C-005.3.2** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Assign resolved user ID to audit log payload before persistence, **so that** The user_id field in the row being inserted into ENT-AUDIT-LOG-ENTRY contains the value resolved in step 3.1.

    **Acceptance criteria:**
      - **AC-034** — Audit row user_id matches fetched ID exactly.
        - _Measurable:_ audit_row.user_id === step_3_1.fetched_id

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10, ENT-AUDIT-LOG-ENTRY, US-010-C-005.5 · Pass: 3_

    _Decomposition rationale:_ Decomposing into the assignment/persistence step to isolate the mapping logic from the physical write action (covered by sibling US-010-C-005.5).

    _Surfaced assumptions:_ A-0343, A-0344
##### US-010-C-005.4 `[Tier C · pending]`

**As a** Backend Developer, **I want** Record system timestamp at commit time, **so that** timestamp reflects precise moment of immutable entry persistence.

**Acceptance criteria:**
  - **AC-033** — timestamp is accurate to sub-second precision
    - _Measurable:_ abs(timestamp - system_clock_at_commit) < 100ms

_Status: pending · Priority: medium · Tier: C · Traces to: UJ-10, ENT-AUDIT-LOG-ENTRY, WF-13 · Pass: 2_

_Decomposition rationale:_ Timestamp precision is an implementation decision affecting forensic utility. It is a concrete system behavior.

_Surfaced assumptions:_ A-0126, A-0127, A-0128

  - **US-010-C-005.4.1** `[Tier C · pending]`
    **As a** Backend Developer, **I want** Capture time from database server context, **so that** Timestamp reflects server-side wall clock at transaction boundary.

    **Acceptance criteria:**
      - **AC-033.1** — Timestamp populated using database connection server clock.
        - _Measurable:_ value retrieved from db_connection.server_clock() before commit

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-AUDIT-LOG-ENTRY, UJ-10 · Pass: 3_

    _Decomposition rationale:_ Ensures the source of truth is the system kernel at commit, preventing client-side clock skew which would violate the parent AC.

    _Surfaced assumptions:_ A-0345
  - **US-010-C-005.4.2** `[Tier C · pending]`
    **As a** Backend Developer, **I want** Provision column for sub-second storage, **so that** Database schema supports microsecond precision.

    **Acceptance criteria:**
      - **AC-033.2** — Column type supports sub-second resolution.
        - _Measurable:_ PostgreSQL column type is TIMESTAMPTZ with 64-bit precision

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-AUDIT-LOG-ENTRY, US-010-C-005.5 · Pass: 3_

    _Decomposition rationale:_ Schema definition must allow storing the precision required by the parent acceptance criteria; relies on Tech-7 (PostgreSQL).

    _Surfaced assumptions:_ A-0345
  - **US-010-C-005.4.3** `[Tier C · pending]`
    **As a** Backend Developer, **I want** Verify timestamp accuracy post-commit, **so that** Persisted value validates against system clock constraints.

    **Acceptance criteria:**
      - **AC-033.3** — Timestamp deviation does not exceed threshold.
        - _Measurable:_ abs(persisted_timestamp - system_clock) < 0.1s

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-13, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Verifies that the implementation commitment (source + storage) results in the required accuracy and detects drift during commit.

    _Surfaced assumptions:_ A-0345
##### US-010-C-005.5 `[Tier D · atomic]`

**As a** Database Writer, **I want** Insert row into ENT-AUDIT-LOG-ENTRY, **so that** Audit trail entry is physically present in the database.

**Acceptance criteria:**
  - **AC-034** — Audit row is found in table
    - _Measurable:_ SELECT COUNT(*) FROM ENT-AUDIT-LOG-ENTRY WHERE id = <generated_id> > 0

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10, ENT-AUDIT-LOG-ENTRY, WF-13 · Pass: 2_

_Decomposition rationale:_ This is the atomic leaf operation. All other children (Hashing, Storage Strategy, Identity, Time) support this specific database write action.

_Surfaced assumptions:_ A-0126, A-0127, A-0128

#### US-010-C-006 `[Tier C · pending]`

**As a** Implementation commitment, **I want** Reject unencrypted payloads at API gateway, **so that** Invalid requests are rejected immediately without processing.

**Acceptance criteria:**
  - **AC-025** — API returns 400 or 403 on non-TLS request.
    - _Measurable:_ Traefik or API Gateway rejects connection without valid TLS certificate chain

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-10, TECH-2, WF-5 · Pass: 1_

_Decomposition rationale:_ Concrete implementation of the encryption strategy. Enforces the TLS requirement at the ingress point.

_Surfaced assumptions:_ A-0027, A-0028, A-0029, A-0030, A-0031

##### US-010-C-006.1 `[Tier C · pending]`

**As a** CAM operator, **I want** Configure Traefik ingress listener to enforce TLS 1.2+ minimum version, **so that** Any connection attempt without valid TLS 1.2+ certificate chain is dropped.

**Acceptance criteria:**
  - **AC-001** — Traefik listener rejects handshake with TLS < 1.2.
    - _Measurable:_ tls.min_version === 'TLS12' or greater in Traefik configuration at ingress

_Status: pending · Priority: critical · Tier: C · Traces to: TECH-2, UJ-10 · Pass: 2_

_Decomposition rationale:_ Specific configuration choice required to satisfy the architectural commitment.

_Surfaced assumptions:_ A-0129, A-0130, A-0131

  - **US-010-C-006.1.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Set tls.min_version to TLS1.2 or TLS1.3 in Traefik ingress config, **so that** Traefik listener configuration records the minimum allowed protocol version.

    **Acceptance criteria:**
      - **AC-001.1** — Configuration file contains valid minVersion parameter
        - _Measurable:_ tls.min_version field in Traefik config equals 'TLS12' or 'TLS13'

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-2, UJ-10 · Pass: 3_

    _Decomposition rationale:_ Defines the primary configuration parameter that enforces the policy, directly implementing the requirement's core version constraint.

    _Surfaced assumptions:_ A-0346, A-0347
  - **US-010-C-006.1.2** `[Tier C · pending]`
    **As a** Security Analyst, **I want** Disable TLS 1.0 and TLS 1.1 protocol support in listener, **so that** Legacy protocol handshake attempts are rejected before backend processing.

    **Acceptance criteria:**
      - **AC-001.2** — No legacy protocol connections accepted
        - _Measurable:_ Connection logs show rejection events for protocols 'TLS1' or 'TLS1.1'

    _Status: pending · Priority: high · Tier: C · Traces to: TECH-2, UJ-10 · Pass: 3_

    _Decomposition rationale:_ Ensures that setting a minimum version is not sufficient if legacy protocols are explicitly disabled at the listener level.

    _Surfaced assumptions:_ A-0346, A-0347
  - **US-010-C-006.1.3** `[Tier C · pending]`
    **As a** Integration Engineer, **I want** Enforce cipher suite whitelist compatible with Bun runtime, **so that** Connections using weak or deprecated cipher suites are rejected.

    **Acceptance criteria:**
      - **AC-001.3** — All connections use approved cipher suites
        - _Measurable:_ tls.cipher_suites array in config contains only modern suites (e.g. TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384)

    _Status: pending · Priority: medium · Tier: C · Traces to: TECH-2, UJ-10 · Pass: 3_

    _Decomposition rationale:_ Version compliance is insufficient without strong encryption; this commits to the cryptographic strength required for secure communication.

    _Surfaced assumptions:_ A-0346, A-0347
##### US-010-C-006.2 `[Tier C · pending]`

**As a** CAM operator, **I want** Disable HTTP (port 80) listener on the ingress proxy, **so that** No traffic is accepted on unencrypted ports.

**Acceptance criteria:**
  - **AC-002** — HTTP GET requests to the ingress port return 403 or 400 immediately.
    - _Measurable:_ Traefik service definition lacks port 80 or explicitly returns 403 on listen

_Status: pending · Priority: critical · Tier: C · Traces to: TECH-2, WF-5 · Pass: 2_

_Decomposition rationale:_ Enforces strict rejection by removing the alternative entry point.

_Surfaced assumptions:_ A-0129, A-0130, A-0131

  - **US-010-C-006.2-1** `[Tier C · pending]`
    **As a** Infrastructure Strategist, **I want** Remove port 80 from Traefik service definition in Kubernetes/Docker Compose config, **so that** Traefik ingress container does not bind to port 80 on the host or container network.

    **Acceptance criteria:**
      - **AC-003** — Port 80 listener is absent from Traefik static configuration.
        - _Measurable:_ Traefik config file (providers/traefik.yml or Deployment YAML) contains no port: 80 entry in the exposed ports array

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-2, TECH-1 · Pass: 3_

    _Decomposition rationale:_ This is the primary implementation commitment required to enforce the policy of disabling HTTP listeners, directly utilizing the Traefik proxy technology constraint.

    _Surfaced assumptions:_ A-0348, A-0349
  - **US-010-C-006.2-2** `[Tier C · pending]`
    **As a** Security Engineer, **I want** Configure Traefik middleware to return 403/400 for any requests received on port 80, **so that** Any request arriving on port 80 is rejected with the specified status codes without backend invocation.

    **Acceptance criteria:**
      - **AC-004** — Requests on port 80 are intercepted by Traefik middleware.
        - _Measurable:_ Traefik `middlewares` section contains a route or catch-all that responds with 403/400 if port does not match 443

    _Status: pending · Priority: high · Tier: C · Traces to: TECH-2, TECH-1 · Pass: 3_

    _Decomposition rationale:_ This binds the security policy to the Traefik infrastructure's capability to handle traffic routing and rejection before the application layer.

    _Surfaced assumptions:_ A-0348, A-0349
  - **US-010-C-006.2-3** `[Tier D · atomic]`
    **As a** Compliance Operator, **I want** Validate that Traefik ingress pod listens only on port 443, **so that** System state verification confirms no HTTP listener is active.

    **Acceptance criteria:**
      - **AC-005** — Container network interface for the ingress proxy has no listening socket on 80.
        - _Measurable:_ `netstat` or `ss -tlnp` on the ingress pod shows no LISTEN state on port 80

    _Status: atomic · Priority: medium · Tier: D · Traces to: TECH-2, TECH-1 · Pass: 3_

    _Decomposition rationale:_ This is a leaf operation to verify that the configuration change was successfully applied and the policy is enforced at runtime.

    _Surfaced assumptions:_ A-0348, A-0349
##### US-010-C-006.3 `[Tier C · pending]`

**As a** CAM operator, **I want** Return standardized error response for security policy violations, **so that** Client receives 400 Bad Request or 403 Forbidden without leaking internal state.

**Acceptance criteria:**
  - **AC-003** — Response headers do not reveal stack traces or internal paths.
    - _Measurable:_ Error response content type is application/json with generic message

_Status: pending · Priority: critical · Tier: C · Traces to: TECH-2, UJ-10 · Pass: 2_

_Decomposition rationale:_ Ensures security policy enforcement does not introduce information disclosure risks.

_Surfaced assumptions:_ A-0129, A-0130, A-0131

  - **FR-SEC-ERR-1.1** `[Tier C · pending]`
    **As a** Backend Engineer, **I want** Sanitize Node.js error objects before serialization, **so that** Error payloads contain no stack traces, internal paths, or PII.

    **Acceptance criteria:**
      - **AC-003-C1** — Response body contains only defined keys (status, message, code).
        - _Measurable:_ JSON schema validation against { status: integer, message: string, code: string } with no additional properties at commit.

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-5, UJ-10 · Pass: 3_

    _Decomposition rationale:_ Node.js/Bun (TECH-5) default error objects often contain internal stack traces; this child commits to a specific sanitation step.

    _Surfaced assumptions:_ A-0350, A-0351
  - **FR-SEC-ERR-1.2** `[Tier C · pending]`
    **As a** Ingress Admin, **I want** Configure Traefik to strip diagnostic headers, **so that** No internal headers (X-Debug-Mode, Server-Version, etc.) leak to client.

    **Acceptance criteria:**
      - **AC-003-C2** — All response headers match the canonical whitelist.
        - _Measurable:_ setdiff(response.headers, canonical_whitelist) === [] for all 400/403 responses.

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-2 · Pass: 3_

    _Decomposition rationale:_ Traefik (TECH-2) is the ingress proxy (TECH-2); this child defines the gateway-level policy to ensure headers are safe even if backend leaks data.

    _Surfaced assumptions:_ A-0350, A-0351
  - **FR-SEC-ERR-1.3** `[Tier C · pending]`
    **As a** Security Architect, **I want** Map security violations to HTTP status codes, **so that** Malformed requests return 400, unauthorized access attempts return 403.

    **Acceptance criteria:**
      - **AC-003-C3** — Correct status code returned based on violation type.
        - _Measurable:_ status_code === 400 if input_validation_failed OR status_code === 403 if auth_policy_violated.

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-10, WF-12 · Pass: 3_

    _Decomposition rationale:_ Distinguishes between client error (400) and server security restriction (403) to aid client diagnostics without revealing state.

    _Surfaced assumptions:_ A-0350, A-0351
##### US-010-C-006.4 `[Tier C · pending]`

**As a** CAM operator, **I want** Log rejected connection events to audit trail, **so that** Every rejected connection is recorded for security monitoring.

**Acceptance criteria:**
  - **AC-004** — Security rejection log entry is persisted with timestamp and IP.
    - _Measurable:_ ENT-AUDIT-LOG-ENTRY is written for every rejected TLS handshake

_Status: pending · Priority: high · Tier: C · Traces to: TECH-2, UJ-10, WF-5 · Pass: 2_

_Decomposition rationale:_ Compliance with audit obligations for rejected connection attempts.

_Surfaced assumptions:_ A-0129, A-0130, A-0131

  - **FR-ACCT-4.1** `[Tier D · atomic]`
    **As a** System Operator, **I want** Extract Source IP from Request Header, **so that** Log entry contains client IP address.

    **Acceptance criteria:**
      - **AC-004.1** — Source IP field is populated in every log entry.
        - _Measurable:_ ENT-AUDIT-LOG-ENTRY.source_ip is non-empty string for every row inserted after rejection

    _Status: atomic · Priority: high · Tier: D · Traces to: TECH-2 · Pass: 3_

    _Decomposition rationale:_ Defining the metadata capture required for the audit entry before persistence; atomic enough to test header extraction logic.

    _Surfaced assumptions:_ A-0352, A-0353
  - **FR-ACCT-4.2** `[Tier D · atomic]`
    **As a** System Operator, **I want** Capture Timestamp at Failure Event, **so that** Log entry contains precise failure time.

    **Acceptance criteria:**
      - **AC-004.2** — Timestamp reflects system time at rejection.
        - _Measurable:_ ENT-AUDIT-LOG-ENTRY.created_at === current_server_time_at_insert

    _Status: atomic · Priority: high · Tier: D · Traces to: TECH-2 · Pass: 3_

    _Decomposition rationale:_ Timestamp capture is a separate atomic operation from the write action; ensures accurate chronology for security analysis.

    _Surfaced assumptions:_ A-0352, A-0353
  - **FR-ACCT-4.3** `[Tier D · atomic]`
    **As a** System Operator, **I want** Persist Rejection Record to Audit Store, **so that** Log entry is stored and retrievable.

    **Acceptance criteria:**
      - **AC-004.3** — Failure record exists in audit table after event.
        - _Measurable:_ SELECT COUNT(*) FROM ENT-AUDIT-LOG-ENTRY WHERE event_type = 'REJECTION' AND created_at < now() > 0

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-AUDIT-LOG-ENTRY, WF-5 · Pass: 3_

    _Decomposition rationale:_ The core atomic action of the requirement: actually writing the record to the persistent store.

    _Surfaced assumptions:_ A-0352, A-0353
  - **FR-ACCT-4.4** `[Tier B · pending]`
    **As a** Architect, **I want** Enforce Append-Only Log Constraint, **so that** Log entries cannot be modified or deleted.

    **Acceptance criteria:**
      - **AC-004.4** — No update or delete operations permitted on audit entries.
        - _Measurable:_ Attempted UPDATE on ENT-AUDIT-LOG-ENTRY returns error 400 Forbidden

    _Status: pending · Priority: critical · Tier: B · Traces to: TECH-7, COMP-17 · Pass: 3_

    _Decomposition rationale:_ Architectural policy decision (Scope Commitment) that defines the integrity guarantees of the audit trail, distinct from the implementation mechanics of writing.

    _Surfaced assumptions:_ A-0352, A-0353
#### US-010-C-002 `[downgraded]`

**As a** Engineering sub-strategy, **I want** Persist cryptographic hash of vote record on write, **so that** Vote record integrity is verified via stored hash after submission.

**Acceptance criteria:**
  - **AC-021** — Vote record hash is read-only and validated on access.
    - _Measurable:_ ENT-VOTE-RESULT table must contain a 'hash' column; read operations verify the row hash against the stored value

_Status: downgraded · Priority: critical · Traces to: UJ-10, ENT-VOTE-RESULT, COMP-4 · Pass: 2_

##### US-010-C-002-1 `[Tier C · pending]`

**As a** Data Integrity Commitment, **I want** Compute hash and persist within the same database transaction as vote submission, **so that** Vote record exists only if its hash is stored and balanced.

**Acceptance criteria:**
  - **AC-021-1** — Write transaction fails if hash computation is incomplete
    - _Measurable:_ COMMIT on ENT-VOTE-RESULT only succeeds if hash column is populated before transaction ends

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-10, ENT-VOTE-RESULT · Pass: 2_

_Decomposition rationale:_ Binds the 'persist on write' commitment to a specific ACID transactional boundary, ensuring atomicity between data and hash.

_Surfaced assumptions:_ A-0218, A-0219, A-0220

  - **US-010-C-002-1.1** `[Tier C · pending]`
    **As a** Implementation Commitment, **I want** Select deterministic hash algorithm for vote payload, **so that** Vote integrity verification relies on a fixed, predictable hash value.

    **Acceptance criteria:**
      - **AC-021-1.1** — Hash computation returns a 64-character hex string.
        - _Measurable:_ hash_algorithm === 'SHA-256' and len(hash) == 64

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-VOTE-RESULT, COMP-4 · Pass: 3_

    _Decomposition rationale:_ Selecting the specific algorithm is an implementation decision under the architectural commitment. This binds the cryptographic standard before moving to storage logic.

    _Surfaced assumptions:_ A-0527, A-0528, A-0529
  - **US-010-C-002-1.2** `[Tier C · pending]`
    **As a** Architectural Choice, **I want** Bind hash calculation and row insert to single DB transaction, **so that** Vote record cannot persist without its hash, preventing orphaned records.

    **Acceptance criteria:**
      - **AC-021-1.2** — Commit succeeds only if both hash column and vote data are written in one unit of work.
        - _Measurable:_ transaction.commit_state === 'committed' AND row_exists AND hash_column_populated

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-VOTE-RESULT, ENT-COMMUNITY · Pass: 3_

    _Decomposition rationale:_ This child codifies the 'same database transaction' constraint from the parent description into a specific architectural strategy. It defines the boundary of atomicity for this operation.

    _Surfaced assumptions:_ A-0527, A-0528, A-0529
  - **US-010-C-002-1.3** `[Tier C · pending]`
    **As a** Implementation Commitment, **I want** Enforce immutable hash column via schema constraint, **so that** Hash value cannot be altered once written to prevent backdating.

    **Acceptance criteria:**
      - **AC-021-1.3** — Direct updates to the hash column are rejected by the database.
        - _Measurable:_ UPDATE hash_column SET value = ... FAILED OR CONSTRAINT_VIOLATED

    _Status: pending · Priority: high · Tier: C · Traces to: US-010-C-002-3, ENT-VOTE-RESULT · Pass: 3_

    _Decomposition rationale:_ This child defines how the storage commitment (read-only hash) is enforced. It overlaps slightly with sibling US-010-C-002-3 regarding schema but focuses on the write-protection constraint.

    _Surfaced assumptions:_ A-0527, A-0528, A-0529
  - **US-010-C-002-1.4** `[Tier D · atomic]`
    **As a** Leaf Operation, **I want** Rollback transaction on hash computation failure, **so that** No vote record is visible if hash cannot be computed or stored.

    **Acceptance criteria:**
      - **AC-021-1.4** — If hash computation throws or storage fails, transaction state reverts to pre-submit.
        - _Measurable:_ IF (hash_error OR db_error) THEN TRANSACTION.ROLLBACK()

    _Status: atomic · Priority: critical · Tier: D · Traces to: AC-021-1, ENT-VOTE-RESULT · Pass: 3_

    _Decomposition rationale:_ This is the atomic action verifying the 'Write transaction fails' AC. It represents the terminal behavior required to ensure the vote record does not exist without its hash.

    _Surfaced assumptions:_ A-0527, A-0528, A-0529
##### US-010-C-002-2 `[Tier C · pending]`

**As a** Read Verification Logic, **I want** Compute hash of current row data and compare against stored hash value on every read access, **so that** Any deviation indicates data integrity failure or tampering.

**Acceptance criteria:**
  - **AC-021-2** — Read operation throws integrity error if hashes mismatch
    - _Measurable:_ HASH(CURRENT_DATA) === STORED_HASH for all GET requests to ENT-VOTE-RESULT

_Status: pending · Priority: high · Tier: C · Traces to: UJ-10, COMP-4 · Pass: 2_

_Decomposition rationale:_ Defines the specific verification behavior required by the parent's 'verified via stored hash' goal.

_Surfaced assumptions:_ A-0218, A-0219, A-0220

  - **US-010-C-002-2-1** `[Tier D · atomic]`
    **As a** Read-Verification Logic, **I want** Compute SHA-256 hash of retrieved row data payload, **so that** Hexadecimal string generated representing current row state.

    **Acceptance criteria:**
      - **AC-021-2-1** — Hash computed successfully for every GET request
        - _Measurable:_ computed_hash.length === 64 for every read request to ENT-VOTE-RESULT

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-10, A-0028 · Pass: 3_

    _Decomposition rationale:_ Hash computation is the atomic operation that must occur to verify integrity; must happen synchronously before response generation.

    _Surfaced assumptions:_ A-0530, A-0531, A-0532
  - **US-010-C-002-2-2** `[Tier C · pending]`
    **As a** Comparison Engine, **I want** Compare computed hash against stored hash column value, **so that** Boolean result indicating match or mismatch status.

    **Acceptance criteria:**
      - **AC-021-2-2** — Comparison logic returns true only when values are identical
        - _Measurable:_ computed_hash === stored_hash implies match_result === true

    _Status: pending · Priority: critical · Tier: C · Traces to: US-010-C-002-3, COMP-4 · Pass: 3_

    _Decomposition rationale:_ This commitment links the verification logic to the architectural choice of a dedicated read-only column (Sibling 3) and the voting compliance rules (COMP-4).

    _Surfaced assumptions:_ A-0530, A-0531, A-0532
  - **US-010-C-002-2-3** `[Tier C · pending]`
    **As a** Failure Handler, **I want** Enforce integrity error response upon mismatch detection, **so that** HTTP error response returned to client immediately.

    **Acceptance criteria:**
      - **AC-021-2-3** — Read request fails with integrity error when hashes mismatch
        - _Measurable:_ http_status_code === 403 or 500 when match_result === false

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-10, COMP-4 · Pass: 3_

    _Decomposition rationale:_ Defines the boundary behavior for the system when the integrity check fails, ensuring no corrupted data is served to a user.

    _Surfaced assumptions:_ A-0530, A-0531, A-0532
  - **US-010-C-002-2-4** `[Tier D · atomic]`
    **As a** Audit Logger, **I want** Record hash verification event to immutable audit log, **so that** Audit log entry created with verification timestamp and status.

    **Acceptance criteria:**
      - **AC-021-2-4** — Every verification attempt is recorded in audit trail
        - _Measurable:_ audit_log_entries.count >= verification_requests.count per hour

    _Status: atomic · Priority: medium · Tier: D · Traces to: WF-13 · Pass: 3_

    _Decomposition rationale:_ Ensures transparency and accountability for integrity checks, supporting compliance and forensic analysis requirements.

    _Surfaced assumptions:_ A-0530, A-0531, A-0532
##### US-010-C-002-3 `[Tier B · pending]`

**As a** Architectural Schema Choice, **I want** Add dedicated read-only column to ENT-VOTE-RESULT table for hash storage, **so that** Data model supports hash verification natively.

**Acceptance criteria:**
  - **AC-021-3** — Table schema includes hash column with appropriate data type
    - _Measurable:_ ENT-VOTE-RESULT table metadata contains 'hash' column

_Status: pending · Priority: high · Tier: B · Traces to: ENT-VOTE-RESULT, TECH-7 · Pass: 2_

_Decomposition rationale:_ Commits to the structural architectural choice (schema change) required to store the integrity proof.

_Surfaced assumptions:_ A-0218, A-0219, A-0220

##### US-010-C-002-4 `[Tier B · pending]`

**As a** Immutability Constraint, **I want** Enforce that the hash column cannot be updated directly via application or admin interfaces, **so that** Hash value is protected from accidental or malicious modification.

**Acceptance criteria:**
  - **AC-021-4** — Direct UPDATE of hash column is rejected by database or application layer
    - _Measurable:_ All attempts to update hash column return error code 1644 or similar 'immutable' error

_Status: pending · Priority: critical · Tier: B · Traces to: COMP-4, US-010-C-005 · Pass: 2_

_Decomposition rationale:_ Establishes the governing rule that hash must be read-only to ensure the integrity proof is trusted.

_Surfaced assumptions:_ A-0218, A-0219, A-0220

#### US-010-C-003 `[downgraded]`

**As a** Governing rule / standard, **I want** Enforce Board Member role before vote submission allowed, **so that** Only authorized board members can cast votes during the meeting window.

**Acceptance criteria:**
  - **AC-022** — Vote submission API rejects request if user role is not Board Member.
    - _Measurable:_ ENT-SESSION check against ENT-BOARD-MEMBER list must pass before vote payload is processed

_Status: downgraded · Priority: critical · Traces to: UJ-10, ENT-BOARD-MEMBER, ENT-ROLE, ENT-SESSION · Pass: 2_

##### US-010-C-003-1 `[Tier C · pending]`

**As a** Auth Service, **I want** Resolve membership claim from session context, **so that** Request proceeds if valid board membership claim exists in session.

**Acceptance criteria:**
  - **AC-001** — Session claims include explicit board membership flag
    - _Measurable:_ session.user_is_board_member === true for authorized users

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-SESSION, ENT-BOARD-MEMBER · Pass: 2_

_Decomposition rationale:_ The authorization engine must rely on an explicit claim in the session object rather than re-resolving role from the user store on every request to ensure performance and state consistency.

_Surfaced assumptions:_ A-0221, A-0222, A-0223

  - **US-010-C-003-1.1** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Validate session record existence and freshness, **so that** Proceed to flag extraction only if session is active.

    **Acceptance criteria:**
      - **AC-001** — Session record exists and is not expired.
        - _Measurable:_ ENT-SESSION.valid_until >= current_timestamp at request time

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-SESSION · Pass: 3_

    _Decomposition rationale:_ First atomic step in the resolution sequence; prevents processing of stale sessions before checking membership.

    _Surfaced assumptions:_ A-0533, A-0534
  - **US-010-C-003-1.2** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Extract board membership flag from payload, **so that** Retrieve boolean flag value for decision logic.

    **Acceptance criteria:**
      - **AC-002** — Flag is present and matches user role context.
        - _Measurable:_ session.user_is_board_member exists and equals true or false

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-SESSION, ENT-BOARD-MEMBER · Pass: 3_

    _Decomposition rationale:_ Second step specifically extracting the required attribute from the session context to satisfy the parent AC.

    _Surfaced assumptions:_ A-0533, A-0534
  - **US-010-C-003-1.3** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Set request authorization result, **so that** Return 200 OK or 403 Forbidden based on flag value.

    **Acceptance criteria:**
      - **AC-003** — HTTP status code matches membership status.
        - _Measurable:_ status_code === 200 when flag is true OR status_code === 403 when flag is false/null

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-VOTE, US-010-C-003-3 · Pass: 3_

    _Decomposition rationale:_ Final leaf operation that triggers the next workflow step or error handler, linking to sibling rejection policy.

    _Surfaced assumptions:_ A-0533, A-0534
##### US-010-C-003-2 `[Tier B · pending]`

**As a** API Gateway, **I want** Enforce rule boundary on vote endpoint, **so that** Policy applies exclusively to vote submission traffic.

**Acceptance criteria:**
  - **AC-002** — Rule applies only to defined vote endpoints
    - _Measurable:_ enforcement logic active on POST /api/vote/submit only

_Status: pending · Priority: critical · Tier: B · Traces to: US-010-C-004, WF-5 · Pass: 2_

_Decomposition rationale:_ This child defines the specific scope boundary (B) for the rule, distinguishing it from other platform rules that might apply to different endpoints.

_Surfaced assumptions:_ A-0221, A-0222, A-0223

##### US-010-C-003-3 `[Tier C · pending]`

**As a** API Gateway, **I want** Reject invalid requests with HTTP 403, **so that** Client receives Forbidden response immediately.

**Acceptance criteria:**
  - **AC-003** — HTTP 403 Forbidden response is returned for unauthz requests
    - _Measurable:_ response.status_code === 403 for all failed role checks

_Status: pending · Priority: critical · Tier: C · Traces to: US-010-C-006, ENT-SESSION · Pass: 2_

_Decomposition rationale:_ Aligns with sibling US-010-C-006's rejection logic but specific to authorization failures rather than transport errors.

_Surfaced assumptions:_ A-0221, A-0222, A-0223

  - **US-010-C-003-3.1** `[Tier C · pending]`
    **As a** Policy Enforcer, **I want** Invoke Cerbos policy engine to evaluate session and role claims, **so that** Receive authorization decision (ALLOW or DENY) from Cerbos.

    **Acceptance criteria:**
      - **AC-101** — System returns DENY if Cerbos decision is DENY
        - _Measurable:_ cerbos_decision.status === 'DENY' implies response.status_code === 403

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-9, ENT-SESSION, US-010-C-003-4 · Pass: 3_

    _Decomposition rationale:_ Separates the authorization decision logic from response formatting; delegates policy logic to the dedicated authorization engine defined in handoff.

    _Surfaced assumptions:_ A-0535, A-0536, A-0537
  - **US-010-C-003-3.2** `[Tier C · pending]`
    **As a** Response Builder, **I want** Construct HTTP 403 Forbidden response object, **so that** Generate response body and headers compliant with security standards.

    **Acceptance criteria:**
      - **AC-102** — Response contains standard Forbidden headers
        - _Measurable:_ response.headers['WWW-Authenticate'] is present AND response.headers['Cache-Control'] === 'no-store'

    _Status: pending · Priority: high · Tier: C · Traces to: TECH-2, US-010-C-003-4 · Pass: 3_

    _Decomposition rationale:_ Defines the specific content and headers of the error response to prevent information leakage and caching attacks.

    _Surfaced assumptions:_ A-0535, A-0536, A-0537
  - **US-010-C-003-3.3** `[Tier C · pending]`
    **As a** Response Dispatcher, **I want** Send 403 response immediately to client, **so that** Client receives immediate Forbidden status.

    **Acceptance criteria:**
      - **AC-103** — Response is sent synchronously after decision
        - _Measurable:_ response.time_since_decision <= 10ms AND response.status_code === 403

    _Status: pending · Priority: high · Tier: C · Traces to: TECH-2, US-010-C-003-4 · Pass: 3_

    _Decomposition rationale:_ Ensures the 403 is returned as soon as the decision is known, preventing latency caused by downstream errors or retries.

    _Surfaced assumptions:_ A-0535, A-0536, A-0537
##### US-010-C-003-4 `[Tier C · pending]`

**As a** Audit Log System, **I want** Record denied access attempts, **so that** Audit trail contains immutable record of failed vote attempts.

**Acceptance criteria:**
  - **AC-004** — Denial event is logged to audit trail
    - _Measurable:_ ENT-AUDIT-LOG-ENTRY created for every failed vote submission

_Status: pending · Priority: high · Tier: C · Traces to: US-010-C-005, TECH-12 · Pass: 2_

_Decomposition rationale:_ Ensures compliance with audit requirements for security incidents, mirroring the immutable log strategy of sibling US-010-C-005.

_Surfaced assumptions:_ A-0221, A-0222, A-0223

  - **US-010-C-003-4a** `[Tier C · pending]`
    **As a** CAM operator, **I want** Capture denial event payload including user and session identifiers, **so that** Audit entry contains User ID, IP, Timestamp, and Session ID.

    **Acceptance criteria:**
      - **AC-004a** — Event payload includes mandatory context fields.
        - _Measurable:_ payload === { user_id, ip, timestamp, session_id }

    _Status: pending · Priority: high · Tier: C · Traces to: US-010-C-003-4, ENT-VOTE · Pass: 3_

    _Decomposition rationale:_ Distinguishes the data capture step from the persistence step; requires explicit definition of fields to ensure compliance with audit standards.

    _Surfaced assumptions:_ A-0538, A-0539
  - **US-010-C-003-4b** `[Tier D · atomic]`
    **As a** Audit engineer, **I want** Persist entry to immutable audit store, **so that** Entry written to ENT-AUDIT-LOG-ENTRY with append-only guarantee.

    **Acceptance criteria:**
      - **AC-004b** — Entry is persisted and immediately readable by audit reader.
        - _Measurable:_ select * from audit_log_entries where id = new_entry_id is not null

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-010-C-003-4, ENT-AUDIT-LOG-ENTRY, TECH-7 · Pass: 3_

    _Decomposition rationale:_ Atomic operation of writing the record; relies on the append-only constraint to ensure immutability.

    _Surfaced assumptions:_ A-0538, A-0539
### FR US-011 `[pending]`

**As a** Hestami Staff, **I want** Monitor platform data integrity across tenants, **so that** Staff ensures strict multi-tenant isolation is enforced.

**Acceptance criteria:**
  - **AC-020** — Isolation rules enforced
    - _Measurable:_ Access request returns 403 if source and target differ by ENT-TENANT ID
  - **AC-021** — Alert response time
    - _Measurable:_ Alert triggered within 60 minutes of isolation rule violation detection

_Status: pending · Priority: critical · Traces to: UJ-11, ENT-TENANT, WF-12, COMP-17, COMP-5 · Pass: 0_

#### US-011-C01 `[Tier C · pending]`

**As a** System Architect, **I want** Enforce tenant isolation via PostgreSQL Row-Level Security (RLS), **so that** No cross-tenant data access is permitted by the database engine.

**Acceptance criteria:**
  - **AC-1** — RLS policies reject queries accessing foreign tenant data.
    - _Measurable:_ DENY permission returned when query origin_session.tenant_id != target_row.tenant_id

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-11, ENT-TENANT, WF-12, TECH-7, TECH-9 · Pass: 1_

_Decomposition rationale:_ RLS is the primary technical commitment to enforce AC-020. It moves isolation from application logic to storage enforcement, satisfying the need for strict multi-tenant isolation.

_Surfaced assumptions:_ A-0032, A-0033

##### US-011-C01.1 `[Tier C · pending]`

**As a** DBA/DevOps, **I want** Maintain RLS policy definitions for all tenant-scoped tables, **so that** Valid RLS policies exist in the database schema to block cross-tenant access.

**Acceptance criteria:**
  - **AC-001** — RLS policy SQL text is present in the database for each table.
    - _Measurable:_ SELECT COUNT(*) FROM row_level_security_policies WHERE target_table IN (SELECT table_name FROM information_schema.tables) GROUP BY target_table HAVING COUNT(*) > 0

_Status: pending · Priority: critical · Tier: C · Traces to: TECH-7, ENT-TENANT · Pass: 2_

_Decomposition rationale:_ Binding specific database policies to tables is the concrete implementation of the RLS architectural commitment; without policies, the choice is void.

_Surfaced assumptions:_ A-0132, A-0133, A-0134

  - **US-011-C01.1.1** `[Tier D · atomic]`
    **As a** Schema Inspector, **I want** Query information_schema to identify tables lacking active RLS policies, **so that** List of tenant-scoped tables without RLS protection is returned.

    **Acceptance criteria:**
      - **AC-001** — Scan results include every table without a defined policy.
        - _Measurable:_ COUNT(*) FROM information_schema.tables WHERE tenant_id IS NOT NULL AND table_name NOT IN (SELECT target_table FROM row_level_security_policies) > 0

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-TENANT, ENT-DATABASE · Pass: 3_

    _Decomposition rationale:_ This is the atomic detection step required before any policy maintenance can occur. It defines the work items (tables) that require action.

    _Surfaced assumptions:_ A-0354, A-0355
  - **US-011-C01.1.2** `[Tier C · pending]`
    **As a** Policy Architect, **I want** Construct RLS policy SQL statements using standard Postgres syntax, **so that** Valid `CREATE POLICY` or `ALTER POLICY` SQL text is generated for the missing table.

    **Acceptance criteria:**
      - **AC-002** — Generated SQL passes syntax validation before storage.
        - _Measurable:_ pg_syntax_error_count for generated SQL statement === 0

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-7, A-0132 · Pass: 3_

    _Decomposition rationale:_ This is an implementation commitment on *how* the policy text is derived. It commits to specific syntax rules and source data (tenant_id) used in the policy definition.

    _Surfaced assumptions:_ A-0354, A-0355
  - **US-011-C01.1.3** `[Tier C · pending]`
    **As a** Definition Manager, **I want** Persist generated policy SQL in a migration registry for tracking, **so that** Policy SQL text is versioned and queued for application.

    **Acceptance criteria:**
      - **AC-003** — Policy SQL exists in registry with generated timestamp and version.
        - _Measurable:_ SELECT COUNT(*) FROM policy_migration_registry WHERE sql IS NOT NULL AND status = 'pending'

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-TENANT, TECH-11 · Pass: 3_

    _Decomposition rationale:_ This commits to a storage strategy for policy definitions. It separates the definition generation from the physical schema application, allowing auditability.

    _Surfaced assumptions:_ A-0354, A-0355
  - **US-011-C01.1.4** `[Tier D · atomic]`
    **As a** Schema Updater, **I want** Execute pending policy SQL statements in the database, **so that** RLS policy becomes active and visible in the database schema.

    **Acceptance criteria:**
      - **AC-004** — Policy is active and prevents unauthorized cross-tenant rows.
        - _Measurable:_ SELECT COUNT(*) FROM pg_policies WHERE tablename = 'target_table' > 0

    _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-7, US-011-C01.1.1 · Pass: 3_

    _Decomposition rationale:_ This is the leaf operation that physically changes the schema to achieve the parent's goal. It is atomic enough to be tested per row.

    _Surfaced assumptions:_ A-0354, A-0355
##### US-011-C01.2 `[Tier C · pending]`

**As a** Backend Engineer, **I want** Propagate Tenant ID in query context for every session, **so that** Every query execution context contains a resolved tenant_id value.

**Acceptance criteria:**
  - **AC-002** — Query context resolves a non-null tenant identifier.
    - _Measurable:_ session.tenant_id IS NOT NULL AND session.tenant_id = query.origin_session.tenant_id

_Status: pending · Priority: high · Tier: C · Traces to: ENT-SESSION, UJ-11 · Pass: 2_

_Decomposition rationale:_ RLS relies on the connection/session providing the target context; binding this is the upstream requirement for the RLS mechanism to function.

_Surfaced assumptions:_ A-0132, A-0133, A-0134

  - **US-011-C01.2.1** `[Tier C · pending]`
    **As a** Auth Middleware, **I want** Extract tenant_id from authenticated token payload, **so that** Session context object contains valid tenant identifier derived from auth token.

    **Acceptance criteria:**
      - **AC-002-1** — Decoded token payload includes 'tenant_id' claim.
        - _Measurable:_ JSON.parse(token_payload).tenant_id !== undefined

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-SESSION, TECH-10, UJ-11 · Pass: 3_

    _Decomposition rationale:_ This child defines the extraction step of the propagation mechanism. The auth engine must surface the tenant claim before the session layer can bind it to the DB connection.

    _Surfaced assumptions:_ A-0356, A-0357, A-0358
  - **US-011-C01.2.2** `[Tier C · pending]`
    **As a** Connection Manager, **I want** Bind tenant_id to active DB connection pool entry, **so that** Every connection in the pool carries the tenant_id context value.

    **Acceptance criteria:**
      - **AC-002-2** — Connection metadata includes resolved tenant_id.
        - _Measurable:_ connection.tenant_id === session.tenant_id

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-SESSION, ENT-TENANT, TECH-7, UJ-11 · Pass: 3_

    _Decomposition rationale:_ This child defines the binding step. The connection pool layer must accept and store the tenant context before executing any SQL statement to ensure RLS enforcement works at the database level.

    _Surfaced assumptions:_ A-0356, A-0357, A-0358
  - **US-011-C01.2.3** `[Tier D · atomic]`
    **As a** Query Validator, **I want** Reject query execution if tenant_id is missing or null, **so that** System prevents unauthorized or unscoped data access by blocking queries without valid context.

    **Acceptance criteria:**
      - **AC-002-3** — Query planner throws error on null context.
        - _Measurable:_ return false if session.tenant_id === null || session.tenant_id !== query.origin_session.tenant_id

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-11, ENT-AUDIT-LOG-ENTRY, TECH-12 · Pass: 3_

    _Decomposition rationale:_ This child defines the guardrail logic. Verification ensures that propagation failures or context loss do not bypass security boundaries during concurrent load.

    _Surfaced assumptions:_ A-0356, A-0357, A-0358
##### US-011-C01.3 `[Tier C · pending]`

**As a** Security Analyst, **I want** Validate RLS isolation holds under concurrent load, **so that** No cross-tenant data is visible to any query despite high concurrency.

**Acceptance criteria:**
  - **AC-003** — No rows from other tenants are returned in any query result set.
    - _Measurable:_ cross_tenant_rows_count === 0 AND query_latency < 50ms

_Status: pending · Priority: high · Tier: C · Traces to: TECH-12, WF-12 · Pass: 2_

_Decomposition rationale:_ Performance and correctness must be verified together; the system must not degrade isolation under load, which is a non-functional verification constraint.

_Surfaced assumptions:_ A-0132, A-0133, A-0134

  - **FR-US-011-C01.3.1** `[Tier C · pending]`
    **As a** Observability instrumentation, **I want** Inject cross-tenant row counter into query result payloads, **so that** Query result sets include a verified cross_tenant_row_count field.

    **Acceptance criteria:**
      - **AC-004** — Cross-tenant row count is accurately captured per query.
        - _Measurable:_ count(cross_tenant_rows) === 0 for every query result set in the test suite

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-12, TECH-12, TECH-7 · Pass: 3_

    _Decomposition rationale:_ The requirement to validate isolation requires a concrete commitment to instrumentation. Without injecting a counter or flag, the system cannot verify row-level leakage. This child binds the validation logic to the query processing path.

    _Surfaced assumptions:_ A-0359, A-0360
  - **FR-US-011-C01.3.2** `[Tier C · pending]`
    **As a** Latency SLA enforcement, **I want** Track and enforce query execution latency thresholds under load, **so that** All validated queries complete within 50ms regardless of isolation checks.

    **Acceptance criteria:**
      - **AC-005** — Query latency meets isolation SLA.
        - _Measurable:_ query_latency < 50ms for every validated query execution

    _Status: pending · Priority: high · Tier: C · Traces to: WF-12, TECH-12, TECH-7 · Pass: 3_

    _Decomposition rationale:_ The AC explicitly includes query_latency < 50ms. This child commits to the specific threshold constraint and the instrumentation needed to verify it without impacting isolation checks.

    _Surfaced assumptions:_ A-0359, A-0360
  - **FR-US-011-C01.3.3** `[Tier D · atomic]`
    **As a** Alert emission action, **I want** Send security alert upon isolation breach detection, **so that** Security team receives alert when cross_tenant_row_count > 0.

    **Acceptance criteria:**
      - **AC-006** — Alert is emitted within 1 minute of breach.
        - _Measurable:_ alert_sent_time - breach_detected_time <= 60s

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-12, TECH-12, UJ-11 · Pass: 3_

    _Decomposition rationale:_ This child is the terminal action of the validation loop. It is atomic and testable (Did the alert go out?). It is Tier D because it represents an atomic observable event in the system state.

    _Surfaced assumptions:_ A-0359, A-0360
  - **FR-US-011-C01.3.4** `[Tier D · atomic]`
    **As a** Load test execution, **I want** Run concurrent tenant load simulation job, **so that** Validated load test report generated with pass/fail metrics.

    **Acceptance criteria:**
      - **AC-007** — Load test completes with metrics.
        - _Measurable:_ load_test_job_status === 'completed' AND metrics_report_generated

    _Status: atomic · Priority: high · Tier: D · Traces to: WF-12, TECH-12, TECH-1 · Pass: 3_

    _Decomposition rationale:_ Validation requires actual concurrent execution. This child commits to the atomic action of running the test workload. It is Tier D because it is a specific executable workflow step.

    _Surfaced assumptions:_ A-0359, A-0360
#### US-011-C02 `[Tier C · pending]`

**As a** DevOps Engineer, **I want** Configure anomaly detection pipeline for isolation violations, **so that** System generates alerts for violations detected in real-time or near real-time.

**Acceptance criteria:**
  - **AC-2** — Violation alert sent within 60 minutes of detection.
    - _Measurable:_ alert_event.timestamp - violation_detected_timestamp <= 3600 seconds

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-11, WF-12, COMP-5, TECH-12 · Pass: 1_

_Decomposition rationale:_ AC-021 requires a specific monitoring commitment. This child defines the observability stack configuration to meet the response time constraint.

_Surfaced assumptions:_ A-0032, A-0033

##### US-011-C02.1 `[Tier C · pending]`

**As a** CAM operator, **I want** Ingest isolation violation events into the anomaly pipeline, **so that** Isolation violation events are captured for analysis within the pipeline.

**Acceptance criteria:**
  - **AC-C02-1** — Events are captured before the detection window closes
    - _Measurable:_ event_received_timestamp <= violation_detected_timestamp + 1s

_Status: pending · Priority: critical · Tier: C · Traces to: WF-12, US-011-C01 · Pass: 2_

_Decomposition rationale:_ Data ingestion is the necessary precursor to detection. Must be traced to WF-12 (Isolation Enforcement) and C01 (RLS policies) to ensure the events are valid isolation checks before scoring.

_Surfaced assumptions:_ A-0135, A-0136, A-0137

  - **US-011-C02.1.1** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Validate incoming event payload schema, **so that** Event structure matches violation schema definition.

    **Acceptance criteria:**
      - **AC-02.1.1** — Payload validates against defined event schema.
        - _Measurable:_ JSON schema validation returns true for all fields in payload

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-011-C02.1, WF-12 · Pass: 3_

    _Decomposition rationale:_ Schema validation is the first atomic step in ingestion to ensure structural integrity before processing.

    _Surfaced assumptions:_ A-0361, A-0362
  - **US-011-C02.1.2** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Enforce detection window timestamp constraint, **so that** Event accepted only if within detection window.

    **Acceptance criteria:**
      - **AC-02.1.2** — Event captured before detection window closes.
        - _Measurable:_ stored_timestamp <= violation_detected_timestamp + 1s for every accepted row

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-011-C02.1, WF-12 · Pass: 3_

    _Decomposition rationale:_ Enforcing the specific timing AC is a leaf operation to ensure data freshness.

    _Surfaced assumptions:_ A-0361, A-0362
  - **US-011-C02.1.3** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Persist validated event to anomaly store, **so that** Event record written to pipeline storage.

    **Acceptance criteria:**
      - **AC-02.1.3** — Event record successfully persisted to database.
        - _Measurable:_ INSERT operation returns success for valid event rows

    _Status: atomic · Priority: high · Tier: D · Traces to: US-011-C02.1, WF-12 · Pass: 3_

    _Decomposition rationale:_ Persistence is the atomic state transition committing the ingestion to durable storage.

    _Surfaced assumptions:_ A-0361, A-0362
  - **US-011-C02.1.4** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Publish event to analysis event stream, **so that** Event message available for downstream scoring.

    **Acceptance criteria:**
      - **AC-02.1.4** — Event message published to event bus within bounds.
        - _Measurable:_ Message acknowledged by event bus within ingestion latency budget

    _Status: atomic · Priority: high · Tier: D · Traces to: US-011-C02.1, WF-12 · Pass: 3_

    _Decomposition rationale:_ Fan-out to analysis consumers is the final atomic action enabling the pipeline to proceed.

    _Surfaced assumptions:_ A-0361, A-0362
##### US-011-C02.2 `[Tier C · pending]`

**As a** Anomaly Scorer, **I want** Calculate anomaly score for collected isolation events, **so that** System distinguishes between expected noise and real isolation breaches.

**Acceptance criteria:**
  - **AC-C02-2** — Scored events exceed configured threshold
    - _Measurable:_ anomaly_score >= 0.85 OR anomaly_score == 1.0

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-11, TECH-12 · Pass: 2_

_Decomposition rationale:_ This child defines the core logic of the pipeline. Traces to UJ-11 (Staff monitoring) to ensure the output is usable by operators, and TECH-12 (Observability) to ensure metrics are logged for the score.

_Surfaced assumptions:_ A-0135, A-0136, A-0137

  - **US-011-C02.2-1** `[Tier C · pending]`
    **As a** System, **I want** Apply selected anomaly scoring algorithm to ingestion events, **so that** Every event in the pipeline receives a calculated anomaly_score value.

    **Acceptance criteria:**
      - **AC-1** — Score calculation completes without error for valid input.
        - _Measurable:_ score !== null AND score IS FINITE for every event_id processed

    _Status: pending · Priority: critical · Tier: C · Traces to: US-011-C02.2, UJ-11 · Pass: 3_

    _Decomposition rationale:_ Defines the implementation choice of how the 'score' is mathematically derived, ensuring the system performs the calculation correctly.

    _Surfaced assumptions:_ A-0363, A-0364
  - **US-011-C02.2-2** `[Tier C · pending]`
    **As a** Configuration, **I want** Read and apply configured anomaly thresholds from storage, **so that** Events are flagged as anomalies if score exceeds 0.85 or equals 1.0.

    **Acceptance criteria:**
      - **AC-2** — Threshold comparison logic matches the configured value.
        - _Measurable:_ if (score >= threshold_config.value) OR (score === 1.0) then flag=true

    _Status: pending · Priority: critical · Tier: C · Traces to: US-011-C02.2, COMP-10 · Pass: 3_

    _Decomposition rationale:_ Commits to the specific mechanism (read config) by which the threshold values are applied, distinguishing this from hard-coding.

    _Surfaced assumptions:_ A-0363, A-0364
  - **US-011-C02.2-3** `[Tier D · atomic]`
    **As a** Data Process, **I want** Persist calculated score and flag status to anomaly store, **so that** Resulting score and anomaly flag are written to the persistent store.

    **Acceptance criteria:**
      - **AC-3** — Record exists in anomaly_store with correct score.
        - _Measurable:_ SELECT 1 FROM anomaly_store WHERE event_id = ? AND anomaly_score = ? LIMIT 1

    _Status: atomic · Priority: high · Tier: D · Traces to: US-011-C02.2, UJ-11 · Pass: 3_

    _Decomposition rationale:_ Atomic leaf operation: committing the result of the scoring process to a state that can be verified via data integrity checks.

    _Surfaced assumptions:_ A-0363, A-0364
  - **US-011-C02.2-4** `[Tier D · atomic]`
    **As a** Observability, **I want** Log scoring metrics to telemetry collector, **so that** Scoring performance and false positive rate are emitted to the monitoring pipeline.

    **Acceptance criteria:**
      - **AC-4** — Metric record is received by collector within TTL.
        - _Measurable:_ collect_time <= processing_time + 30 seconds

    _Status: atomic · Priority: medium · Tier: D · Traces to: US-011-C02.2, TECH-12 · Pass: 3_

    _Decomposition rationale:_ Enforces the observability commitment defined by TECH-12, ensuring scoring behavior is visible for tuning the thresholds and algorithms.

    _Surfaced assumptions:_ A-0363, A-0364
##### US-011-C02.3 `[Tier C · pending]`

**As a** Alert Dispatcher, **I want** Generate and dispatch violation alert to monitoring service, **so that** Stakeholders are notified of the violation to initiate response.

**Acceptance criteria:**
  - **AC-C02-3** — Alert payload sent within the compliance deadline
    - _Measurable:_ alert_sent_timestamp - violation_detected_timestamp <= 3600s

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-5, US-011-C04 · Pass: 2_

_Decomposition rationale:_ This child fulfills the parent's AC-2. It must satisfy financial audit requirements (COMP-5) and tie to audit logs (US-011-C04) to ensure the alert is recorded immutably.

_Surfaced assumptions:_ A-0135, A-0136, A-0137

#### US-011-C03 `[Tier B · pending]`

**As a** Security Lead, **I want** Define Tenant ID binding logic for sessions and tokens, **so that** Every session and auth token carries a valid ENT-TENANT identifier.

**Acceptance criteria:**
  - **AC-3** — Session token includes tenant context at issuance.
    - _Measurable:_ token.payload.tenant_id === auth_request.tenant_id

_Status: pending · Priority: high · Tier: B · Traces to: UJ-11, ENT-SESSION, COMP-17 · Pass: 1_

_Decomposition rationale:_ This is a governing rule (Tier B) because it defines the policy for how tenant identity is bound to a user session, a prerequisite for RLS checks in US-011-C01.

_Surfaced assumptions:_ A-0032, A-0033

##### US-011-C03.1 `[Tier C · pending]`

**As a** Auth Middleware, **I want** Inject tenant_id into JWT access token claims on issuance, **so that** Issued token contains valid tenant context derived from auth request.

**Acceptance criteria:**
  - **AC-3** — Token payload includes tenant ID matching request context.
    - _Measurable:_ token.payload.tenant_id === auth_request.tenant_id for every issued access token

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-11, ENT-SESSION, COMP-17 · Pass: 2_

_Decomposition rationale:_ Direct implementation of the binding logic requirement; ensures isolation at the artifact level as the most testable consequence.

_Surfaced assumptions:_ A-0224, A-0225

  - **US-011-C03.1-1.0.1** `[Tier D · atomic]`
    **As a** Auth Middleware, **I want** Extract tenant identifier from incoming auth request context, **so that** Tenant identifier is available for token construction.

    **Acceptance criteria:**
      - **AC-001** — Extracted tenant_id matches request context value
        - _Measurable:_ extracted_id === request.context.tenant_id

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-11, ENT-SESSION · Pass: 3_

    _Decomposition rationale:_ First step in the injection flow; isolates the retrieval logic before token construction.

    _Surfaced assumptions:_ A-0540
  - **US-011-C03.1-1.0.2** `[Tier D · atomic]`
    **As a** Auth Middleware, **I want** Add extracted tenant_id to JWT payload claims, **so that** JWT payload contains tenant context claim.

    **Acceptance criteria:**
      - **AC-002** — Token payload includes tenant_id matching extraction
        - _Measurable:_ token.payload['tenant_id'] === extracted_id

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-11, ENT-SESSION, US-011-C03.1 · Pass: 3_

    _Decomposition rationale:_ Ensures the tenant context is explicitly placed into the transport layer for downstream validation.

    _Surfaced assumptions:_ A-0540
  - **US-011-C03.1-1.0.3** `[Tier D · atomic]`
    **As a** Auth Middleware, **I want** Validate token scope consistency against tenant RLS, **so that** Issued token is scoped to the correct tenant.

    **Acceptance criteria:**
      - **AC-003** — Token payload tenant_id matches RLS policy scope
        - _Measurable:_ tenant_id_in_token === RLS_policy.tenant_id_scope

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-11, ENT-SESSION, TECH-7 · Pass: 3_

    _Decomposition rationale:_ Enforces data isolation requirement (UJ-11) by verifying tenant_id matches RLS constraints before signing.

    _Surfaced assumptions:_ A-0540
  - **US-011-C03.1-1.0.4** `[Tier D · atomic]`
    **As a** Auth Middleware, **I want** Record tenant context in issuance event log, **so that** Audit record contains tenant_id for the issued token.

    **Acceptance criteria:**
      - **AC-004** — Log entry includes tenant_id associated with issuance
        - _Measurable:_ audit_log_entry.tenant_id === token.tenant_id

    _Status: atomic · Priority: high · Tier: D · Traces to: US-011-C03.3, ENT-SESSION, UJ-11 · Pass: 3_

    _Decomposition rationale:_ Aligns with sibling C03.3 by ensuring the audit trail captures the specific tenant context of the issuance event.

    _Surfaced assumptions:_ A-0540
##### US-011-C03.2 `[Tier C · pending]`

**As a** Auth Service Validator, **I want** Reject authentication requests missing or ambiguous tenant_id, **so that** Invalid or ambiguous tenant identifiers result in denied authentication.

**Acceptance criteria:**
  - **AC-3.1** — Authentication fails when tenant_id is null or unbound.
    - _Measurable:_ auth_request.tenant_id === null OR token.payload.tenant_id !== auth_request.tenant_id results in status 403

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-TENANT, COMP-17 · Pass: 2_

_Decomposition rationale:_ Enforces the binding logic by gating the entry point; prevents cross-tenant leakage at the authorization layer.

_Surfaced assumptions:_ A-0224, A-0225

##### US-011-C03.3 `[Tier C · pending]`

**As a** Audit Logger, **I want** Create immutable record for every token issuance event, **so that** Audit trail contains history of who issued what token for which tenant.

**Acceptance criteria:**
  - **AC-3.2** — Audit log entry generated on every token issuance.
    - _Measurable:_ count(log_entries_for_tenant_issuance) === count(token_issuances) per audit period

_Status: pending · Priority: high · Tier: C · Traces to: UJ-11, COMP-17, ENT-AUDIT-LOG-ENTRY · Pass: 2_

_Decomposition rationale:_ Supports COMP-17 and UJ-11 integrity monitoring; provides verifiable evidence of the binding logic being applied.

_Surfaced assumptions:_ A-0224, A-0225

##### US-011-C03.4 `[Tier C · pending]`

**As a** Session State Manager, **I want** Bind tenant_id to session state for refresh token validation, **so that** Refresh tokens are only valid within the scope of the bound tenant session.

**Acceptance criteria:**
  - **AC-3.3** — Refresh token validation fails if tenant_id in state differs from request.
    - _Measurable:_ validate_refresh_token() returns true only if state.tenant_id === request.tenant_id

_Status: pending · Priority: high · Tier: C · Traces to: ENT-SESSION, COMP-17 · Pass: 2_

_Decomposition rationale:_ Extends the binding logic to refresh tokens; ensures long-lived artifacts also enforce isolation.

_Surfaced assumptions:_ A-0224, A-0225

#### US-011-C04 `[Tier C · pending]`

**As a** Compliance Officer, **I want** Log all isolation check attempts for audit trail, **so that** Audit log contains immutable record of all access attempts.

**Acceptance criteria:**
  - **AC-4** — Log entry created for every access request.
    - _Measurable:_ audit_log_count == total_access_requests for period of interest

_Status: pending · Priority: medium · Tier: C · Traces to: UJ-11, COMP-17, ENT-AUDIT-LOG-ENTRY · Pass: 1_

_Decomposition rationale:_ Compliance citation COMP-17 requires complete history. This child commits to the implementation detail of logging every isolation check attempt.

_Surfaced assumptions:_ A-0032, A-0033

##### FR-US-011-C04-01 `[Tier C · pending]`

**As a** CAM operator, **I want** Emit audit event on access decision, **so that** Every access request results in a log row creation.

**Acceptance criteria:**
  - **AC-001** — Event logged within 100ms of decision
    - _Measurable:_ log_entry.created_at >= access_check.timestamp - 100ms for every entry

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-11, COMP-17, ENT-AUDIT-LOG-ENTRY · Pass: 2_

_Decomposition rationale:_ Binds the requirement to the specific action of recording the event; this must happen at the decision boundary to capture the 'attempt' semantics.

_Surfaced assumptions:_ A-0138, A-0139

  - **FR-US-011-C04-01.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Define the audit log entry payload schema, **so that** Every log row contains User ID, Action, Timestamp, Tenant ID, Decision ID.

    **Acceptance criteria:**
      - **AC-01** — Log row contains all required identity and action fields.
        - _Measurable:_ JSON schema of persisted row validates presence of fields: user_id, action_type, timestamp, tenant_id, decision_id

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-AUDIT-LOG-ENTRY, COMP-17 · Pass: 3_

    _Decomposition rationale:_ Distinguishes 'what' is logged from 'when' (latency) and 'how' (storage). Essential to avoid overlap with sibling FR-US-011-C04-03 (isolation scope) which defines layers, and FR-US-011-C04-02 (persistence) which defines storage constraints.

    _Surfaced assumptions:_ A-0365, A-0366
  - **FR-US-011-C04-01.2** `[Tier C · pending]`
    **As a** CAM operator, **I want** Implement asynchronous buffering for log ingestion, **so that** Decision event enters write path within 100ms threshold.

    **Acceptance criteria:**
      - **AC-02** — Event enters buffer before main response is finalized.
        - _Measurable:_ latency_between_decision_and_buffer_acceptance <= 100ms for 99.9% of requests

    _Status: pending · Priority: high · Tier: C · Traces to: TECH-12, WF-13 · Pass: 3_

    _Decomposition rationale:_ Selects an architectural strategy (async/buffer) to meet the strict 100ms performance constraint inherent in the parent. This strategy commits to decoupling business logic from storage IO.

    _Surfaced assumptions:_ A-0365, A-0366
  - **FR-US-011-C04-01.3** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Persist log entry to storage, **so that** Write operation completes and is acknowledged.

    **Acceptance criteria:**
      - **AC-03** — Persistent record exists immediately after buffer acceptance.
        - _Measurable:_ SELECT count(*) FROM audit_log_entries WHERE decision_id = X AND is_finalized = true

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-AUDIT-LOG-ENTRY, FR-US-011-C04-02 · Pass: 3_

    _Decomposition rationale:_ Atomic action representing the final leaf operation where the log row is physically durable. Traces to sibling FR-US-011-C04-02 which defines the append-only nature of the storage constraint.

    _Surfaced assumptions:_ A-0365, A-0366
##### FR-US-011-C04-02 `[Tier C · pending]`

**As a** CAM operator, **I want** Persist to append-only storage, **so that** Log entries cannot be modified or deleted after write.

**Acceptance criteria:**
  - **AC-002** — Delete attempt returns error
    - _Measurable:_ DELETE FROM audit_logs WHERE id = :id returns error code for all entries

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-17, ENT-AUDIT-LOG-ENTRY · Pass: 2_

_Decomposition rationale:_ Enforces the 'immutable record' AC by committing to a specific storage constraint (append-only) that guarantees integrity.

_Surfaced assumptions:_ A-0138, A-0139

  - **FR-US-011-C04-02-1** `[Tier C · pending]`
    **As a** Storage Engineer, **I want** Configure SeaweedFS object buckets to reject overwrite/delete operations, **so that** Storage layer returns failure on non-append write attempts.

    **Acceptance criteria:**
      - **AC-002-C1** — Non-append write requests fail at storage gateway
        - _Measurable:_ tusd server returns 415 or 503 on overwrite/delete attempt for audit bucket

    _Status: pending · Priority: critical · Tier: C · Traces to: COMP-17, ENT-AUDIT-LOG-ENTRY, TECH-13 · Pass: 3_

    _Decomposition rationale:_ Defines the specific storage engine mechanism (SeaweedFS configuration) required to enforce the append-only strategy at the infrastructure level.

    _Surfaced assumptions:_ A-0367, A-0368, A-0369
  - **FR-US-011-C04-02-2** `[Tier C · pending]`
    **As a** Backend Developer, **I want** Implement API layer policy to reject DELETE/UPDATE on audit entities, **so that** API returns error before DB mutation occurs.

    **Acceptance criteria:**
      - **AC-002-C2** — DELETE requests for audit logs return HTTP 403/500
        - _Measurable:_ HTTP response status code is 403 Forbidden for audit log mutation endpoints

    _Status: pending · Priority: critical · Tier: C · Traces to: COMP-17, ENT-AUDIT-LOG-ENTRY, FR-US-011-C04-03 · Pass: 3_

    _Decomposition rationale:_ Adds application-level defense in depth, ensuring immutability even if storage layer is bypassed or misconfigured.

    _Surfaced assumptions:_ A-0367, A-0368, A-0369
  - **FR-US-011-C04-02-3** `[Tier C · pending]`
    **As a** Database Architect, **I want** Apply immutable RLS policy to audit log tables within PostgreSQL, **so that** Row-level security blocks any user from modifying audit rows.

    **Acceptance criteria:**
      - **AC-002-C3** — RLS policy denies UPDATE/DELETE on audit tables
        - _Measurable:_ SELECT permission granted, DML permissions explicitly revoked for all roles on audit schema

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-AUDIT-LOG-ENTRY, TECH-7, COMP-17 · Pass: 3_

    _Decomposition rationale:_ Leverages existing infrastructure (PostgreSQL RLS) to enforce the immutability constraint at the database schema level.

    _Surfaced assumptions:_ A-0367, A-0368, A-0369
  - **FR-US-011-C04-02-4** `[Tier D · atomic]`
    **As a** QA Engineer, **I want** Verify single log entry append operation succeeds and is recorded, **so that** Audit log row count increments without data modification.

    **Acceptance criteria:**
      - **AC-002-C4** — Append operation records exact data without truncation
        - _Measurable:_ COUNT(*) of audit table increases by 1 after single insert, existing rows unchanged

    _Status: atomic · Priority: medium · Tier: D · Traces to: ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Atomic operation representing the successful execution of the append-only requirement in a testable unit.

    _Surfaced assumptions:_ A-0367, A-0368, A-0369
##### FR-US-011-C04-03 `[Tier B · pending]`

**As a** Scope architect, **I want** Define isolation check scope, **so that** System logs attempts from both RLS and Application Auth layers.

**Acceptance criteria:**
  - **AC-003** — Logs include RLS and App checks
    - _Measurable:_ SELECT COUNT(*) FROM audit_logs WHERE source_layer IN ('RLS', 'APP_AUTH') >= total_checks

_Status: pending · Priority: high · Tier: B · Traces to: US-011-C01, US-011-C03, ENT-TENANT · Pass: 2_

_Decomposition rationale:_ This child defines the policy boundary of what constitutes an 'isolation check attempt', determining whether RLS checks, AuthZ checks, or both are in scope for the audit trail.

_Surfaced assumptions:_ A-0138, A-0139

### FR US-013 `[pending]`

**As a** CAM, **I want** Review financial health and usage analytics, **so that** CAM monitors community spending and platform activity.

**Acceptance criteria:**
  - **AC-024** — Data accurate
    - _Measurable:_ ENT-METRIC-SNAPSHOT matches source ledger within 0.1% variance
  - **AC-025** — Export format correct
    - _Measurable:_ Exported CSV/PDF includes all columns defined in ENT-REPORT-CONFIG

_Status: pending · Priority: high · Traces to: UJ-13, ENT-METRIC-SNAPSHOT, WF-10, COMP-5, COMP-15 · Pass: 0_

#### US-013-C01 `[Tier A · pending]`

**As a** Functional Sub-area, **I want** Aggregate financial ledger metrics for CAM review, **so that** Dashboard displays community spending data derived from client ledgers.

**Acceptance criteria:**
  - **AC-FIN-001** — Financial sub-area covers all client ledger entries.
    - _Measurable:_ subset(snapshots) == union(client_ledger_entries) for each community

_Status: pending · Priority: high · Tier: A · Traces to: UJ-13, ENT-METRIC-SNAPSHOT · Pass: 1_

_Decomposition rationale:_ This child defines one of the two primary dimensions of the parent (Financial Health) as a distinct sub-area requiring its own data model.

_Surfaced assumptions:_ A-0038, A-0039, A-0040

##### FR-FIN-LEDGER-SCOPE-001 `[Tier B · pending]`

**As a** Scope boundary, **I want** Define source boundary for ledger aggregation by tenant ownership, **so that** Only ledgers belonging to the active `ENT-TENANT` ID are included in the CAM dashboard metrics.

**Acceptance criteria:**
  - **AC-FIN-SCOPE-001** — Metric excludes data from external or internal admin ledger partitions.
    - _Measurable:_ Filter ledger rows where `tenant_id` == `system.tenant_id` AND `status` = 'ACTIVE'

_Status: pending · Priority: high · Tier: B · Traces to: ENT-TENANT, ENT-CLIENT-LEDGER · Pass: 2_

_Decomposition rationale:_ Distinguishes the system's multi-tenant isolation commitment from the specific functional sub-area's data scope, preventing data leaks from `ENT-TENANT` of other orgs.

_Surfaced assumptions:_ A-0147, A-0148

##### FR-FIN-LEDGER-CONTENT-001 `[Tier B · pending]`

**As a** Content policy, **I want** Filter out transient ledger states from metric calculations, **so that** Metric aggregates only finalized transactions, excluding voided, reversed, or pending entries.

**Acceptance criteria:**
  - **AC-FIN-CONTENT-001** — Calculation excludes ledger entries where `status` is 'VOID', 'REVERSED', or 'PENDING'.
    - _Measurable:_ Count(ledger_entries where status NOT IN ('VOID', 'REVERSED', 'PENDING')) matches metric count

_Status: pending · Priority: high · Tier: B · Traces to: UJ-13, ENT-METRIC-SNAPSHOT · Pass: 2_

_Decomposition rationale:_ Ensures the dashboard reflects settled financial reality rather than transient bookkeeping states, aligning with 'Financial Audit' sub-area commitments in `US-013-C05`.

_Surfaced assumptions:_ A-0147, A-0148

##### FR-FIN-LEDGER-LOGIC-001 `[Tier C · pending]`

**As a** Implementation commitment, **I want** Enforce materialized view refresh schedule for snapshots, **so that** Dashboard displays metrics within 15 minutes of the nightly batch job completion.

**Acceptance criteria:**
  - **AC-FIN-LOGIC-001** — Snapshot row `created_at` must be >= 14:55:00 when job completes at 15:00:00.
    - _Measurable:_ SELECT MAX(created_at) FROM metric_snapshots >= TIMESTAMP '2024-01-01 15:00:00'

_Status: pending · Priority: medium · Tier: C · Traces to: ENT-METRIC-SNAPSHOT, TECH-6 · Pass: 2_

_Decomposition rationale:_ Concrete technical constraint on freshness derived from DBOS workflow scheduling capabilities, distinct from the variance threshold in `US-013-C03`.

_Surfaced assumptions:_ A-0147, A-0148

  - **FR-FIN-LEDGER-LOGIC-001-001** `[Tier C · pending]`
    **As a** Scheduler, **I want** Trigger refresh via DBOS workflow engine, **so that** Job initiates automatically according to the configured schedule.

    **Acceptance criteria:**
      - **AC-001** — Refresh job is registered and active.
        - _Measurable:_ DBOS Workflow definition for 'MetricSnapshotRefresh' returns status 'active' in workflow registry

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-6, WF-10 · Pass: 3_

    _Decomposition rationale:_ This child commits to the specific engineering sub-strategy (DBOS) for handling the schedule, distinguishing it from a generic 'cron' or 'queue' approach. It is an implementation choice (Tier C).

    _Surfaced assumptions:_ A-0379, A-0380
  - **FR-FIN-LEDGER-LOGIC-001-002** `[Tier B · pending]`
    **As a** Scope Commitment, **I want** Enforce data freshness window and content boundary, **so that** Snapshots include only finalized data within the required 15-minute window.

    **Acceptance criteria:**
      - **AC-002** — Metric aggregates exclude transient and pending entries.
        - _Measurable:_ Query returns rows where status IN ('finalized', 'approved')

    _Status: pending · Priority: high · Tier: B · Traces to: FR-FIN-LEDGER-CONTENT-001 · Pass: 3_

    _Decomposition rationale:_ This child defines what the system IS regarding the content of the view (Scope commitment). It binds the system to exclude transient states, distinct from how it is implemented (Tier C).

    _Surfaced assumptions:_ A-0379, A-0380
  - **FR-FIN-LEDGER-LOGIC-001-003** `[Tier D · atomic]`
    **As a** Verification, **I want** Verify dashboard read consistency, **so that** Dashboard renders metrics from the refreshed snapshot without stale data.

    **Acceptance criteria:**
      - **AC-003** — Dashboard query returns valid data within window.
        - _Measurable:_ SELECT MAX(created_at) FROM metric_snapshots WHERE snapshot_type = 'daily' AND tenant_id = $1;

    _Status: atomic · Priority: medium · Tier: D · Traces to: ENT-METRIC-SNAPSHOT, UJ-13 · Pass: 3_

    _Decomposition rationale:_ This is a leaf operation (Tier D). It is an atomic action whose acceptance criteria are individually testable without further decomposition (verifying the dashboard read).

    _Surfaced assumptions:_ A-0379, A-0380
  - **FR-FIN-LEDGER-LOGIC-001-004** `[Tier C · pending]`
    **As a** Isolation Enforcer, **I want** Filter refresh data by active tenant ID, **so that** No cross-tenant data leakage occurs during batch refresh.

    **Acceptance criteria:**
      - **AC-004** — Refresh query includes `ENT-TENANT` filter.
        - _Measurable:_ WHERE tenant_id IN (SELECT id FROM active_leaders LIMIT 1000) OR tenant_id = CURRENT_TENANT

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-FIN-LEDGER-SCOPE-001, ENT-TENANT · Pass: 3_

    _Decomposition rationale:_ This child is an implementation commitment to apply the scope boundary rule from the sibling. It binds the system to the specific constraint of multi-tenant isolation during the refresh process.

    _Surfaced assumptions:_ A-0379, A-0380
#### US-013-C02 `[Tier A · pending]`

**As a** Functional Sub-area, **I want** Aggregate platform usage analytics for CAM review, **so that** Dashboard displays system activity metrics (API calls, logins).

**Acceptance criteria:**
  - **AC-USG-001** — Usage sub-area covers platform activity events.
    - _Measurable:_ subset(snapshots) == union(event_logs) for each platform instance

_Status: pending · Priority: high · Tier: A · Traces to: UJ-13 · Pass: 1_

_Decomposition rationale:_ This child defines the second dimension of the parent (Usage Analytics) as a distinct sub-area, separating it from the financial ledger.

_Surfaced assumptions:_ A-0038, A-0039, A-0040

##### US-013-C02-01 `[Tier B · pending]`

**As a** Engineering sub-strategy, **I want** Adopt OpenTelemetry collectors for telemetry ingestion, **so that** Platform activity events are captured consistently across Node.js (Tech-5) and Native Clients (Tech-4) without custom SDK implementation.

**Acceptance criteria:**
  - **AC-001** — Telemetry pipeline utilizes OpenTelemetry agents
    - _Measurable:_ OpenTelemetry collector configuration matches ENT-DEVICE-SYNC-TOKEN specifications at connection layer

_Status: pending · Priority: high · Tier: B · Traces to: UJ-13 · Pass: 2_

_Decomposition rationale:_ Defines the engineering architecture for data capture, committing to Tech-12 observability stack rather than custom logging libraries.

_Surfaced assumptions:_ A-0149, A-0150

##### US-013-C02-02 `[Tier B · pending]`

**As a** Scope commitment, **I want** Exclude internal staff and technician sessions from public usage metrics, **so that** Dashboard reflects only external user and provider activity (P-1, P-2, P-3, P-4).

**Acceptance criteria:**
  - **AC-002** — User persona in session does not match internal roles
    - _Measurable:_ session.persona_id in ('P-5', 'P-6') implies record is filtered from aggregation stream

_Status: pending · Priority: critical · Tier: B · Traces to: UJ-13, US-013-C02 · Pass: 2_

_Decomposition rationale:_ Establishes the boundary of 'platform activity' by explicitly excluding P-5/P-6 sessions as defined in existing assumption A-0039.

_Surfaced assumptions:_ A-0149, A-0150

##### US-013-C02-03 `[Tier C · pending]`

**As a** Implementation commitment, **I want** Define metric snapshot generation interval, **so that** Dashboard renders updated metrics without excessive database load.

**Acceptance criteria:**
  - **AC-003** — Snapshots computed at fixed intervals via background task
    - _Measurable:_ Task schedule interval_ms == 900000 (15 minutes)

_Status: pending · Priority: medium · Tier: C · Traces to: UJ-13 · Pass: 2_

_Decomposition rationale:_ Commits to specific frequency for materialized view updates (A-0040), enabling testable refresh behavior.

_Surfaced assumptions:_ A-0149, A-0150

  - **US-013-C02-03.1** `[Tier C · pending]`
    **As a** Scheduler, **I want** Configure DBOS Workflow task to execute metric aggregation jobs, **so that** Background task initiates snapshot generation every 15 minutes automatically.

    **Acceptance criteria:**
      - **AC-003.1** — Task executes at fixed interval.
        - _Measurable:_ Next job start_time = Last job finish_time + 900000 milliseconds

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-13 · Pass: 3_

    _Decomposition rationale:_ Committed to a specific durable workflow engine (Tech-6) to ensure reliability of the interval defined in the parent.

    _Surfaced assumptions:_ A-0381, A-0382
  - **US-013-C02-03.2** `[Tier B · pending]`
    **As a** Policy, **I want** Define scope of metrics aggregated into snapshots, **so that** Snapshot view reflects only usage data eligible for public display.

    **Acceptance criteria:**
      - **AC-003.2** — Snapshot excludes internal staff sessions.
        - _Measurable:_ count(external_users) >= 0 AND count(internal_users) == 0 in snapshot view

    _Status: pending · Priority: high · Tier: B · Traces to: UJ-13, US-013-C02-02 · Pass: 3_

    _Decomposition rationale:_ Establishes the policy boundary for what data is materialized, ensuring alignment with the sibling commitment to exclude internal sessions (US-013-C02-02).

    _Surfaced assumptions:_ A-0381, A-0382
  - **US-013-C02-03.3** `[Tier C · pending]`
    **As a** System, **I want** Enforce resource throttling during aggregation window, **so that** System prevents database overload during snapshot computation.

    **Acceptance criteria:**
      - **AC-003.3** — Job throttles if active connections exceed threshold.
        - _Measurable:_ abort_if(DB.active_connections > 20)

    _Status: pending · Priority: medium · Tier: C · Traces to: UJ-13 · Pass: 3_

    _Decomposition rationale:_ Concrete implementation constraint to satisfy the parent goal of 'without excessive database load'.

    _Surfaced assumptions:_ A-0381, A-0382
##### US-013-C02-04 `[Tier C · pending]`

**As a** Implementation commitment, **I want** Enforce tenant isolation on aggregated data, **so that** CAMs never see metrics from other HOA tenants.

**Acceptance criteria:**
  - **AC-004** — Aggregation logic validates tenant ownership
    - _Measurable:_ SELECT COUNT(*) FROM aggregated_metrics WHERE tenant_id != current_tenant_id yields 0 at commit time

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-11, UJ-13 · Pass: 2_

_Decomposition rationale:_ Commits to using PostgreSQL Row-Level Security (Tech-7) constraints for aggregation queries to ensure data isolation.

_Surfaced assumptions:_ A-0149, A-0150

  - **US-013-C02-04.1** `[Tier C · pending]`
    **As a** Database Layer, **I want** Apply Row-Level Security (RLS) policy on metric aggregation tables, **so that** All queries to aggregated_metrics are restricted to the session's tenant_id.

    **Acceptance criteria:**
      - **AC-04-1** — RLS policy enforces tenant filter at row access level.
        - _Measurable:_ SELECT COUNT(*) FROM aggregated_metrics WHERE tenant_id != current_tenant_id yields 0 for any unauthenticated session

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-12, ENT-TENANT · Pass: 3_

    _Decomposition rationale:_ RLS is the primary enforcement point for Postgres multi-tenancy; this child defines the DB-level mechanism for the parent commitment.

    _Surfaced assumptions:_ A-0383, A-0384
  - **US-013-C02-04.2** `[Tier C · pending]`
    **As a** Aggregation Service, **I want** Inject tenant context into aggregation query parameters, **so that** Aggregation logic filters incoming requests before computing metrics.

    **Acceptance criteria:**
      - **AC-04-2** — Aggregation query parameters include mandatory tenant_id filter.
        - _Measurable:_ All aggregation service endpoints append tenant_id = :request_tenant to every SQL query

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-10, ENT-METRIC-SNAPSHOT · Pass: 3_

    _Decomposition rationale:_ Application-level filtering provides defense-in-depth; this child defines the specific logic layer enforcing isolation before data hits the DB.

    _Surfaced assumptions:_ A-0383, A-0384
  - **US-013-C02-04.3** `[Tier C · pending]`
    **As a** Audit & Monitoring, **I want** Log cross-tenant access attempts to immutable audit trail, **so that** Security events for isolation violations are recorded for compliance review.

    **Acceptance criteria:**
      - **AC-04-3** — Every denied request or bypass attempt writes a log entry.
        - _Measurable:_ ENT-AUDIT-LOG-ENTRY records exist for every request where tenant_id mismatch is detected

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-11, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Compliance and security monitoring requires logging violations; this child defines the observability commitment under the isolation policy.

    _Surfaced assumptions:_ A-0383, A-0384
  - **US-013-C02-04.4** `[Tier D · atomic]`
    **As a** Schema Definition, **I want** Ensure metric tables contain indexed tenant_id column, **so that** Schema enforces physical separation of tenant data attributes.

    **Acceptance criteria:**
      - **AC-04-4** — tenant_id column exists and is indexed in metric tables.
        - _Measurable:_ DESCRIBE aggregated_metrics returns tenant_id with btree index

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-METRIC-SNAPSHOT, A-0040 · Pass: 3_

    _Decomposition rationale:_ The atomic action of ensuring the schema supports isolation; this child defines the physical attribute required for the isolation mechanism.

    _Surfaced assumptions:_ A-0383, A-0384
##### US-013-C02-05 `[Tier D · atomic]`

**As a** Leaf operation, **I want** Persist single usage event to journal, **so that** Individual event row is stored immutably.

**Acceptance criteria:**
  - **AC-005** — Event log entry is written successfully
    - _Measurable:_ INSERT INTO event_logs (id, event_type, timestamp) returns affected_rows = 1

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-13 · Pass: 2_

_Decomposition rationale:_ Atomic write operation representing the terminal node of the data ingestion pipeline.

_Surfaced assumptions:_ A-0149, A-0150

##### US-013-C02-06 `[Tier D · atomic]`

**As a** Leaf operation, **I want** Update materialized metric snapshot record, **so that** Dashboard view reflects latest computed state.

**Acceptance criteria:**
  - **AC-006** — Materialized view row updated with new sum
    - _Measurable:_ UPDATE ENT-METRIC-SNAPSHOT SET value = value + delta WHERE id == snapshot_id returns rows_affected = 1

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-13 · Pass: 2_

_Decomposition rationale:_ Atomic update operation representing the terminal node of the metric accumulation pipeline.

_Surfaced assumptions:_ A-0149, A-0150

#### US-013-C03 `[Tier C · pending]`

**As a** Implementation Commitment, **I want** Enforce variance threshold on financial metric snapshots, **so that** No snapshot persists if financial ledger variance exceeds 0.1%.

**Acceptance criteria:**
  - **AC-ACC-001** — Financial metric accuracy meets 0.1% variance limit.
    - _Measurable:_ abs(sum(snapshot) - sum(ledger)) / sum(ledger) <= 0.001

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-METRIC-SNAPSHOT, WF-10 · Pass: 1_

_Decomposition rationale:_ This is a concrete implementation commitment derived from AC-024, specifying the exact threshold the system must enforce.

_Surfaced assumptions:_ A-0038, A-0039, A-0040

##### US-013-C03-1 `[Tier D · atomic]`

**As a** Metric Engine, **I want** Compute variance between snapshot and ledger aggregates, **so that** Returns the numeric percentage difference.

**Acceptance criteria:**
  - **AC-VAR-001** — Variance calculation returns a numeric float or zero.
    - _Measurable:_ variance_value === abs(sum(snapshot_values) - sum(ledger_values)) / sum(ledger_values)

_Status: atomic · Priority: high · Tier: D · Traces to: ENT-METRIC-SNAPSHOT · Pass: 2_

_Decomposition rationale:_ Breaking the implementation commitment into its atomic mathematical operation allows for unit testing the formula logic independently from the business rule.

_Surfaced assumptions:_ A-0151, A-0152

##### US-013-C03-2 `[Tier D · atomic]`

**As a** Variance Validator, **I want** Validate computed variance against 0.1% limit, **so that** Emits a boolean status indicating threshold compliance.

**Acceptance criteria:**
  - **AC-THRESH-001** — Validation returns true only if variance <= 0.001.
    - _Measurable:_ is_compliant === (variance_value <= 0.001)

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-10 · Pass: 2_

_Decomposition rationale:_ The threshold check is a distinct verification step required before the persistence guard can be evaluated.

_Surfaced assumptions:_ A-0151, A-0152

##### US-013-C03-3 `[Tier D · atomic]`

**As a** Persistence Guard, **I want** Conditionally persist snapshot to materialized view, **so that** Snapshot row is inserted into materialized view if validated.

**Acceptance criteria:**
  - **AC-PIST-001** — Snapshot update only occurs if validation passed.
    - _Measurable:_ if is_compliant then update_view else rollback_transaction

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-METRIC-SNAPSHOT, WF-10 · Pass: 2_

_Decomposition rationale:_ The final execution step that binds the implementation commitment to the database layer, enforcing the No snapshot persists constraint.

_Surfaced assumptions:_ A-0151, A-0152

#### US-013-C04 `[Tier C · pending]`

**As a** Implementation Commitment, **I want** Generate exports matching report configuration columns, **so that** CSV/PDF exports contain exactly the columns defined in ENT-REPORT-CONFIG.

**Acceptance criteria:**
  - **AC-EXP-001** — Export file columns match report config.
    - _Measurable:_ len(export_columns) == len(ENT-REPORT-CONFIG.columns)

_Status: pending · Priority: high · Tier: C · Traces to: WF-10, ENT-REPORT-CONFIG · Pass: 1_

_Decomposition rationale:_ This is a concrete implementation commitment derived from AC-025, ensuring the system strictly adheres to the exported schema definition.

_Surfaced assumptions:_ A-0038, A-0039, A-0040

##### US-013-C04-A-01 `[Tier A · pending]`

**As a** Functional Sub-Area, **I want** Generate CSV file exports, **so that** Export file contains tabular data in CSV format matching the configuration.

**Acceptance criteria:**
  - **AC-CSV-01** — Export is a valid UTF-8 CSV file.
    - _Measurable:_ file.encoding === 'UTF-8' && file.contentType === 'text/csv' for 'US-013-C04-A-01' path

_Status: pending · Priority: high · Tier: A · Traces to: WF-10, ENT-REPORT-CONFIG · Pass: 2_

_Decomposition rationale:_ Splitting by file format distinguishes the two primary functional paths (CSV vs PDF) which require different libraries and storage handling.

_Surfaced assumptions:_ A-0153, A-0154, A-0155, A-0156

  - **US-013-C04-A-01-1** `[Tier C · pending]`
    **As a** Output Formatter, **I want** Encode output stream as UTF-8, **so that** File is a valid UTF-8 encoded CSV document.

    **Acceptance criteria:**
      - **AC-CSV-ENC** — Export file uses UTF-8 encoding
        - _Measurable:_ file.encoding === 'UTF-8' for 'US-013-C04-A-01' path

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-10 · Pass: 3_

    _Decomposition rationale:_ Satisfies the 'file.encoding' condition of AC-CSV-01; encoding is a foundational implementation choice for text files.

    _Surfaced assumptions:_ A-0385, A-0386
  - **US-013-C04-A-01-2** `[Tier C · pending]`
    **As a** Format Validator, **I want** Assert Content-Type header is text/csv, **so that** HTTP response headers declare content type as text/csv.

    **Acceptance criteria:**
      - **AC-CSV-CONTENT** — HTTP response Content-Type is text/csv
        - _Measurable:_ header('Content-Type') === 'text/csv' for 'US-013-C04-A-01' path

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-10 · Pass: 3_

    _Decomposition rationale:_ Satisfies the 'file.contentType' condition of AC-CSV-01; ensures downstream consumers interpret the file correctly.

    _Surfaced assumptions:_ A-0385, A-0386
  - **US-013-C04-A-01-3** `[Tier C · pending]`
    **As a** Schema Enforcer, **I want** Render columns in config-defined order, **so that** Export headers and rows follow ENT-REPORT-CONFIG sequence.

    **Acceptance criteria:**
      - **AC-CSV-COL-ORD** — Column order matches report config
        - _Measurable:_ header_row_sequence === ENT-REPORT-CONFIG.column_order

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-REPORT-CONFIG · Pass: 3_

    _Decomposition rationale:_ Satisfies the 'matching the configuration' condition; binds data output to the existing report configuration schema.

    _Surfaced assumptions:_ A-0385, A-0386
##### US-013-C04-A-02 `[Tier A · pending]`

**As a** Functional Sub-Area, **I want** Generate PDF file exports, **so that** Export file contains formatted layout in PDF format matching the configuration.

**Acceptance criteria:**
  - **AC-PDF-01** — Export is a valid PDF file.
    - _Measurable:_ file.contentType === 'application/pdf' && file.size > 0 for 'US-013-C04-A-02' path

_Status: pending · Priority: high · Tier: A · Traces to: WF-10, ENT-REPORT-CONFIG · Pass: 2_

_Decomposition rationale:_ PDF generation is a distinct functional capability from CSV, utilizing different rendering engines and potentially different data aggregation logic.

_Surfaced assumptions:_ A-0153, A-0154, A-0155, A-0156

  - **US-013-C04-A-02-C01** `[Tier B · pending]`
    **As a** Rendering Strategy, **I want** Commit to headless browser rendering for layout fidelity, **so that** Layouts render exactly as defined in configuration without server-side PDF library limitations.

    **Acceptance criteria:**
      - **AC-001** — PDF output matches visual configuration exactly.
        - _Measurable:_ rendered_dom_elements_count === configuration_dom_elements_count for every export job

    _Status: pending · Priority: high · Tier: B · Traces to: WF-10, ENT-REPORT-CONFIG · Pass: 3_

    _Decomposition rationale:_ This child establishes the architectural strategy (Headless Browser) required to satisfy the 'formatted layout' AC, distinguishing it from server-side PDF generation limits.

    _Surfaced assumptions:_ A-0387, A-0388
  - **US-013-C04-A-02-C02** `[Tier C · pending]`
    **As a** Implementation Choice, **I want** Select Puppeteer for rendering engine implementation, **so that** Rendering engine is standardized across tenant instances.

    **Acceptance criteria:**
      - **AC-002** — Render engine library version is logged and versioned.
        - _Measurable:_ process.env.PUPPETEER_VERSION in [20.x, 21.x] at service startup

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-REPORT-CONFIG · Pass: 3_

    _Decomposition rationale:_ This child commits to a specific technology (Puppeteer) under the strategy of headless rendering, making implementation decisions explicit.

    _Surfaced assumptions:_ A-0387, A-0388
  - **US-013-C04-A-02-C03** `[Tier C · pending]`
    **As a** Font Handling, **I want** Embed fonts or fallback to system fonts during generation, **so that** Typography matches configuration without missing glyphs.

    **Acceptance criteria:**
      - **AC-003** — Generated PDF contains embedded font subsets or uses licensed system fonts.
        - _Measurable:_ pdf_fonts_array.length > 0 || pdf_system_fonts_used === true for every exported file

    _Status: pending · Priority: medium · Tier: C · Traces to: ENT-REPORT-CONFIG · Pass: 3_

    _Decomposition rationale:_ Layout fidelity depends on font availability; this child binds the implementation to a font embedding strategy.

    _Surfaced assumptions:_ A-0387, A-0388
  - **US-013-C04-A-02-D01** `[Tier D · atomic]`
    **As a** Leaf Validation, **I want** Verify PDF file validity before storage, **so that** No corrupted or invalid files persist to storage.

    **Acceptance criteria:**
      - **AC-004** — Export file is recognized as a valid PDF by a standard viewer or validator.
        - _Measurable:_ pdf_validator.is_valid(file_path) === true for every persisted file

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-10 · Pass: 3_

    _Decomposition rationale:_ This is a leaf operation testing the immediate consequence of the generation process.

    _Surfaced assumptions:_ A-0387, A-0388
##### US-013-C04-C-01 `[Tier C · pending]`

**As a** Implementation Commitment, **I want** Map report columns to database schema, **so that** Export columns reflect the exact subset defined in ENT-REPORT-CONFIG.

**Acceptance criteria:**
  - **AC-MAP-01** — Export column count matches config count.
    - _Measurable:_ export_columns.length === ENT-REPORT-CONFIG.columns.length at export initiation

_Status: pending · Priority: critical · Tier: C · Traces to: WF-10, ENT-REPORT-CONFIG · Pass: 2_

_Decomposition rationale:_ This is a concrete implementation strategy for handling the 'exact columns' constraint. It binds the data model to the report configuration.

_Surfaced assumptions:_ A-0153, A-0154, A-0155, A-0156

##### US-013-C04-C-02 `[Tier C · pending]`

**As a** Implementation Commitment, **I want** Persist export files to object storage, **so that** Export artifacts are stored and retrievable via supported channels.

**Acceptance criteria:**
  - **AC-STORE-01** — Export file exists in the object store bucket.
    - _Measurable:_ object_exists_in_seaweedfs(path) === true after write completes

_Status: pending · Priority: critical · Tier: C · Traces to: WF-10, ENT-REPORT-CONFIG, TECH-13 · Pass: 2_

_Decomposition rationale:_ Committed to using SeaweedFS (TECH-13) for all export artifacts. This choice impacts storage tier and retrieval API.

_Surfaced assumptions:_ A-0153, A-0154, A-0155, A-0156

  - **US-013-C04-C-02-1** `[Tier D · atomic]`
    **As a** Storage Operator, **I want** Write file bytes to SeaweedFS bucket, **so that** File payload is persisted in object storage.

    **Acceptance criteria:**
      - **AC-PERSIST-01** — File bytes match the input stream.
        - _Measurable:_ read(file_at_path) === input_stream_bytes after upload completes

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-10, TECH-13 · Pass: 3_

    _Decomposition rationale:_ Defines the atomic storage action required to satisfy the existence acceptance criterion. Decomposes the 'Persist' commitment into the specific write operation.

    _Surfaced assumptions:_ A-0389
  - **US-013-C04-C-02-2** `[Tier C · pending]`
    **As a** Metadata Manager, **I want** Persist file metadata (hash, timestamp, tenant_id), **so that** Audit-ready record of the stored artifact exists.

    **Acceptance criteria:**
      - **AC-META-01** — Metadata record is complete and immutable.
        - _Measurable:_ metadata_row_exists(path, hash, timestamp, tenant_id) === true after upload

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-REPORT-CONFIG, TECH-13 · Pass: 3_

    _Decomposition rationale:_ Binds the persistence requirement to the governance needs of auditability and retrieval, separating the content write from the metadata write.

    _Surfaced assumptions:_ A-0389
  - **US-013-C04-C-02-3** `[Tier D · atomic]`
    **As a** Integrity Verifier, **I want** Verify file integrity via stored hash, **so that** Stored data has not been corrupted.

    **Acceptance criteria:**
      - **AC-INTEG-01** — Stored file checksum matches metadata hash.
        - _Measurable:_ hash(read_file()) === metadata_record.hash

    _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-13 · Pass: 3_

    _Decomposition rationale:_ Establishes the verification requirement for the stored file content, ensuring the 'Persist' commitment includes data integrity.

    _Surfaced assumptions:_ A-0389
#### US-013-C05 `[Tier B · pending]`

**As a** Governing Rule, **I want** Adhere to financial audit retention standards, **so that** All metrics are retained per statutory and audit compliance requirements.

**Acceptance criteria:**
  - **AC-AUD-001** — Data retention policy enforced per COMP-5 and COMP-15.
    - _Measurable:_ delete_record_age >= retention_period_compliance

_Status: pending · Priority: critical · Tier: B · Traces to: COMP-5, COMP-15 · Pass: 1_

_Decomposition rationale:_ This child establishes the policy constraint governing how the data is stored and disposed of, independent of implementation tech choices.

_Surfaced assumptions:_ A-0038, A-0039, A-0040

### FR US-015 `[pending]`

**As a** Hestami Staff, **I want** Audit compliance status for a community, **so that** Staff runs a scan to ensure permits and insurance are current.

**Acceptance criteria:**
  - **AC-028** — Scan covers all assets
    - _Measurable:_ Scan result includes ENT-PROPERTY-ASSET and ENT-PERMIT for all properties in community
  - **AC-029** — Report actionable
    - _Measurable:_ Output report lists specific ENT-COMPLIANCE-FLAG items requiring attention

_Status: pending · Priority: critical · Traces to: UJ-15, COMP-10, COMP-14, ENT-COMPLIANCE-FLAG, WF-13 · Pass: 0_

#### FR-AUDIT-01 `[Tier C · pending]`

**As a** CAM operator, **I want** Retrieve current state of permits and insurance policies for all properties in the community, **so that** The audit scan has ingested the required asset and compliance data.

**Acceptance criteria:**
  - **AC-028** — Scan result includes ENT-PROPERTY-ASSET and ENT-PERMIT for all properties in community
    - _Measurable:_ Query returns records for all ENT-PROPERTY-ASSET linked to the community ID

_Status: pending · Priority: high · Tier: C · Traces to: UJ-15, ENT-PROPERTY-ASSET, ENT-PERMIT, WF-13 · Pass: 1_

_Decomposition rationale:_ Data retrieval is a prerequisite implementation choice; verifies AC-028 directly.

_Surfaced assumptions:_ A-0045, A-0046

##### FR-AUDIT-01.1 `[Tier C · pending]`

**As a** Data Ingestion Lead, **I want** Query property registry for target community ID, **so that** Query result set includes all ENT-PROPERTY-ASSET rows where community_id matches scan parameter.

**Acceptance criteria:**
  - **AC-028** — Query returns records for all ENT-PROPERTY-ASSET linked to the community ID
    - _Measurable:_ SELECT COUNT(*) FROM journal_entries WHERE community_id = $param LIMIT 1

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-PROPERTY-ASSET, UJ-15, WF-13 · Pass: 2_

_Decomposition rationale:_ Defines the specific data retrieval path for the property assets within the audit scan workflow, separating this from compliance data retrieval.

_Surfaced assumptions:_ A-0168

  - **FR-AUDIT-01.1.C1** `[Tier C · pending]`
    **As a** Engineer, **I want** Implement WHERE clause on community_id parameter, **so that** Query returns only records where community_id matches the scan parameter.

    **Acceptance criteria:**
      - **AC-001** — Every returned row has community_id equal to param.
        - _Measurable:_ row.community_id === $param for every row in result set

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-PROPERTY-ASSET, WF-13 · Pass: 3_

    _Decomposition rationale:_ The primary function of the query is filtering by community ID; this child defines the implementation of that filter logic directly.

    _Surfaced assumptions:_ A-0413, A-0414, A-0415
  - **FR-AUDIT-01.1.C2** `[Tier C · pending]`
    **As a** Engineer, **I want** Validate result set against journal_entries table, **so that** Result count matches the count of journal entries for the community.

    **Acceptance criteria:**
      - **AC-002** — Returned record count matches source count.
        - _Measurable:_ SELECT COUNT(*) FROM result_set === SELECT COUNT(*) FROM journal_entries WHERE community_id = $param

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-PROPERTY-ASSET, WF-13 · Pass: 3_

    _Decomposition rationale:_ AC-028 explicitly references journal_entries; this child ensures the query implementation honors that specific verification requirement.

    _Surfaced assumptions:_ A-0413, A-0414, A-0415
  - **FR-AUDIT-01.1.C3** `[Tier C · pending]`
    **As a** Security Architect, **I want** Apply Row-Level Security policies to query execution, **so that** Query respects multi-tenant isolation enforced by database RLS.

    **Acceptance criteria:**
      - **AC-003** — No cross-tenant data leakage occurs.
        - _Measurable:_ All rows returned belong to the requesting tenant's RLS scope.

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-PROPERTY-ASSET, TECH-7 · Pass: 3_

    _Decomposition rationale:_ Per TECH-7, PostgreSQL RLS is the enforcement mechanism; this child commits to using that constraint during ingestion.

    _Surfaced assumptions:_ A-0413, A-0414, A-0415
  - **FR-AUDIT-01.1.D1** `[Tier D · atomic]`
    **As a** Engineer, **I want** Log query execution details to audit trail, **so that** Immutable record of query parameters and execution state is created.

    **Acceptance criteria:**
      - **AC-004** — Audit log entry exists immediately after query.
        - _Measurable:_ ENT-AUDIT-LOG-ENTRY is created with community_id and timestamp matching query execution time.

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-13, FR-AUDIT-01.1 · Pass: 3_

    _Decomposition rationale:_ This is a leaf operation; once the query is executed and logged, no further functional decomposition is required for the audit trail purpose.

    _Surfaced assumptions:_ A-0413, A-0414, A-0415
##### FR-AUDIT-01.2 `[Tier C · pending]`

**As a** Compliance Engineer, **I want** Fetch permit and insurance status for linked assets, **so that** Result set includes ENT-PERMIT and ENT-INSURANCE-POLICY objects matched to the assets in FR-AUDIT-01.1.

**Acceptance criteria:**
  - **AC-029** — Scan result includes ENT-PERMIT for all properties in community
    - _Measurable:_ Every asset row in output has a corresponding permit record if one exists in registry

_Status: pending · Priority: high · Tier: C · Traces to: ENT-PERMIT, UJ-15, UJ-8, WF-13 · Pass: 2_

_Decomposition rationale:_ Separates compliance data retrieval from asset data retrieval to isolate source dependencies and data source availability strategies.

_Surfaced assumptions:_ A-0168

  - **FR-AUDIT-01.2.1** `[Tier D · atomic]`
    **As a** System Operator, **I want** Retrieve permit status from external registry API, **so that** Internal database row created for every active permit found in registry.

    **Acceptance criteria:**
      - **AC-101** — Internal permit row matches external registry ID.
        - _Measurable:_ per external_id IN registry_response: internal_permit_table.status == registry_response.status

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-PERMIT, UJ-8, WF-13 · Pass: 3_

    _Decomposition rationale:_ Permit ingestion is a distinct atomic operation separate from insurance ingestion; it must be validated against the registry API contract.

    _Surfaced assumptions:_ A-0416, A-0417, A-0418
  - **FR-AUDIT-01.2.2** `[Tier D · atomic]`
    **As a** System Operator, **I want** Retrieve insurance policy status from external provider API, **so that** Internal database row created for every active insurance policy found in registry.

    **Acceptance criteria:**
      - **AC-102** — Internal insurance row matches external provider policy ID.
        - _Measurable:_ per external_id IN insurance_response: internal_insurance_table.status == insurance_response.status

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-INSURANCE-POLICY, UJ-7, WF-13 · Pass: 3_

    _Decomposition rationale:_ Insurance ingestion is a distinct atomic operation requiring its own API integration and validation, distinct from permit data.

    _Surfaced assumptions:_ A-0416, A-0417, A-0418
  - **FR-AUDIT-01.2.3** `[Tier D · atomic]`
    **As a** System Operator, **I want** Join external permit/insurance records to internal asset ID, **so that** Every fetched external record is linked to a specific ENT-PROPERTY-ASSET row via join key.

    **Acceptance criteria:**
      - **AC-103** — No external record exists without a linked asset ID.
        - _Measurable:_ SELECT COUNT(*) FROM external_records WHERE asset_id IS NULL = 0

    _Status: atomic · Priority: high · Tier: D · Traces to: FR-AUDIT-01.1, ENT-PROPERTY-ASSET · Pass: 3_

    _Decomposition rationale:_ Data linking is the final atomic step ensuring the fetch operation results in a unified audit view consistent with the property registry.

    _Surfaced assumptions:_ A-0416, A-0417, A-0418
##### FR-AUDIT-01.3 `[Tier C · pending]`

**As a** Workflow Architect, **I want** Enforce snapshot consistency for external API calls, **so that** Audit report reflects data state as of scan initiation time, excluding records modified during scan execution.

**Acceptance criteria:**
  - **AC-030** — Scan results do not change if source data is updated during the scan window
    - _Measurable:_ Hash of result set at start time matches hash at end time

_Status: pending · Priority: high · Tier: C · Traces to: UJ-15, WF-13 · Pass: 2_

_Decomposition rationale:_ Implements the point-in-time snapshot requirement (A-0046) as a concrete implementation commitment for handling concurrent writes during scan execution.

_Surfaced assumptions:_ A-0168

  - **FR-AUDIT-01.3-C1** `[Tier C · pending]`
    **As a** Database Engine, **I want** Enforce Read-Committed Snapshot Isolation, **so that** Query session starts read view before scan.

    **Acceptance criteria:**
      - **AC-C1** — Session isolation level is set to snapshot.
        - _Measurable:_ session.isolation_level == 'read_committed_snapshot'

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-15, WF-13 · Pass: 3_

    _Decomposition rationale:_ This child defines the specific DB implementation required to achieve the parent's snapshot consistency policy without blocking writers.

    _Surfaced assumptions:_ A-0419, A-0420, A-0421
  - **FR-AUDIT-01.3-C2** `[Tier C · pending]`
    **As a** External Integration, **I want** Cache external data state in staging buffer, **so that** API response data excluded from concurrent updates.

    **Acceptance criteria:**
      - **AC-C2** — Buffered data matches external snapshot hash.
        - _Measurable:_ buffered_data_hash === external_data_snapshot_hash

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-15, WF-13 · Pass: 3_

    _Decomposition rationale:_ Isolating external calls in a buffer prevents network changes from affecting the result set during the window.

    _Surfaced assumptions:_ A-0419, A-0420, A-0421
  - **FR-AUDIT-01.3-C3** `[Tier C · pending]`
    **As a** Data Verification, **I want** Compute SHA-256 over result set rows, **so that** Hash matches stored baseline.

    **Acceptance criteria:**
      - **AC-C3** — Computed hash matches stored hash.
        - _Measurable:_ SHA-256(ALL_ROWS) === stored_hash

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-15, WF-13 · Pass: 3_

    _Decomposition rationale:_ Hashing is the standard algorithm for deterministic set comparison required for the audit report integrity.

    _Surfaced assumptions:_ A-0419, A-0420, A-0421
  - **FR-AUDIT-01.3-D1** `[Tier D · atomic]`
    **As a** Audit Operation, **I want** Insert audit snapshot record, **so that** Record persisted to audit log table.

    **Acceptance criteria:**
      - **AC-D1** — Audit log snapshot record is created.
        - _Measurable:_ audit_log_snapshot.id IS NOT NULL

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-13 · Pass: 3_

    _Decomposition rationale:_ This is the terminal operation of storing the verified state in the audit trail for compliance.

    _Surfaced assumptions:_ A-0419, A-0420, A-0421
#### FR-AUDIT-03 `[downgraded]`

**As a** CAM operator, **I want** Define community scope for audit (e.g., Active Properties Only vs All Owned), **so that** Audit covers the agreed subset of properties defined by policy.

**Acceptance criteria:**
  - **AC-SCOPE-01** — Admin can configure audit scope to include active or all properties
    - _Measurable:_ Configuration option exists to filter properties by status='Active' in scan query

_Status: downgraded · Priority: medium · Traces to: US-008 · Pass: 2_

##### FR-AUDIT-03.1 `[Tier D · atomic]`

**As a** CAM operator, **I want** toggle audit scope configuration between 'Active Only' and 'All Owned', **so that** System state updates the active audit scope preference for the community.

**Acceptance criteria:**
  - **AC-001** — Scope toggle persists and applies immediately
    - _Measurable:_ Configuration table 'audit_scope' contains new value for community_id upon update

_Status: atomic · Priority: high · Tier: D · Traces to: US-008, FR-AUDIT-01 · Pass: 2_

_Decomposition rationale:_ The user-facing action to change the scope is an atomic leaf operation that triggers the policy change.

_Surfaced assumptions:_ A-0229, A-0230, A-0231

##### FR-AUDIT-03.2 `[Tier C · pending]`

**As a** Backend Service, **I want** filter property list based on 'Active' status flag or skip filter, **so that** Audit scan results set includes only active properties when configured, or all otherwise.

**Acceptance criteria:**
  - **AC-002** — Query results respect the stored configuration flag
    - _Measurable:_ Query 'SELECT * FROM properties WHERE status = 'Active' OR (status = 'all' AND config='all')

_Status: pending · Priority: critical · Tier: C · Traces to: US-008, FR-AUDIT-01 · Pass: 2_

_Decomposition rationale:_ The implementation of the filter logic is an architectural choice required to make the configuration valid.

_Surfaced assumptions:_ A-0229, A-0230, A-0231

##### FR-AUDIT-03.3 `[Tier B · pending]`

**As a** CAM policy admin, **I want** define jurisdictional scope rules (e.g. 'Inactive properties excluded per state law'), **so that** Scope configuration defaults to jurisdictional standard if not overridden.

**Acceptance criteria:**
  - **AC-003** — Admin override of default jurisdictional scope is accepted
    - _Measurable:_ System accepts policy override if it does not violate compliance [A-0045]

_Status: pending · Priority: medium · Tier: B · Traces to: US-008, FR-AUDIT-01 · Pass: 2_

_Decomposition rationale:_ This is a sub-policy commitment (Tier B) regarding how defaults are set, distinguishing it from the atomic action.

_Surfaced assumptions:_ A-0229, A-0230, A-0231

### Backlog (6 roots)

### FR US-016 `[pending]`

**As a** Product Admin, **I want** Define monetization direction for Phase 3, **so that** Admin configures revenue model strategy for CAM.

**Acceptance criteria:**
  - **AC-030** — Monetization placeholder set
    - _Measurable:_ System configuration field accepts Q-1 decision value (SaaS/Transaction/Insights)

_Status: pending · Priority: open · Traces to: Q-1, VOC-2 · Pass: 0_

#### US-016-B-2 `[Tier B · pending]`

**As a** Architectural Strategy, **I want** Support Transaction revenue model architecture, **so that** System architecture supports transaction-based fee invoicing.

**Acceptance criteria:**
  - **AC-002** — System supports one-time transaction revenue entries.
    - _Measurable:_ Billing engine accepts and processes 'transaction' revenue_type for single job completions.

_Status: pending · Priority: critical · Tier: B · Traces to: VOC-2, COMP-15, Q-1 · Pass: 1_

_Decomposition rationale:_ Transaction-based fees require immediate processing and linkage to job completion events, distinct from subscription logic.

_Surfaced assumptions:_ A-0047, A-0048, A-0049

##### FR-REV-1 `[Tier C · pending]`

**As a** Billing Engine, **I want** Detect and process job completion event to initiate one-time invoice generation, **so that** Invoice is created immediately upon job completion status change, without recurring schedule.

**Acceptance criteria:**
  - **AC-1.1** — Invoice record created within 5 seconds of job completion event.
    - _Measurable:_ INVOICE.created_at - WORKORDER.completed_at <= 5000 milliseconds

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-6, WF-3, COMP-15 · Pass: 2_

_Decomposition rationale:_ Distinguishes transaction revenue from subscription revenue by enforcing a synchronous, event-driven trigger instead of a recurring schedule definition. Prevents overlap with US-016-B-1.

_Surfaced assumptions:_ A-0235, A-0236

##### FR-REV-2 `[Tier C · pending]`

**As a** Data Model, **I want** Validate revenue type discriminator against schedule definitions, **so that** Transaction revenue entries cannot have an associated recurring schedule ID.

**Acceptance criteria:**
  - **AC-1.2** — Revenue type 'transaction' forbids linking to schedule definitions.
    - _Measurable:_ IF invoice.revenue_type == 'transaction' THEN schedule_id IS NULL

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-INVOICE, ENT-SCHEDULE-JOB, US-016-B-1 · Pass: 2_

_Decomposition rationale:_ Ensures data integrity between the one-time model and the recurring model (US-016-B-1). Prevents architectural drift by enforcing mutually exclusive states.

_Surfaced assumptions:_ A-0235, A-0236

##### FR-REV-3 `[Tier C · pending]`

**As a** Tax Service, **I want** Apply jurisdiction-specific tax calculation for each transaction invoice, **so that** Tax liability and amount calculated per transaction location at time of invoice.

**Acceptance criteria:**
  - **AC-1.3** — Tax amount reflects correct jurisdiction rates for job location.
    - _Measurable:_ INVOICE.total_tax == TAX_SERVICE.calculate(job_location)

_Status: pending · Priority: high · Tier: C · Traces to: COMP-15, A-0047, UJ-14 · Pass: 2_

_Decomposition rationale:_ Addresses COMP-15 compliance requirement. Differentiates from subscription model where tax might be calculated differently (e.g., prepaid vs per use).

_Surfaced assumptions:_ A-0235, A-0236

##### FR-REV-4 `[Tier D · atomic]`

**As a** Ledger Operator, **I want** Post balanced general ledger entry for transaction revenue, **so that** Journal entry persists with matching debit and credit for revenue recognition.

**Acceptance criteria:**
  - **AC-1.4** — Single journal entry balances debits and credits immediately.
    - _Measurable:_ sum(entry.debits) == sum(entry.credits) per transaction invoice

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-CLIENT-LEDGER, ENT-INVOICE · Pass: 2_

_Decomposition rationale:_ Leaf operation defining the atomic action of recording the financial impact of the transaction model on the database.

_Surfaced assumptions:_ A-0235, A-0236

#### US-016-B-1 `[downgraded]`

**As a** Architectural Strategy, **I want** Support SaaS Subscription revenue model architecture, **so that** System architecture supports recurring billing subscriptions.

**Acceptance criteria:**
  - **AC-001** — System stores and processes recurring subscription revenue records.
    - _Measurable:_ Billing engine accepts and processes 'subscription' revenue_type for recurring charges.

_Status: downgraded · Priority: critical · Traces to: VOC-2, WF-3, COMP-15 · Pass: 2_

##### US-016-B-1-1 `[Tier B · pending]`

**As a** Architectural Strategist, **I want** Commit to manage full subscription lifecycle (create, modify, cancel, pause), **so that** System maintains a persistent subscription state machine with durable transitions.

**Acceptance criteria:**
  - **AC-002** — Subscription state changes are recorded in audit log.
    - _Measurable:_ Every state transition (e.g., active -> paused) generates an ENT-AUDIT-LOG-ENTRY record at write time

_Status: pending · Priority: critical · Tier: B · Traces to: VOC-2, WF-3 · Pass: 2_

_Decomposition rationale:_ Defines the scope boundary for what the SaaS subscription model covers (lifecycle vs. one-off). This is a policy commitment distinct from implementation logic.

_Surfaced assumptions:_ A-0232, A-0233, A-0234

##### US-016-B-1-2 `[Tier C · pending]`

**As a** Billing Engineer, **I want** Implement daily pro-ration logic for mid-cycle subscription starts, **so that** Charges reflect actual active service days for partial month cycles.

**Acceptance criteria:**
  - **AC-003** — Proration formula yields zero charges for inactive days.
    - _Measurable:_ charge_amount === unit_price * (active_days / billing_period_days) for partial periods

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-PRICE-BOOK, COMP-15, WF-3 · Pass: 2_

_Decomposition rationale:_ Specific implementation strategy under the subscription architecture commitment. Determines how the system calculates recurring revenue value.

_Surfaced assumptions:_ A-0232, A-0233, A-0234

##### US-016-B-1-3 `[Tier C · pending]`

**As a** Accounting Compliance Lead, **I want** Post revenue recognition entries on invoice recognition date per GAAP, **so that** System records revenue in ledger when obligation is satisfied, not just at cash receipt.

**Acceptance criteria:**
  - **AC-004** — Ledger entry date matches contract performance obligation satisfaction.
    - _Measurable:_ journal_entry_post_date === effective_invoice_date AND sum(debits) === sum(credits)

_Status: pending · Priority: high · Tier: C · Traces to: COMP-5, ENT-CLIENT-LEDGER · Pass: 2_

_Decomposition rationale:_ Commits to a specific accounting treatment (Accrual) required by the strategy. This is an architectural choice with downstream consequences for the finance team.

_Surfaced assumptions:_ A-0232, A-0233, A-0234

##### US-016-B-1-4 `[Tier D · atomic]`

**As a** Billing Operator, **I want** Generate and queue recurring invoice for next cycle, **so that** Recurring invoice record created and status set to pending for payment processing.

**Acceptance criteria:**
  - **AC-005** — Recurring invoice exists in ledger with correct due date.
    - _Measurable:_ COUNT(INV) > 0 WHERE INV.subscription_id IS NOT NULL AND INV.status = 'pending' AND INV.due_date = next_birthday

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-3, ENT-INVOICE · Pass: 2_

_Decomposition rationale:_ Atomic action representing the recurring billing mechanism. This is a testable leaf operation that enforces the subscription revenue model strategy.

_Surfaced assumptions:_ A-0232, A-0233, A-0234

##### US-016-B-1-5 `[Tier C · pending]`

**As a** System Reliability Engineer, **I want** Automate payment failure retry queue with exponential backoff, **so that** System retries failed charges before triggering dunning notice, preserving subscription.

**Acceptance criteria:**
  - **AC-006** — Failed payments trigger retry job within 24 hours.
    - _Measurable:_ time_since_payment_failure_ms < 86400000 AND retry_count <= 3 BEFORE dunning_notice_sent

_Status: pending · Priority: high · Tier: C · Traces to: ENT-PAYMENT-TRANSACTION, ENT-NOTIFICATION, COMP-2 · Pass: 2_

_Decomposition rationale:_ Implementation commitment regarding reliability and dunning policy. This defines the behavior of the billing engine in failure scenarios, essential for SaaS revenue stability.

_Surfaced assumptions:_ A-0232, A-0233, A-0234

#### US-016-B-3 `[downgraded]`

**As a** Architectural Strategy, **I want** Support Insights data revenue model architecture, **so that** System architecture supports usage-based revenue tracking.

**Acceptance criteria:**
  - **AC-003** — System calculates and records revenue based on usage metrics.
    - _Measurable:_ Revenue calculation triggers upon metric snapshot generation and usage event log access.

_Status: downgraded · Priority: high · Traces to: VOC-2, WF-10, ENT-METRIC-SNAPSHOT · Pass: 2_

##### US-016-B-3-1 `[Tier B · pending]`

**As a** System Architect, **I want** Define Usage-Based Revenue Model boundaries relative to Subscription and Transaction models, **so that** The system distinguishes usage revenue logic from recurring billing and transaction fees to prevent double-counting..

**Acceptance criteria:**
  - **AC-003-1** — System differentiates revenue source tags at ingestion.
    - _Measurable:_ Every revenue record includes a source_type field with value usage that differs from subscription and transaction

_Status: pending · Priority: high · Tier: B · Traces to: ENT-METRIC-SNAPSHOT, US-016-B-1, US-016-B-2 · Pass: 2_

_Decomposition rationale:_ Before implementing calculation logic, the system must commit to how this revenue model is distinct from siblings B-1 and B-2, defining the scope boundaries.

_Surfaced assumptions:_ A-0237, A-0238

##### US-016-B-3-2 `[Tier C · pending]`

**As a** CAM operator, **I want** Trigger revenue calculation upon metric snapshot generation, **so that** Revenue is not calculated on read; it is calculated when the snapshot event occurs..

**Acceptance criteria:**
  - **AC-003-2** — Revenue job queue fires within 100ms of snapshot write.
    - _Measurable:_ timestamp(snapshot_write) + 0.1s >= timestamp(revenue_trigger_start)

_Status: pending · Priority: critical · Tier: C · Traces to: WF-10, ENT-METRIC-SNAPSHOT · Pass: 2_

_Decomposition rationale:_ The parent's AC explicitly states triggers upon metric snapshot generation; this becomes a concrete implementation constraint regarding latency and ordering.

_Surfaced assumptions:_ A-0237, A-0238

##### US-016-B-3-3 `[Tier C · pending]`

**As a** Database Engineer, **I want** Apply jurisdiction-specific usage rates to metric values, **so that** Revenue calculation incorporates local rates and tax rules for the region where usage occurred..

**Acceptance criteria:**
  - **AC-003-3** — Calculation result includes tax breakdown per region.
    - _Measurable:_ revenue_record.tax_breakdown.region_id matches event_location.region_id

_Status: pending · Priority: high · Tier: C · Traces to: COMP-15, COMP-7 · Pass: 2_

_Decomposition rationale:_ Tax compliance is a specific external authority requiring specific implementation logic per jurisdiction, binding the usage calculation to legal constraints.

_Surfaced assumptions:_ A-0237, A-0238

##### US-016-B-3-4 `[Tier C · pending]`

**As a** Database Engineer, **I want** Partition usage revenue ledger separate from subscription ledgers, **so that** Usage revenue persists in a dedicated ledger path to ensure isolation of metrics and billing logic..

**Acceptance criteria:**
  - **AC-003-4** — All usage revenue records reside in table partition usage_revenue.
    - _Measurable:_ SELECT COUNT(*) FROM revenue_ledger WHERE revenue_type=usage AND database_id!=subscription_db > 0

_Status: pending · Priority: high · Tier: C · Traces to: TECH-7, TECH-8 · Pass: 2_

_Decomposition rationale:_ Architectural choice to separate data paths for different revenue models with downstream performance consequences, enforced via schema design.

_Surfaced assumptions:_ A-0237, A-0238

### FR US-017 `[pending]`

**As a** System, **I want** Configure ARC (Architectural Request) automation, **so that** System determines if ARC decisions are automated or AI-assisted.

**Acceptance criteria:**
  - **AC-031** — Automation level set
    - _Measurable:_ Workflow logic flag indicates Q-2 decision (Auto/AI-Assisted)

_Status: pending · Priority: open · Traces to: Q-2, WF-5, VOC-9, COMP-4 · Pass: 0_

#### US-017-1.1 `[Tier B · pending]`

**As a** Policy Architect, **I want** Define eligibility strategy for fully automated ARC decision approval, **so that** Only requests meeting strict compliance criteria bypass human/AI review.

**Acceptance criteria:**
  - **AC-031** — System routes request to Auto path only if permit exists AND no violations.
    - _Measurable:_ permit_status === 'Active' AND violation_count === 0

_Status: pending · Priority: critical · Tier: B · Traces to: VOC-9, US-009 · Pass: 1_

_Decomposition rationale:_ Establishes the high-level policy boundary for automation scope, ruling out automation for unknown or flagged cases before implementation details are specified.

_Surfaced assumptions:_ A-0050, A-0051, A-0052

##### US-017-1.1.1 `[Tier C · pending]`

**As a** CAM operator, **I want** Validate external permit status for each ARC request against authoritative source, **so that** Permit record is retrieved with 'Active' status from Permit Status API or cached valid state.

**Acceptance criteria:**
  - **AC-031-01** — Permit status is validated before auto-path decision.
    - _Measurable:_ System returns true only if API call returns 200 and permit.status === 'Active'.

_Status: pending · Priority: critical · Tier: C · Traces to: VOC-9, US-017-2.1 · Pass: 2_

_Decomposition rationale:_ The eligibility strategy depends on the permit verification step; this child commits to that specific logic branch.

##### US-017-1.1.2 `[Tier C · pending]`

**As a** CAM operator, **I want** Aggregate and evaluate active violation flags for the community associated with the request, **so that** System confirms violation_count equals zero and no open compliance flags exist for the property.

**Acceptance criteria:**
  - **AC-031-02** — Violations are checked for the relevant community/asset before auto-path.
    - _Measurable:_ System returns true only if SUM(active_violations) === 0 AND NO OPEN_FLAG exists for the property_id in violation_registry.

_Status: pending · Priority: critical · Tier: C · Traces to: VOC-9, US-017-3.1 · Pass: 2_

_Decomposition rationale:_ This child commits to the violation aggregation step which is logically independent of permit status.

##### US-017-1.1.3 `[Tier C · pending]`

**As a** System, **I want** Route request to standard human review queue if either eligibility check fails, **so that** Request state transitions to 'Awaiting_Manual_Review' and is logged in the audit trail.

**Acceptance criteria:**
  - **AC-031-03** — Non-eligible requests are excluded from automation path and queued for review.
    - _Measurable:_ If permit_check === false OR violation_check === false THEN set request_status = 'Awaiting_Manual_Review' AND trigger WF-9.

_Status: pending · Priority: critical · Tier: C · Traces to: VOC-9, US-017-4.1 · Pass: 2_

_Decomposition rationale:_ This child defines the fallback behavior for the automation path to ensure compliance flags (COMP-13) are honoured as per sibling US-017-4.1.

#### US-017-2.1 `[Tier C · pending]`

**As a** Developer, **I want** Implement external Permit Status API verification step, **so that** System validates permit validity via API before enabling Auto path.

**Acceptance criteria:**
  - **AC-032** — Permit check returns success without timeout and valid data.
    - _Measurable:_ http_status_code === 200 AND permit_expiry_date > today

_Status: pending · Priority: high · Tier: C · Traces to: ENT-PERMIT, WF-5 · Pass: 1_

_Decomposition rationale:_ Translates the policy commitment into a concrete verification step, binding the system to an external data source and defining the data state requirement.

_Surfaced assumptions:_ A-0050, A-0051, A-0052

##### US-017-2.1.1 `[Tier D · atomic]`

**As a** API Client, **I want** Invoke external Permit Status API endpoint, **so that** HTTP request completed and response body received.

**Acceptance criteria:**
  - **AC-032-1** — HTTP status code returned is 200
    - _Measurable:_ response.status === 200

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-PERMIT, WF-5 · Pass: 2_

_Decomposition rationale:_ Atomic network interaction; foundational to the validation step. This is the first leaf operation of the integration.

_Surfaced assumptions:_ A-0169, A-0170

##### US-017-2.1.2 `[Tier D · atomic]`

**As a** Data Processor, **I want** Extract permit_expiry_date from API response, **so that** Expiry date value extracted and parsed from JSON.

**Acceptance criteria:**
  - **AC-032-2** — Response contains 'expiry_date' field in correct format
    - _Measurable:_ response.data.expiry_date !== null && isISO8601(response.data.expiry_date)

_Status: atomic · Priority: high · Tier: D · Traces to: ENT-PERMIT · Pass: 2_

_Decomposition rationale:_ Data extraction precedes business logic; atomic parsing action.

_Surfaced assumptions:_ A-0169, A-0170

##### US-017-2.1.3 `[Tier D · atomic]`

**As a** Business Logic, **I want** Compare permit_expiry_date against system timestamp, **so that** Permit validity boolean determined.

**Acceptance criteria:**
  - **AC-032-3** — Validity logic returns true only if expiry_date > current_time
    - _Measurable:_ permit_expiry_date > new Date().toISOString()

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-PERMIT · Pass: 2_

_Decomposition rationale:_ Core business logic enforcing the acceptance criteria of AC-032; atomic computation.

_Surfaced assumptions:_ A-0169, A-0170

##### US-017-2.1.4 `[Tier D · atomic]`

**As a** State Manager, **I want** Update Permit status record with validation result, **so that** Internal Permit record reflects current API validation status.

**Acceptance criteria:**
  - **AC-032-4** — Recorded status matches computed validity
    - _Measurable:_ db.row.status === computed_validity

_Status: atomic · Priority: high · Tier: D · Traces to: ENT-PERMIT · Pass: 2_

_Decomposition rationale:_ State mutation required to enable 'Auto path' decisions downstream; atomic persistence.

_Surfaced assumptions:_ A-0169, A-0170

##### US-017-2.1.5 `[Tier D · atomic]`

**As a** Auditor, **I want** Append validation event to system audit log, **so that** Event recorded with timestamp and actor for compliance.

**Acceptance criteria:**
  - **AC-032-5** — Audit log entry created successfully
    - _Measurable:_ audit_log.contains(entry) && entry.status === 'created'

_Status: atomic · Priority: medium · Tier: D · Traces to: ENT-AUDIT-LOG-ENTRY · Pass: 2_

_Decomposition rationale:_ Compliance requirement for traceability of API usage and validation results.

_Surfaced assumptions:_ A-0169, A-0170

#### US-017-3.1 `[Tier C · pending]`

**As a** Developer, **I want** Implement violation flag aggregation for decision logic, **so that** System blocks automation path if active violation flags exist.

**Acceptance criteria:**
  - **AC-033** — Violation lookup query returns empty set for eligible requests.
    - _Measurable:_ violations_list.length === 0

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-4, COMP-13 · Pass: 1_

_Decomposition rationale:_ Defines the negative constraint logic required to rule out automation for non-compliant cases, ensuring policy adherence before automation triggers.

_Surfaced assumptions:_ A-0050, A-0051, A-0052

##### US-017-3.1-1 `[Tier C · pending]`

**As a** Database Engineer, **I want** Query violations table to determine active status, **so that** Returns set of violation records associated with the target request.

**Acceptance criteria:**
  - **AC-034** — Query response time is under 200ms for standard index usage.
    - _Measurable:_ timestamp(response_end) - timestamp(query_start) <= 0.2s

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-13 · Pass: 2_

_Decomposition rationale:_ This is the foundational data retrieval step required before any logic decision; it commits to the specific data source and indexing requirement for the system to function correctly.

_Surfaced assumptions:_ A-0171, A-0172, A-0173

  - **US-017-3.1-1-1** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Filter violations by active status predicate, **so that** Returns only rows where status matches active definition (OPEN/PENDING).

    **Acceptance criteria:**
      - **AC-035** — Returned rows match 'active' predicate logic.
        - _Measurable:_ count(rows WHERE status IN ('OPEN','PENDING')) === count(returned_rows)

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-017-3.1-3 · Pass: 3_

    _Decomposition rationale:_ Implements the predicate defined in sibling US-017-3.1-3 by mapping status field values to the boolean 'active' state used in workflow logic.

    _Surfaced assumptions:_ A-0422, A-0423, A-0424
  - **US-017-3.1-1-2** `[Tier C · pending]`
    **As a** Database Engineer, **I want** Deploy composite index for query optimization, **so that** Query execution plan utilizes index covering without full table scan.

    **Acceptance criteria:**
      - **AC-036** — Response time remains under 200ms with index usage.
        - _Measurable:_ timestamp(response_end) - timestamp(query_start) <= 0.2s AND query_plan.index_usage === true

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-12 · Pass: 3_

    _Decomposition rationale:_ Performance AC binds architectural constraint. Index strategy is an implementation choice to satisfy the response time commitment.

    _Surfaced assumptions:_ A-0422, A-0423, A-0424
  - **US-017-3.1-1-3** `[Tier D · atomic]`
    **As a** System Operator, **I want** Validate request context association, **so that** Only violations matching request ID returned.

    **Acceptance criteria:**
      - **AC-037** — All returned violations are associated with the target request.
        - _Measurable:_ count(rows WHERE request_id === target_context.request_id) === total_rows

    _Status: atomic · Priority: high · Tier: D · Traces to: COMP-13, UJ-4 · Pass: 3_

    _Decomposition rationale:_ Ensures scope of 'target request' is enforced. Links violation data to the field workflow context where violations block execution.

    _Surfaced assumptions:_ A-0422, A-0423, A-0424
##### US-017-3.1-2 `[Tier C · pending]`

**As a** Workflow Engineer, **I want** Inject violation check into dispatch workflow branch, **so that** Workflow halts or routes to review if violations_list.length > 0.

**Acceptance criteria:**
  - **AC-035** — Dispatch workflow pauses execution pending violation check result.
    - _Measurable:_ Workflow state changes to 'WAITING_ON_COMPLIANCE' for 2s if violations found

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-13 · Pass: 2_

_Decomposition rationale:_ This implements the specific blocking behavior promised in the parent requirement, committing to the integration point within the durable workflow engine (DBOS).

_Surfaced assumptions:_ A-0171, A-0172, A-0173

  - **US-017-3.1-2.1** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Transition workflow state to 'WAITING_ON_COMPLIANCE', **so that** Workflow execution is paused at the current state machine step.

    **Acceptance criteria:**
      - **AC-001** — Workflow state field equals 'WAITING_ON_COMPLIANCE'.
        - _Measurable:_ state === 'WAITING_ON_COMPLIANCE' at commit time

    _Status: atomic · Priority: critical · Tier: D · Traces to: COMP-13 · Pass: 3_

    _Decomposition rationale:_ Atomic state mutation action required to implement the pause requirement; no further decomposition needed as state value is an atomic enum.

    _Surfaced assumptions:_ A-0425, A-0426
  - **US-017-3.1-2.2** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Transition workflow state to 'ROUTED_TO_REVIEW', **so that** Workflow execution pauses and job is queued for manual review.

    **Acceptance criteria:**
      - **AC-002** — Workflow state field equals 'ROUTED_TO_REVIEW' and job is in review queue.
        - _Measurable:_ state === 'ROUTED_TO_REVIEW' && job_in_review_queue === true

    _Status: atomic · Priority: high · Tier: D · Traces to: COMP-13 · Pass: 3_

    _Decomposition rationale:_ Atomic state mutation action for the alternate branch when violations are present; distinct from the pause-only path.

    _Surfaced assumptions:_ A-0425, A-0426
  - **US-017-3.1-2.3** `[Tier C · pending]`
    **As a** Workflow Engineer, **I want** Enforce 2-second timeout for violation check wait, **so that** Workflow state changes back to 'READY' or proceeds to 'ROUTED_TO_REVIEW' after 2s if violations exist.

    **Acceptance criteria:**
      - **AC-003** — Workflow resumes or routes after exactly 2 seconds.
        - _Measurable:_ timestamp(commit) - timestamp(pause) <= 2s

    _Status: pending · Priority: high · Tier: C · Traces to: COMP-13, US-017-3.1-1 · Pass: 3_

    _Decomposition rationale:_ Implementation choice on timeout duration; not a broad architectural rule but a specific system parameter for this workflow behavior.

    _Surfaced assumptions:_ A-0425, A-0426
  - **US-017-3.1-2.4** `[Tier C · pending]`
    **As a** Auditor, **I want** Log pause event to audit trail, **so that** Audit record created documenting state transition due to violation check.

    **Acceptance criteria:**
      - **AC-004** — Audit log entry contains 'WAITING_ON_COMPLIANCE' state and violation count.
        - _Measurable:_ exists(record in audit_logs WHERE event_type === 'STATE_CHANGE' AND state === 'WAITING_ON_COMPLIANCE')

    _Status: pending · Priority: critical · Tier: C · Traces to: COMP-17 · Pass: 3_

    _Decomposition rationale:_ Compliance requirement to record state transitions; implements audit trail enforcement for this workflow branch.

    _Surfaced assumptions:_ A-0425, A-0426
##### US-017-3.1-3 `[Tier C · pending]`

**As a** Logic Engineer, **I want** Define active violation state predicate, **so that** A violation is considered 'active' if status is 'OPEN' or 'PENDING' and not 'RESOLVED'.

**Acceptance criteria:**
  - **AC-036** — Only non-resolved violations trigger the block.
    - _Measurable:_ Query WHERE status IN ('OPEN', 'PENDING')

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-4 · Pass: 2_

_Decomposition rationale:_ This defines the domain logic for determining 'active' status, which is a specific implementation choice required to translate the vague term 'active violation' into database operations.

_Surfaced assumptions:_ A-0171, A-0172, A-0173

  - **US-017-3.1-3.1** `[Tier C · pending]`
    **As a** database_query, **I want** Implement status filter logic for active violations, **so that** Only records with status in the active list are returned.

    **Acceptance criteria:**
      - **AC-001** — Query returns only active violation records.
        - _Measurable:_ result.status IN ('OPEN', 'PENDING') for every row returned

    _Status: pending · Priority: critical · Tier: C · Traces to: US-017-3.1-1, COMP-13 · Pass: 3_

    _Decomposition rationale:_ This child decomposes the predicate into the specific SQL filter logic required to query the table (referenced in sibling US-017-3.1-1).

    _Surfaced assumptions:_ A-0427, A-0428
  - **US-017-3.1-3.2** `[Tier C · pending]`
    **As a** data_schema, **I want** Define and enforce allowed status values, **so that** System treats only defined status values as valid for predicate logic.

    **Acceptance criteria:**
      - **AC-002** — Status field rejects invalid values or treats them as non-active.
        - _Measurable:_ status must match a value in the set ('OPEN', 'PENDING', 'RESOLVED') to be processed

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-VIOLATION, US-017-3.1-1 · Pass: 3_

    _Decomposition rationale:_ Defines the constraint on the ENT-VIOLATION entity status field to prevent logic errors from undefined states.

    _Surfaced assumptions:_ A-0427, A-0428
  - **US-017-3.1-3.3** `[Tier C · pending]`
    **As a** workflow_integration, **I want** Inject blocking logic into dispatch workflow, **so that** Workflow halts job scheduling if active violations exist.

    **Acceptance criteria:**
      - **AC-003** — Dispatch workflow pauses if active violation count > 0.
        - _Measurable:_ WF-8 (Permit and Code Compliance Check) returns block state when active_violations_count > 0

    _Status: pending · Priority: critical · Tier: C · Traces to: US-017-3.1-2, WF-8, COMP-13 · Pass: 3_

    _Decomposition rationale:_ Connects the predicate logic to the specific workflow (dispatch) that executes the blocking action, as committed in sibling US-017-3.1-2.

    _Surfaced assumptions:_ A-0427, A-0428
#### US-017-4.1 `[Tier D · atomic]`

**As a** System, **I want** Persist automation configuration flag to database, **so that** New configuration state is durable and retrievable.

**Acceptance criteria:**
  - **AC-034** — Write operation commits and returns success status.
    - _Measurable:_ db_transaction.status === 'committed'

_Status: atomic · Priority: high · Tier: D · Traces to: ENT-ARC-REQUEST · Pass: 1_

_Decomposition rationale:_ Atomic implementation choice that finalizes the configuration, defining the persistence mechanism for the system state.

_Surfaced assumptions:_ A-0050, A-0051, A-0052

### FR US-018 `[pending]`

**As a** Product Admin, **I want** Select initial marketplace onboarding strategy, **so that** Admin defines whether onboarding is direct or directory-partnered.

**Acceptance criteria:**
  - **AC-032** — Strategy configured
    - _Measurable:_ System accepts Q-3 decision (Direct/Partnership) for ENT-ONBOARDING-REQUEST flow

_Status: pending · Priority: open · Traces to: Q-3, ENT-ONBOARDING-REQUEST, WF-1, COMP-7 · Pass: 0_

#### US-018-1.1 `[Tier B · pending]`

**As a** Architectural commitment, **I want** Enable or disable directory-partner integration capability, **so that** System behavior switches between internal application intake and external directory ingestion.

**Acceptance criteria:**
  - **AC-032-C1** — System flag distinguishes between 'Direct' and 'Partner' marketplace modes.
    - _Measurable:_ config.marketplace_mode IN ('Direct', 'Partner')

_Status: pending · Priority: critical · Tier: B · Traces to: Q-3, ENT-ONBOARDING-REQUEST · Pass: 1_

_Decomposition rationale:_ This is the foundational policy commitment that dictates the system's entry-point logic for provider acquisition, defining the scope of the marketplace model.

_Surfaced assumptions:_ A-0053, A-0054

##### US-018-1.1.1 `[Tier C · pending]`

**As a** Config Manager, **I want** Persist marketplace mode toggle state per tenant, **so that** System config object contains valid 'Direct' or 'Partner' enum value.

**Acceptance criteria:**
  - **AC-032-C2** — Config value persists across application restarts.
    - _Measurable:_ SELECT config.marketplace_mode FROM config WHERE tenant_id = $tenant_id returns one of 'Direct', 'Partner' at application boot

_Status: pending · Priority: high · Tier: C · Traces to: ENT-TENANT, WF-1 · Pass: 2_

_Decomposition rationale:_ Defines the storage mechanism for the architectural commitment; necessary for the routing logic in the sibling children to reference.

_Surfaced assumptions:_ A-0239, A-0240, A-0241

##### US-018-1.1.2 `[Tier C · pending]`

**As a** API Router, **I want** Determine source ingestion path based on current config flag, **so that** Incoming API request sent to internal intake or partner API gateway.

**Acceptance criteria:**
  - **AC-032-C3** — Routing logic returns correct destination service for incoming lead.
    - _Measurable:_ IF config.marketplace_mode == 'Direct' THEN route to Internal API ELSE route to Partner Gateway

_Status: pending · Priority: critical · Tier: C · Traces to: US-018-1.2, US-018-1.3 · Pass: 2_

_Decomposition rationale:_ Binds the architectural choice to the specific execution paths defined in the sibling requirements (1.2 manual, 1.3 partner).

_Surfaced assumptions:_ A-0239, A-0240, A-0241

##### US-018-1.1.3 `[Tier D · atomic]`

**As a** Audit Recorder, **I want** Create immutable log entry on mode toggle change, **so that** System records timestamp and operator for configuration state change.

**Acceptance criteria:**
  - **AC-032-C4** — Audit log entry created immediately upon admin update.
    - _Measurable:_ INSERT INTO audit_logs (tenant_id, entity='config', action='mode_change') completes within 500ms of admin request

_Status: atomic · Priority: high · Tier: D · Traces to: ENT-AUDIT-LOG-ENTRY, COMP-17 · Pass: 2_

_Decomposition rationale:_ Terminal operation ensuring compliance with audit trails for architectural changes; atomic action.

_Surfaced assumptions:_ A-0239, A-0240, A-0241

##### US-018-1.1.4 `[Tier C · pending]`

**As a** Data Integrity Guard, **I want** Validate existing lead data source metadata does not conflict with new mode, **so that** Existing leads retain original source metadata regardless of current mode setting.

**Acceptance criteria:**
  - **AC-032-C5** — Historical lead records remain queryable with original 'Partner' source flag.
    - _Measurable:_ SELECT lead.source_metadata FROM ENT-ONBOARDING-REQUEST WHERE lead_id = $id; -- Source flag must not be overwritten by current config.mode

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-1, COMP-17 · Pass: 2_

_Decomposition rationale:_ Ensures the architectural switch does not corrupt or delete historical data required for compliance verification.

_Surfaced assumptions:_ A-0239, A-0240, A-0241

#### US-018-1.2 `[Tier C · pending]`

**As a** Direct Onboarding Implementation, **I want** Handle manual provider application submissions via Admin portal, **so that** New provider records created in `ENT-ONBOARDING-REQUEST` with direct source metadata.

**Acceptance criteria:**
  - **AC-032-C2** — Direct applications persist to the onboarding request entity.
    - _Measurable:_ ENT-ONBOARDING-REQUEST.source = 'Direct' AND status = 'Pending'

_Status: pending · Priority: high · Tier: C · Traces to: WF-1 · Pass: 1_

_Decomposition rationale:_ Specific implementation path when the architecture is committed to direct onboarding, realizing the workflow WF-1 for direct providers.

_Surfaced assumptions:_ A-0053, A-0054

##### US-018-1.2-01 `[Tier D · atomic]`

**As a** Data Validator, **I want** Validate manual form input against schema before persistence, **so that** Submission is rejected or accepted based on schema compliance.

**Acceptance criteria:**
  - **AC-001** — Invalid submissions trigger a schema validation error response.
    - _Measurable:_ SubmitRequest with missing required fields returns 400 Bad Request with error message containing field validation failures.

_Status: atomic · Priority: critical · Tier: D · Traces to: US-018-1.1 · Pass: 2_

_Decomposition rationale:_ Input validation is the atomic gatekeeper ensuring data quality before any persistence or workflow initiation.

_Surfaced assumptions:_ A-0174, A-0175, A-0176

##### US-018-1.2-02 `[Tier D · atomic]`

**As a** Record Writer, **I want** Persist submission to ENT-ONBOARDING-REQUEST entity with source metadata, **so that** Row is inserted into ONBOARDING-REQUEST with source='Direct'.

**Acceptance criteria:**
  - **AC-002** — Record exists in entity with correct source identifier immediately after successful submission.
    - _Measurable:_ Query ENT-ONBOARDING-REQUEST by submission_id returns row where source = 'Direct'.

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-1, US-018-1.1 · Pass: 2_

_Decomposition rationale:_ Persistence is the atomic action that fulfills the 'New provider records created' outcome specified in the parent requirement.

_Surfaced assumptions:_ A-0174, A-0175, A-0176

##### US-018-1.2-03 `[Tier D · atomic]`

**As a** State Manager, **I want** Initialize workflow status to Pending upon creation, **so that** Record status is set to 'Pending' immediately after save.

**Acceptance criteria:**
  - **AC-003** — New records for direct applications have a status of 'Pending' by default.
    - _Measurable:_ New row in ENT-ONBOARDING-REQUEST satisfies status = 'Pending' check immediately after insert commit.

_Status: atomic · Priority: high · Tier: D · Traces to: WF-1, US-018-1.3 · Pass: 2_

_Decomposition rationale:_ State initialization is a distinct atomic operation required to route the submission into the correct workflow stage for manual processing.

_Surfaced assumptions:_ A-0174, A-0175, A-0176

##### US-018-1.2-04 `[Tier D · atomic]`

**As a** Auditor, **I want** Log submission event to immutable audit trail, **so that** An immutable log entry records the Admin user and timestamp of the manual submission.

**Acceptance criteria:**
  - **AC-004** — Submission event is recorded in the audit log immediately after persistence.
    - _Measurable:_ ENT-AUDIT-LOG-ENTRY contains entry with action='ManualSubmission' and userId matching Admin role.

_Status: atomic · Priority: high · Tier: D · Traces to: WF-1, US-018-1.4 · Pass: 2_

_Decomposition rationale:_ Audit logging is the atomic action ensuring compliance and traceability for manual administrative actions, distinct from the business logic of the submission.

_Surfaced assumptions:_ A-0174, A-0175, A-0176

#### US-018-1.3 `[Tier C · pending]`

**As a** Partner Directory Ingestion, **I want** Parse and normalize incoming lead data from directory partner API, **so that** Lead records created in `ENT-ONBOARDING-REQUEST` with partner source metadata.

**Acceptance criteria:**
  - **AC-032-C3** — Partner leads are stored with partner ID and standardized schema mapping.
    - _Measurable:_ ENT-ONBOARDING-REQUEST.source = 'Partner' AND partner_id IS NOT NULL

_Status: pending · Priority: high · Tier: C · Traces to: WF-1 · Pass: 1_

_Decomposition rationale:_ Specific implementation path when the architecture is committed to directory-partnered onboarding, realizing the workflow WF-1 for partner leads.

_Surfaced assumptions:_ A-0053, A-0054

##### US-018-1.3-1 `[Tier C · pending]`

**As a** CAM operator, **I want** Ingest partner lead payloads via HTTP POST with JSON body validation, **so that** System receives and validates raw JSON payloads against expected schema structure.

**Acceptance criteria:**
  - **AC-010** — Incoming JSON body is deserialized successfully.
    - _Measurable:_ JSON.parse(payload) returns valid object OR throws parse error

_Status: pending · Priority: critical · Tier: C · Traces to: WF-1 · Pass: 2_

_Decomposition rationale:_ Ingestion mechanism is an implementation commitment defining the transport protocol and validation strategy.

_Surfaced assumptions:_ A-0177, A-0178, A-0179, A-0180

  - **US-018-1.3-1.1** `[Tier C · pending]`
    **As a** Parser, **I want** Deserialize incoming JSON payload, **so that** Raw JSON text converted to in-memory object structure.

    **Acceptance criteria:**
      - **AC-101** — JSON parsing completes without exception
        - _Measurable:_ JSON.parse(payload) throws no error

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ First step in ingestion; deserialization must succeed for any subsequent validation to occur. This binds the system to a specific parsing strategy (JS/JSON.parse) rather than leaving the implementation open.

    _Surfaced assumptions:_ A-0429, A-0430, A-0431
  - **US-018-1.3-1.2** `[Tier C · pending]`
    **As a** Validator, **I want** Validate Content-Type header and Encoding, **so that** Request rejected if header is missing or encoding is invalid.

    **Acceptance criteria:**
      - **AC-102** — Content-Type header must be application/json
        - _Measurable:_ req.headers['content-type'] === 'application/json'
      - **AC-103** — Payload must be valid UTF-8
        - _Measurable:_ isValidUTF8(payload.buffer) === true

    _Status: pending · Priority: high · Tier: C · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ Transport integrity is a prerequisite for schema validation. Content-Type and Encoding are specific implementation constraints distinct from the schema structure itself.

    _Surfaced assumptions:_ A-0429, A-0430, A-0431
  - **US-018-1.3-1.3** `[Tier C · pending]`
    **As a** Guardian, **I want** Enforce Payload Size Limit, **so that** Large payloads blocked to prevent resource exhaustion.

    **Acceptance criteria:**
      - **AC-104** — Payload size does not exceed configured limit
        - _Measurable:_ request.body.size <= MAX_PAYLOAD_BYTES

    _Status: pending · Priority: high · Tier: C · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ Prevents DoS-style attacks or memory overflows at the ingestion layer. This is an implementation decision on resource boundaries.

    _Surfaced assumptions:_ A-0429, A-0430, A-0431
  - **US-018-1.3-1.4** `[Tier C · pending]`
    **As a** Verifier, **I want** Validate Schema Structure, **so that** Invalid field shapes or types trigger validation error.

    **Acceptance criteria:**
      - **AC-105** — All required fields match schema types
        - _Measurable:_ Zod.safeParse(schema)(parsedPayload).success === true

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ The core validation logic ensuring data integrity before downstream mapping (US-018-1.3-2). This is a specific engineering sub-strategy for data validation using a Zod schema.

    _Surfaced assumptions:_ A-0429, A-0430, A-0431
##### US-018-1.3-2 `[Tier C · pending]`

**As a** Data engineer, **I want** Map external source fields to canonical ENT-ONBOARDING-REQUEST schema, **so that** Partner IDs and lead details are transformed into internal standardized fields.

**Acceptance criteria:**
  - **AC-011** — External source fields are mapped to internal schema keys correctly.
    - _Measurable:_ source_partner_id IS NOT NULL AND source_fields_mapped_to_target_schema === true

_Status: pending · Priority: critical · Tier: C · Traces to: WF-1 · Pass: 2_

_Decomposition rationale:_ Schema mapping logic is a specific implementation strategy under the normalization requirement.

_Surfaced assumptions:_ A-0177, A-0178, A-0179, A-0180

  - **US-018-1.3-2.1** `[Tier C · pending]`
    **As a** Data Engineer, **I want** Map partner identity fields (source_partner_id to partner_id), **so that** Unique partner identifier is correctly assigned from source to canonical schema.

    **Acceptance criteria:**
      - **AC-001** — Partner ID transformation succeeds for non-null sources.
        - _Measurable:_ target.partner_id === source_partner_id trimmed and upper-cased when source_partner_id is NOT NULL

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ Isolates identity mapping logic to ensure unique identification before persistence or normalization.

    _Surfaced assumptions:_ A-0432
  - **US-018-1.3-2.2** `[Tier C · pending]`
    **As a** Data Engineer, **I want** Map structural lead information fields to canonical schema keys, **so that** Name, company, and contact metadata are mapped to corresponding schema fields.

    **Acceptance criteria:**
      - **AC-002** — Source contact metadata populates target fields for non-null values.
        - _Measurable:_ target.lead_name == source.contact_name AND target.company_name == source.company_name

    _Status: pending · Priority: high · Tier: C · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ Separates structural field routing from value normalization (Tier 4 sibling) to clarify data flow boundaries.

    _Surfaced assumptions:_ A-0432
  - **US-018-1.3-2.3** `[Tier C · pending]`
    **As a** Data Engineer, **I want** Map temporal and audit metadata fields to schema timestamps, **so that** Source timestamps are preserved in the target schema's audit fields.

    **Acceptance criteria:**
      - **AC-003** — Source timestamps are copied to target created_at fields.
        - _Measurable:_ target.created_at === source.timestamp_epoch

    _Status: pending · Priority: medium · Tier: C · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ Ensures audit trail integrity by mapping temporal data before persistence.

    _Surfaced assumptions:_ A-0432
##### US-018-1.3-3 `[Tier D · atomic]`

**As a** System, **I want** Persist validated lead record into ENT-ONBOARDING-REQUEST table, **so that** Single lead record is stored in the database with partner metadata attached.

**Acceptance criteria:**
  - **AC-012** — Record persists to database with correct schema.
    - _Measurable:_ INSERT ENT-ONBOARDING-REQUEST returns 1 row affected AND commit succeeds

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-1 · Pass: 2_

_Decomposition rationale:_ Atomic persistence operation representing the terminal action of the ingestion workflow.

_Surfaced assumptions:_ A-0177, A-0178, A-0179, A-0180

##### US-018-1.3-4 `[Tier C · pending]`

**As a** Security engineer, **I want** Normalize PII fields (email, phone) before storage, **so that** Personally identifiable information is stored in a consistent, sanitized format.

**Acceptance criteria:**
  - **AC-013** — PII fields conform to normalization standards (e.g., lowercase email).
    - _Measurable:_ normalize_email(source_email) === record.email AND record.email IS NOT NULL

_Status: pending · Priority: high · Tier: C · Traces to: WF-1 · Pass: 2_

_Decomposition rationale:_ Data transformation rules for PII are concrete implementation commitments to ensure data quality and compliance.

_Surfaced assumptions:_ A-0177, A-0178, A-0179, A-0180

  - **US-018-1.3-4-1** `[Tier C · pending]`
    **As a** Implementation Decision, **I want** Convert all email address fields to lowercase prior to database insert, **so that** Storage contains only lowercase email strings regardless of input casing.

    **Acceptance criteria:**
      - **AC-013-1** — Persisted email matches input email in lowercase form
        - _Measurable:_ record.email === toLowerInvariant(source_email)

    _Status: pending · Priority: critical · Tier: C · Traces to: US-018-1.3-2, US-018-1.3-3, WF-1 · Pass: 3_

    _Decomposition rationale:_ Lowercase normalization is a standard email best practice that eliminates duplicate records caused by case variance; it is a direct implementation choice of the normalization policy.

    _Surfaced assumptions:_ A-0433, A-0434, A-0435
  - **US-018-1.3-4-2** `[Tier C · pending]`
    **As a** Implementation Decision, **I want** Format phone numbers using E.164 international standard, **so that** Phone numbers stored with country code and no special characters.

    **Acceptance criteria:**
      - **AC-013-2** — Stored phone string conforms to E.164 pattern
        - _Measurable:_ record.phone.matches(/^[\+][\d]{9,15}$/)

    _Status: pending · Priority: critical · Tier: C · Traces to: US-018-1.3-2, US-018-1.3-3, WF-1 · Pass: 3_

    _Decomposition rationale:_ E.164 is a named international standard for telephone numbers; adopting it ensures compatibility with external telephony systems and consistent storage.

    _Surfaced assumptions:_ A-0433, A-0434, A-0435
  - **US-018-1.3-4-3** `[Tier C · pending]`
    **As a** Implementation Decision, **I want** Validate email syntax against RFC 5322 before storage, **so that** Malformed email addresses are rejected during normalization process.

    **Acceptance criteria:**
      - **AC-013-3** — Email input matches RFC 5322 syntax rules
        - _Measurable:_ isValidRFC5322(record.email_source)

    _Status: pending · Priority: high · Tier: C · Traces to: US-018-1.3-5, WF-1 · Pass: 3_

    _Decomposition rationale:_ Syntax validation prevents storing invalid data that could break future lookups; this relies on an external standard (RFC 5322) for authority.

    _Surfaced assumptions:_ A-0433, A-0434, A-0435
  - **US-018-1.3-4-4** `[Tier C · pending]`
    **As a** Implementation Decision, **I want** Generate audit log entry for each normalization transformation, **so that** System records input value, output value, and timestamp for every normalized PII field.

    **Acceptance criteria:**
      - **AC-013-4** — Audit log entry exists for every normalized record
        - _Measurable:_ count(audit_logs) where action=='normalize_pii' === count(ingest_events)

    _Status: pending · Priority: medium · Tier: C · Traces to: US-018-1.3-3, WF-1 · Pass: 3_

    _Decomposition rationale:_ Security engineers require evidence of transformation to ensure compliance with audit requirements and verify the normalization happened correctly.

    _Surfaced assumptions:_ A-0433, A-0434, A-0435
##### US-018-1.3-5 `[Tier D · atomic]`

**As a** System, **I want** Reject payload on idempotency header conflict or missing partner ID, **so that** Malformed or duplicate payloads are discarded without creating a record.

**Acceptance criteria:**
  - **AC-014** — Invalid requests are rejected immediately.
    - _Measurable:_ if partner_id IS NULL OR exists(lead) THEN reject_request === true

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-1 · Pass: 2_

_Decomposition rationale:_ Atomic validation logic enforcing data integrity and preventing duplicates at the leaf level.

_Surfaced assumptions:_ A-0177, A-0178, A-0179, A-0180

##### US-018-1.3-6 `[Tier C · pending]`

**As a** Data engineer, **I want** Configure partner API endpoint connection with retry logic, **so that** Ingestion process handles temporary API failures via exponential backoff.

**Acceptance criteria:**
  - **AC-015** — Transient 5xx errors trigger retry sequence.
    - _Measurable:_ retry_count < max_retries AND status_code === 500 THEN trigger_retry

_Status: pending · Priority: high · Tier: C · Traces to: WF-1 · Pass: 2_

_Decomposition rationale:_ Connection handling strategy is a concrete architectural choice for reliability.

_Surfaced assumptions:_ A-0177, A-0178, A-0179, A-0180

  - **US-018-1.3-6.1** `[Tier C · pending]`
    **As a** Data engineer, **I want** Define exponential backoff parameters for retry sequence, **so that** System applies calculated delay before attempting subsequent retry.

    **Acceptance criteria:**
      - **AC-015.1** — Retry delay increases exponentially up to max limit.
        - _Measurable:_ delay_n >= initial_delay * multiplier^(n-1) for n < max_retries

    _Status: pending · Priority: critical · Tier: C · Traces to: US-018-1.3-6, WF-11 · Pass: 3_

    _Decomposition rationale:_ Specifics the math of the backoff strategy; a concrete implementation choice under the broader commitment to retry logic.

    _Surfaced assumptions:_ A-0436, A-0437
  - **US-018-1.3-6.2** `[Tier C · pending]`
    **As a** Data engineer, **I want** Classify transient HTTP status codes eligible for retry, **so that** Retry logic activates only for specific server errors and network timeouts.

    **Acceptance criteria:**
      - **AC-015.2** — Retry triggers for 5xx errors and network timeouts.
        - _Measurable:_ trigger_retry if status_code >= 500 AND status_code < 600 OR exception_in([ETIMEDOUT, ECONNRESET])

    _Status: pending · Priority: critical · Tier: C · Traces to: US-018-1.3-6, WF-11 · Pass: 3_

    _Decomposition rationale:_ Defines the boundary between transient and permanent failures, ensuring system does not retry on non-recoverable errors.

    _Surfaced assumptions:_ A-0436, A-0437
  - **US-018-1.3-6.3** `[Tier D · atomic]`
    **As a** System, **I want** Log retry attempt event to message queue, **so that** System maintains audit trail of all retry attempts for observability.

    **Acceptance criteria:**
      - **AC-015.3** — Every retry attempt is logged with timestamp and reason.
        - _Measurable:_ log_entry_created_at = current_timestamp() AND log_entry_reason = 'retry_attempt'

    _Status: atomic · Priority: high · Tier: D · Traces to: US-018-1.3-6, WF-11 · Pass: 3_

    _Decomposition rationale:_ Atomic logging action required to support compliance and debugging; distinct from the retry logic itself.

    _Surfaced assumptions:_ A-0436, A-0437
#### US-018-1.4 `[Tier C · pending]`

**As a** Licensing Verification Routing, **I want** Route license verification requests to internal or external sources based on mode, **so that** Provider license status validated against appropriate authority for the selected mode.

**Acceptance criteria:**
  - **AC-032-C4** — License check queries internal DB for Direct and API for Partner (or designated source).
    - _Measurable:_ verify_license(source_mode) returns boolean for provided entity_id

_Status: pending · Priority: critical · Tier: C · Traces to: WF-1, COMP-7 · Pass: 1_

_Decomposition rationale:_ Implementation of the compliance constraint COMP-7, ensuring the correct verification authority is queried based on the chosen strategy.

_Surfaced assumptions:_ A-0053, A-0054

##### US-018-1.4.1 `[Tier C · pending]`

**As a** Verification Engine, **I want** Execute internal DB query for Direct source verification, **so that** License status retrieved from internal records without external dependency.

**Acceptance criteria:**
  - **AC-032-D1** — Internal DB query returns valid license status for Direct entities.
    - _Measurable:_ internal_db.query(entity_id) returns boolean AND source_mode == 'Direct'

_Status: pending · Priority: critical · Tier: C · Traces to: WF-1, COMP-7 · Pass: 2_

_Decomposition rationale:_ Commits to using the internal database as the authoritative source for Direct providers, eliminating external latency for this path.

_Surfaced assumptions:_ A-0181, A-0182, A-0183

  - **FR-ACCT-1.4.1.1** `[Tier C · pending]`
    **As a** Query Execution Layer, **I want** Issue read-only SQL query against PostgreSQL `ENT-PROVIDER` table, **so that** Retrieve raw license status record for Direct entity.

    **Acceptance criteria:**
      - **AC-032-D1-1** — Query must execute against primary `ENT-PROVIDER` table, not views or fallback sources
        - _Measurable:_ SELECT source_table FROM query_plan WHERE query_source == 'internal' must return 'ENT-PROVIDER'

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-1, AC-032-D1 · Pass: 3_

    _Decomposition rationale:_ This child defines the specific database object and access path, binding the implementation to the primary storage engine. It rules out ad-hoc queries or temporary tables.

    _Surfaced assumptions:_ A-0438, A-0439
  - **FR-ACCT-1.4.1.2** `[Tier D · atomic]`
    **As a** Validation Logic Unit, **I want** Evaluate license expiry date against current system time, **so that** Determine boolean 'is_valid' status for Direct entities.

    **Acceptance criteria:**
      - **AC-032-D1-2** — License is only valid if expiry date is not in the past
        - _Measurable:_ record.license_expiry_date > Date.now() && record.status_field IS NOT NULL

    _Status: atomic · Priority: high · Tier: D · Traces to: WF-1, COMP-7 · Pass: 3_

    _Decomposition rationale:_ This is an atomic verification action. It transforms the raw database record into the system's verification state.

    _Surfaced assumptions:_ A-0438, A-0439
  - **FR-ACCT-1.4.1.3** `[Tier C · pending]`
    **As a** Security Enforcement Layer, **I want** Enforce Row-Level Security (RLS) policy on read request, **so that** Ensure user session permissions allow read access to specific tenant data.

    **Acceptance criteria:**
      - **AC-032-D1-3** — Query must fail if current session lacks tenant isolation rights
        - _Measurable:_ PG_RELSYS.check_row_access(user.session_id, record.tenant_id) === true

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-12, TECH-7 · Pass: 3_

    _Decomposition rationale:_ This child commits to the multi-tenant isolation mechanism (PostgreSQL RLS) required by security constraints, ensuring data leakage is prevented.

    _Surfaced assumptions:_ A-0438, A-0439
  - **FR-ACCT-1.4.1.4** `[Tier C · pending]`
    **As a** Compliance Audit Layer, **I want** Append immutable entry to `ENT-AUDIT-LOG-ENTRY` for query execution, **so that** Record who queried, when, and the result status for audit trails.

    **Acceptance criteria:**
      - **AC-032-D1-4** — Every read operation generates a log record
        - _Measurable:_ SELECT count(*) FROM audit_log WHERE event_type == 'license_query' AND result.status == 'success' must increment by 1 per request

    _Status: pending · Priority: medium · Tier: C · Traces to: COMP-17, AC-032-D1 · Pass: 3_

    _Decomposition rationale:_ This child binds the system to compliance obligations (audit trail creation). It ensures actions are recorded without affecting the primary business flow.

    _Surfaced assumptions:_ A-0438, A-0439
##### US-018-1.4.2 `[Tier C · pending]`

**As a** Integration Orchestrator, **I want** Execute external API call for Partner source verification, **so that** License status retrieved from designated partner authority via API.

**Acceptance criteria:**
  - **AC-032-D2** — External API call returns verified license status for Partner entities.
    - _Measurable:_ external_api.call(entity_id) returns boolean AND source_mode == 'Partner'

_Status: pending · Priority: critical · Tier: C · Traces to: WF-1, COMP-7 · Pass: 2_

_Decomposition rationale:_ Commits to routing Partner entities to external authorities, satisfying COMP-7 licensing requirements for designated sources.

_Surfaced assumptions:_ A-0181, A-0182, A-0183

  - **FR-ACCT-1.4.2.1** `[Tier C · pending]`
    **As a** Auth Manager, **I want** Establish and maintain secure session with Partner Authority endpoint, **so that** Validated connection token or OAuth handshake succeeds.

    **Acceptance criteria:**
      - **AC-001** — Valid session token obtained before request submission.
        - _Measurable:_ HTTP 401 or 403 is not returned due to auth failure for the duration of the call window

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ Connection management is a prerequisite for any API interaction; failure here blocks all verification attempts. This is an implementation choice regarding auth protocol.

    _Surfaced assumptions:_ A-0440, A-0441, A-0442
  - **FR-ACCT-1.4.2.2** `[Tier C · pending]`
    **As a** Data Engineer, **I want** Construct verification payload matching Partner API schema, **so that** JSON request body constructed and signed.

    **Acceptance criteria:**
      - **AC-002** — Request payload contains only required fields per Partner spec.
        - _Measurable:_ Payload structure matches Partner API OpenAPI spec version v1.2

    _Status: pending · Priority: high · Tier: C · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ Ensures the API call adheres to the external partner's specific data requirements, preventing protocol-level rejection.

    _Surfaced assumptions:_ A-0440, A-0441, A-0442
  - **FR-ACCT-1.4.2.3** `[Tier C · pending]`
    **As a** Integration Orchestrator, **I want** Transmit verification request to Partner API with timeout handling, **so that** HTTP response received or circuit breaker triggered.

    **Acceptance criteria:**
      - **AC-003** — Request completes within defined latency threshold.
        - _Measurable:_ Call duration does not exceed 3000ms before timeout trigger

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ Implements the time-bound constraint on external dependency interaction, necessary for workflow idempotency.

    _Surfaced assumptions:_ A-0440, A-0441, A-0442
  - **FR-ACCT-1.4.2.4** `[Tier D · atomic]`
    **As a** State Manager, **I want** Map external license status boolean to internal database field, **so that** ENT-PROVIDER-PROFILE license_verified field updated.

    **Acceptance criteria:**
      - **AC-004** — Internal status matches API boolean response.
        - _Measurable:_ ENT-PROVIDER-PROFILE.license_verified === parse(api_response.status)

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-1, COMP-7 · Pass: 3_

    _Decomposition rationale:_ Bridges the external source of truth to the internal data model, ensuring consistency for downstream workflows. This is an atomic state transition.

    _Surfaced assumptions:_ A-0440, A-0441, A-0442
  - **FR-ACCT-1.4.2.5** `[Tier C · pending]`
    **As a** Audit Logger, **I want** Log verification outcome and response headers for compliance, **so that** Immutability record created in ENT-AUDIT-LOG-ENTRY.

    **Acceptance criteria:**
      - **AC-005** — API response hash and timestamp recorded.
        - _Measurable:_ ENT-AUDIT-LOG-ENTRY contains SHA-256 of response body and request timestamp

    _Status: pending · Priority: high · Tier: C · Traces to: WF-1, COMP-7 · Pass: 3_

    _Decomposition rationale:_ Ensures audit trail for COMP-7 compliance and traceability of verification decisions, implementing specific logging policies.

    _Surfaced assumptions:_ A-0440, A-0441, A-0442
##### US-018-1.4.3 `[Tier C · pending]`

**As a** Mode Resolver, **I want** Determine source mode based on entity configuration, **so that** Verification path selected before query execution.

**Acceptance criteria:**
  - **AC-032-D3** — Mode resolution returns 'Direct' or 'Partner' based on entity attributes.
    - _Measurable:_ verify_mode(entity) returns one of ['Direct', 'Partner']

_Status: pending · Priority: high · Tier: C · Traces to: WF-1, COMP-7 · Pass: 2_

_Decomposition rationale:_ Defines the logic path selector that dictates which implementation commitment (Child 1 or Child 2) is executed.

_Surfaced assumptions:_ A-0181, A-0182, A-0183

  - **US-018-1.4.3.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Read ENT-PROVIDER internal status flag from database, **so that** Internal verification status is available for 'Direct' path.

    **Acceptance criteria:**
      - **AC-1** — System reads ENT-PROVIDER.internal_status attribute.
        - _Measurable:_ DB Query for ENT-PROVIDER returns non-null internal_status

    _Status: pending · Priority: high · Tier: C · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ Establishes the first input condition for the mode resolution logic; aligns with sibling US-018-1.4.1 internal DB query execution.

    _Surfaced assumptions:_ A-0443, A-0444, A-0445
  - **US-018-1.4.3.2** `[Tier C · pending]`
    **As a** CAM operator, **I want** Read ENT-PROVIDER external dependency status from cache, **so that** External API dependency status is available for 'Partner' path.

    **Acceptance criteria:**
      - **AC-2** — System reads ENT-PROVIDER.external_dependency_status attribute.
        - _Measurable:_ ENT-PROVIDER.external_dependency_status is populated from partner API cache

    _Status: pending · Priority: high · Tier: C · Traces to: COMP-7 · Pass: 3_

    _Decomposition rationale:_ Establishes the second input condition for the mode resolution logic; aligns with sibling US-018-1.4.2 external API call execution.

    _Surfaced assumptions:_ A-0443, A-0444, A-0445
  - **US-018-1.4.3.3** `[Tier C · pending]`
    **As a** CAM operator, **I want** Compute and return resolved mode string ('Direct' or 'Partner'), **so that** Single mode label returned to caller for query routing.

    **Acceptance criteria:**
      - **AC-3** — verify_mode(entity) returns exactly one of ['Direct', 'Partner']
        - _Measurable:_ Output string === 'Direct' | 'Partner'

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-1, US-018-1.4.1, US-018-1.4.2 · Pass: 3_

    _Decomposition rationale:_ Finalizes the decision logic; binds the two input checks into the final return value required by the parent AC.

    _Surfaced assumptions:_ A-0443, A-0444, A-0445
### FR US-019 `[pending]`

**As a** Product Admin, **I want** Define Hestami Staff operations scope, **so that** Admin selects support agent vs internal admin oversight.

**Acceptance criteria:**
  - **AC-033** — Staff scope defined
    - _Measurable:_ System accepts Q-4 decision (Remote/Internal)" for ENT-USER role definitions

_Status: pending · Priority: open · Traces to: Q-4, ENT-USER, WF-12, COMP-17 · Pass: 0_

#### US-019.1 `[Tier C · pending]`

**As a** Implementation Commitment, **I want** Configure Staff Role Types (Internal Admin vs Support Agent), **so that** System recognizes distinct role configurations for Internal Admin and Support Agent.

**Acceptance criteria:**
  - **AC-101** — Role type updated in system configuration.
    - _Measurable:_ Role type field in ENT-USER profile reflects 'Internal Admin' or 'Support Agent' value.

_Status: pending · Priority: critical · Tier: C · Traces to: Q-4, ENT-USER · Pass: 1_

_Decomposition rationale:_ This child commits the implementation to distinguish between the two role types, translating the functional scope into a concrete configuration task.

_Surfaced assumptions:_ A-0055, A-0056, A-0057, A-0058

##### US-019.1.1 `[Tier B · pending]`

**As a** Security Policy, **I want** Restrict write access to role configuration, **so that** Only designated administrative users can modify role type definitions.

**Acceptance criteria:**
  - **AC-102** — Non-admin user cannot update ENT-USER role_type field
    - _Measurable:_ Permission check returns false for non-admin roles attempting PUT to /users/{id}/role

_Status: pending · Priority: critical · Tier: B · Traces to: ENT-USER, ENT-ROLE · Pass: 2_

_Decomposition rationale:_ Security is a governing rule (Tier B) that must be defined before implementation. This establishes the authority boundary for the feature.

_Surfaced assumptions:_ A-0184, A-0185, A-0186

##### US-019.1.3 `[Tier C · pending]`

**As a** Data Persistence, **I want** Update ENT-USER profile with new role value, **so that** System row in ENT-USER table reflects new role_type at commit.

**Acceptance criteria:**
  - **AC-104** — Database commit succeeds with new value
    - _Measurable:_ SELECT role_type FROM ENT-USER WHERE id = X returns new value immediately after commit

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-USER, Q-4 · Pass: 2_

_Decomposition rationale:_ This is the core implementation mechanism (Tier C) for the configuration action, committing to specific data persistence behavior.

_Surfaced assumptions:_ A-0184, A-0185, A-0186

  - **US-019.1.3.1** `[Tier D · atomic]`
    **As a** Data Writer, **I want** Update ENT-USER.row with new role_type within active transaction, **so that** The specific row in the ENT-USER table is persisted with the new value.

    **Acceptance criteria:**
      - **AC-104-1** — Row contains updated role_type at commit time
        - _Measurable:_ SELECT role_type FROM ENT-USER WHERE id = X returns new value immediately after transaction commit

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-USER · Pass: 3_

    _Decomposition rationale:_ The atomic state mutation is the core functional unit of the persistence requirement; cannot be subdivided further without violating atomicity.

    _Surfaced assumptions:_ A-0446, A-0447
  - **US-019.1.3.2** `[Tier C · pending]`
    **As a** Transaction Manager, **I want** Enforce row-level locking on ENT-USER to prevent concurrent lost updates, **so that** No other update to the same row can succeed until the current transaction commits or rolls back.

    **Acceptance criteria:**
      - **AC-104-2** — Concurrent updates do not cause write skew or lost updates
        - _Measurable:_ Two simultaneous updates to the same user id result in only one committing or an error; no partial writes observed

    _Status: pending · Priority: high · Tier: C · Traces to: Q-4, ENT-USER · Pass: 3_

    _Decomposition rationale:_ To guarantee the 'immediate consistency' AC-104, specific locking strategy must be chosen; this commits to a technical constraint for concurrency safety.

    _Surfaced assumptions:_ A-0446, A-0447
  - **US-019.1.3.3** `[Tier D · atomic]`
    **As a** Audit Logger, **I want** Create immutable audit log entry for the role change event, **so that** An ENT-AUDIT-LOG-ENTRY record is written containing who, when, and what changed.

    **Acceptance criteria:**
      - **AC-104-3** — Audit record is immutable and persisted to audit storage
        - _Measurable:_ ENT-AUDIT-LOG-ENTRY exists and cannot be modified or deleted after creation

    _Status: atomic · Priority: high · Tier: D · Traces to: COMP-17, US-019.1.3.1 · Pass: 3_

    _Decomposition rationale:_ Requirement for immutable history is a compliance obligation (COMP-17); this is an atomic action triggered by the persistence event.

    _Surfaced assumptions:_ A-0446, A-0447
##### US-019.1.4 `[Tier C · pending]`

**As a** Session Management, **I want** Invalidate user sessions upon role change, **so that** Active authentication tokens are revoked when role is modified.

**Acceptance criteria:**
  - **AC-105** — Active sessions fail on next request after role update
    - _Measurable:_ Session token used in request returns 401 Unauthorized after role_type change event triggers cache invalidation

_Status: pending · Priority: high · Tier: C · Traces to: ENT-SESSION, US-019.3 · Pass: 2_

_Decomposition rationale:_ This is a specific implementation consequence (Tier C) required to maintain security posture when role boundaries change, linked to the audit sibling US-019.3.

_Surfaced assumptions:_ A-0184, A-0185, A-0186

  - **US-019.1.4.1** `[Tier D · atomic]`
    **As a** Session Store Operator, **I want** Update ENT-SESSION record status to 'REVOKED' in the persistent store, **so that** The session record is marked as invalid and cannot be used for future auth checks.

    **Acceptance criteria:**
      - **AC-001** — ENT-SESSION row status reflects revocation.
        - _Measurable:_ SELECT status FROM ENT-SESSION WHERE session_id = 'X' AND user_id = 'Y' returns 'REVOKED' within 50ms of trigger event

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-019.1.4, WF-12 · Pass: 3_

    _Decomposition rationale:_ Directly implements the requirement to revoke active authentication tokens by persistently marking the session as invalid.

    _Surfaced assumptions:_ A-0448, A-0449, A-0450
  - **US-019.1.4.2** `[Tier D · atomic]`
    **As a** Cache Operator, **I want** Delete session cache entry associated with the invalid session ID, **so that** No stale token exists in the application cache layer to bypass the database check.

    **Acceptance criteria:**
      - **AC-002** — Cache lookup fails for revoked token.
        - _Measurable:_ GET /session/{id} for a revoked ID returns 404 or invalid hash in Redis/SeaweedFS

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-019.1.4, TECH-8 · Pass: 3_

    _Decomposition rationale:_ Ensures the immediate failure of tokens by clearing the fast-path cache used by Better-Auth and oRPC.

    _Surfaced assumptions:_ A-0448, A-0449, A-0450
  - **US-019.1.4.3** `[Tier D · atomic]`
    **As a** Session Manager, **I want** Send logout signal to active client connections, **so that** Active mobile or web clients are disconnected immediately.

    **Acceptance criteria:**
      - **AC-003** — Client receives invalidation notice.
        - _Measurable:_ WebSocket/Service Worker receives 'logout' event or refresh token is rejected within 100ms of backend update

    _Status: atomic · Priority: high · Tier: D · Traces to: US-019.1.4, WF-2 · Pass: 3_

    _Decomposition rationale:_ Mitigates user session hijacking by ensuring connected clients (P-1, P-6) are logged out immediately.

    _Surfaced assumptions:_ A-0448, A-0449, A-0450
  - **US-019.1.4.4** `[Tier D · atomic]`
    **As a** Audit Logger, **I want** Append immutable record to ENT-AUDIT-LOG-ENTRY table, **so that** System action is recorded for compliance and forensic analysis.

    **Acceptance criteria:**
      - **AC-004** — Audit entry created for every session revocation event.
        - _Measurable:_ SELECT COUNT(*) FROM ENT-AUDIT-LOG-ENTRY WHERE action = 'SESSION_REVOKED' AND timestamp > NOW()-interval '1 minute' equals the number of role change events in that period

    _Status: atomic · Priority: medium · Tier: D · Traces to: US-019.1.4, WF-13, COMP-17 · Pass: 3_

    _Decomposition rationale:_ Complies with the mandate for complete, auditable history of all actions regardless of user role.

    _Surfaced assumptions:_ A-0448, A-0449, A-0450
##### US-019.1.2 `[deferred]`

**As a** Validation Logic, **I want** Validate role type against allowed enum, **so that** System rejects updates that do not match 'Internal Admin' or 'Support Agent'.

**Acceptance criteria:**
  - **AC-103** — Input validation blocks invalid role strings
    - _Measurable:_ Request with role_type not in ['Internal Admin', 'Support Agent'] returns 400 Bad Request

_Status: deferred · Priority: high · Traces to: ENT-USER, ENT-ROLE · Pass: 3_

#### US-019.2 `[Tier C · pending]`

**As a** Implementation Commitment, **I want** Enforce Role Scope Access Boundaries, **so that** System restricts administrative actions based on assigned role scope.

**Acceptance criteria:**
  - **AC-102** — Unauthorized role access is blocked.
    - _Measurable:_ Request to perform Admin action by Support Agent role returns HTTP 403 Forbidden.

_Status: pending · Priority: critical · Tier: C · Traces to: WF-12, COMP-17 · Pass: 1_

_Decomposition rationale:_ This child binds the architectural commitment to the actual access control enforcement mechanism, ensuring data isolation (WF-12) is respected by roles.

_Surfaced assumptions:_ A-0055, A-0056, A-0057, A-0058

##### US-019.2.1 `[Tier C · pending]`

**As a** Authorization Strategy, **I want** Apply Row Level Security (RLS) policies at the PostgreSQL layer for all data queries, **so that** SQL queries return no data rows if the current session's role lacks permission for the target resource.

**Acceptance criteria:**
  - **AC-01** — No rows are returned for queries restricted by RLS policy.
    - _Measurable:_ SELECT COUNT(*) > 0 fails when RLS policy denies access for the session user ID.

_Status: pending · Priority: critical · Tier: C · Traces to: WF-12 · Pass: 2_

_Decomposition rationale:_ RLS is the primary defense-in-depth mechanism for tenant isolation and role enforcement as defined in WF-12; this child specifies the architectural layer where the boundary is enforced.

_Surfaced assumptions:_ A-0187, A-0188

  - **US-019.2.1.C.1** `[Tier C · pending]`
    **As a** Database Security Engineer, **I want** Bind session user identity to the database role context, **so that** The PostgreSQL session executes with role information derived from the authentication token.

    **Acceptance criteria:**
      - **AC-01-RLS** — Query execution plan includes role-based filtering logic
        - _Measurable:_ explain ANALYZE SELECT * FROM tenant_data WHERE tenant_id = 1; contains 'RLS' or 'security_label' filter expressions

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-12 · Pass: 3_

    _Decomposition rationale:_ This child defines the mechanism for providing the database with the necessary context to apply policies; without this, the RLS policies cannot function correctly.

    _Surfaced assumptions:_ A-0451, A-0452
  - **US-019.2.1.C.2** `[Tier C · pending]`
    **As a** Schema Administrator, **I want** Define `CREATE POLICY` statements on tenant-owned data tables, **so that** Every tenant data table has a valid, active RLS policy attached to its definition.

    **Acceptance criteria:**
      - **AC-02-RLS** — RLS policies are valid PostgreSQL syntax and are attached to target tables
        - _Measurable:_ pg_policies table contains an entry for each tenant-owned table with a non-null `role` column

    _Status: pending · Priority: high · Tier: C · Traces to: WF-12 · Pass: 3_

    _Decomposition rationale:_ This child commits to the specific implementation of the security boundary (the policy statements themselves) as a concrete implementation choice.

    _Surfaced assumptions:_ A-0451, A-0452
  - **US-019.2.1.C.3** `[Tier C · pending]`
    **As a** Database Architect, **I want** Filter policy application to resource types defined in tenant schema, **so that** RLS policies are not applied to system metadata tables or public system functions.

    **Acceptance criteria:**
      - **AC-03-RLS** — Policies are scoped to schema objects with a tenant identifier
        - _Measurable:_ SELECT schemaname, tablename FROM pg_tables WHERE security_label IS NOT NULL; returns only tenant-owned objects

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-12 · Pass: 3_

    _Decomposition rationale:_ This child defines the scope of the RLS commitment, ensuring we don't accidentally lock out system access or apply policies to the wrong objects.

    _Surfaced assumptions:_ A-0451, A-0452
##### US-019.2.2 `[Tier D · atomic]`

**As a** API Enforcement, **I want** Evaluate Role Scope Claims against Resource Requirements in the Authorization Engine before business logic execution, **so that** Request is blocked immediately if the user token claims do not satisfy the resource's role scope definition.

**Acceptance criteria:**
  - **AC-02** — Request returns 403 Forbidden if Role Scope does not match Resource Requirement.
    - _Measurable:_ HTTP Status Code 403 is returned by the API Gateway or Auth Engine when TokenClaims[Role] does not satisfy Resource.Requirement[Scope].

_Status: atomic · Priority: critical · Tier: D · Traces to: US-019.1, COMP-17 · Pass: 2_

_Decomposition rationale:_ This is the leaf operation for access decision making. It binds to the sibling role configuration (US-019.1) and the audit requirement (COMP-17) which expects a record of the denial decision.

_Surfaced assumptions:_ A-0187, A-0188

##### US-019.2.3 `[Tier D · atomic]`

**As a** Audit Logging, **I want** Append immutable denial event to the Audit Log upon scope mismatch, **so that** System records an immutable audit entry for every failed scope check to satisfy COMP-17 compliance.

**Acceptance criteria:**
  - **AC-03** — A denied access event is persisted to the audit log.
    - _Measurable:_ ENT-AUDIT-LOG-ENTRY record exists with status 'DENIED' and timestamp matching the request.

_Status: atomic · Priority: high · Tier: D · Traces to: COMP-17 · Pass: 2_

_Decomposition rationale:_ This is the terminal leaf for the compliance obligation. It ensures that the 'Complete, auditable history' (COMP-17) is fulfilled for all enforcement attempts.

_Surfaced assumptions:_ A-0187, A-0188

#### US-019.3 `[Tier D · atomic]`

**As a** Leaf Operation, **I want** Create Audit Entry for Role Scope Change, **so that** Immutable record of role definition modification is created.

**Acceptance criteria:**
  - **AC-103** — Audit log entry exists for scope change.
    - _Measurable:_ New record in ENT-AUDIT-LOG-ENTRY with unique ID matching the change event.

_Status: atomic · Priority: critical · Tier: D · Traces to: COMP-17, WF-12 · Pass: 1_

_Decomposition rationale:_ This child represents the atomic verification action required to satisfy compliance requirements (COMP-17) for all changes.

_Surfaced assumptions:_ A-0055, A-0056, A-0057, A-0058

### FR US-020 `[pending]`

**As a** System, **I want** Enforce license and insurance verification, **so that** System prevents invalid vendor operations.

**Acceptance criteria:**
  - **AC-034** — License check active
    - _Measurable:_ ENT-PROVIDER profile blocks work dispatch if license expired or invalid

_Status: pending · Priority: critical · Traces to: COMP-1, COMP-7, COMP-8, ENT-PROVIDER-PROFILE · Pass: 0_

#### US-020-C1 `[Tier C · pending]`

**As a** Integration Engineer, **I want** Enforce synchronous or cached fetch of license/insurance status from external registry for every dispatch request, **so that** System retrieves valid status before authorizing field dispatch.

**Acceptance criteria:**
  - **AC-001** — Verification API response is consumed and cached prior to workflow execution.
    - _Measurable:_ Request to ENT-EXTERNAL-SOURCE completes within 2000ms or valid cache hit is used for WF-2

_Status: pending · Priority: critical · Tier: C · Traces to: WF-2, WF-11, COMP-1, COMP-7 · Pass: 1_

_Decomposition rationale:_ Decomposes the policy into an architectural choice: how to handle external data verification. This commits to a specific data dependency strategy (TECH-11 Sync Cycle).

_Surfaced assumptions:_ A-0059, A-0060

##### US-020-C1-1 `[Tier C · pending]`

**As a** Backend Engineer, **I want** Configure Redis cache for external registry responses with 5-minute TTL, **so that** Subsequent dispatch requests utilize cached status to reduce external call latency.

**Acceptance criteria:**
  - **AC-001-1** — Cache hit returns data within 50ms.
    - _Measurable:_ response_time < 50ms when cache hit occurs for ENT-EXTERNAL-SOURCE

_Status: pending · Priority: high · Tier: C · Traces to: WF-2, WF-11, COMP-1, COMP-7 · Pass: 2_

_Decomposition rationale:_ Defines the specific caching mechanism (Redis/TTL) to ensure the 'cached fetch' option in the parent is technically actionable without violating latency SLAs.

_Surfaced assumptions:_ A-0189, A-0190

  - **US-020-C1-1.1** `[Tier C · pending]`
    **As a** Backend Engineer, **I want** Configure Redis TTL to 300 seconds for all cache entries, **so that** Cache entries expire automatically after 5 minutes.

    **Acceptance criteria:**
      - **AC-001-1-1** — Cache entry expiry is set to 300 seconds.
        - _Measurable:_ redis_key_expiry_seconds === 300

    _Status: pending · Priority: high · Tier: C · Traces to: WF-11, COMP-1 · Pass: 3_

    _Decomposition rationale:_ Defines the specific time-bounding strategy for the cache to balance freshness and latency reduction.

    _Surfaced assumptions:_ A-0453, A-0454, A-0455
  - **US-020-C1-1.2** `[Tier C · pending]`
    **As a** Backend Engineer, **I want** Define cache key as 'ProviderID:LicenseType:Status', **so that** Unique keys prevent cross-licensing data leakage.

    **Acceptance criteria:**
      - **AC-001-1-2** — Cache key includes required identifiers.
        - _Measurable:_ key_pattern.includes("ProviderID") && key_pattern.includes("LicenseType")

    _Status: pending · Priority: critical · Tier: C · Traces to: COMP-7, ENT-EXTERNAL-SOURCE, A-0190 · Pass: 3_

    _Decomposition rationale:_ Implements the constraint on data isolation for different provider licenses defined in existing assumptions.

    _Surfaced assumptions:_ A-0453, A-0454, A-0455
  - **US-020-C1-1.3** `[Tier D · atomic]`
    **As a** QA Engineer, **I want** Verify cache hit response time under load, **so that** System delivers cached response within 50ms.

    **Acceptance criteria:**
      - **AC-001-1-3** — Response time for cache hit stays within 50ms.
        - _Measurable:_ response_time_ms < 50 AND status === 'CACHE_HIT'

    _Status: atomic · Priority: high · Tier: D · Traces to: WF-2, ENT-EXTERNAL-SOURCE · Pass: 3_

    _Decomposition rationale:_ Leaf operation verifying the primary user-facing performance metric defined in the parent AC.

    _Surfaced assumptions:_ A-0453, A-0454, A-0455
  - **US-020-C1-1.4** `[Tier C · pending]`
    **As a** Backend Engineer, **I want** Implement cache refresh on external status change, **so that** Stale cache entries are invalidated or updated.

    **Acceptance criteria:**
      - **AC-001-1-4** — New external status overwrites existing cache entry.
        - _Measurable:_ cache_overwrite_allowed === true

    _Status: pending · Priority: medium · Tier: C · Traces to: WF-2, WF-11, US-020-C1-2 · Pass: 3_

    _Decomposition rationale:_ Defines the behavior for cache miss updates to ensure data accuracy when external source returns fresh data.

    _Surfaced assumptions:_ A-0453, A-0454, A-0455
##### US-020-C1-2 `[Tier C · pending]`

**As a** Integration Engineer, **I want** Issue synchronous GET request to external registry when cache miss, **so that** System retrieves fresh status directly before dispatch workflow initiates.

**Acceptance criteria:**
  - **AC-001-2** — Direct API call completes or times out within 2000ms.
    - _Measurable:_ request_completed OR request_timeout < 2000ms for ENT-EXTERNAL-SOURCE call path

_Status: pending · Priority: critical · Tier: C · Traces to: WF-2, WF-11, COMP-1, COMP-7 · Pass: 2_

_Decomposition rationale:_ Implements the 'synchronous fetch' alternative from the parent requirement to handle cache misses or TTL expiration, adhering to the parent's AC-001.

_Surfaced assumptions:_ A-0189, A-0190

  - **FR-US020C12-D01** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Validate local cache for expiration, **so that** Identifies whether a local cache hit is available or a fresh fetch is required.

    **Acceptance criteria:**
      - **AC-001** — Cache lookup returns MISS or expired timestamp.
        - _Measurable:_ read(cache.key) === false OR (now() - cache.ttl) > 300

    _Status: atomic · Priority: high · Tier: D · Traces to: US-020-C1-1 · Pass: 3_

    _Decomposition rationale:_ Identifies the trigger condition for the parent flow; relates to sibling US-020-C1-1 which configures the cache.

    _Surfaced assumptions:_ A-0456, A-0457, A-0458
  - **FR-US020C12-D02** `[Tier D · atomic]`
    **As a** Integration Engineer, **I want** Construct and initiate HTTP GET to registry, **so that** External API request is initiated towards ENT-EXTERNAL-SOURCE.

    **Acceptance criteria:**
      - **AC-002** — HTTP request is sent with valid auth headers.
        - _Measurable:_ http_request.method === 'GET' AND http_request.url === registry_endpoint

    _Status: atomic · Priority: high · Tier: D · Traces to: WF-11, WF-2 · Pass: 3_

    _Decomposition rationale:_ The core action of the parent requirement; traces to the External API Sync Cycle (WF-11) and Job Dispatch (WF-2).

    _Surfaced assumptions:_ A-0456, A-0457, A-0458
  - **FR-US020C12-C01** `[Tier C · pending]`
    **As a** System Policy, **I want** Enforce synchronous timeout budget, **so that** System ensures request does not exceed 2000ms total duration.

    **Acceptance criteria:**
      - **AC-003** — Request execution aborted if duration exceeds 2000ms.
        - _Measurable:_ request_duration <= 2000 OR timeout_error_logged === true

    _Status: pending · Priority: critical · Tier: C · Traces to: COMP-7, COMP-1 · Pass: 3_

    _Decomposition rationale:_ This is a specific implementation constraint (timeout logic) that governs how the external call is handled, directly impacting compliance with licensing deadlines (COMP-7).

    _Surfaced assumptions:_ A-0456, A-0457, A-0458
  - **FR-US020C12-D03** `[Tier D · atomic]`
    **As a** System Operator, **I want** Parse and map external registry response, **so that** External status is transformed into internal system state.

    **Acceptance criteria:**
      - **AC-004** — External status 'ACTIVE' maps to internal license state 'VERIFIED'.
        - _Measurable:_ external_status === 'ACTIVE' implies internal_status === 'VERIFIED'

    _Status: atomic · Priority: high · Tier: D · Traces to: COMP-1, WF-2 · Pass: 3_

    _Decomposition rationale:_ Transforms the raw API response into actionable system state for the dispatch workflow.

    _Surfaced assumptions:_ A-0456, A-0457, A-0458
##### US-020-C1-3 `[Tier D · atomic]`

**As a** Workflow Engine, **I want** Reject Work Order dispatch if verification fails after 3 retries, **so that** Field dispatch request remains in 'pending' state; system logs rejection reason.

**Acceptance criteria:**
  - **AC-001-3** — Dispatch is blocked immediately on persistent verification failure.
    - _Measurable:_ WF-2 status transitions to 'rejection_pending' when API returns invalid status after 3 attempts

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-2, WF-11, US-020-C2, COMP-13 · Pass: 2_

_Decomposition rationale:_ This is a leaf operation (Tier D) that enforces the business rule defined in sibling US-020-C2. It is atomic and testable without further breakdown.

_Surfaced assumptions:_ A-0189, A-0190

##### US-020-C1-4 `[Tier C · pending]`

**As a** Audit Log Writer, **I want** Persist external verification result hash to audit log, **so that** Immutable record exists proving license status was checked at time of dispatch attempt.

**Acceptance criteria:**
  - **AC-001-4** — Audit entry contains timestamp and API response code.
    - _Measurable:_ ENT-AUDIT-LOG-ENTRY count increases by 1 on every fetch attempt, storing response_code and timestamp

_Status: pending · Priority: medium · Tier: C · Traces to: WF-2, WF-11, COMP-17, COMP-10 · Pass: 2_

_Decomposition rationale:_ Compliance requirement to maintain audit trail of verification attempts, linking the fetch strategy to system integrity obligations.

_Surfaced assumptions:_ A-0189, A-0190

  - **US-020-C1-4.1** `[Tier D · atomic]`
    **As a** Audit Log Writer, **I want** Compute SHA-256 hash of API verification response, **so that** Cryptographic hash digest of verification result is generated.

    **Acceptance criteria:**
      - **AC-001-4.1** — Hash digest matches expected SHA-256 of response data
        - _Measurable:_ hash_value === sha256(response_body + timestamp)

    _Status: atomic · Priority: medium · Tier: D · Traces to: US-020-C1-4, WF-2, WF-11 · Pass: 3_

    _Decomposition rationale:_ Hash generation is the atomic cryptographic step required to create the immutable reference.

    _Surfaced assumptions:_ A-0459
  - **US-020-C1-4.2** `[Tier D · atomic]`
    **As a** Audit Log Writer, **I want** Persist audit log entry with timestamp and hash, **so that** Audit log record is created with required fields.

    **Acceptance criteria:**
      - **AC-001-4.2** — Entry is inserted into audit table
        - _Measurable:_ count(audit_table) increases by 1 on commit with fields response_code and timestamp

    _Status: atomic · Priority: high · Tier: D · Traces to: US-020-C1-4, WF-2, WF-11 · Pass: 3_

    _Decomposition rationale:_ Persistence is the atomic state change that makes the record visible and auditable.

    _Surfaced assumptions:_ A-0459
  - **US-020-C1-4.3** `[Tier D · atomic]`
    **As a** Audit Log Writer, **I want** Enforce append-only constraint on audit storage, **so that** Record is prevented from modification or deletion.

    **Acceptance criteria:**
      - **AC-001-4.3** — No UPDATE/DELETE allowed on audit log row
        - _Measurable:_ database transaction fails if UPDATE/DELETE attempted on audit_log_id

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-020-C1-4, WF-2, WF-11, COMP-17 · Pass: 3_

    _Decomposition rationale:_ Constraint enforcement is the atomic mechanism that prevents retroactive modification.

    _Surfaced assumptions:_ A-0459
#### US-020-C2 `[Tier C · pending]`

**As a** Workflow Engineer, **I want** Configure state machine guard that rejects 'pending' to 'dispatched' transition on verification failure, **so that** Work Order remains in pending state if compliance check returns false.

**Acceptance criteria:**
  - **AC-002** — Workflow state transition is blocked when status validation fails.
    - _Measurable:_ DBOS workflow state machine rejects WF-2 state change if ENT-PROVIDER-PROFILE.check_status == false

_Status: pending · Priority: critical · Tier: C · Traces to: WF-2, WF-8, COMP-11, COMP-12 · Pass: 1_

_Decomposition rationale:_ Translates the verification policy into a concrete state machine implementation (TECH-6 DBOS). This defines the specific logic enforcement point in the workflow.

_Surfaced assumptions:_ A-0059, A-0060

##### US-020-C2.1 `[Tier D · atomic]`

**As a** Leaf Operation, **I want** Reject WF-2 state transition from pending to dispatched when check_status is false, **so that** The Work Order remains in pending state; DBOS transition event fails..

**Acceptance criteria:**
  - **AC-02-1** — Workflow state change is rejected.
    - _Measurable:_ wf_transition_result === 'rejected' when ENT-PROVIDER-PROFILE.check_status === false and current_state === 'pending'

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-2, WF-8, COMP-11, COMP-12 · Pass: 2_

_Decomposition rationale:_ The parent requirement commits to a single atomic enforcement rule. The verification logic (reading status) and enforcement logic (rejecting state) form one indivisible guard condition testable at the workflow checkpoint. Splitting further would introduce implementation granularity beyond requirement scope.

_Surfaced assumptions:_ A-0191

#### US-020-C3 `[Tier C · pending]`

**As a** Frontend Engineer, **I want** Render validation error toast to provider on mobile/web app when verification fails, **so that** User sees 'License Expired' message and disabled submit button immediately.

**Acceptance criteria:**
  - **AC-003** — Validation error is visible and action disabled upon API failure.
    - _Measurable:_ SvelteKit component renders error banner with 'reason_code: LICENSE_EXPIRED' within 200ms of API failure response

_Status: pending · Priority: high · Tier: C · Traces to: UJ-1, UJ-7, TECH-3, TECH-4 · Pass: 1_

_Decomposition rationale:_ Decomposes the enforcement requirement into the user-facing consequence. This binds the system behavior to user feedback expectations for mobile and web clients.

_Surfaced assumptions:_ A-0059, A-0060

##### FR-US-020-C3.1 `[Tier D · atomic]`

**As a** Frontend Engineer, **I want** Web component renders error toast banner on SvelteKit client, **so that** User sees 'License Expired' message on web interface.

**Acceptance criteria:**
  - **AC-003.1** — Banner renders within 200ms of API failure.
    - _Measurable:_ timestamp(banner_render) - timestamp(api_error) <= 200ms

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-1, UJ-7, TECH-3 · Pass: 2_

_Decomposition rationale:_ Isolate the specific web rendering implementation commitment under the SvelteKit constraint.

_Surfaced assumptions:_ A-0192, A-0193

##### FR-US-020-C3.2 `[Tier D · atomic]`

**As a** Mobile Engineer, **I want** Native client renders error toast banner on iOS/Android, **so that** User sees 'License Expired' message on mobile app.

**Acceptance criteria:**
  - **AC-003.2** — Banner renders within 200ms of API failure.
    - _Measurable:_ timestamp(banner_render) - timestamp(api_error) <= 200ms

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-1, UJ-7, TECH-4 · Pass: 2_

_Decomposition rationale:_ Isolate the specific mobile rendering implementation commitment under the Native constraint.

_Surfaced assumptions:_ A-0192, A-0193

##### FR-US-020-C3.3 `[Tier D · atomic]`

**As a** Frontend Engineer, **I want** Submit button is disabled on verification failure response, **so that** User cannot proceed with submission during failed state.

**Acceptance criteria:**
  - **AC-003.3** — Button is disabled immediately upon failure.
    - _Measurable:_ button.disabled === true at time of error_response

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-1, UJ-7, TECH-3 · Pass: 2_

_Decomposition rationale:_ Commit to the specific form state change logic required to enforce the user interaction constraint.

_Surfaced assumptions:_ A-0192, A-0193

#### US-020-C4 `[Tier C · pending]`

**As a** Compliance Analyst, **I want** Configure jurisdiction-specific license check rules per state regulation in admin UI, **so that** System checks correct authority (State/County) for each provider's operating region.

**Acceptance criteria:**
  - **AC-004** — Providers in California must match CA license number format and state.
    - _Measurable:_ Admin config storage for ENT-PROVIDER-PROFILE enforces regex validation for state-specific license ID patterns

_Status: pending · Priority: high · Tier: C · Traces to: UJ-7, COMP-7, COMP-8 · Pass: 1_

_Decomposition rationale:_ Decomposes into data configuration logic. This commits to managing variable external standards (domain_regime) via internal configuration rather than hardcoding logic.

_Surfaced assumptions:_ A-0059, A-0060

##### US-020-C4.1 `[Tier C · pending]`

**As a** Admin Operator, **I want** Define schema columns for state and county jurisdiction metadata, **so that** Database records can store unique regulatory boundaries for each provider region.

**Acceptance criteria:**
  - **AC-020** — Rule records contain jurisdiction identifiers.
    - _Measurable:_ ENT-JURISDICTION-TABLE contains columns for state_code, county_code, and effective_date for every row.

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-7, ENT-PROVIDER-PROFILE · Pass: 2_

_Decomposition rationale:_ Before implementing logic, the data model must commit to how boundaries are stored; this binds the downstream validation logic.

_Surfaced assumptions:_ A-0194, A-0195, A-0196

  - **US-020-C4.1.1** `[Tier C · pending]`
    **As a** Data Model Architect, **I want** Define `state_code` column with FIPS-2 compliant length, **so that** Database enforces 2-character state code via schema constraint.

    **Acceptance criteria:**
      - **AC-020.1** — `state_code` column accepts exactly 2 characters.
        - _Measurable:_ INSERT INTO ENT_JURISDICTION-TABLE ... CHECK (LENGTH(state_code) = 2) succeeds only for 2-char strings

    _Status: pending · Priority: critical · Tier: C · Traces to: COMP-7, TECH-7 · Pass: 3_

    _Decomposition rationale:_ Distinguishes state from county granularity; binding to FIPS-2 ensures standardization against COMP-7 constraints.

    _Surfaced assumptions:_ A-0460, A-0461, A-0462
  - **US-020-C4.1.2** `[Tier C · pending]`
    **As a** Data Model Architect, **I want** Define `county_code` column with flexible jurisdiction granularity, **so that** Database supports variable-length county codes for jurisdictions with many counties.

    **Acceptance criteria:**
      - **AC-020.2** — `county_code` column supports variable length strings.
        - _Measurable:_ INSERT ... with VARCHAR(50) type succeeds for county codes up to 50 characters

    _Status: pending · Priority: high · Tier: C · Traces to: COMP-7, TECH-7 · Pass: 3_

    _Decomposition rationale:_ Accommodates complex county naming conventions (e.g., "Orange County, CA") and aligns with COMP-7 multi-regional support.

    _Surfaced assumptions:_ A-0460, A-0461, A-0462
  - **US-020-C4.1.3** `[Tier C · pending]`
    **As a** Data Model Architect, **I want** Define `effective_date` column with immutable timestamps, **so that** Rule validity periods are tracked accurately without timezone ambiguity.

    **Acceptance criteria:**
      - **AC-020.3** — `effective_date` column stores UTC timestamps.
        - _Measurable:_ System returns TIMESTAMP in UTC for all effective_date reads, with no NULL values

    _Status: pending · Priority: critical · Tier: C · Traces to: COMP-7, TECH-7 · Pass: 3_

    _Decomposition rationale:_ Ensures legal compliance tracking across timezones (UTC) and supports COMP-7 deadline enforcement logic.

    _Surfaced assumptions:_ A-0460, A-0461, A-0462
  - **US-020-C4.1.4** `[Tier C · pending]`
    **As a** Database Engineer, **I want** Create index on jurisdiction columns for query performance, **so that** Jurisdiction lookups on ENT_JURISDICTION-TABLE complete under 50ms.

    **Acceptance criteria:**
      - **AC-020.4** — Composite index exists on state_code, county_code.
        - _Measurable:_ EXPLAIN ANALYZE for query on these columns shows index usage, runtime <50ms

    _Status: pending · Priority: medium · Tier: C · Traces to: TECH-7 · Pass: 3_

    _Decomposition rationale:_ Supports high-volume jurisdiction queries for UJ-8 (Permit Compliance) and UJ-7 (Insurance) workflows.

    _Surfaced assumptions:_ A-0460, A-0461, A-0462
##### US-020-C4.2 `[Tier C · pending]`

**As a** Admin Operator, **I want** Implement regex validation engine for license number patterns, **so that** System rejects license entries that do not match the configured pattern for the region.

**Acceptance criteria:**
  - **AC-021** — Validation fails on non-matching strings.
    - _Measurable:_ Regex pattern stored in rule matches input string exactly or via defined wildcard substitution.

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-7, UJ-7 · Pass: 2_

_Decomposition rationale:_ The core technical commitment is the engine that applies the stored rules; this is a concrete implementation choice.

_Surfaced assumptions:_ A-0194, A-0195, A-0196

  - **US-020-C4.2.1** `[Tier C · pending]`
    **As a** Configuration Manager, **I want** Persist Region-Pattern mapping to database, **so that** Region-specific regex patterns are stored and retrievable for enforcement.

    **Acceptance criteria:**
      - **AC-021.1** — Admin can store a regex pattern for a region
        - _Measurable:_ A record in jurisdiction_rule_records contains a 'pattern' field indexed by 'region_id' at write time.

    _Status: pending · Priority: high · Tier: C · Traces to: US-020-C4.1, ENT-PROVIDER-PROFILE · Pass: 3_

    _Decomposition rationale:_ Defines the storage commitment for the engine's input data; requires a schema definition (C4.1) to be valid.

    _Surfaced assumptions:_ A-0463, A-0464, A-0465
  - **US-020-C4.2.2** `[Tier D · atomic]`
    **As a** Validation Engine, **I want** Execute regex match on license input, **so that** Request is rejected if input fails to match configured pattern.

    **Acceptance criteria:**
      - **AC-021.2** — System rejects entry on mismatch
        - _Measurable:_ HTTP 400 returned and entry not persisted when input string !== stored pattern for the active region.

    _Status: atomic · Priority: critical · Tier: D · Traces to: COMP-7, UJ-7 · Pass: 3_

    _Decomposition rationale:_ This is the atomic verification action the parent commits to; the system's primary behavioral consequence.

    _Surfaced assumptions:_ A-0463, A-0464, A-0465
  - **US-020-C4.2.3** `[Tier C · pending]`
    **As a** Error Handler, **I want** Generate validation error payload, **so that** User receives specific message indicating pattern mismatch.

    **Acceptance criteria:**
      - **AC-021.3** — Error body includes region identifier
        - _Measurable:_ Response body contains a 'region_name' field indicating which rule was violated.

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-7 · Pass: 3_

    _Decomposition rationale:_ Defines the communication contract for failure states; impacts user experience in UJ-7.

    _Surfaced assumptions:_ A-0463, A-0464, A-0465
  - **US-020-C4.2.4** `[Tier C · pending]`
    **As a** Fallback Manager, **I want** Enforce fail-closed stance on pattern load failure, **so that** System blocks saves if regex engine is unavailable or pattern missing.

    **Acceptance criteria:**
      - **AC-021.4** — Save operation blocked on missing pattern
        - _Measurable:_ Operation blocked if 'region_id' exists but 'pattern' is null or engine throws exception.

    _Status: pending · Priority: critical · Tier: C · Traces to: US-020-C4.4 · Pass: 3_

    _Decomposition rationale:_ Defines the consequence of the engine's failure, aligning with the fail-closed commitment of C4.4.

    _Surfaced assumptions:_ A-0463, A-0464, A-0465
##### US-020-C4.3 `[Tier D · atomic]`

**As a** Admin Operator, **I want** Create a single jurisdiction rule record via UI form submission, **so that** A new rule is persisted and immediately available for enforcement.

**Acceptance criteria:**
  - **AC-022** — Record creation succeeds with unique ID.
    - _Measurable:_ POST /admin/rules returns 201 status and record_id upon form submission.

_Status: atomic · Priority: high · Tier: D · Traces to: COMP-7, US-020-C3 · Pass: 2_

_Decomposition rationale:_ The administrative action to save a rule is an atomic operation testable by the UI interaction.

_Surfaced assumptions:_ A-0194, A-0195, A-0196

##### US-020-C4.4 `[Tier B · pending]`

**As a** System Designer, **I want** Commit to reject operations when jurisdiction rule is missing, **so that** System enforces a default 'fail-closed' stance on compliance authority.

**Acceptance criteria:**
  - **AC-023** — Provider blocked if no rule found for region.
    - _Measurable:_ Job dispatch workflow halts if ENT-JURISDICTION-TABLE returns empty for provider's region_id.

_Status: pending · Priority: critical · Tier: B · Traces to: COMP-7, COMP-13 · Pass: 2_

_Decomposition rationale:_ This defines the safety policy for unknown jurisdictions, a governing rule independent of implementation.

_Surfaced assumptions:_ A-0194, A-0195, A-0196

##### US-020-C4.5 `[Tier C · pending]`

**As a** Admin Operator, **I want** Audit log creation for jurisdiction rule modification, **so that** All changes to compliance rules are immutable and attributable.

**Acceptance criteria:**
  - **AC-024** — Change event is written to audit log.
    - _Measurable:_ ENT-AUDIT-LOG-ENTRY contains user_id, timestamp, and diff_hash for every rule update.

_Status: pending · Priority: high · Tier: C · Traces to: COMP-8, ENT-AUDIT-LOG-ENTRY · Pass: 2_

_Decomposition rationale:_ Compliance requirements dictate that configuration changes must be traceable; this binds to audit standards.

_Surfaced assumptions:_ A-0194, A-0195, A-0196

  - **US-020-C4.5-01** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Calculate diff_hash between previous and new rule state, **so that** A unique hash value representing the delta is computed and ready for storage.

    **Acceptance criteria:**
      - **AC-001** — The stored diff_hash matches the calculation of the difference between prior and current rule definitions.
        - _Measurable:_ hash(current_rule) XOR hash(previous_rule) === stored_diff_hash

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Hash calculation is a distinct technical operation required to satisfy the 'diff_hash' field in the AC; it validates state change integrity.

    _Surfaced assumptions:_ A-0466, A-0467, A-0468
  - **US-020-C4.5-02** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Capture current session user_id at write time, **so that** The audit entry is associated with the authenticated user who triggered the change.

    **Acceptance criteria:**
      - **AC-002** — The user_id field in the log entry matches the active session user.
        - _Measurable:_ log_entry.user_id === active_session.user_id

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-SESSION, ENT-USER · Pass: 3_

    _Decomposition rationale:_ Attribution requires binding the write event to the active session context; this is an atomic data capture step.

    _Surfaced assumptions:_ A-0466, A-0467, A-0468
  - **US-020-C4.5-03** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Persist log entry to immutable storage with timestamp, **so that** The entry is written to the audit table and becomes immediately visible in read queries.

    **Acceptance criteria:**
      - **AC-003** — The entry is successfully committed to the log table with current timestamp.
        - _Measurable:_ SELECT * FROM audit_logs WHERE id = new_id ORDER BY timestamp LIMIT 1

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-AUDIT-LOG-ENTRY, COMP-8 · Pass: 3_

    _Decomposition rationale:_ The final persistence step enforces immutability; this is the atomic I/O action that satisfies the core AC.

    _Surfaced assumptions:_ A-0466, A-0467, A-0468
##### US-020-C4.6 `[Tier A · pending]`

**As a** System Architect, **I want** Admin Configuration Sub-area: Regulatory Data Sourcing, **so that** System must source rule definitions from external authoritative bodies or internal registry.

**Acceptance criteria:**
  - **AC-025** — Rules are loaded before application runtime.
    - _Measurable:_ Admin dashboard is read-only until regulatory_rule_sync_job completes.

_Status: pending · Priority: medium · Tier: A · Traces to: WF-11 · Pass: 2_

_Decomposition rationale:_ This splits the functional area of 'Config' into data sourcing vs validation logic, requiring further decomposition or definition.

_Surfaced assumptions:_ A-0194, A-0195, A-0196

  - **US-020-C4.6.1** `[Tier B · pending]`
    **As a** Architectural Strategy, **I want** Commit to External API polling or webhook subscription for rule definitions from authoritative bodies., **so that** System ingests rule definitions from external sources before runtime..

    **Acceptance criteria:**
      - **AC-026** — System successfully establishes connection to defined external source.
        - _Measurable:_ Connection test succeeds for at least one external jurisdiction API endpoint at startup.

    _Status: pending · Priority: high · Tier: B · Traces to: WF-11 · Pass: 3_

    _Decomposition rationale:_ Establishes the primary ingestion mechanism; distinguishes from internal registry strategy to handle coverage and fallback scenarios.

    _Surfaced assumptions:_ A-0469, A-0470, A-0471
  - **US-020-C4.6.2** `[Tier B · pending]`
    **As a** Architectural Strategy, **I want** Commit to Internal Registry as fallback for jurisdictions without available external APIs., **so that** System permits manual or static persistence of rules when external sourcing is unavailable..

    **Acceptance criteria:**
      - **AC-027** — Internal registry rules are loadable by the sync process.
        - _Measurable:_ Rule records inserted into internal registry are readable by the startup loader.

    _Status: pending · Priority: high · Tier: B · Traces to: US-020-C4.6.1 · Pass: 3_

    _Decomposition rationale:_ Provides the fallback coverage required for regions lacking external data feeds; defines the boundary between external dependency and internal authority.

    _Surfaced assumptions:_ A-0469, A-0470, A-0471
  - **US-020-C4.6.3** `[Tier C · pending]`
    **As a** Implementation Commitment, **I want** Configure startup hook to trigger regulatory_rule_sync_job prior to application runtime initialization., **so that** Application state reflects loaded rules only; admin dashboard remains read-only until job finishes..

    **Acceptance criteria:**
      - **AC-025** — Admin dashboard is read-only until sync completes.
        - _Measurable:_ Dashboard read-only flag is true immediately after job start and false after job success.

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-11, US-020-C4.6.1, US-020-C4.6.2 · Pass: 3_

    _Decomposition rationale:_ Converts the pre-runtime loading policy (AC-025) into a concrete implementation sequence; binds the timing of data readiness to the job lifecycle.

    _Surfaced assumptions:_ A-0469, A-0470, A-0471
  - **US-020-C4.6.4** `[Tier C · pending]`
    **As a** Implementation Commitment, **I want** Validate incoming rule definitions against canonical schema before persistence to database., **so that** Only valid rules are stored; invalid rules trigger errors in sync job log..

    **Acceptance criteria:**
      - **AC-028** — Every persisted rule matches the canonical rule schema.
        - _Measurable:_ Schema validation function returns true for every row in the target table post-ingestion.

    _Status: pending · Priority: high · Tier: C · Traces to: US-020-C4.6.3, US-020-C4.1 · Pass: 3_

    _Decomposition rationale:_ Ensures data integrity of the sourced definitions; relies on sibling US-020-C4.1 for schema definition.

    _Surfaced assumptions:_ A-0469, A-0470, A-0471
### FR US-021 `[pending]`

**As a** System, **I want** Manage statutory deadlines and notice requirements, **so that** System alerts users before deadlines expire.

**Acceptance criteria:**
  - **AC-035** — Notice sent on deadline
    - _Measurable:_ Notification sent 48 hours before ENT-TENANT statutory deadline expiration

_Status: pending · Priority: critical · Traces to: COMP-2, COMP-3, COMP-23 · Pass: 0_

#### FR-DEADLINE-CALC-01 `[Tier C · pending]`

**As a** Calculation logic, **I want** Determine notice offset duration based on jurisdiction, **so that** System calculates deadline offset (e.g., 48h) correctly for the specific state law.

**Acceptance criteria:**
  - **AC-01** — Offset matches the applicable state statute.
    - _Measurable:_ deadline_offset_days === statutory_days_for_state[state_code]

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-2, COMP-3 · Pass: 1_

_Decomposition rationale:_ Defines the specific logic for handling variable statutory deadlines. This is an implementation commitment (Tier C) that concretizes the high-level compliance policy.

_Surfaced assumptions:_ A-0061, A-0062, A-0063, A-0064

##### FR-DEADLINE-CALC-01-C1 `[Tier C · pending]`

**As a** Implementation Strategy, **I want** Use an immutable lookup table for statutory notice period values., **so that** The system reads offset days from a configured source rather than hard-coding logic..

**Acceptance criteria:**
  - **AC-C1-01** — Statutory days are retrieved from the configured lookup table.
    - _Measurable:_ query(statutory_lookup, state_code) returns expected offset value

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-2, COMP-3 · Pass: 2_

_Decomposition rationale:_ Binding the calculation to a data store allows for compliance updates without code changes; this is a concrete architectural choice (Table vs. Algorithm).

_Surfaced assumptions:_ A-0197, A-0198, A-0199

  - **FR-DEADLINE-CALC-01-C1-1** `[Tier C · pending]`
    **As a** Backend Architect, **I want** Define PostgreSQL schema for statutory lookup table, **so that** Database stores offset data in a table with explicit columns for state code and offset value..

    **Acceptance criteria:**
      - **AC-1-01** — Table rejects duplicate state codes on insert.
        - _Measurable:_ INSERT INTO statutory_offsets (state_code, offset_days) fails with unique violation if state_code already exists

    _Status: pending · Priority: critical · Tier: C · Traces to: COMP-2, COMP-3, FR-DEADLINE-CALC-01-C1 · Pass: 3_

    _Decomposition rationale:_ Defines the physical storage implementation (schema) of the committed lookup table strategy, separating structural constraints from logic.

    _Surfaced assumptions:_ A-0472, A-0473, A-0474
  - **FR-DEADLINE-CALC-01-C1-2** `[Tier C · pending]`
    **As a** Compliance Engineer, **I want** Enforce immutability via versioning rather than direct updates, **so that** Changes to statutory values persist as new version records effective from a specific date..

    **Acceptance criteria:**
      - **AC-1-02** — Direct SQL UPDATE statements are prevented for the statutory offsets table.
        - _Measurable:_ Any attempt to UPDATE statutory_offsets returns application error 'IMMUTABLE_TABLE'

    _Status: pending · Priority: critical · Tier: C · Traces to: COMP-2, COMP-3, FR-DEADLINE-CALC-01-C1 · Pass: 3_

    _Decomposition rationale:_ Specific architectural choice to achieve immutability; prevents data loss and ensures auditability of statutory value changes.

    _Surfaced assumptions:_ A-0472, A-0473, A-0474
  - **FR-DEADLINE-CALC-01-C1-3** `[Tier C · pending]`
    **As a** Backend Architect, **I want** Index state_code for high-performance retrieval, **so that** Lookup queries complete within performance budget despite table immutability..

    **Acceptance criteria:**
      - **AC-1-03** — SELECT queries on state_code execute within 50ms.
        - _Measurable:_ SELECT * FROM statutory_offsets WHERE state_code = ? runs in under 50ms on 10 concurrent requests

    _Status: pending · Priority: high · Tier: C · Traces to: COMP-2, COMP-3, FR-DEADLINE-CALC-01-C1 · Pass: 3_

    _Decomposition rationale:_ Defines performance constraints required for the lookup table implementation to satisfy real-time deadline calculation needs.

    _Surfaced assumptions:_ A-0472, A-0473, A-0474
##### FR-DEADLINE-CALC-01-C2 `[Tier C · pending]`

**As a** Implementation Strategy, **I want** Calculate offset using the Work Order creation timestamp converted to UTC., **so that** Deadline calculation is consistent regardless of local server timezone drift..

**Acceptance criteria:**
  - **AC-C2-01** — The input timestamp is the record creation time, not the request time.
    - _Measurable:_ calculation_timestamp === work_order.created_at

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-2, COMP-4 · Pass: 2_

_Decomposition rationale:_ Ensures consistent time handling (VOC-23) across all tenants by standardizing on UTC for internal logic before applying local timezones if needed.

_Surfaced assumptions:_ A-0197, A-0198, A-0199

  - **FR-DEADLINE-CALC-01-C2-D1** `[Tier D · atomic]`
    **As a** Backend Service, **I want** Normalize timestamp to UTC epoch, **so that** Calculation input is standardized to UTC offset +00:00.

    **Acceptance criteria:**
      - **AC-D1-01** — Converted value has zero offset.
        - _Measurable:_ datetime.utc.isoformat() === true for calculation_timestamp before offset math

    _Status: atomic · Priority: critical · Tier: D · Traces to: COMP-2 · Pass: 3_

    _Decomposition rationale:_ This child isolates the timezone normalization step required to satisfy the system-wide consistency constraint (A-0064) before offset arithmetic is applied.

    _Surfaced assumptions:_ A-0475
  - **FR-DEADLINE-CALC-01-C2-D2** `[Tier D · atomic]`
    **As a** Data Persistence Layer, **I want** Persist UTC-normalized deadline, **so that** Deadline value stored in database matches UTC epoch.

    **Acceptance criteria:**
      - **AC-D2-01** — Stored deadline is UTC.
        - _Measurable:_ SELECT timezone FROM work_orders WHERE created_at = X ORDER BY deadline LIMIT 1 OFFSET 0

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-2 · Pass: 3_

    _Decomposition rationale:_ This child binds the persistence constraint to ensure the normalized UTC value is the canonical stored state, preventing timezone drift in the data store.

    _Surfaced assumptions:_ A-0475
##### FR-DEADLINE-CALC-01-C3 `[Tier C · pending]`

**As a** Implementation Strategy, **I want** Map Tenant record state_code to the Statutory Lookup key., **so that** The jurisdiction lookup is resolved using the Tenant entity..

**Acceptance criteria:**
  - **AC-C3-01** — Tenant state code is valid and present in the lookup table.
    - _Measurable:_ tenant.state_code IS NOT NULL AND EXISTS IN statutory_lookup

_Status: pending · Priority: critical · Tier: C · Traces to: FR-JURISDICTION-ID-02, ENT-TENANT · Pass: 2_

_Decomposition rationale:_ Enforces the dependency on jurisdiction resolution (FR-JURISDICTION-ID-02) as a prerequisite for this calculation.

_Surfaced assumptions:_ A-0197, A-0198, A-0199

  - **FR-DEADLINE-CALC-01-C3.1** `[Tier D · atomic]`
    **As a** Data validation operator, **I want** Read and validate Tenant state_code field against schema constraints, **so that** A valid, normalized state code string is available for lookup.

    **Acceptance criteria:**
      - **AC-C3-1-1** — Tenant state_code is non-null and matches expected format.
        - _Measurable:_ state_code IS NOT NULL AND LENGTH(state_code) = 2 AND state_code IN (SELECT value FROM valid_state_codes)

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-TENANT · Pass: 3_

    _Decomposition rationale:_ Before mapping to the statutory lookup, the input field must be validated to ensure it meets format requirements defined in A-0062, preventing lookup failures due to malformed data.

    _Surfaced assumptions:_ A-0476, A-0477
  - **FR-DEADLINE-CALC-01-C3.2** `[Tier D · atomic]`
    **As a** Lookup operator, **I want** Execute join query to resolve jurisdiction key from Statutory Lookup, **so that** A unique statutory jurisdiction key is retrieved or null is returned.

    **Acceptance criteria:**
      - **AC-C3-2-1** — Lookup returns exactly one jurisdiction key or indicates missing key.
        - _Measurable:_ SELECT COUNT(*) FROM statutory_lookup WHERE lookup_key = normalized_state_code <= 1

    _Status: atomic · Priority: critical · Tier: D · Traces to: FR-JURISDICTION-ID-02, FR-DEADLINE-CALC-01-C1 · Pass: 3_

    _Decomposition rationale:_ This child commits to the specific data access operation that realizes the mapping commitment; it references the immutable lookup table strategy defined in sibling C1.

    _Surfaced assumptions:_ A-0476, A-0477
  - **FR-DEADLINE-CALC-01-C3.3** `[Tier D · atomic]`
    **As a** Integration operator, **I want** Persist resolved jurisdiction key to Work Order record, **so that** The calculated jurisdiction is stored in the Work Order metadata.

    **Acceptance criteria:**
      - **AC-C3-3-1** — Jurisdiction key is stored in the Work Order record.
        - _Measurable:_ Work_order.jurisdiction_key = lookup_result_key

    _Status: atomic · Priority: medium · Tier: D · Traces to: ENT-WORK-ORDER, FR-DEADLINE-CALC-01-C2 · Pass: 3_

    _Decomposition rationale:_ The resolved jurisdiction must be captured in the downstream Work Order entity to be used in deadline calculations (C2) and compliance checks.

    _Surfaced assumptions:_ A-0476, A-0477
##### FR-DEADLINE-CALC-01-C4 `[Tier C · pending]`

**As a** Implementation Strategy, **I want** Default to 48 hours if state code is missing or statute undefined., **so that** System avoids failure when statutory data is unavailable, ensuring notices are still sent..

**Acceptance criteria:**
  - **AC-C4-01** — If statute not found, system uses default 48h offset.
    - _Measurable:_ IF (statute IS NULL) THEN offset === 48 ELSE offset === statute_days

_Status: pending · Priority: high · Tier: C · Traces to: ENT-NOTIFICATION, WF-9 · Pass: 2_

_Decomposition rationale:_ Handles edge cases for new tenants or jurisdictions without specific laws; ensures WCAG-like consistency and availability.

_Surfaced assumptions:_ A-0197, A-0198, A-0199

  - **FR-DEADLINE-CALC-01-C4.1** `[Tier D · atomic]`
    **As a** System, **I want** Persist default offset value of 48 hours to notification configuration., **so that** The system maintains a stored default offset of 48 hours..

    **Acceptance criteria:**
      - **AC-001** — System contains a stored value for default offset.
        - _Measurable:_ Configuration record DEFAULT_OFFSET_DAYS === 48

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-NOTIFICATION · Pass: 3_

    _Decomposition rationale:_ Establishes the data persistence mechanism for the default value required by the fallback logic.

    _Surfaced assumptions:_ A-0478, A-0479, A-0480
  - **FR-DEADLINE-CALC-01-C4.2** `[Tier D · atomic]`
    **As a** Workflow Engine, **I want** Evaluate statute existence before deadline calculation., **so that** Workflow determines if a valid statute exists for the jurisdiction..

    **Acceptance criteria:**
      - **AC-002** — System evaluates statute availability flag.
        - _Measurable:_ Statute availability check returns Boolean (true/false) before offset assignment

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-9 · Pass: 3_

    _Decomposition rationale:_ Defines the atomic branching logic condition required to trigger the fallback path.

    _Surfaced assumptions:_ A-0478, A-0479, A-0480
  - **FR-DEADLINE-CALC-01-C4.3** `[Tier D · atomic]`
    **As a** Calculation Logic, **I want** Assign default offset value to the notification workflow., **so that** Offset variable is set to 48 hours when statute is null..

    **Acceptance criteria:**
      - **AC-003** — Offset value equals 48 when statute is null.
        - _Measurable:_ When statute IS NULL, THEN offset === 48 ELSE offset === statute_days

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-9 · Pass: 3_

    _Decomposition rationale:_ Executes the core logic of the requirement by atomizing the conditional assignment.

    _Surfaced assumptions:_ A-0478, A-0479, A-0480
#### FR-JURISDICTION-ID-02 `[Tier C · pending]`

**As a** Context resolver, **I want** Resolve tenant location to applicable state jurisdiction, **so that** System maps Tenant record to the correct state code for compliance lookup.

**Acceptance criteria:**
  - **AC-02** — Jurisdiction code is retrieved on tenant load.
    - _Measurable:_ tenant.state_code !== null

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-23, ENT-TENANT · Pass: 1_

_Decomposition rationale:_ Determines which rules apply. Without this mapping, the system cannot select the correct notice period. This binds the system to specific state data requirements.

_Surfaced assumptions:_ A-0061, A-0062, A-0063, A-0064

##### FR-JUR-02-C1 `[Tier C · pending]`

**As a** CAM operator, **I want** Extract state code from tenant address field, **so that** System reads address state or extracts from zip code.

**Acceptance criteria:**
  - **AC-001** — Extracted code matches valid state abbreviation.
    - _Measurable:_ extracted_state === address.state OR extracted_state === lookup(address.zip)

_Status: pending · Priority: high · Tier: C · Traces to: ENT-TENANT, COMP-23, FR-DEADLINE-CALC-01 · Pass: 2_

_Decomposition rationale:_ Primary resolution strategy binds the data source; ensures we handle user-provided address data directly.

_Surfaced assumptions:_ A-0200, A-0201, A-0202

  - **FR-JUR-02-C1.1** `[Tier C · pending]`
    **As a** Data Normalization, **I want** Enforce primary source priority for state code extraction, **so that** System uses address.state field value when available.

    **Acceptance criteria:**
      - **AC-002** — System uses address.state value if present.
        - _Measurable:_ if address.state is not null AND matches regex ^[A-Z]{2}$, then extracted_state === address.state

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-JUR-02-C1, ENT-TENANT, COMP-23 · Pass: 3_

    _Decomposition rationale:_ Defines the primary path for data extraction to ensure performance and data integrity from the tenant record itself before attempting fallbacks.

    _Surfaced assumptions:_ A-0481, A-0482
  - **FR-JUR-02-C1.2** `[Tier C · pending]`
    **As a** Data Normalization, **I want** Perform zip-to-state lookup on missing primary, **so that** System resolves state code from address.zip using internal mapping.

    **Acceptance criteria:**
      - **AC-003** — System resolves state from zip code if primary is missing.
        - _Measurable:_ if address.state is null AND address.zip is present, then extracted_state === lookup(address.zip)

    _Status: pending · Priority: high · Tier: C · Traces to: FR-JUR-02-C1, ENT-TENANT, FR-DEADLINE-CALC-01 · Pass: 3_

    _Decomposition rationale:_ Defines the secondary path to ensure state resolution capability persists even when address state field is not populated by the upstream process.

    _Surfaced assumptions:_ A-0481, A-0482
  - **FR-JUR-02-C1.3** `[Tier C · pending]`
    **As a** Data Integrity, **I want** Validate extracted state code against canonical list, **so that** Final extracted_state is guaranteed to be a valid US state abbreviation.

    **Acceptance criteria:**
      - **AC-004** — Extracted state code is a valid US abbreviation.
        - _Measurable:_ extracted_state in allowed_state_codes_set

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-JUR-02-C1, ENT-TENANT, COMP-23 · Pass: 3_

    _Decomposition rationale:_ Ensures downstream jurisdictional logic (e.g., COMP-23, FR-DEADLINE-CALC-01) only receives valid codes, preventing errors in compliance checks.

    _Surfaced assumptions:_ A-0481, A-0482
##### FR-JUR-02-C2 `[Tier C · pending]`

**As a** CAM operator, **I want** Fallback to Admin Region setting, **so that** System defaults to Admin region if address missing.

**Acceptance criteria:**
  - **AC-002** — Admin region is used only when address is null or invalid.
    - _Measurable:_ if (address.state === null) THEN tenant.state_code === admin_region_field

_Status: pending · Priority: medium · Tier: C · Traces to: ENT-TENANT, COMP-23, FR-DEADLINE-CALC-01 · Pass: 2_

_Decomposition rationale:_ Secondary strategy handles incomplete user input; prevents service blocking for admins.

_Surfaced assumptions:_ A-0200, A-0201, A-0202

  - **FR-JUR-02-C2.1** `[Tier C · pending]`
    **As a** validation logic, **I want** determine if primary address state is null or invalid, **so that** Flag address state for fallback if condition met.

    **Acceptance criteria:**
      - **AC-003** — Fallback logic triggers when address.state is null or fails format check.
        - _Measurable:_ address.state === null OR (address.state.length === 0) OR regex(address.state) fails

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-TENANT, FR-JUR-02-C1 · Pass: 3_

    _Decomposition rationale:_ This child defines the condition precedent for the fallback strategy; it is a concrete implementation commitment regarding validation rules.

    _Surfaced assumptions:_ A-0483, A-0484, A-0485
  - **FR-JUR-02-C2.2** `[Tier C · pending]`
    **As a** fallback sourcing, **I want** read and normalize admin_region_field from tenant record, **so that** Admin region value is available for assignment.

    **Acceptance criteria:**
      - **AC-004** — System retrieves the configured Admin Region code without error.
        - _Measurable:_ admin_region_field.value EXISTS and admin_region_field.type IS 'STATE_CODE'

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-TENANT · Pass: 3_

    _Decomposition rationale:_ This child defines the implementation commitment for sourcing the fallback value; it commits to data availability and type safety.

    _Surfaced assumptions:_ A-0483, A-0484, A-0485
  - **FR-JUR-02-C2.3** `[Tier D · atomic]`
    **As a** operation, **I want** write resolved state code to tenant address record, **so that** Tenant record reflects the fallback state code.

    **Acceptance criteria:**
      - **AC-005** — Tenant address state_code updated immediately after resolution.
        - _Measurable:_ UPDATE tenants SET state_code = admin_region WHERE id = ? AND (state IS NULL OR state = '')

    _Status: atomic · Priority: high · Tier: D · Traces to: FR-JUR-02-D1 · Pass: 3_

    _Decomposition rationale:_ This is the atomic action resulting from the commitment; it is a testable leaf operation that persists the outcome.

    _Surfaced assumptions:_ A-0483, A-0484, A-0485
##### FR-JUR-02-D1 `[Tier D · atomic]`

**As a** Leaf operation, **I want** Persist resolved state code to tenant record, **so that** State code is stored in database.

**Acceptance criteria:**
  - **AC-003** — Tenant record contains valid 2-letter state code.
    - _Measurable:_ SELECT * FROM tenants WHERE state_code IS NULL AND updated_at > NOW()

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-TENANT, COMP-23, FR-DEADLINE-CALC-01, FR-AUDIT-LOG-04 · Pass: 2_

_Decomposition rationale:_ Terminal operation that finalizes the commitment; ensures data persists for downstream compliance checks.

_Surfaced assumptions:_ A-0200, A-0201, A-0202

#### FR-NOTIFY-TRIG-03 `[Tier D · atomic]`

**As a** Notification trigger, **I want** Queue notification message for delivery 48 hours prior, **so that** Message is placed in the delivery queue with timestamp.

**Acceptance criteria:**
  - **AC-03** — Notification entry created with scheduled timestamp.
    - _Measurable:_ notification.scheduled_time === now() + (48 * 60 * 60 * 1000)

_Status: atomic · Priority: high · Tier: D · Traces to: WF-9, ENT-NOTIFICATION · Pass: 1_

_Decomposition rationale:_ Atomic action of sending the alert. This is a leaf operation (Tier D) with testable delivery timing.

_Surfaced assumptions:_ A-0061, A-0062, A-0063, A-0064

#### FR-AUDIT-LOG-04 `[Tier C · pending]`

**As a** Compliance recorder, **I want** Log the notice generation and delivery attempt, **so that** Immutable audit record of notice event exists.

**Acceptance criteria:**
  - **AC-04** — Audit entry contains timestamp and actor ID.
    - _Measurable:_ audit_entry.timestamp !== null AND audit_entry.actor_id !== null

_Status: pending · Priority: high · Tier: C · Traces to: COMP-23, ENT-AUDIT-LOG-ENTRY · Pass: 1_

_Decomposition rationale:_ Ensures audit trail integrity required for compliance. This is an implementation choice (Tier C) to record state transitions.

_Surfaced assumptions:_ A-0061, A-0062, A-0063, A-0064

##### FR-AUDIT-LOG-04.1 `[Tier C · pending]`

**As a** CAM operator, **I want** Map notice event data to log entry schema, **so that** Log entry includes payload of the notice generation.

**Acceptance criteria:**
  - **AC-001** — Log entry payload is not null when notice is logged.
    - _Measurable:_ log_entry.payload !== null when notice_event is created

_Status: pending · Priority: high · Tier: C · Traces to: FR-NOTIFY-TRIG-03, ENT-AUDIT-LOG-ENTRY · Pass: 2_

_Decomposition rationale:_ Defines the specific content fields captured from the notice generation workflow (sibling FR-NOTIFY-TRIG-03) into the immutable record.

_Surfaced assumptions:_ A-0203

  - **FR-AUDIT-LOG-04.1.1** `[Tier C · pending]`
    **As a** Data Engineer, **I want** Normalize notice payload to audit schema version 1.0, **so that** System logs contain notice data structured according to the canonical audit schema.

    **Acceptance criteria:**
      - **AC-001-1** — Transformed payload matches canonical schema definition
        - _Measurable:_ JSON.stringify(log_entry.payload) === JSON.stringify(expected_audit_schema)

    _Status: pending · Priority: high · Tier: C · Traces to: FR-AUDIT-LOG-04.1, ENT-AUDIT-LOG-ENTRY, ENT-NOTIFICATION · Pass: 3_

    _Decomposition rationale:_ Defines the transformation logic required to bridge the raw notice event object to the immutable audit log schema.

    _Surfaced assumptions:_ A-0486, A-0487, A-0488
  - **FR-AUDIT-LOG-04.1.2** `[Tier D · atomic]`
    **As a** Validation Operator, **I want** Reject log write if payload is null, **so that** System refuses to persist an audit entry with missing notice payload.

    **Acceptance criteria:**
      - **AC-001-2** — Write fails when notice payload is missing
        - _Measurable:_ if (notice_event.payload === null) { reject() }

    _Status: atomic · Priority: critical · Tier: D · Traces to: FR-AUDIT-LOG-04.1, FR-AUDIT-LOG-04.3, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ This is a leaf verification operation ensuring data completeness before persistence, aligning with the parent's payload integrity goal.

    _Surfaced assumptions:_ A-0486, A-0487, A-0488
  - **FR-AUDIT-LOG-04.1.3** `[Tier C · pending]`
    **As a** Architect, **I want** Include source event identifiers in metadata, **so that** Audit entry links back to the originating notice event for traceability.

    **Acceptance criteria:**
      - **AC-001-3** — Metadata contains original notice ID
        - _Measurable:_ log_entry.metadata.notice_id === source_event_id

    _Status: pending · Priority: high · Tier: C · Traces to: FR-AUDIT-LOG-04.1, FR-AUDIT-LOG-04.2, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Commits to preserving the trace chain between the trigger event and the log entry, separating payload mapping from identity resolution.

    _Surfaced assumptions:_ A-0486, A-0487, A-0488
##### FR-AUDIT-LOG-04.2 `[Tier C · pending]`

**As a** CAM operator, **I want** Resolve actor identity from active session, **so that** Log entry actor_id matches the authenticated user's session.

**Acceptance criteria:**
  - **AC-002** — Actor ID corresponds to the current session user.
    - _Measurable:_ log_entry.actor_id === ENT-SESSION.user_id for the active session at commit time

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-SESSION, WF-13 · Pass: 2_

_Decomposition rationale:_ Ensures the actor recorded is the one performing the action. Relies on ENT-SESSION to provide the user identity.

_Surfaced assumptions:_ A-0203

  - **FR-AUDIT-LOG-04.2.1** `[Tier B · pending]`
    **As a** Scope Commitment, **I want** Bind audit identity resolution to the active session context, **so that** Audit entries identify users solely via session data, excluding external identity lookups.

    **Acceptance criteria:**
      - **AC-003** — No fallback to static user table lookup occurs for actor_id.
        - _Measurable:_ SELECT COUNT(*) FROM audit_logs WHERE actor_id_source = 'static_lookup' yields 0 at commit time

    _Status: pending · Priority: critical · Tier: B · Traces to: WF-13 · Pass: 3_

    _Decomposition rationale:_ Establishes the policy that the session is the canonical identity source, preventing ambiguity or data leakage via stale user lookups. This child defines the 'what' (scope policy) rather than the 'how'.

    _Surfaced assumptions:_ A-0489, A-0490
  - **FR-AUDIT-LOG-04.2.2** `[Tier C · pending]`
    **As a** Implementation Choice, **I want** Resolve user_id from session token payload, **so that** Actor ID value matches the 'user_id' or 'sub' claim extracted from the authentication session.

    **Acceptance criteria:**
      - **AC-004** — Resolved ID equals the session token claim.
        - _Measurable:_ extract_token.user_id === log_entry.actor_id

    _Status: pending · Priority: high · Tier: C · Traces to: TECH-10, ENT-SESSION · Pass: 3_

    _Decomposition rationale:_ Defines the specific technical mechanism (token claim extraction) under the Tier B policy. This is a technology-specific commitment required by the auth engine choice.

    _Surfaced assumptions:_ A-0489, A-0490
  - **FR-AUDIT-LOG-04.2.3** `[Tier D · atomic]`
    **As a** Leaf Operation, **I want** Persist resolved actor_id into the audit log record, **so that** The audit log entry is saved with the final actor_id value populated.

    **Acceptance criteria:**
      - **AC-005** — Log entry record contains the actor_id field.
        - _Measurable:_ log_entry.actor_id IS NOT NULL AND log_entry.actor_id == extracted_user_id

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-AUDIT-LOG-ENTRY, WF-13 · Pass: 3_

    _Decomposition rationale:_ This is the atomic execution step where the resolved identity becomes a persistent fact in the system state. It is testable without further decomposition.

    _Surfaced assumptions:_ A-0489, A-0490
##### FR-AUDIT-LOG-04.3 `[Tier B · pending]`

**As a** System Architect, **I want** Enforce append-only storage mechanism for logs, **so that** Log entries cannot be overwritten or deleted after write.

**Acceptance criteria:**
  - **AC-003** — System prevents updates to persisted audit records.
    - _Measurable:_ UPDATE ON log_entries SET ... throws error or is blocked by RLS

_Status: pending · Priority: critical · Tier: B · Traces to: COMP-17 · Pass: 2_

_Decomposition rationale:_ Immutability is a major architectural commitment. This child defines the specific policy/strategy (append-only storage) that ensures the 'Immutable audit record' goal is met.

_Surfaced assumptions:_ A-0203

##### FR-AUDIT-LOG-04.4 `[Tier C · pending]`

**As a** CAM operator, **I want** Capture system clock timestamp for the entry, **so that** Timestamp reflects the server time at commit moment.

**Acceptance criteria:**
  - **AC-004** — Timestamp is non-null and within 100ms of commit time.
    - _Measurable:_ abs(log_entry.timestamp - commit_time) <= 0.1 seconds

_Status: pending · Priority: high · Tier: C · Traces to: WF-13 · Pass: 2_

_Decomposition rationale:_ Ensures the timestamp is a verification point for chain-of-custody. Relies on WF-13 for audit trail creation logic.

_Surfaced assumptions:_ A-0203

  - **FR-AUDIT-LOG-04.4.1** `[Tier D · atomic]`
    **As a** System Clock Manager, **I want** Acquire authoritative server time at transaction start, **so that** Timestamp variable holds value from primary server clock.

    **Acceptance criteria:**
      - **AC-04.1-01** — Acquired time matches primary server clock.
        - _Measurable:_ read_clock_source() === db_server_utc_clock

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-13, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Splits the 'capture' requirement into the specific clock acquisition step required to satisfy the 'server time' commitment.

    _Surfaced assumptions:_ A-0491, A-0492
  - **FR-AUDIT-LOG-04.4.2** `[Tier D · atomic]`
    **As a** Transaction Hook, **I want** Persist timestamp atomically with commit, **so that** Timestamp field is populated at exact commit boundary.

    **Acceptance criteria:**
      - **AC-04.2-01** — Timestamp persists with commit.
        - _Measurable:_ INSERT/UPDATE AT COMMIT => timestamp_field IS NOT NULL

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-13, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Defines the injection mechanism (commit hook) to ensure the timestamp reflects the exact moment of the audit trail creation.

    _Surfaced assumptions:_ A-0491, A-0492
  - **FR-AUDIT-LOG-04.4.3** `[Tier D · atomic]`
    **As a** Validation Logic, **I want** Reject or flag if drift exceeds tolerance, **so that** No entry persists with timestamp > 100ms from commit.

    **Acceptance criteria:**
      - **AC-04.3-01** — Skew validation passes or blocks.
        - _Measurable:_ abs(timestamp - commit_time) <= 0.1 seconds ELSE reject_entry

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-13, ENT-AUDIT-LOG-ENTRY · Pass: 3_

    _Decomposition rationale:_ Encodes the 100ms AC into a concrete rejection/flagging action that the system can verify.

    _Surfaced assumptions:_ A-0491, A-0492

## Non-Functional Requirements (0 roots · 0 total nodes · 0 atomic leaves)

_No non-functional requirements recorded yet for this run._

## Summary Telemetry

| Kind | Roots | Total | Atomic | Decomposed | Pending | Pruned | Deferred | Downgraded | A | B | C | D |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FR | 21 | 848 | 279 | 0 | 562 | 0 | 1 | 6 | 5 | 49 | 487 | 279 |
| NFR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
