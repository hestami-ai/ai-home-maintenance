# Hestami Platform — Implementation Roadmap

**Version:** 1.0  
**Status:** Draft  
**Scope:** All 12 CDM domains, self-hosted infrastructure, backend API surface with OpenAPI for mobile SDK generation

---

## Overview

This roadmap is organized into **phases** (not timeboxes). Each phase builds upon the previous and results in a working, testable increment. The **Work Order Lifecycle** workflow is prioritized as the first domain workflow to be fully implemented once the foundational infrastructure is in place.

### Out of Scope (This Roadmap)
- External integrations (payment processors, email/SMS providers, permit systems)
- AI agent integration (MCP servers, function-calling endpoints)
- Mobile app development (handled by separate AI agent systems)

### In Scope
- All 12 CDM domains
- Self-hosted infrastructure (Docker Compose, Postgres, Redis, Traefik)
- SvelteKit + oRPC backend with Zod validation
- DBOS durable workflows
- OpenTelemetry observability
- OpenAPI spec generation for SDK consumers

---

## Phase 0: Project Scaffolding & Infrastructure

**Goal:** Establish the foundational project structure, tooling, and local development environment.

### 0.1 SvelteKit Project Initialization
- [x] Initialize SvelteKit project with Node adapter
- [x] Configure TypeScript strict mode
- [x] Set up ESLint + Prettier with project conventions
- [x] Configure path aliases (`$lib`, `$server`, etc.)

### 0.2 Docker Compose Infrastructure
- [x] Create `docker-compose.yml` with services:
  - `postgres` (PostGIS-enabled for future geo features)
  - `redis` (session storage, caching)
  - `traefik` (reverse proxy, SSL termination)
  - `app` (SvelteKit application)
- [x] Create `Dockerfile` for SvelteKit app with PM2 cluster mode
- [x] Configure environment variable management (`.env.example`, `.env.local`)
- [x] Set up health check endpoints

### 0.3 Database Foundation
- [x] Initialize Prisma with PostgreSQL provider
- [x] Configure Prisma for Zod schema generation (`zod-prisma-types`)
- [x] Create initial migration structure
- [x] Set up database seeding framework

### 0.4 Development Tooling
- [x] Configure Vitest for unit testing
- [x] Set up Playwright for API integration tests
- [x] Configure OpenTelemetry SDK (local Jaeger for dev)
- [x] Create `scripts/` directory with common dev commands

### Deliverables
- Running local dev environment via `docker compose up`
- Empty SvelteKit app accessible via Traefik
- Prisma connected to Postgres
- Test framework operational

---

## Phase 1: Core Platform Infrastructure

**Goal:** Implement multitenancy, authentication, authorization, and the API framework.

### 1.1 Multitenancy Foundation

#### 1.1.1 Organization Model
- [x] Define `Organization` entity in Prisma schema:
  ```prisma
  enum OrganizationType {
    COMMUNITY_ASSOCIATION
    MANAGEMENT_COMPANY
    SERVICE_PROVIDER
    INDIVIDUAL_CONCIERGE
    COMMERCIAL_CLIENT
  }
  
  model Organization {
    id        String           @id @default(cuid())
    name      String
    type      OrganizationType
    // ... additional fields
  }
  ```
- [x] Implement `organization_id` as tenant discriminator on all tenant-scoped tables
- [x] Create base model mixin/pattern for tenant-scoped entities

#### 1.1.2 Row-Level Security (RLS)
- [x] Create Postgres RLS policies for tenant isolation
- [x] Implement `set_config('app.current_org_id', ...)` pattern for session context
- [x] Create migration to enable RLS on tenant-scoped tables
- [ ] Write RLS bypass prevention tests

### 1.2 Authentication & Session Management

#### 1.2.1 Better-Auth Integration
- [x] Install and configure Better-Auth
- [x] Implement JWT session with Redis storage
- [x] Create login/logout endpoints
- [x] Implement session refresh logic

#### 1.2.2 Organization Context Selection
- [x] Implement post-login organization selection flow
- [x] Create `X-Org-Id` header middleware
- [x] Implement organization context switching endpoint
- [x] Validate user membership in selected organization

### 1.3 Authorization System

#### 1.3.1 Role Model
- [x] Define roles in Prisma:
  - `OWNER` (homeowner)
  - `TENANT` (renter)
  - `MANAGER` (community/portfolio manager)
  - `VENDOR` (service provider staff)
  - `BOARD_MEMBER`
  - `ADMIN`
- [x] Create `UserOrganizationRole` junction table
- [x] Implement role-checking middleware

#### 1.3.2 Permission System
- [x] Define permission constants per domain
- [x] Create permission-checking utilities
- [x] Implement `@requiresPermission` decorator pattern for oRPC procedures

### 1.4 oRPC API Framework

#### 1.4.1 Router Setup
- [x] Install and configure oRPC
- [x] Create base router with context injection (user, org, trace)
- [x] Implement `/api/v1/rpc` route handler
- [x] Configure Zod schema integration for input/output

#### 1.4.2 Standard Response Envelope
- [x] Implement success response wrapper:
  ```typescript
  { ok: true, data: T, meta: { request_id, trace_id, span_id, timestamp } }
  ```
- [x] Implement error response wrapper per SRD spec
- [x] Create error code constants and types

#### 1.4.3 Idempotency
- [x] Create `IdempotencyKey` table for tracking
- [x] Implement idempotency middleware for mutating operations
- [x] Configure TTL-based cleanup for old keys

#### 1.4.4 OpenAPI Generation
- [x] Configure oRPC OpenAPI plugin
- [x] Set up automatic spec generation on build
- [x] Create `/api/docs` endpoint for Swagger UI (dev only)

### 1.5 Observability Foundation

#### 1.5.1 OpenTelemetry Integration
- [x] Configure OTLP exporter
- [x] Implement trace context propagation through oRPC
- [ ] Add `organization_id` to all spans
- [ ] Instrument Prisma client for query tracing

#### 1.5.2 Logging
- [x] Configure structured JSON logging
- [x] Include `trace_id`, `span_id`, `request_id` in all logs
- [x] Set up log levels per environment

### Deliverables
- User can register, login, select organization context
- oRPC endpoints operational with full request/response typing
- RLS enforced at database level
- OpenAPI spec generated and accessible
- Distributed tracing operational

---

## Phase 2: Domain 1 — Association / Entity / Property Model

**Goal:** Implement the foundational data model for associations, properties, and parties.

### 2.1 Core Entities

#### 2.1.1 Association
- [x] `Association` model (extends Organization context)
- [x] Association settings and configuration
- [x] Association status lifecycle

#### 2.1.2 Property (Community)
- [x] `Property` model representing a community/development
- [x] Property address and geo-location
- [x] Property metadata (year built, total units, etc.)

#### 2.1.3 Housing Unit / Lot
- [x] `Unit` model for individual lots/units
- [x] Unit type classification (SFH, condo, townhouse, lot)
- [x] Unit address and identifiers

#### 2.1.4 Common Area / Amenity
- [x] `CommonArea` model
- [x] Amenity types (pool, clubhouse, park, etc.)
- [x] Amenity scheduling/reservation foundation

### 2.2 Party & Relationship Models

#### 2.2.1 Person / Party
- [x] `Party` model (abstract person/entity)
- [x] Link to `User` for platform users
- [x] Contact information management

#### 2.2.2 Ownership
- [x] `Ownership` model linking Party to Unit
- [x] Ownership percentage and type
- [x] Ownership history tracking

#### 2.2.3 Tenancy
- [x] `Tenancy` model for renters
- [x] Lease date tracking
- [x] Tenant contact management

### 2.3 Management Relationships

#### 2.3.1 Management Contract
- [x] `ManagementContract` linking Management Company to Association
- [x] Contract terms and dates
- [x] Service level definitions

#### 2.3.2 Manager Assignment
- [x] `ManagerAssignment` model with assignment types (Community/Portfolio/Assistant)
- [x] Manager assignment to associations
- [x] Manager workload tracking (maxUnits field)

### 2.4 API Procedures

- [x] `association/v1/create` / `get` / `list` / `update` / `delete`
- [x] `property/v1/create` / `get` / `list` / `update` / `delete`
- [x] `unit/v1/create` / `get` / `list` / `update` / `delete`
- [x] `party/v1/create` / `get` / `list` / `update` / `delete`
- [x] `ownership/v1/create` / `get` / `listByUnit` / `end` / `delete`
- [x] `organization/create` / `list` / `get` / `current` / `setDefault` / `update` / `delete`

### 2.5 Authorization & Policy Engine (Cerbos)

**Goal:** Implement fine-grained, multi-tenant authorization using Cerbos PDP with Prisma query plan integration.

#### 2.5.1 Cerbos Infrastructure
- [x] Add Cerbos PDP service to `docker-compose.yml`
- [x] Configure Cerbos server with disk-based policy storage (`cerbos/config.yaml`)
- [x] Set up policy directory structure (`cerbos/policies/derived_roles/`, `cerbos/policies/resource/`)
- [x] Install `@cerbos/grpc` package (note: `@cerbos/orm-prisma` not compatible with Prisma 7)

#### 2.5.2 Derived Roles
- [x] Define `common_roles.yaml` with organization-scoped role derivation:
  - `org_admin` - User has ADMIN role in resource's organization
  - `org_manager` - User has MANAGER role in resource's organization
  - `org_board_member` - User has BOARD_MEMBER role
  - `org_owner` - User has OWNER role
  - `org_tenant` - User has TENANT role
  - `org_vendor` - User has VENDOR role
  - `resource_owner` - User owns the specific resource (unit ownership)
  - `resource_member` - User is a member of the resource
  - `assigned_vendor` - Vendor assigned to the resource
  - `org_management` - Combined ADMIN or MANAGER role
  - `org_stakeholder` - Combined OWNER, TENANT, or BOARD_MEMBER role

#### 2.5.3 Resource Policies
- [x] `organization.yaml` - Organization-level access rules
- [x] `association.yaml` - Association CRUD permissions
- [x] `property.yaml` - Property CRUD permissions
- [x] `unit.yaml` - Unit access with ownership-based filtering
- [x] `party.yaml` - Party/contact management permissions
- [x] `ownership.yaml` - Ownership record permissions
- [x] `work_order.yaml` - Work order lifecycle permissions (view, create, assign, close)

#### 2.5.4 Multi-Tenant Scoped Policies
- [x] Implement scoped policy pattern for tenant-specific overrides (via `scope` field)
- [x] Document scope naming convention (organization slug)
- [ ] Create example tenant-specific policy override

#### 2.5.5 Cerbos TypeScript Integration
- [x] Create `src/lib/server/cerbos/index.ts` service module
- [x] Implement `getCerbos()` singleton client
- [x] Implement `isAllowed()` for single-resource authorization
- [x] Implement `planResources()` + custom Prisma adapter for collection filtering
- [x] Create `queryPlanToPrismaWhere()` helper with field name mapping

#### 2.5.6 oRPC Middleware Integration
- [x] Update `orgProcedure` to build Cerbos principal from context
- [x] Add `context.cerbos.authorize()` helper for single-resource checks
- [x] Add `context.cerbos.queryFilter()` helper for list operations
- [x] Update `RequestContext` with `orgRoles` for Cerbos principal
- [x] Update context creation to populate all user org memberships

#### 2.5.7 Migration from Static Permissions
- [x] Deprecate `src/lib/server/api/permissions.ts` static role mapping (added @deprecated notices)
- [x] Update association route handlers to use Cerbos
- [x] Update property route handlers to use Cerbos
- [x] Update unit route handlers to use Cerbos
- [x] Update party route handlers to use Cerbos
- [x] Update ownership route handlers to use Cerbos
- [x] Update organization route handlers to use Cerbos
- [x] Remove `requirePermission()` calls in favor of Cerbos checks

### Deliverables
- Complete property hierarchy (Association → Property → Unit)
- Party and ownership management
- Management company relationships
- Full CRUD APIs with OpenAPI documentation
- **Cerbos-based authorization with multi-tenant scoped policies**
- **Query plan integration for efficient collection filtering**

---

## Phase 3: Domain 2 — Accounting Foundation

**Goal:** Implement the core accounting structure for association financial management.

### 3.1 Chart of Accounts

#### 3.1.1 GL Structure
- [x] `GLAccount` model with account types:
  - Assets, Liabilities, Equity, Revenue, Expenses
- [x] Account numbering scheme (unique per association)
- [x] Sub-account hierarchy (parent/child relationships)
- [x] Operating vs. Reserve fund segregation (`FundType` enum)

#### 3.1.2 Default Chart of Accounts
- [x] Seed data for standard HOA chart of accounts (50+ accounts)
- [x] Auto-seed on association creation
- [x] Manual seed endpoint (`glAccount/seedDefaults`)
- [x] Customization support per association (via API)

### 3.2 Journal Entries

- [x] `JournalEntry` model (header)
- [x] `JournalEntryLine` model (debits/credits)
- [x] Double-entry validation (debits must equal credits)
- [x] Posting status workflow (DRAFT → PENDING_APPROVAL → POSTED)
- [x] Reversal support (creates reversal entry, updates original status)

### 3.3 Bank Accounts

- [x] `BankAccount` model
- [x] Bank account to GL account mapping
- [x] Balance tracking (book vs. bank)

### 3.4 Assessments

#### 3.4.1 Assessment Configuration
- [x] `AssessmentType` (regular, special, late fee with configurable frequency)
- [x] Assessment schedule configuration (MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, ONE_TIME)
- [x] Pro-ration rules (`prorateOnTransfer` flag)
- [x] Late fee configuration (amount, percent, grace period)

#### 3.4.2 Assessment Charges
- [x] `AssessmentCharge` model
- [ ] Automatic charge generation workflow (DBOS)
- [x] Charge → GL posting (auto-creates journal entry on charge creation)

### 3.5 Payments (AR)

- [x] `Payment` model
- [x] Payment application to charges (`PaymentApplication` junction table)
- [x] Auto-apply to oldest charges feature
- [x] Overpayment/credit handling (`unappliedAmount` tracking)
- [x] Payment → GL posting (auto-creates journal entry, reverses on void)

### 3.6 Accounts Payable Foundation

- [x] `Vendor` model (links to Service Provider org via `serviceProviderOrgId`)
- [x] `APInvoice` model with line items
- [x] Invoice approval workflow foundation (DRAFT → PENDING_APPROVAL → APPROVED → PAID)
- [x] W-9 / 1099 tracking fields (`w9OnFile`, `is1099Eligible`)

### 3.7 API Procedures

- [x] `glAccount/*` (create, list, get, update, delete)
- [x] `journalEntry/*` (create, list, get, post, reverse)
- [x] `assessment/*` (createType, listTypes, createCharge, listCharges, getUnitBalance)
- [x] `payment/*` (create, list, get, void)
- [x] `vendor/*` (create, list, get, update, delete)
- [x] `apInvoice/*` (create, list, get, approve, void)

### 3.8 Cerbos Authorization Policies

- [x] `gl_account.yaml` - GL account access control
- [x] `journal_entry.yaml` - Journal entry permissions (including post/reverse)
- [x] `assessment_type.yaml` - Assessment type configuration access
- [x] `assessment_charge.yaml` - Charge viewing (with owner/tenant restrictions)
- [x] `payment.yaml` - Payment recording and voiding
- [x] `vendor.yaml` - Vendor management
- [x] `ap_invoice.yaml` - Invoice approval workflow

### 3.9 Bank Account Management

#### 3.9.1 Bank Account API Routes
- [x] `bankAccount/create` - Create bank account linked to GL cash account
- [x] `bankAccount/list` - List bank accounts for association
- [x] `bankAccount/get` - Get bank account details
- [x] `bankAccount/update` - Update bank account info
- [x] `bankAccount/delete` - Deactivate bank account
- [x] `bankAccount/updateBankBalance` - Update bank balance for reconciliation

#### 3.9.2 Bank Account Features
- [x] Link to GL cash account (Operating or Reserve)
- [x] Track book balance vs bank balance
- [x] Last reconciled date tracking
- [x] Primary account designation per fund type

#### 3.9.3 Cerbos Policy
- [x] `bank_account.yaml` - Bank account access control

### Deliverables
- [x] Complete GL structure with double-entry enforcement
- [x] Default chart of accounts with 50+ standard HOA accounts
- [x] Assessment configuration and charge creation with GL posting
- [x] Payment processing and application with GL posting
- [x] AP invoice tracking with approval workflow
- [x] Financial data properly isolated per association
- [x] Bank account management with GL integration
- [x] Automatic charge generation (DBOS workflow - assessmentPosting_v1)

---

## Phase 4: Domain 6 — Work Orders & Vendor Management (Priority Workflow)

**Goal:** Implement the Work Order lifecycle as the first complete DBOS workflow.

### 4.1 Asset Management

- [x] `Asset` model (equipment, systems, common area items)
- [x] Asset location (unit or common area)
- [x] Asset maintenance history (`AssetMaintenanceLog`)
- [x] Warranty tracking (expiration date, details)
- [x] Maintenance scheduling (frequency, next date)

### 4.2 Vendor Management

#### 4.2.1 Vendor Profiles
- [x] `ServiceProviderProfile` model
- [x] Service categories and capabilities
- [x] Service area definitions (radius, zip codes)
- [x] Insurance and license tracking

#### 4.2.2 Vendor Relationships
- [x] `AssociationServiceProvider` linking table
- [x] Preferred vendor designation
- [x] Vendor rating/feedback (average rating, total reviews)

### 4.3 Work Order Model

#### 4.3.1 Core Work Order
- [x] `WorkOrder` model with fields:
  - Requestor, location, description
  - Priority, category
  - Status, assigned vendor
  - Scheduled dates, completion
- [x] Work order numbering scheme (WO-XXXXXX)
- [x] Attachment support (`WorkOrderAttachment`)
- [x] Comments support (`WorkOrderComment`)

#### 4.3.2 Work Order Status Lifecycle
```
DRAFT → SUBMITTED → TRIAGED → ASSIGNED → SCHEDULED → 
IN_PROGRESS → ON_HOLD → COMPLETED → INVOICED → CLOSED
                                              ↓
                                          CANCELLED
```
- [x] Status transition validation
- [x] Status history tracking (`WorkOrderStatusHistory`)
- [x] SLA deadline calculation by priority

### 4.4 Bidding & Proposals

- [x] `WorkOrderBid` model
- [x] Bid request workflow (`bid/requestBids`)
- [x] Bid submission (`bid/submitBid`)
- [x] Bid comparison (`bid/listBids`)
- [x] Bid acceptance/rejection (`bid/acceptBid`, `bid/rejectBid`)
- [x] Bid withdrawal (`bid/withdrawBid`)
- [x] Bid → Work Order assignment (auto on accept)

### 4.5 DBOS Work Order Workflow

#### 4.5.1 Workflow Definition
- [x] `workOrderLifecycle_v1` DBOS workflow
- [x] State transitions with validation (in API)
- [x] SLA timer integration (deadline tracking)
- [x] Notification triggers at each state (stub - queues intent)

#### 4.5.2 Workflow Steps (DBOS durable)
- [x] `create` - Create work order
- [x] `updateStatus` - Generic status update
- [x] `assignVendor` - Assign vendor
- [x] `schedule` - Schedule work
- [x] `complete` - Complete work order
- [x] `transitionStatus` - DBOS workflow-based transition
- [x] `getTransitionStatus` - Query workflow status
- [x] `processInvoice` step (links to AP)

### 4.6 Work Order → AP Integration

- [x] Vendor invoice submission on completion (`workOrder/createInvoice`)
- [x] Invoice → `APInvoice` creation (with line items)
- [x] AP approval workflow trigger (invoice created in PENDING_APPROVAL status)
- [x] Work order status updated to INVOICED

### 4.7 API Procedures

- [x] `asset/*` (create, list, get, update, delete, logMaintenance, getMaintenanceHistory)
- [x] `workOrder/*` (create, list, get, updateStatus, assignVendor, schedule, complete, addComment, getStatusHistory, createInvoice)
- [x] `bid/*` (requestBids, submitBid, listBids, acceptBid, rejectBid, withdrawBid)

### 4.8 Cerbos Authorization Policies

- [x] `asset.yaml` - Asset access control
- [x] `work_order.yaml` - Work order permissions (existing)

### Deliverables
- [x] Asset management with maintenance tracking
- [x] Work order lifecycle with status validation
- [x] Vendor assignment and scheduling
- [x] Full audit trail of work order state changes
- [x] Complete bidding process
- [x] Integration with AP for invoicing
- [x] DBOS durable workflow integration

---

## Phase 5: Domain 4 — Violations

**Goal:** Implement violation tracking and enforcement workflow.

### 5.1 Violation Model

- [x] `Violation` model with:
  - Unit/location reference
  - Violation type/category
  - Description and evidence
  - Status lifecycle 
- [x] `ViolationType` configuration per association
- [x] CC&R/rule reference linking

### 5.2 Evidence Management

- [x] `ViolationEvidence` model
- [x] Photo/video attachment support
- [x] Evidence timestamp and location metadata
- [x] Chain of custody tracking

### 5.3 Notice Sequence

- [x] `ViolationNotice` model
- [x] Notice templates per violation type (`NoticeTemplate` model)
- [x] Notice sequence configuration (`NoticeSequenceConfig`, `NoticeSequenceStep` models)
  - Warning → First Notice → Second Notice → Fine → Hearing
- [x] Cure period tracking
- [x] Delivery method tracking (mail, email, posted)

### 5.4 Hearings

- [x] `ViolationHearing` model
- [x] Hearing scheduling
- [x] Hearing outcome recording
- [x] Appeal process support (`ViolationAppeal` model with full lifecycle)

### 5.5 Fines & GL Integration

- [x] Fine assessment on violation
- [x] Fine → Assessment Charge creation (`fineToCharge` endpoint)
- [x] Fine waiver/reduction workflow
- [x] Fine → GL posting (via assessment charge integration)

### 5.6 DBOS Violation Workflow

- [x] `violationLifecycle_v1` workflow
- [x] Automatic notice escalation based on cure period
- [x] SLA timers for response windows (cure period tracking)
- [x] Notification triggers (stub - queues intent)

### 5.7 API Procedures

- [x] `violation/v1/create` / `get` / `list` / `update`
- [x] `violation/v1/addEvidence` / `sendNotice` / `scheduleHearing`
- [x] `violation/v1/recordOutcome` / `assessFine` / `close`

### Deliverables
- [x] Violation lifecycle (core CRUD, status transitions, cure/close)
- [x] Evidence management
- [x] Automated notice sequences (templates, sequence config, steps)
- [x] Fine integration with accounting (assessment charge/GL posting)
- [x] Hearing management
- [x] Appeal process (file, schedule, decide, withdraw)

---

## Phase 6: Domain 5 — ARC (Architectural Requests)

**Goal:** Implement architectural review committee request processing.

### 6.1 ARC Request Model

- [x] `ARCRequest` model with:
  - Requestor (owner)
  - Unit reference
  - Project description
  - Status lifecycle
- [x] Request categories (fence, roof, paint, addition, etc.)
- [x] Estimated project cost and timeline

### 6.2 Plans & Documents

- [x] `ARCDocument` model
- [x] Document type classification (plans, specs, photos, permits)
- [x] Version tracking for revised submissions

### 6.3 Committee Management

- [x] `ARCCommittee` model
- [x] Committee member assignments
- [x] Voting configuration (quorum, approval threshold)

### 6.4 Review Process

- [x] `ARCReview` model for committee actions
- [x] Review actions: Approve, Deny, Request Changes, Table
- [x] Conditions of approval
- [x] Expiration dates for approvals

### 6.5 DBOS ARC Workflow

- [x] `arcReviewLifecycle_v1` workflow
- [x] Submission → Committee Review → Decision
- [x] Revision request loop
- [x] Approval expiration handling

### 6.6 API Procedures

- [x] `arc/request/v1/create` / `get` / `list` / `update`
- [x] `arc/request/v1/submit` / `addDocument` / `withdraw`
- [x] `arc/review/v1/assignCommittee` / `submitReview` / `recordDecision`

### Deliverables
- [x] Complete ARC request lifecycle (submit/withdraw/assignment/decision with guards)
- [x] Document management for plans
- [x] Committee review process (assignment, member reviews, quorum/threshold)
- [x] Conditional approvals with expiration

---

## Phase 7: Domain 8 — Governance

**Goal:** Implement board management, meetings, and voting.

### 7.1 Board Management

- [x] `Board` model
- [x] `BoardPosition` (President, VP, Secretary, Treasurer, Director)
- [x] `BoardMember` assignments with terms
- [x] Board history tracking

### 7.2 Meetings

- [x] `Meeting` model (board, annual, special)
- [x] Meeting scheduling and location
- [x] `MeetingAgenda` with agenda items
- [x] `MeetingMinutes` recording
- [x] Attendance tracking

### 7.3 Voting

- [x] `Vote` model for formal votes
- [x] Voting methods (in-person, proxy, electronic)
- [x] Quorum calculation
- [x] Vote tallying and results

### 7.4 Resolutions & Policies

- [x] `Resolution` model
- [x] Resolution status (proposed, adopted, superseded)
- [x] `PolicyDocument` for rules and regulations
- [x] Policy version history

### 7.5 API Procedures

- [x] `governance/board/v1/*`
- [x] `governance/meeting/v1/*`
- [x] `governance/vote/v1/*`
- [x] `governance/resolution/v1/*`

### Deliverables
- [x] Board composition management
- [x] Meeting lifecycle (schedule → agenda → minutes)
- [x] Voting with quorum enforcement
- [x] Resolution and policy tracking

---

## Phase 8: Domain 7 — Communications

**Goal:** Implement multi-channel communication capabilities.

### 8.1 Communication Templates

- [x] `CommunicationTemplate` model
- [x] Template types (email, SMS, letter)
- [x] Variable substitution support
- [x] Template versioning

### 8.2 Mass Communications

- [x] `MassCommunication` model
- [x] Recipient targeting (all owners, specific units, delinquent, etc.)
- [x] Scheduling for future send
- [x] Delivery tracking

### 8.3 Announcements

- [x] `Announcement` model
- [x] Portal display configuration
- [x] Announcement expiration
- [x] Read tracking

### 8.4 Calendar Events

- [x] `CalendarEvent` model
- [x] Event types (meeting, maintenance, amenity closure)
- [x] Recurring event support
- [ ] Event notifications

### 8.5 API Procedures

- [x] `communication/template/v1/*`
- [x] `communication/mass/v1/*`
- [x] `communication/announcement/v1/*`
- [x] `calendar/event/v1/*`

### Deliverables
- [x] Template management
- [x] Mass email/SMS capability (integration points stubbed)
- [x] Announcement system
- [x] Calendar with events

---

## Phase 9: Domain 9 — Owner Portal / CRM

**Goal:** Implement homeowner-facing portal capabilities.

### 9.1 User Account Management

- [x] Profile management
- [x] Contact preferences
- [x] Notification settings
- [ ] Password/security management

### 9.2 Request System

- [x] `OwnerRequest` model (general inquiries)
- [x] Request categorization
- [x] Request → Work Order conversion
- [x] Request tracking and history

### 9.3 Payment Preferences

- [x] Stored payment methods (integration point)
- [x] Auto-pay configuration
- [ ] Payment history view

### 9.4 Document Access

- [x] Document visibility rules per role
- [x] Document download tracking
- [x] Secure document delivery

### 9.5 API Procedures

- [x] `portal/profile/v1/*`
- [x] `portal/request/v1/*`
- [x] `portal/payment/v1/*`
- [x] `portal/document/v1/*`

### Deliverables
- [x] Owner self-service capabilities
- [x] Request submission and tracking
- [x] Payment preference management
- [x] Secure document access

---

## Phase 10: Domain 10 — Documents & Records

**Goal:** Implement comprehensive document management.

### 10.1 Document Model

- [x] `Document` model with:
  - Type classification
  - Association/property scope
  - Version tracking
  - Access control
- [x] Document categories:
  - CC&Rs, Bylaws, Rules
  - Financial Reports
  - Contracts
  - Reserve Studies
  - ARC Plans
  - Inspection Reports

### 10.2 Document Storage

- [x] File storage abstraction (local/S3-compatible)
- [x] Document metadata extraction
- [x] Thumbnail generation for images
- [x] PDF preview support

### 10.3 Document Versioning

- [x] Version history tracking
- [ ] Version comparison support
- [x] Superseded document handling

### 10.4 Access Control

- [x] Document visibility rules
- [x] Role-based access
- [x] Audit trail for access

### 10.5 API Procedures

- [x] `document/v1/upload` / `get` / `list` / `download`
- [x] `document/v1/updateMetadata` / `archive` / `restore`
- [x] `document/v1/getVersions` / `revert`

### Deliverables
- [x] Centralized document repository
- [x] Version control
- [x] Role-based access
- [x] Audit trail

---

## Phase 11: Domain 11 — Reserve Studies

**Goal:** Implement reserve study tracking and funding analysis.

### 11.1 Reserve Component Model

- [x] `ReserveComponent` model with:
  - Description and category
  - Useful life / remaining life
  - Replacement cost (current and future)
  - Funding status

### 11.2 Reserve Study

- [x] `ReserveStudy` model
- [x] Study date and preparer
- [x] Component inventory snapshot
- [x] Funding plan recommendations

### 11.3 Funding Analysis

- [x] Current reserve balance tracking
- [x] Funding plan modeling
- [x] Percent-funded calculation
- [x] Contribution schedule

### 11.4 API Procedures

- [x] `reserve/component/v1/*`
- [x] `reserve/study/v1/*`
- [x] `reserve/funding/v1/*`

### Deliverables
- [x] Reserve component inventory
- [x] Study tracking with snapshots
- [x] Funding analysis tools

---

## Phase 12: Domain 12 — Compliance

**Goal:** Implement compliance tracking and deadline management.

### 12.1 Compliance Requirements

- [x] `ComplianceRequirement` model
- [x] Requirement types:
  - Statutory deadlines
  - Notice requirements
  - Voting rules
  - Financial audit requirements
  - Resale packet guidelines
- [x] Jurisdiction-based rules

### 12.2 Compliance Calendar

- [x] Deadline tracking per association
- [x] Recurring compliance events
- [x] Compliance status dashboard

### 12.3 Compliance Checklist

- [x] `ComplianceChecklist` model
- [x] Checklist items with due dates
- [x] Completion tracking
- [x] Evidence/documentation linking

### 12.4 API Procedures

- [x] `compliance/requirement/v1/*`
- [x] `compliance/deadline/v1/*`
- [x] `compliance/checklist/v1/*`

### Deliverables
- [x] Compliance requirement library
- [x] Deadline tracking and alerts
- [x] Checklist management

---

## Phase 13: Domain 3 — Workflow Automation (Remaining Workflows)

**Goal:** Implement remaining DBOS workflows not covered in earlier phases.

### 13.1 Assessment Posting Workflow

- [x] `assessmentPosting_v1` workflow
- [x] Scheduled charge generation
- [x] Late fee application
- [x] Delinquency escalation (notification stub)

### 13.2 AP Invoice → Payment Workflow

- [ ] `apPaymentProcessing_v1` workflow (deferred - complex integration)
- [ ] Invoice approval chain
- [ ] Payment batch processing
- [ ] Check/ACH generation (integration point)

### 13.3 Vendor Assignment Workflow

- [ ] `vendorAssignment_v1` workflow (deferred - depends on ML matching)
- [ ] Automatic vendor matching
- [ ] Bid request automation

### 13.4 Meeting Workflow

- [x] `meetingLifecycle_v1` workflow
- [x] Notice generation (notification stub)
- [x] Agenda distribution (notification stub)
- [x] Minutes placeholder creation

### Deliverables
- [x] Core domain workflows implemented in DBOS (workOrder, violation, ARC, assessment, meeting)
- [x] Workflow versioning aligned with API versions
- [x] Complete audit trails via DBOS system database

---

## Phase 14: Cross-Tenant Features

**Goal:** Implement features that span organizational boundaries.

### 14.1 Service Provider Portal

- [x] Multi-association work order view (`serviceProviderWorkOrders` router)
- [ ] Unified invoice submission (deferred - requires AP integration)
- [x] Service area management (`ServiceArea` model, `serviceArea` router)
- [x] Service provider link verification (`ServiceProviderLink` model)

### 14.2 Management Company Features

- [ ] Portfolio dashboard (deferred - requires aggregation layer)
- [ ] Cross-association reporting (deferred - requires reporting framework)
- [ ] Manager workload balancing (deferred)

### 14.3 Homeowner Concierge

- [x] Individual homeowner onboarding (`IndividualProperty` model)
- [x] Personal property management (`IndividualAsset` model)
- [x] Vendor coordination for individuals (`IndividualMaintenanceRequest` model)

### Deliverables
- [x] Service providers can manage work across associations (via linked vendors)
- [ ] Management companies have portfolio-level views (deferred)
- [x] Individual homeowners can use platform independently (models ready)

---

## Phase 15: Reporting & Analytics

**Goal:** Implement reporting infrastructure and standard reports.

### 15.1 Reporting Framework

- [x] Report definition model (`ReportDefinition`)
- [x] Parameter handling (JSON schema in `parametersJson`)
- [x] Output formats (PDF, Excel, CSV, JSON, HTML)
- [x] Report scheduling (`ReportSchedule` model)
- [x] Report execution tracking (`ReportExecution` model)
- [x] Dashboard widgets (`DashboardWidget` model)

### 15.2 Financial Reports

- [x] Report categories defined (FINANCIAL, RECEIVABLES, PAYABLES)
- [ ] Balance Sheet (report template - deferred)
- [ ] Income Statement (report template - deferred)
- [ ] Aged Receivables (report template - deferred)
- [ ] Delinquency Report (report template - deferred)
- [ ] Budget vs. Actual (report template - deferred)

### 15.3 Operational Reports

- [x] Report categories defined (OPERATIONAL, COMPLIANCE, GOVERNANCE)
- [x] Dashboard summary endpoint with aggregated metrics
- [ ] Work Order Summary (report template - deferred)
- [ ] Violation Summary (report template - deferred)
- [ ] ARC Request Status (report template - deferred)
- [ ] Compliance Status (report template - deferred)

### 15.4 API Procedures

- [x] `reportDefinition/create` / `list` / `get` / `update` / `delete`
- [x] `reportExecution/generate` / `list` / `get` / `cancel`
- [x] `reportSchedule/create` / `list` / `get` / `update` / `delete` / `runNow`
- [x] `dashboard/createWidget` / `listWidgets` / `updateWidget` / `deleteWidget` / `reorderWidgets` / `getSummary`

### Deliverables
- [x] Reporting framework (models, enums, API routes)
- [ ] Standard financial reports (templates deferred)
- [x] Operational dashboards (widget system + summary endpoint)

---

## Phase 16: Production Hardening

**Goal:** Prepare the platform for production deployment.

### 16.1 Security Audit

- [ ] RLS policy review and testing
- [ ] Authentication flow security review
- [ ] API rate limiting
- [ ] Input sanitization audit

### 16.2 Performance Optimization

- [ ] Database index optimization
- [ ] Query performance analysis
- [ ] Caching strategy implementation
- [ ] Load testing

### 16.3 Operational Readiness

- [ ] Backup and restore procedures
- [ ] Disaster recovery plan
- [ ] Monitoring and alerting setup
- [ ] Runbook documentation

### 16.4 Documentation

- [ ] API documentation finalization
- [ ] Deployment guide
- [ ] Operations manual

### Deliverables
- [ ] Production-ready platform
- [ ] Security hardened
- [ ] Performance optimized
- [ ] Operational documentation

---

## Appendix A: Technology Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend Framework | SvelteKit |
| Runtime | Node.js |
| Process Manager | PM2 (cluster mode) |
| API Framework | oRPC |
| Schema Validation | Zod (generated from Prisma) |
| ORM | Prisma |
| Database | PostgreSQL (self-hosted) |
| Row-Level Security | Postgres RLS |
| Session Storage | Redis |
| Workflow Engine | DBOS |
| Observability | OpenTelemetry |
| Reverse Proxy | Traefik |
| Containerization | Docker Compose |
| Authentication | Better-Auth |

---

## Appendix B: Domain to Phase Mapping

| Domain | Phase |
|--------|-------|
| 1. Association/Property | Phase 2 |
| 2. Accounting | Phase 3 |
| 3. Workflow Automation | Phase 4, 13 |
| 4. Violations | Phase 5 |
| 5. ARC | Phase 6 |
| 6. Work Orders | Phase 4 |
| 7. Communications | Phase 8 |
| 8. Governance | Phase 7 |
| 9. Owner Portal | Phase 9 |
| 10. Documents | Phase 10 |
| 11. Reserve Studies | Phase 11 |
| 12. Compliance | Phase 12 |

---

## Appendix C: DBOS Workflow Summary

| Workflow | Phase | Priority |
|----------|-------|----------|
| `workOrderLifecycle_v1` | Phase 4 | **First** |
| `violationLifecycle_v1` | Phase 5 | High |
| `arcReviewLifecycle_v1` | Phase 6 | High |
| `assessmentPosting_v1` | Phase 13 | Medium |
| `apPaymentProcessing_v1` | Phase 13 | Medium |
| `vendorAssignment_v1` | Phase 13 | Medium |
| `meetingLifecycle_v1` | Phase 13 | Medium |

---

## Appendix D: API Namespace Structure

```
/api/v1/rpc
├── association.*
├── property.*
├── unit.*
├── party.*
├── ownership.*
├── accounting.glAccount.*
├── accounting.journalEntry.*
├── accounting.assessment.*
├── accounting.payment.*
├── accounting.apInvoice.*
├── workOrder.*
├── vendor.*
├── asset.*
├── violation.*
├── arc.request.*
├── arc.review.*
├── governance.board.*
├── governance.meeting.*
├── governance.vote.*
├── governance.resolution.*
├── communication.template.*
├── communication.mass.*
├── communication.announcement.*
├── calendar.event.*
├── portal.profile.*
├── portal.request.*
├── portal.payment.*
├── portal.document.*
├── document.*
├── reserve.component.*
├── reserve.study.*
├── reserve.funding.*
├── compliance.requirement.*
├── compliance.deadline.*
├── compliance.checklist.*
├── report.*
```
