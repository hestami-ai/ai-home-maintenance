# Phase 6 — CAM Navigation Implementation Roadmap
## CAM Navigation & Domain Information Architecture

**Status:** In Progress (Core UI Complete, API Integration Complete, Workflow Modals Complete)  
**Dependencies:** Phase 5 Platform UX complete  
**Scope:** CAM pillar navigation, split-view patterns, dashboard, and all 11 navigation destinations

---

## Overview

Phase 6 implements the **CAM Navigation & Domain Information Architecture** as defined in the Phase 6 IA document. This phase builds the complete CAM user experience including:

- Canonical left navigation sidebar (11 fixed items)
- Association context selector (for management companies)
- Split-view list + detail pattern components
- Tabbed detail panel pattern
- Dashboard with actionable sections
- All domain-specific operational screens

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

## Design Decisions

1. **Navigation Order:** Fixed and non-negotiable per IA document
2. **Permission-Based Visibility:** Items hidden (not reordered) based on Cerbos permissions
3. **Badge Counts:** Only on Violations, ARC Requests, Work Orders
4. **Association Context:** Required for all CAM operations; auto-selected for single-association orgs
5. **Split-View Pattern:** Reusable component for all list+detail screens
6. **Tabbed Detail Pattern:** Overview, Documents, History/Audit tabs on all detail views

---

## P6.1 Foundation — CAM Layout & Navigation

### P6.1.1 CAM Layout Structure

- [x] Create `/app/cam/+layout.svelte` with CAM-specific sidebar
- [x] Implement responsive layout (sidebar collapsible on mobile)
- [x] Add association context header bar (shows current association)
- [x] Integrate with existing app layout (header, theme)

### P6.1.2 CAM Sidebar Navigation Component

- [x] Create `$lib/components/cam/CamSidebar.svelte`
- [x] Implement fixed navigation order:
  1. Dashboard
  2. Associations
  3. Units & Properties
  4. Violations
  5. ARC Requests
  6. Work Orders
  7. Vendors
  8. Documents & Records
  9. Accounting
  10. Governance
  11. Reports
- [x] Add icons for each nav item (Lucide)
- [x] Implement active state highlighting
- [x] Add badge count support for Violations, ARC Requests, Work Orders
- [x] Implement permission-based visibility (hide unauthorized items)

### P6.1.3 Association Context Selector

- [x] Create `$lib/components/cam/AssociationSelector.svelte`
- [x] Fetch user's accessible associations via API
- [x] Auto-select if only one association
- [x] Show selector dropdown for management companies with multiple associations
- [x] Store selected association in context/store
- [x] Redirect to association selection if none selected (inline selector shown)

### P6.1.4 CAM Stores

- [x] Create `$lib/stores/cam.ts` for CAM-specific state:
  - Current association context
  - Badge counts (violations, ARC, work orders)
  - Navigation state
- [x] Implement badge count fetching (API calls)
- [x] Auto-refresh badge counts on relevant actions

### Deliverables
- [x] CAM layout with sidebar navigation
- [x] Association context selector
- [x] Badge counts on nav items
- [x] Permission-based nav visibility

---

## P6.2 Reusable UX Pattern Components

### P6.2.1 Split-View Layout Component

- [x] Create `$lib/components/cam/SplitView.svelte`
- [x] Props: list slot, detail slot, responsive breakpoints
- [x] Implement list panel (left, scrollable)
- [x] Implement detail panel (right, scrollable)
- [x] Mobile: full-screen list, slide-in detail
- [x] Support empty state for no selection
- [x] Support loading states

### P6.2.2 List Panel Component

- [x] Create `$lib/components/cam/ListPanel.svelte`
- [x] Props: items, selected, onSelect, loading, empty state
- [x] Implement search input and filter controls
- [x] Support pagination (cursor-based)
- [x] Bulk selection (optional) - bulkSelection, selectedCount, totalCount, onSelectAll, onDeselectAll, bulkActions props

### P6.2.3 Detail Panel Component

- [x] Create `$lib/components/cam/DetailPanel.svelte`
- [x] Props: tabs, activeTab, header slot, actions slot
- [x] Implement tabbed navigation (Overview, Documents, History)
- [x] Implement header with title and action buttons
- [x] Support loading and empty states

### P6.2.4 Tabbed Content Component

- [x] Create `$lib/components/cam/TabbedContent.svelte`
- [x] Standard tabs: Overview, Documents, History/Audit
- [x] Support custom tabs per domain
- [x] Lazy-load tab content (lazyLoad prop, badge support)

### P6.2.5 Action Button Patterns

- [x] Create `$lib/components/cam/DecisionButton.svelte`
- [x] Explicit decision buttons (Approve, Deny, Escalate, etc.)
- [x] Require rationale modal for governance actions
- [x] Loading and disabled states

### P6.2.6 Rationale Modal

- [x] Create `$lib/components/cam/RationaleModal.svelte`
- [x] Required for governance actions per IA
- [x] Text area for rationale
- [x] Confirm/Cancel buttons
- [x] Validation (non-empty rationale)

### Deliverables
- [x] Split-view layout component
- [x] List and detail panel components
- [x] Tabbed content component
- [x] Decision buttons with rationale support

---

## P6.3 Dashboard — Actionable Overview

### P6.3.1 Dashboard Page Structure

- [x] Refactor `/app/cam/+page.svelte` to match IA spec
- [x] Create `/app/cam/+page.server.ts` for data loading
- [x] Implement three fixed sections:
  1. Requires Action
  2. Risk & Compliance
  3. Financial Attention

### P6.3.2 Requires Action Section

- [x] Create `$lib/components/cam/dashboard/RequiresActionCard.svelte`
- [x] Pending ARC approvals (count + deep link)
- [x] Escalated violations (count + deep link)
- [x] Overdue work orders (count + deep link)
- [x] Each card links to split-view operational screen

### P6.3.3 Risk & Compliance Section

- [x] Create `$lib/components/cam/dashboard/RiskComplianceCard.svelte`
- [x] Open violations by severity (chart or breakdown)
- [x] Repeat offenders list
- [x] Deep links to filtered violation views

### P6.3.4 Financial Attention Section

- [x] Create `$lib/components/cam/dashboard/FinancialAttentionCard.svelte`
- [x] Overdue assessments (count + amount)
- [x] Budget exceptions
- [x] Deep links to accounting views

### P6.3.5 Dashboard API Integration

- [ ] Create/verify backend endpoints for dashboard aggregates:
  - `GET /api/v1/rpc/dashboard/requiresAction`
  - `GET /api/v1/rpc/dashboard/riskCompliance`
  - `GET /api/v1/rpc/dashboard/financialAttention`
- [x] Implement API calls in page server load (client-side via API client)

### Deliverables
- [x] Dashboard with three actionable sections
- [x] Real data from backend APIs (client-side fetching based on association context)
- [x] Deep links to operational screens

---

## P6.4 Associations

### P6.4.1 Associations List Page

- [x] Create `/app/cam/associations/+page.svelte`
- [ ] Create `/app/cam/associations/+page.server.ts` (currently using client-side API)
- [x] Implement split-view with association list
- [x] Show association name, status, unit count
- [x] For management companies: list all managed associations
- [ ] For single association orgs: redirect to detail or show single item

### P6.4.2 Association Detail View

- [x] Create `/app/cam/associations/[id]/+page.svelte`
- [x] Implement tabbed detail panel:
  - **Overview:** Name, legal name, status, fiscal year, settings
  - **Documents:** Governing documents linked to association
  - **History:** Activity events for association
- [x] Action buttons: Edit, Manage Settings

### P6.4.3 Edit Association

- [x] Create `/app/cam/associations/[id]/edit/+page.svelte`
- [x] Form: name, legal name, status, fiscal year, contact info
- [ ] Superforms validation
- [x] API integration with `association/update`

### Deliverables
- [x] Associations list with split-view
- [x] Association detail with tabs
- [x] Edit functionality

---

## P6.5 Units & Properties

### P6.5.1 Units List Page

- [x] Create `/app/cam/units/+page.svelte`
- [ ] Create `/app/cam/units/+page.server.ts` (currently using client-side API)
- [x] Split-view: list of units with property grouping
- [x] Search/filter by unit number, property, owner
- [x] Show unit number, type, owner name, status

### P6.5.2 Unit Detail View

- [x] Create `/app/cam/units/[id]/+page.svelte`
- [x] Tabbed detail panel:
  - **Overview:** Unit info, current owner(s), tenant(s)
  - **Documents:** Unit-specific documents
  - **History:** Activity events, ownership history
- [x] Quick links to violations, ARC requests, work orders for this unit

### P6.5.3 Edit Unit

- [x] Create `/app/cam/units/[id]/edit/+page.svelte`
- [x] Form: unit number, type, status, address, details
- [x] API integration with `unit/update`

### P6.5.4 Properties List/Detail

- [x] Create `/app/cam/properties/+page.svelte`
- [x] Property overview with unit count, common areas
- [x] Property detail with tabs (`/app/cam/properties/[id]`)

### P6.5.5 Unit/Property CRUD

- [x] Create unit form (`/app/cam/units/new`)
- [x] Edit unit form
- [x] Create property form (`/app/cam/properties/new`)
- [x] Edit property form (`/app/cam/properties/[id]/edit`)
- [x] API integration with `unit/*` and `property/*` endpoints

### Deliverables
- [x] Units & Properties split-view
- [x] Unit detail with tabs
- [x] Edit unit form
- [x] Create unit form
- [x] Property detail page

---

## P6.6 Violations

### P6.6.1 Violations List Page

- [x] Create `/app/cam/violations/+page.svelte`
- [ ] Create `/app/cam/violations/+page.server.ts` (currently using client-side API)
- [x] Split-view with violation list
- [x] Filter by status, severity, unit, date range
- [x] Show violation number, title, status, severity, unit
- [x] Badge count integration

### P6.6.2 Violation Detail View

- [x] Create `/app/cam/violations/[id]/+page.svelte`
- [x] Tabbed detail panel:
  - **Overview:** Violation info, responsible party, timeline
  - **Documents:** Evidence, notices
  - **History:** Status history, notices sent, hearings
- [x] Action buttons: Send Notice, Escalate, Schedule Hearing, Close
- [x] Rationale required for status changes

### P6.6.3 Create Violation

- [x] Create `/app/cam/violations/new/+page.svelte`
- [x] Form: unit selection, violation type, description, severity, evidence upload
- [ ] Superforms validation
- [x] API integration with `violation/create`

### P6.6.4 Edit Violation

- [x] Create `/app/cam/violations/[id]/edit/+page.svelte`
- [x] Form: edit unit, type, description, severity, dates
- [x] API integration with `violation/update`

### P6.6.5 Violation Workflow Actions

- [x] Send notice modal (select template, preview, send)
- [x] Schedule hearing modal
- [x] Assess fine modal
- [x] Close/cure violation with rationale

### Deliverables
- [x] Violations split-view with filters
- [x] Violation detail with full workflow
- [x] Create violation form
- [x] Workflow action modals

---

## P6.7 ARC Requests

### P6.7.1 ARC Requests List Page

- [x] Create `/app/cam/arc/+page.svelte`
- [ ] Create `/app/cam/arc/+page.server.ts` (currently using client-side API)
- [x] Split-view with ARC request list
- [x] Filter by status, category, unit, date
- [x] Show request number, title, status, category, unit
- [x] Badge count integration

### P6.7.2 ARC Request Detail View

- [x] Create `/app/cam/arc/[id]/+page.svelte`
- [x] Tabbed detail panel:
  - **Overview:** Request info, submitter, project details
  - **Documents:** Plans, specs, photos, permits
  - **History:** Review history, status changes
- [x] Action buttons: Approve, Deny, Request Changes, Table
- [x] Rationale required for all decisions

### P6.7.3 ARC Submit Request

- [x] Create `/app/cam/arc/new/+page.svelte`
- [x] Form: unit selection, category, description, project scope, cost, timeline
- [x] API integration with `arcRequest/create`

### P6.7.4 ARC Review Workflow

- [x] Review decision modal with rationale (ARCDecisionModal)
- [ ] Committee assignment (if applicable)
- [x] Conditions/stipulations input for conditional approvals

### Deliverables
- [x] ARC Requests split-view
- [x] ARC detail with review workflow
- [x] Decision modals with rationale
- [x] Submit ARC request form

---

## P6.8 Work Orders

### P6.8.1 Work Orders List Page

- [x] Create `/app/cam/work-orders/+page.svelte`
- [ ] Create `/app/cam/work-orders/+page.server.ts` (currently using client-side API)
- [x] Split-view with work order list
- [x] Filter by status, priority, category, vendor, date
- [x] Show WO number, title, status, priority, assigned vendor
- [x] Badge count integration

### P6.8.2 Work Order Detail View

- [x] Create `/app/cam/work-orders/[id]/+page.svelte`
- [x] Tabbed detail panel:
  - **Overview:** WO info, location, description, vendor, schedule
  - **Documents:** Photos, invoices, bids
  - **History:** Status history, activity log
- [x] Action buttons: Assign Vendor, Schedule, Complete, Close

### P6.8.3 Create Work Order

- [x] Create `/app/cam/work-orders/new/+page.svelte`
- [x] Form: location (unit/common area), category, priority, description
- [x] Optional: request bids, assign vendor
- [x] API integration with `workOrder/create`

### P6.8.4 Edit Work Order

- [x] Create `/app/cam/work-orders/[id]/edit/+page.svelte`
- [x] Form: edit location, category, priority, description, vendor, due date
- [x] API integration with `workOrder/update`

### P6.8.5 Work Order Workflow

- [x] Vendor assignment modal (AssignVendorModal)
- [ ] Bid request/review flow
- [x] Schedule work modal (ScheduleWorkModal)
- [x] Complete/close with notes (CompleteWorkOrderModal)

### Deliverables
- [x] Work Orders split-view
- [x] Work order detail with workflow
- [x] Create work order form
- [x] Edit work order form

---

## P6.9 Vendors

### P6.9.1 Vendors List Page

- [x] Create `/app/cam/vendors/+page.svelte`
- [ ] Create `/app/cam/vendors/+page.server.ts` (currently using client-side API)
- [x] Split-view with approved vendor list
- [x] Filter by trade type, approval status
- [x] Show vendor name, trades, approval status, contact

### P6.9.2 Vendor Detail View

- [x] Create `/app/cam/vendors/[id]/+page.svelte`
- [x] Tabbed detail panel:
  - **Overview:** Vendor info, contact, trades, approval status
  - **Documents:** Insurance, licenses, contracts
  - **History:** Work order history, performance
- [x] Action buttons: Edit, Suspend, Remove

### P6.9.3 Add/Manage Vendor

- [x] Add vendor form (`/app/cam/vendors/new`)
- [x] Edit vendor form (`/app/cam/vendors/[id]/edit`)
- [x] Approval workflow (VendorApprovalModal)
- [x] Document upload for compliance (UploadComplianceDocModal)

### Deliverables
- [x] Vendors split-view
- [x] Vendor detail with documents
- [x] Add/edit vendor forms

---

## P6.10 Documents & Records

### P6.10.1 Documents List Page

- [x] Create `/app/cam/documents/+page.svelte`
- [ ] Create `/app/cam/documents/+page.server.ts` (currently using client-side API)
- [x] Split-view with document list
- [x] Filter by category, visibility, date, context
- [x] Show document name, category, visibility, date

### P6.10.2 Document Detail View

- [x] Create `/app/cam/documents/[id]/+page.svelte`
- [x] Tabbed detail panel:
  - **Overview:** Document info, visibility, linked contexts
  - **Preview:** Document preview (PDF, image)
  - **History:** Version history, access log
- [x] Action buttons: Download, Edit Metadata, Archive

### P6.10.3 Upload Document

- [x] Create `/app/cam/documents/upload/+page.svelte`
- [x] Form: file upload, category, visibility, context binding
- [x] API integration with `document/create`

### Deliverables
- [x] Documents split-view
- [x] Document detail with preview
- [x] Upload functionality

---

## P6.11 Accounting

### P6.11.1 Accounting Overview Page

- [x] Create `/app/cam/accounting/+page.svelte`
- [x] Sub-navigation or tabs for accounting areas:
  - Assessments
  - Receivables
  - Payables
  - GL/Journal
  - Bank Accounts

### P6.11.2 Assessments

- [x] Create `/app/cam/accounting/assessments/+page.svelte`
- [x] List of assessment charges by unit
- [x] Filter by status (due, overdue, paid)
- [x] Detail view with payment history

### P6.11.3 Receivables

- [x] Create `/app/cam/accounting/receivables/+page.svelte`
- [x] Aged receivables view
- [x] Delinquency tracking

### P6.11.4 Payables

- [x] Create `/app/cam/accounting/payables/+page.svelte`
- [x] AP invoices list
- [x] Vendor payment tracking

### P6.11.5 GL/Journal

- [x] Create `/app/cam/accounting/gl/+page.svelte`
- [x] Chart of accounts
- [x] Journal entries

### Deliverables
- [x] Accounting section with sub-areas
- [x] Assessments, receivables, payables views
- [x] GL/Journal access

---

## P6.12 Governance

### P6.12.1 Governance Overview Page

- [x] Create `/app/cam/governance/+page.svelte`
- [x] Sub-navigation for governance areas:
  - Board
  - Meetings
  - Resolutions
  - Policies

### P6.12.2 Board Management

- [x] Create `/app/cam/governance/board/+page.svelte`
- [x] Current board members list
- [x] Board member detail with term info
- [x] Add/remove board member (AddBoardMemberModal)

### P6.12.3 Meetings

- [x] Create `/app/cam/governance/meetings/+page.svelte`
- [x] Split-view with meeting list
- [x] Meeting detail: agenda, minutes, attendance, motions
- [x] Schedule meeting form (ScheduleMeetingModal)

### P6.12.4 Resolutions

- [x] Create `/app/cam/governance/resolutions/+page.svelte`
- [x] Resolution list with status
- [x] Resolution detail with voting record

### P6.12.5 Policies

- [x] Create `/app/cam/governance/policies/+page.svelte`
- [x] Policy document list
- [x] Policy detail with version history

### Deliverables
- [x] Governance section with sub-areas
- [x] Board, meetings, resolutions, policies views

---

## P6.13 Reports

### P6.13.1 Reports Overview Page

- [x] Create `/app/cam/reports/+page.svelte`
- [ ] Create `/app/cam/reports/+page.server.ts` (currently using client-side API)
- [x] List of available report definitions
- [x] Filter by category (Financial, Operational, Compliance, etc.)

### P6.13.2 Report Execution

- [x] Create `/app/cam/reports/[id]/+page.svelte`
- [x] Report parameters form
- [x] Execute report and show results
- [x] Export options (PDF, Excel, CSV)

### P6.13.3 Report Scheduling

- [x] Create `/app/cam/reports/[id]/schedule/+page.svelte`
- [x] Schedule recurring report execution
- [x] Delivery method configuration

### P6.13.4 Dashboard Widgets

- [x] Integrate with dashboard widget system (DashboardWidget, ReportWidget, UpcomingMeetingsWidget)
- [ ] Custom widget configuration

### Deliverables
- [x] Reports list and execution
- [x] Report scheduling
- [x] Export functionality

---

## P6.14 Backend API Gaps

### P6.14.1 Dashboard Aggregate Endpoints

- [ ] Audit existing APIs for dashboard data needs
- [ ] Create `dashboard/getRequiresAction` if missing
- [ ] Create `dashboard/getRiskCompliance` if missing
- [ ] Create `dashboard/getFinancialAttention` if missing

### P6.14.2 Badge Count Endpoints

- [ ] Create `cam/getBadgeCounts` endpoint:
  - Open violations count
  - Pending ARC requests count
  - Active work orders count

### P6.14.3 List Filtering Enhancements

- [ ] Verify all list endpoints support required filters
- [ ] Add missing filter parameters as needed

### Deliverables
- [ ] Dashboard aggregate APIs
- [x] Badge count API (fetchBadgeCounts in cam.ts, loadBadgeCounts in store)
- [ ] Enhanced list filtering

---

## P6.15 Cerbos Policy Verification

### P6.15.1 Navigation Visibility Policies

- [ ] Verify policies exist for all CAM resource types
- [ ] Test permission-based nav item hiding
- [ ] Add missing policies if needed

### P6.15.2 Action Authorization

- [ ] Verify policies for all workflow actions
- [ ] Test rationale-required actions
- [ ] Ensure audit trail for authorized actions

### Deliverables
- [ ] Verified Cerbos policies for CAM
- [ ] Permission-based UI working

---

## P6.16 Testing & Polish

### P6.16.1 Flow Testing

- [ ] Test complete CAM navigation flow
- [ ] Test split-view interactions on all screen sizes
- [ ] Test all workflow actions with rationale
- [ ] Test badge count updates

### P6.16.2 Responsive Design

- [ ] Mobile sidebar behavior
- [ ] Mobile split-view (list/detail toggle)
- [ ] Touch-friendly interactions

### P6.16.3 Accessibility

- [ ] Keyboard navigation for sidebar
- [ ] Screen reader labels
- [ ] Focus management in modals

### P6.16.4 Performance

- [x] Lazy-load tab content (TabbedContent lazyLoad prop)
- [ ] Optimize list rendering
- [ ] Cache badge counts appropriately

### Deliverables
- [ ] All flows tested
- [ ] Responsive design verified
- [ ] Accessibility basics covered

---

## Implementation Order

1. **P6.1** Foundation — CAM Layout & Navigation
2. **P6.2** Reusable UX Pattern Components
3. **P6.3** Dashboard — Actionable Overview
4. **P6.14** Backend API Gaps (parallel with frontend)
5. **P6.4** Associations
6. **P6.5** Units & Properties
7. **P6.6** Violations
8. **P6.7** ARC Requests
9. **P6.8** Work Orders
10. **P6.9** Vendors
11. **P6.10** Documents & Records
12. **P6.11** Accounting
13. **P6.12** Governance
14. **P6.13** Reports
15. **P6.15** Cerbos Policy Verification
16. **P6.16** Testing & Polish

---

## Dependencies

| Phase | Dependency |
|-------|------------|
| P6.1 | Phase 5 complete (auth, layout, org context) |
| P6.3 | P6.1, P6.2 complete |
| P6.4-P6.13 | P6.1, P6.2 complete |
| P6.14 | Can run parallel with frontend work |
| P6.15 | P6.4-P6.13 complete |
| P6.16 | All previous phases complete |

---

## Success Criteria

1. CAM users see fixed 11-item navigation sidebar
2. Navigation items hidden (not reordered) based on permissions
3. Badge counts appear on Violations, ARC Requests, Work Orders
4. Dashboard shows actionable sections with real data
5. All screens use split-view list + detail pattern
6. All detail views have Overview, Documents, History tabs
7. Governance actions require rationale
8. Association context is always explicit
9. All actions produce audit trail via activity events
10. Responsive design works on mobile

---

## Future Enhancements (Not in Phase 6)

- **Bulk Operations** — Multi-select and bulk actions on lists
- **Advanced Filtering** — Saved filters, complex queries
- **Keyboard Shortcuts** — Power user navigation
- **Real-time Updates** — WebSocket for live badge counts
- **AI Assistance** — AI-suggested actions on dashboard
- **Custom Dashboard** — User-configurable dashboard widgets

---

## Non-Goals (Phase 6)

- Cross-pillar navigation (Concierge, Contractor)
- Mobile native apps
- Offline support
- AI-powered features
- Advanced analytics beyond basic reports
