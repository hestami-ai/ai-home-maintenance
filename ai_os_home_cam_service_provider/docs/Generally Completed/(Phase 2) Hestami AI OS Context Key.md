============================================================
Hestami AI OS — Context Key (Phase 2: Contractor Operations)
============================================================

Purpose
This Context Key provides the essential conceptual framework for implementing, extending, and operating the Service Provider / Contractor Operations subsystem of the Hestami OS.
It describes the business domains, architectural assumptions, multitenancy behavior, workflow rules, and API patterns that all agents and developers must follow.

Phase 2 is modeled after ServiceTitan, integrated into the core Hestami platform, and interoperable with Phase 1 CAM workflows.

1. Subsystem Overview

The Phase 2 subsystem enables contractors to run their complete operations on Hestami:

Intake of service requests

Job lifecycle management

Dispatching and routing

Technician mobile execution

Estimates, proposals, and invoicing

Inventory and procurement

Recurring maintenance contracts

Compliance and licensing

AI-driven automation end-to-end

Contractors operate as Organizations under the same multitenant architecture used in Phase 1.

2. Core Business Domains (Phase 2)

These domains define the conceptual boundary for the subsystem and guide all implementation:

1. Contractor Identity, Licensing & Compliance

Model the legal entity, its licensing, insurance, service areas, branch structure, and compliance status.
AI agents monitor license and insurance validity.

2. Workforce & Technician Management

Technicians, dispatchers, office staff, skills, certifications, availability, PTO, territories, KPIs.

3. Pricebook, Services & Materials

Service catalog, flat-rate or hourly labor items, materials, parts, bundles, seasonal pricing, HOA-specific pricing.

4. Job Lifecycle & Work Order Management

End-to-end flow from lead/ticket → estimate → job → scheduling → execution → completion → warranty.

5. Dispatch, Routing & Scheduling

Real-time dispatch board, skills-based assignment, travel-time estimation, SLA windows, emergency prioritization, AI dispatching.

6. Field Technician Mobile Operations

Technician mobile app for job execution, notes, photos, materials, signatures, payments, and offline support.

7. Estimates, Proposals & Invoicing

AI-generated scopes of work, proposal options, approvals, invoices, payments, profitability evaluation.

8. Inventory, Materials & Procurement

Warehouse and truck stock, material consumption, auto-replenishment, supplier integrations.

9. Maintenance Contracts & Recurring Services

Annual/seasonal contracts, scheduled visits, SLAs, performance tracking, renewal workflows.

These domains collectively define the contractor operational universe.

3. Architecture Context

Phase 2 shares the platform architecture from Phase 1:

SvelteKit + Node modular monolith

oRPC APIs with forward-slash procedure naming

Prisma ORM + Zod schemas

Postgres with RLS for multitenancy

DBOS for durable workflows

OpenTelemetry for observability

All Phase 2 logic must adhere to the same constraints outlined in the original Context Key.

4. API & Namespace Model

All contractor APIs follow the oRPC pattern:

POST /api/v1/rpc/{namespace}/{version}/{procedure}


Examples:

/api/v1/rpc/job/v1/create

/api/v1/rpc/job/v1/updateStatus

/api/v1/rpc/dispatch/v1/assignTech

/api/v1/rpc/estimate/v1/generate

/api/v1/rpc/invoice/v1/collectPayment

/api/v1/rpc/technician/v1/setAvailability

/api/v1/rpc/pricebook/v1/updateItem

/api/v1/rpc/maintenance/v1/createContract

Rules:

Zod validation is mandatory.

All writes require an idempotency key.

API versions map 1:1 to DBOS workflow versions.

Organization scope must be active and enforced.

5. Multitenancy Rules

Each contractor is an Organization.

Technicians inherit the organization scope.

Dispatchers, managers, and finance operate only within this org.

Jobs, estimates, invoices, and inventory records must be tagged with organization_id.

No cross-tenant visibility is allowed except through explicit, RLS-safe relationship tables (e.g., HOA ↔ Vendor approval lists).

Technicians may not view jobs outside their organization.

6. Workflow Model (DBOS)

Key workflow categories:

Job Lifecycle Workflow

Durable execution of job transitions, SLA timers, notifications, technician updates.

Estimate Workflow

AI-driven generation of scopes of work, pricebook lookups, and approval sequences.

Dispatch Workflow

Technician assignment, conflict resolution, routing calculations, emergency reassignments.

Invoice & Payment Workflow

Invoice creation, payment capture, refunds, receipts.

Maintenance Contract Workflow

Scheduled visits, SLA scoring, renewal automation.

Inventory Workflow

Material consumption, reorder thresholds, supplier tasks.

Compliance Workflow

Periodic checks of licenses, insurance, vendor approval status.

All workflows must be:

Durable

Idempotent

Versioned

Fully observable (OpenTelemetry)

7. Error, Validation, and Safety Model

The Phase 1 error envelope is reused.

Contractor-specific validation includes:

Illegal job state transitions

Technician availability conflicts

Licensing/insurance invalidity

Scheduling conflicts

Inventory shortages blocking job scheduling

Pricebook reference errors

SLA window violations

Errors must include:

error.code

error.type

field_errors[]

trace_id

8. Cross-Domain Integration with CAM (Phase 1)

Contractor operations integrate deeply with Phase 1:

ARC → Contractor Jobs
Installations, inspections, post-approval verification.

Violations → Contractor Jobs
Repairs, remediation tasks.

Maintenance Schedules → Recurring Services
Shared across association and contractor calendars.

Vendor Compliance → HOA Dashboards
Licensing, insurance, performance scoring.

Work Orders → Contractor Jobs
HOA or homeowner escalations.

Agents must treat Phase 1 and Phase 2 as interoperable but distinct bounded contexts.

9. AI Agent Responsibilities (Phase 2)
AI Dispatcher

Assignments, optimization, rescheduling, emergency routing.

AI Estimator

Scope creation, option set generation, pricebook lookup, proposal formatting.

AI Technician Assistant

Job guidance, transcription, documentation capture, step verification.

AI Compliance Agent

License & insurance checks, gating unsafe vendors.

AI Procurement Agent

Stock levels, automated reordering, consumption analysis.

AI Contract Renewal Agent

Performance analytics, renewal recommendations, scheduling optimization.

All agents must:

Use versioned endpoints

Obey RLS

Include idempotency keys

Log trace metadata

Follow the SRD’s workflow versioning

10. Platform Constraints for Developer Agents

Prisma is the single source of truth for persistent types.

Zod is generated from Prisma and used for all I/O validation.

DBOS workflows must always match the API version.

No mutating operation may bypass idempotency requirements.

Organization scope must be explicit and enforced.

No diagrammatic or schema-level assumptions may be made beyond this document and the Phase 2 SRD.