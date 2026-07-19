# JAN-IRP-002 — Program Lifecycle and Gate Model

**Version:** 0.3.0  
**Status:** Proposed Normative Draft  
**Purpose:** Define the dependency-correct lifecycle through which the canonical roadmap becomes a repository-specific implementation program and accepted baseline.

## 1. Two orthogonal structures

The implementation program has two distinct structures:

1. **Program phases `P0–P9`** describe how evidence, understanding, authority, and implementation progress through time.
2. **Canonical capabilities `C1–C11`** describe what implementation outcomes must eventually become true.

They shall not be conflated.

```text
Program phases discover and authorize work.
Canonical capabilities define stable target outcomes.
Repository-specific increments bind capabilities to actual code and migration work.
```

## 2. Program phase graph

```text
P0  Program Foundation and Source Baseline
 │
 ▼
P1  Repository Intake and Evidence Preservation
 │
 ▼
P2  Current-State Semantic Reconstruction
 │
 ▼
P3  Normative Applicability and Conformance Assessment
 │
 ▼
P4  Code–Specification Reconciliation
 │
 ▼
P5  Transition Architecture
 │
 ▼
P6  Repository-Specific Roadmap Instantiation
 │
 ▼
P7  Capability Realization
 │
 ▼
P8  Integration and Operational Conformance
 │
 ▼
P9  Release and Evolution Baseline
```

A phase may reopen an earlier phase when new evidence invalidates an accepted assumption or reveals incomplete reconstruction.

## 3. Phase lifecycle state

Each phase shall use:

```text
NOT_STARTED
PROPOSED
AUTHORIZED
ACTIVE
WAITING_FOR_EVIDENCE
WAITING_FOR_AUTHORITY
UNDER_REVIEW
CONDITIONALLY_ACCEPTED
ACCEPTED
REJECTED
REOPENED
SUSPENDED
SUPERSEDED
CANCELLED
```

### 3.1 Acceptance meanings

- `ACCEPTED`: all mandatory exit conditions are satisfied or covered by approved bounded deviations.
- `CONDITIONALLY_ACCEPTED`: progression is allowed under explicit conditions, owners, deadlines, and risk controls.
- `REJECTED`: evidence is insufficient or mandatory conditions fail; downstream authorization is withheld.

## 4. Gate rule

A phase or increment may pass its exit gate only when:

- its entrance conditions were satisfied;
- required outputs exist in controlled form;
- evidence is reproducible and indexed;
- mandatory review is complete;
- blockers are resolved or explicitly accepted under valid deviation;
- the acceptance authority records a decision;
- downstream authorization is bounded and explicit.

A passing build, generated document, completed checklist, route rendering, or agent assertion is insufficient alone.

## 5. Phase P0 — Program Foundation and Source Baseline

### Outcome

The normative corpus, authority hierarchy, requirement extraction method, program controls, and known source gaps are governed sufficiently to begin repository investigation.

### Required work

- materialize all available source documents;
- assign stable IDs, versions, statuses, owners, and authority tiers;
- identify missing, superseded, duplicate, and contradictory documents;
- audit the provisional 157-requirement register;
- establish requirement-ID permanence and clause traceability;
- approve discrepancy classifications and evidence conventions;
- configure program-instance storage and access;
- assign investigation, review, and acceptance roles.

### Required outputs

```text
Approved Source Catalog
Authority Hierarchy
Requirement Register Baseline
Known Source Gap Register
Program Execution Context
P1 Authorization
```

### Exit conditions

- no unresolved source-authority ambiguity blocks investigation;
- every material source is controlled or explicitly unavailable;
- requirement extraction coverage is known;
- the repository may be acquired without changing target semantics.

## 6. Phase P1 — Repository Intake and Evidence Preservation

### Outcome

The exact implementation and relevant operational context are acquired and preserved as reproducible current-state evidence.

### Required work

- record repository, branch, commit, submodules, worktrees, uncommitted state, and archive identity;
- preserve build manifests, generated artifacts, migrations, infrastructure, and deployment configuration;
- run baseline builds and tests without remediation;
- inventory code, routes, components, APIs, schemas, data models, tests, agents, runtimes, integrations, and operations;
- hash evidence and record tool versions;
- document inaccessible or missing evidence.

### Write boundary

P1 is read-mostly. Repository modifications are prohibited except for approved investigative instrumentation that is isolated, reversible, identified as non-product code, and incapable of changing the evidence being assessed.

### Required outputs

```text
Repository Evidence Manifest
Baseline Build Report
Baseline Test Report
Implementation Surface Inventory
Toolchain and Dependency Inventory
Deployment and Runtime Inventory
Evidence Integrity Manifest
P2 Authorization
```

### Exit conditions

- the assessed revision is immutable or reproducibly identifiable;
- evidence scope and exclusions are explicit;
- baseline failures are preserved rather than fixed silently;
- sufficient material exists for semantic reconstruction.

## 7. Phase P2 — Current-State Semantic Reconstruction

### Outcome

The implementation is understood as a professional and technical system rather than merely inventoried as files.

### Required work

Reconstruct at least:

- current semantic entities and relationships;
- state and lifecycle models;
- PWU/PWA/RPH concepts or analogues;
- mutation and command behavior;
- event and workflow behavior;
- projections, screens, routes, and navigation;
- authority, identity, and tenant boundaries;
- agent roles, context assembly, tool use, and completion behavior;
- persistence, migrations, and transactional boundaries;
- tests, validators, and assurance behavior;
- runtime, deployment, recovery, and observability;
- product-realization traceability.

### Required outputs

```text
Current-State Architecture Report
Current Semantic Model
Current Work and Coordination Model
Current UI and Experience Map
Current Runtime and Persistence Model
Current Agent and Harness Model
Current Security and Authority Model
Current Test and Assurance Model
Current Deployment and Operations Model
Unknowns and Confidence Register
P3 Authorization
```

### Exit conditions

- material behavior is supported by code, tests, runtime observation, or explicit uncertainty;
- descriptive diagrams and prose do not claim more than evidence supports;
- current-state and target-state terminology remain distinguishable.

## 8. Phase P3 — Normative Applicability and Conformance Assessment

### Outcome

Every normative implementation requirement has an applicability and current-conformance disposition supported by evidence.

### Required work

- map requirements to current-state entities, code, tests, and behavior;
- assess structural, semantic, execution, UI, agent, security, and operational conformance;
- identify unassessed evidence gaps;
- assign status and confidence;
- identify candidate discrepancies;
- obtain independent sampling or full review according to criticality.

### Assessment statuses

```text
CONFORMANT
PARTIALLY_CONFORMANT
NONCONFORMANT
NOT_IMPLEMENTED
NOT_APPLICABLE
UNKNOWN
BLOCKED_BY_SPECIFICATION
```

### Required outputs

```text
Requirement Conformance Matrix
Requirement-to-Code Trace
Requirement-to-Test Trace
Applicability Decisions
Evidence Gap Register
Candidate Discrepancy Register
P4 Authorization
```

### Exit conditions

- every mandatory requirement has a status;
- every `NOT_APPLICABLE` disposition has rationale and authority;
- no critical conformance claim lacks evidence;
- unknowns are bounded resolution obligations.

## 9. Phase P4 — Code–Specification Reconciliation

### Outcome

Every material discrepancy between observed implementation and normative target has an explicit, reviewed classification and disposition.

### Required classifications

```text
IMPLEMENTATION_DEFECT
SPECIFICATION_DEFECT
DOCUMENTATION_STALENESS
VALID_EXISTING_BEHAVIOR
TEMPORARY_DEVIATION
UNRESOLVED_AMBIGUITY
```

### Required dispositions

```text
PRESERVE
DOCUMENT
ADAPT
WRAP
REFACTOR
MIGRATE
REPLACE
RETIRE
CREATE
ESCALATE
```

### Required outputs

```text
Accepted Discrepancy Register
Reconciliation Decisions
Specification Change Proposals
Implementation Defect Register
Temporary Deviation Register
Preservation Decisions
P5 Authorization
```

### Exit conditions

- no material discrepancy remains silently unresolved;
- specification defects have upstream owners;
- valid existing behavior is protected from accidental loss;
- temporary deviations have expiration and compensating controls.

## 10. Phase P5 — Transition Architecture

### Outcome

A controlled path exists from the accepted current state to the normative target without assuming wholesale rewrite or blind preservation.

### Required work

- construct current-to-target mappings;
- select transition strategy per material component;
- define semantic, data, API, UI, runtime, agent, and deployment migrations;
- define compatibility periods and dual-operation where required;
- identify bootstrap concessions and expiration gates;
- define rollback, recovery, and evidence preservation;
- identify constraints on sequencing and operational continuity.

### Required outputs

```text
Target-to-Current Mapping
Transition Architecture
Data Migration Strategy
API Compatibility Strategy
UI Transition Strategy
Runtime and Agent Transition Strategy
Bootstrap Concession Register
Deprecation Plan
Rollback and Recovery Plan
P6 Authorization
```

### Exit conditions

- every nonconformant material area has a transition path or approved deferral;
- migration order respects data and runtime dependencies;
- no strategy depends on silent destructive replacement;
- operational continuity and recovery are addressed.

## 11. Phase P6 — Repository-Specific Roadmap Instantiation

### Outcome

The canonical capability catalog is transformed into an exact repository-specific implementation roadmap.

### Required work

- bind each canonical capability to current conformance and transition strategy;
- identify preservation, adaptation, creation, migration, and retirement work;
- construct repository dependency DAG;
- divide work into bounded vertical increments;
- define exact paths, services, schemas, routes, tests, and migration targets;
- assign entrance conditions, non-goals, prohibited shortcuts, proof obligations, and reviewers;
- produce implementation waves without embedding dates as normative semantics.

### Required outputs

```text
Repository-Specific Roadmap Instance
Capability Binding Matrix
Increment Dependency DAG
Implementation Wave Model
Capability Increment Specifications
Evidence Plans
Authorized Deferrals and Deviations
P7 Authorization
```

### Exit conditions

- every applicable mandatory requirement maps to an increment, preserved conformance, approved deviation, or upstream blocker;
- the DAG has no unexplained cycles;
- the first increment is bounded and executable;
- future increments cannot silently redefine earlier semantic decisions.

## 12. Phase P7 — Capability Realization

### Outcome

Authorized capabilities become true in the implementation through accepted vertical increments.

### Execution rule

Each increment shall:

- assess its immediate current baseline;
- implement only authorized scope and necessary prerequisites;
- preserve valid behavior;
- execute migration controls;
- add semantic and operational tests;
- produce the required evidence package;
- undergo independent review;
- receive an acceptance decision.

### Required outputs

```text
Implemented Capability Increments
Migration Records
Requirement and Evidence Updates
Accepted Gate Decisions
Updated Current-State Baseline
Updated Deviation and Deferral Registers
```

### Exit conditions

The baseline set of capabilities selected for the release profile is accepted and integrated.

## 13. Phase P8 — Integration and Operational Conformance

### Outcome

Capabilities that pass locally are demonstrated to compose into a coherent, recoverable, secure, observable Janumi system.

### Required assurance

- end-to-end intent and outcome traceability;
- cross-PWU decomposition and recomposition;
- RPH durability and restart recovery;
- command, event, and projection consistency;
- agent authority and sandbox isolation;
- tenant isolation;
- migration and rollback;
- backup and restore;
- load, backpressure, and resource governance;
- accessibility and critical UI journeys;
- operational observation and reconciliation.

### Required outputs

```text
Integrated Conformance Report
Runtime Conformance Results
Security and Tenant Isolation Evidence
Recovery Drill Evidence
End-to-End Acceptance Journeys
Operational Readiness Findings
P9 Authorization
```

## 14. Phase P9 — Release and Evolution Baseline

### Outcome

An identified implementation revision and operating profile are accepted for use with explicit residual risk and continued evolution controls.

### Required outputs

```text
Conformance Declaration
Accepted Implementation Revision
Semantic Model and Runtime Profile Versions
Deployment Profile
Known Residual Deviations
Accepted Risks
Deferred Requirements
Operating Runbooks
Evolution Backlog
Next Program-Instance Trigger Conditions
```

### Exit conditions

- release authority accepts the evidence and residual risk;
- no hidden severity-one semantic, tenant, authority, data-integrity, or recovery defect remains;
- rollback and recovery are credible;
- future changes remain governed by this corpus or an approved successor.

## 15. Parallelization rules

Parallel work is allowed only when:

- hard prerequisites are accepted;
- work uses the same controlled semantic baseline;
- teams cannot create competing sources of truth;
- integration and reconciliation obligations are explicit;
- evidence remains attributable.

Examples:

- P1 inventory tooling and P0 editorial consolidation may overlap only if inventory does not rely on unresolved semantics.
- P7 increments may run in parallel when their aggregate, schema, API, and migration dependencies do not conflict.
- UI prototyping may precede backend completion but cannot receive conformance acceptance until authoritative projections and commands exist.

## 16. Reopening rule

An accepted phase shall reopen when new evidence materially invalidates:

- source authority;
- current-state reconstruction;
- requirement applicability;
- discrepancy disposition;
- transition assumptions;
- increment dependency;
- assurance evidence.

Reopening shall preserve the prior acceptance record and identify affected downstream decisions.
