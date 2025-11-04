# STAFF Service Request UI Implementation Roadmap

**Author:** Cascade (pairing with Hestami team)  
**Date:** 2025-10-24  
**Document Type:** Technical Implementation Roadmap  
**Related Design Doc:** [STAFF Service Request UI Design.md](./STAFF%20Service%20Request%20UI%20Design.md)

---

## 1. Overview
This roadmap translates the STAFF Service Request UI design into actionable engineering tasks across backend (Django/FastAPI), frontend (SvelteKit), and infrastructure layers. It follows the incremental delivery model outlined in the design document, prioritizing manual research enablement, then bidding coordination, followed by productivity enhancements.

## 2. Assumptions & Constraints
- **Tech Stack:** Django REST Framework (backend), SvelteKit + TailwindCSS + shadcn/ui (frontend)
- **Existing Infrastructure:** JWT authentication, timeline API, service request CRUD endpoints already functional
- **Team Capacity:** Assumes 1-2 full-stack engineers with access to design/UX support
- **Timeline Horizon:** 8-12 weeks for MVP + Bidding phases; productivity enhancements ongoing

## 3. Phase Breakdown

### Phase 1: MVP – Manual Research Enablement (Weeks 1-4)
**Goal:** Enable STAFF to view, triage, and capture research for service requests.

#### Backend Tasks [COMPLETED]
| Task ID | Description | Effort | Dependencies | Acceptance Criteria |
|---------|-------------|--------|--------------|---------------------|
| BE-1.1 | Extend `list_service_requests` endpoint with STAFF-specific filters (status, priority, assigned_to, deadline) | 2d | Existing endpoint @backend/django/hestami_ai_project/services/views/base_views.py#122-172 | Returns paginated results with filter params; supports search by property/customer |
| BE-1.2 | Add `assigned_to` field to `ServiceRequest` model + migration | 1d | None | Field added, migration applied, admin updated |
| BE-1.3 | Create `GET /api/services/requests/queue/` endpoint for STAFF dashboard with aggregated counts | 2d | BE-1.1 | Returns status counts, priority distribution, SLA indicators |
| BE-1.4 | Enhance `ServiceResearch` serializer to support HTML content submission | 1d | Existing model @backend/django/hestami_ai_project/services/models/base_models.py#493-545 | Validates rich-text input, stores base64 images |
| BE-1.5 | Add `PATCH /api/services/requests/<id>/status/` endpoint for manual status transitions | 2d | None | Updates status, logs timeline entry, returns updated request |
| BE-1.6 | Implement permission class `IsHestamaiStaff` enforcement on new endpoints | 1d | Existing permission @backend/django/hestami_ai_project/services/permissions.py | Only STAFF role can access queue/research endpoints |
| BE-1.7 | Create notification model + endpoint `GET /api/notifications/` (basic polling) | 3d | None | Stores user notifications, marks read, returns unread count |

**Backend Total:** ~12 days

#### Frontend Tasks 
| Task ID | Description | Effort | Dependencies | Acceptance Criteria |
|---------|-------------|--------|--------------|---------------------|
| FE-1.1 | Create STAFF dashboard route `/staff/requests` with queue table component | 3d | BE-1.3 | Displays requests with filters, search, pagination |
| FE-1.2 | Implement status/priority filter chips + saved filter persistence (localStorage) | 2d | FE-1.1 | Filters apply to table, saved filters load on mount |
| FE-1.3 | Build notification bell component with badge + dropdown | 2d | BE-1.7 | Polls every 30s, shows unread count, displays recent notifications |
| FE-1.4 | Create request detail route `/staff/requests/<id>` with tabbed layout | 3d | BE-1.1 | Overview, Research Notes, Timeline, Bids tabs render |
| FE-1.5 | Build Overview tab displaying request metadata + status controls | 2d | FE-1.4, BE-1.5 | Shows customer, property, schedule, budget; status dropdown triggers PATCH |
| FE-1.6 | Integrate rich-text editor (TipTap or similar) for Research Notes tab | 3d | BE-1.4 | Supports HTML, image paste, submits to research endpoint |
| FE-1.7 | Embed existing Timeline component in Timeline tab | 1d | FE-1.4, @frontend/sveltekit/hestami-ai-ui/src/lib/components/timeline/Timeline.svelte | Reuses component, passes serviceRequestId |
| FE-1.8 | Add SLA indicators (days in status, deadline warnings) to detail sidebar | 2d | FE-1.4 | Calculates from created_at/updated_at, highlights overdue |

**Frontend Total:** ~18 days

#### [NOT IMPLEMENTING] Testing & Integration
| Task ID | Description | Effort | Dependencies | Acceptance Criteria |
|---------|-------------|--------|--------------|---------------------|
| QA-1.1 | Write backend unit tests for new endpoints + permissions | 2d | BE-1.* | 80%+ coverage on new code |
| QA-1.2 | Manual QA: STAFF workflow (login → queue → detail → research capture) | 1d | FE-1.*, BE-1.* | No critical bugs, UX matches wireframes |
| QA-1.3 | Performance test: queue endpoint with 1000+ requests | 1d | BE-1.3 | <500ms response time with pagination |

**Testing Total:** ~4 days

**Phase 1 Total:** ~34 days (~7 weeks with 1 engineer, ~4 weeks with 2 engineers)

---

### Phase 2: Bidding Enhancements (Weeks 5-8)
**Goal:** Enable STAFF to track provider outreach, compare bids, and accept/decline.

#### Backend Tasks
| Task ID | Description | Effort | Dependencies | Acceptance Criteria |
|---------|-------------|--------|--------------|---------------------|
| BE-2.1 | Create `ProviderOutreach` model (provider, service_request, status, last_contact, notes) | 2d | None | Model + migration + admin |
| BE-2.2 | Add CRUD endpoints for `ProviderOutreach` under `/api/services/requests/<id>/outreach/` | 3d | BE-2.1 | Create, list, update outreach records |
| BE-2.3 | Enhance `list_bids` endpoint to include provider details + bid metadata | 1d | Existing endpoint @backend/django/hestami_ai_project/services/urls.py#31 | Returns enriched bid data for comparison table |
| BE-2.4 | Update `select_bid` endpoint to auto-transition status to ACCEPTED + log timeline | 2d | Existing endpoint @backend/django/hestami_ai_project/services/urls.py#33 | Sets selected_provider, updates status, creates timeline entry |
| BE-2.5 | Add `POST /api/services/requests/<id>/reopen-research/` endpoint | 1d | None | Transitions to IN_RESEARCH, logs reason to timeline |
| BE-2.6 | Extend notification system to trigger on bid submission | 2d | BE-1.7 | Creates notification for assigned STAFF when bid received |

**Backend Total:** ~11 days

#### Frontend Tasks
| Task ID | Description | Effort | Dependencies | Acceptance Criteria |
|---------|-------------|--------|--------------|---------------------|
| FE-2.1 | Build Bids tab with Provider Roster table (manual entry form) | 3d | BE-2.2 | Add/edit/delete outreach records, displays status/availability |
| FE-2.2 | Create Bid Comparison table component | 2d | BE-2.3 | Shows quote, availability, included services, confidence rating |
| FE-2.3 | Implement bid selection workflow (radio + Accept/Decline buttons) | 2d | BE-2.4, FE-2.2 | Confirms selection, calls select_bid, shows toast, refreshes |
| FE-2.4 | Add "Reopen Research" action button with reason modal | 2d | BE-2.5 | Prompts for reason, submits, transitions status |
| FE-2.5 | Display bid target indicator (e.g., "Secure ≥3 bids before [date]") | 1d | FE-2.1 | Calculates from bid_submission_deadline, shows progress |
| FE-2.6 | Update notification bell to handle bid-received events | 1d | BE-2.6, FE-1.3 | Shows "New bid from [Provider]" notification |

**Frontend Total:** ~11 days

#### [NOT IMPLEMENTING] Testing & Integration
| Task ID | Description | Effort | Dependencies | Acceptance Criteria |
|---------|-------------|--------|--------------|---------------------|
| QA-2.1 | Backend tests for outreach CRUD + bid selection logic | 2d | BE-2.* | 80%+ coverage |
| QA-2.2 | Manual QA: full bidding workflow (research → outreach → bid → accept) | 1d | FE-2.*, BE-2.* | No critical bugs, timeline logs correctly |
| QA-2.3 | Edge case testing: reopen after accept, multiple bids from same provider | 1d | BE-2.4, BE-2.5 | Handles gracefully with validation errors |

**Testing Total:** ~4 days

**Phase 2 Total:** ~26 days (~5 weeks with 1 engineer, ~3 weeks with 2 engineers)

---

### Phase 3: Operational Productivity (Weeks 9-12)
**Goal:** Add SLA tracking, saved filters, bulk actions, timeline audience controls.

#### Backend Tasks
| Task ID | Description | Effort | Dependencies | Acceptance Criteria |
|---------|-------------|--------|--------------|---------------------|
| BE-3.1 | Add `sla_deadline` calculated field to ServiceRequest (based on priority + created_at) | 2d | None | Returns deadline in serializer, flags overdue |
| BE-3.2 | Create `SavedFilter` model (user, name, filter_params) + CRUD endpoints | 2d | None | STAFF can save/load custom filters |
| BE-3.3 | Implement bulk status update endpoint `POST /api/services/requests/bulk-update/` | 2d | None | Accepts list of IDs + new status, validates permissions |
| BE-3.4 | Add `audience` field to `TimelineEntry` (STAFF_ONLY, CUSTOMER_VISIBLE, PROVIDER_VISIBLE) | 2d | @backend/django/hestami_ai_project/services/models/timeline_models.py | Migration + serializer update |
| BE-3.5 | Filter timeline endpoint by audience based on user role | 2d | BE-3.4 | STAFF sees all, customers/providers see filtered |
| BE-3.6 | Add reminder model + endpoints for per-request manual reminders | 3d | None | STAFF can set reminders, displayed in sidebar |

**Backend Total:** ~13 days

#### Frontend Tasks
| Task ID | Description | Effort | Dependencies | Acceptance Criteria |
|---------|-------------|--------|--------------|---------------------|
| FE-3.1 | Add saved filter UI (save current filters, load from dropdown) | 2d | BE-3.2 | Persists to backend, loads on selection |
| FE-3.2 | Implement bulk selection checkboxes + bulk action toolbar | 3d | BE-3.3 | Select multiple requests, apply status change |
| FE-3.3 | Display SLA deadline warnings in queue table + detail view | 2d | BE-3.1 | Highlights overdue/approaching deadlines in red/yellow |
| FE-3.4 | Add audience selector to timeline comment form | 1d | BE-3.4 | Dropdown for STAFF_ONLY vs shared visibility |
| FE-3.5 | Build reminder sidebar widget with add/edit/delete | 2d | BE-3.6 | Shows upcoming reminders, allows CRUD |
| FE-3.6 | Create alternate view: Kanban board (status columns) | 3d | FE-1.1 | Drag-drop to change status, updates backend |
| FE-3.7 | Create alternate view: Calendar (scheduled requests) | 3d | FE-1.1 | Shows scheduled_start dates, click to open detail |

**Frontend Total:** ~16 days

#### [NOT IMPLEMENTING] Testing & Integration
| Task ID | Description | Effort | Dependencies | Acceptance Criteria |
|---------|-------------|--------|--------------|---------------------|
| QA-3.1 | Backend tests for bulk operations + audience filtering | 2d | BE-3.* | 80%+ coverage |
| QA-3.2 | Manual QA: saved filters, bulk actions, alternate views | 2d | FE-3.* | No critical bugs, performance acceptable |
| QA-3.3 | Accessibility audit (keyboard nav, screen reader) | 2d | FE-3.* | WCAG 2.1 AA compliance |

**Testing Total:** ~6 days

**Phase 3 Total:** ~35 days (~7 weeks with 1 engineer, ~4 weeks with 2 engineers)

---

### Phase 4: Automation Prep (Ongoing)
**Goal:** Lay groundwork for provider portal, structured outreach logging, push notifications.

#### Backend Tasks
| Task ID | Description | Effort | Dependencies | Acceptance Criteria |
|---------|-------------|--------|--------------|---------------------|
| BE-4.1 | Design provider portal API spec (read-only service requests, bid submission) | 3d | Phase 2 | OpenAPI spec documented |
| BE-4.2 | Implement WebSocket/SSE infrastructure for real-time notifications | 5d | BE-1.7 | Replaces polling, pushes to connected clients |
| BE-4.3 | Add structured outreach log fields (medium: email/phone, timestamp, outcome) | 2d | BE-2.1 | Enhances ProviderOutreach model |
| BE-4.4 | Create notification rules engine (trigger conditions, recipient logic) | 5d | BE-1.7 | Configurable rules for bid deadlines, status changes |

**Backend Total:** ~15 days

#### Frontend Tasks
| Task ID | Description | Effort | Dependencies | Acceptance Criteria |
|---------|-------------|--------|--------------|---------------------|
| FE-4.1 | Integrate WebSocket client for real-time notifications | 3d | BE-4.2 | Receives push notifications, updates UI |
| FE-4.2 | Build provider portal UI scaffolding (separate route tree) | 5d | BE-4.1 | Login, request list, bid submission form |
| FE-4.3 | Enhance outreach form with structured fields (medium, outcome) | 2d | BE-4.3 | Dropdown for medium, timestamp auto-filled |

**Frontend Total:** ~10 days

**Phase 4 Total:** ~25 days (ongoing, can be parallelized with Phase 3)

---

## 4. Dependency Graph
```
Phase 1 (MVP)
  ├─ BE-1.1 → BE-1.3 → FE-1.1
  ├─ BE-1.2 → BE-1.5 → FE-1.5
  ├─ BE-1.4 → FE-1.6
  ├─ BE-1.7 → FE-1.3
  └─ FE-1.4 → FE-1.5, FE-1.6, FE-1.7, FE-1.8

Phase 2 (Bidding)
  ├─ BE-2.1 → BE-2.2 → FE-2.1
  ├─ BE-2.3 → FE-2.2 → FE-2.3
  ├─ BE-2.4 → FE-2.3
  ├─ BE-2.5 → FE-2.4
  └─ BE-2.6 → FE-2.6

Phase 3 (Productivity)
  ├─ BE-3.1 → FE-3.3
  ├─ BE-3.2 → FE-3.1
  ├─ BE-3.3 → FE-3.2
  ├─ BE-3.4 → BE-3.5 → FE-3.4
  └─ BE-3.6 → FE-3.5

Phase 4 (Automation)
  ├─ BE-4.2 → FE-4.1
  ├─ BE-4.1 → FE-4.2
  └─ BE-4.3 → FE-4.3
```

## 5. Risk Mitigation
| Risk | Impact | Mitigation |
|------|--------|------------|
| Rich-text editor performance with large HTML | Medium | Implement lazy loading, limit image sizes, add compression |
| Timeline audience filtering breaks existing flows | High | Feature flag rollout, comprehensive regression testing |
| Notification polling overhead at scale | Medium | Monitor backend load, prioritize Phase 4 WebSocket migration |
| STAFF user adoption resistance | High | Conduct user testing after Phase 1, iterate on UX feedback |
| Provider portal scope creep | Medium | Strict API contract in Phase 4, defer UI polish to later |

## 6. Success Metrics
- **Phase 1:** STAFF can triage ≥20 requests/day, research capture time <5min/request
- **Phase 2:** Bid comparison time <2min, acceptance workflow <30sec
- **Phase 3:** Saved filters reduce queue load time by 30%, bulk actions handle 10+ requests
- **Phase 4:** Real-time notifications reduce polling traffic by 80%, provider portal self-service rate >50%

## 7. Rollout Strategy
1. **Phase 1:** Deploy to staging, conduct STAFF training session, shadow existing workflow for 1 week
2. **Phase 2:** Beta release to 2-3 STAFF users, gather feedback, iterate for 1 week before full rollout
3. **Phase 3:** Incremental feature flags (saved filters → bulk actions → alternate views)
4. **Phase 4:** Provider portal soft launch with select partners, monitor API usage

## 8. Open Questions & Decisions Needed
1. **Research Notes Template:** Should we pre-fill fields (provider name, URL, coverage) or keep fully free-form? (Impacts BE-1.4, FE-1.6)
2. **SLA Calculation:** What are target turnaround times per priority level? (Impacts BE-3.1)
3. **Notification Channels:** Email + in-app, or in-app only for MVP? (Impacts BE-1.7)
4. **Provider Portal Auth:** Separate JWT flow or reuse existing? (Impacts BE-4.1)
5. **Responsive Breakpoints:** Mobile support required for STAFF dashboard? (Impacts FE-1.1+)

---

## 9. Next Steps
1. Review roadmap with engineering + product leads, finalize effort estimates
2. Resolve open questions (Section 8) before Phase 1 kickoff
3. Set up project tracking (Jira/Linear) with task IDs mapped to this roadmap
4. Schedule Phase 1 sprint planning meeting
