# STAFF Service Request UI Design

**Author:** Cascade (pairing with Hestami team)  
**Date:** 2025-10-24  
**Document Type:** Product/UX Design Brief (Markdown)

---

## 1. Purpose & Scope
This document captures the initial design direction for STAFF-facing tooling that manages the service request lifecycle from intake through fulfillment. It synthesizes existing platform capabilities, outlines target workflows, and proposes low-fidelity wireframes for core screens. The focus is on short-term deliverables that unlock manual research, bid coordination, and status progression while leaving room for future automation.

## 2. Current System Touchpoints
- **Service Request model & lifecycle** – Status, priority, budget, and scheduling metadata already exist in the Django model.@backend/django/hestami_ai_project/services/models/base_models.py#131-229
- **API endpoints** – REST routes support listing/creating requests, managing bids, clarifications, research data, and timeline logging.@backend/django/hestami_ai_project/services/urls.py#18-75
- **Timeline component** – Svelte component provides rich-text comments, edit/delete flows, and downstream parsing for activity logs.@frontend/sveltekit/hestami-ai-ui/src/lib/components/timeline/Timeline.svelte#1-200

These touchpoints inform the STAFF UI requirements and highlight areas needing additional structure (e.g., research notes capture, bid comparison).

## 3. Design Principles
1. **Operational clarity first** – Emphasize state, deadlines, and ownership so STAFF can triage quickly.
2. **Structured free-form capture** – Allow rich-text “dumping grounds” for provider research while nudging for consistency (templates, placeholders).
3. **Manual overrides preserved** – Support unrestricted status transitions while surfacing soft warnings (e.g., no bids yet).
4. **Incremental sophistication** – Ship value early, then layer automation (provider portal, outreach logging enhancements).
5. **Role-safe transparency** – Prepare for privacy constraints so STAFF notes vs provider/customer visibility can diverge later.

## 4. Primary USER Personas
- **STAFF Researcher**: Handles multiple open requests, gathers provider options, logs outreach.
- **STAFF Coordinator**: Reviews bids, moves requests toward scheduling, communicates decisions.
- **Future Provider Portal User** (for context): Needs read-only access to their requests/bids but not other providers’ data.

## 5. Core Workflows
### 5.1 Queue Management
- Filter by status/priority, search by property or customer.
- Notification bell surfaces new assignments, bids received, approaching deadlines.
- Saved filters for SLA-driven follow-ups.

### 5.2 Research Workspace
- Overview tab: key metadata (customer, property, schedule, budget) plus status controls.
- Research Notes tab: HTML editor storing provider findings for downstream parsing (via `add_research_data`).
- Timeline tab: reuse existing component for outreach logging; introduce filters for STAFF-only vs shared entries.

### 5.3 Bid Coordination
- Provider roster table capturing outreach status and availability manually.
- Bid comparison table consolidating submitted quotes.
- Actions to accept bid, decline, or reopen research (auto-logging to timeline).

### 5.4 Decision & Handoff
- Summaries for customer-facing review (research synopsis + selected bid).
- Manual status changes with confirmations and optional notifications.

### 5.5 Cross-Request Visibility
- Alternate views (Kanban, calendar) for workload visualization.
- SLA indicators for aging requests or pending bid deadlines.

## 6. Wireframe Sketches
Low-fidelity ASCII wireframes illustrate initial layouts.

### 6.1 STAFF Service Request Queue
```
+----------------------------------------------------------------------------------+
| Hestami Admin | [Search 🔍] ____________________ | [Filter ▼] | [Notification 🔔3] |
+----------------------------------------------------------------------------------+
| Tabs: [All Requests]*  [My Queue]  [Bidding]  [Scheduled]                         |
+----------------------------------------------------------------------------------+
| Status Chips: [Pending 5] [In Research 12]* [Bidding 4] [Needs Follow-up 3] ...   |
+----------------------------------------------------------------------------------+
| Priority | Request Title            | Property / Owner     | Status     | Due     |
|--------- |------------------------- |--------------------- |----------- |-------- |
| 🔴Urgent | HVAC repair – leak       | 615 Oak St / Walker  | IN_RESEARCH| Oct 25  |
| 🟠High   | Landscaping refresh      | 22 Lake Dr / Patel   | BIDDING    | Oct 28  |
| 🟢Med    | Roof inspection          | 9 Elm Ct / Johnson   | PENDING    | Oct 24  |
| ...                                                                            ⏷ |
+----------------------------------------------------------------------------------+
| Left Sidebar                                                                     |
|  • Saved Filters:                                                                |
|     - “Expiring Bids (<48h)”                                                     |
|     - “Requires Follow-up”                                                       |
|  • Bulk Actions (disabled until items selected)                                  |
+----------------------------------------------------------------------------------+
```

### 6.2 Service Request Detail – Research Workspace
```
+----------------------------------------------------------------------------------+
| ← Back to Queue   Request #SR-4821 | Status: IN_RESEARCH ▾ | [Assign to me]      |
+----------------------------------------------------------------------------------+
| Columns:                                                                        |
| Left (65%)                                                                      |
|   Section Tabs: [Overview]* [Research Notes] [Timeline] [Bids]                  |
|                                                                                 |
|   OVERVIEW                                                                      |
|   ┌──────────────────────────────────────────────────────────────────────┐      |
|   | Customer: Jane Doe (Owner)       Property: 615 Oak St, Centerville    |      |
|   | Category: HVAC                   Priority: Urgent                     |      |
|   | Preferred Window: Oct 27 (2-5pm)  Flexibility: No                     |      |
|   | Budget: $300 - $600              Last Updated: Oct 23 9:45 AM         |      |
|   └──────────────────────────────────────────────────────────────────────┘      |
|   Problem Summary:                                                             |
|     “Unit leaking water onto ceiling. ...”                                     |
|                                                                                 |
| Right (35%)                                                                     |
|   ACTIONS                                                                      |
|   [Move to BIDDING] [Reopen Research] [Cancel Request]                          |
|   SLA Indicators:                                                               |
|     • Bid deadline not set → Set Deadline                                       |
|     • Days in status: 2                                                         |
|                                                                                 |
|   REMINDERS                                                                    |
|     Oct 24 – Follow up with CoolAir Pros                                        |
|                                                                                 |
|   TIMELINE SNAPSHOT                                                             |
|     Today 10:05  STA-Laura  Logged outreach to CoolAir (awaiting reply)        |
|     Today 09:22  STA-Laura  Added provider note                                 |
+----------------------------------------------------------------------------------+
```

### 6.3 Bids & Provider Coordination (Detail Tab)
```
[BIDS] Tab
+----------------------------------------------------------------------------------+
| Target: Secure ≥3 bids before Oct 27 5:00 PM                                    |
+----------------------------------------------------------------------------------+
| Provider Roster (manual research summary)                                       |
| ┌─────────────┬──────────────┬───────────┬─────────────┬────────────┬──────────┐ |
| | Provider    | Contact Info | Status    | Last Touch  | Availability| Notes    | |
| | CoolAir Pro | (703)555-0188| Contacted | Oct 24 09:30| Oct 27 PM   | awaiting | |
| | Rapid HVAC  | rapid@example| Declined  | Oct 23 14:10| —          | no slots | |
| | Comfort Inc | comfort@example| Bid Sent| Oct 24 10:45| Oct 27 3pm | see bid  | |
| └─────────────┴──────────────┴───────────┴─────────────┴────────────┴──────────┘ |
| [Add Provider ↺]                                                                |
+----------------------------------------------------------------------------------+
| Bid Comparison                                                                  |
| ┌────────────┬───────────────┬─────────────┬─────────────┬──────────────┬──────┐ |
| | Provider   | Quote         | Availability| Included    | Confidence    | ☑   | |
| | Comfort Inc| $520 flat     | Oct 27 3pm  | Diagnostics | ★★★★☆         | ○   | |
| | (Awaiting) | —             | —           | —           | —              | ○   | |
| └────────────┴───────────────┴─────────────┴─────────────┴──────────────┴──────┘ |
| [Accept Selected Bid]   [Decline Bid]   [Reopen Research]                        |
| Auto-log actions to timeline when buttons used (toast confirmation).            |
+----------------------------------------------------------------------------------+
```

## 7. Notifications & Task Management
- Global bell icon with badge count for new items (assignment, bid received, deadline alert).
- Optional per-request reminders (manual) surfaced in side panel.
- Explore lightweight polling (e.g., 30s) before investing in push notifications.

## 8. Data, Permissions & Visibility
- Timeline already supports rich-text comments; introduce tagging to flag STAFF-private vs shared messages in future iterations.
- Research Notes saved via existing research endpoint and parsed downstream.
- Status transitions remain manual but accompanied by contextual warnings.
- Prepare backend to enforce audience-based filtering once provider portal is added.

## 9. Incremental Roadmap
1. **MVP (Manual Research Enablement)**
   - Queue dashboard with filters + notifications bell.
   - Request detail with Overview, Research Notes (HTML editor), Timeline embed.
   - Status management controls + research data submission wiring.
2. **Bidding Enhancements**
   - Provider roster + bid comparison UI.
   - Actions to accept bids, reopen research, auto-log timeline entries.
   - Manual concept ready for eventual provider self-service UI.
3. **Operational Productivity**
   - SLA indicators, saved filters, bulk actions.
   - Timeline audience filters and tagging.
4. **Automation Prep**
   - Outreach logging structure (timestamp/medium), notifications rules engine.
   - Hooks for provider portal integration once built.

## 10. Outstanding Questions
1. Which fields should the Research Notes editor pre-fill (e.g., provider name, URL, coverage area) to standardize dumps?
2. What is the target SLA for bid turnaround to tune notification rules?
3. Are there compliance/privacy requirements dictating how STAFF-only notes are stored vs customer-visible content?
4. Preferred responsive breakpoints and accessibility requirements for the admin console?

---

## 11. Next Steps
- Validate Research Notes template requirements with STAFF users.
- Align with engineering on notification infrastructure (polling vs push).
- Begin high-fidelity design phase using these wireframes as a baseline.
