# (Phase 32) Reserve Studies — CAM UI System Requirements
Last updated: 2026-01-13
Owner: CAM Product / Engineering
Status: Draft (SRD)

## 1. Purpose
Deliver a complete CAM-facing UI for managing HOA reserve studies, including reserve components, study records, and funding schedules, aligned with Domain 11 in Phase 1.

This phase focuses on CAM UI + workflows over existing backend APIs and data models.

## 2. Background / Current State
- Prisma models and migrations exist for reserve studies and components.
- Backend API routes exist under `reserve` with durable DBOS workflows.
- No dedicated CAM UI routes/navigation currently exist for Reserve Studies.

## 3. Goals
- CAM can create and maintain a reserve component inventory per association.
- CAM can create and view reserve studies per association (vendor-prepared or internally recorded).
- CAM can attach reserve-study documents and maintain component snapshots per study.
- CAM can maintain and review a multi-year funding schedule tied to a study.
- CAM can export/share reserve study summaries (PDF/CSV initial scope: CSV; PDF optional).

## 4. Non-Goals (Out of Scope)
- Automated reserve study generation from inspections or AI extraction (future phase).
- Full reserve funding forecasting engine beyond stored schedule rows (future phase).
- Owner portal UX for reserve studies (future phase).
- Multi-association portfolio analytics (future phase).

## 5. Users & Roles
### Primary users
- CAM Staff (day-to-day reserve tracking)
- CAM Supervisor / Admin (policy-level controls; approvals)

### Secondary users
- Board Member (read-only access, if enabled)
- Auditor (read-only access, export)

## 6. Permissions & Access Control
Authorization must be enforced server-side (Cerbos) and reflected client-side:
- `reserveComponent`: create/view/update/delete/list
- `reserveStudy`: create/view/update/list
- Related read access to `Association`, `Document`

UI must:
- Hide navigation + actions when user lacks permission.
- Show “Not authorized” empty-state when user navigates directly without access.

## 7. Information Architecture (CAM)
### Navigation
Add a CAM sidebar entry:
- Label: “Reserve Studies”
- Route: `/app/cam/reserve-studies`

### Route map (proposed)
- `/app/cam/reserve-studies` (overview)
- `/app/cam/reserve-studies/components` (component inventory)
- `/app/cam/reserve-studies/components/new`
- `/app/cam/reserve-studies/components/[id]`
- `/app/cam/reserve-studies/studies` (study list)
- `/app/cam/reserve-studies/studies/new`
- `/app/cam/reserve-studies/studies/[id]` (study detail)
- `/app/cam/reserve-studies/studies/[id]/components` (study snapshots)
- `/app/cam/reserve-studies/studies/[id]/funding-schedule`
- `/app/cam/reserve-studies/studies/[id]/export` (optional)

All pages operate in the context of the currently selected association.

## 8. Data Model Mapping (Prisma)
UI concepts map to:
- Reserve Component inventory: `ReserveComponent`
- Reserve Study record: `ReserveStudy`
- Study component snapshot: `ReserveStudyComponent`
- Funding schedule rows: `ReserveFundingSchedule`
- Supporting attachments: `Document` (linked via `ReserveStudy.documentId` where available)

## 9. Backend API Integration Requirements
UI must integrate with these backend procedures (existing):
- `reserve.createComponent`
- `reserve.getComponent`
- `reserve.listComponents` (pagination supported)
- `reserve.updateComponent`
- `reserve.deleteComponent`
- `reserve.createStudy`
- `reserve.getStudy`
- `reserve.listStudies` (pagination supported)
- `reserve.addStudyComponent`
- `reserve.getStudyComponents`
- `reserve.setFundingSchedule`
- `reserve.getFundingSchedule`

### Idempotency
All “create” operations require `idempotencyKey` (UUID).
UI must generate a new UUID per submission attempt and reuse it on retry for the same user action.

### Error handling
UI must handle:
- `NOT_FOUND` (association/component/study missing or cross-tenant)
- `VALIDATION_FAILED` (field errors)
- `INTERNAL_SERVER_ERROR`
Show a standard error banner + field-level errors when provided.

## 10. UX Requirements (Core Screens)

### 10.1 Overview (`/app/cam/reserve-studies`)
Purpose: fast status + entry points.
Must display:
- Latest study (if any): study date, type, percent funded, preparer
- Component inventory counts by category (optional aggregation)
- Quick actions: “Add Component”, “Create Study”, “View Studies”, “View Funding Schedule (latest)”
- Empty state: “No reserve study yet” with CTA to create study; “No components” with CTA to add components

### 10.2 Component Inventory (`/components`)
List view must support:
- Search: name, category, location
- Filters: category, condition rating range (if present), “remaining life <= X”
- Sort: name, category, remaining life, replacement cost, updated date
- Row fields (minimum): name, category, remaining life, current replacement cost, condition rating
- Bulk actions (optional): export CSV, bulk update inflation rate (future)

Component detail must support:
- View all fields
- Edit fields with validation
- Soft delete behavior should reflect backend (if delete is soft); UI must confirm deletion
- “Used in studies” list: links to studies where snapshots exist (optional)

Component create/edit form fields (minimum):
- name (required)
- category (required enum)
- description, location
- usefulLife (int > 0), remainingLife (int >= 0)
- placedInServiceDate (optional)
- currentReplacementCost (required > 0)
- inflationRate (optional >= 0)
- quantity/unitOfMeasure (optional)
- conditionRating (optional 1–10)
- notes (optional)

### 10.3 Studies List (`/studies`)
List view must support:
- Create new study
- Filters: study type, year, preparer
- Sort: studyDate desc (default), createdAt desc
- Display: studyDate, type, percentFunded, fundingPlanType, preparer, component snapshot count

### 10.4 Study Create (`/studies/new`)
Must support creation of a study record independent of component snapshots.
Fields (minimum):
- studyType (enum)
- studyDate (required)
- effectiveDate (required)
- expirationDate (optional)
- preparerName (required)
- preparerCompany, preparerCredentials (optional)
- reserveBalance, fullyFundedBalance, recommendedContribution (numbers)
- percentFunded (0–100)
- fundingPlanType (enum)
- notes (optional)
- documentId (optional): attach via document picker / upload flow

After creation:
- Navigate to study detail page.
- Prompt to “Add components to this study”.

### 10.5 Study Detail (`/studies/[id]`)
Must show:
- Study metadata (all fields)
- Summary tiles: percent funded, reserve balance, recommended contribution, fully funded balance
- Links: “Study Components”, “Funding Schedule”, “Documents”
- Audit-friendly metadata: created at, updated at (if available), created by (if available)

### 10.6 Study Components / Snapshots (`/studies/[id]/components`)
Purpose: per-study snapshot values for each component (may differ from inventory).
Must support:
- Add component to study (picker from inventory, excluding already-linked)
- For each snapshot: override/record study-time values (minimum):
  - componentId (fixed)
  - usefulLife, remainingLife
  - currentReplacementCost (or study replacement cost if modeled)
  - notes/assumptions (optional)
- Table view with inline edit (optional) or row edit modal
- Validation: remainingLife cannot exceed usefulLife; costs must be positive

### 10.7 Funding Schedule (`/studies/[id]/funding-schedule`)
Must support:
- View multi-year rows (fiscalYear) with:
  - beginningBalance, contribution, interestEarnings, expenditures, endingBalance (exact fields depend on backend schema)
- Edit schedule rows in a controlled editor:
  - Add/remove years
  - Validate continuity (endingBalance of year N == beginningBalance of year N+1) (warning at minimum; hard validation optional)
- Show derived charts (optional MVP): ending balance over time, contribution plan over time

### 10.8 Export / Reporting (MVP)
- CSV export of:
  - Component inventory
  - Study component snapshots
  - Funding schedule
- Optional: “Reserve Studies” report entry under `/app/cam/reports` (category `FINANCIAL` or `OPERATIONAL`).

## 11. Audit & Activity Logging
All create/update/delete actions must generate auditable events (ActivityEvent).
UI must:
- Include meaningful operation summaries where supported by backend.
- Surface “last updated” timestamps and by-whom when backend supports.

## 12. Performance & Reliability Requirements
- List pages must load within 2 seconds for:
  - up to 2,000 components
  - up to 100 studies
- Pagination must be used where available; avoid loading unbounded data sets.
- UI must be resilient to retries (idempotencyKey usage).

## 13. Accessibility & i18n
- All forms must be keyboard navigable and screen-reader friendly.
- Monetary fields must display with currency formatting (current org default); multi-currency support is future-facing and must not block this phase.

## 14. Acceptance Criteria (MVP)
1. CAM can navigate to “Reserve Studies” and see an overview for the current association.
2. CAM can create, view, edit, and delete reserve components.
3. CAM can create a reserve study and view it in the studies list.
4. CAM can add components to a study and record snapshot values.
5. CAM can view and set a funding schedule for a study.
6. Authorization is enforced for all actions; unauthorized users cannot perform restricted operations.

## 15. Open Questions
- Should `ReserveStudy.documentId` be required for “official” studies?
- Should component inventory updates propagate to existing study snapshots (likely no; snapshots remain immutable)?
- Should the UI support multiple funding schedules per study (versioning), or only the latest overwrite?
- What is the canonical source for fiscal year configuration (association fiscalYearEnd vs organization defaults)?
