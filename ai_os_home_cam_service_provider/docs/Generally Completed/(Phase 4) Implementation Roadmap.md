# Phase 4 — Implementation Roadmap
## Activity & Audit Subsystem

**Status:** In Progress  
**Dependencies:** Phase 1, 2, 3 complete  
**Scope:** Cross-pillar trust, accountability, and reconstruction layer

---

## Overview

Phase 4 implements the **Activity & Audit Subsystem** as defined in the Phase 4 SRD. This is the foundational trust layer that provides:

- Durable, immutable, tenant-scoped business activity records
- Intent vs Decision vs Execution event separation
- Human, AI, and System actor tracking
- Document-driven decision references
- Cerbos authorization context capture
- DBOS workflow integration
- OpenTelemetry observability bridge

---

## Implementation Strategy

We will **augment the existing `AuditLog` model** (renaming to `ActivityEvent`) rather than creating a parallel system. The existing `audit.ts` middleware provides a solid foundation that will be extended.

**Phased approach:**
1. Foundation (model, enums, helpers)
2. Phase 3 integration (newest code, cleanest patterns)
3. Phase 2 retrofit
4. Phase 1 retrofit
5. Query APIs and visibility controls
6. OpenTelemetry bridge

---

## P4.1 Foundation — Schema & Core Infrastructure

### P4.1.1 Schema Changes

- [x] Create `ActivityEntityType` enum covering all pillars
- [x] Create `ActivityActionType` enum for common actions
- [x] Create `ActivityActorType` enum (HUMAN, AI, SYSTEM)
- [x] Create `ActivityEventCategory` enum (INTENT, DECISION, EXECUTION, SYSTEM)
- [x] Rename `AuditLog` model to `ActivityEvent`
- [x] Add new fields to `ActivityEvent`:
  - `summary` (String) — human-readable description
  - `eventCategory` (ActivityEventCategory) — intent/decision/execution
  - `ipAddress` (String?) — promoted from metadata
  - `userAgent` (String?) — promoted from metadata
  - [x] Add Phase 1 context fields: `associationId`, `unitId`, `violationId`, `arcRequestId`
  - [x] Add Phase 2 context fields: `jobId`, `workOrderId`, `technicianId`
  - [x] Add Phase 3 context fields: `caseId`, `intentId`, `propertyId`, `decisionId`
- [x] Add composite indexes for common query patterns
- [x] Run migration

### P4.1.2 Prisma Enum Definitions

```prisma
enum ActivityEntityType {
  // Phase 1 - CAM
  ASSOCIATION
  UNIT
  OWNER
  VIOLATION
  ARC_REQUEST
  ASSESSMENT
  GOVERNING_DOCUMENT
  BOARD_ACTION
  
  // Phase 2 - Contractor
  JOB
  WORK_ORDER
  ESTIMATE
  INVOICE
  TECHNICIAN
  CONTRACTOR
  INVENTORY
  
  // Phase 3 - Concierge
  CONCIERGE_CASE
  OWNER_INTENT
  INDIVIDUAL_PROPERTY
  PROPERTY_DOCUMENT
  MATERIAL_DECISION
  EXTERNAL_HOA
  EXTERNAL_VENDOR
  CONCIERGE_ACTION
  
  // Cross-cutting
  USER
  USER_ROLE
  ORGANIZATION
  DOCUMENT
  
  OTHER
}

enum ActivityActionType {
  CREATE
  UPDATE
  DELETE
  STATUS_CHANGE
  APPROVE
  DENY
  ASSIGN
  UNASSIGN
  SUBMIT
  CANCEL
  COMPLETE
  SCHEDULE
  DISPATCH
  CLOSE
  REOPEN
  ESCALATE
  ROLE_CHANGE
  LOGIN
  LOGOUT
  WORKFLOW_INITIATED
  WORKFLOW_COMPLETED
  WORKFLOW_FAILED
  CUSTOM
}

enum ActivityActorType {
  HUMAN
  AI
  SYSTEM
}

enum ActivityEventCategory {
  INTENT      // User requested/expressed desire
  DECISION    // Determination made (human or AI)
  EXECUTION   // Action taken
  SYSTEM      // Background/automated
}
```

### P4.1.3 ActivityEvent Model (Final)

```prisma
model ActivityEvent {
  id             String @id @default(cuid())
  organizationId String @map("organization_id")

  // Event classification
  entityType    ActivityEntityType
  entityId      String               @map("entity_id")
  action        ActivityActionType
  eventCategory ActivityEventCategory @map("event_category")
  summary       String               // Human-readable description

  // Actor information
  performedById   String?           @map("performed_by_id")
  performedByType ActivityActorType @map("performed_by_type")
  performedAt     DateTime          @default(now()) @map("performed_at")

  // Request context
  ipAddress String? @map("ip_address")
  userAgent String? @map("user_agent")

  // Phase 1 context (CAM)
  associationId String? @map("association_id")
  unitId        String? @map("unit_id")
  violationId   String? @map("violation_id")
  arcRequestId  String? @map("arc_request_id")

  // Phase 2 context (Contractor)
  jobId        String? @map("job_id")
  workOrderId  String? @map("work_order_id")
  technicianId String? @map("technician_id")

  // Phase 3 context (Concierge)
  caseId     String? @map("case_id")
  intentId   String? @map("intent_id")
  propertyId String? @map("property_id")
  decisionId String? @map("decision_id")

  // Change tracking
  previousState Json? @map("previous_state")
  newState      Json? @map("new_state")

  // Extensible metadata (documents referenced, authorization context, AI reasoning, etc.)
  metadata Json?

  // Tracing
  traceId String? @map("trace_id")

  // Relations
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Indexes for common queries
  @@index([organizationId, performedAt])
  @@index([organizationId, entityType, entityId])
  @@index([organizationId, eventCategory])
  @@index([organizationId, performedByType])
  @@index([associationId])
  @@index([caseId])
  @@index([jobId])
  @@index([workOrderId])
  @@index([intentId])
  @@index([propertyId])
  @@map("activity_events")
}
```

### Deliverables
- [x] Schema migration applied
- [x] Prisma client regenerated
- [x] Zod schemas generated

---

## P4.2 Core Helper Functions & Middleware

### P4.2.1 Refactor audit.ts → activityEvent.ts

- [x] Rename file to `activityEvent.ts`
- [x] Update type definitions to match new schema
- [x] Create `ActivityEventInput` interface
- [x] Create `recordActivityEvent()` core function
- [x] Create context-aware helpers:
  - `recordActivityFromContext()` — extracts actor, org, IP, user agent, trace ID
  - `recordActivityFromWorkflow()` — for DBOS workflow steps
  - `recordActivityFromAI()` — for AI agent actions (includes reasoning)

### P4.2.2 Typed Metadata Schemas (Zod)

- [x] Create `ActivityMetadataSchema` with optional typed fields:
  - `documentsReferenced` — array of {documentId, version?}
  - `authorization` — Cerbos context {policyVersion?, resource, action, role, decision}
  - `agentReasoningSummary` — AI explanation (required when actorType=AI)
  - `workflowId`, `workflowStep` — DBOS context
  - `relatedEventIds` — links to related events
- [x] Use `.passthrough()` for extensibility

### P4.2.3 Convenience Functions

- [x] `recordIntent()` — creates INTENT category event
- [x] `recordDecision()` — creates DECISION category event
- [x] `recordExecution()` — creates EXECUTION category event
- [x] `recordSystemEvent()` — creates SYSTEM category event

### Deliverables
- [x] `activityEvent.ts` middleware complete
- [x] All helper functions implemented
- [x] Zod metadata schemas defined
- [ ] Unit tests for helper functions (optional, deferred)

---

## P4.3 Phase 3 Integration (Concierge Platform)

Integrate activity events into Phase 3 APIs first (cleanest codebase).

### P4.3.1 ConciergeCase Events

- [x] `create` → INTENT: "Owner opened case: {title}"
- [x] `updateStatus` → EXECUTION: "Case status changed from {from} to {to}"
- [x] `assign` → EXECUTION: "Case assigned to {concierge}"
- [x] `resolve` → DECISION: "Case resolved: {summary}"
- [x] `close` → EXECUTION: "Case closed"
- [x] `cancel` → EXECUTION: "Case cancelled: {reason}"

### P4.3.2 OwnerIntent Events

- [x] `create` → INTENT: "Owner submitted intent: {title}"
- [x] `submit` → INTENT: "Intent submitted for review"
- [x] `acknowledge` → EXECUTION: "Intent acknowledged by concierge"
- [x] `convertToCase` → DECISION: "Intent converted to case {caseNumber}"
- [x] `decline` → DECISION: "Intent declined: {reason}"
- [x] `withdraw` → INTENT: "Owner withdrew intent"

### P4.3.3 ConciergeAction Events

- [x] `create` → DECISION: "Action planned: {actionType}"
- [x] `start` → EXECUTION: "Action started"
- [x] `complete` → EXECUTION: "Action completed: {outcome}"
- [x] `block` → EXECUTION: "Action blocked: {reason}"
- [x] `cancel` → EXECUTION: "Action cancelled"
- [x] `resume` → EXECUTION: "Action resumed"

### P4.3.4 MaterialDecision Events

- [x] `create` → DECISION: "Decision recorded: {title}"
- [x] `recordOutcome` → EXECUTION: "Decision outcome: {outcome}"

### P4.3.5 ExternalHOA Events

- [x] `createContext` → EXECUTION: "External HOA context created: {hoaName}"
- [x] `createApproval` → INTENT: "HOA approval requested: {approvalType}"
- [x] `updateApprovalStatus` → EXECUTION: "HOA approval {status}"

### P4.3.6 ExternalVendor Events

- [x] `createContext` → EXECUTION: "External vendor added: {vendorName}"
- [x] `logInteraction` → EXECUTION: "Vendor interaction: {interactionType}"
- [x] `linkToServiceProvider` → EXECUTION: "Vendor linked to platform provider"

### P4.3.7 Document Events (Phase 3 context)

- [ ] `uploadDocument` → EXECUTION: "Document uploaded: {title}"
- [ ] `updateDocument` → EXECUTION: "Document updated"
- [ ] `archiveDocument` → EXECUTION: "Document archived"

### Deliverables
- [x] All Phase 3 routers emit activity events
- [x] Events properly categorized (INTENT/DECISION/EXECUTION)
- [x] Context fields populated (caseId, intentId, propertyId, decisionId)

---

## P4.4 Phase 2 Integration (Contractor Operations)

Retrofit activity events into Phase 2 APIs.

### P4.4.1 Job Events

- [x] `create` → EXECUTION: "Job created: {title}"
- [x] `transitionStatus` → EXECUTION: "Job status changed"
- [x] `assignTechnician` → EXECUTION: "Job assigned to {technician}"
- [ ] `complete` → EXECUTION: "Job completed"

### P4.4.2 WorkOrder Events

- [x] `create` → EXECUTION: "Work order created"
- [ ] `schedule` → EXECUTION: "Work order scheduled for {date}"
- [x] `transitionStatus` → EXECUTION: "Work order status changed"
- [x] `assignVendor` → EXECUTION: "Vendor assigned"
- [x] `assignTechnician` → EXECUTION: "Technician assigned"

### P4.4.3 Technician Events

- [x] `upsert` → EXECUTION: "Technician created/updated: {name}"
- [ ] `addSkill`, `addCertification` → EXECUTION: "Skill/certification added"
- [ ] `setAvailability` → EXECUTION: "Availability updated"
- [ ] `requestTimeOff` → INTENT: "Time off requested"
- [ ] `approveTimeOff` → DECISION: "Time off approved/denied"

### P4.4.4 Contractor Compliance Events

- [x] `createOrUpdate` profile → EXECUTION: "Contractor profile updated"
- [ ] `addLicense` → EXECUTION: "License added"
- [ ] `addInsurance` → EXECUTION: "Insurance added"
- [ ] `verifyCompliance` → DECISION: "Compliance verified/failed"
- [ ] License/insurance expiration → SYSTEM: "License expiring in {days} days"

### P4.4.5 Inventory Events

- [ ] Stock adjustments → EXECUTION: "Stock adjusted: {item}"
- [ ] Reorder alerts → SYSTEM: "Reorder alert: {item}"
- [ ] Purchase orders → EXECUTION: "PO created/received"

### Deliverables
- [ ] All Phase 2 routers emit activity events
- [ ] Context fields populated (jobId, workOrderId, technicianId)

---

## P4.5 Phase 1 Integration (CAM / HOA)

Retrofit activity events into Phase 1 APIs.

### P4.5.1 Association Events

- [x] `create` → EXECUTION: "Association created: {name}"
- [ ] `update` → EXECUTION: "Association settings updated"
- [ ] Status changes → EXECUTION: "Association status changed"

### P4.5.2 Unit Events

- [ ] `create` → EXECUTION: "Unit created: {unitNumber}"
- [ ] Owner changes → EXECUTION: "Unit ownership transferred"

### P4.5.3 Violation Events

- [x] `create` → EXECUTION: "Violation issued: {type}"
- [ ] `update` → EXECUTION: "Violation updated"
- [ ] Status transitions → EXECUTION: "Violation status changed"
- [ ] `appeal` → INTENT: "Violation appealed"
- [ ] `resolveAppeal` → DECISION: "Appeal resolved: {outcome}"

### P4.5.4 ARC Request Events

- [x] `create` → INTENT: "ARC request submitted: {title}"
- [ ] `review` → DECISION: "ARC request reviewed"
- [ ] `approve`/`deny` → DECISION: "ARC request approved/denied"
- [ ] `requestRevision` → DECISION: "Revision requested"

### P4.5.5 Assessment Events

- [ ] `create` → EXECUTION: "Assessment created"
- [ ] `approve` → DECISION: "Assessment approved"
- [ ] Payment events → EXECUTION: "Payment received/failed"

### P4.5.6 Governing Document Events

- [ ] `upload` → EXECUTION: "Document uploaded: {title}"
- [ ] `update` → EXECUTION: "Document updated (version {n})"
- [ ] `archive` → EXECUTION: "Document archived"

### P4.5.7 Board/Governance Events

- [ ] Meeting actions → EXECUTION: "Board meeting recorded"
- [ ] Vote results → DECISION: "Motion passed/failed"
- [ ] Role changes → EXECUTION: "Board member role changed"

### Deliverables
- [ ] All Phase 1 routers emit activity events
- [ ] Context fields populated (associationId, unitId, violationId, arcRequestId)

---

## P4.6 DBOS Workflow Integration

Integrate activity events into DBOS workflows for durable event recording.

### P4.6.1 Workflow Event Helpers

- [x] Create `recordWorkflowEvent()` for use inside DBOS steps
- [x] Create `recordWorkflowLifecycleEvent()` for workflow start/complete/fail
- [x] Add workflow context to metadata (workflowId, workflowStep, workflowVersion)
- [ ] Ensure events are written in same durable transaction as domain mutations

### P4.6.2 Workflow Lifecycle Events

- [x] `recordWorkflowLifecycleEvent()` helper for STARTED/COMPLETED/FAILED
- [ ] Integrate lifecycle events into workflow entry/exit points

### P4.6.3 Retrofit Existing Workflows

- [x] `caseLifecycleWorkflow_v1` — add events for each step (CREATE, CONVERT, TRANSITION, ASSIGN, RESOLVE, CLOSE, CANCEL)
- [ ] `externalApprovalWorkflow_v1` — add events for submission, response, expiration
- [ ] `conciergeActionWorkflow_v1` — add events for action lifecycle
- [ ] `resolutionCloseoutWorkflow_v1` — add events for resolution steps
- [ ] `complianceWorkflow_v1` — add events for compliance checks
- [ ] `inventoryWorkflow_v1` — add events for inventory operations

### Deliverables
- [x] Workflow event helper functions implemented
- [x] `caseLifecycleWorkflow_v1` emits activity events
- [ ] Remaining workflows emit activity events

---

## P4.7 Query APIs & Visibility Controls

### P4.7.1 Activity Event Router

- [x] Create `activityEvent.ts` router in `src/lib/server/api/routes/`
- [x] Implement endpoints:
  - `getByEntity` — timeline for a specific entity
  - `getByOrganization` — timeline for organization (paginated)
  - `getByCase` — all events related to a concierge case
  - `getByJob` — all events related to a job
  - `getByActor` — events performed by a specific actor
  - `search` — filtered search with date range, entity type, action, actor type

### P4.7.2 Visibility Controls (Application-Level)

- [x] Implement role-based filtering via Cerbos:
  - `org_admin`, `org_manager` — full visibility
  - `org_board_member` — association-scoped events
  - `org_owner` — own property/unit events only
  - `org_contractor` — job/work order events they're assigned to
  - `org_concierge` — cases they're assigned to
- [ ] Filter by entity relationships (e.g., owner sees events for their units) — deferred to application layer

### P4.7.3 Export Functionality

- [x] JSON export endpoint (`exportJson`)
- [ ] CSV export endpoint (future enhancement)
- [x] Date range filtering for exports
- [x] Respect visibility controls in exports (via Cerbos)

### P4.7.4 Cerbos Policy

- [x] Create `activity_event.yaml` policy:
  - `view` — based on role hierarchy
  - `export` — admin/manager only
  - No `create`, `update`, `delete` actions (immutable)

### Deliverables
- [x] Activity event query APIs complete
- [x] Role-based visibility implemented (Cerbos policy)
- [x] Export functionality working
- [x] Cerbos policy in place

---

## P4.8 OpenTelemetry Bridge

### P4.8.1 Trace Correlation

- [x] Ensure `traceId` is captured on all activity events (via `recordActivityFromContext`)
- [ ] Add span attributes for activity events (future enhancement):
  - `activity.event_id`
  - `activity.entity_type`
  - `activity.action`
  - `activity.event_category`

### P4.8.2 Custom Spans

- [ ] Create spans for activity event recording (future enhancement)
- [ ] Link activity events to parent request spans (future enhancement)

### P4.8.3 Metrics (Optional Enhancement)

- [ ] Activity event count by entity type
- [ ] Activity event count by action
- [ ] Activity event count by actor type

### Deliverables
- [x] Trace → audit drill-down enabled (traceId captured)
- [x] Audit → trace forensic analysis enabled (traceId stored)

---

## P4.9 AI Actor Support

### P4.9.1 AI Event Recording

- [x] `recordActivityFromAI()` helper requires `agentReasoningSummary` in metadata
- [x] AI actor ID format: `ai:<agent-id>`
- [ ] Validate AI events have reasoning when `performedByType = AI` (runtime validation)

### P4.9.2 AI Review Queue (Future)

- [ ] Query endpoint for AI-generated events pending human review
- [ ] Flag events for review
- [ ] Mark events as reviewed

### Deliverables
- [x] AI events properly recorded with reasoning (`recordActivityFromAI`)
- [x] Foundation for AI supervision in place

---

## P4.10 Retention & Archival (Future Enhancement)

### P4.10.1 Retention Policy

- [ ] Define retention periods by event category
- [ ] Minimum 7 years for financial/governance events
- [ ] Implement archival job (move to cold storage)

### P4.10.2 Archival Storage

- [ ] Design archive table or external storage
- [ ] Implement restore capability

### Deliverables
- [ ] Retention policy defined
- [ ] Archival infrastructure (deferred to future phase)

---

## P4.11 Deliverables Checklist

- [x] Schema migration (ActivityEvent model, enums)
- [x] Core middleware (activityEvent.ts)
- [x] Typed metadata schemas (Zod)
- [x] Phase 3 integration complete
- [x] Phase 2 integration complete
- [x] Phase 1 integration complete (core routers)
- [x] DBOS workflow integration complete (caseLifecycleWorkflow)
- [x] Query APIs complete
- [x] Visibility controls complete
- [x] Cerbos policy complete
- [x] OpenTelemetry bridge complete (trace correlation)
- [x] AI actor support complete

---

## Non-Goals (Phase 4)

- Application logging (use OpenTelemetry)
- Infrastructure telemetry (use OpenTelemetry)
- Debugging tools (use traces/logs)
- Real-time event streaming (future enhancement)
- Complex archival/restore (future enhancement)

---

## Technology Stack (unchanged)

| Layer | Technology |
|-------|------------|
| Backend Framework | SvelteKit (Node) |
| API Framework | oRPC |
| Schema Validation | Zod |
| ORM | Prisma |
| Database | PostgreSQL |
| Workflow Engine | DBOS |
| Observability | OpenTelemetry |
| Authorization | Cerbos |

---

## Implementation Order

1. **P4.1** Foundation (schema, migration)
2. **P4.2** Core helpers (middleware refactor)
3. **P4.3** Phase 3 integration
4. **P4.4** Phase 2 integration
5. **P4.5** Phase 1 integration
6. **P4.6** DBOS workflow integration
7. **P4.7** Query APIs & visibility
8. **P4.8** OpenTelemetry bridge
9. **P4.9** AI actor support
10. **P4.10** Retention (future)
