# Janumi Professional Workbench Field Service Management SaaS Reference Undertaking

## Canonical RPH Fixture, Assurance Assignments, and Expected Event Trace

**Document ID:** `RPH-DOC-006`
**Status:** Reference implementation fixture
**Purpose:** Validate the Recursive Professional Harness architecture against one realistic Undertaking instantiated from the Product Realization PWA
**Applicable PWA:** Product Realization PWA
**Reference Undertaking:** Field Service Management SaaS Undertaking for small trades businesses
**Professional Work Graph:** Field Service Management Professional Work Graph
**Prospective produced product:** Field Service Management SaaS
**Scope of fixture:** Intent shaping through approved architecture baseline
**Deferred:** Full implementation, integrated validation, release baseline, and production deployment

The Product Realization PWA is the reusable architecture. The Field Service Management SaaS Undertaking is the concrete body of work represented by this fixture. Its Professional Work Graph contains the PWU Instances and other instantiated work objects below. The prospective Field Service Management SaaS product is an output of the Undertaking and is not the Undertaking itself.

---

# 1. Reference User Intent

## 1.1 Originating expression

> Build me a SaaS Field Service Management system for trades businesses such as plumbers, roofers, landscapers, lawn-care companies, deck builders, and similar small service businesses.

## 1.2 Why this Undertaking was selected

This intent is useful as an RPH reference because it is:

* commercially recognizable;
* materially underspecified;
* broad enough to require recursive decomposition;
* dependent on multiple professional perspectives;
* suitable for multi-tenant architecture;
* rich in assumptions, constraints, and user journeys;
* large enough to expose decomposition and assurance problems;
* familiar to the Product Realization PWA and the legacy Janumi Professional Workbench Product Lens phase implementation.

The request does not yet specify:

* target customer size;
* supported trades;
* primary user roles;
* geographic scope;
* mobile and offline requirements;
* scheduling complexity;
* payment behavior;
* accounting integrations;
* tenant isolation;
* compliance needs;
* initial release scope;
* success criteria.

The fixture therefore begins with a provisional intent rather than treating the user’s sentence as an executable specification.

---

# 2. Fixture Boundaries

## 2.1 Included

This reference fixture covers:

1. capture of raw intent;
2. intent discovery;
3. Product Intent formalization;
4. initial product behavior definition;
5. user-journey definition;
6. initial requirement formation;
7. architecture shaping;
8. architecture assumption disclosure;
9. architecture assurance;
10. human approval;
11. architecture baseline promotion.

## 2.2 Excluded

The fixture does not fully instantiate:

* implementation-level PWU Instances;
* source-code changes;
* production infrastructure;
* release management;
* complete security certification;
* complete cost analysis;
* detailed UI design;
* exhaustive field-service functionality;
* full multi-domain ontology.

## 2.3 Fixture objective

The fixture is successful if it proves that:

* work identity can remain separate from execution sequence;
* intent survives decomposition;
* assumptions become explicit objects;
* execution success remains separate from assurance success;
* Assurance Policies are evaluated through conforming validator implementations using evidence;
* a human decision references a specific semantic version;
* an architecture baseline can be promoted only through governed acceptance;
* traceability can be followed from user expression to baseline.

---

# 3. Object Index

The fixture uses the following top-level objects.

| Object ID                       | Type                   | Title                                   |
| ------------------------------- | ---------------------- | --------------------------------------- |
| `pwa_product_realization_1_3`   | PWA version            | Product Realization PWA v1.3            |
| `und_fsm_001`                   | Undertaking            | Field Service Management SaaS Undertaking |
| `pwut_product_realization`      | PWU Type               | Product Realization                     |
| `pwut_intent_product_definition` | PWU Type              | Intent and Product Definition           |
| `pwut_product_behavior`         | PWU Type               | Product Behavior Definition             |
| `pwut_architecture_definition`  | PWU Type               | Architecture Definition                 |
| `pwut_system_context`           | PWU Type               | System Context Definition               |
| `pwut_multitenancy_architecture` | PWU Type              | Multi-Tenancy Architecture              |
| `pwut_data_architecture`        | PWU Type               | Data Architecture                       |
| `pwut_mobile_offline_architecture` | PWU Type            | Mobile and Offline Architecture         |
| `pwut_integration_architecture` | PWU Type               | Integration Architecture                |
| `int_fsm_001`                   | Intent                 | Field Service Management Product Intent |
| `pwu_fsm_root`                  | PWU Instance           | Field Service Management Product Realization |
| `pwu_fsm_intent`                | PWU Instance           | Intent and Product Definition           |
| `pwu_fsm_behavior`              | PWU Instance           | Product Behavior Definition             |
| `pwu_fsm_arch`                  | PWU Instance           | Architecture Definition                 |
| `pwu_fsm_arch_context`          | PWU Instance           | System Context Definition               |
| `pwu_fsm_arch_multitenancy`     | PWU Instance           | Multi-Tenancy Architecture              |
| `pwu_fsm_arch_data`             | PWU Instance           | Data Architecture                       |
| `pwu_fsm_arch_mobile`           | PWU Instance           | Mobile and Offline Architecture         |
| `pwu_fsm_arch_integrations`     | PWU Instance           | Integration Architecture                |
| `dcp_fsm_arch_001`              | Decomposition Contract | Architecture Decomposition              |
| `rcp_fsm_arch_001`              | Recomposition Contract | Architecture Recomposition              |
| `plan_fsm_intent_001`           | Execution Plan         | Intent Discovery Plan                   |
| `plan_fsm_arch_001`             | Execution Plan         | Architecture Generation Plan            |
| `pol_intent_fidelity_v1`        | Assurance Policy       | Intent Fidelity                         |
| `pol_intent_complete_v1`        | Assurance Policy       | Intent Completeness                     |
| `pol_assumption_disclosure_v1`  | Assurance Policy       | Assumption Disclosure                   |
| `pol_decomposition_coverage_v1` | Assurance Policy       | Decomposition Coverage                  |
| `pol_arch_coverage_v1`          | Assurance Policy       | Architecture Coverage                   |
| `pol_intent_preservation_v1`    | Assurance Policy       | Intent Preservation                     |
| `asm_fsm_001`                   | Assumption             | Initial target is small businesses      |
| `asm_fsm_002`                   | Assumption             | US-first deployment                     |
| `asm_fsm_003`                   | Assumption             | Offline mobile capability is required   |
| `asm_fsm_004`                   | Assumption             | Payments are initially delegated        |
| `dec_fsm_intent_001`            | Decision               | Approve Product Intent                  |
| `dec_fsm_arch_001`              | Decision               | Approve Architecture Baseline           |
| `base_fsm_intent_001`           | Baseline               | Product Intent Baseline                 |
| `base_fsm_arch_001`             | Baseline               | Architecture Baseline                   |

All `pwu_fsm_*` records in this fixture are concrete PWU Instances owned by the Field Service Management SaaS Undertaking. Their `pwuKind` values are compatibility identifiers that must resolve to governing PWU Types defined by the selected Product Realization PWA version; `pwuKind` does not make an instance a reusable type.

Canonical binding:

| PWU Instance ID                  | Governing PWU Type ID                 |
| -------------------------------- | ------------------------------------- |
| `pwu_fsm_root`                 | `pwut_product_realization`          |
| `pwu_fsm_intent`               | `pwut_intent_product_definition`    |
| `pwu_fsm_behavior`             | `pwut_product_behavior`             |
| `pwu_fsm_arch`                 | `pwut_architecture_definition`      |
| `pwu_fsm_arch_context`         | `pwut_system_context`               |
| `pwu_fsm_arch_multitenancy`    | `pwut_multitenancy_architecture`    |
| `pwu_fsm_arch_data`            | `pwut_data_architecture`            |
| `pwu_fsm_arch_mobile`          | `pwut_mobile_offline_architecture`  |
| `pwu_fsm_arch_integrations`    | `pwut_integration_architecture`     |

Every row above is bound through `undertakingId = und_fsm_001`; `und_fsm_001` is bound to `pwa_product_realization_1_3`, the immutable Product Realization PWA v1.3 definition.

These fixture IDs are deterministic, human-readable test identifiers. Production identifiers use the opaque prefixed ULID or UUIDv7 format defined by the contract package.

---

# 4. Raw Intent Object

```json
{
  "id": "int_fsm_001",
  "objectType": "INTENT",
  "undertakingId": "und_fsm_001",
  "semanticVersion": 1,
  "revision": 1,
  "lifecycleStatus": "UNDER_DISCOVERY",
  "originatingExpression": "Build me a SaaS Field Service Management system for trades businesses such as plumbers, roofers, landscapers, lawn-care companies, deck builders, and similar small service businesses.",
  "formalizedObjective": null,
  "desiredOutcomes": [],
  "successConditions": [],
  "nonGoals": [],
  "ambiguityIds": [
    "amb_fsm_customer_size",
    "amb_fsm_initial_scope",
    "amb_fsm_mobile_offline",
    "amb_fsm_geography",
    "amb_fsm_payments",
    "amb_fsm_integrations"
  ],
  "constraintIds": [],
  "stakeholderIds": [],
  "intentStatus": "UNDER_DISCOVERY",
  "createdBy": {
    "actorId": "human_user_001",
    "actorType": "HUMAN",
    "displayName": "Product Owner"
  }
}
```

---

# 5. Formalized Product Intent

After intent discovery, the proposed Product Intent becomes:

> Create a multi-tenant Field Service Management SaaS that enables small and lower-middle-market trades businesses to manage customers, service locations, work requests, estimates, schedules, field assignments, job status, technician activity, invoices, and operational communication through web and mobile interfaces.

## 5.1 Desired outcomes

1. Office staff can manage the lifecycle from customer request through job completion.
2. Dispatchers can schedule and assign field work.
3. Technicians can access assigned jobs and update work status in the field.
4. Business owners can see current operational status.
5. Customer, property, job, estimate, invoice, and communication records remain traceable.
6. Each tenant’s business data remains isolated from other tenants.
7. The initial platform can grow into additional trades and integrations without redesigning its core domain model.

## 5.2 Initial success conditions

* A tenant can create and manage customers and service locations.
* A work request can become an estimate, scheduled job, completed work, and invoice.
* A dispatcher can assign a technician and time window.
* A technician can view assigned work and update job state.
* Tenant data is isolated and authorization is enforced.
* The system preserves an auditable history of important job-state changes.
* The architecture supports a responsive web client and a future native mobile client.
* The architecture does not require all possible trade-specific functionality in the initial release.

## 5.3 Initial non-goals

* Full accounting-system replacement.
* Payroll processing.
* Enterprise workforce optimization.
* Complete route optimization.
* Inventory and warehouse management.
* Marketplace matching between consumers and contractors.
* Deep trade-specific estimating logic in the first release.
* International tax and regulatory support.

## 5.4 Initial boundaries

### In scope

* B2B SaaS.
* Multi-tenant operation.
* Office and field users.
* Customer and service-location management.
* Work intake.
* Estimate and job lifecycle.
* Scheduling and assignment.
* Technician updates.
* Invoicing records.
* Notifications and communication records.
* Auditability.
* Web-first implementation with mobile architecture support.

### Out of scope for initial baseline

* Native mobile implementation.
* Advanced dispatch optimization.
* Accounting ledger.
* Payroll.
* Complex inventory.
* Consumer marketplace.
* Multi-country localization.

---

# 6. Initial Constraints

## 6.1 Multi-tenancy constraint

```json
{
  "id": "con_fsm_multitenancy",
  "objectType": "CONSTRAINT",
  "statement": "All tenant-owned operational data must be isolated by enforceable authorization and persistence boundaries.",
  "constraintType": "SECURITY",
  "strength": "MANDATORY",
  "status": "ACTIVE"
}
```

## 6.2 Auditability constraint

```json
{
  "id": "con_fsm_auditability",
  "objectType": "CONSTRAINT",
  "statement": "Material job, estimate, assignment, invoice, and authorization state changes must remain traceable.",
  "constraintType": "BUSINESS",
  "strength": "MANDATORY",
  "status": "ACTIVE"
}
```

## 6.3 Extensibility constraint

```json
{
  "id": "con_fsm_extensibility",
  "objectType": "CONSTRAINT",
  "statement": "The core model must support multiple trades without embedding one trade's terminology or workflow as universal behavior.",
  "constraintType": "ARCHITECTURAL",
  "strength": "MANDATORY",
  "status": "ACTIVE"
}
```

## 6.4 Mobile-readiness constraint

```json
{
  "id": "con_fsm_mobile_ready",
  "objectType": "CONSTRAINT",
  "statement": "The architecture must permit field-user access through mobile clients and intermittent-connectivity workflows.",
  "constraintType": "TECHNICAL",
  "strength": "PREFERRED",
  "status": "ACTIVE"
}
```

---

# 7. Initial Assumptions

## 7.1 Small-business target assumption

```json
{
  "id": "asm_fsm_001",
  "objectType": "ASSUMPTION",
  "statement": "The initial customer profile is a small or lower-middle-market trades business rather than a national enterprise.",
  "basis": "The originating examples emphasize local service trades and no enterprise requirements were stated.",
  "affectedObjectIds": [
    "int_fsm_001",
    "pwu_fsm_behavior",
    "pwu_fsm_arch"
  ],
  "materiality": "MATERIAL",
  "status": "DISCLOSED"
}
```

## 7.2 Geography assumption

```json
{
  "id": "asm_fsm_002",
  "objectType": "ASSUMPTION",
  "statement": "The initial release is intended for the United States.",
  "basis": "No internationalization, currency, tax, or regulatory requirements were supplied.",
  "affectedObjectIds": [
    "int_fsm_001",
    "pwu_fsm_behavior",
    "pwu_fsm_arch_integrations"
  ],
  "materiality": "MATERIAL",
  "status": "DISCLOSED"
}
```

## 7.3 Offline assumption

```json
{
  "id": "asm_fsm_003",
  "objectType": "ASSUMPTION",
  "statement": "Field technicians may operate with intermittent connectivity and will ultimately require limited offline capability.",
  "basis": "Field-service work frequently occurs at sites with unreliable connectivity.",
  "affectedObjectIds": [
    "pwu_fsm_arch_mobile",
    "con_fsm_mobile_ready"
  ],
  "materiality": "MATERIAL",
  "status": "DISCLOSED"
}
```

## 7.4 Payment delegation assumption

```json
{
  "id": "asm_fsm_004",
  "objectType": "ASSUMPTION",
  "statement": "The initial system records invoice and payment status but delegates payment processing to an external provider.",
  "basis": "The originating intent did not require the product to implement payment processing directly.",
  "affectedObjectIds": [
    "pwu_fsm_behavior",
    "pwu_fsm_arch_integrations"
  ],
  "materiality": "MATERIAL",
  "status": "DISCLOSED"
}
```

---

# 8. Root Product Realization PWU Instance

```json
{
  "id": "pwu_fsm_root",
  "objectType": "PROFESSIONAL_WORK_UNIT",
  "undertakingId": "und_fsm_001",
  "pwuTypeId": "pwut_product_realization",
  "isLocalExtension": false,
  "pwuKind": "PRODUCT_REALIZATION",
  "title": "Field Service Management Product Realization",
  "description": "Transform the approved Field Service Management Product Intent into an implemented and assured software baseline.",
  "intentId": "int_fsm_001",
  "parentWorkUnitId": null,
  "obligationIds": [
    "obl_fsm_preserve_intent",
    "obl_fsm_produce_baseline",
    "obl_fsm_assure_outcome"
  ],
  "constraintIds": [
    "con_fsm_multitenancy",
    "con_fsm_auditability",
    "con_fsm_extensibility",
    "con_fsm_mobile_ready"
  ],
  "assumptionIds": [
    "asm_fsm_001",
    "asm_fsm_002",
    "asm_fsm_003",
    "asm_fsm_004"
  ],
  "evidenceRequirementIds": [
    "evreq_fsm_intent",
    "evreq_fsm_behavior",
    "evreq_fsm_arch",
    "evreq_fsm_validation"
  ],
  "verificationCriterionIds": [
    "ver_fsm_root_intent",
    "ver_fsm_root_evidence",
    "ver_fsm_root_governance"
  ],
  "executionState": "NOT_PLANNED",
  "assuranceState": "UNASSESSED",
  "shapeIntegrityState": "UNKNOWN",
  "workLifecycleState": "SHAPING",
  "riskProfile": {
    "consequence": "HIGH",
    "uncertainty": "HIGH",
    "irreversibility": "MEDIUM",
    "securitySensitivity": "HIGH",
    "regulatoryExposure": "LOW"
  }
}
```

---

# 9. Semantic PWU Instance Hierarchy

```text
Field Service Management Product Realization
├── Intent and Product Definition
├── Product Behavior Definition
├── Architecture Definition
│   ├── System Context Definition
│   ├── Multi-Tenancy Architecture
│   ├── Data Architecture
│   ├── Mobile and Offline Architecture
│   └── Integration Architecture
├── Implementation Planning
├── Product Implementation
├── Integrated Product Validation
└── Product Baseline Promotion
```

Only the first three major branches are fully instantiated in this fixture.

Each displayed node is a PWU Instance bound to the correspondingly named PWU Type in the Product Realization PWA.

---

# 10. Intent and Product Definition PWU Instance

```json
{
  "id": "pwu_fsm_intent",
  "objectType": "PROFESSIONAL_WORK_UNIT",
  "undertakingId": "und_fsm_001",
  "pwuTypeId": "pwut_intent_product_definition",
  "isLocalExtension": false,
  "pwuKind": "INTENT_AND_PRODUCT_DEFINITION",
  "title": "Intent and Product Definition",
  "intentId": "int_fsm_001",
  "parentWorkUnitId": "pwu_fsm_root",
  "obligationIds": [
    "obl_fsm_formalize_intent",
    "obl_fsm_define_scope",
    "obl_fsm_surface_ambiguity"
  ],
  "constraintIds": [],
  "assumptionIds": [
    "asm_fsm_001",
    "asm_fsm_002"
  ],
  "expectedOutputs": [
    {
      "artifactType": "PRODUCT_INTENT",
      "required": true
    },
    {
      "artifactType": "PRODUCT_BOUNDARY",
      "required": true
    },
    {
      "artifactType": "CONSTRAINT_CATALOG",
      "required": true
    }
  ],
  "assurancePolicyIds": [
    "pol_intent_fidelity_v1",
    "pol_intent_complete_v1",
    "pol_assumption_disclosure_v1"
  ],
  "executionState": "PLANNED",
  "assuranceState": "UNASSESSED",
  "shapeIntegrityState": "UNKNOWN",
  "workLifecycleState": "PLANNED"
}
```

---

# 11. Product Behavior Definition PWU Instance

## 11.1 Purpose

Define the first product behavior model sufficient to inform architecture.

## 11.2 Initial actors

* Business Owner
* Office Administrator
* Dispatcher
* Field Technician
* Customer
* External Payment Provider
* External Accounting System
* Notification Provider

## 11.3 Initial capabilities

* Tenant administration
* User and role management
* Customer management
* Service-location management
* Work-request intake
* Estimate creation
* Scheduling and dispatch
* Technician assignment
* Job-state management
* Field notes and evidence
* Invoice generation
* Payment-status recording
* Customer communication
* Operational reporting
* Audit history

## 11.4 Critical journey

### Journey: Request to Completed Job

```text
Customer or office staff creates work request
→ Office reviews request
→ Estimate is prepared
→ Customer approves estimate
→ Job is scheduled
→ Technician is assigned
→ Technician performs work
→ Technician records completion
→ Office reviews completion
→ Invoice is issued
→ Payment status is recorded
```

### Exceptional paths

* Estimate rejected.
* Customer requests revision.
* Technician unavailable.
* Job rescheduled.
* Work requires follow-up visit.
* Technician cannot complete work.
* Customer cancels.
* Network unavailable during field update.
* Invoice disputed.

## 11.5 Representative requirements

### Requirement FSM-FUNC-001

> The system shall allow an authorized tenant user to create and maintain customers and service locations.

### Requirement FSM-FUNC-002

> The system shall allow an authorized user to create a work request associated with a customer and service location.

### Requirement FSM-FUNC-003

> The system shall support conversion of an approved estimate into a schedulable job.

### Requirement FSM-FUNC-004

> The system shall allow an authorized dispatcher to assign a technician and scheduled time window to a job.

### Requirement FSM-FUNC-005

> The system shall allow a technician to view assigned jobs and record permitted job-state transitions.

### Requirement FSM-SEC-001

> A tenant user shall not access another tenant’s customers, locations, jobs, estimates, invoices, or communications.

### Requirement FSM-AUD-001

> The system shall retain an auditable record of material job-state changes.

### Requirement FSM-QUAL-001

> The core product model shall support trade-specific extensions without requiring modification of universal customer, location, job, and assignment identities.

---

# 12. Architecture Definition PWU Instance

```json
{
  "id": "pwu_fsm_arch",
  "objectType": "PROFESSIONAL_WORK_UNIT",
  "undertakingId": "und_fsm_001",
  "pwuTypeId": "pwut_architecture_definition",
  "isLocalExtension": false,
  "pwuKind": "ARCHITECTURE_DEFINITION",
  "title": "Field Service Architecture Definition",
  "intentId": "int_fsm_001",
  "parentWorkUnitId": "pwu_fsm_root",
  "obligationIds": [
    "obl_fsm_arch_cover_requirements",
    "obl_fsm_arch_isolate_tenants",
    "obl_fsm_arch_preserve_audit",
    "obl_fsm_arch_support_mobile",
    "obl_fsm_arch_support_extensions"
  ],
  "constraintIds": [
    "con_fsm_multitenancy",
    "con_fsm_auditability",
    "con_fsm_extensibility",
    "con_fsm_mobile_ready"
  ],
  "assumptionIds": [
    "asm_fsm_001",
    "asm_fsm_002",
    "asm_fsm_003",
    "asm_fsm_004"
  ],
  "decompositionContractId": "dcp_fsm_arch_001",
  "recompositionContractId": "rcp_fsm_arch_001",
  "assurancePolicyIds": [
    "pol_assumption_disclosure_v1",
    "pol_decomposition_coverage_v1",
    "pol_arch_coverage_v1",
    "pol_intent_preservation_v1"
  ],
  "executionState": "PLANNED",
  "assuranceState": "UNASSESSED",
  "shapeIntegrityState": "UNKNOWN",
  "workLifecycleState": "PLANNED"
}
```

---

# 13. Architecture Decomposition Contract

```json
{
  "id": "dcp_fsm_arch_001",
  "objectType": "DECOMPOSITION_CONTRACT",
  "parentWorkUnitId": "pwu_fsm_arch",
  "childWorkUnitIds": [
    "pwu_fsm_arch_context",
    "pwu_fsm_arch_multitenancy",
    "pwu_fsm_arch_data",
    "pwu_fsm_arch_mobile",
    "pwu_fsm_arch_integrations"
  ],
  "rationale": "The architecture has several materially different professional concerns that require distinct outputs and assurance while remaining recomposable into one architecture baseline.",
  "obligationAllocations": [
    {
      "obligationId": "obl_fsm_arch_cover_requirements",
      "allocatedTo": [
        "pwu_fsm_arch_context",
        "pwu_fsm_arch_data",
        "pwu_fsm_arch_integrations"
      ]
    },
    {
      "obligationId": "obl_fsm_arch_isolate_tenants",
      "allocatedTo": [
        "pwu_fsm_arch_multitenancy",
        "pwu_fsm_arch_data"
      ]
    },
    {
      "obligationId": "obl_fsm_arch_preserve_audit",
      "allocatedTo": [
        "pwu_fsm_arch_data"
      ]
    },
    {
      "obligationId": "obl_fsm_arch_support_mobile",
      "allocatedTo": [
        "pwu_fsm_arch_mobile",
        "pwu_fsm_arch_context"
      ]
    },
    {
      "obligationId": "obl_fsm_arch_support_extensions",
      "allocatedTo": [
        "pwu_fsm_arch_context",
        "pwu_fsm_arch_data"
      ]
    }
  ],
  "constraintPropagations": [
    {
      "constraintId": "con_fsm_multitenancy",
      "childWorkUnitIds": [
        "pwu_fsm_arch_multitenancy",
        "pwu_fsm_arch_data",
        "pwu_fsm_arch_integrations"
      ]
    },
    {
      "constraintId": "con_fsm_auditability",
      "childWorkUnitIds": [
        "pwu_fsm_arch_data"
      ]
    },
    {
      "constraintId": "con_fsm_extensibility",
      "childWorkUnitIds": [
        "pwu_fsm_arch_context",
        "pwu_fsm_arch_data"
      ]
    },
    {
      "constraintId": "con_fsm_mobile_ready",
      "childWorkUnitIds": [
        "pwu_fsm_arch_mobile"
      ]
    }
  ],
  "coverageClaims": [
    {
      "claimId": "clm_fsm_arch_decomposition_complete",
      "parentObligationIds": [
        "obl_fsm_arch_cover_requirements",
        "obl_fsm_arch_isolate_tenants",
        "obl_fsm_arch_preserve_audit",
        "obl_fsm_arch_support_mobile",
        "obl_fsm_arch_support_extensions"
      ],
      "childWorkUnitIds": [
        "pwu_fsm_arch_context",
        "pwu_fsm_arch_multitenancy",
        "pwu_fsm_arch_data",
        "pwu_fsm_arch_mobile",
        "pwu_fsm_arch_integrations"
      ],
      "coverageType": "COMPLETE",
      "rationale": "Each architecture obligation is allocated to one or more child units and recomposed at the parent."
    }
  ],
  "recompositionContractId": "rcp_fsm_arch_001",
  "status": "UNDER_REVIEW"
}
```

---

# 14. Architecture Child PWU Instances

## 14.1 System Context Definition

Purpose:

* define system boundary;
* identify external actors and systems;
* establish major product responsibilities;
* distinguish universal and trade-specific concerns.

Expected outputs:

* system-context diagram;
* responsibility boundary;
* external-system catalog;
* high-level component model.

## 14.2 Multi-Tenancy Architecture

Purpose:

* define tenant identity;
* define tenant-scoped authorization;
* define persistence isolation;
* define tenant-aware runtime behavior.

Principal claim:

> The architecture provides enforceable tenant isolation across authorization, queries, storage, caching, background work, and integrations.

## 14.3 Data Architecture

Purpose:

* define core entities;
* define ownership;
* define lifecycle;
* define audit strategy;
* define extensibility mechanism.

Initial core entities:

* Tenant
* User
* Role
* Customer
* ServiceLocation
* WorkRequest
* Estimate
* EstimateLine
* Job
* Appointment
* Assignment
* Technician
* WorkNote
* Attachment
* Invoice
* PaymentRecord
* Communication
* AuditEvent

## 14.4 Mobile and Offline Architecture

Purpose:

* define mobile-client boundary;
* define intermittent-connectivity strategy;
* define synchronization behavior;
* prevent the web client from becoming an accidental permanent constraint.

## 14.5 Integration Architecture

Purpose:

* define provider boundaries for payments, accounting, notifications, maps, and future integrations;
* preserve traceability and tenant context across integration calls;
* avoid embedding provider-specific semantics into core domain objects.

---

# 15. Candidate Architecture Output

The fixture assumes the architecture generator produces this candidate shape:

```text
Clients
├── Responsive Web Application
├── Future Native Mobile Client
└── External Integration Clients

Application Boundary
├── Authentication and Authorization
├── Tenant Context
├── Customer and Location Management
├── Work Intake and Estimates
├── Scheduling and Dispatch
├── Job Execution
├── Invoicing
├── Communication
├── Reporting
└── Audit and History

Core Services
├── API Layer
├── Application Services
├── Domain Model
├── Durable Workflow Service
├── Notification Adapter
├── Payment Adapter
├── Accounting Adapter
└── File and Media Service

Persistence
├── Relational Database
├── Object Storage
├── Search or Indexing Layer
└── Audit/Event Store

Operational Boundary
├── Observability
├── Background Processing
├── Secrets
├── Tenant-Aware Authorization
└── Backup and Recovery
```

This output is an architecture artifact, not proof that the Architecture Definition PWU Instance is satisfied.

---

# 16. Architecture Claims

## Claim FSM-ARCH-001

> The architecture covers the currently approved product capabilities.

## Claim FSM-ARCH-002

> The architecture provides an enforceable multi-tenant boundary.

## Claim FSM-ARCH-003

> The architecture supports traceable job and operational state changes.

## Claim FSM-ARCH-004

> The architecture does not hardcode one trade’s workflow as the universal product model.

## Claim FSM-ARCH-005

> The architecture permits future native mobile and intermittent-connectivity support.

## Claim FSM-ARCH-006

> External payment and accounting providers can be integrated without redefining core invoice and job identities.

---

# 17. Required Architecture Evidence

| Evidence ID                     | Evidence type         | Supports                              |
| ------------------------------- | --------------------- | ------------------------------------- |
| `evd_fsm_intent_baseline`       | Approved intent       | All architecture claims               |
| `evd_fsm_requirement_trace`     | Trace matrix          | Architecture coverage                 |
| `evd_fsm_context_diagram`       | Architecture artifact | Boundary and integration claims       |
| `evd_fsm_tenant_model`          | Architecture analysis | Tenant-isolation claim                |
| `evd_fsm_data_model`            | Data model            | Auditability and extensibility claims |
| `evd_fsm_mobile_strategy`       | Architecture analysis | Mobile-readiness claim                |
| `evd_fsm_integration_contracts` | Interface artifact    | Provider-decoupling claim             |
| `evd_fsm_assumption_catalog`    | Assurance artifact    | Residual uncertainty                  |

---

# 18. Assurance Policy Assignments

## 18.1 Intent Fidelity

Applied to:

* formalized Product Intent;
* Product Intent Baseline.

Evaluates:

* whether “small trades businesses” was preserved;
* whether the platform was silently transformed into a marketplace;
* whether advanced enterprise functionality was incorrectly made mandatory;
* whether excluded functionality was presented as required.

## 18.2 Intent Completeness

Applied before architecture.

Evaluates whether architecture has enough information concerning:

* users;
* capabilities;
* geography;
* tenant model;
* deployment assumptions;
* success conditions;
* non-goals.

## 18.3 Assumption Disclosure

Applied to:

* intent synthesis;
* behavior model;
* architecture output;
* architecture rationale.

Expected findings include:

* US-first assumption;
* small-business target assumption;
* offline assumption;
* delegated-payments assumption;
* unverified scale assumptions.

## 18.4 Decomposition Coverage

Applied to `dcp_fsm_arch_001`.

Evaluates whether:

* tenant isolation is allocated;
* auditability is allocated;
* mobile-readiness is allocated;
* extensibility is allocated;
* integration concerns are represented;
* architecture can be recomposed.

## 18.5 Architecture Coverage

Evaluates claims FSM-ARCH-001 through FSM-ARCH-006.

## 18.6 Intent Preservation

Compares:

```text
Originating expression
→ approved Product Intent
→ product behavior
→ architecture
```

It checks for:

* marketplace drift;
* enterprise-platform drift;
* trade-specific overfitting;
* loss of field-user needs;
* loss of tenant isolation;
* substitution of implementation convenience for product need.

---

# 19. Sample Assurance Assessment

```json
{
  "id": "assess_fsm_arch_coverage_001",
  "objectType": "ASSURANCE_ASSESSMENT",
  "assurancePolicyId": "pol_arch_coverage_v1",
  "policySemanticVersion": 1,
  "subjectObjectIds": [
    "pwu_fsm_arch",
    "art_fsm_architecture_001"
  ],
  "claimIds": [
    "clm_fsm_arch_001",
    "clm_fsm_arch_002",
    "clm_fsm_arch_003",
    "clm_fsm_arch_004",
    "clm_fsm_arch_005",
    "clm_fsm_arch_006"
  ],
  "evaluator": {
    "actorId": "agent_verifier_001",
    "actorType": "AGENT",
    "displayName": "Architecture Verifier",
    "executionInstanceId": "exec_verifier_fsm_001"
  },
  "evidenceConsideredIds": [
    "evd_fsm_intent_baseline",
    "evd_fsm_requirement_trace",
    "evd_fsm_context_diagram",
    "evd_fsm_tenant_model",
    "evd_fsm_data_model",
    "evd_fsm_mobile_strategy",
    "evd_fsm_integration_contracts",
    "evd_fsm_assumption_catalog"
  ],
  "observationIds": [
    "obs_fsm_arch_001",
    "obs_fsm_arch_002"
  ],
  "disposition": "CONDITIONALLY_SATISFIED",
  "residualUncertainty": [
    "The required offline capability is not yet sufficiently bounded.",
    "Tenant-isolation verification criteria require greater specificity before implementation."
  ],
  "recommendedControlAction": "GATHER_EVIDENCE"
}
```

---

# 20. Sample Assurance Observations

## Observation 1: Offline ambiguity

```json
{
  "id": "obs_fsm_arch_001",
  "objectType": "ASSURANCE_OBSERVATION",
  "assessmentId": "assess_fsm_arch_coverage_001",
  "subjectObjectIds": [
    "pwu_fsm_arch_mobile",
    "asm_fsm_003"
  ],
  "observationType": "EVIDENCE_DEFICIT",
  "severity": "MATERIAL",
  "statement": "The architecture anticipates intermittent connectivity, but the required offline operations and conflict-resolution behavior have not been bounded.",
  "evidenceIds": [
    "evd_fsm_mobile_strategy"
  ],
  "disposition": "OPEN"
}
```

## Observation 2: Tenant isolation criteria incomplete

```json
{
  "id": "obs_fsm_arch_002",
  "objectType": "ASSURANCE_OBSERVATION",
  "assessmentId": "assess_fsm_arch_coverage_001",
  "subjectObjectIds": [
    "pwu_fsm_arch_multitenancy",
    "clm_fsm_arch_002"
  ],
  "observationType": "RECOMMENDATION",
  "severity": "MATERIAL",
  "statement": "Tenant isolation is architecturally represented, but implementation-level verification must include authorization, query scoping, cache isolation, job execution, object storage, and integration context.",
  "evidenceIds": [
    "evd_fsm_tenant_model"
  ],
  "disposition": "OPEN"
}
```

---

# 21. Controller Response

The controller evaluates the architecture result:

```text
Execution State: SUCCEEDED
Assurance State: CONDITIONALLY_SATISFIED
Shape Integrity: AT_RISK
Open Material Observations: 2
```

It does not mark the Architecture Definition PWU Instance as satisfied.

Recommended response:

1. Create clarification question for offline scope.
2. Revise mobile architecture evidence.
3. Create implementation-level tenant-isolation verification obligation.
4. Re-run Architecture Coverage.
5. Present the revised evidence package for human approval.

This demonstrates the key distinction:

> Architecture generation succeeded, but architecture assurance is not yet complete.

---

# 22. Human Architecture Decision

After remediation, the human receives:

* approved Product Intent;
* architecture artifact;
* architecture claims;
* evidence;
* assumptions;
* assurance findings produced through validator implementations;
* resolved observations;
* residual uncertainty;
* proposed baseline purpose.

The human decision is:

```json
{
  "id": "dec_fsm_arch_001",
  "objectType": "DECISION",
  "decisionType": "APPROVAL",
  "subjectObjectIds": [
    "pwu_fsm_arch",
    "art_fsm_architecture_002",
    "base_fsm_arch_001"
  ],
  "selectedOption": "Approve architecture for implementation planning",
  "rationale": "The architecture sufficiently covers the approved product scope. Limited offline capability is retained as an architectural requirement but deferred from the first implementation increment. Tenant-isolation verification obligations must remain mandatory.",
  "authority": {
    "actorId": "human_user_001",
    "actorType": "HUMAN",
    "displayName": "Product Owner"
  },
  "consideredEvidenceIds": [
    "evd_fsm_intent_baseline",
    "evd_fsm_requirement_trace",
    "evd_fsm_context_diagram",
    "evd_fsm_tenant_model",
    "evd_fsm_data_model",
    "evd_fsm_mobile_strategy_v2",
    "evd_fsm_integration_contracts"
  ],
  "consideredObservationIds": [
    "obs_fsm_arch_001",
    "obs_fsm_arch_002"
  ],
  "status": "EFFECTIVE"
}
```

The decision approves a specific semantic version.

Any later semantic architecture change invalidates or supersedes this approval.

---

# 23. Architecture Baseline

```json
{
  "id": "base_fsm_arch_001",
  "objectType": "BASELINE",
  "baselineType": "ARCHITECTURE",
  "itemObjectIds": [
    "art_fsm_architecture_002",
    "art_fsm_context_001",
    "art_fsm_tenant_arch_001",
    "art_fsm_data_arch_001",
    "art_fsm_mobile_arch_002",
    "art_fsm_integration_arch_001"
  ],
  "assuranceAssessmentIds": [
    "assess_fsm_arch_coverage_002",
    "assess_fsm_intent_preservation_001",
    "assess_fsm_assumption_disclosure_001",
    "assess_fsm_decomposition_001"
  ],
  "promotionDecisionId": "dec_fsm_arch_001",
  "status": "AUTHORITATIVE"
}
```

Purpose:

> Authoritative architecture reference for implementation planning, subject to recorded constraints, assumptions, and residual uncertainty.

---

# 24. Recomposition Contract

```json
{
  "id": "rcp_fsm_arch_001",
  "objectType": "RECOMPOSITION_CONTRACT",
  "parentWorkUnitId": "pwu_fsm_arch",
  "requiredChildWorkUnitIds": [
    "pwu_fsm_arch_context",
    "pwu_fsm_arch_multitenancy",
    "pwu_fsm_arch_data",
    "pwu_fsm_arch_mobile",
    "pwu_fsm_arch_integrations"
  ],
  "aggregationRules": [
    {
      "rule": "All child artifacts must use a consistent tenant identity model."
    },
    {
      "rule": "Data ownership and integration contracts must preserve tenant context."
    },
    {
      "rule": "Mobile synchronization must not bypass authorization or audit obligations."
    },
    {
      "rule": "Trade-specific extensions must not alter universal entity identity."
    }
  ],
  "conflictResolutionRules": [
    {
      "conflictType": "TENANT_IDENTITY_MISMATCH",
      "action": "REJECT_RECOMPOSITION"
    },
    {
      "conflictType": "OFFLINE_AUDIT_CONFLICT",
      "action": "RESHAPE_MOBILE_ARCHITECTURE"
    }
  ],
  "parentCompletionClaimId": "clm_fsm_arch_parent_complete",
  "status": "SATISFIED"
}
```

---

# 25. Traceability Chain

The reference fixture must support this query:

```text
Originating user expression
  ↓ DERIVED_FROM
Approved Product Intent
  ↓ DEFINES
Desired Outcome: Manage work-request-to-invoice lifecycle
  ↓ REALIZED_BY
User Journey: Request to Completed Job
  ↓ REFINED_BY
Requirement FSM-FUNC-004
  ↓ ALLOCATED_TO
Scheduling and Dispatch Architecture Concern
  ↓ PRODUCES
Architecture Artifact
  ↓ SUPPORTS
Architecture Coverage Claim
  ↓ VERIFIED_BY
Architecture Assurance Assessment
  ↓ APPROVED_BY
Human Architecture Decision
  ↓ PROMOTES
Architecture Baseline
```

A second chain should demonstrate a constraint:

```text
Multi-Tenancy Constraint
  ↓ PROPAGATES_TO
Multi-Tenancy Architecture PWU Instance
  ↓ PRODUCES
Tenant Isolation Model
  ↓ SUPPORTS
Tenant Isolation Claim
  ↓ VERIFIED_BY
Architecture Assessment
  ↓ BECOMES
Mandatory Implementation Verification Obligation
```

---

# 26. Expected Event Trace

The following sequence is representative rather than exhaustive.

```text
1. IntentCaptured
2. PwuProposed: Product Realization
3. PwuProposed: Intent and Product Definition
4. IntentDiscoveryStarted
5. AssumptionDetected: Initial customer size
6. AssumptionDetected: US-first scope
7. IntentFormalized
8. AssuranceAssessmentRequested: Intent Fidelity
9. AssuranceAssessmentStarted
10. AssuranceObservationRecorded
11. AssuranceAssessmentSatisfied
12. DecisionProposed: Approve Intent
13. DecisionEffective
14. IntentApproved
15. BaselineCreated: Intent Baseline
16. BaselinePromoted: Intent Baseline

17. PwuProposed: Product Behavior Definition
18. PwuShapingStarted
19. ClaimAsserted: Behavior sufficiently covers intent
20. PwuMarkedReady
21. ExecutionPlanProposed
22. ExecutionPlanApproved
23. ExecutionPlanActivated
24. ExecutionStepStarted
25. ExecutionStepSucceeded
26. EvidenceProposed: Journey and requirement artifacts
27. EvidenceAdmitted
28. PwuSatisfied

29. PwuProposed: Architecture Definition
30. DecompositionProposed
31. AssuranceAssessmentRequested: Decomposition Coverage
32. DecompositionValidated
33. PwuMarkedReady
34. ExecutionPlanProposed
35. ExecutionPlanApproved
36. RuntimeBindingRequested
37. RuntimeBindingAuthorized
38. ExecutionPlanActivated
39. ExecutionStepStarted: Generate architecture
40. ExecutionStepSucceeded
41. EvidenceProposed: Architecture artifacts
42. AssumptionDetected: Offline behavior
43. AssumptionDetected: Payment provider delegation
44. AssuranceAssessmentRequested: Assumption Disclosure
45. AssuranceAssessmentSatisfied
46. AssuranceAssessmentRequested: Architecture Coverage
47. AssuranceObservationRecorded: Offline ambiguity
48. AssuranceObservationRecorded: Tenant isolation criteria
49. AssuranceAssessmentConditionallySatisfied
50. PwuChallenged
51. TacticalChangeRequested
52. ClarificationRequested
53. IntentConstraintRefined: Offline scope
54. ExecutionPlanRevised
55. ExecutionStepStarted: Revise architecture
56. ExecutionStepSucceeded
57. EvidenceProposed: Revised mobile architecture
58. EvidenceAdmitted
59. AssuranceAssessmentRequested: Architecture Coverage
60. AssuranceAssessmentSatisfied
61. AssuranceAssessmentRequested: Intent Preservation
62. AssuranceAssessmentSatisfied
63. PwuSatisfied
64. RecompositionStarted
65. RecompositionCompleted
66. DecisionProposed: Approve Architecture
67. DecisionEffective
68. BaselineCreated: Architecture
69. BaselineSubmittedForReview
70. BaselineApproved
71. BaselinePromoted
72. PwuBaselined
```

---

# 27. Legacy Product Lens Compatibility Phase Projection

The legacy Product Lens UI may display these derived compatibility milestones:

| Legacy phase         | Fixture milestone                   |
| -------------------- | ----------------------------------- |
| INTAKE               | Events 1–16                         |
| ARCHITECTURE         | Events 29–43                        |
| ASSUMPTION_SURFACING | Events 42–45                        |
| VERIFY               | Events 46–62                        |
| HISTORICAL_CHECK     | Optional assessment before event 63 |
| REVIEW               | Events 66–67                        |
| COMMIT               | Events 68–72                        |

The projection is derived from canonical state.

The system must not use this legacy compatibility phase label as the authoritative state.

---

# 28. Invariant Conformance Tests

## Test 1: Execution is not assurance

Given:

```text
Architecture execution step succeeds.
```

Then:

```text
ExecutionState = SUCCEEDED
AssuranceState != automatically SATISFIED
```

## Test 2: Material assumptions persist

When the architecture output assumes intermittent connectivity:

* an Assumption Object is created;
* affected PWU Instances are linked;
* the assumption cannot remain only in prose.

## Test 3: Constraint propagation

The Multi-Tenancy Constraint must be traceable to:

* Multi-Tenancy Architecture PWU Instance;
* Data Architecture PWU Instance;
* Integration Architecture PWU Instance;
* implementation verification obligations.

## Test 4: Decomposition coverage

The Architecture Definition PWU Instance cannot begin child execution unless:

* mandatory obligations are allocated;
* constraints are propagated;
* a recomposition contract exists.

## Test 5: Approval version binding

The architecture decision must reference:

* the exact architecture semantic version;
* exact evidence;
* exact assurance results.

A later semantic revision invalidates or supersedes the approval.

## Test 6: Open finding blocks baseline

A critical unresolved tenant-isolation finding blocks Architecture Baseline promotion.

## Test 7: Conditional assurance remains visible

Conditional satisfaction cannot be displayed as unconditional success.

## Test 8: Layout has no semantic effect

Moving the Architecture Definition PWU Instance on the canvas:

* changes presentation revision;
* does not change the PWU Instance semantic version;
* does not invalidate approval.

## Test 9: Intent revision triggers impact analysis

If the user changes the target from small businesses to national enterprises:

* Intent semantic version increments;
* architecture and product behavior require review;
* scale assumptions are invalidated;
* prior Architecture Baseline remains immutable;
* a successor baseline is required.

## Test 10: Invalid evidence affects claims

If the tenant-isolation analysis is invalidated:

* the tenant-isolation claim becomes contested or under assessment;
* Architecture Assurance may become invalidated;
* dependent baseline status is flagged for review.

---

# 29. Frictions Exposed by the Fixture

## 29.1 Object count grows quickly

Even this partial Undertaking creates:

* multiple PWU Instances;
* assumptions;
* constraints;
* claims;
* evidence;
* assessments;
* observations;
* decisions;
* baselines;
* trace links.

This is acceptable internally, but the UI must not expose every object equally.

### Required response

Use layered presentation:

* summary by default;
* progressive disclosure;
* object inspector;
* policy-driven alerts;
* semantic zoom.

## 29.2 Product behavior may be under-modeled

The fixture treats actors, journeys, capabilities, and requirements as artifacts and ontology objects but not always as separate PWU Instances.

The implementation must decide when defining one of these constitutes a separate PWU Instance governed by an applicable PWU Type.

### Recommended rule

Use a separate PWU Instance when the definition:

* requires substantive analysis;
* has independent acceptance criteria;
* may decompose;
* requires assurance;
* has its own lifecycle.

## 29.3 Baseline granularity needs care

Promoting an entire Architecture Baseline may be too coarse if some parts are approved and others provisional.

### Recommended response

Allow:

* baseline items;
* provisional items;
* conditions;
* scoped approval;
* baseline purpose.

## 29.4 Assurance policy applicability may become complex

Applying every policy to every object would be unmanageable.

### Required response

Use risk and object-type applicability rules.

Example:

```text
Assumption Disclosure:
Apply to all model-produced professional artifacts.

Independent Architecture Coverage:
Apply to Standard and High-Assurance Architecture Definition PWU Instances.

Human Architecture Approval:
Apply when architecture changes a public interface, data boundary,
security boundary, migration strategy, or irreversible commitment.
```

## 29.5 Execution-plan and PWU Instance boundaries may blur

Architecture generation can be represented as one PWU Instance with multiple execution steps or as several child PWU Instances.

### Recommended decision rule

Use child PWU Instances for distinct professional obligations.

Use execution steps for operational actions used to satisfy one obligation.

## 29.6 Evidence admission needs governance

Not every generated artifact should automatically become admissible evidence.

### Required response

Implement:

```text
Evidence proposed
→ evidence checked for provenance and scope
→ evidence admitted or rejected
```

## 29.7 Human review packages need strong synthesis

A user cannot reasonably inspect the entire object graph.

### Required response

Generate a governed review package containing:

* decision requested;
* changed shape;
* major claims;
* material assumptions;
* blocking and material findings;
* evidence summary;
* residual uncertainty;
* exact baseline candidate.

---

# 30. Simplifications Recommended Before Implementation

The fixture suggests that the first vertical slice does not need every theoretical object type.

## 30.1 Minimum initial canonical objects

Implement first:

* Intent
* PWU Type
* PWU Instance
* Constraint
* Assumption
* Claim
* Evidence
* Assurance Policy
* Assurance Assessment
* Assurance Observation
* Execution Plan
* Execution Step
* Runtime Binding
* Decision
* Baseline
* Trace Link

## 30.2 Defer as separate first-class objects

Initially represent these through typed fields or extensions:

* stakeholder;
* actor;
* capability;
* journey;
* requirement;
* risk;
* architecture element.

Promote them to universal first-class tables only after the Product Realization PWA implementation proves the need.

They must still have stable IDs inside ontology artifacts.

## 30.3 Avoid initial numerical confidence aggregation

Use:

* satisfied;
* conditionally satisfied;
* rejected;
* inconclusive;
* residual uncertainty;
* severity;
* evidence sufficiency.

## 30.4 Preserve a static compatibility plan

Do not introduce unrestricted dynamic planning in the first slice.

Dynamic behavior should initially be limited to:

* clarification;
* evidence gathering;
* local retry;
* local architecture revision;
* human escalation.

---

# 31. Machine-Readable Fixture Package

The implementation repository should contain:

```text
fixtures/
└── product-realization-pwa/
    └── field-service-management/
        ├── manifest.json
        ├── intent.json
        ├── constraints.json
        ├── assumptions.json
        ├── pwu-hierarchy.json
        ├── decomposition-contracts.json
        ├── recomposition-contracts.json
        ├── execution-plans.json
        ├── runtime-bindings.json
        ├── claims.json
        ├── evidence.json
        ├── assurance-policies.json
        ├── assurance-assessments.json
        ├── observations.json
        ├── decisions.json
        ├── baselines.json
        ├── trace-links.json
        └── expected-events.jsonl
```

The fixture should support three modes:

1. **Seed mode**
   Loads the final canonical Undertaking.

2. **Replay mode**
   Replays the expected event stream.

3. **Conformance mode**
   Runs commands and checks resulting state against expected projections.

---

# 32. Expected Read Models

## 32.1 Work View

```text
Field Service Management Product Realization
├── Intent and Product Definition       BASELINED
├── Product Behavior Definition         SATISFIED
└── Architecture Definition             BASELINED
    ├── System Context                  SATISFIED
    ├── Multi-Tenancy Architecture      SATISFIED
    ├── Data Architecture               SATISFIED
    ├── Mobile/Offline Architecture     CONDITIONALLY SATISFIED
    └── Integration Architecture        SATISFIED
```

## 32.2 Assurance View

```text
Architecture Definition
├── Decomposition Coverage              SATISFIED
├── Assumption Disclosure               SATISFIED
├── Architecture Coverage               SATISFIED
├── Intent Preservation                 SATISFIED
└── Open Residual Condition
    └── Offline behavior deferred from first increment
```

## 32.3 Trace View

```text
User Intent
→ Product Intent Baseline
→ Journey
→ Requirement
→ Architecture Concern
→ Architecture Artifact
→ Claim
→ Evidence
→ Assessment
→ Human Decision
→ Architecture Baseline
```

## 32.4 Compatibility View

```text
INTAKE          COMPLETE
ARCHITECTURE    COMPLETE
PROPOSE         NOT STARTED
VERIFY          COMPLETE FOR ARCHITECTURE
REVIEW          APPROVED
EXECUTE         NOT STARTED
VALIDATE        PARTIAL
COMMIT          REPOSITORY NOT APPLICABLE; ARCHITECTURE BASELINE PROMOTED SEPARATELY
```

---

# 33. Fixture Acceptance Criteria

The Reference Undertaking is valid when:

* all object IDs are stable;
* all references resolve;
* every mandatory architecture obligation is allocated;
* all mandatory constraints are propagated or retained;
* every satisfied claim has admissible evidence;
* every assessment identifies a policy version;
* execution success does not imply assurance success;
* approval references a specific semantic version;
* baseline promotion references an effective decision;
* traceability reaches the originating expression;
* open residual uncertainty remains visible;
* the event stream reconstructs the final state;
* projection state can be rebuilt;
* duplicate command replay does not create duplicate decisions or baselines;
* the fixture can be rendered without relying on hardcoded legacy Product Lens phases;
* every PWU Instance resolves to a PWU Type in the selected Product Realization PWA version.

---

# 34. Implementation Outcome

This fixture establishes the first executable Field Service Management SaaS Undertaking instantiated from the Product Realization PWA under the Recursive Professional Harness.

It demonstrates that the legacy Product Lens sequence can be preserved as a compatibility Execution Plan while the authoritative work is represented through:

* approved intent;
* professional obligations;
* recursive PWU Instances governed by Product Realization PWU Types;
* constraints and assumptions;
* replaceable execution plans;
* governed runtime bindings;
* claims;
* evidence;
* assurance assessments;
* human decisions;
* authoritative baselines.

Most importantly, it demonstrates the core control principle:

> A model may successfully produce an architecture without the system yet being justified in believing that the architecture satisfies the user’s intent.

The RPH closes that gap by preserving the work’s shape, collecting evidence, assessing the resulting claims, invoking governance where authority is required, and preventing the work from becoming authoritative until the available evidence supports that transition.
