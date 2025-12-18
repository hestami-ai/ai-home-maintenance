# **\============================================================**

# **📘 Phase 4 — System Requirements Document (SRD vNext)**

# **Hestami AI OS: Activity & Audit Subsystem**

## **Document Purpose**

This SRD defines the **Activity & Audit Subsystem**, the **cross-pillar trust, accountability, and reconstruction layer** of the Hestami AI Operating System.

Phase 4 spans **all pillars**:

* Phase 1 — Community Association Management (CAM)

* Phase 2 — Service Provider / Contractor Operations

* Phase 3 — Concierge Property Owner Platform

This vNext revision explicitly incorporates **Phase-3 concierge semantics**, **intent-vs-execution separation**, **human-in-the-loop workflows**, and **future AI-agent accountability**.

This document is **normative**.

---

---

## **0\. EXECUTIVE SUMMARY**

---

The Activity & Audit Subsystem provides a **durable, immutable, tenant-scoped record of all significant business actions** across the Hestami platform.

It exists to ensure:

* Legal and regulatory defensibility

* HOA governance transparency

* Financial and accounting auditability

* Vendor and contractor accountability

* Human oversight of AI-assisted and AI-executed actions

* Reconstruction of *why* decisions were made, not just *what* was executed

This subsystem is **not**:

* Application logging

* Infrastructure telemetry

* A debugging tool

It is a **business-level historical ledger**.

Phase 4 is the **trust spine** of the entire Hestami OS.

---

---

## **1\. THREE DISTINCT HISTORIES IN THE SYSTEM**

---

Hestami maintains three complementary histories:

1. **Infrastructure Telemetry**

   * OpenTelemetry traces, spans, logs, metrics

   * Used for debugging and performance analysis

2. **Business Activity & Audit History** *(this subsystem)*

   * Who did what, when, why, and under what authority

   * Durable, queryable, exportable

3. **Data Change / Version History**

   * Soft deletes, versioned configs, shadow tables

Only **\#2** is suitable for:

* Governance

* Legal discovery

* AI supervision

* Dispute resolution

---

---

## **2\. ACTIVITY & AUDIT AS A FIRST-CLASS DOMAIN**

---

Activity & Audit is a **first-class CDM domain**, equal in importance to:

* Work Orders

* Violations

* ARC Requests

* Accounting

* Concierge Cases

Every **material domain mutation** MUST produce an ActivityEvent.

---

---

## **3\. AUDITED ENTITY COVERAGE**

---

The subsystem MUST audit actions across all critical entities, including:

### **Association / CAM (Phase 1\)**

* Associations

* Governing documents

* Fees and policies

* Violations

* ARC requests

* Board and governance actions

### **Contractor Operations (Phase 2\)**

* Jobs

* Estimates

* Dispatch assignments

* Invoices and payments

* Inventory and procurement

* Licensing and compliance

### **Concierge & Owner Operations (Phase 3\)** 

* **ConciergeCase**

* **OwnerIntent**

* **Property**

* **PropertyDocument**

* **DecisionRecord**

* **ExternalParty** (HOA, vendor, authority)

### **Cross-Cutting**

* User roles and permissions

* Cerbos authorization-relevant actions

* AI agent actions

* System-initiated workflows

---

---

## **4\. ACTIVITYEVENT — CANONICAL AUDIT MODEL**

---

### **4.1 Core Model**

`model ActivityEvent {`

  `id              String   @id @default(cuid())`

  `organizationId        String`

  `entityType      String`

  `entityId        String`

  `action          String`

  `summary         String`

  `performedById   String?`

  `performedByType String   // HUMAN | AI | SYSTEM`

  `performedAt     DateTime @default(now())`

  `metadata        Json?`

  `ipAddress       String?`

  `userAgent       String?`

  `@@index([organizationId, entityType, entityId])`

  `@@index([organizationId, performedAt])`

`}`

---

### **4.2 EntityType (Expanded)**

`type ActivityEntityType =`

  `| "ASSOCIATION"`

  `| "PROPERTY"`

  `| "CONCIERGE_CASE"`

  `| "OWNER_INTENT"`

  `| "WORK_ORDER"`

  `| "JOB"`

  `| "VIOLATION"`

  `| "ARC_REQUEST"`

  `| "ASSESSMENT"`

  `| "INVOICE"`

  `| "PROPERTY_DOCUMENT"`

  `| "DECISION_RECORD"`

  `| "EXTERNAL_PARTY"`

  `| "USER_ROLE"`

  `| "OTHER";`

---

### **4.3 Action Types**

Examples:

* CREATE

* UPDATE

* STATUS\_CHANGE

* APPROVE

* DENY

* ASSIGN

* CLOSE

* ROLE\_CHANGE

* CUSTOM

---

---

## **5\. INTENT VS EXECUTION (PHASE-3 CRITICAL DISTINCTION)**

---

The audit subsystem MUST explicitly distinguish between:

### **Intent Events**

Examples:

* “Owner requested guidance on enclosing balcony”

* “Owner submitted maintenance concern”

### **Decision Events**

Examples:

* “Concierge determined HOA approval required”

* “AI recommended deferring repair due to cost model”

* “Human concierge overrode AI recommendation”

### **Execution Events**

Examples:

* “Work order created”

* “External vendor contacted”

* “Repair scheduled”

**ConciergeCase events MUST NOT be conflated with WorkOrder or Job events.**

This separation is mandatory for:

* Legal defensibility

* AI supervision

* Accurate reconstruction of outcomes

---

---

## **6\. HUMAN, AI, AND SYSTEM ACTORS**

---

Every ActivityEvent MUST record **who acted** and **what kind of actor it was**.

### **Actor Rules**

* `performedByType = HUMAN`

  * Human user (owner, concierge, manager, board member)

* `performedByType = AI`

  * AI worker or assistant

  * `performedById = "ai:<agent-id>"`

* `performedByType = SYSTEM`

  * Scheduled jobs, migrations, background processes

### **AI-Specific Requirements**

AI-generated events SHOULD include:

`{`

  `"agentReasoningSummary": "Brief explanation of why the action was taken"`

`}`

This is mandatory once AI agents execute actions autonomously.

---

---

## **7\. DOCUMENT-DRIVEN DECISIONS**

---

When documents influence a decision, ActivityEvents MUST be able to reference them.

Example metadata:

`{`

  `"documentsReferenced": [`

    `{ "documentId": "doc_123", "version": 3 }`

  `]`

`}`

This applies to:

* HOA CC\&Rs

* Architectural guidelines

* Permits

* Prior approvals

This requirement is critical for:

* HOA disputes

* Owner challenges

* AI explainability

---

---

## **8\. CERBOS AUTHORIZATION CONTEXT**

---

When an action depends on **delegated authority or policy evaluation**, the audit record SHOULD capture authorization context.

Example:

`{`

  `"authorization": {`

    `"policyVersion": "2025-03",`

    `"resource": "concierge_case",`

    `"action": "approve",`

    `"role": "DELEGATED_AGENT",`

    `"decision": "ALLOW"`

  `}`

`}`

This is REQUIRED when:

* Delegated authority is exercised

* AI agents act

* Access is contested

---

---

## **9\. WORKFLOW INTEGRATION (DBOS)**

---

* All domain mutations occur inside DBOS workflows

* ActivityEvents MUST be written **inside the same durable transaction**

* Helper function:

`recordActivityEvent(`

  `organizationId,`

  `entityType,`

  `entityId,`

  `action,`

  `summary,`

  `metadata?`

`)`

* Workflow versioning applies equally to audit logic

---

---

## **10\. API LAYER INTEGRATION (oRPC)**

---

* All mutating oRPC procedures MUST:

  * Validate input

  * Authorize (Cerbos)

  * Execute DBOS workflow

  * Produce ActivityEvent

* ActivityEvent IDs MAY be attached to traces for debugging

---

---

## **11\. OBSERVABILITY BRIDGE (OpenTelemetry)**

---

Each ActivityEvent SHOULD be linked to telemetry:

* `activity.event_id`

* `activity.entity_type`

* `activity.action`

This enables:

* Trace → audit drill-down

* Audit → trace forensic analysis

---

---

## **12\. SECURITY, ACCESS, AND VISIBILITY**

---

* Tenant-scoped via RLS

* Role-based visibility:

  * Boards \> Managers \> Owners

  * Vendors limited to related entities

* Concierge staff limited to assigned tenants

* No deletion or modification of audit events

Redaction MAY be supported, but records remain immutable.

---

---

## **13\. RETENTION & ARCHIVAL**

---

* Minimum retention: **7 years**

* Financial and governance events may require longer

* Support archival and restore

* Sensitive metadata MAY be encrypted at rest

---

---

## **14\. AI SUPERVISION & FORENSICS**

---

The audit subsystem MUST support:

* Identification of AI-generated actions

* Human review queues

* Reconstruction of AI reasoning chains

* Training data extraction for future models

No AI agent may act without producing auditable history.

---

---

## **15\. SUMMARY**

---

Phase 4 is no longer optional infrastructure.

It is the **foundational trust layer** that makes:

* Concierge reasoning defensible

* AI actions inspectable

* Governance transparent

* Disputes resolvable

* The entire Hestami OS credible at scale

With Phase-3 integration, Activity & Audit becomes the **chronological narrative of truth** across intent, decision, and execution.

