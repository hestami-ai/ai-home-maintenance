# Phase 7 — CAM Violations Lifecycle Implementation Roadmap

**Status:** In Progress  
**Dependencies:** Phase 6 CAM Navigation complete  
**Scope:** Complete violations lifecycle per Storyboard #1, including missing states, communications, remediation, and edge cases

---

## Overview

Phase 7 completes the **Violations Lifecycle** as defined in CAM Storyboard #1. This phase builds on the existing Phase 6 violations implementation to add:

- Missing canonical states (DETECTED, UNDER_REVIEW, OWNER_RESPONSE_PENDING, REMEDIATION_IN_PROGRESS)
- Communications tab with notices and owner responses
- Remediation authorization with work order creation
- Enhanced list view with Days Open and Escalation Flag
- Prior violation history display
- Edge case workflows (false positive, appeals, HOA conflicts)

---

## Key Technologies

| Layer | Technology |
|-------|------------|
| Frontend Framework | SvelteKit 5 with Runes |
| UI Framework | Skeleton UI + Flowbite Svelte |
| Form Handling | Superforms |
| Icons | Lucide Svelte |
| Styling | TailwindCSS |
| Authentication | Better Auth (self-hosted) |
| API | oRPC (existing backend) |
| Authorization | Cerbos |

---

## Current State (Phase 6 Complete)

### Already Implemented
- [x] Split-view layout (CAM-VIOLATIONS-01)
- [x] List panel with search, status/severity filters
- [x] Detail panel with Overview, Documents, History tabs
- [x] Violation creation form (CAM-VIOLATIONS-02)
- [x] Send Notice modal with template selection
- [x] Schedule Hearing modal
- [x] Assess Fine modal
- [x] Rationale modal for governance actions
- [x] Badge count integration
- [x] State-based action visibility
- [x] Activity history display

---

## P7.1 Canonical State Expansion

### P7.1.1 Add Missing States

- [x] Update violation status enum to include:
  - `DETECTED` - Initial detection, not yet confirmed
  - `UNDER_REVIEW` - Staff reviewing evidence
  - `OWNER_RESPONSE_PENDING` - Awaiting owner response
  - `REMEDIATION_IN_PROGRESS` - Work order active
- [x] Update status color mappings in UI
- [x] Update status filter options

### P7.1.2 State Transition Logic

- [x] Add "Confirm Violation" action (DETECTED → UNDER_REVIEW)
- [x] Add "Mark Invalid" action (DETECTED → CLOSED)
- [x] Add "Request Owner Response" action (NOTICE_SENT → OWNER_RESPONSE_PENDING)
- [x] Add "Authorize Remediation" action (ESCALATED → REMEDIATION_IN_PROGRESS)
- [x] Ensure all transitions require rationale where appropriate
- [ ] Validate state transitions (prevent invalid jumps) - backend

### P7.1.3 Update Violation Creation

- [x] New violations enter `DETECTED` state (not OPEN) - form updated
- [x] Add confirmation step before enforcement begins
- [x] Update form to clarify "detection" vs "confirmed violation"

### Deliverables
- [ ] All 8 canonical states supported
- [ ] State transitions validated
- [ ] UI reflects new states

---

## P7.2 Enhanced List View

### P7.2.1 Days Open Column

- [x] Calculate days since violation created/detected
- [x] Display in list view
- [x] Color-code based on age (green < 7, yellow 7-30, red > 30)
- [x] Sort by days open

### P7.2.2 Escalation Flag

- [x] Add visual escalation indicator (icon/badge)
- [x] Show for ESCALATED status and any violation with escalation history
- [x] Filter by escalation flag

### P7.2.3 Bulk Selection Integration

- [x] Wire up ListPanel bulk selection props
- [x] Add bulk actions: Escalate, Resolve
- [x] Bulk action confirmation with rationale

### P7.2.4 Rule/Type Display

- [x] Show violation type code in list
- [x] Add rule excerpt tooltip on hover

### Deliverables
- [x] Enhanced list with Days Open, Escalation Flag
- [x] Bulk actions working
- [x] Improved rule visibility

---

## P7.3 Communications Tab

### P7.3.1 Create Communications Tab

- [x] Add "Communications" tab to violation detail (Tab 4 per storyboard)
- [x] Display notices sent (date, type, recipient, delivery status)
- [x] Display owner responses (date, content, attachments)
- [ ] Message thread view (read-only for owners)

### P7.3.2 Notice History

- [x] Fetch notices from backend API
- [x] Show notice type, template used, sent date
- [ ] Link to notice document if generated
- [x] Show delivery confirmation status

### P7.3.3 Owner Response Display

- [x] Create owner response viewer component
- [x] Display submission date, content, attachments
- [x] Manager response controls (acknowledge, request more info)
- [x] Note: Owner input NEVER changes state automatically

### P7.3.4 Owner Response Viewer Screen (CAM-VIOLATIONS-03)

- [x] Create `/app/cam/violations/[id]/response/[responseId]/+page.svelte`
- [x] Full-screen view of owner submission
- [x] Attachments gallery
- [x] Manager action buttons (Acknowledge)

### Deliverables
- [x] Communications tab with notices and responses
- [x] Owner response viewer screen
- [x] Manager response controls

---

## P7.4 Actions Tab

### P7.4.1 Create Actions Tab

- [x] Add "Actions" tab to violation detail (Tab 2 per storyboard)
- [x] Keep action buttons in header for quick access
- [x] Group actions by category:
  - Confirmation actions (Confirm, Mark Invalid)
  - Notice actions (Send Notice, Request Response)
  - Escalation actions (Escalate)
  - Fine actions (Assess Fine)
  - Remediation actions (Authorize Remediation)
  - Resolution actions (Resolve)

### P7.4.2 State-Aware Action Display

- [x] Only show actions valid for current state
- [x] Disabled state with tooltip for invalid actions (DecisionButton supports disabledReason)
- [ ] Required artifacts warning before action - backend

### P7.4.3 Action Audit Preview

- [x] Show what ActivityEvent will be created
- [x] Preview rationale requirement
- [x] Confirm before execution (via RationaleModal)

### Deliverables
- [x] Dedicated Actions tab
- [x] State-aware action visibility
- [x] Action audit preview

---

## P7.5 Remediation Authorization

### P7.5.1 Remediation Authorization Screen (CAM-VIOLATIONS-04)

- [x] Create `/app/cam/violations/[id]/remediation/+page.svelte`
- [x] Vendor selection (from approved vendors)
- [x] Budget source selection
- [x] Scope summary input
- [x] Create Work Order button (links to Phase 2)

### P7.5.2 Work Order Integration

- [x] Create work order from violation context
- [ ] Link work order to violation - backend
- [ ] Update violation status to REMEDIATION_IN_PROGRESS - backend
- [ ] Show linked work orders in violation detail

### P7.5.3 Remediation Tracking

- [ ] Display work order status in violation detail
- [ ] Auto-update violation when work order completes (optional)
- [ ] Vendor invoice linking

### Deliverables
- [x] Remediation authorization screen
- [x] Work order creation from violation
- [ ] Linked work order display

---

## P7.6 Prior Violation History

### P7.6.1 Same Unit History

- [x] Fetch prior violations for same unit
- [x] Display in Overview tab or dedicated section
- [x] Show count, dates, outcomes

### P7.6.2 Same Rule History

- [x] Fetch prior violations for same violation type
- [x] Highlight repeat offenders
- [x] Suggest escalation for repeat violations

### P7.6.3 History Summary Card

- [x] Integrated into Overview tab (not separate component)
- [x] Show unit history + rule history
- [x] Link to historical violations

### Deliverables
- [x] Prior violation history display
- [x] Repeat offender highlighting
- [x] History summary component

---

## P7.7 Edge Case Workflows

### P7.7.1 False Positive

- [x] Add "Mark Invalid" action
- [x] Require rationale for invalid marking
- [ ] Close violation with "FALSE_POSITIVE" outcome - backend
- [ ] No enforcement actions recorded - backend

### P7.7.2 Owner Appeal

- [x] Add "Appeal" flag to violation - UI ready
- [x] Create appeal submission flow (AppealModal)
- [x] Board review required flag (requestBoardReview option)
- [ ] Separate appeal decision recording - backend
- [ ] Appeal outcome affects violation status - backend

### P7.7.3 External HOA Rule Conflict

- [x] Add "HOA Conflict" flag (hasHoaConflict field)
- [x] Document reference field (hoaConflictNotes)
- [x] Manual interpretation notes display
- [x] Emphasized audit trail (timeline visualization)

### Deliverables
- [x] False positive workflow (Mark Invalid action)
- [x] Appeal workflow (AppealModal + Actions tab integration)
- [x] HOA conflict handling (warning banner in Overview)

---

## P7.8 Required Artifacts Validation

### P7.8.1 Artifact Presence Check

- [ ] Before decisions, verify required artifacts exist - backend
  - Evidence (photos, notes)
  - Rule citation
  - Property/unit details
- [ ] Block or warn if artifacts missing - backend

### P7.8.2 Rule Text Display

- [x] Fetch governing rule text from violation type (violationTypeRuleText field)
- [x] Display excerpt in Overview tab (Governing Rule card)
- [ ] Link to full rule document - backend

### P7.8.3 Evidence Gallery

- [ ] Enhanced evidence display in Documents tab
- [ ] Photo gallery with lightbox
- [ ] Timestamped evidence list
- [x] Evidence upload from detail view (existing upload link)

### Deliverables
- [ ] Artifact validation before decisions - backend
- [x] Rule text display
- [ ] Enhanced evidence gallery

---

## P7.9 SLA & Timeline Features

### P7.9.1 SLA Timer Display

- [x] Calculate time remaining for cure period (calculateSlaStatus function)
- [x] Display countdown in Overview tab (SLA banner)
- [x] Color-code based on urgency (low/medium/high/critical)

### P7.9.2 Timeline Visualization

- [x] Create timeline component for violation lifecycle (History tab)
- [x] Show state transitions with dates
- [x] Highlight overdue items (SLA banner)

### P7.9.3 Due Date Management

- [ ] Set/edit due dates for cure period - backend
- [ ] Automatic escalation warnings - backend
- [ ] Overdue notification triggers - backend

### Deliverables
- [x] SLA timer display
- [x] Timeline visualization
- [ ] Due date management - backend

---

## P7.10 Backend API Requirements

### P7.10.1 New Endpoints Needed

- [x] `violation.listNotices` - Notice history (existing)
- [ ] `violation.listResponses` - Owner responses
- [ ] `violation.submitResponse` - Submit owner response
- [x] `violation.getPriorViolations` - Prior violations for unit/type ✓
- [ ] `violation.createRemediation` - Create remediation work order

### P7.10.2 State Transition Endpoints

- [x] `violation.updateStatus` - Generic status change (existing)
- [x] `violation.escalate` - Escalate violation ✓
- [x] `violation.markInvalid` - Mark as false positive → DISMISSED ✓
- [x] `violation.resolve` - Resolve violation → CLOSED ✓

### P7.10.3 Appeal Endpoints

- [x] `violation.fileAppeal` - Submit appeal ✓
- [x] `violation.getAppeal` - Get appeal details ✓
- [x] `violation.recordAppealDecision` - Record appeal decision ✓

### Deliverables
- [x] Core API endpoints implemented
- [ ] Frontend API client updated

---

## P7.11 Audit & ActivityEvent Compliance

### P7.11.1 Verify ActivityEvent Generation

- [x] Detection logged → VIOLATION CREATE (existing)
- [x] Violation confirmed → VIOLATION STATUS_CHANGE (via updateStatus)
- [x] Notice sent → VIOLATION STATUS_CHANGE (via sendNotice)
- [ ] Owner response received → VIOLATION STATUS_CHANGE
- [x] Escalation → VIOLATION STATUS_CHANGE (via escalate) ✓
- [x] Fine applied → VIOLATION STATUS_CHANGE (via assessFine)
- [ ] Work order created → WORK_ORDER CREATE
- [x] Violation resolved → VIOLATION STATUS_CHANGE (via resolve) ✓
- [x] Violation closed → VIOLATION STATUS_CHANGE (via close)

### P7.11.2 Audit Display Enhancement

- [x] Show actor type (HUMAN / SYSTEM) in history (badge in timeline)
- [x] Display rationale for each decision (expandable rationale section)
- [x] Show related artifacts (document links in timeline events)

### Deliverables
- [x] Core actions generate ActivityEvents
- [x] Enhanced audit display

---

## P7.12 Testing & Polish

### P7.12.1 Flow Testing

- [ ] Test complete violation lifecycle (DETECTED → CLOSED)
- [ ] Test all state transitions
- [ ] Test rationale requirements
- [ ] Test artifact validation

### P7.12.2 Edge Case Testing

- [ ] Test false positive flow
- [ ] Test appeal flow
- [ ] Test remediation flow
- [ ] Test bulk actions

### P7.12.3 Responsive Design

- [ ] Mobile-friendly Communications tab
- [ ] Mobile-friendly Actions tab
- [ ] Touch-friendly timeline

### Deliverables
- [ ] All flows tested
- [ ] Edge cases verified
- [ ] Responsive design confirmed

---

## Implementation Order

1. **P7.1** Canonical State Expansion (foundation for all other work)
2. **P7.2** Enhanced List View (quick wins, improves usability)
3. **P7.3** Communications Tab (core storyboard requirement)
4. **P7.4** Actions Tab (reorganize existing functionality)
5. **P7.5** Remediation Authorization (Phase 2 integration)
6. **P7.6** Prior Violation History (decision support)
7. **P7.7** Edge Case Workflows (completeness)
8. **P7.8** Required Artifacts Validation (governance)
9. **P7.9** SLA & Timeline Features (operational efficiency)
10. **P7.10** Backend API Requirements (parallel with frontend)
11. **P7.11** Audit & ActivityEvent Compliance (verification)
12. **P7.12** Testing & Polish

---

## Dependencies

| Phase | Dependency |
|-------|------------|
| P7.1 | Phase 6 complete |
| P7.3-P7.4 | P7.1 complete |
| P7.5 | P7.1 complete, Work Orders module available |
| P7.6-P7.9 | P7.1 complete |
| P7.10 | Can run parallel with frontend work |
| P7.11-P7.12 | All previous phases complete |

---

## Success Criteria

1. All 8 canonical states supported with valid transitions
2. Communications tab shows notices and owner responses
3. Actions tab provides state-aware action controls
4. Remediation creates linked work orders
5. Prior violation history displayed for decision support
6. False positive, appeal, and HOA conflict workflows functional
7. Required artifacts validated before decisions
8. SLA timers and timeline visualization working
9. All actions generate proper ActivityEvents
10. Complete lifecycle testable end-to-end

---

## Estimated Effort

| Section | Effort |
|---------|--------|
| P7.1 State Expansion | 4 hours |
| P7.2 Enhanced List | 3 hours |
| P7.3 Communications Tab | 6 hours |
| P7.4 Actions Tab | 3 hours |
| P7.5 Remediation | 5 hours |
| P7.6 Prior History | 3 hours |
| P7.7 Edge Cases | 4 hours |
| P7.8 Artifacts | 3 hours |
| P7.9 SLA/Timeline | 4 hours |
| P7.10 Backend APIs | 8 hours (backend) |
| P7.11 Audit | 2 hours |
| P7.12 Testing | 4 hours |
| **Total** | **~49 hours** |

---

## Non-Goals (Phase 7)

- AI-powered violation detection (future)
- Automated escalation (future)
- Owner self-service portal (separate phase)
- Mobile native app support
- Real-time notifications (WebSocket)
