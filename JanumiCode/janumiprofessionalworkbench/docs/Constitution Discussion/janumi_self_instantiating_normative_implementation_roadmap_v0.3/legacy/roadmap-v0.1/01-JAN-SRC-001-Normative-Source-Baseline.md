# JAN-SRC-001 — Normative Source Baseline

**Version:** 0.1  
**Status:** Proposed normative baseline  
**Owner:** TBD  
**Approval authority:** TBD  
**Purpose:** Establish the source documents, authority hierarchy, and conflict-disposition rules governing the implementation roadmap.

> This baseline is derived from the document corpus produced in the current Janumi architecture effort. The documents remain draft material until formally approved and placed under repository change control. The roadmap SHALL NOT treat conversational existence as equivalent to organizational approval.

## Authority hierarchy

| Tier | Authority | Effect |
|---:|---|---|
| 0 | Janumi Constitution | Highest semantic and architectural authority. |
| 1 | Foundations, laws, PCLC, CPCO, CONOP | Universal theory, semantics, and operating doctrine. |
| 2 | PWU, RPH, CPM, JSDL, JEM, Shape Engineering, PWA profiles | Normative architecture and specialization contracts. |
| 3 | Compiler, runtime, workspace, and UI profiles | Concrete realization profiles subordinate to higher tiers. |
| 4 | Source baseline, requirement register, roadmap, and conformance matrix | Govern controlled implementation and evidence; they may not redefine upstream semantics. |
| 5 | Operating plan and backlog | Mutable scheduling, staffing, estimates, and tasks. |

## Source catalog

| Document ID | Title | Version | Status | Tier | Owner | Approval authority | Scope |
|---|---|---:|---|---:|---|---|---|
| `JAN-CONST-001` | Janumi Constitution | 0.1 | `PROPOSED_NORMATIVE_HIGHEST_AUTHORITY` | 0 | TBD | TBD | Constitutional obligations governing all Janumi implementations. |
| `JAN-CONOP-001` | Janumi Concept of Operations | 0.1 | `PROPOSED_DOCTRINAL` | 1 | TBD | TBD | Lived operating concept for AI-native professional work. |
| `JAN-CPCO-001` | Canonical Professional Cognition Ontology | 0.1 | `PROPOSED_NORMATIVE` | 1 | TBD | TBD | Canonical domain-independent semantic model. |
| `JAN-FCA-001` | Derived Corollaries and Architectural Consequences | 0.1 | `PROPOSED_NORMATIVE` | 1 | TBD | TBD | Derivation of architectural consequences from the foundational laws. |
| `JAN-FPC-001` | Foundations of Professional Cognition — Primitive Concepts | 0.1 | `PROPOSED_NORMATIVE` | 1 | TBD | TBD | Domain-independent primitives of professional cognition. |
| `JAN-FPL-001` | Fundamental Laws of Professional Cognition | 0.1 | `PROPOSED_NORMATIVE` | 1 | TBD | TBD | Domain-independent laws governing professional cognition. |
| `JAN-PCLC-001` | Professional Cognition Life Cycle | 0.1 | `PROPOSED_NORMATIVE` | 1 | TBD | TBD | Dynamic model of professional cognition. |
| `JAN-CPM-001` | Canonical Projection Model | 0.1 | `PROPOSED_NORMATIVE` | 2 | TBD | TBD | Rules for derived role- and purpose-specific projections. |
| `JAN-JCPWA-001` | JanumiCode Professional Work Architecture Profile | 0.1 | `PROPOSED_NORMATIVE_PROFILE` | 2 | TBD | TBD | Product-realization specialization of the Janumi discipline. |
| `JAN-JEM-001` | Janumi Execution Model | 0.1 | `PROPOSED_NORMATIVE` | 2 | TBD | TBD | Infrastructure-independent execution semantics. |
| `JAN-JSDL-001` | Janumi Semantic Definition Language | 0.1 | `PROPOSED_NORMATIVE` | 2 | TBD | TBD | Machine-readable semantic source language. |
| `JAN-PWU-001` | Professional Work Unit Aggregate Specification | 0.1 | `PROPOSED_NORMATIVE` | 2 | TBD | TBD | Semantic and operational contract for Professional Work Units. |
| `JAN-RPH-001` | Recursive Professional Harness Coordination Specification | 0.1 | `PROPOSED_NORMATIVE` | 2 | TBD | TBD | Coordination obligations for recursive professional work. |
| `JAN-RXM-001` | Reference Experience Model | 0.1 | `PROPOSED_NORMATIVE` | 2 | TBD | TBD | Canonical experience principles for professional cognition. |
| `JAN-SEH-001` | Shape Engineering Handbook | 0.1 | `PROPOSED_NORMATIVE_METHOD` | 2 | TBD | TBD | Method for engineering Professional Work Architectures. |
| `JAN-JCUX-001` | JanumiCode UI Information Architecture and Screen Contract | 0.1 | `PROPOSED_NORMATIVE_PROFILE` | 3 | TBD | TBD | Concrete routes, screens, component contracts, and acceptance journeys. |
| `JAN-JSDLC-001` | JSDL Compiler Architecture and Bootstrap Implementation Specification | 0.1 | `PROPOSED_NORMATIVE` | 3 | TBD | TBD | Compiler phases, IR, diagnostics, and generators. |
| `JAN-JSRP-001` | Janumi Single-Node Runtime Profile | 0.1 | `PROPOSED_NORMATIVE_PROFILE` | 3 | TBD | TBD | Initial PostgreSQL-centered implementation profile. |
| `JAN-RIWS-001` | Reference Interaction and Workspace Specification | 0.1 | `PROPOSED_NORMATIVE` | 3 | TBD | TBD | Canonical application shell, workspaces, and interaction semantics. |
| `JAN-CONF-001` | Conformance and Evidence Matrix | 0.1 | `WORKING_NORMATIVE_CONTROL_RECORD` | 4 | TBD | TBD | Traceability from requirements to implementation, verification, evidence, and acceptance. |
| `JAN-REQ-001` | Normative Requirement Register | 0.1 | `PROPOSED_NORMATIVE_CONTROL` | 4 | TBD | TBD | Stable implementation-oriented obligation register. |
| `JAN-RMAP-001` | Normative Implementation Roadmap | 0.1 | `PROPOSED_NORMATIVE_CONTROL` | 4 | TBD | TBD | Capability order, gates, evidence, deferrals, and deviations. |
| `JAN-SRC-001` | Normative Source Baseline | 0.1 | `PROPOSED_NORMATIVE_CONTROL` | 4 | TBD | TBD | Source catalog, authority hierarchy, and conflict-disposition rules. |

## Missing or intentionally excluded artifacts

- A complete CONEMP was discussed but was not produced as a stable source document in the current corpus. It is excluded from the requirement baseline until generated and approved.
- The source documents must be editorially consolidated because some concepts were refined across successive drafts. G0 requires that consolidation before the roadmap becomes effective.

## Current-state versus target-state authority

- **Current-state evidence:** source code, migrations, tests, deployed behavior, operational data, and existing UI reveal what the implementation presently does.
- **Target-state authority:** the approved Constitution, CPCO, architecture specifications, PWA, and roadmap govern what the implementation must become.
- A conflict SHALL be classified as `IMPLEMENTATION_DEFECT`, `SPECIFICATION_DEFECT`, `DOCUMENTATION_STALENESS`, `VALID_EXISTING_BEHAVIOR`, `TEMPORARY_DEVIATION`, or `UNRESOLVED_AMBIGUITY`.
- The coding agent SHALL not silently assume that either code or documentation is correct. It SHALL preserve the discrepancy, assess downstream impact, and initiate reconciliation.

## Roadmap change rule

A change to sequence, packaging, or parallelization MAY be made through roadmap governance when semantic obligations remain unchanged. A change to professional meaning, lifecycle, authority, invariants, or conformance criteria requires an upstream specification change and reconciliation.
