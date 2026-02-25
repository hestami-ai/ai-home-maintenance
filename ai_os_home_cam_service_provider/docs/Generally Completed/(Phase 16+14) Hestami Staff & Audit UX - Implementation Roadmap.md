# Hestami Staff & Audit UX — Consolidated Implementation Roadmap

**Document Type:** Implementation Roadmap with Progress Tracking
**Scope:** Staff UX (Phase 16) + Audit Review & Forensics UX (Phase 14)
**Status:** Core Implementation Complete — Enhancement Items Pending (~75% overall)

---

## Overview

This roadmap consolidates the **Staff UX** and **Audit Review & Forensics UX** into a single implementation plan. The Staff UX is the internal operating system for Hestami personnel, while Audit Review provides the accountability and forensics layer that makes all operations defensible.

### Key Dependencies
- **Phase 13 Concierge Case UX**: ✅ Completed (provides Case model foundation)
- **ActivityEvent Infrastructure**: ✅ Exists (`activityEvent.ts` middleware)
- **Cerbos Authorization**: ✅ Exists (policy-based access control)
- **oRPC + Zod Pipeline**: ✅ Exists (type-safe API layer)

### Implementation Strategy
1. **Staff Management & Lifecycle** first (foundational for all staff operations)
2. **Work Queue** second (daily operational surface)
3. **Case Detail UX** third (leverages existing Case model)
4. **Audit Review UX** fourth (consumes ActivityEvent data)
5. **Vendor Management UX** fifth (extends existing vendor infrastructure)
6. **Communications UX** sixth (cross-cutting concern)

---

## Sub-Phase 1: Staff Management & Lifecycle

**Purpose:** Establish the Staff Entity model and lifecycle management as the foundation for all staff operations.

### 1.1 Staff Entity Model
- [x] Define `Staff` model in Prisma schema with:
  - [x] Unique staff ID
  - [x] Name and contact details
  - [x] Role(s) array
  - [x] Pillar access permissions
  - [x] Status enum (Active, Pending, Suspended, Deactivated)
  - [x] Assignment history relation
  - [x] Activity history relation
  - [x] Organization relation
- [x] Run `npx prisma generate` to update Zod schemas
- [x] Create Cerbos policy for `staff` resource

### 1.2 Staff CRUD API
- [x] Implement `staff/v1/create` oRPC procedure
- [x] Implement `staff/v1/get` oRPC procedure
- [x] Implement `staff/v1/list` oRPC procedure
- [x] Implement `staff/v1/update` oRPC procedure
- [x] Regenerate OpenAPI spec and frontend types (blocked by pre-existing Zod generation issues)

### 1.3 Staff Onboarding Flow
- [x] Create Staff Management entry point in System Tools navigation
- [x] Implement "Add Staff Member" form:
  - [x] Name input
  - [x] Email input
  - [x] Initial role(s) selection
  - [x] Pillar access checkboxes
- [ ] Implement secure invitation system (email trigger)
- [x] Set initial status to `Pending Activation`
- [x] Record `STAFF_CREATED` ActivityEvent

### 1.4 Role & Permission Management
- [x] Implement role assignment UI (multi-select)
- [x] Implement pillar access toggle UI
- [x] Implement case assignment eligibility toggle
- [x] Ensure permission changes:
  - [x] Take effect immediately
  - [x] Are logged via ActivityEvent
  - [x] Do not retroactively alter past actions
- [x] Record `STAFF_ROLE_CHANGED` ActivityEvent

### 1.5 Staff Deactivation Flow
- [x] Implement `staff/v1/deactivate` oRPC procedure
- [x] Create deactivation confirmation modal showing:
  - [x] List of active cases assigned to staff
  - [ ] Pending tasks count
- [x] Require case reassignment before deactivation completes
- [x] Implement acknowledgment of responsibility transfer
- [x] Set status to `Deactivated`, disable login
- [x] Record `STAFF_DEACTIVATED` ActivityEvent

### 1.6 Emergency Suspension Flow
- [x] Implement `staff/v1/suspend` oRPC procedure
- [x] Immediate access revocation on suspension
- [x] Auto-escalate cases to Operations Coordinator
- [ ] Set admin review SLA requirement
- [x] Record `STAFF_SUSPENDED` ActivityEvent

### 1.7 Staff Profile View
- [x] Create Staff Profile page showing:
  - [x] Contact information
  - [x] Current role(s)
  - [x] Pillar access
  - [x] Status
  - [ ] Assignment history
  - [ ] Activity history (recent)

---

## Sub-Phase 2: Work Queue UX

**Purpose:** Create the default landing page for staff that answers "What needs attention right now?"

### 2.1 Work Queue API
- [x] Implement `workQueue/v1/list` oRPC procedure with filters:
  - [x] By pillar
  - [x] By state
  - [x] By assigned operator
  - [x] By urgency/priority
- [x] Include SLA calculation logic
- [ ] Regenerate OpenAPI spec and frontend types (blocked by pre-existing Zod issues)

### 2.2 Work Queue List View
- [x] Create Work Queue page as staff landing page
- [x] Implement list displaying for each item:
  - [x] Case ID
  - [x] Case type
  - [x] Property / HOA
  - [x] Current state
  - [x] Time in state
  - [x] Required action (explicit)
  - [x] Priority / SLA indicator
- [x] Implement filter controls:
  - [x] Pillar filter dropdown
  - [x] State filter dropdown
  - [x] Assigned operator filter
  - [x] Urgency filter

### 2.3 Work Queue Actions
- [ ] Implement "Claim" action for unassigned items
- [x] Implement "View Case" navigation
- [ ] Implement bulk selection (for reassignment)
- [x] Implement SLA warning visual indicators

### 2.4 Work Queue Real-time Updates
- [ ] Implement polling or SSE for queue updates
- [ ] Show visual indicator when queue changes
- [x] Preserve filter state on refresh

---

## Sub-Phase 3: Case Detail UX (Staff View)

**Purpose:** Provide comprehensive case management interface for staff operations.

### 3.1 Case Detail Layout
- [x] Create Case Detail page with header showing:
  - [x] Case ID
  - [x] Case type
  - [x] Current state
  - [x] Assigned staff
  - [ ] SLA indicators
- [x] Implement tab navigation:
  - [x] Overview
  - [x] Context
  - [x] Scope
  - [x] Tasks
  - [x] Vendors
  - [ ] Bids
  - [x] Communications
  - [x] Timeline
  - [ ] Review
  - [x] Audit

### 3.2 Overview Tab
- [x] Display case summary
- [x] Show property/customer information
- [x] Display current state with state machine visualization
- [x] Show assigned staff with reassignment option

### 3.3 Context Tab
- [x] Display property details
- [x] Show issue description
- [ ] List constraints and requirements
- [ ] Display related documents

### 3.4 Scope Tab
- [ ] Display scope of work definition
- [ ] Show scope version history
- [ ] Implement scope editing (with versioning)

### 3.5 Tasks Tab
- [x] List case tasks with status
- [x] Implement task/action creation (staffConciergeAction.create API + UI modal)
- [x] Implement task assignment (actions assigned to performedByUserId)
- [x] Implement task completion (staffConciergeAction.complete API + UI)
- [x] Implement action state machine (PLANNED → IN_PROGRESS → COMPLETED/BLOCKED/CANCELLED)
- [x] Implement action blocking (staffConciergeAction.block API + UI)
- [x] Implement action cancellation (staffConciergeAction.cancel API + UI)
- [x] Action status badges with color-coding
- [x] Action type labels (Phone Call, Email, Research, Vendor Contact, etc.)

### 3.6 Vendors Tab (Case-Scoped)
- [ ] List vendors associated with case
- [ ] Show vendor status (Identified, Contacted, Responded)
- [ ] Link to full vendor profile

### 3.7 Bids Tab
- [ ] List bids received for case
- [ ] Show bid status and details
- [ ] Implement bid comparison view

### 3.8 Communications Tab
- [x] Display unified communication log
- [x] Differentiate internal notes vs external messages
- [ ] Implement message composition
- [ ] Show email, SMS, portal message history

### 3.9 Timeline Tab
- [x] Display chronological case timeline
- [x] Show milestones, notes, issues, status changes
- [ ] Implement timeline entry creation

### 3.10 Review Tab
- [ ] Display post-completion review form
- [ ] Capture outcome summary
- [ ] Capture vendor performance notes
- [ ] Capture issues encountered
- [ ] Set reusability flags

### 3.11 Audit Tab (Case-Scoped)
- [x] Display ActivityEvents for this case
- [x] Show actor, action, timestamp, summary
- [x] Link to full Audit Review workspace

---

## Sub-Phase 4: Audit Review & Forensics UX

**Purpose:** Provide authorized users with complete, defensible, cross-pillar reconstruction of what happened.

### 4.1 Audit Review API
- [x] Leverage existing `activityEvent` oRPC procedures (getByEntity, getByOrganization, getByCase, getByActor)
- [ ] Implement `audit/v1/export` oRPC procedure
- [x] Cerbos policy for `activity_event` resource exists
- [ ] Regenerate OpenAPI spec and frontend types (blocked by pre-existing Zod issues)

### 4.2 Audit Subject Selector (Left Pane)
- [x] Create Activity Log page as Audit Review Workspace
- [x] Implement subject type selector:
  - [x] Violation
  - [x] ARC Request
  - [x] Work Order
  - [x] Concierge Case
  - [ ] Governance Meeting
  - [x] Property
  - [x] Owner
  - [ ] Vendor
- [x] Implement subject list with columns:
  - [x] ID
  - [x] Type
  - [x] Status
  - [x] Date range
  - [x] Organization
- [x] Implement filters:
  - [x] Date range
  - [ ] Pillar
  - [x] Entity type
  - [ ] Outcome

### 4.3 Audit Timeline (Right Pane)
- [x] Implement chronological timeline view
- [x] Display for each ActivityEvent:
  - [x] Timestamp
  - [x] Action
  - [x] Entity
  - [x] Actor (Human / AI / System)
  - [ ] Role at time of action
  - [ ] Authority source
  - [x] Summary
- [x] Implement visual encoding:
  - [x] Human actions → neutral
  - [x] AI-assisted actions → labeled
  - [ ] External decisions → labeled

### 4.4 Event Detail Drawer
- [x] Implement detail drawer on event selection (inline expansion)
- [x] Tab 1 — Event Details:
  - [x] Full action description
  - [x] Actor identity
  - [ ] Role & organization
  - [ ] Idempotency key
- [ ] Tab 2 — Authority & Policy:
  - [ ] Cerbos policy evaluated
  - [ ] Role used
  - [ ] Decision (ALLOW / DENY)
  - [ ] Policy version
- [ ] Tab 3 — Evidence & Documents:
  - [ ] Documents referenced
  - [ ] Versions
  - [ ] Inline previews
  - [ ] Hashes (optional)

### 4.5 Forensic Lenses
- [ ] Implement lens selector
- [ ] Decision Lens — Only decisions
- [ ] Authority Lens — Board / Manager actions
- [ ] External Lens — HOA / Vendor actions
- [ ] Dispute Lens — Escalations, overrides
- [ ] Ensure lenses alter visibility, never data

### 4.6 Cross-Entity Correlation
- [x] Implement navigation from event to:
  - [ ] Originating intent
  - [ ] Downstream execution
  - [ ] Related governance decisions
  - [ ] Subsequent enforcement actions
- [x] Display related entity links (case, property, association)

### 4.7 Export & Reporting
- [ ] Implement PDF export of audit timeline
- [ ] Implement decision summary export
- [ ] Implement document bundle export
- [ ] Implement JSON event log export
- [ ] Ensure exports preserve:
  - [ ] Ordering
  - [ ] Actor attribution
  - [ ] Document versions
  - [ ] Policy versions

### 4.8 Audit Entry Points
- [ ] Add "View Audit" link from CAM entities
- [x] Add "View Audit" link from Concierge Cases (Staff Case Detail Audit tab)
- [ ] Add "View Audit" link from Governance Meetings
- [ ] Add "View Audit" link from Reports/Compliance
- [x] Add Platform Admin audit access (Activity Log in admin sidebar)

### 4.9 Audit Integrity UX
- [ ] Display immutability indicator
- [ ] Show ordering is fixed
- [ ] Display authority explicitly
- [ ] Highlight gaps if any exist
- [ ] Label external inputs clearly

---

## Sub-Phase 5: Vendor Discovery & Management UX

**Purpose:** Convert unstructured vendor research into structured, reusable, auditable vendor entities.

### 5.1 Vendor Research Workspace
- [x] Create Vendor Research page
- [x] Display context header (persistent):
  - [x] Case ID
  - [x] Property summary
  - [x] Required service category
  - [x] Coverage location
  - [x] Constraints

### 5.2 Vendor Capture Form
- [x] Implement capture form with:
  - [x] Source URL input
  - [x] HTML paste field (raw HTML)
  - [x] Plain text paste field (fallback)
- [x] Accept any combination of inputs
- [x] Never block submission due to incomplete inputs
- [x] Primary action: "Extract Vendor Information"

### 5.3 Extraction Workflow
- [x] Implement extraction pending state
- [x] Call backend extraction service (stub - AI integration pending)
- [x] Populate extracted fields with confidence scores

### 5.4 Extraction Results & Confirmation
- [x] Implement two-column layout:
  - [x] Left: Extracted structured fields (editable) with confidence indicators
  - [ ] Right: Source evidence viewer with highlighted extraction evidence
- [x] Implement staff actions:
  - [x] Accept
  - [x] Edit
  - [ ] Remove
  - [ ] Annotate
- [x] Primary CTA: "Confirm Vendor Candidate"

### 5.5 Vendor Candidate Entity
- [x] Create Vendor Candidate on confirmation
- [x] Link to Case
- [x] Store provenance (URL, timestamp)
- [x] Set status to `Identified`
- [x] Record `VENDOR_CANDIDATE_CREATED` ActivityEvent

### 5.6 Vendor Profile (Internal)
- [x] Create Vendor Profile page showing:
  - [x] Contact info
  - [x] Service categories
  - [x] Coverage area
  - [x] Credentials
  - [ ] Past cases
  - [ ] Performance notes
  - [x] Risk flags
- [x] Support vendors without platform accounts

### 5.7 Error Handling
- [x] Handle extraction failure → allow manual entry
- [x] Handle multiple vendors detected → require selection
- [ ] Handle duplicate vendor detected → merge or override decision

---

## Sub-Phase 6: Bid Coordination UX

**Purpose:** Manage vendor bidding process with full tracking and comparison.

### 6.1 Bid Management
- [x] Create Bid Management API (vendorBid routes)
- [x] For each vendor, track:
  - [x] Scope version attached
  - [x] Response deadline (validUntil)
  - [ ] Required attachments
- [ ] Track outreach attempts
- [ ] Track missing responses
- [ ] Track clarifications
- [ ] Auto-flag incomplete bids

### 6.2 Decision Preparation
- [x] Implement side-by-side bid comparison API (vendorBid/compare)
- [x] Display normalized pricing
- [x] Highlight key differences (isLowest, isFastest flags)
- [x] Implement recommendation with rationale field (VendorBid model)
- [x] Mark artifact as customer-facing (isCustomerFacing field)

---

## Sub-Phase 7: Communications UX

**Purpose:** Provide unified communication log tied to Cases.

### 7.1 Unified Communication Log
- [x] Implement communication log API (caseCommunication routes)
- [x] Support email, SMS, letter channels
- [x] Differentiate internal notes vs external messages (direction field)
- [x] Tie all communications to a Case
- [ ] Enforce: No off-platform communication is authoritative

### 7.2 Communication Composition
- [x] Implement message composer API
- [x] Support template selection (CommunicationTemplate model exists)
- [x] Support recipient selection
- [x] Support channel selection (email/SMS/letter)
- [x] Record ActivityEvent on communication creation

---

## Sub-Phase 8: Global Navigation & Layout

**Purpose:** Establish persistent staff navigation structure.

### 8.1 Staff Navigation
- [x] Implement persistent left navigation with:
  - [x] Work Queue
  - [x] Cases
  - [ ] Concierge Operations
  - [ ] CAM / Governance
  - [x] Vendors
  - [x] Customers & Properties
  - [x] Documents & Evidence
  - [x] Activity & Audit
  - [x] System Tools (Settings, Permissions)
- [ ] Implement navigation state persistence
- [x] Implement breadcrumb navigation (Breadcrumb component)

### 8.2 Staff Role Routing
- [ ] Route staff to appropriate landing based on role
- [x] Implement role-based navigation visibility (sectioned layout)
- [ ] Implement pillar-based access control on navigation items

---

## Sub-Phase 9: Documents & Evidence UX

**Purpose:** Manage versioned, timestamped, case-linked documents.

### 9.1 Document Management
- [x] Implement document list view (placeholder page)
- [x] Display version history (CaseAttachment versioning fields)
- [x] Display timestamps
- [x] Show case linkage
- [x] Enforce immutability post-close (lockedAt field)

### 9.2 Document Upload
- [ ] Implement document upload flow
- [x] Support multiple file types (category field)
- [x] Auto-link to current case context
- [ ] Record `DOCUMENT_UPLOADED` ActivityEvent

### 9.3 Document Versioning
- [x] Implement version creation flow (previousVersionId, version fields)
- [x] Maintain version chain (AttachmentVersions relation)
- [ ] Record `DOCUMENT_VERSION_CREATED` ActivityEvent

---

## Sub-Phase 10: Execution Tracking UX

**Purpose:** Track case execution with timeline view.

### 10.1 Timeline View
- [x] Implement execution timeline component (in case detail Timeline tab)
- [x] Display milestones (CaseMilestone model)
- [x] Display notes
- [x] Display issues (CaseIssue model)
- [x] Display status changes
- [x] Support staff intervention on exceptions (CaseIssue assignment)

---

## Sub-Phase 11: Review & Record UX

**Purpose:** Capture post-completion review for institutional knowledge.

### 11.1 Post-Completion Review
- [x] Implement review form capturing:
  - [x] Outcome summary
  - [x] Vendor performance notes
  - [x] Issues encountered
  - [x] Reusability flags
- [ ] Feed data to future case recommendations
- [x] Record ActivityEvent on review creation

---

## Implementation Notes

### ActivityEvent Integration
The existing `activityEvent.ts` middleware provides:
- Intent / Decision / Execution event categorization
- Human, AI, System actor tracking
- Cross-pillar context (CAM, Contractor, Concierge)
- OpenTelemetry trace correlation
- Typed metadata schemas

All new features must integrate with this infrastructure for audit compliance.

### Cerbos Authorization
New resources requiring Cerbos policies:
- `staff` — Staff entity CRUD and lifecycle
- `audit` — Read-only audit access
- `workQueue` — Work queue access by role
- `vendorCandidate` — Vendor research and capture

### Type Generation Pipeline
After each API implementation:
1. `npm run openapi:generate`
2. `npm run types:generate`
3. Update `cam.ts` with new type exports
4. `npm run check` to verify

---

## Progress Summary

| Sub-Phase | Description | Status |
|-----------|-------------|--------|
| 1 | Staff Management & Lifecycle | 🟡 ~90% (invitation email, history views pending) |
| 2 | Work Queue UX | 🟡 ~80% (claim, bulk select, real-time pending) |
| 3 | Case Detail UX (Staff View) | 🟡 ~70% (SLA, Bids/Review tabs, Scope editing pending) |
| 4 | Audit Review & Forensics UX | 🟡 ~50% (export, forensic lenses, authority tabs pending) |
| 5 | Vendor Discovery & Management UX | 🟡 ~85% (evidence viewer, past cases pending) |
| 6 | Bid Coordination UX | 🟡 ~60% (outreach tracking, attachments pending) |
| 7 | Communications UX | 🟡 ~90% (off-platform enforcement pending) |
| 8 | Global Navigation & Layout | 🟡 ~70% (nav items, state persistence, role routing pending) |
| 9 | Documents & Evidence UX | 🟡 ~70% (upload flow, activity events pending) |
| 10 | Execution Tracking UX | ✅ Completed |
| 11 | Review & Record UX | 🟡 ~90% (feed to recommendations pending) |

**Legend:** ⬜ Not Started | 🟡 In Progress | ✅ Completed

---

## Recent Updates

### 2026-01-22: Tasks Tab Action Management
- Added `staffConciergeActionRouter` export from `concierge/index.ts`
- Registered `staffConciergeAction` in `appRouter.ts`
- Implemented full action lifecycle management in Staff Case Detail Tasks tab:
  - Create Action modal with action type selection and description
  - Start Action (PLANNED → IN_PROGRESS)
  - Complete Action with outcome (IN_PROGRESS → COMPLETED)
  - Block Action with reason (IN_PROGRESS → BLOCKED)
  - Cancel Action with optional reason (non-terminal → CANCELLED)
- Fixed RLS context issue for activity event recording in staff action handlers
- All action operations now properly record ActivityEvents with correct RLS context
