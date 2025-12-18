# **\============================================================**

# **Hestami AI OS — Context Key**

# **Phase 3: Concierge Property Owner Platform**

## **Purpose**

This Context Key defines the **conceptual and operational framework** for the **Concierge Property Owner Platform**, the Phase 3 pillar of the Hestami AI Operating System.

It describes:

* The role of the concierge subsystem within the three-pillar OS

* Its business domains and boundaries

* Architectural and multitenancy assumptions

* Authorization, workflow, and API rules

* How the subsystem evolves from human-operated to AI-agent-driven execution

This document is **normative** and must be followed by all human developers and AI developer agents working on Phase 3\.

---

## **1\. Subsystem Overview**

Phase 3 introduces an **owner-centric orchestration layer** that allows property owners to manage issues, requests, and decisions related to their properties, even when:

* Their HOA is not on the Hestami platform

* Their service providers are not on the Hestami platform

* Governance exists only as uploaded documents

* Execution requires human coordination

The Concierge Platform is **not** a CRM, a marketplace, or a ticket queue.  
 It is a **system of synthesis** that translates owner intent into coordinated outcomes across fragmented external systems.

Phase 3 complements, but does not replace:

* Phase 1 — Community Association Management (CAM)

* Phase 2 — Service Provider / Contractor Operations

---

## **2\. Architectural Context**

Phase 3 shares the **identical architectural foundation** used in Phase 1 and Phase 2:

* **Backend**: SvelteKit \+ Node.js

* **API Layer**: oRPC (function-based, forward-slash naming)

* **Persistence**: Postgres with Row-Level Security (RLS)

* **ORM**: Prisma (single source of truth)

* **Validation**: Zod (generated from Prisma)

* **Workflows**: DBOS (durable, idempotent, versioned)

* **Authorization**: Cerbos (policy-based PDP via gRPC)

* **Observability**: OpenTelemetry

Phase 3 introduces new namespaces and workflows but **no new infrastructure paradigm**.

---

## **3\. Tenant and Multitenancy Model**

### **3.1 Property Owners as Tenants**

Property owners are modeled as **Organization** entities, consistent with the rest of the platform.

Organization types include:

* `INDIVIDUAL_PROPERTY_OWNER`

* `TRUST_OR_LLC`

* `COMMUNITY_ASSOCIATION` (optional / external)

* `SERVICE_PROVIDER` (optional / external)

A property owner organization may exist **entirely independently** of HOA or contractor participation.

---

### **3.2 Organization Scope**

All API calls must execute within an explicitly selected organization scope:

* Users may belong to multiple organizations

* An active organization must be selected after authentication

* The active scope is enforced via `X-Org-Id`

* No implicit scope inference is permitted

This rule is identical across all three phases.

---

### **3.3 Data Isolation**

* All tenant-scoped records include `organization_id`

* Isolation is enforced via Postgres RLS

* Cross-tenant relationships are explicit and minimal

* External entities are represented but never trusted as authoritative systems

---

## **4\. Core Business Domains (Phase 3\)**

The Concierge Platform consists of **nine primary business domains**, aligned in rigor and structure with Phase 2\.

1. **Property & Ownership Modeling**  
    Properties, ownership roles, delegated authority, and relationships.

2. **Property Portfolio Management**  
    Grouping and managing multiple properties under a single owner.

3. **Owner Intent & Request Intake**  
    Free-form owner requests, constraints, and priorities.

4. **Concierge Case Lifecycle**  
    Durable case management spanning intake, execution, and resolution.

5. **Property Document Management**  
    Governing documents, permits, approvals, and correspondence used as assistive inputs.

6. **Human Concierge Execution**  
    Human-operated coordination, tracking, and outcome recording.

7. **External HOA Context Tracking**  
    HOA constraints and approvals when the HOA is not a platform participant.

8. **External Vendor Coordination**  
    Service provider tracking without onboarding requirements.

9. **Decision, Rationale & Trust Ledger**  
    Transparent recording of material decisions and supporting evidence.

---

## **5\. API & Namespace Model**

Phase 3 APIs follow the standard oRPC pattern:

`POST /api/v1/rpc/{namespace}/{version}/{procedure}`

Representative namespaces include:

* `property`

* `portfolio`

* `intent`

* `case`

* `document`

* `decision`

Rules:

* All inputs and outputs must use Zod schemas

* All mutating operations require idempotency keys

* Breaking changes require version increments

* DBOS workflow versions must match API versions

---

## **6\. Workflow Model (DBOS)**

Phase 3 relies on **durable workflows** for all multi-step or long-running operations.

Key workflow categories include:

* Concierge Case Lifecycle

* External Approval Tracking

* Concierge Action Execution

* Document Review

* Resolution and Closeout

All workflows must be:

* Durable

* Idempotent

* Versioned

* Fully observable

No concierge operation may bypass DBOS.

---

## **7\. Authorization Model (Cerbos)**

Phase 3 uses **Cerbos** as the fine-grained authorization engine, consistent with Phases 1 and 2\.

Cerbos governs access to:

* Properties

* Concierge cases

* Owner intents

* Documents

* Decisions

* Delegated authority

Rules:

* Single-resource actions must call `authorize()`

* Collection endpoints must use `queryFilter()`

* Authorization must occur before workflow execution

* RLS remains the final isolation boundary

Authorization decisions are policy-based and attribute-driven.

---

## **8\. Observability & Auditability**

Every Phase 3 operation must emit OpenTelemetry metadata, including:

* `trace_id`

* `span_id`

* `organization_id`

* `case_id` or `property_id` (when applicable)

* Actor identity (human or system)

All significant actions are recorded as immutable domain events.

---

## **9\. AI Agent Evolution Model**

Phase 3 is **AI-ready but not AI-run**.

The evolution path mirrors Phase 2’s agent maturity model:

* **Phase 3.0** — Human concierge execution

* **Phase 3.1** — AI recommendations and summaries

* **Phase 3.2** — AI-executed steps with human approval

* **Phase 3.3** — Autonomous concierge agents

No Phase 3 design may prevent this progression.

---

## **10\. Conceptual Summary**

Phase 3 establishes the Concierge Property Owner Platform as:

**The owner-centric operating layer that translates intent into outcomes across fragmented governance and service ecosystems.**

It maintains:

* Architectural parity with Phases 1 and 2

* Strict multitenancy and authorization discipline

* Durable, explainable workflows

* A clean upgrade path to AI agent orchestration

