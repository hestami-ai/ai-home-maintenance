# Phase 33: Statutory Compliance CAM UI - Implementation Roadmap

**SRD Reference**: `(Phase 33) Statutory Compliance for CAM UI.md`
**Status**: Not Started
**Last Updated**: 2026-01-13

---

## Prerequisites Checklist

- [ ] Verify Prisma models exist: `ComplianceRequirement`, `ComplianceDeadline`, `ComplianceChecklistItem`
- [ ] Verify backend API routes exist under `compliance` namespace
- [ ] Verify `compliance.getComplianceSummary` endpoint exists
- [ ] Verify DBOS workflows exist for compliance operations
- [ ] Verify Cerbos policies exist for `complianceRequirement`, `complianceDeadline`, `complianceChecklistItem`
- [ ] Extract/verify API types in `$lib/api/cam.ts` from `types.generated.ts`

---

## Phase 1: Foundation and Navigation

### 1.1 Cerbos Policy Verification
- [ ] Verify `complianceRequirement` policy: create, view, update, list
- [ ] Verify `complianceDeadline` policy: create, view, update, list
- [ ] Verify `complianceChecklistItem` policy: update
- [ ] Verify derived roles grant appropriate access (org_admin, org_manager, org_board_member, org_auditor)
- [ ] Add missing policies if needed

### 1.2 Type Extraction and Schema Setup
- [ ] Extract `ComplianceRequirement` type from `types.generated.ts` to `$lib/api/cam.ts`
- [ ] Extract `ComplianceDeadline` type from `types.generated.ts` to `$lib/api/cam.ts`
- [ ] Extract `ComplianceChecklistItem` type
- [ ] Extract `ComplianceSummary` type (from getComplianceSummary response)
- [ ] Export relevant enums (ComplianceRequirementType, ComplianceDeadlineStatus, RecurrenceType)
- [ ] Run `bun run check` to verify types

### 1.3 CAM Navigation Update
- [ ] Add "Compliance" entry to CAM sidebar navigation
- [ ] Route: `/app/cam/compliance`
- [ ] Icon selection (Lucide)
- [ ] Permission-gated visibility (hide if user lacks complianceDeadline:list)

### 1.4 Route Structure Setup
- [ ] Create `/app/cam/compliance/+page.svelte` (dashboard)
- [ ] Create `/app/cam/compliance/+page.server.ts`
- [ ] Create `/app/cam/compliance/+layout.svelte` (shared layout)
- [ ] Create `/app/cam/compliance/+layout.server.ts` (permission check)

---

## Phase 2: Requirement Templates (Organization-Scoped)

### 2.1 Requirements List Page
- [ ] Create `/app/cam/compliance/requirements/+page.svelte`
- [ ] Create `/app/cam/compliance/requirements/+page.server.ts`
- [ ] Implement SSR data loading via `createDirectClient`
- [ ] Call `compliance.listRequirements`
- [ ] Implement search (name, jurisdiction, statutory reference)
- [ ] Implement filters (type, active/inactive)
- [ ] Implement pagination
- [ ] Display columns: name, type, jurisdiction, recurrence, requiresEvidence
- [ ] Empty state with CTA to create template
- [ ] Permission check: hide "Create" button if no create permission

### 2.2 Requirement Create Page
- [ ] Create `/app/cam/compliance/requirements/new/+page.svelte`
- [ ] Create `/app/cam/compliance/requirements/new/+page.server.ts`
- [ ] Implement form with fields:
  - [ ] name (required)
  - [ ] description (optional textarea)
  - [ ] type (enum dropdown)
  - [ ] jurisdiction (text input, recommended)
  - [ ] recurrence (enum dropdown, default ANNUAL)
  - [ ] defaultDueDayOfYear (optional number 1-365)
  - [ ] defaultLeadDays (optional number)
  - [ ] requiresEvidence (boolean toggle)
  - [ ] evidenceTypes (string array input)
  - [ ] statutoryReference (text input)
  - [ ] penaltyDescription (textarea)
  - [ ] checklistTemplate (dynamic array of title + description)
- [ ] Generate idempotencyKey on form mount
- [ ] Implement form validation (Zod)
- [ ] Call `compliance.createRequirement` on submit
- [ ] Handle errors (field-level + banner)
- [ ] Navigate to requirement detail on success

### 2.3 Requirement Detail/Edit Page
- [ ] Create `/app/cam/compliance/requirements/[id]/+page.svelte`
- [ ] Create `/app/cam/compliance/requirements/[id]/+page.server.ts`
- [ ] Load requirement via `compliance.getRequirement`
- [ ] Display all fields in view mode
- [ ] Implement edit mode toggle
- [ ] Implement update form with validation
- [ ] Call `compliance.updateRequirement` on save
- [ ] Handle NOT_FOUND (redirect or error state)

---

## Phase 3: Deadline Management (Association-Scoped)

### 3.1 Deadline List Page
- [ ] Create `/app/cam/compliance/deadlines/+page.svelte`
- [ ] Create `/app/cam/compliance/deadlines/+page.server.ts`
- [ ] Implement SSR data loading via `compliance.listDeadlines`
- [ ] Implement search (requirement name, statutory reference)
- [ ] Implement filters:
  - [ ] status (NOT_STARTED, IN_PROGRESS, COMPLETED, OVERDUE)
  - [ ] type (requirement type)
  - [ ] due date range
  - [ ] requires evidence flag
- [ ] Implement sorting (due date asc default, overdue first, createdAt desc)
- [ ] Display columns: dueDate, requirement name, type, status, evidence completeness, assigned-to
- [ ] Pagination
- [ ] Empty state with CTA to create deadline
- [ ] Create Deadline button (permission-gated)
- [ ] Visual indicators for overdue items (red highlight/badge)

### 3.2 Deadline Create Page
- [ ] Create `/app/cam/compliance/deadlines/new/+page.svelte`
- [ ] Create `/app/cam/compliance/deadlines/new/+page.server.ts`
- [ ] Load available requirements via `compliance.listRequirements`
- [ ] Implement requirement template picker (searchable dropdown)
- [ ] Implement form with fields:
  - [ ] requirementId (required, from picker)
  - [ ] dueDate (required datetime picker)
  - [ ] leadDays (optional, default from requirement)
  - [ ] notes (optional textarea, if modeled)
- [ ] Auto-populate leadDays from selected requirement
- [ ] Generate idempotencyKey on form mount
- [ ] Implement form validation
- [ ] Call `compliance.createDeadline` on submit
- [ ] Navigate to deadline detail on success

### 3.3 Deadline Detail Page
- [ ] Create `/app/cam/compliance/deadlines/[id]/+page.svelte`
- [ ] Create `/app/cam/compliance/deadlines/[id]/+page.server.ts`
- [ ] Load deadline via `compliance.getDeadline`
- [ ] Display requirement info section:
  - [ ] name, type, jurisdiction
  - [ ] statutory reference
  - [ ] penalty description
- [ ] Display deadline info section:
  - [ ] due date (with overdue indicator if applicable)
  - [ ] status badge
  - [ ] lead days
  - [ ] createdAt, updatedAt
- [ ] Implement status controls:
  - [ ] NOT_STARTED to IN_PROGRESS button
  - [ ] IN_PROGRESS to COMPLETED button
  - [ ] Warning/block if completing without required evidence
- [ ] Handle NOT_FOUND error state

---

## Phase 4: Checklist and Evidence

### 4.1 Checklist Section (on Deadline Detail)
- [ ] Display checklist items from deadline
- [ ] Each item shows:
  - [ ] Title
  - [ ] Description
  - [ ] Completion toggle (checkbox)
  - [ ] Notes field (editable)
  - [ ] Evidence attachment indicator
- [ ] Implement completion toggle
- [ ] Call `compliance.updateChecklistItem` on toggle/notes change
- [ ] Generate idempotencyKey per update

### 4.2 Evidence Attachment
- [ ] Implement Attach Evidence button per checklist item
- [ ] Document picker modal (select from existing documents)
- [ ] Upload new document option (integrate with document upload flow)
- [ ] Call `compliance.addEvidenceDocument` on attach
- [ ] Display attached document with:
  - [ ] Document name/link
  - [ ] Uploaded by
  - [ ] Timestamp
- [ ] Evidence complete summary indicator when all required items have documents

---

## Phase 5: Compliance Dashboard

### 5.1 Dashboard Implementation
- [ ] Implement `/app/cam/compliance/+page.svelte` content
- [ ] Load summary via `compliance.getComplianceSummary`
- [ ] Display summary counts for current association:
  - [ ] Total deadlines
  - [ ] Not started
  - [ ] In progress
  - [ ] Completed
  - [ ] Overdue
  - [ ] Upcoming this month
- [ ] Overdue section:
  - [ ] Top N overdue deadlines
  - [ ] Show: due date, type, title, days overdue
  - [ ] Link to deadline detail
- [ ] Due Soon section:
  - [ ] Due within next 30 days
  - [ ] Show: due date, type, title
  - [ ] Link to deadline detail
- [ ] Quick action buttons:
  - [ ] Create Deadline to `/deadlines/new`
  - [ ] View All Deadlines to `/deadlines`
  - [ ] Manage Requirement Templates to `/requirements` (permission-gated)
- [ ] Implement filters:
  - [ ] Requirement type
  - [ ] Jurisdiction
  - [ ] Status

---

## Phase 6: Automation and Overdue Handling

### 6.1 Overdue Computation (MVP - Client-Side)
- [ ] Implement overdue calculation in UI:
  - [ ] dueDate less than now AND status is NOT_STARTED or IN_PROGRESS
- [ ] Display overdue badge/indicator on deadline rows
- [ ] Display X days overdue on deadline detail

### 6.2 Overdue Computation (Preferred - Backend Job)
- [ ] Implement scheduled job/workflow to update status to OVERDUE
- [ ] Run daily or on configurable schedule
- [ ] Update deadlines where dueDate passed and status not COMPLETED

### 6.3 Notifications (MVP)
- [ ] In-app notification for upcoming deadlines (30/14/7/1 days before)
- [ ] In-app notification for overdue reminders
- [ ] Optional: Email notifications (future enhancement)

---

## Phase 7: Calendar View (Optional)

### 7.1 Calendar Implementation
- [ ] Create `/app/cam/compliance/calendar/+page.svelte`
- [ ] Create `/app/cam/compliance/calendar/+page.server.ts`
- [ ] Month view showing due dates
- [ ] Agenda/list view alternative
- [ ] Color coding: overdue (red), due soon (yellow), completed (green)
- [ ] Click to navigate to deadline detail

---

## Phase 8: Export and Reporting

### 8.1 CSV Export Implementation
- [ ] Compliance status export (CSV) by association:
  - [ ] Deadline list with status, due date, completion, evidence completeness
- [ ] Add export button to deadline list page
- [ ] Client-side CSV generation

### 8.2 Reports Integration (Optional)
- [ ] Add Compliance category reports to `/app/cam/reports`
- [ ] Leverage existing COMPLIANCE category filter

### 8.3 Resale Packet Export (Future)
- [ ] Generate pre-filled checklist + document bundle
- [ ] Out of scope for MVP

---

## Phase 9: Polish and Validation

### 9.1 Error Handling
- [ ] Implement standard error banner component usage
- [ ] Handle NOT_FOUND errors gracefully
- [ ] Handle VALIDATION_FAILED with field-level errors
- [ ] Handle INTERNAL_SERVER_ERROR with retry guidance

### 9.2 Accessibility
- [ ] Keyboard navigation for all forms and checklists
- [ ] Screen reader labels for all inputs
- [ ] Focus management on modals
- [ ] ARIA attributes on interactive elements (especially checkboxes)

### 9.3 Date/Time Handling
- [ ] Store dates as ISO format
- [ ] Display dates in user local timezone
- [ ] Prevent timezone confusion in date entry

### 9.4 Performance
- [ ] Verify dashboard loads less than 2 seconds with 1,000 deadlines
- [ ] Verify templates list loads less than 2 seconds with 500 templates
- [ ] Verify pagination works correctly
- [ ] Verify no unbounded data loading

### 9.5 Final Verification
- [ ] Run `bun run check` - must pass
- [ ] Test all CRUD operations for requirement templates
- [ ] Test deadline creation from templates
- [ ] Test checklist completion workflow
- [ ] Test evidence attachment workflow
- [ ] Test status transitions
- [ ] Test authorization enforcement (unauthorized user cannot access)
- [ ] Test idempotency (retry same operation with same key)

---

## Acceptance Criteria Verification

- [ ] **AC1**: CAM can navigate to Compliance and see summary counts for current association
- [ ] **AC2**: CAM can create and manage compliance requirement templates (permission-gated)
- [ ] **AC3**: CAM can create compliance deadlines for an association from templates
- [ ] **AC4**: CAM can update deadline status and complete checklist items
- [ ] **AC5**: CAM can attach evidence documents to checklist items
- [ ] **AC6**: Overdue and due-soon items are clearly visible and filterable
- [ ] **AC7**: Authorization prevents unauthorized access/actions

---

## Open Questions (Resolve Before Implementation)

- [ ] Should COMPLETED be blocked unless required evidence is attached, or only warned?
- [ ] How should jurisdiction be modeled (free-text vs standardized codes)?
- [ ] Should compliance deadlines be assignable to specific staff users (schema support)?
- [ ] Do we need versioning for requirement templates (changes dont affect existing deadlines)?
- [ ] What is the minimal viable notification channel for Phase 33 (in-app only vs email)?

---

## Notes

- All mutations use DBOS workflows with `idempotencyKey` as `workflowID`
- Use `createDirectClient` for SSR data loading in `+page.server.ts`
- Extract types from `types.generated.ts`, never import Prisma types client-side
- Follow oRPC `.errors()` pattern, never throw `ApiException` directly
- Requirement templates are organization-scoped; deadlines are association-scoped
- Checklist items are auto-generated from requirement template on deadline creation
