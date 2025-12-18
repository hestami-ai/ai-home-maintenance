# CAM UX #6 — Dashboard Implementation Roadmap

## Overview

This roadmap implements the CAM Dashboard as specified in **(Phase 12) CAM UX 6 - Dashboard (Derived View).md**. The dashboard is a **derived view** that surfaces data from existing domain screens (Violations, ARC, Work Orders, Governance, Financials) without introducing new business logic.

**Key Constraint**: The dashboard is an **action queue**, not a command center. It points, prioritizes, and routes—never replaces canonical workflows.

---

## Current State Assessment

### Existing Infrastructure
- **Backend API**: `src/lib/server/api/routes/report/dashboard.ts` exists with:
  - Widget CRUD operations (createWidget, listWidgets, updateWidget, deleteWidget, reorderWidgets)
  - `getSummary` endpoint with basic aggregations (financials, operations, compliance)
- **Frontend**: `src/routes/app/cam/+page.svelte` with partial dashboard implementation
- **Components**: `src/lib/components/cam/dashboard/` contains:
  - `RequiresActionCard.svelte` (partial)
  - `RiskComplianceCard.svelte` (partial)
  - `FinancialAttentionCard.svelte` (partial)
  - `ReportWidget.svelte`
  - `UpcomingMeetingsWidget.svelte`
- **Audit Infrastructure**: `activityEvent.ts` fully implemented with `recordActivityFromContext()`
- **Charting**: ApexCharts available via Flowbite-Svelte dependency
- **Prisma Schema**: Organization → Association hierarchy properly modeled

### Gaps Identified
1. Backend `getSummary` lacks several required data points (e.g., oldest ARC age, governance pending actions)
2. No dedicated dashboard aggregation endpoint for all four sections
3. Frontend components missing deep links and proper filtering
4. No audit logging for dashboard interactions
5. Missing "Recent Governance Activity" section entirely

---

## Implementation Phases

### Phase 1: Backend API Enhancement
**Goal**: Create comprehensive dashboard aggregation endpoint

#### 1.1 Extend Dashboard Router Schema ✅ COMPLETED
- [x] Define Zod schemas for all four dashboard sections
- [x] Create `DashboardRequiresActionSchema` with:
  - Pending ARC count + oldest age
  - Escalated violations count by severity
  - Work orders awaiting authorization count + budget flag
  - Governance actions pending (meetings needing minutes, motions awaiting votes)
- [x] Create `DashboardRiskComplianceSchema` with:
  - Open violations by severity
  - Repeat violations by unit (top 5)
  - Overdue ARC requests count
  - Long-running work orders count
- [x] Create `DashboardFinancialAttentionSchema` with:
  - Overdue assessments count
  - Work orders exceeding budget count
  - Reserve-funded work pending approval count
- [x] Create `DashboardRecentGovernanceSchema` with:
  - Recently approved ARC requests (last 30 days)
  - Recently closed violations (last 30 days)
  - Approved motions (last 30 days)
  - New policies/resolutions (last 30 days)

#### 1.2 Implement Dashboard Aggregation Endpoint ✅ COMPLETED
- [x] Create `getDashboardData` oRPC procedure in `dashboard.ts`
- [x] Implement `requiresAction` data aggregation
- [x] Implement `riskCompliance` data aggregation
- [x] Implement `financialAttention` data aggregation
- [x] Implement `recentGovernance` data aggregation
- [x] Add date range filter support (schema defined)
- [x] Add association filter support (for multi-association orgs)
- [x] Add severity filter support (where applicable)

#### 1.3 Cerbos Authorization ✅ COMPLETED
- [x] Verify `dashboard_widget` resource policy exists
- [x] Ensure `view` action inherits from existing domain policies
- [ ] Test authorization for all user roles (Manager, Board Member, Staff, Auditor) — *manual testing pending*

---

### Phase 2: Frontend Type Definitions ✅ COMPLETED
**Goal**: Centralize dashboard types in `cam.ts`

#### 2.1 Update Type Definitions ✅ COMPLETED
- [x] Add `DashboardRequiresAction` type to `src/lib/api/cam.ts` (derived from generated OpenAPI types)
- [x] Add `DashboardRiskCompliance` type
- [x] Add `DashboardFinancialAttention` type
- [x] Add `DashboardRecentGovernance` type
- [x] Add `DashboardData` composite type
- [x] Add `DashboardFilters` type (dateRange, associationId, severity)

#### 2.2 Update API Client ✅ COMPLETED
- [x] Add `dashboardApi.getData()` method
- [x] Add `dashboardApi.recordView()` method (for audit)
- [x] Add `dashboardApi.getSummary()` method (legacy endpoint)

---

### Phase 3: Section 1 — Requires Action (Primary) ✅ COMPLETED
**Goal**: Implement the primary action queue section

#### 3.1 Backend Data ✅ COMPLETED
- [x] Query pending ARC decisions with oldest submission date
- [x] Query escalated violations grouped by severity
- [x] Query work orders in SUBMITTED status awaiting board approval
- [x] Query meetings requiring minutes approval
- [x] Query motions in PENDING vote status

#### 3.2 Frontend Component ✅ COMPLETED
- [x] Update `RequiresActionCard.svelte` with all required cards:
  - [x] Pending ARC Decisions card (count + oldest age + deep link)
  - [x] Escalated Violations card (count by severity + deep link)
  - [x] Work Orders Awaiting Authorization card (count + budget flag + deep link)
  - [x] Governance Actions Pending card (minutes + motions + deep link)
- [x] Implement urgency badges (not priority)
- [x] Implement deep links with proper filter parameters
- [x] Remove any inline action buttons (navigation only)

---

### Phase 4: Section 2 — Risk & Compliance ✅ COMPLETED
**Goal**: Show patterns, not individual records

#### 4.1 Backend Data ✅ COMPLETED
- [x] Aggregate open violations by severity
- [x] Identify repeat violations by unit (units with 2+ violations)
- [x] Count overdue ARC requests (past SLA)
- [x] Identify long-running work orders (open > 30 days)

#### 4.2 Frontend Component ✅ COMPLETED
- [x] Update `RiskComplianceCard.svelte`:
  - [x] Violations by severity visualization (horizontal stacked bar)
  - [x] Repeat violations by unit list (top 5)
  - [x] Overdue ARC requests count
  - [x] Long-running work orders count
- [x] CSS-based severity bar (ApexCharts not needed for this simple visualization)
- [x] Implement click-through to filtered lists
- [x] Remove configuration knobs

---

### Phase 5: Section 3 — Financial Attention ✅ COMPLETED
**Goal**: Highlight financial conditions requiring governance action

#### 5.1 Backend Data ✅ COMPLETED
- [x] Count overdue assessments (past due date, balance > 0)
- [x] Identify work orders exceeding budget threshold
- [x] Count reserve-funded work pending approval

#### 5.2 Frontend Component ✅ COMPLETED
- [x] Update `FinancialAttentionCard.svelte`:
  - [x] Overdue assessments card (count + amount + deep link)
  - [x] Work orders exceeding budget card (count + deep link)
  - [x] Reserve-funded work pending card (count + deep link)
- [x] Show source of truth labels
- [x] Implement deep links only (no inline edits)

---

### Phase 6: Section 4 — Recent Governance Activity ✅ COMPLETED
**Goal**: Maintain decision awareness and transparency

#### 6.1 Backend Data ✅ COMPLETED
- [x] Query recently approved ARC requests (last 30 days)
- [x] Query recently closed violations (last 30 days)
- [x] Query approved motions (last 30 days)
- [x] Query adopted resolutions (last 30 days)
- [x] Include actor information (role-based)

#### 6.2 Frontend Component ✅ COMPLETED
- [x] Create `RecentGovernanceCard.svelte`:
  - [x] Chronological activity feed
  - [x] Read-only display
  - [x] Actor visible (role-based)
  - [x] Deep links to source records
- [x] Export from `src/lib/components/cam/dashboard/index.ts`

---

### Phase 7: Dashboard Layout & Filters ✅ COMPLETED
**Goal**: Implement fixed layout with global filters

#### 7.1 Layout Implementation ✅ COMPLETED
- [x] Update `src/routes/app/cam/+page.svelte` with fixed section order:
  1. Requires Action
  2. Risk & Compliance
  3. Financial Attention
  4. Recent Governance Activity
- [x] Remove any drag-and-drop functionality
- [x] Implement responsive 2-column grid layout
- [x] Add refresh button and loading/error states
- [x] Show last updated timestamp

#### 7.2 Filter Implementation — PARTIAL
- [x] Filter schema defined in backend (DashboardFiltersSchema)
- [ ] Add date range filter UI (global) — *deferred*
- [ ] Add association selector UI (if multi-association) — *deferred*
- [ ] Add severity filter UI (where applicable) — *deferred*
- [x] No per-card filters
- [x] No saved views

---

### Phase 8: Audit Logging ✅ COMPLETED
**Goal**: Track dashboard interactions for accountability

#### 8.1 Implement Audit Events ✅ COMPLETED
- [x] Record "dashboard viewed" event on page load
- [x] Record "card clicked" event with navigation intent (endpoint ready)
- [x] Record "filter applied" event (endpoint ready)
- [x] Use `recordActivityFromContext()` from `activityEvent.ts`
- [x] Use `entityType: 'OTHER'` and `action: 'CUSTOM'` (dashboard is a derived view, not a domain entity)

#### 8.2 Audit Event Schema ✅ COMPLETED
- [x] Define metadata schema for dashboard events:
  ```typescript
  {
    dashboardEventType: 'DASHBOARD_VIEWED' | 'CARD_CLICKED' | 'FILTER_APPLIED',
    section?: string,
    card?: string,
    targetUrl?: string,
    filters?: { dateRange?, associationId?, severity? }
  }
  ```

---

### Phase 9: Testing & Validation
**Goal**: Ensure dashboard meets spec requirements

#### 9.1 Unit Tests
- [ ] Test dashboard aggregation endpoint
- [ ] Test Cerbos authorization for each role
- [ ] Test filter combinations

#### 9.2 Integration Tests
- [ ] Test deep links navigate to correctly filtered lists
- [ ] Test audit events are recorded
- [ ] Test multi-association filtering

#### 9.3 UX Validation
- [ ] Verify no inline actions exist
- [ ] Verify all cards link to filtered lists
- [ ] Verify badges indicate urgency (not priority)
- [ ] Verify dashboard adapts by visibility (role-based)

---

### Phase 10: DBOS Workflow Integration (Future)
**Goal**: Enable workflow-driven dashboard updates

#### 10.1 Workflow Events
- [ ] Subscribe to violation status changes
- [ ] Subscribe to ARC decision events
- [ ] Subscribe to work order authorization events
- [ ] Subscribe to governance motion events

#### 10.2 Real-time Updates (Optional)
- [ ] Evaluate WebSocket/SSE for live dashboard updates
- [ ] Implement polling fallback if real-time not feasible

---

## Implementation Order (Recommended)

Based on ease of implementation and dependencies:

1. **Phase 2** - Type definitions (foundation)
2. **Phase 1.1** - Schema definitions (foundation)
3. **Phase 3** - Requires Action (highest value, most data already available)
4. **Phase 4** - Risk & Compliance (builds on violations data)
5. **Phase 5** - Financial Attention (builds on assessments data)
6. **Phase 6** - Recent Governance (new component)
7. **Phase 7** - Layout & Filters (integration)
8. **Phase 1.2-1.3** - Full aggregation endpoint (consolidation)
9. **Phase 8** - Audit logging (trust spine)
10. **Phase 9** - Testing (validation)
11. **Phase 10** - DBOS workflows (future enhancement)

---

## Files to Modify/Create

### Backend
| File | Action | Description |
|------|--------|-------------|
| `src/lib/server/api/routes/report/dashboard.ts` | Modify | Add `getDashboardData` endpoint |
| `src/lib/server/api/schemas.ts` | Modify | Add dashboard section schemas |
| `prisma/schema.prisma` | Modify | Add `DASHBOARD` to ActivityEntityType (if needed) |

### Frontend
| File | Action | Description |
|------|--------|-------------|
| `src/lib/api/cam.ts` | Modify | Add dashboard types and API methods |
| `src/routes/app/cam/+page.svelte` | Modify | Update layout, add filters, integrate new components |
| `src/lib/components/cam/dashboard/RequiresActionCard.svelte` | Modify | Complete implementation |
| `src/lib/components/cam/dashboard/RiskComplianceCard.svelte` | Modify | Add charts, complete implementation |
| `src/lib/components/cam/dashboard/FinancialAttentionCard.svelte` | Modify | Complete implementation |
| `src/lib/components/cam/dashboard/RecentGovernanceCard.svelte` | Create | New component |
| `src/lib/components/cam/dashboard/DashboardFilters.svelte` | Create | Global filter component |
| `src/lib/components/cam/dashboard/index.ts` | Modify | Export new components |

### Cerbos
| File | Action | Description |
|------|--------|-------------|
| `cerbos/policies/resource/dashboard.yaml` | Verify | Ensure policy exists and covers all roles |

---

## Success Criteria

- [ ] Dashboard loads in < 2 seconds — *needs performance testing*
- [x] All four sections render with accurate data
- [x] Deep links navigate to correctly filtered domain screens
- [x] No inline actions exist on dashboard
- [x] Audit events recorded for view and navigation
- [ ] Role-based visibility works correctly — *needs manual testing*
- [ ] Filters apply globally across all sections — *filter UI deferred*
- [x] `npm run check` passes with 0 errors

---

## Notes

- **Charts**: Use ApexCharts via Flowbite-Svelte sparingly. The spec says "charts are optional but restrained."
- **No Customization**: The dashboard has a fixed layout. No drag-and-drop, no saved views.
- **Authority Boundaries**: The dashboard never enables governance decisions—those happen in canonical workflows.
- **AI Readability**: Keep data structures clean for future AI agent consumption.
