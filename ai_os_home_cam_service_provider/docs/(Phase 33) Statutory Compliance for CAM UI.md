# (Phase 33) Statutory Compliance — CAM UI System Requirements
Last updated: 2026-01-13
Owner: CAM Product / Engineering
Status: Draft (SRD)

## 1. Purpose
Deliver a CAM-facing statutory compliance module aligned with Domain 12 in Phase 1:
- statutory deadlines
- notice requirements
- voting rules
- financial audit requirements
- resale packet guidelines
…implemented as requirement templates + per-association deadline instances with evidence and checklists.

This phase focuses on CAM UI + operational workflows over existing backend APIs and data models.

## 2. Background / Current State
- Prisma models exist: `ComplianceRequirement`, `ComplianceDeadline`, `ComplianceChecklistItem`.
- Backend API routes exist under `compliance` plus a `getComplianceSummary` endpoint.
- Contractor compliance (licenses/insurance) exists separately and is not the focus of this phase.

## 3. Goals
- CAM can define compliance requirement templates (by jurisdiction and type).
- CAM can instantiate and track deadlines per association.
- CAM can execute a checklist per deadline, upload/attach evidence documents, and change status.
- CAM has dashboard visibility into what is overdue, due soon, and completed.
- CAM can export a compliance status package for auditors/boards/resale requests.

## 4. Non-Goals (Out of Scope)
- Full “rules engine + AI-parsed statutory logic” automation (future phase), beyond assisting template creation.
- Automated legal interpretation or legal advice generation.
- End-user (owner) self-service compliance portal.
- Multi-jurisdiction statutory dataset ingestion at scale (future phase).

## 5. Users & Roles
### Primary users
- CAM Staff (manages deadlines and evidence)
- Compliance Admin (manages templates, jurisdictions, and standards)

### Secondary users
- Board Member (read-only dashboards and export)
- Auditor (read-only export)
- Concierge staff (read-only or limited actions, optional)

## 6. Permissions & Access Control
Authorization must be enforced via Cerbos and reflected in UI:
- `complianceRequirement`: create/view/update/list
- `complianceDeadline`: create/view/update/list
- `complianceChecklistItem`: update (as checklist completion)
- Read access to `Document` for evidence

UI must:
- Hide/disable actions without permission.
- Prevent cross-tenant access (association must belong to org).

## 7. Information Architecture (CAM)
### Navigation
Add a CAM sidebar entry:
- Label: “Compliance”
- Route: `/app/cam/compliance`

### Route map (proposed)
- `/app/cam/compliance` (association compliance dashboard)
- `/app/cam/compliance/deadlines` (deadline list)
- `/app/cam/compliance/deadlines/new`
- `/app/cam/compliance/deadlines/[id]` (deadline detail)
- `/app/cam/compliance/requirements` (templates list; admin)
- `/app/cam/compliance/requirements/new`
- `/app/cam/compliance/requirements/[id]` (template detail/edit)
- `/app/cam/compliance/calendar` (optional)
- `/app/cam/compliance/export` (optional)

All deadline pages operate in the context of the currently selected association.
Requirements/templates operate at the organization level.

## 8. Data Model Mapping (Prisma)
- Requirement template: `ComplianceRequirement`
  - type, jurisdiction, recurrence, statutory reference, evidence requirements, checklist template
- Deadline instance: `ComplianceDeadline`
  - associationId + requirementId + dueDate + status + leadDays + assignedTo (if present)
- Checklist items: `ComplianceChecklistItem`
  - deadlineId + completion + evidenceDocumentId + notes
- Evidence: `Document` referenced by `evidenceDocumentId`

## 9. Backend API Integration Requirements
UI must integrate with these backend procedures (existing):
- Templates:
  - `compliance.createRequirement`
  - `compliance.getRequirement`
  - `compliance.listRequirements`
  - `compliance.updateRequirement`
- Deadlines:
  - `compliance.createDeadline`
  - `compliance.getDeadline`
  - `compliance.listDeadlines`
  - `compliance.updateDeadlineStatus`
  - `compliance.addEvidenceDocument`
  - `compliance.updateChecklistItem`
- Summary:
  - `compliance.getComplianceSummary`

### Idempotency
All “create” operations require `idempotencyKey` (UUID).
UI must generate and reuse idempotency keys on retry for the same action.

### Error handling
UI must handle:
- `NOT_FOUND` (association, requirement, deadline)
- `VALIDATION_FAILED`
- `INTERNAL_SERVER_ERROR`
Show field-level errors when available.

## 10. UX Requirements (Core Screens)

### 10.1 Compliance Dashboard (`/app/cam/compliance`)
Must display:
- Summary counts for current association:
  - total, not started, in progress, completed, overdue, upcoming this month
- “Overdue” section: top N overdue deadlines with due date, type, title, days overdue
- “Due Soon” section: due within next 30 days (configurable)
- Quick actions:
  - “Create Deadline”
  - “View All Deadlines”
  - “Manage Requirement Templates” (permission-gated)

Must support filtering by:
- requirement type (STATUTORY_DEADLINE, NOTICE_REQUIREMENT, VOTING_RULE, FINANCIAL_AUDIT, RESALE_PACKET, etc.)
- jurisdiction
- status

### 10.2 Deadline List (`/deadlines`)
List view must support:
- Search: requirement name, statutory reference
- Filters: status, type, due date range, “requires evidence”
- Sort: due date asc (default), overdue first, createdAt desc
- Columns (minimum): dueDate, requirement name, type, status, evidence completeness indicator, assigned-to (optional)

Bulk actions (optional):
- Export CSV
- Bulk status update (guarded; likely out-of-scope MVP)

### 10.3 Deadline Create (`/deadlines/new`)
Creation workflow:
1. Select requirement template (searchable picker).
2. Configure deadline:
   - associationId (implicit from current association)
   - dueDate (required)
   - leadDays (default from requirement)
   - status initial default `NOT_STARTED`
3. Auto-generate checklist items from requirement checklist template (if present).

Form fields (minimum):
- requirementId (required)
- dueDate (required datetime)
- leadDays (optional)
- notes (optional) (if modeled)

After creation:
- Navigate to deadline detail.

### 10.4 Deadline Detail (`/deadlines/[id]`)
Must show:
- Requirement info (name, type, jurisdiction, statutory reference, penalty description)
- Deadline info (due date, status, lead days, createdAt)
- Checklist section:
  - list of items with completion toggles
  - item notes
  - attach evidence per item (document picker/upload) if required by requirement
- Evidence summary:
  - “Evidence complete” when all required evidence items have documents attached
- Status controls:
  - Update status transitions:
    - NOT_STARTED → IN_PROGRESS → COMPLETED
    - Any → OVERDUE may be automatic based on dueDate (see Automation)
  - Completion should be blocked or warn if required evidence missing (policy decision; at minimum warn)

### 10.5 Requirement Templates (`/requirements`)
Templates are organization-scoped.
List view must support:
- Search: name, jurisdiction, statutory reference
- Filters: type, active/inactive
- Create new template (permission-gated)

Template create/edit fields (minimum):
- name (required)
- description (optional)
- type (enum)
- jurisdiction (optional but strongly recommended)
- recurrence (enum; default annual)
- defaultDueDayOfYear (optional)
- defaultLeadDays (optional)
- requiresEvidence (bool)
- evidenceTypes (string array)
- statutoryReference (string)
- penaltyDescription (string)
- checklistTemplate: array of (title, description)

### 10.6 Calendar View (Optional)
A calendar (month + agenda) showing:
- due dates
- overdue items
- quick click into deadline detail

## 11. Automation Requirements
### 11.1 Overdue computation
System must treat a deadline as overdue when:
- `dueDate < now` AND `status` is NOT_STARTED or IN_PROGRESS.
Options:
- (MVP) UI computes and displays “overdue” based on dueDate and status, while backend status may lag.
- (Preferred) Backend periodically updates status to `OVERDUE` (scheduled job/workflow).

### 11.2 Template-to-deadline generation (MVP vs Future)
- MVP: deadlines are created manually by CAM from templates.
- Future: auto-generate upcoming deadlines per association from active templates and recurrence rules.

### 11.3 Notifications (MVP)
System should generate reminders:
- Upcoming deadlines: 30/14/7/1 days before due (configurable)
- Overdue reminders: daily/weekly (configurable)
Channels:
- In-app notifications (preferred MVP)
- Email (optional)

## 12. Audit & Evidence Handling
- All changes to deadline status and checklist completion must be auditable (ActivityEvent).
- Evidence documents must record:
  - who uploaded
  - timestamp
  - association context
- UI must support linking existing documents from “Documents & Records” where relevant.

## 13. Reporting & Exports
MVP exports:
- Compliance status export (CSV) by association:
  - deadline list with status, due date, completion, evidence completeness
- “Resale packet” export bundle (future): generate a pre-filled checklist + document bundle.

Optional integration:
- Add “Compliance” category reports into `/app/cam/reports` (already supports a COMPLIANCE category filter).

## 14. Performance & Reliability
- Dashboard loads within 2 seconds for up to:
  - 1,000 deadlines per association
  - 500 templates per org
- Lists must be paginated; avoid unbounded loads.
- Idempotency keys must prevent duplicate template/deadline creation during retries.

## 15. Accessibility & i18n
- Keyboard and screen-reader accessible checklist interactions.
- Date/time display localized; due date entry must prevent timezone confusion (store ISO, display local).

## 16. Acceptance Criteria (MVP)
1. CAM can navigate to “Compliance” and see summary counts for the current association.
2. CAM can create and manage compliance requirement templates (permission-gated).
3. CAM can create compliance deadlines for an association from templates.
4. CAM can update deadline status and complete checklist items.
5. CAM can attach evidence documents to checklist items.
6. Overdue and due-soon items are clearly visible and filterable.
7. Authorization prevents unauthorized access/actions.

## 17. Open Questions
- Should “COMPLETED” be blocked unless required evidence is attached, or only warned?
- How should jurisdiction be modeled (free-text vs standardized codes)?
- Should compliance deadlines be assignable to specific staff users (and does the schema support it today)?
- Do we need versioning for requirement templates (so changes don’t retroactively change existing deadlines)?
- What is the minimal viable notification channel for Phase 33 (in-app only vs email)?
