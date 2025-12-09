# Implementation Roadmap: CAM Platform (Vantaca Competitor)

## Overview

This roadmap outlines the phased implementation of the Community Association Management (CAM) platform. Since development is AI-agent driven, phases are defined by logical dependencies rather than time estimates.

**Key Decisions:**
- **Multi-tenancy:** Row-level tenancy with `tenant_id` (Management Company)
- **Self-managed HOAs:** Supported (Association acts as its own Management Company)
- **Tech Stack:** Django + DBOS (backend), SvelteKit + Bun (frontend), PostgreSQL, Morphir (domain model)
- **Auth:** Django built-in authentication
- **Portals:** Manager Portal + Homeowner Portal in MVP

---

## Phase 0: Foundation & Infrastructure ✅ (Complete)

**Goal:** Establish the development environment, project structure, and core infrastructure patterns.

**Status:** Complete (except Morphir, which is deferred pending Phase 1 entity definitions).

### 0.1 Project Scaffolding
- [x] Create monorepo structure:
  ```
  /cam-platform
    /backend          # Django + DBOS
    /frontend         # SvelteKit
    /morphir          # Domain definitions
    /infrastructure   # Docker Compose, scripts
  ```
- [x] Initialize Django project with DRF
- [x] Initialize SvelteKit project with Bun (Svelte 5, Tailwind v4, Skeleton UI)
- [x] Set up PostgreSQL with Docker Compose
- [x] Configure DBOS integration with Django (placeholder, full integration pending)

### 0.2 Fractal-HVA Operational Guarantees
- [x] Implement Idempotency Key middleware (Redis-backed)
- [x] Implement API Versioning middleware (header-based: `Accept: application/vnd.cam.v1+json`)
- [x] Create `OutboxEvent` table and model
- [x] Implement Transactional Outbox pattern (atomic commits)
- [x] Create DBOS background worker for outbox processing

> **Note:** Outbox processor in `backend/cam/core/workers.py`. Run with `python manage.py process_outbox --continuous`.

### 0.3 Multi-Tenancy Infrastructure
- [x] Create `ManagementCompany` model (the tenant)
- [x] Implement row-level tenancy middleware
- [x] Create tenant-aware base model class (`TenantModel`)
- [x] Implement tenant context injection for all queries

### 0.4 Authentication & Authorization
- [x] Configure Django built-in auth
- [x] Create `User` model extensions (tenant association)
- [x] Implement RBAC foundation:
  - Role: `SystemAdmin`, `Manager`, `BoardMember`, `Homeowner`
  - Permission scoping by Association
- [x] Create JWT token generation for API access
- [x] Implement session management for portal access

> **Note:** Session endpoints at `/api/v1/auth/session/login/`, `/logout/`, `/status/`.

### 0.5 Morphir Setup ✅
- [x] Install Morphir toolchain (package.json with morphir-elm)
- [x] Define initial domain types:
  - `CAM.Domain.Tenant` - ManagementCompany, Association, Phase, Portfolio, LateFeeConfig
  - `CAM.Domain.Property` - Unit, Resident, UnitOwnership
  - `CAM.Domain.Financial` - Money, Fund, GLAccount, GLTransaction, AssessmentRule
  - `CAM.Domain.Workflow` - ActionItem, WorkflowTemplate, Message
- [x] Define business rules:
  - `CAM.Rules.LateFee` - Late fee calculation logic
  - `CAM.Rules.Assessment` - Assessment generation rules
- [x] Configure build pipeline:
  - `npm run gen:typescript` → frontend/src/lib/generated
  - `npm run gen:python` → backend/cam/generated
- [ ] **Checkpoint:** Generate code and validate integration

> **Note:** Run `cd morphir && npm install && npm run gen:all` to generate TypeScript and Python code.

---

## Phase 1: Organizational Hierarchy & Core Entities

**Goal:** Establish the foundational data model for managing associations, units, and residents.

### 1.1 Management Company & Association
- [x] `ManagementCompany` model:
  - `name`, `settings` (JSON), `is_self_managed` (boolean)
- [x] `Association` model:
  - `name`, `tax_id`, `fiscal_year_end`, `address`
  - `management_company_id` (FK, tenant)
  - `bylaws_config` (JSON: late fee rules, grace periods)
- [x] `Portfolio` model:
  - Logical grouping for community managers
  - Many-to-many with Associations
- [x] `Phase` / `Neighborhood` model:
  - Sub-grouping within Association
  - Used for assessment rule scoping

> **Note:** Models created in `backend/cam/tenants/models.py` with serializers and viewsets.

### 1.2 Unit (Property) Model
- [x] `Unit` model:
  - `account_number` (unique per Association)
  - `address`, `unit_type` (SFH, Condo, Townhome)
  - `association_id`, `phase_id`
  - `lot_size`, `square_footage` (optional)
- [x] Unit search and filtering API

> **Note:** Models created in `backend/cam/properties/models.py` with serializers and viewsets.

### 1.3 Resident Model
- [x] `Resident` model:
  - `first_name`, `last_name`, `email`, `phone`
  - `resident_type`: Owner, Tenant, Previous Owner
  - `is_board_member`, `board_position`
  - `portal_access_enabled`
  - `contact_preferences` (JSON)
- [x] `UnitOwnership` model (junction table):
  - `unit_id`, `resident_id`
  - `ownership_percentage`, `start_date`, `end_date`
  - Supports multiple owners per unit
- [x] Ownership history tracking

### 1.4 API Endpoints (Phase 1)
- [x] CRUD: `/api/v1/tenants/associations/`
- [x] CRUD: `/api/v1/properties/units/`
- [x] CRUD: `/api/v1/properties/residents/`
- [x] CRUD: `/api/v1/properties/ownerships/`
- [x] GET: `/api/v1/tenants/portfolios/` (manager view)
- [x] Implement pagination, filtering, search

> **Note:** All endpoints include tenant-aware filtering, search, and pagination.

### 1.5 Frontend: Manager Portal Shell
- [ ] SvelteKit app structure with routing
- [ ] Authentication flow (login/logout)
- [ ] Navigation shell (sidebar, header)
- [ ] Association selector (portfolio view)
- [ ] Unit directory page (list, search, filter)
- [ ] Unit detail page (residents, ownership history)

---

## Phase 2: Financial Core - General Ledger (Fund Accounting)

**Goal:** Implement the fund accounting foundation that differentiates CAM from standard accounting.

### 2.1 Chart of Accounts
- [ ] `Fund` model:
  - `name`, `fund_type` (Operating, Reserve, Deferred Maintenance)
  - `association_id`
- [ ] `GLAccount` model:
  - `account_number`, `name`, `account_type` (Asset, Liability, Equity, Revenue, Expense)
  - `parent_account_id` (hierarchical)
  - `association_id`, `fund_id`
  - `is_bank_account`, `is_system_account`
- [ ] Default Chart of Accounts template (seed data)
- [ ] Association-specific COA customization

### 2.2 General Ledger Entries
- [ ] `GLEntry` model:
  - `date`, `description`, `reference_number`
  - `debit_amount`, `credit_amount`
  - `gl_account_id`, `fund_id`, `association_id`
  - `source_type`, `source_id` (polymorphic: Invoice, Payment, etc.)
  - `created_by`, `created_at`
- [ ] Double-entry validation (debits = credits per transaction)
- [ ] `GLTransaction` model (groups related entries)
- [ ] Journal entry API with atomic commits

### 2.3 Bank Account Model
- [ ] `BankAccount` model:
  - `account_number`, `routing_number`, `bank_name`
  - `account_type` (Checking, Savings, Money Market)
  - `fund_id` (Operating vs Reserve)
  - `association_id`
  - `current_balance`, `last_reconciled_date`
- [ ] Bank account ↔ GL Account linkage

### 2.4 Budget Model
- [ ] `Budget` model:
  - `fiscal_year`, `association_id`
  - `status` (Draft, Approved, Active)
- [ ] `BudgetLineItem` model:
  - `budget_id`, `gl_account_id`
  - `budgeted_amount` (monthly or annual)
- [ ] Budget vs Actual comparison logic

### 2.5 Financial Reports
- [ ] Balance Sheet generator (by Fund)
- [ ] Income Statement generator (by Fund, by Period)
- [ ] Trial Balance report
- [ ] Budget vs Actual report
- [ ] Report export (PDF, CSV)

### 2.6 API Endpoints (Phase 2)
- [ ] CRUD: `/api/v1/associations/{id}/funds/`
- [ ] CRUD: `/api/v1/associations/{id}/gl-accounts/`
- [ ] POST: `/api/v1/associations/{id}/journal-entries/`
- [ ] GET: `/api/v1/associations/{id}/reports/balance-sheet/`
- [ ] GET: `/api/v1/associations/{id}/reports/income-statement/`

### 2.7 Frontend: Financial Module
- [ ] Chart of Accounts management page
- [ ] Journal entry form
- [ ] GL transaction history view
- [ ] Financial reports dashboard
- [ ] Report viewer with export options

---

## Phase 3: Accounts Receivable - The Assessment Engine

**Goal:** Automate the generation of charges and tracking of homeowner balances.

### 3.1 Owner Ledger
- [ ] `OwnerLedger` model:
  - `unit_id` (1:1 relationship)
  - `current_balance`, `last_payment_date`
- [ ] `LedgerEntry` model:
  - `ledger_id`, `date`, `description`
  - `charge_amount`, `payment_amount`
  - `running_balance`
  - `source_type`, `source_id` (Assessment, Payment, Fine, etc.)
- [ ] Ledger balance calculation (real-time vs cached)

### 3.2 Charge Types & Assessment Rules
- [ ] `ChargeType` model:
  - `name` (Monthly Assessment, Special Assessment, Late Fee, Violation Fine)
  - `gl_account_id` (revenue account)
  - `association_id`
- [ ] `AssessmentRule` model:
  - `charge_type_id`, `amount`
  - `frequency` (Monthly, Quarterly, Annual, One-Time)
  - `effective_date`, `end_date`
  - `scope`: All Units, Phase, Specific Units
  - `day_of_month` (when to charge)
- [ ] Assessment rule evaluation engine

### 3.3 Assessment Generation (DBOS Workflow)
- [ ] `@dbos.workflow`: `generate_monthly_assessments`
  - Evaluate all active rules
  - Create charges for applicable units
  - Post to Owner Ledger
  - Post to GL (Debit: AR, Credit: Assessment Revenue)
  - Emit `assessment.generated` event
- [ ] Scheduled trigger (1st of month)
- [ ] Manual trigger option

### 3.4 Late Fee Engine
- [ ] Late fee configuration per Association:
  - Grace period (days)
  - Late fee type (Flat, Percentage, Tiered)
  - Late fee amount/rate
- [ ] `@dbos.workflow`: `apply_late_fees`
  - Identify delinquent accounts past grace period
  - Calculate and apply late fees
  - Post to ledger and GL
  - Emit `late_fee.applied` event

### 3.5 Payment Processing (Manual Entry)
- [ ] `Payment` model:
  - `unit_id`, `amount`, `payment_date`
  - `payment_method` (Check, Cash, ACH, Credit Card)
  - `reference_number`, `memo`
  - `deposit_batch_id`
- [ ] Payment application logic:
  - FIFO (oldest charges first)
  - Specific charge allocation
- [ ] `DepositBatch` model (group payments for bank deposit)
- [ ] GL posting (Debit: Bank, Credit: AR)

### 3.6 Delinquency Tracking
- [ ] `DelinquencyStatus` model:
  - `unit_id`, `current_stage`
  - `stage_entered_date`, `next_action_date`
- [ ] Delinquency stages (configurable per Association):
  - Current → Reminder → Late Letter → Intent to Lien → Attorney Turnover
- [ ] `@dbos.workflow`: `delinquency_escalation`
  - Monitor accounts
  - Auto-escalate based on rules
  - Generate letters/notices
  - Emit events for each transition

### 3.7 API Endpoints (Phase 3)
- [ ] GET: `/api/v1/units/{id}/ledger/`
- [ ] POST: `/api/v1/associations/{id}/assessments/generate/`
- [ ] POST: `/api/v1/units/{id}/payments/`
- [ ] GET: `/api/v1/associations/{id}/delinquencies/`
- [ ] CRUD: `/api/v1/associations/{id}/assessment-rules/`

### 3.8 Frontend: AR Module
- [ ] Owner ledger detail view
- [ ] Assessment rule configuration
- [ ] Payment entry form
- [ ] Deposit batch management
- [ ] Delinquency dashboard
- [ ] AR aging report

---

## Phase 4: The Action Item Engine (Workflow Core)

**Goal:** Implement the workflow engine that makes everything trackable and actionable.

### 4.1 Action Item Model
- [ ] `ActionItem` model:
  - `id`, `type` (Invoice Approval, Violation, Homeowner Request, etc.)
  - `title`, `description`
  - `linked_object_type`, `linked_object_id` (polymorphic)
  - `association_id`, `unit_id` (optional)
  - `current_step`, `status` (Open, In Progress, Completed, Cancelled)
  - `assigned_role`, `assigned_user_id`
  - `priority`, `due_date`, `follow_up_date`
  - `created_at`, `updated_at`

### 4.2 Workflow Definition
- [ ] `WorkflowTemplate` model:
  - `name`, `action_item_type`
  - `steps` (JSON array of step definitions)
  - `association_id` (null = global template)
- [ ] `WorkflowStep` structure:
  - `step_name`, `assigned_role`
  - `allowed_transitions` (next steps)
  - `auto_escalation_days`, `escalation_target`
  - `required_fields`, `validation_rules`

### 4.3 Action Item Lifecycle (DBOS)
- [ ] `@dbos.workflow`: `action_item_lifecycle`
  - Create action item
  - Monitor step timeouts
  - Auto-escalate when overdue
  - Emit events on transitions
- [ ] Step transition API with validation
- [ ] Bulk action support

### 4.4 Message/Communication Model
- [ ] `Message` model:
  - `action_item_id` (required) OR `unit_id`
  - `direction` (Inbound, Outbound)
  - `channel` (Email, SMS, Portal Note, Phone Log)
  - `subject`, `body`
  - `sender_id`, `recipient_id`
  - `sent_at`, `read_at`
- [ ] `Attachment` model:
  - `message_id`, `file_name`, `file_url`, `file_type`
- [ ] Message threading (replies)

### 4.5 Notification System
- [ ] `NotificationPreference` model (per user)
- [ ] `Notification` model:
  - `user_id`, `type`, `title`, `body`
  - `action_item_id`, `read_at`
- [ ] In-app notification delivery
- [ ] Email notification templates (deferred: actual sending)

### 4.6 API Endpoints (Phase 4)
- [ ] CRUD: `/api/v1/action-items/`
- [ ] POST: `/api/v1/action-items/{id}/transition/`
- [ ] GET: `/api/v1/action-items/my-queue/`
- [ ] CRUD: `/api/v1/action-items/{id}/messages/`
- [ ] GET: `/api/v1/notifications/`

### 4.7 Frontend: Action Item Module
- [ ] Action item queue (filterable by type, status, assignment)
- [ ] Action item detail view
- [ ] Step transition UI with validation
- [ ] Message thread view
- [ ] Notification center
- [ ] Dashboard widgets (overdue items, my assignments)

---

## Phase 5: Accounts Payable

**Goal:** Enable payment of vendors with approval workflows.

### 5.1 Vendor Management
- [ ] `Vendor` model:
  - `company_name`, `contact_name`, `email`, `phone`
  - `address`, `tax_id`
  - `is_1099_vendor`, `w9_on_file`
  - `insurance_expiration_date`, `insurance_verified`
  - `default_gl_account_id`
  - `management_company_id` (shared across associations)
- [ ] Vendor search and directory

### 5.2 Invoice Model
- [ ] `Invoice` model:
  - `vendor_id`, `association_id`
  - `invoice_number`, `invoice_date`, `due_date`
  - `total_amount`, `description`
  - `status` (Received, Data Entry, Pending Approval, Approved, Ready for Payment, Paid)
  - `action_item_id` (linked workflow)
- [ ] `InvoiceLineItem` model:
  - `invoice_id`, `gl_account_id`, `fund_id`
  - `description`, `amount`
- [ ] Invoice attachment support (PDF upload)

### 5.3 Approval Workflow (DBOS)
- [ ] `@dbos.workflow`: `invoice_approval`
  - Data entry step
  - Manager review
  - Board approval (if over threshold)
  - Final approval
  - Ready for payment
- [ ] Approval threshold configuration per Association
- [ ] Approval delegation rules

### 5.4 Payment Processing
- [ ] `VendorPayment` model:
  - `vendor_id`, `association_id`
  - `payment_date`, `amount`
  - `payment_method` (Check, ACH)
  - `check_number`, `bank_account_id`
  - `status` (Pending, Printed, Sent, Cleared, Voided)
- [ ] `PaymentInvoice` junction (one payment → many invoices)
- [ ] Check printing queue
- [ ] GL posting (Debit: Expense, Credit: Bank)

### 5.5 API Endpoints (Phase 5)
- [ ] CRUD: `/api/v1/vendors/`
- [ ] CRUD: `/api/v1/associations/{id}/invoices/`
- [ ] POST: `/api/v1/invoices/{id}/approve/`
- [ ] POST: `/api/v1/associations/{id}/payments/`
- [ ] GET: `/api/v1/associations/{id}/ap-aging/`

### 5.6 Frontend: AP Module
- [ ] Vendor directory
- [ ] Invoice entry form with line items
- [ ] Invoice approval queue
- [ ] Payment batch creation
- [ ] Check printing interface
- [ ] AP aging report

---

## Phase 6: CCR Enforcement (Violations & ARC)

**Goal:** Manage community rule enforcement and architectural review.

### 6.1 Violation Management
- [ ] `ViolationType` model:
  - `name` (Trash Cans, Lawn Maintenance, Parking, etc.)
  - `default_fine_amount`
  - `escalation_schedule` (JSON)
  - `association_id`
- [ ] `Violation` model:
  - `unit_id`, `violation_type_id`
  - `description`, `observed_date`, `reported_by`
  - `status` (Open, Courtesy Notice, 1st Fine, 2nd Fine, Hearing, Closed)
  - `action_item_id`
- [ ] `ViolationPhoto` model (evidence)

### 6.2 Violation Workflow (DBOS)
- [ ] `@dbos.workflow`: `violation_escalation`
  - Courtesy notice (14-day cure period)
  - 1st fine if not cured
  - 2nd fine escalation
  - Hearing scheduling
  - Resolution or attorney turnover
- [ ] Fine posting to Owner Ledger
- [ ] Letter generation (templates)

### 6.3 Architectural Review (ARC)
- [ ] `ARCRequestType` model:
  - `name` (Fence, Roof, Paint, Landscaping, etc.)
  - `required_documents` (JSON)
  - `association_id`
- [ ] `ARCRequest` model:
  - `unit_id`, `request_type_id`
  - `description`, `proposed_start_date`
  - `contractor_name`, `contractor_license`
  - `status` (Submitted, Under Review, Approved, Conditionally Approved, Denied)
  - `board_vote_date`, `conditions` (text)
  - `action_item_id`
- [ ] `ARCDocument` model (plans, photos)

### 6.4 ARC Workflow (DBOS)
- [ ] `@dbos.workflow`: `arc_review`
  - Submission validation
  - Manager preliminary review
  - Board review/vote
  - Decision notification
  - Compliance inspection (post-completion)

### 6.5 API Endpoints (Phase 6)
- [ ] CRUD: `/api/v1/associations/{id}/violations/`
- [ ] POST: `/api/v1/violations/{id}/escalate/`
- [ ] CRUD: `/api/v1/associations/{id}/arc-requests/`
- [ ] POST: `/api/v1/arc-requests/{id}/vote/`

### 6.6 Frontend: CCR Module
- [ ] Violation entry form with photo upload
- [ ] Violation tracking dashboard
- [ ] ARC request submission form
- [ ] ARC review queue (board view)
- [ ] Violation/ARC history per unit

---

## Phase 7: Homeowner Portal

**Goal:** Provide self-service capabilities for homeowners.

### 7.1 Portal Authentication
- [ ] Homeowner registration flow
- [ ] Email verification
- [ ] Password reset
- [ ] Portal access management (enable/disable)

### 7.2 Account & Ledger View
- [ ] Current balance display
- [ ] Ledger history (charges, payments)
- [ ] Statement download (PDF)
- [ ] Payment history

### 7.3 Payment Submission (UI Only - Integration Deferred)
- [ ] Payment form (amount, method selection)
- [ ] Saved payment methods (placeholder for future integration)
- [ ] Payment confirmation
- [ ] Auto-pay enrollment (configuration only)

### 7.4 ARC Request Submission
- [ ] Request type selection
- [ ] Form with required fields
- [ ] Document upload
- [ ] Request status tracking
- [ ] Decision notification view

### 7.5 Work Order Submission
- [ ] `WorkOrder` model:
  - `unit_id`, `association_id`
  - `category`, `description`
  - `priority`, `status`
  - `assigned_vendor_id`
  - `action_item_id`
- [ ] Work order form
- [ ] Status tracking

### 7.6 Communication
- [ ] View messages related to unit
- [ ] Submit inquiries (creates Action Item)
- [ ] Document library (community docs, bylaws)

### 7.7 Frontend: Homeowner Portal
- [ ] Separate SvelteKit route group (`/portal/`)
- [ ] Mobile-responsive design
- [ ] Dashboard (balance, recent activity)
- [ ] Ledger page
- [ ] Payment page
- [ ] ARC request page
- [ ] Work order page
- [ ] Messages/Documents page

---

## Phase 8: Board Portal

**Goal:** Provide board members with oversight and approval capabilities.

### 8.1 Board Authentication & Access
- [ ] Board member role assignment
- [ ] Board-specific permissions
- [ ] Multi-association board access (for board members on multiple HOAs)

### 8.2 Financial Oversight
- [ ] View-only financial reports
- [ ] Balance Sheet, Income Statement
- [ ] Budget vs Actual
- [ ] Bank account balances

### 8.3 Approval Workflows
- [ ] Invoice approval queue
- [ ] ARC request voting interface
- [ ] Violation hearing decisions
- [ ] Bulk approval support

### 8.4 Meeting Support
- [ ] Board meeting agenda builder (future)
- [ ] Resolution tracking (future)

### 8.5 Frontend: Board Portal
- [ ] Separate route group (`/board/`)
- [ ] Financial dashboard
- [ ] Approval queues
- [ ] Read-only unit/resident directory

---

## Phase 9: External Integrations

**Goal:** Connect to external services for payments, banking, and communications.

### 9.1 Payment Gateway Integration
- [ ] Stripe integration (credit card, ACH)
- [ ] Payment webhook handling
- [ ] Automatic ledger posting
- [ ] Refund processing
- [ ] PCI compliance considerations

### 9.2 Bank Integration
- [ ] Plaid integration (transaction download)
- [ ] Bank reconciliation workflow
- [ ] Lockbox file import (NACHA format)
- [ ] Positive Pay file export

### 9.3 Email Integration
- [ ] SendGrid integration
- [ ] Email template management
- [ ] Outbound email tracking
- [ ] Inbound email parsing (future)

### 9.4 SMS Integration
- [ ] Twilio integration
- [ ] SMS notification delivery
- [ ] Opt-in/opt-out management

### 9.5 Document Storage
- [ ] S3/Cloud storage integration
- [ ] Document categorization
- [ ] Retention policies

---

## Phase 10: Advanced Features & Polish

**Goal:** Enhance the platform with advanced capabilities.

### 10.1 Reporting Engine
- [ ] Custom report builder
- [ ] Scheduled report delivery
- [ ] Report templates library
- [ ] Export formats (PDF, Excel, CSV)

### 10.2 Bulk Operations
- [ ] Bulk unit import (CSV)
- [ ] Bulk resident import
- [ ] Bulk payment import
- [ ] Bulk violation creation (drive-by inspections)

### 10.3 Audit Trail
- [ ] Comprehensive audit logging
- [ ] Change history per entity
- [ ] Audit report generation

### 10.4 Search & Analytics
- [ ] Global search across entities
- [ ] Dashboard analytics
- [ ] KPI tracking (collection rate, response times)

### 10.5 Mobile Optimization
- [ ] Progressive Web App (PWA) support
- [ ] Offline capability for inspections
- [ ] Mobile-optimized workflows

---

## Appendix: Technology Checkpoints

### Morphir Evaluation (End of Phase 0)
- **Success Criteria:**
  - Types generate correctly for both Python and TypeScript
  - Build pipeline integrates smoothly with Bun
  - Developer experience is acceptable
- **Fallback:** OpenAPI 3.1 with code generation (openapi-generator)

### DBOS Validation (End of Phase 3)
- **Success Criteria:**
  - Workflows execute reliably
  - Sleep/timer functionality works for escalations
  - Introspection endpoint provides useful metadata
- **Fallback:** Temporal.io or custom state machine

### Performance Benchmarks (End of Phase 7)
- **Targets:**
  - API response time < 200ms (p95)
  - Ledger calculation < 500ms for 10-year history
  - Portal page load < 2s

---

## Dependency Graph

```
Phase 0 (Foundation)
    ↓
Phase 1 (Org Hierarchy) ──────────────────┐
    ↓                                      │
Phase 2 (GL/Fund Accounting)               │
    ↓                                      │
Phase 3 (AR/Assessments) ←─────────────────┤
    ↓                                      │
Phase 4 (Action Items) ←───────────────────┘
    ↓
┌───┴───┬───────────┐
↓       ↓           ↓
Phase 5 Phase 6     Phase 7
(AP)    (CCR)       (Homeowner Portal)
        ↓           ↓
        └─────┬─────┘
              ↓
        Phase 8 (Board Portal)
              ↓
        Phase 9 (Integrations)
              ↓
        Phase 10 (Advanced)
```

Phases 5, 6, and 7 can be developed in parallel after Phase 4 is complete.
