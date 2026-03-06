# Concierge Domain - UI Specifications

## 1. Owner Portal (`/app/owner`)
- **Focus:** Simplification and guided intake.
- **Service Call Submission:** Form divided into Property Selection, Category Selection (10 categories), Urgency (4 levels), and Details.
- **Detail View:** Read-only timeline, status badges, communication thread, and quote approval/rejection interface.
- **Terminology:** Strictly uses "Service Call", "Submitted", "In Progress".

## 2. Concierge Management Portal (`/app/concierge`)
- **Focus:** High-throughput triage and dispatch.
- **Layout:** The standard SvelteKit Split-View pattern (List Panel on left, Detail Workspace on right) for `/app/concierge/cases/`.
- **Workspace Tabs:**
  - **Overview:** Owner intent, status, key dates.
  - **Intent:** Original request and clarification threading.
  - **Decisions:** Material decisions with recorded rationale.
  - **Actions:** Linking to CAM Work Orders or ARC requests.
  - **History & Audit:** Unified timeline of notes and status changes.
- **Action Panel:** Features quick actions like "Request Clarification", "Link ARC Request", "Record Decision", and "Change Status".

## 3. Property & Document Management
- **Property Details:** Tabbed interface for Overview, Documents, Media (Lightbox gallery), Service History, and Systems.
- **Document Handlers:** Heavy use of drag-and-drop for attachments, categorized and linked explicitly to a `ConciergeCase` or `IndividualProperty`.
