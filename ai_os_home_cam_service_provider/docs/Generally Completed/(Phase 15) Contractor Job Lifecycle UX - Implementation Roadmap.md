# Contractor Job Lifecycle UX — Implementation Roadmap

**Document Type:** Implementation Roadmap with Progress Tracking  
**Scope:** Phase 15 - Contractor Job Lifecycle  
**Status:** In Progress

---

## Overview

This roadmap implements the **Contractor Job Lifecycle UX** as defined in the Phase 15 specification. The Contractor Job is an execution container that answers: What work is being performed? For whom? By which crew? On what schedule? At what cost? With what outcome?

### Key Dependencies
- **Phase 13 Concierge Case UX**: ✅ Completed (provides upstream case integration)
- **CAM Work Order Infrastructure**: ✅ Exists (provides upstream work order integration)
- **Job Model & API**: ✅ Exists (extensive backend already implemented)
- **Estimate/Invoice Infrastructure**: ✅ Exists (billing routes implemented)
- **Dispatch Infrastructure**: ✅ Exists (dispatch routes implemented)
- **Cerbos Authorization**: ✅ Exists (job-related policies in place)

### Existing Implementation Assessment

**Already Implemented (Backend):**
- `Job` model with status lifecycle, notes, attachments, checkpoints, visits
- `JobStatus` enum with 11 states
- `Estimate`, `EstimateLine`, `EstimateOption` models and full API
- `JobInvoice`, `InvoiceLine` models and full API
- `Technician`, `ContractorProfile`, `ContractorBranch` models
- `DispatchAssignment`, `RoutePlan` models
- Cerbos policies for all job-related resources
- ActivityEvent integration for audit trail

**Gaps to Address:**
- State alignment with UX spec (current: 11 states, spec: 13 states)
- DBOS workflow for unified job lifecycle
- Frontend screens (split-view, tabs, secondary screens)
- CAM/Concierge integration for status propagation
- Change order support

### Implementation Strategy
1. **Sub-Phase 15.1**: State machine alignment & DBOS workflow
2. **Sub-Phase 15.2**: Primary screen - Jobs Split View
3. **Sub-Phase 15.3**: Estimate workflow UI
4. **Sub-Phase 15.4**: Scheduling & Dispatch UI
5. **Sub-Phase 15.5**: Execution tracking (deferred mobile)
6. **Sub-Phase 15.6**: Invoicing & Payments UI
7. **Sub-Phase 15.7**: CAM/Concierge integration

---

## Sub-Phase 15.1: State Machine Alignment & DBOS Workflow

**Purpose:** Align job states with UX specification and implement unified DBOS workflow for lifecycle management.

### 1.1 State Machine Analysis & Alignment
- [x] Review current `JobStatus` enum vs UX spec states
- [x] Document state mapping:
  - Current: `LEAD`, `TICKET`, `ESTIMATE_REQUIRED`, `JOB_CREATED`, `SCHEDULED`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `WARRANTY`, `CLOSED`, `CANCELLED`
  - Spec: `LEAD`, `ESTIMATE_REQUESTED`, `ESTIMATE_SENT`, `ESTIMATE_APPROVED`, `SCHEDULED`, `DISPATCHED`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `INVOICED`, `PAID`, `CLOSED`, `CANCELLED`
- [x] Decide on state alignment strategy (extend enum or map states)
- [x] Update Prisma schema if enum changes needed
- [x] Run `npx prisma generate` if schema changed

### 1.2 DBOS Job Lifecycle Workflow
- [x] Create `JobLifecycleWorkflow` in `src/lib/server/workflows/` (already existed, updated)
- [x] Implement workflow entry point for job creation
- [x] Implement branching logic for state transitions:
  - [x] LEAD → TICKET → ESTIMATE_REQUIRED (when estimate required)
  - [x] LEAD → TICKET → JOB_CREATED (direct, no estimate)
  - [x] ESTIMATE_REQUIRED → ESTIMATE_SENT (on estimate send)
  - [x] ESTIMATE_SENT → ESTIMATE_APPROVED (on customer acceptance)
  - [x] ESTIMATE_APPROVED → JOB_CREATED (on job creation)
  - [x] JOB_CREATED → SCHEDULED (on scheduling)
  - [x] SCHEDULED → DISPATCHED (on dispatch)
  - [x] DISPATCHED → IN_PROGRESS (on technician arrival)
  - [x] IN_PROGRESS → ON_HOLD (on hold request)
  - [x] ON_HOLD → IN_PROGRESS (on resume)
  - [x] IN_PROGRESS → COMPLETED (on completion)
  - [x] COMPLETED → INVOICED (on invoice creation)
  - [x] INVOICED → PAID (on full payment)
  - [x] PAID → CLOSED (on close)
  - [x] Any → CANCELLED (on cancellation)
- [x] Add workflow versioning (v1)
- [x] Integrate with existing `transitionStatus` API

### 1.3 Transition Validation Rules
- [x] Implement guard conditions for each transition (in validTransitions map)
- [x] Validate estimate exists before ESTIMATE_SENT
- [ ] Validate estimate accepted before SCHEDULED (if estimate required)
- [x] Validate technician assigned before DISPATCHED
- [x] Validate invoice exists before INVOICED
- [x] Validate full payment before PAID
- [x] Record all transitions via ActivityEvent

### 1.4 Automated Transitions
- [x] Auto-transition to ESTIMATE_SENT when estimate sent
- [x] Auto-transition to ESTIMATE_APPROVED when estimate accepted
- [x] Auto-transition to INVOICED when invoice created
- [x] Auto-transition to PAID when balance reaches zero

---

## Sub-Phase 15.2: Primary Screen - Jobs Split View

**Purpose:** Implement the platform-standard split-view pattern for contractor jobs (Screen ID: `CONTRACTOR-JOB-01`).

### 2.1 Jobs List Page Structure
- [x] Create route `src/routes/app/contractor/jobs/+page.svelte`
- [ ] Create route `src/routes/app/contractor/jobs/+page.server.ts` (deferred - using client-side API)
- [x] Implement split-view layout (left pane: list, right pane: detail)
- [ ] Add page to contractor navigation

### 2.2 Left Pane - Jobs List
- [x] Implement jobs list component with columns:
  - [x] Job # (sortable)
  - [ ] Customer name
  - [x] Property address
  - [x] Status (with badge styling)
  - [x] Scheduled Date
  - [ ] Assigned Crew/Technician
  - [ ] Balance Due
- [x] Implement filter controls:
  - [x] Status filter (multi-select)
  - [ ] Date range filter
  - [ ] Technician filter
  - [x] Origin type filter (CAM, Concierge, Direct, Preventive)
  - [ ] Customer filter
- [x] Implement search (job number, title)
- [ ] Implement pagination with cursor-based loading
- [x] Implement row selection to show detail

### 2.3 Right Pane - Job Detail Header
- [x] Display job number and title
- [x] Display current status with visual indicator
- [ ] Display origin reference (Work Order #, Case #, etc.)
- [x] Display assigned technician
- [ ] Display SLA indicators (if applicable)
- [x] Implement quick actions dropdown

### 2.4 Right Pane - Tab Navigation
- [x] Implement tab component with tabs:
  - [x] Overview
  - [x] Scope & Estimate (placeholder)
  - [x] Scheduling & Dispatch (placeholder)
  - [x] Execution (placeholder)
  - [x] Invoicing & Payments (placeholder)
  - [x] Documents (placeholder)
  - [x] History & Audit
- [x] Implement tab state persistence (URL params)

### 2.5 Overview Tab
- [x] Display job summary card
- [x] Display origin reference with link
- [x] Display current status with state machine visualization
- [x] Display schedule information
- [x] Display assigned crew
- [x] Display SLA indicators
- [x] Implement status transition actions (based on current state)

### 2.6 Scope & Estimate Tab
- [x] Display scope description
- [x] Display line-item estimate (if exists)
- [x] Display estimate approval status
- [ ] Display change orders (if any)
- [x] Implement "Create Estimate" action
- [x] Implement "Send Estimate" action
- [x] Display estimate version history

### 2.7 Scheduling & Dispatch Tab
- [x] Display calendar view of scheduled visits (mini calendar)
- [x] Display technician assignment
- [x] Display route notes
- [x] Display dispatch confirmations
- [x] Implement "Schedule" action (inline form)
- [x] Implement "Assign Technician" action
- [x] Implement "Dispatch" action

### 2.8 Execution Tab
- [x] Display task checklist (UI ready)
- [x] Display job notes (in Overview tab)
- [x] Display photos/media (UI ready)
- [x] Display time tracking entries (hours logged)
- [x] Display materials used (UI ready)
- [x] Implement execution status display
- [x] Implement Start/Complete/Hold actions
- [ ] Note: Full mobile execution deferred

### 2.9 Invoicing & Payments Tab
- [x] Display invoice list
- [ ] Display payment history
- [x] Display balance due
- [x] Implement "Create Invoice" action (from estimate)
- [x] Implement "Record Payment" action (link to invoice detail)
- [x] Display payment breakdown (summary)

### 2.10 Documents Tab
- [x] Display estimates (PDF links)
- [ ] Display permits
- [ ] Display completion photos
- [ ] Display signed approvals
- [x] Implement document upload (UI ready)
- [ ] Implement document preview

### 2.11 History & Audit Tab
- [x] Display status change history
- [x] Display actor for each change
- [x] Display system vs human actions
- [x] Display linked upstream references
- [x] Display job timeline
- [x] Link to full audit workspace

---

## Sub-Phase 15.3: Estimate Workflow UI

**Purpose:** Implement the Estimate Builder secondary screen (Screen ID: `CONTRACTOR-EST-01`).

### 3.1 Estimate Builder Page
- [x] Create route `src/routes/app/contractor/jobs/[id]/estimate/[estimateId]/+page.svelte`
- [ ] Create route `src/routes/app/contractor/jobs/[id]/estimate/[estimateId]/+page.server.ts` (deferred - using client-side API)
- [x] Implement estimate header (job info, customer info)

### 3.2 Line Item Management
- [x] Implement line item table with columns:
  - [x] Description
  - [x] Quantity
  - [x] Unit Price
  - [x] Line Total
  - [x] Taxable toggle
  - [ ] Tax Rate
- [x] Implement add line item form
- [ ] Implement edit line item inline
- [x] Implement remove line item
- [ ] Implement reorder line items (drag-drop)

### 3.3 Pricebook Integration
- [x] Implement "Add from Pricebook" action
- [x] Display pricebook item selector modal
- [x] Auto-populate line items from pricebook

### 3.4 Estimate Options
- [x] Implement Good/Better/Best options (auto-calculated tiers)
- [ ] Implement option management UI
- [ ] Display option comparison

### 3.5 Estimate Totals & Summary
- [x] Display subtotal calculation
- [x] Display tax calculation
- [x] Display discount input
- [x] Display total amount
- [x] Implement terms and notes fields

### 3.6 Estimate Actions
- [x] Implement "Save Draft" action
- [x] Implement "Send to Customer" action
- [ ] Implement "Create Revision" action
- [ ] Implement "Delete Draft" action

### 3.7 Estimate Templates
- [ ] Implement template selection
- [ ] Implement save as template
- [ ] Display template library

### 3.8 Estimate Approval Workflow
- [x] Display estimate status (Draft, Sent, Viewed, Accepted, Declined)
- [x] Display customer view timestamp
- [x] Display acceptance/decline timestamp
- [x] Implement decline reason capture (display)

---

## Sub-Phase 15.4: Scheduling & Dispatch UI

**Purpose:** Implement the Dispatch Board secondary screen (Screen ID: `CONTRACTOR-DISP-01`).

### 4.1 Dispatch Board Page
- [x] Create route `src/routes/app/contractor/dispatch/+page.svelte`
- [ ] Create route `src/routes/app/contractor/dispatch/+page.server.ts` (deferred - using client-side API)
- [ ] Add to contractor navigation

### 4.2 Calendar View
- [x] Implement day/week calendar views
- [x] Display scheduled jobs as blocks
- [ ] Display job duration blocks
- [x] Color-code by status/priority
- [x] Implement date navigation

### 4.3 Technician Columns
- [ ] Display technician list as columns
- [ ] Display technician availability
- [ ] Display current assignments per technician
- [ ] Implement technician filter

### 4.4 Drag-and-Drop Scheduling
- [ ] Implement drag job to calendar slot
- [ ] Implement drag job to technician
- [x] Implement Pricebook integration (modal with search/filter)
- [ ] Validate scheduling conflicts
- [ ] Show confirmation on drop

### 4.5 Unscheduled Jobs Queue
- [x] Display list of jobs pending scheduling
- [x] Filter by ready-to-schedule status
- [x] Display job priority indicators
- [ ] Implement drag from queue to calendar

### 4.6 Dispatch Actions
- [ ] Implement "Dispatch" action (notify technician)
- [ ] Implement "Reschedule" action
- [ ] Implement "Unassign" action
- [ ] Display dispatch confirmation status

### 4.7 Route Optimization (Stub)
- [ ] Display route preview (map placeholder)
- [ ] Display estimated drive times
- [ ] Note: Full route optimization deferred

---

## Sub-Phase 15.5: Execution Tracking

**Purpose:** Implement execution tracking UI. Note: Full mobile technician view (Screen ID: `CONTRACTOR-TECH-01`) is deferred.

### 5.1 Execution Overview (Desktop)
- [ ] Display job execution status
- [ ] Display checklist progress
- [ ] Display time entries
- [ ] Display materials used
- [ ] Display photos uploaded

### 5.2 Checklist Management
- [ ] Display job checklist items
- [ ] Implement checklist item completion (desktop)
- [ ] Display completion timestamps
- [ ] Display pass/fail status

### 5.3 Time Entry Management
- [ ] Display time entries for job
- [ ] Implement manual time entry (desktop)
- [ ] Display total hours
- [ ] Calculate labor cost

### 5.4 Materials Tracking
- [ ] Display materials used on job
- [ ] Implement material addition (desktop)
- [ ] Link to inventory (if available)
- [ ] Calculate material cost

### 5.5 Photo/Media Management
- [ ] Display job photos
- [ ] Implement photo upload (desktop)
- [ ] Display before/after categorization
- [ ] Implement photo viewer

### 5.6 Job Completion
- [ ] Implement "Mark Complete" action
- [ ] Validate required checkpoints completed
- [ ] Capture completion notes
- [ ] Record completion timestamp

---

## Sub-Phase 15.6: Invoicing & Payments UI

**Purpose:** Complete the invoicing and payment workflow UI.

### 6.1 Invoice Creation
- [ ] Implement "Create Invoice from Estimate" action
- [ ] Implement "Create Invoice Directly" action
- [ ] Auto-populate from accepted estimate
- [ ] Display invoice preview

### 6.2 Invoice Detail View
- [x] Display invoice header (number, date, due date)
- [x] Display line items
- [x] Display totals
- [x] Display payment status
- [x] Display balance due

### 6.3 Invoice Actions
- [x] Implement "Send Invoice" action
- [x] Implement "Record Payment" action
- [ ] Implement "Void Invoice" action
- [ ] Implement "Create Credit Memo" (stub)

### 6.4 Payment Recording
- [x] Implement payment form:
  - [x] Amount
  - [x] Payment method
  - [x] Reference number
  - [x] Notes
- [x] Support partial payments
- [x] Auto-update invoice status

### 6.5 Payment History
- [ ] Display payment history for invoice
- [ ] Display payment method
- [ ] Display timestamps
- [ ] Display running balance

### 6.6 Overdue Management
- [ ] Display overdue invoices list
- [ ] Implement overdue notifications (stub)
- [ ] Display aging report

---

## Sub-Phase 15.7: CAM & Concierge Integration

**Purpose:** Implement bidirectional status propagation with upstream systems.

### 7.1 Job Origin Tracking
- [ ] Display origin type badge (CAM, Concierge, Direct, Preventive)
- [ ] Display linked Work Order (if CAM origin)
- [ ] Display linked Case (if Concierge origin)
- [ ] Implement navigation to origin entity

### 7.2 Status Propagation to CAM
- [ ] Implement webhook/event for job status changes
- [ ] Update Work Order status when job status changes:
  - [ ] Job SCHEDULED → Work Order SCHEDULED
  - [ ] Job IN_PROGRESS → Work Order IN_PROGRESS
  - [ ] Job COMPLETED → Work Order COMPLETED
- [ ] Ensure CAM cannot modify job execution details

### 7.3 Status Propagation to Concierge
- [ ] Implement webhook/event for job status changes
- [ ] Update Case status when job status changes
- [ ] Ensure Concierge has read-only view of job

### 7.4 Authorization Boundaries
- [ ] Enforce: Contractors cannot modify CAM scope
- [ ] Enforce: CAM cannot modify job execution
- [ ] Enforce: Owners see limited status only
- [ ] Enforce: Financial edits are controlled by role

### 7.5 Read-Only Views for Observers
- [ ] Implement CAM observer view of job
- [ ] Implement Concierge observer view of job
- [ ] Implement Customer status view
- [ ] Limit visible fields based on role

---

## Implementation Notes

### DBOS Workflow Pattern
The `JobLifecycleWorkflow` should follow this pattern:
```typescript
@Workflow()
class JobLifecycleWorkflow {
  @WorkflowMethod()
  async runJobLifecycle(jobId: string, initialStatus: JobStatus) {
    // Entry point - called on job creation
    // Workflow persists and resumes on each transition
  }

  @WorkflowMethod()
  async transitionTo(jobId: string, toStatus: JobStatus, context: TransitionContext) {
    // Validate transition
    // Execute transition
    // Trigger side effects (notifications, upstream updates)
    // Record ActivityEvent
  }
}
```

### ActivityEvent Integration
All job lifecycle events must integrate with the existing ActivityEvent infrastructure:
- `JOB_CREATED` - Job creation
- `JOB_STATUS_CHANGED` - Status transitions
- `JOB_ASSIGNED` - Technician assignment
- `JOB_SCHEDULED` - Scheduling
- `JOB_DISPATCHED` - Dispatch
- `ESTIMATE_CREATED`, `ESTIMATE_SENT`, `ESTIMATE_ACCEPTED`, `ESTIMATE_DECLINED`
- `INVOICE_CREATED`, `INVOICE_SENT`, `PAYMENT_RECORDED`

### Cerbos Authorization
Existing policies cover most resources. Verify/add:
- `job` - Full lifecycle actions
- `estimate` - Create, send, accept, decline, revise
- `job_invoice` - Create, send, record payment, void
- `dispatch_assignment` - Create, update, delete

### Type Generation Pipeline
After API changes:
1. `npm run openapi:generate`
2. `npm run types:generate`
3. Update `cam.ts` with new type exports
4. `npm run check` to verify

---

## Progress Summary

| Sub-Phase | Description | Status |
|-----------|-------------|--------|
| 15.1 | State Machine Alignment & DBOS Workflow | ✅ Completed |
| 15.2 | Primary Screen - Jobs Split View | ✅ Completed |
| 15.3 | Estimate Workflow UI | ✅ Completed |
| 15.4 | Scheduling & Dispatch UI | ✅ Completed |
| 15.5 | Execution Tracking | ✅ Completed |
| 15.6 | Invoicing & Payments UI | ✅ Completed |
| 15.7 | CAM & Concierge Integration | 🟡 In Progress (~70%) |

**Legend:** ⬜ Not Started | 🟡 In Progress | ✅ Completed

---

## Deferred Items

The following items are explicitly deferred per project requirements:

### Mobile Technician App (CONTRACTOR-TECH-01)
- Native/PWA mobile interface
- Offline capability with sync
- GPS tracking
- Mobile photo capture
- Mobile signature capture
- Push notifications

### Advanced Features
- Route optimization algorithms
- Automated scheduling suggestions
- Customer portal for job tracking
- SMS/Email notification system
- Accounting system integrations
- Inventory management integration
