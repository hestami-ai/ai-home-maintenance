# CAM and Associations - System Requirements

## 1. Core Architecture & Navigation (Phase 6 IA)
The CAM Pillar is structured around a stable, permissions-driven left navigation spanning 11 strict domains:
1. **Dashboard** (Aggregation & Action Items)
2. **Associations** (Governance)
3. **Units & Properties** (Asset Tracking)
4. **Violations** (Compliance)
5. **ARC Requests** (Architectural Review)
6. **Work Orders** (Maintenance)
7. **Vendors** (Vendor Mgmt)
8. **Documents & Records** (Records)
9. **Accounting** (Finance)
10. **Governance** (Board Ops, Meetings, Motions)
11. **Reports** (Analytics)

All navigation is fixed; items are hidden based on Cerbos permissions rather than reordered.

## 2. Organization vs. Association Management
- **Dual Isolation:** Strict isolation by `Organization` (Tier 1) and `Association` (Tier 2).
- **Association Pivot:** Management Companies isolate their operations by stamping every record (Violations, ARC, Work Orders, etc.) with `associationId`.
- **SQL RLS Enforcement:** Postgres RLS enforced via `app.current_assoc_id()`. Management staff bypass Tier 2 isolation when querying organization-wide portfolios, while board members/owners are strictly fenced to their `associationId`.

## 3. Sub-Domain Requirements
### 3.1 Violations (Compliance)
- Tracks infractions against CC&Rs.
- Workflow stages supported by DBOS: OPEN -> 1st_NOTICE -> 2nd_NOTICE -> HEARING -> FINE -> RESOLVED.
- Supports attaching evidence (via unified `Document` model).

### 3.2 ARC Requests (Architecture)
- Tracks architectural modifications submitted by owners.
- Stages: SUBMITTED -> UNDER_REVIEW -> APPROVED_CONDITIONAL -> APPROVED -> REJECTED.
- Requires Board/Committee approval logic with mandatory rationale capture.

### 3.3 Work Orders & Maintenance
- Tracks association-level repair work (distinct from individual homeowner concierge calls).
- Stages: OPEN -> ASSIGNED -> IN_PROGRESS -> COMPLETED -> CLOSED.
- Can spawn Service Provider Contractor `Job`s for execution.

### 3.4 Governance & Meetings
- **Board Ops:** Tracks board members, roles, periods.
- **Meetings:** Agendas, attendance, meeting minutes.
- **Motions/Voting:** Records formal resolutions and vote tallies, satisfying statutory requirements.

### 3.5 Accounting & Finance
- Standard accounting structures: Chart of Accounts, GL mapping.
- **Assessments:** Automated posting of recurring charges (Assessments).
- **Invoices:** AP Invoice ingestion, approval, and payment workflows.

### 3.6 Reserve Studies & Statutory Compliance
- **Reserve Studies:** Inventory tracking for components (Roof, Pool), replacement cost, and multi-year funding projection schedules.
- **Compliance:** Rule-based trackers (audits, filings) governed by recurring deadlines.

## 4. Execution Rules for AI Agents
- **Idempotency:** UI MUST generate a UUID per mutation request and send it as `idempotencyKey` to DBOS.
- **Context Injection:** When calling oRPC, ensure `associationId` is properly propagated (`X-Assoc-Id`).
- **Unified Document Model:** Use `Document` + `DocumentContextBinding` (e.g., binding to a Violation or ARC Request) instead of specialized tables.
