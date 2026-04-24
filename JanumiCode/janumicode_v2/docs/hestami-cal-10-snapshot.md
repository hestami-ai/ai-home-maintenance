# Requirements Decomposition — b1f56fbe

_Generated 2026-04-23 00:10Z · Run: b1f56fbe-4e70-4f9e-a958-cc2ed3af5d4e_
_Lens: product · Phase: 2 · Status: in_progress_
_Budget used: 0 calls · Max depth reached: 0_

## Business Context

### Release Plan (3 releases)
#### Release 1: Homeowner Core Services & Asset Digitalization
This initial release empowers homeowners to seamlessly request and track home repair services from verified vendors. It also introduces the foundational capability for owners to digitalize their property assets by uploading photos and creating detailed profiles, setting the stage for a comprehensive property record. Basic dispute resolution and internal platform monitoring capabilities are also established to ensure a stable and reliable service from day one.

**Rationale:** This release delivers the minimum viable product by addressing the most immediate pain point for homeowners: finding reliable help for repairs. It establishes the core user experience and begins building out the digital asset registry, which is a fundamental platform component. Features in subsequent releases will depend on these core service request and asset management capabilities.

**Journeys:** UJ-1, UJ-2, UJ-9, UJ-8, UJ-12
**Domains:** DOM-PROPERTY-ASSETS, DOM-WORK-ORDER, DOM-VENDOR-MGMT, DOM-DIGITAL-ASSETS, DOM-NOTIFICATION, DOM-SUPPORT

#### Release 2: Landlord & Vendor Operations Expansion
Building on Release 1, this phase expands the platform's utility to landlords and investors, allowing them to compare vendor quotes, manage portfolio reporting across multiple units, and escalate vendor disputes. Crucially, it introduces comprehensive onboarding and management tools for service providers, enabling contractors to join the platform, complete field jobs, invoice clients, and manage their compliance dashboard. This establishes the critical supply side of the marketplace.

**Rationale:** After establishing core homeowner demand in Release 1, Release 2 focuses on scaling the platform by onboarding the supply side (vendors) and catering to the more complex needs of landlords and investors. Vendor management, job completion, and compliance are essential for a functioning marketplace, and these capabilities directly leverage the service request flows initiated in Release 1.

**Journeys:** UJ-3, UJ-10, UJ-14, UJ-11, UJ-4, UJ-5
**Domains:** DOM-VENDOR-MGMT, DOM-FINANCE, DOM-COMPLIANCE, DOM-REPORTING, DOM-VERIFICATION, DOM-DISPATCH

#### Release 3: Community Association Governance & Finance
This final phase introduces advanced functionality tailored for community associations. It enables association managers to process resident maintenance requests, board members to review budgets, vote on actions, and access essential association documents. Additionally, it streamlines financial operations by allowing association managers to reconcile resident dues, providing a comprehensive solution for HOA governance and financial management within the Hestami ecosystem.

**Rationale:** Release 3 addresses the most complex and specialized segment of the real property ecosystem: community association management. These features depend on the maturity of core service request and financial transaction capabilities established in earlier releases. Introducing governance, complex financial reconciliation, and document management after the individual property owner and vendor workflows are solidified ensures a robust foundation.

**Journeys:** UJ-6, UJ-7, UJ-13, UJ-15
**Domains:** DOM-GOVERNANCE, DOM-FINANCE, DOM-COMMUNITY, DOM-CONTRACTS

### Intent Lens
**Lens:** product  
**Confidence:** 0.95  
**Rationale:** The input is a 'Product Description' document for the 'Hestami AI Real Property OS and Platform', detailing its 'Vision', 'Mission', 'three pillars', 'Personas', 'User Journeys', and 'Core Technological Infrastructure and Stack'. These are all unambiguous signals for a new product, platform, or service.

### Intent Statement
**Hestami is an AI-native operating system that unifies homeowners, landlords, service providers, and community associations into a single digital ecosystem designed to streamline maintenance, governance, and financial workflows. We aim to minimize friction by matching property needs with verified vendors while handling complex compliance and digital asset management autonomously where possible.**

Hestami serves homeowners, investors, contractors, and community associations by providing a unified platform for property maintenance, vendor management, and association compliance. The system integrates property asset registries, field service dispatch, financial transaction processing, and regulatory governance into one secure interface. It connects people requesting repairs with verified providers, manages digital assets, and handles administrative burdens, creating a seamless digital operating system for the real property and home services ecosystem.

**Who it serves:** Homeowner — Individual owners of a single residence or apartment unit who need maintenance and repairs.  
**Problem:** Hestami serves homeowners, investors, contractors, and community associations by providing a unified platform for property maintenance, vendor management, and association compliance. The system integrates property asset registries, field service dispatch, financial transaction processing, and regulatory governance into one secure interface. It connects people requesting repairs with verified providers, manages digital assets, and handles administrative burdens, creating a seamless digital operating system for the real property and home services ecosystem.

#### Confirmed Assumptions
- **DEC-1** — The product will follow a Three-Pillar Phasing Strategy to align product maturity with market readiness for each vertical (Owners, Vendors, Associations).
- **DEC-2** — AI automation will be integrated directly into the system of record rather than as a separate layer to ensure data consistency.
- **DEC-3** — The platform will prioritize offline-first mobile capabilities for field workers to ensure operational continuity.
- **DEC-4** — All external integrations must originate from the platform origin to maintain security and control.

#### Confirmed Constraints
- No direct client access to the system origin IP is permitted; all traffic must traverse Cloudflare.
- External partner integrations such as Nextdoor are initially out-of-scope.
- The platform must adhere to strict statutory deadlines for HOA notices and voting rules.
- Data for distinct communities must be logically and physically isolated to prevent cross-association data leakage.

#### Out of Scope
- Define primary revenue streams per pillar (subscription, transaction, or vendor fee)
- Determine threshold for AI agent autonomy versus human staff approval on vendor matching


## Functional Requirements (15 roots · 964 total nodes · 378 atomic leaves)

### Release 1: Homeowner Core Services & Asset Digitalization (4 roots)
*This initial release empowers homeowners to seamlessly request and track home repair services from verified vendors. It also introduces the foundational capability for owners to digitalize their property assets by uploading photos and creating detailed profiles, setting the stage for a comprehensive property record. Basic dispute resolution and internal platform monitoring capabilities are also established to ensure a stable and reliable service from day one.*

### FR US-001 `[pending]`

**As a** Homeowner, **I want** Create a Service Call for repair need, **so that** Hestami CDM creates a new Work Order record linked to the property address.

**Acceptance criteria:**
  - **AC-001** — Service call is persisted
    - _Measurable:_ POST /work-orders returns 201 and GET /work-orders/{id} returns the record within 1 second
  - **AC-002** — Service call metadata is captured
    - _Measurable:_ Work Order includes property address and issue description verbatim

_Status: pending · Priority: critical · Traces to: UJ-1, VOC-7, ENT-PROPERTY, ENT-WORK-ORDER · Pass: 0_

#### US-001-2 `[Tier C · pending]`

**As a** State Policy, **I want** Initialize Work Order Status to 'Open' on persistence, **so that** New Work Order enters the Workflow Engine in the 'Open' state immediately.

**Acceptance criteria:**
  - **AC-002** — Status field value matches state machine initial state.
    - _Measurable:_ work_order.status === 'Open' immediately after commit

_Status: pending · Priority: high · Tier: C · Traces to: WF-2, UJ-1 · Pass: 1_

_Decomposition rationale:_ Sets the initial state for the Workflow Engine (WF-2). This is an implementation commitment on state value.

_Surfaced assumptions:_ A-0001, A-0002, A-0003

##### US-001-2-1 `[Tier C · pending]`

**As a** Database Engineer, **I want** Configure database column default for Work Order status, **so that** Inserted rows receive 'Open' status automatically from DB engine.

**Acceptance criteria:**
  - **AC-002-DB** — DB default value enforces 'Open' on INSERT.
    - _Measurable:_ SELECT default FROM work_orders WHERE default IS NOT NULL; -> 'Open'

_Status: pending · Priority: high · Tier: C · Traces to: WF-2 · Pass: 2_

_Decomposition rationale:_ Ensures persistence layer handles initialization independently of application logic, providing a safety net for the workflow engine.

_Surfaced assumptions:_ A-0048, A-0049, A-0050

  - **US-001-2-1-001** `[Tier C · pending]`
    **As a** CAM operator, **I want** Define the literal string value for the default status, **so that** The database schema specifies 'Open' as the explicit default literal.

    **Acceptance criteria:**
      - **AC-001** — The column definition contains the literal string 'Open' (case-sensitive).
        - _Measurable:_ SELECT column_default FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'status'; -> 'Open'

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-2 · Pass: 3_

    _Decomposition rationale:_ This child commits to the specific data value used by the DB engine, isolating the constant string definition from the DDL execution logic.

    _Surfaced assumptions:_ A-0170, A-0171, A-0172
    - **US-001-2-1-001-001** `[Tier D · atomic]`
      **As a** Database Engineer, **I want** Set status column default literal to 'Open', **so that** The 'status' column in 'work_orders' table returns 'Open' on insert without value.

      **Acceptance criteria:**
        - **AC-001-01** — Column default matches 'Open'.
          - _Measurable:_ SELECT column_default FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'status'; -> 'Open'

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-2 · Pass: 4_

      _Decomposition rationale:_ This child represents the atomic definition of the literal string value itself, the primary component of the schema commitment.

      _Surfaced assumptions:_ A-0379
    - **US-001-2-1-001-002** `[Tier D · atomic]`
      **As a** Workflow Engineer, **I want** Ensure default literal aligns with WF-2 state machine, **so that** The 'Open' default is interpreted correctly by the state machine logic in WF-2 as a valid initial state.

      **Acceptance criteria:**
        - **AC-002-01** — WF-2 configuration accepts 'Open' as start state.
          - _Measurable:_ WF-2 state machine transition rules allow 'Open' as start state

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-2 · Pass: 4_

      _Decomposition rationale:_ This child ensures the schema value is semantically meaningful to the consuming workflow engine, preventing mismatch between database defaults and workflow logic.

      _Surfaced assumptions:_ A-0379
  - **US-001-2-1-002** `[Tier C · pending]`
    **As a** CAM operator, **I want** Configure DDL execution strategy for the default, **so that** ALTER TABLE statement is generated and deployed to the storage engine.

    **Acceptance criteria:**
      - **AC-002** — The DDL statement executes successfully without locking the table for longer than maintenance window.
        - _Measurable:_ ALTER TABLE work_orders ALTER COLUMN status SET DEFAULT 'Open'; -> executes without timeout > 30s

    _Status: pending · Priority: high · Tier: C · Traces to: WF-2, US-001-2-4 · Pass: 3_

    _Decomposition rationale:_ This child commits to the technical method (DDL vs Application logic) required to persist the default, complementing the App-side commit (US-001-2-4).

    _Surfaced assumptions:_ A-0170, A-0171, A-0172
    - **FR-001** `[Tier B · pending]`
      **As a** Architecture, **I want** Select Online DDL as the schema change mechanism, **so that** Schema modifications avoid table locks during the maintenance window.

      **Acceptance criteria:**
        - **AC-003** — ALTER TABLE does not block reads or writes
          - _Measurable:_ Transaction isolation level permits concurrent access without deadlocks for duration > 10s

      _Status: pending · Priority: critical · Tier: B · Traces to: WF-2 · Pass: 4_

      _Decomposition rationale:_ This child binds the architectural decision on how to handle schema changes, distinguishing it from standard blocking DDL.

      _Surfaced assumptions:_ A-0380, A-0381, A-0382
    - **FR-002** `[Tier C · pending]`
      **As a** Constraint, **I want** Enforce maximum lock timeout of 30 seconds, **so that** Schema changes fail gracefully if they cannot complete within the maintenance window.

      **Acceptance criteria:**
        - **AC-002** — ALTER TABLE completes without locking > 30s
          - _Measurable:_ pg_locks.wait_time_ms <= 30000 for any DDL execution path

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-2 · Pass: 4_

      _Decomposition rationale:_ This is a concrete implementation constraint ensuring availability requirements are met.

      _Surfaced assumptions:_ A-0380, A-0381, A-0382
    - **FR-003** `[Tier C · pending]`
      **As a** Implementation, **I want** Apply DEFAULT clause for the 'status' column, **so that** New rows receive 'Open' status without application logic intervention.

      **Acceptance criteria:**
        - **AC-004** — Insert into work_orders sets status to Open
          - _Measurable:_ DEFAULT 'Open' is applied at row creation time by the database engine

      _Status: pending · Priority: high · Tier: C · Traces to: US-001-2-1-001 · Pass: 4_

      _Decomposition rationale:_ This child addresses the specific column default mechanism referenced in the sibling US-001-2-1-001.

      _Surfaced assumptions:_ A-0380, A-0381, A-0382
    - **FR-004** `[Tier C · pending]`
      **As a** Compliance, **I want** Log DDL execution events to the audit trail, **so that** Schema change history is preserved for compliance and rollback analysis.

      **Acceptance criteria:**
        - **AC-005** — Every DDL execution generates an audit log entry
          - _Measurable:_ ENT-AUDIT-LOG is appended with schema_change_event payload for every DDL commit

      _Status: pending · Priority: high · Tier: C · Traces to: WF-2 · Pass: 4_

      _Decomposition rationale:_ This child surfaces the compliance requirement to track schema evolution, distinct from the functional implementation.

      _Surfaced assumptions:_ A-0380, A-0381, A-0382
  - **US-001-2-1-003** `[Tier C · pending]`
    **As a** CAM operator, **I want** Define migration backfill scope for existing rows, **so that** Existing NULL status values are not automatically backfilled by the default mechanism.

    **Acceptance criteria:**
      - **AC-003** — Insert-only enforcement: Existing rows retain their original status until explicitly updated or transitioned by WF-2.
        - _Measurable:_ SELECT COUNT(*) FROM work_orders WHERE status IS NULL AND created_at > 'migration_timestamp'; -> > 0 (NULLs persist on pre-migration)

    _Status: pending · Priority: medium · Tier: C · Traces to: WF-2, US-001-2-4 · Pass: 3_

    _Decomposition rationale:_ This child commits to the data integrity constraint of defaults applying only to new rows, distinguishing this scope from application-side validation.

    _Surfaced assumptions:_ A-0170, A-0171, A-0172
    - **FR-003-C01** `[Tier C · pending]`
      **As a** Migration Logic, **I want** Enforce retention of NULL status on pre-migration rows, **so that** Legacy work orders created before the migration timestamp maintain their NULL status value without automatic correction.

      **Acceptance criteria:**
        - **AC-004** — Legacy NULLs persist after migration.
          - _Measurable:_ COUNT(WO WHERE status IS NULL AND created_at < 'migration_timestamp') > 0 post-migration

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-2, US-001-2-1-003 · Pass: 4_

      _Decomposition rationale:_ This implements the core policy of preserving legacy data integrity; defines the specific operational constraint on existing rows versus new rows.

      _Surfaced assumptions:_ A-0383, A-0384, A-0385
    - **FR-003-C02** `[Tier C · pending]`
      **As a** New Row Defaults, **I want** Apply default literal 'Open' to newly created rows only, **so that** All work orders created after the migration timestamp utilize the defined default value for status.

      **Acceptance criteria:**
        - **AC-005** — New rows use default 'Open' status.
          - _Measurable:_ COUNT(WO WHERE status = 'Open' AND created_at > 'migration_timestamp') === NEW_WO_COUNT

      _Status: pending · Priority: high · Tier: C · Traces to: US-001-2-1-001, US-001-2-1-002, FR-003-C01 · Pass: 4_

      _Decomposition rationale:_ Separates the scope for new data from legacy data; relies on the default literal defined in US-001-2-1-001 and DDL strategy in US-001-2-1-002.

      _Surfaced assumptions:_ A-0383, A-0384, A-0385
    - **FR-003-C03** `[Tier D · atomic]`
      **As a** Validation Step, **I want** Run migration verification query to confirm backfill scope boundaries, **so that** Verification report confirms no pre-migration NULLs were inadvertently updated or overwritten.

      **Acceptance criteria:**
        - **AC-006** — No legacy NULLs found in unexpected states.
          - _Measurable:_ SELECT COUNT(*) FROM work_orders WHERE created_at < 'migration_timestamp' AND status IS NOT NULL AND status <> 'Open' AND id IN (backfill_set) = 0

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-003-C01, FR-003-C02 · Pass: 4_

      _Decomposition rationale:_ Atomic verification step ensuring the policy implementation (C children) was executed correctly.

      _Surfaced assumptions:_ A-0383, A-0384, A-0385
##### US-001-2-2 `[Tier C · pending]`

**As a** Workflow Developer, **I want** Configure Workflow Engine initial state for new instances, **so that** WF-2 sets 'Open' as the entry state before transition logic runs.

**Acceptance criteria:**
  - **AC-002-WF** — WF Engine initialization sets state to Open.
    - _Measurable:_ wf_state_map.get('initial') === 'Open' for new work orders

_Status: pending · Priority: high · Tier: C · Traces to: WF-2, UJ-1 · Pass: 2_

_Decomposition rationale:_ Aligns the workflow engine's internal state machine with the persistence requirement to ensure logical consistency immediately upon workflow instantiation.

_Surfaced assumptions:_ A-0048, A-0049, A-0050

  - **US-001-2-2-1** `[Tier C · pending]`
    **As a** Workflow Engine Operator, **I want** Configure WF-2 state map with 'Open' constant, **so that** The workflow engine's internal state map maps 'initial' key to 'Open'.

    **Acceptance criteria:**
      - **AC-002-WF-1** — The 'initial' key resolves to 'Open' in the state map.
        - _Measurable:_ wf_state_map['initial'] === 'Open' for any new instance loaded after configuration

    _Status: pending · Priority: high · Tier: C · Traces to: WF-2, UJ-1 · Pass: 3_

    _Decomposition rationale:_ This child isolates the specific configuration action required by the parent commitment. It commits to the technical approach (state map definition) rather than the broader strategy.

    _Surfaced assumptions:_ A-0173, A-0174, A-0175
    - **US-001-2-2-1.1** `[Tier D · atomic]`
      **As a** Configuration Writer, **I want** Persist 'initial' -> 'Open' mapping to the versioned workflow config store, **so that** Configuration record for WF-2 state map is committed to persistent storage.

      **Acceptance criteria:**
        - **AC-002-001** — Stored config contains key 'initial' with value 'Open'.
          - _Measurable:_ wf_state_map_config_store.exists('initial') && wf_state_map_config_store.get('initial') === 'Open'

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-2, UJ-1 · Pass: 4_

      _Decomposition rationale:_ Defines the data durability requirement for the configuration decision; ensures the state map is not volatile in memory only.

      _Surfaced assumptions:_ A-0386, A-0387
    - **US-001-2-2-1.2** `[Tier D · atomic]`
      **As a** Engine Loader, **I want** Inject persisted config mapping into runtime memory at engine boot, **so that** Engine state map holds 'Open' for 'initial' key after startup.

      **Acceptance criteria:**
        - **AC-002-002** — Runtime state map matches persisted value.
          - _Measurable:_ runtime_wf_state_map['initial'] === 'Open'

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-2, UJ-1 · Pass: 4_

      _Decomposition rationale:_ Defines the runtime behavior commitment resulting from the stored config; bridges configuration storage with active execution.

      _Surfaced assumptions:_ A-0386, A-0387
    - **US-001-2-2-1.3** `[Tier D · atomic]`
      **As a** Health Checker, **I want** Verify config consistency against canonical vocabulary during health check, **so that** Configuration is valid and matches VOC-1 state vocabulary.

      **Acceptance criteria:**
        - **AC-002-003** — State map value matches canonical Open status.
          - _Measurable:_ wf_state_map_config_store['initial'] in canonical_work_order_status_vocabulary

      _Status: atomic · Priority: high · Tier: D · Traces to: WF-2, VOC-173 · Pass: 4_

      _Decomposition rationale:_ Ensures the configuration does not drift from canonical vocabulary; validates system integrity against external standards.

      _Surfaced assumptions:_ A-0386, A-0387
  - **US-001-2-2-2** `[Tier D · atomic]`
    **As a** Workflow Engine Operator, **I want** Initialize Work Order state to 'Open' at creation, **so that** Every new Work Order row has status 'Open' immediately after creation..

    **Acceptance criteria:**
      - **AC-002-WF-2** — Status column contains 'Open' before first transition.
        - _Measurable:_ SELECT status FROM work_orders WHERE created_at = NOW() ORDER BY created_at DESC LIMIT 1; WHERE status = 'Open'

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-2, UJ-1, US-001-2-4 · Pass: 3_

    _Decomposition rationale:_ This is the atomic leaf operation representing the actual moment the system sets the state. It is testable as a leaf action and complements the DB Default (US-001-2-1) and Commit Write (US-001-2-4) siblings by defining the logic path specifically through the Workflow Engine.

    _Surfaced assumptions:_ A-0173, A-0174, A-0175
  - **US-001-2-2-3** `[Tier C · pending]`
    **As a** Workflow Engineer, **I want** Enforce immutability of initial state value, **so that** The 'Open' initial state cannot be overridden by external inputs or configuration drift during the init window..

    **Acceptance criteria:**
      - **AC-002-WF-3** — No transition or status write is permitted prior to state initialization.
        - _Measurable:_ INSERT INTO work_orders ... WHERE status != 'Open' OR (triggered_event = 'init' AND status != 'Open') => FALSE

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-2, US-001-2-9, US-001-2-4 · Pass: 3_

    _Decomposition rationale:_ This child defines a governing rule (constraint) for the implementation commitment. It ensures the parent's scope is honored by preventing conflicting logic from the workflow engine or other sources.

    _Surfaced assumptions:_ A-0173, A-0174, A-0175
    - **US-001-2-2-3.1** `[Tier C · pending]`
      **As a** API Gateway Policy, **I want** Reject all POST/PUT requests to /work-orders/{id}/status during the init window, **so that** API calls attempting to change status during init receive HTTP 403 Forbidden.

      **Acceptance criteria:**
        - **AC-002-1** — External status writes are rejected during init period
          - _Measurable:_ status_code === 403 AND error_code === 'INIT_WINDOW_LOCKED'

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-2, TECH-10, ENT-WORK-ORDER · Pass: 4_

      _Decomposition rationale:_ External input protection is the primary mechanism for 'init window' security; this implements the policy via API Gateway or RLS rules.

      _Surfaced assumptions:_ A-0388, A-0389
    - **US-001-2-2-3.2** `[Tier C · pending]`
      **As a** Workflow Engine Validator, **I want** Validate internal state machine transitions against init flag before persisting, **so that** Internal status transitions are blocked unless init flag is cleared.

      **Acceptance criteria:**
        - **AC-002-2** — Internal transition requests fail during init window
          - _Measurable:_ transition_request_result === false OR error_code === 'INIT_NOT_COMPLETE'

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-2, US-001-2-2-2 · Pass: 4_

      _Decomposition rationale:_ This implements the protection against configuration drift by the workflow engine itself, ensuring no internal logic overrides the initial state.

      _Surfaced assumptions:_ A-0388, A-0389
    - **US-001-2-2-3.3** `[Tier C · pending]`
      **As a** Configuration Drift Guard, **I want** Prevent updates to Work Order initial state constant definitions during init window, **so that** Configuration updates to state map or status constants fail if init flag is active.

      **Acceptance criteria:**
        - **AC-002-3** — Config map updates are rejected during init phase
          - _Measurable:_ config_update_error === 'STATE_MAP_IMMUTABLE'

      _Status: pending · Priority: high · Tier: C · Traces to: US-001-2-2-1, ENT-REGION-CONFIG, TECH-12 · Pass: 4_

      _Decomposition rationale:_ Protects the 'Open' constant definition from being overridden by configuration drift, ensuring the vocabulary remains stable.

      _Surfaced assumptions:_ A-0388, A-0389
##### US-001-2-3 `[Tier C · pending]`

**As a** API Developer, **I want** Validate incoming payload status field during schema enforcement, **so that** Requests with status != 'Open' return 400 Bad Request.

**Acceptance criteria:**
  - **AC-002-API** — API rejects non-'Open' status on creation.
    - _Measurable:_ schema.validate(payload).error === 'status: Open' if payload.status !== 'Open'

_Status: pending · Priority: high · Tier: C · Traces to: US-001-3 · Pass: 2_

_Decomposition rationale:_ Enforces the requirement at the edge layer (US-001-3 sibling context) to prevent invalid data from ever reaching persistence logic.

_Surfaced assumptions:_ A-0048, A-0049, A-0050

  - **US-001-2-3-C1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Define Zod schema validator for Work Order status enum, **so that** Schema throws error if payload.status is not 'Open'.

    **Acceptance criteria:**
      - **AC-003-C1** — Validator rejects payloads where status is not 'Open'
        - _Measurable:_ schema.validate(payload).error !== null if payload.status !== 'Open'

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-9, US-001-2-1 · Pass: 3_

    _Decomposition rationale:_ Binds the AC to the specific technology choice (Zod) listed in handoff constraints, establishing the validation rule before the workflow engine engages.

    _Surfaced assumptions:_ A-0176, A-0177, A-0178
    - **US-001-2-3-C1.1** `[Tier C · pending]`
      **As a** Backend Developer, **I want** Configure Zod Literal for status field, **so that** Schema accepts only 'Open' enum value.

      **Acceptance criteria:**
        - **AC-001** — Schema rejects 'Pending', 'Closed', and other statuses.
          - _Measurable:_ Z.object({ status: Z.literal('Open') }).safeParse(payload).success === false if payload.status !== 'Open'

      _Status: pending · Priority: high · Tier: C · Traces to: TECH-9, US-001-2-1 · Pass: 4_

      _Decomposition rationale:_ Translates the Phase 1 policy (A-0178) into concrete schema logic using Z.literal to prevent invalid statuses at the type level.
    - **US-001-2-3-C1.2** `[Tier C · pending]`
      **As a** Backend Developer, **I want** Enable strict schema parsing mode, **so that** Schema rejects partial objects or extra fields.

      **Acceptance criteria:**
        - **AC-002** — Schema errors on payload with extra keys beyond defined properties.
          - _Measurable:_ schema.strict === true in the Zod config object

      _Status: pending · Priority: high · Tier: C · Traces to: TECH-9, US-001-2-1 · Pass: 4_

      _Decomposition rationale:_ Adds a constraint to prevent loose typing errors, ensuring only expected properties are persisted to the Work Order record.
    - **US-001-2-3-C1.3** `[Tier C · pending]`
      **As a** Integration Engineer, **I want** Wire Zod schema to oRPC endpoint handler, **so that** Validation occurs at the oRPC boundary before routing.

      **Acceptance criteria:**
        - **AC-003** — oRPC handler invokes Zod instance before passing payload to business logic.
          - _Measurable:_ Zod.parse(payload) called in oRPC route handler before call to service layer

      _Status: pending · Priority: critical · Tier: C · Traces to: TECH-9, US-001-2-1 · Pass: 4_

      _Decomposition rationale:_ Connects the schema definition to the specific integration protocol (TECH-9), ensuring validation happens at the HTTP boundary (A-0176) as per architectural constraint.
  - **US-001-2-3-C2** `[Tier C · pending]`
    **As a** CAM operator, **I want** Configure HTTP 400 Bad Request response behavior, **so that** API client receives 400 status code with specific error message.

    **Acceptance criteria:**
      - **AC-003-C2** — HTTP response code is 400 for invalid status
        - _Measurable:_ res.status === 400 && res.body.error.message === 'status: Open'

    _Status: pending · Priority: critical · Tier: C · Traces to: US-001-2-1, US-001-2-4 · Pass: 3_

    _Decomposition rationale:_ Defines the downstream consequence of schema failure; ensures client receives a standard error before DB write occurs.

    _Surfaced assumptions:_ A-0176, A-0177, A-0178
    - **US-001-2-3-C2-1** `[Tier D · atomic]`
      **As a** response_engine, **I want** Set HTTP status code to 400 for invalid status payload, **so that** Client receives HTTP 400 status for invalid status value.

      **Acceptance criteria:**
        - **AC-004-C2-1** — HTTP Status Code is exactly 400.
          - _Measurable:_ res.status === 400 for all validation failures in US-001-2-3-C2 scope

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-001-2-1, US-001-2-4 · Pass: 4_

      _Decomposition rationale:_ Defining the status code is a required leaf operation to satisfy the HTTP contract for client error conditions.

      _Surfaced assumptions:_ A-0390
    - **US-001-2-3-C2-2** `[Tier D · atomic]`
      **As a** response_engine, **I want** Construct error message body string, **so that** HTTP 400 response body contains the string 'status: Open'.

      **Acceptance criteria:**
        - **AC-005-C2-2** — Error message text matches specification.
          - _Measurable:_ JSON.parse(res.body).error.message === 'status: Open' for all validation failures

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-001-2-1, US-001-2-4, US-001-2-3-C1 · Pass: 4_

      _Decomposition rationale:_ The specific error message content defines the user-facing contract and prevents client-side ambiguity about the error cause.

      _Surfaced assumptions:_ A-0390
    - **US-001-2-3-C2-3** `[Tier D · atomic]`
      **As a** security_layer, **I want** Sanitize response headers for 400 responses, **so that** Response does not leak stack traces or internal path info.

      **Acceptance criteria:**
        - **AC-006-C2-3** — No stack traces in headers or body.
          - _Measurable:_ res.headers['X-Stack-Trace'] === undefined && res.body.error !== {stack: ...} for all failures

      _Status: atomic · Priority: high · Tier: D · Traces to: US-001-2-1, US-001-2-4 · Pass: 4_

      _Decomposition rationale:_ Security best practice requires sanitizing error responses to prevent information disclosure vulnerabilities.

      _Surfaced assumptions:_ A-0390
  - **US-001-2-3-C3** `[Tier C · pending]`
    **As a** CAM operator, **I want** Enforce validation timing before database write, **so that** No INSERT query executes if validation throws.

    **Acceptance criteria:**
      - **AC-003-C3** — Database remains unchanged on validation failure
        - _Measurable:_ DB transaction is rolled back or never begins if schema.validate throws

    _Status: pending · Priority: high · Tier: C · Traces to: US-001-2-2, US-001-2-4 · Pass: 3_

    _Decomposition rationale:_ Commits to the architectural timing constraint (validation at boundary vs. commit time) to prevent partial state consistency.

    _Surfaced assumptions:_ A-0176, A-0177, A-0178
    - **US-001-2-3-C3-01** `[Tier C · pending]`
      **As a** DB Operator, **I want** Initialize database transaction boundary only after schema validation passes, **so that** No database transaction is begun until the request payload is proven valid by the Zod schema..

      **Acceptance criteria:**
        - **AC-001** — Transaction block begins only after schema validation.
          - _Measurable:_ Database connection transaction.begin() is called synchronously after schema.validate() returns without throwing.

      _Status: pending · Priority: critical · Tier: C · Traces to: US-001-2-3-C1, WF-2, ENT-WORK-ORDER · Pass: 4_

      _Decomposition rationale:_ Ensures the timing constraint from the parent is respected at the DB level, preventing partial state changes or resource locking based on invalid data. Traces to C1 (Schema) and WF-2 (Workflow).

      _Surfaced assumptions:_ A-0391, A-0392, A-0393
    - **US-001-2-3-C3-02** `[Tier C · pending]`
      **As a** Error Handler, **I want** Map schema validation exceptions to automatic transaction rollback signals, **so that** Any Zod validation error immediately triggers an abort of the current database transaction context..

      **Acceptance criteria:**
        - **AC-002** — Transaction is rolled back on schema error.
          - _Measurable:_ If schema.validate() throws an Error, the database transaction.rollback() is executed within 10ms.

      _Status: pending · Priority: high · Tier: C · Traces to: US-001-2-3-C1, US-001-2-3-C2, TECH-8 · Pass: 4_

      _Decomposition rationale:_ Bridges the gap between the HTTP-level validation (C1/C2) and the database state (TECH-8). Ensures the failure signal propagates to the persistence layer correctly.

      _Surfaced assumptions:_ A-0391, A-0392, A-0393
    - **US-001-2-3-C3-03** `[Tier C · pending]`
      **As a** Architect, **I want** Configure transaction isolation level for Work Order creation paths, **so that** Reads and writes during the validation-to-commit window are isolated to prevent dirty reads from concurrent invalidation attempts..

      **Acceptance criteria:**
        - **AC-003** — Isolation level prevents concurrent modification visibility issues.
          - _Measurable:_ PostgreSQL session isolation_level is set to 'Serializable' for the specific transaction handling Work Order creation.

      _Status: pending · Priority: critical · Tier: C · Traces to: TECH-8, ENT-WORK-ORDER, WF-2 · Pass: 4_

      _Decomposition rationale:_ Addresses the system internal restriction on concurrent writes (Constraint). Prevents race conditions where a validation check and write might clash with another concurrent write.

      _Surfaced assumptions:_ A-0391, A-0392, A-0393
  - **US-001-2-3-C4** `[Tier C · pending]`
    **As a** CAM operator, **I want** Record validation failure in audit log, **so that** Validation event is persisted to audit trail for compliance.

    **Acceptance criteria:**
      - **AC-003-C4** — Rejected request logged with payload snippet
        - _Measurable:_ ENT-AUDIT-LOG contains entry referencing the failed validation timestamp and error code

    _Status: pending · Priority: medium · Tier: C · Traces to: ENT-AUDIT-LOG, TECH-13 · Pass: 3_

    _Decomposition rationale:_ Ensures security and compliance requirements for auditability are met even when requests fail at the ingress layer.

    _Surfaced assumptions:_ A-0176, A-0177, A-0178
    - **FR-ACCT-4.1** `[Tier C · pending]`
      **As a** CAM operator, **I want** Sanitize payload snippet to prevent PII leakage, **so that** Log entry contains truncated, sanitized payload without sensitive data.

      **Acceptance criteria:**
        - **AC-004-01** — Payload field contains no credentials or personal identifiers.
          - _Measurable:_ payload_field does not contain patterns matching PII regex (email, social, phone) for every row in ENT-AUDIT-LOG at commit time

      _Status: pending · Priority: critical · Tier: C · Traces to: ENT-AUDIT-LOG · Pass: 4_

      _Decomposition rationale:_ Sanitization is an implementation choice required to satisfy security constraints before persisting to the audit trail; it rules out storing raw request bodies.

      _Surfaced assumptions:_ A-0394, A-0395
    - **FR-ACCT-4.2** `[Tier C · pending]`
      **As a** CAM operator, **I want** Extract validation error code from exception handler, **so that** Log entry contains standardized error code from Zod validation failure.

      **Acceptance criteria:**
        - **AC-004-02** — Error code field populated with exception.code string value.
          - _Measurable:_ error_code field equals exception.message.code for every log entry referencing validation failure at commit time

      _Status: pending · Priority: high · Tier: C · Traces to: ENT-AUDIT-LOG · Pass: 4_

      _Decomposition rationale:_ Error code extraction is the specific implementation logic for populating the log with failure metadata; distinct from payload content.

      _Surfaced assumptions:_ A-0394, A-0395
    - **FR-ACCT-4.3** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Write audit event to ENT-AUDIT-LOG, **so that** Validation event persists to storage with unique ID and timestamp.

      **Acceptance criteria:**
        - **AC-004-03** — Event persisted to ENT-AUDIT-LOG storage.
          - _Measurable:_ Unique log entry ID exists in ENT-AUDIT-LOG with timestamp >= now()

      _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-AUDIT-LOG, TECH-13 · Pass: 4_

      _Decomposition rationale:_ Persistence is the atomic leaf operation defining the end-to-end flow of the requirement; this child is the terminal action of the parent's scope.

      _Surfaced assumptions:_ A-0394, A-0395
##### US-001-2-4 `[Tier D · atomic]`

**As a** System, **I want** Write 'Open' to Work Order status column on commit, **so that** Row in database contains 'Open' in status column.

**Acceptance criteria:**
  - **AC-002-ROW** — Status column value is 'Open' immediately after commit.
    - _Measurable:_ SELECT status FROM work_orders WHERE id = :id; -> 'Open'

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-1, WF-2 · Pass: 2_

_Decomposition rationale:_ Represents the atomic leaf operation where the system's physical state is verified against the requirement's acceptance criteria.

_Surfaced assumptions:_ A-0048, A-0049, A-0050

#### US-001-3 `[Tier C · pending]`

**As a** Input Validation, **I want** Validate request payload against Zod schema, **so that** Requests failing schema validation return 400 Bad Request.

**Acceptance criteria:**
  - **AC-003** — Invalid payloads reject with 400 status.
    - _Measurable:_ POST returns 400 if payload does not match schema definition

_Status: pending · Priority: high · Tier: C · Traces to: UJ-1, ENT-WORK-ORDER · Pass: 1_

_Decomposition rationale:_ Concrete implementation choice using Zod (TECH-9). This defines how the input is processed technically.

_Surfaced assumptions:_ A-0001, A-0002, A-0003

##### US-001-3.1 `[Tier D · atomic]`

**As a** CAM operator, **I want** Parse incoming JSON body, **so that** Malformed JSON causes immediate rejection before schema check.

**Acceptance criteria:**
  - **AC-004** — Malformed payloads reject with 400 status.
    - _Measurable:_ If JSON.parse() throws SyntaxError, response status is 400 and body is empty or structured error.

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-1, ENT-WORK-ORDER · Pass: 2_

_Decomposition rationale:_ JSON parsing is a distinct, atomic step that must fail fast before any schema logic applies.

_Surfaced assumptions:_ A-0051

##### US-001-3.2 `[Tier D · atomic]`

**As a** CAM operator, **I want** Enforce Zod schema types, **so that** Payload types match Zod definitions (string, number, enum, etc.).

**Acceptance criteria:**
  - **AC-005** — Type mismatches trigger 400 rejection.
    - _Measurable:_ schema.parse(payload) throws ZodError with type mismatch for every non-matching field.

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-1, ENT-WORK-ORDER · Pass: 2_

_Decomposition rationale:_ Type safety is a primary responsibility of the validation layer to prevent downstream type errors.

_Surfaced assumptions:_ A-0051

##### US-001-3.3 `[Tier D · atomic]`

**As a** CAM operator, **I want** Enforce required field presence, **so that** Missing mandatory fields trigger 400 rejection.

**Acceptance criteria:**
  - **AC-006** — Required fields present or validation fails.
    - _Measurable:_ Zod Error includes 'instance' of 'REQUIRED' for every missing key in the schema.

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-1, ENT-WORK-ORDER · Pass: 2_

_Decomposition rationale:_ Required fields are a subset of schema logic that can be isolated for testing.

_Surfaced assumptions:_ A-0051

##### US-001-3.4 `[Tier D · atomic]`

**As a** CAM operator, **I want** Log validation failure event, **so that** Validation errors recorded in audit trail for compliance.

**Acceptance criteria:**
  - **AC-007** — Error logged to audit trail immediately after rejection.
    - _Measurable:_ ENT-AUDIT-LOG contains entry with timestamp, error code, and payload snippet (anonymized).

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-1, US-001-4 · Pass: 2_

_Decomposition rationale:_ This aligns with sibling US-001-4 which mandates logging creation events; validation failures also require audit trail coverage.

_Surfaced assumptions:_ A-0051

##### US-001-3.5 `[Tier D · atomic]`

**As a** CAM operator, **I want** Return structured 400 response, **so that** HTTP 400 sent with standardized error message.

**Acceptance criteria:**
  - **AC-008** — Response body contains 'statusCode' and 'message'.
    - _Measurable:_ Response JSON includes 'statusCode': 400 and 'message' describing validation error.

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-1, ENT-WORK-ORDER · Pass: 2_

_Decomposition rationale:_ Client-facing error format is an atomic action required to satisfy the 'return 400' acceptance criterion.

_Surfaced assumptions:_ A-0051

#### US-001-1 `[downgraded]`

**As a** Architectural Choice, **I want** Enforce mandatory Property Address linking via Foreign Key, **so that** Work Order record is invalid without a valid Property Address reference.

**Acceptance criteria:**
  - **AC-001** — Work Order requires a Property ID on creation.
    - _Measurable:_ work_order.property_id is NOT NULL for all persisted rows

_Status: downgraded · Priority: critical · Traces to: ENT-PROPERTY, ENT-WORK-ORDER, UJ-1 · Pass: 2_

##### FR-WO-FK-1 `[Tier C · pending]`

**As a** Database Engineer, **I want** Implement FOREIGN KEY constraint on ENT-WORK-ORDER referencing ENT-PROPERTY, **so that** PostgreSQL throws unique constraint error or foreign key violation if parent row is missing.

**Acceptance criteria:**
  - **AC-FK-01** — Persistence of a Work Order with invalid Property ID fails.
    - _Measurable:_ INSERT OR UPDATE on ENT-WORK-ORDER returns 1386/foreign key constraint failure for non-existent ENT-PROPERTY.id

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-PROPERTY, ENT-WORK-ORDER, UJ-1 · Pass: 2_

_Decomposition rationale:_ This child defines the concrete implementation of the foreign key commitment at the database level, ensuring referential integrity is hard-enforced.

_Surfaced assumptions:_ A-0161, A-0162

  - **FR-WO-FK-1.1** `[Tier C · pending]`
    **As a** DB Architect, **I want** Define foreign key constraint schema in DDL, **so that** ENT-WORK-ORDER table enforces property_id reference via DB constraint.

    **Acceptance criteria:**
      - **AC-001** — FK constraint is active and validated at commit.
        - _Measurable:_ ALTER TABLE ENT-WORK-ORDER ADD CONSTRAINT fk_workorder_property FOREIGN KEY (property_id) REFERENCES ENT-PROPERTY(id) ON DELETE RESTRICT returns success

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-PROPERTY, ENT-WORK-ORDER, FR-WO-FK-2 · Pass: 3_

    _Decomposition rationale:_ Schema definition is the prerequisite technical choice required to enable the architectural commitment.

    _Surfaced assumptions:_ A-0342, A-0343, A-0344
  - **FR-WO-FK-1.2** `[Tier C · pending]`
    **As a** Error Handler, **I want** Map FK violation to API response, **so that** API returns 500 Internal Server Error with specific constraint message.

    **Acceptance criteria:**
      - **AC-002** — DB FK violation returns 500 with SQLState code.
        - _Measurable:_ HTTP status code is 500, error body contains 'SQLState: 23505' and message 'foreign key violation'

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-1, FR-WO-FK-4, ENT-LEDGER · Pass: 3_

    _Decomposition rationale:_ This child defines how the system exposes the architectural failure to the client, linking to user journey error expectations and compliance logging.

    _Surfaced assumptions:_ A-0342, A-0343, A-0344
  - **FR-WO-FK-1.3** `[Tier C · pending]`
    **As a** Security Engineer, **I want** Enforce data type consistency on FK column, **so that** No data type mismatch between ENT-PROPERTY.id and ENT-WORK-ORDER.property_id.

    **Acceptance criteria:**
      - **AC-003** — property_id column accepts only valid ENT-PROPERTY.id values.
        - _Measurable:_ INSERT with non-matching id type or value returns SQLConstraintViolation at commit time

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-PROPERTY, ENT-WORK-ORDER, UJ-12 · Pass: 3_

    _Decomposition rationale:_ Data type consistency is a concrete implementation choice required to satisfy the architectural integrity commitment.

    _Surfaced assumptions:_ A-0342, A-0343, A-0344
##### FR-WO-FK-2 `[Tier C · pending]`

**As a** API Developer, **I want** Validate property_id existence against ENT-PROPERTY registry before persistence, **so that** Request rejected with 400 Bad Request before database write.

**Acceptance criteria:**
  - **AC-VAL-01** — API endpoint rejects payload without existing property reference.
    - _Measurable:_ HTTP 400 response sent when work_order.property_id is missing or not found in ENT-PROPERTY lookup

_Status: pending · Priority: high · Tier: C · Traces to: US-001-3, UJ-1 · Pass: 2_

_Decomposition rationale:_ Extends the architectural commitment to the API edge, aligning with sibling US-001-3 (Schema Validation) but focusing on FK integrity rather than just field presence.

_Surfaced assumptions:_ A-0161, A-0162

  - **FR-WO-FK-2-C-01** `[Tier C · pending]`
    **As a** API Implementation Strategy, **I want** Execute synchronous lookup of ENT-PROPERTY registry before write, **so that** System validates property existence in real-time before accepting work order data.

    **Acceptance criteria:**
      - **AC-001** — Registry lookup response is awaited before commit.
        - _Measurable:_ Lookup call latency < write timeout for every request with property_id field

    _Status: pending · Priority: critical · Tier: C · Traces to: US-001-3, FR-WO-FK-1 · Pass: 3_

    _Decomposition rationale:_ Defines the architectural timing strategy (Synchronous vs Asynchronous) required to meet the 'before database write' constraint.

    _Surfaced assumptions:_ A-0345, A-0346
  - **FR-WO-FK-2-C-02** `[Tier D · atomic]`
    **As a** Leaf Operation, **I want** Reject request if property_id is missing or null, **so that** Client receives immediate 400 error without attempting write.

    **Acceptance criteria:**
      - **AC-002** — Response code is 400 when property_id is absent.
        - _Measurable:_ HTTP Status Code === 400 for all payloads where payload.property_id === null or undefined

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-1, US-001-3 · Pass: 3_

    _Decomposition rationale:_ Atomic verification of payload structure before validation logic is invoked.

    _Surfaced assumptions:_ A-0345, A-0346
  - **FR-WO-FK-2-C-03** `[Tier D · atomic]`
    **As a** Leaf Operation, **I want** Return 400 Bad Request with property lookup details, **so that** User receives actionable guidance on missing property reference.

    **Acceptance criteria:**
      - **AC-003** — Response body contains reference to ENT-PROPERTY error.
        - _Measurable:_ Response JSON includes 'error' object referencing 'ENT-PROPERTY' domain

    _Status: atomic · Priority: high · Tier: D · Traces to: FR-WO-FK-4, UJ-1 · Pass: 3_

    _Decomposition rationale:_ Ensures the error message aligns with FR-WO-FK-4 (User receives actionable guidance) requirements.

    _Surfaced assumptions:_ A-0345, A-0346
##### FR-WO-FK-4 `[Tier D · atomic]`

**As a** Validation Operator, **I want** Display specific error message referencing required Property Address field, **so that** User receives actionable guidance to link a valid property during job creation.

**Acceptance criteria:**
  - **AC-MSG-01** — Error message explicitly mentions 'Property Address ID required'.
    - _Measurable:_ HTTP 400 response body contains string matching 'Property Address' and 'Required'

_Status: atomic · Priority: low · Tier: D · Traces to: UJ-1 · Pass: 2_

_Decomposition rationale:_ This child defines the leaf-level UI interaction outcome for the user when the architectural constraint is violated at the API layer.

_Surfaced assumptions:_ A-0161, A-0162

##### FR-WO-FK-3 `[downgraded]`

**As a** System Architect, **I want** Define retention policy for Work Orders referencing deleted Properties, **so that** Orphaned Work Orders are preserved with an 'orphaned' flag during lifecycle management.

**Acceptance criteria:**
  - **AC-RET-01** — Existing Work Orders remain queryable after referenced Property is archived/deleted.
    - _Measurable:_ SELECT query on ENT-WORK-ORDER returns rows even if referenced ENT-PROPERTY.id does not exist in primary key table

_Status: downgraded · Priority: medium · Traces to: US-001-4, UJ-1 · Pass: 3_

  - **FR-WO-FK-3.1** `[Tier B · pending]`
    **As a** Architecture Policy, **I want** Define Property Retirement State Mechanism, **so that** Property rows are never physically deleted to satisfy FK constraints on existing Work Orders.

    **Acceptance criteria:**
      - **AC-001** — Property deletion is implemented as a status flag change ('retired') rather than a database DELETE statement.
        - _Measurable:_ Query on ENT-PROPERTY WHERE id = {X} always returns a row with 'status' != null for any ID in ENT-WORK-ORDER ENT-WORK-ORDER foreign key references.

    _Status: pending · Priority: critical · Tier: B · Traces to: FR-WO-FK-1, UJ-1 · Pass: 3_

    _Decomposition rationale:_ Directly addresses the conflict between standard FK constraints (FR-WO-FK-1) and the requirement to retain Work Orders (FR-WO-FK-3). This Tier B child establishes the necessary governing rule: soft-deletion.

    _Surfaced assumptions:_ A-0372, A-0373, A-0374
  - **FR-WO-FK-3.2** `[Tier C · pending]`
    **As a** Database Engineer, **I want** Add Orphan Status Column to Work Order Entity, **so that** System has an explicit indicator for orphaned Work Orders in the schema.

    **Acceptance criteria:**
      - **AC-002** — ENT-WORK-ORDER table includes boolean column 'is_orphaned'.
        - _Measurable:_ SELECT column_name FROM information_schema.columns WHERE table_name='WORK_ORDER' AND column_name='is_orphaned' returns 'is_orphaned'.

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-1, WF-2 · Pass: 3_

    _Decomposition rationale:_ Concrete implementation decision required to support the policy from FR-WO-FK-3.1. This moves the commitment from a rule to a data structure change.

    _Surfaced assumptions:_ A-0372, A-0373, A-0374
  - **FR-WO-FK-3.3** `[Tier C · pending]`
    **As a** Workflow Developer, **I want** Configure Property Status Change Trigger, **so that** Orphan flag updates immediately when property status changes to retired.

    **Acceptance criteria:**
      - **AC-003** — Trigger logic executes on ENT-PROPERTY status update without latency exceeding 5 minutes.
        - _Measurable:_ Latency between ENT-PROPERTY status change and ENT-WORK-ORDER 'is_orphaned' update measurement <= 300000ms.

    _Status: pending · Priority: medium · Tier: C · Traces to: UJ-1, WF-2 · Pass: 3_

    _Decomposition rationale:_ Defines the behavioral commitment for the status change event. Ensures the lifecycle management requirement is met actively.

    _Surfaced assumptions:_ A-0372, A-0373, A-0374
  - **FR-WO-FK-3.4** `[Tier D · atomic]`
    **As a** Deployment Operator, **I want** Execute Batch Flag Update for Historical Data, **so that** Historical Work Orders referencing retired properties are automatically flagged during migration or onboarding.

    **Acceptance criteria:**
      - **AC-004** — Migration script updates existing rows referencing retired properties.
        - _Measurable:_ EXECUTE UPDATE ENT-WORK-ORDER SET is_orphaned=true WHERE property_id IN (SELECT id FROM ENT-PROPERTY WHERE status='retired') succeeds without constraint violations.

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-1, A-0161 · Pass: 3_

    _Decomposition rationale:_ Terminal action required to bring existing data into compliance with the new policy. AC is individually testable as a single data operation.

    _Surfaced assumptions:_ A-0372, A-0373, A-0374
#### US-001-4 `[downgraded]`

**As a** Audit Constraint, **I want** Log creation event to system audit trail, **so that** Creation is recorded immutably for compliance review.

**Acceptance criteria:**
  - **AC-004** — Audit entry exists for every new Work Order.
    - _Measurable:_ query(audit_logs).exists WHERE type === 'WO_CREATED' AND target_id === new_wo_id

_Status: downgraded · Priority: critical · Traces to: ENT-AUDIT-LOG, COMP-1 · Pass: 2_

##### FR-AUD-1.1 `[Tier C · pending]`

**As a** Implementation commitment, **I want** Persist audit entry synchronously upon primary record commit, **so that** Audit entry exists immediately after Work Order creation succeeds.

**Acceptance criteria:**
  - **AC-001** — Audit entry is present in storage within 10ms of commit.
    - _Measurable:_ query(audit_logs).exists WHERE target_id === wo_id AND timestamp >= wo_timestamp

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-WORK-ORDER, ENT-AUDIT-LOG · Pass: 2_

_Decomposition rationale:_ Defines the consistency requirement for the audit trail relative to the primary workflow (AC-004), ensuring no lag allows for state divergence.

_Surfaced assumptions:_ A-0163, A-0164, A-0165, A-0166

  - **FR-AUD-1.1.1** `[Tier C · pending]`
    **As a** Database Coordinator, **I want** Enforce atomic transaction boundary for Work Order and Audit Log writes, **so that** Work Order and Audit Log persist together or neither persists.

    **Acceptance criteria:**
      - **AC-001.1** — Transaction rollback on Audit failure
        - _Measurable:_ IF AUDIT_WRITE_ERROR THEN WORK_ORDER_TXN_STATUS == ROLLBACK

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-WORK-ORDER, ENT-AUDIT-LOG · Pass: 3_

    _Decomposition rationale:_ Binding persistence consistency to a single transaction ensures the primary requirement (immediate existence) is honored without violating integrity.

    _Surfaced assumptions:_ A-0347, A-0348
  - **FR-AUD-1.1.2** `[Tier C · pending]`
    **As a** Schema Validator, **I want** Validate Audit Entry payload against required JSON schema before persistence, **so that** Only well-formed audit entries are written to storage.

    **Acceptance criteria:**
      - **AC-001.2** — Schema validation on write
        - _Measurable:_ PAYLOAD matches JSON Schema Audit-Entry-v1

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-AUDIT-LOG · Pass: 3_

    _Decomposition rationale:_ Ensures structural correctness of the persisted record, preventing corruption or parsing errors on read.

    _Surfaced assumptions:_ A-0347, A-0348
  - **FR-AUD-1.1.3** `[Tier D · atomic]`
    **As a** Persistence Operator, **I want** Execute single atomic database write for audit entry, **so that** Audit entry record is inserted into storage layer.

    **Acceptance criteria:**
      - **AC-001.3** — Write operation returns success
        - _Measurable:_ DATABASE_RETURN_VALUE == SUCCESS OR ERROR_CODE == TIMEOUT

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-AUDIT-LOG, FR-AUD-1.2 · Pass: 3_

    _Decomposition rationale:_ This is the terminal leaf operation that performs the actual storage action; it traces to the storage strategy sibling to confirm the storage path.

    _Surfaced assumptions:_ A-0347, A-0348
##### FR-AUD-1.3 `[Tier C · pending]`

**As a** Implementation commitment, **I want** Include cryptographic hash of event data in log record, **so that** Data integrity can be verified against stored hash.

**Acceptance criteria:**
  - **AC-003** — Stored hash matches live record content.
    - _Measurable:_ verify(hash(audit_entry_data)) === stored_hash_value

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-AUDIT-LOG · Pass: 2_

_Decomposition rationale:_ Concrete implementation choice for integrity verification (Tier C) that binds the commitment to an algorithmic process.

_Surfaced assumptions:_ A-0163, A-0164, A-0165, A-0166

  - **FR-AUD-1.3.1** `[Tier C · pending]`
    **As a** Security Architect, **I want** Commit to SHA-256 hashing algorithm, **so that** Hash function produces a standard 64-character hex digest.

    **Acceptance criteria:**
      - **AC-004** — Hash function output length is 64 hex characters.
        - _Measurable:_ length(hex_digest) === 64

    _Status: pending · Priority: high · Tier: C · Traces to: FR-AUD-1.3, ENT-AUDIT-LOG · Pass: 3_

    _Decomposition rationale:_ Selecting a specific hash algorithm is an implementation choice; SHA-256 is the industry standard for audit integrity and satisfies collision resistance requirements without needing further scope decomposition.
  - **FR-AUD-1.3.2** `[Tier C · pending]`
    **As a** Backend Engineer, **I want** Hash full payload before persisting, **so that** Hash covers all mutable fields except immutable system fields.

    **Acceptance criteria:**
      - **AC-005** — Hash input includes all event fields.
        - _Measurable:_ hash_input == JSON.stringify(full_record)

    _Status: pending · Priority: high · Tier: C · Traces to: FR-AUD-1.3, FR-AUD-1.4 · Pass: 3_

    _Decomposition rationale:_ Defining the input scope for hashing ensures that any modification to any field breaks the integrity check; FR-AUD-1.4 confirms payload includes identity, so we hash the full context.
  - **FR-AUD-1.3.3** `[Tier D · atomic]`
    **As a** QA Engineer, **I want** Compute hash on read to verify integrity, **so that** Read-side process returns integrity status.

    **Acceptance criteria:**
      - **AC-006** — Computed hash matches stored hash value.
        - _Measurable:_ verify(hash(retrieved_data)) === stored_hash_value

    _Status: atomic · Priority: critical · Tier: D · Traces to: FR-AUD-1.3, ENT-AUDIT-LOG · Pass: 3_

    _Decomposition rationale:_ Atomic verification step; once the record is written (FR-AUD-1.3.2) and stored, the system must be able to verify integrity at any read point without further decomposition.
##### FR-AUD-1.4 `[Tier C · pending]`

**As a** Implementation commitment, **I want** Log entry payload includes actor identity and session token, **so that** Every event is attributable to a specific user/action context.

**Acceptance criteria:**
  - **AC-004** — Log record contains user_id and session_id fields.
    - _Measurable:_ audit_entry.schema.contains(user_id, session_id)

_Status: pending · Priority: high · Tier: C · Traces to: ENT-AUDIT-LOG, TECH-8 · Pass: 2_

_Decomposition rationale:_ Defines the scope of the event payload, ensuring accountability without requiring external authority citation.

_Surfaced assumptions:_ A-0163, A-0164, A-0165, A-0166

  - **FR-AUD-1.4.1** `[Tier C · pending]`
    **As a** Backend Service, **I want** Resolve user_id from Auth Context (Better-Auth), **so that** Every audit log record contains the resolved user identifier from the active auth session.

    **Acceptance criteria:**
      - **AC-004.1** — Log record user_id matches the current authenticated user
        - _Measurable:_ log.user_id === auth_context.claims.sub

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-AUDIT-LOG, TECH-11 · Pass: 3_

    _Decomposition rationale:_ Decomposes the requirement into the specific source of truth for the user identity. Commits to using TECH-11 (Better-Auth) as the provider for user resolution, ensuring consistency across the platform.

    _Surfaced assumptions:_ A-0349
  - **FR-AUD-1.4.2** `[Tier C · pending]`
    **As a** Backend Service, **I want** Capture session_id from Auth Context, **so that** Every audit log record contains the active session identifier for correlation.

    **Acceptance criteria:**
      - **AC-004.2** — Log record session_id matches the active session token string
        - _Measurable:_ log.session_id === auth_context.session_token

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-AUDIT-LOG, ENT-SESSION-TOKEN · Pass: 3_

    _Decomposition rationale:_ Decomposes the requirement into the specific source for session correlation. Defines that the session_id is the opaque token provided by the session manager to prevent ambiguity.

    _Surfaced assumptions:_ A-0349
  - **FR-AUD-1.4.3** `[Tier D · atomic]`
    **As a** Persistence Layer, **I want** Persist identity fields to audit record schema, **so that** The audit log storage layer physically stores user_id and session_id.

    **Acceptance criteria:**
      - **AC-004.3** — Row contains non-null user_id and session_id upon write
        - _Measurable:_ NOT IS NULL(log.user_id) AND NOT IS NULL(log.session_id)

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-AUDIT-LOG, TECH-8 · Pass: 3_

    _Decomposition rationale:_ This is the atomic leaf operation where the data is actually written. Validates that the schema commitment (from Tier B) is realized in the persistence layer defined in TECH-8.

    _Surfaced assumptions:_ A-0349
##### FR-AUD-1.2 `[downgraded]`

**As a** Architectural choice, **I want** Enforce append-only storage strategy for audit records, **so that** Log records cannot be deleted or overwritten by application writes.

**Acceptance criteria:**
  - **AC-002** — No DELETE or UPDATE operations allowed on audit log storage.
    - _Measurable:_ DENY UPDATE/DELETE on ENT-AUDIT-LOG schema or object bucket

_Status: downgraded · Priority: critical · Traces to: COMP-1, ENT-AUDIT-LOG · Pass: 3_

  - **FR-AUD-1.2.1** `[Tier C · pending]`
    **As a** API Gateway Operator, **I want** Reject HTTP mutation requests targeting audit log endpoints, **so that** No HTTP 200 response for PUT/POST/DELETE on /audit-log paths.

    **Acceptance criteria:**
      - **AC-002a** — Mutation requests are blocked with 403 Forbidden.
        - _Measurable:_ All PUT/POST/DELETE requests to ENT-AUDIT-LOG endpoints return HTTP 403.

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-AUD-1.1, ENT-AUDIT-LOG · Pass: 3_

    _Decomposition rationale:_ This child implements the enforcement boundary at the network ingress layer, preventing unauthorized writes before they reach the storage engine, independent of the specific storage engine chosen.

    _Surfaced assumptions:_ A-0375, A-0376, A-0377, A-0378
  - **FR-AUD-1.2.2** `[Tier C · pending]`
    **As a** Storage Engine Operator, **I want** Enable write-once-read-many semantics on audit log storage, **so that** Audit entries persist immutably after initial write event.

    **Acceptance criteria:**
      - **AC-002b** — Deleted or overwritten records are not recoverable from storage.
        - _Measurable:_ Storage layer metadata flags (WORM/versioning) or RLS policies prevent any mutation on existing audit row.

    _Status: pending · Priority: critical · Tier: C · Traces to: COMP-1, ENT-AUDIT-LOG · Pass: 3_

    _Decomposition rationale:_ This child enforces the requirement at the data persistence layer, ensuring that even if the API layer is bypassed, the storage medium respects the immutability constraint.

    _Surfaced assumptions:_ A-0375, A-0376, A-0377, A-0378
  - **FR-AUD-1.2.3** `[Tier C · pending]`
    **As a** Application Logic Enforcer, **I want** Validate audit log schema for immutability flags before commit, **so that** Application logic rejects any write that violates immutability schema constraints.

    **Acceptance criteria:**
      - **AC-002c** — Schema-level write constraints prevent non-admin writes.
        - _Measurable:_ Database transactions on ENT-AUDIT-LOG containing non-admin roles fail validation checks.

    _Status: pending · Priority: high · Tier: C · Traces to: FR-AUD-1.1, ENT-AUDIT-LOG · Pass: 3_

    _Decomposition rationale:_ Ensures that the business application itself adheres to the append-only rule before attempting persistence, serving as a defense-in-depth measure.

    _Surfaced assumptions:_ A-0375, A-0376, A-0377, A-0378
  - **FR-AUD-1.2.4** `[Tier B · pending]`
    **As a** Compliance Strategist, **I want** Bind audit log retention policy to immutability enforcement, **so that** Immutability constraints persist for the full duration of the retention period.

    **Acceptance criteria:**
      - **AC-002d** — Immutability flags are cleared only after retention expiry.
        - _Measurable:_ Immutability constraints on ENT-AUDIT-LOG remain active until compliance retention period (7 years) elapses per A-0163.

    _Status: pending · Priority: high · Tier: B · Traces to: COMP-1, A-0163 · Pass: 3_

    _Decomposition rationale:_ This child defines the policy boundary for how long the immutability constraint is required, linking architectural choice to regulatory obligation.

    _Surfaced assumptions:_ A-0375, A-0376, A-0377, A-0378
  - **FR-AUD-1.2.5** `[Tier C · pending]`
    **As a** Error Handling Specialist, **I want** Log failed mutation attempts with audit context, **so that** Attempts to violate immutability are recorded in a secondary immutable log.

    **Acceptance criteria:**
      - **AC-002e** — Blocked mutation events are recorded for forensic analysis.
        - _Measurable:_ Event log captures 403 responses with actor identity and attempt timestamp.

    _Status: pending · Priority: medium · Tier: C · Traces to: FR-AUD-1.4, ENT-AUDIT-LOG · Pass: 3_

    _Decomposition rationale:_ Provides visibility into enforcement attempts without violating the primary audit log integrity, supporting the 'No overwrite' constraint via side-channel logging.

    _Surfaced assumptions:_ A-0375, A-0376, A-0377, A-0378
### FR US-002 `[pending]`

**As a** Homeowner, **I want** View Work Order status updates, **so that** User sees status transition from Open to Scheduled or Completed.

**Acceptance criteria:**
  - **AC-003** — Status updates propagate
    - _Measurable:_ Status change visible on Dashboard within 30 seconds of technician input
  - **AC-004** — Notification delivered
    - _Measurable:_ ENT-NOTIFY-LOG records successful delivery to user's channel within 5 minutes

_Status: pending · Priority: high · Traces to: UJ-2, WF-2, WF-6, ENT-NOTIFY-LOG · Pass: 0_

#### US-002-1.1 `[Tier B · pending]`

**As a** State Machine Enforcer, **I want** Validate status transitions against the Work Order state machine schema, **so that** Only defined state transitions (e.g., Open -> Scheduled) are allowed.

**Acceptance criteria:**
  - **AC-003.1** — State transitions adhere to the workflow graph.
    - _Measurable:_ Workflow engine rejects invalid state transitions at write time

_Status: pending · Priority: critical · Tier: B · Traces to: WF-2 · Pass: 1_

_Decomposition rationale:_ This child binds the system behavior to the governing workflow rules defined in WF-2, ensuring the transition promise is honored as a policy choice.

_Surfaced assumptions:_ A-0004, A-0005, A-0006

##### US-002-1.1-C1 `[Tier C · pending]`

**As a** Workflow Architect, **I want** Define transition graph schema version loaded into DBOS, **so that** Workflow engine graph schema loaded matches WF-2 specification.

**Acceptance criteria:**
  - **AC-003.1.1** — Schema version is consistent with active WF-2 graph.
    - _Measurable:_ graph_schema_version === WF-2_latest_version

_Status: pending · Priority: high · Tier: C · Traces to: WF-2 · Pass: 2_

_Decomposition rationale:_ Commitment to versioning the transition graph ensures the schema enforcement aligns with the active workflow definition.

_Surfaced assumptions:_ A-0167, A-0168

  - **US-002-1.1-C1-D1** `[Tier D · atomic]`
    **As a** State Manager, **I want** Write active schema version identifier to DBOS state store, **so that** Runtime config contains the version string.

    **Acceptance criteria:**
      - **AC-D1** — Version field is populated in the active configuration record
        - _Measurable:_ config.get('graph_schema_version') === active_version_id

    _Status: atomic · Priority: high · Tier: D · Traces to: WF-2 · Pass: 3_

    _Decomposition rationale:_ Persistence of the version identifier is the prerequisite for any runtime lookup.

    _Surfaced assumptions:_ A-0350
  - **US-002-1.1-C1-D2** `[Tier D · atomic]`
    **As a** Schema Validator, **I want** Compare loaded graph checksum against WF-2 specification, **so that** Graph integrity confirmed against spec.

    **Acceptance criteria:**
      - **AC-D2** — Loaded graph hash matches expected WF-2 hash
        - _Measurable:_ sha256(loaded_graph) === wf2_spec_hash

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-2 · Pass: 3_

    _Decomposition rationale:_ Integrity check ensures the loaded graph is the published WF-2 spec, preventing drift.

    _Surfaced assumptions:_ A-0350
  - **US-002-1.1-C1-D3** `[Tier D · atomic]`
    **As a** Context Injector, **I want** Expose version variable to DBOS execution context, **so that** Workflow functions can read the active version.

    **Acceptance criteria:**
      - **AC-D3** — Version variable is accessible during function execution
        - _Measurable:_ runtime.context.has('graph_schema_version') === true

    _Status: atomic · Priority: medium · Tier: D · Traces to: WF-2 · Pass: 3_

    _Decomposition rationale:_ Runtime context injection enables engine logic to branch based on active version.

    _Surfaced assumptions:_ A-0350
##### US-002-1.1-C2 `[Tier C · pending]`

**As a** DB Enforcer, **I want** Enforce atomic validation at write time within DBOS transaction, **so that** Database transaction rolls back if transition check fails.

**Acceptance criteria:**
  - **AC-003.1.2** — Invalid transition triggers rollback of work order state.
    - _Measurable:_ write_operation_success === false IF transition_is_valid === false

_Status: pending · Priority: critical · Tier: C · Traces to: WF-2, TECH-7 · Pass: 2_

_Decomposition rationale:_ Ensures data consistency by binding validation logic to the transactional boundary.

_Surfaced assumptions:_ A-0167, A-0168

  - **US-002-1.1-C2-1** `[Tier C · pending]`
    **As a** System, **I want** Validate transition state against WF-2 graph, **so that** Transition logic passes if current state matches target state in graph.

    **Acceptance criteria:**
      - **AC-001** — Transition validation function returns true.
        - _Measurable:_ WF-2_graph.check(current_state, target_state) === true

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-2, TECH-7 · Pass: 3_

    _Decomposition rationale:_ Validating the transition graph is the core functional check required to determine validity; separates from transaction mechanics.

    _Surfaced assumptions:_ A-0351, A-0352
  - **US-002-1.1-C2-2** `[Tier C · pending]`
    **As a** System, **I want** Enforce DBOS transaction boundary around write, **so that** Write operation is atomic with respect to DBOS workflow.

    **Acceptance criteria:**
      - **AC-002** — Write operation is wrapped in DBOS transaction context.
        - _Measurable:_ dbos.transaction_scope.contains(write_op) === true

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-7 · Pass: 3_

    _Decomposition rationale:_ Ensures the transactional boundary exists so that failure triggers rollback; distinct from the validation logic itself.

    _Surfaced assumptions:_ A-0351, A-0352
  - **US-002-1.1-C2-3** `[Tier C · pending]`
    **As a** System, **I want** Execute rollback on validation failure, **so that** Previous state is restored on failed transition check.

    **Acceptance criteria:**
      - **AC-003** — Rollback is triggered when validation is false.
        - _Measurable:_ dbos.rollback() === true IF !transition_is_valid

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-2, TECH-7 · Pass: 3_

    _Decomposition rationale:_ Defines the consequence of invalidation; this is the enforcement mechanism that ensures data integrity upon failure.

    _Surfaced assumptions:_ A-0351, A-0352
##### US-002-1.1-C3 `[Tier D · atomic]`

**As a** Error Handler, **I want** Surface rejection error payload to client application, **so that** Client receives 400 Bad Request with human-readable error message.

**Acceptance criteria:**
  - **AC-003.1.3** — HTTP response status matches invalid transition event.
    - _Measurable:_ http_status_code === 400

_Status: atomic · Priority: medium · Tier: D · Traces to: WF-2, ENT-NOTIFY-TPL · Pass: 2_

_Decomposition rationale:_ Concrete leaf operation defining the client-facing response when the state machine is violated.

_Surfaced assumptions:_ A-0167, A-0168

#### US-002-1.2 `[Tier C · pending]`

**As a** State Update Operator, **I want** Update ENT-WORK-ORDER status field on event trigger, **so that** The work order record reflects the new status in the database.

**Acceptance criteria:**
  - **AC-003.2** — Database status field changes atomically.
    - _Measurable:_ ENT-WORK-ORDER.status equals new value at commit time

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-WORK-ORDER, WF-2 · Pass: 1_

_Decomposition rationale:_ This child defines the atomic data change required to satisfy the state transition policy.

_Surfaced assumptions:_ A-0004, A-0005, A-0006

##### US-002-1.2-01 `[Tier D · atomic]`

**As a** DB Writer, **I want** Write status value to ENT-WORK-ORDER.status, **so that** ENT-WORK-ORDER.status contains new value upon transaction completion.

**Acceptance criteria:**
  - **AC-004** — Row status matches new value at commit.
    - _Measurable:_ SELECT status FROM ENT-WORK-ORDER WHERE id = :id AND status = :new_value returns true

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-WORK-ORDER, WF-2 · Pass: 2_

_Decomposition rationale:_ Core persistence operation required to satisfy the functional update need. This is the terminal data modification step.

_Surfaced assumptions:_ A-0052, A-0053

##### US-002-1.2-02 `[Tier D · atomic]`

**As a** Transaction Manager, **I want** Commit or rollback DB transaction on workflow signal, **so that** Transaction scope completes without indefinite locking.

**Acceptance criteria:**
  - **AC-005** — Transaction ends within 5 seconds of start.
    - _Measurable:_ EXTRACT (NOW() - transaction_start) FROM db_transaction_logs WHERE status = 'COMMITTED' OR status = 'ROLLEDBACK'

_Status: atomic · Priority: critical · Tier: D · Traces to: TECH-8, WF-2, US-002-1.2 · Pass: 2_

_Decomposition rationale:_ Ensures atomicity and availability (AC-003.2). This is the implementation commitment defining the transaction boundary and timeout constraint.

_Surfaced assumptions:_ A-0052, A-0053

#### US-002-1.3 `[Tier C · pending]`

**As a** Notification Dispatcher, **I want** Write successful delivery record to ENT-NOTIFY-LOG, **so that** Delivery success logged within 5 minutes.

**Acceptance criteria:**
  - **AC-004.1** — Notification log entry created for delivery success.
    - _Measurable:_ ENT-NOTIFY-LOG record exists within 5 minutes of user action

_Status: pending · Priority: high · Tier: C · Traces to: ENT-NOTIFY-LOG, WF-6 · Pass: 1_

_Decomposition rationale:_ This child addresses the notification requirement by defining the audit logging mechanism that verifies delivery attempts.

_Surfaced assumptions:_ A-0004, A-0005, A-0006

##### US-002-1.3.1 `[Tier D · atomic]`

**As a** Event Consumer, **I want** Ingest delivery success event from WF-6 trigger, **so that** Event queued for logging processing.

**Acceptance criteria:**
  - **AC-001.1** — Ingestion triggered by WF-6 event.
    - _Measurable:_ event_queue_length > 0 upon WF-6 signal arrival

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-6, ENT-NOTIFY-LOG · Pass: 2_

_Decomposition rationale:_ Separates the consumption of the upstream success signal from the persistence action. Atomic verification of the trigger receipt.

_Surfaced assumptions:_ A-0054, A-0055

##### US-002-1.3.2 `[Tier D · atomic]`

**As a** Log Writer, **I want** Insert record into ENT-NOTIFY-LOG, **so that** Row persisted with delivery status and timestamp.

**Acceptance criteria:**
  - **AC-001.2** — Row inserted with status SUCCESS.
    - _Measurable:_ select * from ENT-NOTIFY-LOG where status = 'SUCCESS' count > 0

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-NOTIFY-LOG, WF-6 · Pass: 2_

_Decomposition rationale:_ Isolates the persistence mechanism. Tests against the database row count directly.

_Surfaced assumptions:_ A-0054, A-0055

##### US-002-1.3.3 `[Tier C · pending]`

**As a** SLA Monitor, **I want** Enforce 5-minute processing SLA, **so that** Alert raised or record flagged if threshold exceeded.

**Acceptance criteria:**
  - **AC-001.3** — Processing latency does not exceed 5 minutes.
    - _Measurable:_ log_creation_timestamp - event_trigger_timestamp <= 5 minutes

_Status: pending · Priority: high · Tier: C · Traces to: WF-6, ENT-NOTIFY-LOG · Pass: 2_

_Decomposition rationale:_ Commits to the specific performance constraint (5 min) as an implementation choice/threshold, distinct from the raw write action.

_Surfaced assumptions:_ A-0054, A-0055

  - **US-002-1.3.3-C-01** `[Tier C · pending]`
    **As a** Monitoring Engine, **I want** Measure processing latency between trigger and log creation, **so that** Latency value computed in seconds.

    **Acceptance criteria:**
      - **AC-001.3.1** — Latency value derived from system clocks.
        - _Measurable:_ latency_seconds = log_creation_timestamp - event_trigger_timestamp

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-6 · Pass: 3_

    _Decomposition rationale:_ Measuring the time delta is the prerequisite verification step before any enforcement logic can apply.

    _Surfaced assumptions:_ A-0179, A-0180
    - **US-002-1.3.3-C-01-1** `[Tier C · pending]`
      **As a** CAM operator, **I want** Identify WF-6 signal emission moment as event_trigger_timestamp, **so that** Trigger time is sourced from the WF-6 workflow signal emission event.

      **Acceptance criteria:**
        - **AC-001.3.1.1** — Trigger timestamp matches WF-6 emission signal.
          - _Measurable:_ event_trigger_timestamp === WF-6_signal_timestamp

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-6 · Pass: 4_

      _Decomposition rationale:_ Commits to the specific workflow signal as the source of truth for the trigger time, aligning with existing assumption A-0179 but specifying the implementation choice.

      _Surfaced assumptions:_ A-0396, A-0397, A-0398
    - **US-002-1.3.3-C-01-2** `[Tier C · pending]`
      **As a** CAM operator, **I want** Capture ENT-NOTIFY-LOG record creation time as log_creation_timestamp, **so that** Log time is sourced from the database write timestamp on ENT-NOTIFY-LOG.

      **Acceptance criteria:**
        - **AC-001.3.1.2** — Log timestamp matches ENT-NOTIFY-LOG schema field.
          - _Measurable:_ log_creation_timestamp === ENT-NOTIFY-LOG.record_timestamp

      _Status: pending · Priority: high · Tier: C · Traces to: ENT-NOTIFY-LOG · Pass: 4_

      _Decomposition rationale:_ Commits to the specific entity schema field for the sink timestamp, enabling the latency calculation defined in the parent.

      _Surfaced assumptions:_ A-0396, A-0397, A-0398
    - **US-002-1.3.3-C-01-3** `[Tier D · atomic]`
      **As a** System Operator, **I want** Compute delta between sink and source timestamps, **so that** Latency value stored in seconds (integer ms).

      **Acceptance criteria:**
        - **AC-001.3.1.3** — Latency delta is non-negative and recorded in milliseconds.
          - _Measurable:_ latency_seconds >= 0 AND latency_seconds === round(log_creation_timestamp - event_trigger_timestamp, 0)

      _Status: atomic · Priority: high · Tier: D · Traces to: UJ-12 · Pass: 4_

      _Decomposition rationale:_ Atomic implementation commitment performing the core calculation logic defined in the parent AC.

      _Surfaced assumptions:_ A-0396, A-0397, A-0398
    - **US-002-1.3.3-C-01-4** `[Tier C · pending]`
      **As a** System Operator, **I want** Persist latency metric to monitoring store, **so that** Metric stored in OpenTelemetry-compatible store with UTC normalization.

      **Acceptance criteria:**
        - **AC-001.3.1.4** — Latency is persisted in a time-series store normalized to UTC.
          - _Measurable:_ store_timestamp === ENT-NOTIFY-LOG.record_timestamp AND store_value_unit === 'ms'

      _Status: pending · Priority: medium · Tier: C · Traces to: WF-12 · Pass: 4_

      _Decomposition rationale:_ Commits to the storage mechanism and normalization rules for the latency metric, grounding this in the analytics engine.

      _Surfaced assumptions:_ A-0396, A-0397, A-0398
  - **US-002-1.3.3-C-02** `[Tier C · pending]`
    **As a** Compliance Logic, **I want** Evaluate latency against 5-minute threshold, **so that** Boolean flag indicating SLA compliance status.

    **Acceptance criteria:**
      - **AC-001.3.2** — Violation state detected if latency exceeds limit.
        - _Measurable:_ is_violation = (latency_seconds > 300 seconds)

    _Status: pending · Priority: high · Tier: C · Traces to: US-002-1.3.3-C-01 · Pass: 3_

    _Decomposition rationale:_ The threshold comparison is the specific policy check defined in the parent requirement's acceptance criteria.

    _Surfaced assumptions:_ A-0179, A-0180
    - **US-002-1.3.3-C-02-01** `[Tier D · atomic]`
      **As a** Logic Engine, **I want** Retrieve Latency Value, **so that** Latency value populated for comparison.

      **Acceptance criteria:**
        - **AC-001.3.2-01** — Latency value is successfully retrieved.
          - _Measurable:_ latency_seconds is available and > 0

      _Status: atomic · Priority: high · Tier: D · Traces to: US-002-1.3.3-C-01 · Pass: 4_

      _Decomposition rationale:_ Child 1 extracts the latency input required for the evaluation, tracing to the measurement step.

      _Surfaced assumptions:_ A-0399, A-0400, A-0401
    - **US-002-1.3.3-C-02-02** `[Tier D · atomic]`
      **As a** Logic Engine, **I want** Evaluate Violation Logic, **so that** Violation boolean computed.

      **Acceptance criteria:**
        - **AC-001.3.2-02** — Violation boolean is returned based on threshold.
          - _Measurable:_ is_violation === (latency_seconds > 300)

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-002-1.3.3-C-01 · Pass: 4_

      _Decomposition rationale:_ Child 2 performs the core compliance comparison logic against the defined threshold.

      _Surfaced assumptions:_ A-0399, A-0400, A-0401
    - **US-002-1.3.3-C-02-03** `[Tier D · atomic]`
      **As a** Logic Engine, **I want** Write Compliance Flag, **so that** Notification log entry updated.

      **Acceptance criteria:**
        - **AC-001.3.2-03** — Compliance flag persisted to log record.
          - _Measurable:_ log_entry.is_violation === result

      _Status: atomic · Priority: high · Tier: D · Traces to: US-002-1.3.3-C-03 · Pass: 4_

      _Decomposition rationale:_ Child 3 commits the resulting status to the notification log, tracing to the flagging step.

      _Surfaced assumptions:_ A-0399, A-0400, A-0401
  - **US-002-1.3.3-C-03** `[Tier D · atomic]`
    **As a** Alert Generator, **I want** Flag record in ENT-NOTIFY-LOG on violation, **so that** Notification log entry updated with SLA breach status.

    **Acceptance criteria:**
      - **AC-001.3.3** — Record persists the alert status.
        - _Measurable:_ ENT-NOTIFY-LOG row exists with status == 'SLA_EXCEEDED' when is_violation is true

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-NOTIFY-LOG · Pass: 3_

    _Decomposition rationale:_ This is the atomic reaction step (leaf operation) that materializes the enforcement requirement when a violation is found.

    _Surfaced assumptions:_ A-0179, A-0180
#### US-002-1.4 `[Tier C · pending]`

**As a** View Refresh Coordinator, **I want** Invalidate frontend cache or push real-time update to client, **so that** User sees status change on Dashboard within 30 seconds.

**Acceptance criteria:**
  - **AC-003.3** — Dashboard renders latest status.
    - _Measurable:_ WebSocket push or cache invalidation occurs within 30 seconds of DB commit

_Status: pending · Priority: high · Tier: C · Traces to: UJ-2, TECH-4 · Pass: 1_

_Decomposition rationale:_ This child addresses the visibility SLA by committing to a specific data synchronization strategy between backend and frontend.

_Surfaced assumptions:_ A-0004, A-0005, A-0006

##### US-002-1.4.1 `[Tier C · pending]`

**As a** CAM operator, **I want** Inject unique version token into real-time status signal payload, **so that** Client identifies state change by comparing signal token against stored version.

**Acceptance criteria:**
  - **AC-003.3.1** — Signal payload contains non-null version token on every update.
    - _Measurable:_ signal.payload.version_token !== null AND signal.payload.version_token === new_db_state_version

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-2, TECH-4 · Pass: 2_

_Decomposition rationale:_ Specific implementation commitment for the cache invalidation mechanism mentioned in the parent AC.

_Surfaced assumptions:_ A-0056, A-0057

  - **US-002-1.4.1.1** `[Tier C · pending]`
    **As a** Backend Engineer, **I want** Derive version token from database commit transaction context, **so that** Token value reflects the immutable state of the database record at the exact moment of the write.

    **Acceptance criteria:**
      - **AC-001** — Token value matches database commit transaction hash or row version.
        - _Measurable:_ version_token === db_row_version_at_commit OR version_token === uuidv7(time_ns + db_seq)

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-2, TECH-8 · Pass: 3_

    _Decomposition rationale:_ Committing to the source of the token is a concrete implementation choice; deriving from the DB commit ensures consistency with the 'atomic and immediately available' constraint in existing assumptions.

    _Surfaced assumptions:_ A-0181, A-0182
    - **US-002-1.4.1.1-C1** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Read DB Row Version from Commit Context, **so that** Retrieve monotonic row version atomically at commit time.

      **Acceptance criteria:**
        - **AC-001.1** — DB row version is retrieved from transaction metadata.
          - _Measurable:_ pg_current_xact_id or row version column returns value at statement completion

      _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-8 · Pass: 4_

      _Decomposition rationale:_ This is the first atomic operation of the token derivation; it isolates the database-specific mechanism required to source the row version.

      _Surfaced assumptions:_ A-0402, A-0403, A-0404
    - **US-002-1.4.1.1-C2** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Generate UUIDv7 Time-Based Token, **so that** Compute deterministic UUIDv7 using system clock and DB sequence.

      **Acceptance criteria:**
        - **AC-001.2** — Generated UUID follows UUIDv7 monotonicity rules.
          - _Measurable:_ uuidv7(time_ns + db_seq) returns a strictly increasing 128-bit value within a nanosecond clock

      _Status: atomic · Priority: high · Tier: D · Traces to: TECH-6 · Pass: 4_

      _Decomposition rationale:_ This isolates the implementation of the alternative token source (UUIDv7) and validates the specific library/algorithim used for time-based derivation.

      _Surfaced assumptions:_ A-0402, A-0403, A-0404
    - **US-002-1.4.1.1-C3** `[Tier C · pending]`
      **As a** Strategy Architect, **I want** Select Canonical Token Source, **so that** Determine which source (DB row version or UUIDv7) populates the token field.

      **Acceptance criteria:**
        - **AC-001.3** — Output token equals exactly one of the valid sources.
          - _Measurable:_ version_token equals db_row_version_at_commit OR version_token equals uuidv7(time_ns + db_seq)

      _Status: pending · Priority: critical · Tier: C · Traces to: US-002-1.4.1.4 · Pass: 4_

      _Decomposition rationale:_ This represents the logic commitment (if/else) that binds the two sub-operations to the final payload requirement, bridging implementation choices.

      _Surfaced assumptions:_ A-0402, A-0403, A-0404
    - **US-002-1.4.1.1-C4** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Inject Token into Signal Context Object, **so that** Token is prepared for downstream serialization and transmission.

      **Acceptance criteria:**
        - **AC-001.4** — Token is present in the object passed to the signal publisher.
          - _Measurable:_ signal_context.token_hash matches version_token field

      _Status: atomic · Priority: high · Tier: D · Traces to: US-002-1.4.1.2 · Pass: 4_

      _Decomposition rationale:_ This is the final atomic operation that consumes the result of the derivation and makes it available for the sibling requirement regarding payload serialization.

      _Surfaced assumptions:_ A-0402, A-0403, A-0404
  - **US-002-1.4.1.2** `[Tier C · pending]`
    **As a** Backend Engineer, **I want** Serialize version token into JSON payload field `version_token`, **so that** Client can deserialize and compare the token without parsing nested data structures.

    **Acceptance criteria:**
      - **AC-002** — Payload JSON includes a top-level string field named `version_token`.
        - _Measurable:_ signal.payload.version_token !== undefined && typeof signal.payload.version_token === 'string'

    _Status: pending · Priority: high · Tier: C · Traces to: TECH-4, UJ-2 · Pass: 3_

    _Decomposition rationale:_ Defining the field mapping is a concrete architectural implementation choice that dictates how the frontend consumes the signal (SvelteKit payload structure).

    _Surfaced assumptions:_ A-0181, A-0182
    - **FR-AC-1.2.1** `[Tier D · atomic]`
      **As a** Verification Engineer, **I want** Ensure field `version_token` exists in JSON., **so that** Key `version_token` is present in the signal payload..

      **Acceptance criteria:**
        - **AC-001** — Payload contains the `version_token` key.
          - _Measurable:_ signal.payload.version_token !== undefined

      _Status: atomic · Priority: high · Tier: D · Traces to: UJ-2 · Pass: 4_

      _Decomposition rationale:_ Defines presence of the required JSON property as the first structural validation step.

      _Surfaced assumptions:_ A-0405
    - **FR-AC-1.2.2** `[Tier D · atomic]`
      **As a** Verification Engineer, **I want** Ensure field `version_token` is String., **so that** Field `version_token` is a string type for frontend safety..

      **Acceptance criteria:**
        - **AC-002** — Payload `version_token` is a String.
          - _Measurable:_ typeof signal.payload.version_token === 'string'

      _Status: atomic · Priority: high · Tier: D · Traces to: TECH-4 · Pass: 4_

      _Decomposition rationale:_ Enforces type safety for frontend deserialization matching SvelteKit expectations.

      _Surfaced assumptions:_ A-0405
    - **FR-AC-1.2.3** `[Tier D · atomic]`
      **As a** Verification Engineer, **I want** Ensure field `version_token` value matches source., **so that** Field `version_token` matches value derived from commit context..

      **Acceptance criteria:**
        - **AC-003** — Field value matches source context token.
          - _Measurable:_ signal.payload.version_token === token_from_context

      _Status: atomic · Priority: high · Tier: D · Traces to: US-002-1.4.1.1 · Pass: 4_

      _Decomposition rationale:_ Binds serialization to the derived token source defined in sibling derivation logic.

      _Surfaced assumptions:_ A-0405
  - **US-002-1.4.1.3** `[Tier D · atomic]`
    **As a** System Operator, **I want** Publish signal event after database transaction successfully commits, **so that** Client receives signal only after the new state is guaranteed to be persistent.

    **Acceptance criteria:**
      - **AC-003** — No signal emitted if `pg_commit` returns error or rolls back.
        - _Measurable:_ signal_published === false WHEN (db_transaction_status = 'rolled_back')

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-2, UJ-2 · Pass: 3_

    _Decomposition rationale:_ This is an atomic system operation (publish if success, do not publish if fail) that is individually testable, making it a leaf operation.

    _Surfaced assumptions:_ A-0181, A-0182
  - **US-002-1.4.1.4** `[Tier D · atomic]`
    **As a** Backend Engineer, **I want** Construct signal payload with `version_token` from commit context, **so that** Final JSON blob ready for WebSocket transmission.

    **Acceptance criteria:**
      - **AC-004** — Payload constructed exactly as JSON object before serializing.
        - _Measurable:_ JSON.stringify(payload) includes 'version_token' field AND payload matches expected schema version v1

    _Status: atomic · Priority: high · Tier: D · Traces to: TECH-4, TECH-6 · Pass: 3_

    _Decomposition rationale:_ The construction of the payload is the atomic step following the commit context and field mapping.

    _Surfaced assumptions:_ A-0181, A-0182
##### US-002-1.4.2 `[Tier C · pending]`

**As a** CAM operator, **I want** Maintain persistent WebSocket connection on client Dashboard component, **so that** Client receives push notification without polling when status changes occur.

**Acceptance criteria:**
  - **AC-003.3.2** — WebSocket connection remains open and active for status updates.
    - _Measurable:_ client.ws.connection_state === 'open' within 1 minute of user session start

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-2, TECH-4 · Pass: 2_

_Decomposition rationale:_ Specific implementation commitment for the WebSocket push mechanism mentioned in the parent AC.

_Surfaced assumptions:_ A-0056, A-0057

  - **FR-ACCT-1.2** `[Tier C · pending]`
    **As a** Reconnection Backoff, **I want** Initiate reconnection attempt with exponential backoff on failure, **so that** Client reconnects to server after defined delay sequences.

    **Acceptance criteria:**
      - **AC-102** — First reconnect attempt occurs after 1s delay.
        - _Measurable:_ Connection attempt scheduled at timestamp = failure_timestamp + 1000ms

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-9, ENT-SESSION-TOKEN · Pass: 3_

    _Decomposition rationale:_ Defines the failure recovery strategy (backoff) to ensure the system handles transient network issues without indefinite blocking.

    _Surfaced assumptions:_ A-0183, A-0184
    - **FR-ACCT-1.2.1** `[Tier C · pending]`
      **As a** Configuration Commitment, **I want** Initialize retry delay to 1000ms upon first failure, **so that** First reconnect attempt waits 1s before scheduling.

      **Acceptance criteria:**
        - **AC-1.2.1-A** — Delay is exactly 1s on first failure.
          - _Measurable:_ scheduled_timestamp === failure_timestamp + 1000ms for attempt #1

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-9, ENT-SESSION-TOKEN · Pass: 4_

      _Decomposition rationale:_ This commits to the specific implementation value of the base delay parameter. It is a concrete engineering choice required to satisfy the parent AC.

      _Surfaced assumptions:_ A-0406, A-0407, A-0408
    - **FR-ACCT-1.2.2** `[Tier C · pending]`
      **As a** Algorithm Commitment, **I want** Apply 2.0 multiplier to delay for each subsequent failure, **so that** Retry delay grows exponentially (1s, 2s, 4s, ...).

      **Acceptance criteria:**
        - **AC-1.2.2-A** — Delay for attempt N = Delay(N-1) * 2.
          - _Measurable:_ delay_attempt[2] === delay_attempt[1] * 2 && delay_attempt[3] === delay_attempt[2] * 2

      _Status: pending · Priority: high · Tier: C · Traces to: WF-9, UJ-12 · Pass: 4_

      _Decomposition rationale:_ This defines the mathematical progression of the backoff algorithm. It rules out linear backoff (e.g., fixed 1s) and specific constant delays.

      _Surfaced assumptions:_ A-0406, A-0407, A-0408
    - **FR-ACCT-1.2.3** `[Tier C · pending]`
      **As a** Constraint Commitment, **I want** Cap maximum retry delay at 60 seconds, **so that** Delays do not exceed 60s to prevent connection starvation.

      **Acceptance criteria:**
        - **AC-1.2.3-A** — Delay does not exceed 60s.
          - _Measurable:_ delay_attempt[N] <= 60000ms for all N

      _Status: pending · Priority: high · Tier: C · Traces to: WF-9, ENT-SESSION-TOKEN · Pass: 4_

      _Decomposition rationale:_ This is a system-side restriction preventing resource exhaustion or indefinite wait states. It acts as a hard constraint on the algorithm.

      _Surfaced assumptions:_ A-0406, A-0407, A-0408
    - **FR-ACCT-1.2.4** `[Tier C · pending]`
      **As a** State Management, **I want** Persist backoff state in client-side session storage, **so that** Backoff progress is tracked per user session without server persistence.

      **Acceptance criteria:**
        - **AC-1.2.4-A** — Current delay and attempt count are stored.
          - _Measurable:_ session_storage.retry_state.current_delay === calculated_delay AND session_storage.retry_state.attempt_count === N

      _Status: pending · Priority: medium · Tier: C · Traces to: ENT-SESSION-TOKEN, ENT-USER · Pass: 4_

      _Decomposition rationale:_ This defines the storage mechanism for the algorithmic state. It confirms that server-side DB is not used for this specific flow, aligning with client-side resilience.

      _Surfaced assumptions:_ A-0406, A-0407, A-0408
    - **FR-ACCT-1.2.5** `[Tier D · atomic]`
      **As a** Leaf Operation, **I want** Schedule next WebSocket connection attempt via setTimeout or Promise, **so that** Timer fires and invokes reconnect handler at calculated time.

      **Acceptance criteria:**
        - **AC-1.2.5-A** — Timer clears and reconnection logic triggers on tick.
          - _Measurable:_ setTimeout callback fires AND client.connect() is invoked within 10ms of scheduled_time

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-9, ENT-SESSION-TOKEN · Pass: 4_

      _Decomposition rationale:_ This is the atomic action executed by the system. It verifies the final step of the backoff loop: actually initiating the next connection.

      _Surfaced assumptions:_ A-0406, A-0407, A-0408
    - **FR-ACCT-1.2.6** `[Tier C · pending]`
      **As a** Failure Condition, **I want** Reset backoff delay to 1s upon successful reconnection, **so that** State resets for subsequent failures after successful recovery.

      **Acceptance criteria:**
        - **AC-1.2.6-A** — Delay resets to 1s on success.
          - _Measurable:_ if (reconnection_successful) then set_retry_delay(1000ms)

      _Status: pending · Priority: high · Tier: C · Traces to: WF-9, ENT-SESSION-TOKEN · Pass: 4_

      _Decomposition rationale:_ This defines the reset policy. It distinguishes between network failure (backoff) and transient glitches (reset), ensuring system availability.

      _Surfaced assumptions:_ A-0406, A-0407, A-0408
  - **FR-ACCT-1.3** `[Tier C · pending]`
    **As a** Token Refresh Trigger, **I want** Request new session token when current token nears expiry, **so that** Client maintains valid authentication state during WebSocket lifecycle.

    **Acceptance criteria:**
      - **AC-103** — Token refresh request sent before 5-minute expiry window.
        - _Measurable:_ Refresh request initiated when session token TTL > 5 minutes and < 10 minutes

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-11, WF-9 · Pass: 3_

    _Decomposition rationale:_ Defines the authentication refresh commitment to prevent session expiration from breaking the persistent connection; links to identity management workflow.

    _Surfaced assumptions:_ A-0183, A-0184
  - **FR-ACCT-1.4** `[Tier C · pending]`
    **As a** Connection State Reporting, **I want** Update UI connection status flag upon state change, **so that** Dashboard UI reflects active/disconnected connection status accurately.

    **Acceptance criteria:**
      - **AC-104** — UI status flag updates immediately on connection close/open.
        - _Measurable:_ UI component state 'connectionState' updated within 100ms of WebSocket event

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-4 · Pass: 3_

    _Decomposition rationale:_ Binds the connection event to the client-side rendering layer, ensuring the user perceives the connection status change.

    _Surfaced assumptions:_ A-0183, A-0184
    - **FR-ACCT-1.4.1** `[Tier C · pending]`
      **As a** Event Listener Implementation, **I want** Register WebSocket event listeners for close and open states on client side, **so that** System captures connection state changes as they occur.

      **Acceptance criteria:**
        - **AC-104-1** — Close event listener is registered upon initialization.
          - _Measurable:_ WebSocket client emits 'close' event triggers detection logic without delay
        - **AC-104-2** — Open event listener is registered upon initialization.
          - _Measurable:_ WebSocket client emits 'open' event triggers detection logic without delay

      _Status: pending · Priority: critical · Tier: C · Traces to: TECH-4, FR-ACCT-1.1, FR-ACCT-1.2 · Pass: 4_

      _Decomposition rationale:_ This child binds the detection mechanism (Event Listener) required to fulfill the 'Update upon state change' commitment, distinguishing it from the subsequent state update logic.

      _Surfaced assumptions:_ A-0409, A-0410
    - **FR-ACCT-1.4.2** `[Tier C · pending]`
      **As a** State Mutation Logic, **I want** Execute UI state mutation to reflect detected connection status, **so that** Dashboard UI variable 'connectionState' reflects new status.

      **Acceptance criteria:**
        - **AC-104-3** — UI state update function executes synchronously.
          - _Measurable:_ UI framework store updates immediately upon signal receipt

      _Status: pending · Priority: critical · Tier: C · Traces to: TECH-4, FR-ACCT-1.1 · Pass: 4_

      _Decomposition rationale:_ This child isolates the imperative action of updating the UI state from the event detection, defining the implementation commitment for state mutation.

      _Surfaced assumptions:_ A-0409, A-0410
    - **FR-ACCT-1.4.3** `[Tier C · pending]`
      **As a** Latency Enforcement, **I want** Measure and verify time delta between WebSocket event and UI update, **so that** UI status flag update occurs within 100ms of connection change.

      **Acceptance criteria:**
        - **AC-104-4** — Update window constraint is enforced.
          - _Measurable:_ delta(state_update_timestamp - event_timestamp) < 100 milliseconds

      _Status: pending · Priority: critical · Tier: C · Traces to: TECH-4, FR-ACCT-1.2 · Pass: 4_

      _Decomposition rationale:_ This child addresses the specific performance constraint in AC-104, committing to the architectural boundary for responsiveness.

      _Surfaced assumptions:_ A-0409, A-0410
  - **FR-ACCT-1.1** `[deferred]`
    **As a** Client Heartbeat Logic, **I want** Send ping frame periodically to server to prevent idle timeout, **so that** Server acknowledges pong and session remains established.

    **Acceptance criteria:**
      - **AC-101** — Client sends ping frame at configured interval.
        - _Measurable:_ WebSocket frame type 'ping' sent every 30000ms within client session

    _Status: deferred · Priority: critical · Traces to: TECH-4, WF-6 · Pass: 4_
##### US-002-1.4.3 `[Tier C · pending]`

**As a** CAM operator, **I want** Measure delta between DB commit time and client render time, **so that** End-to-end latency is verified to be under the 30 second threshold.

**Acceptance criteria:**
  - **AC-003.3.3** — Total latency from server commit to user screen render is logged and verified.
    - _Measurable:_ render_timestamp - commit_timestamp <= 30000 milliseconds

_Status: pending · Priority: high · Tier: C · Traces to: UJ-2, TECH-4 · Pass: 2_

_Decomposition rationale:_ Verification commitment ensuring the SLA defined in the parent AC is met.

_Surfaced assumptions:_ A-0056, A-0057

  - **FR-002-1.4.3.1** `[Tier D · atomic]`
    **As a** Backend Instrumentation, **I want** Capture atomic commit timestamp from database transaction, **so that** Backend commit timestamp is available for latency calculation.

    **Acceptance criteria:**
      - **AC-001** — Commit timestamp is recorded at the exact moment of DB commit.
        - _Measurable:_ timestamp === transaction_commit_timestamp

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-2, TECH-4, US-002-1.4.1, US-002-1.4.2 · Pass: 3_

    _Decomposition rationale:_ Backend instrumentation is the atomic source for the first half of the latency calculation; requires capture at commit time.

    _Surfaced assumptions:_ A-0185, A-0186, A-0187
  - **FR-002-1.4.3.2** `[Tier D · atomic]`
    **As a** Frontend Instrumentation, **I want** Capture render timestamp from client side, **so that** Client-side render completion timestamp is available.

    **Acceptance criteria:**
      - **AC-002** — Render timestamp is captured upon DOM rendering completion.
        - _Measurable:_ timestamp === performance.now()_at_render_complete

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-2, TECH-4, US-002-1.4.2 · Pass: 3_

    _Decomposition rationale:_ Frontend instrumentation is the atomic source for the second half of the latency calculation; relies on TECH-4 SvelteKit capabilities.

    _Surfaced assumptions:_ A-0185, A-0186, A-0187
  - **FR-002-1.4.3.3** `[Tier D · atomic]`
    **As a** Verification Logic, **I want** Calculate delta and compare against threshold, **so that** Delta is calculated and validated against the 30 second threshold.

    **Acceptance criteria:**
      - **AC-003** — Delta (render_ts - commit_ts) does not exceed 30000 milliseconds.
        - _Measurable:_ (render_timestamp - commit_timestamp) <= 30000

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-2, TECH-13 · Pass: 3_

    _Decomposition rationale:_ The core verification logic that combines the two timestamps; implemented in monitoring pipeline (TECH-13).

    _Surfaced assumptions:_ A-0185, A-0186, A-0187
  - **FR-002-1.4.3.4** `[Tier D · atomic]`
    **As a** Alerting, **I want** Log violation if threshold exceeded, **so that** Violation record is created for debugging and monitoring.

    **Acceptance criteria:**
      - **AC-004** — Alert record is created if latency exceeds threshold.
        - _Measurable:_ if (delta > 30000) then create_alert_record

    _Status: atomic · Priority: medium · Tier: D · Traces to: UJ-2, TECH-13, WF-6 · Pass: 3_

    _Decomposition rationale:_ Handling the edge case of threshold violation to ensure observability; traces to Notification Workflow (WF-6).

    _Surfaced assumptions:_ A-0185, A-0186, A-0187
### FR US-008 `[pending]`

**As a** Support Staff, **I want** Resolve Billing Dispute for Customer, **so that** Dispute ticket is closed and General Ledger is adjusted.

**Acceptance criteria:**
  - **AC-015** — Ticket resolved
    - _Measurable:_ ENT-TICKET status changes to 'Resolved' and user satisfaction rating collected
  - **AC-016** — Ledger adjusted
    - _Measurable:_ ENT-LEDGER entry created for any credit memo issued

_Status: pending · Priority: high · Traces to: UJ-8, WF-14, ENT-TICKET, ENT-LEDGER · Pass: 0_

#### US-008-C1 `[Tier C · pending]`

**As a** Workflow logic, **I want** Transition ticket status to 'Resolved' upon validation, **so that** Ticket record shows status 'Resolved' and user rating is collected.

**Acceptance criteria:**
  - **AC-001** — Ticket status updates atomically to 'Resolved'.
    - _Measurable:_ ENT-TICKET.status === 'Resolved' at commit time

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-8, WF-14, ENT-TICKET · Pass: 1_

_Decomposition rationale:_ Ticket state transition is the primary functional consequence of resolution; decomposed to verify state machine integrity.

_Surfaced assumptions:_ A-0022, A-0023, A-0024

##### FR-ACCT-1.1 `[Tier D · atomic]`

**As a** System, **I want** Set ENT-TICKET status to 'Resolved', **so that** Ticket record reflects resolved status to end-users and dashboards.

**Acceptance criteria:**
  - **AC-001** — Status column equals 'Resolved' immediately after commit.
    - _Measurable:_ ENT-TICKET.status === 'Resolved' immediately after transaction commit

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-TICKET, UJ-8 · Pass: 2_

_Decomposition rationale:_ This is the primary data mutation that satisfies the user-facing requirement; atomic at the row level.

_Surfaced assumptions:_ A-0098

##### FR-ACCT-1.2 `[Tier D · atomic]`

**As a** System, **I want** Update WF-14 step to 'Closed', **so that** Workflow engine marks the escalation handler step as complete.

**Acceptance criteria:**
  - **AC-002** — Workflow step transitions to final state.
    - _Measurable:_ WF-14.step_state === 'Closed' or equivalent terminal state

_Status: atomic · Priority: high · Tier: D · Traces to: WF-14, UJ-8 · Pass: 2_

_Decomposition rationale:_ The workflow engine requires an internal state change to release downstream listeners and event emitters; distinct from entity state.

_Surfaced assumptions:_ A-0098

#### US-008-C2 `[Tier C · pending]`

**As a** Finance logic, **I want** Generate credit memo entry for dispute amount, **so that** ENT-LEDGER entry created with credit amount matching dispute.

**Acceptance criteria:**
  - **AC-002** — Ledger entry reflects disputed credit value.
    - _Measurable:_ ENT-LEDGER.amount === dispute_amount AND ENT-LEDGER.type === 'credit_memo'

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-8, ENT-LEDGER, US-004 · Pass: 1_

_Decomposition rationale:_ Ledger adjustment must be tied to the dispute claim value; links to Invoice/Work Order closure process.

_Surfaced assumptions:_ A-0022, A-0023, A-0024

##### US-008-C2-1 `[Tier D · atomic]`

**As a** CAM operator, **I want** Validate dispute ticket context and approval state, **so that** Ticket is verified as active and dispute reason approved.

**Acceptance criteria:**
  - **AC-002-1** — Ticket status is 'Active' and 'Dispute' type
    - _Measurable:_ ticket.status === 'Active' AND ticket.dispute_approved === true

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-8, US-004 · Pass: 2_

_Decomposition rationale:_ Pre-condition check required before financial adjustment to ensure the source of funds is valid and the dispute resolution process is complete per US-008-C1 workflow.

_Surfaced assumptions:_ A-0099

##### US-008-C2-2 `[Tier D · atomic]`

**As a** CAM operator, **I want** Create Ledger Entry record with credit memo attributes, **so that** Journal entry row exists with amount and type.

**Acceptance criteria:**
  - **AC-002-2** — Ledger entry row contains correct type and amount
    - _Measurable:_ ENT-LEDGER.type === 'credit_memo' AND ENT-LEDGER.amount === dispute_amount

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-8, ENT-LEDGER · Pass: 2_

_Decomposition rationale:_ Core implementation commitment: mapping the dispute amount to the ledger schema ensures financial integrity matches the User Story AC-002.

_Surfaced assumptions:_ A-0099

##### US-008-C2-3 `[Tier D · atomic]`

**As a** CAM operator, **I want** Persist financial adjustment and audit trail, **so that** Transaction is committed and audit log entry created.

**Acceptance criteria:**
  - **AC-002-3** — Audit log records the credit memo transaction
    - _Measurable:_ ENT-AUDIT-LOG contains record with entity_id=ENT-LEDGER and action='credit_memo_creation'

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-8, US-004, US-008-C1 · Pass: 2_

_Decomposition rationale:_ Persistence and audit are atomic actions required for compliance (A-0024) and to satisfy the system of action workflow engine constraints.

_Surfaced assumptions:_ A-0099

#### US-008-C3 `[Tier D · atomic]`

**As a** Data Capture, **I want** Record user satisfaction rating, **so that** Satisfaction score is stored in ticket metadata.

**Acceptance criteria:**
  - **AC-003** — Rating value is persisted and retrievable.
    - _Measurable:_ ENT-TICKET.satisfaction_rating is NOT NULL after resolution

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-8, ENT-TICKET · Pass: 1_

_Decomposition rationale:_ Satisfaction capture is an atomic leaf operation requiring no further breakdown for immediate implementation.

_Surfaced assumptions:_ A-0022, A-0023, A-0024

#### US-008-C4 `[Tier C · pending]`

**As a** Validation, **I want** Verify dispute reason and reason code selection, **so that** Dispute reason text is validated against allowed codes.

**Acceptance criteria:**
  - **AC-004** — Reason field contains a valid enumerated value.
    - _Measurable:_ ENT-TICKET.dispute_reason IN ['billing', 'service', 'product', 'other']

_Status: pending · Priority: medium · Tier: C · Traces to: UJ-8, ENT-TICKET · Pass: 1_

_Decomposition rationale:_ Input validation is required before state transition to prevent invalid dispute categorization.

_Surfaced assumptions:_ A-0022, A-0023, A-0024

##### US-008-C4-01 `[Tier D · atomic]`

**As a** Validation Engine, **I want** Compare input reason string against configured enum list, **so that** Input value is flagged as valid or invalid immediately upon submission.

**Acceptance criteria:**
  - **AC-004** — The submitted dispute_reason matches a value in the allowed enum list.
    - _Measurable:_ dispute_reason IN ['billing', 'service', 'product', 'other']

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-8, ENT-TICKET, WF-14 · Pass: 2_

_Decomposition rationale:_ Binds the core verification logic into an atomic data integrity check operation.

_Surfaced assumptions:_ A-0100, A-0101

##### US-008-C4-02 `[Tier D · atomic]`

**As a** Validation Engine, **I want** Prevent ticket submission if validation fails, **so that** Database transaction rolls back and error is returned to client.

**Acceptance criteria:**
  - **AC-005** — No journal entry or ticket state transition occurs for invalid input.
    - _Measurable:_ submit_ticket() returns error when dispute_reason not in allowed set

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-8, ENT-TICKET, WF-14 · Pass: 2_

_Decomposition rationale:_ Enforces the consequence of failure, ensuring data quality by blocking state change.

_Surfaced assumptions:_ A-0100, A-0101

##### US-008-C4-03 `[Tier D · atomic]`

**As a** Validation Engine, **I want** Render validation error to user interface, **so that** User sees specific message indicating invalid or missing reason.

**Acceptance criteria:**
  - **AC-006** — Validation error message is displayed when reason is invalid.
    - _Measurable:_ UI renders error text containing 'invalid reason code' when AC-004 fails

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-8, ENT-TICKET, WF-14 · Pass: 2_

_Decomposition rationale:_ Handles the user-facing consequence of the validation check, ensuring feedback is provided.

_Surfaced assumptions:_ A-0100, A-0101

### FR US-009 `[pending]`

**As a** Homeowner, **I want** Upload Photo to Create Property Asset Profile, **so that** Digital File is saved and metadata extracted from image.

**Acceptance criteria:**
  - **AC-017** — Asset saved
    - _Measurable:_ ENT-DIGITAL-FILE record stored with < 2s latency on 5G network
  - **AC-018** — Metadata extracted
    - _Measurable:_ ENT-DIGITAL-META includes date captured and filename from OCR

_Status: pending · Priority: medium · Traces to: UJ-9, WF-15, ENT-DIGITAL-FILE, ENT-PROP-ADDRESS · Pass: 0_

#### US-009-1 `[Tier C · pending]`

**As a** CAM operator, **I want** Accept file stream via tusd endpoint with 5G network constraint enforcement, **so that** File ingested without corruption or timeout.

**Acceptance criteria:**
  - **AC-001** — Upload stream completes under 2 seconds latency
    - _Measurable:_ upload_timestamp - receipt_timestamp < 2000ms AND file_hash_matches_input

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-9, WF-15 · Pass: 1_

_Decomposition rationale:_ Ingestion step is distinct from processing; latency requirement is an engineering sub-strategy enforced here.

_Surfaced assumptions:_ A-0025, A-0026, A-0027

##### US-009-1.1 `[Tier C · pending]`

**As a** Backend Service, **I want** Manage Tusd Stream Session Lifecycle, **so that** Stream session state maintained across interruptions.

**Acceptance criteria:**
  - **AC-001.1** — Session state valid after pause/resume
    - _Measurable:_ tusd_session_id persists across 30s pause and resume without data loss

_Status: pending · Priority: critical · Tier: C · Traces to: WF-15 · Pass: 2_

_Decomposition rationale:_ Tusd protocol management is the mechanism enabling the 'Accept file stream' commitment. It defines the boundary of the upload session lifecycle independent of network constraints.

_Surfaced assumptions:_ A-0102, A-0103

  - **US-009-1.1-B01** `[Tier B · pending]`
    **As a** System Architect, **I want** Define Session ID Strategy for TUS Streams, **so that** Every stream session has a globally unique identifier across the backend service.

    **Acceptance criteria:**
      - **AC-001** — Session ID uniqueness verified against TUS metadata
        - _Measurable:_ generate_unique_id(session_id_header) === unique_id_in_db_for_stream

    _Status: pending · Priority: critical · Tier: B · Traces to: WF-15 · Pass: 3_

    _Decomposition rationale:_ Session ID strategy is an architectural choice that defines how the system tracks streams across interruptions; this policy choice determines downstream storage schema and indexing.

    _Surfaced assumptions:_ A-0246, A-0247
  - **US-009-1.1-C01** `[Tier C · pending]`
    **As a** Backend Operator, **I want** Persist Session State to Storage on Pause, **so that** Session state is durable and recoverable after a pause event.

    **Acceptance criteria:**
      - **AC-002** — State persisted before pause timeout
        - _Measurable:_ state_snapshot_exists_in_db_before_pause_timeout_expires

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-15 · Pass: 3_

    _Decomposition rationale:_ Ensures data integrity during interruption; commits the architectural choice to durable storage rather than volatile memory.

    _Surfaced assumptions:_ A-0246, A-0247
    - **US-009-1.1-C01-D01** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Capture current session metadata into a serialized payload, **so that** Snapshot object contains all headers and progress state at moment of pause.

      **Acceptance criteria:**
        - **AC-010** — Snapshot JSON payload includes valid TUS headers.
          - _Measurable:_ snapshot.headers.size === expected_header_count and snapshot.headers.type is a valid TUS enum

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-15, ENT-SESSION-TOKEN · Pass: 4_

      _Decomposition rationale:_ Defines the specific content of the persistence action; this is atomic enough to test by validating the resulting JSON structure against the expected schema.

      _Surfaced assumptions:_ A-0515, A-0516, A-0517
    - **US-009-1.1-C01-D02** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Write snapshot payload to durable storage row, **so that** Snapshot record exists in database table with unique ID before timeout expiry.

      **Acceptance criteria:**
        - **AC-011** — Snapshot row exists in database within 100ms of pause event.
          - _Measurable:_ row_count(where session_snapshot_id = new_id) === 1 AND row_created_at >= (pause_timestamp - 100ms)

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-15, TECH-8 · Pass: 4_

      _Decomposition rationale:_ Defines the storage execution aspect; verifies the database write completes within the required window defined by the timeout constraint.

      _Surfaced assumptions:_ A-0515, A-0516, A-0517
    - **US-009-1.1-C01-D03** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Acknowledge persistence completion to client, **so that** Client session status updates to 'paused_with_backup' after DB write returns.

      **Acceptance criteria:**
        - **AC-012** — Client receives success status only after DB write commit.
          - _Measurable:_ client_ack_timestamp > db_commit_timestamp AND client_status === 'paused_with_backup'

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-9, ENT-SESSION-TOKEN · Pass: 4_

      _Decomposition rationale:_ Defines the client-facing interaction; ensures the client does not proceed or lose state if the server acknowledges a failure before persistence.

      _Surfaced assumptions:_ A-0515, A-0516, A-0517
  - **US-009-1.1-C02** `[Tier C · pending]`
    **As a** Backend Operator, **I want** Restore Session State from Storage on Resume, **so that** Session state is valid and consistent when client resumes the stream.

    **Acceptance criteria:**
      - **AC-003** — State restored without data loss
        - _Measurable:_ state_after_resume === state_snapshot_from_db

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-15 · Pass: 3_

    _Decomposition rationale:_ Implements the verification that state is valid after pause/resume; ensures consistency for the user upon return.

    _Surfaced assumptions:_ A-0246, A-0247
    - **US-009-1.1-C02-1** `[Tier D · atomic]`
      **As a** Backend Operator, **I want** Validate session token validity against blacklist and expiry, **so that** Resume is rejected or allowed based on current token status.

      **Acceptance criteria:**
        - **AC-003-T1** — Token is not expired and not on revocation list.
          - _Measurable:_ token_expiry_timestamp > now() AND session_token ! IN (SELECT token_id FROM revoked_tokens)

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-15 · Pass: 4_

      _Decomposition rationale:_ Token validation is an atomic prerequisite action for state restoration; failure here blocks the resume flow entirely.

      _Surfaced assumptions:_ A-0518, A-0519, A-0520
    - **US-009-1.1-C02-2** `[Tier D · atomic]`
      **As a** Backend Operator, **I want** Retrieve session snapshot from durable storage, **so that** Snapshot data object fully populated in memory.

      **Acceptance criteria:**
        - **AC-003-T2** — Snapshot retrieved from database with no latency errors.
          - _Measurable:_ snapshot_object != null AND snapshot_timestamp <= now()

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-15 · Pass: 4_

      _Decomposition rationale:_ Fetching the snapshot is an atomic read operation; it is the foundational step to reconstructing state without data loss.

      _Surfaced assumptions:_ A-0518, A-0519, A-0520
    - **US-009-1.1-C02-3** `[Tier C · pending]`
      **As a** Backend Operator, **I want** Reconstruct stream buffer offset using snapshot metadata, **so that** Current stream position aligned with last committed position.

      **Acceptance criteria:**
        - **AC-003-T3** — Buffer offset matches snapshot position within defined tolerance.
          - _Measurable:_ Math.abs(restored_offset - snapshot_offset) <= tolerance_threshold

      _Status: pending · Priority: high · Tier: C · Traces to: WF-15 · Pass: 4_

      _Decomposition rationale:_ Choosing to use snapshot metadata for offset alignment is an implementation strategy that determines how state is merged.

      _Surfaced assumptions:_ A-0518, A-0519, A-0520
    - **US-009-1.1-C02-4** `[Tier D · atomic]`
      **As a** Backend Operator, **I want** Persist resume completion state and log event, **so that** Session state marked as resumed in storage and audit log updated.

      **Acceptance criteria:**
        - **AC-003-T4** — Resume confirmation row persisted and event logged.
          - _Measurable:_ UPDATE session SET is_resumed=true WHERE session_id=... AND now() < timeout

      _Status: atomic · Priority: high · Tier: D · Traces to: WF-15 · Pass: 4_

      _Decomposition rationale:_ Updating the session status is an atomic write operation that closes the loop for the resume requirement.

      _Surfaced assumptions:_ A-0518, A-0519, A-0520
  - **US-009-1.1-C03** `[Tier C · pending]`
    **As a** System Health Monitor, **I want** Clean Up Expired Sessions from Storage, **so that** Database storage for sessions does not grow indefinitely.

    **Acceptance criteria:**
      - **AC-004** — Inactive sessions removed periodically
        - _Measurable:_ session_rows < max_count_in_db_interval

    _Status: pending · Priority: high · Tier: C · Traces to: WF-15 · Pass: 3_

    _Decomposition rationale:_ Enforces system health and prevents resource leakage; defines the operational boundary of active session lifetime.

    _Surfaced assumptions:_ A-0246, A-0247
    - **FR-C03-1** `[Tier C · pending]`
      **As a** CAM operator, **I want** calculate session expiration time based on last heartbeat timestamp, **so that** Only sessions older than the configured idle threshold are flagged for removal.

      **Acceptance criteria:**
        - **AC-001** — Session flagged for removal if idle_duration > threshold.
          - _Measurable:_ SELECT age(current_timestamp, last_activity) > threshold FROM session_rows WHERE last_activity IS NOT NULL

      _Status: pending · Priority: high · Tier: C · Traces to: WF-15, ENT-SESSION-TOKEN · Pass: 4_

      _Decomposition rationale:_ Defines the specific metric ('inactive') used to identify storage bloat; this is an implementation choice rather than a functional sub-area.

      _Surfaced assumptions:_ A-0521, A-0522, A-0523
    - **FR-C03-2** `[Tier C · pending]`
      **As a** CAM operator, **I want** execute cleanup via periodic background worker, **so that** Expired rows are purged from storage without blocking active uploads.

      **Acceptance criteria:**
        - **AC-002** — Cleanup job executes on a schedule that maintains low resource contention.
          - _Measurable:_ worker_process_queue_depth <= max_concurrent_ops AND job_duration < 1_minute_per_batch

      _Status: pending · Priority: high · Tier: C · Traces to: WF-15, US-009-1.1-C01 · Pass: 4_

      _Decomposition rationale:_ Splits the high-level goal into the execution strategy; the asynchronous nature is inherited from existing assumptions but the scheduling is a new implementation commitment.

      _Surfaced assumptions:_ A-0521, A-0522, A-0523
    - **FR-C03-3** `[Tier C · pending]`
      **As a** CAM operator, **I want** verify session state consistency before deletion, **so that** No active sessions are mistakenly deleted during concurrent client operations.

      **Acceptance criteria:**
        - **AC-003** — Deleted row status matches 'expired' state flag in audit log.
          - _Measurable:_ SELECT COUNT(*) FROM audit_log WHERE action='delete' AND target='session' AND state='verified' > 0

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-15, US-009-1.1-C02 · Pass: 4_

      _Decomposition rationale:_ Ensures safety of the implementation choice; deletion must be verifiable to prevent data loss for active tenants.

      _Surfaced assumptions:_ A-0521, A-0522, A-0523
##### US-009-1.2 `[Tier C · pending]`

**As a** Network Monitor, **I want** Enforce Latency SLA on 5G Links, **so that** Rejection of uploads exceeding 2000ms on 5G.

**Acceptance criteria:**
  - **AC-001.2** — Upload stream duration within SLA
    - _Measurable:_ upload_timestamp - receipt_timestamp < 2000ms AND network_type === '5G'

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-9, WF-15 · Pass: 2_

_Decomposition rationale:_ Latency enforcement is the specific constraint logic defined in AC-001. It binds the system to the performance verification defined in the parent.

_Surfaced assumptions:_ A-0102, A-0103

  - **FR-ACCT-2.1** `[Tier D · atomic]`
    **As a** Latency Enforcement Engine, **I want** Check network_type against client headers, **so that** System recognizes upload as originating from a 5G link.

    **Acceptance criteria:**
      - **AC-201** — Network type matches '5G' string.
        - _Measurable:_ client_headers.network_type === '5G' returns true

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-9 · Pass: 3_

    _Decomposition rationale:_ Verifies the prerequisite condition (5G network) before applying latency thresholds, relying on assumption [A-0102].

    _Surfaced assumptions:_ A-0248, A-0249
  - **FR-ACCT-2.2** `[Tier D · atomic]`
    **As a** Latency Enforcement Engine, **I want** Calculate upload stream duration, **so that** System produces delta between receipt and upload timestamps.

    **Acceptance criteria:**
      - **AC-202** — Duration delta is computed correctly.
        - _Measurable:_ delta_ms = receipt_timestamp - upload_timestamp

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-9 · Pass: 3_

    _Decomposition rationale:_ Atomic mathematical operation required to evaluate the SLA threshold; ensures timestamp integrity per TU protocol.

    _Surfaced assumptions:_ A-0248, A-0249
  - **FR-ACCT-2.3** `[Tier D · atomic]`
    **As a** Latency Enforcement Engine, **I want** Evaluate SLA breach condition, **so that** System flags upload as violating SLA if 5G and > 2000ms.

    **Acceptance criteria:**
      - **AC-203** — Breach condition is true.
        - _Measurable:_ if (network_is_5g) and (delta_ms > 2000) then flag_breach

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-9 · Pass: 3_

    _Decomposition rationale:_ Combines network type and duration check into the core enforcement logic; maps directly to parent AC-001.2.

    _Surfaced assumptions:_ A-0248, A-0249
  - **FR-ACCT-2.4** `[Tier D · atomic]`
    **As a** Stream Control Module, **I want** Abort tusd stream session, **so that** Upload terminated with latency violation error code.

    **Acceptance criteria:**
      - **AC-204** — Stream receives termination signal.
        - _Measurable:_ tusd_client receives 500 Error with reason 'SLA_VIOLATION'

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-9, US-009-1.1 · Pass: 3_

    _Decomposition rationale:_ Executes the enforcement action defined in the parent; references sibling 1.1 for session lifecycle context.

    _Surfaced assumptions:_ A-0248, A-0249
  - **FR-ACCT-2.5** `[Tier D · atomic]`
    **As a** Audit Logger, **I want** Record latency enforcement event, **so that** Event logged for observability and compliance.

    **Acceptance criteria:**
      - **AC-205** — Latency event written to audit log.
        - _Measurable:_ ENT-AUDIT-LOG contains entry with network_type, delta_ms, and result

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-9 · Pass: 3_

    _Decomposition rationale:_ Provides traceability for the enforcement decision; supports TECH-13 OpenTelemetry observability.

    _Surfaced assumptions:_ A-0248, A-0249
##### US-009-1.3 `[Tier C · pending]`

**As a** Integrity Service, **I want** Validate File Hash against Input, **so that** Upload rejected if hash mismatch.

**Acceptance criteria:**
  - **AC-001.3** — Integrity check on commit
    - _Measurable:_ stored_hash === input_hash_at_upload

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-9 · Pass: 2_

_Decomposition rationale:_ Integrity verification is the second specific constraint logic defined in AC-001. It commits to the technology (hashing) and the verification of corruption prevention.

_Surfaced assumptions:_ A-0102, A-0103

  - **FR-ACCT-1.3-1** `[Tier D · atomic]`
    **As a** Integrity Service, **I want** Reject upload if hash mismatch, **so that** Upload request returns error response with rejection reason.

    **Acceptance criteria:**
      - **AC-001** — Upload request fails with mismatch error when hashes differ.
        - _Measurable:_ response.status_code === 4xx AND response.body.contains('hash_mismatch')

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-9 · Pass: 3_

    _Decomposition rationale:_ This child defines the failure path of the validation commitment. It binds the rejection mechanism to the specific validation outcome, ensuring data integrity is enforced via the upload protocol.

    _Surfaced assumptions:_ A-0250, A-0251, A-0252, A-0253
  - **FR-ACCT-1.3-2** `[Tier D · atomic]`
    **As a** Integrity Service, **I want** Persist hash record on match, **so that** Asset record is created with the validated hash stored.

    **Acceptance criteria:**
      - **AC-002** — Validated hash is stored in the asset metadata upon commit.
        - _Measurable:_ asset.record.hash_field === input_hash AND timestamp === commit_timestamp

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-9 · Pass: 3_

    _Decomposition rationale:_ This child defines the success path. It commits the verification result to the system state, satisfying the requirement to store the hash for future audit or verification.

    _Surfaced assumptions:_ A-0250, A-0251, A-0252, A-0253
  - **FR-ACCT-1.3-3** `[Tier D · atomic]`
    **As a** Integrity Service, **I want** Log validation event, **so that** Audit log entry is created for the validation attempt.

    **Acceptance criteria:**
      - **AC-003** — Every validation attempt results in an audit log entry.
        - _Measurable:_ audit_log.count(queries.where(entity='hash_validation').since(commit)) > 0

    _Status: atomic · Priority: medium · Tier: D · Traces to: UJ-9 · Pass: 3_

    _Decomposition rationale:_ This child binds the verification to compliance requirements for auditability. It ensures the validation process itself is recorded as a transactional event.

    _Surfaced assumptions:_ A-0250, A-0251, A-0252, A-0253
#### US-009-2 `[Tier C · pending]`

**As a** Backend service, **I want** Execute metadata extraction pipeline using ffmpeg and ExifTool, **so that** Metadata extracted from image EXIF and OCR content.

**Acceptance criteria:**
  - **AC-002** — Metadata JSON populated with date and filename
    - _Measurable:_ meta.date_captured != null AND meta.filename != null

_Status: pending · Priority: high · Tier: C · Traces to: WF-15, ENT-DIGITAL-FILE · Pass: 1_

_Decomposition rationale:_ Processing is an implementation choice (tools used) distinct from storage or recording.

_Surfaced assumptions:_ A-0025, A-0026, A-0027

##### US-009-2-1 `[Tier D · atomic]`

**As a** Media Processor, **I want** Extract EXIF tags from file content, **so that** EXIF metadata available for ingestion.

**Acceptance criteria:**
  - **AC-002-01** — EXIF date field is populated.
    - _Measurable:_ meta.date_captured != null when ExifTool reads file tags
  - **AC-002-02** — EXIF filename field is populated.
    - _Measurable:_ meta.filename != null derived from file metadata

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-15, ENT-DIGITAL-FILE · Pass: 2_

_Decomposition rationale:_ Atomic operation within the pipeline; must succeed for AC-002 to be met for image assets.

_Surfaced assumptions:_ A-0104, A-0105, A-0106, A-0107

##### US-009-2-2 `[Tier D · atomic]`

**As a** Media Processor, **I want** Extract OCR text from image content, **so that** OCR text available for content analysis.

**Acceptance criteria:**
  - **AC-002-03** — OCR text content is populated if image contains text.
    - _Measurable:_ meta.ocr_text != null when external AI tooling detects text

_Status: atomic · Priority: high · Tier: D · Traces to: WF-15, ENT-DIGITAL-FILE · Pass: 2_

_Decomposition rationale:_ Atomic operation for non-EXIF metadata derived via assumed tooling; handles text-based content fields.

_Surfaced assumptions:_ A-0104, A-0105, A-0106, A-0107

##### US-009-2-3 `[Tier D · atomic]`

**As a** Record Writer, **I want** Assemble final Metadata JSON object, **so that** Valid JSON persisted to metadata record.

**Acceptance criteria:**
  - **AC-002-04** — Assembled JSON matches schema.
    - _Measurable:_ JSON validates against ENT-DIGITAL-META schema at write commit

_Status: atomic · Priority: critical · Tier: D · Traces to: US-009-3, WF-15, ENT-DIGITAL-FILE · Pass: 2_

_Decomposition rationale:_ Combines outputs from sub-operations into the canonical record structure before persistence.

_Surfaced assumptions:_ A-0104, A-0105, A-0106, A-0107

##### US-009-2-4 `[Tier D · atomic]`

**As a** Validator, **I want** Validate file format compatibility, **so that** Unsupported formats rejected or fallback applied.

**Acceptance criteria:**
  - **AC-002-05** — Processing result is binary success or documented failure.
    - _Measurable:_ Pipeline job status is either 'completed' or 'error' with valid code

_Status: atomic · Priority: high · Tier: D · Traces to: WF-15, US-009-1 · Pass: 2_

_Decomposition rationale:_ Ensures the pipeline handles edge cases like corrupted files or unsupported codecs before attempting extraction.

_Surfaced assumptions:_ A-0104, A-0105, A-0106, A-0107

#### US-009-3 `[Tier C · pending]`

**As a** Persistence service, **I want** Create ENT-DIGITAL-FILE and ENT-DIGITAL-META records in PostgreSQL, **so that** Asset records persisted and linked to property address.

**Acceptance criteria:**
  - **AC-003** — Records created with Row-Level Security enforced
    - _Measurable:_ INSERT succeeds on ENT-DIGITAL-FILE AND ENT-DIGITAL-META WITH RLS check

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-DIGITAL-FILE, ENT-PROP-ADDRESS · Pass: 1_

_Decomposition rationale:_ Persistence is the architectural commitment for storage integrity.

_Surfaced assumptions:_ A-0025, A-0026, A-0027

##### US-009-3-1 `[Tier D · atomic]`

**As a** DB Writer, **I want** Persist ENT-DIGITAL-FILE record in PostgreSQL, **so that** Digital File record is stored with reference to SeaweedFS object.

**Acceptance criteria:**
  - **AC-003-F** — File record inserted successfully
    - _Measurable:_ SELECT COUNT(*) FROM ENT-DIGITAL-FILE WHERE file_id = ? AND tenant_id = ? AND is_deleted = false

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-DIGITAL-FILE · Pass: 2_

_Decomposition rationale:_ Separates the file-specific persistence action from metadata persistence, defining the primary entity creation commitment.

_Surfaced assumptions:_ A-0108

##### US-009-3-2 `[Tier D · atomic]`

**As a** DB Writer, **I want** Persist ENT-DIGITAL-META record in PostgreSQL, **so that** Digital Metadata record is stored linked to file record.

**Acceptance criteria:**
  - **AC-003-M** — Metadata record inserted successfully
    - _Measurable:_ SELECT COUNT(*) FROM ENT-DIGITAL-META WHERE meta_id = ? AND file_id = ? AND is_deleted = false

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-DIGITAL-META · Pass: 2_

_Decomposition rationale:_ Separates the metadata-specific persistence action, ensuring both record types are treated as atomic leaf operations under the parent commitment.

_Surfaced assumptions:_ A-0108

#### US-009-4 `[Tier D · atomic]`

**As a** Leaf operation, **I want** Link extracted file metadata to Property Address, **so that** File associated with specific property unit.

**Acceptance criteria:**
  - **AC-004** — Foreign key constraint satisfied between file and property
    - _Measurable:_ SELECT COUNT(*) FROM property_files WHERE property_id = input_prop_id AND file_id = input_file_id

_Status: atomic · Priority: high · Tier: D · Traces to: ENT-PROP-ADDRESS, US-009-3 · Pass: 1_

_Decomposition rationale:_ Linking is an atomic verification step against the property registry.

_Surfaced assumptions:_ A-0025, A-0026, A-0027

### Release 2: Landlord & Vendor Operations Expansion (5 roots)
*Building on Release 1, this phase expands the platform's utility to landlords and investors, allowing them to compare vendor quotes, manage portfolio reporting across multiple units, and escalate vendor disputes. Crucially, it introduces comprehensive onboarding and management tools for service providers, enabling contractors to join the platform, complete field jobs, invoice clients, and manage their compliance dashboard. This establishes the critical supply side of the marketplace.*

### FR US-003 `[pending]`

**As a** Landlord, **I want** Solicit Vendor Estimates for property maintenance, **so that** Multiple Work Order Estimates are populated for comparison.

**Acceptance criteria:**
  - **AC-005** — Estimates collected
    - _Measurable:_ UI lists at least 3 distinct Vendor Estimates associated with the Work Order
  - **AC-006** — Budget check performed
    - _Measurable:_ System prevents selection if total estimated cost exceeds approved budget

_Status: pending · Priority: high · Traces to: UJ-3, ENT-WORK-ESTIMATE, ENT-VENDOR · Pass: 0_

#### FR-ACCT-1.1 `[Tier C · pending]`

**As a** CAM operator, **I want** Initiate vendor estimation request to active vendor network, **so that** System dispatches estimate requests to at least 3 qualified vendors associated with the Work Order.

**Acceptance criteria:**
  - **AC-001** — Estimate requests are sent to the vendor pool
    - _Measurable:_ Count of outgoing request events for the Work Order >= 3 before timeout

_Status: pending · Priority: high · Tier: C · Traces to: UJ-3, ENT-VENDOR · Pass: 1_

_Decomposition rationale:_ Initiation is the first functional step to populate estimates. This child defines the trigger and target mechanism, converting the 'solicit' user goal into an actionable system event.

_Surfaced assumptions:_ A-0007, A-0008, A-0009, A-0010, A-0011

#### FR-ACCT-1.2 `[Tier C · pending]`

**As a** CAM operator, **I want** Ingest and store submitted vendor estimates, **so that** System persists estimate data into Work Order Estimate entity linked to the parent Work Order.

**Acceptance criteria:**
  - **AC-002** — Estimate records are created and persisted
    - _Measurable:_ Count of EST-001 entity records linked to WO-ID equals count of incoming valid responses

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-WORK-ESTIMATE, UJ-3 · Pass: 1_

_Decomposition rationale:_ Ingestion is the data capture commitment. It transforms external vendor input into internal state, satisfying the 'populated' requirement. It is Tier C because it defines how the system handles the data.

_Surfaced assumptions:_ A-0007, A-0008, A-0009, A-0010, A-0011

##### FR-ACCT-1.2.1 `[Tier C · pending]`

**As a** Data Validator, **I want** Validate incoming payload against canonical estimate schema, **so that** Rejected responses that miss required fields or violate type constraints.

**Acceptance criteria:**
  - **AC-1.2.1-A** — Every incoming JSON payload conforms to ENT-WORK-ESTIMATE schema.
    - _Measurable:_ payload.schema_valid === true at ingestion attempt

_Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.1, UJ-3, ENT-WORK-ESTIMATE · Pass: 2_

_Decomposition rationale:_ Schema validation is the first technical barrier to ensure data integrity before persistence. It leverages existing assumption [A-0008] on response schema standardization but enforces strict adherence.

_Surfaced assumptions:_ A-0058, A-0059, A-0060

  - **FR-ACCT-1.2.1-A** `[Tier C · pending]`
    **As a** CAM operator, **I want** Resolve canonical schema definition from registry, **so that** Schema loaded into validation engine.

    **Acceptance criteria:**
      - **AC-001** — Schema definition retrieved from ENT-WORK-ESTIMATE entity.
        - _Measurable:_ schema_definition !== null && schema_definition.version exists

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-WORK-ESTIMATE, FR-ACCT-1.1 · Pass: 3_

    _Decomposition rationale:_ Defining the source of the schema is a necessary architectural choice; it dictates whether validation is code-embedded or registry-driven.

    _Surfaced assumptions:_ A-0188, A-0189
    - **FR-ACCT-1.2.1-A.1** `[Tier D · atomic]`
      **As a** Engine Operator, **I want** Fetch schema JSON from Work Order Estimate record, **so that** Schema object is returned with non-null payload.

      **Acceptance criteria:**
        - **AC-001-A.1** — Schema data is retrieved successfully from the database.
          - _Measurable:_ SELECT schema_definition FROM ENT-WORK-ESTIMATE WHERE wo_id = ? returns a row with schema_definition != null

      _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-WORK-ESTIMATE, FR-ACCT-1.1 · Pass: 4_

      _Decomposition rationale:_ The first step in resolving a schema is a direct data retrieval operation; this is an atomic leaf operation testable by database query results.

      _Surfaced assumptions:_ A-0411, A-0412, A-0413
    - **FR-ACCT-1.2.1-A.2** `[Tier D · atomic]`
      **As a** Engine Operator, **I want** Verify schema version against runtime expectations, **so that** Schema version string matches current validation engine requirement.

      **Acceptance criteria:**
        - **AC-001-A.2** — Schema version is consistent with registry state.
          - _Measurable:_ schema_definition.version !== null && schema_definition.version === expectedVersion

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-ACCT-1.2.1-C · Pass: 4_

      _Decomposition rationale:_ Version checking is required before loading; this validates the integrity of the fetched data to ensure compatibility with field-level checking (sibling C).

      _Surfaced assumptions:_ A-0411, A-0412, A-0413
    - **FR-ACCT-1.2.1-A.3** `[Tier C · pending]`
      **As a** Auth Gatekeeper, **I want** Authorize user to read schema definition from registry, **so that** Access granted or rejected based on user role permissions.

      **Acceptance criteria:**
        - **AC-001-A.3** — User permissions permit read access to the ESTIMATE schema field.
          - _Measurable:_ Cerbos policy check: User has READ permission on ENT-WORK-ESTIMATE.schemaDefinition column

      _Status: pending · Priority: high · Tier: C · Traces to: ENT-USER, ENT-ROLE · Pass: 4_

      _Decomposition rationale:_ This is an implementation commitment defining the policy check (C) that must pass before the fetch operation (D) can succeed; it is not a functional sub-area but a permission boundary.

      _Surfaced assumptions:_ A-0411, A-0412, A-0413
    - **FR-ACCT-1.2.1-A.4** `[Tier D · atomic]`
      **As a** Engine Operator, **I want** Bind schema object to validation engine context, **so that** Validation engine instance holds schema in memory.

      **Acceptance criteria:**
        - **AC-001-A.4** — Validation engine state contains the loaded schema.
          - _Measurable:_ engineContext.schema === fetchedSchemaObject

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-ACCT-1.2.1-B · Pass: 4_

      _Decomposition rationale:_ Binding makes the schema available for the validation logic; failure here would trigger the sibling error response (B) if not handled gracefully.

      _Surfaced assumptions:_ A-0411, A-0412, A-0413
  - **FR-ACCT-1.2.1-B** `[Tier C · pending]`
    **As a** CAM operator, **I want** Construct structured error response for validation failure, **so that** Client receives rejection with field-level details.

    **Acceptance criteria:**
      - **AC-002** — HTTP 400 returned for invalid payload.
        - _Measurable:_ response.status_code === 400 && response.body.errors !== undefined

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.2.3 · Pass: 3_

    _Decomposition rationale:_ How errors are formatted (field paths vs generic message) is a specific implementation commitment that impacts client debugging.

    _Surfaced assumptions:_ A-0188, A-0189
    - **FR-ACCT-1.2.1-B.1** `[Tier D · atomic]`
      **As a** API Layer, **I want** Set HTTP response status code to 400, **so that** Client receives a 4xx error classifying as Bad Request.

      **Acceptance criteria:**
        - **AC-002-A** — Response status code equals 400 on validation failure
          - _Measurable:_ response.status_code === 400

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-ACCT-1.2.1-A, FR-ACCT-1.2.1-C · Pass: 4_

      _Decomposition rationale:_ Status code enforcement is a distinct atomic step from payload construction; failing to set the correct code breaks the contract even if the body is correct.

      _Surfaced assumptions:_ A-0414, A-0415, A-0416
    - **FR-ACCT-1.2.1-B.2** `[Tier D · atomic]`
      **As a** Payload Generator, **I want** Populate response body 'errors' field with validation messages, **so that** Client receives field-level detail in JSON body.

      **Acceptance criteria:**
        - **AC-002-B** — Response body contains 'errors' key with at least one error entry
          - _Measurable:_ response.body.errors !== undefined && response.body.errors.length > 0

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-ACCT-1.2.1-A, FR-ACCT-1.2.1-C · Pass: 4_

      _Decomposition rationale:_ Structuring the payload to include field-level errors is a separate atomic operation from the status code; this child commits to the specific content mapping required by the parent.

      _Surfaced assumptions:_ A-0414, A-0415, A-0416
    - **FR-ACCT-1.2.1-B.3** `[Tier D · atomic]`
      **As a** Security Filter, **I want** Sanitize validation error messages against stack traces, **so that** Error response does not leak internal implementation details.

      **Acceptance criteria:**
        - **AC-002-C** — Error message text does not contain internal file paths or stack traces
          - _Measurable:_ !response.body.errors.some(e => e.message.includes('stack') || e.message.includes('file://') || e.message.includes('trace'))

      _Status: atomic · Priority: high · Tier: D · Traces to: FR-ACCT-1.2.1-A, FR-ACCT-1.2.1-C · Pass: 4_

      _Decomposition rationale:_ Security constraint requires distinct filtering logic to ensure user-facing errors are safe; this is a testable implementation decision.

      _Surfaced assumptions:_ A-0414, A-0415, A-0416
  - **FR-ACCT-1.2.1-C** `[Tier D · atomic]`
    **As a** Leaf, **I want** Perform atomic field-level type checking, **so that** Specific field validated against schema type.

    **Acceptance criteria:**
      - **AC-003** — Field type matches schema definition.
        - _Measurable:_ typeof payload.field === schema.field.type

    _Status: atomic · Priority: critical · Tier: D · Traces to: FR-ACCT-1.2.1-A · Pass: 3_

    _Decomposition rationale:_ The fundamental atomic operation of validation; once the schema and failure logic are committed, these are the testable operations.

    _Surfaced assumptions:_ A-0188, A-0189
##### FR-ACCT-1.2.2 `[Tier C · pending]`

**As a** Link Manager, **I want** Associate estimate record with parent Work Order entity, **so that** Established foreign key relationship between EST-001 and ENT-WORK-ORDER.

**Acceptance criteria:**
  - **AC-1.2.2-A** — Estimate record contains valid WO_ID referencing existing order.
    - _Measurable:_ wo_id IN (SELECT id FROM ent_work_orders)

_Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.1, ENT-WORK-ORDER, ENT-WORK-ESTIMATE · Pass: 2_

_Decomposition rationale:_ Definitive commitment to the 'linked to parent Work Order' aspect of the parent requirement. This child ensures the entity relationship defined in the parent is enforced.

_Surfaced assumptions:_ A-0058, A-0059, A-0060

  - **FR-ACCT-1.2.2.1** `[Tier D · atomic]`
    **As a** Validation operator, **I want** Query ENT-WORK-ORDER for primary key existence of incoming wo_id, **so that** Return success or error code immediately after verification.

    **Acceptance criteria:**
      - **AC-001** — System executes query against ent_work_orders table.
        - _Measurable:_ SELECT id FROM ent_work_orders WHERE id = :wo_id returns >= 1 row

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-WORK-ORDER, FR-ACCT-1.2.1 · Pass: 3_

    _Decomposition rationale:_ Defines the atomic check required before any persistence occurs; must be a leaf operation to ensure data integrity is atomic.

    _Surfaced assumptions:_ A-0190, A-0191, A-0192
  - **FR-ACCT-1.2.2.2** `[Tier C · pending]`
    **As a** Architecture decision, **I want** Define and enforce foreign key constraint at database layer, **so that** Estimate table rejects writes that violate referential integrity.

    **Acceptance criteria:**
      - **AC-002** — Database engine enforces constraint on wo_id column.
        - _Measurable:_ INSERT or UPDATE on est_001 raises integrity exception if wo_id not in ent_work_orders.id

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-WORK-ESTIMATE, ENT-WORK-ORDER · Pass: 3_

    _Decomposition rationale:_ Commits to the architectural strategy of enforcing integrity at the storage engine rather than just application logic, binding downstream behavior to DB constraints.

    _Surfaced assumptions:_ A-0190, A-0191, A-0192
    - **FR-ACCT-1.2.2.2.1** `[Tier C · pending]`
      **As a** Database Administrator, **I want** Configure ON DELETE RESTRICT for wo_id column, **so that** Referential integrity violations raise a database exception rather than allowing orphan records.

      **Acceptance criteria:**
        - **AC-003** — Constraint raises standard integrity violation error.
          - _Measurable:_ Attempted DELETE on ENT-WORK-ORDER returns SQLSTATE 23503

      _Status: pending · Priority: critical · Tier: C · Traces to: ENT-WORK-ORDER, ENT-WORK-ESTIMATE, COMP-1 · Pass: 4_

      _Decomposition rationale:_ Specifies the specific referential action policy required to enforce immutability of referenced Work Orders.

      _Surfaced assumptions:_ A-0417, A-0418, A-0419
    - **FR-ACCT-1.2.2.2.2** `[Tier C · pending]`
      **As a** Database Architect, **I want** Create B-tree index on est_001.wo_id, **so that** Referential checks execute in O(log N) time to support high throughput inserts.

      **Acceptance criteria:**
        - **AC-004** — Index exists and supports FK checks.
          - _Measurable:_ EXPLAIN ANALYZE on FK check shows 'Index Scan' on est_001_wo_id_idx

      _Status: pending · Priority: critical · Tier: C · Traces to: ENT-WORK-ESTIMATE, TECH-8, TECH-9 · Pass: 4_

      _Decomposition rationale:_ Defines the storage structure required to enforce the constraint efficiently during write paths.

      _Surfaced assumptions:_ A-0417, A-0418, A-0419
    - **FR-ACCT-1.2.2.2.3** `[Tier C · pending]`
      **As a** API Integrator, **I want** Map database integrity exception to HTTP 400 Bad Request, **so that** Client applications receive consistent error codes for invalid references.

      **Acceptance criteria:**
        - **AC-005** — Constraint error translates to HTTP 400.
          - _Measurable:_ Response status code is 400 with body containing error message referencing 'Referential Integrity'

      _Status: pending · Priority: high · Tier: C · Traces to: FR-ACCT-1.2.2.3, TECH-9, COMP-1 · Pass: 4_

      _Decomposition rationale:_ Ensures the database constraint integrates with the existing API-level rejection strategy defined in sibling FR-ACCT-1.2.2.3.

      _Surfaced assumptions:_ A-0417, A-0418, A-0419
    - **FR-ACCT-1.2.2.2.4** `[Tier C · pending]`
      **As a** Compliance Engineer, **I want** Log constraint violation events to ENT-AUDIT-LOG, **so that** System records attempts to violate data integrity for audit review.

      **Acceptance criteria:**
        - **AC-006** — Violation logged to immutable audit stream.
          - _Measurable:_ ENT-AUDIT-LOG row contains est_001_id, event_type='constraint_violation', timestamp

      _Status: pending · Priority: medium · Tier: C · Traces to: ENT-AUDIT-LOG, COMP-1, TECH-13 · Pass: 4_

      _Decomposition rationale:_ Ensures the architectural enforcement supports regulatory auditing requirements for data integrity failures.

      _Surfaced assumptions:_ A-0417, A-0418, A-0419
  - **FR-ACCT-1.2.2.3** `[Tier D · atomic]`
    **As a** Error handling logic, **I want** Reject request and return 400 Bad Request for invalid references, **so that** User receives clear error indicating missing Work Order reference.

    **Acceptance criteria:**
      - **AC-003** — API returns HTTP 400 status on validation failure.
        - _Measurable:_ Response status code is 400 and body contains 'missing_wo_id' error tag

    _Status: atomic · Priority: high · Tier: D · Traces to: FR-ACCT-1.2.1, FR-ACCT-1.2.5 · Pass: 3_

    _Decomposition rationale:_ Handles the atomic consequence of the validation check (AC-001) when the condition is not met; defines the immediate user-facing outcome.

    _Surfaced assumptions:_ A-0190, A-0191, A-0192
##### FR-ACCT-1.2.3 `[Tier C · pending]`

**As a** Audit Logger, **I want** Create immutable audit trail for every ingestion event, **so that** Audit log record exists for every estimate receipt regardless of validation status.

**Acceptance criteria:**
  - **AC-1.2.3-A** — Audit log entry is created and marked immutable.
    - _Measurable:_ count(audit_logs where type='estimate_ingest' AND wo_id='X') > 0 for every ingestion event X

_Status: pending · Priority: high · Tier: C · Traces to: UJ-10, ENT-AUDIT-LOG, TECH-8 · Pass: 2_

_Decomposition rationale:_ Compliance and traceability requirement. Ensures that every response from vendors (even invalid ones) is logged for forensics, supporting UJ-10 Reporting and COMP-2 audit requirements.

_Surfaced assumptions:_ A-0058, A-0059, A-0060

  - **FR-ACCT-1.2.3.1** `[Tier C · pending]`
    **As a** Constraint Enforcer, **I want** Enforce append-only constraint on the audit log table, **so that** Updates to audit entries are rejected at the database level.

    **Acceptance criteria:**
      - **AC-1.2.3.1-A** — Update attempts to existing audit records fail.
        - _Measurable:_ Attempted UPDATE of row in audit_logs returns error code 400 or DB error.

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.2.3-A, UJ-10 · Pass: 3_

    _Decomposition rationale:_ Immutability is an architectural constraint that must be enforced at the storage layer to satisfy the 'immutable' claim of the parent.

    _Surfaced assumptions:_ A-0193, A-0194, A-0195
    - **FR-ACCT-1.2.3.1.1** `[Tier C · pending]`
      **As a** Database Architect, **I want** Create unique constraint on audit_log table primary key, **so that** Inserts succeed, subsequent updates fail.

      **Acceptance criteria:**
        - **AC-1.2.3.1.1-A** — UPDATE on audit_logs returns error 400 or DB error
          - _Measurable:_ RETURNING ERROR ON UPDATE OF PRIMARY KEY IN audit_logs table

      _Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.2.3.4 · Pass: 4_

      _Decomposition rationale:_ Defines the primary mechanism for enforcement, distinguishing it from application-layer validation and ensuring consistency with the Commit to Logging strategy.

      _Surfaced assumptions:_ A-0420, A-0421
    - **FR-ACCT-1.2.3.1.2** `[Tier C · pending]`
      **As a** API Developer, **I want** Return HTTP 400 Bad Request on rejected update, **so that** Client application receives clear failure status.

      **Acceptance criteria:**
        - **AC-1.2.3.1.2-A** — HTTP Status Code equals 400 for failed update
          - _Measurable:_ HTTP Status Code is 400 for request to UPDATE row in audit_logs

      _Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.2.3.2 · Pass: 4_

      _Decomposition rationale:_ Defines the API contract for failure states, coordinating with the Insert strategy to ensure clients handle failures gracefully.

      _Surfaced assumptions:_ A-0420, A-0421
    - **FR-ACCT-1.2.3.1.3** `[Tier D · atomic]`
      **As a** System Operator, **I want** Log failed update attempt metadata, **so that** Record exists in failure log or system logs.

      **Acceptance criteria:**
        - **AC-1.2.3.1.3-A** — System logs error event on constraint violation
          - _Measurable:_ Event log contains entry for failed update with timestamp and request ID

      _Status: atomic · Priority: high · Tier: D · Traces to: FR-ACCT-1.2.3.3, UJ-10 · Pass: 4_

      _Decomposition rationale:_ Ensures that constraint failures do not swallow events, supporting traceability per Consolidate Portfolio Reporting requirements.

      _Surfaced assumptions:_ A-0420, A-0421
  - **FR-ACCT-1.2.3.2** `[Tier D · atomic]`
    **As a** Log Operator, **I want** Insert a new record into the audit log table, **so that** Audit row persisted with event ID and timestamp.

    **Acceptance criteria:**
      - **AC-1.2.3.2-A** — Audit record exists after ingestion request.
        - _Measurable:_ SELECT COUNT(*) FROM audit_logs WHERE event_id = 'X' returns 1 at commit time.

    _Status: atomic · Priority: high · Tier: D · Traces to: FR-ACCT-1.2.3-A, UJ-10 · Pass: 3_

    _Decomposition rationale:_ The atomic write operation that realizes the commitment to an audit trail.

    _Surfaced assumptions:_ A-0193, A-0194, A-0195
  - **FR-ACCT-1.2.3.3** `[Tier C · pending]`
    **As a** Data Linker, **I want** Associate audit record with ingestion event ID and validation result, **so that** Audit record contains source references for traceability.

    **Acceptance criteria:**
      - **AC-1.2.3.3-A** — Audit record links to ingestion event and payload state.
        - _Measurable:_ audit_logs.payload_state IN ('accepted', 'rejected') AND audit_logs.event_id = ingestion_events.id

    _Status: pending · Priority: high · Tier: C · Traces to: FR-ACCT-1.2.3-A, UJ-10 · Pass: 3_

    _Decomposition rationale:_ Ensures the audit trail is connected to the specific ingestion transaction context for UJ-10 traceability.

    _Surfaced assumptions:_ A-0193, A-0194, A-0195
    - **FR-ACCT-1.2.3.3.1** `[Tier C · pending]`
      **As a** Database Architect, **I want** Create foreign key constraint linking audit_log.event_id to ingestion_events.id, **so that** Audit records are physically linked to ingestion events, preventing orphaned records.

      **Acceptance criteria:**
        - **AC-001** — Foreign key constraint exists and is enforced on write.
          - _Measurable:_ Database constraint 'audit_log_event_fk' exists and throws error on insert/update if referenced id is invalid

      _Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.2.3.2, AC-1.2.3.3-A · Pass: 4_

      _Decomposition rationale:_ Establishes the structural mechanism for traceability. This is an implementation commitment regarding database schema integrity, not a policy choice (Tier B).

      _Surfaced assumptions:_ A-0422, A-0423
    - **FR-ACCT-1.2.3.3.2** `[Tier C · pending]`
      **As a** Schema Designer, **I want** Define payload_state field with specific enum constraints, **so that** System stores validation outcomes as a controlled set of values for consistency.

      **Acceptance criteria:**
        - **AC-002** — payload_state only accepts values from a defined set.
          - _Measurable:_ SQL query 'SELECT DISTINCT payload_state FROM audit_logs WHERE payload_state NOT IN ('accepted', 'rejected')" returns zero rows

      _Status: pending · Priority: high · Tier: C · Traces to: AC-1.2.3.3-A, FR-ACCT-1.2.3.1 · Pass: 4_

      _Decomposition rationale:_ Defines the specific data type and value constraints for traceability, ensuring downstream code can parse the state without custom logic.

      _Surfaced assumptions:_ A-0422, A-0423
    - **FR-ACCT-1.2.3.3.3** `[Tier C · pending]`
      **As a** Performance Engineer, **I want** Create index on audit_logs.event_id for fast traceability lookups, **so that** Queries joining audit logs to ingestion events complete within target latency.

      **Acceptance criteria:**
        - **AC-003** — Index exists on event_id and is used in join plans.
          - _Measurable:_ EXPLAIN ANALYZE shows index scan on 'audit_log_event_id_idx' for queries joining on ingestion_events.id

      _Status: pending · Priority: medium · Tier: C · Traces to: FR-ACCT-1.2.3.1, FR-ACCT-1.2.3.3.1 · Pass: 4_

      _Decomposition rationale:_ Ensures the linkage is efficient. An unindexed FK would cause performance degradation during audit trail queries, violating operational constraints.

      _Surfaced assumptions:_ A-0422, A-0423
  - **FR-ACCT-1.2.3.4** `[Tier B · pending]`
    **As a** Policy Decider, **I want** Commit to logging ingestion events regardless of payload validation outcome, **so that** Audit trail covers both valid and invalid ingestion attempts.

    **Acceptance criteria:**
      - **AC-1.2.3.4-A** — Audit entry created for events marked as validation failure.
        - _Measurable:_ count(audit_logs where status='validation_failed') > 0 when validation_errors > 0

    _Status: pending · Priority: high · Tier: B · Traces to: FR-ACCT-1.2.3, FR-ACCT-1.2.1 · Pass: 3_

    _Decomposition rationale:_ Defines the boundary of the audit scope: it applies even to events that fail validation checks performed by sibling FR-ACCT-1.2.1.

    _Surfaced assumptions:_ A-0193, A-0194, A-0195
##### FR-ACCT-1.2.4 `[Tier C · pending]`

**As a** State Manager, **I want** Update Work Order status to reflect estimates received, **so that** Work Order status transitions to 'Estimates Received' if appropriate.

**Acceptance criteria:**
  - **AC-1.2.4-A** — Work Order status updated upon successful estimate persistence.
    - _Measurable:_ wo_status_changed == true if current status != 'Estimates Received'

_Status: pending · Priority: high · Tier: C · Traces to: WF-2, UJ-3, ENT-WORK-ORDER · Pass: 2_

_Decomposition rationale:_ Ensures the workflow engine knows estimates are available for selection (FR-ACCT-1.3/F1.4). Couples persistence with the workflow state machine.

_Surfaced assumptions:_ A-0058, A-0059, A-0060

  - **FR-ACCT-1.2.4-1** `[Tier C · pending]`
    **As a** Database Operation, **I want** Atomically write the status field transition on the Work Order entity record, **so that** The Work Order status field is updated to 'Estimates Received' in the database without race conditions.

    **Acceptance criteria:**
      - **AC-1.2.4-1A** — Status update persists only after transaction commit
        - _Measurable:_ READ(wo.status) == 'Estimates Received' immediately after WF-2 transaction commit completes

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-2, ENT-WORK-ORDER · Pass: 3_

    _Decomposition rationale:_ Binding the database write ensures the data consistency required by the 'State Manager' persona and prevents read-modify-write conflicts during concurrent updates.

    _Surfaced assumptions:_ A-0196, A-0197
    - **FR-ACCT-1.2.4-1.1** `[Tier C · pending]`
      **As a** Database Developer, **I want** Enforce workflow transaction boundary on DB commit, **so that** Database commit occurs only after WF-2 step completes successfully.

      **Acceptance criteria:**
        - **AC-1.1** — Database commit time precedes read verification by < 1ms
          - _Measurable:_ timestamp(txn.commit) <= timestamp(read(wo.status)) + 0.001

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-2 · Pass: 4_

      _Decomposition rationale:_ Defines the coupling mechanism between the workflow engine and the database transaction engine.

      _Surfaced assumptions:_ A-0424, A-0425
    - **FR-ACCT-1.2.4-1.2** `[Tier C · pending]`
      **As a** Database Developer, **I want** Implement optimistic locking via version column, **so that** Concurrent update attempts are rejected if version mismatch detected.

      **Acceptance criteria:**
        - **AC-1.2** — Update fails if current row version differs from snapshot
          - _Measurable:_ WHERE wo.version = :expected_version AND UPDATE ... > 0

      _Status: pending · Priority: critical · Tier: C · Traces to: ENT-WORK-ORDER · Pass: 4_

      _Decomposition rationale:_ Establishes the concurrency control strategy to handle race conditions without external locks.

      _Surfaced assumptions:_ A-0424, A-0425
    - **FR-ACCT-1.2.4-1.3** `[Tier C · pending]`
      **As a** Database Developer, **I want** Set transaction isolation level for critical section, **so that** Reads and writes are consistent under Serializable isolation.

      **Acceptance criteria:**
        - **AC-1.3** — Transaction isolation level is explicitly set to SERIALIZABLE
          - _Measurable:_ statement_isolation_level = 'SERIALIZABLE'

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-2, ENT-WORK-ORDER · Pass: 4_

      _Decomposition rationale:_ Ensures read consistency and prevents phantom reads during the critical update window.

      _Surfaced assumptions:_ A-0424, A-0425
  - **FR-ACCT-1.2.4-2** `[Tier C · pending]`
    **As a** Guard Condition, **I want** Validate that current status allows transition to 'Estimates Received', **so that** The system rejects the update if the Work Order is in 'Closed' or 'Completed' state.

    **Acceptance criteria:**
      - **AC-1.2.4-2A** — Status transition logic prevents invalid state jumps
        - _Measurable:_ WHEN(wo.status == 'Completed' OR wo.status == 'Closed') THEN reject(update_request) == true

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-2, UJ-3 · Pass: 3_

    _Decomposition rationale:_ This guards the integrity of the state machine defined in WF-2, ensuring 'Estimates Received' is only a valid intermediate or final state.

    _Surfaced assumptions:_ A-0196, A-0197
    - **FR-ACCT-1.2.4-2.1** `[Tier D · atomic]`
      **As a** READ operation, **I want** Retrieve current status value from the Work Order entity cache, **so that** System obtains the current status string for the Work Order in scope.

      **Acceptance criteria:**
        - **AC-1.2.4-2.1A** — Status read completes within sync timeout
          - _Measurable:_ read_latency_ms < 50ms AND status_value !== null AND status_value !== undefined

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-2 · Pass: 4_

      _Decomposition rationale:_ This is the first atomic step required to validate the guard condition; the system must first access the state before it can evaluate it.

      _Surfaced assumptions:_ A-0426, A-0427
    - **FR-ACCT-1.2.4-2.2** `[Tier D · atomic]`
      **As a** LOGIC operation, **I want** Compare status value against forbidden states list, **so that** System determines whether the current state triggers a guard rejection.

      **Acceptance criteria:**
        - **AC-1.2.4-2.2A** — Status check evaluates 'Closed' and 'Completed' states correctly
          - _Measurable:_ status_value in ['Closed', 'Completed'] === false OR reject_flag === true

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-2, UJ-3 · Pass: 4_

      _Decomposition rationale:_ This is the core verification logic defined in the parent acceptance criterion; it must be testable as a specific invariant check.

      _Surfaced assumptions:_ A-0426, A-0427
    - **FR-ACCT-1.2.4-2.3** `[Tier D · atomic]`
      **As a** ACTION operation, **I want** Return rejection response to the client if guard triggered, **so that** Client receives HTTP 4xx error with reason code for invalid transition.

      **Acceptance criteria:**
        - **AC-1.2.4-2.3A** — Rejection response is sent synchronously before database commit
          - _Measurable:_ response_code === 409 AND response_body.reason === 'INVALID_STATE_TRANSITION' AND db_write_not_performed === true

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-2, UJ-3 · Pass: 4_

      _Decomposition rationale:_ This is the terminal leaf operation for the guard branch; it enforces the business rule by physically blocking the update path.

      _Surfaced assumptions:_ A-0426, A-0427
  - **FR-ACCT-1.2.4-3** `[Tier D · atomic]`
    **As a** Audit Entry, **I want** Append immutable audit record for the status transition event, **so that** A durable log entry exists proving the status change occurred and by whom.

    **Acceptance criteria:**
      - **AC-1.2.4-3A** — Audit trail contains event hash and actor ID
        - _Measurable:_ EXISTS(ENT-AUDIT-LOG WHERE wo_id == parent_id AND event_type == 'WO_STATUS_CHANGE')

    _Status: atomic · Priority: high · Tier: D · Traces to: WF-2, WF-3 · Pass: 3_

    _Decomposition rationale:_ Leaf operation satisfying compliance and audit needs; verifies the action was logged per FR-ACCT-1.2.3 sibling context.

    _Surfaced assumptions:_ A-0196, A-0197
  - **FR-ACCT-1.2.4-4** `[Tier D · atomic]`
    **As a** Notification Trigger, **I want** Queue state update notification for the State Manager persona, **so that** The State Manager receives a notification that the status is now 'Estimates Received'.

    **Acceptance criteria:**
      - **AC-1.2.4-4A** — Notification enqueued within 5 minutes of status change
        - _Measurable:_ NOTIFY-LOG.entry_created_timestamp <= UPDATE_TIMESTAMP + 300 seconds

    _Status: atomic · Priority: medium · Tier: D · Traces to: WF-6, UJ-3 · Pass: 3_

    _Decomposition rationale:_ Leaf operation ensuring the user receives feedback as per UJ-3 'Track Job Progress' acceptance criteria.

    _Surfaced assumptions:_ A-0196, A-0197
##### FR-ACCT-1.2.5 `[Tier C · pending]`

**As a** Duplicate Resolver, **I want** Handle incoming duplicate estimates from same vendor, **so that** System rejects or merges duplicate estimates based on defined policy.

**Acceptance criteria:**
  - **AC-1.2.5-A** — Duplicate detection logic prevents accidental double-payment risks.
    - _Measurable:_ no two persisted records exist with identical vendor_id, wo_id, and cost within tolerance

_Status: pending · Priority: medium · Tier: C · Traces to: FR-ACCT-1.1, UJ-3, ENT-WORK-ESTIMATE · Pass: 2_

_Decomposition rationale:_ This child surfaces the open question of how duplicates are handled (merge vs reject). It ensures data integrity on the 'Count equals valid responses' AC by defining what counts as a 'valid' unique response.

_Surfaced assumptions:_ A-0058, A-0059, A-0060

  - **FR-ACCT-1.2.5.1** `[Tier C · pending]`
    **As a** Detection Strategy, **I want** Query existing estimates for identical vendor_id and wo_id, **so that** System identifies if a new estimate matches an existing one within tolerance.

    **Acceptance criteria:**
      - **AC-1.2.5.1-A** — Query returns matches if vendor, work order, and cost align.
        - _Measurable:_ query(existing_estimates, conditions: { vendor_id === incoming_vendor_id AND wo_id === incoming_wo_id AND abs(cost - incoming_cost) <= tolerance }) > 0

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-WORK-ESTIMATE, FR-ACCT-1.2.2 · Pass: 3_

    _Decomposition rationale:_ Defines the algorithmic approach to finding duplicates (index lookup vs linear scan), committing to the comparison logic required to enforce the parent AC.

    _Surfaced assumptions:_ A-0198, A-0199
    - **FR-ACCT-1.2.5.1-1** `[Tier C · pending]`
      **As a** CAM operator, **I want** Normalize vendor_id field from incoming and existing estimates before comparison, **so that** Comparison operates on standardized, whitespace-trimmed vendor identifiers.

      **Acceptance criteria:**
        - **AC-1.2.5.1-1-A** — Vendor ID strings are normalized to a canonical format before equality check.
          - _Measurable:_ normalized(incoming_vendor_id) === normalized(existing_vendor_id)

      _Status: pending · Priority: critical · Tier: C · Traces to: ENT-WORK-ESTIMATE · Pass: 4_

      _Decomposition rationale:_ Vendor identifiers vary in casing and spacing in field data; normalization is a prerequisite for accurate matching, making it a distinct implementation commitment under the query strategy.

      _Surfaced assumptions:_ A-0428, A-0429, A-0430, A-0431
    - **FR-ACCT-1.2.5.1-2** `[Tier C · pending]`
      **As a** CAM operator, **I want** Enforce unique work order ID equality constraint in query predicate, **so that** Estimates from different work orders are never considered duplicates regardless of vendor.

      **Acceptance criteria:**
        - **AC-1.2.5.1-2-A** — Only records with identical wo_id are returned in the query result set.
          - _Measurable:_ incoming_wo_id === existing_wo_id

      _Status: pending · Priority: critical · Tier: C · Traces to: ENT-WORK-ESTIMATE · Pass: 4_

      _Decomposition rationale:_ The strategy defines a strict scoping rule on the Work Order context; this child commits to the specific predicate required to isolate the correct search space.

      _Surfaced assumptions:_ A-0428, A-0429, A-0430, A-0431
    - **FR-ACCT-1.2.5.1-3** `[Tier C · pending]`
      **As a** CAM operator, **I want** Apply cost tolerance window for variance check, **so that** Estimates within the configured tolerance threshold are flagged as potential duplicates.

      **Acceptance criteria:**
        - **AC-1.2.5.1-3-A** — Flag records where abs(incoming_cost - existing_cost) is less than or equal to tolerance.
          - _Measurable:_ abs(incoming_cost - existing_cost) <= configured_tolerance

      _Status: pending · Priority: high · Tier: C · Traces to: ENT-WORK-ESTIMATE · Pass: 4_

      _Decomposition rationale:_ This child binds the specific logic for cost alignment, separating it from the identifier checks. The tolerance value itself is an open question for v1 configuration, but the logic must be implemented.

      _Surfaced assumptions:_ A-0428, A-0429, A-0430, A-0431
    - **FR-ACCT-1.2.5.1-4** `[Tier C · pending]`
      **As a** CAM operator, **I want** Count query results and determine duplicate flag based on cardinality, **so that** If result set count > 0, duplicate is identified; otherwise, proceed to next estimate.

      **Acceptance criteria:**
        - **AC-1.2.5.1-4-A** — Duplicate flag is asserted if query returns at least one matching record.
          - _Measurable:_ COUNT(query_results) > 0 => duplicate_flag = true

      _Status: pending · Priority: high · Tier: C · Traces to: ENT-WORK-ESTIMATE · Pass: 4_

      _Decomposition rationale:_ This is the decision logic that synthesizes the filtered results into the business outcome (duplicate identified or not). It defines the terminal logic of this detection strategy.

      _Surfaced assumptions:_ A-0428, A-0429, A-0430, A-0431
  - **FR-ACCT-1.2.5.2** `[Tier C · pending]`
    **As a** Threshold Setting, **I want** Apply cost tolerance threshold for cost variance, **so that** System determines if cost difference is negligible and counts as a duplicate.

    **Acceptance criteria:**
      - **AC-1.2.5.2-A** — Variance within tolerance triggers duplicate logic.
        - _Measurable:_ abs(existing_cost - incoming_cost) <= configured_tolerance_percentage

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-3, ENT-WORK-ESTIMATE · Pass: 3_

    _Decomposition rationale:_ Commits to a specific implementation parameter (cost tolerance) rather than an architectural choice, making it an implementation commitment (Tier C).

    _Surfaced assumptions:_ A-0198, A-0199
    - **FR-ACCT-1.2.5.2.1** `[Tier C · pending]`
      **As a** CAM operator, **I want** Compute absolute difference between existing and incoming cost values, **so that** A computed variance value ready for threshold comparison.

      **Acceptance criteria:**
        - **AC-001** — Computed variance equals absolute difference of costs.
          - _Measurable:_ abs(existing_cost - incoming_cost) == computed_variance

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-3, ENT-WORK-ESTIMATE, FR-ACCT-1.2.5.1 · Pass: 4_

      _Decomposition rationale:_ The variance calculation is the first atomic step required to apply the threshold logic; it depends on data fetched by FR-ACCT-1.2.5.1.

      _Surfaced assumptions:_ A-0432, A-0433, A-0434
    - **FR-ACCT-1.2.5.2.2** `[Tier C · pending]`
      **As a** CAM operator, **I want** Compare computed variance against configured tolerance percentage, **so that** Boolean flag indicating whether cost difference is negligible.

      **Acceptance criteria:**
        - **AC-002** — Variance is within bounds of tolerance.
          - _Measurable:_ computed_variance <= configured_tolerance_percentage

      _Status: pending · Priority: high · Tier: C · Traces to: UJ-3, ENT-WORK-ESTIMATE · Pass: 4_

      _Decomposition rationale:_ This child implements the decision boundary defined in the parent requirement; it determines the logical branch for duplicate handling.

      _Surfaced assumptions:_ A-0432, A-0433, A-0434
    - **FR-ACCT-1.2.5.2.3** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Mark incoming estimate as duplicate candidate if condition met, **so that** System identifies record as duplicate for rejection or merge.

      **Acceptance criteria:**
        - **AC-003** — Duplicate candidate flag is set to true when condition passes.
          - _Measurable:_ duplicate_candidate_flag == true

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-3, ENT-WORK-ESTIMATE, FR-ACCT-1.2.5.4 · Pass: 4_

      _Decomposition rationale:_ This is the atomic leaf operation that executes the 'duplicate logic' promise of the parent, leading to FR-ACCT-1.2.5.4 (Conflict).

      _Surfaced assumptions:_ A-0432, A-0433, A-0434
  - **FR-ACCT-1.2.5.3** `[Tier D · atomic]`
    **As a** Merge Operation, **I want** Update existing estimate record with new incoming data, **so that** Original estimate record is modified to include new fields, timestamp, or data without persistence of double record.

    **Acceptance criteria:**
      - **AC-1.2.5.3-A** — Existing record updated with newer timestamp and vendor data.
        - _Measurable:_ updated_estimate.timestamp === incoming_estimate.timestamp AND updated_estimate.data === merge(existing_data, incoming_data)

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-WORK-ESTIMATE, FR-ACCT-1.2.4 · Pass: 3_

    _Decomposition rationale:_ Atomic action that enforces the 'merge' branch of the parent policy. It is a leaf operation as it performs the final state transition.

    _Surfaced assumptions:_ A-0198, A-0199
  - **FR-ACCT-1.2.5.4** `[Tier D · atomic]`
    **As a** Reject Operation, **I want** Return HTTP 409 Conflict to client on duplicate detection, **so that** Client is notified that duplicate was rejected and must re-submit or resolve manually.

    **Acceptance criteria:**
      - **AC-1.2.5.4-A** — Client receives explicit error response for duplicate ingestion.
        - _Measurable:_ http_response.status === 409 AND response_body.contains('duplicate_detected')

    _Status: atomic · Priority: critical · Tier: D · Traces to: FR-ACCT-1.2.1, UJ-3 · Pass: 3_

    _Decomposition rationale:_ Atomic action that enforces the 'reject' branch of the parent policy. It terminates the ingestion flow for this specific estimate.

    _Surfaced assumptions:_ A-0198, A-0199
##### FR-ACCT-1.2.6 `[Tier C · pending]`

**As a** Status Verifier, **I want** Check Work Order eligibility for estimate storage, **so that** Estimates are only stored if the Work Order is in 'Active' or 'Soliciting' state.

**Acceptance criteria:**
  - **AC-1.2.6-A** — Ingestion fails if Work Order is closed or archived.
    - _Measurable:_ wo_status IN ('ACTIVE', 'SOLICITING') is true at time of ingestion

_Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.1, WF-2, ENT-WORK-ORDER · Pass: 2_

_Decomposition rationale:_ Enforces the constraint that estimates are only relevant for open orders. Prevents data pollution in closed cases.

_Surfaced assumptions:_ A-0058, A-0059, A-0060

  - **FR-ACCT-1.2.6-C1** `[Tier D · atomic]`
    **As a** Status Validator, **I want** Compare incoming estimate against Work Order status in DB, **so that** Validation succeeds if Work Order status is ACTIVE or SOLICITING.

    **Acceptance criteria:**
      - **AC-001** — Status comparison matches canonical allowed list.
        - _Measurable:_ SELECT status FROM ENT-WORK-ORDER WHERE id = incoming_wo_id; result IN ('ACTIVE', 'SOLICITING')

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-WORK-ORDER, WF-2 · Pass: 3_

    _Decomposition rationale:_ This child isolates the core state verification logic required by the parent. It binds the ingestion pipeline to the current state of the Work Order entity, ruling out cached or stale status checks.

    _Surfaced assumptions:_ A-0200, A-0201, A-0202
  - **FR-ACCT-1.2.6-C2** `[Tier D · atomic]`
    **As a** Ingestion Rejection Handler, **I want** Abort ingestion and generate rejection message, **so that** Estimate ingestion transaction is rolled back with error response.

    **Acceptance criteria:**
      - **AC-002** — Ingestion request returns 400/Invalid State error on validation failure.
        - _Measurable:_ HTTP Response Code === 400 AND Body contains 'Work Order not eligible for estimate' reason

    _Status: atomic · Priority: critical · Tier: D · Traces to: FR-ACCT-1.1, WF-2 · Pass: 3_

    _Decomposition rationale:_ This child defines the failure path for the parent commitment. It specifies the architectural consequence (abort/rollback) when the Tier D logic fails, preventing orphaned estimates.

    _Surfaced assumptions:_ A-0200, A-0201, A-0202
  - **FR-ACCT-1.2.6-C3** `[Tier D · atomic]`
    **As a** Audit Trail Recorder, **I want** Append rejection event to audit log, **so that** Immutable record of rejection exists in audit log for every failed validation.

    **Acceptance criteria:**
      - **AC-003** — Audit log entry created for rejected ingestion.
        - _Measurable:_ SELECT 1 FROM ENT-AUDIT-LOG WHERE event_type = 'INGEST_REJECTED' AND wo_id = incoming_wo_id; count > 0

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-AUDIT-LOG, COMP-5 · Pass: 3_

    _Decomposition rationale:_ This child ensures compliance and observability requirements are met for the rejection action. It connects the failure path to the audit infrastructure.

    _Surfaced assumptions:_ A-0200, A-0201, A-0202
#### FR-ACCT-1.3 `[Tier C · pending]`

**As a** CAM operator, **I want** Validate budget constraint on estimate selection, **so that** System blocks selection or persists of estimates where sum(costs) exceeds approved budget.

**Acceptance criteria:**
  - **AC-003** — Selection disabled if budget exceeded
    - _Measurable:_ If sum(est. costs) > budget_limit THEN selection_flag === false

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-3, ENT-WORK-ORDER · Pass: 1_

_Decomposition rationale:_ Budget check is a governing rule (AC-006). This child implements the policy verification, ensuring financial controls are active before estimates are usable.

_Surfaced assumptions:_ A-0007, A-0008, A-0009, A-0010, A-0011

##### FR-ACCT-1.3.1 `[Tier D · atomic]`

**As a** CAM operator, **I want** Read approved budget limit from Work Order entity, **so that** Budget limit value is loaded into calculation context.

**Acceptance criteria:**
  - **AC-003-1** — Budget limit value is fetched and present in context.
    - _Measurable:_ budget_limit_value IS NOT NULL AND budget_limit_value >= 0

_Status: atomic · Priority: critical · Tier: D · Traces to: FR-ACCT-1.3, ENT-WORK-ORDER · Pass: 2_

_Decomposition rationale:_ Atomic data retrieval required before any comparison can occur; defines the state required for the constraint check.

_Surfaced assumptions:_ A-0061, A-0062, A-0063

##### FR-ACCT-1.3.2 `[Tier D · atomic]`

**As a** CAM operator, **I want** Sum active vendor estimate costs, **so that** Total estimated cost is calculated from selected estimate set.

**Acceptance criteria:**
  - **AC-003-2** — Sum of estimate costs excludes inactive or draft estimates.
    - _Measurable:_ sum(est. costs) === aggregate(cost_field) WHERE estimate_status = 'active'

_Status: atomic · Priority: critical · Tier: D · Traces to: FR-ACCT-1.3, ENT-WORK-ESTIMATE · Pass: 2_

_Decomposition rationale:_ Atomic aggregation operation needed to derive the metric to be compared against the budget.

_Surfaced assumptions:_ A-0061, A-0062, A-0063

##### FR-ACCT-1.3.3 `[Tier D · atomic]`

**As a** CAM operator, **I want** Enforce budget constraint toggle, **so that** Selection flag is updated to reflect budget compliance.

**Acceptance criteria:**
  - **AC-003-3** — Selection flag is set based on comparison result.
    - _Measurable:_ if (sum_estimates > budget_limit) THEN selection_flag === false ELSE selection_flag === true

_Status: atomic · Priority: critical · Tier: D · Traces to: FR-ACCT-1.3, UJ-3 · Pass: 2_

_Decomposition rationale:_ The atomic state update action that realizes the validation result in the user interface.

_Surfaced assumptions:_ A-0061, A-0062, A-0063

#### FR-ACCT-1.4 `[Tier C · pending]`

**As a** CAM operator, **I want** Render vendor estimate comparison list on UI, **so that** UI displays sorted list of at least 3 distinct vendor estimates associated with the Work Order.

**Acceptance criteria:**
  - **AC-004** — UI lists at least 3 distinct estimates
    - _Measurable:_ List.length >= 3 AND List.item_count == count(persisted estimates)

_Status: pending · Priority: high · Tier: C · Traces to: UJ-3, ENT-WORK-ESTIMATE · Pass: 1_

_Decomposition rationale:_ Display logic is the user-facing commitment satisfying AC-005. It defines the UI state requirements and the minimum data density needed for comparison.

_Surfaced assumptions:_ A-0007, A-0008, A-0009, A-0010, A-0011

##### FR-ACCT-1.4.1 `[Tier C · pending]`

**As a** Backend Service, **I want** Retrieve persisted estimates for Work Order, **so that** UI receives array of estimate records associated with the parent Work Order.

**Acceptance criteria:**
  - **AC-1.4.1-001** — Retrieved data includes all estimates linked to WO_ID
    - _Measurable:_ Array returned in fetch response has length === count(ENT-WORK-ESTIMATE rows where WO_ID === input_id)

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-3, ENT-WORK-ESTIMATE · Pass: 2_

_Decomposition rationale:_ Binding the data source required to satisfy the list population AC; distinguishes from ingestion (1.2) by focusing on read retrieval for the list view.

_Surfaced assumptions:_ A-0064, A-0065, A-0066

  - **FR-ACCT-1.4.1-1** `[Tier C · pending]`
    **As a** Data Engineer, **I want** Deduplicate estimate rows by Vendor ID during aggregation, **so that** Response array contains unique estimates per vendor, preventing double-counting of vendor bids.

    **Acceptance criteria:**
      - **AC-1.4.1-1-01** — Response array contains unique estimates per vendor.
        - _Measurable:_ response.length === distinct_count(response.map(e => e.vendor_id))

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-3, FR-ACCT-1.4.1 · Pass: 3_

    _Decomposition rationale:_ The sibling requirement FR-ACCT-1.4.4 warns on count < 3, implying the system must present distinct vendor bids. This child commits the specific logic to avoid duplicate vendor entries from the same estimate.

    _Surfaced assumptions:_ A-0203
    - **FR-ACCT-1.4.1-1-1** `[Tier C · pending]`
      **As a** Data Engineer, **I want** Execute server-side aggregation using database grouping to ensure uniqueness, **so that** Payload is constructed from grouped results rather than post-processed rows.

      **Acceptance criteria:**
        - **AC-001** — Aggregation step is invoked before serialization.
          - _Measurable:_ DB query includes GROUP BY Vendor_ID clause before result set is returned to API layer

      _Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.4.1, UJ-3 · Pass: 4_

      _Decomposition rationale:_ Defines the location of the deduplication logic to ensure efficiency and consistency with the 'during aggregation' requirement.

      _Surfaced assumptions:_ A-0435
    - **FR-ACCT-1.4.1-1-2** `[Tier C · pending]`
      **As a** API Controller, **I want** Apply deduplication constraints specifically to Work Order Estimate entities, **so that** Deduplication logic does not affect Vendor Profiles or general asset lookups.

      **Acceptance criteria:**
        - **AC-002** — Constraint applies only to ENT-WORK-ESTIMATE rows.
          - _Measurable:_ Filter scope check returns true for Estimate entity and false for Vendor entity

      _Status: pending · Priority: high · Tier: C · Traces to: FR-ACCT-1.4.1-3, ENT-WORK-ESTIMATE · Pass: 4_

      _Decomposition rationale:_ Establishes the boundary of where the deduplication rule applies, preventing scope leakage to other vendor management functions.

      _Surfaced assumptions:_ A-0435
  - **FR-ACCT-1.4.1-2** `[Tier C · pending]`
    **As a** Security Engineer, **I want** Apply Row-Level Security (RLS) filters to estimate data source, **so that** User only sees estimates they have permission to view within their tenant.

    **Acceptance criteria:**
      - **AC-1.4.1-2-01** — No unauthorized estimates are returned.
        - _Measurable:_ ALL estimated_records WHERE tenant_id === USER.tenant_id

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-3, ENT-WORK-ESTIMATE, TECH-8 · Pass: 3_

    _Decomposition rationale:_ Multi-tenant isolation (TECH-8) is a mandatory constraint. This child implements the specific RLS logic required before the estimate count comparison can be trusted.

    _Surfaced assumptions:_ A-0203
    - **FR-ACCT-1.4.1-2-1** `[Tier C · pending]`
      **As a** Query Architect, **I want** Construct tenant-scoped WHERE predicate for estimate query, **so that** Query only selects rows matching the authenticated user's tenant ID.

      **Acceptance criteria:**
        - **AC-001** — Predicate includes tenant_id filter.
          - _Measurable:_ SELECT * FROM estimates WHERE tenant_id IN (SELECT tenant_id FROM users WHERE user_id = CURRENT_USER)

      _Status: pending · Priority: critical · Tier: C · Traces to: TECH-8, UJ-3 · Pass: 4_

      _Decomposition rationale:_ Defines the specific logic for data filtering at the SQL level, directly implementing the RLS strategy commitment.

      _Surfaced assumptions:_ A-0436, A-0437
    - **FR-ACCT-1.4.1-2-2** `[Tier C · pending]`
      **As a** Context Resolver, **I want** Resolve current session tenant context from authentication token, **so that** Application thread knows which tenant context applies to the current request.

      **Acceptance criteria:**
        - **AC-002** — Tenant ID retrieved from session successfully.
          - _Measurable:_ session.tenant_id != null AND session.tenant_id === auth_token.payload.tenant_id

      _Status: pending · Priority: critical · Tier: C · Traces to: ENT-USER, TECH-11 · Pass: 4_

      _Decomposition rationale:_ Ensures the query predicate has the necessary input variable (user context) to function correctly.

      _Surfaced assumptions:_ A-0436, A-0437
    - **FR-ACCT-1.4.1-2-3** `[Tier D · atomic]`
      **As a** Security Enforcer, **I want** Block row access where tenant IDs mismatch, **so that** Unauthorized requests receive empty result set for estimates.

      **Acceptance criteria:**
        - **AC-003** — Access denied on mismatch.
          - _Measurable:_ count(*) === 0 when estimate.tenant_id !== session.tenant_id

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-3, FR-ACCT-1.4.1-1 · Pass: 4_

      _Decomposition rationale:_ The atomic verification step that ensures no data leakage occurs if the predicate is correct.

      _Surfaced assumptions:_ A-0436, A-0437
    - **FR-ACCT-1.4.1-2-4** `[Tier D · atomic]`
      **As a** Data Validator, **I want** Persist RLS policies on ENT-WORK-ESTIMATE table schema, **so that** Database schema enforces row-level filtering automatically on SELECT queries.

      **Acceptance criteria:**
        - **AC-004** — RLS policy active on table.
          - _Measurable:_ SELECT row_level_security_enabled FROM table_info WHERE table_name = 'ent_work_estimate'

      _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-8, ENT-WORK-ESTIMATE · Pass: 4_

      _Decomposition rationale:_ The architectural commitment (using PostgreSQL RLS) translated into a concrete schema state leaf.

      _Surfaced assumptions:_ A-0436, A-0437
  - **FR-ACCT-1.4.1-3** `[Tier C · pending]`
    **As a** API Designer, **I want** Map estimate entity fields to API response payload, **so that** Response payload matches the expected schema without truncation or modification.

    **Acceptance criteria:**
      - **AC-1.4.1-3-01** — Response structure matches API schema contract.
        - _Measurable:_ JSON.stringify(response) === JSON.stringify(schema.validate(response))

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-3, ENT-WORK-ESTIMATE · Pass: 3_

    _Decomposition rationale:_ This child ensures the data retrieved (from 1.4.1-2) is correctly serialized into the frontend expectation defined by the response contract.

    _Surfaced assumptions:_ A-0203
    - **FR-ACCT-1.4.1-3.1** `[Tier B · pending]`
      **As a** API Architect, **I want** Adopt strict OpenAPI schema as the single source of truth for response payloads, **so that** All responses validated against contract before transmission.

      **Acceptance criteria:**
        - **AC-001** — Response passes schema validation.
          - _Measurable:_ JSON.stringify(response) === JSON.stringify(schema.validate(response))

      _Status: pending · Priority: critical · Tier: B · Traces to: UJ-3, ENT-WORK-ESTIMATE, FR-ACCT-1.4.1-2 · Pass: 4_

      _Decomposition rationale:_ Establishes the architectural boundary and policy for what constitutes a valid API response, overriding any default serialization behavior.

      _Surfaced assumptions:_ A-0438, A-0439, A-0440
    - **FR-ACCT-1.4.1-3.2** `[Tier C · pending]`
      **As a** Developer, **I want** Project specific ENT-WORK-ESTIMATE fields to response keys, **so that** Response structure mirrors schema aliases.

      **Acceptance criteria:**
        - **AC-002** — Mapped fields match schema definitions.
          - _Measurable:_ response.keys() === schema.required_keys()

      _Status: pending · Priority: high · Tier: C · Traces to: ENT-WORK-ESTIMATE, FR-ACCT-1.4.1-1, FR-ACCT-1.4.1-2 · Pass: 4_

      _Decomposition rationale:_ Defines the concrete implementation decision for field projection, ensuring deduplication logic and RLS are respected during mapping.

      _Surfaced assumptions:_ A-0438, A-0439, A-0440
    - **FR-ACCT-1.4.1-3.3** `[Tier C · pending]`
      **As a** Developer, **I want** Prevent truncation of string values in JSON payload, **so that** No data loss on character count.

      **Acceptance criteria:**
        - **AC-003** — String lengths preserved.
          - _Measurable:_ response.text_field.length >= source.field_length

      _Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.4.1-3.2 · Pass: 4_

      _Decomposition rationale:_ Enforces the 'without truncation' constraint from the parent AC by committing to a serialization strategy that preserves integrity.

      _Surfaced assumptions:_ A-0438, A-0439, A-0440
    - **FR-ACCT-1.4.1-3.4** `[Tier C · pending]`
      **As a** Developer, **I want** Omit non-schema-compliant fields from output, **so that** Clean payload matching contract.

      **Acceptance criteria:**
        - **AC-004** — No extra keys in response.
          - _Measurable:_ Object.keys(response).length === Object.keys(schema).length

      _Status: pending · Priority: high · Tier: C · Traces to: FR-ACCT-1.4.1-3.1 · Pass: 4_

      _Decomposition rationale:_ Implementation commitment to filter out legacy or unused fields that are not defined in the schema.

      _Surfaced assumptions:_ A-0438, A-0439, A-0440
    - **FR-ACCT-1.4.1-3.5** `[Tier D · atomic]`
      **As a** Automation, **I want** Serialize single Estimate row to JSON string, **so that** Valid UTF-8 string.

      **Acceptance criteria:**
        - **AC-005** — Valid JSON output.
          - _Measurable:_ JSON.parse(response).valid

      _Status: atomic · Priority: medium · Tier: D · Traces to: ENT-WORK-ESTIMATE · Pass: 4_

      _Decomposition rationale:_ Atomic leaf operation representing the fundamental action of serializing data for transmission.

      _Surfaced assumptions:_ A-0438, A-0439, A-0440
##### FR-ACCT-1.4.2 `[Tier C · pending]`

**As a** Frontend Service, **I want** Order retrieved estimates by cost, **so that** UI displays list with vendor estimates sorted ascending by price.

**Acceptance criteria:**
  - **AC-1.4.2-001** — UI order matches ascending cost sort
    - _Measurable:_ Array index 0 has minimum cost and index N has maximum cost for sorted list

_Status: pending · Priority: high · Tier: C · Traces to: UJ-3, ENT-WORK-ESTIMATE · Pass: 2_

_Decomposition rationale:_ Binding the sorting mechanism; ensures 'sorted list' requirement is met; distinct from filtering (1.5) as this is purely ordering of available data.

_Surfaced assumptions:_ A-0064, A-0065, A-0066

  - **FR-ACCT-1.4.2.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Expose Cost field in Estimate response, **so that** Client receives estimate records including numeric cost value for sorting.

    **Acceptance criteria:**
      - **AC-1.4.2.1-001** — Estimate response contains cost field.
        - _Measurable:_ estimate.cost != null && typeof estimate.cost === 'number'

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-WORK-ESTIMATE, FR-ACCT-1.4.1 · Pass: 3_

    _Decomposition rationale:_ Sorting requires the sort key to exist in the payload. This commits to the data integrity constraint required for the parent sort logic.

    _Surfaced assumptions:_ A-0204, A-0205
    - **FR-ACCT-1.4.2.1.1** `[Tier C · pending]`
      **As a** API Layer Engineer, **I want** Include 'cost' property in Estimate JSON response object, **so that** Response payload contains the cost key with valid data.

      **Acceptance criteria:**
        - **AC-1.4.2.1-001-A** — JSON response object includes the cost field.
          - _Measurable:_ estimate.response.cost_key in JSON keys === true

      _Status: pending · Priority: high · Tier: C · Traces to: ENT-WORK-ESTIMATE · Pass: 4_

      _Decomposition rationale:_ Defines the structural requirement for the API payload to ensure the client receives the data needed for sorting in sibling FR-ACCT-1.4.2.2.

      _Surfaced assumptions:_ A-0441, A-0442
    - **FR-ACCT-1.4.2.1.2** `[Tier C · pending]`
      **As a** QA Engineer, **I want** Validate cost field is a JavaScript Number type, **so that** Validation fails if cost is string, boolean, object, or null.

      **Acceptance criteria:**
        - **AC-1.4.2.1-001-B** — Value type check for cost field.
          - _Measurable:_ typeof estimate.cost === 'number'

      _Status: pending · Priority: high · Tier: C · Traces to: ENT-WORK-ESTIMATE, FR-ACCT-1.4.2.2 · Pass: 4_

      _Decomposition rationale:_ Ensures the value is compatible with numeric sorting operations required by the sibling requirement for list ordering.

      _Surfaced assumptions:_ A-0441, A-0442
    - **FR-ACCT-1.4.2.1.3** `[Tier C · pending]`
      **As a** Backend Developer, **I want** Substitute numeric zero for missing cost values, **so that** Response returns 0 instead of null for missing calculations.

      **Acceptance criteria:**
        - **AC-1.4.2.1-001-C** — Cost field is never null in response.
          - _Measurable:_ estimate.cost.value !== null

      _Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.4.2.2 · Pass: 4_

      _Decomposition rationale:_ Prevents sort logic in FR-ACCT-1.4.2.2 from failing when data is missing, effectively resolving the open question A-0205 by committing to a default strategy.

      _Surfaced assumptions:_ A-0441, A-0442
  - **FR-ACCT-1.4.2.2** `[Tier D · atomic]`
    **As a** Leaf operation, **I want** Sort list array by cost ascending, **so that** Array of estimates is reordered so index 0 holds min cost and index N holds max cost.

    **Acceptance criteria:**
      - **AC-1.4.2.2-001** — Output array matches input array with ascending sort.
        - _Measurable:_ for (i=0;i<arr.length;i++) arr[i].cost <= arr[i+1].cost

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-3, FR-ACCT-1.4.2.1 · Pass: 3_

    _Decomposition rationale:_ This is the core atomic operation fulfilling the parent requirement's primary sorting goal. It is testable as a verification of correctness.

    _Surfaced assumptions:_ A-0204, A-0205
  - **FR-ACCT-1.4.2.3** `[Tier D · atomic]`
    **As a** Leaf operation, **I want** Transmit sorted list to client, **so that** Client renders list reflecting server-side sort order.

    **Acceptance criteria:**
      - **AC-1.4.2.3-001** — Client DOM order matches response array order.
        - _Measurable:_ DOM.element_order === response.array_index_order

    _Status: atomic · Priority: medium · Tier: D · Traces to: FR-ACCT-1.4.3, FR-ACCT-1.4.2.2 · Pass: 3_

    _Decomposition rationale:_ Final step of the data flow that ensures the UI requirement (sorted display) is met. Overlaps conceptually with rendering but focuses on data state.

    _Surfaced assumptions:_ A-0204, A-0205
##### FR-ACCT-1.4.3 `[Tier D · atomic]`

**As a** UI Render Engine, **I want** Render estimate comparison list grid, **so that** DOM element displays the comparison list with vendor details and prices.

**Acceptance criteria:**
  - **AC-1.4.3-001** — UI grid mounts and displays data correctly
    - _Measurable:_ DOM elements for each estimate card exist and contain text equal to rendered estimate data

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-3 · Pass: 2_

_Decomposition rationale:_ Leaf operation representing the atomic action of visualizing the data; final output step for the UI rendering requirement.

_Surfaced assumptions:_ A-0064, A-0065, A-0066

##### FR-ACCT-1.4.4 `[Tier D · atomic]`

**As a** UI Validation Logic, **I want** Verify minimum distinct estimate count, **so that** UI displays warning or message if distinct estimates count is less than 3.

**Acceptance criteria:**
  - **AC-1.4.4-001** — Warning message appears if distinct count < 3
    - _Measurable:_ Warning element visibility === (list.length < 3 ? true : false)

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-3 · Pass: 2_

_Decomposition rationale:_ Leaf operation handling the 'at least 3' constraint; ensures the system explicitly communicates the AC failure condition when data is insufficient.

_Surfaced assumptions:_ A-0064, A-0065, A-0066

#### FR-ACCT-1.5 `[Tier C · pending]`

**As a** CAM operator, **I want** Filter inactive vendors from estimate solicitation, **so that** System excludes vendors with expired licenses or insurance from the solicitation list.

**Acceptance criteria:**
  - **AC-005** — Only active vendors receive requests
    - _Measurable:_ Request sent only if vendor.status == 'active' AND license_expiry_date > now

_Status: pending · Priority: high · Tier: C · Traces to: ENT-VENDOR, UJ-3 · Pass: 1_

_Decomposition rationale:_ Vendor eligibility is a compliance-driven constraint. It ensures solicited estimates come from qualified sources, preventing non-compliant work from entering the workflow.

_Surfaced assumptions:_ A-0007, A-0008, A-0009, A-0010, A-0011

##### FR-ACCT-1.5-2 `[Tier C · pending]`

**As a** Backend Service, **I want** Validate Vendor License Status, **so that** System queries license records and blocks request dispatch if expired.

**Acceptance criteria:**
  - **AC-002** — License expiry check executes within the solicitation request pipeline
    - _Measurable:_ SELECT COUNT(*) FROM ENT_VENDOR_LICENSE WHERE vendor_id = 'X' AND expiry_date < 'Y' AND status = 'expired'

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-3, FR-ACCT-1.1 · Pass: 2_

_Decomposition rationale:_ Implementation commitment to specific data validation logic (License check) distinct from Insurance check, enabling parallel or sequential verification logic.

_Surfaced assumptions:_ A-0067, A-0068, A-0069

  - **FR-ACCT-1.5-2.1** `[Tier D · atomic]`
    **As a** Leaf Operation, **I want** Retrieve license record from ENT_VENDOR_LICENSE, **so that** Vendor license status data returned to validation step.

    **Acceptance criteria:**
      - **AC-101** — License data is fetched for requested vendor ID.
        - _Measurable:_ SELECT statement returns a row where vendor_id matches request and no error is thrown

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-3 · Pass: 3_

    _Decomposition rationale:_ Data retrieval is the atomic data access step required to enable the expiry check; it is testable by verifying the DB row exists.

    _Surfaced assumptions:_ A-0206, A-0207
  - **FR-ACCT-1.5-2.2** `[Tier D · atomic]`
    **As a** Leaf Operation, **I want** Compare license expiry date against current server time, **so that** Boolean flag indicating if license is currently valid.

    **Acceptance criteria:**
      - **AC-102** — Expiry comparison logic returns correct status.
        - _Measurable:_ Boolean result is true iff current UTC time < expiry_date stored in record

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-3 · Pass: 3_

    _Decomposition rationale:_ Expiry logic is the core business verification step; splitting this out allows unit testing of the timestamp comparison independent of database access.

    _Surfaced assumptions:_ A-0206, A-0207
  - **FR-ACCT-1.5-2.3** `[Tier D · atomic]`
    **As a** Leaf Operation, **I want** Reject dispatch request if license is expired, **so that** Request pipeline terminates with block reason.

    **Acceptance criteria:**
      - **AC-103** — Dispatch is blocked if validity flag is false.
        - _Measurable:_ HTTP 403 or equivalent rejection status returned when expiry check is invalid

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-3 · Pass: 3_

    _Decomposition rationale:_ Enforcement is the atomic action step; testable by asserting that an invalid license triggers the blocking behavior.

    _Surfaced assumptions:_ A-0206, A-0207
##### FR-ACCT-1.5-3 `[Tier C · pending]`

**As a** Backend Service, **I want** Validate Vendor Insurance Status, **so that** System queries insurance records and blocks request dispatch if expired or lapsed.

**Acceptance criteria:**
  - **AC-003** — Insurance status check executes and verifies continuous coverage
    - _Measurable:_ SELECT COUNT(*) FROM ENT_VENDOR_INSURANCE WHERE vendor_id = 'X' AND coverage_status = 'active' AND current_date < expiry_date

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-3, FR-ACCT-1.1 · Pass: 2_

_Decomposition rationale:_ Implementation commitment to specific data validation logic (Insurance check) distinct from License check, ensuring complete compliance data coverage.

_Surfaced assumptions:_ A-0067, A-0068, A-0069

  - **FR-ACCT-1.5-3.1** `[Tier D · atomic]`
    **As a** Data Access Operator, **I want** Execute query against ENT-VENDOR-INSURANCE table, **so that** Active policy record is retrieved for vendor_id.

    **Acceptance criteria:**
      - **AC-003-1** — SQL query returns at least one row for valid vendor.
        - _Measurable:_ SELECT COUNT(*) >= 1 WHERE vendor_id = 'X' AND coverage_status = 'active' returns true

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-3, WF-7 · Pass: 3_

    _Decomposition rationale:_ Atomic data retrieval step required to verify the existence of active coverage. Must be validated before logic execution.

    _Surfaced assumptions:_ A-0208, A-0209
  - **FR-ACCT-1.5-3.2** `[Tier D · atomic]`
    **As a** Validation Operator, **I want** Compare current date against policy expiry, **so that** Determines if coverage is continuous..

    **Acceptance criteria:**
      - **AC-003-2** — Date math confirms coverage validity.
        - _Measurable:_ current_date < expiry_date evaluates to true for all retrieved records

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-3, WF-7 · Pass: 3_

    _Decomposition rationale:_ Atomic logic step that isolates the time-bound constraint. System must use server-authoritative time.

    _Surfaced assumptions:_ A-0208, A-0209
  - **FR-ACCT-1.5-3.3** `[Tier C · pending]`
    **As a** Enforcement Mechanism, **I want** Reject request dispatch if validation fails, **so that** Work Order Assignment or Job Creation is halted..

    **Acceptance criteria:**
      - **AC-003-3** — Dispatch queue rejects request upon failure.
        - _Measurable:_ Dispatch Queue status transitions to 'BLOCKED' or error code 'INS_EXPIRED'

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-7, COMP-5 · Pass: 3_

    _Decomposition rationale:_ This child commits to the architectural enforcement point where validation results impact workflow state. It groups the consequence logic.

    _Surfaced assumptions:_ A-0208, A-0209
    - **FR-ACCT-1.5-3.3-C-1** `[Tier C · pending]`
      **As a** CAM operator, **I want** Read vendor license and insurance records, **so that** Determine if vendor status is 'ACTIVE' based on non-expired fields.

      **Acceptance criteria:**
        - **AC-003-3.1** — Boolean 'is_active' is derived from database state.
          - _Measurable:_ license_expiry_date > server_time AND insurance_expiry_date > server_time

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-7 · Pass: 4_

      _Decomposition rationale:_ Defines the data retrieval strategy required to evaluate the enforcement rule.

      _Surfaced assumptions:_ A-0443
    - **FR-ACCT-1.5-3.3-C-2** `[Tier C · pending]`
      **As a** CAM operator, **I want** Transition work assignment status to 'BLOCKED', **so that** Work Order Assignment or Job Creation is halted in the workflow.

      **Acceptance criteria:**
        - **AC-003-3.2** — Status field in persistence store equals 'BLOCKED'.
          - _Measurable:_ status_field == 'BLOCKED' for the specific assignment ID at commit time

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-7 · Pass: 4_

      _Decomposition rationale:_ Specific state mutation required to enforce the halt condition synchronously.

      _Surfaced assumptions:_ A-0443
    - **FR-ACCT-1.5-3.3-C-3** `[Tier C · pending]`
      **As a** CAM operator, **I want** Emit specific rejection reason code, **so that** Upstream dispatcher receives 'INS_EXPIRED' or 'LIC_EXPIRED'.

      **Acceptance criteria:**
        - **AC-003-3.3** — Error payload contains code corresponding to failure type.
          - _Measurable:_ error_code in response matches 'INS_EXPIRED' or 'LIC_EXPIRED' based on record read

      _Status: pending · Priority: high · Tier: C · Traces to: WF-7 · Pass: 4_

      _Decomposition rationale:_ Communicates the cause of failure to the dispatching workflow for context and retry logic.

      _Surfaced assumptions:_ A-0443
    - **FR-ACCT-1.5-3.3-C-4** `[Tier C · pending]`
      **As a** CAM operator, **I want** Record compliance event for the rejection, **so that** Audit trail contains the blocking event with reason.

      **Acceptance criteria:**
        - **AC-003-3.4** — ENT-COMPLIANCE-EVENT record created with rejection reason.
          - _Measurable:_ COUNT(ENT-COMPLIANCE-EVENT where rejection_reason in response) == 1 within 1 second

      _Status: pending · Priority: high · Tier: C · Traces to: COMP-5 · Pass: 4_

      _Decomposition rationale:_ Satisfies compliance requirements for enforcement events as defined in COMP-5.

      _Surfaced assumptions:_ A-0443
  - **FR-ACCT-1.5-3.4** `[Tier D · atomic]`
    **As a** Compliance Recorder, **I want** Create compliance event log entry, **so that** Event is stored in ENT-COMPLIANCE-EVENT..

    **Acceptance criteria:**
      - **AC-003-4** — Filtering event is recorded for audit trail.
        - _Measurable:_ INSERT INTO ENT-COMPLIANCE-EVENT records status 'Insurance_Expired' at commit time

    _Status: atomic · Priority: medium · Tier: D · Traces to: WF-5, A-0069 · Pass: 3_

    _Decomposition rationale:_ Atomic audit action required to satisfy audit logging constraints. Independent of the blocking decision.

    _Surfaced assumptions:_ A-0208, A-0209
##### FR-ACCT-1.5-4 `[Tier C · pending]`

**As a** Audit Service, **I want** Log Vendor Exclusion Event, **so that** System records filtered vendor to audit trail for compliance review.

**Acceptance criteria:**
  - **AC-004** — Exclusion event is persisted with vendor ID, reason, and timestamp
    - _Measurable:_ INSERT INTO ENT_COMPLIANCE_EVENT VALUES (vendor_id, 'VENDOR_FILTERED', reason, current_timestamp)

_Status: pending · Priority: high · Tier: C · Traces to: UJ-3, FR-ACCT-1.1 · Pass: 2_

_Decomposition rationale:_ Implementation commitment to audit trail creation, ensuring that the exclusion action is observable and immutable as per compliance obligations.

_Surfaced assumptions:_ A-0067, A-0068, A-0069

  - **FR-ACCT-1.5-4.1** `[Tier C · pending]`
    **As a** Compliance Engine, **I want** Validate vendor exclusion trigger state before logging, **so that** System confirms vendor status reflects exclusion logic before persisting.

    **Acceptance criteria:**
      - **AC-101** — Vendor status indicates exclusion in source record.
        - _Measurable:_ ENT-VENDOR status equals 'FILTERED' at time of log generation

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.5-2, FR-ACCT-1.5-3, UJ-3 · Pass: 3_

    _Decomposition rationale:_ This child validates the precondition (Vendor Exclusion) referenced by the parent. It links to sibling license/insurance validation steps where the actual filtering decision is made, ensuring we only log genuine exclusions, not standard status checks.

    _Surfaced assumptions:_ A-0210, A-0211
    - **FR-ACCT-1.5-4.1.1** `[Tier C · pending]`
      **As a** Data Reader, **I want** Retrieve vendor status from source of record before validation, **so that** System retrieves the latest committed status value for the target vendor.

      **Acceptance criteria:**
        - **AC-0101-1** — Status is read from ENT-VENDOR status field at commit time.
          - _Measurable:_ ENT-VENDOR.status value is fetched from the committed database state, not a cache, at the moment of validation request

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-3, FR-ACCT-1.5-4.2 · Pass: 4_

      _Decomposition rationale:_ The validation flow requires retrieving the authoritative state. We separate 'Read' from 'Check' to ensure atomicity of the source fetch.

      _Surfaced assumptions:_ A-0444
    - **FR-ACCT-1.5-4.1.2** `[Tier C · pending]`
      **As a** Logic Validator, **I want** Compare retrieved status against exclusion threshold, **so that** Boolean result determining if exclusion logic is triggered.

      **Acceptance criteria:**
        - **AC-0101-2** — Vendor status indicates exclusion in source record.
          - _Measurable:_ Status value retrieved matches the constant string 'FILTERED' within the vendor validation logic

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-3, FR-ACCT-1.5-4.2 · Pass: 4_

      _Decomposition rationale:_ The validation logic is a specific implementation choice. The comparison threshold ('FILTERED') is an engineering sub-strategy decision.

      _Surfaced assumptions:_ A-0444
    - **FR-ACCT-1.5-4.1.3** `[Tier C · pending]`
      **As a** Gatekeeper, **I want** Gate the compliance event logging based on validation result, **so that** Logging proceeds only if validation passes exclusion trigger.

      **Acceptance criteria:**
        - **AC-0101-3** — Persistence to ENT_COMPLIANCE_EVENT is allowed only if validation succeeds.
          - _Measurable:_ Event write operation is initiated only if the boolean result from FR-ACCT-1.5-4.1.2 is true; otherwise, the request to FR-ACCT-1.5-4.2 is aborted

      _Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.5-4.2 · Pass: 4_

      _Decomposition rationale:_ This child commits to the gating behavior that links the validation result to the logging sibling FR-ACCT-1.5-4.2, ensuring compliance before persistence.

      _Surfaced assumptions:_ A-0444
  - **FR-ACCT-1.5-4.2** `[Tier D · atomic]`
    **As a** Data Writer, **I want** Persist compliance event record to database, **so that** Row written to ENT_COMPLIANCE_EVENT with required fields.

    **Acceptance criteria:**
      - **AC-102** — Record inserted into ENT_COMPLIANCE_EVENT with non-null values.
        - _Measurable:_ SELECT COUNT(*) FROM ENT_COMPLIANCE_EVENT WHERE vendor_id = ? AND event_type = 'VENDOR_FILTERED' returns 1 at commit time

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-3, FR-ACCT-1.1 · Pass: 3_

    _Decomposition rationale:_ This child represents the terminal operation (Leaf) of the logging process. It is atomic (insert row) and testable against the specific database structure defined in the parent AC, satisfying the 'Leaf Operations' definition.

    _Surfaced assumptions:_ A-0210, A-0211
##### FR-ACCT-1.5-1 `[downgraded]`

**As a** System Logic, **I want** Define Active Vendor Status Rule, **so that** System enforces composite status definition requiring both license and insurance validity.

**Acceptance criteria:**
  - **AC-001** — Vendor 'active' status is only true if license_expiry_date > now AND insurance_expiry_date > now
    - _Measurable:_ vendor.status === 'active' AND (license_expiry_date > current_timestamp() AND insurance_expiry_date > current_timestamp())

_Status: downgraded · Priority: critical · Traces to: UJ-3 · Pass: 3_

  - **FR-ACCT-1.5-1.1** `[Tier C · pending]`
    **As a** System Logic, **I want** Compute derived status field by evaluating expiry conditions, **so that** Vendor record includes a boolean field reflecting the composite status logic.

    **Acceptance criteria:**
      - **AC-001** — Boolean field matches logical result of expiry checks.
        - _Measurable:_ record.vendor_status == (license_expiry_date > current_timestamp() && insurance_expiry_date > current_timestamp())

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-3, FR-ACCT-1.5-2 · Pass: 3_

    _Decomposition rationale:_ This child binds the specific implementation mechanism (computed field) under the broader policy commitment to define the rule.

    _Surfaced assumptions:_ A-0358, A-0359, A-0360
  - **FR-ACCT-1.5-1.2** `[Tier C · pending]`
    **As a** System Logic, **I want** Enforce request failure on composite status failure, **so that** System rejects write requests if vendor status is determined inactive by the rule.

    **Acceptance criteria:**
      - **AC-002** — Request fails when status logic evaluates false.
        - _Measurable:_ http_status_code == 400 if (!is_active && attempt == write_request)

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-3, FR-ACCT-1.5-4 · Pass: 3_

    _Decomposition rationale:_ This child commits to the downstream consequence (blocking) of the status rule, distinguishing it from the definition itself.

    _Surfaced assumptions:_ A-0358, A-0359, A-0360
  - **FR-ACCT-1.5-1.3** `[Tier B · pending]`
    **As a** Policy Maker, **I want** Define grace period policy for license expiration, **so that** System policy defines whether a buffer period exists between expiry and status change.

    **Acceptance criteria:**
      - **AC-003** — Grace period configuration is present and validated.
        - _Measurable:_ config.grace_period_days exists and config.grace_period_days >= 0

    _Status: pending · Priority: medium · Tier: B · Traces to: UJ-3, FR-ACCT-1.5-5 · Pass: 3_

    _Decomposition rationale:_ This child is a policy choice (Tier B) as it dictates the tolerance for status transition, which is a human decision (e.g., 0 days vs 30 days).

    _Surfaced assumptions:_ A-0358, A-0359, A-0360
### FR US-004 `[pending]`

**As a** Contractor, **I want** Complete Work Order and generate Invoice, **so that** Job is closed and financial obligation recorded in General Ledger.

**Acceptance criteria:**
  - **AC-007** — Invoice generated
    - _Measurable:_ ENT-INVOICE record created within 1 minute of job completion status
  - **AC-008** — Job Costing calculated
    - _Measurable:_ Invoice includes materials, labor, and equipment line items

_Status: pending · Priority: critical · Traces to: UJ-4, WF-3, WF-4, VOC-19, ENT-INVOICE, ENT-LEDGER · Pass: 0_

#### US-004.1 `[Tier C · pending]`

**As a** CAM operator, **I want** Calculate job costing by aggregating materials, labor, and equipment line items, **so that** Invoice line items accurately reflect total job costs for financial recording.

**Acceptance criteria:**
  - **AC-004.1** — Invoice line items match cost components.
    - _Measurable:_ sum(material_costs) + sum(labor_costs) + sum(equipment_costs) === invoice_total_cost for the completed job

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, WF-3, VOC-19 · Pass: 1_

_Decomposition rationale:_ Defines the core calculation logic required to fulfill the 'Job Costing calculated' AC; concrete enough to define the calculation algorithm and data sources.

_Surfaced assumptions:_ A-0012, A-0013, A-0014

##### US-004.1.1 `[Tier C · pending]`

**As a** CAM operator, **I want** Aggregate material costs from active inventory transactions, **so that** Material cost component accurately reflects sum of consumed items.

**Acceptance criteria:**
  - **AC-001** — Material cost matches inventory ledger.
    - _Measurable:_ sum(transaction_quantity * unit_price) for items with status='Consumed' === material_cost_component

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, WF-3, VOC-19 · Pass: 2_

_Decomposition rationale:_ Defines the specific data source and calculation rule for the material component, converting the high-level requirement into testable implementation logic.

_Surfaced assumptions:_ A-0070, A-0071, A-0072

  - **US-004.1.1.1** `[Tier B · pending]`
    **As a** CAM operator, **I want** Define Material Cost Data Source, **so that** System reads material consumption from ENT-TRANSACTION ledger.

    **Acceptance criteria:**
      - **AC-001-1** — System uses ENT-TRANSACTION as the canonical source for material cost data.
        - _Measurable:_ No reads from ENT-INVENTORY or ENT-COST-RAW for material aggregation in production

    _Status: pending · Priority: critical · Tier: B · Traces to: VOC-19, UJ-4 · Pass: 3_

    _Decomposition rationale:_ Selecting the canonical source table is an architectural choice (Engineering sub-strategy) that dictates downstream data access patterns and isolation.

    _Surfaced assumptions:_ A-0212, A-0213, A-0214
  - **US-004.1.1.2** `[Tier B · pending]`
    **As a** CAM operator, **I want** Commit to Price Source Strategy, **so that** System pulls unit price from ENT-PRICEBOOK at time of calculation.

    **Acceptance criteria:**
      - **AC-001-2** — Cost calculation utilizes rates stored in ENT-PRICEBOOK rather than transaction snapshot.
        - _Measurable:_ query(unit_price) returns value from ENT-PRICEBOOK.current_rates for the transaction date

    _Status: pending · Priority: high · Tier: B · Traces to: VOC-19, WF-3 · Pass: 3_

    _Decomposition rationale:_ Distinguishes between static snapshot vs. current price lookups; this is a policy choice regarding cost validity (Scope commitment).

    _Surfaced assumptions:_ A-0212, A-0213, A-0214
  - **US-004.1.1.3** `[Tier C · pending]`
    **As a** System Engineer, **I want** Implement Cost Aggregation Logic, **so that** System sums (quantity * unit_price) for valid rows.

    **Acceptance criteria:**
      - **AC-001-3** — Aggregated value equals the AC-001 mathematical invariant.
        - _Measurable:_ sum(transaction_quantity * unit_price) for status='Consumed' rows === material_cost_component

    _Status: pending · Priority: critical · Tier: C · Traces to: VOC-19 · Pass: 3_

    _Decomposition rationale:_ This is the core algorithmic implementation commitment; verification is purely mathematical.

    _Surfaced assumptions:_ A-0212, A-0213, A-0214
    - **US-004.1.1.3.1** `[Tier C · pending]`
      **As a** Implementation Commitment, **I want** Validate Material Quantity against Transaction Ledger, **so that** System verifies quantity exists and is positive from ENT-TRANSACTION rows.

      **Acceptance criteria:**
        - **AC-001-3.1** — Quantity value is numeric and > 0 for every valid row.
          - _Measurable:_ transaction.quantity > 0 AND is_numeric(transaction.quantity)

      _Status: pending · Priority: high · Tier: C · Traces to: VOC-19, US-004.1.1.3 · Pass: 4_

      _Decomposition rationale:_ Before aggregation, the system must ensure the input quantity is valid to prevent downstream financial errors. This is an implementation decision (Tier C) regarding data validation logic.

      _Surfaced assumptions:_ A-0445, A-0446
    - **US-004.1.1.3.2** `[Tier C · pending]`
      **As a** Implementation Commitment, **I want** Retrieve Unit Price from Pricebook Snapshot, **so that** System pulls unit_price from ENT-PRICEBOOK at calculation time per existing assumption.

      **Acceptance criteria:**
        - **AC-001-3.2** — Price value is retrieved from the correct Pricebook record.
          - _Measurable:_ price_source == 'ENT-PRICEBOOK' AND price_version == snapshot_at_calculation_time

      _Status: pending · Priority: critical · Tier: C · Traces to: US-004.1.1.2, VOC-19, US-004.1.1.3 · Pass: 4_

      _Decomposition rationale:_ Connects directly to sibling US-004.1.1.2 which commits to Price Source Strategy. This child defines the specific retrieval logic for the Cost Aggregation task.

      _Surfaced assumptions:_ A-0445, A-0446
    - **US-004.1.1.3.3** `[Tier D · atomic]`
      **As a** Leaf Operation, **I want** Calculate Aggregated Material Cost, **so that** System outputs sum(quantity * unit_price) for active rows.

      **Acceptance criteria:**
        - **AC-001-3.3** — Aggregated value equals AC-001 mathematical invariant.
          - _Measurable:_ sum(row.quantity * row.unit_price) === material_cost_component

      _Status: atomic · Priority: critical · Tier: D · Traces to: AC-001-3, US-004.1.1.3 · Pass: 4_

      _Decomposition rationale:_ This is the atomic action of the requirement (Tier D). It performs the core mathematical operation defined in the parent's acceptance criteria AC-001-3.

      _Surfaced assumptions:_ A-0445, A-0446
    - **US-004.1.1.3.4** `[Tier C · pending]`
      **As a** Implementation Commitment, **I want** Apply Currency and Rounding Invariant, **so that** System rounds result to 2 decimal places using GL currency standard.

      **Acceptance criteria:**
        - **AC-001-3.4** — Result is rounded to 2 decimal places using defined GL currency.
          - _Measurable:_ abs(rounded_value - raw_sum) < 0.005 AND decimal_places == 2

      _Status: pending · Priority: high · Tier: C · Traces to: COMP-1, VOC-11, US-004.1.1.3 · Pass: 4_

      _Decomposition rationale:_ Financial systems require rounding to match General Ledger standards (VOC-11, COMP-1). This is a specific implementation choice regarding precision and currency handling.

      _Surfaced assumptions:_ A-0445, A-0446
##### US-004.1.2 `[Tier C · pending]`

**As a** CAM operator, **I want** Aggregate labor costs from technician assignments, **so that** Labor cost component accurately reflects sum of technician billable hours.

**Acceptance criteria:**
  - **AC-002** — Labor cost matches assignment hours.
    - _Measurable:_ sum(assigned_hours * effective_rate) === labor_cost_component

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, WF-3, VOC-19 · Pass: 2_

_Decomposition rationale:_ Defines the specific data source and calculation rule for the labor component, distinguishing it from equipment to ensure accurate profitability analysis.

_Surfaced assumptions:_ A-0070, A-0071, A-0072

  - **US-004.1.2.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Retrieve Billable Hours from Work Assignment, **so that** System reads assigned hours from ENT-WORK-ASSIGNMENT records linked to the completed job..

    **Acceptance criteria:**
      - **AC-1.1** — Hours are sourced from active work assignments.
        - _Measurable:_ Source for labor hours is ENT-WORK-ASSIGNMENT.status == 'Active' AND ENT-WORK-ASSIGNMENT.technician_id is populated

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, WF-3 · Pass: 3_

    _Decomposition rationale:_ Defines the data source for the 'assigned_hours' component of the AC. Commitment to read from the assignment entity rather than a log or estimate table.

    _Surfaced assumptions:_ A-0215
    - **US-004.1.2.1.C1** `[Tier C · pending]`
      **As a** Data Source Selector, **I want** Query ENT-WORK-ASSIGNMENT table as the exclusive source for billable hours, **so that** System does not query ENT-TASK or ENT-INVOICE for hour values during this retrieval phase.

      **Acceptance criteria:**
        - **AC-101** — System reads from ENT-WORK-ASSIGNMENT schema.
          - _Measurable:_ SQL query explicitly selects from table 'ENT-WORK-ASSIGNMENT' at commit time

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, WF-3 · Pass: 4_

      _Decomposition rationale:_ Defines the architectural commitment regarding the specific data model entity used, separating this from potential alternative data stores like Task logs or Invoices.

      _Surfaced assumptions:_ A-0447, A-0448, A-0449
    - **US-004.1.2.1.C2** `[Tier C · pending]`
      **As a** Filter Logic Enforcer, **I want** Filter records by Active status before aggregation, **so that** Draft, Cancelled, or Completed assignments are excluded from the hour sum.

      **Acceptance criteria:**
        - **AC-102** — Query filters by status equality check.
          - _Measurable:_ WHERE status = 'Active' clause is present in the generated SELECT statement

      _Status: pending · Priority: high · Tier: C · Traces to: UJ-4, WF-3 · Pass: 4_

      _Decomposition rationale:_ Breaks the 'Retrieve' action into its specific state-filtering commitment, ensuring only the correct lifecycle state contributes to the calculation.

      _Surfaced assumptions:_ A-0447, A-0448, A-0449
    - **US-004.1.2.1.C3** `[Tier C · pending]`
      **As a** Job Link Validator, **I want** Verify assignment links to a completed job in ENT-WORK-ORDER, **so that** Assignment rows without a valid completed work order ID are rejected.

      **Acceptance criteria:**
        - **AC-103** — System validates foreign key linkage to active/completed order.
          - _Measurable:_ JOIN on ENT-WORK-ORDER where ENT-WORK-ORDER.status in ('Completed', 'Closed') returns > 0 rows

      _Status: pending · Priority: high · Tier: C · Traces to: UJ-4, WF-3 · Pass: 4_

      _Decomposition rationale:_ Defines the relationship constraint that hours must belong to a closed job, preventing counting hours from open or suspended tasks.

      _Surfaced assumptions:_ A-0447, A-0448, A-0449
  - **US-004.1.2.2** `[Tier C · pending]`
    **As a** CAM operator, **I want** Retrieve Effective Rate from Skill or Contract, **so that** System resolves labor cost per hour using ENT-SKILL or ENT-CONTRACT tables..

    **Acceptance criteria:**
      - **AC-1.2** — Rate matches configured table entry for the technician.
        - _Measurable:_ effective_rate == ENT-SKILL.rate OR effective_rate == ENT-CONTRACT.rate for the assigned technician

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-3, VOC-19 · Pass: 3_

    _Decomposition rationale:_ Defines the data source for the 'effective_rate' component of the AC. Commitment to specific entity lookups.

    _Surfaced assumptions:_ A-0215
    - **US-004.1.2.2-1** `[Tier C · pending]`
      **As a** CAM operator, **I want** Resolve rate source priority between Skill and Contract tables, **so that** Returns the highest priority rate found or the active rate if both are valid.

      **Acceptance criteria:**
        - **AC-001** — If skill record exists, return skill rate.
          - _Measurable:_ if (ENT-SKILL.active) then effective_rate = ENT-SKILL.rate
        - **AC-002** — If no skill record, return contract rate.
          - _Measurable:_ if (!ENT-SKILL.active and ENT-CONTRACT.active) then effective_rate = ENT-CONTRACT.rate

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-3, VOC-19 · Pass: 4_

      _Decomposition rationale:_ Splits the retrieval logic into source selection rules. This binds the priority policy (Skill > Contract) which is an implementation choice under the parent goal.

      _Surfaced assumptions:_ A-0450, A-0451
    - **US-004.1.2.2-2** `[Tier C · pending]`
      **As a** CAM operator, **I want** Validate rate record validity and data type, **so that** Returns null/zero if rate record is inactive, expired, or invalid type.

      **Acceptance criteria:**
        - **AC-003** — Rate value must be numeric.
          - _Measurable:_ typeof effective_rate === 'number' or effective_rate === 0
        - **AC-004** — Record status must be active.
          - _Measurable:_ ENT-SKILL.status === 'active' or ENT-CONTRACT.status === 'active'

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-3, VOC-19 · Pass: 4_

      _Decomposition rationale:_ Separates data integrity validation from source selection. Ensures the system does not retrieve invalid or expired rates, preventing calculation errors in labor costing.

      _Surfaced assumptions:_ A-0450, A-0451
  - **US-004.1.2.3** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Aggregate and Validate Labor Cost, **so that** Labor cost component is calculated and persisted only if sum matches..

    **Acceptance criteria:**
      - **AC-1.3** — Labor cost matches assignment hours.
        - _Measurable:_ sum(assigned_hours * effective_rate) === labor_cost_component

    _Status: atomic · Priority: critical · Tier: D · Traces to: VOC-19, WF-3 · Pass: 3_

    _Decomposition rationale:_ Final atomic operation implementing the AC. Tests the invariant directly.

    _Surfaced assumptions:_ A-0215
##### US-004.1.3 `[Tier C · pending]`

**As a** CAM operator, **I want** Aggregate equipment costs from asset usage logs, **so that** Equipment cost component accurately reflects sum of machine rental or depreciation.

**Acceptance criteria:**
  - **AC-003** — Equipment cost matches asset log entries.
    - _Measurable:_ sum(usage_hours * hourly_depreciation_rate) === equipment_cost_component

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, WF-3, VOC-19 · Pass: 2_

_Decomposition rationale:_ Defines the specific data source and calculation rule for the equipment component to complete the tripartite cost structure required for accurate job costing.

_Surfaced assumptions:_ A-0070, A-0071, A-0072

  - **FR-004.1.3-1** `[Tier D · atomic]`
    **As a** System, **I want** Retrieve usage hours from immutable log records, **so that** Usage hours are fetched for each completed job in the aggregation window.

    **Acceptance criteria:**
      - **AC-101** — Usage log entries are fetched only for jobs with status 'Completed'.
        - _Measurable:_ count(logs.where(job_status == Completed) > 0) for every aggregation window

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-4 · Pass: 3_

    _Decomposition rationale:_ Read operation is the atomic first step of the aggregation function; tied to the completion event of the job.

    _Surfaced assumptions:_ A-0216, A-0217
  - **FR-004.1.3-2** `[Tier D · atomic]`
    **As a** System, **I want** Load current depreciation/rental rate configuration, **so that** Hourly rates are resolved from the active configuration store.

    **Acceptance criteria:**
      - **AC-102** — Rates used are the most recent active version per machine type.
        - _Measurable:_ rate_value === config.table.get_latest_active_version(machine_id)

    _Status: atomic · Priority: high · Tier: D · Traces to: VOC-19 · Pass: 3_

    _Decomposition rationale:_ Rate resolution is the second atomic step; defines the multiplier for usage hours per costing model (VOC-19).

    _Surfaced assumptions:_ A-0216, A-0217
  - **FR-004.1.3-3** `[Tier D · atomic]`
    **As a** System, **I want** Write aggregated cost to equipment component field, **so that** Equipment cost component is updated with the calculated sum.

    **Acceptance criteria:**
      - **AC-103** — The new cost component value matches the sum(usage_hours * rate).
        - _Measurable:_ new_equipment_cost_component == sum(usage_hours * rate) for the aggregation batch

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-3 · Pass: 3_

    _Decomposition rationale:_ Persistence is the final atomic step; feeds the financial component used in WF-3 invoicing.

    _Surfaced assumptions:_ A-0216, A-0217
#### US-004.2 `[Tier C · pending]`

**As a** CAM operator, **I want** Instantiate ENT-INVOICE record with job completion metadata, **so that** Invoice record exists and is linked to the completed work order.

**Acceptance criteria:**
  - **AC-004.2** — Invoice created within 1 minute of job completion.
    - _Measurable:_ invoice_created_timestamp - job_completed_timestamp <= 60 seconds

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, WF-3, ENT-INVOICE · Pass: 1_

_Decomposition rationale:_ Separates creation from posting logic to ensure strict adherence to the 1-minute SLA defined in AC-007.

_Surfaced assumptions:_ A-0012, A-0013, A-0014

##### FR-INV-001 `[Tier D · atomic]`

**As a** CAM operator, **I want** persist_invoice_entity, **so that** Invoice entity created in PostgreSQL with unique ID.

**Acceptance criteria:**
  - **AC-001** — Row inserted into ENT-INVOICE table.
    - _Measurable:_ SELECT count(*) FROM invoice WHERE invoice_id = 'new_id' = 1

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-4, ENT-INVOICE, WF-3 · Pass: 2_

_Decomposition rationale:_ Atomic persistence of the invoice record is the foundational operation required to satisfy the instantiation requirement.

_Surfaced assumptions:_ A-0073, A-0074

##### FR-INV-002 `[Tier D · atomic]`

**As a** CAM operator, **I want** link_job_metadata, **so that** Work order completion timestamp and status stored in invoice record.

**Acceptance criteria:**
  - **AC-002** — Invoice record references the correct completed work order.
    - _Measurable:_ invoice.work_order_id = source_work_order.id AND invoice.job_completed_timestamp = source_job_completion_timestamp

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-4, ENT-INVOICE, ENT-WORK-ORDER · Pass: 2_

_Decomposition rationale:_ Populating the job metadata fields is the second atomic operation required to link the invoice to the completed work order as requested.

_Surfaced assumptions:_ A-0073, A-0074

##### FR-INV-003 `[Tier C · pending]`

**As a** System Controller, **I want** enforce_latency_threshold, **so that** System monitors and ensures invoice creation happens within 60 seconds of job completion event.

**Acceptance criteria:**
  - **AC-003** — Creation latency does not exceed 1 minute.
    - _Measurable:_ (invoice.created_timestamp - job_completed_timestamp) * 1000 <= 60000

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, AC-004.2 · Pass: 2_

_Decomposition rationale:_ The 1-minute SLA is a system-wide constraint/threshold that governs the performance implementation strategy for the instantiation process.

_Surfaced assumptions:_ A-0073, A-0074

  - **FR-INV-003.1** `[Tier C · pending]`
    **As a** Data Capture, **I want** capture job_completed_timestamp at workflow event, **so that** Timestamp source is immutable and synchronized with system clock.

    **Acceptance criteria:**
      - **AC-003.1** — Job completion timestamp is recorded atomically.
        - _Measurable:_ ENT-WORK-ORDER.job_completed_timestamp is written with sub-millisecond precision at event fire

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-4 · Pass: 3_

    _Decomposition rationale:_ Source integrity is the prerequisite for valid latency verification; if the timestamp is delayed or stale, the 60s check is meaningless.

    _Surfaced assumptions:_ A-0218
    - **FR-INV-003.1.1** `[Tier D · atomic]`
      **As a** Backend Service, **I want** Persist job_completed_timestamp to database row, **so that** ENT-INVOICE.job_completed_timestamp contains the captured value.

      **Acceptance criteria:**
        - **AC-003.1.1** — Timestamp row is inserted/updated with value from system clock.
          - _Measurable:_ ENT-INVICE.job_completed_timestamp IS NOT NULL AND EQUALS current_system_time AT COMMIT

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-4 · Pass: 4_

      _Decomposition rationale:_ Atomic write operation is the leaf-level action that physically stores the data captured by the workflow event.

      _Surfaced assumptions:_ A-0452, A-0453
    - **FR-INV-003.1.2** `[Tier C · pending]`
      **As a** Backend Service, **I want** Enforce sub-millisecond precision threshold on write, **so that** Stored timestamp resolution does not exceed 1ms precision.

      **Acceptance criteria:**
        - **AC-003.1.2** — Database value resolution meets precision requirement.
          - _Measurable:_ EXTRACT(MILLISECOND FROM job_completed_timestamp) >= 0 AND <= 999 for every row

      _Status: pending · Priority: high · Tier: C · Traces to: UJ-4 · Pass: 4_

      _Decomposition rationale:_ Precision is a concrete implementation choice enforced via database column type or application logic.

      _Surfaced assumptions:_ A-0452, A-0453
    - **FR-INV-003.1.3** `[Tier B · pending]`
      **As a** System Architect, **I want** Commit to immutable timestamp source after event firing, **so that** Field becomes read-only post-workflow transition to prevent tampering.

      **Acceptance criteria:**
        - **AC-003.1.3** — Field update is rejected after workflow event completion.
          - _Measurable:_ UPDATE JOB_COMPLETED_TIMESTAMP FAILS if workflow_status != 'IN_PROGRESS'

      _Status: pending · Priority: critical · Tier: B · Traces to: UJ-4 · Pass: 4_

      _Decomposition rationale:_ Immutability is an architectural choice (Tier B) that defines the behavior of the data field regardless of specific storage implementation.

      _Surfaced assumptions:_ A-0452, A-0453
  - **FR-INV-003.2** `[Tier C · pending]`
    **As a** Latency Validator, **I want** validate creation window before commit, **so that** Invoice creation is rejected or flagged if window exceeds threshold.

    **Acceptance criteria:**
      - **AC-003.2** — Creation latency is enforced at commit time.
        - _Measurable:_ IF (invoice.created_timestamp - job_completed_timestamp) * 1000 > 60000 THEN reject_transaction() OR emit_alert()

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, AC-004.2 · Pass: 3_

    _Decomposition rationale:_ Enforcement logic is the core operational mechanism to 'ensure' the SLA; this child defines the verification boundary for the acceptance criteria.

    _Surfaced assumptions:_ A-0218
    - **FR-ACCT-2.1** `[Tier B · pending]`
      **As a** policy_engine, **I want** Enforce 60-second latency window policy constraint, **so that** System treats any window exceeding 60000ms as a violation.

      **Acceptance criteria:**
        - **AC-2.1-01** — Violation triggers enforcement logic, not bypass.
          - _Measurable:_ Condition (invoice.created_timestamp - job_completed_timestamp) > 60000 MUST trigger violation handling

      _Status: pending · Priority: critical · Tier: B · Traces to: AC-003.2, UJ-4, AC-004.2 · Pass: 4_

      _Decomposition rationale:_ Defines the specific latency threshold as a governing policy rule (Tier B) that dictates the behavior of the system rather than a specific code module or data access operation.

      _Surfaced assumptions:_ A-0454, A-0455
    - **FR-ACCT-2.2** `[Tier C · pending]`
      **As a** validation_logic, **I want** Calculate millisecond delta between job completion and invoice creation, **so that** Latency value is computed and compared against policy threshold.

      **Acceptance criteria:**
        - **AC-2.2-01** — Delta calculation completes before transaction commit.
          - _Measurable:_ Calculated delta == (invoice.created_timestamp - job_completed_timestamp) * 1000 at commit hook execution time

      _Status: pending · Priority: critical · Tier: C · Traces to: FR-INV-003.1, AC-004.2, UJ-4 · Pass: 4_

      _Decomposition rationale:_ Implements the specific logic to retrieve and compare the timestamps; relies on the sibling context FR-INV-003.1 for the job completion timestamp.

      _Surfaced assumptions:_ A-0454, A-0455
    - **FR-ACCT-2.3** `[Tier D · atomic]`
      **As a** notification_engine, **I want** Create and persist violation alert event record, **so that** System logs the alert and updates invoice status to flag the latency violation.

      **Acceptance criteria:**
        - **AC-2.3-01** — Alert record is created in compliance domain upon violation.
          - _Measurable:_ ENT-COMPLIANCE-EVENT record is created with violation_reason = 'LATENCY_THRESHOLD_EXCEEDED' and timestamp = current_time

      _Status: atomic · Priority: high · Tier: D · Traces to: UJ-4, AC-004.2 · Pass: 4_

      _Decomposition rationale:_ This is the terminal action (Tier D) required to notify stakeholders of the violation, satisfying the 'emit_alert()' branch of the parent AC.

      _Surfaced assumptions:_ A-0454, A-0455
#### US-004.3 `[Tier C · pending]`

**As a** CAM operator, **I want** Post financial entries to General Ledger, **so that** Financial obligation recorded in audit trail.

**Acceptance criteria:**
  - **AC-004.3** — Double-entry invariant holds on ledger posting.
    - _Measurable:_ sum(ledger_debits) - sum(ledger_credits) === 0 for the generated entry

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, WF-3, ENT-LEDGER · Pass: 1_

_Decomposition rationale:_ Ensures compliance with VOC-11 GL constraints by verifying the core accounting integrity before the workflow transitions to 'Closed'.

_Surfaced assumptions:_ A-0012, A-0013, A-0014

##### US-004.3.1 `[Tier C · pending]`

**As a** CAM operator, **I want** Validate debit-credit balance invariant before persistence, **so that** No entry can be persisted unless debits equal credits.

**Acceptance criteria:**
  - **AC-001** — Sum of credits equals sum of debits in the entry buffer.
    - _Measurable:_ sum(line_item.debits) === sum(line_item.credits) for the entry payload

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-LEDGER, WF-3 · Pass: 2_

_Decomposition rationale:_ This child enforces the core accounting invariant required by the parent; without this check, the system violates the GAAP commitment defined in the parent's scope.

_Surfaced assumptions:_ A-0075, A-0076, A-0077

  - **FR-ACCT-1.1-1** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Aggregate debit amounts from the entry buffer payload, **so that** A scalar value representing the total debit sum is produced.

    **Acceptance criteria:**
      - **AC-001-1** — The sum of all line_item.debits in the payload equals the scalar.
        - _Measurable:_ sum(line_items.filter(item.debit_flag === true).amount) === scalar

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-LEDGER, WF-3 · Pass: 3_

    _Decomposition rationale:_ Calculation of the debit sum is an atomic read operation prerequisite to validation.

    _Surfaced assumptions:_ A-0219
  - **FR-ACCT-1.1-2** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Aggregate credit amounts from the entry buffer payload, **so that** A scalar value representing the total credit sum is produced.

    **Acceptance criteria:**
      - **AC-001-2** — The sum of all line_item.credits in the payload equals the scalar.
        - _Measurable:_ sum(line_items.filter(item.credit_flag === true).amount) === scalar

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-LEDGER, WF-3 · Pass: 3_

    _Decomposition rationale:_ Calculation of the credit sum is an atomic read operation prerequisite to validation.

    _Surfaced assumptions:_ A-0219
  - **FR-ACCT-1.1-3** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Assert equality of debit and credit sums, **so that** Validation passes and persistence permission is granted, OR validation fails and entry is rejected.

    **Acceptance criteria:**
      - **AC-001-3** — The debit sum equals the credit sum, OR validation fails and entry is rejected.
        - _Measurable:_ scalar_debit_sum === scalar_credit_sum || (scalar_debit_sum !== scalar_credit_sum AND entry.status === 'REJECTED')

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-LEDGER, WF-3 · Pass: 3_

    _Decomposition rationale:_ The final comparison and branch decision is the atomic outcome of the validation process.

    _Surfaced assumptions:_ A-0219
##### US-004.3.2 `[Tier C · pending]`

**As a** CAM operator, **I want** Map work order line items to GL accounts, **so that** Line items from the completed job are assigned valid GL codes.

**Acceptance criteria:**
  - **AC-002** — Every line item in the invoice is linked to an active GL account.
    - _Measurable:_ gl_account_id is non-null and belongs to active_chart_of_accounts

_Status: pending · Priority: high · Tier: C · Traces to: UJ-4, VOC-11 · Pass: 2_

_Decomposition rationale:_ This defines the architectural strategy for cost-to-leader mapping; it commits to a specific data relationship between work orders and the chart of accounts.

_Surfaced assumptions:_ A-0075, A-0076, A-0077

  - **US-004.3.2.1** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Retrieve line item default mapping from configuration, **so that** Returns a GL account ID or specific fallback identifier for the work order line item.

    **Acceptance criteria:**
      - **AC-002.1** — Mapping lookup returns a valid identifier.
        - _Measurable:_ lookup_result.gl_account_id != null OR lookup_result.use_default == true

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-4, VOC-11 · Pass: 3_

    _Decomposition rationale:_ Atomic operation to fetch the configured mapping rule for a specific line item before validation.

    _Surfaced assumptions:_ A-0220, A-0221
  - **US-004.3.2.2** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Verify returned GL account status against active chart, **so that** Ensures the financial record targets a current, active account in the chart of accounts.

    **Acceptance criteria:**
      - **AC-002.2** — Target GL account is active and belongs to the current chart.
        - _Measurable:_ target_gl_account.status == 'active' AND target_gl_account.chart_id IN (SELECT id FROM active_charts)

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-4, VOC-11, US-004.3.1 · Pass: 3_

    _Decomposition rationale:_ Validates the result of the mapping lookup to prevent posting to deactivated or invalid accounts, aligning with AC-002.

    _Surfaced assumptions:_ A-0220, A-0221
  - **US-004.3.2.3** `[Tier C · pending]`
    **As a** CAM operator, **I want** Handle missing or invalid mapping exceptions, **so that** System flags the invoice or triggers a review workflow for unmapped items.

    **Acceptance criteria:**
      - **AC-002.3** — Exception state is raised for unmapped items or invalid GL lookups.
        - _Measurable:_ if (lookup_result.use_default == false AND target_gl_account.status != 'active') THEN raise_error 'INVALID_MAP'

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-4, US-004.3.3 · Pass: 3_

    _Decomposition rationale:_ Defines the policy response to the atomic checks above, ensuring data integrity is not compromised by silent failures.

    _Surfaced assumptions:_ A-0220, A-0221
    - **US-004.3.2.3.1** `[Tier C · pending]`
      **As a** Validator, **I want** Validate mapping ID existence in cache, **so that** Identify null/missing mapping configuration for the invoice line item.

      **Acceptance criteria:**
        - **AC-001** — Mapping existence check executes before status check.
          - _Measurable:_ mapping_id is read from cache at transaction start per A-0220 before any validation logic.

      _Status: pending · Priority: high · Tier: C · Traces to: US-004.3.2.1 · Pass: 4_

      _Decomposition rationale:_ Separates the existence check (configuration) from status check (database state); US-004.3.2.1 provides the retrieval logic for this data source.

      _Surfaced assumptions:_ A-0456, A-0457
    - **US-004.3.2.3.2** `[Tier C · pending]`
      **As a** Validator, **I want** Validate GL account status in chart, **so that** Identify inactive or archived account status preventing posting.

      **Acceptance criteria:**
        - **AC-002** — System detects 'inactive' or 'archived' account status.
          - _Measurable:_ target_gl_account.status in ['inactive', 'archived'] triggers exception flag.

      _Status: pending · Priority: high · Tier: C · Traces to: US-004.3.2.2 · Pass: 4_

      _Decomposition rationale:_ Separates the existence check from the status check; US-004.3.2.2 provides the status verification logic.

      _Surfaced assumptions:_ A-0456, A-0457
    - **US-004.3.2.3.3** `[Tier D · atomic]`
      **As a** State Manager, **I want** Persist exception state in transaction log, **so that** Exception flag is set and immutable before invoice commit.

      **Acceptance criteria:**
        - **AC-003** — Exception state is persisted immediately upon validation failure.
          - _Measurable:_ exception_state == 'pending_review' AND ledger_entry.immutable == true at commit time.

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-4, ENT-LEDGER · Pass: 4_

      _Decomposition rationale:_ Atomic leaf operation for state transition; ensures audit compliance per A-0076 and workflow integrity per UJ-4.

      _Surfaced assumptions:_ A-0456, A-0457
    - **US-004.3.2.3.4** `[Tier C · pending]`
      **As a** Workflow Orchestrator, **I want** Trigger manual review workflow queue, **so that** Creates review ticket or queue item for CAM operator.

      **Acceptance criteria:**
        - **AC-004** — Review workflow task created in system queue.
          - _Measurable:_ Queue item created with US-004.3.3 context and exception details within 5 mins.

      _Status: pending · Priority: high · Tier: C · Traces to: US-004.3.3 · Pass: 4_

      _Decomposition rationale:_ Implements the manual review requirement from A-0221; defines the boundary for automation vs manual intervention.

      _Surfaced assumptions:_ A-0456, A-0457
##### US-004.3.3 `[Tier D · atomic]`

**As a** System, **I want** Persist journal entry to immutable audit log, **so that** Entry is recorded in the ledger with an immutable sequence number.

**Acceptance criteria:**
  - **AC-003** — Entry exists in ledger table and cannot be deleted after commit.
    - _Measurable:_ ledger_entries table row is immutable and accessible for audit retrieval

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-LEDGER, COMP-1 · Pass: 2_

_Decomposition rationale:_ This is the terminal action that realizes the commitment to an audit trail; it tests the system's ability to finalize the transaction permanently.

_Surfaced assumptions:_ A-0075, A-0076, A-0077

#### US-004.4 `[Tier C · pending]`

**As a** CAM operator, **I want** Verify vendor compliance status (license/insurance) against current state, **so that** Invoice generation blocked or flagged if vendor is non-compliant.

**Acceptance criteria:**
  - **AC-004.4** — Invoice creation requires active vendor license.
    - _Measurable:_ vendor_license_expiry_date > current_timestamp AND vendor_insurance_status === 'active'

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, WF-5, ENT-VENDOR, ENT-VENDOR-LICENSE · Pass: 1_

_Decomposition rationale:_ Integrates WF-5 compliance monitoring into the invoicing flow to prevent invalid financial transactions from violating COMP-5.

_Surfaced assumptions:_ A-0012, A-0013, A-0014

##### US-004.4.1 `[Tier D · atomic]`

**As a** Compliance Checker, **I want** Validate Vendor License Expiry Date against server time, **so that** Returns true if expiry date is in the future, false otherwise.

**Acceptance criteria:**
  - **AC-004.4.1** — Invoice creation is denied if vendor license is expired.
    - _Measurable:_ vendor_license_expiry_date > current_timestamp_utc

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-4, WF-5, US-004.2 · Pass: 2_

_Decomposition rationale:_ Extracts the specific license expiry validation sub-step from the composite compliance check defined in the parent AC-004.4.

_Surfaced assumptions:_ A-0078, A-0079, A-0080

##### US-004.4.2 `[Tier D · atomic]`

**As a** Compliance Checker, **I want** Validate Vendor Insurance Status against policy records, **so that** Returns true if insurance status is active, false otherwise.

**Acceptance criteria:**
  - **AC-004.4.2** — Invoice creation is denied if vendor insurance is not active.
    - _Measurable:_ vendor_insurance_status === 'active' in ENT-VENDOR-INSURANCE

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-4, WF-5, US-004.2 · Pass: 2_

_Decomposition rationale:_ Extracts the specific insurance status validation sub-step from the composite compliance check defined in the parent AC-004.4.

_Surfaced assumptions:_ A-0078, A-0079, A-0080

##### US-004.4.3 `[Tier D · atomic]`

**As a** Workflow Gater, **I want** Enforce Invoice Creation Block on Combined Compliance Failure, **so that** Invoice status is set to 'blocked' if either check fails.

**Acceptance criteria:**
  - **AC-004.4.3** — System prevents invoice persistence when compliance flags are not satisfied.
    - _Measurable:_ if (!check_license && !check_insurance) then invoice.status === 'blocked'

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-4, US-004.2 · Pass: 2_

_Decomposition rationale:_ Implements the downstream consequence of the compliance checks (gating invoice creation) defined in the parent AC-004.4.

_Surfaced assumptions:_ A-0078, A-0079, A-0080

##### US-004.4.4 `[Tier D · atomic]`

**As a** Audit Log Writer, **I want** Record Compliance Event for Invoice Creation Attempt, **so that** Compliance event record created in ENT-COMPLIANCE-EVENT.

**Acceptance criteria:**
  - **AC-004.4.4** — Every invoice creation attempt writes an event log entry.
    - _Measurable:_ count(ENT-COMPLIANCE-EVENT where event_type = 'compliance_check') > 0 for every invoice_create request

_Status: atomic · Priority: medium · Tier: D · Traces to: UJ-4, WF-5, US-004.3 · Pass: 2_

_Decomposition rationale:_ Ensures the audit trail requirement is met for the compliance check operation per COMP-5 and general audit requirements.

_Surfaced assumptions:_ A-0078, A-0079, A-0080

### FR US-005 `[pending]`

**As a** Contractor, **I want** Monitor License and Compliance status, **so that** Dashboard alerts contractor if license or insurance is expiring.

**Acceptance criteria:**
  - **AC-009** — Expiry alert triggered
    - _Measurable:_ ENT-RISK-ALERT is created 30 days before expiration of ENT-VENDOR-LICENSE
  - **AC-010** — License status verified
    - _Measurable:_ UI shows Active status only if verification check ENT-VER-CHECK is valid

_Status: pending · Priority: critical · Traces to: UJ-5, WF-5, ENT-VENDOR-LICENSE, ENT-RISK-ALERT · Pass: 0_

#### US-005-C01 `[Tier C · pending]`

**As a** CAM operator, **I want** create risk alert when license expiry is within 30 days, **so that** ENT-RISK-ALERT record persists with expiry_date and alert_type.

**Acceptance criteria:**
  - **AC-009** — Alert is created 30 days before expiration.
    - _Measurable:_ SELECT COUNT(*) FROM alerts WHERE alert_type = 'ENT-RISK-ALERT' AND expiry_date - current_date <= 30 AND vendor_id IN (SELECT id FROM vendors WHERE license_expiry_date <= current_date + 30)

_Status: pending · Priority: critical · Tier: C · Traces to: WF-5 · Pass: 1_

_Decomposition rationale:_ Decomposes the 'Alert Trigger' AC into a specific database action and timing constraint within the workflow engine.

_Surfaced assumptions:_ A-0015, A-0016, A-0017

##### FR-AC-1.1 `[Tier C · pending]`

**As a** Backend Logic, **I want** Enforce 30-day expiry threshold on vendor license date, **so that** System calculates alert trigger only when expiry_date <= current_date + 30.

**Acceptance criteria:**
  - **AC-010** — Alert generation condition equals 30 days.
    - _Measurable:_ SELECT (vendor.license_expiry_date - CURRENT_DATE) WHERE <= 30

_Status: pending · Priority: high · Tier: C · Traces to: WF-5 · Pass: 2_

_Decomposition rationale:_ Threshold logic is the core implementation decision that defines the business rule of the alert trigger.

_Surfaced assumptions:_ A-0081, A-0082

  - **FR-AC-1.1-1** `[Tier C · pending]`
    **As a** CAM operator, **I want** configure threshold constant at 30 days, **so that** The alert condition is bounded by a fixed or configured duration of 30 days.

    **Acceptance criteria:**
      - **AC-101** — Threshold parameter equals 30 days.
        - _Measurable:_ threshold_days === 30

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-5 · Pass: 3_

    _Decomposition rationale:_ The specific duration value is a concrete implementation choice (constant) rather than a functional sub-area; it is testable and does not require further decomposition at this level.

    _Surfaced assumptions:_ A-0222, A-0223
    - **FR-AC-1.1-1.1** `[Tier C · pending]`
      **As a** Persistence Engineer, **I want** Persist threshold value to configuration store, **so that** System stores the 30-day threshold constant.

      **Acceptance criteria:**
        - **AC-101.1** — Stored threshold matches requirement
          - _Measurable:_ config_store['threshold_days'] === 30

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-5 · Pass: 4_

      _Decomposition rationale:_ Defines the storage commitment for the configuration parameter, ensuring data persistence for WF-5 consumption.

      _Surfaced assumptions:_ A-0458, A-0459
    - **FR-AC-1.1-1.2** `[Tier D · atomic]`
      **As a** Logic Unit, **I want** Read threshold for alert calculation, **so that** Calculation uses the persisted threshold.

      **Acceptance criteria:**
        - **AC-101.2** — Calculation fetches correct value
          - _Measurable:_ calculated_window === config_store['threshold_days']

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-5, FR-AC-1.1-2 · Pass: 4_

      _Decomposition rationale:_ Atomic read action for WF-5 logic, explicitly linking to Sibling FR-AC-1.1-2 (Time Source) for consistent window calculation.

      _Surfaced assumptions:_ A-0458, A-0459
    - **FR-AC-1.1-1.3** `[Tier C · pending]`
      **As a** Security Architect, **I want** Enforce threshold update permissions, **so that** Only authorized users can change the threshold.

      **Acceptance criteria:**
        - **AC-101.3** — Unauthorized updates are rejected
          - _Measurable:_ request.authorized === true for update requests

      _Status: pending · Priority: high · Tier: C · Traces to: WF-5, ENT-ROLE · Pass: 4_

      _Decomposition rationale:_ Implements the access control constraint for the configuration, binding to the Admin Role (ENT-ROLE) for verification.

      _Surfaced assumptions:_ A-0458, A-0459
  - **FR-AC-1.1-2** `[Tier C · pending]`
    **As a** System logic, **I want** use database server time for current_date, **so that** Expiry calculation uses the database server's system time to ensure consistency.

    **Acceptance criteria:**
      - **AC-102** — Current date source matches system time.
        - _Measurable:_ current_date_source === DB_SERVER_TIMEZONE

    _Status: pending · Priority: high · Tier: C · Traces to: WF-5 · Pass: 3_

    _Decomposition rationale:_ Determining the authoritative source for 'current_date' is a concrete implementation choice affecting the calculation outcome.

    _Surfaced assumptions:_ A-0222, A-0223
    - **FR-AC-1.1-2.1** `[Tier C · pending]`
      **As a** Infrastructure Engineer, **I want** Configure connection pool timezone for database sessions, **so that** All database queries return timestamps from the DB server's local timezone context.

      **Acceptance criteria:**
        - **AC-201** — Connection pool uses UTC session timezone.
          - _Measurable:_ SET TIMEZONE 'UTC' at connection establishment in Node.js pool config

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-5 · Pass: 4_

      _Decomposition rationale:_ Establishes the boundary for time consistency at the infrastructure layer; necessary for subsequent logic to trust DB time.

      _Surfaced assumptions:_ A-0460, A-0461
    - **FR-AC-1.1-2.2** `[Tier C · pending]`
      **As a** Backend Developer, **I want** Enforce DB-verified timestamp retrieval in expiry logic, **so that** Expiry calculations use DB function result rather than Node.js runtime date.

      **Acceptance criteria:**
        - **AC-202** — Timestamp source matches DB server time.
          - _Measurable:_ query timestamp via connection cursor instead of Date.now()

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-5 · Pass: 4_

      _Decomposition rationale:_ Ensures the application logic respects the infrastructure constraint without relying on client/system clock skew.

      _Surfaced assumptions:_ A-0460, A-0461
    - **FR-AC-1.1-2.3** `[Tier D · atomic]`
      **As a** QA Engineer, **I want** Verify persistence of UTC timestamp in compliance event records, **so that** Stored events record the DB server time, not adjusted local time.

      **Acceptance criteria:**
        - **AC-203** — Stored timestamp value matches DB session time.
          - _Measurable:_ ENT-COMPLIANCE-EVENT.timestamp_utc === query result from DB server

      _Status: atomic · Priority: medium · Tier: D · Traces to: WF-5 · Pass: 4_

      _Decomposition rationale:_ Leaf operation verifying the end-to-end outcome of the consistency requirement.

      _Surfaced assumptions:_ A-0460, A-0461
  - **FR-AC-1.1-3** `[Tier C · pending]`
    **As a** Workflow integration, **I want** invoke alert creation workflow on condition match, **so that** FR-AC-1.2 is triggered immediately or via queue when threshold is met.

    **Acceptance criteria:**
      - **AC-103** — Alert record creation is invoked.
        - _Measurable:_ status === 'CREATED' AND status !== 'DUPLICATE'

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-AC-1.2 · Pass: 3_

    _Decomposition rationale:_ The linkage to the sibling requirement FR-AC-1.2 defines the system behaviour's output path, binding the condition to the action.

    _Surfaced assumptions:_ A-0222, A-0223
    - **FR-AC-1.1-3.1** `[Tier C · pending]`
      **As a** Condition Evaluator, **I want** Evaluate condition match against current data state, **so that** Trigger signal generated if threshold met.

      **Acceptance criteria:**
        - **AC-103-1** — Condition evaluation completes within 5 seconds of cron/webhook tick
          - _Measurable:_ timestamp(trigger_start) - timestamp(condition_check) <= 5000ms

      _Status: pending · Priority: high · Tier: C · Traces to: FR-AC-1.1-3, FR-AC-1.2, FR-AC-1.1-1, FR-AC-1.1-2 · Pass: 4_

      _Decomposition rationale:_ Separates the condition evaluation logic from the invocation logic; defines latency requirements for the evaluation path relative to the threshold and time source siblings.

      _Surfaced assumptions:_ A-0462, A-0463, A-0464
    - **FR-AC-1.1-3.2** `[Tier C · pending]`
      **As a** Workflow Orchestrator, **I want** Invoke alert creation workflow via DBOS subscriber or API, **so that** Workflow FR-AC-1.2 is enqueued or executed immediately.

      **Acceptance criteria:**
        - **AC-103-2** — Invocation attempt fails gracefully if queue is full
          - _Measurable:_ queue_status === 'FULL' AND error_message === 'QUEUE_FULL'

      _Status: pending · Priority: critical · Tier: C · Traces to: FR-AC-1.1-3, FR-AC-1.2, TECH-7, FR-AC-1.1-2 · Pass: 4_

      _Decomposition rationale:_ Commits to using DBOS (TECH-7) for invocation, ensuring consistency with Tech Stack TECH-7, and handles the queue path implied by 'via queue' in the parent.

      _Surfaced assumptions:_ A-0462, A-0463, A-0464
    - **FR-AC-1.1-3.3** `[Tier C · pending]`
      **As a** State Validator, **I want** Validate alert status 'CREATED' != 'DUPLICATE' before finalizing, **so that** Alert record is persisted without creating duplicates.

      **Acceptance criteria:**
        - **AC-103-3** — Duplicate check returns true for new entries
          - _Measurable:_ SELECT COUNT(*) FROM alert_records WHERE vendor_id == v AND window == w AND status == 'CREATED' === 0

      _Status: pending · Priority: critical · Tier: C · Traces to: FR-AC-1.1-3, FR-AC-1.2, A-0082 · Pass: 4_

      _Decomposition rationale:_ Translates the 'prevent duplicate alerts' assumption (A-0082) into a concrete state validation check before persistence, ensuring compliance with existing constraints.

      _Surfaced assumptions:_ A-0462, A-0463, A-0464
    - **FR-AC-1.1-3.4** `[Tier C · pending]`
      **As a** Payload Builder, **I want** Construct alert payload with entity IDs and server timestamp, **so that** Workflow receives complete data to process FR-AC-1.2.

      **Acceptance criteria:**
        - **AC-103-4** — Payload includes vendor_id and expiry_window
          - _Measurable:_ payload.vendor_id IS NOT NULL AND payload.expiry_window IS NOT NULL

      _Status: pending · Priority: high · Tier: C · Traces to: FR-AC-1.1-3, FR-AC-1.2, FR-AC-1.1-1, A-0082 · Pass: 4_

      _Decomposition rationale:_ Defines the schema for the invocation request, ensuring downstream workflow has necessary data defined by the threshold (FR-AC-1.1-1) and time source (FR-AC-1.1-2).

      _Surfaced assumptions:_ A-0462, A-0463, A-0464
##### FR-AC-1.2 `[Tier D · atomic]`

**As a** Data Persistence, **I want** Create new ENT-RISK-ALERT record instance, **so that** ENT-RISK-ALERT row is inserted with calculated attributes.

**Acceptance criteria:**
  - **AC-011** — Alert record persists to database with unique primary key.
    - _Measurable:_ INSERT INTO ENT-RISK-ALERT (id, expiry_date, alert_type, vendor_id) succeeds and returns success code

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-5, UJ-5 · Pass: 2_

_Decomposition rationale:_ Persistence is the atomic action completing the creation workflow; it is the leaf operation for this functional requirement.

_Surfaced assumptions:_ A-0081, A-0082

#### US-005-C02 `[Tier C · pending]`

**As a** CAM operator, **I want** verify license status via verification check endpoint, **so that** UI renders 'Active' status only if ENT-VER-CHECK status is 'VALID'.

**Acceptance criteria:**
  - **AC-010** — UI shows Active status only if check is valid.
    - _Measurable:_ SELECT status FROM dashboard_state WHERE vendor_id = $1 AND license_status = 'ACTIVE' IS TRUE WHEN EXISTS (SELECT 1 FROM ver_checks WHERE vendor_id = $1 AND status = 'VALID')

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-VENDOR-LICENSE · Pass: 1_

_Decomposition rationale:_ Decomposes the 'Status Verification' AC into a data integrity constraint linking UI state to the verification entity.

_Surfaced assumptions:_ A-0015, A-0016, A-0017

##### US-005-C02.1 `[Tier C · pending]`

**As a** Backend Engineer, **I want** Implement oRPC endpoint to fetch latest ENT-VER-CHECK record, **so that** Response object includes 'status', 'expiry_date', and 'is_valid' boolean.

**Acceptance criteria:**
  - **AC-001** — Endpoint returns payload containing ENT-VER-CHECK snapshot.
    - _Measurable:_ JSON response contains 'status' and 'expiry_date' fields matching DB schema

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, ENT-VER-CHECK, WF-5 · Pass: 2_

_Decomposition rationale:_ Commits to the backend technology choice and data source entity for the status verification query.

_Surfaced assumptions:_ A-0083, A-0084, A-0085

  - **US-005-C02.1-1** `[Tier C · pending]`
    **As a** CAM operator, **I want** retrieve latest ENT-VER-CHECK record via oRPC, **so that** Returns row containing 'status', 'expiry_date', 'is_valid' fields.

    **Acceptance criteria:**
      - **AC-001-1** — Query returns the record with the maximum timestamp for status
        - _Measurable:_ SELECTed row.ordering_key = MAX(row.ordering_key) WHERE entity_id = ?

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, ENT-VER-CHECK · Pass: 3_

    _Decomposition rationale:_ Defines the core data retrieval logic required for the endpoint's primary function.

    _Surfaced assumptions:_ A-0224, A-0225
    - **US-005-C02.1-1-1** `[Tier D · atomic]`
      **As a** Engineer, **I want** Execute database query to fetch record with maximum ordering_key, **so that** Row object containing primary key, timestamp, and entity_id is obtained.

      **Acceptance criteria:**
        - **AC-001-1-A** — Query selects exactly one row based on max ordering_key.
          - _Measurable:_ SELECT * FROM ENT-VER-CHECK WHERE entity_id = ? ORDER BY ordering_key DESC LIMIT 1

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-5, ENT-VER-CHECK · Pass: 4_

      _Decomposition rationale:_ Atomic query execution step. This child isolates the storage retrieval logic from the field projection and serialization logic handled by siblings. It relies on the timestamp-based ordering rule defined in existing assumption A-0224.

      _Surfaced assumptions:_ A-0465
    - **US-005-C02.1-1-2** `[Tier D · atomic]`
      **As a** Engineer, **I want** Project specific fields into response object, **so that** Object contains status, expiry_date, and is_valid fields.

      **Acceptance criteria:**
        - **AC-001-1-B** — Returned payload includes exactly the three required fields.
          - _Measurable:_ Response JSON keys set to ['status', 'expiry_date', 'is_valid']

      _Status: atomic · Priority: high · Tier: D · Traces to: UJ-5, ENT-VER-CHECK · Pass: 4_

      _Decomposition rationale:_ Atomic field projection step. Distinct from sibling US-005-C02.1-2 (Serialization) which handles JSON encoding; this child ensures the correct data subset is prepared for the response envelope. It enforces the field set required for the compliance dashboard visibility in UJ-5.

      _Surfaced assumptions:_ A-0465
  - **US-005-C02.1-2** `[Tier C · pending]`
    **As a** CAM operator, **I want** serialize response object to JSON, **so that** JSON payload matches contract schema with mapped fields.

    **Acceptance criteria:**
      - **AC-001-2** — Response object contains valid 'status' string and 'expiry_date' string
        - _Measurable:_ response.status !== null && response.expiry_date !== null
      - **AC-001-3** — Boolean 'is_valid' correctly reflects current status state
        - _Measurable:_ response.is_valid === (entity.status === 'VALID')

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-5 · Pass: 3_

    _Decomposition rationale:_ Defines the transformation layer that converts DB schema to the API contract.

    _Surfaced assumptions:_ A-0224, A-0225
    - **US-005-C02.1-2-01** `[Tier C · pending]`
      **As a** Field Mapper, **I want** Map database entity fields to response contract keys, **so that** Response object contains 'status', 'expiry_date', 'is_valid' keys corresponding to ENT-VER-CHECK entity.

      **Acceptance criteria:**
        - **AC-001-2-MAP** — Response keys match contract schema exactly.
          - _Measurable:_ response.status exists && response.expiry_date exists && response.is_valid exists

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, US-005-C02.1-1 · Pass: 4_

      _Decomposition rationale:_ Binding the internal Entity model to the external JSON contract requires explicit field mapping logic; this child defines the mapping policy.

      _Surfaced assumptions:_ A-0466, A-0467, A-0468
    - **US-005-C02.1-2-02** `[Tier C · pending]`
      **As a** Logic Engine, **I want** Derive 'is_valid' boolean from 'status' string value, **so that** Boolean 'is_valid' is true if and only if 'status' equals 'VALID'.

      **Acceptance criteria:**
        - **AC-001-3-LOGIC** — Boolean 'is_valid' reflects entity status state accurately.
          - _Measurable:_ response.is_valid === (entity.status === 'VALID')

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5 · Pass: 4_

      _Decomposition rationale:_ The business rule for validity is a policy choice that binds the status string to the semantic boolean, distinct from implementation details like database column names.

      _Surfaced assumptions:_ A-0466, A-0467, A-0468
    - **US-005-C02.1-2-03** `[Tier C · pending]`
      **As a** Schema Validator, **I want** Enforce Zod schema validation before JSON serialization, **so that** Output payload passes JSON schema validation and serialization check.

      **Acceptance criteria:**
        - **AC-001-2-VALID** — No schema violations occur during object generation.
          - _Measurable:_ schema.validate(response) === null

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, VOC-1 · Pass: 4_

      _Decomposition rationale:_ Ensuring the output is well-formed JSON matching the contract is an implementation commitment regarding serialization technology and validation timing.

      _Surfaced assumptions:_ A-0466, A-0467, A-0468
  - **US-005-C02.1-3** `[Tier C · pending]`
    **As a** CAM operator, **I want** handle missing or expired records gracefully, **so that** Returns null or specific indicator for missing record.

    **Acceptance criteria:**
      - **AC-001-4** — Returns null structure when no active record found
        - _Measurable:_ if (record_count === 0) { return null; }

    _Status: pending · Priority: high · Tier: C · Traces to: US-005-C02.3 · Pass: 3_

    _Decomposition rationale:_ Addresses the edge case covered by sibling requirement C02.3 (UI default state).

    _Surfaced assumptions:_ A-0224, A-0225
    - **US-005-C02.1-3.1** `[Tier D · atomic]`
      **As a** CAM Operator, **I want** Return null structure when no active record found, **so that** Response object contains null data payload for missing records.

      **Acceptance criteria:**
        - **AC-001-4-1** — Response payload is null when record_count equals zero.
          - _Measurable:_ record_count === 0 implies response.data === null

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-005-C02.1-3 · Pass: 4_

      _Decomposition rationale:_ Splits the parent's 'missing' branch into a leaf operation where the system outputs null.

      _Surfaced assumptions:_ A-0469, A-0470
    - **US-005-C02.1-3.2** `[Tier D · atomic]`
      **As a** CAM Operator, **I want** Return specific indicator when record exists but is expired, **so that** Response object contains status indicator 'EXPIRED' with reason.

      **Acceptance criteria:**
        - **AC-001-4-2** — Response payload contains status indicator 'EXPIRED' when record exists and is not valid.
          - _Measurable:_ record_count > 0 && status !== 'VALID' implies response.status === 'EXPIRED'

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-005-C02.1-3 · Pass: 4_

      _Decomposition rationale:_ Splits the parent's 'expired' branch into a leaf operation where the system outputs an indicator.

      _Surfaced assumptions:_ A-0469, A-0470
    - **US-005-C02.1-3.3** `[Tier C · pending]`
      **As a** System Architect, **I want** Define response structure for graceful indicators, **so that** Response schema enforces consistent indicator fields (status, reason).

      **Acceptance criteria:**
        - **AC-001-4-3** — Response structure for expired records includes 'status' and 'reason' fields.
          - _Measurable:_ response.status === 'EXPIRED' && response.reason !== null

      _Status: pending · Priority: high · Tier: C · Traces to: US-005-C02.1-3 · Pass: 4_

      _Decomposition rationale:_ Establishes the implementation standard for the 'specific indicator' mentioned in the parent requirement.

      _Surfaced assumptions:_ A-0469, A-0470
    - **US-005-C02.1-3.4** `[Tier C · pending]`
      **As a** System Architect, **I want** Enforce response generation latency constraint, **so that** Graceful responses are generated within acceptable time limits.

      **Acceptance criteria:**
        - **AC-001-4-4** — Graceful response generation occurs within system latency bounds.
          - _Measurable:_ response_time <= 500ms

      _Status: pending · Priority: medium · Tier: C · Traces to: US-005-C02.1-3 · Pass: 4_

      _Decomposition rationale:_ Binds the technical constraint (A-0083) to the implementation commitment of this parent requirement.

      _Surfaced assumptions:_ A-0469, A-0470
##### US-005-C02.2 `[Tier C · pending]`

**As a** Frontend Engineer, **I want** Map backend status 'VALID' to UI badge 'Active', **so that** Dashboard UI displays 'Active' label with green styling.

**Acceptance criteria:**
  - **AC-002** — UI badge text matches status string 'VALID' received from backend.
    - _Measurable:_ document.querySelector('.status-badge').innerText === 'Active' when status === 'VALID'

_Status: pending · Priority: high · Tier: C · Traces to: UJ-5, UJ-10, ENT-VER-CHECK · Pass: 2_

_Decomposition rationale:_ Defines the frontend rendering logic required to visualize the backend data correctly to the operator.

_Surfaced assumptions:_ A-0083, A-0084, A-0085

  - **US-005-C02.2.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Bind status string 'VALID' to innerText property of badge component, **so that** The visual text displayed to the user is exactly 'Active' when the backend status field is 'VALID'.

    **Acceptance criteria:**
      - **AC-003** — Badge text is 'Active' when status is 'VALID'
        - _Measurable:_ component.innerText === 'Active' when status === 'VALID'

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-5, ENT-VER-CHECK · Pass: 3_

    _Decomposition rationale:_ Decomposes the text-mapping requirement into the specific data-binding mechanism (innerText binding).

    _Surfaced assumptions:_ A-0226, A-0227, A-0228
    - **US-005-C02.2.1** `[Tier D · atomic]`
      **As a** UI Binding Operation, **I want** Map backend status 'VALID' to innerText 'Active' on badge, **so that** User sees 'Active' text rendered when status field equals 'VALID'.

      **Acceptance criteria:**
        - **AC-003** — Badge text is 'Active' when status is 'VALID'
          - _Measurable:_ component.innerText === 'Active' when status === 'VALID'

      _Status: atomic · Priority: high · Tier: D · Traces to: UJ-5, ENT-VER-CHECK · Pass: 4_

      _Decomposition rationale:_ This child is the atomic leaf of the decomposition tree. It represents the concrete implementation commitment (UI text mapping) verified by the acceptance criteria. No further breakdown of 'Bind' logic is valid without creating new policy decisions.

      _Surfaced assumptions:_ A-0471
  - **US-005-C02.2.2** `[Tier C · pending]`
    **As a** CAM operator, **I want** Apply design token for active status styling to badge element, **so that** Badge renders with the designated green color palette when status is 'VALID'.

    **Acceptance criteria:**
      - **AC-004** — Badge element has class or style matching active state
        - _Measurable:_ element.style.color === designToken('success-green') && classList.contains('status-active')

    _Status: pending · Priority: medium · Tier: C · Traces to: TECH-4, COMP-1 · Pass: 3_

    _Decomposition rationale:_ Decomposes the visual presentation requirement into the CSS/Design Token commitment, ensuring styling matches domain conventions.

    _Surfaced assumptions:_ A-0226, A-0227, A-0228
    - **US-005-C02.2.2-001** `[Tier D · atomic]`
      **As a** Frontend Render Logic, **I want** Resolve design token value for active status, **so that** The color value 'success-green' is resolved for a 'VALID' status before style application.

      **Acceptance criteria:**
        - **AC-004-01** — Resolved color matches defined token.
          - _Measurable:_ designToken('success-green') returns 'success-green' when status is 'VALID'

      _Status: atomic · Priority: high · Tier: D · Traces to: US-005-C02.2.2, UJ-2 · Pass: 4_

      _Decomposition rationale:_ Splits the compound acceptance criterion (color && class) into atomic logical operations. Isolating token resolution allows independent testing of style mappings.

      _Surfaced assumptions:_ A-0472, A-0473
    - **US-005-C02.2.2-002** `[Tier D · atomic]`
      **As a** DOM State Manager, **I want** Apply status-active class to badge element, **so that** The badge DOM element has 'status-active' class injected when status is 'VALID'.

      **Acceptance criteria:**
        - **AC-004-02** — Badge class list includes 'status-active'.
          - _Measurable:_ element.classList.contains('status-active') evaluates to true for status 'VALID'

      _Status: atomic · Priority: high · Tier: D · Traces to: US-005-C02.2.2, UJ-2 · Pass: 4_

      _Decomposition rationale:_ Splits the compound acceptance criterion (color && class) into atomic logical operations. Isolating class application allows independent testing of state binding.

      _Surfaced assumptions:_ A-0472, A-0473
  - **US-005-C02.2.3** `[Tier C · pending]`
    **As a** CAM operator, **I want** Map 'Active' label to ARIA accessibility label, **so that** Screen reader announces 'Active' when badge is displayed.

    **Acceptance criteria:**
      - **AC-005** — ARIA label attribute matches text content
        - _Measurable:_ element.getAttribute('aria-label') === component.innerText

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, UJ-10, VOC-18 · Pass: 3_

    _Decomposition rationale:_ Decomposes the UI badge requirement into the accessibility commitment (ARIA mapping), required for WCAG compliance.

    _Surfaced assumptions:_ A-0226, A-0227, A-0228
    - **US-005-C02.2.3.1** `[Tier D · atomic]`
      **As a** DOM renderer, **I want** Assign 'aria-label' attribute value directly to the badge element on every render cycle, **so that** The browser's accessibility tree reflects the visual text content.

      **Acceptance criteria:**
        - **AC-001** — DOM element has valid 'aria-label' attribute with string value.
          - _Measurable:_ element.getAttribute('aria-label') !== null && element.getAttribute('aria-label').length > 0

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-5, UJ-10 · Pass: 4_

      _Decomposition rationale:_ This is the fundamental DOM manipulation action required to satisfy the mapping requirement.

      _Surfaced assumptions:_ A-0474, A-0475, A-0476
    - **US-005-C02.2.3.2** `[Tier D · atomic]`
      **As a** Content source, **I want** Retrieve 'innerText' from the badge's parent or container component, **so that** Source text is available for accessibility mapping.

      **Acceptance criteria:**
        - **AC-002** — Content extraction does not throw errors or return null.
          - _Measurable:_ component.innerText !== null && component.innerText !== undefined

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-5, UJ-10 · Pass: 4_

      _Decomposition rationale:_ Defines the data source for the label; separation ensures text extraction is decoupled from attribute assignment.

      _Surfaced assumptions:_ A-0474, A-0475, A-0476
    - **US-005-C02.2.3.3** `[Tier B · pending]`
      **As a** Accessibility policy, **I want** Ensure mapping adheres to WCAG 2.1 AA guidelines for status and role indicators, **so that** Screen readers correctly interpret the element as a status indicator.

      **Acceptance criteria:**
        - **AC-003** — Element passes WCAG automated and manual accessibility audits.
          - _Measurable:_ aria-label value is present, descriptive, and matches visual state

      _Status: pending · Priority: high · Tier: B · Traces to: VOC-18 · Pass: 4_

      _Decomposition rationale:_ Establishes the governing accessibility standard that constrains the implementation choice.

      _Surfaced assumptions:_ A-0474, A-0475, A-0476
    - **US-005-C02.2.3.4** `[Tier C · pending]`
      **As a** Architecture, **I want** Use synchronous state updates to ensure label matches text during user interaction, **so that** No latency gap exists between text change and accessibility update.

      **Acceptance criteria:**
        - **AC-004** — Label value equals text value after state transition.
          - _Measurable:_ waitForUpdate(component).then(() => element.getAttribute('aria-label') === component.innerText)

      _Status: pending · Priority: high · Tier: C · Traces to: UJ-5 · Pass: 4_

      _Decomposition rationale:_ Committed to synchronous reactivity to prevent screen reader lag during state changes.

      _Surfaced assumptions:_ A-0474, A-0475, A-0476
  - **US-005-C02.2.4** `[Tier D · atomic]`
    **As a** Leaf Operation, **I want** Render badge DOM element with reactive props, **so that** DOM element is inserted and re-rendered on status change.

    **Acceptance criteria:**
      - **AC-006** — Badge component mounts and updates reactively
        - _Measurable:_ querySelector('.status-badge').exists && component.statusProp.isReactive === true

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-5, ENT-VER-CHECK, TECH-4 · Pass: 3_

    _Decomposition rationale:_ The atomic DOM operation representing the final result of the rendering commitment; testable without further decomposition.

    _Surfaced assumptions:_ A-0226, A-0227, A-0228
##### US-005-C02.3 `[Tier D · atomic]`

**As a** System Engineer, **I want** Default UI state to 'Inactive' when ENT-VER-CHECK is missing, **so that** UI shows 'Inactive' status if query returns null or expired rows.

**Acceptance criteria:**
  - **AC-003** — UI renders 'Inactive' label when no valid check record exists.
    - _Measurable:_ document.querySelector('.status-badge').innerText === 'Inactive' when ENT-VER-CHECK is null

_Status: atomic · Priority: high · Tier: D · Traces to: US-005-C01, US-005-C04, COMP-5 · Pass: 2_

_Decomposition rationale:_ Commits to the error-handling and data-quality policy ensuring the UI never displays a false positive Active status.

_Surfaced assumptions:_ A-0083, A-0084, A-0085

#### US-005-C03 `[Tier C · pending]`

**As a** CAM operator, **I want** aggregate insurance and license data for dashboard, **so that** Contractor view queries join insurance and license tables with latest snapshots.

**Acceptance criteria:**
  - **AC-011** — Dashboard displays combined license and insurance status.
    - _Measurable:_ SELECT COUNT(*) FROM combined_compliance_view WHERE vendor_id = $1 AND status IS NOT NULL >= 1

_Status: pending · Priority: high · Tier: C · Traces to: UJ-5 · Pass: 1_

_Decomposition rationale:_ Separates the data aggregation logic required to satisfy the 'Monitor Compliance' intent, committing to the view layer implementation.

_Surfaced assumptions:_ A-0015, A-0016, A-0017

##### US-005-C03-01 `[Tier C · pending]`

**As a** Database Engineer, **I want** Define `combined_compliance_view` SQL join structure, **so that** View returns rows with non-null status for License and Insurance combined.

**Acceptance criteria:**
  - **AC-011-01** — Dashboard view query returns at least one row per vendor_id when data exists.
    - _Measurable:_ SELECT COUNT(*) FROM combined_compliance_view WHERE vendor_id = $1 AND status IS NOT NULL must return >= 1 for any vendor with active records.

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, US-005-C03 · Pass: 2_

_Decomposition rationale:_ This child commits the specific table join mechanics required to satisfy the dashboard view AC. It is an implementation detail of the architectural commitment defined in the parent.

_Surfaced assumptions:_ A-0086, A-0087, A-0088

  - **US-005-C03-01-01** `[Tier C · pending]`
    **As a** SQL Architect, **I want** Define join keys for License and Insurance tables to Vendor anchor, **so that** View schema includes vendor_id as the primary key linking all compliance sources.

    **Acceptance criteria:**
      - **AC-011-01** — Join returns rows for all vendors with active compliance records.
        - _Measurable:_ SELECT COUNT(*) FROM combined_compliance_view WHERE vendor_id = $1 AND (license_status IS NOT NULL OR insurance_status IS NOT NULL) must return >= 1

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, US-005-C03, US-005-C03-02 · Pass: 3_

    _Decomposition rationale:_ Commits to the structural definition of the view; establishes the relationship between vendor and compliance entities (ENT-VENDOR-LICENSE, ENT-VENDOR-INSURANCE) as the basis for all downstream filtering.

    _Surfaced assumptions:_ A-0229, A-0230
    - **US-005-C03-01-01-01** `[Tier C · pending]`
      **As a** CAM operator, **I want** Define `vendor_id` as a nullable foreign key column in `ENT-VENDOR-LICENSE` referencing `ENT-VENDOR.id`, **so that** License records are logically linked to vendors, allowing vendors without licenses to exist.

      **Acceptance criteria:**
        - **AC-011-01-L** — License table contains `vendor_id` column referencing Vendor ID.
          - _Measurable:_ Column `ENT-VENDOR-LICENSE.vendor_id` must be of type UUID and referenceable against `ENT-VENDOR.id` in PostgreSQL RLS config.

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, US-005-C03-01-02 · Pass: 4_

      _Decomposition rationale:_ Decomposes the 'Define join keys' goal for the License source table. Nullable FK allows for missing licenses, satisfying AC-011-01's requirement to return all vendors.

      _Surfaced assumptions:_ A-0477, A-0478
    - **US-005-C03-01-01-02** `[Tier C · pending]`
      **As a** CAM operator, **I want** Define `vendor_id` as a nullable foreign key column in `ENT-VENDOR-INSURANCE` referencing `ENT-VENDOR.id`, **so that** Insurance records are logically linked to vendors, allowing vendors without insurance to exist.

      **Acceptance criteria:**
        - **AC-011-01-I** — Insurance table contains `vendor_id` column referencing Vendor ID.
          - _Measurable:_ Column `ENT-VENDOR-INSURANCE.vendor_id` must be of type UUID and referenceable against `ENT-VENDOR.id` in PostgreSQL RLS config.

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, US-005-C03-01-03 · Pass: 4_

      _Decomposition rationale:_ Decomposes the 'Define join keys' goal for the Insurance source table. Ensures both compliance sources are anchored to the Vendor anchor.

      _Surfaced assumptions:_ A-0477, A-0478
    - **US-005-C03-01-01-03** `[Tier C · pending]`
      **As a** Database Architect, **I want** Enforce unique index on `vendor_id` in License and Insurance tables, **so that** Prevents duplicate records for a single vendor per compliance table (1-to-many is handled by status, but 1-to-1 key uniqueness for source ID).

      **Acceptance criteria:**
        - **AC-011-01-UNI** — No two rows in License table share the same `vendor_id`.
          - _Measurable:_ Index `idx_license_vendor` on `ENT-VENDOR-LICENSE.vendor_id` is unique.

      _Status: pending · Priority: high · Tier: C · Traces to: US-005-C03-01-02, US-005-C03-01-04 · Pass: 4_

      _Decomposition rationale:_ Ensures data integrity required for the View to aggregate status correctly without double-counting vendors. Links to status aggregation (02) and missing data defaults (04).

      _Surfaced assumptions:_ A-0477, A-0478
    - **US-005-C03-01-01-04** `[Tier C · pending]`
      **As a** SQL Developer, **I want** Configure View join logic to use `LEFT JOIN` on License and Insurance tables, **so that** View includes vendor rows even when compliance records are missing, supporting the AC-011-01 acceptance criteria..

      **Acceptance criteria:**
        - **AC-011-01-V** — View `combined_compliance_view` returns rows for vendors with no license/insurance records.
          - _Measurable:_ SELECT COUNT(*) FROM combined_compliance_view WHERE vendor_id = $1 AND (license_status IS NOT NULL OR insurance_status IS NOT NULL) returns >= 1 for all active vendors.

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, US-005-C03-01-03 · Pass: 4_

      _Decomposition rationale:_ Directly satisfies the primary AC-011-01 requirement. Decomposes the 'View schema' requirement into a specific SQL strategy (Left Join) to ensure vendors are included.

      _Surfaced assumptions:_ A-0477, A-0478
  - **US-005-C03-01-02** `[Tier C · pending]`
    **As a** Logic Designer, **I want** Enforce status aggregation precedence rules for combined view, **so that** View outputs a single scalar 'combined_status' string based on defined rules.

    **Acceptance criteria:**
      - **AC-011-02** — Combined status reflects the most restrictive compliance state when both records exist.
        - _Measurable:_ IF license_status = 'EXPIRED' THEN combined_status = 'EXPIRED' ELSE IF insurance_status = 'EXPIRED' THEN combined_status = 'EXPIRED' END IF

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, COMP-5 · Pass: 3_

    _Decomposition rationale:_ Concrete algorithmic decision on how to handle the non-null status requirement; binds the view logic to the 'most restrictive' state to ensure safety for UJ-5 dashboard.

    _Surfaced assumptions:_ A-0229, A-0230
    - **US-005-C03-01-02-01** `[Tier C · pending]`
      **As a** Backend Logic, **I want** Evaluate License Expiration Precedence, **so that** Set combined status to 'EXPIRED' if license_status is 'EXPIRED' on snapshot.

      **Acceptance criteria:**
        - **AC-C1-01** — Combined status is 'EXPIRED' if license expired, regardless of insurance
          - _Measurable:_ combined_status === 'EXPIRED' when ENT-VENDOR-LICENSE.status === 'EXPIRED'

      _Status: pending · Priority: high · Tier: C · Traces to: AC-011-02, US-005-C03-01-01, US-005-C03-01-03 · Pass: 4_

      _Decomposition rationale:_ Breaks the main rule into the specific conditional path where License takes precedence over Insurance per business priority.

      _Surfaced assumptions:_ A-0479
    - **US-005-C03-01-02-02** `[Tier C · pending]`
      **As a** Backend Logic, **I want** Evaluate Insurance Expiration Precedence, **so that** Set combined status to 'EXPIRED' if insurance expired but license valid.

      **Acceptance criteria:**
        - **AC-C1-02** — Combined status is 'EXPIRED' if insurance expired and license valid
          - _Measurable:_ combined_status === 'EXPIRED' when ENT-VENDOR-INSURANCE.status === 'EXPIRED' AND ENT-VENDOR-LICENSE.status !== 'EXPIRED'

      _Status: pending · Priority: high · Tier: C · Traces to: AC-011-02, US-005-C03-01-01, US-005-C03-01-03 · Pass: 4_

      _Decomposition rationale:_ Breaks the main rule into the specific conditional path where Insurance is the only failure source.

      _Surfaced assumptions:_ A-0479
    - **US-005-C03-01-02-03** `[Tier C · pending]`
      **As a** Backend Logic, **I want** Resolve Default/Active Status, **so that** Set combined status to 'ACTIVE' if no expiration found.

      **Acceptance criteria:**
        - **AC-C1-03** — Combined status is 'ACTIVE' when neither record is expired
          - _Measurable:_ combined_status === 'ACTIVE' when license_status != 'EXPIRED' AND insurance_status != 'EXPIRED'

      _Status: pending · Priority: medium · Tier: C · Traces to: AC-011-02, US-005-C03-01-03, US-005-C03-01-04 · Pass: 4_

      _Decomposition rationale:_ Completes the conditional tree by defining the 'else' branch for compliant vendors, linking to sibling 01-04 for default handling.

      _Surfaced assumptions:_ A-0479
    - **US-005-C03-01-02-04** `[Tier C · pending]`
      **As a** Presentation Layer, **I want** Normalize Output String, **so that** Ensure combined_status is uppercase enum value.

      **Acceptance criteria:**
        - **AC-C1-04** — Output string matches canonical enumeration 'ACTIVE' or 'EXPIRED'
          - _Measurable:_ combined_status IN ['ACTIVE', 'EXPIRED'] AND LENGTH(combined_status) = 7

      _Status: pending · Priority: low · Tier: C · Traces to: AC-011-02, US-005-C03-01-02-03 · Pass: 4_

      _Decomposition rationale:_ Finalizes the implementation by enforcing string formatting constraints and preventing invalid status propagation.

      _Surfaced assumptions:_ A-0479
  - **US-005-C03-01-03** `[Tier C · pending]`
    **As a** Performance Engineer, **I want** Query against snapshot tables generated by WF-5 for compliance status, **so that** View reads from materialized snapshot tables to avoid locking on live Vendor/Contractor data.

    **Acceptance criteria:**
      - **AC-011-03** — View query executes against materialized data, not live transaction logs.
        - _Measurable:_ SELECT source_table FROM information_schema.tables WHERE table_name = 'combined_compliance_view' AND source_snapped = true

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-5, US-005-C03-02, WF-5 · Pass: 3_

    _Decomposition rationale:_ Commits to the architectural constraint of using snapshots per existing assumption A-0086 and A-0088; ensures data consistency without requiring live read access to ENT-VENDOR-INSURANCE.

    _Surfaced assumptions:_ A-0229, A-0230
    - **US-005-C03-01-03-01** `[Tier C · pending]`
      **As a** DB Architect, **I want** Create physical materialized table for compliance snapshot, **so that** A dedicated storage artifact exists containing compliance state detached from live transaction logs.

      **Acceptance criteria:**
        - **AC-03-01-01** — Table `combined_compliance_snapshot` exists with compatible schema
          - _Measurable:_ Query `SELECT COUNT(*) FROM combined_compliance_snapshot` returns > 0 and column definitions match `combined_compliance_view`

      _Status: pending · Priority: high · Tier: C · Traces to: WF-5, US-005-C03-01-01 · Pass: 4_

      _Decomposition rationale:_ To support the 'View reads from materialized snapshot' requirement, the physical table definition is the immediate implementation step that enables decoupling the read path from write locking.

      _Surfaced assumptions:_ A-0480, A-0481
    - **US-005-C03-01-03-02** `[Tier C · pending]`
      **As a** Workflow Engineer, **I want** Schedule and implement snapshot refresh logic, **so that** Snapshot data is synchronized with source data without direct write access from application.

      **Acceptance criteria:**
        - **AC-03-02-01** — Snapshot refresh completes within 5 minutes of source update
          - _Measurable:_ Timestamp of latest row in `combined_compliance_snapshot` >= (Timestamp of latest insert into `combined_compliance_source` - '5 minutes')

      _Status: pending · Priority: high · Tier: C · Traces to: WF-5, A-0086, A-0015 · Pass: 4_

      _Decomposition rationale:_ The performance requirement mandates avoiding live locks, which necessitates a distinct background process or ETL job to populate the snapshot; this child defines the operational strategy for that population.

      _Surfaced assumptions:_ A-0480, A-0481
    - **US-005-C03-01-03-03** `[Tier C · pending]`
      **As a** Performance Engineer, **I want** Configure view execution plan to bypass live joins, **so that** Read queries are routed to the snapshot artifact via schema or view aliases.

      **Acceptance criteria:**
        - **AC-03-03-01** — Query optimizer selects snapshot table over live tables for `combined_compliance_view`
          - _Measurable:_ EXPLAIN ANALYZE on `combined_compliance_view` query shows scan on `combined_compliance_snapshot` and no joins to `ENT-VENDOR-LICENSE` or `ENT-VENDOR-INSURANCE` live tables

      _Status: pending · Priority: medium · Tier: C · Traces to: US-005-C03-01-02, US-005-C03-01-04, A-0088 · Pass: 4_

      _Decomposition rationale:_ The requirement explicitly states the view reads from snapshot tables; this child commits to the specific query rewrite or alias mechanism that forces the query planner to use the materialized storage.

      _Surfaced assumptions:_ A-0480, A-0481
  - **US-005-C03-01-04** `[Tier D · atomic]`
    **As a** DBA, **I want** Set default status value when compliance records are missing, **so that** Row is excluded from view or status is set to 'UNKNOWN' if no records exist for vendor.

    **Acceptance criteria:**
      - **AC-011-04** — Row is not persisted if vendor_id exists but no compliance record exists in either source table.
        - _Measurable:_ WHERE NOT (license_status IS NULL AND insurance_status IS NULL)

    _Status: atomic · Priority: medium · Tier: D · Traces to: UJ-5, US-005-C03-01 · Pass: 3_

    _Decomposition rationale:_ Atomic operation defining the final row content; defines the terminal behavior for the 'returns rows when data exists' AC.

    _Surfaced assumptions:_ A-0229, A-0230
##### US-005-C03-02 `[Tier C · pending]`

**As a** Backend Engineer, **I want** Configure snapshot freshness for dashboard data, **so that** Dashboard displays data derived from snapshots updated within a defined window.

**Acceptance criteria:**
  - **AC-011-02** — Dashboard data reflects license/insurance state changes without more than a 5-minute delay.
    - _Measurable:_ Timestamp of last row update in view + 5 minutes > Timestamp of status change event.

_Status: pending · Priority: high · Tier: C · Traces to: UJ-5, US-005-C03 · Pass: 2_

_Decomposition rationale:_ Defines the 'latest snapshots' constraint from the parent. This is an implementation commitment regarding data staleness bounds required for the dashboard.

_Surfaced assumptions:_ A-0086, A-0087, A-0088

  - **US-005-C03-02-01** `[Tier C · pending]`
    **As a** CAM operator, **I want** Schedule snapshot refresh task to run every 4 minutes, **so that** System ensures updates complete within 5-minute window by using tight intervals.

    **Acceptance criteria:**
      - **AC-011-02-01** — Refresh task executes at 4-minute intervals.
        - _Measurable:_ job_schedule.interval_minutes === 4

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5 · Pass: 3_

    _Decomposition rationale:_ Choosing 4 minutes provides safety margin to meet the 5-minute AC while allowing for queue latency.

    _Surfaced assumptions:_ A-0231, A-0232
    - **US-005-C03-02-01-1** `[Tier C · pending]`
      **As a** Scheduler, **I want** Configure job interval to 4 minutes, **so that** System scheduler property job_schedule.interval_minutes is set to 4.

      **Acceptance criteria:**
        - **AC-001** — Job schedule interval is 4 minutes.
          - _Measurable:_ job_schedule.interval_minutes === 4

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5 · Pass: 4_

      _Decomposition rationale:_ The interval is a configuration parameter required to satisfy the parent's timing constraint. This child captures the specific architectural choice of polling frequency.

      _Surfaced assumptions:_ A-0482, A-0483, A-0484
    - **US-005-C03-02-01-2** `[Tier D · atomic]`
      **As a** Refresh Worker, **I want** Execute snapshot data refresh operation, **so that** Latest snapshot data is persisted to view without violating window constraint.

      **Acceptance criteria:**
        - **AC-002** — Snapshot write completes within 5-minute window.
          - _Measurable:_ execution_timestamp - write_timestamp <= 5 minutes
        - **AC-003** — Refresh operation is atomic and idempotent.
          - _Measurable:_ write(snapshot_view, data) throws no exception if record exists

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-5 · Pass: 4_

      _Decomposition rationale:_ The execution of the refresh is the atomic operation the system performs. This is testable by verifying the snapshot view updates on every run.

      _Surfaced assumptions:_ A-0482, A-0483, A-0484
  - **US-005-C03-02-02** `[Tier D · atomic]`
    **As a** Leaf operation, **I want** Calculate view staleness on row read/write event, **so that** System flags rows older than 5 minutes as stale immediately.

    **Acceptance criteria:**
      - **AC-011-02-02** — Staleness calculation uses EventTimestamp vs ViewTimestamp.
        - _Measurable:_ ABS(ViewUpdateTimestamp - EventTimestamp) <= 5 minutes

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-5 · Pass: 3_

    _Decomposition rationale:_ Atomic verification step required to confirm the freshness AC is met at the database layer.

    _Surfaced assumptions:_ A-0231, A-0232
  - **US-005-C03-02-03** `[Tier C · pending]`
    **As a** CAM operator, **I want** Bind dashboard view to WF-5 event stream outputs, **so that** Dashboard reads only from WF-5 refresh output rather than direct DB query.

    **Acceptance criteria:**
      - **AC-011-02-03** — View refresh source traces to WF-5 completion.
        - _Measurable:_ source_workflow_id === 'WF-5'

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-5, WF-5 · Pass: 3_

    _Decomposition rationale:_ Aligns with existing assumption A-0086 that dashboard relies on WF-5 logic, preventing real-time direct reads.

    _Surfaced assumptions:_ A-0231, A-0232
    - **US-005-C03-02-03-01** `[Tier C · pending]`
      **As a** Database Engineer, **I want** Create materialized view `dash_wf5_snapshot` bound to WF-5 stream, **so that** Dashboard queries resolve exclusively to the materialized view..

      **Acceptance criteria:**
        - **AC-001** — Dashboard view exists and references WF-5 source.
          - _Measurable:_ SELECT view_name, source_system FROM views WHERE view_name = 'dash_wf5_snapshot' AND source_system = 'WF-5' LIMIT 1;

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, US-005-C03-02-01 · Pass: 4_

      _Decomposition rationale:_ Establishes the concrete database artifact that materializes the architectural commitment.

      _Surfaced assumptions:_ A-0485, A-0486
    - **US-005-C03-02-03-02** `[Tier C · pending]`
      **As a** Workflow Orchestrator, **I want** Configure stream subscription on WF-5 event stream for Dashboard consumers, **so that** WF-5 completion events trigger updates to the Dashboard view..

      **Acceptance criteria:**
        - **AC-002** — Subscription listener is active for WF-5 stream.
          - _Measurable:_ SELECT id, stream_id FROM stream_subscriptions WHERE stream_id = 'WF-5' AND consumer_type = 'dashboard' AND status = 'active';

      _Status: pending · Priority: high · Tier: C · Traces to: UJ-5, WF-5 · Pass: 4_

      _Decomposition rationale:_ Ensures the ingestion hook exists to bind the dashboard to the event stream.

      _Surfaced assumptions:_ A-0485, A-0486
    - **US-005-C03-02-03-03** `[Tier C · pending]`
      **As a** Security Engineer, **I want** Disable direct database query routes for Dashboard endpoints, **so that** Direct queries to underlying tables are denied or proxied to the view..

      **Acceptance criteria:**
        - **AC-003** — Direct table access returns 403 or 404 for Dashboard users.
          - _Measurable:_ GET /api/dash/table/ids -> HTTP 403 Forbidden; GET /api/dash/view/ids -> HTTP 200 OK;

      _Status: pending · Priority: high · Tier: C · Traces to: UJ-5 · Pass: 4_

      _Decomposition rationale:_ Enforces the security and architectural boundary that views are the only allowed access vector.

      _Surfaced assumptions:_ A-0485, A-0486
##### US-005-C03-03 `[Tier C · pending]`

**As a** Security Engineer, **I want** Enforce row-level security on `combined_compliance_view`, **so that** Only Contractor persona P-3 can query/view the combined view.

**Acceptance criteria:**
  - **AC-011-03** — Query for P-1 or P-2 returns zero rows or is rejected by RLS.
    - _Measurable:_ POST to endpoint with non-P-3 roles must receive 403 Forbidden or 0 rows.

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, US-005-C03 · Pass: 2_

_Decomposition rationale:_ Commits the access control logic for the view. This is an implementation commitment for authorization constraints.

_Surfaced assumptions:_ A-0086, A-0087, A-0088

  - **US-005-C03-03-01** `[Tier C · pending]`
    **As a** Security Architect, **I want** Commit to use native Postgres RLS for `combined_compliance_view`, **so that** RLS policy compiled and active on the database object.

    **Acceptance criteria:**
      - **AC-001** — View metadata confirms RLS is enabled.
        - _Measurable:_ SELECT row_level_security.enabled FROM pg_attribute WHERE attname = 'combined_compliance_view' returns true

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, US-005-C03 · Pass: 3_

    _Decomposition rationale:_ Postgres RLS (TECH-8) is the mandated constraint. This child commits to the database-native enforcement strategy.

    _Surfaced assumptions:_ A-0233
    - **US-005-C03-03-01-01** `[Tier C · pending]`
      **As a** Database Admin, **I want** Configure Row-Level Security flag on `combined_compliance_view`, **so that** The database engine marks the view as RLS-enabled in `pg_attribute`..

      **Acceptance criteria:**
        - **AC-001** — View metadata confirms RLS is enabled.
          - _Measurable:_ SELECT row_level_security.enabled FROM pg_attribute WHERE attname = 'combined_compliance_view' returns true

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, US-005-C03-03-02 · Pass: 4_

      _Decomposition rationale:_ This child operationalizes the parent's commitment to 'native RLS' by configuring the specific database object property required to trigger row-level filtering.

      _Surfaced assumptions:_ A-0487, A-0488, A-0489
    - **US-005-C03-03-01-02** `[Tier C · pending]`
      **As a** Security Architect, **I want** Define RLS predicate mapping for `ENT-USER` session variables, **so that** RLS policy binds session identity to row filtering logic..

      **Acceptance criteria:**
        - **AC-002** — Session variables map to correct persona predicates.
          - _Measurable:_ RLS policy SQL contains 'USERS.id = current_user_id' or equivalent binding for active session.

      _Status: pending · Priority: critical · Tier: C · Traces to: US-005-C03-03-02, TECH-11 · Pass: 4_

      _Decomposition rationale:_ The parent strategy requires a concrete predicate definition; this child commits to the specific implementation of persona mapping within the RLS policy SQL.

      _Surfaced assumptions:_ A-0487, A-0488, A-0489
    - **US-005-C03-03-01-03** `[Tier C · pending]`
      **As a** DevOps Engineer, **I want** Implement RLS compilation trigger mechanism, **so that** RLS policy re-compiles after schema changes without downtime..

      **Acceptance criteria:**
        - **AC-003** — RLS policy remains active after `CREATE VIEW` execution.
          - _Measurable:_ Policy re-compilation succeeds within 5 seconds of view creation or schema modification event.

      _Status: pending · Priority: high · Tier: C · Traces to: COMP-2, WF-5 · Pass: 4_

      _Decomposition rationale:_ Since RLS policies must be active to be enforced, this child addresses the timing and mechanics of making the commitment 'active' on the object.

      _Surfaced assumptions:_ A-0487, A-0488, A-0489
  - **US-005-C03-03-02** `[Tier C · pending]`
    **As a** Security Developer, **I want** Map `ENT-USER` persona to RLS predicate variable, **so that** Session variable correctly identifies P-3 for access.

    **Acceptance criteria:**
      - **AC-002** — Session context variable maps P-3 persona.
        - _Measurable:_ current_setting('app.user_role') = 'P-3' resolves correctly for Contractor session

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, US-005-C03 · Pass: 3_

    _Decomposition rationale:_ Defining the mapping between application persona and database column is an implementation choice required before the leaf test.

    _Surfaced assumptions:_ A-0233
    - **US-005-C03-03-02-C01** `[Tier C · pending]`
      **As a** Middleware, **I want** Inject persona string into session context at authentication boundary, **so that** Every new connection session for a Contractor user holds 'P-3' in the session variable.

      **Acceptance criteria:**
        - **AC-002a** — Middleware sets app.user_role to P-3 for Contractor login
          - _Measurable:_ INSERT INTO session_context (session_id, app_user_role) VALUES ('session_id', 'P-3') succeeds on Auth endpoint call for contractor_id

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, US-005-C03-03-01 · Pass: 4_

      _Decomposition rationale:_ This child defines the injection point and trigger for the mapping, distinguishing it from the database-side reading mechanism. It commits to the middleware responsibility.

      _Surfaced assumptions:_ A-0490, A-0491, A-0492
    - **US-005-C03-03-02-C02** `[Tier C · pending]`
      **As a** Database, **I want** Configure RLS predicate function to read session variable within view function scope, **so that** The RLS policy function reads 'app.user_role' from the active session without requiring row-level storage.

      **Acceptance criteria:**
        - **AC-002b** — RLS function query includes current_setting('app.user_role') in WHERE clause
          - _Measurable:_ EXPLAIN ANALYZE of view query shows 'current_setting' usage in filter expression

      _Status: pending · Priority: critical · Tier: C · Traces to: US-005-C03-03-01 · Pass: 4_

      _Decomposition rationale:_ This child commits to the specific database pattern for reading persona data, ensuring the RLS strategy aligns with the injected session state. It rules out row-based storage for persona lookup.

      _Surfaced assumptions:_ A-0490, A-0491, A-0492
    - **US-005-C03-03-02-C03** `[Tier D · atomic]`
      **As a** Verification, **I want** Verify session variable content for Contractor login, **so that** System state confirms 'P-3' is present in session context for Contractor persona.

      **Acceptance criteria:**
        - **AC-002c** — Query 'SELECT current_setting(\'app.user_role\')' returns P-3
          - _Measurable:_ SELECT current_setting('app.user_role') FROM pg_session WHERE current_setting('app.user_role') = 'P-3' returns count > 0 for Contractor sessions

      _Status: atomic · Priority: high · Tier: D · Traces to: UJ-5 · Pass: 4_

      _Decomposition rationale:_ This is a leaf operation (D) as it represents an atomic verification of the implementation commitment (C) defined by the other children. It tests the system's ability to maintain the state correctly.

      _Surfaced assumptions:_ A-0490, A-0491, A-0492
  - **US-005-C03-03-03** `[Tier D · atomic]`
    **As a** QA Engineer, **I want** Execute verification query as Contractor (P-3), **so that** View returns expected data rows for P-3.

    **Acceptance criteria:**
      - **AC-003** — P-3 query succeeds and returns data.
        - _Measurable:_ SELECT COUNT(*) FROM combined_compliance_view WHERE user_role = 'P-3' returns count > 0

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-5, US-005-C03 · Pass: 3_

    _Decomposition rationale:_ Atomic action to verify the allowed persona access matches the acceptance criteria.

    _Surfaced assumptions:_ A-0233
  - **US-005-C03-03-04** `[Tier D · atomic]`
    **As a** QA Engineer, **I want** Execute verification query as Owner/Landlord (P-1/P-2), **so that** Query returns 0 rows or is rejected with 403.

    **Acceptance criteria:**
      - **AC-004** — P-1/P-2 query returns empty set or error.
        - _Measurable:_ SELECT COUNT(*) FROM combined_compliance_view WHERE user_role IN ('P-1','P-2') returns 0

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-5, US-005-C03 · Pass: 3_

    _Decomposition rationale:_ Atomic action to verify the blocked personas are prevented from querying the view.

    _Surfaced assumptions:_ A-0233
#### US-005-C04 `[Tier C · pending]`

**As a** CAM operator, **I want** persist alert events in notification audit log, **so that** ENT-NOTIFY-LOG entry records alert delivery attempt per WF-6.

**Acceptance criteria:**
  - **AC-012** — Alert delivery attempts are logged immutably.
    - _Measurable:_ SELECT COUNT(*) FROM notify_log WHERE event_type = 'ALERT_SENT' AND vendor_id = $1 >= 1

_Status: pending · Priority: high · Tier: C · Traces to: ENT-RISK-ALERT, UJ-5 · Pass: 1_

_Decomposition rationale:_ Decomposes the audit obligation for the alert feature into a specific logging commitment, distinct from the alert creation itself.

_Surfaced assumptions:_ A-0015, A-0016, A-0017

##### US-005-C04.1 `[Tier C · pending]`

**As a** CAM operator, **I want** define schema for alert event log entries, **so that** Log entries capture alert_id, vendor_id, event_type, and timestamp.

**Acceptance criteria:**
  - **AC-001** — Log entry contains mandatory identifiers.
    - _Measurable:_ SELECT column_name FROM information_schema.columns WHERE table_name='notify_log' AND column_name IN ('alert_id', 'vendor_id', 'event_type', 'timestamp') returns non-null result

_Status: pending · Priority: critical · Tier: C · Traces to: US-005-C04, WF-6 · Pass: 2_

_Decomposition rationale:_ Defining the log schema ensures the system records the specific data points required to audit delivery attempts per WF-6.

_Surfaced assumptions:_ A-0089, A-0090

  - **US-005-C04.1.1** `[Tier C · pending]`
    **As a** DB Architect, **I want** Enforce UUID4 generation for alert_id column, **so that** Every log entry has a globally unique identifier.

    **Acceptance criteria:**
      - **AC-001** — Column exists and accepts UUID4 strings
        - _Measurable:_ SELECT column_data_type FROM information_schema.columns WHERE table_name='notify_log' AND column_name='alert_id' returns 'uuid'

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-6 · Pass: 3_

    _Decomposition rationale:_ System-generated unique ID is necessary to track individual alerts regardless of source. UUID4 ensures global uniqueness without relying on vendor or event state.

    _Surfaced assumptions:_ A-0234, A-0235, A-0236
    - **US-005-C04.1.1.1** `[Tier D · atomic]`
      **As a** DB Engineer, **I want** Define CHECK constraint for alert_id column in notify_log table, **so that** Database schema enforces UUID4 format for every new alert_id entry.

      **Acceptance criteria:**
        - **AC-001** — DB constraint validates UUID4 regex pattern on insert.
          - _Measurable:_ CHECK (alert_id ~ '^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$') returns true for all new rows.

      _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-8, ENT-NOTIFY-LOG · Pass: 4_

      _Decomposition rationale:_ Enforces immutability at the database constraint level per existing assumption [A-0090]; this child isolates the storage layer verification requirement.

      _Surfaced assumptions:_ A-0493
    - **US-005-C04.1.1.2** `[Tier D · atomic]`
      **As a** Backend Developer, **I want** Implement UUID4 generation logic in application service layer, **so that** Every write operation produces a valid UUID4 string before persisting.

      **Acceptance criteria:**
        - **AC-002** — Generated alert_id matches UUID4 standard.
          - _Measurable:_ generateUUIDv4() function returns string matching ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$

      _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-6, TECH-9, ENT-NOTIFY-LOG · Pass: 4_

      _Decomposition rationale:_ Handles the application-side generation strategy; ensures payload validity before DB interaction as per [A-0090] complement.

      _Surfaced assumptions:_ A-0493
    - **US-005-C04.1.1.3** `[Tier D · atomic]`
      **As a** Migration Engineer, **I want** Scan and remediate existing notify_log entries with non-UUID4 identifiers, **so that** All legacy entries either converted to valid UUID4 or flagged for removal.

      **Acceptance criteria:**
        - **AC-003** — No non-UUID4 entries exist in active logs post-migration.
          - _Measurable:_ SELECT COUNT(*) FROM notify_log WHERE alert_id !~ '^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$' returns 0

      _Status: atomic · Priority: high · Tier: D · Traces to: ENT-NOTIFY-LOG, WF-6 · Pass: 4_

      _Decomposition rationale:_ Addresses the state of existing data; ensures the parent requirement is met for all current and future rows.

      _Surfaced assumptions:_ A-0493
  - **US-005-C04.1.2** `[Tier C · pending]`
    **As a** DB Architect, **I want** Enforce foreign key constraint to ENT-VENDOR for vendor_id, **so that** Every log entry links to a valid, existing vendor record.

    **Acceptance criteria:**
      - **AC-002** — Column contains valid foreign key references
        - _Measurable:_ All non-null vendor_id values exist in ENT-VENDOR table (referential integrity check)

    _Status: pending · Priority: critical · Tier: C · Traces to: US-005-C04.3, WF-6 · Pass: 3_

    _Decomposition rationale:_ Vendor association is required to attribute alerts to the correct provider. This links to the vendor mapping workflow (US-005-C04.3) and the notification router (WF-6).

    _Surfaced assumptions:_ A-0234, A-0235, A-0236
    - **US-005-C04.1.2.1** `[Tier D · atomic]`
      **As a** Database Validator, **I want** Reject row insertion if vendor_id is not found in ENT-VENDOR table, **so that** Log entry insertion fails with database error or rollback on invalid reference.

      **Acceptance criteria:**
        - **AC-003** — Insert transaction aborts if vendor_id references non-existent record.
          - _Measurable:_ INSERT statement fails for vendor_id where NOT EXISTS (SELECT 1 FROM ENT-VENDOR v WHERE v.id = :vendor_id)

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-005-C04.1.1, WF-6 · Pass: 4_

      _Decomposition rationale:_ Lifecycle split: Insert phase validation ensures data consistency upon creation of the log record.

      _Surfaced assumptions:_ A-0494, A-0495
    - **US-005-C04.1.2.2** `[Tier D · atomic]`
      **As a** Database Validator, **I want** Reject row modification or deletion if referenced vendor_id is still active or required, **so that** Log entry update/delete fails or orphaned records are prevented.

      **Acceptance criteria:**
        - **AC-004** — Update/Delete transaction aborts if FK constraint is violated.
          - _Measurable:_ UPDATE/DELETE statement fails if referenced vendor_id exists in ENT-VENDOR table with valid state

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-005-C04.1.1, WF-6 · Pass: 4_

      _Decomposition rationale:_ Lifecycle split: Modify/Remove phase validation handles state transitions and orphan prevention.

      _Surfaced assumptions:_ A-0494, A-0495
  - **US-005-C04.1.3** `[Tier C · pending]`
    **As a** Data Modeler, **I want** Enforce enumeration set for event_type column, **so that** Every log entry contains a standard, pre-defined event classification.

    **Acceptance criteria:**
      - **AC-003** — Column values restricted to approved event_type enum set
        - _Measurable:_ event_type column contains only values from the defined ENUM('alert', 'warning', 'info', 'error') or similar controlled vocabulary

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-6 · Pass: 3_

    _Decomposition rationale:_ Standardized event types enable reliable parsing and filtering downstream. This is a scope commitment defining the allowed event universe.

    _Surfaced assumptions:_ A-0234, A-0235, A-0236
    - **US-005-C04.1.3.1** `[Tier C · pending]`
      **As a** Backend Engineer, **I want** Synchronize controlled vocabulary definitions from system configuration, **so that** The event_type set is available and consistent across the schema and runtime cache before any write occurs.

      **Acceptance criteria:**
        - **AC-003.1** — Vocabulary configuration changes are reflected in the schema immediately.
          - _Measurable:_ Vocabulary load task finishes and DB schema refresh completes within 5s of config change.

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-6 · Pass: 4_

      _Decomposition rationale:_ This child isolates the configuration maintenance task required to support dynamic vocabulary, separating state management from enforcement logic.

      _Surfaced assumptions:_ A-0496, A-0497
    - **US-005-C04.1.3.2** `[Tier C · pending]`
      **As a** Backend Engineer, **I want** Enforce ENUM constraint on INSERT/UPDATE operations, **so that** No log entry is persisted containing an event_type value outside the currently defined vocabulary set.

      **Acceptance criteria:**
        - **AC-003.2** — Write operations rejecting invalid event_type values.
          - _Measurable:_ Database transaction rolls back or returns error if event_type not in approved set.

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-6 · Pass: 4_

      _Decomposition rationale:_ This child isolates the runtime validation logic, defining the atomic verification step for the column constraint.

      _Surfaced assumptions:_ A-0496, A-0497
  - **US-005-C04.1.4** `[Tier C · pending]`
    **As a** DB Architect, **I want** Enforce UTC timestamp precision for timestamp column, **so that** Every log entry records event time in UTC with millisecond precision.

    **Acceptance criteria:**
      - **AC-004** — Column stores time in UTC with millisecond precision
        - _Measurable:_ SELECT column_data_type ... AND column_name='timestamp' returns 'timestamp(6)' or 'timestamptz' with UTC normalization logic

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-6 · Pass: 3_

    _Decomposition rationale:_ UTC standardization is required for cross-region correlation and audit trails. This is an implementation constraint on the schema's time handling.

    _Surfaced assumptions:_ A-0234, A-0235, A-0236
    - **US-005-C04.1.4.1** `[Tier C · pending]`
      **As a** DB Engineer, **I want** Configure PostgreSQL column definition for timestamp storage, **so that** Column definition explicitly uses 'timestamp(6)' or 'timestamptz' with UTC defaults.

      **Acceptance criteria:**
        - **AC-004-DB** — SELECT column_data_type for 'timestamp' returns 'timestamp(6)' or 'timestamptz'.
          - _Measurable:_ SELECT data_type FROM information_schema.columns WHERE column_name='timestamp' AND column_type IN ('timestamp(6)','timestamptz')

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-6, TECH-8 · Pass: 4_

      _Decomposition rationale:_ This child commits to the database schema enforcement layer, ensuring the engine handles offset normalization rather than storing local time.

      _Surfaced assumptions:_ A-0498, A-0499
    - **US-005-C04.1.4.2** `[Tier C · pending]`
      **As a** Backend Engineer, **I want** Implement timestamp normalization middleware at application boundary, **so that** All incoming event times are converted to UTC before persistence regardless of client timezone.

      **Acceptance criteria:**
        - **AC-004-APP** — Ingress timestamps from API requests are normalized to UTC before DB write.
          - _Measurable:_ Log row timestamp === toUTC(requested_timestamp)

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-6, TECH-6 · Pass: 4_

      _Decomposition rationale:_ This child commits to the application logic layer that validates and transforms time data before it reaches the storage engine.

      _Surfaced assumptions:_ A-0498, A-0499
    - **US-005-C04.1.4.3** `[Tier C · pending]`
      **As a** DevOps Engineer, **I want** Enforce global server timezone configuration for deployment containers, **so that** System clock on origin servers resolves to UTC, preventing drift during container startup.

      **Acceptance criteria:**
        - **AC-004-INFRA** — Container environment variable TZ is set to 'UTC' at deployment.
          - _Measurable:_ docker inspect | grep 'TZ' === 'TZ=UTC'

      _Status: pending · Priority: high · Tier: C · Traces to: WF-6, TECH-20 · Pass: 4_

      _Decomposition rationale:_ This child commits to the infrastructure deployment configuration that ensures the host system clock aligns with the database expectation.

      _Surfaced assumptions:_ A-0498, A-0499
##### US-005-C04.2 `[Tier C · pending]`

**As a** CAM operator, **I want** enforce immutability constraint on alert log, **so that** Alert log rows cannot be modified or deleted after creation.

**Acceptance criteria:**
  - **AC-002** — Update operations fail on log rows for alert events.
    - _Measurable:_ UPDATE notify_log SET status='X' WHERE event_type='ALERT_SENT' AND alert_id=$1 raises error code 'UPDATE_VIOLATION'

_Status: pending · Priority: critical · Tier: C · Traces to: US-005-C04, WF-6 · Pass: 2_

_Decomposition rationale:_ Immutability is a hard architectural constraint to support the 'audit log' purpose and prevent tampering.

_Surfaced assumptions:_ A-0089, A-0090

  - **FR-ALERT-01** `[Tier C · pending]`
    **As a** CAM operator, **I want** return custom error code on update violation, **so that** Client receives 'UPDATE_VIOLATION' instead of 500 or 503.

    **Acceptance criteria:**
      - **AC-002-1** — Update API returns specific error.
        - _Measurable:_ Response status code 400 with 'error_code' === 'UPDATE_VIOLATION' for all denied update requests.

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-6, US-005-C04.2 · Pass: 3_

    _Decomposition rationale:_ Standardizing the API response ensures frontend and downstream systems understand the violation type explicitly rather than treating it as a generic failure.

    _Surfaced assumptions:_ A-0237, A-0238, A-0239
    - **FR-ALERT-01-C01** `[Tier C · pending]`
      **As a** API Gateway Layer, **I want** Return HTTP 400 Bad Request status for all constraint violations., **so that** Client receives a 4xx status code instead of 5xx for business logic rejections..

      **Acceptance criteria:**
        - **AC-002-C01** — The HTTP response status code is 400 when an update is denied.
          - _Measurable:_ response.status_code === 400 when constraint violated

      _Status: pending · Priority: critical · Tier: C · Traces to: US-005-C04.2, WF-6 · Pass: 4_

      _Decomposition rationale:_ Separates the HTTP response strategy from the specific error content. This is the fundamental architectural choice (Status Code Mapping) under the parent error handling strategy.

      _Surfaced assumptions:_ A-0500, A-0501, A-0502
    - **FR-ALERT-01-C02** `[Tier C · pending]`
      **As a** Error Content Formatter, **I want** Populate 'error_code' payload with 'UPDATE_VIOLATION' string., **so that** Client parsing logic can identify specific violation type from payload..

      **Acceptance criteria:**
        - **AC-002-C02** — Response body contains 'error_code' property.
          - _Measurable:_ response.body.error_code === 'UPDATE_VIOLATION'

      _Status: pending · Priority: high · Tier: C · Traces to: US-005-C04.2, FR-ALERT-01 · Pass: 4_

      _Decomposition rationale:_ Defines the specific content commitment within the error strategy. Determines the semantic meaning of the custom code.

      _Surfaced assumptions:_ A-0500, A-0501, A-0502
    - **FR-ALERT-01-C03** `[Tier C · pending]`
      **As a** Security Auditor, **I want** Sanitize error payload to exclude stack traces or internal IDs., **so that** Client receives a safe error message without exposing internal system state..

      **Acceptance criteria:**
        - **AC-002-C03** — Payload does not contain stack traces or PII.
          - _Measurable:_ response.body.stack_trace is undefined and no PII present

      _Status: pending · Priority: critical · Tier: C · Traces to: TECH-2, TECH-16 · Pass: 4_

      _Decomposition rationale:_ Security constraint derived from the error response strategy. This commitment ensures the specific error behavior does not violate security requirements.

      _Surfaced assumptions:_ A-0500, A-0501, A-0502
    - **FR-ALERT-01-C04** `[Tier C · pending]`
      **As a** Audit Coordinator, **I want** Trigger audit entry creation before sending HTTP response., **so that** Violation attempt is permanently logged even if client sees error..

      **Acceptance criteria:**
        - **AC-002-C04** — ENT-AUDIT-LOG entry exists before 400 response is sent.
          - _Measurable:_ ENT-AUDIT-LOG.created_at <= HTTP response sent

      _Status: pending · Priority: high · Tier: C · Traces to: FR-ALERT-02, WF-6 · Pass: 4_

      _Decomposition rationale:_ Links the error response commitment to the audit commitment (FR-ALERT-02). Defines the sequencing constraint between erroring and logging.

      _Surfaced assumptions:_ A-0500, A-0501, A-0502
  - **FR-ALERT-02** `[Tier D · atomic]`
    **As a** CAM operator, **I want** create audit entry for violation attempt, **so that** A record is written to the audit log documenting the blocked write..

    **Acceptance criteria:**
      - **AC-002-2** — Audit entry exists for every blocked update.
        - _Measurable:_ Query on ENT-AUDIT-LOG returns a row with 'violation_type' === 'IMMUTABILITY' and matching 'log_row_id' for every denied UPDATE statement.

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-6, US-005-C04.2 · Pass: 3_

    _Decomposition rationale:_ This is the atomic leaf operation that fulfills the 'so that' clause; every violation attempt must be recorded for forensic compliance.

    _Surfaced assumptions:_ A-0237, A-0238, A-0239
  - **FR-ALERT-03** `[Tier C · pending]`
    **As a** CAM operator, **I want** enforce constraint across all log columns, **so that** Any attempt to update status, timestamp, or metadata fails..

    **Acceptance criteria:**
      - **AC-002-3** — Constraint covers all entities in the alert log table.
        - _Measurable:_ Test updates against 'status', 'timestamp', and 'metadata' columns all trigger the error code defined in FR-ALERT-01.

    _Status: pending · Priority: high · Tier: C · Traces to: US-005-C04.1, US-005-C04.2 · Pass: 3_

    _Decomposition rationale:_ Immutability is not per-field but per-entity. This child ensures the architectural decision (DB Constraint) is applied to the whole table, not just the 'alert_id' column.

    _Surfaced assumptions:_ A-0237, A-0238, A-0239
    - **FR-ALERT-03.1** `[Tier C · pending]`
      **As a** CAM operator, **I want** enforce status column immutability, **so that** Update to status column triggers rollback and custom error.

      **Acceptance criteria:**
        - **AC-003-1** — UPDATE SET status=... fails.
          - _Measurable:_ UPDATE alert_logs SET status='INACTIVE' WHERE id=1 returns code 'UPDATE_VIOLATION' defined in FR-ALERT-01

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, FR-ALERT-01 · Pass: 4_

      _Decomposition rationale:_ Decomposes the general constraint commitment into the specific status column enforcement, aligning with the error code defined in FR-ALERT-01.

      _Surfaced assumptions:_ A-0503, A-0504
    - **FR-ALERT-03.2** `[Tier C · pending]`
      **As a** CAM operator, **I want** enforce timestamp column immutability, **so that** Update to timestamp column triggers rollback and custom error.

      **Acceptance criteria:**
        - **AC-003-2** — UPDATE SET timestamp=... fails.
          - _Measurable:_ UPDATE alert_logs SET timestamp='now()' WHERE id=1 returns code 'UPDATE_VIOLATION' defined in FR-ALERT-01

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, FR-ALERT-01 · Pass: 4_

      _Decomposition rationale:_ Ensures audit trail integrity by preventing timestamp manipulation, consistent with the audit commitment in FR-ALERT-02.

      _Surfaced assumptions:_ A-0503, A-0504
    - **FR-ALERT-03.3** `[Tier C · pending]`
      **As a** CAM operator, **I want** enforce metadata column immutability, **so that** Update to metadata column triggers rollback and custom error.

      **Acceptance criteria:**
        - **AC-003-3** — UPDATE SET metadata=... fails.
          - _Measurable:_ UPDATE alert_logs SET metadata='{}' WHERE id=1 returns code 'UPDATE_VIOLATION' defined in FR-ALERT-01

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-5, FR-ALERT-01 · Pass: 4_

      _Decomposition rationale:_ Protects against metadata tampering which could compromise alert correlation, using the same enforcement pattern as other columns.

      _Surfaced assumptions:_ A-0503, A-0504
##### US-005-C04.3 `[Tier C · pending]`

**As a** CAM operator, **I want** map WF-6 workflow events to log creation, **so that** One log entry created per notification attempt event in WF-6.

**Acceptance criteria:**
  - **AC-003** — WF-6 event count matches log count for alert delivery.
    - _Measurable:_ COUNT(WF-6_workflow_steps) == COUNT(notify_log_rows WHERE event_type='ALERT_DELIVERY') for same vendor_id and time window

_Status: pending · Priority: high · Tier: C · Traces to: US-005-C04, WF-6 · Pass: 2_

_Decomposition rationale:_ Establishes the trigger mechanism linking the workflow engine (WF-6) to the audit persistence layer.

_Surfaced assumptions:_ A-0089, A-0090

  - **FR-ACCT-1.1** `[Tier C · pending]`
    **As a** Event Selector, **I want** Filter WF-6 workflow steps for specific event_type values, **so that** Only specific workflow steps (e.g., ALERT_DELIVERY) trigger log creation.

    **Acceptance criteria:**
      - **AC-001** — Log creation only triggers on valid alert delivery steps.
        - _Measurable:_ WF-6 step event_type must be 'ALERT_DELIVERY' to initiate log row insert

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-6 · Pass: 3_

    _Decomposition rationale:_ Decouples trigger logic from general workflow steps to ensure AC-003 count match.

    _Surfaced assumptions:_ A-0240, A-0241, A-0242
    - **FR-ACCT-1.1.1** `[Tier C · pending]`
      **As a** Engineer, **I want** Validate event_type field value matches 'ALERT_DELIVERY', **so that** Log creation is permitted only when event_type equals 'ALERT_DELIVERY'.

      **Acceptance criteria:**
        - **AC-101** — Event Type validation rejects log creation for non-matching values
          - _Measurable:_ IF (step.event_type != 'ALERT_DELIVERY') THEN NOT INSERT INTO audit_log

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-6 · Pass: 4_

      _Decomposition rationale:_ Splits the parent's filter logic into the specific condition check implementation.

      _Surfaced assumptions:_ A-0505, A-0506
    - **FR-ACCT-1.1.2** `[Tier C · pending]`
      **As a** Engineer, **I want** Insert audit log row upon validation success, **so that** Audit log row persists with correct event metadata.

      **Acceptance criteria:**
        - **AC-102** — Audit log row persists with correct event metadata
          - _Measurable:_ SELECT COUNT(*) FROM audit_log WHERE event_id IS NOT NULL AND workflow_step_id IN (WF-6 steps filtered)

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-6, FR-ACCT-1.2, FR-ACCT-1.3 · Pass: 4_

      _Decomposition rationale:_ Defines the atomic action of persisting the log row, linking to payload construction and transaction siblings.

      _Surfaced assumptions:_ A-0505, A-0506
  - **FR-ACCT-1.2** `[Tier C · pending]`
    **As a** Payload Composer, **I want** Construct log row payload from event context, **so that** Log row contains event_id, vendor_id, and timestamp.

    **Acceptance criteria:**
      - **AC-002** — Log row contains required fields from source event.
        - _Measurable:_ ENT-NOTIFY-LOG rows must have vendor_id, event_id, and timestamp columns populated

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-NOTIFY-LOG, US-005-C04.1 · Pass: 3_

    _Decomposition rationale:_ Defines the content commitment distinct from the trigger logic.

    _Surfaced assumptions:_ A-0240, A-0241, A-0242
    - **FR-ACCT-1.2.1** `[Tier D · atomic]`
      **As a** Data Mapper, **I want** Map event_id field from source context to log row, **so that** Log row event_id column is populated with value from source event context.

      **Acceptance criteria:**
        - **AC-002-1** — Log row event_id matches source event_id
          - _Measurable:_ log_row.event_id IS NOT NULL AND log_row.event_id == source_event_id

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-6, ENT-NOTIFY-LOG · Pass: 4_

      _Decomposition rationale:_ Defines the specific data integrity commitment for the event identifier field, which is the primary reference key for log correlation.

      _Surfaced assumptions:_ A-0507, A-0508
    - **FR-ACCT-1.2.2** `[Tier D · atomic]`
      **As a** Data Mapper, **I want** Map vendor_id field from source context to log row, **so that** Log row vendor_id column is populated with value from source event context.

      **Acceptance criteria:**
        - **AC-002-2** — Log row vendor_id matches source vendor_id
          - _Measurable:_ log_row.vendor_id IS NOT NULL AND log_row.vendor_id == source_vendor_id

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-6, ENT-NOTIFY-LOG · Pass: 4_

      _Decomposition rationale:_ Defines the specific data integrity commitment for the vendor identifier field, ensuring linkability to the ENT-VENDOR entity.

      _Surfaced assumptions:_ A-0507, A-0508
    - **FR-ACCT-1.2.3** `[Tier D · atomic]`
      **As a** Data Mapper, **I want** Map timestamp field from source context to log row, **so that** Log row timestamp column is populated with value from source event context.

      **Acceptance criteria:**
        - **AC-002-3** — Log row timestamp matches source timestamp
          - _Measurable:_ log_row.timestamp IS NOT NULL AND log_row.timestamp == normalize_utc(source_timestamp)

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-6, ENT-NOTIFY-LOG · Pass: 4_

      _Decomposition rationale:_ Defines the specific data integrity commitment for the timestamp field, ensuring chronological consistency across the system.

      _Surfaced assumptions:_ A-0507, A-0508
  - **FR-ACCT-1.3** `[Tier C · pending]`
    **As a** Persistence Manager, **I want** Write log row within same workflow transaction, **so that** No orphaned log rows or workflow steps exist.

    **Acceptance criteria:**
      - **AC-003** — Log row persists only if WF-6 step completes.
        - _Measurable:_ If WF-6 step transaction rolls back, ENT-NOTIFY-LOG insert must not persist

    _Status: pending · Priority: high · Tier: C · Traces to: US-005-C04.2, ENT-NOTIFY-LOG · Pass: 3_

    _Decomposition rationale:_ Ensures atomicity between step completion and log creation.

    _Surfaced assumptions:_ A-0240, A-0241, A-0242
    - **FR-ACCT-1.3.1** `[Tier C · pending]`
      **As a** CAM operator, **I want** Bind log write operation to WF-6 workflow transaction ID, **so that** Log row is associated with the same transaction context as the workflow step.

      **Acceptance criteria:**
        - **AC-003.1** — Log row transaction ID matches WF-6 step transaction ID.
          - _Measurable:_ log.row.transaction_id === wf6.step.transaction_id for every persisted row

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-6 · Pass: 4_

      _Decomposition rationale:_ This child establishes the specific architectural constraint required to satisfy the parent AC-003. It defines the binding mechanism between the persistence and the workflow engine.

      _Surfaced assumptions:_ A-0509
    - **FR-ACCT-1.3.2** `[Tier D · atomic]`
      **As a** Leaf operation, **I want** Persist log row data to database, **so that** Log row entity is written to ENT-NOTIFY-LOG table.

      **Acceptance criteria:**
        - **AC-003.2** — Row exists in ENT-NOTIFY-LOG with valid payload.
          - _Measurable:_ SELECT COUNT(*) FROM ENT-NOTIFY-LOG WHERE transaction_id = $current_wf_id AND payload IS NOT NULL

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-ACCT-1.2, WF-6 · Pass: 4_

      _Decomposition rationale:_ This is the atomic write action. It depends on the payload construction from sibling FR-ACCT-1.2 and must occur within the transaction scope defined in child 1.

      _Surfaced assumptions:_ A-0509
    - **FR-ACCT-1.3.3** `[Tier D · atomic]`
      **As a** Leaf operation, **I want** Abort transaction or rollback log write on WF-6 failure, **so that** No log row persists if WF-6 step transaction rolls back.

      **Acceptance criteria:**
        - **AC-003.3** — No log rows exist if WF-6 transaction failed.
          - _Measurable:_ SELECT COUNT(*) FROM ENT-NOTIFY-LOG WHERE transaction_id = $failed_wf_id === 0

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-6, FR-ACCT-1.3.2 · Pass: 4_

      _Decomposition rationale:_ This child defines the atomic cleanup behavior. It ensures the 'no orphaned log rows' requirement by enforcing that any failure in the workflow invalidates the write operation.

      _Surfaced assumptions:_ A-0509
  - **FR-ACCT-1.4** `[Tier C · pending]`
    **As a** Auditor, **I want** Verify log entry counts against workflow logs, **so that** System verifies invariant before marking job complete.

    **Acceptance criteria:**
      - **AC-004** — System rejects job completion if log count mismatch.
        - _Measurable:_ COUNT(WF-6 steps) - COUNT(ENT-NOTIFY-LOG rows) must be 0 for vendor_id

    _Status: pending · Priority: medium · Tier: C · Traces to: WF-6, US-005-C04.2 · Pass: 3_

    _Decomposition rationale:_ Implements the AC-003 verification condition as an operational check.

    _Surfaced assumptions:_ A-0240, A-0241, A-0242
    - **FR-ACCT-1.4.1** `[Tier D · atomic]`
      **As a** Operation, **I want** Execute COUNT query on completed WF-6 workflow steps, **so that** Integer value representing total workflow steps for the vendor.

      **Acceptance criteria:**
        - **AC-004.1** — Count query returns non-null integer.
          - _Measurable:_ SELECT COUNT(*) FROM wf_steps WHERE vendor_id = :id AND status = 'COMPLETED' returns >= 0

      _Status: atomic · Priority: high · Tier: D · Traces to: WF-6 · Pass: 4_

      _Decomposition rationale:_ Atomic read operation required to establish the expected log count baseline.

      _Surfaced assumptions:_ A-0510, A-0511
    - **FR-ACCT-1.4.2** `[Tier D · atomic]`
      **As a** Operation, **I want** Execute COUNT query on ENT-NOTIFY-LOG rows, **so that** Integer value representing total notification log entries.

      **Acceptance criteria:**
        - **AC-004.2** — Count query returns non-null integer.
          - _Measurable:_ SELECT COUNT(*) FROM notify_logs WHERE vendor_id = :id returns >= 0

      _Status: atomic · Priority: high · Tier: D · Traces to: FR-ACCT-1.3 · Pass: 4_

      _Decomposition rationale:_ Atomic read operation against the entity constructed and written by sibling FR-ACCT-1.3.

      _Surfaced assumptions:_ A-0510, A-0511
    - **FR-ACCT-1.4.3** `[Tier C · pending]`
      **As a** Logic, **I want** Assert zero difference between workflow count and log count, **so that** Boolean result indicating invariant match or mismatch.

      **Acceptance criteria:**
        - **AC-004.3** — Comparison returns true only if counts are equal.
          - _Measurable:_ count_wf_steps - count_notify_logs === 0 evaluates to true for pass, false for fail

      _Status: pending · Priority: critical · Tier: C · Traces to: FR-ACCT-1.2 · Pass: 4_

      _Decomposition rationale:_ Implementation decision to compare the two atomic counts. Sibling FR-ACCT-1.2 constructs the log payload used in this count.

      _Surfaced assumptions:_ A-0510, A-0511
    - **FR-ACCT-1.4.4** `[Tier D · atomic]`
      **As a** Action, **I want** Reject job completion state transition, **so that** Job state set to 'FAILED' and workflow paused.

      **Acceptance criteria:**
        - **AC-004.4** — Job completion fails if invariant check is false.
          - _Measurable:_ SET job_status = 'FAILED' occurs if assertion fails

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-005-C04.2 · Pass: 4_

      _Decomposition rationale:_ Atomic enforcement action resulting from the invariant check failure per parent AC-004.

      _Surfaced assumptions:_ A-0510, A-0511
### FR US-010 `[pending]`

**As a** Investor, **I want** Review Portfolio Performance Report, **so that** Report generated showing risks and unit performance.

**Acceptance criteria:**
  - **AC-019** — Report generated
    - _Measurable:_ ENT-REPORT-SNAP created and downloadable PDF/CSV within 10 seconds
  - **AC-020** — Data accurate
    - _Measurable:_ Report includes > 95% accuracy against source ENT-TRANSACTION data

_Status: pending · Priority: medium · Traces to: UJ-10, WF-12, ENT-REPORT-TPL, ENT-KPI-METRIC · Pass: 0_

#### US-010-C1 `[Tier C · pending]`

**As a** Report Engine, **I want** Execute WF-12 Portfolio Analytics Engine, **so that** KPI metrics calculated for portfolio.

**Acceptance criteria:**
  - **AC-101** — Analytics workflow completes without error
    - _Measurable:_ wf_execution.status === 'completed'

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-10, WF-12 · Pass: 1_

_Decomposition rationale:_ This child enforces the execution of the specific workflow engine (WF-12) trace, committing the system to use the analytics logic rather than ad-hoc aggregation.

_Surfaced assumptions:_ A-0028, A-0029, A-0030, A-0031

##### US-010-C1.1 `[Tier C · pending]`

**As a** Orchestrator, **I want** Invoke DBOS workflow task for WF-12, **so that** DBOS task instance created and returned ID.

**Acceptance criteria:**
  - **AC-001** — Task instance exists in DBOS queue immediately after trigger.
    - _Measurable:_ SELECT task_id FROM dbos_tasks WHERE wf_id = 'WF-12' ORDER BY created_at DESC LIMIT 1

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-10, WF-12 · Pass: 2_

_Decomposition rationale:_ The execution commitment must start with a concrete technical invocation to the workflow engine (DBOS), distinct from the output artifacts handled by sibling C2/C3/C4.

_Surfaced assumptions:_ A-0109, A-0110, A-0111, A-0112

  - **US-010-C1.1.1** `[Tier D · atomic]`
    **As a** AuthZ Check, **I want** Verify Orchestrator persona has permission to trigger workflow WF-12, **so that** Policy engine confirms action is permitted.

    **Acceptance criteria:**
      - **AC-1.1.1** — Policy engine returns 'allow' for the request.
        - _Measurable:_ Cerbos policy check returns 'true' for user persona 'Orchestrator' with action 'invoke_workflow' and resource 'WF-12'

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10, WF-12 · Pass: 3_

    _Decomposition rationale:_ Authorization is a prerequisite step for invocation; failing here blocks the workflow start immediately.

    _Surfaced assumptions:_ A-0254, A-0255, A-0256
  - **US-010-C1.1.2** `[Tier D · atomic]`
    **As a** Payload Prep, **I want** Construct and validate the workflow payload for WF-12, **so that** Validated payload ready for submission.

    **Acceptance criteria:**
      - **AC-1.1.2** — Payload schema validation passes.
        - _Measurable:_ Payload object conforms to WF-12 event schema and includes required source data fields

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-10, WF-12 · Pass: 3_

    _Decomposition rationale:_ Data integrity and schema compliance for WF-12 inputs is a prerequisite before submission.

    _Surfaced assumptions:_ A-0254, A-0255, A-0256
  - **US-010-C1.1.3** `[Tier D · atomic]`
    **As a** Trigger Execution, **I want** Submit request to DBOS workflow engine, **so that** Task instance created in DBOS queue.

    **Acceptance criteria:**
      - **AC-1.1.3** — DBOS SDK returns success response with task ID.
        - _Measurable:_ Response object from DBOS SDK contains non-null 'task_id' and 'status' === 'accepted'

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10, WF-12 · Pass: 3_

    _Decomposition rationale:_ This is the core system action that transitions the requirement state from 'Ready' to 'Running'.

    _Surfaced assumptions:_ A-0254, A-0255, A-0256
  - **US-010-C1.1.4** `[Tier D · atomic]`
    **As a** Response Capture, **I want** Log the returned task ID for audit trail, **so that** Task ID stored in execution_logs.

    **Acceptance criteria:**
      - **AC-1.1.4** — Task ID recorded in system logs.
        - _Measurable:_ execution_logs table contains a new row with the task_id and timestamp of this trigger event

    _Status: atomic · Priority: high · Tier: D · Traces to: UJ-10, WF-12 · Pass: 3_

    _Decomposition rationale:_ Ensures traceability of the invocation event for the lifecycle covered by sibling US-010-C1.3.

    _Surfaced assumptions:_ A-0254, A-0255, A-0256
##### US-010-C1.2 `[Tier C · pending]`

**As a** Orchestrator, **I want** Monitor workflow status until terminal state, **so that** System reaches state 'completed' or 'failed' within A-0031 timeout window.

**Acceptance criteria:**
  - **AC-002** — Status is not 'pending' for more than 10 seconds.
    - _Measurable:_ SELECT status FROM execution_logs WHERE wf_instance_id = X AND timestamp > NOW() - INTERVAL '10 seconds' LIMIT 1 = 'failed'

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-10, WF-12, US-010-C2 · Pass: 2_

_Decomposition rationale:_ Monitoring ensures the 'completed' AC-101 condition is met; tracing to C2 implies consistency with the snapshot persistence expected downstream.

_Surfaced assumptions:_ A-0109, A-0110, A-0111, A-0112

  - **US-010-C1.2-1** `[Tier C · pending]`
    **As a** Monitor Operator, **I want** Execute periodic status checks on the workflow instance, **so that** System polls the workflow state at intervals ensuring the 10-second pending window is respected.

    **Acceptance criteria:**
      - **AC-002.1** — Status checks occur frequently enough to detect terminal state within 10 seconds.
        - _Measurable:_ polling_interval_seconds <= 5 for every execution_cycle

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-12, UJ-10 · Pass: 3_

    _Decomposition rationale:_ This child defines the polling frequency required to satisfy the parent's acceptance criterion regarding the 10-second pending limit. It binds the system to a specific cadence to avoid false timeouts.

    _Surfaced assumptions:_ A-0257, A-0258
    - **US-010-C1.2-1.1** `[Tier C · pending]`
      **As a** CAM operator, **I want** Calculate next polling timestamp based on interval limit, **so that** System knows when to trigger the next status check.

      **Acceptance criteria:**
        - **AC-002.1.1** — Next check time minus current time does not exceed 5 seconds.
          - _Measurable:_ next_poll_time - current_time <= 5 seconds for every execution_cycle

      _Status: pending · Priority: high · Tier: C · Traces to: WF-12 · Pass: 4_

      _Decomposition rationale:_ Defines the implementation strategy for maintaining the polling interval constraint specified in the parent's AC.

      _Surfaced assumptions:_ A-0524, A-0525
    - **US-010-C1.2-1.2** `[Tier C · pending]`
      **As a** CAM operator, **I want** Retrieve current workflow state from execution source, **so that** Latest workflow status is available for comparison.

      **Acceptance criteria:**
        - **AC-002.1.2** — Workflow status string is returned without error.
          - _Measurable:_ workflow.status is not null after query execution

      _Status: pending · Priority: high · Tier: C · Traces to: UJ-10 · Pass: 4_

      _Decomposition rationale:_ Implements the data retrieval step required to verify workflow state within the polling cycle.

      _Surfaced assumptions:_ A-0524, A-0525
    - **US-010-C1.2-1.3** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Compare fetched state against terminal state list, **so that** System identifies if workflow has reached terminal state.

      **Acceptance criteria:**
        - **AC-002.1.3** — System flags terminal status if state exists in terminal list.
          - _Measurable:_ status_in_terminal_list == true when workflow.status in terminal_set

      _Status: atomic · Priority: high · Tier: D · Traces to: US-010-C1.2-2 · Pass: 4_

      _Decomposition rationale:_ Refers to sibling commitment US-010-C1.2-2 which defines the terminal state validation logic; this child binds the data to the terminal state definition.

      _Surfaced assumptions:_ A-0524, A-0525
    - **US-010-C1.2-1.4** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Append polling event record to audit log, **so that** Polling activity is recorded for observability.

      **Acceptance criteria:**
        - **AC-002.1.4** — Polling event ID exists in audit log within 1 second.
          - _Measurable:_ audit_log_count > 0 for every polling event within 1 second

      _Status: atomic · Priority: medium · Tier: D · Traces to: US-010-C1.2-3 · Pass: 4_

      _Decomposition rationale:_ Links to sibling failure handling context; audit logging ensures the system can be debugged if the polling window is violated.

      _Surfaced assumptions:_ A-0524, A-0525
  - **US-010-C1.2-2** `[Tier C · pending]`
    **As a** Monitor Operator, **I want** Validate workflow state against terminal state list, **so that** System confirms workflow has reached a non-pending state (completed/failed).

    **Acceptance criteria:**
      - **AC-002.2** — Status string matches one of the allowed terminal states exactly.
        - _Measurable:_ wf_status_value IN ('completed', 'failed', 'cancelled')

    _Status: pending · Priority: critical · Tier: C · Traces to: US-010-C2, WF-12 · Pass: 3_

    _Decomposition rationale:_ This child rules out intermediate states and ensures the system recognizes the specific strings defined in the acceptance criteria. It forces downstream logic to treat anything else as a pending state.

    _Surfaced assumptions:_ A-0257, A-0258
    - **US-010-C1.2-2.1** `[Tier C · pending]`
      **As a** Status Acquirer, **I want** Query execution_logs for latest wf_status_value, **so that** Latest status string retrieved for comparison.

      **Acceptance criteria:**
        - **AC-002.2.1** — Latest workflow status retrieved from persistence layer
          - _Measurable:_ SELECT wf_status_value FROM execution_logs WHERE wf_id = ? ORDER BY timestamp DESC LIMIT 1 returns exactly one row

      _Status: pending · Priority: high · Tier: C · Traces to: US-010-C2, WF-12 · Pass: 4_

      _Decomposition rationale:_ Data retrieval is a necessary sub-step to enable validation before the logic can be applied.

      _Surfaced assumptions:_ A-0526
    - **US-010-C1.2-2.2** `[Tier C · pending]`
      **As a** State Matcher, **I want** Compare retrieved status to terminal whitelist, **so that** Boolean result of terminal state check.

      **Acceptance criteria:**
        - **AC-002.2.2** — Status value matches an allowed terminal state exactly
          - _Measurable:_ wf_status_value IN ('completed', 'failed', 'cancelled') evaluates to true

      _Status: pending · Priority: critical · Tier: C · Traces to: US-010-C2, WF-12 · Pass: 4_

      _Decomposition rationale:_ This enforces the core acceptance criteria AC-002.2 of the parent requirement.

      _Surfaced assumptions:_ A-0526
    - **US-010-C1.2-2.3** `[Tier C · pending]`
      **As a** Result Logger, **I want** Record validation outcome to audit log, **so that** Validation event persists in audit trail.

      **Acceptance criteria:**
        - **AC-002.2.3** — Validation outcome inserted into audit log
          - _Measurable:_ INSERT INTO audit_log (workflow_id, status_validation_result) VALUES (?, ?) succeeds

      _Status: pending · Priority: high · Tier: C · Traces to: US-010-C2, WF-12 · Pass: 4_

      _Decomposition rationale:_ Auditability and observability are required for monitoring systems to track state determinations.

      _Surfaced assumptions:_ A-0526
  - **US-010-C1.2-3** `[Tier C · pending]`
    **As a** Monitor Operator, **I want** Trigger failure flag upon timeout expiration, **so that** Workflow state is forcibly updated to 'failed' if pending time exceeds window.

    **Acceptance criteria:**
      - **AC-002.3** — If polling misses a state update, workflow is marked failed immediately.
        - _Measurable:_ elapsed_since_last_update >= 10 AND last_status = 'pending' THEN status = 'failed'

    _Status: pending · Priority: critical · Tier: C · Traces to: US-010-C1.1, UJ-10 · Pass: 3_

    _Decomposition rationale:_ This child handles the consequence of missing the timeout window. It connects to the sibling responsible for invoking the task and ensures the system fails gracefully rather than hanging indefinitely.

    _Surfaced assumptions:_ A-0257, A-0258
    - **FR-ACCT-1.2-3-1** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Compute elapsed time since last non-pending status update, **so that** Numeric delta value available for threshold comparison.

      **Acceptance criteria:**
        - **AC-002.3.1** — Time delta calculation excludes 'failed' state timestamps.
          - _Measurable:_ delta = current_timestamp - max(update_timestamp WHERE status != 'failed')

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10 · Pass: 4_

      _Decomposition rationale:_ Isolates the calculation logic to define the specific input for the timeout check without committing to the database schema source yet.

      _Surfaced assumptions:_ A-0527, A-0528
    - **FR-ACCT-1.2-3-2** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Persist 'failed' status to the workflow record, **so that** Workflow record is in terminal 'failed' state.

      **Acceptance criteria:**
        - **AC-002.3.2** — Workflow status field is updated to 'failed'.
          - _Measurable:_ ent_workflow.status === 'failed' after commit

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-010-C1.1, US-010-C1.2-1 · Pass: 4_

      _Decomposition rationale:_ Defines the terminal outcome of the timeout check, ensuring the system moves to a state that signals failure.

      _Surfaced assumptions:_ A-0527, A-0528
    - **FR-ACCT-1.2-3-3** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Record failure trigger event in audit log, **so that** Failure trigger is immutably recorded for compliance.

      **Acceptance criteria:**
        - **AC-002.3.3** — An audit log entry documents the timeout failure trigger.
          - _Measurable:_ exists() IN audit_logs WHERE event_type = 'timeout_failure' AND workflow_id = target

      _Status: atomic · Priority: high · Tier: D · Traces to: UJ-12 · Pass: 4_

      _Decomposition rationale:_ Satisfies compliance requirements for failure events by ensuring an immutable record is created.

      _Surfaced assumptions:_ A-0527, A-0528
##### US-010-C1.3 `[Tier D · atomic]`

**As a** Auditor, **I want** Log workflow completion or failure event, **so that** Audit row persists in execution_logs table with status and timestamp.

**Acceptance criteria:**
  - **AC-003** — Execution log row persists immediately after task status check.
    - _Measurable:_ SELECT * FROM execution_logs WHERE wf_instance_id = X ORDER BY timestamp DESC LIMIT 1 = 'completed'

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-10, WF-12, ENT-AUDIT-LOG · Pass: 2_

_Decomposition rationale:_ This is a terminal leaf operation verifying that the system recorded the result of the execution.

_Surfaced assumptions:_ A-0109, A-0110, A-0111, A-0112

##### US-010-C1.4 `[Tier C · pending]`

**As a** Orchestrator, **I want** Enforce DBOS retry policy constraints, **so that** Task retries adhere to internal queue limits without exceeding UJ-10 SLA.

**Acceptance criteria:**
  - **AC-004** — Retry loop does not exceed defined attempt threshold (e.g., 3 times).
    - _Measurable:_ task_retry_count <= 3 AND (task_retry_count < 3 OR elapsed_time < 10s)

_Status: pending · Priority: medium · Tier: C · Traces to: UJ-10, WF-12 · Pass: 2_

_Decomposition rationale:_ Implementation choice on how to handle transient failures (DBOS specific) before declaring an error per AC-101.

_Surfaced assumptions:_ A-0109, A-0110, A-0111, A-0112

  - **US-010-C1.4.1** `[Tier C · pending]`
    **As a** Orchestrator, **I want** Cap retry attempt count to defined threshold, **so that** Task is stopped from retrying once maximum attempts reached.

    **Acceptance criteria:**
      - **AC-004.1** — Retry count does not exceed 3.
        - _Measurable:_ task_retry_count <= 3

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-10, WF-12, US-010-C1.1 · Pass: 3_

    _Decomposition rationale:_ Defines the upper boundary of the retry loop, ensuring queue limits are respected.

    _Surfaced assumptions:_ A-0259, A-0260
    - **FR-ACCT-1.1** `[Tier C · pending]`
      **As a** CAM operator, **I want** validate retry count against threshold before allowing new retry, **so that** Retry request is rejected if current count is at or above limit.

      **Acceptance criteria:**
        - **AC-004.2** — New retry requests are rejected when retry_count == 3.
          - _Measurable:_ If workflow.retry_count == 3 AND action_type == 'retry' THEN reject_action()

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-12, UJ-10 · Pass: 4_

      _Decomposition rationale:_ Enforces the hard limit boundary defined by the parent policy; prevents infinite loop and resource exhaustion.

      _Surfaced assumptions:_ A-0529, A-0530
    - **FR-ACCT-1.2** `[Tier C · pending]`
      **As a** CAM operator, **I want** increment retry counter upon retry workflow step execution, **so that** Counter value increases atomically after a retry cycle.

      **Acceptance criteria:**
        - **AC-004.3** — Counter increments after every completed retry attempt.
          - _Measurable:_ workflow.retry_count_before == N AND workflow.retry_count_after == N + 1

      _Status: pending · Priority: high · Tier: C · Traces to: WF-12, UJ-10 · Pass: 4_

      _Decomposition rationale:_ Maintains accurate state of attempts; ensures the validation logic in Child 1 has correct input data.

      _Surfaced assumptions:_ A-0529, A-0530
    - **FR-ACCT-1.3** `[Tier C · pending]`
      **As a** CAM operator, **I want** audit retry count breach event, **so that** System logs when limit is reached to support traceability.

      **Acceptance criteria:**
        - **AC-004.4** — Audit record created when retry count reaches 3.
          - _Measurable:_ Count == 3 AND workflow.retry_count <= 3 BEFORE AND AFTER

      _Status: pending · Priority: medium · Tier: C · Traces to: WF-12, US-010-C1.4.3 · Pass: 4_

      _Decomposition rationale:_ Ensures observability when the parent policy limit is triggered; distinguishes this from simple status update in sibling 4.3.

      _Surfaced assumptions:_ A-0529, A-0530
  - **US-010-C1.4.2** `[Tier C · pending]`
    **As a** Orchestrator, **I want** Enforce elapsed time SLA window for retries, **so that** Retry attempts terminate if elapsed time exceeds 10 seconds.

    **Acceptance criteria:**
      - **AC-004.2** — Elapsed time for retries remains under SLA limit.
        - _Measurable:_ elapsed_time < 10s

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-10, WF-12, US-010-C1.2 · Pass: 3_

    _Decomposition rationale:_ Ensures task retries do not block the queue indefinitely, adhering to SLA constraints.

    _Surfaced assumptions:_ A-0259, A-0260
    - **US-010-C1.4.2-01** `[Tier C · pending]`
      **As a** Retry Policy Enforcer, **I want** Evaluate elapsed_time condition before queuing next retry attempt, **so that** Retry queue is blocked if time limit is exceeded.

      **Acceptance criteria:**
        - **AC-004.2-01** — Retry execution does not occur if elapsed_time >= 10000ms
          - _Measurable:_ if (current_timestamp - start_timestamp) >= 10000 THEN cancel_retry()

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-10, US-010-C1.4.1 · Pass: 4_

      _Decomposition rationale:_ Defines the primary enforcement logic, distinct from the count-based limit in sibling US-010-C1.4.1.

      _Surfaced assumptions:_ A-0531, A-0532
    - **US-010-C1.4.2-02** `[Tier C · pending]`
      **As a** Audit Logger, **I want** Persist SLA breach event to the system audit trail, **so that** Violations are recorded for compliance review in UJ-10.

      **Acceptance criteria:**
        - **AC-004.2-02** — Breach event is immutably recorded in audit log
          - _Measurable:_ INSERT INTO ENT-AUDIT-LOG (event_id, timestamp, message) ...

      _Status: pending · Priority: high · Tier: C · Traces to: UJ-10, WF-12, US-010-C1.2 · Pass: 4_

      _Decomposition rationale:_ Commitment to compliance and traceability required for the reporting workflow context.

      _Surfaced assumptions:_ A-0531, A-0532
    - **US-010-C1.4.2-03** `[Tier D · atomic]`
      **As a** Time Validator, **I want** Calculate time delta using synchronized system clock, **so that** Accurate elapsed_time value returned for comparison.

      **Acceptance criteria:**
        - **AC-004.2-03** — Timestamp precision is sufficient for SLA comparison
          - _Measurable:_ clock_precision >= 1ms AND clock_source == synchronized_source

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10, WF-12 · Pass: 4_

      _Decomposition rationale:_ Atomic verification step required to validate the elapsed_time variable in AC-004.2.

      _Surfaced assumptions:_ A-0531, A-0532
    - **US-010-C1.4.2-04** `[Tier D · atomic]`
      **As a** Status Updater, **I want** Set workflow execution status to failed upon SLA breach, **so that** Workflow transitions to terminal state preventing further retries.

      **Acceptance criteria:**
        - **AC-004.2-04** — Status transition is durable and reflected in DB
          - _Measurable:_ UPDATE ENT-WORK-ORDER SET status = 'failed' WHERE id = ? AND elapsed_time > ?

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10, US-010-C1.4.3 · Pass: 4_

      _Decomposition rationale:_ Terminal state change ensures system stability and aligns with sibling commitment to persist failure status.

      _Surfaced assumptions:_ A-0531, A-0532
  - **US-010-C1.4.3** `[Tier D · atomic]`
    **As a** Orchestrator, **I want** Persist failure status on limit breach, **so that** Workflow status transitions to 'failed' with audit record.

    **Acceptance criteria:**
      - **AC-004.3** — Workflow record reflects final failed state.
        - _Measurable:_ wf_execution.status === 'failed' AND timestamp > elapsed_time

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10, WF-12, US-010-C1.3 · Pass: 3_

    _Decomposition rationale:_ The terminal action of the retry logic, marking the task as complete and failed.

    _Surfaced assumptions:_ A-0259, A-0260
#### US-010-C2 `[Tier D · atomic]`

**As a** Data Persistence, **I want** Persist ENT-REPORT-SNAP, **so that** Report snapshot record exists in DB.

**Acceptance criteria:**
  - **AC-102** — Report snapshot row inserted
    - _Measurable:_ SELECT * FROM report_snapshots WHERE id = 'X' LIMIT 1

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-10, ENT-REPORT-SNAP · Pass: 1_

_Decomposition rationale:_ This child defines the leaf operation for storing the result, committing to the specific entity record type for caching/report history.

_Surfaced assumptions:_ A-0028, A-0029, A-0030, A-0031

#### US-010-C3 `[Tier C · pending]`

**As a** Template Binding, **I want** Apply ENT-REPORT-TPL, **so that** Output matches defined template schema.

**Acceptance criteria:**
  - **AC-103** — Generated PDF/CSV matches template layout
    - _Measurable:_ output.template_id === ENT-REPORT-TPL.selected_id

_Status: pending · Priority: high · Tier: C · Traces to: UJ-10, ENT-REPORT-TPL · Pass: 1_

_Decomposition rationale:_ This child binds the visual structure of the report, committing to a specific template configuration rather than default layout.

_Surfaced assumptions:_ A-0028, A-0029, A-0030, A-0031

##### US-010-C3-1 `[Tier D · atomic]`

**As a** Data Mapper, **I want** Map source transaction fields to template schema columns, **so that** Data structure matches ENT-REPORT-TPL selected schema layout.

**Acceptance criteria:**
  - **AC-C3-1** — Mapped row count equals source row count
    - _Measurable:_ len(output.data_rows) === len(source.transactions) for every request

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10, ENT-REPORT-TPL, ENT-TRANSACTION · Pass: 2_

_Decomposition rationale:_ Mapping is the functional bridge between raw data and structured output, requiring strict type enforcement.

_Surfaced assumptions:_ A-0113, A-0114, A-0115

##### US-010-C3-2 `[Tier D · atomic]`

**As a** Renderer, **I want** Generate PDF or CSV stream from mapped data, **so that** Binary stream ready for storage and retrieval.

**Acceptance criteria:**
  - **AC-C3-2** — Output stream matches target format headers
    - _Measurable:_ output.file_extension is 'pdf' or 'csv' and content-type matches request header

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-10, ENT-REPORT-TPL, TECH-14 · Pass: 2_

_Decomposition rationale:_ Rendering converts the logical data model into the physical file format required by the user journey.

_Surfaced assumptions:_ A-0113, A-0114, A-0115

##### US-010-C3-3 `[Tier D · atomic]`

**As a** Writer, **I want** Persist generated file to object storage with checksum, **so that** File available for download in output bucket with audit trail.

**Acceptance criteria:**
  - **AC-C3-3** — Stored file hash matches computed SHA-256 digest
    - _Measurable:_ file_hash === computed_hash for every persisted object in object storage

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10, ENT-REPORT-TPL, TECH-14 · Pass: 2_

_Decomposition rationale:_ Persistence is the final step making the output durable and auditable for the system of record.

_Surfaced assumptions:_ A-0113, A-0114, A-0115

#### US-010-C4 `[Tier C · pending]`

**As a** Data Validator, **I want** Validate ENT-KPI-METRIC, **so that** Report data accurate against source transactions.

**Acceptance criteria:**
  - **AC-104** — Source data consistency check passes
    - _Measurable:_ accuracy_ratio >= 0.95

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-10, ENT-KPI-METRIC · Pass: 1_

_Decomposition rationale:_ This child addresses the accuracy AC (AC-020) by committing to a specific validation logic against the transaction entity.

_Surfaced assumptions:_ A-0028, A-0029, A-0030, A-0031

##### US-010-C4-001 `[Tier D · atomic]`

**As a** Data Fetcher, **I want** Retrieve KPI Definition and Aggregation Rules, **so that** KPI Metric definition object loaded with formula and scope.

**Acceptance criteria:**
  - **AC-104.1** — KPI definition is loaded from ENT-KPI-METRIC.
    - _Measurable:_ KPI definition object exists and contains a non-null formula string.

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10, ENT-KPI-METRIC · Pass: 2_

_Decomposition rationale:_ Obtaining the calculation logic is the prerequisite for any validation; this is an atomic fetch operation.

_Surfaced assumptions:_ A-0116, A-0117

##### US-010-C4-002 `[Tier D · atomic]`

**As a** Data Aggregator, **I want** Fetch Source Transactions within KPI Scope, **so that** List of source transactions ready for calculation.

**Acceptance criteria:**
  - **AC-104.2** — All transactions within the defined time window are retrieved.
    - _Measurable:_ Count of fetched transactions matches count in ENT-TRANSACTION for the period.

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10, ENT-KPI-METRIC, ENT-TRANSACTION · Pass: 2_

_Decomposition rationale:_ Gathering the source data is a distinct atomic step from fetching the definition.

_Surfaced assumptions:_ A-0116, A-0117

##### US-010-C4-003 `[Tier D · atomic]`

**As a** Consistency Checker, **I want** Calculate Accuracy Ratio against Reported Value, **so that** Accuracy ratio value computed (float).

**Acceptance criteria:**
  - **AC-104.3** — Accuracy ratio is computed using the KPI formula.
    - _Measurable:_ accuracy_ratio is not null and is a numeric value derived from source data.

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10, ENT-KPI-METRIC · Pass: 2_

_Decomposition rationale:_ Applying the logic to data is the core of the validation; testable math operation.

_Surfaced assumptions:_ A-0116, A-0117

##### US-010-C4-004 `[Tier D · atomic]`

**As a** Audit Logger, **I want** Persist Validation Result and Anomaly Status, **so that** Validation record stored in audit log.

**Acceptance criteria:**
  - **AC-104.4** — Result is immutably recorded.
    - _Measurable:_ Audit log entry exists with status, calculated ratio, and timestamp.

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-10 · Pass: 2_

_Decomposition rationale:_ Logging is an atomic operation required for compliance and traceability.

_Surfaced assumptions:_ A-0116, A-0117

### FR US-011 `[pending]`

**As a** New Contractor, **I want** Complete Vendor Registration and Vetting, **so that** Account is activated for job access and work orders.

**Acceptance criteria:**
  - **AC-021** — Account active
    - _Measurable:_ ENT-VENDOR status changes to 'Active' after WF-1 vetting completes
  - **AC-022** — Forms collected
    - _Measurable:_ W-9 / 1099 data (VOC-17) is stored in ENT-VER-CHECK

_Status: pending · Priority: critical · Traces to: UJ-11, WF-1, ENT-VENDOR, VOC-17, ENT-TRUST-SCORE · Pass: 0_

#### FR-ONB-1.1 `[Tier A · pending]`

**As a** functional sub-area, **I want** Collect and validate identity/tax documents for new vendor onboarding, **so that** Vendor identity and tax status forms are stored in the verification repository.

**Acceptance criteria:**
  - **AC-101** — Vendor forms are ingested and stored without validation errors
    - _Measurable:_ Files in ENT-VER-CHECK contain W-9 or 1099 data with no null values for mandatory fields

_Status: pending · Priority: critical · Tier: A · Traces to: UJ-11, WF-1, ENT-VER-CHECK, VOC-17 · Pass: 1_

_Decomposition rationale:_ Separates the 'Forms collected' acceptance criteria into a distinct functional sub-area focused solely on data ingestion and storage.

_Surfaced assumptions:_ A-0032, A-0033, A-0034, A-0035

##### FR-ONB-1.1-1 `[Tier C · pending]`

**As a** Ingestion Policy, **I want** Enforce strict file format constraints at upload boundary, **so that** Only supported file formats (PDF, OFX) proceed to processing; others are rejected immediately.

**Acceptance criteria:**
  - **AC-101-1** — Upload endpoint rejects unsupported MIME types.
    - _Measurable:_ HTTP 415 returned for requests with Content-Type not in ['application/pdf', 'application/vnd.openxmlformats-officedocument', 'image/tiff']

_Status: pending · Priority: critical · Tier: C · Traces to: WF-1 · Pass: 2_

_Decomposition rationale:_ Defines the specific technical constraint for the 'Collect' action; isolates file format security from validation logic.

_Surfaced assumptions:_ A-0118, A-0119, A-0120

  - **FR-ONB-1.1-1.1** `[Tier D · atomic]`
    **As a** Enforcement Gate, **I want** Reject request with HTTP 415 if Content-Type is not in allowed whitelist, **so that** Client receives 415 error immediately upon upload attempt with unsupported format.

    **Acceptance criteria:**
      - **AC-101-1** — Upload endpoint rejects unsupported MIME types.
        - _Measurable:_ HTTP 415 returned for requests with Content-Type not in ['application/pdf', 'application/vnd.openxmlformats-officedocument', 'image/tiff']

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ Atomic implementation commitment defining the failure case of the format policy; this is the testable leaf operation for the rejection branch.

    _Surfaced assumptions:_ A-0261, A-0262
  - **FR-ONB-1.1-1.2** `[Tier D · atomic]`
    **As a** Ingestion Gate, **I want** Forward request to downstream processing if Content-Type is in allowed whitelist, **so that** Request proceeds to FR-ONB-1.1-2 (Completeness Validation) and subsequent steps.

    **Acceptance criteria:**
      - **AC-101-2** — Supported MIME types are forwarded without format-related rejection.
        - _Measurable:_ Requests with valid Content-Type do not return 415 and are passed to the next handler in the ingestion pipeline

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ Atomic implementation commitment defining the success path of the format policy; ensures that the 'proceed' clause from the parent description is testable.

    _Surfaced assumptions:_ A-0261, A-0262
##### FR-ONB-1.1-2 `[Tier C · pending]`

**As a** Data Validation Logic, **I want** Validate completeness against mandatory field schema, **so that** Storage proceeds only if all mandatory fields are non-null and format-compliant.

**Acceptance criteria:**
  - **AC-101-2** — Mandatory fields contain data.
    - _Measurable:_ sum(cast(is_null(mandatory_fields) as int)) === 0 for all rows in ENT-VER-CHECK at commit time

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-VER-CHECK, UJ-11 · Pass: 2_

_Decomposition rationale:_ Separates the 'Validate' action into schema-based verification, distinct from storage integrity.

_Surfaced assumptions:_ A-0118, A-0119, A-0120

  - **FR-ONB-1.1-2.1** `[Tier D · atomic]`
    **As a** Commit Guard, **I want** Enforce null-ness check on configured mandatory columns, **so that** Reject the row if any configured mandatory field is null at commit time.

    **Acceptance criteria:**
      - **AC-001** — No mandatory field value is null.
        - _Measurable:_ count(columns in mandatory_schema) where value is null === 0

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-VER-CHECK · Pass: 3_

    _Decomposition rationale:_ This is the atomic leaf operation for the 'completeness' aspect of the parent AC. It is directly testable without further decomposition.

    _Surfaced assumptions:_ A-0263, A-0264, A-0265
  - **FR-ONB-1.1-2.2** `[Tier D · atomic]`
    **As a** Schema Validator, **I want** Enforce format-compliance check on mandatory fields, **so that** Reject the row if any mandatory field fails regex or length validation defined in schema.

    **Acceptance criteria:**
      - **AC-002** — Every mandatory field matches its defined format.
        - _Measurable:_ all(fields in mandatory_schema) => regex_match(field, pattern(field))

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-VER-CHECK · Pass: 3_

    _Decomposition rationale:_ This is the atomic leaf operation for the 'format-compliant' aspect of the parent AC. Separated from null checks to allow distinct validation logic paths.

    _Surfaced assumptions:_ A-0263, A-0264, A-0265
  - **FR-ONB-1.1-2.3** `[Tier C · pending]`
    **As a** Schema Resolver, **I want** Retrieve mandatory field schema for the specific entity and jurisdiction, **so that** Validation rules are derived from the active configuration for the document type and region.

    **Acceptance criteria:**
      - **AC-003** — Schema lookup returns the correct jurisdiction-specific mandatory list.
        - _Measurable:_ schema.id === entity.region && schema.version === active_config.latest

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-VER-CHECK, FR-ONB-1.1-3 · Pass: 3_

    _Decomposition rationale:_ This is an implementation commitment that binds the validation logic to a configuration mechanism (schema lookup), acknowledging the jurisdictional variation noted in existing assumption [A-0118].

    _Surfaced assumptions:_ A-0263, A-0264, A-0265
    - **FR-ONB-1.1-2.3.1** `[Tier C · pending]`
      **As a** Implementation Commitment, **I want** Perform cache lookup for jurisdiction-specific schema using entity region and doc type key, **so that** Retrieve cached schema or mark for primary store query.

      **Acceptance criteria:**
        - **AC-004** — Cache hit/miss event is logged for observability.
          - _Measurable:_ log.level === 'info' && log.message.includes('schema-cache-miss' || 'schema-cache-hit')

      _Status: pending · Priority: high · Tier: C · Traces to: UJ-11, ENT-REGION-CONFIG · Pass: 4_

      _Decomposition rationale:_ Defines the initial low-latency retrieval path; separates cache management from primary data access.

      _Surfaced assumptions:_ A-0533, A-0534, A-0535
    - **FR-ONB-1.1-2.3.2** `[Tier C · pending]`
      **As a** Implementation Commitment, **I want** Query primary configuration table using derived composite key (entity.region + entity.type), **so that** Schema object returned or exception raised for missing key.

      **Acceptance criteria:**
        - **AC-005** — Primary store returns schema matching stored region version.
          - _Measurable:_ schema.id === entity.region && schema.version <= active_config.latest

      _Status: pending · Priority: critical · Tier: C · Traces to: ENT-UNIT-CONFIG, WF-1 · Pass: 4_

      _Decomposition rationale:_ Ensures data integrity by fetching the authoritative source when cache is stale or miss; binds to the dynamic table storage assumption.

      _Surfaced assumptions:_ A-0533, A-0534, A-0535
    - **FR-ONB-1.1-2.3.3** `[Tier B · pending]`
      **As a** Architectural Choice, **I want** Fall back to base schema when jurisdiction config is missing, **so that** System accepts validation rules defined in the global baseline configuration.

      **Acceptance criteria:**
        - **AC-006** — Validation proceeds without error when region config is absent.
          - _Measurable:_ validation_result === 'success' && fallback_schema === true

      _Status: pending · Priority: medium · Tier: B · Traces to: UJ-1, AC-003 · Pass: 4_

      _Decomposition rationale:_ Establishes the system behavior for edge cases (missing locales); defines the scope boundary for jurisdiction coverage.

      _Surfaced assumptions:_ A-0533, A-0534, A-0535
##### FR-ONB-1.1-3 `[Tier C · pending]`

**As a** Tax Form Classification, **I want** Identify tax document type (W-9 vs 1099), **so that** Document is tagged with 'form_type' attribute for compliance lookup.

**Acceptance criteria:**
  - **AC-101-3** — Form type is assigned correctly.
    - _Measurable:_ ENT-VER-CHECK.form_type IN ('W-9', '1099') AND is_distinct_from_null

_Status: pending · Priority: high · Tier: C · Traces to: VOC-17, WF-1 · Pass: 2_

_Decomposition rationale:_ Implements the 'Validate' action by mapping physical document to the canonical vocabulary (VOC-17) required for storage.

_Surfaced assumptions:_ A-0118, A-0119, A-0120

  - **FR-ONB-1.1-3.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Match W-9 signature patterns in document content, **so that** Document is tagged W-9 when specific keywords found.

    **Acceptance criteria:**
      - **AC-101-3.1** — W-9 detected via OCR/Pattern matching.
        - _Measurable:_ document content contains 'W-9' OR 'TIN' pattern with confidence > 0.9

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-1, VOC-17 · Pass: 3_

    _Decomposition rationale:_ Defines the specific implementation strategy for detecting W-9 forms as part of the broader identification capability.

    _Surfaced assumptions:_ A-0266, A-0267, A-0268
    - **FR-ONB-1.1-3.1-C1** `[Tier D · atomic]`
      **As a** Engineer, **I want** Invoke OCR service to extract raw text from digital asset, **so that** Document raw text string populated in memory.

      **Acceptance criteria:**
        - **AC-101-3.1-A** — OCR service returns extracted text string for valid documents.
          - _Measurable:_ ocr_result.text != null AND ocr_result.source_id === document_id

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-1 · Pass: 4_

      _Decomposition rationale:_ The parent's 'OCR' component must be isolated as a distinct technical sub-operation to verify integration with the ingestion workflow.

      _Surfaced assumptions:_ A-0536, A-0537
    - **FR-ONB-1.1-3.1-C2** `[Tier D · atomic]`
      **As a** Engineer, **I want** Apply regex patterns to identify 'W-9' or 'TIN' keywords, **so that** Match results with confidence score generated.

      **Acceptance criteria:**
        - **AC-101-3.1-B** — Text search identifies W-9 or TIN string with score >= 0.9.
          - _Measurable:_ pattern_match.confidence >= 0.9 AND pattern_match.match_type IN ['W-9', 'TIN']

      _Status: atomic · Priority: critical · Tier: D · Traces to: VOC-17 · Pass: 4_

      _Decomposition rationale:_ The 'Pattern matching' component is an implementation commitment where specific algorithmic thresholds (0.9) are applied to the extracted text.

      _Surfaced assumptions:_ A-0536, A-0537
    - **FR-ONB-1.1-3.1-C3** `[Tier D · atomic]`
      **As a** Engineer, **I want** Update document metadata to reflect detected form type, **so that** Document entity 'formType' attribute set to 'W-9'.

      **Acceptance criteria:**
        - **AC-101-3.1-C** — Document metadata persists with updated formType.
          - _Measurable:_ document.formType === 'W-9' AND document.last_modified === now()

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-ONB-1.1-3.1 · Pass: 4_

      _Decomposition rationale:_ The resulting 'Tagging' action is the final state transition defined by the parent requirement, committed to as a leaf operation.

      _Surfaced assumptions:_ A-0536, A-0537
  - **FR-ONB-1.1-3.2** `[Tier C · pending]`
    **As a** CAM operator, **I want** Match 1099 signature patterns in document content, **so that** Document is tagged 1099 when specific keywords found.

    **Acceptance criteria:**
      - **AC-101-3.2** — 1099 detected via OCR/Pattern matching.
        - _Measurable:_ document content contains '1099' pattern with confidence > 0.9

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-1, VOC-17 · Pass: 3_

    _Decomposition rationale:_ Defines the specific implementation strategy for detecting 1099 forms as part of the broader identification capability.

    _Surfaced assumptions:_ A-0266, A-0267, A-0268
    - **FR-ONB-1.1-3.2.1** `[Tier D · atomic]`
      **As a** OCR Service, **I want** Extract text regions corresponding to 1099 form layout, **so that** Structured text string containing 1099 keywords.

      **Acceptance criteria:**
        - **AC-101-3.2-1** — OCR output contains '1099' text regions.
          - _Measurable:_ extracted_text_regions.length > 0 AND extracted_text_regions.includes('1099')

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-4, ENT-DIGITAL-FILE · Pass: 4_

      _Decomposition rationale:_ Atomic extraction is the first testable step in the pattern matching pipeline; verified by OCR service output.

      _Surfaced assumptions:_ A-0538, A-0539
    - **FR-ONB-1.1-3.2.2** `[Tier D · atomic]`
      **As a** Pattern Matcher, **I want** Apply 1099 keyword pattern confidence calculation, **so that** Computed confidence score for 1099 match.

      **Acceptance criteria:**
        - **AC-101-3.2-2** — Confidence score meets threshold for auto-tag.
          - _Measurable:_ pattern_match_confidence >= 0.9

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-4 · Pass: 4_

      _Decomposition rationale:_ Direct implementation of the parent AC regarding confidence > 0.9; verifies the matching logic engine.

      _Surfaced assumptions:_ A-0538, A-0539
    - **FR-ONB-1.1-3.2.3** `[Tier D · atomic]`
      **As a** Document State Manager, **I want** Persist 1099 classification flag to entity metadata, **so that** Document Entity type field updated to 1099.

      **Acceptance criteria:**
        - **AC-101-3.2-3** — Document metadata reflects successful 1099 tag.
          - _Measurable:_ document_entity.type === '1099' AND document_entity.last_modified_at >= now()

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-1, ENT-DIGITAL-FILE · Pass: 4_

      _Decomposition rationale:_ The final atomic action completing the requirement's functional outcome; commits the tag to the system of record.

      _Surfaced assumptions:_ A-0538, A-0539
    - **FR-ONB-1.1-3.2.4** `[Tier D · atomic]`
      **As a** Compliance Validator, **I want** Validate extracted Tax ID format against IRS standard, **so that** Tax ID status recorded (Valid/Invalid).

      **Acceptance criteria:**
        - **AC-101-3.2-4** — Extracted Tax ID matches valid IRS pattern.
          - _Measurable:_ extracted_tax_id.matches(/\d{9}-\d{4}|\d{5}-\d{4}/)

      _Status: atomic · Priority: high · Tier: D · Traces to: WF-1, ENT-VENDOR · Pass: 4_

      _Decomposition rationale:_ Supports the 'W-9 / 1099 data' requirement (VOC-17) by verifying specific form content; atomic validation step.

      _Surfaced assumptions:_ A-0538, A-0539
  - **FR-ONB-1.1-3.3** `[Tier C · pending]`
    **As a** CAM operator, **I want** Trigger manual review for low-confidence classifications, **so that** Uncertain documents routed to staff queue.

    **Acceptance criteria:**
      - **AC-101-3.3** — Ambiguous documents flagged for human review.
        - _Measurable:_ if classification_confidence < 0.9 then set_status = 'Pending_Review'

    _Status: pending · Priority: high · Tier: C · Traces to: WF-1, FR-ONB-1.1-4 · Pass: 3_

    _Decomposition rationale:_ Defines the exception handling and fallback strategy for documents that do not meet automatic classification criteria.

    _Surfaced assumptions:_ A-0266, A-0267, A-0268
    - **FR-ONB-1.1-3.3.1** `[Tier C · pending]`
      **As a** CAM operator, **I want** Retrieve and validate classification confidence score, **so that** Confidence score is available and valid for comparison logic.

      **Acceptance criteria:**
        - **AC-102-3.3-1** — Confidence score is retrieved from classification service.
          - _Measurable:_ document.classification_confidence is not null and >= 0.0

      _Status: pending · Priority: high · Tier: C · Traces to: WF-1 · Pass: 4_

      _Decomposition rationale:_ Verifies the prerequisite condition for the threshold check; failure to retrieve a valid score blocks the review trigger logic.

      _Surfaced assumptions:_ A-0540
    - **FR-ONB-1.1-3.3.2** `[Tier C · pending]`
      **As a** CAM operator, **I want** Evaluate threshold comparison rule, **so that** Document identified as ambiguous if confidence < 0.9.

      **Acceptance criteria:**
        - **AC-102-3.3-2** — Ambiguous document identified based on threshold.
          - _Measurable:_ if classification_confidence < 0.9 then flag_ambiguous = true

      _Status: pending · Priority: high · Tier: C · Traces to: WF-1, FR-ONB-1.1-4 · Pass: 4_

      _Decomposition rationale:_ Applies the policy choice for ambiguity handling defined by the threshold constraint; relies on A-0268 for the 0.9 value.

      _Surfaced assumptions:_ A-0540
    - **FR-ONB-1.1-3.3.3** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Update document status to Pending_Review, **so that** Document status is set to Pending_Review in the database.

      **Acceptance criteria:**
        - **AC-102-3.3-3** — Status field updated on persisted document.
          - _Measurable:_ document.status === 'Pending_Review' after transaction commit

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-1 · Pass: 4_

      _Decomposition rationale:_ Atomic state transition required for audit trail compliance and downstream workflow triggers (e.g. UJ-8).

      _Surfaced assumptions:_ A-0540
    - **FR-ONB-1.1-3.3.4** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Insert document into staff review queue, **so that** Document entry added to staff review queue table.

      **Acceptance criteria:**
        - **AC-102-3.3-4** — Document record exists in staff review queue.
          - _Measurable:_ count(staff_review_queue WHERE doc_id = target_doc) > 0

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-1 · Pass: 4_

      _Decomposition rationale:_ Final action to enable human operator to inspect and approve the ambiguous document; completes the routing commitment.

      _Surfaced assumptions:_ A-0540
##### FR-ONB-1.1-4 `[Tier D · atomic]`

**As a** Repository Persistence, **I want** Persist document bytes to verification storage, **so that** Document file is immutable and accessible via ENT-VER-CHECK ID.

**Acceptance criteria:**
  - **AC-101-4** — File exists in storage and is readable.
    - _Measurable:_ GET request to /storage/{entity_id} returns 200 OK with document bytes

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-VER-CHECK, WF-1 · Pass: 2_

_Decomposition rationale:_ This is the terminal atomic operation (Leaf) defining the 'Stored in repository' acceptance criterion.

_Surfaced assumptions:_ A-0118, A-0119, A-0120

#### FR-ONB-1.2 `[Tier A · pending]`

**As a** functional sub-area, **I want** Execute external compliance and license verification checks, **so that** Vendor license and insurance status are validated against external standards.

**Acceptance criteria:**
  - **AC-102** — License expiration is detected and flagged prior to activation
    - _Measurable:_ System query against ENT-VENDOR-LICENSE and ENT-VENDOR-INSURANCE returns non-expired status

_Status: pending · Priority: critical · Tier: A · Traces to: UJ-11, WF-1, ENT-VENDOR, VOC-17 · Pass: 1_

_Decomposition rationale:_ Derives the 'Vetting' functional area which defines the policy check logic (compliance/external auth) separate from data storage.

_Surfaced assumptions:_ A-0032, A-0033, A-0034, A-0035

##### FR-ONB-1.2.1 `[Tier C · pending]`

**As a** CAM operator, **I want** Query license status for active vendors during onboarding workflow, **so that** System retrieves current validity status from external registry for license entity.

**Acceptance criteria:**
  - **AC-102-LIC** — License entity record reflects valid status after query
    - _Measurable:_ ENT-VENDOR-LICENSE.valid_status === 'active' AND ENT-VENDOR-LICENSE.expiry_date > current_date

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-11, WF-1, ENT-VENDOR-LICENSE · Pass: 2_

_Decomposition rationale:_ Breaks down the general compliance requirement into the specific license verification action. This is an implementation commitment (Technology/Logic) for the license domain.

_Surfaced assumptions:_ A-0121, A-0122

  - **FR-ONB-1.2.1.1** `[Tier C · pending]`
    **As a** Integration Engineer, **I want** Establish authenticated connection to external registry endpoint, **so that** Secure channel open to external API for license status retrieval.

    **Acceptance criteria:**
      - **AC-001** — Connection handshake completes successfully.
        - _Measurable:_ status === 'connected' && protocol === 'tls' && endpoint in approved_registry_list

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-ONB-1.2.3, TECH-2, TECH-9 · Pass: 3_

    _Decomposition rationale:_ Commits to using secure, authenticated connections, leveraging sibling FR-ONB-1.2.3 for endpoint definitions and technical constraints TECH-2/TECH-9.

    _Surfaced assumptions:_ A-0269, A-0270
    - **FR-ONB-1.2.1.1.1** `[Tier C · pending]`
      **As a** Security Engineer, **I want** Configure TLS cipher suites and protocol versions for registry traffic, **so that** Registry connections utilize only approved secure protocols.

      **Acceptance criteria:**
        - **AC-101** — Outgoing connections refuse protocols below TLS 1.2
          - _Measurable:_ openssl s_client handshake fails for TLS 1.1 or lower

      _Status: pending · Priority: high · Tier: C · Traces to: TECH-2 · Pass: 4_

      _Decomposition rationale:_ Security hardening of the transport layer is a direct implementation decision required before any connection attempt can succeed, distinct from the broader authentication logic.

      _Surfaced assumptions:_ A-0541, A-0542, A-0543
    - **FR-ONB-1.2.1.1.2** `[Tier C · pending]`
      **As a** Integration Engineer, **I want** Implement credential retrieval and injection for registry API calls, **so that** API calls contain valid, rotated authentication tokens.

      **Acceptance criteria:**
        - **AC-102** — Credentials are sourced from a secure secret store
          - _Measurable:_ Credential lookup succeeds against HSM/Vault integration

      _Status: pending · Priority: critical · Tier: C · Traces to: TECH-9, FR-ONB-1.2.1.3 · Pass: 4_

      _Decomposition rationale:_ Authentication logic dictates how the system obtains identity before handshake; this binds the specific secret management technology to the integration layer.

      _Surfaced assumptions:_ A-0541, A-0542, A-0543
    - **FR-ONB-1.2.1.1.3** `[Tier D · atomic]`
      **As a** DevOps Engineer, **I want** Resolve registry endpoints based on tenant geographic region, **so that** Connections are routed to the nearest available registry instance.

      **Acceptance criteria:**
        - **AC-103** — Endpoint resolution selects region-appropriate host
          - _Measurable:_ Resolved URL matches tenant_region_config.host_map[region]

      _Status: atomic · Priority: high · Tier: D · Traces to: FR-ONB-1.2.1.3, TECH-2 · Pass: 4_

      _Decomposition rationale:_ Registry availability varies by jurisdiction; endpoint resolution is a sub-strategy for maintaining 'available registry list' compliance and ensures correct routing.

      _Surfaced assumptions:_ A-0541, A-0542, A-0543
    - **FR-ONB-1.2.1.1.4** `[Tier D · atomic]`
      **As a** DevOps Engineer, **I want** Validate external CA certificate chain upon connection init, **so that** Certificate verification passes without errors.

      **Acceptance criteria:**
        - **AC-104** — Certificate chain validates against trusted root store
          - _Measurable:_ tls_verify_status === 'success' && ca_chain_length >= 0

      _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-2 · Pass: 4_

      _Decomposition rationale:_ Certificate validation is an atomic, testable verification step occurring during the handshake, making it a leaf operation.

      _Surfaced assumptions:_ A-0541, A-0542, A-0543
    - **FR-ONB-1.2.1.1.5** `[Tier C · pending]`
      **As a** Security Engineer, **I want** Enforce rate limiting and connection pooling policies for registry calls, **so that** Outbound traffic adheres to external provider SLAs.

      **Acceptance criteria:**
        - **AC-105** — Connection pool size and rate limit are configured per registry
          - _Measurable:_ Connection pool count <= provider_max_connections && request_rate <= provider_rate_limit

      _Status: pending · Priority: medium · Tier: C · Traces to: TECH-9 · Pass: 4_

      _Decomposition rationale:_ Operational constraints like rate limiting are internal implementation commitments necessary to prevent external rejection without explicit external mandates.

      _Surfaced assumptions:_ A-0541, A-0542, A-0543
  - **FR-ONB-1.2.1.2** `[Tier C · pending]`
    **As a** Data Engineer, **I want** Transform external schema response to internal license record structure, **so that** ENT-VENDOR-LICENSE entity populated with validity status and expiry date.

    **Acceptance criteria:**
      - **AC-002** — Internal fields populated correctly from external response.
        - _Measurable:_ ENT-VENDOR-LICENSE.valid_status is defined && ENT-VENDOR-LICENSE.expiry_date is populated

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-11, ENT-VENDOR-LICENSE, WF-1 · Pass: 3_

    _Decomposition rationale:_ Defines the data mapping strategy between external registry model and internal schema, a necessary implementation step before state persistence.

    _Surfaced assumptions:_ A-0269, A-0270
    - **FR-ONB-1.2.1.2.1** `[Tier C · pending]`
      **As a** Mapping Rule Enforcer, **I want** Map external license status string to internal valid_status enum, **so that** ENT-VENDOR-LICENSE.valid_status reflects the normalized external state.

      **Acceptance criteria:**
        - **AC-002.1** — External status 'Active' maps to internal 'Active'
          - _Measurable:_ If external.response.status === 'Active', then internal.ENT-VENDOR-LICENSE.valid_status === 'Active' at commit time

      _Status: pending · Priority: critical · Tier: C · Traces to: ENT-VENDOR-LICENSE, FR-ONB-1.2.1.3 · Pass: 4_

      _Decomposition rationale:_ Defines the primary field mapping for the license entity, committing to a specific string-to-enum transformation strategy.

      _Surfaced assumptions:_ A-0544, A-0545
    - **FR-ONB-1.2.1.2.2** `[Tier C · pending]`
      **As a** Date Normalizer, **I want** Normalize external expiry date string to ISO 8601 timestamp, **so that** ENT-VENDOR-LICENSE.expiry_date stores a standard timestamp regardless of source format.

      **Acceptance criteria:**
        - **AC-002.2** — Expiry date stored in DB is parseable ISO 8601
          - _Measurable:_ internal.ENT-VENDOR-LICENSE.expiry_date matches format 'YYYY-MM-DDTHH:mm:ssZ' and parses correctly

      _Status: pending · Priority: high · Tier: C · Traces to: ENT-VENDOR-LICENSE, FR-ONB-1.2.1.1 · Pass: 4_

      _Decomposition rationale:_ Commits to a standardization strategy (ISO 8601) to ensure downstream compatibility, ruling out local timezone storage for this field.

      _Surfaced assumptions:_ A-0544, A-0545
    - **FR-ONB-1.2.1.2.3** `[Tier C · pending]`
      **As a** Missing Data Handler, **I want** Default internal fields for missing external data, **so that** System does not crash on null external response; defaults to 'Expired' status and 'Null' date.

      **Acceptance criteria:**
        - **AC-002.3** — Missing external status triggers internal default of 'Unknown' or 'Expired'
          - _Measurable:_ If external.response.status is null/undefined, then internal.ENT-VENDOR-LICENSE.valid_status === 'Unknown' OR 'Expired'

      _Status: pending · Priority: critical · Tier: C · Traces to: ENT-VENDOR-LICENSE, WF-1 · Pass: 4_

      _Decomposition rationale:_ Commits to an error-handling strategy for malformed or missing registry responses, preventing transaction failure.

      _Surfaced assumptions:_ A-0544, A-0545
    - **FR-ONB-1.2.1.2.4** `[Tier C · pending]`
      **As a** Schema Diff Auditor, **I want** Log schema mismatch events for admin review, **so that** Any deviation from expected external schema is logged to a mismatch log.

      **Acceptance criteria:**
        - **AC-002.4** — Schema mismatch triggers audit log entry
          - _Measurable:_ If external.field_name !== expected.field_name, then an audit entry is created in ENT-AUDIT-LOG referencing FR-ONB-1.2.1.2.2

      _Status: pending · Priority: medium · Tier: C · Traces to: ENT-AUDIT-LOG, ENT-VENDOR-LICENSE · Pass: 4_

      _Decomposition rationale:_ Commits to an observability requirement for data engineering changes, ensuring traceability of schema evolution.

      _Surfaced assumptions:_ A-0544, A-0545
  - **FR-ONB-1.2.1.3** `[Tier C · pending]`
    **As a** Backend Engineer, **I want** Persist validated license status to database transaction, **so that** License status state is durable and queryable by downstream workflows.

    **Acceptance criteria:**
      - **AC-003** — Record committed with accurate timestamp.
        - _Measurable:_ commit_timestamp recorded on ENT-VENDOR-LICENSE && transaction is idempotent

    _Status: pending · Priority: high · Tier: C · Traces to: WF-1, ENT-VENDOR-LICENSE · Pass: 3_

    _Decomposition rationale:_ Commits to the persistence behavior during the Vendor Registration workflow (WF-1), distinguishing it from read operations or failure handling.

    _Surfaced assumptions:_ A-0269, A-0270
    - **FR-ONB-1.2.1.3.1** `[Tier C · pending]`
      **As a** CAM operator, **I want** Enforce server-side timestamp injection on write, **so that** Database record `commit_timestamp` reflects server commit time, preventing client clock skew.

      **Acceptance criteria:**
        - **AC-003-1** — Persisted row `commit_timestamp` is within 50ms of database commit event.
          - _Measurable:_ ABS(client_timestamp - row.commit_timestamp) < 50ms for 99% of commits, enforced via DB function trigger

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-1, ENT-VENDOR-LICENSE · Pass: 4_

      _Decomposition rationale:_ AC-003 mandates 'accurate timestamp'. This child commits the architectural strategy (server-side injection) to rule out client-side timestamp manipulation, which could corrupt audit trails.

      _Surfaced assumptions:_ A-0546, A-0547, A-0548
    - **FR-ONB-1.2.1.3.2** `[Tier C · pending]`
      **As a** CAM operator, **I want** Implement idempotency validation on write endpoint, **so that** Repeated status updates with same request ID do not duplicate state changes.

      **Acceptance criteria:**
        - **AC-003-2** — Idempotent key prevents duplicate updates.
          - _Measurable:_ UPDATE count for request_id === 1 on repeated submissions within transaction window

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-1, ENT-VENDOR-LICENSE · Pass: 4_

      _Decomposition rationale:_ AC-003 explicitly requires 'transaction is idempotent'. This child commits to a concrete implementation strategy (validation check) distinguishing it from a functional sub-area.

      _Surfaced assumptions:_ A-0546, A-0547, A-0548
    - **FR-ONB-1.2.1.3.3** `[Tier D · atomic]`
      **As a** Atomic action, **I want** Update license status record in ENT-VENDOR-LICENSE, **so that** Status column changed to 'Active' or 'Expired' with no other schema changes.

      **Acceptance criteria:**
        - **AC-003-3** — Record status updates correctly.
          - _Measurable:_ SELECT status FROM ENT-VENDOR-LICENSE WHERE id = X returns new validated status

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-1, ENT-VENDOR-LICENSE · Pass: 4_

      _Decomposition rationale:_ The core operational unit of the persistence requirement is the atomic database update. This is a leaf operation (Tier D) testable against the schema directly.

      _Surfaced assumptions:_ A-0546, A-0547, A-0548
##### FR-ONB-1.2.2 `[Tier C · pending]`

**As a** CAM operator, **I want** Query insurance status for active vendors during onboarding workflow, **so that** System retrieves current coverage status from external registry for insurance entity.

**Acceptance criteria:**
  - **AC-102-INS** — Insurance entity record reflects valid coverage after query
    - _Measurable:_ ENT-VENDOR-INSURANCE.is_active === true AND ENT-VENDOR-INSURANCE.coverage_limit > 0

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-11, WF-1, ENT-VENDOR-INSURANCE · Pass: 2_

_Decomposition rationale:_ Separates insurance verification as a distinct implementation commitment from license verification, ensuring both are validated as per existing assumption A-0035.

_Surfaced assumptions:_ A-0121, A-0122

  - **FR-ONB-1.2.2-001** `[Tier C · pending]`
    **As a** Integration Layer, **I want** Invoke external insurance registry API endpoint with tenant-specific credentials, **so that** System obtains raw insurance status payload from registry provider.

    **Acceptance criteria:**
      - **AC-102-01** — Request completes within SLA or error logged
        - _Measurable:_ response_time_ms < 2000 OR status_code IN (200, 204) OR status_code == 500

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-1, UJ-11, ENT-VENDOR-INSURANCE · Pass: 3_

    _Decomposition rationale:_ Establishes the mechanism for data retrieval; required before any validation or persistence can occur.

    _Surfaced assumptions:_ A-0271, A-0272, A-0273
    - **FR-ONB-1.2.2-001-1** `[Tier C · pending]`
      **As a** IAM Operator, **I want** Inject tenant-specific credentials into the registry API request, **so that** Auth token or header injected correctly identifies the originating tenant context.

      **Acceptance criteria:**
        - **AC-002** — Every external request includes valid authentication context.
          - _Measurable:_ Request header or query parameter matches pattern for current tenant_id stored in ENT-REGION-CONFIG or ENT-ACCOUNT

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-1, UJ-11, A-0271 · Pass: 4_

      _Decomposition rationale:_ Defines the specific technical approach for 'tenant-specific credentials' mentioned in the requirement, separating auth logic from payload handling.

      _Surfaced assumptions:_ A-0549, A-0550, A-0551
    - **FR-ONB-1.2.2-001-2** `[Tier C · pending]`
      **As a** SLA Enforcer, **I want** Enforce SLA timeout threshold on external response processing, **so that** Requests exceeding response_time_ms < 2000 are rejected or logged appropriately.

      **Acceptance criteria:**
        - **AC-003** — Responses are rejected if duration exceeds limit.
          - _Measurable:_ System records error_status if response_time_ms > 2000 before reading body

      _Status: pending · Priority: high · Tier: C · Traces to: AC-102-01, WF-1 · Pass: 4_

      _Decomposition rationale:_ Transforms the AC-102-01 timing constraint into a concrete implementation commitment regarding the request lifecycle logic.

      _Surfaced assumptions:_ A-0549, A-0550, A-0551
    - **FR-ONB-1.2.2-001-3** `[Tier D · atomic]`
      **As a** Data Processor, **I want** Extract raw insurance status fields from payload, **so that** System obtains raw insurance status payload ready for mapping.

      **Acceptance criteria:**
        - **AC-004** — Raw payload content extracted successfully.
          - _Measurable:_ Extracted JSON object matches structure defined in External OpenAPI spec for insurance endpoint

      _Status: atomic · Priority: high · Tier: D · Traces to: UJ-11, FR-ONB-1.2.2-002 · Pass: 4_

      _Decomposition rationale:_ Finalizes the integration step by defining the atomic operation of parsing the retrieved data, handing off mapping to sibling FR-ONB-1.2.2-002.

      _Surfaced assumptions:_ A-0549, A-0550, A-0551
  - **FR-ONB-1.2.2-002** `[Tier C · pending]`
    **As a** Business Logic, **I want** Map external payload fields to internal schema fields for ENT-VENDOR-INSURANCE, **so that** External 'policy_active' boolean becomes ENT-VENDOR-INSURANCE.is_active.

    **Acceptance criteria:**
      - **AC-102-02** — Mapping preserves data integrity during transformation
        - _Measurable:_ external_policy_active === internal_is_active AND external_limit === internal_coverage_limit

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-VENDOR-INSURANCE, WF-1 · Pass: 3_

    _Decomposition rationale:_ Ensures external registry data is interpreted correctly by the internal application state model.

    _Surfaced assumptions:_ A-0271, A-0272, A-0273
    - **FR-ONB-1.2.2-002.1** `[Tier D · atomic]`
      **As a** Data Transformer, **I want** Read external 'policy_active' boolean and write to ENT-VENDOR-INSURANCE.is_active, **so that** Internal is_active field reflects current external boolean state.

      **Acceptance criteria:**
        - **AC-001** — Internal is_active equals external policy_active value.
          - _Measurable:_ ENT-VENDOR-INSURANCE.is_active === external_payload.policy_active (boolean equality check)

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-ONB-1.2.2-002 · Pass: 4_

      _Decomposition rationale:_ This is the atomic write action for the status field; cannot be decomposed further without breaking atomicity.

      _Surfaced assumptions:_ A-0552
    - **FR-ONB-1.2.2-002.2** `[Tier D · atomic]`
      **As a** Data Transformer, **I want** Read external 'coverage_limit' and write to ENT-VENDOR-INSURANCE.coverage_limit, **so that** Internal coverage_limit field contains the parsed external limit value.

      **Acceptance criteria:**
        - **AC-002** — Internal coverage_limit matches external limit value.
          - _Measurable:_ ENT-VENDOR-INSURANCE.coverage_limit === parsed(external_payload.coverage_limit)

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-ONB-1.2.2-002 · Pass: 4_

      _Decomposition rationale:_ This is the atomic write action for the limit field; cannot be decomposed further without breaking atomicity.

      _Surfaced assumptions:_ A-0552
    - **FR-ONB-1.2.2-002.3** `[Tier C · pending]`
      **As a** Validator, **I want** Verify mapping integrity before persistence, **so that** Ensure debits/credits (or status/limit) are consistent with external payload.

      **Acceptance criteria:**
        - **AC-003** — External source and internal target are consistent.
          - _Measurable:_ (external_policy_active === internal_is_active) AND (external_limit === internal_coverage_limit)

      _Status: pending · Priority: high · Tier: C · Traces to: FR-ONB-1.2.2-002 · Pass: 4_

      _Decomposition rationale:_ This child implements the verification logic (AC-102-02) from the parent, representing the policy choice of validation.

      _Surfaced assumptions:_ A-0552
  - **FR-ONB-1.2.2-003** `[Tier D · atomic]`
    **As a** Persistence Layer, **I want** Persist validated insurance status to ENT-VENDOR-INSURANCE record, **so that** ENT-VENDOR-INSURANCE.is_active reflects current registry state.

    **Acceptance criteria:**
      - **AC-102-03** — Record update reflects valid query results
        - _Measurable:_ ENT-VENDOR-INSURANCE.is_active === true AND ENT-VENDOR-INSURANCE.coverage_limit > 0

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-VENDOR-INSURANCE, WF-1, UJ-11 · Pass: 3_

    _Decomposition rationale:_ This is the terminal leaf operation for the data update; once the record is persisted, the system state is correct per AC-102-INS.

    _Surfaced assumptions:_ A-0271, A-0272, A-0273
  - **FR-ONB-1.2.2-004** `[Tier C · pending]`
    **As a** Error Handling, **I want** Handle registry unavailability or timeout by deferring vendor activation, **so that** Vendor activation blocked until successful status check.

    **Acceptance criteria:**
      - **AC-102-04** — Activation blocked if registry check fails without successful fallback
        - _Measurable:_ vendor_activation_status === 'pending_verification' if registry_call_failed AND retries_exhausted

    _Status: pending · Priority: high · Tier: C · Traces to: WF-1, UJ-11 · Pass: 3_

    _Decomposition rationale:_ Defines the boundary condition where the onboarding flow must halt or transition to a failure state.

    _Surfaced assumptions:_ A-0271, A-0272, A-0273
    - **FR-ONB-1.2.2-004.1** `[Tier D · atomic]`
      **As a** State Transition Handler, **I want** Update vendor activation status to 'pending_verification' upon confirmed registry failure, **so that** Vendor activation flow halts until status reverts to 'active' via successful registry call.

      **Acceptance criteria:**
        - **AC-001** — Status field set to 'pending_verification' atomically.
          - _Measurable:_ ENT-VENDOR.activation_status === 'pending_verification' immediately after failure condition evaluates to true

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-1, UJ-11, FR-ONB-1.2.2-003 · Pass: 4_

      _Decomposition rationale:_ Defines the primary state change action; corresponds to the 'activation blocked' requirement without the conditional logic.

      _Surfaced assumptions:_ A-0553, A-0554
    - **FR-ONB-1.2.2-004.2** `[Tier D · atomic]`
      **As a** Audit Logger, **I want** Record failure event to the system audit trail, **so that** Trace of registry failure and retry attempt count is persisted for compliance and debugging.

      **Acceptance criteria:**
        - **AC-002** — Audit entry created for each failed registration attempt.
          - _Measurable:_ ENT-AUDIT-LOG contains an entry with 'event_type' === 'registry_failure' and timestamp within 1 second of failure

      _Status: atomic · Priority: high · Tier: D · Traces to: WF-1, UJ-11, ENT-AUDIT-LOG · Pass: 4_

      _Decomposition rationale:_ Ensures auditability and debugging capability required by enterprise compliance standards for onboarding failures.

      _Surfaced assumptions:_ A-0553, A-0554
    - **FR-ONB-1.2.2-004.3** `[Tier D · atomic]`
      **As a** Retry Condition Enforcer, **I want** Evaluate and decrement retry counter on every failed attempt, **so that** System stops retrying and blocks activation when maximum retry threshold is reached.

      **Acceptance criteria:**
        - **AC-003** — Retry counter decremented and checked against maximum threshold per failure.
          - _Measurable:_ vendor_retry_count < max_retry_attempts evaluates to false when retries_exhausted is true

      _Status: atomic · Priority: high · Tier: D · Traces to: WF-1, UJ-11, ENT-VENDOR · Pass: 4_

      _Decomposition rationale:_ Implements the 'retries_exhausted' condition from the parent AC to prevent infinite loop failures on registry side errors.

      _Surfaced assumptions:_ A-0553, A-0554
##### FR-ONB-1.2.4 `[Tier C · pending]`

**As a** CAM operator, **I want** Apply expiry grace period thresholds for flagging, **so that** System flags vendor for review if license expires within configured threshold window.

**Acceptance criteria:**
  - **AC-104-GRA** — Flag is triggered when expiry date is within grace window
    - _Measurable:_ if (current_date + grace_period < ENT-VENDOR-LICENSE.expiry_date) then trigger_alert() == true

_Status: pending · Priority: high · Tier: C · Traces to: WF-1, ENT-COMPLIANCE-EVENT, ENT-RISK-ALERT · Pass: 2_

_Decomposition rationale:_ Specific implementation commitment regarding how 'prior to activation' is defined (grace period). This converts the AC 'expiration is detected' into a concrete algorithmic choice.

_Surfaced assumptions:_ A-0121, A-0122

  - **FR-ONB-1.2.4.1** `[Tier C · pending]`
    **As a** System, **I want** Configure grace period threshold, **so that** Threshold value persisted.

    **Acceptance criteria:**
      - **AC-104-GRA-1** — Grace period threshold is stored in configuration store
        - _Measurable:_ threshold_value !== null

    _Status: pending · Priority: high · Tier: C · Traces to: WF-5 · Pass: 3_

    _Decomposition rationale:_ Configuration is a policy choice, distinct from execution.

    _Surfaced assumptions:_ A-0274, A-0275, A-0276
    - **FR-ONB-1.2.4.1.1** `[Tier C · pending]`
      **As a** Input constraint, **I want** Validate grace period threshold value against business rules, **so that** Rejected values prevent configuration update.

      **Acceptance criteria:**
        - **AC-104-GRA-1.1** — Threshold value must be positive integer.
          - _Measurable:_ threshold_value > 0 AND threshold_value <= MAX_DAYS_FOR_CONFIG

      _Status: pending · Priority: high · Tier: C · Traces to: WF-5 · Pass: 4_

      _Decomposition rationale:_ Validating the input is a necessary implementation commitment before persistence; binds the value to system limits.

      _Surfaced assumptions:_ A-0555, A-0556, A-0557
    - **FR-ONB-1.2.4.1.2** `[Tier D · atomic]`
      **As a** Persistence operation, **I want** Persist threshold value to system configuration store, **so that** Config row updated with new threshold_value.

      **Acceptance criteria:**
        - **AC-104-GRA-1.2** — Threshold is readable from config store immediately.
          - _Measurable:_ SELECT threshold_value FROM config_store WHERE key='grace_period' AND value = <new_value> succeeds

      _Status: atomic · Priority: critical · Tier: D · Traces to: WF-5 · Pass: 4_

      _Decomposition rationale:_ Persistence is the terminal atomic action required to materialize the configuration decision.

      _Surfaced assumptions:_ A-0555, A-0556, A-0557
    - **FR-ONB-1.2.4.1.3** `[Tier B · pending]`
      **As a** Scope commitment, **I want** Define applicability of threshold to existing vs new entities, **so that** Threshold applies to target compliance events only.

      **Acceptance criteria:**
        - **AC-104-GRA-1.3** — Config change triggers re-evaluation only for defined scope.
          - _Measurable:_ Existing vendor records excluded from re-calculation OR New records included automatically

      _Status: pending · Priority: high · Tier: B · Traces to: WF-5, FR-ONB-1.2.4.2 · Pass: 4_

      _Decomposition rationale:_ This is a policy choice (what entities are affected by the threshold) that dictates downstream workflow behavior.

      _Surfaced assumptions:_ A-0555, A-0556, A-0557
  - **FR-ONB-1.2.4.2** `[Tier D · atomic]`
    **As a** System, **I want** Evaluate license expiry logic, **so that** Risk status evaluated.

    **Acceptance criteria:**
      - **AC-104-GRA-2** — License expiry date is compared against current date plus grace period
        - _Measurable:_ date_diff <= grace_period

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-VENDOR-LICENSE · Pass: 3_

    _Decomposition rationale:_ Comparison is an atomic calculation step.

    _Surfaced assumptions:_ A-0274, A-0275, A-0276
  - **FR-ONB-1.2.4.3** `[Tier D · atomic]`
    **As a** System, **I want** Create compliance alert record, **so that** Alert record created.

    **Acceptance criteria:**
      - **AC-104-GRA-3** — Risk alert entity is created upon flag condition met
        - _Measurable:_ alert_entity_created_at !== null

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-RISK-ALERT, ENT-COMPLIANCE-EVENT · Pass: 3_

    _Decomposition rationale:_ Alert creation is a data mutation operation.

    _Surfaced assumptions:_ A-0274, A-0275, A-0276
##### FR-ONB-1.2.5 `[Tier C · pending]`

**As a** CAM operator, **I want** Create compliance event record upon verification failure, **so that** System creates immutable record of failed external check in compliance event log.

**Acceptance criteria:**
  - **AC-105-FIL** — Compliance event is persisted with timestamp and failure reason
    - _Measurable:_ ENT-COMPLIANCE-EVENT.created_at === current_timestamp AND ENT-COMPLIANCE-EVENT.status === 'failed'

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-11, WF-1, ENT-COMPLIANCE-EVENT · Pass: 2_

_Decomposition rationale:_ Defines the atomic action for handling a failed verification result. This is a testable implementation choice regarding state management and audit.

_Surfaced assumptions:_ A-0121, A-0122

  - **FR-ONB-1.2.5.C-1** `[Tier B · pending]`
    **As a** Architect, **I want** Enforce immutability of the compliance event record, **so that** Event record cannot be edited or deleted after creation.

    **Acceptance criteria:**
      - **AC-105-FIL-B1** — Event record is stored in an append-only log structure or has an immutable flag set.
        - _Measurable:_ ENT-COMPLIANCE-EVENT.is_immutable === true OR database triggers prevent UPDATE/DELETE

    _Status: pending · Priority: critical · Tier: B · Traces to: ENT-COMPLIANCE-EVENT · Pass: 3_

    _Decomposition rationale:_ Immutability is an architectural choice with downstream consequences for audit trails; it is not merely an implementation detail but a structural constraint on the storage layer.

    _Surfaced assumptions:_ A-0277, A-0278
  - **FR-ONB-1.2.5.C-2** `[Tier C · pending]`
    **As a** Developer, **I want** Define mandatory schema fields for the compliance event, **so that** Event record contains timestamp, status, and reason fields.

    **Acceptance criteria:**
      - **AC-105-FIL-C1** — Event record contains timestamp and status at creation.
        - _Measurable:_ ENT-COMPLIANCE-EVENT.created_at === current_timestamp AND ENT-COMPLIANCE-EVENT.status === 'failed'

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-COMPLIANCE-EVENT · Pass: 3_

    _Decomposition rationale:_ These fields define the implementation commitment for the data model required to meet the parent AC; they are concrete, individually-decidable choices.

    _Surfaced assumptions:_ A-0277, A-0278
    - **FR-ONB-1.2.5.C-2.1** `[Tier C · pending]`
      **As a** Database Engineer, **I want** Enforce `created_at` field behavior, **so that** Timestamp recorded automatically at row insertion.

      **Acceptance criteria:**
        - **AC-105-FIL-C2-001** — Timestamp defaults to current system time on insert
          - _Measurable:_ inserted_row.created_at === current_timestamp_utc()

      _Status: pending · Priority: critical · Tier: C · Traces to: FR-ONB-1.2.5.C-2, ENT-COMPLIANCE-EVENT · Pass: 4_

      _Decomposition rationale:_ Splits the schema requirement into specific field constraints; timestamp is the first critical field for audit trails.

      _Surfaced assumptions:_ A-0558, A-0559, A-0560
    - **FR-ONB-1.2.5.C-2.2** `[Tier C · pending]`
      **As a** Database Engineer, **I want** Enforce `status` field behavior, **so that** Status field accepts valid compliance states.

      **Acceptance criteria:**
        - **AC-105-FIL-C2-002** — Status column validates against predefined enum values
          - _Measurable:_ row.status IN ('pending', 'active', 'failed', 'completed')

      _Status: pending · Priority: critical · Tier: C · Traces to: FR-ONB-1.2.5.C-2, ENT-COMPLIANCE-EVENT · Pass: 4_

      _Decomposition rationale:_ Separates status logic from timestamp/reason logic; status defines the compliance state lifecycle.

      _Surfaced assumptions:_ A-0558, A-0559, A-0560
    - **FR-ONB-1.2.5.C-2.3** `[Tier C · pending]`
      **As a** Database Engineer, **I want** Enforce `reason` field behavior, **so that** Reason field populated on failure events.

      **Acceptance criteria:**
        - **AC-105-FIL-C2-003** — Reason field is not null when status is failed
          - _Measurable:_ row.reason IS NOT NULL WHEN status = 'failed'

      _Status: pending · Priority: critical · Tier: C · Traces to: FR-ONB-1.2.5.C-2, FR-ONB-1.2.5.C-3 · Pass: 4_

      _Decomposition rationale:_ Links schema definition to extraction workflow defined in sibling C-3 while maintaining the mandatory field requirement.

      _Surfaced assumptions:_ A-0558, A-0559, A-0560
  - **FR-ONB-1.2.5.C-3** `[Tier C · pending]`
    **As a** Developer, **I want** Extract failure reason from workflow or external response, **so that** Event record contains a populated failure reason string.

    **Acceptance criteria:**
      - **AC-105-FIL-C2** — Failure reason is not null and describes the cause of the failed check.
        - _Measurable:_ ENT-COMPLIANCE-EVENT.failure_reason IS NOT NULL AND length(ENT-COMPLIANCE-EVENT.failure_reason) > 0

    _Status: pending · Priority: high · Tier: C · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ The logic for populating the 'failure reason' field is an implementation choice regarding data mapping from the external verification workflow.

    _Surfaced assumptions:_ A-0277, A-0278
    - **FR-ONB-1.2.5.C-3.1** `[Tier D · atomic]`
      **As a** Data extraction agent, **I want** Read failure message from Workflow execution log, **so that** Failure reason string populated from WF-1 state.

      **Acceptance criteria:**
        - **AC-105-FIL-C2-A** — If WF-1 failed, extract message from log.
          - _Measurable:_ reason_str === wf_execution_state.failure_message

      _Status: atomic · Priority: high · Tier: D · Traces to: WF-1 · Pass: 4_

      _Decomposition rationale:_ Commits to Workflow logs as the primary source for failure diagnostics.

      _Surfaced assumptions:_ A-0561, A-0562, A-0563
    - **FR-ONB-1.2.5.C-3.2** `[Tier D · atomic]`
      **As a** Data extraction agent, **I want** Read failure message from External API response, **so that** Failure reason string populated from external vendor check result.

      **Acceptance criteria:**
        - **AC-105-FIL-C2-B** — If external check fails, extract reason from response body.
          - _Measurable:_ reason_str === response.body.error.message

      _Status: atomic · Priority: high · Tier: D · Traces to: WF-1, FR-ONB-1.2.5.C-2 · Pass: 4_

      _Decomposition rationale:_ Commits to External API response as a fallback source for failure diagnostics, tied to schema definition.

      _Surfaced assumptions:_ A-0561, A-0562, A-0563
    - **FR-ONB-1.2.5.C-3.3** `[Tier D · atomic]`
      **As a** Data transformation agent, **I want** Normalize and persist failure reason string, **so that** Failure reason stored in ENT-COMPLIANCE-EVENT.failure_reason field.

      **Acceptance criteria:**
        - **AC-105-FIL-C2-C** — Persisted reason must be trimmed and null-checked.
          - _Measurable:_ db.update('ENT-COMPLIANCE-EVENT', {failure_reason}, {status: 'updated'})

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-ONB-1.2.5.C-2 · Pass: 4_

      _Decomposition rationale:_ Commits to the persistence operation required by the schema definition in sibling C-2.

      _Surfaced assumptions:_ A-0561, A-0562, A-0563
##### FR-ONB-1.2.3 `[downgraded]`

**As a** Architect, **I want** Integrate with external state/provincial license registries, **so that** System establishes connection to approved external API endpoints for validation.

**Acceptance criteria:**
  - **AC-103-REG** — External registry connection string is configured and reachable
    - _Measurable:_ System configuration contains valid endpoint URL and authentication token for external registry

_Status: downgraded · Priority: high · Traces to: WF-1, ENT-COMPLIANCE-REQ · Pass: 3_

  - **FR-ONB-1.2.3-C1** `[Tier B · pending]`
    **As a** Scope Policy, **I want** Restrict integration to pre-approved registry allowlists, **so that** System rejects calls to unauthorized registry endpoints.

    **Acceptance criteria:**
      - **AC-001** — Registry domain matches allowlist.
        - _Measurable:_ registry.url IN (SELECT allowed_url FROM registry_config)

    _Status: pending · Priority: high · Tier: B · Traces to: ENT-COMPLIANCE-REQ · Pass: 3_

    _Decomposition rationale:_ Defines the boundary of external integration; prevents scope creep to unofficial registries.

    _Surfaced assumptions:_ A-0361, A-0362, A-0363
  - **FR-ONB-1.2.3-C2** `[Tier C · pending]`
    **As a** Security Implementation, **I want** Encrypt registry credentials at rest in database, **so that** Stored tokens are unreadable without decryption key.

    **Acceptance criteria:**
      - **AC-002** — Credential column uses AES-256 encryption.
        - _Measurable:_ cryptographic_algorithm(credential_column) = 'AES-256'

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-2 · Pass: 3_

    _Decomposition rationale:_ Enforces security constraints for sensitive connection parameters; binds to Cloudflare TLS proxy requirement.

    _Surfaced assumptions:_ A-0361, A-0362, A-0363
  - **FR-ONB-1.2.3-C3** `[Tier C · pending]`
    **As a** Engineering Strategy, **I want** Implement retry logic for transient registry unreachability, **so that** Temporary outages do not trigger vendor verification failure.

    **Acceptance criteria:**
      - **AC-003** — Request retries up to 3 times before failure.
        - _Measurable:_ retry_count === 3 if status_code IN (408, 503, 504) before marking failure

    _Status: pending · Priority: medium · Tier: C · Traces to: WF-1 · Pass: 3_

    _Decomposition rationale:_ Ensures reliability of onboarding workflow; decouples transient network issues from business logic.

    _Surfaced assumptions:_ A-0361, A-0362, A-0363
  - **FR-ONB-1.2.3-C4** `[Tier D · atomic]`
    **As a** Audit Leaf, **I want** Log connection attempt result to audit table, **so that** Audit record created for every connect/disconnect event.

    **Acceptance criteria:**
      - **AC-004** — Entry exists in audit log within 500ms.
        - _Measurable:_ audit_log.created_at >= connect_attempt.timestamp AND audit_log.status IN ('success', 'failed')

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-AUDIT-LOG · Pass: 3_

    _Decomposition rationale:_ Provides immutable trail for compliance events; satisfies VOC-17 W-9/1099 data retention needs.

    _Surfaced assumptions:_ A-0361, A-0362, A-0363
#### FR-ONB-1.3 `[Tier A · pending]`

**As a** functional sub-area, **I want** Transition vendor account status to 'Active' and enable work order access, **so that** Vendor is visible in vendor list and can receive assignments.

**Acceptance criteria:**
  - **AC-103** — Vendor record status updates to Active after vetting workflow completion
    - _Measurable:_ ENT-VENDOR.status === 'Active' and ENT-VENDOR.disabled === false

_Status: pending · Priority: critical · Tier: A · Traces to: UJ-11, WF-1, ENT-VENDOR · Pass: 1_

_Decomposition rationale:_ Maps the 'Account active' acceptance criteria to a specific state transition sub-area within the onboarding lifecycle.

_Surfaced assumptions:_ A-0032, A-0033, A-0034, A-0035

##### FR-ONB-1.3.C1 `[Tier B · pending]`

**As a** Scope commitment, **I want** Define the trigger condition for status transition, **so that** Vendor status updates automatically upon WF-1 workflow signal.

**Acceptance criteria:**
  - **AC-103.1** — Status transition occurs only when WF-1 completes.
    - _Measurable:_ Event 'WF-1_completed' must exist in event_store before ENT-VENDOR.status update transaction

_Status: pending · Priority: critical · Tier: B · Traces to: WF-1, ENT-VENDOR · Pass: 2_

_Decomposition rationale:_ Establishes the architectural choice that the transition is event-driven, preventing manual overrides or stale status updates.

_Surfaced assumptions:_ A-0123, A-0124, A-0125

  - **FR-ONB-1.3.C1.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** consume WF-1_completed event signal via synchronous processing, **so that** Vendor record status updates within the same request lifecycle as event emission.

    **Acceptance criteria:**
      - **AC-103.1.1** — Status update completes before request response returned if synchronous path used.
        - _Measurable:_ GET /vendor/{id} returns 'Active' status within 1s of WF-1 event emission timestamp

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-1, ENT-VENDOR · Pass: 3_

    _Decomposition rationale:_ Defines the processing pattern (synchronous vs asynchronous) required to satisfy the 'Immediate activation' policy in AC-103.1.

    _Surfaced assumptions:_ A-0364, A-0365, A-0366
  - **FR-ONB-1.3.C1.2** `[Tier C · pending]`
    **As a** CAM operator, **I want** enforce atomic transaction boundary for event consumption and status mutation, **so that** Partial updates (event processed, status not changed) are never persisted.

    **Acceptance criteria:**
      - **AC-103.1.2** — No orphan events exist if status update fails.
        - _Measurable:_ If transaction fails, WF-1_completed event record is rolled back or flagged as processed-but-failed with null status update

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-1, ENT-VENDOR · Pass: 3_

    _Decomposition rationale:_ Binds the system to the invariant that the event store and vendor status must be updated within a single durability boundary.

    _Surfaced assumptions:_ A-0364, A-0365, A-0366
  - **FR-ONB-1.3.C1.3** `[Tier C · pending]`
    **As a** CAM operator, **I want** write specific status enum value 'Active' to ENT-VENDOR.status, **so that** Database column status holds literal string 'Active' immediately after trigger.

    **Acceptance criteria:**
      - **AC-103.1.3** — Status field value matches trigger signal intent.
        - _Measurable:_ ENT-VENDOR.status equals 'Active' exactly following 'WF-1_completed' event processing

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-1, ENT-VENDOR · Pass: 3_

    _Decomposition rationale:_ Concrete implementation of the 'Active' status commitment implied by 'Immediate activation' in existing assumption [A-0034].

    _Surfaced assumptions:_ A-0364, A-0365, A-0366
##### FR-ONB-1.3.C2 `[Tier B · pending]`

**As a** Scope commitment, **I want** Define visibility eligibility policy, **so that** Vendor record is returned in vendor list only if status is Active.

**Acceptance criteria:**
  - **AC-103.2** — List query filters on ENT-VENDOR.status field
    - _Measurable:_ SELECT * FROM ENT-VENDOR WHERE status = 'Active' AND disabled = false

_Status: pending · Priority: critical · Tier: B · Traces to: ENT-VENDOR, UJ-11 · Pass: 2_

_Decomposition rationale:_ Binds the 'visible in vendor list' requirement to a specific database predicate and data state constraint.

_Surfaced assumptions:_ A-0123, A-0124, A-0125

  - **FR-ONB-1.3.C2.1** `[Tier C · pending]`
    **As a** Implementation Commitment, **I want** Enforce active status filter on ENT-VENDOR status column, **so that** Vendor records with status other than 'Active' are excluded from the list.

    **Acceptance criteria:**
      - **AC-001** — Returned vendor status must equal 'Active'.
        - _Measurable:_ SELECT status FROM ENT-VENDOR WHERE id IN (SELECT id FROM returned_vendors) = 'Active'

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-11 · Pass: 3_

    _Decomposition rationale:_ The core eligibility rule requires status to be 'Active'; this commits to the specific value validation logic.

    _Surfaced assumptions:_ A-0367
  - **FR-ONB-1.3.C2.2** `[Tier C · pending]`
    **As a** Implementation Commitment, **I want** Enforce disabled flag filter on ENT-VENDOR disabled column, **so that** Vendor records with disabled=true are excluded from the list.

    **Acceptance criteria:**
      - **AC-002** — Returned vendor disabled flag must be false.
        - _Measurable:_ SELECT disabled FROM ENT-VENDOR WHERE id IN (SELECT id FROM returned_vendors) = false

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-11 · Pass: 3_

    _Decomposition rationale:_ The eligibility rule explicitly includes the disabled flag condition alongside status, committing to this secondary filter.

    _Surfaced assumptions:_ A-0367
  - **FR-ONB-1.3.C2.3** `[Tier C · pending]`
    **As a** Implementation Commitment, **I want** Execute SQL query for vendor list retrieval, **so that** List query is constructed using direct SQL SELECT with filters applied at database level.

    **Acceptance criteria:**
      - **AC-003** — Query result matches the filter criteria exactly.
        - _Measurable:_ query_result.count = (SELECT count(*) FROM ENT-VENDOR WHERE status = 'Active' AND disabled = false)

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-11 · Pass: 3_

    _Decomposition rationale:_ Commits to the database-level implementation of the policy, excluding application-layer filtering.

    _Surfaced assumptions:_ A-0367
##### FR-ONB-1.3.C3 `[downgraded]`

**As a** Scope commitment, **I want** Define assignment eligibility policy, **so that** Vendor can receive work order assignments only if Active.

**Acceptance criteria:**
  - **AC-103.3** — Assignment logic validates vendor status
    - _Measurable:_ WF-10 dispatch logic rejects assignment if ENT-VENDOR.status != 'Active'

_Status: downgraded · Priority: high · Traces to: WF-10, ENT-VENDOR · Pass: 3_

  - **FR-ONB-1.3.C3.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Perform real-time status validation on incoming assignment requests, **so that** Assignment request fails if vendor status is not Active.

    **Acceptance criteria:**
      - **AC-001** — Dispatch workflow rejects assignment if status check fails.
        - _Measurable:_ reject if ENT-VENDOR.status != 'Active'

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-10, ENT-VENDOR · Pass: 3_

    _Decomposition rationale:_ Direct implementation of the core eligibility logic requirement.

    _Surfaced assumptions:_ A-0368, A-0369
  - **FR-ONB-1.3.C3.2** `[Tier B · pending]`
    **As a** Architect, **I want** Define policy scope to include all external vendor entities, **so that** Policy applies to every vendor record not marked as Internal.

    **Acceptance criteria:**
      - **AC-002** — Assignment check runs for all external vendors.
        - _Measurable:_ scope == {v | v in ENT-VENDOR AND v.type != 'Internal'}

    _Status: pending · Priority: high · Tier: B · Traces to: ENT-VENDOR · Pass: 3_

    _Decomposition rationale:_ Commits to the breadth of the policy scope.

    _Surfaced assumptions:_ A-0368, A-0369
  - **FR-ONB-1.3.C3.3** `[Tier B · pending]`
    **As a** Compliance Officer, **I want** Derive Active status from license/insurance validity per compliance scope, **so that** Vendor cannot receive assignments if license/insurance is lapsed.

    **Acceptance criteria:**
      - **AC-003** — Active status is considered false if license/insurance expired.
        - _Measurable:_ ENT-VENDOR-LICENSE.expiration_date > CURRENT_DATE AND ENT-VENDOR-INSURANCE.active == true

    _Status: pending · Priority: critical · Tier: B · Traces to: ENT-VENDOR, ENT-VENDOR-LICENSE, ENT-VENDOR-INSURANCE · Pass: 3_

    _Decomposition rationale:_ Aligns assignment eligibility with compliance verification requirements A-0035 and COMP-5.

    _Surfaced assumptions:_ A-0368, A-0369
  - **FR-ONB-1.3.C3.4** `[Tier C · pending]`
    **As a** CAM operator, **I want** Log assignment rejection event with specific reason code, **so that** System creates audit record for blocked assignment.

    **Acceptance criteria:**
      - **AC-004** — Audit entry records rejection and vendor ID.
        - _Measurable:_ log_entry.reason == 'INACTIVE_STATUS'

    _Status: pending · Priority: medium · Tier: C · Traces to: ENT-AUDIT-LOG · Pass: 3_

    _Decomposition rationale:_ Enables observability and debugging for assignment failures.

    _Surfaced assumptions:_ A-0368, A-0369
### Release 3: Community Association Governance & Finance (4 roots)
*This final phase introduces advanced functionality tailored for community associations. It enables association managers to process resident maintenance requests, board members to review budgets, vote on actions, and access essential association documents. Additionally, it streamlines financial operations by allowing association managers to reconcile resident dues, providing a comprehensive solution for HOA governance and financial management within the Hestami ecosystem.*

### FR US-006 `[pending]`

**As a** Association Manager, **I want** Assign Resident to Common Area Amenity, **so that** Job is queued for vendor service and ledger is updated.

**Acceptance criteria:**
  - **AC-011** — Amenity request routed
    - _Measurable:_ System assigns Vendor and updates ENT-AMENITY-REQ status to 'Pending' within 1 hour
  - **AC-012** — Ledger updated
    - _Measurable:_ Transaction recorded in ENT-LEDGER reflecting amenity usage cost

_Status: pending · Priority: medium · Traces to: UJ-6, VOC-15, ENT-ASSOCIATION, ENT-AMENITY-REQ · Pass: 0_

#### US-006-01 `[Tier C · pending]`

**As a** CAM operator, **I want** Execute Vendor Assignment logic via DBOS workflow, **so that** Vendor profile linked to Amenity Request with status 'Pending' assignment.

**Acceptance criteria:**
  - **AC-V-01** — Selected vendor is active and within service area.
    - _Measurable:_ Vendor.license_expiry_date >= Today AND Vendor.assigned_to_area includes Amenity.location
  - **AC-V-02** — Request status transitions to 'Pending' within 1 hour.
    - _Measurable:_ Timestamp(Amenity_Request.status_change) - Timestamp(Amenity_Request.created) <= 3600 seconds

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-6 · Pass: 1_

_Decomposition rationale:_ Binding the routing logic to specific constraints (service area, license validity) forces downstream verification that the system actually validates these conditions before assignment.

_Surfaced assumptions:_ A-0018, A-0019, A-0020

##### US-006-01-01 `[Tier D · atomic]`

**As a** Validation Operator, **I want** Check Vendor License and Insurance Expiry, **so that** Vendor is marked eligible only if expiry_date is in the future.

**Acceptance criteria:**
  - **AC-V-1** — Vendor license is valid at the time of assignment.
    - _Measurable:_ Vendor.license_expiry_date >= Current_Time()

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-6 · Pass: 2_

_Decomposition rationale:_ Extracts the license expiry check from AC-V-01 to form a leaf verification operation.

_Surfaced assumptions:_ A-0091, A-0092, A-0093

##### US-006-01-02 `[Tier D · atomic]`

**As a** Validation Operator, **I want** Check Service Area Coverage, **so that** Amenity Request is linked only if location is inside Service Area.

**Acceptance criteria:**
  - **AC-V-2** — Vendor service area contains the Amenity location.
    - _Measurable:_ Vendor.assigned_to_area.includes(Amenity.location)

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-6 · Pass: 2_

_Decomposition rationale:_ Extracts the geographic coverage check from AC-V-01 to form a leaf verification operation.

_Surfaced assumptions:_ A-0091, A-0092, A-0093

##### US-006-01-03 `[Tier D · atomic]`

**As a** State Manager, **I want** Transition Amenity Request to Pending, **so that** Request status updates to 'Pending' and timing is logged.

**Acceptance criteria:**
  - **AC-V-3** — Amenity Request status is 'Pending' within time window.
    - _Measurable:_ Status == 'Pending' AND (Current_Time - Request.Created_Time) <= 3600 seconds

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-6 · Pass: 2_

_Decomposition rationale:_ Combines the status update and AC-V-02 timing requirement into a single atomic leaf operation.

_Surfaced assumptions:_ A-0091, A-0092, A-0093

#### US-006-02 `[Tier C · pending]`

**As a** System Designer, **I want** Post Ledger Transaction for Amenity Usage, **so that** ENT-LEDGER entry created recording usage cost charged to Association fund.

**Acceptance criteria:**
  - **AC-L-01** — Debit and Credit balance invariant holds per GL rule.
    - _Measurable:_ SUM(JournalEntry.debits) - SUM(JournalEntry.credits) = 0 FOR the new ledger entry
  - **AC-L-02** — Transaction links to the correct Amenity Usage cost account.
    - _Measurable:_ LedgerEntry.account_id IN (SELECT id FROM ChartOfAccounts WHERE name='Amenity_Usage_Cost')

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-6, US-004 · Pass: 1_

_Decomposition rationale:_ Distinguishes the financial recording path from the operational routing path; verifies accounting compliance (GAAP/Assessment) separately from the operational workflow.

_Surfaced assumptions:_ A-0018, A-0019, A-0020

##### FR-FIN-1.1 `[Tier C · pending]`

**As a** Financial Logic, **I want** Calculate Amenity Usage Cost Amount, **so that** Determination of the monetary value to be debited from the Association fund.

**Acceptance criteria:**
  - **AC-001** — The cost amount matches the calculated usage metric times the unit rate.
    - _Measurable:_ entry.amount == (entry.usage_quantity * config.unit_cost) for the current association

_Status: pending · Priority: critical · Tier: C · Traces to: US-006-02 · Pass: 2_

_Decomposition rationale:_ Before an entry can be persisted, the system must derive the specific cost value from configuration and usage data; this is a concrete implementation logic step.

_Surfaced assumptions:_ A-0094, A-0095, A-0096

  - **FR-FIN-1.1.1** `[Tier C · pending]`
    **As a** Data Source Reader, **I want** Retrieve usage_quantity from ENT-AMENITY-REQ, **so that** Obtain quantity metrics associated with the Amenity Request.

    **Acceptance criteria:**
      - **AC-101** — Usage quantity is retrieved from the Amenity Request record.
        - _Measurable:_ request.usage_quantity is populated and non-null for the given Amenity Request ID

    _Status: pending · Priority: high · Tier: C · Traces to: FR-FIN-1.3 · Pass: 3_

    _Decomposition rationale:_ Decomposes the calculation into its input requirements; feeds the JE insertion step.

    _Surfaced assumptions:_ A-0243, A-0244
    - **FR-FIN-1.1.1** `[Tier D · atomic]`
      **As a** Data Source Reader, **I want** retrieve usage_quantity from ENT-AMENITY-REQ, **so that** Usage quantity is populated and non-null.

      **Acceptance criteria:**
        - **AC-101** — Usage quantity is retrieved from the Amenity Request record. (request.usage_quantity is populated and non-null for the given Amenity Request ID)
          - _Measurable:_ request.usage_quantity !== null

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-FIN-1.3 · Pass: 4_

      _Decomposition rationale:_ This requirement is an atomic leaf operation; further decomposition is unnecessary.
  - **FR-FIN-1.1.2** `[Tier C · pending]`
    **As a** Configuration Reader, **I want** Retrieve unit_cost from Pricebook Configuration, **so that** Obtain valid unit rate for the specific Amenity Type.

    **Acceptance criteria:**
      - **AC-102** — Unit cost is retrieved and validated against active pricebook.
        - _Measurable:_ pricebook.unit_cost > 0 AND pricebook.is_active === true at request creation date

    _Status: pending · Priority: high · Tier: C · Traces to: FR-FIN-1.3 · Pass: 3_

    _Decomposition rationale:_ Decomposes the calculation into its configuration requirements; ensures rate validity before application.

    _Surfaced assumptions:_ A-0243, A-0244
    - **FR-FIN-1.1.2.1** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Resolve Amenity Type string to Pricebook Entry ID, **so that** The Amenity Type is mapped to a unique Pricebook Entry identifier.

      **Acceptance criteria:**
        - **AC-001** — Amenity Type string matches a registered Pricebook Entry Key.
          - _Measurable:_ PricebookEntry.Key === AmenityRequest.AmenityType for valid mapping in Pricebook table

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-FIN-1.1.1 · Pass: 4_

      _Decomposition rationale:_ Before fetching the cost, the system must resolve the semantic Amenity Type string to a database key. This is a prerequisite leaf operation for the retrieval.

      _Surfaced assumptions:_ A-0512, A-0513
    - **FR-FIN-1.1.2.2** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Fetch and validate Pricebook Record, **so that** Pricebook record with active status and positive cost is loaded.

      **Acceptance criteria:**
        - **AC-002** — Pricebook record is active and cost is positive at request time.
          - _Measurable:_ PricebookEntry.is_active === true AND PricebookEntry.unit_cost > 0 AND request_timestamp <= PricebookEntry.valid_from_date

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-FIN-1.1.3 · Pass: 4_

      _Decomposition rationale:_ The core retrieval step involves both reading the record and verifying its validity constraints against the request timestamp.

      _Surfaced assumptions:_ A-0512, A-0513
    - **FR-FIN-1.1.2.3** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Return Unit Cost Value, **so that** Unit cost value is populated in the response payload.

      **Acceptance criteria:**
        - **AC-003** — Return value matches the validated Pricebook Entry unit_cost.
          - _Measurable:_ Response.unit_cost === PricebookEntry.unit_cost

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-FIN-1.1.3 · Pass: 4_

      _Decomposition rationale:_ The final leaf operation is populating the variable used for the Gross Amount calculation in the sibling requirement.

      _Surfaced assumptions:_ A-0512, A-0513
  - **FR-FIN-1.1.3** `[Tier D · atomic]`
    **As a** Arithmetic Engine, **I want** Compute Gross Amount, **so that** Calculate raw financial value prior to rounding.

    **Acceptance criteria:**
      - **AC-103** — Gross amount equals usage quantity times unit cost.
        - _Measurable:_ calculated_gross === usage_quantity * unit_cost

    _Status: atomic · Priority: critical · Tier: D · Traces to: FR-FIN-1.3, FR-FIN-1.4 · Pass: 3_

    _Decomposition rationale:_ Terminal arithmetic operation; defines the precise mathematical invariant before persistence.

    _Surfaced assumptions:_ A-0243, A-0244
  - **FR-FIN-1.1.4** `[Tier D · atomic]`
    **As a** Financial Formatter, **I want** Apply Currency Rounding, **so that** Round amount to two decimal places in base currency.

    **Acceptance criteria:**
      - **AC-104** — Final amount is rounded to 2 decimal places using half-up method.
        - _Measurable:_ abs(final_amount - round(calculated_gross, 2)) === 0 AND currency_digits <= 2

    _Status: atomic · Priority: critical · Tier: D · Traces to: FR-FIN-1.3 · Pass: 3_

    _Decomposition rationale:_ Leaf operation for currency precision; ensures financial data integrity for the ledger insert.

    _Surfaced assumptions:_ A-0243, A-0244
##### FR-FIN-1.2 `[Tier C · pending]`

**As a** Accounting Mapping, **I want** Map Event to Chart of Accounts ID, **so that** Selection of the correct GL account ID for the debit side.

**Acceptance criteria:**
  - **AC-002** — The account ID corresponds to the Amenity Usage Cost account.
    - _Measurable:_ entry.account_id == 'Amenity_Usage_Cost' from ChartOfAccounts

_Status: pending · Priority: critical · Tier: C · Traces to: US-006-02 · Pass: 2_

_Decomposition rationale:_ AC-L-02 mandates a specific account mapping; this child binds that policy choice into a concrete lookup operation.

_Surfaced assumptions:_ A-0094, A-0095, A-0096

  - **FR-FIN-1.2-C01** `[Tier C · pending]`
    **As a** CAM operator, **I want** Identify Amenity Usage Event from incoming Work Order, **so that** Event is classified as an Amenity Usage type requiring a debit mapping.

    **Acceptance criteria:**
      - **AC-002-1** — Incoming work order has an Amenity type attribute.
        - _Measurable:_ work_order.type == 'Amenity_Usage' AND work_order.type IS NOT NULL

    _Status: pending · Priority: critical · Tier: C · Traces to: US-006-02 · Pass: 3_

    _Decomposition rationale:_ The mapping logic requires identifying the nature of the event first to determine if the specific Amenity Usage Cost account mapping applies.

    _Surfaced assumptions:_ A-0245
    - **FR-FIN-1.2-C01-01** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Classify incoming Work Order as Amenity Usage Event, **so that** Event is flagged for debit mapping downstream.

      **Acceptance criteria:**
        - **AC-003-01** — Work Order is classified if type is Amenity_Usage and not null.
          - _Measurable:_ work_order.type === 'Amenity_Usage' AND work_order.type !== null

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-006-02, FR-FIN-1.2-C02 · Pass: 4_

      _Decomposition rationale:_ The classification logic is a single atomic verification step. Further decomposition into sub-conditions (e.g. Null Check vs Value Check) would not add value as they are part of the same atomic check in the data model. This child is the terminal node for the identification commitment.

      _Surfaced assumptions:_ A-0514
  - **FR-FIN-1.2-C02** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Map Event to Account ID, **so that** Entry account_id is set to 'Amenity_Usage_Cost'.

    **Acceptance criteria:**
      - **AC-002-2** — The selected account matches the system definition for Amenity Usage Cost.
        - _Measurable:_ entry.account_id == 'Amenity_Usage_Cost' AND 'Amenity_Usage_Cost' IN (SELECT account_id FROM ChartOfAccounts)

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-006-02 · Pass: 3_

    _Decomposition rationale:_ Once the event type is identified, the system commits to the specific account ID as the atomic implementation step.

    _Surfaced assumptions:_ A-0245
##### FR-FIN-1.3 `[Tier D · atomic]`

**As a** Persistence Operation, **I want** Insert Journal Entry Record, **so that** Row added to journal_entries table with calculated values.

**Acceptance criteria:**
  - **AC-003** — The row exists in the journal entries table after commit.
    - _Measurable:_ SELECT * FROM journal_entries WHERE id = new_row_id IS TRUE

_Status: atomic · Priority: critical · Tier: D · Traces to: US-006-02 · Pass: 2_

_Decomposition rationale:_ This is the atomic write operation required to fulfill the parent's goal of creating an entry.

_Surfaced assumptions:_ A-0094, A-0095, A-0096

##### FR-FIN-1.4 `[Tier D · atomic]`

**As a** Validation, **I want** Verify Debit-Credit Balance Invariant, **so that** Guarantee that debits equal credits for the entry.

**Acceptance criteria:**
  - **AC-004** — Sum of debits equals sum of credits for the new entry.
    - _Measurable:_ ABS(SUM(debits) - SUM(credits)) <= epsilon

_Status: atomic · Priority: critical · Tier: D · Traces to: US-006-02 · Pass: 2_

_Decomposition rationale:_ AC-L-01 requires balance verification; this is the leaf operation that executes the check before or during commit.

_Surfaced assumptions:_ A-0094, A-0095, A-0096

#### US-006-03 `[Tier C · pending]`

**As a** CAM operator, **I want** Notify Vendor and Resident of Assignment, **so that** Ent-NOTIFY-TPL sent to Vendor email and Resident portal.

**Acceptance criteria:**
  - **AC-N-01** — Notification delivered to registered contact channels.
    - _Measurable:_ Ent-NOTIFY-LOG.sent_at IS NOT NULL AND Ent-NOTIFY-DELIVERY.status = 'Delivered'

_Status: pending · Priority: high · Tier: C · Traces to: UJ-6 · Pass: 1_

_Decomposition rationale:_ Defines the communication commitment required for the 'Job queued' aspect of the parent, separating notification infrastructure from the core business logic.

_Surfaced assumptions:_ A-0018, A-0019, A-0020

##### US-006-03-01 `[Tier D · atomic]`

**As a** System, **I want** Send Email to Vendor, **so that** Vendor receives notification email via registered channel.

**Acceptance criteria:**
  - **AC-VND-001** — Vendor email delivered successfully
    - _Measurable:_ Ent-NOTIFY-DELIVERY.status = 'Sent' and Ent-NOTIFY-DELIVERY.recipient = Vendor.primary_email

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-6 · Pass: 2_

_Decomposition rationale:_ This child binds the Vendor branch of the notification requirement, separating delivery mechanics from the Resident branch.

_Surfaced assumptions:_ A-0097

##### US-006-03-02 `[Tier D · atomic]`

**As a** System, **I want** Render Message for Resident, **so that** Resident portal displays notification content.

**Acceptance criteria:**
  - **AC-RES-001** — Portal notification record created
    - _Measurable:_ Ent-NOTIFY-LOG.created_at IS NOT NULL AND Ent-NOTIFY-LOG.recipient_role = 'Resident'

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-6 · Pass: 2_

_Decomposition rationale:_ This child binds the Resident branch of the notification requirement, ensuring portal content is generated correctly.

_Surfaced assumptions:_ A-0097

##### US-006-03-03 `[Tier D · atomic]`

**As a** System, **I want** Persist Delivery Audit, **so that** Notification delivery event is recorded in audit log.

**Acceptance criteria:**
  - **AC-AUD-001** — Delivery log entry written to database
    - _Measurable:_ Ent-NOTIFY-LOG.sent_at IS NOT NULL AND Ent-NOTIFY-LOG.status = 'Processed'

_Status: atomic · Priority: high · Tier: D · Traces to: UJ-6 · Pass: 2_

_Decomposition rationale:_ This child binds the 'Ent-NOTIFY-LOG' requirement from the parent AC, ensuring audit compliance for all delivery events.

_Surfaced assumptions:_ A-0097

### FR US-007 `[pending]`

**As a** Board Member, **I want** Cast Vote on Association Resolution, **so that** Vote is recorded and resolution status updates.

**Acceptance criteria:**
  - **AC-013** — Vote recorded
    - _Measurable:_ ENT-VOTE record created immediately upon submission with timestamp
  - **AC-014** — Document accessible
    - _Measurable:_ Board Member can view ENT-VOTING-RES document in read-only mode

_Status: pending · Priority: critical · Traces to: UJ-7, WF-11, ENT-VOTE, ENT-VOTING-RES · Pass: 0_

#### US-007-2 `[Tier C · pending]`

**As a** Persistence Layer, **I want** create ENT-VOTE record atomically with submission, **so that** Vote record persisted with server timestamp immediately upon transaction commit.

**Acceptance criteria:**
  - **AC-013-Impl** — ENT-VOTE record created immediately upon submission
    - _Measurable:_ ENT-VOTE insert succeeds and row exists in DB within <10ms of submission API call

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-7, ENT-VOTE · Pass: 1_

_Decomposition rationale:_ Atomicity of vote creation is an implementation commitment (Tier C) that ensures data integrity and prevents race conditions during the voting process.

_Surfaced assumptions:_ A-0021

#### US-007-3 `[Tier B · pending]`

**As a** Content Server, **I want** enforce read-only access for resolution documents, **so that** User can only read ENT-VOTING-RES content without mutation capability.

**Acceptance criteria:**
  - **AC-014** — Document accessible in read-only mode
    - _Measurable:_ GET request to resolution document returns content; POST/PUT requests return 403 Forbidden

_Status: pending · Priority: high · Tier: B · Traces to: UJ-7, ENT-VOTING-RES · Pass: 1_

_Decomposition rationale:_ Access control model for resolution views is a scope commitment (Tier B) defining the boundary of permitted actions (read-only) versus other permissions.

_Surfaced assumptions:_ A-0021

##### US-007-3.1 `[Tier C · pending]`

**As a** CAM operator, **I want** Reject mutation requests for resolution document endpoints, **so that** No POST, PUT, or DELETE requests to /resolution/... paths are persisted or processed.

**Acceptance criteria:**
  - **AC-001** — Mutation requests return 403 Forbidden.
    - _Measurable:_ HTTP status code === 403 when request.method in ['POST', 'PUT', 'DELETE']
  - **AC-002** — 403 response body does not expose resource existence.
    - _Measurable:_ Response body === 'Forbidden' or 'Unauthorized' for all failed attempts

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-7 · Pass: 2_

_Decomposition rationale:_ Mutation prevention is the core safety constraint derived from the 'read-only' commitment. This child commits to the HTTP method filtering logic required to enforce the parent's policy.

_Surfaced assumptions:_ A-0169

  - **US-007-3.1.1** `[Tier D · atomic]`
    **As a** Request Validator, **I want** Verify HTTP method is in forbidden list, **so that** Request is rejected immediately without processing.

    **Acceptance criteria:**
      - **AC-001** — 403 returned for mutation methods
        - _Measurable:_ request.method in ['POST', 'PUT', 'DELETE'] implies status_code === 403

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-7 · Pass: 3_

    _Decomposition rationale:_ Isolates the method-checking logic as an atomic operation before path validation.

    _Surfaced assumptions:_ A-0353, A-0354
  - **US-007-3.1.2** `[Tier D · atomic]`
    **As a** Path Resolver, **I want** Validate path matches resolution endpoint pattern, **so that** Rule applies only to /resolution/ paths.

    **Acceptance criteria:**
      - **AC-002** — Path matches protected regex
        - _Measurable:_ path.startsWith('/resolution') === true triggers enforcement logic

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-7 · Pass: 3_

    _Decomposition rationale:_ Separates path scope from method scope to ensure correct targeting of the protection policy.

    _Surfaced assumptions:_ A-0353, A-0354
  - **US-007-3.1.3** `[Tier D · atomic]`
    **As a** State Guard, **I want** Prevent persistence of request artifacts, **so that** No database writes occur on failed mutation.

    **Acceptance criteria:**
      - **AC-003** — No state change detected
        - _Measurable:_ db.select(path).equals(db.select(path_before_request)) === true

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-7 · Pass: 3_

    _Decomposition rationale:_ Enforces the 'No POST... persisted' constraint as a testable atomic state check.

    _Surfaced assumptions:_ A-0353, A-0354
  - **US-007-3.1.4** `[Tier D · atomic]`
    **As a** Auditor, **I want** Log the blocked attempt event, **so that** Security audit trail updated.

    **Acceptance criteria:**
      - **AC-004** — Log entry created for rejection
        - _Measurable:_ ENT-AUDIT-LOG row exists with message containing '403 Forbidden'

    _Status: atomic · Priority: medium · Tier: D · Traces to: US-007-3.3 · Pass: 3_

    _Decomposition rationale:_ Links to sibling requirement US-007-3.3 regarding logging access attempts for security compliance.

    _Surfaced assumptions:_ A-0353, A-0354
##### US-007-3.2 `[Tier C · pending]`

**As a** CAM operator, **I want** Validate authentication for read requests, **so that** Authenticated users receive document content via GET requests.

**Acceptance criteria:**
  - **AC-003** — GET requests with valid session return 200 OK.
    - _Measurable:_ HTTP status code === 200 AND response.body !== null when valid session token is present
  - **AC-004** — Invalid session returns 401 Unauthorized.
    - _Measurable:_ HTTP status code === 401 when session token is missing or expired

_Status: pending · Priority: high · Tier: C · Traces to: UJ-7 · Pass: 2_

_Decomposition rationale:_ Read access still requires authorization checks. This child commits to the auth validation layer ensuring only permitted sessions retrieve the resolution content.

_Surfaced assumptions:_ A-0169

  - **US-007-3.2.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Verify cryptographic signature on session token, **so that** No malformed or tampered tokens pass through.

    **Acceptance criteria:**
      - **AC-101** — Signature validation matches issuer public key.
        - _Measurable:_ token.sig === expected.sig using issuer's public key stored in secure store

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-7 · Pass: 3_

    _Decomposition rationale:_ Integrity check is the primary barrier against replay and tampering attacks on stateless tokens; this is a concrete implementation check.

    _Surfaced assumptions:_ A-0355, A-0356
  - **US-007-3.2.2** `[Tier C · pending]`
    **As a** CAM operator, **I want** Validate session token expiration timestamp, **so that** Expired or near-expired sessions are rejected.

    **Acceptance criteria:**
      - **AC-102** — Token expiry exceeds current server clock time.
        - _Measurable:_ token.exp > server_clock_time - clock_skew_tolerance (e.g. 30s)

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-7 · Pass: 3_

    _Decomposition rationale:_ Enforces temporal validity to prevent session reuse; relies on internal clock and tolerance settings.

    _Surfaced assumptions:_ A-0355, A-0356
  - **US-007-3.2.3** `[Tier C · pending]`
    **As a** CAM operator, **I want** Evaluate role-based permissions for resource access, **so that** User role matches required permission for the specific document.

    **Acceptance criteria:**
      - **AC-103** — User role includes READ permission on the target document scope.
        - _Measurable:_ user.roles.intersects(doc.allowed_roles) === true AND doc.scope === user.resource_scope

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-7 · Pass: 3_

    _Decomposition rationale:_ Authenticates identity via token, authorizes action via permission; prevents unauthorized access to specific resources.

    _Surfaced assumptions:_ A-0355, A-0356
  - **US-007-3.2.4** `[Tier C · pending]`
    **As a** CAM operator, **I want** Return standardized 401 response, **so that** Client receives 401 status with no data leakage.

    **Acceptance criteria:**
      - **AC-104** — Response body contains no resource data or existence hints.
        - _Measurable:_ response.status === 401 AND response.body === null OR response.body === {error: 'Unauthorized'}

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-7 · Pass: 3_

    _Decomposition rationale:_ Standardizes error handling to prevent user enumeration while adhering to existing 403 policy constraints.

    _Surfaced assumptions:_ A-0355, A-0356
##### US-007-3.3 `[Tier C · pending]`

**As a** CAM operator, **I want** Log access attempt events, **so that** All GET requests and failed POST/PUT attempts are recorded for audit.

**Acceptance criteria:**
  - **AC-005** — Access event created in audit log upon request.
    - _Measurable:_ ENT-AUDIT-LOG record created with timestamp, user_id, and resource_path for every GET request

_Status: pending · Priority: medium · Tier: C · Traces to: UJ-7 · Pass: 2_

_Decomposition rationale:_ Governance and compliance require tracking who accessed voting resolutions. This child commits to the audit logging mechanism to surface the user action history.

_Surfaced assumptions:_ A-0169

  - **US-007-3.3-C1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Create audit log record for every successful GET request, **so that** A record exists in ENT-AUDIT-LOG for every 2xx GET response.

    **Acceptance criteria:**
      - **AC-001** — Every 2xx GET request triggers log entry creation.
        - _Measurable:_ count(entries in ENT-AUDIT-LOG where event_type='GET' AND status_code=2xx) equals total successful GET requests during test window.

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-7, US-007-3.2 · Pass: 3_

    _Decomposition rationale:_ Separates successful read logging from failed mutation logging to ensure specific coverage of GET traffic.

    _Surfaced assumptions:_ A-0357
  - **US-007-3.3-C2** `[Tier C · pending]`
    **As a** CAM operator, **I want** Create audit log record for every failed POST/PUT request, **so that** A record exists in ENT-AUDIT-LOG for every 4xx/5xx POST/PUT response.

    **Acceptance criteria:**
      - **AC-002** — Every POST/PUT response with status >= 400 triggers log entry creation.
        - _Measurable:_ count(entries in ENT-AUDIT-LOG where event_type='MUTATION_FAIL') equals total POST/PUT requests returning 4xx/5xx status codes during test window.

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-7, US-007-3.1, US-007-3.2 · Pass: 3_

    _Decomposition rationale:_ Covers the 'failed POST/PUT' part of the requirement, linking to sibling scope regarding mutation rejection (US-007-3.1).

    _Surfaced assumptions:_ A-0357
  - **US-007-3.3-C3** `[Tier B · pending]`
    **As a** Security Officer, **I want** Exempt resource existence details from log records for auth failures, **so that** Log records for 401/403 do not reveal which resources exist.

    **Acceptance criteria:**
      - **AC-003** — Auth failure logs omit resource_path for sensitive status codes.
        - _Measurable:_ For entries where status_code in (401, 403), resource_path is set to NULL or a generic constant to prevent enumeration attacks.

    _Status: pending · Priority: critical · Tier: B · Traces to: UJ-7, US-007-3.2 · Pass: 3_

    _Decomposition rationale:_ This is a security policy decision (Tier B) that overrides default logging behavior to comply with assumption A-0169 regarding 403 leakage.

    _Surfaced assumptions:_ A-0357
  - **US-007-3.3-C4** `[Tier C · pending]`
    **As a** Backend Engineer, **I want** Persist log records to ENT-AUDIT-LOG entity with immutable schema, **so that** Log records are written to the designated audit table without subsequent modification.

    **Acceptance criteria:**
      - **AC-004** — Log entry persists after transaction commit.
        - _Measurable:_ SELECT COUNT(*) FROM ENT-AUDIT-LOG WHERE event_id IS NOT NULL returns count equal to transactions logged.

    _Status: pending · Priority: medium · Tier: C · Traces to: UJ-7 · Pass: 3_

    _Decomposition rationale:_ Commitment to the specific storage mechanism and immutability constraint, utilizing ENT-AUDIT-LOG defined in the canonical vocabulary.

    _Surfaced assumptions:_ A-0357
#### US-007-1 `[deferred]`

**As a** Auth Engine, **I want** validate user role against resolution voting eligibility, **so that** Reject vote submission if user is not a board member.

**Acceptance criteria:**
  - **AC-013** — System rejects vote submission for unauthorized users
    - _Measurable:_ HTTP 403 returned for ENT-VOTE creation request if user.role != BOARD_MEMBER

_Status: deferred · Priority: critical · Traces to: UJ-7, WF-11 · Pass: 2_

### FR US-012 `[pending]`

**As a** Association Manager, **I want** Reconcile HOA Payments and Assessment, **so that** Resident dues and Assessment charges matched in Ledger.

**Acceptance criteria:**
  - **AC-023** — Payments matched
    - _Measurable:_ ENT-TRANSACTION records show zero variance for period reconciliation
  - **AC-024** — Audit saved
    - _Measurable:_ ENT-AUDIT-LOG entry created for every reconciliation batch

_Status: pending · Priority: critical · Traces to: UJ-13, COMP-1, ENT-ACCOUNT, ENT-PAYMENT-METHOD, VOC-2 · Pass: 0_

#### US-012-C-1 `[Tier C · pending]`

**As a** CAM operator, **I want** Execute Payment-to-Assessment matching algorithm, **so that** ENT-TRANSACTION records linked to Assessment charges with zero variance.

**Acceptance criteria:**
  - **AC-001** — Every payment batch successfully matches a corresponding assessment charge record.
    - _Measurable:_ count(matched_payments) === count(assessment_charges) for every reconciliation batch ID

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-13 · Pass: 1_

_Decomposition rationale:_ This is the core functional implementation logic. It moves from the high-level scope commitment to the specific algorithmic choice required to fulfill the matching requirement.

_Surfaced assumptions:_ A-0036, A-0037

##### US-012-C-1-1 `[Tier C · pending]`

**As a** CAM operator, **I want** Construct payment-assessment matching key using Batch ID, Amount, and Currency, **so that** Records are grouped by shared Batch ID, equal Amount, and identical Currency code.

**Acceptance criteria:**
  - **AC-002** — Matching key is valid for a pair only if amounts and currency match.
    - _Measurable:_ pair.batch_id == pair2.batch_id AND abs(pair1.amount - pair2.amount) === 0 AND pair1.currency == pair2.currency

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-13, WF-3 · Pass: 2_

_Decomposition rationale:_ This child defines the core data logic required to perform the algorithm. It resolves the 'how' of matching before tolerance or variance is considered.

_Surfaced assumptions:_ A-0126, A-0127

  - **US-012-C-1-1.1** `[Tier D · atomic]`
    **As a** Validation operator, **I want** Verify Batch ID equality for candidate pair, **so that** Records with mismatched Batch IDs are excluded from the candidate set immediately.

    **Acceptance criteria:**
      - **AC-002.1** — Batch ID string comparison returns true
        - _Measurable:_ pair.batch_id === pair2.batch_id

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-3, UJ-13 · Pass: 3_

    _Decomposition rationale:_ Batch ID is the primary grouping dimension; must be validated first to filter candidate pairs before deeper comparison.

    _Surfaced assumptions:_ A-0279, A-0280
  - **US-012-C-1-1.2** `[Tier D · atomic]`
    **As a** Validation operator, **I want** Verify Amount equality for candidate pair, **so that** Records with differing amounts (rounded to standard precision) are excluded from the candidate set.

    **Acceptance criteria:**
      - **AC-002.2** — Amount difference is effectively zero
        - _Measurable:_ round(pair1.amount - pair2.amount, 2) === 0

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-3, UJ-13 · Pass: 3_

    _Decomposition rationale:_ Amount is the second key dimension; strict equality is required at this stage before variance tolerance siblings (US-012-C-1-2) are considered.

    _Surfaced assumptions:_ A-0279, A-0280
  - **US-012-C-1-1.3** `[Tier D · atomic]`
    **As a** Validation operator, **I want** Verify Currency code equality for candidate pair, **so that** Records with different currency codes are excluded from the candidate set.

    **Acceptance criteria:**
      - **AC-002.3** — Currency code string comparison returns true
        - _Measurable:_ pair1.currency === pair2.currency

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-3, UJ-13 · Pass: 3_

    _Decomposition rationale:_ Currency ensures cross-border transaction handling is consistent; exact match is required per AC-002 and assumption A-0126.

    _Surfaced assumptions:_ A-0279, A-0280
  - **US-012-C-1-1.4** `[Tier C · pending]`
    **As a** State management, **I want** Group validated pairs into a single Matched Batch, **so that** A set of records marked as matched and available for downstream processing (Reconciled).

    **Acceptance criteria:**
      - **AC-002.4** — Matched group contains only pairs satisfying 1.1, 1.2, 1.3
        - _Measurable:_ count(group.members) > 0 AND all(p in group.members -> p.batch_id == group.key.batch_id && p.amount == group.key.amount && p.currency == group.key.currency)

    _Status: pending · Priority: high · Tier: C · Traces to: WF-3, UJ-13 · Pass: 3_

    _Decomposition rationale:_ This is the implementation decision to physically group the validated pairs into a structure for status update; bridges validation logic to the persistence requirement of US-012-C-1-4.

    _Surfaced assumptions:_ A-0279, A-0280
    - **US-012-C-1-1.4.1** `[Tier C · pending]`
      **As a** Orchestrator, **I want** Initialize Reconciled Batch Header, **so that** A batch header object is instantiated with a unique identifier and run boundary.

      **Acceptance criteria:**
        - **AC-002.4.1** — Batch header created with unique run-boundary ID
          - _Measurable:_ batch_id is unique and immutable per WF-3 run timestamp

      _Status: pending · Priority: critical · Tier: C · Traces to: WF-3 · Pass: 4_

      _Decomposition rationale:_ Defines the container for the matched pairs; must be established before items are linked to ensure isolation.

      _Surfaced assumptions:_ A-0564, A-0565
    - **US-012-C-1-1.4.2** `[Tier D · atomic]`
      **As a** Operator, **I want** Persist Batch Items Reference, **so that** Validated pairs are linked to the batch header as immutable items.

      **Acceptance criteria:**
        - **AC-002.4.2** — Each item references a validated pair and batch header
          - _Measurable:_ forall item i in batch: item.batch_id === header.id && item.pair_validation_flags === true

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-13 · Pass: 4_

      _Decomposition rationale:_ Atomic action of writing the item references; ensures the 'Matched Group' is materialized.

      _Surfaced assumptions:_ A-0564, A-0565
    - **US-012-C-1-1.4.3** `[Tier D · atomic]`
      **As a** Notifier, **I want** Transition Batch to Reconciled State, **so that** Batch status changes to Reconciled and downstream queues are signaled.

      **Acceptance criteria:**
        - **AC-002.4.3** — Batch status is updated to Reconciled and downstream workflows are notified
          - _Measurable:_ batch.status === 'Reconciled' && downstream_event emitted

      _Status: atomic · Priority: high · Tier: D · Traces to: UJ-13, WF-3 · Pass: 4_

      _Decomposition rationale:_ The terminal action defining the 'Reconciled' outcome for downstream processing.

      _Surfaced assumptions:_ A-0564, A-0565
##### US-012-C-1-2 `[Tier C · pending]`

**As a** CAM operator, **I want** Apply configurable variance tolerance to calculate match eligibility, **so that** Variance between payment and assessment is validated against the configured threshold from settings.

**Acceptance criteria:**
  - **AC-003** — Match eligibility depends on tolerance configuration.
    - _Measurable:_ abs(payment.amount - assessment.amount) <= configured.variance_threshold

_Status: pending · Priority: high · Tier: C · Traces to: UJ-13, WF-3 · Pass: 2_

_Decomposition rationale:_ Respects existing assumption A-0037 that tolerance is configurable. This child binds the system behavior to the runtime setting rather than a hardcoded value.

_Surfaced assumptions:_ A-0126, A-0127

  - **FR-ACCT-1.2.1** `[Tier D · atomic]`
    **As a** Validation engine, **I want** Retrieve configured variance threshold from settings store, **so that** Current threshold value available for comparison.

    **Acceptance criteria:**
      - **AC-004** — System fetches threshold at validation start.
        - _Measurable:_ threshold_value === system_settings.variance_tolerance

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-3 · Pass: 3_

    _Decomposition rationale:_ The variance logic depends on an external configuration; retrieval is the first atomic step required to enable the comparison operation.

    _Surfaced assumptions:_ A-0281
  - **FR-ACCT-1.2.2** `[Tier D · atomic]`
    **As a** Validation engine, **I want** Compare absolute difference of payment and assessment against threshold, **so that** Boolean match_eligible flag produced.

    **Acceptance criteria:**
      - **AC-003** — Match eligibility is strictly determined by the math inequality.
        - _Measurable:_ abs(payment.amount - assessment.amount) <= threshold_value implies match_eligible === true

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-13 · Pass: 3_

    _Decomposition rationale:_ The core logic is the mathematical comparison; this is the final decision node for pair eligibility.

    _Surfaced assumptions:_ A-0281
##### US-012-C-1-3 `[Tier C · pending]`

**As a** CAM operator, **I want** Isolate unmatched records for exception routing to C-2, **so that** Any pair failing the variance check is flagged as unmatched in the current batch.

**Acceptance criteria:**
  - **AC-004** — Failed pairs are excluded from matched count.
    - _Measurable:_ if (variance > threshold) { record.is_matched = false; route_to_exception = true }

_Status: pending · Priority: high · Tier: C · Traces to: UJ-13, US-012-C-2 · Pass: 2_

_Decomposition rationale:_ Defines the boundary between the successful matching logic of this child and the exception handling of sibling C-2. Ensures the parent AC (count match) is not violated by unhandled errors.

_Surfaced assumptions:_ A-0126, A-0127

  - **US-012-C-1-3-1** `[Tier D · atomic]`
    **As a** System, **I want** Set unmatched flag on record, **so that** Record is marked as not matched in the ledger.

    **Acceptance criteria:**
      - **AC-004-1** — Failing records are flagged.
        - _Measurable:_ record.is_matched === false for every pair where variance > threshold

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-13, US-012-C-2 · Pass: 3_

    _Decomposition rationale:_ Extracting the state update action from the parent to verify the record-level consequence independently. This ensures the unmatched state is persisted as a distinct atomic change.

    _Surfaced assumptions:_ A-0282, A-0283
  - **US-012-C-1-3-2** `[Tier D · atomic]`
    **As a** System, **I want** Decrement matched batch count, **so that** Batch matched count reflects only successful pairs.

    **Acceptance criteria:**
      - **AC-004-2** — Batch count excludes failures.
        - _Measurable:_ batch.matched_count === initial_count - count(failed_pairs)

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-13, US-012-C-2 · Pass: 3_

    _Decomposition rationale:_ Separating the aggregate state update to verify that the count logic correctly maintains the matched set invariant. This commits to the specific arithmetic rule for the batch summary.

    _Surfaced assumptions:_ A-0282, A-0283
  - **US-012-C-1-3-3** `[Tier C · pending]`
    **As a** System, **I want** Trigger exception routing workflow, **so that** Unmatched records enter exception queue for C-2.

    **Acceptance criteria:**
      - **AC-004-3** — Unmatched records are queued.
        - _Measurable:_ exception_workflow_id === 'C-2' AND record.status === 'EXCEPTION' at workflow completion time

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-13, US-012-C-2 · Pass: 3_

    _Decomposition rationale:_ This child commits to the specific architectural choice of using workflow C-2 for exceptions rather than a generic catch-all. As a Tier C child, it defines a sub-strategy (exception routing path) that has downstream consequences for C-2 handling.

    _Surfaced assumptions:_ A-0282, A-0283
    - **US-012-C-1-3-3-1** `[Tier D · atomic]`
      **As a** Filtering logic, **I want** Identify records marked as unmatched, **so that** Only records with UNMATCHED status are selected for exception handling.

      **Acceptance criteria:**
        - **AC-001** — Input set contains only records flagged as UNMATCHED
          - _Measurable:_ SELECT * FROM batch_records WHERE match_status = 'UNMATCHED'

      _Status: atomic · Priority: high · Tier: D · Traces to: US-012-C-1-3-1, US-012-C-1-3-3, UJ-13 · Pass: 4_

      _Decomposition rationale:_ Distinguishes the subset of records eligible for the exception path, dependent on the flag set in sibling requirement 3-1.

      _Surfaced assumptions:_ A-0566, A-0567
    - **US-012-C-1-3-3-2** `[Tier D · atomic]`
      **As a** Workflow Dispatch, **I want** Invoke Workflow C-2 for the selected set, **so that** Workflow instance created and queued for processing.

      **Acceptance criteria:**
        - **AC-002** — Workflow instance ID begins with 'C-2'
          - _Measurable:_ exception_workflow_id === 'C-2' AND workflow.status === 'QUEUED' at trigger time

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-012-C-1-3-3, UJ-13 · Pass: 4_

      _Decomposition rationale:_ Executes the routing commitment to the specific exception queue defined in the parent requirement.

      _Surfaced assumptions:_ A-0566, A-0567
    - **US-012-C-1-3-3-3** `[Tier D · atomic]`
      **As a** State Update, **I want** Persist record as EXCEPTION, **so that** Record status transitions to EXCEPTION within the batch transaction.

      **Acceptance criteria:**
        - **AC-003** — Record status is EXCEPTION after completion
          - _Measurable:_ record.status === 'EXCEPTION' AND record.batch_id IS NOT NULL

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-012-C-1-3-3, UJ-13 · Pass: 4_

      _Decomposition rationale:_ Completes the status transition obligation defined in the parent AC.

      _Surfaced assumptions:_ A-0566, A-0567
##### US-012-C-1-4 `[Tier D · atomic]`

**As a** System, **I want** Persist RECONCILED status on successful pair match, **so that** ENT-TRANSACTION record status updates to RECONCILED upon successful pairing.

**Acceptance criteria:**
  - **AC-005** — Transaction status reflects match result.
    - _Measurable:_ ENT-TRANSACTION.status === 'RECONCILED' AND ENT-TRANSACTION.matched_at !== null

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-13, WF-3 · Pass: 2_

_Decomposition rationale:_ This is the terminal operation (Leaf) for a matched transaction. It is the atomic action executed to confirm the AC 'count(matched) === count(...)'. It is testable independently.

_Surfaced assumptions:_ A-0126, A-0127

#### US-012-C-2 `[Tier C · pending]`

**As a** CAM operator, **I want** Flag variance exceptions for review, **so that** Discrepancies > 0 recorded and routed to dispute workflow.

**Acceptance criteria:**
  - **AC-002** — All payments not perfectly matched are flagged for human or automated resolution.
    - _Measurable:_ sum(variance) > 0 implies record exists in exception_queue OR dispute_ticket_id is populated

_Status: pending · Priority: high · Tier: C · Traces to: UJ-13, UJ-08 · Pass: 1_

_Decomposition rationale:_ Defines the system response to non-matching data. This binds the implementation to a specific error-handling strategy rather than a vague 'handle errors' commitment.

_Surfaced assumptions:_ A-0036, A-0037

##### US-012-C-2.1 `[Tier C · pending]`

**As a** CAM operator, **I want** Persist mismatch record to exception_queue table, **so that** Discrepancy record created with unique exception_queue_id.

**Acceptance criteria:**
  - **AC-002.1** — Exception queue entry exists after variance detected.
    - _Measurable:_ SELECT COUNT(*) FROM exception_queue WHERE transaction_id = :id AND variance > 0 ORDER BY created_at DESC LIMIT 1 >= 1

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-13 · Pass: 2_

_Decomposition rationale:_ Persistence is the first step in committing to the exception policy; must ensure data durability before routing.

_Surfaced assumptions:_ A-0128, A-0129

  - **US-012-C-2.1-01** `[Tier C · pending]`
    **As a** System Data Modeler, **I want** Define exception_queue record schema, **so that** Record schema includes variance_amount, transaction_id, exception_queue_id columns.

    **Acceptance criteria:**
      - **AC-01** — Exception queue table contains required columns.
        - _Measurable:_ SELECT COUNT(*) FROM exception_queue WHERE transaction_id IS NOT NULL AND variance_amount IS NOT NULL >= 1

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-13 · Pass: 3_

    _Decomposition rationale:_ Defining the payload structure is a prerequisite to persistence; it commits the data model for the reconciliation workflow.

    _Surfaced assumptions:_ A-0284
    - **US-012-C-2.1-01-C1** `[Tier C · pending]`
      **As a** Data Modeler, **I want** Enforce Foreign Key constraint on transaction_id, **so that** Every exception record links to an existing valid financial transaction.

      **Acceptance criteria:**
        - **AC-001** — Foreign key constraint prevents orphan records.
          - _Measurable:_ SELECT COUNT(*) FROM exception_queue WHERE transaction_id NOT IN (SELECT id FROM transaction) = 0

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-13, ENT-TRANSACTION · Pass: 4_

      _Decomposition rationale:_ Variance detection requires traceability to a specific financial event; this child ensures the schema preserves that link via FK.

      _Surfaced assumptions:_ A-0568, A-0569, A-0570
    - **US-012-C-2.1-01-C2** `[Tier C · pending]`
      **As a** Data Modeler, **I want** Define decimal precision for variance_amount, **so that** Variance value stored with 2 decimal places to support currency calculations.

      **Acceptance criteria:**
        - **AC-002** — Variance column is NUMERIC(10,2).
          - _Measurable:_ SELECT data_type FROM information_schema.columns WHERE table_name='exception_queue' AND column_name='variance_amount' = 'NUMERIC(10,2)' = true

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-13, COMP-1 · Pass: 4_

      _Decomposition rationale:_ Financial variance must be precise for GL compliance; floating point arithmetic is disallowed for monetary values.

      _Surfaced assumptions:_ A-0568, A-0569, A-0570
    - **US-012-C-2.1-01-C3** `[Tier C · pending]`
      **As a** Data Modeler, **I want** Enforce uniqueness constraint on exception_queue_id, **so that** No two records share the same exception_queue_id.

      **Acceptance criteria:**
        - **AC-003** — Unique constraint on primary key column.
          - _Measurable:_ SELECT COUNT(*) FROM exception_queue WHERE id IN (SELECT id FROM exception_queue WHERE id = ANY (SELECT id FROM exception_queue WHERE id = 'X')) = 0

      _Status: pending · Priority: high · Tier: C · Traces to: US-012-C-2.1-02 · Pass: 4_

      _Decomposition rationale:_ This child operationalizes the sibling's commitment (US-012-C-2.1-02) by defining the uniqueness constraint in the schema definition.

      _Surfaced assumptions:_ A-0568, A-0569, A-0570
    - **US-012-C-2.1-01-C4** `[Tier B · pending]`
      **As a** Architect, **I want** Define exception queue as transient reconciliation buffer, **so that** Records are scoped for immediate reconciliation rather than long-term storage.

      **Acceptance criteria:**
        - **AC-004** — Table is marked transient or has TTL for cleanup.
          - _Measurable:_ DROP TABLE IF EXISTS exception_queue_permanent OR DELETE FROM exception_queue WHERE created_at < NOW() - INTERVAL '7 days' = true

      _Status: pending · Priority: high · Tier: B · Traces to: UJ-13 · Pass: 4_

      _Decomposition rationale:_ This defines the lifecycle scope of the table, distinguishing it from permanent ledger entries.

      _Surfaced assumptions:_ A-0568, A-0569, A-0570
    - **US-012-C-2.1-01-C5** `[Tier C · pending]`
      **As a** Security Engineer, **I want** Apply Row-Level Security (RLS) tenant filter, **so that** Only authorized tenants can query exception_queue for their own records.

      **Acceptance criteria:**
        - **AC-005** — RLS policy restricts access to current_tenant_id.
          - _Measurable:_ SELECT COUNT(*) FROM exception_queue WHERE current_tenant_id != CURRENT_USER_TENANT_ID = 0

      _Status: pending · Priority: critical · Tier: C · Traces to: A-0128 · Pass: 4_

      _Decomposition rationale:_ This implements the existing assumption of tenant isolation at the database level using Postgres RLS.

      _Surfaced assumptions:_ A-0568, A-0569, A-0570
  - **US-012-C-2.1-02** `[Tier C · pending]`
    **As a** System Architect, **I want** Implement UUID v4 generation for exception_queue_id, **so that** Each exception record has a globally unique identifier within tenant.

    **Acceptance criteria:**
      - **AC-02** — Exception queue ID format matches UUID v4.
        - _Measurable:_ exception_queue_id matches regex pattern for UUID v4 standard

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-13 · Pass: 3_

    _Decomposition rationale:_ Unique ID strategy is a concrete architectural choice required for referential integrity with UJ-13 reconciliation and downstream workflow handling.

    _Surfaced assumptions:_ A-0284
    - **US-012-C-2.1-02-C-01** `[Tier C · pending]`
      **As a** workflow engine, **I want** Generate UUID v4 at insert transaction, **so that** Every exception record contains a populated ID before commit completes.

      **Acceptance criteria:**
        - **AC-002.1** — Exception queue ID is populated at write.
          - _Measurable:_ SELECT COUNT(*) FROM exception_queue WHERE exception_queue_id IS NULL = 0 AT COMMIT TIME

      _Status: pending · Priority: critical · Tier: C · Traces to: US-012-C-2.1-03 · Pass: 4_

      _Decomposition rationale:_ Binds ID generation to the write transaction to ensure immediate visibility and prevent nulls, satisfying the immediate write constraint in UJ-13.

      _Surfaced assumptions:_ A-0571, A-0572
    - **US-012-C-2.1-02-C-02** `[Tier D · atomic]`
      **As a** validation engine, **I want** Enforce UUID v4 regex pattern on read/write, **so that** System rejects or corrects IDs that violate the UUID v4 standard.

      **Acceptance criteria:**
        - **AC-002** — Exception queue ID matches UUID v4 regex.
          - _Measurable:_ exception_queue_id matches ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$

      _Status: atomic · Priority: high · Tier: D · Traces to: UJ-13 · Pass: 4_

      _Decomposition rationale:_ Ensures the stored identifier is valid for payment matching and ledger reconciliation logic.

      _Surfaced assumptions:_ A-0571, A-0572
    - **US-012-C-2.1-02-C-03** `[Tier C · pending]`
      **As a** crypto layer, **I want** Source randomness from OS crypto entropy, **so that** Generated IDs possess sufficient entropy to prevent collisions.

      **Acceptance criteria:**
        - **AC-002.2** — ID generation uses secure cryptographic functions.
          - _Measurable:_ API calls to secureRandom or crypto.randomUUID() are used in backend code

      _Status: pending · Priority: critical · Tier: C · Traces to: US-012-C-2.1-01 · Pass: 4_

      _Decomposition rationale:_ Security commitment ensuring IDs cannot be predicted or cloned by attackers during payment matching.

      _Surfaced assumptions:_ A-0571, A-0572
    - **US-012-C-2.1-02-C-04** `[Tier D · atomic]`
      **As a** schema writer, **I want** Map ID to VARCHAR column with sufficient length, **so that** Storage engine preserves the full UUID string without truncation.

      **Acceptance criteria:**
        - **AC-002.3** — Column length accommodates full UUID string.
          - _Measurable:_ VARCHAR length >= 36 characters for exception_queue_id

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-012-C-2.1-01 · Pass: 4_

      _Decomposition rationale:_ Schema-level commitment ensuring data integrity of the generated identifier.

      _Surfaced assumptions:_ A-0571, A-0572
  - **US-012-C-2.1-03** `[Tier C · pending]`
    **As a** System Developer, **I want** Enforce immediate transactional write upon variance detection, **so that** Exception entry is visible to downstream workflows (e.g., alerts) in same commit.

    **Acceptance criteria:**
      - **AC-03** — INSERT statement executes synchronously after validation.
        - _Measurable:_ Transaction commit time < 100ms from variance detection event

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-13 · Pass: 3_

    _Decomposition rationale:_ Transaction boundary ensures consistency between variance detection and record persistence, supporting AC-002.1 visibility requirements.

    _Surfaced assumptions:_ A-0284
    - **US-012-C-2.1-03.1** `[Tier C · pending]`
      **As a** DB Admin, **I want** Configure database transaction isolation level for exception writes, **so that** No phantom reads occur during variance detection and write operations.

      **Acceptance criteria:**
        - **AC-03.1** — Transaction isolation level is set to prevent concurrency anomalies.
          - _Measurable:_ Configured isolation_level == 'SERIALIZABLE' for exception_queue tables

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-13 · Pass: 4_

      _Decomposition rationale:_ Visibility to downstream workflows requires strict isolation to ensure readers see committed writes in the same commit batch.

      _Surfaced assumptions:_ A-0573, A-0574
    - **US-012-C-2.1-03.2** `[Tier C · pending]`
      **As a** Event Engineer, **I want** Register downstream workflow listeners on the exception creation event topic, **so that** Alert workflow receives event payload immediately upon commit.

      **Acceptance criteria:**
        - **AC-03.2** — Listener subscription is active and confirmed on the event topic.
          - _Measurable:_ PubSub subscription_id for exception_event exists and heartbeat is healthy

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-13 · Pass: 4_

      _Decomposition rationale:_ Visibility requirement mandates a decoupled event path that publishes the record state immediately after the DB commit.

      _Surfaced assumptions:_ A-0573, A-0574
    - **US-012-C-2.1-03.3** `[Tier D · atomic]`
      **As a** System Developer, **I want** Persist exception record row to database, **so that** Exception entry is visible in ledger immediately.

      **Acceptance criteria:**
        - **AC-03.3** — INSERT statement returns success status.
          - _Measurable:_ Transaction commit returns success code; exception_queue_id is non-null and unique

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-13 · Pass: 4_

      _Decomposition rationale:_ This is the atomic leaf operation that physically realizes the immediate write commitment.

      _Surfaced assumptions:_ A-0573, A-0574
##### US-012-C-2.2 `[Tier C · pending]`

**As a** System Operator, **I want** Route exception to Queue or Ticket based on config, **so that** Record populated with exception_queue_id OR dispute_ticket_id, but not both.

**Acceptance criteria:**
  - **AC-002.2** — Record points to one resolution path.
    - _Measurable:_ exception_queue_id IS NULL OR dispute_ticket_id IS NULL

_Status: pending · Priority: high · Tier: C · Traces to: UJ-08 · Pass: 2_

_Decomposition rationale:_ Defines the architectural choice for exception handling paths; ensures exclusivity of resolution channels.

_Surfaced assumptions:_ A-0128, A-0129

  - **US-012-C-2.2.1** `[Tier C · pending]`
    **As a** System Layer, **I want** Evaluate routing config to determine queue versus ticket path, **so that** System selects exception_queue_id or dispute_ticket_id or null based on config value.

    **Acceptance criteria:**
      - **AC-001** — Config value is read and processed for every exception record.
        - _Measurable:_ read(config) returns valid key OR null on request

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-08 · Pass: 3_

    _Decomposition rationale:_ Implements the 'based on config' architectural decision by fetching routing rules.

    _Surfaced assumptions:_ A-0285, A-0286
    - **FR-ROUTE-1.1** `[Tier C · pending]`
      **As a** Decision Engine, **I want** Apply routing rules against read configuration to determine path type, **so that** System determines whether target is queue_id, ticket_id, or null based on configuration.

      **Acceptance criteria:**
        - **AC-002** — Routing logic produces consistent target ID for identical input and config
          - _Measurable:_ hash(rule_input) === rule_output for same input configuration

      _Status: pending · Priority: high · Tier: C · Traces to: UJ-08, US-012-C-2.2.3 · Pass: 4_

      _Decomposition rationale:_ Defines the specific logic engine commitment (rule application) that sits between configuration loading and record persistence.

      _Surfaced assumptions:_ A-0575, A-0576
    - **FR-ROUTE-1.2** `[Tier D · atomic]`
      **As a** State Manager, **I want** Select single target ID for the exception record, **so that** Record contains exactly one of queue_id, ticket_id, or null.

      **Acceptance criteria:**
        - **AC-003** — Target ID field is populated with a single value, not multiple
          - _Measurable:_ record.queue_id OR record.ticket_id OR record.target_id is NOT NULL AND count(non-null target_ids) === 1

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-08 · Pass: 4_

      _Decomposition rationale:_ Atomic operation: finalizing the decision by binding it to the record state, ensuring the 'single selection' AC is met.

      _Surfaced assumptions:_ A-0575, A-0576
    - **FR-ROUTE-1.3** `[Tier D · atomic]`
      **As a** Persistence Layer, **I want** Persist updated target ID to database with transactional safety, **so that** Routing decision is durable and visible to downstream consumers.

      **Acceptance criteria:**
        - **AC-004** — Target ID update succeeds within the transaction context
          - _Measurable:_ transaction.commit() returns true AND record.target_id persists in DB after commit

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-08 · Pass: 4_

      _Decomposition rationale:_ Atomic write operation required to complete the selection, ensuring AC-004 is satisfied.

      _Surfaced assumptions:_ A-0575, A-0576
  - **US-012-C-2.2.2** `[Tier C · pending]`
    **As a** Database Layer, **I want** Enforce mutual exclusion constraint on record state, **so that** Database rejects write if both queue_id and ticket_id are non-null.

    **Acceptance criteria:**
      - **AC-002** — Constraint violation occurs if both IDs are set simultaneously.
        - _Measurable:_ CHECK (exception_queue_id IS NULL OR dispute_ticket_id IS NULL) returns true for all rows

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-08, US-012-C-2.1 · Pass: 3_

    _Decomposition rationale:_ Implements the 'not both' policy requirement to ensure single path resolution.

    _Surfaced assumptions:_ A-0285, A-0286
    - **FR-DB-2.2.2-1** `[Tier C · pending]`
      **As a** DB Architect, **I want** Define native SQL CHECK constraint on the record table, **so that** Database schema enforces row-level mutual exclusion at storage engine level.

      **Acceptance criteria:**
        - **AC-001** — SQL definition includes exclusion logic
          - _Measurable:_ Database schema object 'CREATE TABLE ... CHECK (exception_queue_id IS NULL OR dispute_ticket_id IS NULL) ...' exists and is active

      _Status: pending · Priority: critical · Tier: C · Traces to: US-012-C-2.2.3 · Pass: 4_

      _Decomposition rationale:_ Selects the native database constraint mechanism over application-level validation, committing to the specific technology implementation of the rule.

      _Surfaced assumptions:_ A-0577, A-0578
    - **FR-DB-2.2.2-2** `[Tier C · pending]`
      **As a** Transaction Handler, **I want** Rollback transaction immediately upon constraint violation, **so that** No data state is persisted when both IDs are non-null.

      **Acceptance criteria:**
        - **AC-002** — Write fails with database error
          - _Measurable:_ If (exception_queue_id IS NOT NULL AND dispute_ticket_id IS NOT NULL) THEN ROLLBACK is executed before commit confirmation

      _Status: pending · Priority: critical · Tier: C · Traces to: US-012-C-2.2.1 · Pass: 4_

      _Decomposition rationale:_ Defines the consequence of the constraint violation, committing to atomic transaction behavior rather than partial update or soft validation.

      _Surfaced assumptions:_ A-0577, A-0578
    - **FR-DB-2.2.2-3** `[Tier D · atomic]`
      **As a** Auditor, **I want** Log constraint violation event to immutable audit trail, **so that** System records evidence of policy violation for compliance and debugging.

      **Acceptance criteria:**
        - **AC-003** — Violation record persisted to audit log
          - _Measurable:_ ENT-AUDIT-LOG receives row containing violation timestamp, session_id, and failing_row_hash

      _Status: atomic · Priority: high · Tier: D · Traces to: US-012-C-2.2.1, US-012-C-2.2.3 · Pass: 4_

      _Decomposition rationale:_ Converts the architectural choice into a leaf operation defining the terminal audit action required for regulatory compliance.

      _Surfaced assumptions:_ A-0577, A-0578
  - **US-012-C-2.2.3** `[Tier C · pending]`
    **As a** Configuration Manager, **I want** Load routing configuration from versioned source, **so that** Routing rules are available and validated against system schema.

    **Acceptance criteria:**
      - **AC-003** — Routing config is fetched and validated at request time.
        - _Measurable:_ fetch_config() returns valid schema object within 100ms

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-08 · Pass: 3_

    _Decomposition rationale:_ Ensures the 'config' aspect is decoupled and managed externally, enabling flexibility.

    _Surfaced assumptions:_ A-0285, A-0286
    - **US-012-C-2.2.3.1** `[Tier C · pending]`
      **As a** Configuration Fetcher, **I want** Retrieve routing rules from external versioned store endpoint, **so that** Raw configuration object loaded into memory.

      **Acceptance criteria:**
        - **AC-003.1** — Fetch endpoint responds with configuration data or error.
          - _Measurable:_ HTTP 200 returned for valid version; HTTP 404/500 for missing source; response body matches versioned schema.

      _Status: pending · Priority: critical · Tier: C · Traces to: US-012-C-2.2.3 · Pass: 4_

      _Decomposition rationale:_ Defines the specific source location and fetch mechanism for the 'Load' verb, separating it from validation logic.

      _Surfaced assumptions:_ A-0579, A-0580, A-0581
    - **US-012-C-2.2.3.2** `[Tier C · pending]`
      **As a** Schema Validator, **I want** Run Zod schema validation against the loaded configuration object, **so that** Guaranteed schema-compliant config object ready for use.

      **Acceptance criteria:**
        - **AC-003.2** — Invalid config structures are rejected prior to system usage.
          - _Measurable:_ Zod.parse() throws ValidationError on any struct mismatch; no routing rules persisted if validation fails.

      _Status: pending · Priority: high · Tier: C · Traces to: US-012-C-2.2.3 · Pass: 4_

      _Decomposition rationale:_ Decomposes the 'validated against system schema' AC into a specific technical implementation choice (Zod library and synchronous check).

      _Surfaced assumptions:_ A-0579, A-0580, A-0581
    - **US-012-C-2.2.3.3** `[Tier C · pending]`
      **As a** Latency Optimizer, **I want** Cache retrieved config in-memory with TTL to meet 100ms SLA, **so that** Subsequent requests served from cache avoiding external latency.

      **Acceptance criteria:**
        - **AC-003.3** — Config retrieval completes within 100ms for cached entries.
          - _Measurable:_ Cache hit latency <= 5ms; Cache miss + fetch latency <= 100ms total; Cache eviction handled on config version change.

      _Status: pending · Priority: critical · Tier: C · Traces to: US-012-C-2.2.3 · Pass: 4_

      _Decomposition rationale:_ Addresses the performance AC ('within 100ms') by committing to a specific architectural pattern (Caching) required to meet the constraint.

      _Surfaced assumptions:_ A-0579, A-0580, A-0581
    - **US-012-C-2.2.3.4** `[Tier C · pending]`
      **As a** Version Controller, **I want** Associate loaded config with version metadata for audit trail, **so that** All routing rules linked to a specific release version.

      **Acceptance criteria:**
        - **AC-003.4** — Every loaded config includes a version identifier.
          - _Measurable:_ Config object contains `version` field matching source metadata; history of previous versions preserved in audit log.

      _Status: pending · Priority: medium · Tier: C · Traces to: US-012-C-2.2.3 · Pass: 4_

      _Decomposition rationale:_ Implements the 'versioned source' requirement by binding the configuration data to version control metadata for rollback and auditability.

      _Surfaced assumptions:_ A-0579, A-0580, A-0581
##### US-012-C-2.3 `[Tier C · pending]`

**As a** Notification Service, **I want** Send alert to CAM operator upon flag, **so that** Operator receives notification that variance exists and requires review.

**Acceptance criteria:**
  - **AC-002.3** — Notification sent to configured email channel.
    - _Measurable:_ SELECT COUNT(*) FROM notify_log WHERE exception_queue_id = :id AND status = 'SENT' >= 1

_Status: pending · Priority: medium · Tier: C · Traces to: UJ-13, UJ-08 · Pass: 2_

_Decomposition rationale:_ Operational feedback mechanism; ensures the human operator is aware of the exception flagged.

_Surfaced assumptions:_ A-0128, A-0129

  - **US-012-C-2.3-D-001** `[Tier D · atomic]`
    **As a** Notification Service, **I want** Compose email message using approved template, **so that** Message body prepared with variance details and link to review page.

    **Acceptance criteria:**
      - **AC-001** — Message payload matches template content
        - _Measurable:_ payload_content === template_engine.render(template_id, exception_data)

    _Status: atomic · Priority: medium · Tier: D · Traces to: UJ-13 · Pass: 3_

    _Decomposition rationale:_ Payload generation is the first atomic step of the notification lifecycle; verification ensures content integrity before transmission.

    _Surfaced assumptions:_ A-0287, A-0288, A-0289
  - **US-012-C-2.3-D-002** `[Tier D · atomic]`
    **As a** Notification Service, **I want** Resolve CAM operator recipients from user roles, **so that** List of valid user IDs identified for the alert.

    **Acceptance criteria:**
      - **AC-002** — Recipient list contains active CAM users for exception queue
        - _Measurable:_ recipient_list.length > 0 AND all users belong to ENT-ROLE.CAM_OPERATOR

    _Status: atomic · Priority: medium · Tier: D · Traces to: UJ-08 · Pass: 3_

    _Decomposition rationale:_ Recipient resolution is a distinct atomic check that ensures the correct audience receives the review request.

    _Surfaced assumptions:_ A-0287, A-0288, A-0289
  - **US-012-C-2.3-D-003** `[Tier D · atomic]`
    **As a** Notification Service, **I want** Write delivery status record to notify_log, **so that** Audit entry inserted with send timestamp and status.

    **Acceptance criteria:**
      - **AC-003** — Delivery status persisted immutably
        - _Measurable:_ notify_log.insert_count > 0 AND notify_log.status IN ('SENT', 'FAILED')

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-012-C-2.4 · Pass: 3_

    _Decomposition rationale:_ Logging is a required commitment for auditability of the exception workflow; this action links to the audit entry creation sibling.

    _Surfaced assumptions:_ A-0287, A-0288, A-0289
  - **US-012-C-2.3-D-004** `[Tier D · atomic]`
    **As a** Notification Service, **I want** Invoke external email provider SDK for transmission, **so that** Transmission request submitted to upstream provider.

    **Acceptance criteria:**
      - **AC-004** — Transmission request validated by provider
        - _Measurable:_ provider_response_code === 200 OR error_message != null

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-012-C-2.2 · Pass: 3_

    _Decomposition rationale:_ External provider call is the atomic action realizing the email channel commitment; routing logic from sibling 2.2 dictates channel selection.

    _Surfaced assumptions:_ A-0287, A-0288, A-0289
##### US-012-C-2.4 `[Tier C · pending]`

**As a** Audit Writer, **I want** Create immutable audit entry for exception creation, **so that** Batch audit log updated to reflect exception processing.

**Acceptance criteria:**
  - **AC-002.4** — Audit entry records the exception creation event.
    - _Measurable:_ SELECT COUNT(*) FROM audit_log WHERE event_type = 'EXCEPTION_CREATED' AND related_id = :id >= 1

_Status: pending · Priority: high · Tier: C · Traces to: US-012-C-3 · Pass: 2_

_Decomposition rationale:_ Satisfies COMP-1/COMP-2 audit requirements; links exception handling to immutable audit trail defined in sibling C-3.

_Surfaced assumptions:_ A-0128, A-0129

  - **US-012-C-2.4.1** `[Tier C · pending]`
    **As a** Database Architect, **I want** Enforce append-only constraint on audit log table, **so that** Rows representing exception creation events cannot be modified or deleted.

    **Acceptance criteria:**
      - **AC-01** — Immutability constraint prevents UPDATE/DELETE on audit rows.
        - _Measurable:_ Attempt to UPDATE or DELETE row in ENT-AUDIT-LOG for exception_event raises error code 100 or equivalent.

    _Status: pending · Priority: critical · Tier: C · Traces to: US-012-C-3 · Pass: 3_

    _Decomposition rationale:_ This child defines the primary architectural choice (immutable storage) that distinguishes the audit trail from operational logs, binding the system to compliance rules.

    _Surfaced assumptions:_ A-0290, A-0291, A-0292, A-0293
    - **US-012-C-2.4.1.1** `[Tier C · pending]`
      **As a** DB Architect, **I want** Apply database-level constraint to ENT-AUDIT-LOG, **so that** No UPDATE or DELETE statements succeed on the audit log table.

      **Acceptance criteria:**
        - **AC-001** — Attempted modification to ENT-AUDIT-LOG fails immediately.
          - _Measurable:_ Every SQL statement attempting UPDATE or DELETE on table ENT-AUDIT-LOG throws a database-specific error code (e.g., PostgreSQL error 100).

      _Status: pending · Priority: critical · Tier: C · Traces to: ENT-AUDIT-LOG, TECH-8, COMP-1 · Pass: 4_

      _Decomposition rationale:_ This child enforces the constraint directly at the storage layer, utilizing PostgreSQL constraints (CHECK or ON UPDATE) as permitted by assumption A-0290. It binds the immutability policy to the schema design.

      _Surfaced assumptions:_ A-0582, A-0583
    - **US-012-C-2.4.1.2** `[Tier C · pending]`
      **As a** Backend Developer, **I want** Implement application-level write validation for audit endpoints, **so that** API layer rejects requests that do not match strict POST criteria or contain invalid mutation data.

      **Acceptance criteria:**
        - **AC-002** — Non-PATCH requests on audit endpoints return 400 Bad Request.
          - _Measurable:_ HTTP 400 status code is returned for any PUT or DELETE request targeting audit routes defined under TECH-6.

      _Status: pending · Priority: high · Tier: C · Traces to: TECH-6, ENT-AUDIT-LOG, COMP-2 · Pass: 4_

      _Decomposition rationale:_ Provides defense-in-depth by intercepting write attempts before they reach the database, ensuring the application respects the audit-only policy.

      _Surfaced assumptions:_ A-0582, A-0583
    - **US-012-C-2.4.1.3** `[Tier D · atomic]`
      **As a** System, **I want** Return standardized error response code 100 on violation, **so that** Clients receive a consistent error response when immutability is violated.

      **Acceptance criteria:**
        - **AC-003** — Error response body contains code 100 for immutability violations.
          - _Measurable:_ Response header 'Content-Type' is application/json and body contains 'error_code': 100

      _Status: atomic · Priority: critical · Tier: D · Traces to: COMP-2, ENT-AUDIT-LOG, US-012-C-2.4.2 · Pass: 4_

      _Decomposition rationale:_ This is a leaf operation defining the specific observable behavior (error response) when the constraint is breached, enabling client-side handling.

      _Surfaced assumptions:_ A-0582, A-0583
    - **US-012-C-2.4.1.4** `[Tier D · atomic]`
      **As a** System, **I want** Persist exception creation event to audit log via batch, **so that** Exception events are captured and logged in the audit trail without alteration.

      **Acceptance criteria:**
        - **AC-004** — Event row appears in ENT-AUDIT-LOG after creation transaction commits.
          - _Measurable:_ Querying ENT-AUDIT-LOG returns the exception_event_id within 10 seconds of the creation transaction commit, assuming batch interval defaults per A-0291.

      _Status: atomic · Priority: high · Tier: D · Traces to: US-012-C-2.4.3, ENT-AUDIT-LOG, WF-6 · Pass: 4_

      _Decomposition rationale:_ Leverages the sibling requirement US-012-C-2.4.3 to define how the initial event is logged, ensuring the leaf operation for capture aligns with batch persistence strategy.

      _Surfaced assumptions:_ A-0582, A-0583
  - **US-012-C-2.4.2** `[Tier D · atomic]`
    **As a** Backend Operator, **I want** Insert row with exception event data into audit log, **so that** A single audit row is created linking to the exception record at commit.

    **Acceptance criteria:**
      - **AC-02** — Audit row exists with valid exception ID and event type.
        - _Measurable:_ SELECT * FROM ENT-AUDIT-LOG WHERE related_id = :exception_queue_id AND event_type = 'EXCEPTION_CREATED'; Returns exactly 1 row.

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-012-C-3 · Pass: 3_

    _Decomposition rationale:_ This is the leaf operation that physically executes the logging requirement. It is atomic and directly testable against the acceptance criteria provided in the parent.

    _Surfaced assumptions:_ A-0290, A-0291, A-0292, A-0293
  - **US-012-C-2.4.3** `[Tier C · pending]`
    **As a** Workflow Engineer, **I want** Configure batch job to process audit events periodically, **so that** Exception events are persisted to the audit log via scheduled batch process.

    **Acceptance criteria:**
      - **AC-03** — Batch job processes pending events without data loss.
        - _Measurable:_ Last processed timestamp = Current Time - Batch Interval <= 5 minutes.

    _Status: pending · Priority: medium · Tier: C · Traces to: US-012-C-3, US-012-C-2.1 · Pass: 3_

    _Decomposition rationale:_ The parent requirement explicitly mentions 'Batch audit log', implying an async/batch strategy. This child defines the mechanism (job schedule) to reconcile exception events into the log.

    _Surfaced assumptions:_ A-0290, A-0291, A-0292, A-0293
    - **US-012-C-2.4.3.1** `[Tier C · pending]`
      **As a** Workflow Architect, **I want** Implement DBOS periodic workflow to trigger audit event processing, **so that** The scheduled job executes at the configured interval, ensuring timely processing of pending events..

      **Acceptance criteria:**
        - **AC-03.1** — The workflow schedules consistently according to the configured interval.
          - _Measurable:_ Next execution timestamp equals current timestamp + batch_interval, rounded to system precision.

      _Status: pending · Priority: critical · Tier: C · Traces to: US-012-C-2.4.3, US-012-C-2.4.2 · Pass: 4_

      _Decomposition rationale:_ Commits to DBOS (TECH-7) as the scheduling technology, binding the implementation to the system-of-action workflow engine rather than external cron jobs.

      _Surfaced assumptions:_ A-0584, A-0585, A-0586
    - **US-012-C-2.4.3.2** `[Tier C · pending]`
      **As a** Data Modeler, **I want** Enforce status-based selection for batch queue visibility, **so that** Only events marked 'pending' are eligible for the batch job, preventing duplicate processing of processed events..

      **Acceptance criteria:**
        - **AC-03.2** — Events with a 'processed' status are invisible to the batch query.
          - _Measurable:_ Query filter 'status = pending' returns zero rows for any row where 'status = processed'.

      _Status: pending · Priority: high · Tier: C · Traces to: US-012-C-2.4.3, US-012-C-2.4.2 · Pass: 4_

      _Decomposition rationale:_ Defines the operational scope of 'pending events' by introducing a status field, separating the 'processing' phase from the 'completed' phase to ensure AC-03 (no data loss).

      _Surfaced assumptions:_ A-0584, A-0585, A-0586
    - **US-012-C-2.4.3.3** `[Tier C · pending]`
      **As a** Reliability Engineer, **I want** Configure retry policy and dead-letter queue for failed batch runs, **so that** Transient failures do not cause data loss; events are eventually persisted to the audit log..

      **Acceptance criteria:**
        - **AC-03.3** — Events that fail processing are re-queued or moved to a dead-letter table for human review.
          - _Measurable:_ Event 'status' transitions to 'failed' and retries resume until success or TTL exhaustion.

      _Status: pending · Priority: high · Tier: C · Traces to: US-012-C-2.4.3, US-012-C-2.4.1 · Pass: 4_

      _Decomposition rationale:_ Addresses the 'without data loss' requirement in AC-03 by committing to a specific error handling strategy that preserves audit integrity.

      _Surfaced assumptions:_ A-0584, A-0585, A-0586
#### US-012-C-3 `[Tier C · pending]`

**As a** CAM operator, **I want** Write immutable batch audit entry, **so that** ENT-AUDIT-LOG records the reconciliation batch details.

**Acceptance criteria:**
  - **AC-003** — Audit log entry is created for every reconciliation run and includes batch ID and timestamp.
    - _Measurable:_ exists in ENT-AUDIT-LOG WHERE batch_id = reconciliation_run.id AND is_immutable = true

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-13 · Pass: 1_

_Decomposition rationale:_ Compliance commitment. This enforces the requirement that Audit saved (AC-024) is met through a specific architectural constraint (append-only).

_Surfaced assumptions:_ A-0036, A-0037

##### US-012-LOG-1.1 `[Tier B · pending]`

**As a** Architectural Choice, **I want** Enforce append-only storage pattern for audit entries, **so that** Log records cannot be modified or deleted after initial commit.

**Acceptance criteria:**
  - **AC-1.1.1** — No write operations modify existing rows in audit table.
    - _Measurable:_ UPDATE audit_log SET ... returns false or is prevented at storage layer

_Status: pending · Priority: critical · Tier: B · Traces to: UJ-13 · Pass: 2_

_Decomposition rationale:_ The 'immutable' requirement mandates a specific architectural strategy (Append-Only) rather than simple application logic; this binds the storage backend choice.

_Surfaced assumptions:_ A-0130, A-0131, A-0132

  - **US-012-LOG-1.1.1** `[Tier C · pending]`
    **As a** storage engine, **I want** reject UPDATE statements on existing audit log rows, **so that** Existing audit rows are never modified in place; new records are appended only.

    **Acceptance criteria:**
      - **AC-1.1.1.U** — UPDATE audit_log returns an error or zero rows affected
        - _Measurable:_ SELECT COUNT(*) FROM audit_log WHERE id = ? AND updated_at = ? returns 0 if update attempted on existing primary key

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-13 · Pass: 3_

    _Decomposition rationale:_ Separates the 'no write' policy into the specific operation (UPDATE) that is the primary threat to data integrity; this is an individually-decidable implementation constraint.

    _Surfaced assumptions:_ A-0370, A-0371
  - **US-012-LOG-1.1.2** `[Tier C · pending]`
    **As a** storage engine, **I want** reject DELETE statements on existing audit log rows, **so that** Existing audit rows are never deleted; history remains intact.

    **Acceptance criteria:**
      - **AC-1.1.1.D** — DELETE audit_log returns an error or zero rows affected
        - _Measurable:_ DELETE FROM audit_log WHERE id = ? returns 0 rows affected for valid existing primary keys

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-13 · Pass: 3_

    _Decomposition rationale:_ Separates the 'no write' policy into the specific operation (DELETE) that would remove historical evidence; this is an individually-decidable implementation constraint.

    _Surfaced assumptions:_ A-0370, A-0371
##### US-012-LOG-1.2 `[Tier D · atomic]`

**As a** Leaf Operation, **I want** Persist reconciliation batch identifier, **so that** Every audit log row contains a unique batch ID matching the run..

**Acceptance criteria:**
  - **AC-1.2.1** — Audit log entry batch_id equals reconciliation run id.
    - _Measurable:_ audit_log.batch_id = reconciliation_run.id for all rows

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-13 · Pass: 2_

_Decomposition rationale:_ Capturing the batch ID is an atomic data persistence action required to satisfy the content of the audit entry.

_Surfaced assumptions:_ A-0130, A-0131, A-0132

##### US-012-LOG-1.3 `[Tier D · atomic]`

**As a** Leaf Operation, **I want** Persist system timestamp at write time, **so that** Every audit log row contains a capture timestamp..

**Acceptance criteria:**
  - **AC-1.3.1** — Audit log entry timestamp reflects write commit time.
    - _Measurable:_ audit_log.timestamp >= NOW() at write time

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-13 · Pass: 2_

_Decomposition rationale:_ Recording the time of entry is an atomic operation defining the temporal boundary of the audit record.

_Surfaced assumptions:_ A-0130, A-0131, A-0132

##### US-012-LOG-1.4 `[Tier C · pending]`

**As a** Implementation Commitment, **I want** Validate reconciliation run state before audit write, **so that** System prevents writing audit entry if reconciliation is incomplete..

**Acceptance criteria:**
  - **AC-1.4.1** — Write operation fails if batch_id is null or state is invalid.
    - _Measurable:_ INSERT ... WHERE batch_id IS NOT NULL AND status = 'COMPLETED'

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-13 · Pass: 2_

_Decomposition rationale:_ Ensures only valid reconciliation results trigger the immutable write, guarding against partial data logging.

_Surfaced assumptions:_ A-0130, A-0131, A-0132

  - **US-012-LOG-1.4.1** `[Tier D · atomic]`
    **As a** DB Constraint, **I want** Enforce Batch ID non-null constraint at write, **so that** Insert fails if batch_id is null.

    **Acceptance criteria:**
      - **AC-1.4.1-1** — Insert operation throws error when batch_id is null.
        - _Measurable:_ INSERT statement returns error code when batch_id IS NULL

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-13 · Pass: 3_

    _Decomposition rationale:_ Extracts the Batch ID validation from the compound acceptance criteria into an atomic, testable database constraint.

    _Surfaced assumptions:_ A-0294, A-0295
  - **US-012-LOG-1.4.2** `[Tier D · atomic]`
    **As a** DB Constraint, **I want** Enforce Reconciliation Status check at write, **so that** Insert fails if status != 'COMPLETED'.

    **Acceptance criteria:**
      - **AC-1.4.1-2** — Insert operation throws error when status is not 'COMPLETED'.
        - _Measurable:_ INSERT statement returns error code when status != 'COMPLETED'

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-13 · Pass: 3_

    _Decomposition rationale:_ Extracts the Reconciliation Status validation from the compound acceptance criteria into an atomic, testable database constraint.

    _Surfaced assumptions:_ A-0294, A-0295
### FR US-013 `[pending]`

**As a** Board Member, **I want** View and Download Association Documents, **so that** Member accesses Bylaws and contracts securely.

**Acceptance criteria:**
  - **AC-025** — Document viewed
    - _Measurable:_ Download of ENT-DIST-DOC successful and access logged to ENT-AUDIT-LOG
  - **AC-026** — Access restricted
    - _Measurable:_ Only roles in ENT-BOARD-MEMBER can view ENT-BYLAWS

_Status: pending · Priority: medium · Traces to: UJ-15, WF-8, ENT-BYLAWS, ENT-DIST-DOC · Pass: 0_

#### US-013-C-01 `[Tier C · pending]`

**As a** Security Architect, **I want** Validate user role entitlement via policy engine, **so that** Request is denied (403) if user lacks ENT-BOARD-MEMBER role.

**Acceptance criteria:**
  - **AC-C-01** — Unauthorized users receive 403 Forbidden.
    - _Measurable:_ HTTP 403 status code is returned when ENT-USER.role != ENT-BOARD-MEMBER for resource ENT-BYLAWS

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-15, WF-8, ENT-BOARD-MEMBER, ENT-ROLE, TECH-10 · Pass: 1_

_Decomposition rationale:_ Security is a gating commitment before any content is served. Cerbos is the explicit policy engine, making this an implementation choice rather than a generic requirement.

_Surfaced assumptions:_ A-0038, A-0039, A-0040

##### US-013-C-01-A `[Tier C · pending]`

**As a** Authentication Gatekeeper, **I want** Verify session validity before policy check, **so that** Request proceeds only if user session token is valid.

**Acceptance criteria:**
  - **AC-101** — Session token is valid and not expired.
    - _Measurable:_ session_validated === true and token_expiry > now()

_Status: pending · Priority: critical · Tier: C · Traces to: ENT-SESSION-TOKEN, UJ-15 · Pass: 2_

_Decomposition rationale:_ Ensures the identity is trusted before invoking the policy engine, preventing unauthorized access attempts without valid identity tokens.

_Surfaced assumptions:_ A-0133, A-0134

  - **US-013-C-01-A.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Validate JWT signature against trusted public keys, **so that** No request is processed if the token signature cannot be verified.

    **Acceptance criteria:**
      - **AC-101-1** — Token signature matches public key from configuration
        - _Measurable:_ crypto.verifySign(data, signature, public_keys) === true

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-SESSION-TOKEN · Pass: 3_

    _Decomposition rationale:_ This child specifies the cryptographic implementation choice required to ensure token integrity before trusting its claims. It binds the system to a specific security protocol.

    _Surfaced assumptions:_ A-0296, A-0297
    - **US-013-C-01-A.1.1** `[Tier C · pending]`
      **As a** Key Manager, **I want** Load and cache trusted public keys from secure configuration store, **so that** Trusted keys are available for the verification process without blocking the request flow.

      **Acceptance criteria:**
        - **AC-101-1.1** — Keys are available in memory before verification attempt
          - _Measurable:_ crypto.keyCache.contains(key) is true for configured keys at request time

      _Status: pending · Priority: critical · Tier: C · Traces to: US-013-C-01-A.1 · Pass: 4_

      _Decomposition rationale:_ Verifying a signature requires keys. Loading keys is a distinct implementation commitment that supports the verification step.

      _Surfaced assumptions:_ A-0587, A-0588, A-0589, A-0590
    - **US-013-C-01-A.1.2** `[Tier D · atomic]`
      **As a** Cryptographic Operator, **I want** Execute signature verification against loaded public key, **so that** Determination of whether the signature is cryptographically valid for the given payload.

      **Acceptance criteria:**
        - **AC-101-1.2** — Verification result is binary (valid/invalid)
          - _Measurable:_ crypto.verifySign(data, signature, public_keys) returns boolean without throwing

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-013-C-01-A.1 · Pass: 4_

      _Decomposition rationale:_ The core atomic operation of the parent requirement. This is the leaf action where the cryptographic invariant is checked.

      _Surfaced assumptions:_ A-0587, A-0588, A-0589, A-0590
    - **US-013-C-01-A.1.3** `[Tier C · pending]`
      **As a** Security Policy Handler, **I want** Reject request and log audit entry when signature is invalid, **so that** Invalid tokens are blocked from reaching downstream logic and security events are recorded.

      **Acceptance criteria:**
        - **AC-101-1.3** — System returns 401 Unauthorized for failed verification
          - _Measurable:_ http.response_code === 401 and audit_log.contains(entry for failed_sig)

      _Status: pending · Priority: critical · Tier: C · Traces to: US-013-C-01-A.1 · Pass: 4_

      _Decomposition rationale:_ Defines the policy consequence of the verification result. This is a commitment on behavior (what to do when verification fails) rather than the raw operation.

      _Surfaced assumptions:_ A-0587, A-0588, A-0589, A-0590
  - **US-013-C-01-A.2** `[Tier C · pending]`
    **As a** CAM operator, **I want** Check token expiration claim against system time, **so that** Expired tokens are rejected immediately to prevent active sessions from exceeding validity.

    **Acceptance criteria:**
      - **AC-101-2** — Token 'exp' claim is not earlier than system time + tolerance
        - _Measurable:_ token_expiry > (system_clock() + 30000ms)

    _Status: pending · Priority: critical · Tier: C · Traces to: ENT-SESSION-TOKEN · Pass: 3_

    _Decomposition rationale:_ This child defines the specific algorithm for time-based validation, introducing a concrete tolerance threshold for clock synchronization errors.

    _Surfaced assumptions:_ A-0296, A-0297
    - **US-013-C-01-A.2.1** `[Tier D · atomic]`
      **As a** Token Parser, **I want** Extract 'exp' claim from signature-verified JWT payload, **so that** Numeric timestamp of token expiration is available.

      **Acceptance criteria:**
        - **AC-101-2.1** — JWT parsing function returns 'exp' if claim exists and signature is valid.
          - _Measurable:_ JSON.parse(token_payload).exp !== undefined AND signature_verify === true

      _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-SESSION-TOKEN · Pass: 4_

      _Decomposition rationale:_ Atomic operation: Extracting a specific field from a verified structure is a leaf-level data access task.

      _Surfaced assumptions:_ A-0591, A-0592
    - **US-013-C-01-A.2.2** `[Tier C · pending]`
      **As a** System Clock Provider, **I want** Acquire authoritative system time from runtime environment, **so that** Current server timestamp is available for comparison.

      **Acceptance criteria:**
        - **AC-101-2.2** — System time is read from the backend runtime's clock source.
          - _Measurable:_ Timestamp retrieved from TEH-6 or OS source === Date.now() within 1ms

      _Status: pending · Priority: critical · Tier: C · Traces to: TECH-6 · Pass: 4_

      _Decomposition rationale:_ Commitment to use the runtime's clock (TECH-6/Bun) rather than client time; ensures defense-in-depth against client clock skew.

      _Surfaced assumptions:_ A-0591, A-0592
    - **US-013-C-01-A.2.3** `[Tier D · atomic]`
      **As a** Threshold Calculator, **I want** Compute minimum valid expiration threshold, **so that** Threshold value (system_clock + 30000ms) is computed.

      **Acceptance criteria:**
        - **AC-101-2.3** — Threshold calculation yields the correct integer value in milliseconds.
          - _Measurable:_ threshold === system_clock + 30000

      _Status: atomic · Priority: high · Tier: D · Traces to: ENT-SESSION-TOKEN · Pass: 4_

      _Decomposition rationale:_ Mathematical commitment to the 30s tolerance defined in the AC; ensures consistency across requests.

      _Surfaced assumptions:_ A-0591, A-0592
    - **US-013-C-01-A.2.4** `[Tier C · pending]`
      **As a** Session Policy Bypass, **I want** Skip policy engine if token validation fails, **so that** Policy request is not sent for expired tokens.

      **Acceptance criteria:**
        - **AC-101-2.4** — If token is expired, the request is terminated before policy evaluation.
          - _Measurable:_ if (token_expiry < threshold) return 401; policy_engine_call === false

      _Status: pending · Priority: critical · Tier: C · Traces to: US-013-C-01-A.4 · Pass: 4_

      _Decomposition rationale:_ Aligns with sibling commitment A.4; prevents unnecessary latency by short-circuiting policy evaluation for invalid tokens.

      _Surfaced assumptions:_ A-0591, A-0592
  - **US-013-C-01-A.3** `[Tier C · pending]`
    **As a** CAM operator, **I want** Fetch session data from high-performance cache, **so that** Token data is available without blocking downstream policy evaluation.

    **Acceptance criteria:**
      - **AC-101-3** — Token data retrieval latency is under 5ms
        - _Measurable:_ latency(token_fetch) <= 5ms

    _Status: pending · Priority: high · Tier: C · Traces to: US-013-C-01-C · Pass: 3_

    _Decomposition rationale:_ This child commits to a specific architectural constraint (caching) to ensure session validation does not introduce latency into the synchronous policy workflow defined in sibling B and C.

    _Surfaced assumptions:_ A-0296, A-0297
    - **US-013-C-01-A.3.1** `[Tier C · pending]`
      **As a** System Architect, **I want** Select Redis as the high-performance cache engine, **so that** Session data persists in a key-value store accessible by the Node.js origin.

      **Acceptance criteria:**
        - **AC-101-3.1** — Cache store connects to Node.js origin without direct client exposure.
          - _Measurable:_ Connection string points to Redis cluster; port 6379 restricted to origin network; public access denied.

      _Status: pending · Priority: critical · Tier: C · Traces to: US-013-C-01-A.1 · Pass: 4_

      _Decomposition rationale:_ This child binds the specific technology choice. It distinguishes the engineering strategy (Redis) from generic caching, forcing a commitment to a specific infrastructure component.

      _Surfaced assumptions:_ A-0593, A-0594
    - **US-013-C-01-A.3.2** `[Tier C · pending]`
      **As a** System Config, **I want** Define Token TTL to 30 minutes, **so that** Cache entries expire before downstream token validity allows, preventing stale sessions.

      **Acceptance criteria:**
        - **AC-101-3.2** — Token TTL is strictly less than token validity.
          - _Measurable:_ TTL_seconds = 1800; token_expiration_seconds >= 1800 for all valid sessions.

      _Status: pending · Priority: high · Tier: C · Traces to: US-013-C-01-A.2 · Pass: 4_

      _Decomposition rationale:_ This child establishes the temporal boundary for the cache, directly addressing the 'expiry' sibling's logic while preventing cache hits on expired tokens.

      _Surfaced assumptions:_ A-0593, A-0594
    - **US-013-C-01-A.3.3** `[Tier C · pending]`
      **As a** System Admin, **I want** Enforce cache invalidation on logout, **so that** Active session tokens are removed from cache when user terminates the session.

      **Acceptance criteria:**
        - **AC-101-3.3** — Logout request triggers immediate cache invalidation.
          - _Measurable:_ Cache TTL update event must fire within 10ms of logout API call completion.

      _Status: pending · Priority: critical · Tier: C · Traces to: US-013-C-01-A.4 · Pass: 4_

      _Decomposition rationale:_ This child aligns with the sibling 'Skip policy on failure' by ensuring the session state is authoritative in the cache. It prevents unauthorized access after logout.

      _Surfaced assumptions:_ A-0593, A-0594
  - **US-013-C-01-A.4** `[Tier C · pending]`
    **As a** CAM operator, **I want** Skip policy engine on session failure, **so that** Policy request is never sent if session validity check fails.

    **Acceptance criteria:**
      - **AC-101-4** — Cerbos API is not called when session validation fails
        - _Measurable:_ cerbos_request_sent === false when session_validated === false

    _Status: pending · Priority: critical · Tier: C · Traces to: US-013-C-01-C · Pass: 3_

    _Decomposition rationale:_ This child defines the branching logic in the authorization workflow, explicitly decoupling the policy check from invalid sessions to prevent unnecessary resource consumption and reduce policy evaluation time.

    _Surfaced assumptions:_ A-0296, A-0297
    - **US-013-C-01-A.4-C1** `[Tier D · atomic]`
      **As a** Flow Control Unit, **I want** Evaluate session validity status from upstream checks, **so that** Determine if the session state is 'validated' or 'failure' (based on A.1, A.2, A.3 results).

      **Acceptance criteria:**
        - **AC-D1-001** — System returns 'session_failure' if any upstream check (A.1, A.2, A.3) returns false.
          - _Measurable:_ session_validated == false implies status === 'failure' AND (A.1_status == fail OR A.2_status == fail OR A.3_status == fail)

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-013-C-01-A.4, US-013-C-01-C · Pass: 4_

      _Decomposition rationale:_ This leaf operation defines the input condition for the skip logic. It aggregates the upstream check states (siblings A.1, A.2, A.3) into a single binary state required to trigger the bypass.

      _Surfaced assumptions:_ A-0595, A-0596
    - **US-013-C-01-A.4-C2** `[Tier D · atomic]`
      **As a** Policy Engine Bypass Guard, **I want** Suppress Cerbos API invocation request, **so that** No outbound HTTP request is sent to the Cerbos policy engine service.

      **Acceptance criteria:**
        - **AC-D2-001** — Cerbos API call count is zero when session failure is detected.
          - _Measurable:_ cerbos_request_sent === false AND session_validated === false

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-013-C-01-A.4, US-013-C-01-C · Pass: 4_

      _Decomposition rationale:_ This is the core functional action of the requirement. It implements the 'Skip' directive as a binary outcome (call or no call) conditioned on the state of C1.

      _Surfaced assumptions:_ A-0595, A-0596
    - **US-013-C-01-A.4-C3** `[Tier D · atomic]`
      **As a** Audit Event Recorder, **I want** Log session failure and bypass event to audit trail, **so that** Immutable record exists proving the skip occurred and the session state at time of check.

      **Acceptance criteria:**
        - **AC-D3-001** — Audit log entry contains 'skip_reason' and 'session_status'.
          - _Measurable:_ audit_log.entries.length >= 1 AND audit_log.entries[0].action === 'policy_bypass' AND audit_log.entries[0].timestamp === current_time

      _Status: atomic · Priority: high · Tier: D · Traces to: US-013-C-01-A.4, US-013-C-01-C · Pass: 4_

      _Decomposition rationale:_ Ensures compliance and traceability. Even when optimization bypasses the engine, the decision itself is recorded to prevent unauthorized session termination later in the audit process.

      _Surfaced assumptions:_ A-0595, A-0596
##### US-013-C-01-B `[Tier C · pending]`

**As a** Policy Context Builder, **I want** Construct policy evaluation context for Cerbos, **so that** Policy request includes user ID, resource (ENT-BYLAWS), and action (VIEW).

**Acceptance criteria:**
  - **AC-102** — Policy request payload matches Cerbos API schema.
    - _Measurable:_ request_body.user_id === user.id and request_body.resource === 'ENT-BYLAWS'

_Status: pending · Priority: high · Tier: C · Traces to: ENT-USER, ENT-BYLAWS, TECH-10 · Pass: 2_

_Decomposition rationale:_ Cerbos (TECH-10) requires specific context for decision making; this step binds the application identity to the policy engine's schema.

_Surfaced assumptions:_ A-0133, A-0134

  - **US-013-C-01-B-C-01** `[Tier C · pending]`
    **As a** CAM operator, **I want** Populate request user_id from active session, **so that** Policy request contains the authenticated user identifier from the session token.

    **Acceptance criteria:**
      - **AC-001** — request_body.user_id matches the user.id in the session.
        - _Measurable:_ request_body.user_id === session.token.user.id for every request

    _Status: pending · Priority: high · Tier: C · Traces to: US-013-C-01-A, ENT-USER, AC-102 · Pass: 3_

    _Decomposition rationale:_ Sources the user identity from the verified session (Sibling A) rather than a DB lookup, ensuring alignment with session lifecycle management and security posture.

    _Surfaced assumptions:_ A-0298
    - **US-013-C-01-B-C-01-A1** `[Tier D · atomic]`
      **As a** Auth Service, **I want** Locate active session token from request context, **so that** Session token data object is retrieved and ready for extraction.

      **Acceptance criteria:**
        - **AC-101** — System resolves active session token from auth header or bearer token
          - _Measurable:_ Session object is retrieved and validated against session store within 10ms of request arrival

      _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-USER, US-013-C-01-A · Pass: 4_

      _Decomposition rationale:_ Populating the user ID requires a valid session token first; this child commits to the prerequisite lookup step.

      _Surfaced assumptions:_ A-0597
    - **US-013-C-01-B-C-01-A2** `[Tier D · atomic]`
      **As a** Auth Service, **I want** Extract user identifier claim from session token, **so that** User ID string is parsed from the token payload claims.

      **Acceptance criteria:**
        - **AC-102** — Extracted value matches the 'user.id' claim in the session object
          - _Measurable:_ Extracted string equals session.token.user.id for 100% of requests with valid tokens

      _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-USER, AC-102 · Pass: 4_

      _Decomposition rationale:_ The core requirement is mapping the specific claim to the request field; this child isolates the extraction logic.

      _Surfaced assumptions:_ A-0597
    - **US-013-C-01-B-C-01-A3** `[Tier D · atomic]`
      **As a** Request Composer, **I want** Populate policy request body with extracted user ID, **so that** Outgoing policy request contains the user_id field.

      **Acceptance criteria:**
        - **AC-103** — Request body 'user_id' matches extracted ID
          - _Measurable:_ request_body.user_id === extracted_user_id for every outgoing Cerbos request

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-013-C-01-B-C-02, US-013-C-01-B-C-03 · Pass: 4_

      _Decomposition rationale:_ This step connects the extracted ID to the subsequent serialization steps defined in sibling contexts.

      _Surfaced assumptions:_ A-0597
  - **US-013-C-01-B-C-02** `[Tier C · pending]`
    **As a** CAM operator, **I want** Populate request resource as ENT-BYLAWS, **so that** Policy request specifies ENT-BYLAWS as the resource being evaluated.

    **Acceptance criteria:**
      - **AC-002** — request_body.resource is set to the literal string 'ENT-BYLAWS'.
        - _Measurable:_ request_body.resource === 'ENT-BYLAWS' for every request

    _Status: pending · Priority: high · Tier: C · Traces to: AC-102, ENT-BYLAWS · Pass: 3_

    _Decomposition rationale:_ Defines the specific resource entity type for this policy check context, binding the integration to the Bylaws domain entity.

    _Surfaced assumptions:_ A-0298
    - **FR-ACCT-1.1** `[Tier D · atomic]`
      **As a** payload_builder, **I want** resolve canonical bylaw identifier, **so that** Request payload includes the correct bylaw entity ID as a string.

      **Acceptance criteria:**
        - **AC-1.1** — Resource field maps to the ENT-BYLAWS entity ID
          - _Measurable:_ request_body.resource === 'ENT-BYLAWS' in the constructed JSON object

      _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-BYLAWS · Pass: 4_

      _Decomposition rationale:_ Breaks the population action into the specific resolution of the canonical entity ID from the ENT-BYLAWS record; ensures the string literal matches the entity definition.

      _Surfaced assumptions:_ A-0598
    - **FR-ACCT-1.2** `[Tier D · atomic]`
      **As a** policy_requester, **I want** construct Cerbos request body, **so that** Valid JSON payload is formed containing the bylaw resource identifier.

      **Acceptance criteria:**
        - **AC-1.2** — Constructed object conforms to policy engine schema
          - _Measurable:_ JSON schema validation of request_body passes before transmission to engine

      _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-10 · Pass: 4_

      _Decomposition rationale:_ Commitment to format the data for the policy engine (TECH-10), ensuring the resource field is included in the payload sent for authorization decisions.

      _Surfaced assumptions:_ A-0598
  - **US-013-C-01-B-C-03** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Serialize JSON payload for Cerbos API, **so that** A valid JSON object is formed matching Cerbos schema and submitted to the engine.

    **Acceptance criteria:**
      - **AC-003** — Serialized payload conforms to Cerbos API schema version.
        - _Measurable:_ JSON payload passes Cerbos schema validation at client-side before network send

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-013-C-01-C, AC-102 · Pass: 3_

    _Decomposition rationale:_ This is an atomic operation (Serialization) that transforms the constructed fields into the transmission format required by the API endpoint.

    _Surfaced assumptions:_ A-0298
##### US-013-C-01-C `[Tier C · pending]`

**As a** Authorization Decision Fetcher, **I want** Invoke Cerbos policy engine API, **so that** System receives 'allowed' or 'denied' response from Cerbos.

**Acceptance criteria:**
  - **AC-103** — Policy engine response is returned within timeout.
    - _Measurable:_ engine_response.status === 'denied' || engine_response.status === 'allowed'

_Status: pending · Priority: critical · Tier: C · Traces to: TECH-10 · Pass: 2_

_Decomposition rationale:_ Direct execution of the architectural commitment to use the policy engine as the source of truth for entitlements.

_Surfaced assumptions:_ A-0133, A-0134

  - **US-013-C-01-C-1** `[Tier C · pending]`
    **As a** Protocol Handler, **I want** Configure network timeout for Cerbos client, **so that** Request fails gracefully with timeout error if Cerbos does not respond within configured limit.

    **Acceptance criteria:**
      - **AC-001** — Cerbos API call respects the maximum timeout duration.
        - _Measurable:_ request_timeout_ms <= 3000 AND engine_response.status === 'denied' || engine_response.status === 'allowed' within window

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-10, TECH-13 · Pass: 3_

    _Decomposition rationale:_ Network latency is an internal implementation risk; defining the timeout constraint binds the system behavior to the availability of TECH-10 and ensures AC-103 is met.

    _Surfaced assumptions:_ A-0299, A-0300, A-0301
    - **US-013-C-01-C-1.1** `[Tier D · atomic]`
      **As a** Client Initiation, **I want** Initialize Cerbos HTTP request with configured timeout duration in header, **so that** Request sent to Cerbos contains timeout configuration parameter.

      **Acceptance criteria:**
        - **AC-001-1** — Request headers include timeout configuration.
          - _Measurable:_ req.headers['timeout'] === config.timeout_ms

      _Status: atomic · Priority: high · Tier: D · Traces to: TECH-10 · Pass: 4_

      _Decomposition rationale:_ Defines the setup action required to bind the timeout configuration to the Cerbos client initialization.

      _Surfaced assumptions:_ A-0599
    - **US-013-C-01-C-1.2** `[Tier D · atomic]`
      **As a** Connection Termination, **I want** Terminate request stream if elapsed duration exceeds configured limit, **so that** Network connection is forcibly closed before deadline expiry.

      **Acceptance criteria:**
        - **AC-001-2** — Stream closed upon timeout expiry.
          - _Measurable:_ socket.isClosed() === true after timeout_ms elapsed

      _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-10 · Pass: 4_

      _Decomposition rationale:_ Defines the runtime enforcement action that physically stops waiting for an unresponsive Cerbos engine.

      _Surfaced assumptions:_ A-0599
    - **US-013-C-01-C-1.3** `[Tier D · atomic]`
      **As a** Error Mapping, **I want** Return HTTP 504 error code to client upon timeout, **so that** Client receives standardized error code indicating gateway timeout rather than policy denial.

      **Acceptance criteria:**
        - **AC-001-3** — Response status code is 504 on timeout.
          - _Measurable:_ response.status === 504 AND response.body.includes('timeout')

      _Status: atomic · Priority: high · Tier: D · Traces to: TECH-10 · Pass: 4_

      _Decomposition rationale:_ Ensures the client knows the request failed due to network latency rather than authorization logic.

      _Surfaced assumptions:_ A-0599
    - **US-013-C-01-C-1.4** `[Tier D · atomic]`
      **As a** Observability, **I want** Log timeout event to observability pipeline, **so that** Event recorded for debugging Cerbos latency issues.

      **Acceptance criteria:**
        - **AC-001-4** — Event logged within 1 second of timeout.
          - _Measurable:_ ENT-AUDIT-LOG entry exists within 1s AND contains 'timeout' keyword

      _Status: atomic · Priority: medium · Tier: D · Traces to: TECH-13 · Pass: 4_

      _Decomposition rationale:_ Binds the failure event to the observability stack (TECH-13) for root cause analysis.

      _Surfaced assumptions:_ A-0599
  - **US-013-C-01-C-2** `[Tier C · pending]`
    **As a** Protocol Handler, **I want** Validate policy request payload schema, **so that** Request body matches Cerbos expected schema before transmission.

    **Acceptance criteria:**
      - **AC-002** — Payload serialization passes Zod validation before network call.
        - _Measurable:_ payload.schema_valid === true before POST to Cerbos endpoint

    _Status: pending · Priority: high · Tier: C · Traces to: TECH-9 · Pass: 3_

    _Decomposition rationale:_ Using oRPC (TECH-9) implies strict typing; validating schema ensures the integration layer does not send malformed data that could break the policy engine connection.

    _Surfaced assumptions:_ A-0299, A-0300, A-0301
    - **US-013-C-01-C-2-1** `[Tier D · atomic]`
      **As a** Validation Operator, **I want** Assert presence of required fields, **so that** Payload cannot proceed if 'userId' or 'resourceId' is missing.

      **Acceptance criteria:**
        - **AC-002.1** — Required keys exist in payload object.
          - _Measurable:_ payload.userId !== undefined && payload.resourceId !== undefined && payload.action !== undefined

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-013-C-01-C-2, TECH-9 · Pass: 4_

      _Decomposition rationale:_ Structural validation is the atomic unit of schema checking; absence of a key is a fundamental failure mode testable independently.

      _Surfaced assumptions:_ A-0600
    - **US-013-C-01-C-2-2** `[Tier D · atomic]`
      **As a** Validation Operator, **I want** Assert data type constraints, **so that** Payload rejected if field types mismatch schema definitions.

      **Acceptance criteria:**
        - **AC-002.2** — All required fields match their declared Zod types.
          - _Measurable:_ typeof payload.userId === 'string' && payload.userId.match(/^[a-f0-9-]{8}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{12}$/)

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-013-C-01-C-2, TECH-9 · Pass: 4_

      _Decomposition rationale:_ Type safety is the next atomic check after presence; Zod enforces this, making it a testable leaf operation.

      _Surfaced assumptions:_ A-0600
    - **US-013-C-01-C-2-3** `[Tier D · atomic]`
      **As a** Validation Operator, **I want** Assert enum value constraints, **so that** Payload rejected if 'action' is not in allowed list.

      **Acceptance criteria:**
        - **AC-002.3** — Payload action matches Cerbos decision set.
          - _Measurable:_ 'allow' === payload.action || 'deny' === payload.action || 'request' === payload.action

      _Status: atomic · Priority: high · Tier: D · Traces to: US-013-C-01-C-2, TECH-9 · Pass: 4_

      _Decomposition rationale:_ Validating allowed values is a distinct atomic check from type checking; it rules out invalid states before policy evaluation.

      _Surfaced assumptions:_ A-0600
    - **US-013-C-01-C-2-4** `[Tier D · atomic]`
      **As a** Validation Operator, **I want** Assert strict schema mode, **so that** Payload rejected if extra keys are present outside schema.

      **Acceptance criteria:**
        - **AC-002.4** — Payload keys exactly match schema keys.
          - _Measurable:_ Object.keys(payload).every(k => schemaKeys.includes(k))

      _Status: atomic · Priority: medium · Tier: D · Traces to: US-013-C-01-C-2, TECH-9 · Pass: 4_

      _Decomposition rationale:_ Preventing data leakage or undefined behavior requires rejecting unknown fields; this is a distinct atomic check from required field validation.

      _Surfaced assumptions:_ A-0600
    - **US-013-C-01-C-2-5** `[Tier C · pending]`
      **As a** Error Handler, **I want** Map validation errors to HTTP 400 response, **so that** System responds with 400 Bad Request and error details when validation fails.

      **Acceptance criteria:**
        - **AC-002.5** — HTTP status 400 is returned on validation failure.
          - _Measurable:_ response.status === 400 when Zod throws an error

      _Status: pending · Priority: high · Tier: C · Traces to: US-013-C-01-C-2, TECH-9 · Pass: 4_

      _Decomposition rationale:_ This is an implementation choice (C) rather than a leaf operation because it defines the system's behavioral policy (error mapping) rather than a simple data check. It bridges the validation result to the response layer.

      _Surfaced assumptions:_ A-0600
  - **US-013-C-01-C-3** `[Tier C · pending]`
    **As a** Response Mapper, **I want** Map Cerbos decision to HTTP status code, **so that** Cerbos 'denied' maps to HTTP 403, 'allowed' maps to 200/404.

    **Acceptance criteria:**
      - **AC-003** — Mapped HTTP status code matches Cerbos decision status.
        - _Measurable:_ response.http_status === 403 when cerbos.status === 'denied' AND response.http_status !== 403 when cerbos.status === 'allowed'

    _Status: pending · Priority: critical · Tier: C · Traces to: US-013-C-01-D · Pass: 3_

    _Decomposition rationale:_ Sibling US-013-C-01-D defines the 403 output; this child ensures the mapping logic produces that output without leaking data, fulfilling the sibling's contract.

    _Surfaced assumptions:_ A-0299, A-0300, A-0301
    - **US-013-C-01-C-3-D-01** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Map Cerbos 'denied' decision to HTTP 403, **so that** Client receives 403 status code for denied authorization decisions.

      **Acceptance criteria:**
        - **AC-001** — HTTP 403 returned when Cerbos status is 'denied'
          - _Measurable:_ response.http_status === 403 AND cerbos.status === 'denied'

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-013-C-01-C-1, US-013-C-01-C-4, UJ-1 · Pass: 4_

      _Decomposition rationale:_ Defines the critical path for denied access, ensuring the external HTTP signal matches the internal policy engine outcome.

      _Surfaced assumptions:_ A-0601, A-0602, A-0603
    - **US-013-C-01-C-3-D-02** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Map Cerbos 'allowed' decision to HTTP 200, **so that** Client receives 200 status code for allowed authorization decisions with resource.

      **Acceptance criteria:**
        - **AC-002** — HTTP 200 returned when Cerbos status is 'allowed' and resource exists
          - _Measurable:_ response.http_status === 200 AND cerbos.status === 'allowed' AND resource.exists === true

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-013-C-01-C-2, US-013-C-01-C-4, UJ-3 · Pass: 4_

      _Decomposition rationale:_ Standard success response for allowed access where the requested resource is present.

      _Surfaced assumptions:_ A-0601, A-0602, A-0603
    - **US-013-C-01-C-3-D-03** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Map Cerbos 'allowed' decision to HTTP 404, **so that** Client receives 404 status code for allowed authorization decisions where resource is missing.

      **Acceptance criteria:**
        - **AC-003** — HTTP 404 returned when Cerbos status is 'allowed' and resource missing
          - _Measurable:_ response.http_status === 404 AND cerbos.status === 'allowed' AND resource.exists === false

      _Status: atomic · Priority: high · Tier: D · Traces to: US-013-C-01-C-2, US-013-C-01-C-4, UJ-10 · Pass: 4_

      _Decomposition rationale:_ Handles the edge case where policy permits access but the specific resource instance does not exist.

      _Surfaced assumptions:_ A-0601, A-0602, A-0603
  - **US-013-C-01-C-4** `[Tier C · pending]`
    **As a** Audit Engineer, **I want** Persist decision audit event, **so that** Decision event logged to immutable audit trail immediately after response.

    **Acceptance criteria:**
      - **AC-004** — Audit log entry created within 10ms of decision.
        - _Measurable:_ audit_event_timestamp >= request_timestamp AND audit_entry.immutable === true

    _Status: pending · Priority: high · Tier: C · Traces to: COMP-1, TECH-13 · Pass: 3_

    _Decomposition rationale:_ Comp-1 requires auditable GL structure; audit logging decisions is the compliance equivalent for security operations. Ensures AC-103 compliance for security logs.

    _Surfaced assumptions:_ A-0299, A-0300, A-0301
    - **US-013-C-01-C-4-1** `[Tier C · pending]`
      **As a** Audit Logger, **I want** Validate and capture decision payload into audit record, **so that** Audit entry contains required fields and excludes PII.

      **Acceptance criteria:**
        - **AC-401** — Audit entry payload matches schema and excludes PII.
          - _Measurable:_ entry.data_keys IN [user_id, resource_id, decision_id] AND PII_check === false

      _Status: pending · Priority: critical · Tier: C · Traces to: US-013-C-01-C-2 · Pass: 4_

      _Decomposition rationale:_ This child defines the data contract for the audit log, ensuring data fidelity and privacy alignment with sibling C-2 payload validation.

      _Surfaced assumptions:_ A-0604, A-0605
    - **US-013-C-01-C-4-2** `[Tier C · pending]`
      **As a** Latency Enforcer, **I want** Enforce 10ms timestamp variance constraint, **so that** Audit entry timestamp is within 10ms of decision response.

      **Acceptance criteria:**
        - **AC-402** — Entry timestamp is within 10ms of request response.
          - _Measurable:_ absolute(entry.timestamp - request_timestamp) <= 10ms

      _Status: pending · Priority: critical · Tier: C · Traces to: US-013-C-01-C-1 · Pass: 4_

      _Decomposition rationale:_ This child binds the timing requirement of AC-004 to the timeout configuration sibling C-1, ensuring logging completes before any timeout logic might intervene.

      _Surfaced assumptions:_ A-0604, A-0605
    - **US-013-C-01-C-4-3** `[Tier D · atomic]`
      **As a** Storage Committer, **I want** Persist single audit entry to immutable sequence, **so that** Entry written to append-only storage without deletion capability.

      **Acceptance criteria:**
        - **AC-403** — Entry is successfully written to immutable store.
          - _Measurable:_ storage_op === 'append' AND entry.immutable === true

      _Status: atomic · Priority: critical · Tier: D · Traces to: COMP-1 · Pass: 4_

      _Decomposition rationale:_ This child reduces the immutability AC to the lowest-level atomic storage operation, verifying the write behavior directly against the compliance requirement COMP-1.

      _Surfaced assumptions:_ A-0604, A-0605
##### US-013-C-01-D `[Tier D · atomic]`

**As a** Forbidden Response Formatter, **I want** Emit HTTP 403 response for denied requests, **so that** Client receives 403 Forbidden with no sensitive data leakage.

**Acceptance criteria:**
  - **AC-104** — HTTP status code is 403 and response body is minimal.
    - _Measurable:_ http_status_code === 403 and response_body_size < 100 bytes

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-15 · Pass: 2_

_Decomposition rationale:_ Leaf operation finalizing the failure path when policy determines access is denied, ensuring compliance with the parent's acceptance criteria.

_Surfaced assumptions:_ A-0133, A-0134

#### US-013-C-02 `[Tier C · pending]`

**As a** Content Engineer, **I want** Configure download headers for browser compatibility, **so that** Browser can cache or stream the document without CORS errors.

**Acceptance criteria:**
  - **AC-C-02** — Download headers are correctly set.
    - _Measurable:_ Response includes Content-Disposition, Content-Type, and Access-Control-Allow-Origin headers per SvelteKit/Cloudflare config.

_Status: pending · Priority: high · Tier: C · Traces to: UJ-15, WF-8, ENT-DIST-DOC, TECH-4, TECH-2 · Pass: 1_

_Decomposition rationale:_ Delivery format is an architectural commitment determining user experience and caching behavior, distinct from the data retrieval logic.

_Surfaced assumptions:_ A-0038, A-0039, A-0040

##### US-013-C-02-1 `[Tier C · pending]`

**As a** Header config: disposition, **I want** Enforce Content-Disposition header for download context, **so that** Browser interprets file as download attachment or inline view.

**Acceptance criteria:**
  - **AC-01** — Header Content-Disposition is set to attachment for downloads.
    - _Measurable:_ response_headers['Content-Disposition'] === 'attachment; filename=...'

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-15, ENT-DIST-DOC, WF-8 · Pass: 2_

_Decomposition rationale:_ This child isolates the specific responsibility of determining whether the browser should save the file or render it inline, which is a direct implementation choice for the download feature.

_Surfaced assumptions:_ A-0135, A-0136, A-0137

  - **US-013-C-02-1-A** `[Tier C · pending]`
    **As a** Context Detector, **I want** Identify request intent as download versus inline view context, **so that** System flags download requests to apply specific header logic.

    **Acceptance criteria:**
      - **AC-001** — Request context is detected correctly.
        - _Measurable:_ Request path/query matches download criteria OR file attributes indicate download intent

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-15, WF-8 · Pass: 3_

    _Decomposition rationale:_ Enforcing the header depends on correctly distinguishing download from view; this logic gate is an implementation commitment (Tier C) not an atomic action.

    _Surfaced assumptions:_ A-0302, A-0303, A-0304
    - **US-013-C-02-1-A-1** `[Tier D · atomic]`
      **As a** Request Validator, **I want** Parse and evaluate query string parameters for download intent indicators, **so that** Flag request as 'download' if explicit parameter (e.g. ?download=1) is present.

      **Acceptance criteria:**
        - **AC-001** — Download intent flag is set when query parameter matches configured list.
          - _Measurable:_ if (req.query[download] in ['true', '1']) => context === DOWNLOAD

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-15, WF-8 · Pass: 4_

      _Decomposition rationale:_ This is the first atomic check in the detection chain; it verifies the query param path from UJ-15 and WF-8 before processing headers.

      _Surfaced assumptions:_ A-0606, A-0607, A-0608, A-0609
    - **US-013-C-02-1-A-2** `[Tier D · atomic]`
      **As a** Request Validator, **I want** Evaluate URL path suffixes and canonical routing patterns for download context, **so that** Flag request as 'download' if path matches configured download route patterns.

      **Acceptance criteria:**
        - **AC-002** — Context is 'download' when path matches /dl/ or /assets/ routes.
          - _Measurable:_ if (req.path.startsWith('/dl') || req.path.startsWith('/assets/download')) => context === DOWNLOAD

      _Status: atomic · Priority: high · Tier: D · Traces to: UJ-15, WF-8 · Pass: 4_

      _Decomposition rationale:_ Atomic check for path-based routing which is a defined indicator per A-0302. This check is testable against a URL pattern list.

      _Surfaced assumptions:_ A-0606, A-0607, A-0608, A-0609
    - **US-013-C-02-1-A-3** `[Tier D · atomic]`
      **As a** Request Validator, **I want** Inspect request headers and file attributes for download intent hints, **so that** Flag request as 'download' if headers (e.g., Accept: application/pdf) or attributes indicate file delivery.

      **Acceptance criteria:**
        - **AC-003** — Context is 'download' if file attributes indicate intent, excluding client-side hints.
          - _Measurable:_ if (req.headers['accept'].includes('application/pdf') || file.type !== 'inline') => context === DOWNLOAD

      _Status: atomic · Priority: medium · Tier: D · Traces to: UJ-15, WF-8 · Pass: 4_

      _Decomposition rationale:_ Atomic check for the second indicator specified in A-0302 ('file attributes indicate download intent'). This is a distinct atomic operation from path/param checks.

      _Surfaced assumptions:_ A-0606, A-0607, A-0608, A-0609
    - **US-013-C-02-1-A-4** `[Tier D · atomic]`
      **As a** Request Validator, **I want** Resolve detection conflicts and apply default fallback policy, **so that** Assign default context (View vs Download) when indicators are missing or conflicting.

      **Acceptance criteria:**
        - **AC-004** — System defaults to 'View' context when no explicit indicators are found.
          - _Measurable:_ if (!queryIndicator && !pathIndicator && !attributeIndicator) => context === VIEW

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-15, WF-8 · Pass: 4_

      _Decomposition rationale:_ Atomic operation that defines the terminal state of the detection logic when previous checks fail. This determines the baseline context for the subsequent header injection steps.

      _Surfaced assumptions:_ A-0606, A-0607, A-0608, A-0609
  - **US-013-C-02-1-B** `[Tier D · atomic]`
    **As a** Header Setter, **I want** Inject 'attachment' into Content-Disposition header, **so that** Response object contains required disposition value.

    **Acceptance criteria:**
      - **AC-002** — Response header matches download AC.
        - _Measurable:_ response_headers['Content-Disposition'] === 'attachment; filename=...'

    _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-15, WF-8, ENT-DIST-DOC · Pass: 3_

    _Decomposition rationale:_ Direct atomic execution of the requirement's primary AC; testable without further decomposition.

    _Surfaced assumptions:_ A-0302, A-0303, A-0304
  - **US-013-C-02-1-C** `[Tier D · atomic]`
    **As a** Filename Processor, **I want** Extract and sanitize filename for header value, **so that** Header contains valid, safe filename string.

    **Acceptance criteria:**
      - **AC-003** — Header filename is populated and safe.
        - _Measurable:_ filename !== null && filename.length > 0 && filename.includes('<>' === false

    _Status: atomic · Priority: high · Tier: D · Traces to: ENT-DIST-DOC · Pass: 3_

    _Decomposition rationale:_ Atomic processing of the filename string; ensures the disposition header is complete before transmission.

    _Surfaced assumptions:_ A-0302, A-0303, A-0304
  - **US-013-C-02-1-D** `[Tier B · pending]`
    **As a** Policy Commitment, **I want** Allow configuration override for specific file paths or tenant settings, **so that** System applies header settings from external config rather than hardcoding defaults.

    **Acceptance criteria:**
      - **AC-004** — Configuration overrides default disposition behavior.
        - _Measurable:_ Admin setting exists and system reads config on request initiation

    _Status: pending · Priority: medium · Tier: B · Traces to: ENT-DIST-DOC, UJ-15, US-013-C-02-2, US-013-C-02-3 · Pass: 3_

    _Decomposition rationale:_ Defines the governance rule for the header enforcement; allows flexibility without committing to specific technology (Tier C) yet.

    _Surfaced assumptions:_ A-0302, A-0303, A-0304
##### US-013-C-02-2 `[Tier C · pending]`

**As a** Header config: origin, **I want** Manage Access-Control-Allow-Origin header whitelist, **so that** Browser permits cross-origin resource sharing or denies based on config.

**Acceptance criteria:**
  - **AC-02** — Header Access-Control-Allow-Origin is set correctly.
    - _Measurable:_ response_headers['Access-Control-Allow-Origin'] matches allowed list or is * for trusted origins

_Status: pending · Priority: critical · Tier: C · Traces to: UJ-15, TECH-4, ENT-DIST-DOC · Pass: 2_

_Decomposition rationale:_ CORS configuration is a critical security implementation commitment that dictates client-side permissions for the distributed document entities.

_Surfaced assumptions:_ A-0135, A-0136, A-0137

  - **US-013-C-02-2-1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Compare incoming Origin header against stored whitelist, **so that** Determine whether the request origin is permitted for sharing resources.

    **Acceptance criteria:**
      - **AC-101** — Origin header matches exactly one entry in the configured whitelist.
        - _Measurable:_ request_headers[Origin] === whitelisted_origin OR whitelisted_origin === "*"

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-6, TECH-4, UJ-15 · Pass: 3_

    _Decomposition rationale:_ The whitelist is a configuration source (TECH-6). The matching logic must execute at request time (TECH-4) to authorize resource access (UJ-15).

    _Surfaced assumptions:_ A-0305, A-0306, A-0307
    - **US-013-C-02-2-1.1** `[Tier C · pending]`
      **As a** Configuration Service, **I want** Retrieve active origin allowlist from secure configuration store, **so that** Obtain list of permitted origins for comparison.

      **Acceptance criteria:**
        - **AC-101.1** — Configuration fetch completes within 5ms
          - _Measurable:_ Fetch time (request_time - config_time) <= 5000ms

      _Status: pending · Priority: critical · Tier: C · Traces to: TECH-6, A-0135 · Pass: 4_

      _Decomposition rationale:_ Separates data access from logic processing; ensures consistency of the whitelist source against the requirement.

      _Surfaced assumptions:_ A-0610, A-0611
    - **US-013-C-02-2-1.2** `[Tier C · pending]`
      **As a** Normalization Layer, **I want** Canonicalize incoming Origin header (lowercase, strip port unless specified), **so that** Standardized string ready for deterministic comparison.

      **Acceptance criteria:**
        - **AC-101.2** — Input origin is transformed to canonical form
          - _Measurable:_ Output string is lowercase and lacks trailing slash/port if not present in whitelist entry

      _Status: pending · Priority: critical · Tier: C · Traces to: TECH-4, UJ-15 · Pass: 4_

      _Decomposition rationale:_ Handles RFC 6265 inconsistencies (case sensitivity, trailing slashes) that would otherwise bypass whitelists if comparison were raw.

      _Surfaced assumptions:_ A-0610, A-0611
    - **US-013-C-02-2-1.3** `[Tier D · atomic]`
      **As a** Comparison Logic, **I want** Execute string equality check against normalized whitelist, **so that** Boolean permit/deny decision for the specific request.

      **Acceptance criteria:**
        - **AC-101** — Origin header matches exactly one entry OR wildcard
          - _Measurable:_ result === (normalized_origin === whitelisted_origin || whitelisted_origin === "*")

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-013-C-02-2-2, US-013-C-02-2-3, US-013-C-02-2-4 · Pass: 4_

      _Decomposition rationale:_ Atomic verification step that directly tests the parent AC-101; feeds directly into sibling response/header logic.

      _Surfaced assumptions:_ A-0610, A-0611
  - **US-013-C-02-2-2** `[Tier C · pending]`
    **As a** CAM operator, **I want** Set Access-Control-Allow-Origin response header, **so that** Response header reflects the validated origin or wildcard.

    **Acceptance criteria:**
      - **AC-102** — Response header value matches the matched whitelist entry or wildcard.
        - _Measurable:_ response_headers['Access-Control-Allow-Origin'] === validated_origin_string

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-20, TECH-4, UJ-15 · Pass: 3_

    _Decomposition rationale:_ Header injection happens at the edge/origin layer (TECH-20) after validation logic (TECH-4) completes.

    _Surfaced assumptions:_ A-0305, A-0306, A-0307
    - **US-013-C-02-2-2-1** `[Tier C · pending]`
      **As a** Value Resolver, **I want** Determine header value from whitelist or wildcard config, **so that** Header value is either the matched origin string or the wildcard character.

      **Acceptance criteria:**
        - **AC-0102-01** — Header value equals the matched origin string from allowlist.
          - _Measurable:_ header_value === whitelist_match_string OR header_value === '*'

      _Status: pending · Priority: high · Tier: C · Traces to: TECH-20 · Pass: 4_

      _Decomposition rationale:_ The system must resolve whether to set a specific origin or a wildcard based on configuration and request context (credentials). This is a concrete implementation decision under the parent commitment.
    - **US-013-C-02-2-2-2** `[Tier D · atomic]`
      **As a** Header Writer, **I want** Inject resolved value into HTTP response object, **so that** HTTP response object contains the 'Access-Control-Allow-Origin' header.

      **Acceptance criteria:**
        - **AC-0102-02** — Response headers dictionary includes the correct origin value.
          - _Measurable:_ response_headers['Access-Control-Allow-Origin'] === header_value_from_resolver

      _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-20, TECH-4 · Pass: 4_

      _Decomposition rationale:_ This is the atomic leaf operation that physically applies the configuration to the network response. It is individually testable as a final verification step before transmission.
    - **US-013-C-02-2-2-3** `[Tier C · pending]`
      **As a** Audit Logger, **I want** Record header assignment event in audit log, **so that** System audit log contains a record of the header decision and value.

      **Acceptance criteria:**
        - **AC-0102-03** — Audit log entry created with origin or wildcard value.
          - _Measurable:_ ENT-AUDIT-LOG contains event with header_value field populated

      _Status: pending · Priority: medium · Tier: C · Traces to: ENT-AUDIT-LOG, TECH-13 · Pass: 4_

      _Decomposition rationale:_ Compliance requires tracking of security-related header decisions to demonstrate adherence to CORS policies. This is an implementation commitment to maintain the integrity of the audit trail.
  - **US-013-C-02-2-3** `[Tier B · pending]`
    **As a** Architect, **I want** Enforce wildcard deny for credentials (CORS policy constraint), **so that** System refuses to set '*' header if credentials are present in request.

    **Acceptance criteria:**
      - **AC-103** — Access-Control-Allow-Credentials header is absent when Origin is '*', or '*' is not used for credential access.
        - _Measurable:_ if (response_header[Access-Control-Allow-Credentials] === 'true') then response_header[Access-Control-Allow-Origin] != '*'

    _Status: pending · Priority: high · Tier: B · Traces to: TECH-10, UJ-15, US-013-C-02-3 · Pass: 3_

    _Decomposition rationale:_ This is a governing rule (Tier B) regarding security policy implementation. It defines that wildcard origins disallow credentials, a standard constraint enforced via policy engine (TECH-10) and impacting document access (UJ-15).

    _Surfaced assumptions:_ A-0305, A-0306, A-0307
  - **US-013-C-02-2-4** `[Tier C · pending]`
    **As a** CAM operator, **I want** Handle preflight origin mismatch rejection, **so that** Reject OPTIONS requests with mismatched origin headers gracefully.

    **Acceptance criteria:**
      - **AC-104** — Preflight OPTIONS request returns forbidden if Origin does not match policy.
        - _Measurable:_ OPTIONS response_status_code === 403 OR header[Access-Control-Allow-Origin] is empty

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-20, UJ-15, US-013-C-02-4 · Pass: 3_

    _Decomposition rationale:_ Preflight handling ensures correct MIME types and origins before actual content is sent, interacting with Content-Type mapping (US-013-C-02-4).

    _Surfaced assumptions:_ A-0305, A-0306, A-0307
    - **FR-013-C-02-2-4-01** `[Tier D · atomic]`
      **As a** Logic check, **I want** Compare incoming Origin header against stored policy whitelist, **so that** Origin header differs from configured policy.

      **Acceptance criteria:**
        - **AC-001** — Origin header value does not match stored allowlist entry.
          - _Measurable:_ req.origin not in ALLOWLIST[Origin]

      _Status: atomic · Priority: critical · Tier: D · Traces to: US-013-C-02-2-1 · Pass: 4_

      _Decomposition rationale:_ This child binds the logic of checking the origin, separating it from the act of response generation for testability.

      _Surfaced assumptions:_ A-0612, A-0613
    - **FR-013-C-02-2-4-02** `[Tier D · atomic]`
      **As a** Response generator, **I want** Return 403 Forbidden response with empty headers, **so that** Client receives HTTP 403 with no Access-Control-Allow-Origin header.

      **Acceptance criteria:**
        - **AC-002** — Response status code is 403 and origin header is empty.
          - _Measurable:_ resp.status_code === 403 AND resp.header['Access-Control-Allow-Origin'] === null

      _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-20, UJ-15 · Pass: 4_

      _Decomposition rationale:_ This child binds the specific network action required by the preflight rejection policy.

      _Surfaced assumptions:_ A-0612, A-0613
##### US-013-C-02-3 `[Tier C · pending]`

**As a** Header config: caching, **I want** Define Cache-Control directives for document streaming, **so that** Browser caches or re-fetches documents without CORS errors.

**Acceptance criteria:**
  - **AC-03** — Header Cache-Control includes max-age directives.
    - _Measurable:_ response_headers['Cache-Control'] includes 'no-store' or 'public' as defined in system policy

_Status: pending · Priority: high · Tier: C · Traces to: UJ-15, ENT-DIST-DOC, TECH-4 · Pass: 2_

_Decomposition rationale:_ Caching behavior is an implementation commitment that ensures browser performance and consistency while respecting privacy and security constraints.

_Surfaced assumptions:_ A-0135, A-0136, A-0137

  - **FR-HEADER-1.1** `[Tier C · pending]`
    **As a** Security Officer, **I want** Enforce no-store directive for documents with privacy flags, **so that** Sensitive documents are not cached by client browser to prevent leakage.

    **Acceptance criteria:**
      - **AC-101** — Documents with privacy attributes must use no-store.
        - _Measurable:_ For every request to ENT-DIST-DOC where is_private === true, response_headers['Cache-Control'] contains 'no-store'.

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-15, ENT-DIST-DOC · Pass: 3_

    _Decomposition rationale:_ This defines the specific security rule for private assets, committing the system to prevent client-side caching of sensitive data.

    _Surfaced assumptions:_ A-0308, A-0309, A-0310
    - **FR-HEADER-1.1.1** `[Tier B · pending]`
      **As a** Architect, **I want** Delegate header enforcement to response middleware layer, **so that** Header logic is centralized and consistent across all endpoints.

      **Acceptance criteria:**
        - **AC-101.1** — Header injection logic exists in middleware pipeline.
          - _Measurable:_ Header logic is invoked prior to response commit in Middleware Stack

      _Status: pending · Priority: high · Tier: B · Traces to: FR-HEADER-1.2, FR-HEADER-1.3 · Pass: 4_

      _Decomposition rationale:_ Decides the architectural boundary of where the logic lives (Middleware vs Handler) to prevent duplication and ensure consistency with other header rules.

      _Surfaced assumptions:_ A-0614, A-0615, A-0616
    - **FR-HEADER-1.1.2** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Read privacy flag from document entity, **so that** System possesses the truth of document privacy before response generation.

      **Acceptance criteria:**
        - **AC-101.2** — Privacy flag is read synchronously.
          - _Measurable:_ Request context contains 'is_private' boolean from ENT-DIST-DOC

      _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-DIST-DOC · Pass: 4_

      _Decomposition rationale:_ Verifies the data prerequisite for the conditional header logic; atomic verification of privacy state.

      _Surfaced assumptions:_ A-0614, A-0615, A-0616
    - **FR-HEADER-1.1.3** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Inject no-store directive into response header, **so that** Response includes 'Cache-Control: no-store' string.

      **Acceptance criteria:**
        - **AC-101.3** — no-store header is present in response.
          - _Measurable:_ response_headers['Cache-Control'] === 'no-store' OR 'no-store' included in header list

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-15 · Pass: 4_

      _Decomposition rationale:_ The atomic execution step that fulfills the core requirement for sensitive documents.

      _Surfaced assumptions:_ A-0614, A-0615, A-0616
  - **FR-HEADER-1.2** `[Tier C · pending]`
    **As a** Performance Engineer, **I want** Enforce public + max-age for public streaming documents, **so that** Public documents are cached by browsers to reduce origin load.

    **Acceptance criteria:**
      - **AC-102** — Public documents must use public + max-age.
        - _Measurable:_ For every request to ENT-DIST-DOC where is_public === true, response_headers['Cache-Control'] contains 'public' and a max-age value derived from config.

    _Status: pending · Priority: medium · Tier: C · Traces to: UJ-15, TECH-4 · Pass: 3_

    _Decomposition rationale:_ This commits the specific caching strategy for public assets, balancing performance and security.

    _Surfaced assumptions:_ A-0308, A-0309, A-0310
    - **FR-HEADER-1.2.1** `[Tier C · pending]`
      **As a** CAM operator, **I want** Validate document `is_public` boolean on `ENT-DIST-DOC`, **so that** Public documents proceed to cache header enforcement; private documents bypass this path.

      **Acceptance criteria:**
        - **AC-102.1.1** — Only documents with `is_public === true` trigger the caching logic.
          - _Measurable:_ Response logic only executes for rows where `is_public` field equals true in `ENT-DIST-DOC`.

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-15, FR-HEADER-1.1 · Pass: 4_

      _Decomposition rationale:_ Branching on document sensitivity is a prerequisite to applying the correct caching policy, ensuring private content does not accidentally receive public cache headers.

      _Surfaced assumptions:_ A-0617
    - **FR-HEADER-1.2.2** `[Tier C · pending]`
      **As a** CAM operator, **I want** Resolve `max-age` configuration value from system settings, **so that** A numeric duration for cache lifetime is determined before header injection.

      **Acceptance criteria:**
        - **AC-102.2.1** — The value used in `Cache-Control` matches the configuration default or document-specific override.
          - _Measurable:_ Response header `Cache-Control` max-age integer equals `sys_config.document_max_age_seconds`.

      _Status: pending · Priority: high · Tier: C · Traces to: UJ-15, TECH-4 · Pass: 4_

      _Decomposition rationale:_ Caching duration is not static; it depends on dynamic configuration, requiring a dedicated lookup commitment to ensure correctness across deployments.

      _Surfaced assumptions:_ A-0617
    - **FR-HEADER-1.2.3** `[Tier C · pending]`
      **As a** CAM operator, **I want** Inject `Cache-Control` headers into HTTP response, **so that** Browser receives valid caching directives allowing origin load reduction.

      **Acceptance criteria:**
        - **AC-102.3.1** — HTTP response includes `Cache-Control: public, max-age=<value>`.
          - _Measurable:_ Response headers object contains `Cache-Control` key with string value containing `public` and `max-age`.

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-15, TECH-4, FR-HEADER-1.3 · Pass: 4_

      _Decomposition rationale:_ Header injection is the final action that satisfies the user story outcome, interacting with CORS constraints defined in sibling FR-HEADER-1.3.

      _Surfaced assumptions:_ A-0617
  - **FR-HEADER-1.3** `[Tier C · pending]`
    **As a** Integration Specialist, **I want** Validate CORS consistency with Cache-Control headers, **so that** Headers do not conflict, preventing browsers from caching protected content across origins.

    **Acceptance criteria:**
      - **AC-103** — no-store is required if CORS allows list restricts origin.
        - _Measurable:_ If Access-Control-Allow-Origin header is present but does not allow *all, response_headers['Cache-Control'] must not allow public caching unless explicitly exempted.

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-15, ENT-DIST-DOC · Pass: 3_

    _Decomposition rationale:_ This resolves the technical conflict between browser caching and cross-origin restrictions, ensuring compliance with the system policy constraint.

    _Surfaced assumptions:_ A-0308, A-0309, A-0310
    - **FR-HEADER-1.3.1** `[Tier D · atomic]`
      **As a** Header Generator, **I want** Set Cache-Control to no-store when origin is restricted, **so that** Browsers cannot cache restricted content across origins.

      **Acceptance criteria:**
        - **AC-103-1** — Restricted origin documents receive no-store cache policy.
          - _Measurable:_ headers['Cache-Control'] === 'no-store' when headers['Access-Control-Allow-Origin'] !== '*' AND doc.is_private === true

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-15, ENT-DIST-DOC · Pass: 4_

      _Decomposition rationale:_ This child addresses the core constraint from AC-103 regarding restricted origin documents (non-all access), ensuring security by preventing caching.

      _Surfaced assumptions:_ A-0618, A-0619, A-0620
    - **FR-HEADER-1.3.2** `[Tier D · atomic]`
      **As a** Header Generator, **I want** Set Cache-Control to public+max-age when origin allows all and exempted, **so that** Public content is cached for allowed origins only when explicitly exempted.

      **Acceptance criteria:**
        - **AC-103-2** — Public documents with all-origins access and exemption receive public cache policy.
          - _Measurable:_ headers['Cache-Control'] === 'public, max-age=XXX' when headers['Access-Control-Allow-Origin'] === '*' AND doc.exempt_status === true

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-15, ENT-DIST-DOC · Pass: 4_

      _Decomposition rationale:_ This child implements the exception path from AC-103 for documents that are public and explicitly exempted from the no-store rule.

      _Surfaced assumptions:_ A-0618, A-0619, A-0620
    - **FR-HEADER-1.3.3** `[Tier D · atomic]`
      **As a** Header Generator, **I want** Set Cache-Control to no-store when origin allows all and not exempted, **so that** Non-exempted public documents with all-origins access do not receive public cache policy.

      **Acceptance criteria:**
        - **AC-103-3** — Public documents without exemption do not allow public caching regardless of origin.
          - _Measurable:_ headers['Cache-Control'] === 'no-store' when headers['Access-Control-Allow-Origin'] === '*' AND doc.exempt_status === false

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-15, ENT-DIST-DOC · Pass: 4_

      _Decomposition rationale:_ This child completes the logical coverage for 'allows all' origins by enforcing no-store unless exempt, per AC-103 parenthetical.

      _Surfaced assumptions:_ A-0618, A-0619, A-0620
##### US-013-C-02-4 `[Tier C · pending]`

**As a** Header config: type, **I want** Map file extension to Content-Type, **so that** Browser renders document using correct MIME type.

**Acceptance criteria:**
  - **AC-04** — Header Content-Type matches file format.
    - _Measurable:_ response_headers['Content-Type'] === MIME_TYPE_MAP[filename_extension]

_Status: pending · Priority: high · Tier: C · Traces to: UJ-15, ENT-DIST-DOC, TECH-2 · Pass: 2_

_Decomposition rationale:_ MIME type mapping is a system-side restriction to ensure browser compatibility across different rendering engines.

_Surfaced assumptions:_ A-0135, A-0136, A-0137

  - **US-013-C-02-4.1** `[Tier C · pending]`
    **As a** Backend Engineer, **I want** Implement MIME type lookup logic using configured map, **so that** Response header Content-Type is set based on the file extension found in the request.

    **Acceptance criteria:**
      - **AC-04** — Response Content-Type matches map lookup for known extension
        - _Measurable:_ response_headers['Content-Type'] === MIME_TYPE_MAP[filename_extension] for all requests where extension is present

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-15, ENT-DIST-DOC · Pass: 3_

    _Decomposition rationale:_ Core implementation of the header mapping logic, directly verifying the parent's AC.

    _Surfaced assumptions:_ A-0311
    - **US-013-C-02-4.1.1** `[Tier D · atomic]`
      **As a** Backend Engineer, **I want** Extract file extension from request path or Content-Disposition header, **so that** System isolates the known extension string from the filename.

      **Acceptance criteria:**
        - **AC-1.1.1** — Extracted extension matches the filename suffix.
          - _Measurable:_ extracted_extension === filename.substring(filename.lastIndexOf('.'))

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-9, UJ-15, ENT-DIGITAL-FILE · Pass: 4_

      _Decomposition rationale:_ This is the first atomic operation required to identify what MIME type to look up. It must handle the string extraction before any mapping occurs.

      _Surfaced assumptions:_ A-0621, A-0622
    - **US-013-C-02-4.1.2** `[Tier D · atomic]`
      **As a** Backend Engineer, **I want** Perform lookup in configured MIME type map using extracted extension, **so that** System retrieves the corresponding MIME type string or determines it is missing.

      **Acceptance criteria:**
        - **AC-1.2.1** — Map lookup returns the configured MIME type for the extension.
          - _Measurable:_ mime_map.has_key(extracted_extension) === true && mime_map[extracted_extension] !== null

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-9, UJ-15, ENT-DIGITAL-FILE · Pass: 4_

      _Decomposition rationale:_ This step verifies if the extension is in the scope of configured types (as opposed to unknown types handled in sibling US-013-C-02-4.2).

      _Surfaced assumptions:_ A-0621, A-0622
    - **US-013-C-02-4.1.3** `[Tier D · atomic]`
      **As a** Backend Engineer, **I want** Set response header 'Content-Type' to the retrieved MIME type, **so that** HTTP response includes the correct Content-Type header for the client.

      **Acceptance criteria:**
        - **AC-1.3.1** — Response header Content-Type matches map lookup result.
          - _Measurable:_ response_headers['Content-Type'] === mime_map[extracted_extension]

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-15, UJ-9 · Pass: 4_

      _Decomposition rationale:_ This is the final atomic action in the happy path, directly satisfying the parent AC-04.

      _Surfaced assumptions:_ A-0621, A-0622
    - **US-013-C-02-4.1.4** `[Tier D · atomic]`
      **As a** Backend Engineer, **I want** Validate MIME map configuration is loaded and accessible, **so that** System refuses requests if map is missing or inaccessible.

      **Acceptance criteria:**
        - **AC-1.4.1** — System checks map availability before processing.
          - _Measurable:_ mime_map_is_loaded_at_startup === true

      _Status: atomic · Priority: high · Tier: D · Traces to: UJ-15, ENT-DIGITAL-FILE · Pass: 4_

      _Decomposition rationale:_ Ensures the lookup mechanism (Child 2) does not fail with null pointer or empty map errors.

      _Surfaced assumptions:_ A-0621, A-0622
  - **US-013-C-02-4.2** `[Tier B · pending]`
    **As a** System Architect, **I want** Define fallback strategy for unknown file extensions, **so that** Browser can safely render or block content when MIME type is not explicitly configured.

    **Acceptance criteria:**
      - **AC-05** — System applies configured default type for unmapped files
        - _Measurable:_ If filename_extension NOT in MIME_TYPE_MAP, response_headers['Content-Type'] === DEFAULT_FALLBACK_TYPE

    _Status: pending · Priority: high · Tier: B · Traces to: UJ-15 · Pass: 3_

    _Decomposition rationale:_ Defines the boundary/policy for edge cases (unknown files) which is a commitment (Tier B) rather than a specific implementation detail (Tier C).

    _Surfaced assumptions:_ A-0311
#### US-013-D-01 `[Tier D · atomic]`

**As a** System Operator, **I want** Fetch document content from storage, **so that** Binary stream is returned to client.

**Acceptance criteria:**
  - **AC-D-01** — Full document content is returned.
    - _Measurable:_ HTTP 200 response body size matches ENT-DIST-DOC.content_length for all valid documents in SeaweedFS.

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-15, WF-8, ENT-DIST-DOC, TECH-14 · Pass: 1_

_Decomposition rationale:_ Data retrieval is the core atomic operation after authorization succeeds. It is testable without further decomposition.

_Surfaced assumptions:_ A-0038, A-0039, A-0040

#### US-013-D-02 `[Tier D · atomic]`

**As a** Compliance Officer, **I want** Append access event to audit log, **so that** Persistent record of the view/download request exists.

**Acceptance criteria:**
  - **AC-D-02** — Audit log entry is created immediately.
    - _Measurable:_ ENT-AUDIT-LOG row count increments with fields: user_id, timestamp, resource_id, action_type='view/download'.

_Status: atomic · Priority: critical · Tier: D · Traces to: UJ-15, WF-8, ENT-AUDIT-LOG, COMP-2 · Pass: 1_

_Decomposition rationale:_ Logging satisfies AC-025 and COMP-2 audit trail obligations. It is an atomic verification of compliance compliance.

_Surfaced assumptions:_ A-0038, A-0039, A-0040

### Backlog (2 roots)

### FR US-014 `[pending]`

**As a** Admin, **I want** Configure AI Agent Approval Thresholds, **so that** System setting for autonomous vendor matching is defined.

**Acceptance criteria:**
  - **AC-027** — Threshold saved
    - _Measurable:_ Configuration of Q-2 decision is stored and effective immediately
  - **AC-028** — Audit trail created
    - _Measurable:_ ENT-AUDIT-LOG records admin configuration changes

_Status: pending · Priority: high · Traces to: Q-2, VOC-14, COMP-5 · Pass: 0_

#### FR-AI-TH-1.1 `[Tier C · pending]`

**As a** Implementation commitment, **I want** Persist threshold value to database, **so that** Threshold value is stored and available for retrieval.

**Acceptance criteria:**
  - **AC-027** — Threshold value saved in repository.
    - _Measurable:_ Record exists in config_store table with valid key-value pair

_Status: pending · Priority: high · Tier: C · Traces to: US-014, COMP-5 · Pass: 1_

_Decomposition rationale:_ Defines the storage mechanism for the configured setting, converting the policy into a concrete technical requirement.

_Surfaced assumptions:_ A-0041, A-0042, A-0043, A-0044

##### FR-AI-TH-1.1.1 `[Tier D · atomic]`

**As a** Database Writer, **I want** Upsert threshold row into config_store, **so that** Config row exists with specified key and value.

**Acceptance criteria:**
  - **AC-027-D1** — Row persists with correct key-value payload
    - _Measurable:_ SELECT count(*) FROM config_store WHERE key = 'threshold_ai' AND value = expected_val returning 1

_Status: atomic · Priority: critical · Tier: D · Traces to: US-014, COMP-5 · Pass: 2_

_Decomposition rationale:_ Defines the atomic write operation required to satisfy 'Stored and available for retrieval'. This is the terminal leaf operation for the persistence function.

_Surfaced assumptions:_ A-0138

##### FR-AI-TH-1.1.2 `[Tier C · pending]`

**As a** Concurrency Manager, **I want** Handle concurrent writes to same key, **so that** Write succeeds without data loss or deadlock.

**Acceptance criteria:**
  - **AC-027-C2** — No duplicate keys or lost updates in high concurrency
    - _Measurable:_ Concurrent upsert transactions resolve within timeout or fail cleanly on unique constraint

_Status: pending · Priority: high · Tier: C · Traces to: COMP-5 · Pass: 2_

_Decomposition rationale:_ Ensures that persisting the threshold value maintains integrity even when multiple instances (e.g., AI Agent workers) attempt updates simultaneously.

_Surfaced assumptions:_ A-0138

  - **FR-AI-TH-1.1.2-C1** `[Tier C · pending]`
    **As a** DB Architect, **I want** Configure transaction isolation level for concurrent write sessions, **so that** Database maintains consistency while allowing overlapping reads/writes.

    **Acceptance criteria:**
      - **AC-028** — Transactions do not block indefinitely or read uncommitted data
        - _Measurable:_ isolation_level === 'read_committed' AND deadlock_timeout_ms === 5000

    _Status: pending · Priority: critical · Tier: C · Traces to: TECH-8 · Pass: 3_

    _Decomposition rationale:_ Defines the isolation strategy required to prevent dirty reads while enabling concurrency per Postgres defaults.

    _Surfaced assumptions:_ A-0312, A-0313, A-0314
    - **FR-AI-TH-1.1.2-C1-1** `[Tier D · atomic]`
      **As a** DB Admin, **I want** Set default transaction isolation level to Read Committed, **so that** New sessions default to Read Committed isolation.

      **Acceptance criteria:**
        - **AC-029** — Session isolation level is Read Committed.
          - _Measurable:_ SHOW default_transaction_isolation === 'read_committed' in PostgreSQL

      _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-8, FR-AI-TH-1.1.2-C1 · Pass: 4_

      _Decomposition rationale:_ This is the primary implementation step to enforce the consistency model; without it, overlapping reads could see uncommitted data violating the AC.

      _Surfaced assumptions:_ A-0623, A-0624
    - **FR-AI-TH-1.1.2-C1-2** `[Tier D · atomic]`
      **As a** DB Admin, **I want** Configure deadlock timeout to 5000ms, **so that** Deadlock detection triggers after 5s per requirement.

      **Acceptance criteria:**
        - **AC-030** — Deadlock timeout matches requirement.
          - _Measurable:_ SHOW lock_timeout === '5000' in PostgreSQL

      _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-8, FR-AI-TH-1.1.2-C1 · Pass: 4_

      _Decomposition rationale:_ This specific value commits the architecture to a non-blocking strategy; any higher value risks indefinite blocking, any lower increases premature aborts.

      _Surfaced assumptions:_ A-0623, A-0624
    - **FR-AI-TH-1.1.2-C1-3** `[Tier D · atomic]`
      **As a** QA Engineer, **I want** Verify no uncommitted data is read, **so that** Concurrent reads return only committed data.

      **Acceptance criteria:**
        - **AC-031** — No dirty reads observed during load test.
          - _Measurable:_ SELECT count(*) FROM uncommitted_reads WHERE count > 0 === 0 during concurrent writes

      _Status: atomic · Priority: high · Tier: D · Traces to: TECH-8, FR-AI-TH-1.1.2-C1 · Pass: 4_

      _Decomposition rationale:_ This validates that the configuration change achieves the functional outcome of the parent requirement (consistency while allowing overlapping reads).

      _Surfaced assumptions:_ A-0623, A-0624
  - **FR-AI-TH-1.1.2-C2** `[Tier C · pending]`
    **As a** API Gateway, **I want** Implement retry logic for transient unique constraint violations, **so that** Transient conflicts resolve without user intervention via exponential backoff.

    **Acceptance criteria:**
      - **AC-029** — App-level retries attempt before failing
        - _Measurable:_ retry_count < max_retry AND backoff_ms < timeout_window

    _Status: pending · Priority: high · Tier: C · Traces to: TECH-6, COMP-5 · Pass: 3_

    _Decomposition rationale:_ Ensures availability by distinguishing transient (retryable) from permanent (fatal) constraint failures.

    _Surfaced assumptions:_ A-0312, A-0313, A-0314
    - **FR-AI-TH-1.1.2-C2-1** `[Tier B · pending]`
      **As a** Error Classifier, **I want** Map specific HTTP and database error codes to transient vs permanent categories, **so that** System correctly distinguishes retryable 4xx/5xx errors from permanent failures (e.g., 400, 403).

      **Acceptance criteria:**
        - **AC-029-1** — Only transient error codes trigger backoff.
          - _Measurable:_ If error_code in [408, 429, 502, 503] AND unique_constraint_violation, THEN is_retryable === true

      _Status: pending · Priority: critical · Tier: B · Traces to: TECH-6, COMP-5 · Pass: 4_

      _Decomposition rationale:_ This is a policy choice defining what the system treats as transient, distinguishing it from generic implementation values.

      _Surfaced assumptions:_ A-0625, A-0626, A-0627
    - **FR-AI-TH-1.1.2-C2-2** `[Tier C · pending]`
      **As a** Config Manager, **I want** Configure exponential backoff parameters (base delay, multiplier, max delay), **so that** Backoff intervals increase geometrically up to the configured limit.

      **Acceptance criteria:**
        - **AC-029-2** — Backoff calculation follows the exponential formula.
          - _Measurable:_ backoff_ms = min(base_delay * 2^n, max_delay) where n is retry attempt count

      _Status: pending · Priority: high · Tier: C · Traces to: TECH-6 · Pass: 4_

      _Decomposition rationale:_ Setting specific algorithm parameters constitutes an implementation commitment under the retry strategy.

      _Surfaced assumptions:_ A-0625, A-0626, A-0627
    - **FR-AI-TH-1.1.2-C2-3** `[Tier D · atomic]`
      **As a** Auditor, **I want** Log every retry attempt to the audit log with context, **so that** Full forensic trail of retries exists for each unique constraint violation.

      **Acceptance criteria:**
        - **AC-029-3** — Retry attempt is written to audit log immediately.
          - _Measurable:_ ENT-AUDIT-LOG entry exists with timestamp and error_context for every retry loop iteration

      _Status: atomic · Priority: high · Tier: D · Traces to: COMP-5, ENT-AUDIT-LOG · Pass: 4_

      _Decomposition rationale:_ Atomic action of recording an event, individually testable without further decomposition.

      _Surfaced assumptions:_ A-0625, A-0626, A-0627
    - **FR-AI-TH-1.1.2-C2-4** `[Tier B · pending]`
      **As a** Stability Enforcer, **I want** Define failure handling policy after max_retry is exhausted, **so that** System transitions to non-retryable state or queues the request for manual review.

      **Acceptance criteria:**
        - **AC-029-4** — Request is rejected with 409 after max retries.
          - _Measurable:_ Status code returned is 409 Conflict with retry-count field set to max_retry + 1

      _Status: pending · Priority: critical · Tier: B · Traces to: COMP-5, TECH-6 · Pass: 4_

      _Decomposition rationale:_ Deciding the post-exhaustion behavior is a policy choice (Tier B) rather than a simple implementation value.

      _Surfaced assumptions:_ A-0625, A-0626, A-0627
  - **FR-AI-TH-1.1.2-C3** `[Tier C · pending]`
    **As a** Security Officer, **I want** Map unique constraint failures to audit-loggable errors, **so that** Every write conflict is recorded with context for forensic review.

    **Acceptance criteria:**
      - **AC-030** — Constraint error triggers audit entry
        - _Measurable:_ audit_log_entries_created === unique_constraint_error_count

    _Status: pending · Priority: medium · Tier: C · Traces to: ENT-AUDIT-LOG · Pass: 3_

    _Decomposition rationale:_ Ensures compliance obligations (audit trail) are met for data integrity events.

    _Surfaced assumptions:_ A-0312, A-0313, A-0314
    - **FR-AI-TH-1.1.2-C3-1** `[Tier C · pending]`
      **As a** CAM operator, **I want** Extract unique key values from error message, **so that** Error context includes the specific violated key and source transaction ID.

      **Acceptance criteria:**
        - **AC-030-1** — Extracted context contains the unique constraint key value.
          - _Measurable:_ error_payload.key_value != null

      _Status: pending · Priority: high · Tier: C · Traces to: ENT-TRANSACTION · Pass: 4_

      _Decomposition rationale:_ To support forensic review, the raw error must be parsed to extract the specific data that caused the conflict before logging.

      _Surfaced assumptions:_ A-0628, A-0629
    - **FR-AI-TH-1.1.2-C3-2** `[Tier D · atomic]`
      **As a** Database Engine, **I want** Append audit record to log table, **so that** Audit entry persisted with extracted context.

      **Acceptance criteria:**
        - **AC-030** — Constraint error triggers audit entry
          - _Measurable:_ audit_log_entries_created === unique_constraint_error_count

      _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-AUDIT-LOG · Pass: 4_

      _Decomposition rationale:_ This is the terminal leaf operation that physically stores the log entry as defined by the strategy.

      _Surfaced assumptions:_ A-0628, A-0629
##### FR-AI-TH-1.1.3 `[Tier C · pending]`

**As a** Schema Validator, **I want** Enforce value type constraints before persistence, **so that** Only valid types (string/float) are stored.

**Acceptance criteria:**
  - **AC-027-C3** — Stored value matches column schema definition
    - _Measurable:_ Database type error raised if value type differs from column definition

_Status: pending · Priority: high · Tier: C · Traces to: US-014 · Pass: 2_

_Decomposition rationale:_ Ensures data integrity by validating the threshold payload structure before committing, preventing schema mismatches in the repository.

_Surfaced assumptions:_ A-0138

  - **FR-AI-TH-1.1.3.1** `[Tier C · pending]`
    **As a** Application Layer Validator, **I want** Validate input payload types against Zod schema definition before DB commit, **so that** Non-conforming payloads are rejected immediately without touching the database.

    **Acceptance criteria:**
      - **AC-027-C3.1** — Payload validation fails if JSON type differs from Zod schema type.
        - _Measurable:_ Returns HTTP 400 Bad Request if `typeof(payload[field]) !== schema[field].type`

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, UJ-6 · Pass: 3_

    _Decomposition rationale:_ Separates application-level type safety from database enforcement; ensures data integrity before expensive DB operations.

    _Surfaced assumptions:_ A-0315, A-0316
    - **FR-AI-TH-1.1.3.1.C1** `[Tier C · pending]`
      **As a** Backend Engineer, **I want** Enforce Zod strict mode by default for all API endpoints, **so that** Payloads containing extra properties beyond schema definition are rejected immediately.

      **Acceptance criteria:**
        - **AC-001** — Request rejected on extra properties.
          - _Measurable:_ Status code 400 returned when payload contains keys not defined in schema.

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, UJ-6 · Pass: 4_

      _Decomposition rationale:_ Defines the default strictness policy. Without explicit choice, Zod might allow extra properties (pass), creating a policy ambiguity. This commits to 'strict' behavior to ensure DB integrity and aligns with Tier B style policy choices made at implementation level.

      _Surfaced assumptions:_ A-0630, A-0631
    - **FR-AI-TH-1.1.3.1.C2** `[Tier C · pending]`
      **As a** Backend Engineer, **I want** Disable Zod type coercion for schema type mismatches, **so that** String '123' does not coerce to integer 123 without explicit transform; mismatch returns error.

      **Acceptance criteria:**
        - **AC-002** — Return error if JSON type differs from schema type.
          - _Measurable:_ Status code 400 returned if typeof(payload[key]) !== schema[key].type without coercion transform applied.

      _Status: pending · Priority: critical · Tier: C · Traces to: UJ-4, UJ-6 · Pass: 4_

      _Decomposition rationale:_ Ensures data integrity at the API boundary. Zod can coerce types (e.g. string to int). This commits to rejecting coercible mismatches that could violate schema contracts, deferring transformation logic explicitly to child elements if needed.

      _Surfaced assumptions:_ A-0630, A-0631
    - **FR-AI-TH-1.1.3.1.D1** `[Tier D · atomic]`
      **As a** API Developer, **I want** Construct error JSON body with standardized structure, **so that** Client receives specific error codes and messages consistent with API documentation.

      **Acceptance criteria:**
        - **AC-003** — Error response includes 'message' and 'code' fields.
          - _Measurable:_ JSON body contains statusCode: 400, message: Invalid Schema, field: fieldName.

      _Status: atomic · Priority: high · Tier: D · Traces to: UJ-4, UJ-6, FR-AI-TH-1.1.3.3 · Pass: 4_

      _Decomposition rationale:_ Atomic implementation of the 'return to client' part of the parent. This child separates the error generation logic from the validation logic itself. Links to sibling FR-AI-TH-1.1.3.3 which handles logging.

      _Surfaced assumptions:_ A-0630, A-0631
  - **FR-AI-TH-1.1.3.2** `[Tier C · pending]`
    **As a** Database Schema Enforcer, **I want** Enforce strict SQL column types for all stored entity fields, **so that** Database rejects inserts/updates that violate column type definitions.

    **Acceptance criteria:**
      - **AC-027-C3.2** — Database INSERT returns error if value type does not match column definition.
        - _Measurable:_ `INSERT` statement returns `ERROR` if `CAST(value AS target_type)` fails

    _Status: pending · Priority: critical · Tier: C · Traces to: UJ-9, UJ-13 · Pass: 3_

    _Decomposition rationale:_ Ensures persistence safety even if application validation is bypassed; aligns with COMP-1 (General Ledger) constraints.

    _Surfaced assumptions:_ A-0315, A-0316
    - **FR-AI-TH-1.1.3.2.C1** `[Tier C · pending]`
      **As a** Database Enforcer, **I want** Enforce strict typing on Financial Ledger entries, **so that** INSERT or UPDATE fails if amount is not DECIMAL(18,2).

      **Acceptance criteria:**
        - **AC-028-C1** — Non-numeric values for financial fields are rejected at commit time
          - _Measurable:_ Database returns SQL error code 80001 or similar if ENT-LEDGER.amount or ENT-TRANSACTION.amount is not a valid DECIMAL(18,2)

      _Status: pending · Priority: critical · Tier: C · Traces to: FR-AI-TH-1.1.3.1, FR-AI-TH-1.1.3.3, UJ-13, ENT-LEDGER · Pass: 4_

      _Decomposition rationale:_ Financial data integrity is paramount for General Ledger compliance; specific domain enforcement commits the implementation strategy for financial entities.

      _Surfaced assumptions:_ A-0632, A-0633, A-0634
    - **FR-AI-TH-1.1.3.2.C2** `[Tier C · pending]`
      **As a** Database Enforcer, **I want** Enforce strict typing on Property Asset identifiers, **so that** INSERT or UPDATE fails if address/name exceeds VARCHAR length.

      **Acceptance criteria:**
        - **AC-028-C2** — Non-compliant text for property fields is rejected at commit time
          - _Measurable:_ Database returns SQL error code 80001 or similar if ENT-PROPERTY.address or ENT-UNIT.name exceeds defined character limit

      _Status: pending · Priority: high · Tier: C · Traces to: FR-AI-TH-1.1.3.1, FR-AI-TH-1.1.3.3, UJ-9, ENT-PROPERTY · Pass: 4_

      _Decomposition rationale:_ Property asset profiles handle geocoding and legal descriptions; strict typing prevents parsing errors in downstream location services.

      _Surfaced assumptions:_ A-0632, A-0633, A-0634
    - **FR-AI-TH-1.1.3.2.C3** `[Tier C · pending]`
      **As a** Database Enforcer, **I want** Enforce strict typing on Dispatch Schedule timestamps, **so that** INSERT or UPDATE fails if time value is not TIMESTAMP(3).

      **Acceptance criteria:**
        - **AC-028-C3** — Invalid time formats for scheduling are rejected at commit time
          - _Measurable:_ Database returns SQL error code 80001 or similar if ENT-SHIFT.start_time does not match expected TIMESTAMP(3) structure

      _Status: pending · Priority: high · Tier: C · Traces to: FR-AI-TH-1.1.3.1, FR-AI-TH-1.1.3.3, UJ-2, ENT-SHIFT · Pass: 4_

      _Decomposition rationale:_ Scheduling requires precise timezone and precision alignment; this commitment forces the system to use timezone-aware storage for operational tasks.

      _Surfaced assumptions:_ A-0632, A-0633, A-0634
  - **FR-AI-TH-1.1.3.3** `[Tier C · pending]`
    **As a** Error Handler, **I want** Log and respond to type validation exceptions consistently, **so that** Validation failures are logged to audit trail and return to client.

    **Acceptance criteria:**
      - **AC-027-C3.3** — Validation exception is logged to `ENT-AUDIT-LOG`.
        - _Measurable:_ `COUNT(*)` in `ENT-AUDIT-LOG` increases by 1 for every rejected validation.

    _Status: pending · Priority: high · Tier: C · Traces to: UJ-12 · Pass: 3_

    _Decomposition rationale:_ Provides observability for data integrity failures; ensures COMP-2 compliance for audit trails.

    _Surfaced assumptions:_ A-0315, A-0316
    - **FR-AI-TH-1.1.3.3.C1** `[Tier D · atomic]`
      **As a** CAM operator, **I want** write_validation_exception_audit_entry, **so that** Exception is recorded in the immutable audit log with transactional integrity.

      **Acceptance criteria:**
        - **AC-027-C3.3.1** — Audit log count increases for every rejected validation.
          - _Measurable:_ COUNT(*) in ENT-AUDIT-LOG increases by 1 upon commit of a failed validation transaction.

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-12 · Pass: 4_

      _Decomposition rationale:_ Logging is an atomic side-effect of the error handling process. This child commits to the atomic action of writing to the audit log, distinct from the response generation.

      _Surfaced assumptions:_ A-0635, A-0636
    - **FR-AI-TH-1.1.3.3.C2** `[Tier D · atomic]`
      **As a** CAM operator, **I want** send_error_response_to_client, **so that** Client receives an appropriate HTTP error status and sanitized error message.

      **Acceptance criteria:**
        - **AC-027-C3.3.2** — Client receives an error response without internal implementation details.
          - _Measurable:_ Response body does not contain internal stack traces, database errors, or system-specific identifiers.

      _Status: atomic · Priority: critical · Tier: D · Traces to: UJ-12 · Pass: 4_

      _Decomposition rationale:_ Returning the response is the second atomic action of the error handler. It is distinct from logging. It requires sanitization to prevent information leakage.

      _Surfaced assumptions:_ A-0635, A-0636
    - **FR-AI-TH-1.1.3.3.C3** `[Tier D · atomic]`
      **As a** CAM operator, **I want** capture_error_metadata, **so that** Validation error context is preserved for debugging without leaking sensitive data.

      **Acceptance criteria:**
        - **AC-027-C3.3.3** — Error metadata fields (field_name, expected_type, actual_type) are captured.
          - _Measurable:_ ENT-AUDIT-LOG entry contains 'field_name', 'expected_type', and 'actual_type' fields for every validation failure.

      _Status: atomic · Priority: high · Tier: D · Traces to: UJ-12 · Pass: 4_

      _Decomposition rationale:_ Capturing metadata is required to make the audit entry useful for monitoring (UJ-12) and is a concrete implementation choice before the final log write action.

      _Surfaced assumptions:_ A-0635, A-0636
##### FR-AI-TH-1.1.4 `[Tier D · atomic]`

**As a** Cache Invalidation Orchestrator, **I want** Invalidate read cache for threshold key, **so that** Immediate visibility of persisted value to readers.

**Acceptance criteria:**
  - **AC-027-C4** — Read request returns updated value immediately after write
    - _Measurable:_ Read latency < 5ms and returns value from DB source not stale cache

_Status: atomic · Priority: high · Tier: D · Traces to: US-014, COMP-5 · Pass: 2_

_Decomposition rationale:_ Satisfies the 'available for retrieval' portion of the parent AC by ensuring the data store is immediately consistent with cache layers.

_Surfaced assumptions:_ A-0138

#### FR-AI-TH-1.2 `[Tier C · pending]`

**As a** Implementation commitment, **I want** Enforce runtime behavior based on threshold, **so that** AI Agent respects configured threshold in vendor matching.

**Acceptance criteria:**
  - **AC-029** — Matching logic uses active threshold value.
    - _Measurable:_ Matching algorithm queries config_store for current value before processing request

_Status: pending · Priority: high · Tier: C · Traces to: US-014, VOC-14 · Pass: 1_

_Decomposition rationale:_ Connects the configuration to the AI Agent logic (VOC-14) to ensure the setting has downstream consequences.

_Surfaced assumptions:_ A-0041, A-0042, A-0043, A-0044

##### FR-AI-TH-1.2-1 `[Tier D · atomic]`

**As a** AI matching engine, **I want** Query config_store for current threshold value, **so that** Threshold value is loaded into matching context for request processing.

**Acceptance criteria:**
  - **AC-030** — Active threshold value is retrieved before matching.
    - _Measurable:_ config_store.read(threshold_id) returns non-null value for current request

_Status: atomic · Priority: critical · Tier: D · Traces to: FR-AI-TH-1.1 · Pass: 2_

_Decomposition rationale:_ The parent requires configuration retrieval before enforcement; this child is the atomic read operation.

_Surfaced assumptions:_ A-0139, A-0140, A-0141

##### FR-AI-TH-1.2-2 `[Tier D · atomic]`

**As a** AI matching engine, **I want** Filter vendor candidates against threshold, **so that** Candidate list is pruned to only include vendors meeting threshold.

**Acceptance criteria:**
  - **AC-031** — Candidates below threshold are excluded from match set.
    - _Measurable:_ filtered_vendor_list === [v for v in all_vendors if v.trust_score >= threshold]

_Status: atomic · Priority: critical · Tier: D · Traces to: WF-10, VOC-14 · Pass: 2_

_Decomposition rationale:_ Core enforcement logic: the AI Agent must apply the numeric threshold to vendor ratings during the matching workflow.

_Surfaced assumptions:_ A-0139, A-0140, A-0141

##### FR-AI-TH-1.2-3 `[Tier D · atomic]`

**As a** AI matching engine, **I want** Enforce rejection if no vendor meets threshold, **so that** Matching request is aborted with failure status if no valid vendor exists.

**Acceptance criteria:**
  - **AC-032** — Match fails if empty list remains after filtering.
    - _Measurable:_ if len(filtered_vendor_list) == 0: return error('Threshold violation')

_Status: atomic · Priority: critical · Tier: D · Traces to: FR-AI-TH-1.4 · Pass: 2_

_Decomposition rationale:_ Enforces the bounds and consequence logic; ties to validation constraints defined in sibling FR-AI-TH-1.4.

_Surfaced assumptions:_ A-0139, A-0140, A-0141

##### FR-AI-TH-1.2-4 `[Tier D · atomic]`

**As a** Audit logger, **I want** Record enforcement decision in audit log, **so that** System event records usage of threshold for compliance review.

**Acceptance criteria:**
  - **AC-033** — Decision log entry is written per COMP-5 obligations.
    - _Measurable:_ audit_log.write(event='threshold_enforced', status=filtered_vendor_list)

_Status: atomic · Priority: high · Tier: D · Traces to: FR-AI-TH-1.3 · Pass: 2_

_Decomposition rationale:_ Audit trail commitment; ensures enforcement is traceable, linking to sibling audit logging requirement.

_Surfaced assumptions:_ A-0139, A-0140, A-0141

#### FR-AI-TH-1.3 `[Tier C · pending]`

**As a** Implementation commitment, **I want** Write audit log entry for change, **so that** ENT-AUDIT-LOG records the configuration change event.

**Acceptance criteria:**
  - **AC-028** — Audit trail created for configuration change.
    - _Measurable:_ Row inserted into ENT-AUDIT-LOG with user_id, timestamp, and delta values

_Status: pending · Priority: high · Tier: C · Traces to: US-014, COMP-5, Q-2 · Pass: 1_

_Decomposition rationale:_ Addresses the specific audit trail AC-028 and ensures compliance with COMP-5 monitoring rules.

_Surfaced assumptions:_ A-0041, A-0042, A-0043, A-0044

##### FR-AI-TH-1.3.1 `[Tier C · pending]`

**As a** Auth Handler, **I want** Resolve active user identity from session token, **so that** User ID string is populated in the audit row.

**Acceptance criteria:**
  - **AC-030** — User ID field is non-null and matches session token claims
    - _Measurable:_ user_id != null AND user_id matches session token claims

_Status: pending · Priority: critical · Tier: C · Traces to: US-014, TECH-11 · Pass: 2_

_Decomposition rationale:_ Must identify who made the change. Auth context (Better-Auth) is the only source of truth for user identity.

_Surfaced assumptions:_ A-0142, A-0143, A-0144

  - **FR-AI-TH-1.3.1.1** `[Tier D · atomic]`
    **As a** Identity Resolver, **I want** Extract user_id claim from Better-Auth token payload, **so that** Resolved user_id string obtained from session token claims.

    **Acceptance criteria:**
      - **AC-030.1** — Token payload contains valid user_id claim
        - _Measurable:_ token.payload.sub !== null AND token.payload.issuer === trusted_provider_id

    _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-11, US-014 · Pass: 3_

    _Decomposition rationale:_ Defines the specific extraction logic mandated by TECH-11 (Better-Auth); isolates the claim mapping from the physical write operation.

    _Surfaced assumptions:_ A-0317
  - **FR-AI-TH-1.3.1.2** `[Tier D · atomic]`
    **As a** Audit Payload Builder, **I want** Populate audit log row with resolved user_id, **so that** Audit row payload contains populated user_id field.

    **Acceptance criteria:**
      - **AC-030.2** — Audit row payload has user_id field set to resolved value
        - _Measurable:_ payload.user_id === extracted_user_id AND payload.user_id !== null

    _Status: atomic · Priority: critical · Tier: D · Traces to: FR-AI-TH-1.3.3 · Pass: 3_

    _Decomposition rationale:_ Separates the value preparation (this child) from the physical persistence operation (sibling FR-AI-TH-1.3.3), ensuring clean handoff.

    _Surfaced assumptions:_ A-0317
##### FR-AI-TH-1.3.2 `[Tier C · pending]`

**As a** Config Manager, **I want** Compute diff between old and new configuration state, **so that** Delta object contains key, old_value, new_value.

**Acceptance criteria:**
  - **AC-031** — Delta structure matches schema
    - _Measurable:_ Delta JSON validates against delta_schema

_Status: pending · Priority: critical · Tier: C · Traces to: US-014 · Pass: 2_

_Decomposition rationale:_ Content of the audit log must represent the semantic change, not just a hash or opaque blob.

_Surfaced assumptions:_ A-0142, A-0143, A-0144

  - **FR-AI-TH-1.3.2.1** `[Tier C · pending]`
    **As a** CAM operator, **I want** Perform deep equality check to identify structural changes in nested configuration objects, **so that** Only leaf-level value changes are captured in the delta key-path.

    **Acceptance criteria:**
      - **AC-101** — Diff output matches structural changes in nested configs.
        - _Measurable:_ diff_output.keys === diff_paths_from_deep_eq(old_config, new_config)

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-AI-TH-1.3.1, FR-AI-TH-1.3.3 · Pass: 3_

    _Decomposition rationale:_ Defines the specific comparison logic required to generate the delta; without this child, the parent has no defined behavior for nested state.

    _Surfaced assumptions:_ A-0318, A-0319
    - **FR-AI-TH-1.3.2.1.1** `[Tier D · atomic]`
      **As a** Logic component, **I want** Detect structural key insertions, **so that** Path recorded for every key present in new_config and absent from old_config.

      **Acceptance criteria:**
        - **AC-001** — Inserted keys appear in delta output.
          - _Measurable:_ key in new_config AND key NOT in old_config implies key in diff_paths

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-AI-TH-1.3.2.1, FR-AI-TH-1.3.2.2 · Pass: 4_

      _Decomposition rationale:_ Structural insertions are one atomic component of the deep equality check; this child isolates the detection logic for new keys.

      _Surfaced assumptions:_ A-0637, A-0638, A-0639
    - **FR-AI-TH-1.3.2.1.2** `[Tier D · atomic]`
      **As a** Logic component, **I want** Detect structural key deletions, **so that** Path recorded for every key present in old_config and absent from new_config.

      **Acceptance criteria:**
        - **AC-002** — Deleted keys appear in delta output.
          - _Measurable:_ key in old_config AND key NOT in new_config implies key in diff_paths

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-AI-TH-1.3.2.1, FR-AI-TH-1.3.2.2 · Pass: 4_

      _Decomposition rationale:_ Structural deletions are the complementary atomic component of the deep equality check, distinct from value modifications.

      _Surfaced assumptions:_ A-0637, A-0638, A-0639
    - **FR-AI-TH-1.3.2.1.3** `[Tier D · atomic]`
      **As a** Logic component, **I want** Detect leaf-level value modifications, **so that** Path recorded for every key present in both configs where values differ strictly.

      **Acceptance criteria:**
        - **AC-003** — Modified leaf values appear in delta output.
          - _Measurable:_ key in both AND new_value !== old_value (strict equality) implies key in diff_paths

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-AI-TH-1.3.2.1, FR-AI-TH-1.3.2.2 · Pass: 4_

      _Decomposition rationale:_ This child isolates the value-change logic, ensuring only leaf-level value differences contribute to the structural delta.

      _Surfaced assumptions:_ A-0637, A-0638, A-0639
    - **FR-AI-TH-1.3.2.1.4** `[Tier D · atomic]`
      **As a** Filter component, **I want** Exclude metadata fields from comparison, **so that** System-generated keys (e.g., created_at, updated_at) are ignored in diff paths.

      **Acceptance criteria:**
        - **AC-004** — Metadata keys do not appear in delta output.
          - _Measurable:_ is_metadata(key) OR is_system_generated(key) implies key NOT in diff_paths

      _Status: atomic · Priority: medium · Tier: D · Traces to: FR-AI-TH-1.3.2.1, FR-AI-TH-1.3.2.2 · Pass: 4_

      _Decomposition rationale:_ This child enforces the existing assumption regarding metadata fields, ensuring they do not skew the delta output.

      _Surfaced assumptions:_ A-0637, A-0638, A-0639
  - **FR-AI-TH-1.3.2.2** `[Tier C · pending]`
    **As a** CAM operator, **I want** Construct Delta JSON object with required fields (key, old_value, new_value), **so that** Delta object strictly conforms to delta_schema.

    **Acceptance criteria:**
      - **AC-102** — Delta JSON includes exactly key, old_value, new_value.
        - _Measurable:_ Object.keys(delta_obj).filter(k => k !== 'key' && k !== 'old_value' && k !== 'new_value').length === 0

    _Status: pending · Priority: critical · Tier: C · Traces to: FR-AI-TH-1.3.3, TECH-8 · Pass: 3_

    _Decomposition rationale:_ Defines the data contract for the output; binds the downstream consumption of the delta object to a specific structure.

    _Surfaced assumptions:_ A-0318, A-0319
    - **FR-AI-TH-1.3.2.2.1** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Read and serialize current state snapshot into 'new_value' field, **so that** The 'new_value' field contains the exact current configuration state without metadata fields..

      **Acceptance criteria:**
        - **AC-102.1** — The 'new_value' field matches the current database state snapshot.
          - _Measurable:_ delta_obj.new_value === getCurrentStateSnapshot(excludeMetadataFields())

      _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-8, FR-AI-TH-1.3.2.1 · Pass: 4_

      _Decomposition rationale:_ The construction of the Delta object is composed of specific data binding operations. This child isolates the binding of the current state to the 'new_value' field, which is a distinct atomic action testable on its own.

      _Surfaced assumptions:_ A-0640, A-0641
    - **FR-AI-TH-1.3.2.2.2** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Read and serialize previous state snapshot into 'old_value' field, **so that** The 'old_value' field contains the exact configuration state from the prior commit without metadata fields..

      **Acceptance criteria:**
        - **AC-102.2** — The 'old_value' field matches the previous database state snapshot.
          - _Measurable:_ delta_obj.old_value === getPreviousStateSnapshot(excludeMetadataFields())

      _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-8, FR-AI-TH-1.3.2.1 · Pass: 4_

      _Decomposition rationale:_ The 'old_value' binding is a separate atomic action from the 'new_value'. It represents the retrieval of historical state required for the diff object, which can be verified independently.

      _Surfaced assumptions:_ A-0640, A-0641
    - **FR-AI-TH-1.3.2.2.3** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Construct 'key' field by resolving the path identifier of the changed entity, **so that** The 'key' field contains the unique path identifier for the entity that changed..

      **Acceptance criteria:**
        - **AC-102.3** — The 'key' field contains a valid path string.
          - _Measurable:_ Object.keys(delta_obj).includes('key') && validatePathIdentifier(delta_obj.key)

      _Status: atomic · Priority: high · Tier: D · Traces to: FR-AI-TH-1.3.2.1, TECH-9 · Pass: 4_

      _Decomposition rationale:_ Determining the change key is a logical step in constructing the delta object, distinct from value capture. It requires resolving the path identifier from the change trigger event, making it a distinct atomic commitment.

      _Surfaced assumptions:_ A-0640, A-0641
    - **FR-AI-TH-1.3.2.2.4** `[Tier D · atomic]`
      **As a** CAM operator, **I want** Enforce strict schema validation to exclude extraneous keys, **so that** No keys other than 'key', 'old_value', 'new_value' exist in the resulting JSON..

      **Acceptance criteria:**
        - **AC-102.4** — No extraneous keys are present in the payload.
          - _Measurable:_ Object.keys(delta_obj).filter(k => k !== 'key' && k !== 'old_value' && k !== 'new_value').length === 0

      _Status: atomic · Priority: critical · Tier: D · Traces to: FR-AI-TH-1.3.2.1, TECH-9 · Pass: 4_

      _Decomposition rationale:_ The parent requirement specifies 'strictly conforms to delta_schema'. This child isolates the validation step that ensures the output payload adheres to the structural constraint, which is a testable leaf operation.

      _Surfaced assumptions:_ A-0640, A-0641
##### FR-AI-TH-1.3.3 `[Tier D · atomic]`

**As a** Audit Writer, **I want** Insert row into ENT-AUDIT-LOG, **so that** Row persisted in database.

**Acceptance criteria:**
  - **AC-032** — Transaction commits successfully
    - _Measurable:_ SELECT COUNT(*) FROM audit_log WHERE id=new_id = 1

_Status: atomic · Priority: critical · Tier: D · Traces to: US-014, COMP-5 · Pass: 2_

_Decomposition rationale:_ This is the final persistence operation, making it a leaf action (Tier D). It executes the commit step.

_Surfaced assumptions:_ A-0142, A-0143, A-0144

#### FR-AI-TH-1.4 `[Tier C · pending]`

**As a** Implementation commitment, **I want** Validate threshold bounds, **so that** Rejected configurations outside allowed range are not persisted.

**Acceptance criteria:**
  - **AC-030** — Validation logic rejects invalid values.
    - _Measurable:_ Input rejected if threshold < 0 or > 100 or missing required fields

_Status: pending · Priority: medium · Tier: C · Traces to: US-014 · Pass: 1_

_Decomposition rationale:_ Defines the system-internal restriction (constraint) on what values are considered valid settings.

_Surfaced assumptions:_ A-0041, A-0042, A-0043, A-0044

##### FR-AI-TH-1.4.1 `[Tier D · atomic]`

**As a** CAM operator, **I want** Enforce minimum threshold constraint (>= 0), **so that** Threshold values below 0 are rejected.

**Acceptance criteria:**
  - **AC-030.1** — Threshold value must be non-negative.
    - _Measurable:_ threshold >= 0.0 for all persisted configurations

_Status: atomic · Priority: critical · Tier: D · Traces to: FR-AI-TH-1.1, FR-AI-TH-1.2, TECH-6 · Pass: 2_

_Decomposition rationale:_ Decomposing the range validation into its lower bound invariant ensures the system prevents invalid physics/parameters at the boundary.

_Surfaced assumptions:_ A-0145, A-0146

##### FR-AI-TH-1.4.2 `[Tier D · atomic]`

**As a** CAM operator, **I want** Enforce maximum threshold constraint (<= 100), **so that** Threshold values above 100 are rejected.

**Acceptance criteria:**
  - **AC-030.2** — Threshold value must not exceed 100.
    - _Measurable:_ threshold <= 100.0 for all persisted configurations

_Status: atomic · Priority: critical · Tier: D · Traces to: FR-AI-TH-1.1, FR-AI-TH-1.2, TECH-6 · Pass: 2_

_Decomposition rationale:_ Decomposing the range validation into its upper bound invariant ensures the system prevents invalid physics/parameters at the boundary.

_Surfaced assumptions:_ A-0145, A-0146

##### FR-AI-TH-1.4.3 `[Tier D · atomic]`

**As a** CAM operator, **I want** Validate presence of required configuration fields, **so that** Missing required fields cause rejection.

**Acceptance criteria:**
  - **AC-030.3** — All fields in required schema must be present.
    - _Measurable:_ config.get('required_fields').keys() is subset of config.keys()

_Status: atomic · Priority: high · Tier: D · Traces to: FR-AI-TH-1.2, FR-AI-TH-1.3, TECH-6 · Pass: 2_

_Decomposition rationale:_ Missing fields prevent the system from correctly applying the threshold logic at runtime or generating audit events.

_Surfaced assumptions:_ A-0145, A-0146

##### FR-AI-TH-1.4.4 `[Tier D · atomic]`

**As a** CAM operator, **I want** Reject invalid configuration and prevent persistence, **so that** Database transaction rolled back or failed with error code.

**Acceptance criteria:**
  - **AC-030.4** — Invalid config must not be persisted.
    - _Measurable:_ transaction.rollback() occurred if validation_failed == true

_Status: atomic · Priority: critical · Tier: D · Traces to: FR-AI-TH-1.1, FR-AI-TH-1.2, FR-AI-TH-1.3, TECH-6 · Pass: 2_

_Decomposition rationale:_ Enforces the parent requirement's primary goal: ensuring rejected configurations are not persisted to the database.

_Surfaced assumptions:_ A-0145, A-0146

### FR US-015 `[pending]`

**As a** Admin, **I want** Migrate Legacy Property Data to Registry, **so that** Historical property records are synchronized to Hestami CDM.

**Acceptance criteria:**
  - **AC-029** — Data migrated
    - _Measurable:_ Legacy address and photo files mapped to ENT-PROPERTY and ENT-UNIT
  - **AC-030** — Sync completed
    - _Measurable:_ WF-15 reports 0 errors for 95% of legacy records

_Status: pending · Priority: medium · Traces to: Q-4, WF-15, VOC-1 · Pass: 0_

#### US-015-1 `[Tier C · pending]`

**As a** Data Engineer, **I want** Map legacy address fields to ENT-PROPERTY address schema, **so that** Legacy textual addresses resolved to canonical ENT-PROPERTY records.

**Acceptance criteria:**
  - **AC-01** — All legacy address columns are mapped to a canonical ENT-PROPERTY record.
    - _Measurable:_ count(legacy_records) == count(migrated_property_records) AND (property_id != null for all migrated)

_Status: pending · Priority: critical · Tier: C · Traces to: VOC-1, ENT-PROPERTY · Pass: 1_

_Decomposition rationale:_ This child binds the specific field-level mapping strategy required to satisfy AC-029. It converts high-level sync goals into schema transformation rules.

_Surfaced assumptions:_ A-0045, A-0046, A-0047

##### US-015-1.1 `[Tier D · atomic]`

**As a** Data Cleaner, **I want** Normalize legacy address text string to standard format, **so that** Consistent textual representation of legacy addresses (e.g., '123 Main St' -> '123 Main Street').

**Acceptance criteria:**
  - **AC-001** — Normalized text conforms to schema rules.
    - _Measurable:_ normalized_string.length > 0 AND normalized_string.is_valid_pattern === true

_Status: atomic · Priority: high · Tier: D · Traces to: VOC-1, ENT-PROPERTY, WF-15 · Pass: 2_

_Decomposition rationale:_ Legacy addresses are unstructured text; this atomic operation ensures schema compliance before enrichment. D-level because text cleaning is a testable leaf operation.

_Surfaced assumptions:_ A-0147, A-0148, A-0149

##### US-015-1.2 `[Tier D · atomic]`

**As a** Enrichment Engine, **I want** Resolve legacy ZIP code to ENT-TX-REGION record, **so that** Tax jurisdiction assigned to every migrated property record.

**Acceptance criteria:**
  - **AC-002** — Tax region matches ZIP code.
    - _Measurable:_ region.state_code === address.normalized_zip_prefix_state

_Status: atomic · Priority: high · Tier: D · Traces to: VOC-1, ENT-TX-REGION, WF-15 · Pass: 2_

_Decomposition rationale:_ Tax compliance requires accurate regional mapping. Atomic because it's a specific lookup and join operation.

_Surfaced assumptions:_ A-0147, A-0148, A-0149

##### US-015-1.3 `[Tier D · atomic]`

**As a** Matcher, **I want** Match normalized address to existing canonical ENT-PROPERTY, **so that** property_id linked to legacy record.

**Acceptance criteria:**
  - **AC-003** — Legacy record linked to unique property ID.
    - _Measurable:_ property_id != null AND property_id IS NOT NULL

_Status: atomic · Priority: critical · Tier: D · Traces to: ENT-PROPERTY, VOC-1, US-015-3 · Pass: 2_

_Decomposition rationale:_ Core mapping logic. Must reference Validation (US-015-3) to ensure matched records pass the sync check.

_Surfaced assumptions:_ A-0147, A-0148, A-0149

##### US-015-1.4 `[Tier D · atomic]`

**As a** Quality Flagger, **I want** Flag records with unresolvable mismatch for manual review, **so that** Quarantine log entry created for manual review queue.

**Acceptance criteria:**
  - **AC-004** — Unresolvable records logged to audit trail.
    - _Measurable:_ audit_log.exists(entry.quarantine_id) === true FOR failed_rows

_Status: atomic · Priority: high · Tier: D · Traces to: US-015-4, COMP-1 · Pass: 2_

_Decomposition rationale:_ Ensures data integrity compliance. Traces to quarantine sibling (US-015-4) and compliance (COMP-1).

_Surfaced assumptions:_ A-0147, A-0148, A-0149

#### US-015-2 `[Tier C · pending]`

**As a** Asset Operator, **I want** Ingest legacy photo files into ENT-DIGITAL-FILE storage, **so that** Digital asset files are stored and indexed in SeaweedFS (TECH-14).

**Acceptance criteria:**
  - **AC-02** — Photo files match source hash and metadata.
    - _Measurable:_ hash(storage_file) === hash(source_file) AND (metadata_extracted == source_metadata)

_Status: pending · Priority: high · Tier: C · Traces to: ENT-DIGITAL-FILE, TECH-14 · Pass: 1_

_Decomposition rationale:_ This child commits to the specific storage and ingestion technology for media, separating the logic from the structural mapping of addresses.

_Surfaced assumptions:_ A-0045, A-0046, A-0047

##### US-015-2.1 `[Tier C · pending]`

**As a** Media Ingestion Service, **I want** Validate integrity of legacy source file against manifest hash, **so that** File is rejected if hashes do not match, otherwise passes to extraction.

**Acceptance criteria:**
  - **AC-02.1** — Storage file hash equals source file hash exactly.
    - _Measurable:_ hex(hash(storage_file)) === hex(hash(source_manifest))

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-2, TECH-14 · Pass: 2_

_Decomposition rationale:_ Hash validation is a prerequisite for storage commitment; defines the first gate in the ingestion pipeline.

_Surfaced assumptions:_ A-0150, A-0151, A-0152

  - **US-015-2.1.1** `[Tier D · atomic]`
    **As a** Validator, **I want** Read legacy file from SeaweedFS bucket and compute digest, **so that** File hash (hex) is computed from raw bytes.

    **Acceptance criteria:**
      - **AC-01** — File hash is computed from the complete byte stream without caching.
        - _Measurable:_ read_bytes(count=file_size) === computed_hash_input

    _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-14, ENT-DIGITAL-FILE · Pass: 3_

    _Decomposition rationale:_ Computing the actual hash of the ingested file is the first atomic operation required to enable the comparison logic defined in the parent.

    _Surfaced assumptions:_ A-0320, A-0321
  - **US-015-2.1.2** `[Tier D · atomic]`
    **As a** Validator, **I want** Read manifest record and compute digest, **so that** Expected file hash (hex) is computed from manifest content.

    **Acceptance criteria:**
      - **AC-02** — Manifest hash is derived from the source manifest storage record.
        - _Measurable:_ read_bytes(count=manifest_size) === computed_manifest_hash

    _Status: atomic · Priority: critical · Tier: D · Traces to: TECH-14, A-0150 · Pass: 3_

    _Decomposition rationale:_ We must compute the hash of the manifest record itself to verify the integrity of the integrity record, preventing tampering with the reference value.

    _Surfaced assumptions:_ A-0320, A-0321
  - **US-015-2.1.3** `[Tier C · pending]`
    **As a** Policy Enforcer, **I want** Enforce SHA-256 algorithm for all hash calculations, **so that** Hash digests are consistent and verifiable by external systems.

    **Acceptance criteria:**
      - **AC-03** — Hash function used is SHA-256 per system security standards.
        - _Measurable:_ algorithm_used === 'SHA-256'

    _Status: pending · Priority: high · Tier: C · Traces to: COMP-2, TECH-14 · Pass: 3_

    _Decomposition rationale:_ This is an implementation commitment on cryptographic standards to ensure collision resistance and interoperability with other services expecting hex digests.

    _Surfaced assumptions:_ A-0320, A-0321
    - **US-015-2.1.3-C-01** `[Tier C · pending]`
      **As a** Hash Engine, **I want** Calculate file digest using SHA-256 for legacy file ingestion, **so that** Legacy file hash matches manifest record.

      **Acceptance criteria:**
        - **AC-001** — Hash calculation completes using SHA-256 algorithm.
          - _Measurable:_ sha256(file_bytes).length === 64 && sha256(file_bytes).algorithm === 'SHA-256'

      _Status: pending · Priority: critical · Tier: C · Traces to: US-015-2.1.1 · Pass: 4_

      _Decomposition rationale:_ This child binds the policy to the legacy file ingestion workflow defined in sibling 2.1.1, ensuring the policy is applied where legacy bytes are read.

      _Surfaced assumptions:_ A-0642, A-0643, A-0644
    - **US-015-2.1.3-C-02** `[Tier C · pending]`
      **As a** Hash Engine, **I want** Calculate file digest using SHA-256 for manifest content, **so that** Stored manifest hash is valid SHA-256 digest.

      **Acceptance criteria:**
        - **AC-002** — Manifest hash is derived from manifest content bytes.
          - _Measurable:_ sha256(manifest_content).length === 64 && manifest_record.hash === sha256(manifest_content)

      _Status: pending · Priority: critical · Tier: C · Traces to: US-015-2.1.2 · Pass: 4_

      _Decomposition rationale:_ This child binds the policy to the manifest read workflow defined in sibling 2.1.2, ensuring consistency for metadata extraction.

      _Surfaced assumptions:_ A-0642, A-0643, A-0644
    - **US-015-2.1.3-C-03** `[Tier C · pending]`
      **As a** Audit Logger, **I want** Append SHA-256 hash decision to audit trail, **so that** Validation event records hash values and decision state.

      **Acceptance criteria:**
        - **AC-003** — Audit log entry includes the calculated hash digest.
          - _Measurable:_ audit_log_entry.hash_value.length === 64 && audit_log_entry.timestamp <= current_time

      _Status: pending · Priority: high · Tier: C · Traces to: US-015-2.1.6 · Pass: 4_

      _Decomposition rationale:_ This child binds the policy to the logging workflow defined in sibling 2.1.6, ensuring the outcome of the policy is recorded for compliance.

      _Surfaced assumptions:_ A-0642, A-0643, A-0644
    - **US-015-2.1.3-C-04** `[Tier C · pending]`
      **As a** Ingestion Pipeline, **I want** Compute hash for newly uploaded digital assets, **so that** Digital asset record includes SHA-256 hash immediately upon ingest.

      **Acceptance criteria:**
        - **AC-004** — Hash is generated for ENT-DIGITAL-FILE upon UJ-9 asset creation.
          - _Measurable:_ asset_record.hash_algorithm === 'SHA-256' && asset_record.hash_value !== null

      _Status: pending · Priority: high · Tier: C · Traces to: UJ-9 · Pass: 4_

      _Decomposition rationale:_ This child ensures the policy applies to the new asset ingestion workflow (UJ-9), covering the 'Upload' path not explicitly named in sibling context.

      _Surfaced assumptions:_ A-0642, A-0643, A-0644
    - **US-015-2.1.3-C-05** `[Tier C · pending]`
      **As a** API Endpoint, **I want** Serve hash digests via external verification endpoints, **so that** External systems receive consistent SHA-256 hashes in API responses.

      **Acceptance criteria:**
        - **AC-005** — API response headers indicate SHA-256 usage.
          - _Measurable:_ response.header['Hash-Algorithm'] === 'SHA-256' && response.header['Hash-Algo'] === 'SHA-256'

      _Status: pending · Priority: medium · Tier: C · Traces to: TECH-9, UJ-10 · Pass: 4_

      _Decomposition rationale:_ This child binds the policy to the reporting and verification workflows (UJ-10, TECH-9) to ensure external systems can verify digests.

      _Surfaced assumptions:_ A-0642, A-0643, A-0644
  - **US-015-2.1.4** `[Tier D · atomic]`
    **As a** Router, **I want** Route file to extraction job on successful hash match, **so that** File proceeds to metadata extraction workflow.

    **Acceptance criteria:**
      - **AC-04** — Valid file triggers extraction queue insertion.
        - _Measurable:_ if (file_hash === manifest_hash) then push(file, extraction_queue)

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-015-2.2 · Pass: 3_

    _Decomposition rationale:_ Defines the positive flow path. This child binds directly to the sibling requirement for metadata extraction (US-015-2.2) upon validation success.

    _Surfaced assumptions:_ A-0320, A-0321
  - **US-015-2.1.5** `[Tier D · atomic]`
    **As a** Quarantine Handler, **I want** Route file to quarantine queue on hash mismatch, **so that** File is isolated for manual review or rejection.

    **Acceptance criteria:**
      - **AC-05** — Mismatched file triggers quarantine workflow.
        - _Measurable:_ if (file_hash !== manifest_hash) then push(file, quarantine_queue)

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-015-2.5 · Pass: 3_

    _Decomposition rationale:_ Defines the negative flow path. This child binds directly to the sibling requirement for logging quarantine events (US-015-2.5) upon validation failure.

    _Surfaced assumptions:_ A-0320, A-0321
  - **US-015-2.1.6** `[Tier D · atomic]`
    **As a** Logger, **I want** Append validation event to audit log, **so that** Audit trail records hash values and decision state.

    **Acceptance criteria:**
      - **AC-06** — Validation event is persisted to audit log within 1 second.
        - _Measurable:_ audit_write(timestamp) === event_time && audit_write(status) === validation_result

    _Status: atomic · Priority: medium · Tier: D · Traces to: ENT-AUDIT-LOG, COMP-2 · Pass: 3_

    _Decomposition rationale:_ Compliance requirement to log the validation outcome (acceptance/rejection) for audit purposes.

    _Surfaced assumptions:_ A-0320, A-0321
##### US-015-2.2 `[Tier C · pending]`

**As a** Media Ingestion Service, **I want** Extract metadata from valid legacy source file, **so that** Metadata record created with EXIF/GPS/Optical text data.

**Acceptance criteria:**
  - **AC-02.2** — Metadata fields are populated and non-null.
    - _Measurable:_ metadata_extracted !== null AND metadata_extracted.source_date !== null

_Status: pending · Priority: high · Tier: C · Traces to: ENT-DIGITAL-META, TECH-19 · Pass: 2_

_Decomposition rationale:_ Metadata extraction defines the data model commitment for the asset; ensures indexed data exists for search.

_Surfaced assumptions:_ A-0150, A-0151, A-0152

  - **FR-ACCT-1.1** `[Tier B · pending]`
    **As a** Architectural Strategy, **I want** Select and mandate the use of ExifTool (TECH-19) for header parsing, **so that** Parsing of legacy binary headers utilizes the configured toolchain.

    **Acceptance criteria:**
      - **AC-001** — ExifTool binary is invoked for every valid legacy file
        - _Measurable:_ System logs invocation of the ExifTool binary (or subprocess) within 5s of upload trigger

    _Status: pending · Priority: critical · Tier: B · Traces to: TECH-19 · Pass: 3_

    _Decomposition rationale:_ Defines the primary technical approach for extraction, binding downstream tooling and dependencies.

    _Surfaced assumptions:_ A-0322, A-0323, A-0324
  - **FR-ACCT-1.2** `[Tier B · pending]`
    **As a** Functional Scope, **I want** Commit to extracting EXIF, GPS, and OCR fields specifically, **so that** Metadata record contains source_date, device_model, and extracted_text.

    **Acceptance criteria:**
      - **AC-002** — Fields source_date, device_model, extracted_text are populated
        - _Measurable:_ SELECT COUNT(*) FROM metadata_extracted WHERE source_date IS NULL = 0

    _Status: pending · Priority: high · Tier: B · Traces to: ENT-DIGITAL-META · Pass: 3_

    _Decomposition rationale:_ Defines the scope of data extraction, distinguishing from other potential metadata (e.g., file size, modification time).

    _Surfaced assumptions:_ A-0322, A-0323, A-0324
  - **FR-ACCT-1.3** `[Tier C · pending]`
    **As a** Implementation Logic, **I want** Transform GPS coordinates to WGS84 datum (EPSG:4326), **so that** Stored latitude and longitude are usable for geolocation queries.

    **Acceptance criteria:**
      - **AC-003** — GPS coordinates match expected WGS84 precision
        - _Measurable:_ Coordinate system ID in database record metadata equals EPSG:4326

    _Status: pending · Priority: high · Tier: C · Traces to: ENT-PROP-ADDRESS · Pass: 3_

    _Decomposition rationale:_ Compliance with geospatial domain standards required to link metadata to property entities.

    _Surfaced assumptions:_ A-0322, A-0323, A-0324
    - **FR-ACCT-1.3.1** `[Tier C · pending]`
      **As a** Data Validator, **I want** Validate input coordinate string format and source datum ID before reprojection, **so that** Input record contains a valid latitude, longitude, and coordinate_system_id field.

      **Acceptance criteria:**
        - **AC-003.1** — Input record passes schema validation.
          - _Measurable:_ lat and lon fields match expected numeric ranges and coordinate_system_id exists in the canonical dictionary

      _Status: pending · Priority: high · Tier: C · Traces to: ENT-PROP-ADDRESS · Pass: 4_

      _Decomposition rationale:_ Validates the source state before transformation logic is applied; ensures downstream reprojection math has valid operands.

      _Surfaced assumptions:_ A-0645, A-0646
    - **FR-ACCT-1.3.2** `[Tier C · pending]`
      **As a** Reprojection Engine, **I want** Execute coordinate reprojection math to EPSG:4326, **so that** Output coordinates match the WGS84 datum specified in metadata.

      **Acceptance criteria:**
        - **AC-003.2** — Projections align with WGS84 geolocation standards.
          - _Measurable:_ Output latitude and longitude values fall within -180..-90 and 180..90 ranges respectively

      _Status: pending · Priority: high · Tier: C · Traces to: FR-ACCT-1.5 · Pass: 4_

      _Decomposition rationale:_ Binds the transformation algorithm choice; ensures the conversion math is executed before persistence.

      _Surfaced assumptions:_ A-0645, A-0646
    - **FR-ACCT-1.3.3** `[Tier D · atomic]`
      **As a** Data Storage Operator, **I want** Persist transformed coordinates to ENT-PROP-ADDRESS, **so that** Database record holds WGS84 latitude/longitude and EPSG:4326 metadata.

      **Acceptance criteria:**
        - **AC-003.3** — Coordinate system ID stored in metadata.
          - _Measurable:_ ENT-PROP-ADDRESS.record.coordinate_system_id === 'EPSG:4326'

      _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-PROP-ADDRESS · Pass: 4_

      _Decomposition rationale:_ Terminal node representing the committed storage action; ACs are individually testable against the database.

      _Surfaced assumptions:_ A-0645, A-0646
  - **FR-ACCT-1.4** `[Tier C · pending]`
    **As a** Implementation Logic, **I want** Implement 30s timeout on file parsing to prevent resource exhaustion, **so that** Extraction process terminates safely if tool hangs or slows down.

    **Acceptance criteria:**
      - **AC-004** — Parsing process cancels after 30s if not complete
        - _Measurable:_ Job status transitions to 'TIMEOUT' after 30s, queue remains clear

    _Status: pending · Priority: medium · Tier: C · Traces to: TECH-6 · Pass: 3_

    _Decomposition rationale:_ System-side restriction ensuring ingestion pipeline stability under load.

    _Surfaced assumptions:_ A-0322, A-0323, A-0324
  - **FR-ACCT-1.5** `[Tier D · atomic]`
    **As a** Leaf Operation, **I want** Insert parsed metadata into ENT-DIGITAL-META table, **so that** Record is committed to primary storage.

    **Acceptance criteria:**
      - **AC-005** — Row count increases by 1 per successful extraction
        - _Measurable:_ DB row count for file ID matches expected file ingestion count

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-015-2.3, ENT-DIGITAL-META · Pass: 3_

    _Decomposition rationale:_ Atomic persistence action; verification of successful write without further breakdown.

    _Surfaced assumptions:_ A-0322, A-0323, A-0324
##### US-015-2.3 `[Tier C · pending]`

**As a** Media Ingestion Service, **I want** Persist binary file to SeaweedFS storage bucket, **so that** File exists in SeaweedFS with correct object name.

**Acceptance criteria:**
  - **AC-02.3** — File is retrievable from the SeaweedFS bucket.
    - _Measurable:_ GET request to SeaweedFS object path returns file content and 200 status

_Status: pending · Priority: critical · Tier: C · Traces to: TECH-14, WF-4 · Pass: 2_

_Decomposition rationale:_ The core storage commitment; defines the persistence layer for the digital asset.

_Surfaced assumptions:_ A-0150, A-0151, A-0152

  - **US-015-2.3.1** `[Tier C · pending]`
    **As a** Implementation Decision, **I want** Generate object keys using UUID v4 format, **so that** Guaranteed uniqueness across all ingestion events without collisions.

    **Acceptance criteria:**
      - **AC-02.3.1** — Every persisted object has a 36-character hex string key.
        - _Measurable:_ key_length(key) === 36 AND key.matches_regex(^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$)

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-4, TECH-14 · Pass: 3_

    _Decomposition rationale:_ Blob storage requires globally unique keys; UUID v4 is the standard engineering choice to prevent hotspots and collisions without managing a central counter.

    _Surfaced assumptions:_ A-0325, A-0326
  - **US-015-2.3.2** `[Tier D · atomic]`
    **As a** Atomic Verification, **I want** Verify written content via HTTP GET, **so that** File exists and is retrievable with correct status code.

    **Acceptance criteria:**
      - **AC-02.3.2** — The initial write response confirms storage success.
        - _Measurable:_ HTTP response code equals 201 or 200 after the PUT request completes.
      - **AC-02.3.3** — A subsequent GET request returns the original content and 200 status.
        - _Measurable:_ GET response status code equals 200 AND response_content_sha256 === original_file_sha256

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-4, TECH-14 · Pass: 3_

    _Decomposition rationale:_ This child is the direct implementation of AC-02.3; it verifies the system state matches the requirement after the operation completes.

    _Surfaced assumptions:_ A-0325, A-0326
  - **US-015-2.3.3** `[Tier C · pending]`
    **As a** Implementation Decision, **I want** Implement chunked upload for files exceeding 64MB, **so that** No upload timeouts on large media files.

    **Acceptance criteria:**
      - **AC-02.3.4** — Single PUT requests are capped at 64MB.
        - _Measurable:_ file_size > 64MB implies multipart_upload_request is initiated instead of single_put.

    _Status: pending · Priority: high · Tier: C · Traces to: TECH-14, WF-4 · Pass: 3_

    _Decomposition rationale:_ Large single-byte-stream uploads increase timeout risks; chunking is the engineering choice to mitigate operational risk and align with storage best practices.

    _Surfaced assumptions:_ A-0325, A-0326
  - **US-015-2.3.4** `[Tier C · pending]`
    **As a** Implementation Decision, **I want** Use conditional upload requests for idempotency, **so that** Duplicate retries do not corrupt stored object.

    **Acceptance criteria:**
      - **AC-02.3.5** — Retry of an existing key uses conditional headers to verify state.
        - _Measurable:_ If object exists, request uses conditional write header and returns 200 or 308 rather than overwriting blindly.

    _Status: pending · Priority: high · Tier: C · Traces to: WF-4, TECH-14 · Pass: 3_

    _Decomposition rationale:_ Ingestion pipelines encounter transient failures; idempotency prevents data duplication when clients retry failed requests.

    _Surfaced assumptions:_ A-0325, A-0326
##### US-015-2.4 `[Tier C · pending]`

**As a** Media Ingestion Service, **I want** Link file to primary property or entity record, **so that** Digital asset record linked to ENT-DIGITAL-FILE ID and Property ID.

**Acceptance criteria:**
  - **AC-02.4** — Foreign key relationship is established in database.
    - _Measurable:_ SELECT * FROM digital_assets WHERE id = asset_id AND property_id IS NOT NULL

_Status: pending · Priority: medium · Tier: C · Traces to: UJ-9, ENT-PROPERTY · Pass: 2_

_Decomposition rationale:_ Establishes the semantic link between the media and the property owner context required for UJ-9.

_Surfaced assumptions:_ A-0150, A-0151, A-0152

  - **FR-015-2.4-01** `[Tier C · pending]`
    **As a** Search logic component, **I want** Identify property by querying available metadata fields, **so that** Unique property ID retrieved or candidate list returned.

    **Acceptance criteria:**
      - **AC-02.4-01** — System returns single property ID or list of candidates
        - _Measurable:_ Result set size <= 1 for 'Exact Match' logic OR Result set size > 1 for 'Candidate List' logic

    _Status: pending · Priority: critical · Tier: C · Traces to: US-015-2.2, UJ-9 · Pass: 3_

    _Decomposition rationale:_ Binding a file to a property requires resolving the property identity first. This child defines the search strategy that consumes the metadata produced by sibling US-015-2.2.

    _Surfaced assumptions:_ A-0327, A-0328, A-0329
  - **FR-015-2.4-02** `[Tier C · pending]`
    **As a** Data layer component, **I want** Write foreign key constraint to digital asset record, **so that** Digital asset record linked to property ID.

    **Acceptance criteria:**
      - **AC-02.4-02** — Foreign key column populated on commit
        - _Measurable:_ UPDATE digital_assets SET property_id = <value> WHERE id = <asset_id>

    _Status: pending · Priority: critical · Tier: C · Traces to: US-015-2.3, UJ-9 · Pass: 3_

    _Decomposition rationale:_ After a property is identified, the system must physically establish the relationship in the database. This child binds the implementation of the AC (FK established) to the write operation.

    _Surfaced assumptions:_ A-0327, A-0328, A-0329
  - **FR-015-2.4-03** `[Tier C · pending]`
    **As a** Error handling component, **I want** Route unmatched or ambiguous assets to manual review, **so that** Failed links queued for manual resolution.

    **Acceptance criteria:**
      - **AC-02.4-03** — No silent failures on ambiguous matches
        - _Measurable:_ If match_count > 1, status transitions to 'MANUAL_REVIEW' queue linked to US-015-2.5

    _Status: pending · Priority: high · Tier: C · Traces to: US-015-2.5, UJ-9 · Pass: 3_

    _Decomposition rationale:_ Linking is not always deterministic. This child defines the boundary for when the automation stops and human intervention (Quarantine/Review) begins.

    _Surfaced assumptions:_ A-0327, A-0328, A-0329
##### US-015-2.5 `[Tier C · pending]`

**As a** Media Ingestion Service, **I want** Log quarantine events for files failing validation, **so that** Failed files routed to manual review queue.

**Acceptance criteria:**
  - **AC-02.5** — Quarantine event logged with error details.
    - _Measurable:_ INSERT INTO failed_ingest_logs (source_hash, error_code) is successful

_Status: pending · Priority: high · Tier: C · Traces to: US-015-4, ENT-AUDIT-LOG · Pass: 2_

_Decomposition rationale:_ Handles failures as defined in sibling requirement US-015-4; ensures no data loss during migration.

_Surfaced assumptions:_ A-0150, A-0151, A-0152

  - **US-015-2.5.1** `[Tier C · pending]`
    **As a** Architecture Engineer, **I want** Define structure for failed_ingest_logs table, **so that** Schema supports source_hash, error_code, and timestamp columns.

    **Acceptance criteria:**
      - **AC-2.5.1** — Table schema matches required columns.
        - _Measurable:_ CREATE TABLE failed_ingest_logs (source_hash VARCHAR, error_code VARCHAR, created_at TIMESTAMP) succeeds without error

    _Status: pending · Priority: critical · Tier: C · Traces to: WF-4, ENT-AUDIT-LOG · Pass: 3_

    _Decomposition rationale:_ Defines the storage boundary for the failure event. Without this schema commitment, the logging operation (AC) cannot execute.

    _Surfaced assumptions:_ A-0330, A-0331, A-0332
  - **US-015-2.5.2** `[Tier C · pending]`
    **As a** Integration Engineer, **I want** Route failed file to manual_review_queue, **so that** File object state changes to 'ReviewPending' and metadata updated.

    **Acceptance criteria:**
      - **AC-2.5.2** — File state transitions correctly.
        - _Measurable:_ file.status == 'ReviewPending' AND file.quarantine_flag == true for any row in digital_assets where hash in failed_logs

    _Status: pending · Priority: high · Tier: C · Traces to: WF-4, ENT-DIGITAL-FILE, US-015-2.1 · Pass: 3_

    _Decomposition rationale:_ Separates the routing logic from the logging. Commits to the workflow path for errors distinct from successful ingestion (US-015-2.1).

    _Surfaced assumptions:_ A-0330, A-0331, A-0332
  - **US-015-2.5.3** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Persist single quarantine log entry, **so that** Row exists in failed_ingest_logs with populated error_code.

    **Acceptance criteria:**
      - **AC-2.5.3** — Single row insert succeeds.
        - _Measurable:_ SELECT count(*) FROM failed_ingest_logs WHERE source_hash = :hash AND error_code = :code returns 1

    _Status: atomic · Priority: critical · Tier: D · Traces to: ENT-AUDIT-LOG, ENT-DIGITAL-FILE · Pass: 3_

    _Decomposition rationale:_ Atomic action defining the leaf operation for the logging commitment. Acceptance criteria are individually testable without further decomposition.

    _Surfaced assumptions:_ A-0330, A-0331, A-0332
#### US-015-3 `[Tier C · pending]`

**As a** QA Analyst, **I want** Run sync validation script against WF-15 metrics, **so that** Error count reported is within 95% success threshold.

**Acceptance criteria:**
  - **AC-03** — Reported error rate meets 95% completion standard.
    - _Measurable:_ count(error_logs) <= (0.05 * total_legacy_records)

_Status: pending · Priority: critical · Tier: C · Traces to: WF-15 · Pass: 1_

_Decomposition rationale:_ This child commits to the specific verification metric (AC-030) defined in the parent, translating the acceptance criteria into an actionable validation step.

_Surfaced assumptions:_ A-0045, A-0046, A-0047

##### US-015-3-01 `[Tier D · atomic]`

**As a** QA Script Operator, **I want** Verify ENT-PROPERTY address records against legacy source schema, **so that** Address schema consistency is confirmed for all mapped records.

**Acceptance criteria:**
  - **AC-01** — Every ENT-PROPERTY record has a matching legacy source address.
    - _Measurable:_ forall r in legacy_addresses: exists p in ENT-PROPERTY such that r.id == p.source_id and r.schema_match == true

_Status: atomic · Priority: critical · Tier: D · Traces to: US-015-1 · Pass: 2_

_Decomposition rationale:_ This child isolates the validation task for the address domain, ensuring the specific output of sibling US-015-1 (Map legacy address fields) is verified correctly before counting errors.

_Surfaced assumptions:_ A-0153, A-0154, A-0155, A-0156, A-0157

##### US-015-3-02 `[Tier D · atomic]`

**As a** QA Script Operator, **I want** Verify ENT-DIGITAL-FILE ingestion records exist for all legacy photos, **so that** Digital file existence is confirmed for all expected legacy assets.

**Acceptance criteria:**
  - **AC-02** — Every legacy photo file has a corresponding record in ENT-DIGITAL-FILE.
    - _Measurable:_ forall f in legacy_photos: exists d in ENT-DIGITAL-FILE such that d.file_path == f.ingest_path and d.status == 'indexed'

_Status: atomic · Priority: critical · Tier: D · Traces to: US-015-2 · Pass: 2_

_Decomposition rationale:_ This child isolates the validation task for the media domain, ensuring the specific output of sibling US-015-2 (Ingest legacy photo files) is verified correctly.

_Surfaced assumptions:_ A-0153, A-0154, A-0155, A-0156, A-0157

##### US-015-3-03 `[Tier D · atomic]`

**As a** QA Script Operator, **I want** Flag records that failed mapping or ingestion to quarantine, **so that** Unresolvable errors are logged for manual review per audit trail.

**Acceptance criteria:**
  - **AC-03** — All validation failures are written to a dedicated error_log table.
    - _Measurable:_ forall f in legacy_sources: if schema_mismatch or file_missing then insert into error_logs(failure_details)

_Status: atomic · Priority: high · Tier: D · Traces to: US-015-4 · Pass: 2_

_Decomposition rationale:_ This child ensures the quarantine mechanism defined in sibling US-015-4 is triggered for validation failures, maintaining compliance with audit requirements.

_Surfaced assumptions:_ A-0153, A-0154, A-0155, A-0156, A-0157

##### US-015-3-04 `[Tier D · atomic]`

**As a** QA Script Operator, **I want** Calculate aggregate error rate for the validation run, **so that** Success ratio is computed and compared against the 95% threshold.

**Acceptance criteria:**
  - **AC-04** — Reported error rate meets 95% completion standard.
    - _Measurable:_ count(error_logs) <= (0.05 * total_legacy_records)

_Status: atomic · Priority: critical · Tier: D · Traces to: AC-03 · Pass: 2_

_Decomposition rationale:_ This child implements the primary acceptance criterion AC-03 from the parent requirement, performing the specific arithmetic verification.

_Surfaced assumptions:_ A-0153, A-0154, A-0155, A-0156, A-0157

##### US-015-3-05 `[Tier D · atomic]`

**As a** System Auditor, **I want** Append validation run metadata to ENT-AUDIT-LOG, **so that** Validation execution record is stored immutably.

**Acceptance criteria:**
  - **AC-05** — Validation run is logged to ENT-AUDIT-LOG with timestamp and status.
    - _Measurable:_ exists l in ENT-AUDIT-LOG such that l.action == 'run_validation' and l.timestamp == NOW()

_Status: atomic · Priority: high · Tier: D · Traces to: COMP-1 · Pass: 2_

_Decomposition rationale:_ This child handles the compliance commitment to maintain an audit trail for all validation activities, ensuring COMP-1 constraints are met.

_Surfaced assumptions:_ A-0153, A-0154, A-0155, A-0156, A-0157

#### US-015-4 `[Tier C · pending]`

**As a** Compliance Officer, **I want** Quarantine records with unresolvable legacy data errors, **so that** Failed records logged for manual review per COMP-1 audit trail.

**Acceptance criteria:**
  - **AC-04** — All failed records are flagged with specific error codes.
    - _Measurable:_ count(quarantined_records) == count(error_logs) AND (quarantine_status == 'PENDING_REVIEW')

_Status: pending · Priority: high · Tier: C · Traces to: COMP-1, WF-15 · Pass: 1_

_Decomposition rationale:_ This child binds the compliance obligation to handle migration failures safely, ensuring auditability (COMP-1) for any records that fail the 95% threshold.

_Surfaced assumptions:_ A-0045, A-0046, A-0047

##### US-015-4-1 `[Tier C · pending]`

**As a** Migration Worker, **I want** Validate incoming legacy payload against ENT-PROPERTY schema constraints, **so that** Identify records containing unresolvable legacy data errors.

**Acceptance criteria:**
  - **AC-04-1** — Validation failure triggers error flag
    - _Measurable:_ If (record_id, error_count) > 0 then record.quarantine_status = 'PENDING_REVIEW'

_Status: pending · Priority: critical · Tier: C · Traces to: WF-15, US-015-3 · Pass: 2_

_Decomposition rationale:_ Binding the specific validation step ensures we can distinguish between resolvable and unresolvable errors, satisfying the 'unresolvable legacy data errors' constraint.

_Surfaced assumptions:_ A-0158, A-0159, A-0160

  - **US-015-4-1.1** `[Tier D · atomic]`
    **As a** Schema Validator, **I want** Verify Property Address field existence and format, **so that** Record remains valid or fails validation on address missing/format error.

    **Acceptance criteria:**
      - **AC-1001** — Address field is not null and matches expected format
        - _Measurable:_ record.address.length > 0 AND record.address.matches(pattern) for every persisted legacy record

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-015-4-1 · Pass: 3_

    _Decomposition rationale:_ This child defines a specific schema constraint check within the broader validation commitment. It is atomic and testable at the field level.

    _Surfaced assumptions:_ A-0333, A-0334
  - **US-015-4-1.2** `[Tier D · atomic]`
    **As a** Schema Validator, **I want** Verify Property Type enum membership, **so that** Record fails validation if type is not in canonical vocabulary.

    **Acceptance criteria:**
      - **AC-1002** — Property type matches allowed values
        - _Measurable:_ record.type in ['Single-Family', 'Condo', 'Multi-Unit'] for every persisted legacy record

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-015-4-1 · Pass: 3_

    _Decomposition rationale:_ This child isolates the type constraint check as a distinct atomic operation. It defines the boundary of valid data types for this entity.

    _Surfaced assumptions:_ A-0333, A-0334
  - **US-015-4-1.3** `[Tier D · atomic]`
    **As a** Schema Validator, **I want** Verify Unit Configuration linkage integrity, **so that** Record flagged if unit ID references non-existent or invalid configuration.

    **Acceptance criteria:**
      - **AC-1003** — Unit configuration reference resolves to valid entity
        - _Measurable:_ record.unit_config_id is NULL OR EXISTS(record.unit_config_id) in ENT-UNIT-CONFIG for every persisted legacy record

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-015-4-1 · Pass: 3_

    _Decomposition rationale:_ This child decomposes the validation into referential integrity checks, ensuring data consistency with linked entities like ENT-UNIT-CONFIG.

    _Surfaced assumptions:_ A-0333, A-0334
##### US-015-4-2 `[Tier C · pending]`

**As a** Error Classifier, **I want** Map validation failures to canonical error code taxonomy, **so that** Each failed record carries a distinct error_code identifier.

**Acceptance criteria:**
  - **AC-04-2** — Error code assigned per failure type
    - _Measurable:_ record.error_code !== null AND error_code IN canonical_error_codes

_Status: pending · Priority: high · Tier: C · Traces to: COMP-1, VOC-16 · Pass: 2_

_Decomposition rationale:_ Categorizing errors enables the manual review process to prioritize work queues by failure type.

_Surfaced assumptions:_ A-0158, A-0159, A-0160

  - **US-015-4-2.1** `[Tier B · pending]`
    **As a** Scope Manager, **I want** Establish canonical error code taxonomy in configuration repository, **so that** System maps failures to a defined, versioned set of error codes.

    **Acceptance criteria:**
      - **AC-001** — Canonical taxonomy is committed to version control before mapping execution.
        - _Measurable:_ Canonical error code registry version is recorded in system configuration.

    _Status: pending · Priority: critical · Tier: B · Traces to: COMP-1, VOC-16 · Pass: 3_

    _Decomposition rationale:_ Mapping cannot occur without the policy commitment to a defined taxonomy. This child converts the external open question (A-0158) into a committed scope boundary, ensuring we know the source of truth for the codes.

    _Surfaced assumptions:_ A-0335
  - **US-015-4-2.2** `[Tier C · pending]`
    **As a** Implementation Engineer, **I want** Transform legacy failure description to canonical code, **so that** record.error_code field populated with valid canonical code.

    **Acceptance criteria:**
      - **AC-002** — Record's error_code matches the canonical taxonomy.
        - _Measurable:_ record.error_code IN canonical_error_codes

    _Status: pending · Priority: high · Tier: C · Traces to: US-015-4-1 · Pass: 3_

    _Decomposition rationale:_ This is the core transformation logic, directly inheriting the input records from the identification step (US-015-4-1).

    _Surfaced assumptions:_ A-0335
  - **US-015-4-2.3** `[Tier C · pending]`
    **As a** System Architect, **I want** Persist mapped error code to ledger entry, **so that** Mapped code stored in General Ledger for compliance.

    **Acceptance criteria:**
      - **AC-003** — Mapped error code persisted in ledger without duplication.
        - _Measurable:_ journal_entries contains unique error_code for each transaction.

    _Status: pending · Priority: high · Tier: C · Traces to: COMP-1, US-015-4-4 · Pass: 3_

    _Decomposition rationale:_ The mapping must result in a state change compliant with the General Ledger constraint (COMP-1) and trigger the subsequent audit trail step (US-015-4-4).

    _Surfaced assumptions:_ A-0335
##### US-015-4-3 `[Tier C · pending]`

**As a** State Manager, **I want** Transition record lifecycle status to quarantine, **so that** Record exists in quarantine bucket rather than active ledger.

**Acceptance criteria:**
  - **AC-04-3** — Status transition completes atomically
    - _Measurable:_ count(legacy_records WHERE quarantine_status = 'PENDING_REVIEW') == count(identified_errors)

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-1 · Pass: 2_

_Decomposition rationale:_ Separating valid from invalid data requires a distinct status transition to prevent active ledger contamination.

_Surfaced assumptions:_ A-0158, A-0159, A-0160

  - **US-015-4-3-1** `[Tier C · pending]`
    **As a** Implementation Engineer, **I want** Execute status update within single DB transaction scope, **so that** Quarantine status change occurs without partial writes to active ledger.

    **Acceptance criteria:**
      - **AC-1** — Transaction commits only if error count matches pending review count
        - _Measurable:_ BEGIN TRANSACTION ... UPDATE legacy_records ... COMMIT ... ensures no intermediate state visible to read queries.

    _Status: pending · Priority: critical · Tier: C · Traces to: COMP-1 · Pass: 3_

    _Decomposition rationale:_ Enforces the atomicity requirement of AC-04-3 directly; binds to General Ledger compliance constraint.

    _Surfaced assumptions:_ A-0336, A-0337
  - **US-015-4-3-2** `[Tier B · pending]`
    **As a** Architect, **I want** Enforce storage-level isolation for quarantined data, **so that** Quarantined records physically/logically separated from active ledger for audit purposes.

    **Acceptance criteria:**
      - **AC-2** — Quarantine bucket prevents read access by active ledger services
        - _Measurable:_ RLS policy denies SELECT on legacy_records if quarantine_status = 'QUARANTINED' by active application contexts.

    _Status: pending · Priority: critical · Tier: B · Traces to: A-0159 · Pass: 3_

    _Decomposition rationale:_ This is an architectural choice defining the storage structure of the quarantine bucket; required to satisfy audit compliance without external authority beyond A-0159.

    _Surfaced assumptions:_ A-0336, A-0337
  - **US-015-4-3-3** `[Tier C · pending]`
    **As a** Engineer, **I want** Validate error code mapping against legacy records, **so that** Only records with identified errors transition to quarantine status.

    **Acceptance criteria:**
      - **AC-3** — Count of PENDING_REVIEW matches count of mapped error codes
        - _Measurable:_ SELECT COUNT(*) FROM legacy_records WHERE quarantine_status = 'PENDING_REVIEW' = (SELECT COUNT(*) FROM error_mapping_table WHERE mapped).

    _Status: pending · Priority: high · Tier: C · Traces to: US-015-4-2 · Pass: 3_

    _Decomposition rationale:_ Implementation choice to link the status transition to the error taxonomy defined in sibling US-015-4-2.

    _Surfaced assumptions:_ A-0336, A-0337
  - **US-015-4-3-4** `[Tier C · pending]`
    **As a** Engineer, **I want** Disable propagation to sync pipelines for quarantined records, **so that** Quarantined records do not trigger outbound sync jobs or notifications.

    **Acceptance criteria:**
      - **AC-4** — No sync events emitted for records in quarantine status
        - _Measurable:_ Event stream query returns zero rows for quarantine_status = 'PENDING_REVIEW' over 1-hour window.

    _Status: pending · Priority: high · Tier: C · Traces to: US-015-4-5 · Pass: 3_

    _Decomposition rationale:_ Implementation commitment to block propagation as per sibling US-015-4-5 constraint.

    _Surfaced assumptions:_ A-0336, A-0337
##### US-015-4-4 `[Tier C · pending]`

**As a** Audit Writer, **I want** Persist event in compliance audit trail, **so that** Failed record logged for manual review per COMP-1.

**Acceptance criteria:**
  - **AC-04-4** — Audit entry generated on quarantine event
    - _Measurable:_ count(ENT-AUDIT-LOG entries WHERE record_id in failed_batch) == count(failed_batch)

_Status: pending · Priority: critical · Tier: C · Traces to: COMP-1 · Pass: 2_

_Decomposition rationale:_ Satisfies COMP-1 requirement for auditable, compliant General Ledger structure and audit trail immutability.

_Surfaced assumptions:_ A-0158, A-0159, A-0160

  - **US-015-4-4-1** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Insert single row into ENT-AUDIT-LOG for each record in failed_batch, **so that** One log entry is created per failed record.

    **Acceptance criteria:**
      - **AC-001** — Total rows inserted equals total failed records.
        - _Measurable:_ SELECT COUNT(*) FROM ENT-AUDIT-LOG WHERE record_id IN (SELECT record_id FROM failed_batch) = (SELECT COUNT(*) FROM failed_batch)

    _Status: atomic · Priority: critical · Tier: D · Traces to: US-015-4-3 · Pass: 3_

    _Decomposition rationale:_ Breaking down the 'Persist event' requirement into the atomic row insertion operation required to satisfy the AC.

    _Surfaced assumptions:_ A-0338, A-0339
  - **US-015-4-4-2** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Populate error_code field within the new audit entry, **so that** Audit log entry captures the canonical error identifier mapped previously.

    **Acceptance criteria:**
      - **AC-002** — error_code column contains non-null value.
        - _Measurable:_ error_code IS NOT NULL for every row in ENT-AUDIT-LOG

    _Status: atomic · Priority: high · Tier: D · Traces to: US-015-4-2 · Pass: 3_

    _Decomposition rationale:_ Ensures the audit trail is informative for manual review by including the error classification determined in the sibling step.

    _Surfaced assumptions:_ A-0338, A-0339
  - **US-015-4-4-3** `[Tier C · pending]`
    **As a** System architect, **I want** Enforce atomic transaction between quarantine status update and audit write, **so that** Quarantine state and Audit Log state are consistent.

    **Acceptance criteria:**
      - **AC-003** — No partial updates where quarantine occurs without log entry or vice versa.
        - _Measurable:_ IF QUARANTINE_STATUS='quarantined' THEN SELECT COUNT(*) FROM ENT-AUDIT-LOG WHERE record_id IN failed_batch = QUARANTINED_COUNT

    _Status: pending · Priority: critical · Tier: C · Traces to: COMP-1 · Pass: 3_

    _Decomposition rationale:_ Commits to a specific architectural choice (atomicity) required by the compliance obligation COMP-1 to ensure data integrity.

    _Surfaced assumptions:_ A-0338, A-0339
  - **US-015-4-4-4** `[Tier D · atomic]`
    **As a** CAM operator, **I want** Record timestamp of the quarantine event in the audit entry, **so that** Temporal ordering of compliance events is maintained.

    **Acceptance criteria:**
      - **AC-004** — audit_timestamp is within 1 minute of event occurrence.
        - _Measurable:_ ABS(NOW() - audit_timestamp) <= 60 seconds

    _Status: atomic · Priority: medium · Tier: D · Traces to: ENT-AUDIT-LOG · Pass: 3_

    _Decomposition rationale:_ Defines the specific metadata requirement for the leaf operation to make the audit trail actionable.

    _Surfaced assumptions:_ A-0338, A-0339
##### US-015-4-5 `[Tier C · pending]`

**As a** Sync Controller, **I want** Block further propagation of quarantined records, **so that** Quarantined records do not sync to primary ledger.

**Acceptance criteria:**
  - **AC-04-5** — Sync pipeline rejects quarantine status
    - _Measurable:_ status = 'PENDING_REVIEW' implies NOT (synced_to_ledger)

_Status: pending · Priority: high · Tier: C · Traces to: WF-15, US-015-3 · Pass: 2_

_Decomposition rationale:_ Ensures data integrity by preventing partial migration of faulty records into the live system.

_Surfaced assumptions:_ A-0158, A-0159, A-0160

  - **US-015-4-5.D-01** `[Tier D · atomic]`
    **As a** Sync Ingestion Operator, **I want** Evaluate record status field on incoming sync payload, **so that** Sync request is allowed or flagged for rejection.

    **Acceptance criteria:**
      - **AC-01** — Record status is read from payload before ledger interaction.
        - _Measurable:_ status_value === payload['status'] at API ingress time

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-15 · Pass: 3_

    _Decomposition rationale:_ Status validation is the atomic input verification required before any propagation decision; without this, the block logic cannot be executed.

    _Surfaced assumptions:_ A-0340, A-0341
  - **US-015-4-5.D-02** `[Tier D · atomic]`
    **As a** Ledger Writer Guard, **I want** Abort write transaction to primary ledger upon status mismatch, **so that** No record data is persisted to the general ledger.

    **Acceptance criteria:**
      - **AC-02** — Write to ENT-LEDGER is halted if status is quarantined.
        - _Measurable:_ ledger_write_affected === false when payload.status == 'PENDING_REVIEW'

    _Status: atomic · Priority: critical · Tier: D · Traces to: WF-15, US-015-4-4 · Pass: 3_

    _Decomposition rationale:_ The core functional commitment of the parent is enforced here; this defines the specific action taken (abort) to achieve the 'do not sync' goal.

    _Surfaced assumptions:_ A-0340, A-0341
  - **US-015-4-5.D-03** `[Tier D · atomic]`
    **As a** Audit Logger, **I want** Persist sync rejection event to compliance audit trail, **so that** Rejection event is recorded for manual review.

    **Acceptance criteria:**
      - **AC-03** — Rejection event is persisted to ENT-COMPLIANCE-EVENT.
        - _Measurable:_ event_persisted === true && event_reason === 'QUARANTINE_BLOCK'

    _Status: atomic · Priority: high · Tier: D · Traces to: WF-15, US-015-4-4 · Pass: 3_

    _Decomposition rationale:_ Blocking propagation necessitates a record of the denial for auditability, satisfying the 'so that Quarantined records do not sync' compliance requirement.

    _Surfaced assumptions:_ A-0340, A-0341

## Non-Functional Requirements (0 roots · 0 total nodes · 0 atomic leaves)

_No non-functional requirements recorded yet for this run._

## Summary Telemetry

| Kind | Roots | Total | Atomic | Decomposed | Pending | Pruned | Deferred | Downgraded | A | B | C | D |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FR | 15 | 964 | 378 | 0 | 577 | 0 | 2 | 7 | 3 | 35 | 524 | 378 |
| NFR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
