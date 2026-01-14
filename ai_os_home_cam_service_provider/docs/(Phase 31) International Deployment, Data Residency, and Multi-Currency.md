# (Phase 31) International Deployment, Data Residency, and Multi-Currency

**Status:** Draft v0.2  
**Product Phase:** Candidate for Phase 31 (future capability; not Phase 1 scope)  
**Scope:** Delta to Phase 1 SRD describing a future global rollout with strict data residency, multi-currency per org, and 99.99 availability.  
**Base SRD:** `docs/Generally Completed/(Phase 1) Hestami AI OS for CAM, Concierge, and Service Providers.md`

---

## 0. Executive Summary

This SRD delta defines how Hestami evolves from a single Compose deployment to a **global control plane + residency-scoped data planes** architecture (Option C):

- **Every `organization_id` is pinned to a residency zone** (e.g., `EU`, `UK`, `CA`, `US`, `AU`, etc.).
- **All tenant-scoped data and processing stays within the tenant’s residency zone**, including Postgres data, Redis session state, document/object storage, background workers, and observability backends that may contain PII.
- Global components exist only for **routing and orchestration**, and must not become a backdoor for cross-zone data movement.

This delta preserves core Phase 1 principles (oRPC typed APIs, DBOS workflows, Postgres+RLS isolation, Cerbos auth, OpenTelemetry) while adding:

- **Org-aware global routing** (by `X-Org-Id`) to the correct data plane.
- **Zone-local HA** capable of 99.99 availability *without cross-zone failover of restricted data*.
- **Multi-currency per org** with accounting-ready data modeling.

### 0.1 Confirmed Decisions (current)

1. Intra-zone replication is allowed (e.g., multi-region **within** `EU` zone).
2. Control plane stores **opaque IDs only** (no PII).
3. Users do **not** belong to organizations across zones; the same email may exist in multiple zones but represents distinct zone-local identities.
4. No cross-zone features at this time (no shared catalogs, no global benchmarking, no cross-zone collaboration).

---

## 1. Requirements

### 1.1 Critical (P0)

1. The platform SHALL support **all target residency zones at launch** (no phased regional rollout).
2. The platform SHALL enforce **strict data residency**:
   - Tenant-scoped data SHALL be stored and processed only inside the tenant’s assigned zone.
   - Any cross-zone data movement SHALL be explicitly classified, approved, and auditable.
3. The platform SHALL support **multi-currency per organization** with correct formatting and storage.
4. The platform SHALL meet **99.99 availability** per residency zone (see Availability model).
5. Routing SHALL be deterministic from the request using `X-Org-Id` and/or authenticated org context.

### 1.2 High Priority (P1)

1. The platform SHOULD support users belonging to multiple orgs in multiple zones without confusing UX.
2. Support tooling SHOULD allow global triage while keeping tenant data in-zone.
3. Observability SHOULD provide global health views while keeping PII-bearing logs/traces in-zone.

### 1.3 Non-Goals (explicit)

1. Cross-zone active-active for the same tenant’s primary data is out of scope (conflicts with strict residency).
2. “Automatic” cross-zone failover for a tenant’s data is out of scope unless explicitly allowed within a zone (e.g., multi-region **within** EU).
3. Defining the full tax/regulatory model for every country is out of scope; this doc defines the platform hooks.
4. Cross-zone product features (shared catalogs, global analytics, cross-zone collaboration) are out of scope for this phase.

---

## 2. Architecture Delta (Option C)

### 2.1 Terminology

- **Residency Zone:** Jurisdictional boundary for data residency (e.g., EU, UK, CA, US).
- **Region:** Cloud/infra region (e.g., `eu-west-1`, `eu-central-1`) used to implement HA inside a zone.
- **Control Plane:** Global services that route and orchestrate. Must store minimal data.
- **Data Plane:** Per-zone full application stack containing tenant data and processing.

### 2.2 Control Plane Responsibilities (Global)

Control plane SHALL provide:

- **Organization directory (routing):** `organization_id -> residency_zone -> data_plane_endpoints`
- **Tenant lifecycle orchestration:** create org, assign zone, bootstrap zone resources
- **Public entrypoints:** DNS + edge routing + request normalization
- **Global health:** zone-level SLO monitoring and incident coordination

Control plane SHALL NOT store:

- Tenant business data (cases, documents, accounting, communications, etc.)
- Tenant PII unless explicitly approved (see Data Classification)

### 2.3 Data Plane Responsibilities (Per Zone)

Each zone SHALL run an independently operable stack:

- SvelteKit + oRPC API (typed, versioned)
- DBOS workflows (durable, idempotent)
- Postgres (system of record) with RLS
- Cerbos authorization
- Redis (sessions + caching)
- Document pipeline (tusd, object store, hooks, workers)
- OpenTelemetry collection and zone-local storage for logs/traces where needed

---

## 3. Routing & Request Flow

### 3.1 Routing Key

The routing key is `organization_id`, expressed as:

- `X-Org-Id` header for API calls (per Phase 1 SRD), and/or
- selected active org scope derived at login/membership selection.

### 3.2 Edge Routing

The edge/gateway SHALL:

1. Extract `X-Org-Id` (or derive via authenticated context).
2. Resolve `organization_id -> zone endpoint` via the control plane directory.
3. Forward the request to the target zone, preserving trace context and request IDs.

### 3.3 Control Plane Directory API (internal)

Minimum interface (illustrative):

- `GET /internal/org-routing/{organizationId}` -> `{ zone, apiBaseUrl, webBaseUrl, status }`
- `GET /internal/user-orgs/{userSubject}` -> list of org memberships with zone (if the control plane is allowed to store membership pointers)

The directory response SHALL be cacheable with short TTL at the edge.

---

## 4. Identity, Sessions, and Cross-Zone Users

This delta requires an explicit decision about where user identity lives.

### 4.1 Supported Patterns

**Pattern A (recommended for strict residency): External IdP (OIDC)**

- Control plane validates tokens and treats identity as an opaque subject.
- Memberships and profiles are stored per-zone (or per org) as needed.
- Edge routes requests to the zone after the user selects an active org.

**Pattern B: Per-zone auth**

- Users authenticate separately per zone.
- Control plane only routes and does not maintain user PII.

**Pattern C: Global auth (not recommended for strict residency)**

- Global identity store contains PII and may violate residency depending on policy.

### 4.2 Session Storage

- Redis session storage SHALL be zone-local for tenant sessions.
- If a global session is used for the control plane UI, it SHALL not grant access to tenant data planes without zone-level authorization.

### 4.3 Constraint: No Cross-Zone Membership

- A user identity is **zone-local**. Users SHALL NOT have organizations in multiple residency zones.
- The same email address MAY exist in multiple zones, but represents distinct user records and distinct identifiers.
- The control plane SHALL treat all identities as opaque IDs and MUST NOT be responsible for de-duplicating or correlating users across zones.

---

## 5. Data Classification & Residency Rules

### 5.1 Classification Buckets

Define and enforce at runtime:

- **R0: Non-tenant / public** (marketing site content, docs)
- **R1: Global non-PII operational** (zone health, aggregate metrics)
- **R2: Tenant metadata** (org id, zone assignment; possibly org name depending on policy)
- **R3: Tenant PII / business data** (people, payments, documents, communications, logs/traces containing identifiers)

### 5.2 Mandatory Residency Rules

- **R3 data SHALL never leave the tenant’s zone.**
- **R2 data** MAY exist in the control plane only if explicitly approved and minimal (current decision: opaque IDs only).
- **R1 data** MAY be aggregated globally (must be demonstrably non-PII).

### 5.3 Observability Residency

- Logs/traces that contain user identifiers, payload snippets, document names, etc. are **R3** and SHALL remain in-zone.
- Global dashboards MAY show:
  - availability per zone
  - request rates per zone
  - error rates per zone
  - capacity saturation per zone

---

## 6. Multi-Currency Model (Per Organization)

### 6.1 Storage Model (Minimum)

All monetary values that can vary by currency SHALL be stored as:

- `amount_minor` (integer; cents/pence/etc.)
- `currency_code` (ISO-4217, e.g., `USD`, `EUR`, `GBP`)

Organizations SHALL have:

- `default_currency_code`
- `default_locale`
- `timezone`

### 6.2 Accounting Implications (Decision Needed)

Choose one, document it, and enforce it:

1. **Single functional currency per org** (recommended baseline)
   - Store and report accounting ledgers in org’s functional currency.
   - Allow display conversion for UX with explicitly sourced FX rates.
2. **True multi-currency accounting**
   - Requires FX gain/loss, revaluation, and multi-currency GL reporting.

### 6.3 FX Rates (If Converting)

If any conversion occurs:

- Store `fx_rate`, `fx_rate_timestamp`, `fx_rate_source`, `rate_type`
- Ensure conversions are reproducible for audit.

---

## 6A. International Data Model Delta (Prisma)

This section describes the **schema-level changes** required to support international zones (residency), international addresses, and jurisdiction-specific regulatory needs in `hestami-ai-os/prisma/schema.prisma`.

Key point: **residency zones** (EU/UK/CA/US/…) are primarily a *deployment/data-plane boundary*. Most *data model* differences are driven by **jurisdiction** (country/subdivision, tax regime), not the zone itself. Model the jurisdiction explicitly and keep residency zone as an org attribute for routing/audit.

### 6A.1 Organization primitives (required)

Add first-class organization defaults and jurisdiction fields (currently `Organization` is missing these; see `schema.prisma` `model Organization`).

Minimum:

- `residencyZone` (enum or string; used for routing/audit and Phase 31 migration safety)
- `defaultLocale` (BCP-47 like `en-US`)
- `defaultTimezone` (IANA like `Europe/London`)
- `defaultCurrencyCode` (ISO-4217 like `USD`, `EUR`, `GBP`)
- `legalCountryCode` (ISO-3166-1 alpha-2 like `US`, `GB`, `DE`)
- `legalSubdivisionCode` (ISO-3166-2 like `US-CA`, `CA-ON`; optional)

### 6A.2 Addresses (de-US-ify and normalize)

Current schema uses US-shaped address fields in multiple models, with `country` often defaulting to `"US"` and `state` sometimes required (e.g., `Property.state` is required in `schema.prisma`).

Phase 31 target:

1. Introduce a shared `Address` model and reference it from entities that have addresses (Property, Unit, Party, Vendor, branches, etc.).
2. Store ISO codes and flexible components:
   - `countryCode` (ISO-3166-1)
   - `subdivisionCode` (ISO-3166-2; replaces “state/province” ambiguity)
   - `locality` (city/town)
   - `postalCode` (string; do not assume ZIP format)
   - optional `dependentLocality`, `sortingCode`, etc. in `components Json`
   - `formatted` (optional) for display-only caching
3. Make “state” optional everywhere and treat it as a display fallback only during migration.

Migration-friendly approach:

- Add `addressId` columns first (nullable), backfill them from legacy columns, then deprecate legacy columns.

### 6A.3 Tax and regulatory identifiers (remove US-specific coupling)

Current schema includes fields that are US-specific or overloaded:

- `Association.taxId` (single string)
- `Vendor.taxId` plus `w9OnFile` and `is1099Eligible`

International requires **multiple identifiers per entity** and jurisdiction-scoped validation. Phase 31 target:

- Create `TaxIdentifier` model with:
  - `entityType` + `entityId` (or explicit relations per entity class)
  - `identifierType` (EIN, VAT_ID, GST_HST, ABN, UTR, etc.)
  - `countryCode`, optional `subdivisionCode`
  - `valueEncrypted`, `verifiedAt`, `validFrom`, `validTo`
- Keep W-9/1099 as US-only attributes, but either:
  - move them under a US tax identifier record, or
  - gate them behind a `jurisdiction` check so they don’t leak into non-US flows.

### 6A.4 Jurisdiction rules as data (not hard-coded)

To support “laws/regulations” without forking schemas per zone, add data-driven configuration:

- `Jurisdiction` (country/subdivision) with flags and parameters:
  - supported invoice numbering rules
  - tax regime mode (VAT/GST/sales tax)
  - privacy requirements (retention minimums, deletion constraints, consent needs)
- `OrganizationJurisdiction` (or fields on Organization/Association) to select the applicable jurisdiction profile.

This keeps the schema stable while allowing rule updates through configuration and versioned workflows.

### 6A.5 Multi-currency across financial models (concrete schema impacts)

Current schema stores many amounts as `Decimal(..., 2)` without an accompanying currency (examples include Payments, Assessments, AP invoices). Multi-currency requires currency context at minimum.

Phase 31 baseline (minimal disruption):

- Add `currencyCode` to “root” financial documents and treat all child amounts as being in that currency:
  - `AssessmentCharge.currencyCode`
  - `Payment.currencyCode`
  - `APInvoice.currencyCode`
  - any quote/estimate/proposal/invoice models used by service-provider flows
- Add optional FX metadata on converted totals where applicable:
  - `fxRate`, `fxRateSource`, `fxRateTimestamp`, `rateType`

Phase 31 “correct” money storage (recommended, larger migration):

- Move from `Decimal(10,2)` style fields to `amountMinor Int` (or `BigInt`) + `currencyCode` to support currencies with 0/3 decimals and to avoid rounding drift.
- Keep legacy decimals during migration and add derived “minor unit” columns, then flip read/write.

### 6A.6 Locale and timezone (stop using “language”)

Current schema has multiple timezone defaults and a `UserProfile.language` field.

Phase 31 target:

- Replace “language” fields with `locale` (BCP-47).
- Standardize timezone storage as IANA timezone identifiers at org and user levels.
- Treat display formatting as a presentation concern; storage should remain timezone-safe (`TIMESTAMPTZ`).

### 6A.7 Privacy / data subject rights hooks

Strict residency zones often require provable processes, not just configuration:

- Add a `DataSubjectRequest` model (export/delete/rectify) with:
  - request type, requester identity (zone-local opaque IDs), status, timestamps
  - workflow linkage (DBOS workflow ID) for auditability
- Add optional `PolicyAcceptance`/`ConsentRecord` models for:
  - terms/privacy policy version acceptance timestamps
  - marketing consent evidence when required

All of the above MUST remain zone-local and be exportable for compliance.

### 6A.8 Phase 31 migration approach (schema + data)

Because the system is already significantly built, implement schema changes as **additive first**:

1. Add new columns/models (nullable) and start writing them for new records.
2. Backfill in controlled batches (zone-local workflows) with audit logs.
3. Gate new international behavior by org configuration (jurisdiction/currency/locale).
4. Deprecate legacy columns only after parity validation and export correctness are proven.

---

## 7. Availability & Disaster Recovery (99.99)

### 7.1 Availability Model

Target: **99.99 availability per residency zone**. This MUST be achieved without failing over restricted tenant data to a different residency zone.

### 7.2 Zone-Local HA

Each zone SHALL implement HA within the zone boundary. Intra-zone replication (including multi-region inside the same residency zone) is allowed and recommended:

- Multi-AZ database HA with automated failover
- Optional multi-region replication **within zone** to meet 99.99 targets
- App tier redundancy (multiple instances) with zero-downtime deploys
- Zone-local object storage replication
- Zone-local Redis HA

### 7.3 Backups & PITR

- Backups and PITR logs SHALL be stored within the same residency zone.
- Restoration procedures SHALL be tested per zone.

### 7.4 Degraded Mode

Define explicit degraded behaviors (e.g., document processing paused, read-only pages for some domains) per zone to preserve uptime.

---

## 8. Document Processing Pipeline (Residency-Safe)

The Phase 1 document pipeline (tusd -> object store -> hooks -> workflows -> workers) SHALL be replicated per zone.

Requirements:

- Upload endpoints are zone-routed by `organization_id`.
- Object storage buckets/volumes are zone-local.
- Worker fleets run inside the same zone as the tenant’s object storage and Postgres.
- Virus scanning definitions and derived artifacts stay in-zone.

---

## 9. API, Workflows, and Versioning Impact

### 9.1 API Surface

No cross-zone “shared” oRPC routes SHALL be introduced for tenant data. Any global APIs in the control plane MUST be:

- tenant-agnostic, or
- limited to R2 tenant metadata (zone assignment, routing)

### 9.2 DBOS Workflows

DBOS workflows SHALL execute in the tenant’s zone only.

Cross-zone workflows (if needed) MUST be split:

- **Control-plane workflow:** orchestrates and calls zone APIs
- **Zone workflow:** performs tenant-scoped work and writes tenant data

---

## 10. Security & Support Operations

### 10.1 Support Access Model (Flexible)

Support model SHALL be pluggable between:

- 24/7 on-call centralized
- follow-the-sun per zone
- customer-specific SLAs

Enablers required regardless:

- “Break-glass” privileged access that is:
  - zone-scoped
  - time-bound
  - fully audited
- Separation of duties:
  - control plane operators cannot directly access tenant data planes without explicit audited escalation

### 10.2 Compliance Exports

Provide hooks for:

- GDPR user export and deletion workflows (zone-local execution)
- Audit export and retention controls (zone-local storage + policy)

---

## 11. Implementation Checklist (Delta Backlog)

### Phase 0: Decisions (blockers)

- Define residency zones and allowable intra-zone replication (confirmed: intra-zone replication allowed).
- Decide identity pattern (External IdP vs per-zone auth; avoid global auth for strict residency).
- Decide functional currency model (single vs true multi-currency accounting).
- Define what R2 tenant metadata is allowed in control plane (confirmed: opaque IDs only).

### Phase 1: Data Model & Routing

- Add `residency_zone` and currency/locale/timezone defaults to organization model.
- Build control plane org directory + edge routing by `X-Org-Id`.
- Ensure all API calls reject missing/invalid org scope early and consistently.

### Phase 2: Zone Infrastructure

- Template a zone deployment bundle (app, DB, Redis, object storage, workers, Cerbos, OTel collector).
- Implement per-zone secrets, keys, and rotation policies.

### Phase 3: Observability and Support

- Zone-local log/trace backends with global non-PII metrics aggregation.
- Add zone-level runbooks, alerts, and escalation paths.

### Phase 4: Multi-Currency Enablement

- Introduce `Money` storage conventions across quoting/invoicing/payment surfaces.
- Implement formatting and locale-sensitive display rules.
- Implement FX sourcing and auditing if conversions are required.

### Phase 31 Migration Path (from existing deployments)

This capability is intended for a significantly built system. Add a controlled migration plan:

- Create initial residency zones and deploy zone stacks.
- Assign each existing organization a `residency_zone`.
- Provide a per-org migration workflow:
  - export from current deployment
  - import into target zone
  - cut over routing (`organization_id -> zone`)
  - validate (RLS, Cerbos, workflow replay safety, document integrity)
- Define tenant downtime expectations and rollback strategy (per org).

---

## 13. Codebase Asset Review & Gap Analysis (as of Jan 2026)

A deep review of the current implementation reveals several critical gaps that must be addressed to fulfill this SRD's objectives.

### 13.1 Globalization & Localization (i18n/L10n)
- **Hardcoded Locale**: API response envelopes explicitly hardcode `locale: 'en-US'` (see `src/lib/server/api/router.ts`).
- **Framework Absence**: There is no active i18n framework (e.g., `svelte-i18n`) or translation/locale repository.
- **US-Centric Schema**: Address fields in `Property`, `Vendor`, and `Customer` models rely on US conventions (State/Postal Code).
- **Static Timezones**: Many models default to `America/New_York` (e.g., `Technician.timezone`).

### 13.2 Multi-Currency Infrastructure
- **Transactional Depth**: While `Pricebook` has a currency field, transactional models (`Payment`, `APInvoice`, `GLAccount`, `Estimate`, `JobInvoice`) lack `currency_code` fields.
- **FX & Conversion**: No schema or logic exists for FX rate storage or reproducible currency conversion.
- **Tax Model**: Simple `isTaxable` flags are insufficient for global VAT/GST requirements which require regional jurisdiction awareness.

### 13.3 Data Residency & Routing
- **Centralized Infrastructure**: The `docker-compose.yml` defines a monolithic, single-region deployment.
- **Missing Residency Metadata**: The `Organization` model lacks the `residency_zone` field required for the Global Control Plane routing logic.
- **Observability PII Leakage**: Current OTel collection is centralized; log/trace data containing R3 PII is not sequestered by residency zone.

### 13.4 Compliance & Legal Modeling
- **Identifying Credentials**: `tax_id` modeling is US-centric and lacks support for global business identifiers (e.g., EU VAT IDs, registration numbers).
- **Consent Mechanisms**: No current infrastructure for regional consent management (Cookie banners, GDPR/CCPA data rights).

---

## 14. Open Questions (to resolve before build)

1. Which residency zones are in scope (EU, UK, CA, US, AU, etc.), and what regions implement each zone?
US (covers US-heavy customers; also common default for many global customers)
EU / EEA (covers EU procurement + GDPR-driven “EU data stays in EU” demands)
UK (often required separately from EU post‑Brexit)
CA (common Canadian public sector / regulated customer requirement)
AU (common AU public sector / regulated requirement)
APAC-SG (Singapore as a widely-accepted APAC hub for many countries that don’t mandate in-country residency; sometimes use JP instead depending on target market)
Then, the “special cases” that usually force additional zones (can’t be covered cleanly by the above if requirements are truly strict):

CN (China mainland often requires China-local infra/operations)
IN (India sometimes requires in-country residency for certain data/classes)
BR (Brazil occasionally required for regulated/large enterprise or procurement)

If you expect North Africa specifically (e.g., Morocco/Tunisia/Egypt), they often align operationally with EU/ME decisions rather than a sub‑Saharan AF/ZA zone.

2. Which observability fields are considered PII in your compliance stance (email, phone, address, document names, IPs, user agent)?

Everything not email address


3. Do you require customer-managed keys (KMS) per zone and/or per tenant?
No

4. Do you require hard guarantees on where backups/PITR are stored (e.g., specific countries within a zone)?
Yes
