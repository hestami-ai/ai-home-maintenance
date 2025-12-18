# Phase 9: CAM Work Orders (Oversight View) Implementation Roadmap

Based on the specification document `(Phase 9) CAM UX 3 - Work Orders (Oversight View).md`.

---

## Design Decisions

| Decision | Choice |
|----------|--------|
| State machine | **Additive** - Add `AUTHORIZED` and `REVIEW_REQUIRED` to existing states |
| Board Directive origin | Use existing `Resolution` model |
| Preventive Maintenance | Tag with `category: PREVENTIVE` (existing approach) |
| Vendor & Execution tab | Read `Job` status directly from database (same schema) |

---

## Current Implementation Status

### ✅ Already Implemented

#### Schema
- [x] `WorkOrder` model with status, priority, category
- [x] `WorkOrderStatus` enum (DRAFT → CLOSED states)
- [x] `WorkOrderBid`, `WorkOrderStatusHistory`, `WorkOrderComment`, `WorkOrderAttachment` models
- [x] `Vendor` model with compliance fields
- [x] `Asset` model with maintenance scheduling
- [x] `APInvoice` model with work order reference
- [x] `Board`, `Meeting`, `Vote`, `VoteBallot` models
- [x] `Resolution` model (for board directives)
- [x] `ActivityEvent` with workOrderId context field
- [x] `FundType` enum (OPERATING, RESERVE, SPECIAL)

#### Backend
- [x] `workOrder.create` - Create work order
- [x] `workOrder.get` - Get single work order with relations
- [x] `workOrder.list` - List work orders with pagination/filters
- [x] `workOrder.update` - Update work order details
- [x] `workOrder.transition` - State transitions via DBOS workflow
- [x] `workOrder.assign` - Assign vendor to work order
- [x] Cerbos policy for work_order resource

#### Frontend
- [x] Basic work order functionality exists (needs verification)

---

## P9.1 Schema Extensions

### P9.1.1 Add WorkOrderOriginType Enum
- [x] Add `WorkOrderOriginType` enum to schema (VIOLATION_REMEDIATION, ARC_APPROVAL, PREVENTIVE_MAINTENANCE, BOARD_DIRECTIVE, EMERGENCY_ACTION, MANUAL)

### P9.1.2 Add Origin Tracking Fields to WorkOrder
- [x] Add `originType` field (WorkOrderOriginType?)
- [x] Add `violationId` field with relation to Violation
- [x] Add `arcRequestId` field with relation to ARCRequest
- [x] Add `resolutionId` field with relation to Resolution (for board directives)
- [x] Add `originNotes` field (Text)

### P9.1.3 Add Authorization Fields to WorkOrder
- [x] Add `authorizedBy` field (String?)
- [x] Add `authorizedAt` field (DateTime?)
- [x] Add `authorizationRationale` field (Text)
- [x] Add `authorizingRole` field ('MANAGER' | 'BOARD')

### P9.1.4 Add Budget Tracking Fields to WorkOrder
- [x] Add `budgetSource` field (FundType: OPERATING | RESERVE | SPECIAL)
- [x] Add `approvedAmount` field (Decimal)
- [x] Add `spendToDate` field (Decimal)

### P9.1.5 Add Constraints and Board Approval Fields
- [x] Add `constraints` field (Text - HOA rules, conditions)
- [x] Add `requiresBoardApproval` field (Boolean)
- [x] Add `boardApprovalVoteId` field with relation to Vote
- [x] Add `boardApprovalStatus` field (PENDING | APPROVED | DENIED)

### P9.1.6 Add New WorkOrder States
- [x] Add `AUTHORIZED` status to WorkOrderStatus enum
- [x] Add `REVIEW_REQUIRED` status to WorkOrderStatus enum

### P9.1.7 Add Reverse Relations
- [x] Add `workOrders` relation to Violation model
- [x] Add `workOrders` relation to ARCRequest model
- [x] Add `workOrders` relation to Resolution model
- [x] Add `workOrderApprovals` relation to Vote model

### P9.1.8 Budget Threshold Configuration
- [ ] Add `boardApprovalThreshold` to Association settings JSON schema

### Deliverables
- [x] Migration created and applied
- [x] All new fields and relations in place

---

## P9.2 Backend API Extensions

### P9.2.1 Update Create Endpoint
- [x] Add `originType` to create input schema
- [x] Add `violationId`, `arcRequestId`, `resolutionId` to create input
- [x] Add `originNotes` to create input
- [x] Add `budgetSource`, `approvedAmount` to create input
- [x] Add `constraints` to create input
- [x] Validate origin reference exists when provided

### P9.2.2 Add Authorization Endpoint
- [x] Create `workOrder.authorize` endpoint
- [x] Validate required artifacts before authorization (origin, asset, scope)
- [x] Check budget threshold for board approval requirement
- [x] Record authorization fields (authorizedBy, authorizedAt, rationale, role)
- [x] Transition to AUTHORIZED status
- [x] Generate ActivityEvent for AUTHORIZE action

### P9.2.3 Add Board Approval Endpoints
- [x] Create `workOrder.requestBoardApproval` endpoint (creates Vote)
- [x] Create `workOrder.recordBoardDecision` endpoint
- [x] Link Vote to WorkOrder via boardApprovalVoteId
- [x] Update boardApprovalStatus on decision
- [x] Auto-authorize on board approval

### P9.2.4 Add Accept Completion Endpoint
- [x] Create `workOrder.acceptCompletion` endpoint
- [x] Require outcome summary
- [x] Transition from COMPLETED to CLOSED
- [x] Generate ActivityEvent for ACCEPT action

### P9.2.5 Update State Transition Logic
- [x] Update validTransitions to include AUTHORIZED state
- [x] Update validTransitions to include REVIEW_REQUIRED state
- [x] Require TRIAGED → AUTHORIZED before ASSIGNED
- [x] Allow COMPLETED → REVIEW_REQUIRED → CLOSED path

### P9.2.6 Add Validation Rules
- [x] Block authorization without origin type
- [x] Block authorization without asset/location
- [x] Block authorization without scope description
- [ ] Lock scope after authorization (read-only)

### Deliverables
- [x] All new endpoints implemented
- [x] State transitions updated
- [x] Validation rules enforced

---

## P9.3 Cerbos Policy Updates

### P9.3.1 Add New Actions
- [x] Add `authorize` action for managers
- [x] Add `accept` action for managers (completion acceptance)
- [x] Add `request_board_approval` action
- [x] Add `record_board_decision` action
- [x] Add `vote` action for board members (conditional on requiresBoardApproval)

### P9.3.2 Add Auditor Role
- [ ] Add auditor read-only access rule

### Deliverables
- [x] Updated work_order.yaml policy

---

## P9.4 Activity Event Integration

### P9.4.1 New Event Types
- [x] Record AUTHORIZE action on authorization
- [x] Record ACCEPT action on completion acceptance
- [x] Capture authorizingRole in metadata
- [x] Capture origin reference in metadata
- [ ] Capture documents referenced in metadata

### Deliverables
- [x] All work order actions generate ActivityEvents

---

## P9.5 Cross-Domain Integration

### P9.5.1 Create Work Order from Violation
- [x] Add `createWorkOrderFromViolation` service function
- [x] Auto-populate origin fields from violation
- [x] Link to violation unit

### P9.5.2 Create Work Order from ARC Approval
- [x] Add `createWorkOrderFromARC` service function
- [x] Require ARC status = APPROVED
- [x] Copy conditions to constraints field

### P9.5.3 Create Work Order from Board Resolution
- [x] Add `createWorkOrderFromResolution` service function
- [x] Require Resolution status = ADOPTED
- [x] Pre-authorize (board directive = pre-authorized)

### Deliverables
- [x] Cross-domain work order creation working

---

## P9.6 Frontend: Work Orders Split View (CAM-WO-01)

### P9.6.1 Left Pane - Work Orders List
- [x] Create `/app/cam/work-orders/+page.svelte`
- [x] Implement dense table with columns: WO#, Asset, Origin Type, Status, Vendor, Budget Source, Days Open
- [x] Add status filter
- [x] Add origin type filter (options added)
- [ ] Add vendor filter
- [ ] Add budget source filter
- [ ] Add asset filter
- [ ] Add badges: Board Approval Required, Budget Exception, Review Required

### P9.6.2 Right Pane - Tabbed Detail View
- [ ] Implement split-view layout (list + detail)
- [ ] Add tab navigation (6 tabs)

### Deliverables
- [ ] Split view page functional

---

## P9.7 Frontend: Detail Tabs

### P9.7.1 Overview Tab (Tab 1)
- [x] Display current status badge (authoritative)
- [ ] Display origin link (click-through to violation/ARC/resolution)
- [x] Display asset context (unit or common area)
- [x] Display assigned vendor summary
- [x] Display key dates (requested, authorized, scheduled, completed)
- [ ] Display SLA indicators

### P9.7.2 Scope & Authorization Tab (Tab 2)
- [x] Display scope description (read-only after authorization)
- [x] Display authorizing role (Manager/Board)
- [x] Display approval rationale (mandatory field)
- [x] Display conditions/constraints
- [x] Display authorization timestamp and authorizer

### P9.7.3 Budget & Finance Tab (Tab 3)
- [x] Display budget source badge
- [x] Display approved amount
- [x] Display spend to date
- [x] Display variance (highlighted if over budget)
- [x] Display linked invoices (read-only list)

### P9.7.4 Vendor & Execution Tab (Tab 4) - Read-Only
- [x] Display vendor profile summary
- [x] Display Job status (mirrored from Job model)
- [ ] Display completion uploads (photos, notes)
- [x] Display external timestamps (started, completed)
- [x] No execution controls

### P9.7.5 Documents Tab (Tab 5)
- [ ] Display quotes section
- [ ] Display contracts section
- [ ] Display completion photos section
- [ ] Display permits section
- [ ] Documents are referenced, not managed here

### P9.7.6 History & Audit Tab (Tab 6)
- [ ] Display ActivityEvent timeline
- [ ] Show actor (human/system/AI)
- [ ] Show authorization context
- [ ] Show linked decisions

### Deliverables
- [ ] All 6 tabs implemented

---

## P9.8 Frontend: Work Order Creation (CAM-WO-02)

### P9.8.1 Step-Based Creation Wizard
- [x] Create `/app/cam/work-orders/new/+page.svelte`
- [x] Step 1: Select Origin (origin type + origin ID selector)
- [x] Step 2: Define Scope (title, description, asset/unit selection)
- [x] Step 3: Select Budget (budget source, estimated cost)
- [x] Step 4: Assign Vendor (vendor selector or TBD)
- [x] Step 5: Review & Submit

### P9.8.2 Origin Selector Component
- [x] Create OriginSelector component
- [x] Support violation selection
- [x] Support ARC request selection
- [x] Support resolution selection
- [x] Support emergency/manual options

### Deliverables
- [x] Creation wizard functional

---

## P9.9 Frontend: Board Approval Panel (CAM-WO-03)

### P9.9.1 Board Approval UI
- [x] Create BoardApprovalPanel component
- [x] Display when requiresBoardApproval = true
- [x] Show budget threshold exceeded message
- [x] Display vote controls
- [x] Display quorum indicator with progress
- [x] Display rationale capture field
- [x] Lock on decision (read-only after decided)

### Deliverables
- [x] Board approval panel functional

---

## P9.10 UX Guardrails

### P9.10.1 CAM User Restrictions
- [x] CAM users cannot edit execution steps (enforced via Cerbos)
- [x] CAM users cannot modify time entries (enforced via Cerbos)
- [x] CAM users cannot alter invoices (enforced via Cerbos)

### P9.10.2 Vendor Restrictions
- [x] Vendors see only assigned work orders (Cerbos condition)
- [x] Vendors cannot see unrelated CAM data (Cerbos condition)
- [x] Vendors cannot alter scope or budget (EFFECT_DENY rule)

### P9.10.3 Owner View Restrictions
- [x] Owners see status only (view action allowed)
- [x] Owners cannot see financials (view_financials DENY)

### P9.10.4 Auditor Access
- [x] Auditor read-only access to all work order data

### Deliverables
- [x] All guardrails enforced via Cerbos policies

---

## P9.11 Testing

### P9.11.1 Origin Tracking Tests
- [x] Test create work order from violation (scaffolded)
- [x] Test create work order from ARC approval (scaffolded)
- [x] Test create work order from board resolution (scaffolded)
- [x] Test require origin for authorization (scaffolded)

### P9.11.2 Authorization Flow Tests
- [x] Test block authorization without required artifacts (scaffolded)
- [x] Test manager authorization under threshold (scaffolded)
- [x] Test board approval required over threshold (scaffolded)
- [x] Test scope locked after authorization (scaffolded)

### P9.11.3 Board Approval Tests
- [x] Test create vote for work order (scaffolded)
- [x] Test quorum tracking (scaffolded)
- [x] Test authorize on approval (scaffolded)
- [x] Test cancel on denial (scaffolded)

### P9.11.4 Budget Tracking Tests
- [x] Test spend to date calculation (scaffolded)
- [x] Test budget exception flagging (scaffolded)
- [x] Test invoice linking (read-only) (scaffolded)

### P9.11.5 Audit Trail Tests
- [x] Test all state changes recorded (scaffolded)
- [x] Test authorization context captured (scaffolded)
- [x] Test origin entity linking (scaffolded)

### Deliverables
- [x] Test file created: `e2e/workOrder.phase9.test.ts`
- [ ] All test cases implemented and passing

---

## Implementation Priority

1. **P9.1** - Schema extensions (foundation)
2. **P9.2** - Backend API extensions
3. **P9.3** - Cerbos policy updates
4. **P9.4** - Activity event integration
5. **P9.6** - Frontend split view
6. **P9.7** - Frontend detail tabs
7. **P9.8** - Frontend creation wizard
8. **P9.5** - Cross-domain integration
9. **P9.9** - Board approval panel
10. **P9.10** - UX guardrails
11. **P9.11** - Testing

---

## Reference: Schema Changes

### WorkOrderOriginType Enum

```prisma
enum WorkOrderOriginType {
  VIOLATION_REMEDIATION
  ARC_APPROVAL
  PREVENTIVE_MAINTENANCE
  BOARD_DIRECTIVE
  EMERGENCY_ACTION
  MANUAL
}
```

### WorkOrder Model Additions

```prisma
model WorkOrder {
  // ... existing fields ...

  // Origin tracking
  originType       WorkOrderOriginType? @map("origin_type")
  violationId      String?              @map("violation_id")
  arcRequestId     String?              @map("arc_request_id")
  resolutionId     String?              @map("resolution_id")
  originNotes      String?              @map("origin_notes") @db.Text

  // Authorization
  authorizedBy          String?   @map("authorized_by")
  authorizedAt          DateTime? @map("authorized_at")
  authorizationRationale String?  @map("authorization_rationale") @db.Text
  authorizingRole       String?   @map("authorizing_role")

  // Budget
  budgetSource     FundType? @map("budget_source")
  approvedAmount   Decimal?  @map("approved_amount") @db.Decimal(12, 2)
  spendToDate      Decimal?  @map("spend_to_date") @db.Decimal(12, 2)

  // Constraints & Board Approval
  constraints           String?  @map("constraints") @db.Text
  requiresBoardApproval Boolean  @default(false) @map("requires_board_approval")
  boardApprovalVoteId   String?  @map("board_approval_vote_id")
  boardApprovalStatus   String?  @map("board_approval_status")

  // Relations
  violation  Violation?  @relation(fields: [violationId], references: [id])
  arcRequest ARCRequest? @relation(fields: [arcRequestId], references: [id])
  resolution Resolution? @relation(fields: [resolutionId], references: [id])
  boardVote  Vote?       @relation(fields: [boardApprovalVoteId], references: [id])
}
```

### WorkOrderStatus Enum Updates

```prisma
enum WorkOrderStatus {
  DRAFT
  SUBMITTED
  TRIAGED
  AUTHORIZED      // NEW
  ASSIGNED
  SCHEDULED
  IN_PROGRESS
  ON_HOLD
  COMPLETED
  REVIEW_REQUIRED // NEW
  INVOICED
  CLOSED
  CANCELLED
}
```

---

## Reference: Audit Mapping

| Action | EntityType | ActivityAction | Required Context |
|--------|------------|----------------|------------------|
| Work order created | WORK_ORDER | CREATE | originType, originId |
| Authorized | WORK_ORDER | APPROVE | authorizingRole, rationale |
| Vendor assigned | WORK_ORDER | ASSIGN | vendorId, assignedBy |
| Status updated | WORK_ORDER | STATUS_CHANGE | fromStatus, toStatus |
| Completion accepted | WORK_ORDER | APPROVE | outcomeSummary |
| Closed | WORK_ORDER | CLOSE | closedBy, closedAt |
| Cancelled | WORK_ORDER | CANCEL | cancellationReason |
