# Service Providers - System Requirements

## 1. Core Principles
- **The Job Entity:** The `Job` is the central execution container answering "what work is done, for whom, by who, at what cost". 
- **Origin Agnostic:** A job can originate from a CAM Work Order, a Concierge Service Call, a Direct Lead, or Preventive Maintenance.
- **Bidirectional Sync:** Webhooks/events must propagate status changes back to the origin systems (CAM or Concierge) without granting permission cross-boundary.

## 2. Infrastructure & Entities
- **Execution & Dispatch:**
  - `Job`, `JobStatus` (13 states).
  - `Technician`, `ContractorProfile`, `ContractorBranch`.
  - `DispatchAssignment`, `RoutePlan`.
- **Financials:**
  - `Estimate`, `EstimateLine`, `EstimateOption` (Good/Better/Best tiers).
  - `JobInvoice`, `InvoiceLine`, `Payment`.

## 3. DBOS Workflow: Job Lifecycle
- All job mutations execute through `JobLifecycleWorkflow`.
- **State Machine Transitions:**
  - LEAD -> TICKET -> ESTIMATE_REQUIRED -> ESTIMATE_SENT -> ESTIMATE_APPROVED -> JOB_CREATED -> SCHEDULED -> DISPATCHED -> IN_PROGRESS -> ON_HOLD -> COMPLETED -> INVOICED -> PAID -> CLOSED.
- **Automated Actions:**
  - Auto-transition to `ESTIMATE_SENT` when estimate is sent to customer.
  - Auto-transition to `INVOICED` when invoice is generated.

## 4. Cerbos Authorization boundaries
- Contractors CANNOT modify CAM entities directly.
- CAM users CANNOT modify Job execution or financial details of the contractor.
- Read-only observer views are used for cross-tenant visibility.
