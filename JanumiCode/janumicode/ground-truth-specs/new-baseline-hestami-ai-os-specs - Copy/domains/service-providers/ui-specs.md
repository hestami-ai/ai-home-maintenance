# Service Providers - UI Specifications

## 1. Jobs Split-View (`/app/contractor/jobs`)
- **Layout:** Standard Split-View.
- **Left Pane (List):** Sortable job list, status badges, multi-select filters, origin type filters.
- **Right Pane (Detail):** Header with status and quick actions.
- **Tabs:**
  - **Overview:** Job summary, status visualization, assigned crew.
  - **Scope & Estimate:** Estimate line items, approval status, action to create/send estimate.
  - **Scheduling & Dispatch:** Mini-calendar, technician assignment, dispatch actions.
  - **Execution:** Task checklists, notes, photos, time/material tracking.
  - **Invoicing & Payments:** Invoice list, balance due, payment recording.
  - **History & Audit:** Granular log of state transitions and human vs. system actions.

## 2. Estimate Builder Workflow
- **Line Items:** Detailed grid with description, quantity, price, tax toggles.
- **Pricebook:** "Add from Pricebook" modal with search/filter auto-populating line items.
- **Options:** Implementation of Good/Better/Best option tiers.
- **Totals:** Real-time subtotal, tax, and discount calculations.

## 3. Dispatch Board (`/app/contractor/dispatch`)
- **Calendar:** Drag-and-drop enabled day/week calendar interface.
- **Queues:** Unscheduled jobs lane with priority indicators.
- **Technicians:** Columns displaying availability and assignments.

## 4. Mobile Execution
- **Note:** Native PWA mobile capabilities (offline sync, GPS routing, signature capture) are currently *deferred* from the initial implementation but API support must exist.
