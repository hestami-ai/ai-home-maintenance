# Janumi Professional Cognition Architecture

## Documentation README

**Document ID:** `JAN-DOCS-001`
**Version:** `0.1.1`
**Status:** Draft
**Role:** Repository entry point and controlled-document manifest
**Audience:** Humans and AI Agents
**Purpose:** Explain the structure, intent, and proper use of the Janumi architectural documentation.

---

# Document Control

`JAN-DOCS-001` is the controlled manifest for the `Constitution Discussion` document set. Other Janumi document sets may adopt the identifier, version, and status policies below while maintaining their own local manifests. Moving a document out of this set therefore moves its registration responsibility to the destination manifest without changing its permanent identifier.

## Identifier Policy

Every controlled document registered by this manifest SHALL carry a permanent identifier in the form:

```text
JAN-<FAMILY>-<NNN>
```

An allocated document identifier:

* SHALL NOT change when the title, filename, location, version, or status changes;
* SHALL NOT be reassigned to another document;
* SHALL remain attached to a Deprecated or Superseded document;
* SHOULD be used with the semantic version in diagnostics and machine-facing references, for example `JAN-CPCO-001@0.1.0`;
* SHOULD be accompanied by the human-readable title in prose on first use.

A materially distinct replacement document receives a new identifier. A new version of the same document retains its identifier.

## Version Policy

Document versions use `MAJOR.MINOR.PATCH` semantic versioning:

* `PATCH` records editorial corrections or clarifications that do not change requirements;
* `MINOR` records backward-compatible additions or refinements;
* `MAJOR` records incompatible semantic, behavioral, or governance changes.

Versions below `1.0.0` indicate a document is still evolving toward its first stable baseline. Version and status are independent: neither a `0.x` version nor a `1.x` version determines whether a document is binding.

## Status Policy

Each controlled document SHALL declare exactly one of these statuses:

| Status | Meaning |
| --- | --- |
| Draft | Work in progress. Normative keywords express candidate requirements, not approved binding requirements. |
| Proposed | Review-ready candidate submitted for governance approval but not yet binding. |
| Normative | Approved and binding within the document's declared scope. |
| Deprecated | Retained for compatibility or transition, but discouraged for new use. |
| Superseded | Replaced by another identified document and no longer a current source of authority. |

A Superseded document SHALL identify its successor. A Deprecated document SHOULD identify the preferred replacement when one exists.

The Draft registrations below convert the earlier `Normative draft` label to `Draft`. This preserves the documents' intended requirements while avoiding an unsupported claim that the broader discussion corpus has already been ratified.

## Controlled Document Manifest

| Document ID | Document | Version | Status | Note |
| --- | --- | --- | --- | --- |
| `JAN-DOCS-001` | [Janumi Professional Cognition Architecture Documentation README](README.md) | `0.1.1` | Draft | Repository entry point and identifier registry. |
| `JAN-CPCO-001` | [Canonical Professional Cognition Ontology](<Canonical Professional Cognition Ontology.md>) | `0.1.0` | Draft | Canonical semantic-model candidate. |
| `JAN-PWU-001` | [Professional Work Unit Aggregate Specification](<Professional Work Unit Aggregate Specification.md>) | `0.1.0` | Draft | PWU aggregate candidate. |
| `JAN-CPM-001` | [Canonical Projection Model](<Canonical Projection Model.md>) | `0.1.0` | Draft | Projection-model candidate. |
| `JAN-RIWS-001` | [Reference Interaction and Workspace Specification](<Reference Interaction and Workspace Specification.md>) | `0.1.0` | Draft | Interaction and workspace candidate. |
| `JAN-SEH-001` | [Shape Engineering Handbook](<Shape Engineering Handbook.md>) | `0.1.0` | Draft | PWA authoring-method candidate. |
| `JAN-JCPWA-001` | [JanumiCode Professional Work Architecture Profile](<JanumiCode Professional Work Architecture Profile.md>) | `0.1.0` | Draft | JanumiCode PWA candidate. |
| `JAN-JSDL-001` | [Janumi Semantic Definition Language](<Janumi Semantic Definition Language.md>) | `0.1.0` | Draft | Current JSDL core specification. |
| `JAN-JSDL-002` | [Janumi Semantic Definition Language conceptual overview](<Janumi Semantic Definition Language (JSDL).md>) | `0.1.0` | Superseded | Superseded by `JAN-JSDL-001`. |
| `JAN-JSDLC-001` | [JSDL Compiler Architecture and Bootstrap Implementation Specification](<JSDL Compiler Architecture and Bootstrap Implementation Specification.md>) | `0.1.0` | Draft | Compiler architecture candidate. |
| `JAN-JEM-001` | [Janumi Execution Model](<Janumi Execution Model (JEM).md>) | `0.1.0` | Draft | Current execution-model specification. |
| `JAN-JEM-002` | [Janumi Execution Model architectural overview](<retired/Janumi Execution Model (JEM) (retired).md>) | `0.1.0` | Superseded | Superseded by `JAN-JEM-001`. |
| `JAN-JSRP-001` | [Janumi Single-Node Runtime Profile](<Janumi Single-Node Runtime Profile.md>) | `0.1.0` | Draft | Single-node runtime candidate. |
| `JAN-JCUX-001` | [JanumiCode UI Information Architecture and Screen Contract](<JanumiCode UI Information Architecture and Screen Contract.md>) | `0.1.0` | Draft | JanumiCode UI contract candidate. |

The manifest records identity; the metadata in each document records that document's current version and status. A change to either SHALL update both locations in the same change set.

---

# Welcome

This repository contains the foundational architectural specifications for the Janumi Platform.

Janumi is **not** primarily a workflow engine, project management system, coding assistant, knowledge graph, or collection of AI agents.

It is an architecture for representing, coordinating, validating, and continuously reconciling **professional cognition**.

The documents in this repository collectively define:

* the underlying theory;
* the professional ontology;
* the execution semantics;
* the platform architecture;
* the runtime model;
* the authoring methodology;
* domain-specific Professional Work Architectures (PWAs);
* the reference user experience.

These documents are intended to become the canonical source from which implementations, APIs, runtimes, user interfaces, and AI behaviors are derived.

---

# Repository Philosophy

The documentation follows one fundamental principle:

> **Professional meaning precedes software implementation.**

Software is treated as a realization of professional cognition.

Not the other way around.

Every document exists to preserve that ordering.

---

# Intended Audiences

Different readers should consume the documentation differently.

## Professional Work Architects

Responsible for designing new Professional Work Architectures.

Primary documents:

* Shape Engineering Handbook
* CPCO
* JSDL
* Professional Work Architecture profiles

---

## Platform Architects

Responsible for platform architecture.

Primary documents:

* CPCO
* PWU Specification
* RPH Specification
* JEM
* JSRP
* JSDL

---

## Frontend Engineers

Responsible for the Professional Workbench.

Primary documents:

* Reference Experience Model
* Canonical Projection Model
* Reference Interaction and Workspace Specification
* JanumiCode UI Information Architecture

---

## Backend Engineers

Responsible for runtime implementation.

Primary documents:

* JSDL
* JEM
* JSRP
* PWU Specification
* RPH Specification

---

## Coding Agents

Responsible for implementing Janumi.

The recommended reading order appears later in this document.

---

## PWA Authors

Responsible for creating new professional domains.

Primary documents:

* Shape Engineering Handbook
* JSDL
* CPCO
* PWA examples

---

# Architectural Layers

The documentation intentionally separates conceptual concerns.

```text
Professional Reality
        │
        ▼
Shape Engineering
        │
        ▼
Professional Work Architecture
        │
        ▼
Canonical Professional Cognition Ontology
        │
        ▼
JSDL
        │
        ▼
Janumi Execution Model
        │
        ▼
Runtime Profiles
        │
        ▼
User Interfaces
```

Each layer depends only on layers above it.

Lower layers shall not redefine concepts established above.

---

# Documentation Catalog

## Part I — Foundations

### 1. Research Charter

Purpose:

Defines the scientific investigation into professional cognition.

Audience:

Researchers, architects.

Produces:

Foundational concepts.

---

### 2. Janumi Constitution

Purpose:

Defines the constitutional principles governing the platform.

Defines:

* architectural laws
* invariants
* governing principles

Audience:

Everyone.

---

### 3. CONOP (Concept of Operations)

Purpose:

Explains how Janumi is intended to operate.

Audience:

Architects, designers, developers.

---

### 4. CONEMP (Concept of Employment)

Purpose:

Explains how organizations employ Janumi operationally.

Audience:

Enterprise architects.

---

## Part II — Professional Cognition

### 5. Professional Cognition Life Cycle (PCLC)

Defines:

The canonical lifecycle of professional cognition.

Core stages:

* Intent
* Understanding
* Representation
* Reasoning
* Decision
* Action
* Observation
* Reconciliation

---

### 6. Canonical Professional Cognition Ontology (CPCO)

Defines:

The semantic vocabulary of professional work.

Examples:

* Intent
* Outcome
* Representation
* Claim
* Evidence
* Decision
* Observation
* Validation
* Reconciliation

This is the semantic source of truth.

---

## Part III — Professional Work

### 7. Professional Work Unit Specification (PWU)

Defines:

The bounded aggregate representing professionally meaningful work.

Includes:

* lifecycle
* decomposition
* recomposition
* completion
* authority
* commands
* events

---

### 8. Recursive Professional Harness Specification (RPH)

Defines:

Professional coordination.

Includes:

* delegation
* synthesis
* escalation
* tactic change
* recursive coordination

---

## Part IV — User Experience

### 9. Reference Experience Model (RXM)

Defines:

The philosophy of professional interaction.

---

### 10. Canonical Projection Model (CPM)

Defines:

How authoritative cognition becomes views.

Introduces:

* projections
* workspaces
* cognitive navigation

---

### 11. Reference Interaction and Workspace Specification (RIWS)

Defines:

Concrete interaction behavior.

Includes:

* shell
* navigation
* workspace anatomy
* commands
* state handling

---

## Part V — Semantic Platform

### 12. Janumi Semantic Definition Language (JSDL)

Defines:

The canonical language used to encode Professional Work Architectures.

Generates:

* APIs
* schemas
* models
* documentation
* validators
* contracts

---

### 13. JSDL Compiler Architecture

Defines:

How JSDL becomes executable artifacts.

---

## Part VI — Runtime

### 14. Janumi Execution Model (JEM)

Defines:

Execution semantics.

Independent of infrastructure.

---

### 15. Janumi Single-Node Runtime Profile (JSRP)

Defines:

Concrete implementation using:

* PostgreSQL
* OpenTelemetry
* OpenSandbox
* container deployment

---

## Part VII — Shape Engineering

### 16. Shape Engineering Handbook

Defines:

How to create Professional Work Architectures.

This is the methodology for creating future domains.

Examples:

* JanumiCode
* JanumiScience
* JanumiLegal
* JanumiHealthcare

---

## Part VIII — Professional Work Architectures

### 17. JanumiCode PWA

Defines:

Software product realization.

Specializes:

* Requirements
* Architecture
* Implementation
* Verification
* Release
* Operations

---

## Part IX — UI

### 18. JanumiCode UI Information Architecture

Defines:

Concrete screens.

Includes:

* routes
* workspaces
* projections
* commands
* component contracts

This is the primary implementation document for frontend coding agents.

---

# Dependency Graph

The documents should be read approximately in this order.

```text
Research Charter
        │
        ▼
Constitution
        │
        ▼
CONOP / CONEMP
        │
        ▼
Professional Cognition
        │
        ▼
CPCO
        │
        ▼
PWU
        │
        ▼
RPH
        │
        ▼
Projection Model
        │
        ▼
Workspace Specification
        │
        ▼
Shape Engineering
        │
        ▼
Professional Work Architecture
        │
        ▼
JSDL
        │
        ▼
Compiler
        │
        ▼
Execution Model
        │
        ▼
Runtime
        │
        ▼
UI
```

Lower documents SHALL NOT redefine upper-layer concepts.

---

# How Humans Should Use These Documents

## Architects

Read sequentially.

The documents progressively become more concrete.

Avoid skipping directly into runtime or UI specifications.

---

## Frontend Developers

Read:

* CPCO
* Projection Model
* Workspace Specification
* JanumiCode UI

Do not begin implementation solely from screen mockups.

---

## Backend Developers

Read:

* CPCO
* PWU
* RPH
* JSDL
* JEM
* Runtime Profile

Avoid implementing generic CRUD services.

Implement semantic Commands.

---

## Domain Experts

Read:

* Shape Engineering
* relevant Professional Work Architecture

Focus on validating semantics rather than implementation details.

---

# How Coding Agents Should Consume These Documents

Coding agents SHALL inspect a document's control metadata before using it. Only a document with `Status: Normative` is binding. Draft and Proposed documents express candidate requirements; Deprecated and Superseded documents are non-authoritative except where explicitly used for compatibility, migration, or historical context.

Recommended order:

1. Read this README.
2. Read the applicable platform Constitution when one has been registered.
3. Read CPCO.
4. Read PWU.
5. Read RPH.
6. Read Projection Model.
7. Read Workspace Specification.
8. Read JSDL.
9. Read JEM.
10. Read the relevant PWA.
11. Read the UI specification.

The coding agent SHOULD then produce:

* gap analysis;
* implementation plan;
* dependency graph;
* phased implementation roadmap.

The coding agent SHOULD NOT immediately generate code after reading only one document.

---

# Normative Language

The documentation uses RFC-style terminology.

| Keyword    | Meaning               |
| ---------- | --------------------- |
| SHALL      | Mandatory             |
| SHALL NOT  | Prohibited            |
| SHOULD     | Strong recommendation |
| SHOULD NOT | Normally avoided      |
| MAY        | Optional              |

---

# Relationship Between Documents

The documents are complementary.

For example:

CPCO defines what an Outcome is.

PWU defines how Outcomes participate in work.

Projection Model defines how Outcomes are viewed.

Workspace Specification defines how Outcomes appear on screen.

JSDL defines how Outcomes are encoded.

JEM defines how Outcome changes execute.

Runtime Profile defines how Outcome changes are persisted.

JanumiCode defines Outcome specialization for software engineering.

---

# Source of Truth

Subject first to document status and explicit supersession, when two current documents appear to overlap:

1. Constitution
2. CPCO
3. Shape Engineering Handbook
4. Professional Work Architecture
5. JSDL
6. Execution Model
7. Runtime Profile
8. Workspace Specification
9. UI Specification

Higher documents govern lower documents.

Lower documents may specialize but SHALL NOT contradict higher-level semantics.

---

# Change Management

Every architectural change SHOULD answer:

* Why is this change needed?
* Which document is authoritative?
* Which downstream documents are affected?
* Is the change semantic or implementation-only?
* Is the change backward compatible?
* Which JSDL modules change?
* Which runtime behaviors change?
* Which UI projections change?

Changes should propagate from higher layers downward.

Avoid introducing implementation changes that later require semantic justification.

---

# Repository Organization (Recommended)

```text
docs/
├── 00-README.md
├── 01-foundations/
├── 02-professional-cognition/
├── 03-professional-work/
├── 04-experience/
├── 05-semantic-platform/
├── 06-runtime/
├── 07-shape-engineering/
├── 08-pwas/
│   ├── janumicode/
│   ├── janumiscience/
│   ├── janumilegal/
│   └── ...
├── 09-ui/
└── decisions/
```

Professional Work Architectures should each receive their own directory containing:

* charter
* research
* models
* JSDL
* scenarios
* generated artifacts
* releases

---

# Long-Term Vision

The documentation is intended to evolve from explanatory documents into executable specifications.

The progression is:

```text
Professional Reality
        ↓
Shape Engineering
        ↓
Professional Work Architecture
        ↓
JSDL
        ↓
Semantic Compiler
        ↓
Generated Runtime
        ↓
Generated User Experience
```

The objective is that future Professional Work Architectures can be authored through Shape Engineering, encoded in JSDL, compiled by the Janumi Semantic Compiler, and executed by the Janumi Platform while preserving professional meaning, governance, and continuous reconciliation.

This repository therefore documents not just a software platform, but a method for engineering AI-native professional organizations.
