# Phase 13: Concierge Case UX — Implementation Roadmap

## Overview

This roadmap tracks the implementation of the Concierge Case UX as defined in `(Phase 13) Concierge Case UX (Primary Workspace).md`. The backend infrastructure is largely complete; the primary work is frontend implementation and minor backend enhancements.

**Reference Documents:**
- `(Phase 13) Concierge Case UX (Primary Workspace).md` — UX specification
- `Hestami AI OS Context Key.md` — Platform architecture
- `Hestami AI Developer Agent - Onboarding Package.md` — Development guidelines

---

## Status Mapping (Approved)

| UX Spec State | Prisma State | Implementation |
|---------------|--------------|----------------|
| `INTAKE` | `INTAKE` | Direct match |
| `CLARIFYING` | `PENDING_OWNER` | Use `CaseNote.noteType = 'CLARIFICATION_REQUEST'` |
| `UNDER_REVIEW` | `ASSESSMENT` | Direct match |
| `WAITING_EXTERNAL` | `PENDING_EXTERNAL` | Direct match |
| `DECISION_MADE` | `ASSESSMENT` | Track via `MaterialDecision` record |
| `ACTION_IN_PROGRESS` | `IN_PROGRESS` | Direct match |
| `RESOLVED` | `RESOLVED` | Direct match |
| `CLOSED` | `CLOSED` | Direct match |
| `WITHDRAWN` | `CANCELLED` | Use `cancelReason` to indicate withdrawal |

**Additional Prisma States (retained):**
- `PENDING_OWNER` — Waiting on owner (broader than just clarification)
- `ON_HOLD` — Temporary pause

---

## Implementation Phases

### Phase 13.1: Schema Enhancements ✅
**Goal:** Add `noteType` field to `CaseNote` for clarification tracking.

- [x] **13.1.1** Add `noteType` enum to Prisma schema
  ```prisma
  enum CaseNoteType {
    GENERAL
    CLARIFICATION_REQUEST
    CLARIFICATION_RESPONSE
    DECISION_RATIONALE
  }
  ```
- [x] **13.1.2** Add `noteType` field to `CaseNote` model with default `GENERAL`
- [x] **13.1.3** Run `npx prisma generate` to update Zod schemas
- [x] **13.1.4** Create and run migration (`20251218223705_add_case_note_type`)
- [x] **13.1.5** Update `conciergeCase.ts` routes to support `noteType` in `addNote` and `listNotes`

---

### Phase 13.2: Backend API Enhancements ✅
**Goal:** Add missing endpoints and enhance existing ones for UX requirements.

- [x] **13.2.1** Add `requestClarification` endpoint (creates note + transitions to `PENDING_OWNER`)
- [x] **13.2.2** Add `respondToClarification` endpoint (owner submits response)
- [x] **13.2.3** Add `getDetail` endpoint with full aggregated data for split view:
  - Case details
  - Property context
  - Origin intent (if exists)
  - Status history
  - Notes (with types)
  - Participants
  - Actions
  - Decisions
  - Documents/Attachments
  - Linked entities (Unit, Job, ARC, Work Order)
- [x] **13.2.4** Add `linkToArc` endpoint for CAM ARC linkage
- [x] **13.2.5** Add `linkToWorkOrder` endpoint for CAM Work Order linkage
- [x] **13.2.6** Update Cerbos policy for new endpoints (`request_clarification`, `respond_clarification`, `link_arc`, `link_work_order`)
- [x] **13.2.7** Add `linkedArcRequestId` and `linkedWorkOrderId` fields to ConciergeCase schema
- [x] **13.2.8** Add `REQUEST_INFO`, `RESPOND`, `LINK` to ActivityActionType enum
- [x] **13.2.9** Update `cam.ts` API client with new endpoints and types

---

### Phase 13.3: Owner Portal Routes (`/app/owner/cases`) ✅
**Goal:** Implement owner-facing case views.

#### Route Structure
```
/app/owner/
├── +layout.svelte            # Owner portal layout with navigation
├── +page.svelte              # Owner dashboard
├── cases/
│   ├── +page.svelte          # Case list (owner's cases only)
│   ├── new/
│   │   └── +page.svelte      # Case creation form (CONCIERGE-CASE-02)
│   └── [id]/
│       └── +page.svelte      # Case detail view with clarification response
```

- [x] **13.3.1** Create `/app/owner/+layout.svelte` — Owner portal layout with navigation
- [x] **13.3.2** Create `/app/owner/+page.svelte` — Owner dashboard with quick stats
- [x] **13.3.3** Create `/app/owner/cases/+page.svelte` — Owner case list with filters
- [x] **13.3.4** Create `/app/owner/cases/new/+page.svelte` — Case creation form
  - Title and description fields
  - Property selection
  - Priority selection
  - Attachments placeholder
- [x] **13.3.5** Create `/app/owner/cases/[id]/+page.svelte` — Owner case detail view
  - Overview, Timeline, Documents, Participants tabs
  - Clarification response UI when status is PENDING_OWNER
  - Status badges and case metadata

---

### Phase 13.4: Concierge Portal Routes (`/app/concierge/cases`) ✅
**Goal:** Implement concierge staff case management views.

#### Route Structure
```
/app/concierge/
├── cases/
│   ├── +page.svelte          # Split view: Case list + detail (CONCIERGE-CASE-01)
│   └── [id]/
│       └── +page.svelte      # Full-page case detail with management
```

- [x] **13.4.1** Create `/app/concierge/cases/+page.svelte` — Split view with ListPanel/DetailPanel
  - Case list with status filters and search
  - Quick detail preview in right pane
  - Status indicators and attention badges
- [x] **13.4.2** Create `/app/concierge/cases/[id]/+page.svelte` — Full case management view
  - Overview, Timeline, Actions, Documents, Participants tabs
  - Request clarification from owner functionality
  - Add notes with type selection
  - Status change modal
  - Linked entities display

---

### Phase 13.5: Split View Components (CONCIERGE-CASE-01) ✅
**Goal:** Implement the primary split-view workspace.

#### Tab Components (in `src/lib/components/cam/concierge/`)
- [x] **13.5.1** Create `CaseOverviewTab.svelte` — Owner intent, status, blocking indicator, key dates
- [x] **13.5.2** Create `CaseIntentTab.svelte` — Original request, clarification thread, AI summary placeholder
- [x] **13.5.3** Create `CaseDecisionsTab.svelte` — Decision notes with rationale display
- [x] **13.5.4** Create `CaseActionsTab.svelte` — Linked workflows, coordination actions
- [x] **13.5.5** Create `CaseDocumentsTab.svelte` — Attachments with download
- [x] **13.5.6** Create `CaseHistoryTab.svelte` — Combined timeline of notes and status changes
- [x] **13.5.7** Create `CaseParticipantsTab.svelte` — Participant list with roles
- [x] **13.5.8** Update concierge case detail page to use tab components

---

### Phase 13.6: Concierge Action Panel (CONCIERGE-CASE-03) ✅
**Goal:** Implement concierge staff action controls.

- [x] **13.6.1** Create `ConciergeActionPanel.svelte` component with action buttons grid
- [x] **13.6.2** Implement "Request Clarification" action with form
- [x] **13.6.3** Implement "Link ARC Request" and "Link Work Order" actions
- [x] **13.6.4** Implement "Record Decision" action with title/description/rationale
- [x] **13.6.5** Implement "Close Case" action with resolution summary
- [x] **13.6.6** Implement "Change Status" action with status selector and reason
- [x] **13.6.7** Implement concierge assignment UI with concierge dropdown

---

### Phase 13.7: Shared UI Components ✅
**Goal:** Create reusable components for case management.

All components in `src/lib/components/cam/concierge/`:
- [x] **13.7.1** Create `CaseStatusBadge.svelte` — Status with color coding and size variants
- [x] **13.7.2** Create `CasePriorityBadge.svelte` — Priority indicator with icons
- [x] **13.7.3** Create `WaitingOnIndicator.svelte` — Shows who case is waiting on
- [x] **13.7.4** Create `CaseTimelineItem.svelte` — For history/audit display with icons
- [x] **13.7.5** Create `DecisionCard.svelte` — Display material decisions with outcome
- [x] **13.7.6** Create `ClarificationThread.svelte` — Q&A thread display with pending indicator
- [x] **13.7.7** Create `LinkedEntityCard.svelte` — Display linked ARC/WorkOrder/Job/Unit
- [x] **13.7.8** Create `index.ts` — Export all concierge components

---

### Phase 13.8: Integration & Testing
**Goal:** Ensure all components work together correctly.

- [ ] **13.8.1** End-to-end test: Owner creates case
- [ ] **13.8.2** End-to-end test: Concierge requests clarification
- [ ] **13.8.3** End-to-end test: Owner responds to clarification
- [ ] **13.8.4** End-to-end test: Concierge records decision
- [ ] **13.8.5** End-to-end test: Concierge links to CAM ARC
- [ ] **13.8.6** End-to-end test: Concierge links to CAM Work Order
- [ ] **13.8.7** End-to-end test: Case resolution and closure
- [ ] **13.8.8** End-to-end test: Case cancellation/withdrawal
- [ ] **13.8.9** Verify ActivityEvent audit trail completeness
- [ ] **13.8.10** Run `npm run check` — TypeScript/Svelte validation
- [ ] **13.8.11** Manual UI review against UX spec

---

### Phase 13.9: Polish & Documentation
**Goal:** Final refinements and documentation updates.

- [ ] **13.9.1** Review and refine UI styling for consistency with CAM patterns
- [ ] **13.9.2** Add loading states and error handling
- [ ] **13.9.3** Add empty states for all list views
- [ ] **13.9.4** Ensure responsive design for tablet/mobile
- [ ] **13.9.5** Update SRD with new routes and components
- [ ] **13.9.6** Update UX spec with any implementation deviations

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Prisma schema (ConciergeCase, etc.) | ✅ Complete | Exists in schema.prisma |
| oRPC routes (conciergeCase, etc.) | ✅ Complete | Exists in routes/concierge/ |
| DBOS workflow (caseLifecycleWorkflow) | ✅ Complete | Single workflow for all transitions |
| Cerbos policy (concierge_case) | ✅ Complete | Exists in cerbos/policies/resource/ |
| ActivityEvent infrastructure | ✅ Complete | recordIntent, recordExecution, recordDecision |
| CAM ARC routes | ✅ Complete | routes/arc/ |
| CAM Work Order routes | ✅ Complete | routes/workOrder/ |
| UI Components (Card, EmptyState, etc.) | ✅ Complete | $lib/components/ui |

---

## Deferred Items

| Item | Reason | Target Phase |
|------|--------|--------------|
| AI-generated summaries (Tab 2) | Future AI integration | TBD |
| Mobile SDK regeneration | Out of scope for Phase 13 | TBD |
| External HOA integrations | Contact info tracking only | TBD |
| External Vendor integrations | Contact info tracking only | TBD |

---

## Progress Tracking

**Last Updated:** 2024-12-18

| Phase | Status | Completion |
|-------|--------|------------|
| 13.1 Schema Enhancements | Not Started | 0% |
| 13.2 Backend API Enhancements | Not Started | 0% |
| 13.3 Owner Portal Routes | Not Started | 0% |
| 13.4 Concierge Portal Routes | Not Started | 0% |
| 13.5 Split View Components | Not Started | 0% |
| 13.6 Concierge Action Panel | Not Started | 0% |
| 13.7 Shared UI Components | Not Started | 0% |
| 13.8 Integration & Testing | Not Started | 0% |
| 13.9 Polish & Documentation | Not Started | 0% |

**Overall Progress:** 0%
