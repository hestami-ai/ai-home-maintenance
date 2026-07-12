# Janumi Professional Workbench PWA Designer and Undertaking Workbench

## Professional Work Architecture Authoring UX and Product Realization PWA Reference Demonstration

**Status:** Corrected UX architecture baseline
**Document ID:** `RPH-DOC-010`
**Authority:** Canonical PWA-authoring and Undertaking-operation UX specification
**Applies to:** Janumi Professional Workbench (JPWB) and its JanumiCode software-product specialization on the Recursive Professional Harness
**Reusable professional-work architecture:** Product Realization PWA
**Reference Undertaking:** Field Service Management SaaS Undertaking for a multi-tenant product serving trades businesses
**Primary correction:** Separate PWA definition from Undertaking execution

---

# 1. Purpose

This specification defines two related but distinct user experiences:

1. **PWA Designer**
   Used to create, inspect, revise, govern, version, and publish reusable Professional Work Architectures.

2. **Undertaking Workbench**
   Used to instantiate a published PWA and perform concrete professional work under it.

The Product Realization PWA belongs in the first category.

The Field Service Management SaaS Undertaking belongs in the second.

This distinction prevents the Product Realization PWA from being conflated with one use case carried out through it.

---

# 2. Canonical hierarchy

```text
Janumi
└── Janumi Platform
    ├── Recursive Professional Harness
    │   └── Runtime control, assurance, persistence, and governance
    ├── Janumi Professional Workbench
    │   ├── PWA Library and PWA Designer
    │   ├── Undertaking Workbench
    │   └── Execution, assurance, decision, baseline, and traceability surfaces
    └── Domain products
        └── JanumiCode
            ├── Product Realization PWA
            ├── Other software-product PWAs
            └── Software-specific views, policies, integrations, and execution strategies
```

The formal relationship is:

```text
Professional Work Architecture and selected version
        ↓ instantiated as
Undertaking
        ↓ owns
Professional Work Graph
        ↓ executed through
Execution Plans and Execution Workflows
```

---

# 3. Terminology

## 3.1 Professional Work Architecture

A **Professional Work Architecture**, or **PWA**, is a reusable, versioned architecture defining how a class of professional work is structured, decomposed, executed, assured, governed, and accepted.

A PWA may specify:

* PWU Types;
* permitted relationships;
* decomposition patterns;
* recomposition rules;
* required inputs and outputs;
* obligations;
* constraints;
* assurance policies;
* evidence requirements;
* roles;
* governance rules;
* baseline types;
* progression semantics;
* default execution strategies.

A PWA defines reusable professional-work structure; it is not a concrete Undertaking, an instantiated Professional Work Graph, or a temporal Execution Workflow.

## 3.2 Legacy term: Lens

The term `Lens` is retired as the canonical name for a PWA because earlier material used it for work architectures, UI perspectives, product subsystems, and templates.

Legacy examples in prior artifacts include:

* Product Lens;
* Legal Lens;
* Health Lens;
* Compliance Lens;
* Incident Response Lens.

Interpret an architectural use according to its intended meaning and rename it explicitly. The former `Product Lens` is the **Product Realization PWA**. A UI perspective should instead be named a **View**, **Viewpoint**, or **Projection**. Other legacy names require classification rather than a blind `Lens`-to-`PWA` suffix change.

## 3.3 Product Realization PWA

The **Product Realization PWA** is the reusable Professional Work Architecture for product conception, definition, architecture, implementation, validation, and baseline promotion. It is not JanumiCode itself; JanumiCode is a domain product that contains this and other software-product PWAs.

## 3.4 Undertaking

A concrete body of professional work instantiated under one or more compatible PWAs and bound to a selected PWA version.

Example:

> Field Service Management SaaS Undertaking — build a multi-tenant Field Service Management SaaS product for trades businesses.

## 3.5 Professional Work Graph

The instantiated semantic graph of:

* PWU Instances;
* obligations;
* constraints;
* assumptions;
* claims;
* evidence;
* decisions;
* baselines;
* trace relationships

belonging to one Undertaking.

## 3.6 PWU Type

A reusable definition in a PWA.

Example:

> Architecture Definition

## 3.7 PWU Instance

A concrete realization of a PWU Type in an Undertaking.

Example:

> Architecture Definition for the Field Service Management SaaS Undertaking

## 3.8 Execution Plan

An **Execution Plan** is the governed plan for performing one or more PWU Instances. It identifies steps, dependencies, roles, models, tools, context, permissions, retries, branching, escalation, and termination as applicable.

## 3.9 Execution Workflow

A temporal execution structure used to perform one or more PWU Instances.

The word `workflow` remains valid for temporal execution or approval behavior. It is not the canonical name for a PWA or Professional Work Graph.

---

# 4. Product and surface structure

```text
Janumi Professional Workbench
├── PWA Library
├── PWA Designer
├── Undertaking Portfolio
├── Undertaking Workbench
├── Execution Workbench
├── Assurance Workbench
├── Decision Center
├── Baseline Manager
└── Diagnostics
```

These are general JPWB capabilities. JanumiCode reuses and may specialize them for software-product work; it also supplies software-product PWAs, views, policies, artifact types, execution strategies, and integrations.

## 4.1 PWA Library

Used to:

* browse available PWAs;
* inspect versions;
* compare versions;
* create a PWA;
* fork a PWA;
* publish a PWA;
* retire a PWA.

## 4.2 PWA Designer

Used to design and govern a reusable Professional Work Architecture.

## 4.3 Undertaking Portfolio

Used to:

* create an Undertaking;
* select a PWA;
* view active Undertakings;
* compare health;
* identify pending decisions;
* inspect migration or version status.

## 4.4 Undertaking Workbench

Used to perform concrete work under an instantiated PWA.

## 4.5 Execution Workbench

Used to author and operate execution workflows.

## 4.6 Assurance Workbench

Used to evaluate claims and evidence under assurance policies.

## 4.7 Decision Center

Used to exercise authority over versions, waivers, escalations, and acceptance.

## 4.8 Baseline Manager

Used to promote exact object and artifact versions into authoritative baselines.

---

# 5. Top-level navigation

```text
JanumiCode
├── PWAs
│   ├── PWA Library
│   ├── Product Realization PWA
│   └── Create PWA
│
├── Undertakings
│   ├── Active
│   ├── Archived
│   └── Create Undertaking
│
├── Decisions
├── Baselines
└── Administration
```

The user must always be able to identify whether they are operating in:

```text
PWA DESIGN CONTEXT
```

or:

```text
UNDERTAKING CONTEXT
```

These contexts should have visibly distinct headers, icons, and permission models.

---

# 6. PWA Designer

# 6.1 Purpose

The PWA Designer enables users to author reusable professional-work structures without creating a specific Undertaking.

For the Product Realization PWA, it defines the structure by which product work is ordinarily shaped.

The PWA Designer must not display concrete Field Service assumptions, requirements, findings, or execution states except as test fixtures or examples.

---

# 7. Product Realization PWA definition

The Product Realization PWA initially defines this root architecture:

```text
Product Realization
├── Intent and Product Definition
├── Product Behavior Definition
├── Architecture Definition
├── Implementation Planning
├── Product Implementation
├── Integrated Product Validation
└── Product Baseline Promotion
```

These are PWU Types, not active PWUs.

Each PWU Type may define:

* purpose;
* entry conditions;
* required inputs;
* required outputs;
* obligations;
* inherited constraints;
* permitted child types;
* default decomposition;
* required assurance;
* governance;
* recomposition;
* completion semantics;
* compatible execution strategies.

---

# 8. PWA Designer information architecture

```text
Product Realization PWA
├── Overview
├── Work Architecture
├── PWU Types
├── Relationships
├── Decomposition Rules
├── Obligations and Constraints
├── Assurance Policies
├── Roles and Authorities
├── Baseline Definitions
├── Execution Strategies
├── Conformance Tests
├── Versions
└── Publication
```

---

# 9. Product Realization PWA Overview

The overview should answer:

* What professional domain does this PWA govern?
* What classes of Undertakings may instantiate it?
* What root PWU Type does it define?
* Which lifecycle stages exist?
* Which assurance policies are mandatory?
* Which roles and authorities are assumed?
* Which PWA version is published?
* What changed from the previous version?

Example:

```text
PRODUCT REALIZATION PWA v1.3

Purpose
Structure product-development work from originating intent through
validated and authoritative product baselines.

Root PWU Type
Product Realization

Major work areas
• Intent and Product Definition
• Product Behavior Definition
• Architecture Definition
• Implementation Planning
• Product Implementation
• Integrated Product Validation
• Product Baseline Promotion

Mandatory core assurance
• Intent Fidelity
• Intent Completeness
• Requirement Coverage
• Decomposition Coverage
• Constraint Propagation
• Architecture Coverage
• Intent Preservation
• Test Adequacy
• Fitness for Purpose
• Baseline Promotion

Status
PUBLISHED
```

---

# 10. PWA Work Architecture View

This view displays PWU Types and their permitted composition.

```text
Product Realization
│
├── Intent and Product Definition
│   ├── Intent Discovery
│   ├── Stakeholder Definition
│   ├── Product Boundary Definition
│   └── Intent Baseline Promotion
│
├── Product Behavior Definition
│   ├── Actor Definition
│   ├── Capability Definition
│   ├── Journey Definition
│   ├── Scenario Definition
│   ├── Requirement Definition
│   └── Behavior Baseline Promotion
│
├── Architecture Definition
│   ├── System Context
│   ├── Multi-Tenancy Architecture
│   ├── Data Architecture
│   ├── Security Architecture
│   ├── Integration Architecture
│   ├── Mobile and Offline Architecture
│   └── Operational Architecture
│
├── Implementation Planning
├── Product Implementation
├── Integrated Product Validation
└── Product Baseline Promotion
```

This graph is a View of the PWA definition and represents allowed professional-work composition.

It does not represent execution order.

---

# 11. PWU Type Editor

Selecting a PWU Type opens a definition editor.

Example:

```text
ARCHITECTURE DEFINITION — PWU TYPE

Purpose
Define a coherent technical structure capable of realizing approved
product behavior while preserving applicable constraints.

Permitted parents
• Product Realization

Permitted children
• System Context
• Multi-Tenancy Architecture
• Data Architecture
• Security Architecture
• Integration Architecture
• Mobile and Offline Architecture
• Operational Architecture
• Custom Architecture Concern

Required inputs
• Approved Product Intent
• Approved Product Behavior
• Applicable constraints
• Relevant historical decisions

Required outputs
• Architecture description
• Architecture decisions
• System boundaries
• Component responsibilities
• Data ownership model
• Interface model
• Deployment and operational model

Required assurance
• Decomposition Coverage
• Constraint Propagation
• Assumption Disclosure
• Architecture Coverage
• Intent Preservation

Governance
• Human approval required before Architecture Baseline promotion

Completion rule
Execution succeeded
AND required outputs exist
AND required evidence is admissible
AND required assurance is satisfied or validly waived
AND required approval is effective
```

---

# 12. PWU Type actions

Users with PWA design authority may:

* create PWU Type;
* revise purpose;
* define required inputs;
* define required outputs;
* add permitted parent;
* add permitted child;
* define default obligations;
* define inherited constraints;
* assign assurance policies;
* define governance;
* define completion rule;
* define decomposition template;
* define recomposition rule;
* add execution-strategy compatibility;
* deprecate;
* supersede;
* test against fixture;
* publish.

---

# 13. PWA relationship types

The PWA Designer must distinguish type-level relationships from instance-level relationships.

## 13.1 Type-level relationships

Examples:

* `PERMITS_CHILD_TYPE`;
* `REQUIRES_INPUT_TYPE`;
* `PRODUCES_OUTPUT_TYPE`;
* `REQUIRES_POLICY`;
* `ASSIGNS_ROLE`;
* `ALLOWS_EXECUTION_STRATEGY`;
* `PROMOTES_BASELINE_TYPE`;
* `PRECEDES_SEMANTICALLY`;
* `MAY_ITERATE_WITH`;
* `RECOMPOSES_INTO`.

## 13.2 Instance-level relationships

These occur only inside Undertakings.

Examples:

* `DECOMPOSES`;
* `DEPENDS_ON`;
* `SATISFIES`;
* `SUPPORTS`;
* `CONTRADICTS`;
* `PRODUCES`;
* `PROMOTES`;
* `SUPERSEDES`.

---

# 14. Decomposition Rule Designer

The Product Realization PWA should define default and permitted decomposition patterns.

Example:

```text
ARCHITECTURE DEFINITION

Required concerns
• System Context
• Data Ownership
• Security Boundaries

Conditionally required concerns
• Multi-Tenancy, when multi-tenant product
• Mobile and Offline, when mobile field use exists
• Integrations, when external systems are in scope
• Operational Architecture, when production deployment is in scope

Custom concern rule
Allowed when:
• purpose is distinct
• obligations are allocated
• relationship to parent intent is stated
• recomposition remains feasible
```

The user may define:

* mandatory child types;
* conditional child types;
* cardinality;
* applicability expressions;
* obligation-allocation rules;
* recomposition requirements;
* coverage policy;
* exceptions and authorities.

---

# 15. Assurance Policy Assignment

The PWA Designer assigns policies to PWU Types.

Example:

```text
ARCHITECTURE DEFINITION

Required
✓ Decomposition Coverage
✓ Constraint Propagation
✓ Assumption Disclosure
✓ Architecture Coverage
✓ Intent Preservation

Conditional
○ Historical Consistency
  Applies when brownfield change or prior baseline exists

○ Security Assurance
  Applies when security sensitivity ≥ HIGH

○ Migration Assurance
  Applies when existing system migration is in scope
```

The Product Realization PWA references policy definitions but does not contain assessment instances.

---

# 16. Role and authority design

The PWA defines expected roles:

* Undertaking Owner;
* Product Modeler;
* Architect;
* Implementation Planner;
* Maker;
* Assurance Reviewer;
* Human Governor;
* Platform Operator.

For each operation, the PWA may define:

* recommended role;
* required authority;
* independence level;
* escalation target;
* delegation rules.

Example:

```text
Architecture Approval

Initiator
Architect or Undertaking Owner

Required reviewer
Human Governor

Independence
Reviewer must not be the sole producer of the architecture

Authority
ARCHITECTURE_APPROVAL

Result
Version-bound Decision
```

---

# 17. Baseline Type Designer

The Product Realization PWA defines baseline classes.

Initial baseline types:

* Product Intent Baseline;
* Product Behavior Baseline;
* Architecture Baseline;
* Implementation Baseline;
* Integrated Validation Baseline;
* Product Baseline;
* Release Baseline;
* Evidence Package Baseline.

Each baseline type defines:

* purpose;
* required item types;
* required assessments;
* required decisions;
* permitted waivers;
* immutability;
* supersession behavior.

---

# 18. Execution Strategy definitions

The PWA may define compatible default execution strategies without treating them as the professional-work architecture itself.

Example:

```text
Architecture Definition

Compatible execution strategies
• Single architect agent
• Multi-specialist architecture panel
• Human-led architecture with agent support
• Brownfield architecture analysis
• High-assurance independent architecture generation and review
```

An execution strategy may supply:

* execution workflow template;
* roles;
* tools;
* model-selection policies;
* evidence capture;
* retry strategy;
* escalation behavior.

The Undertaking may select or override an allowed strategy.

---

# 19. PWA versioning

A PWA is versioned independently from Undertakings.

```text
Product Realization PWA v1.2
Product Realization PWA v1.3
Product Realization PWA v2.0
```

A PWA version contains:

* PWU Type definitions;
* relationship rules;
* assurance assignments;
* baseline definitions;
* role definitions;
* execution-strategy compatibility;
* conformance tests.

A published PWA version is immutable.

Changes create a successor version.

---

# 20. PWA publication flow

```text
DRAFT
→ UNDER REVIEW
→ VALIDATED
→ PUBLISHED
→ DEPRECATED
→ RETIRED
```

Before publication, the PWA must pass:

* schema validation;
* type-reference validation;
* decomposition consistency;
* assurance assignment validation;
* role and authority validation;
* baseline consistency;
* conformance fixture execution;
* compatibility analysis.

---

# 21. PWA test fixture

The Field Service Management SaaS Undertaking may serve as a Product Realization PWA conformance fixture.

In PWA Designer, it is labeled:

```text
REFERENCE FIXTURE
Field Service Management SaaS Undertaking
```

It is not treated as the Product Realization PWA itself.

The fixture verifies that the PWA can support:

* multiple actors;
* mobile and web behavior;
* multi-tenancy;
* integrations;
* offline constraints;
* architecture decomposition;
* implementation planning;
* integrated validation;
* baseline promotion.

---

# 22. Undertaking creation

The user creates an Undertaking from the Undertaking Portfolio.

```text
CREATE UNDERTAKING

Name
Field Service Management SaaS Undertaking

Description
Build the multi-tenant Field Service Management SaaS product for trades businesses.

PWA
Product Realization PWA v1.3

Profile
Standard Product Realization

Starting mode
○ Guided
○ Workbench
○ Import existing work

[Cancel] [Create Undertaking]
```

Creation produces:

* Undertaking;
* selected PWA version binding;
* root Product Realization PWU Instance;
* default child PWU Instances according to instantiation rules;
* initial governance and assurance configuration.

---

# 23. Undertaking-to-PWA binding

Every Undertaking records:

* PWA ID;
* PWA version;
* instantiation profile;
* local overrides;
* applicable organizational policies;
* migration status.

Example:

```text
UNDERTAKING
Field Service Management SaaS Undertaking

PWA
Product Realization PWA v1.3

Instantiation profile
Standard Product Realization

Local additions
• Multi-tenant security profile
• Mobile field-work profile

Local overrides
• Product Behavior approval required
• Security Assurance mandatory at Architecture
```

---

# 24. PWA inheritance versus local Undertaking content

The UI must clearly distinguish:

```text
INHERITED FROM PRODUCT REALIZATION PWA
```

from:

```text
DEFINED FOR THIS UNDERTAKING
```

Example:

```text
ARCHITECTURE DEFINITION

Inherited from Product Realization PWA v1.3
• Purpose
• Required assurance
• Permitted child types
• Completion semantics

Defined for Field Service Management SaaS Undertaking
• Multi-Tenancy Architecture child
• Mobile and Offline Architecture child
• Tenant-isolation constraints
• Architecture artifacts
• Actual assessments
• Current state
```

---

# 25. Undertaking Workbench

The Undertaking Workbench operates the instantiated Professional Work Graph.

Top-level navigation:

```text
Field Service Management SaaS Undertaking
├── Overview
├── Professional Work Graph
├── Intent
├── Product Behavior
├── Architecture
├── Planning
├── Implementation
├── Validation
├── Execution
├── Assurance
├── Traceability
├── Decisions
├── Baselines
└── Diagnostics
```

Header:

```text
FIELD SERVICE MANAGEMENT SAAS UNDERTAKING
Product Realization PWA v1.3
Undertaking status: Architecture under assurance
```

---

# 26. Undertaking Overview

The Overview summarizes the concrete work.

```text
FIELD SERVICE MANAGEMENT SAAS UNDERTAKING

PWA
Product Realization PWA v1.3

Objective
Enable trades businesses to manage customer work from request through invoice.

Intended output product
Field Service Management SaaS

Current condition
ARCHITECTURE REQUIRES REVISION

Professional Work Graph
Intent and Product Definition        BASELINED
Product Behavior Definition          SATISFIED
Architecture Definition              UNDER ASSURANCE
Implementation Planning              NOT STARTED
Product Implementation               NOT STARTED
Integrated Product Validation        NOT STARTED
Product Baseline Promotion           NOT STARTED

Blocking issue
Tenant isolation does not cover queued jobs or object storage.

Next recommended action
Revise Multi-Tenancy Architecture.
```

---

# 27. Professional Work Graph View

The Professional Work Graph is the instantiated semantic composition of PWU Instances and related professional objects belonging to this Undertaking.

```text
Field Service Management Professional Work Graph

├── Intent and Product Definition             BASELINED
├── Product Behavior Definition               SATISFIED
│   ├── Actor Definition                      SATISFIED
│   ├── Capability Definition                 SATISFIED
│   ├── Request-to-Job Journey                SATISFIED
│   ├── Dispatch-to-Completion Journey        SATISFIED
│   └── Requirement Definition                SATISFIED
│
├── Architecture Definition                   UNDER ASSURANCE
│   ├── System Context                        SATISFIED
│   ├── Multi-Tenancy Architecture            REJECTED
│   ├── Data Architecture                     SATISFIED
│   ├── Security Architecture                 UNDER ASSURANCE
│   ├── Mobile and Offline Architecture       CONDITIONAL
│   ├── Integration Architecture              SATISFIED
│   └── Operational Architecture              READY
│
├── Implementation Planning                   NOT STARTED
├── Product Implementation                    NOT STARTED
├── Integrated Product Validation             NOT STARTED
└── Product Baseline Promotion                NOT STARTED
```

This View shows actual state from the Undertaking's Professional Work Graph.

The Product Realization PWA Work Architecture View shows type definitions without actual state.

---

# 28. Type-instance navigation

From a PWU Instance, the user may select:

```text
View PWU Type Definition
```

Example:

```text
Multi-Tenancy Architecture
Instance in: Field Service Management SaaS Undertaking

Type
Custom Architecture Concern
Defined by: Product Realization PWA v1.3

[Open Type Definition]
```

From a PWU Type, a PWA Designer may select:

```text
View Example Instances
```

Subject to permissions and privacy.

---

# 29. Instance object inspector

A PWU Instance inspector should show both inherited and concrete properties.

```text
MULTI-TENANCY ARCHITECTURE

Instance
pwu_01...

Undertaking
Field Service Management SaaS Undertaking

PWA-defined type
Architecture Concern

Inherited purpose
Define a coherent architecture concern contributing to Architecture Definition.

Instance purpose
Define tenant identity, authorization, persistence isolation, queued-job
isolation, cache isolation, object-storage isolation, and integration isolation.

Inherited assurance
• Architecture Coverage
• Constraint Propagation
• Intent Preservation

Instance assurance
Architecture Coverage: REJECTED
Security Assurance: EVIDENCE REQUIRED
```

---

# 30. Full Product Realization PWA Reference Undertaking

The Field Service Management SaaS Reference Undertaking must exercise the complete Product Realization PWA architecture without being presented as either the PWA definition or the resulting product.

## 30.1 Intent and Product Definition

Concrete instances:

* Intent Discovery;
* Product Boundary Definition;
* Stakeholder Definition;
* Product Intent Approval;
* Intent Baseline Promotion.

## 30.2 Product Behavior Definition

Concrete instances:

* Actor Definition;
* Capability Definition;
* User Journey Definition;
* Scenario Definition;
* Requirement Definition;
* Acceptance Criteria Definition;
* Product Behavior Approval;
* Product Behavior Baseline.

## 30.3 Architecture Definition

Concrete instances:

* System Context;
* Multi-Tenancy Architecture;
* Data Architecture;
* Security Architecture;
* Integration Architecture;
* Mobile and Offline Architecture;
* Operational Architecture;
* Architecture Approval;
* Architecture Baseline.

## 30.4 Implementation Planning

Concrete instances:

* Increment Definition;
* Work Decomposition;
* Dependency Planning;
* Test Planning;
* Migration Planning;
* Runtime-Binding Planning;
* Implementation Plan Approval.

## 30.5 Product Implementation

Concrete instances:

* Tenant and Identity Foundation;
* Customer and Request Management;
* Estimating and Scheduling;
* Technician Mobile Experience Implementation;
* Invoicing and Communications;
* Integration Implementation;
* Operational Readiness.

## 30.6 Integrated Product Validation

Concrete instances:

* Journey Validation;
* Requirement Coverage Assessment;
* Architecture Conformance;
* Test Adequacy;
* Security Validation;
* Operational Validation;
* Fitness for Purpose.

## 30.7 Product Baseline Promotion

Concrete instances:

* Product Baseline Candidate;
* Evidence Package;
* Residual Risk Decision;
* Promotion Decision;
* Authoritative Product Baseline.

---

# 31. PWA version migration experience

An existing Undertaking remains bound to its selected PWA version until explicitly migrated.

Example:

```text
PWA VERSION UPDATE AVAILABLE

Current
Product Realization PWA v1.3

Available
Product Realization PWA v1.4

Changes
• Security Assurance now mandatory for multi-tenant architecture
• New Operational Readiness PWU Type
• Updated Product Baseline requirements
• Revised offline-capability decomposition guidance

Potential impact
• 2 existing PWUs
• 1 baseline definition
• 3 assurance assignments

Options
○ Remain on v1.3
○ Preview migration
○ Create migration proposal
```

A PWA version change for an existing Undertaking is a governed semantic migration, not a silent template refresh.

---

# 32. PWA version migration preview

```text
MIGRATE FIELD SERVICE MANAGEMENT SAAS UNDERTAKING
Product Realization PWA v1.3 → v1.4

New required work
• Operational Readiness PWU

New assurance
• Security Assurance on Architecture Definition

Changed baseline requirements
• Operational rollback evidence required

Unaffected
• Approved Product Intent
• Existing Product Behavior Baseline

Potentially invalidated
• Architecture Approval
• Architecture Baseline

[Cancel] [Create Migration Work]
```

---

# 33. Undertaking-local extension under a PWA

An Undertaking may require local work not created by the PWA's default instantiation rules. Because a PWU Type belongs to a PWA, the Undertaking cannot create an Undertaking-owned PWU Type.

The user may:

* instantiate a PWA-defined generic extension PWU Type as an Undertaking-local PWU Instance;
* define the local instance's purpose, relationships, obligations, constraints, and evidence needs;
* propose a reusable new PWU Type or rule for a future PWA version.

Example:

```text
ADD UNDERTAKING-LOCAL PWU INSTANCE

Instance name
Regulatory Billing Compliance

PWA-defined PWU Type
Product Compliance Concern

Scope
Applies only to this Undertaking

Potential future action
Propose a specific Regulatory Billing Compliance PWU Type for a future Product Realization PWA version
```

Undertaking-local PWU Instances must remain distinguishable from published PWA definitions. They do not create or mutate a PWU Type.

---

# 34. PWA change proposal from Undertaking learning

The system should support bottom-up evolution.

A recurring pattern discovered in Undertakings may be proposed to the PWA.

Example:

```text
PROPOSE PRODUCT REALIZATION PWA IMPROVEMENT

Source
Field Service Management SaaS Undertaking

Observed pattern
Mobile field products require explicit offline-conflict strategy.

Proposed PWA change
Add conditionally required Offline Conflict Strategy PWU Type when:
• mobile field actor exists
• intermittent connectivity assumption applies

Evidence
• Architecture finding
• Implementation defect
• Integrated validation result
```

This creates a PWA change proposal, not an automatic PWA mutation.

---

# 35. UI mode distinction

Each mode exposes a different underlying object and authority boundary:

| Mode | Primary object | Permitted concern |
| --- | --- | --- |
| PWA Design | Reusable PWA definition and PWU Types | Design, version, test, govern, and publish |
| Undertaking | Concrete Undertaking and its Professional Work Graph | Shape and govern PWU Instances and actual professional state |
| Execution | Execution Plan and Execution Workflow for selected PWU Instances | Perform temporal agent, human, and tool activity |
| Assurance | Claims, evidence, criteria, assessments, and findings | Evaluate assurance without exercising governance authority |
| Governance | Decisions and Baselines | Approve, waive, reject, escalate, promote, revoke, or supersede |

## 35.1 PWA Design mode

Header:

```text
PRODUCT REALIZATION PWA v1.4-DRAFT
Professional Work Architecture
```

Primary actions:

* edit type;
* define relationship;
* assign assurance;
* validate architecture;
* publish PWA.

No concrete execution-state indicators.

## 35.2 Undertaking mode

Header:

```text
FIELD SERVICE MANAGEMENT SAAS UNDERTAKING
Instantiated from Product Realization PWA v1.3
```

Primary actions:

* shape work;
* execute;
* assess;
* decide;
* baseline.

Displays actual lifecycle state.

## 35.3 Execution mode

Header:

```text
EXECUTION PLAN
Architecture Definition — Field Service Management SaaS Undertaking
```

Displays a governed Execution Plan and the temporal Execution Workflow that carries it out; neither is the Professional Work Graph.

---

# 36. Correct use of workflow terminology

The UI and documentation may use `workflow` for:

* execution workflows;
* approval workflows;
* evidence-gathering workflows;
* recovery workflows;
* automation workflows.

It should not use `workflow` as the primary name for the Product Realization PWA itself.

Correct:

```text
Product Realization PWA defines the Professional Work Architecture.
Architecture Definition is executed through an execution workflow.
```

Legacy anti-pattern (superseded architecture term and misuse of `workflow`):

```text
Product Lens is a workflow of phases.
```

---

# 37. Corrected product naming

Recommended names:

| Surface                                 | Name                  |
| --------------------------------------- | --------------------- |
| PWA authoring                          | PWA Designer         |
| PWA browsing                           | PWA Library          |
| Concrete-work portfolio                 | Undertaking Portfolio |
| Concrete-work operation                 | Undertaking Workbench |
| Execution-plan authoring and monitoring | Execution Workbench   |
| Assurance review                        | Assurance Workbench   |
| Governance                              | Decision Center       |
| Version authority                       | Baseline Manager      |

The earlier term `Product Lens Workbench` is retained here only as an explicitly identified legacy name and should be retired. Use **PWA Designer** for PWA definition, **Undertaking Workbench** for concrete work, or a clearly named JanumiCode surface for software-specific interaction.

---

# 38. Corrected object–action model

## 38.1 PWA definition actions

```text
Create type
Inspect type
Revise type
Relate types
Assign policy
Define decomposition
Define recomposition
Define authority
Test PWA
Version PWA
Publish PWA
Deprecate PWA
Retire PWA
```

## 38.2 Undertaking actions

```text
Instantiate PWA
Create PWU Instance
Inspect work
Revise shape
Relate instances
Execute plan
Assess claims
Resolve findings
Exercise authority
Promote baseline
Trace work
Recover execution
Migrate PWA version
```

---

# 39. PWA Designer object–action matrix

| PWA object          | Create | Inspect |       Edit | Relate | Test |  Version |  Publish | Deprecate |
| -------------------- | -----: | ------: | ---------: | -----: | ---: | -------: | -------: | --------: |
| PWA                 |      ✓ |       ✓ | Draft only |      ✓ |    ✓ |        ✓ |        ✓ |         ✓ |
| PWU Type             |      ✓ |       ✓ | Draft only |      ✓ |    ✓ | Via PWA | Via PWA |         ✓ |
| Relationship Rule    |      ✓ |       ✓ | Draft only |      ✓ |    ✓ | Via PWA | Via PWA |         ✓ |
| Decomposition Rule   |      ✓ |       ✓ | Draft only |      ✓ |    ✓ | Via PWA | Via PWA |         ✓ |
| Assurance Assignment |      ✓ |       ✓ | Draft only |      ✓ |    ✓ | Via PWA | Via PWA |         ✓ |
| Role Definition      |      ✓ |       ✓ | Draft only |      ✓ |    ✓ | Via PWA | Via PWA |         ✓ |
| Baseline Type        |      ✓ |       ✓ | Draft only |      ✓ |    ✓ | Via PWA | Via PWA |         ✓ |
| Execution Strategy   |      ✓ |       ✓ | Draft only |      ✓ |    ✓ | Via PWA | Via PWA |         ✓ |
| Conformance Fixture  |      ✓ |       ✓ |          ✓ |      ✓ |  Run |        ✓ | Included |         ✓ |

---

# 40. Undertaking object–action matrix

| Instance object |    Create | Inspect |             Edit | Relate | Execute | Assess |      Decide | Baseline |  Supersede |
| --------------- | --------: | ------: | ---------------: | -----: | ------: | -----: | ----------: | -------: | ---------: |
| Undertaking     |         ✓ |       ✓ |          Limited |      ✓ |       — |      ✓ |           ✓ |        — |          ✓ |
| PWU Instance    |         ✓ |       ✓ |                ✓ |      ✓ |       ✓ |      ✓ | Conditional |        ✓ |          ✓ |
| Constraint      |         ✓ |       ✓ |         Governed |      ✓ |       — |      ✓ |       Waive | Included |          ✓ |
| Assumption      |         ✓ |       ✓ |                ✓ |      ✓ |  Verify |      ✓ |      Accept | Included |          ✓ |
| Claim           |         ✓ |       ✓ |          Limited |      ✓ |       — |      ✓ |           — | Included |          ✓ |
| Evidence        |         ✓ |       ✓ | No in-place edit |      ✓ | Produce |  Admit |           — |  Package | Invalidate |
| Assessment      |   Request |       ✓ |               No |      ✓ |     Run |      ✓ |       Waive |  Package | Invalidate |
| Decision        |   Propose |       ✓ | Before effective |      ✓ |       — |      — |           ✓ | Supports |     Revoke |
| Baseline        | Candidate |       ✓ | Before promotion |      ✓ |       — | Verify |     Promote |        ✓ |  Supersede |

---

# 41. Reference demonstration sequence

The complete demonstration should explicitly alternate among PWA Design, Undertaking, Execution, Assurance, and Governance contexts.

## Act 1 — Inspect Product Realization PWA

Show:

* Product Realization PWA v1.3;
* root Product Realization PWU Type;
* required PWU Types;
* assurance assignments;
* baseline types;
* conformance fixture.

Purpose:

> Establish the reusable professional-work architecture.

## Act 2 — Instantiate Product Realization PWA

Create:

> Field Service Management SaaS Undertaking

Bind it to Product Realization PWA v1.3.

Purpose:

> Show the transition from reusable architecture to a concrete Undertaking.

## Act 3 — Shape concrete intent

Operate within the Undertaking Workbench.

Purpose:

> Demonstrate actual PWU Instances and state.

## Act 4 — Inspect type-instance relationship

Open Architecture Definition instance and navigate to its PWU Type.

Purpose:

> Show inherited rules versus Undertaking-specific content.

## Act 5 — Execute architecture work

Open the Execution Workbench.

Purpose:

> Show an Execution Workflow as distinct from the Undertaking's Professional Work Graph.

## Act 6 — Resolve assurance failure

Use Assurance Workbench.

Purpose:

> Demonstrate claims, evidence, findings, and control actions.

## Act 7 — Approve and baseline

Use Decision Center and Baseline Manager.

Purpose:

> Show version-bound authority.

## Act 8 — Propose PWA improvement

From the offline-conflict finding, create a Product Realization PWA improvement proposal.

Purpose:

> Demonstrate learning from an Undertaking without conflating instance and definition.

---

# 42. Core interaction contract: Instantiate PWA

**Action:** Create Undertaking from PWA

**Inputs:**

* Undertaking name;
* originating expression;
* PWA version;
* profile;
* organizational policy overlays.

**Preconditions:**

* PWA version is published;
* user has Undertaking-creation authority.

**System behavior:**

1. Create Undertaking.
2. Bind exact PWA version.
3. Create root PWU Instance.
4. Instantiate mandatory root children.
5. Apply policy assignments.
6. Apply role and governance defaults.
7. Create instantiation event.
8. Open Undertaking Overview.

**Expected event:**

```text
UndertakingInstantiatedFromPWA
```

---

# 43. Core interaction contract: Revise PWA

**Action:** Revise Product Realization PWA

**Preconditions:**

* published PWA is not edited in place;
* user has PWA design authority.

**System behavior:**

1. Create draft successor version.
2. Record source version.
3. Apply definition changes.
4. Run impact analysis across:

   * PWU Types;
   * policies;
   * baseline definitions;
   * conformance fixtures;
   * existing Undertakings.
5. Run PWA conformance tests.
6. Submit for review.
7. Publish successor version.

Existing Undertakings remain bound to their prior version until migrated.

---

# 44. Core interaction contract: Add local PWU Instance

**Action:** Add work not directly instantiated by default PWA structure

**System checks:**

* Is the child type permitted?
* Is a generic extension point allowed?
* Are obligations allocated?
* Are constraints propagated?
* Is recomposition still feasible?
* Does an existing PWA-defined type or generic extension point apply?

If no applicable PWA-defined type or extension point exists, the system must block local type creation and offer a PWA Change Proposal. A permitted resulting PWU Instance belongs to the Undertaking and does not mutate the PWA.

---

# 45. Core interaction contract: Propose PWA change from Undertaking

**Action:** Promote recurring instance learning into PWA design review

**Inputs:**

* source Undertaking;
* observed issue;
* proposed type or rule;
* supporting evidence;
* anticipated applicability.

**System behavior:**

* create PWA Change Proposal;
* link source observations and evidence;
* route to PWA governance;
* preserve Undertaking work independently.

---

# 46. UX acceptance criteria

The corrected UX is conformant when:

1. The Product Realization PWA can be inspected without opening an Undertaking.
2. PWU Types and PWU Instances are visibly distinct.
3. PWA version and Undertaking binding are always visible.
4. The Field Service Management SaaS Undertaking and the Field Service Management SaaS product are identified separately.
5. The Product Realization PWA is identified as a Professional Work Architecture.
6. The reusable PWA, the Undertaking's Professional Work Graph, its Execution Plans, and its Execution Workflows remain distinct; Views are labeled as projections of those objects.
7. PWA edits do not mutate existing Undertakings automatically.
8. Undertaking edits do not mutate the PWA automatically.
9. A PWA version change for an existing Undertaking requires explicit migration.
10. PWA inheritance and local content are distinguished.
11. Published PWA versions are immutable.
12. Concrete execution and assurance state appears only on instances.
13. Product Realization PWA conformance fixtures are labeled as fixtures.
14. Users can navigate between a PWU Instance and its PWU Type.
15. An Undertaking can propose, but not directly apply, a PWA change.
16. Execution Workflows perform selected PWU Instances and are not substituted for the Professional Work Graph.
17. The complete Product Realization PWA Reference Undertaking works end to end.
18. The UI does not use `workflow` as the primary name for the PWA.
19. The UI may use `workflow` for temporal execution structures.
20. A reviewer can always determine which level they are examining.

---

# 47. Recommended implementation order

## Slice 1 — Concept separation

Implement:

* PWA Library;
* PWA Overview;
* Undertaking Portfolio;
* visible PWA version binding;
* distinct PWA and Undertaking headers.

## Slice 2 — Product Realization PWA inspection

Implement:

* PWA Work Architecture View;
* PWU Type Inspector;
* policy assignments;
* baseline definitions;
* read-only Product Realization PWA v1.

## Slice 3 — Undertaking instantiation

Implement:

* Create Undertaking;
* instantiate root Professional Work Graph;
* inherited-versus-local display;
* Field Service Management SaaS Reference Undertaking.

## Slice 4 — PWA editing

Implement:

* draft PWA version;
* PWU Type editing;
* decomposition-rule editing;
* conformance validation;
* publication.

## Slice 5 — Migration and learning

Implement:

* PWA version migration preview;
* Undertaking migration work;
* local extension;
* PWA Change Proposal.

---

# 48. Final terminology rule

Use these terms consistently:

```text
Product Realization PWA
    reusable, versioned Professional Work Architecture

Field Service Management SaaS Undertaking
    concrete professional work bound to Product Realization PWA v1.3

Product Realization structure in Product Realization PWA
    reusable PWU Types and relationship rules

Field Service Management Professional Work Graph
    instantiated PWU Instances and professional relationships owned by the Undertaking

Execution Plan
    governed plan for performing selected PWU Instances

Execution Workflow
    temporal agent, human, and tool activity carrying out an Execution Plan

Field Service Management SaaS
    product produced by the Undertaking
```

The system may therefore truthfully say:

> The Product Realization PWA defines reusable professional work for product realization. The Field Service Management SaaS Undertaking is instantiated under Product Realization PWA v1.3 and owns the Field Service Management Professional Work Graph. Selected PWU Instances are performed through governed Execution Plans and temporal Execution Workflows, evaluated through assurance, governed through Decisions, and accepted through Baselines to produce the Field Service Management SaaS product.

That is the conceptual separation the UI must preserve.
