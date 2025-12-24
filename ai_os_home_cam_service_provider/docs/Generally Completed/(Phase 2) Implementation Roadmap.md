# Hestami Platform — Phase 2 Implementation Roadmap (Contractor Operations)

**Version:** 1.0 (Draft)  
**Status:** Draft  
**Scope:** Service Provider / Contractor Operations (ServiceTitan-style), integrated with Phase 1 CAM.  
**Numbering:** P2.x (distinct from Phase 1).  
**Goal:** Deliver a full contractor operations subsystem (ServiceTitan-style) interoperable with Phase 1 CAM, with workflows delivered after domain models/APIs are in place (Job Lifecycle first).  

---

## Overview
Phase 2 extends the platform into a three-sided ecosystem by adding full contractor operations while interoperating with Phase 1 (HOA/CAM). Workflows will be delivered after domain models and APIs are established. The first complete workflow after models are ready is the **Job Lifecycle**.

### In Scope
- Contractor identity/licensing/compliance, workforce/technicians, pricebook, jobs, dispatch, technician backend, estimates/invoices, inventory/procurement, maintenance contracts.
- All 7 DBOS workflow families (job, estimate, dispatch, invoice/payment, maintenance contract, inventory, compliance) with versioning and idempotency.
- Support both platform-hosted and external service providers.
- Extend common data model (reuse Organization/SERVICE_PROVIDER, Vendor, ServiceArea, ServiceProviderLink).

### Out of Scope (Phase 2)
- AI agent endpoints/skills.
- Mobile app UI (backend surfaces only).
- Deep ML routing/matching; external payment/communication integrations (stubbed).

### Foundational Requirements
- Prisma as source of truth; Zod validation; oRPC with forward-slash naming.
- Postgres RLS; explicit org scope; idempotency on all writes.
- DBOS for durable workflows; OpenTelemetry tracing with org/job/technician context.

### Key Design Decisions
| # | Decision |
|---|----------|
| 1 | Extend existing Phase 1 models directly (no separate extension tables). |
| 2 | Add `EXTERNAL_SERVICE_PROVIDER` to `OrganizationType` enum for external (non-platform) providers; external orgs are lightweight stubs with contact info fields. |
| 3 | Add `Customer` model (contractor-scoped) for off-platform customers; `Job` references either `Customer` or `WorkOrder`/`Unit`. |
| 4 | `Pricebook` is scoped per contractor organization. |
| 5 | Create Cerbos resource policies as each domain is implemented. |
| 6 | Migration naming: `add_<domain>` (e.g., `add_contractor_identity`). |

---

## P2.0 Priorities & Sequencing
1) Establish foundation models/APIs (P2.1–P2.3).  
2) Job domain ready (P2.4) → Dispatch (P2.5) → Technician backend (P2.6).  
3) Pricebook-driven estimates/invoices (P2.7) → Inventory (P2.8).  
4) Maintenance contracts (P2.9) after dispatch + job.  
5) Implement DBOS workflows (P2.10) once models/APIs are stable.  
6) Observability, RLS, idempotency applied throughout (P2.11).  
7) Cross-domain integration with Phase 1 as models stabilize (P2.12).  

---

## P2.1 Contractor Identity, Licensing & Compliance (Foundation)
**Goal:** Model contractor orgs (internal/external), branches, licensing/insurance, and HOA/vendor compliance.
- [x] Add `EXTERNAL_SERVICE_PROVIDER` to `OrganizationType` enum for external (non-platform) providers.
- [x] Extend `Organization` (SERVICE_PROVIDER / EXTERNAL_SERVICE_PROVIDER) with branch offices, operating hours, external contact fields.
- [x] Extend `Vendor` + `ServiceProviderLink` for approval status, insurance/license validity, compliance flags; reuse `ServiceArea`.
- [x] Add models: `ContractorProfile`, `ContractorBranch`, `ContractorLicense`, `ContractorInsurance`, `ContractorTrade`, `ContractorComplianceStatus`.
- [x] Run migration and regenerate Prisma client.
- [x] Add APIs: contractor profile CRUD, branch CRUD, licensing/insurance CRUD, compliance checks, HOA approval linkage.
- [x] Enforce validation: license/insurance expiration gates scheduling; RLS by organization; idempotent writes.
- [x] Add Cerbos policies for contractor resources.

### Deliverables
- [x] Contractor identity/licensing/compliance models
- [x] Compliance gating in APIs
- [x] RLS/idempotent endpoints

---

## P2.2 Workforce & Technician Management
**Goal:** Represent technicians, roles, skills, availability, territories, and performance.
- [x] Add models: `Technician`, `TechnicianSkill`, `TechnicianCertification`, `TechnicianAvailability`, `TechnicianTimeOff`, `TechnicianTerritory`, `TechnicianKPI`.
- [x] Add APIs: technician CRUD, skills/certs CRUD, availability/PTO, territory assignment, KPI view.
- [x] Enforce guards: technician must belong to active contractor org; branch/territory constraints; eligibility checks feed dispatch workflow (availability/time-off checks on scheduling).

### Deliverables
- [x] Technician and availability/territory models
- [x] Eligibility checks in API
- [x] KPI surfaces (read-only)

---

## P2.3 Pricebook, Services & Materials
**Goal:** Commercial catalog for services, labor, and parts, with versioning and HOA-specific pricing. Pricebook is scoped per contractor organization.
- [x] Add models: `Pricebook`, `PricebookItem` (service/labor/material/bundle), `PricebookVersion`, `PriceRule` (seasonal/HOA/volume), `JobTemplate`, `JobTemplateItem`.
- [x] Add APIs: pricebook CRUD, item CRUD, version publish/activate, rules CRUD, job template CRUD.
- [x] Enforce guards: version immutability after publish; references validated before use in estimates/jobs.
- [x] Add Cerbos policies for pricebook resources (`pricebook.yaml`, `pricebook_item.yaml`, `pricebook_version.yaml`, `price_rule.yaml`, `job_template.yaml`).
- [x] Wire pricebook into work orders: `WorkOrder.pricebookVersionId`, `WorkOrder.jobTemplateId`, `WorkOrderLineItem` model.
- [x] Add work order line item APIs: `setPricebook`, `addLineItem`, `listLineItems`, `removeLineItem`, `applyJobTemplate`.

### Deliverables
- [x] Pricebook and versioning
- [x] HOA/seasonal/volume pricing rules
- [x] Job templates tied to pricebook
- [x] Work order line items with pricebook integration

---

## P2.4 Job Lifecycle & Work Order Management (Priority Workflow after models)
**Goal:** End-to-end contractor job domain compatible with HOA work orders, off-platform customers, and external providers.
- [x] Add `Customer` model (contractor-scoped) for off-platform customers (name, phone, email, address, notes).
- [x] Add models: `Job`, `JobStatusHistory`, `JobNote`, `JobAttachment`, `JobCheckpoint` (QA/warranty), `JobVisit`.
- [x] `Job` references: `customerId` (nullable, off-platform), `workOrderId` (nullable, HOA-originated), `unitId`/`propertyId`/`associationId` (nullable, platform property).
- [x] Define states (example): LEAD → TICKET → ESTIMATE_REQUIRED? → JOB_CREATED → SCHEDULED → IN_PROGRESS → ON_HOLD → COMPLETED → WARRANTY → CLOSED → CANCELLED.
- [x] Add APIs: create ticket/lead, convert to job, get/list, update status, add note/attachment, add visit, close/cancel; customer CRUD.
- [x] Integrations: link to HOA `WorkOrder`, `Violation`, `ARCRequest`; allow external provider jobs via `EXTERNAL_SERVICE_PROVIDER` org type.
- [x] Guards: state-machine validation; compliance gates (license/insurance); idempotent status transitions.
- [x] Add Cerbos policies for job and customer resources.

### Deliverables
- [x] Job domain models and state machine
- [x] HOA/ARC/Violation linking
- [x] Status history and attachments/notes

---

## P2.5 Dispatch, Routing & Scheduling
**Goal:** Skills/territory-aware dispatch with SLA windows and travel estimation.
- [x] Add models: `DispatchAssignment`, `ScheduleSlot`, `RoutePlan`, `SLAWindow`, `SLARecord`.
- [x] Add APIs: assignTech, reassign, reschedule, updateStatus, getBoard, optimizeRoute (stub).
- [x] Add SLA APIs: createWindow, listWindows, getWindow, updateWindow, deleteWindow, applyToJob, getJobSLA, markResponse, markResolution, listRecords.
- [x] Guards: technician eligibility (availability, time-off, conflict detection), state-machine validation for dispatch status.
- [x] Add Cerbos policies for dispatch_assignment, schedule_slot, route_plan, sla_window, sla_record.

### Deliverables
- [x] Dispatch assignment/reschedule APIs
- [x] SLA window support
- [x] Routing stub with conflict checks

---

## P2.6 Field Technician Mobile (Backend Only)
**Goal:** Backend surfaces for technician app; UI deferred.
- [x] Add models: `JobChecklist`, `JobStep`, `JobMedia`, `JobTimeEntry`, `JobSignature`, `OfflineSyncQueue`.
- [x] Add APIs: checklist templates/apply/complete steps, time entry start/stop/list, media register/upload/voice notes, signature capture.
- [x] Offline-friendly: `OfflineSyncQueue` for queueable records with batch sync support.
- [x] Add Cerbos policies for job_checklist, job_step, job_media, job_time_entry, job_signature, offline_sync_queue.

### Deliverables
- [x] Checklist/time/media/signature endpoints
- [x] Offline-friendly persistence pattern (queued records)

---

## P2.7 Estimates, Proposals & Invoicing
**Goal:** Generate estimates from pricebook, manage proposals, create invoices, connect to payments (stub).
- [x] Add models: `Estimate`, `EstimateOption`, `EstimateLine`, `Proposal`, `JobInvoice`, `InvoiceLine`, `PaymentIntent` (stub).
- [x] Add APIs: estimate/generate (job + pricebook), proposeOptions, accept/decline proposal, invoice/create, invoice/list/get, collectPayment (stub).
- [x] Integration: AP/AR touchpoints with Phase 1; respect org/job scopes.
- [x] Guards: immutable versions after acceptance; idempotent invoice creation.
- [x] Add Cerbos policies for estimate, estimate_line, estimate_option, proposal, job_invoice, invoice_line, payment_intent.

### Deliverables
- [x] Estimate/proposal flows
- [x] Invoice creation and listing
- [x] Payment intent stubs

---

## P2.8 Inventory, Materials & Procurement
**Goal:** Track materials/parts, truck/warehouse stock, and supplier purchases.
- [x] Add models: `Supplier`, `InventoryItem`, `InventoryLocation`, `InventoryLevel`, `InventoryTransfer`, `InventoryTransferLine`, `MaterialUsage`, `PurchaseOrder`, `PurchaseOrderLine`, `PurchaseOrderReceipt`, `PurchaseOrderReceiptLine`.
- [x] Add APIs: supplier CRUD, inventory item CRUD, location CRUD, stock adjust/reserve/release/count, transfer create/ship/receive/cancel, material usage record/reverse, PO create/submit/confirm/receive/cancel.
- [x] Guards: usage ties to job visit; stock non-negative; supplier may map to `Vendor`.
- [x] Add Cerbos policies for supplier, inventory_item, inventory_location, inventory_level, inventory_transfer, material_usage, purchase_order.

### Deliverables
- [x] Inventory and stock models
- [x] Material usage tied to jobs
- [x] PO creation/receiving

---

## P2.9 Maintenance Contracts & Recurring Services
**Goal:** Support recurring agreements for HOAs/homeowners with scheduled visits.
- [x] Add models: `ServiceContract`, `ContractServiceItem`, `ContractSchedule`, `ScheduledVisit`, `ContractRenewal`, `ContractSLARecord`.
- [x] Add APIs: contract CRUD, schedule recurring visits, renew/cancel, record performance/SLA.
- [x] Integration: can originate from HOA maintenance schedules; uses dispatch/scheduling for visits.
- [x] Guards: enforce active license/insurance before scheduling; SLA tracking.

### Deliverables
- [x] Contract models and CRUD
- [x] Recurring visit scheduling
- [x] SLA tracking and renewals

---

## P2.10 DBOS Workflow Families (All In Scope)
Build after domain models/APIs are stable; versions match API versions.
- [x]  `job_lifecycle_v1` — transitions, SLA timers, notification stubs; compatible with HOA work orders/external providers.  
- [x]  `estimate_generation_v1` — pricebook lookup, option sets, approvals.  
- [x]  `dispatch_assignment_v1` — eligibility checks, routing calc (stub), conflict handling.  
- [x]  `invoice_payment_v1` — invoice creation, payment intent (stub), receipts.  
- [x]  `maintenance_contract_v1` — recurring visit scheduling, renewals, SLA scoring.  
- [x]  `inventory_workflow_v1` — usage logging, reorder triggers, PO creation (stub).  
- [x]  `compliance_workflow_v1` — license/insurance checks, vendor approval updates, gating unsafe vendors.  

### Deliverables
- [x] All 7 workflows implemented and versioned
- [x] Idempotent + observable (traces/logs)

---

## P2.11 Observability, Security, Idempotency
- [x]  OpenTelemetry on all APIs/workflows with org_id, job_id, technician_id where applicable.
- [x]  RLS enforced for all contractor data; explicit org scope required.
- [x]  Idempotency keys required on all mutating endpoints; persisted.
- [x]  Audit logs on job changes, assignments, invoices, compliance gates.
- [x]  Error envelope identical to Phase 1 (code/type/field_errors/trace_id).

### Deliverables
- [x] OTEL spans/metrics with tenancy context
- [x] Idempotency middleware coverage
- [x] Audit logging for key actions

---

## P2.12 Cross-Domain Integration with Phase 1
- [x]  HOA Work Orders → Contractor Jobs (mapping and status sync).
- [x]  Violations → remediation jobs; ARC → inspections/installations.
- [x]  Vendor compliance → extend Phase 1 `Vendor`/`ServiceProviderLink` for approval + license/insurance checks.
- [ ]  Assessments/AP → contractor invoices can feed AP/AR where applicable.
- [x]  Calendar/Events → shared scheduling for recurring visits and jobs.
- [ ]  Reporting hooks for Phase 1 reporting framework (templates deferred to Phase 15+).

### Deliverables
- [x] Mappings for Work Orders/Violations/ARC to Jobs
- [x] Vendor compliance integration
- [x] Shared scheduling hooks

---

## P2.13 Deliverables Checklist
- [x] Contractor identity/licensing/compliance (P2.1)  
- [x] Workforce/technician models & eligibility (P2.2)  
- [x] Pricebook with versioning/rules/templates (P2.3)  
- [x] Job lifecycle models/state machine (P2.4)  
- [x] Dispatch/scheduling APIs (P2.5)  
- [x] Technician backend endpoints (P2.6)  
- [x] Estimates/proposals/invoices (P2.7)  
- [x] Inventory/procurement (P2.8)  
- [x] Maintenance contracts/recurring services (P2.9)  
- [x] All 7 DBOS workflows (P2.10)  
- [x] Observability/idempotency/RLS (P2.11)  
- [x] Phase 1 integration hooks (P2.12)  
- [x] OpenAPI/SDK regeneration and workflow version mapping  

---

## P2.14 Non-Goals (Phase 2)
- AI agent endpoints/skills.
- Mobile app UI.
- Deep ML routing/matching.
- External payment/communication integrations (keep stubs).

---

## P2.15 Technology Stack (unchanged from Phase 1)
| Layer | Technology |
|-------|------------|
| Backend Framework | SvelteKit (Node) |
| API Framework | oRPC (forward-slash naming) |
| Schema Validation | Zod (generated from Prisma) |
| ORM | Prisma |
| Database | PostgreSQL + RLS |
| Session Storage | Redis |
| Workflow Engine | DBOS |
| Observability | OpenTelemetry |
| Reverse Proxy | Traefik |
| Auth | Better-Auth |

---

## P2.16 DBOS Workflow Summary
| Workflow | Priority |
|----------|----------|
| `job_lifecycle_v1` | First after models |
| `estimate_generation_v1` | High |
| `dispatch_assignment_v1` | High |
| `invoice_payment_v1` | Medium |
| `maintenance_contract_v1` | Medium |
| `inventory_workflow_v1` | Medium |
| `compliance_workflow_v1` | Medium |

---

## Appendix A: Domain to Phase Mapping (Phase 2)
| Domain | Phase |
|--------|-------|
| Contractor Identity, Licensing & Compliance | P2.1 |
| Workforce & Technician Management | P2.2 |
| Pricebook, Services & Materials | P2.3 |
| Job Lifecycle & Work Order Mgmt | P2.4 |
| Dispatch, Routing & Scheduling | P2.5 |
| Field Technician Mobile (Backend) | P2.6 |
| Estimates, Proposals & Invoicing | P2.7 |
| Inventory, Materials & Procurement | P2.8 |
| Maintenance Contracts & Recurring | P2.9 |
| DBOS Workflow Families | P2.10 |
| Observability, Security, Idempotency | P2.11 |
| Cross-Domain Integration | P2.12 |

---

## Appendix B: API Namespace Structure (Phase 2)
```
/api/v1/rpc
├── contractor.profile.*           (P2.1)
├── contractor.branch.*            (P2.1)
├── contractor.license.*           (P2.1)
├── technician.*                   (P2.2)
├── pricebook.*                    (P2.3)
├── job.*                          (P2.4)
├── dispatch.*                     (P2.5)
├── technician.mobile.*            (P2.6)
├── estimate.*                     (P2.7)
├── invoice.*                      (P2.7)
├── inventory.*                    (P2.8)
├── procurement.*                  (P2.8)
├── maintenance.*                  (P2.9)
```

---

## Appendix C: Workflow ↔ API Version Mapping
| Workflow | API Namespace | Expected Version |
|----------|---------------|------------------|
| `job_lifecycle_v1` | `job/v1/*` | v1 |
| `estimate_generation_v1` | `estimate/v1/*` | v1 |
| `dispatch_assignment_v1` | `dispatch/v1/*` | v1 |
| `invoice_payment_v1` | `invoice/v1/*` | v1 |
| `maintenance_contract_v1` | `maintenance/v1/*` | v1 |
| `inventory_workflow_v1` | `inventory/v1/*` | v1 |
| `compliance_workflow_v1` | `contractor.compliance/v1/*` | v1 |
