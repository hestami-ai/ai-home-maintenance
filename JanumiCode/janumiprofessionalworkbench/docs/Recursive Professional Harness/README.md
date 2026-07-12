# Recursive Professional Harness document set

These artifacts evolved through exploration, so later specifications often sharpen or supersede earlier material. Read them in the authoritative order below rather than in generation order.

The governing progression is:

```text
Product and vocabulary authority
    ↓
RPH architecture and runtime semantics
    ↓
Product Realization PWA definition
    ↓
Assurance policies
    ↓
Legacy-system migration mapping
    ↓
Reference Undertaking
    ↓
Machine contracts and executable tests
    ↓
Persistence and cutover
    ↓
PWA and Undertaking user experience
```

## Canonical vocabulary rule

The [Janumi Product Architecture and Canonical Vocabulary Charter](Janumi%20Product%20Architecture%20and%20Canonical%20Vocabulary%20Charter%20-%20Governing%20Product%20Ontology%2C%20Subsystem%20Boundaries%2C%20and%20Naming%20Authority.md) is the naming and product-boundary authority for this directory.

In particular:

* Janumi is the company and product family.
* Janumi Platform is the shared multi-tenant technical and service foundation.
* Janumi Professional Workbench (JPWB) is the general-purpose professional-work environment.
* RPH is the underlying control and runtime architecture.
* A Professional Work Architecture (PWA) defines reusable professional-work structure and PWU Types.
* An Undertaking is concrete professional work instantiated under a selected PWA version.
* A Professional Work Graph belongs to an Undertaking and contains its PWU Instances and related professional objects.
* An Execution Workflow is temporal execution machinery, not the PWA or Professional Work Graph.
* JanumiCode is a domain product containing multiple software-product PWAs.
* Product Realization PWA is the canonical replacement for the former architectural use of `Product Lens`.
* Field Service Management SaaS Reference Undertaking is the canonical fixture; the Field Service Management SaaS product is its distinct output.
* A repository commit is not an authoritative Baseline.

Residual uses of `Product Lens`, `Lens`, `phase`, or `dialogue` are valid only when explicitly identifying legacy or compatibility concepts.

## Orientation

Read [Janumi Platform — Executive Overview](Janumi%20Platform%20-%20Executive%20Overview.md) for a concise product-family narrative. It is an orientation aid, not a substitute for the charter or the numbered specifications.

# Canonical manifest and reading order

## RPH-DOC-000 — Product architecture and canonical vocabulary

**Document:** [Janumi Product Architecture and Canonical Vocabulary Charter](Janumi%20Product%20Architecture%20and%20Canonical%20Vocabulary%20Charter%20-%20Governing%20Product%20Ontology%2C%20Subsystem%20Boundaries%2C%20and%20Naming%20Authority.md)

**Authority:** Foundational product architecture and naming authority.

Read this first. It defines Janumi, Janumi Platform, JPWB, RPH, PWA, PWU Type, PWU Instance, Undertaking, Professional Work Graph, Execution Plan, Execution Workflow, View, domain product, packages, delivery dispositions, and Baselines.

## RPH-DOC-001 — RPH and Product Realization architecture

**Document:** [Product Realization PWA Migration to the Recursive Professional Harness](Janumi%20Professional%20Workbench%20Product%20Realization%20PWA%20-%20Migration%20to%20the%20Recursive%20Professional%20Harness.md)

**Authority:** Architecture intent and implementation scope.

This explains why the hardcoded legacy Product Lens phase architecture is being replaced, what the RPH must accomplish, how Shape, Assurance, Loop, Harness, Context, and Prompt Engineering remain distinct, and how the Product Realization PWA is represented on RPH.

## RPH-DOC-002 — Canonical domain model

**Document:** [Canonical Domain Model, Invariants, State Machines, and Event Contract](Janumi%20Professional%20Workbench%20Recursive%20Professional%20Harness%20-%20Canonical%20Domain%20Model%2C%20Invariant%20Catalog%2C%20State%20Machines%2C%20and%20Event%20Contract.md)

**Authority:** Generic RPH runtime semantics and invariants.

This defines Professional Work Objects, concrete PWU runtime semantics, intent, obligations, constraints, assumptions, claims, evidence, assurance assessments, execution plans, decisions, Baselines, state machines, legal transitions, and cross-object invariants. Its runtime rules operate inside the PWA → Undertaking → Professional Work Graph ownership hierarchy established by RPH-DOC-000.

## RPH-DOC-003 — Product Realization PWA ontology

**Document:** [Product Realization PWA Professional Ontology and Assurance Policy Specification](Janumi%20Professional%20Workbench%20Product%20Realization%20PWA%20-%20Professional%20Ontology%20and%20Assurance%20Policy%20Specification.md)

**Authority:** Reusable software-product professional-work definition.

This specializes the generic RPH model with Product Realization PWU Types, roles, artifact types, decomposition and recomposition rules, baseline types, and assurance-policy assignments. It defines the PWA, not a concrete Undertaking or Execution Workflow.

## RPH-DOC-004 — Assurance policy catalog

**Document:** [Product Realization PWA Assurance Policy Catalog and Validator Contract](Janumi%20Professional%20Workbench%20Product%20Realization%20PWA%20-%20Assurance%20Policy%20Catalog%20and%20Validator%20Contract.md)

**Authority:** Assurance policy meanings, applicability, evidence, criteria, dispositions, and validator implementation contracts.

Read this after the PWA ontology because its policies evaluate claims about PWA-defined work. A Validator is an implementation of an Assurance Policy; validator output is not itself an authoritative decision.

## RPH-DOC-005 — Legacy JanumiCode semantic inventory

**Document:** [Legacy JanumiCode Semantic Inventory and RPH Conformance Mapping](Janumi%20Professional%20Workbench%20Legacy%20JanumiCode%20-%20Semantic%20Inventory%20and%20RPH%20Conformance%20Mapping.md)

**Authority:** Migration interpretation of legacy behavior.

This maps the former INTAKE-through-REPLAN phase model, dialogues, validators, and orchestration behavior into Product Realization PWU Types, PWU Instances, Assurance Policies, Execution Plans, governance Decisions, Baselines, controller actions, and compatibility projections. Legacy names in this document identify migration inputs rather than canonical architecture.

## RPH-DOC-006 — Field Service Management SaaS Reference Undertaking

**Document:** [Field Service Management SaaS Reference Undertaking](Janumi%20Professional%20Workbench%20Field%20Service%20Management%20SaaS%20Reference%20Undertaking.md)

**Authority:** Golden semantic and replay fixture.

This is a concrete Undertaking instantiated under the Product Realization PWA. It demonstrates actual PWU Instances, constraints, assumptions, claims, evidence, assurance assessments, findings, decisions, Baselines, traceability, and events. It must never be presented as the PWA definition or as the resulting Field Service Management SaaS product.

## RPH-DOC-007 — Command, event, and schema contracts

**Document:** [Command, Event, and Schema Contract Package](Janumi%20Professional%20Workbench%20Recursive%20Professional%20Harness%20-%20Command%2C%20Event%2C%20Schema%20Contract%20Package.md)

**Authority:** Machine boundary and serialization contract for the initial runtime slice.

Read this only after the domain and fixture. It defines envelopes, object schemas, validator-result schemas, policy-expression schemas, errors, projections, compatibility rules, schema evolution, and package layout.

## RPH-DOC-008 — Executable conformance tests

**Document:** [Executable Invariant and Conformance Test Specification](Janumi%20Professional%20Workbench%20Recursive%20Professional%20Harness%20-%20Executable%20Invariant%20and%20Conformance%20Test%20Specification.md)

**Authority:** Executable acceptance contract.

This turns architectural distinctions into tests for transitions, obligation preservation, constraint propagation, assumption falsification, execution-versus-assurance separation, validator independence, evidence invalidation, waivers, baseline promotion, event replay, recovery, projections, and legacy compatibility.

## RPH-DOC-009 — Persistence and migration

**Document:** [Persistence, Migration, Dual-Run, and Cutover Design](Janumi%20Professional%20Workbench%20Recursive%20Professional%20Harness%20-%20Persistence%2C%20Migration%2C%20Dual-Run%2C%20and%20Cutover%20Design.md)

**Authority:** Persistence, recovery, dual-run, authority-mode, and cutover design.

This follows the semantic contracts because persistence must implement those decisions rather than reshape them. Its phase and dialogue terms refer only to legacy storage or compatibility projections.

## RPH-DOC-010 — PWA Designer and Undertaking Workbench UX

**Document:** [PWA Designer and Undertaking Workbench UX Specification](Janumi%20Professional%20Workbench%20PWA%20Designer%20and%20Undertaking%20Workbench%20-%20Reference%20Demonstration.md)

**Authority:** User-facing separation of PWA design, Undertaking operation, execution, assurance, and governance contexts.

This demonstrates how users author and publish a PWA, instantiate it as an Undertaking, operate its Professional Work Graph, execute PWU Instances, review assurance, govern Baselines, migrate an Undertaking to a new PWA version, and propose PWA improvements from Undertaking learning.

# Coding-agent reading sequence

```text
0. Vocabulary Charter
1. RPH and Product Realization Architecture
2. Canonical Domain Model and Invariants
3. Product Realization PWA Ontology
4. Assurance Policy Catalog
5. Legacy Semantic Inventory and Mapping
6. Reference Undertaking
7. Command/Event/Schema Package
8. Executable Test Specification
9. Persistence and Migration Design
10. PWA Designer and Undertaking Workbench UX
11. Actual codebase inventory and repository-specific implementation plan
```

Use this precedence when documents appear to conflict:

```text
Canonical vocabulary and product boundaries
    outrank
older or compatibility terminology

Domain invariants and authority rules
    outrank
fixture convenience

PWA and Undertaking semantics
    outrank
database, Execution Workflow, or UI convenience

Executable conformance tests
    outrank
implementation shortcuts
```

Conflicts must be surfaced. They must not be silently resolved by redefining a canonical term.

# Human-review sequence

For the conceptual pass, read RPH-DOC-000, 001, 002, 003, 006, and 010.

For the implementation and risk pass, read RPH-DOC-004, 005, 007, 008, and 009.

Database and infrastructure reviewers may read RPH-DOC-009 before RPH-DOC-007 after completing the conceptual pass.

# Background material

Earlier exploratory discussions about Shape Engineering, WBS, PWUs, assurance as feedback control, validators as sensors, the legacy Product Lens ontology, and RPH as an operating system for professional work remain useful background. They are not implementation authority where they conflict with this document set.

The earlier workflow-canvas feature description is likewise a legacy input and UI inspiration. Its useful visual inspection, configurable execution, node-status, assurance visibility, templates, and human-interaction ideas remain; its workflow-first ontology has been superseded.

The concise reading rule is:

> Read the charter to learn the names and boundaries; the architecture to understand intent; the domain model to understand runtime meaning; the PWA to understand reusable work; the assurance catalog to understand trust; the migration map to understand legacy behavior; the Reference Undertaking to understand the concrete example; the contracts to understand interfaces; the tests to understand what must hold; persistence to understand how state survives; and the UX specification to understand how users move among design, Undertaking, execution, assurance, and governance contexts.
