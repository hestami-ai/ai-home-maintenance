# **\============================================================**

# **📘 Phase 3 — System Requirements Document (SRD v1.0)**

# **Hestami AI OS: Concierge Property Owner Platform**

## **Document Purpose**

This SRD formalizes **Phase 3** of the Hestami Operating System: the **Concierge Property Owner Platform**.

Phase 3 completes the three-pillar Hestami OS by introducing an **owner-centric, intent-driven orchestration subsystem** that operates across fragmented real-world ecosystems, including:

* External HOAs and community associations

* External service providers and contractors

* Incomplete or document-only governance contexts

This document is written to support:

* Human software engineers

* AI developer agents

* Future AI worker agents

All requirements herein are **normative**.

---

---

## **0\. EXECUTIVE SUMMARY**

---

Phase 3 expands the Hestami Operating System into a **fully tri-partite platform**:

1. **Community Association Management (Phase 1\)**

2. **Service Provider / Contractor Operations (Phase 2\)**

3. **Property Owner Concierge Operations (Phase 3\)**

The Concierge Property Owner Platform enables individual property owners, trusts, and entities to:

* Register and manage properties independently of HOA participation

* Upload and reference governing documents (CC\&Rs, architectural rules, permits)

* Submit requests and goals in natural language

* Receive concierge assistance even when all counterparties are external

* Track decisions, approvals, and outcomes in a durable, auditable system

Phase 3 is **human-operated in its initial implementation**, with AI assistance only.  
 However, it is **architected from inception** to support progressive automation and eventual AI-agent orchestration without schema or API breakage.

---

---

## **1\. ARCHITECTURE OVERVIEW**

---

### **1.1 Architecture Style**

Phase 3 is implemented as an **internal subsystem** within the Hestami modular monolith and **inherits all platform-wide architectural constraints** defined in Phase 1\.

* Backend: **SvelteKit \+ Node.js**

* API layer: **oRPC**, function-based, forward-slash naming

* Persistence: **Postgres** with **Row-Level Security (RLS)**

* ORM: **Prisma**

* Validation: **Zod**, generated from Prisma

* Workflow engine: **DBOS**, durable and versioned

* Authorization: **Cerbos** (policy-based, gRPC PDP)

* Observability: **OpenTelemetry**

Phase 3 introduces new namespaces, workflows, and roles but does **not** introduce a new service boundary.

---

### **1.2 Subsystem Boundaries**

The Concierge Property Owner Platform consists of:

* Property and ownership modeling

* Owner intent intake and case lifecycle management

* Property document management

* Human concierge orchestration

* External HOA and vendor coordination

* Decision and rationale tracking

* Owner-level financial context and summaries

This subsystem **does not replace**:

* HOA governance engines (Phase 1\)

* Contractor execution engines (Phase 2\)

Instead, it **mediates intent and outcomes** across them.

---

### **1.3 Deployment Context**

Identical to Phase 1 and Phase 2:

* Single SvelteKit application codebase

* Shared DBOS workflow runners

* Shared OpenAPI and SDK generation

* Horizontal scaling via replicated application instances

---

---

## **2\. MULTITENANCY MODEL (PHASE 3\)**

---

### **2.1 Property Owners as Organizations**

Property owners are represented as **Organization** entities, consistent with Phases 1 and 2\.

Organization types include:

* `INDIVIDUAL_PROPERTY_OWNER`

* `TRUST_OR_LLC`

* `COMMUNITY_ASSOCIATION` (optional / external)

* `SERVICE_PROVIDER` (optional / external)

A property owner organization **may exist entirely independently** of HOA or contractor participation.

---

### **2.2 Roles and Delegation**

Phase 3 introduces explicit delegation and authority modeling:

* Owner

* Co-owner

* Trustee / Manager

* Delegated Agent (limited scope)

* Concierge Staff (internal)

No authority is inferred.  
 All permissions must be:

* Explicit

* Cerbos-authorized

* Auditable

---

### **2.3 Data Isolation**

* All tenant-scoped rows include `organization_id`

* Isolation enforced via Postgres RLS

* Cross-tenant relationships are explicit and limited

* External entities are represented but not trusted as systems of record

---

---

## **3\. BUSINESS DOMAINS (PHASE 3\)**

---

Phase 3 consists of **nine primary business domains**, mirroring the structural discipline of Phase 2\.

---

### **DOMAIN 1 — Property & Ownership Modeling**

Represents properties, portfolios, and ownership relationships.

Includes:

* Property records

* Portfolios

* Ownership roles

* Delegated authority scopes

Properties may exist without HOA linkage.

---

### **DOMAIN 2 — Property Portfolio Management**

Supports owners with multiple properties.

Includes:

* Portfolio grouping

* Aggregated views

* Cross-property reporting

---

### **DOMAIN 3 — Owner Intent & Request Intake**

Captures owner goals and requests.

Includes:

* Free-form natural language requests

* Intent classification

* Priority and constraints

* Conversion into durable cases

Intent declaration is **not** workflow execution.

---

### **DOMAIN 4 — Concierge Case Lifecycle**

Defines the durable container for concierge operations.

Includes:

* Case creation

* Status transitions

* Human-operated steps

* Resolution and closeout

Cases persist across vendor changes and delays.

---

### **DOMAIN 5 — Property Document Management**

Manages owner-supplied and externally obtained documents.

Includes:

* CC\&Rs

* Architectural guidelines

* Permits

* Prior approvals

* Correspondence

Documents are **assistive inputs**, not enforced rules.

---

### **DOMAIN 6 — Human Concierge Execution**

Enables internal concierge staff to:

* Review cases

* Interpret documents

* Coordinate externally

* Record actions and outcomes

All actions are logged as structured events.

---

### **DOMAIN 7 — External HOA Context Tracking**

Tracks HOA-related constraints and approvals when HOAs are external.

Includes:

* Manual approval tracking

* Document-based rule reference

* Outcome recording

The system does not assume completeness or correctness of HOA documents.

---

### **DOMAIN 8 — External Vendor Coordination**

Tracks service providers without onboarding requirements.

Includes:

* External vendor representation

* Quotes, schedules, invoices (manual or imported)

* Migration path to Phase 2 when available

---

### **DOMAIN 9 — Decision, Rationale & Trust Ledger**

Records material decisions for transparency and auditability.

Includes:

* Decision records

* Supporting evidence

* Human-readable summaries

* Internal audit detail

This domain is critical for future AI delegation.

---

---

## **4\. API DESIGN MODEL (oRPC)**

---

### **4.1 Namespacing Convention**

All Phase 3 APIs follow the standard oRPC pattern:

`POST /api/v1/rpc/{namespace}/{version}/{procedure}`

Examples:

`POST /api/v1/rpc/case/v1/create`  
`POST /api/v1/rpc/case/v1/updateStatus`  
`POST /api/v1/rpc/intent/v1/submit`  
`POST /api/v1/rpc/document/v1/upload`  
`POST /api/v1/rpc/decision/v1/record`

---

### **4.2 API Requirements**

* Zod validation is mandatory

* All mutations require an idempotency key

* Active organization scope must be enforced

* Breaking changes require version increments

* DBOS workflow versions must match API versions

---

---

## **5\. VALIDATION & ERROR RESPONSE MODEL**

---

Phase 3 uses the **canonical Phase 1 error envelope** without modification.

Validation includes:

* Authority and delegation checks

* Case state transitions

* Document visibility rules

* External coordination constraints

All errors must include:

* `error.code`

* `error.type`

* `field_errors[]`

* `trace_id`

---

---

## **6\. WORKFLOW & EVENTING MODEL (DBOS)**

---

Phase 3 introduces durable workflows for:

* Concierge Case Lifecycle

* External Approval Tracking

* Concierge Action Execution

* Document Review

* Resolution and Closeout

All workflows must be:

* Durable

* Idempotent

* Versioned

* Observable

No long-running or multi-step operation may bypass DBOS.

---

---

## **7\. OBSERVABILITY MODEL (OpenTelemetry)**

---

Every Phase 3 operation must emit:

* `trace_id`

* `span_id`

* `organization_id`

* `case_id` (where applicable)

* Actor identity (human or system)

End-to-end traceability from request intake through resolution is required.

---

---

## **8\. SECURITY & AUTHORIZATION (CERBOS)**

---

Phase 3 uses **Cerbos** as the fine-grained authorization engine.

Authorization applies to:

* Properties

* Concierge cases

* Documents

* Decisions

* Delegated authority

Rules:

* All single-resource actions must call `authorize()`

* All list endpoints must use `queryFilter()`

* Authorization must occur before workflow execution

* Postgres RLS remains the final isolation boundary

Failure to enforce Cerbos checks is a critical violation.

---

---

## **9\. DEPLOYMENT & SCALING STRATEGY**

---

Phase 3 follows the same scaling strategy as Phases 1 and 2\.

Considerations include:

* Increased document processing

* Higher human-in-the-loop interaction volume

* Future offloading of AI-assisted processing

No architectural divergence is permitted.

---

---

## **10\. AI AGENT SUPPORT (FUTURE PHASES)**

---

Phase 3 is **AI-ready but not AI-run**.

Planned evolution:

* Phase 3.0 — Human concierge only

* Phase 3.1 — AI recommendations

* Phase 3.2 — AI-executed steps with approval

* Phase 3.3 — Autonomous concierge agents

All Phase 3 designs must preserve this progression.

---

---

## **11\. SUMMARY**

---

Phase 3 completes the Hestami OS by establishing:

**A property owner–centric system of synthesis for a fragmented real-world ecosystem.**

It preserves:

* Architectural parity with Phases 1 and 2

* CDM integrity

* Authorization rigor

* Workflow durability

* Long-term AI leverage

This SRD is the **normative specification** for implementing the Concierge Property Owner Platform.

