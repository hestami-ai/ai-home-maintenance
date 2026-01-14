# Phase 32: Reserve Studies CAM UI — Implementation Roadmap

**SRD Reference**: `(Phase 32) Reserve Studies CAM UI.md`  
**Status**: Not Started  
**Last Updated**: 2026-01-13

---

## Prerequisites Checklist

- [ ] Verify Prisma models exist: `ReserveComponent`, `ReserveStudy`, `ReserveStudyComponent`, `ReserveFundingSchedule`
- [ ] Verify backend API routes exist under `reserve` namespace
- [ ] Verify DBOS workflows exist for reserve operations
- [ ] Verify Cerbos policies exist for `reserveComponent` and `reserveStudy` resources
- [ ] Extract/verify API types in `$lib/api/cam.ts` from `types.generated.ts`

---

## Phase 1: Foundation & Navigation

### 1.1 Cerbos Policy Verification
- [ ] Verify `reserveComponent` policy exists with: create, view, update, delete, list
- [ ] Verify `reserveStudy` policy exists with: create, view, update, list
- [ ] Verify derived roles grant appropriate access (org_admin, org_manager, org_board_member, org_auditor)
- [ ] Add missing policies if needed

### 1.2 Type Extraction & Schema Setup
- [ ] Extract `ReserveComponent` type from `types.generated.ts` → `$lib/api/cam.ts`
- [ ] Extract `ReserveStudy` type from `types.generated.ts` → `$lib/api/cam.ts`
- [ ] Extract `ReserveStudyComponent` type
- [ ] Extract `ReserveFundingSchedule` type
- [ ] Export relevant enums (ReserveComponentCategory, ReserveStudyType, FundingPlanType)
- [ ] Run `bun run check` to verify types

### 1.3 CAM Navigation Update
- [ ] Add "Reserve Studies" entry to CAM sidebar navigation
- [ ] Route: `/app/cam/reserve-studies`
- [ ] Icon selection (Lucide)
- [ ] Permission-gated visibility (hide if user lacks reserveStudy:list)

### 1.4 Route Structure Setup
- [ ] Create `/app/cam/reserve-studies/+page.svelte` (overview)
- [ ] Create `/app/cam/reserve-studies/+page.server.ts`
- [ ] Create `/app/cam/reserve-studies/+layout.svelte` (shared layout)
- [ ] Create `/app/cam/reserve-studies/+layout.server.ts` (permission check)

---

## Phase 2: Component Inventory

### 2.1 Component List Page
- [ ] Create `/app/cam/reserve-studies/components/+page.svelte`
- [ ] Create `/app/cam/reserve-studies/components/+page.server.ts`
- [ ] Implement SSR data loading via `createDirectClient`
- [ ] Implement search (name, category, location)
- [ ] Implement filters (category, condition rating, remaining life)
- [ ] Implement sorting (name, category, remaining life, replacement cost, updated date)
- [ ] Implement pagination
- [ ] Display columns: name, category, remaining life, current replacement cost, condition rating
- [ ] Empty state with CTA to add component
- [ ] Permission check: hide "Add" button if no create permission

### 2.2 Component Create Page
- [ ] Create `/app/cam/reserve-studies/components/new/+page.svelte`
- [ ] Create `/app/cam/reserve-studies/components/new/+page.server.ts`
- [ ] Implement form with all required fields:
  - [ ] name (required)
  - [ ] category (required enum dropdown)
  - [ ] description, location (optional)
  - [ ] usefulLife (int > 0), remainingLife (int >= 0)
  - [ ] placedInServiceDate (optional date picker)
  - [ ] currentReplacementCost (required > 0, currency input)
  - [ ] inflationRate (optional >= 0)
  - [ ] quantity, unitOfMeasure (optional)
  - [ ] conditionRating (optional 1–10)
  - [ ] notes (optional textarea)
- [ ] Generate idempotencyKey on form mount
- [ ] Implement form validation (Zod)
- [ ] Call `reserve.createComponent` on submit
- [ ] Handle errors (field-level + banner)
- [ ] Navigate to component detail on success

### 2.3 Component Detail/Edit Page
- [ ] Create `/app/cam/reserve-studies/components/[id]/+page.svelte`
- [ ] Create `/app/cam/reserve-studies/components/[id]/+page.server.ts`
- [ ] Load component via `reserve.getComponent`
- [ ] Display all fields in view mode
- [ ] Implement edit mode toggle
- [ ] Implement update form with validation
- [ ] Call `reserve.updateComponent` on save
- [ ] Implement delete with confirmation modal
- [ ] Call `reserve.deleteComponent` on confirm
- [ ] Handle NOT_FOUND (redirect or error state)
- [ ] Optional: "Used in studies" list

---

## Phase 3: Studies Management

### 3.1 Studies List Page
- [ ] Create `/app/cam/reserve-studies/studies/+page.svelte`
- [ ] Create `/app/cam/reserve-studies/studies/+page.server.ts`
- [ ] Implement SSR data loading via `reserve.listStudies`
- [ ] Implement filters (study type, year, preparer)
- [ ] Implement sorting (studyDate desc default, createdAt desc)
- [ ] Display columns: studyDate, type, percentFunded, fundingPlanType, preparer, component count
- [ ] Pagination
- [ ] Empty state with CTA to create study
- [ ] "Create Study" button (permission-gated)

### 3.2 Study Create Page
- [ ] Create `/app/cam/reserve-studies/studies/new/+page.svelte`
- [ ] Create `/app/cam/reserve-studies/studies/new/+page.server.ts`
- [ ] Implement form with fields:
  - [ ] studyType (enum dropdown)
  - [ ] studyDate (required date)
  - [ ] effectiveDate (required date)
  - [ ] expirationDate (optional date)
  - [ ] preparerName (required)
  - [ ] preparerCompany, preparerCredentials (optional)
  - [ ] reserveBalance, fullyFundedBalance, recommendedContribution (currency inputs)
  - [ ] percentFunded (0–100 slider or input)
  - [ ] fundingPlanType (enum dropdown)
  - [ ] notes (optional textarea)
  - [ ] documentId (optional document picker)
- [ ] Generate idempotencyKey on form mount
- [ ] Implement form validation
- [ ] Call `reserve.createStudy` on submit
- [ ] Navigate to study detail on success
- [ ] Show prompt to "Add components to this study"

### 3.3 Study Detail Page
- [ ] Create `/app/cam/reserve-studies/studies/[id]/+page.svelte`
- [ ] Create `/app/cam/reserve-studies/studies/[id]/+page.server.ts`
- [ ] Load study via `reserve.getStudy`
- [ ] Display all metadata fields
- [ ] Summary tiles: percent funded, reserve balance, recommended contribution, fully funded balance
- [ ] Navigation links: "Study Components", "Funding Schedule", "Documents"
- [ ] Audit metadata: created at, updated at, created by
- [ ] Handle NOT_FOUND error state

---

## Phase 4: Study Components (Snapshots)

### 4.1 Study Components Page
- [ ] Create `/app/cam/reserve-studies/studies/[id]/components/+page.svelte`
- [ ] Create `/app/cam/reserve-studies/studies/[id]/components/+page.server.ts`
- [ ] Load snapshots via `reserve.getStudyComponents`
- [ ] Load available components via `reserve.listComponents` (for picker)
- [ ] Implement "Add component to study" picker (exclude already-linked)
- [ ] Table view with columns:
  - [ ] Component name (from inventory)
  - [ ] usefulLife, remainingLife (snapshot values)
  - [ ] currentReplacementCost (snapshot value)
  - [ ] notes/assumptions
- [ ] Implement row edit (modal or inline)
- [ ] Validation: remainingLife <= usefulLife, costs > 0
- [ ] Call `reserve.addStudyComponent` for new snapshots
- [ ] Generate idempotencyKey per add operation

---

## Phase 5: Funding Schedule

### 5.1 Funding Schedule Page
- [ ] Create `/app/cam/reserve-studies/studies/[id]/funding-schedule/+page.svelte`
- [ ] Create `/app/cam/reserve-studies/studies/[id]/funding-schedule/+page.server.ts`
- [ ] Load schedule via `reserve.getFundingSchedule`
- [ ] Display multi-year table:
  - [ ] fiscalYear
  - [ ] beginningBalance
  - [ ] contribution
  - [ ] interestEarnings
  - [ ] expenditures
  - [ ] endingBalance
- [ ] Implement schedule editor:
  - [ ] Add year row
  - [ ] Remove year row
  - [ ] Edit row values
- [ ] Validation: continuity warning (endingBalance N == beginningBalance N+1)
- [ ] Call `reserve.setFundingSchedule` on save
- [ ] Generate idempotencyKey per save operation
- [ ] Optional: ending balance chart over time

---

## Phase 6: Overview Dashboard

### 6.1 Overview Page Implementation
- [ ] Implement `/app/cam/reserve-studies/+page.svelte` content
- [ ] Load latest study via `reserve.listStudies` (limit 1, sorted by date)
- [ ] Load component counts via `reserve.listComponents`
- [ ] Display latest study summary (if exists):
  - [ ] Study date, type, percent funded, preparer
- [ ] Display component inventory counts (optional: by category)
- [ ] Quick action buttons:
  - [ ] "Add Component" → `/components/new`
  - [ ] "Create Study" → `/studies/new`
  - [ ] "View Studies" → `/studies`
  - [ ] "View Funding Schedule" → latest study's funding schedule
- [ ] Empty states:
  - [ ] "No reserve study yet" with CTA
  - [ ] "No components" with CTA

---

## Phase 7: Export & Reporting

### 7.1 CSV Export Implementation
- [ ] Component inventory CSV export (client-side generation)
- [ ] Study component snapshots CSV export
- [ ] Funding schedule CSV export
- [ ] Add export buttons to relevant list pages

### 7.2 Reports Integration (Optional)
- [ ] Add "Reserve Studies" report entry under `/app/cam/reports`
- [ ] Category: FINANCIAL or OPERATIONAL

---

## Phase 8: Polish & Validation

### 8.1 Error Handling
- [ ] Implement standard error banner component usage
- [ ] Handle NOT_FOUND errors gracefully
- [ ] Handle VALIDATION_FAILED with field-level errors
- [ ] Handle INTERNAL_SERVER_ERROR with retry guidance

### 8.2 Accessibility
- [ ] Keyboard navigation for all forms
- [ ] Screen reader labels for all inputs
- [ ] Focus management on modals
- [ ] ARIA attributes on interactive elements

### 8.3 Performance
- [ ] Verify list pages load < 2 seconds with 2,000 components
- [ ] Verify pagination works correctly
- [ ] Verify no unbounded data loading

### 8.4 Final Verification
- [ ] Run `bun run check` — must pass
- [ ] Test all CRUD operations for components
- [ ] Test study creation and viewing
- [ ] Test study component snapshots
- [ ] Test funding schedule CRUD
- [ ] Test authorization enforcement (unauthorized user cannot access)
- [ ] Test idempotency (retry same operation with same key)

---

## Acceptance Criteria Verification

- [ ] **AC1**: CAM can navigate to "Reserve Studies" and see overview for current association
- [ ] **AC2**: CAM can create, view, edit, and delete reserve components
- [ ] **AC3**: CAM can create a reserve study and view it in studies list
- [ ] **AC4**: CAM can add components to a study and record snapshot values
- [ ] **AC5**: CAM can view and set a funding schedule for a study
- [ ] **AC6**: Authorization enforced for all actions; unauthorized users blocked

---

## Open Questions (Resolve Before Implementation)

- [ ] Should `ReserveStudy.documentId` be required for "official" studies?
- [ ] Should component inventory updates propagate to existing study snapshots? (Likely no)
- [ ] Should UI support multiple funding schedules per study (versioning)?
- [ ] What is canonical source for fiscal year configuration?

---

## Notes

- All mutations use DBOS workflows with `idempotencyKey` as `workflowID`
- Use `createDirectClient` for SSR data loading in `+page.server.ts`
- Extract types from `types.generated.ts`, never import Prisma types client-side
- Follow oRPC `.errors()` pattern, never throw `ApiException` directly
- Currency formatting uses org default; multi-currency is future scope
