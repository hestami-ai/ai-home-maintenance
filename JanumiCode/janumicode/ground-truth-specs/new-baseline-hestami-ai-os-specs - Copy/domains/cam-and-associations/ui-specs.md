# CAM and Associations - UI Specifications

## 1. Cross-Cutting CAM UX Patterns (Non-Negotiable)
These patterns apply uniformly across every CAM domain (Violations, ARC, Work Orders, etc.):
- **Split-View List + Detail:** The left pane displays a scrollable, filterable list of entities. The right pane displays the active entity's detail view.
- **Tabbed Detail Panels:** The right pane MUST use a standard tab framework containing:
  - **Overview:** Primary entity data and status.
  - **Documents:** Associated files (evidence, forms, invoices) linked via `DocumentContextBinding`.
  - **History / Audit:** A chronological timeline of state transitions, comments, and DBOS workflow actions.
- **Explicit Decisions:** Actions mapped directly to state machine transitions (e.g., "Approve with Conditions", "Assess Fine").
- **Mandatory Rationale:** Governance actions (ARC review, Violation escalation) require textual justification.

## 2. Navigational Architecture
The left navigation is fixed and never reorders. Visibility is strictly bound to Cerbos roles.
- `Dashboard` (Cards deep-link into split views)
- `Associations`
- `Units & Properties`
- `Violations`
- `ARC Requests`
- `Work Orders`
- `Vendors`
- `Documents & Records`
- `Accounting`
- `Governance`
- `Reports`

## 3. The CAM Dashboard Architecture
The dashboard is an aggregation and action-oriented surface, NOT a reporting surface.
- **Requires Action:** Pending ARC approvals, escalated violations, overdue work orders.
- **Risk & Compliance:** Open compliance deadlines, repeat offenders.
- **Financial Attention:** Overdue assessments, budget exceptions.
All dashboard cards must deep-link directly into the corresponding Split-View interface.

## 4. State Management (Svelte 5)
- Always use Runes (`$state`, `$derived`, `$props`).
- Maintain the selected split-view `activeId` either in URL parameters (preferred for deep-linking) or localized `$state`.
