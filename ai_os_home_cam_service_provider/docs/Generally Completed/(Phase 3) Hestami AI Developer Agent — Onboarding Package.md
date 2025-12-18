# **\============================================================**

# **Hestami AI Developer Agent — Onboarding Package**

# **Phase 3: Concierge Property Owner Platform**

## **1\. Mission**

You will build, modify, and extend backend features for the **Concierge Property Owner Platform**, the Phase 3 subsystem of the Hestami AI Operating System.

This subsystem enables:

* Property owners (individuals, trusts, LLCs) to manage properties

* Submission of owner intent and requests

* Concierge case lifecycle management

* Human-operated orchestration across external HOAs and service providers

* Document-driven assistance using uploaded governing materials

* Durable tracking of decisions, approvals, and outcomes

Phase 3 is **human-operated in its initial implementation**, with AI assistance only.  
 However, **all work must preserve a clean, non-breaking upgrade path to AI-agent execution**.

All outputs must remain consistent with:

* Phase 1 architectural rules (CAM)

* Phase 2 interoperability contracts (Contractor Ops)

* The Hestami Common Data Model (CDM)

* The Phase 3 SRD

* The Phase 3 Context Key

This package is **normative**.

---

## **2\. Architectural Context**

Phase 3 uses the **same architectural foundation** as Phases 1 and 2\.

### **Core Stack**

* **Backend**: SvelteKit \+ Node.js

* **API Layer**: oRPC (function-based, forward-slash naming only)

* **Database**: Postgres with Row-Level Security (RLS)

* **ORM**: Prisma (single source of truth)

* **Validation**: Zod (generated from Prisma)

* **Workflows**: DBOS (durable, idempotent, versioned)

* **Authorization**: Cerbos (policy-based PDP via gRPC)

* **Observability**: OpenTelemetry

Phase 3 introduces new namespaces and workflows but **no new infrastructure patterns**.

---

## **3\. Development Rules (Mandatory)**

All Phase 1 and Phase 2 development rules apply **unchanged**.

### **3.1 Single Source of Truth**

* Prisma defines all persistent data structures

* Zod schemas are generated from Prisma

* All API inputs and outputs MUST use Zod

* No inferred or implicit shapes are permitted

This rule is critical for AI developer agent safety.

---

### **3.2 API Versioning (oRPC)**

All APIs follow:

`POST /api/v1/rpc/{namespace}/{version}/{procedure}`

Examples:

`POST /api/v1/rpc/case/v1/create`  
`POST /api/v1/rpc/intent/v1/submit`  
`POST /api/v1/rpc/document/v1/upload`  
`POST /api/v1/rpc/decision/v1/record`

Rules:

* Breaking change → increment `{version}`

* Never modify an existing version’s contract

* DBOS workflow versions MUST match API versions

---

### **3.3 Idempotency (Required)**

ALL mutating operations MUST require:

`"idempotencyKey": "<UUID>"`

Applies to:

* Case creation and updates

* Intent submission

* Document uploads

* Decision recording

* External coordination updates

DBOS workflows MUST use this key to guarantee idempotent execution.

---

### **3.4 Multitenancy Rules (Phase 3\)**

* Property owners are Organizations

* Every request MUST execute within an explicit organization scope

* `organization_id` MUST be enforced at:

  * API layer

  * Prisma queries

  * Workflow execution

* No implicit ownership or authority inference is allowed

External HOAs and vendors may exist **without accounts** and must be modeled as non-authoritative external entities.

Failure to enforce these rules is a **critical violation**.

---

### **3.5 Authorization (Cerbos)**

Phase 3 uses **Cerbos** for fine-grained authorization.

Mandatory rules:

Single-resource operations MUST call:

 `ctx.cerbos.authorize(action, resourceKind, resourceId)`

* 

Collection/list operations MUST use:

 `ctx.cerbos.queryFilter(action, resourceKind)`

*   
* Authorization MUST occur **before** DBOS workflow execution

* UI-level filtering NEVER replaces Cerbos enforcement

* RLS remains the final isolation boundary

Failure to enforce Cerbos checks is a **critical violation**.

---

### **3.6 Workflow Discipline (DBOS)**

All multi-step or long-running operations MUST be implemented as DBOS workflows.

Examples:

* Concierge case lifecycle workflow

* External approval tracking workflow

* Concierge action execution workflow

* Document review workflow

* Resolution and closeout workflow

Rules:

* Workflows must be durable

* Workflows must be idempotent

* Workflow version MUST match API version

* No concierge logic may bypass DBOS

---

### **3.7 Human-in-the-Loop Constraint (Phase 3-Specific)**

In Phase 3:

* AI agents may **assist**, summarize, or recommend

* AI agents MUST NOT autonomously execute concierge actions

* Human concierge actions MUST be explicitly recorded

* All authority must be explicit and auditable

Designs MUST NOT assume autonomous AI execution.

---

### **3.8 Error Format**

Phase 3 uses the **canonical Phase 1 error envelope** without modification.

All errors MUST include:

* `error.code`

* `error.type`

* `field_errors[]`

* `trace_id`

This format is mandatory for:

* Web clients

* Mobile clients

* AI agents

---

## **4\. Implementation Steps for New Features**

When implementing a Phase 3 feature, follow these steps **in order**:

1. Extend the Prisma schema (Phase 3 aggregates only)

2. Run `prisma generate` to regenerate Zod schemas

3. Define or update Zod DTOs

Implement oRPC procedures using:

 `.input(zodSchema)`  
`.output(zodSchema)`

4.   
5. Enforce Cerbos authorization

6. Implement or update DBOS workflows (version-aligned)

7. Regenerate OpenAPI specification

8. Regenerate SDKs (web, mobile, AI agent)

9. Add workflow and authorization tests

10. Validate RLS and OpenTelemetry instrumentation

Skipping steps is not permitted.

---

## **5\. Phase 3–Specific Safety Principles**

You MUST adhere to the following principles:

1. Never infer owner authority

2. Never bypass Cerbos

3. Never bypass RLS

4. Never encode business rules into UI

5. Never assume HOA or vendor participation

6. Treat documents as assistive inputs, not executable rules

7. Preserve replayability and auditability

8. Maintain backward compatibility unless explicitly versioning upward

9. Log all actions with OpenTelemetry metadata

10. Follow the Phase 3 SRD and Context Key exactly

---

## **6\. Expected Outputs from the AI Developer Agent**

Your outputs for Phase 3 features include:

* Updated `schema.prisma` definitions

* Generated Zod schemas

* New or updated oRPC router definitions

* DBOS workflow definitions (`*_v1`, `*_v2`, etc.)

* Regenerated OpenAPI specification

* Updated SDK artifacts

* Patch notes to Phase 3 SRD or Context Key when required

All outputs must be:

* Deterministic

* Typed

* Idempotent

* RLS-safe

* Cerbos-authorized

* Workflow-backed

* Observable

---

## **7\. Forward Compatibility Statement**

All Phase 3 work must preserve compatibility with:

* AI recommendation agents

* AI execution agents (future phases)

* Cross-pillar orchestration

* Unified CDM analytics and training pipelines

Any design that blocks future AI delegation is considered invalid.

---

## **8\. Summary**

Phase 3 establishes the **owner-centric orchestration layer** of the Hestami OS.

As an AI Developer Agent, your responsibility is to:

**Implement concierge capabilities that work today with humans and tomorrow with autonomous agents—without ever breaking trust, safety, or architectural discipline.**

This onboarding package is the **canonical specification** governing all Phase 3 development.

