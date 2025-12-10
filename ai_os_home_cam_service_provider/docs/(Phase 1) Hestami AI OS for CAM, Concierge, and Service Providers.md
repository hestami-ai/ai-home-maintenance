# **\============================================================**

# **📘 (1) Hestami Platform — System Requirements Document (SRD v1.0)**

# **\============================================================**

**Document Purpose:**  
 This SRD describes the functional, architectural, and operational requirements for the Hestami Platform, an integrated ecosystem for:

* **Community Association Management (HOAs/COAs/POAs)**

* **Homeowner Concierge Services**

* **Service Provider / Contractor Operations**

* **Future Commercial Property Clients (restaurants, office towers, REITs)**

It is written to support **human developers** and **AI developer agents** who will implement and evolve the system.

---

# **\------------------------------------------------------------**

# **0\. EXECUTIVE SUMMARY**

# **\------------------------------------------------------------**

**Hestami** is a unified, API-first platform that merges the capabilities of:

* Vantaca (HOA management),

* ServiceTitan (service provider operations),

* Home concierge business systems,

* A multitenant, workflow-driven SaaS core.

The platform provides:

* **Association management:** accounting, violations, ARC approvals, meetings, governance.

* **Home maintenance concierge:** work orders, vendor coordination, scheduling.

* **Service provider operational tools:** dispatch, invoicing, catalogs, estimates.

* **Workflow automation:** DBOS-driven durable workflows.

* **Typed APIs:** via oRPC, Zod schemas, and automatically generated OpenAPI docs.

* **Extensibility:** for AI worker agents and future AI developer agents.

The goal is to reduce friction across homeowners, HOAs, management companies, and service providers, while enabling AI-driven automation at every level.

---

# **\------------------------------------------------------------**

# **1\. ARCHITECTURE OVERVIEW**

# **\------------------------------------------------------------**

## **1.1 Architecture Style**

* **Modular Monolith** implemented in **Node.js \+ SvelteKit**.

* **oRPC-based API layer** for stable, strongly typed interfaces.

* **DBOS** for durable, versioned workflows.

* **Postgres** as system-of-record database with **Row-Level Security (RLS)**.

* **Redis** for session storage and caching.

* **Traefik** for ingress routing.

* **OpenTelemetry** for full-stack observability: traces, logs, spans.

* **Prisma ORM** for persistence modeling.

* **Zod** for schema-level type and validation, generated automatically from Prisma.

---

## **1.2 Deployment Model**

* All services run inside a **Docker Compose** environment.

* The SvelteKit server uses **PM2 cluster mode** to utilize all CPU cores.

* A single container initially; horizontally scalable later by running multiple SvelteKit/DBOS containers behind Traefik.

* Future optional external workers (e.g., for media processing or AI pipelines).

---

# **\------------------------------------------------------------**

# **2\. MULTITENANCY MODEL**

# **\------------------------------------------------------------**

## **2.1 Tenant Definition**

The primary tenant entity is **Organization** with types:

* `COMMUNITY_ASSOCIATION` (HOA/COA/POA)

* `MANAGEMENT_COMPANY`

* `SERVICE_PROVIDER`

* `INDIVIDUAL_CONCIERGE`

* `COMMERCIAL_CLIENT`

Users may belong to multiple organizations with varying roles. The system mandates that a user **must explicitly select an active Organization scope** upon initial authentication. This active `organization_id` must be used for all subsequent API calls within that scope via the `X-Org-Id` header, and the user must be able to switch this active scope during their session.

---

## **2.2 Data Isolation**

* **Shared Postgres database** with `organization_id` on tenant-scoped rows.

* Strict isolation via **Postgres RLS**.

* Cross-tenant relationships expressed explicitly via linking tables (e.g., `association_service_provider`).

---

## **2.3 Cross-Tenant Collaboration**

* Vendors (service providers) serve multiple associations via relationship tables.

* Individual homeowners can onboard regardless of HOA participation.

* HOAs may self-manage or be managed by management companies (modeled via relational links).

* Future commercial clients use same underlying data model with different policies.

---

# **\------------------------------------------------------------**

# **3\. COMMON DATA MODEL (Hestami CDM)**

# **\------------------------------------------------------------**

This is the **logical domain model** for the entire system. Each domain below includes the primary entities and the relationships they form.

---

## **DOMAIN 1 — Association / Entity / Property Model**

### **Entities**

* **Organization**

* **Association**

* **Property (Community)**

* **Housing Unit / Lot**

* **Common Area / Amenity**

* **Person / Party**

* **Ownership / Tenancy relationships**

* **Management Contract**

* **Community Manager / Portfolio Manager**

### **Purpose**

Provides foundational structure for all association-bound operations and homeowner interactions.

---

## **DOMAIN 2 — Accounting**

### **Entities**

* Chart of Accounts

* GL Accounts

* Journal Entries

* Assessments

* Assessment Charges

* Payments

* AP Invoices

* Vendor W-9 / 1099 data

* Bank Accounts

### **Requirements**

* Auditable, compliant GL structure.

* Automatic periodic assessment posting.

* Integration with Work Orders → AP → Payments.

---

## **DOMAIN 3 — Workflow Automation**

### **Entities & Concepts**

* Task / Workflow Step

* Trigger (event → workflow action)

* SLA Timers

* Notifications (email/SMS)

* Approvals

### **Platform**

* Implemented through **DBOS versioned workflows**.

---

## **DOMAIN 4 — Violations**

* Violation

* Evidence (photos, videos)

* Notice Sequence

* Hearings

* Fines → GL

---

## **DOMAIN 5 — ARC (Architectural Requests)**

* ARC Request

* Plans/Documents

* Committee

* Review Actions

* Conditions

* Permit / BLDS Integration

---

## **DOMAIN 6 — Work Orders / Maintenance**

* Work Order

* Asset

* Vendor

* Bids / Proposals

* Schedules

* Completion

* Invoice → AP Workflow

---

## **DOMAIN 7 — Communications**

* Mass Email

* SMS

* Announcements

* Letter templates

* Calendar events

* Meeting notices

---

## **DOMAIN 8 — Governance**

* Board

* Board Roles

* Meetings

* Agendas

* Minutes

* Voting

* Resolutions

* Policy Docs

---

## **DOMAIN 9 — Owner Portal / CRM**

* User Accounts

* Roles (Owner, Tenant, Manager, Vendor)

* Requests

* Payment preferences

* Document Access

---

## **DOMAIN 10 — Documents & Records**

* CC\&Rs

* Bylaws

* Rules

* Financial Reports

* Contracts

* Reserve Studies

* ARC plans

* Inspection Reports

AI-driven extraction, classification, and summarization are core enhancement features.

---

## **DOMAIN 11 — Reserve Studies**

* Reserve Components

* Life / Remaining Life

* Replacement Cost

* Funding Plans

---

## **DOMAIN 12 — Compliance**

* Statutory deadlines

* Notice requirements

* Voting rules

* Financial audit requirements

* Resale packet guidelines

Through the rules engine and AI-parsed statutory logic.

---

# **\------------------------------------------------------------**

# **4\. API DESIGN MODEL (Using oRPC)**

# **\------------------------------------------------------------**

## **4.1 API Principles**

* **Function-based API** via oRPC.

* **URL structure:** `/api/v1/rpc/{domain}/{method}` or `/api/v1/rpc/{domain}/{version}/{method}`

  * Example: `POST /api/v1/rpc/system/health`

  * Example: `POST /api/v1/rpc/workOrder/v1/create`

* Fully typed: inputs/outputs defined via Zod.

* OpenAPI generated automatically from oRPC router.

---

## **4.2 API Versioning Rules**

* **Path versioning** (`/api/v1/`, `/api/v2/`) for major API-wide changes.

* **Method versioning** for granular breaking changes to specific procedures:

  * `POST /api/v1/rpc/workOrder/v1/create` → original

  * `POST /api/v1/rpc/workOrder/v2/create` → breaking change to create

* Old versions remain active until fully deprecated.

* DBOS workflows also versioned (`workflow_v1`, `workflow_v2`).

---

# **\------------------------------------------------------------**

# **5\. VALIDATION & ERROR RESPONSE MODEL**

# **\------------------------------------------------------------**

## **5.1 Validation Layers**

* **Backend mandatory validation** via Zod (generated from Prisma).

* **Frontend optional validation** (web and mobile) for UX.

* **Server is always the authority**.

---

## **5.2 Standard Error Response Format**

`{`  
  `"ok": false,`  
  `"error": {`  
    `"code": "VALIDATION_FAILED",`  
    `"type": "validation",`  
    `"http_status": 400,`  
    `"message": "Validation failed.",`  
    `"details": "...",`  
    `"field_errors": [],`  
    `"retryable": false`  
  `},`  
  `"meta": {`  
    `"request_id": "req_123",`  
    `"trace_id": "abc",`  
    `"span_id": "xyz",`  
    `"timestamp": "...",`  
    `"locale": "en-US"`  
  `}`  
`}`

Supports:

* SvelteKit Superforms

* Android / iOS apps

* AI agents

---

# **\------------------------------------------------------------**

# **6\. WORKFLOW & EVENTING MODEL (DBOS)**

# **\------------------------------------------------------------**

## **6.1 Role of DBOS**

* Durable

* Idempotent

* Versioned workflow engine

* Replaces Kafka for now (simplifies architecture)

## **6.2 Example Workflows**

* Work Order Lifecycle

* ARC Review

* Violation Notice Sequence

* Assessment Posting

* Vendor Assignment

* AP Invoice → Payment

Each workflow is versioned and triggered by events or API calls.

NOTA BENE: **Work Order Lifecycle** (High Priority: First workflow to be fully implemented)

---

# **\------------------------------------------------------------**

# **7\. OBSERVABILITY MODEL (OpenTelemetry)**

# **\------------------------------------------------------------**

## **7.1 Telemetry Requirements**

For every request:

* **Trace ID**

* **Span ID**

* **Request ID**

* **Organization ID** (for multitenancy)

* Slow query tracking

* DBOS workflow spans

* Error spans

Instrumentation applied at:

* SvelteKit layer

* oRPC handler

* Prisma client

* DBOS workflows

---

# **\------------------------------------------------------------**

# **8\. SECURITY & AUTHORIZATION**

# **\------------------------------------------------------------**

* JWT-based session (Better-Auth) stored in Redis.

* Org-level RLS enforcement in Postgres.

* Fine-grained role system: Owner, Manager, Vendor, Board Member, Admin.

* All API calls include `X-Org-Id`.

---

# **\------------------------------------------------------------**

# **9\. DEPLOYMENT & SCALING STRATEGY**

# **\------------------------------------------------------------**

## **Phase 1 (current)**

* Single Docker host

* SvelteKit (PM2 cluster)

* DBOS inside same container

* Postgres \+ Redis as services

## **Phase 2**

* Multi-instance horizontal scaling

* Traefik load balancing

## **Phase 3**

* Optional externalized workflow workers

* Heavy AI processing offloaded

---

# **\------------------------------------------------------------**

# **10\. AI AGENT SUPPORT**

# **\------------------------------------------------------------**

### **AI Worker Agents**

* Call oRPC functions using SDKs generated from OpenAPI.

* Respect idempotency rules.

* Emit telemetry.

### **AI Developer Agents (Fractal-HVA)**

* Use this SRD \+ Context Key as input.

* Operate over a stable CDM & API schema.

* Generate new features safely.

