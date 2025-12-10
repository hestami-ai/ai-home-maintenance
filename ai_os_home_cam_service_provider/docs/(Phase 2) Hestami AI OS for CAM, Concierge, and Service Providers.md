============================================================
📘 Phase 2 — System Requirements Document (SRD v2.0)
Hestami OS: Service Provider / Contractor Operations Subsystem
============================================================

Document Purpose:
This SRD formalizes the Phase 2 expansion of the Hestami Operating System: the full Service Provider / Contractor Operations module, modeled after ServiceTitan, deeply integrated with the CAM layer from Phase 1, and designed for AI-driven automation.

This subsystem enables contractors (HVAC, plumbing, electrical, roofing, landscaping, general services, etc.) to operate their full business on Hestami, while interoperating with:

HOA governance and maintenance workflows

Homeowner concierge requests

AI dispatching, estimation, and automation

This document follows the structure, tone, and intent of the Phase 1 SRD, adapted for the contractor ecosystem.

------------------------------------------------------------
0. EXECUTIVE SUMMARY
------------------------------------------------------------

Phase 2 expands Hestami into a three-sided operational platform:

Community Associations (Phase 1)

Service Providers / Contractors (Phase 2)

Homeowner Concierge (Phase 3 — later)

This subsystem introduces capabilities comparable to ServiceTitan:

Contractor identity, licensing, insurance

Workforce and technician modeling

Pricebooks, materials, and service catalogs

Full job lifecycle (lead → estimate → scheduling → execution → invoicing → warranty)

Dispatch board, routing, scheduling

Technician mobile experience

Recurring maintenance contract support

Job costing, analytics, vendor compliance monitoring

AI agents orchestrating dispatching, estimating, and workflows

Phase 2 is fully AI-operational and designed to interface directly with Phase 1 work orders and HOA requirements.

------------------------------------------------------------
1. ARCHITECTURE OVERVIEW
------------------------------------------------------------
1.1 Architecture Style

Phase 2 is an internal subsystem extending the Phase 1 Modular Monolith:

SvelteKit + Node backend

oRPC for strongly-typed API procedures

Forward-slash route naming, e.g.:

/api/v1/rpc/job/v1/create

/api/v1/rpc/dispatch/v1/assignTech

/api/v1/rpc/estimate/v1/generate

Prisma ORM with generated Zod schemas

Postgres + RLS as the system of record

DBOS for durable workflows

OpenTelemetry for tracing and observability

The subsystem introduces new namespaces, workflows, and user roles but inherits the global platform requirements described in Phase 1 (e.g., idempotency, multitenancy, versioning).

1.2 Subsystem Boundaries

The Contractor Operations subsystem consists of:

Contractor organizations

Workforce and technicians

Pricebooks and materials

Job ingestion and lifecycle workflows

Dispatching and scheduling

Technician mobile execution

Estimates, proposals, and invoices

Inventory and procurement

Maintenance contracts

Analytics and reporting

This subsystem connects to Phase 1 through:

HOA work orders → contractor jobs

ARC requests → inspections / installations

Violations → remediation jobs

Association vendor lists and compliance checks

Budget and AP/AR interactions where appropriate

1.3 Deployment Context

The subsystem is NOT a separate service; instead:

It shares the SvelteKit application codebase

Uses the same DBOS runners

Uses the same OpenAPI generation and client SDK generation

Operates under the same tenant isolation rules

Scales horizontally with the monolith

------------------------------------------------------------
2. MULTITENANCY MODEL FOR CONTRACTORS
------------------------------------------------------------
2.1 Contractors as Organizations

Contractors are represented as Organization entities (same top-level type as HOAs in Phase 1).

Each contractor organization may have:

One or more branch offices

Service areas (regions, zip codes, polygons)

Multiple technicians and dispatchers

Billing and operations staff

A user must explicitly select an active contractor organization scope before accessing contractor functionality.

2.2 Roles and Authorization

Contractor roles include:

Owner / Executive

Operations Manager

Dispatcher / Scheduler

Technician (Field Ops)

Inventory Manager

Billing & Finance

AI Delegated Roles (agent execution)

Authorization rules:

Technicians view only their assigned jobs

Dispatchers modify schedules and assignments

Finance manages invoices and payments

Branch-scoped data must respect RLS constraints

2.3 Cross-Tenant Data Relationships

Contractors may serve:

Multiple HOAs

Multiple homeowners (Phase 3)

Commercial clients (future)

Cross-tenant collaboration is orchestrated through explicit relationship tables and workflows.

Data exposure must remain RLS-safe.

------------------------------------------------------------
3. BUSINESS DOMAINS (Phase 2)
------------------------------------------------------------

Phase 2 consists of nine primary business domains that reflect natural operational boundaries.

DOMAIN 1 — Contractor Identity, Licensing & Compliance

Defines the contractor’s legal/operational profile:

Legal entity information

State/county licensing

Trade certifications

Insurance and bonding

Business classifications (HVAC, electrical, etc.)

Operating hours and availability

Branch locations

Approved vendor status for specific HOAs

Compliance monitoring rules

AI agents may detect and alert:

License expirations

Insurance lapses

Changes to regulatory status

Violations blocking job scheduling

DOMAIN 2 — Workforce & Technician Management

Represents the contractor’s human resources:

Technician profiles (skills, certifications, specialties)

Work hours, availability, PTO

Territory assignments

Performance metrics

Dispatch eligibility

Safety training records

AI dispatching relies on this domain to match jobs intelligently to technicians.

DOMAIN 3 — Pricebook, Services & Materials

Defines the commercial catalog:

Service items (e.g., "AC tune-up", "Drain cleaning")

Labor models (flat rate, hourly)

Materials and parts

Bundles and job templates

Seasonal pricing rules

HOA-specific or volume pricing

Versioning requirements for pricebook updates

All estimates and invoices derive from pricebook definitions.

DOMAIN 4 — Job Lifecycle & Work Order Management

Defines the end-to-end flow:

Lead or work request

Ticket creation

Estimate required or bypassed

Job creation

Job scheduling

Execution (technician mobile)

Completion, QA, documentation

Warranty tracking

Post-job callbacks or feedback

Jobs must follow a standardized state machine while allowing configuration for specific trades.

DOMAIN 5 — Dispatch, Routing & Scheduling

Controls how technicians are scheduled:

Dispatch board user interface

Technician assignment

Travel-time estimation

Branch and territory constraints

SLA windows (arrival windows)

Emergency vs routine prioritization

AI-assisted or AI-automated dispatch mode

Scheduling events must be persisted via DBOS workflows to guarantee durability.

DOMAIN 6 — Field Technician Mobile Operations

Defines technician-facing job execution:

Job details, checklists, required documentation

Start/stop time tracking

Voice notes and AI transcription

Before/after photos & video

Material usage entry

Customer signatures

On-site estimate generation

Payment acceptance (card, ACH)

Offline mode with queueing

Mobile operations must be robust in low-connectivity environments.

DOMAIN 7 — Estimates, Proposals & Invoicing

Enables contractors to generate revenue:

AI-generated scopes of work from job request context

Multi-tier proposal options

Customer or HOA approval workflows

Invoice creation and presentation

Payment capture (Stripe/Square)

Refunds and adjustments

Job costing and profitability analysis

Estimates use pricebook + contextual job data to generate consistent outputs.

DOMAIN 8 — Inventory, Materials & Procurement

Tracks operational supplies:

Warehouse and truck stock

Material consumption per job

Automated replenishment rules

Supplier purchase workflows

Equipment tracking

Supports job readiness and financial accuracy.

DOMAIN 9 — Maintenance Contracts & Recurring Services

Supports predictable revenue and scheduled work:

Annual or seasonal service agreements

HOA-level or homeowner-level contracts

Auto-scheduling of recurring visits

SLA tracking

Contract renewal flows

Performance and compliance audits

------------------------------------------------------------
4. API DESIGN MODEL (oRPC)
------------------------------------------------------------
4.1 Namespacing Convention

All contractor APIs follow:

/api/v1/rpc/{namespace}/{version}/{procedure}


Examples:

POST /api/v1/rpc/job/v1/create
POST /api/v1/rpc/job/v1/updateStatus
POST /api/v1/rpc/dispatch/v1/assignTech
POST /api/v1/rpc/estimate/v1/generate
POST /api/v1/rpc/invoice/v1/collectPayment
POST /api/v1/rpc/technician/v1/setAvailability
POST /api/v1/rpc/pricebook/v1/updateItem
POST /api/v1/rpc/maintenance/v1/createContract

4.2 API Requirements

All inputs/outputs must use Zod schemas.

All mutations require an idempotency key.

Active organization scope MUST be enforced.

Breaking changes → increment {version}.

All procedures participating in workflows must call DBOS via versioned workflow names.

------------------------------------------------------------
5. VALIDATION & ERROR RESPONSE MODEL
------------------------------------------------------------

Phase 2 uses the Phase 1 standard error envelope.

Critical validation rules include:

Job transition rules

Technician availability conflicts

Territory/service area mismatches

Licensing or insurance invalidation

Pricebook reference integrity

Inventory shortages

Scheduling conflicts

Errors must include:

Canonical error codes

User-friendly messages

trace_id for observability

------------------------------------------------------------
6. WORKFLOW & EVENTING MODEL (DBOS)
------------------------------------------------------------

Phase 2 requires durable workflows for:

Job Lifecycle Workflow

From request → completion

Manages state transitions, SLA timers, notifications

Estimate Generation Workflow

AI-driven scope-of-work creation

Pricebook lookups

Approval logic

Dispatch Workflow

Technician assignment

Conflict detection

Travel-time updates

Invoice Workflow

Invoice creation

Payment capture

Receipt generation

Maintenance Contract Workflow

Recurring visit scheduling

SLA compliance

Renewal reminders

Inventory Workflow

Material consumption

Automated reordering

Compliance Workflow

License/insurance monitoring

Vendor approval status updates

All workflows must be:

Versioned

Idempotent

Observable

Durable

------------------------------------------------------------
7. OBSERVABILITY MODEL (OpenTelemetry)
------------------------------------------------------------

Each contractor operation must emit:

trace_id, span_id

organization_id

job_id, technician_id, where applicable

Workflow spans

Performance metrics

End-to-end traceability from dispatch → job execution → invoice is required.

------------------------------------------------------------
8. SECURITY & AUTHORIZATION
------------------------------------------------------------

JWT sessions (Redis)

Role-specific access control

Technician mobile app authentication

Strict enforcement of X-Org-Id

RLS for all contractor data

No cross-tenant data exposure

Audit logs for job changes and financial actions

------------------------------------------------------------
9. DEPLOYMENT & SCALING STRATEGY
------------------------------------------------------------

Phase 2 introduces high-throughput operational patterns:

Dispatch updates

Technician mobile event streams

AI-driven estimation workflows

Scaling considerations:

Horizontal scaling of SvelteKit servers

Separate DBOS workers for job workflows

Optimized read models for dispatch boards

Caching of lookup data (pricebooks, technicians, service areas)

------------------------------------------------------------
10. AI AGENT SUPPORT
------------------------------------------------------------

Phase 2 defines the following agent roles:

AI Dispatcher — assigns technicians, optimizes routing

AI Estimator — auto-generates scopes of work

AI Technician Assistant — provides on-site guidance

AI Compliance Agent — monitors licensing & insurance

AI Procurement Agent — manages inventory replenishment

AI Contract Renewal Agent — analyzes maintenance contract performance

All agents:

Use generated SDKs

Must operate within selected organization_id

Must use idempotency keys

Must follow workflow versioning rules

Must log observability metadata