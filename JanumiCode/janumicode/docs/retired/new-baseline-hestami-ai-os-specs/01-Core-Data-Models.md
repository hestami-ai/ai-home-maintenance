# Hestami OS: Core Data Models & Entities

*Every entity added below MUST include a `[Source: Phase X]` citation.*

## Phase 19: Staff Onboarding
- **Staff Model Extensions:** `activationCodeEncrypted` (String, nullable) and `activationCodeExpiresAt` (DateTime, nullable). [Source: Phase 19]

## Phase 21: RLS Enforcement
- **Denormalized Organization IDs:** 15 core tables (Property, Unit, WorkOrder, ARCRequest, Violation, Vendor, Asset, GLAccount, BankAccount, AssessmentType, ViolationType, Board, Meeting, ARCCommittee, PolicyDocument) must include an explicit `organizationId` for Tier 1 isolation instead of relying on joins. [Source: Phase 21]

## Phase 23: TIMESTAMPTZ Migration
- **Timezone Awareness:** All `DateTime` fields migrated to Prisma native type `@db.Timestamptz(3)` to ensure UTC storage and conversion at the database boundary. All `SECURITY DEFINER` functions must return `TIMESTAMPTZ(3)`. [Source: Phase 23]

## Phase 24: Document Processing Queue (DPQ)
- **Document Status Extensions:** `DocumentStatus` extended with `PENDING_UPLOAD`, `PROCESSING`, `PROCESSING_FAILED`, `INFECTED`. [Source: Phase 24]
- **Document Processing Metadata:** Added to `Document` model (`processingStartedAt`, `processingCompletedAt`, `processingAttemptCount`, `processingNextRetryAt`, `processingErrorType`, `processingErrorMessage`, `processingErrorDetails`). [Source: Phase 24]

## Phase 1: Community Association Management (CAM)
- **Identity & Org**: Base layout involves `Organization`, `User`, `MemberLevel` tracking cross-tenant roles like Board Member or Property Manager. Note: `OrganizationType` handles the differentiation between CAM properties vs Contractor providers vs Internal staff. `Association` represents the entity itself.
- **Core Entities**: The foundation objects for Associations involve tracking `Unit`, `Property`, `Owner`, `Assessment`, `GoverningDocument`.
- **Violations**: Uses `Violation` tied to specific units and governed texts. Expands into `ViolationEvidence` tracking. Lifecycle includes tracking states like DETECTED, UNDER_REVIEW, NOTICE_SENT, ESCALATED, etc.
- **Architectural Control**: Managed via `ARCRequest`. Ties heavily into `VoteBallot` and `Vote` schemas for handling board quorum/approval requirements.
- **Work Orders (Oversight)**: Represents the authorization/funding container via standard `WorkOrder`. Tracks budget (`FundType`), Origin Links (`WorkOrderOriginType` -> `violationId`/`arcRequestId`), and Constraints (`boardApprovalStatus`). Execution links over to Phase 2 records via `Job`.
- **Documents & Records**: General documents are linked across contexts via `DocumentContextBinding` enforcing type classification and version supersession. Linked into DB Activity log on all decision events.
- **Governance & Meetings**: Modeled via `Meeting`, `MeetingAgendaItem`, `BoardMotion`, `Vote`, and `Resolution`. Agenda items provide external FKs (`arcRequestId`, `violationId`, `workOrderId`). Votes capture conflict of interest parameters on `VoteBallot`.
- **Dashboard Views**: Uses aggregation schemas strictly for the frontend (e.g. `DashboardRequiresActionSchema`) grouping from core entities, without persisting distinct dashboard layout data per user.
- **Staff Management**: `Staff` model gains an optional `organizationId` to support Management Company and Community Association scoped staff. [Source: Phase 28]
- **Committee Structure:** Added `Committee` model (name, description, committeeType, arcLinked) and `CommitteeMember` junction to `Party` model with `CommitteeRole` enum. Board and Committee members are strictly selected from the `Party` model. [Source: Phase 28]
- `Auth Models`: Models specifically configured for handling cross-tenant users, session contexts and JWT validations aligned via Better-Auth integration rules.
- `Event Data Logs`: Models built into Postgres for long-term telemetry / event logging purposes, specifically decoupled from standard application behavior.

## Phase 27: Association Management
- **Managed Association Core:** The creation of an Association by a Management Company establishes linked records for `Association` and `ManagementContract`, while enforcing the parent `organizationId` from the Management Company. [Source: Phase 27]

## Phase 28: Governance & Staff Management
- **Staff Extension:** `Staff` model gains an optional `organizationId` to support Management Company and Community Association scoped staff. [Source: Phase 28]
- **Committee Structure:** Added `Committee` model (name, description, committeeType, arcLinked) and `CommitteeMember` junction to `Party` model with `CommitteeRole` enum. Board and Committee members are strictly selected from the `Party` model. [Source: Phase 28]
- `Auth Models`: Models specifically configured for handling cross-tenant users, session contexts and JWT validations aligned via Better-Auth integration rules.
- `Event Data Logs`: Models built into Postgres for long-term telemetry / event logging purposes, specifically decoupled from standard application behavior.

## Phase 2: Service Provider / Contractor Operations
- **Contractor Identity**: `OrganizationType` fields `SERVICE_PROVIDER` and `EXTERNAL_SERVICE_PROVIDER`. Associated tables: `ContractorProfile`, `ContractorBranch`, `ContractorLicense`, `ContractorTrade`, `ContractorComplianceStatus`.
- **Workforce**: `Technician`, `TechnicianSkill`, `TechnicianAvailability`, `TechnicianTerritory`, `TechnicianKPI`. Constrains operations based on schedule vs active branch scope.
- **Pricebook**: Models the cost structure `Pricebook`, `PricebookItem`, `PricebookVersion`, `PriceRule`, `JobTemplate`. Scoped per contractor org.
- **Job Lifecycle**: Models end-to-end work lifecycle. `Job`, `JobStatusHistory`, `JobCheckpoint`, `JobVisit`, joined back to `WorkOrderLineItem`. References either a `Customer` (off-platform) or `WorkOrder` (HOA originated).
- **Dispatch**: Tracks scheduling via `DispatchAssignment`, `RoutePlan`, `SLAWindow`.
- **Invoices / Revenue**: Generates estimates and manages final payment records through `Estimate`, `Proposal`, `JobInvoice`, `PaymentIntent`.
- **Inventory Mgt.** `Supplier`, `InventoryItem`, `InventoryTransfer`, `PurchaseOrder`. Usage ties inventory to `JobVisit`.

## Phase 3: Concierge Property Owner
- **Owners**: Uses `OrganizationType` values `INDIVIDUAL_PROPERTY_OWNER` and `TRUST_OR_LLC`. Adds roles via `PropertyOwnershipRole` enum (OWNER, TRUSTEE, DELEGATED_AGENT).
- **Portfolios**: Groups properties via `PropertyPortfolio`, `PortfolioProperty`.
- **Intents**: Represents natural language requests via `OwnerIntent`, `IntentNote`. Classifies using `OwnerIntentCategory` and `OwnerIntentPriority`.
- **Concierge Cases**: A durable container linking actions together: `ConciergeCase`, `CaseStatusHistory`, `CaseParticipant`.
- **Unified Document System**: An overarching replacement for earlier document logic. Introduces `Document` over `AssociationDocument`. Binds logic to various entities flexibly using `DocumentContextBinding` and expanded `DocumentCategory` enum types.
- **Actions & Ledgers**: Tracks internal concierge action with `ConciergeAction`, and creates a transparent paper trail of choices using `MaterialDecision`. Logs approvals via `ExternalHOAContext` and interactions with `ExternalVendorContext`.

## Phase 4: Activity & Audit Schema
- **Auditing / History Track**: Dedicated trust ledger for accountability (`ActivityEvent`). Categorizes data via `ActivityEventCategory` (`INTENT`, `DECISION`, `EXECUTION`, `SYSTEM`) and specifies actors via `ActivityActorType` (`HUMAN`, `AI`, `SYSTEM`). Replaces the `AuditLog` structure directly with more nuanced attributes matching specific entities.

## Phase 30: Document Unified Model & Isolation
- **Unified Document Model:** Deprecate `ViolationEvidence` and `ARCDocument`. Migrate to `Document` + `DocumentContextBinding` with `contextType` of `VIOLATION` or `ARC_REQUEST`. [Source: Phase 30]
- **Tiered Isolation Identity:** Added `associationId` explicitly to `Document` to enable Association-level RLS filtering on top of Organization-level. [Source: Phase 30]

## Phase 31: International & Data Residency Data Models
- **Organization Extensions:** Added `residencyZone`, `defaultLocale`, `defaultTimezone`, `defaultCurrencyCode`, `legalCountryCode`, `legalSubdivisionCode` to `Organization`. [Source: Phase 31]
- **Shared Address Model:** Replace US-centric fields with a shared `Address` model using ISO codes (`countryCode`, `subdivisionCode`). [Source: Phase 31]
- **Tax and Compliance:** Extracted generic `TaxIdentifier` (VAT_ID, EIN), generic `Jurisdiction` (rules/flags), and `DataSubjectRequest` (GDPR compliance). [Source: Phase 31]
- **Multi-Currency Accounting:** Financial records explicitly declare `currencyCode` (alongside `amountMinor` or generic `Decimal`). [Source: Phase 31]

## Phase 32: Reserve Studies Models
- **Reserve Inventory & Studies:** Uses `ReserveComponent` (global inventory), `ReserveStudy` (the study record), `ReserveStudyComponent` (snapshot data for the study), and `ReserveFundingSchedule` (multi-year funding projections). [Source: Phase 32]

## Phase 33: Statutory Compliance Models
- **Templates vs Instances:** `ComplianceRequirement` acts as the organization-level template. `ComplianceDeadline` acts as the association-level instance, composed of `ComplianceChecklistItem`s linked to `Document`s as evidence. [Source: Phase 33]

## Phase 35: RLS Connection Pooling
- **RLS Policy Additions:** `individual_properties` gets explicit RLS (was missing). Join-based RLS added to `individual_assets`, `individual_maintenance_requests`, `property_ownerships`, `portfolio_properties`, and Concierge Phase 3 child tables. [Source: Phase 35]

## Phase 37: Staff Portal Orgs Model Updates
- **Security Definer Functions:** Bypassing RLS for Staff admins using structured functions (`get_all_organizations_for_staff`, `get_organization_details_for_staff`, `get_organization_members_for_staff`, `update_organization_status_for_staff`, `update_organization_info_for_staff`). [Source: Phase 37]

## Phase 38: Sub-User Onboarding
- **OrganizationInvitation:** Tracks generic invites with `codeEncrypted`, `deliveryMethod`, `metadata` (for pillar-specifc info like unit limit), `expiresAt`. Status: PENDING | ACCEPTED | EXPIRED | REVOKED. [Source: Phase 38]
- **JoinRequest:** For users submitting requests to join. Contains `JoinRequestStatus` and `verificationData`. [Source: Phase 38]
- **Relationships:** `Organization` gains `invitations` and `joinRequests` relationships. [Source: Phase 38]

## Phase 40: LibreChat Integration
- **Contextual Linking:** e.g., `ConciergeCase` must add a `libreChatId` column (String?) to link natively-tracked issues directly to LibreChat conversations. [Source: Phase 40]

---

