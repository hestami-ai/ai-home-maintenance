============================================================
Hestami AI Developer Agent — Onboarding Package (Phase 2: Contractor Ops Edition)
============================================================
1. Mission

You will build, modify, and extend backend features for the Service Provider / Contractor Operations subsystem of the Hestami OS.

This includes implementing:

Contractor onboarding (licensing, insurance, service areas)

Workforce & technician management

Pricebooks and material catalogs

Job lifecycle workflows

Dispatching, scheduling, and routing

Technician mobile app backend operations

Estimates, proposals, invoicing

Inventory & procurement workflows

Maintenance contract automation

Compliance & vendor-eligibility logic

All work must remain consistent with:

The Phase 2 SRD (Contractor Ops)

The Phase 2 Context Key

The Phase 1 architectural rules

The Hestami CDM and platform-wide constraints

Your outputs must be safe, typed, durable, multitenant, and fully compatible with AI worker agents.

2. Architectural Context

The Contractor Ops subsystem shares the same architectural foundation described in the Phase 1 package:

SvelteKit (Node) as backend framework

oRPC for versioned, typed APIs (forward-slash naming only)

Prisma as the true source of persistent schema

Zod as the source of truth for request/response validation

DBOS for durable, idempotent workflows

Postgres with RLS for strict organizational isolation

OpenTelemetry instrumentation for every operation

Phase 2 adds:

Contractor-specific oRPC namespaces (job, dispatch, estimate, pricebook, technician, invoice, inventory, maintenance)

New workflow families (job lifecycle, dispatch, maintenance contracts, compliance checks)

Rules and state machines for job transitions

Safety constraints around licensing, insurance, service area boundaries, technician eligibility

All Phase 2 modules must interoperate cleanly with existing Phase 1 data (HOAs, work orders, ARC, violations).

3. Development Rules

These rules extend the Phase 1 rules and apply specifically to contractor operations.

a. Single Source of Truth

Prisma schema defines all persistent types.

Zod schemas are generated from Prisma and must not diverge.

All API methods must use Zod input/output schemas.

No implicit types, no inferred shape assumptions.
This is critical for AI developer agent safety.

b. API Versioning (oRPC with forward slashes)

All contractor APIs follow the pattern:

/api/v1/rpc/{namespace}/{version}/{procedure}


Examples:

POST /api/v1/rpc/job/v1/create
POST /api/v1/rpc/job/v1/updateStatus
POST /api/v1/rpc/dispatch/v1/assignTech
POST /api/v1/rpc/estimate/v1/generate
POST /api/v1/rpc/invoice/v1/collectPayment


Rules:

Breaking changes → increment {version}.

Never modify the contract of an existing version.

DBOS workflow versions must match API versions.

c. Idempotency Required for Mutating Operations

ALL mutating procedures must require:

"idempotencyKey": "<UUID>"


Applies to:

Creating jobs

Updating job states

Assigning technicians

Recording material usage

Generating or updating estimates

Creating invoices

Modifying pricebook items

Creating maintenance contracts

The DBOS workflow must use this key to ensure idempotent execution.

d. Multitenancy Rules (Contractor-Specific)

Every contractor is an Organization.

All queries MUST filter by organization_id.

New rows MUST be stamped with organization_id.

Technicians MUST belong to the active contractor organization selected by the user.

Dispatch and job data MUST NEVER cross tenants.

HOA-related job attribution must occur through RLS-safe linking models.

Failure to enforce these rules is considered a critical violation.

e. State Machine & Safety Constraints

Contractor operations are highly stateful. You must enforce:

Valid job status transitions

Technician eligibility (availability, skills, service area)

Licensing & insurance gating rules

SLA timing windows

Disallowed reassignments (e.g., technician not authorized for a trade)

All state transitions must occur through a DBOS workflow to ensure durability.

f. Error Format

Identical to Phase 1 (per SRD).
Every oRPC response must follow the canonical envelope:

error.code

error.type

field_errors[]

trace_id

This format is mandatory for:

Web clients

Mobile apps

AI agents

Future partner integrations

g. Workflow Versioning (DBOS)

Each oRPC method that mutates state must invoke a versioned workflow, such as:

job_lifecycle_v1

dispatch_assignment_v1

estimate_generation_v1

invoice_payment_v1

maintenance_contract_v1

Rules:

Workflow version MUST match API version.

Increment workflow versions when changing logic or state machine steps.

4. Implementation Steps for New Feature Development

Modeled directly after the Phase 1 version, but scoped to Contractor Ops.

Extend Prisma schema for new contractor entities or fields.

Run prisma generate to regenerate Zod types.

Add or modify Zod DTOs for oRPC request/response validation.

Implement oRPC procedures using:

.input(zodSchema)

.output(zodSchema)

Implement or update DBOS workflows aligned with the API version.

Regenerate the OpenAPI spec.

Regenerate iOS/Android SDKs for technician mobile and dispatcher views.

Implement tests:

Unit tests

Workflow simulation tests

Multitenancy safety tests

Validate RLS & Telemetry instrumentation remains correct.

These steps ensure that every feature is safely integrated into the typed, workflow-driven platform architecture.

5. Principles for Safe Development

These principles must guide all development within the contractor subsystem:

1. Never bypass Zod validation.
2. Never bypass RLS; no implicit organization ID injection.
3. Always include idempotency keys for write operations.
4. Enforce job state transitions strictly.
5. Enforce technician eligibility rules at all times.
6. Validate licensing, insurance, and service area compliance.
7. Use DBOS workflows for all long-running or multi-step operations.
8. Maintain backward compatibility unless explicitly versioning upward.
9. Log all operations via OpenTelemetry with trace metadata.
10. Follow the SRD and Context Key exactly—these are the normative specifications.
6. Expected Outputs from the AI Developer Agent

Your outputs for Contractor Ops features include:

Updated schema.prisma definitions

Updated or new oRPC router definitions using forward-slash naming

Generated Zod schemas from Prisma

Updated input/output DTOs

DBOS workflow definitions (*_v1, *_v2, etc.)

Regenerated OpenAPI spec

Updated platform SDKs (mobile, AI agent)

Patch notes to Phase 2 SRD and Context Key when relevant

Outputs must be deterministic, typed, RLS-safe, idempotent, and versioned.