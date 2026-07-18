# Janumi Professional Workbench Product Realization PWA

## Professional Ontology and Assurance Policy Specification

**Document ID:** `RPH-DOC-003`
**Status:** Initial canonical draft
**Applies to:** Janumi Professional Workbench
**Runtime:** Recursive Professional Harness
**Primary implementation:** Product Realization PWA migration from the legacy Product Lens hardcoded phase orchestrator
**Related disciplines:** Shape Engineering, Assurance Engineering, Loop Engineering, Harness Engineering, Context Engineering, and Prompt Engineering

---

# 1. Purpose

This specification defines the professional ontology and assurance assignments of the Product Realization Professional Work Architecture (PWA) in the Janumi Professional Workbench.

The Recursive Professional Harness defines how professional work is represented, executed, assured, revised, and promoted into authoritative state.

The Product Realization PWA defines:

* what product-development work exists;
* which professional concepts are meaningful;
* how those concepts relate;
* which Professional Work Units may be created;
* how those work units may decompose;
* which artifacts they produce;
* what claims must be established;
* what evidence is acceptable;
* which assurance policies apply;
* which decisions require human or organizational authority;
* how child outcomes recompose into a completed product outcome.

The Product Realization PWA is therefore not:

* a fixed workflow;
* a sequence of prompts;
* a collection of agent roles;
* a canvas template;
* a task list;
* a project-management methodology.

It is a reusable, versioned Professional Work Architecture that supplies software-product-realization semantics to the Recursive Professional Harness.

The initial Product Realization PWA will preserve compatibility with the legacy Product Lens sequence:

```text
INTAKE
→ ARCHITECTURE
→ PROPOSE
→ ASSUMPTION_SURFACING
→ VERIFY
→ HISTORICAL_CHECK
→ REVIEW
→ EXECUTE
→ VALIDATE
→ COMMIT
```

However, those phase names will become compatibility milestones and execution-plan groupings. They will no longer define the authoritative structure of the work.

---

# 2. Product Realization PWA Mission

The Product Realization PWA exists to transform an underspecified product intent into an implemented and assured software baseline.

Its governing objective is:

> Preserve the user’s authorized product intent as it is progressively formalized, decomposed, designed, planned, implemented, validated, and accepted.

A successful Product Realization Undertaking must establish more than the existence of working code.

It must establish justified confidence that:

* the intended problem was understood;
* the desired outcomes were preserved;
* critical constraints were respected;
* the proposed product serves the relevant users and journeys;
* the architecture supports the intended capabilities;
* the implementation conforms to the approved shape;
* material assumptions were made explicit;
* material claims are supported by evidence;
* validation covers fitness for purpose, not only local correctness;
* acceptance was granted by appropriate authority;
* the promoted baseline is traceable to the originating intent.

---

# 3. Product Realization PWA Architectural Position

The Product Realization PWA supplies domain semantics to the RPH.

```text
Product Realization PWA
        ↓
PWU Types
Artifact types
Claims
Evidence expectations
Assurance policies
Decomposition rules
Role defaults
        ↓
Recursive Professional Harness
        ↓
Execution plans
Runtime bindings
Assurance assessments
Governance decisions
Baselines
```

The ontology does not directly dictate:

* which model must be used;
* which agent performs each unit;
* the exact order of all activities;
* how many retries are allowed;
* which CLI provider is active;
* the visual arrangement of canvas nodes.

Those are execution, harness, loop, and presentation concerns.

---

# 4. Ontology Conformance Levels

The Product Realization PWA supports three conformance profiles.

## 4.1 Lightweight Profile

Appropriate for:

* small, reversible changes;
* well-understood internal features;
* low-risk prototypes;
* local refactoring;
* exploratory spikes.

Minimum expectations:

* explicit intent;
* bounded PWU Instance;
* known constraints;
* expected output;
* local evidence;
* basic validation;
* no unresolved critical assumptions.

## 4.2 Standard Profile

Appropriate for:

* ordinary product features;
* user-facing behavior;
* database or API changes;
* multi-component work;
* material architecture decisions.

Additional expectations:

* user journeys;
* acceptance criteria;
* architecture impact;
* decomposition contract;
* assumption disclosure;
* independent verification;
* integration evidence;
* human or delegated approval.

## 4.3 High-Assurance Profile

Appropriate for:

* security-sensitive features;
* enterprise governance;
* regulated environments;
* production migrations;
* high-impact architectural changes;
* difficult-to-reverse operations.

Additional expectations:

* independent assurance;
* stronger evidence requirements;
* explicit rollback and recovery;
* policy and security review;
* formal impact analysis;
* constraint-propagation verification;
* human approval;
* baseline package;
* residual-risk decision.

The required profile is selected using consequence, uncertainty, irreversibility, security sensitivity, and regulatory exposure.

---

# 5. Core Product Concepts

The ontology defines the following principal professional concepts.

## 5.1 Product Intent

The authorized description of the problem, desired outcomes, users, constraints, non-goals, and success conditions.

## 5.2 Product Boundary

The definition of what the product or change includes and excludes.

## 5.3 Stakeholder

A person, group, organization, system, or authority affected by or able to constrain the product.

## 5.4 Actor

A human or system participant that performs actions within a user journey or operational process.

## 5.5 Business Domain

A coherent area of business responsibility, terminology, rules, and behavior.

## 5.6 Capability

An ability the product must provide.

## 5.7 Requirement

A statement of necessary product behavior, quality, constraint, interface, or outcome.

## 5.8 User Journey

A structured representation of how an actor seeks an outcome across interactions with the product and surrounding systems.

## 5.9 Scenario

A concrete instance or variation of a journey, including normal, alternate, exceptional, and failure paths.

## 5.10 Domain Entity

A meaningful business or professional object with identity, lifecycle, state, and relationships.

## 5.11 Integration

A relationship through which the product exchanges information or behavior with an external system.

## 5.12 Architecture Element

A component, service, module, data store, interface, runtime, or deployment unit.

## 5.13 Architecture Decision

A governed choice among materially different architectural alternatives.

## 5.14 Product Increment

A bounded set of product behavior and artifacts intended for implementation and validation.

## 5.15 Acceptance Criterion

A verifiable condition that must be satisfied for an increment or outcome to be accepted.

## 5.16 Risk

An uncertain condition that may affect the likelihood or consequence of achieving intent.

## 5.17 Artifact

A persistent output of professional work, such as:

* product definition;
* journey model;
* architecture;
* code;
* test;
* decision record;
* migration plan;
* documentation;
* evidence package.

## 5.18 Baseline

An approved and immutable version of one or more product artifacts that serves as an authoritative reference.

---

# 6. Core Relationship Types

The Product Realization PWA uses typed relationships.

```text
Intent
  DEFINES
Desired Outcome

Stakeholder
  PARTICIPATES_IN
User Journey

User Journey
  REALIZES
Capability

Capability
  REFINED_BY
Requirement

Requirement
  ALLOCATED_TO
PWU Instance

PWU Instance
  PRODUCES
Artifact

Architecture Element
  IMPLEMENTS
Capability

Artifact
  SUPPORTS
Claim

Assurance Assessment
  VERIFIES
Claim

Decision
  APPROVES
Baseline
```

Required relationship vocabulary includes:

* `DEFINES`
* `REFINES`
* `REALIZES`
* `ALLOCATED_TO`
* `SATISFIES`
* `CONSTRAINS`
* `DEPENDS_ON`
* `ASSUMES`
* `PRODUCES`
* `IMPLEMENTS`
* `VALIDATES`
* `SUPPORTS`
* `CONTRADICTS`
* `APPROVES`
* `SUPERSEDES`
* `IMPACTS`
* `DERIVED_FROM`

Relationships must remain typed and traceable. Generic untyped links are insufficient for authoritative reasoning.

---

# 7. Product Realization PWA Root Work Structure

The Product Realization PWA defines this root PWU Type:

```text
Product Realization PWU Type
```

Its purpose is:

> Produce an implemented and assured software outcome that satisfies the approved Product Intent.

The standard semantic decomposition is:

```text
Product Realization PWU Type
├── Intent and Product Definition PWU Type
├── Product Behavior Definition PWU Type
├── Architecture Definition PWU Type
├── Implementation Planning PWU Type
├── Product Implementation PWU Type
├── Integrated Product Validation PWU Type
└── Product Baseline Promotion PWU Type
```

This hierarchy describes reusable semantic composition in the PWA. When the PWA is instantiated as an Undertaking, each required node becomes a concrete PWU Instance in that Undertaking's Professional Work Graph.

It does not require that every child execute strictly in sequence.

For example:

* architecture analysis may expose missing product requirements;
* implementation planning may trigger architecture revision;
* validation may create new implementation PWU Instances;
* historical assurance may operate across several PWU Instances;
* human governance may occur at multiple points.

---

# 8. PWU Type: Product Realization

## Purpose

Govern the full transformation from Product Intent to accepted software baseline.

## Inputs

* user’s originating expression;
* workspace and repository context;
* organizational policy;
* applicable professional ontology version;
* available runtime capabilities.

## Expected outputs

* approved Product Intent;
* product definition;
* behavior and journey model;
* architecture baseline;
* implementation plan;
* implemented product artifacts;
* integrated validation evidence;
* authoritative product baseline.

## Principal completion claim

> The promoted product baseline satisfies the approved Product Intent within its authorized boundaries and residual uncertainty.

## Required evidence

* intent approval;
* requirement and journey coverage;
* architecture evidence;
* implementation artifacts;
* test and validation evidence;
* unresolved-risk disposition;
* baseline-promotion decision.

## Standard child PWU Types

* Intent and Product Definition
* Product Behavior Definition
* Architecture Definition
* Implementation Planning
* Product Implementation
* Integrated Product Validation
* Product Baseline Promotion

## Recomposition rule

A root PWU Instance of this type may be satisfied only when:

* each mandatory child obligation is satisfied, waived, or superseded;
* integrated validation supports the root completion claim;
* no unresolved blocking assurance observations remain;
* an authorized baseline-promotion decision exists.

---

# 9. PWU Type: Intent and Product Definition

## Purpose

Convert the user’s expression into an explicit and governable Product Intent.

## Candidate child PWU Types

```text
Intent and Product Definition PWU Type
├── Intent Discovery PWU Type
├── Product Boundary PWU Type
├── Stakeholder Discovery PWU Type
├── Business Domain Discovery PWU Type
├── Desired Outcome Definition PWU Type
├── Constraint Discovery PWU Type
├── Non-Goal Definition PWU Type
└── Intent Baseline Assembly PWU Type
```

## Required outputs

* formalized objective;
* desired outcomes;
* product boundary;
* non-goals;
* stakeholders;
* known business domains;
* mandatory constraints;
* ambiguities;
* material assumptions;
* success conditions;
* approved or provisional Intent Baseline.

## Principal claims

* the Product Intent faithfully represents the user’s request;
* material ambiguity has been surfaced;
* major stakeholders and constraints have been identified;
* the product boundary is sufficiently clear for subsequent shaping;
* success conditions are meaningful and testable where possible.

## Key assurance policies

* Intent Fidelity
* Intent Completeness
* Ambiguity Disclosure
* Constraint Discovery
* Stakeholder Coverage
* Non-Goal Explicitness
* Human Intent Approval

---

# 10. PWU Type: Intent Discovery

## Purpose

Discover what the user is actually trying to achieve, including needs not fully captured by the initial wording.

## Required inputs

* originating expression;
* dialogue history;
* provided files and links;
* known organizational context;
* existing product or repository context.

## Expected outputs

* candidate formalized intent;
* open questions;
* competing interpretations;
* desired outcomes;
* material assumptions;
* provisional boundaries.

## Required behavior

A PWU Instance of this type must distinguish:

* user-stated facts;
* inferred needs;
* proposed interpretation;
* unresolved ambiguity;
* optional enhancement;
* imposed technical solution.

The system must not silently substitute an inferred solution for the user’s intent.

## Assurance considerations

The applicable Assurance Policy, through a conforming validator implementation, should specifically check for:

* solution substitution;
* premature architecture;
* omission of inconvenient constraints;
* conversion of preferences into requirements;
* unsupported assumptions;
* scope expansion disguised as helpfulness.

---

# 11. PWU Type: Product Behavior Definition

## Purpose

Define how actors, capabilities, journeys, scenarios, entities, and integrations collectively realize Product Intent.

## Candidate child PWU Types

```text
Product Behavior Definition PWU Type
├── Actor Definition PWU Type
├── Capability Definition PWU Type
├── User Journey Definition PWU Type
├── Scenario Definition PWU Type
├── Requirement Definition PWU Type
├── Domain Entity Definition PWU Type
├── Integration Requirement PWU Type
└── Acceptance Model Definition PWU Type
```

## Required outputs

* actor catalog;
* capability map;
* user journeys;
* normal and exceptional scenarios;
* requirements;
* domain entities and relationships;
* integration needs;
* acceptance criteria;
* unresolved behavior questions.

## Principal completion claim

> The defined product behavior is sufficient to guide architecture and implementation without losing the approved Product Intent.

## Key assurance policies

* Actor Coverage
* Journey Completeness
* Scenario Diversity
* Requirement Traceability
* Requirement Consistency
* Requirement Testability
* Entity-Journey Consistency
* Integration Boundary Completeness
* Acceptance-Criteria Coverage

---

# 12. PWU Type: User Journey Definition

## Purpose

Describe how an actor pursues an outcome through interaction with the product and related systems.

## Required fields

* journey identity;
* originating outcome;
* primary actor;
* supporting actors;
* trigger;
* preconditions;
* steps;
* decisions;
* alternate paths;
* exceptional paths;
* completion condition;
* failure condition;
* affected entities;
* required capabilities;
* evidence of success.

## Minimum scenario classes

For material journeys:

* normal path;
* alternate valid path;
* user-error path;
* system-failure path;
* permission-denied path;
* interrupted or resumed path;
* data-unavailable path;
* cancellation path.

Not every journey requires every class, but inapplicability must be explicit.

## Assurance policies

* Journey-to-Intent Traceability
* Journey Outcome Preservation
* Alternate-Path Coverage
* Failure-Path Coverage
* Actor Authorization
* State Continuity
* Accessibility and Usability where applicable

---

# 13. PWU Type: Requirement Definition

## Purpose

Convert approved intent and behavior into explicit obligations that can be allocated, implemented, and verified.

## Requirement types

* functional;
* quality;
* security;
* privacy;
* data;
* interface;
* performance;
* operational;
* deployment;
* migration;
* observability;
* compliance;
* maintainability;
* usability.

## Required properties

* statement;
* rationale;
* authority;
* source intent or journey;
* priority;
* applicability;
* verification method;
* affected artifacts;
* dependencies;
* conflict status;
* lifecycle.

## Requirement quality rules

A requirement should be:

* necessary;
* unambiguous enough for its risk level;
* bounded;
* traceable;
* internally consistent;
* feasible or explicitly exploratory;
* verifiable;
* expressed independently of a specific implementation unless the implementation is itself constrained.

## Assurance policies

* Requirement Necessity
* Requirement Atomicity
* Requirement Ambiguity
* Requirement Feasibility
* Requirement Conflict
* Requirement Verification Readiness
* Requirement Coverage
* Requirement Over-Specification

---

# 14. PWU Type: Architecture Definition

## Purpose

Define a coherent technical structure capable of realizing the approved product behavior within applicable constraints.

## Candidate child PWU Types

```text
Architecture Definition PWU Type
├── System Context PWU Type
├── Architecture Driver PWU Type
├── Component Architecture PWU Type
├── Data Architecture PWU Type
├── Integration Architecture PWU Type
├── Security Architecture PWU Type
├── Deployment Architecture PWU Type
├── Observability Architecture PWU Type
├── Operational Resilience PWU Type
└── Architecture Decision Consolidation PWU Type
```

Applicability is determined by project risk and scope.

## Required inputs

* approved Product Intent;
* product behavior model;
* requirements;
* repository and existing-system context;
* technical constraints;
* organizational policies;
* historical decisions;
* runtime and deployment environment.

## Required outputs

* system boundary;
* component model;
* interfaces;
* data ownership and lifecycle;
* integration model;
* security model;
* deployment topology;
* operational assumptions;
* architecture decisions;
* implementation constraints;
* architecture risks;
* architecture baseline candidate.

## Principal claims

* architecture covers applicable requirements;
* major components have coherent responsibilities;
* interfaces are sufficiently defined;
* security and operational concerns are addressed proportionally;
* dependencies are explicit;
* architecture is feasible;
* architecture preserves Product Intent;
* known tradeoffs are explicit.

## Key assurance policies

* Architecture Coverage
* Architecture Consistency
* Architecture Feasibility
* Separation of Concerns
* Interface Completeness
* Data Ownership Integrity
* Security Architecture
* Operational Resilience
* Observability Sufficiency
* Historical Decision Consistency
* Architecture-to-Intent Preservation

---

# 15. PWU Type: Architecture Decision

An architecture decision is a Professional Work Object and may require a supporting PWU Instance when the decision is material.

## Required content

* decision question;
* context;
* alternatives;
* constraints;
* evaluation criteria;
* selected option;
* rejected options;
* tradeoffs;
* consequences;
* assumptions;
* evidence;
* authority;
* review conditions.

## Assurance policies

* Alternative Adequacy
* Decision Rationale Sufficiency
* Constraint Compatibility
* Evidence Adequacy
* Reversibility Assessment
* Historical Consistency
* Decision Authority

A decision must not be represented merely as text embedded in an architecture document when it materially affects downstream work.

---

# 16. PWU Type: Implementation Planning

## Purpose

Transform approved product and architecture shape into actionable implementation PWU Instances and execution strategies.

## Candidate child PWU Types

```text
Implementation Planning PWU Type
├── Product Increment Definition PWU Type
├── Work Decomposition PWU Type
├── Dependency Analysis PWU Type
├── Repository Impact Analysis PWU Type
├── Risk and Assumption Analysis PWU Type
├── Test Strategy PWU Type
├── Migration Strategy PWU Type
├── Rollback Strategy PWU Type
└── Execution Plan Definition PWU Type
```

## Required outputs

* implementation PWU Instance hierarchy;
* decomposition contract;
* dependency graph;
* candidate execution plans;
* runtime capability requests;
* test strategy;
* migration and rollback requirements;
* risks;
* assumptions;
* sequencing constraints;
* human approval requirements.

## Principal claims

* proposed work covers the approved increment;
* decomposition preserves parent obligations;
* dependencies are explicit;
* implementation is feasible;
* assurance requirements are allocated;
* rollback and recovery are sufficient for risk;
* execution plans do not silently change product semantics.

## Key assurance policies

* Decomposition Coverage
* Constraint Propagation
* Dependency Completeness
* Assumption Disclosure
* Plan Feasibility
* Test-Strategy Adequacy
* Migration Safety
* Rollback Sufficiency
* Scope Integrity
* Architecture Conformance

---

# 17. PWU Type: Work Decomposition

## Purpose

Create bounded child PWU Instances that collectively satisfy a parent PWU Instance's obligation.

## Required outputs

* child PWU Instances;
* obligation allocations;
* constraint propagation;
* assumption propagation;
* sibling dependencies;
* recomposition contract;
* coverage claims;
* retained parent obligations.

## Decomposition quality attributes

### Coverage

Do the children collectively address the parent obligation?

### Cohesion

Does each child represent a coherent professional responsibility?

### Coupling

Are avoidable dependencies minimized?

### Granularity

Is each child small enough to execute and assure but large enough to remain meaningful?

### Boundary clarity

Are responsibilities and exclusions explicit?

### Recomposition feasibility

Can assured child outputs be integrated into a parent result?

### Traceability

Can each child explain why it exists?

## Assurance policies

* Parent Obligation Coverage
* Constraint Propagation
* Child Cohesion
* Excessive Coupling
* Granularity Fitness
* Missing Dependency
* Overlapping Responsibility
* Recomposition Feasibility
* Intent Preservation Through Decomposition

---

# 18. PWU Type: Product Implementation

## Purpose

Produce source code, configuration, tests, documentation, migrations, and related product artifacts.

## Candidate child PWU Instances

Children are generated from the approved implementation decomposition and may include:

* feature implementation;
* API implementation;
* user-interface implementation;
* data-model implementation;
* integration implementation;
* security control implementation;
* test implementation;
* migration implementation;
* documentation;
* deployment configuration.

## Required inputs

* approved PWU Instance shape;
* requirements;
* architecture;
* constraints;
* execution plan;
* runtime bindings;
* context policy;
* test strategy.

## Expected outputs

* product artifacts;
* implementation evidence;
* test results;
* execution traces;
* newly discovered assumptions;
* deviations;
* updated risks;
* completion claims.

## Required execution behavior

Implementation agents may propose:

* reshaping;
* new child PWU Instances;
* additional constraints;
* architecture revision;
* clarification;
* alternative plans.

They may not silently change authoritative intent, requirements, or architecture.

## Key assurance policies

* Implementation Scope Conformance
* Requirement Satisfaction
* Architecture Conformance
* Boundary Compliance
* Code Quality
* Test Evidence Sufficiency
* Security Control Conformance
* Migration Correctness
* Documentation Adequacy
* Unsupported-Assumption Detection

---

# 19. PWU Type: Integrated Product Validation

## Purpose

Establish justified confidence that the implemented product satisfies Product Intent and is suitable for baseline promotion.

## Candidate child PWU Types

```text
Integrated Product Validation PWU Type
├── Requirement Verification PWU Type
├── Journey Validation PWU Type
├── Architecture Conformance PWU Type
├── Integration Validation PWU Type
├── Regression Validation PWU Type
├── Security Validation PWU Type
├── Operational Validation PWU Type
├── Migration Validation PWU Type
├── Fitness-for-Purpose PWU Type
└── Evidence Package Assembly PWU Type
```

## Principal claims

* applicable requirements are satisfied;
* critical journeys work as intended;
* architecture constraints are preserved;
* integrations behave correctly;
* regressions are within acceptable bounds;
* security and operational controls are adequate;
* migration and rollback behavior are acceptable;
* unresolved uncertainty is disclosed;
* the result serves the originating Product Intent.

## Important rule

Integrated Product Validation must not be reduced to test execution.

Tests provide evidence.

Validation evaluates whether the total evidence supports product-level claims.

## Key assurance policies

* Requirement Verification
* Journey Outcome Validation
* Integration Correctness
* Regression Adequacy
* Security Assurance
* Operational Readiness
* Migration Assurance
* Evidence Completeness
* Fitness for Purpose
* Intent Preservation
* Residual Uncertainty Disclosure

---

# 20. PWU Type: Product Baseline Promotion

## Purpose

Determine whether a candidate set of product artifacts should become an authoritative baseline.

## Required inputs

* candidate artifacts;
* approved intent;
* requirements;
* architecture baseline;
* implementation evidence;
* validation assessments;
* open observations;
* waivers;
* residual uncertainty;
* release or deployment constraints.

## Required outputs

* evidence package;
* promotion recommendation;
* governance decision;
* authoritative or rejected baseline;
* residual-risk record;
* supersession relationships.

## Principal promotion claim

> The candidate baseline is sufficiently supported by evidence and governance to serve as the authoritative product state for its declared purpose.

## Promotion conditions

* no unresolved critical finding;
* blocking findings resolved or authorized through waiver;
* required assessments complete;
* baseline items identified and immutable;
* decision authority valid;
* promoted version matches reviewed version;
* rollback or recovery exists where required;
* residual uncertainty accepted.

## Key assurance policies

* Evidence Package Completeness
* Version Integrity
* Open-Finding Disposition
* Waiver Validity
* Decision Authority
* Baseline Consistency
* Promotion Readiness

---

# 21. Artifact Type Catalog

The Product Realization PWA defines standard artifact types.

## Intent artifacts

* originating request;
* Product Intent;
* product boundary;
* stakeholder catalog;
* constraint catalog;
* non-goal catalog.

## Behavior artifacts

* capability map;
* actor catalog;
* user journeys;
* scenarios;
* requirements;
* acceptance criteria;
* domain model;
* integration catalog.

## Architecture artifacts

* system context;
* component model;
* data architecture;
* interface specification;
* security architecture;
* deployment architecture;
* operational model;
* architecture decision record.

## Planning artifacts

* product increment;
* work decomposition;
* dependency graph;
* execution plan;
* test strategy;
* migration plan;
* rollback plan.

## Implementation artifacts

* source code;
* tests;
* schemas;
* configuration;
* migrations;
* documentation;
* deployment manifests;
* generated assets.

## Assurance artifacts

* claims;
* evidence;
* validator implementation reports;
* review findings;
* trace records;
* test results;
* coverage reports;
* residual-risk record.

## Governance artifacts

* approvals;
* waivers;
* rejection decisions;
* promotion decisions;
* baselines.

Artifacts must have:

* identity;
* provenance;
* content hash where applicable;
* semantic version;
* producing PWU Instance;
* applicable claims;
* status;
* supersession history.

---

# 22. Product Realization PWA Claim Catalog

The following claim types are standard.

## Intent claims

* Intent faithfully represents the user’s need.
* Product boundary is sufficiently explicit.
* Success conditions reflect desired outcomes.
* Material ambiguity is disclosed.

## Behavior claims

* Relevant actors are represented.
* Journeys cover major user outcomes.
* Requirements cover approved capabilities.
* Acceptance criteria are sufficient.
* Entity and integration definitions are coherent.

## Architecture claims

* Architecture covers applicable requirements.
* Architecture respects mandatory constraints.
* Components have coherent responsibilities.
* Interfaces are sufficiently defined.
* Security and operational needs are addressed.
* Architecture is feasible within known constraints.

## Planning claims

* Decomposition covers parent obligations.
* Dependencies are explicit.
* Execution plan is feasible.
* Test strategy is sufficient.
* Migration and rollback plans are proportionate.

## Implementation claims

* Implementation satisfies allocated requirements.
* Implementation conforms to architecture.
* Changes remain in scope.
* Tests demonstrate applicable behavior.
* No undisclosed material assumption governs the result.

## Validation claims

* Evidence is sufficient.
* Product behavior satisfies critical journeys.
* Regressions are acceptable.
* Security posture is adequate.
* Product is fit for the approved purpose.
* Intent has survived transformation.

## Promotion claims

* Candidate artifacts match reviewed artifacts.
* Required assurance is complete.
* Open findings are properly dispositioned.
* Decision authority is valid.
* Baseline is suitable for declared use.

---

# 23. Evidence Type Catalog

## Documentary evidence

* approved intent;
* requirement;
* architecture decision;
* policy;
* standard;
* repository history;
* prior baseline.

## Analytical evidence

* repository analysis;
* dependency analysis;
* static analysis;
* architecture analysis;
* threat analysis;
* impact analysis.

## Executable evidence

* unit test;
* integration test;
* end-to-end test;
* property test;
* model check;
* schema validation;
* build result;
* deployment test.

## Observational evidence

* runtime trace;
* log;
* metric;
* screenshot;
* user-observation record;
* performance measurement.

## Review evidence

* independent assessment;
* human review;
* specialist opinion;
* security review;
* historical comparison.

## Governance evidence

* approval;
* waiver;
* risk acceptance;
* promotion decision.

Every evidence item must declare:

* which claim it supports;
* what it does not establish;
* provenance;
* scope;
* validity;
* limitations.

---

# 24. Assurance Policy Structure

Every assurance policy assigned by the Product Realization PWA must define:

```text
Policy identity
Professional purpose
Applicable object types
Trigger conditions
Claims evaluated
Required evidence
Assessment criteria
Evaluator role
Independence requirement
Possible observations
Severity rules
Disposition rules
Remediation options
Escalation conditions
Waiver rules
Permitted controller actions
```

Validator prompts and deterministic validator implementations are runtime assets of the policy. They are not the policy itself.

## 24.1 Relationship to RPH-DOC-004 (composition, not conflict)

RPH-DOC-004 §15–§26 contracts twelve policies: the eleven specified in §25–§35 below, plus Constraint Propagation. That contract and this specification are one catalog expressed at two levels: they compose, and they never contradict.

* The `Blocking conditions` stated in §25–§35 below stand and decide severity. They are the referent of RPH-DOC-004's "blocking finding" language, which that contract uses without enumerating (for example its §15.9, and repeatedly in its §26).
* RPH-DOC-004 governs machine structure — the finding `CODE`s, criterion ids and names, and the twelfth policy, Constraint Propagation (its §20), for which it states its own blocking conditions because this specification has no section for it.
* The `Common findings` and `Common shape failures` in §25–§35 are illustrative and do not extend RPH-DOC-004's ratified `CODE` list.
* Where both documents state a rule, they agree (Intent Preservation: §32 below / §23.6 there). A future edit that makes them disagree is a corpus defect and must fail the conformance build.

— Recorded 2026-07-18 under the sponsor's authoring grant (§0.3 stop-rule gaps; labelled and committed). Derivation and evidence: `docs/_working/RULING-doc003-doc004-compose.md`.

---

# 25. Assurance Policy: Intent Fidelity

## Purpose

Determine whether formalized Product Intent faithfully represents the user’s originating expression and authorized clarifications.

## Targets

* Product Intent;
* intent baseline;
* root Product Realization PWU Instance.

## Claims evaluated

* objective fidelity;
* outcome fidelity;
* boundary fidelity;
* non-goal fidelity;
* constraint fidelity.

## Required evidence

* originating expression;
* clarification dialogue;
* formalized intent;
* user corrections;
* relevant supplied artifacts.

## Common findings

* solution substitution;
* scope expansion;
* omitted constraint;
* false precision;
* unsupported inferred need;
* conflicting interpretation;
* unacknowledged ambiguity.

## Independence

Different invocation from primary intent synthesizer.

High-assurance profile: different agent or model plus human approval.

## Blocking conditions

* formalized objective contradicts user expression;
* mandatory constraint omitted;
* major ambiguity hidden;
* inferred solution presented as user requirement.

## Control actions

* clarify;
* revise context;
* reshape intent;
* request human decision;
* reject intent baseline.

---

# 26. Assurance Policy: Intent Completeness

## Purpose

Determine whether enough of the Product Intent has been externalized to support downstream shaping.

## Evaluates

* desired outcomes;
* product boundary;
* actors and stakeholders;
* constraints;
* non-goals;
* success conditions;
* material ambiguities.

## Important distinction

Completeness is risk-relative.

The policy does not require exhaustive specification before useful work begins.

It determines whether the current shape is sufficient for the next authorized activity.

## Dispositions

* sufficient;
* conditionally sufficient;
* incomplete;
* exploratory approval required.

---

# 27. Assurance Policy: Assumption Disclosure

## Purpose

Identify premises that are material to the validity of professional work but are not established as facts or authorized decisions.

## Targets

* intent;
* requirements;
* architecture;
* plans;
* implementation;
* validation reasoning.

## Required outputs

* Assumption Objects;
* materiality;
* affected objects;
* basis;
* verification need;
* expiration condition;
* recommended action.

## Common findings

* unstated user behavior assumption;
* unsupported platform assumption;
* unverified external-system capability;
* implicit security assumption;
* unacknowledged scalability assumption;
* dependency availability assumption;
* scope assumption.

## Blocking conditions

A critical assumption governs irreversible or high-impact work without verification or authorized acceptance.

---

# 28. Assurance Policy: Requirement Coverage

## Purpose

Determine whether approved capabilities, journeys, constraints, and outcomes are represented by requirements.

## Required evidence

* approved Product Intent;
* capability map;
* journeys;
* requirements;
* trace links;
* explicit exclusions.

## Observations

* uncovered outcome;
* uncovered journey step;
* missing failure behavior;
* duplicate requirement;
* requirement without intent source;
* constraint without implementing obligation.

## Control actions

* add requirement;
* revise journey;
* revise product boundary;
* waive with authority;
* reshape affected PWU Instances.

---

# 29. Assurance Policy: Decomposition Coverage

## Purpose

Determine whether child PWU Instances collectively preserve the obligations of the parent PWU Instance.

## Required evidence

* parent obligations;
* child PWU Instances;
* allocation map;
* constraints;
* assumptions;
* dependencies;
* recomposition contract.

## Critical checks

* no mandatory obligation silently disappears;
* no mandatory constraint silently drops;
* each child has a clear purpose;
* retained parent obligations are explicit;
* sibling dependencies are represented;
* recomposition is feasible.

## Possible outcomes

* valid;
* conditionally valid;
* incomplete;
* over-fragmented;
* excessively coupled;
* semantically corrupted.

## Blocking conditions

* missing mandatory obligation;
* child work contradicts parent intent;
* no recomposition strategy;
* invalid authority or scope.

---

# 30. Assurance Policy: Architecture Coverage

## Purpose

Determine whether architecture adequately addresses applicable product obligations.

## Required evidence

* requirements;
* architecture elements;
* interfaces;
* deployment model;
* decision records;
* trace links.

## Common findings

* requirement with no architecture allocation;
* architecture element with unclear responsibility;
* integration boundary missing;
* data ownership ambiguous;
* deployment assumption hidden;
* security responsibility absent;
* observability omitted.

---

# 31. Assurance Policy: Historical Consistency

## Purpose

Compare proposed work against relevant prior decisions, failures, constraints, and organizational memory.

## Required evidence

* historical decisions;
* narrative memories;
* prior architecture;
* incident records;
* previous assurance findings produced through validator implementations;
* superseded baselines.

## Evaluation questions

* Does this repeat a known failure?
* Does this contradict an active decision?
* Is a previous constraint still applicable?
* Is divergence intentional and justified?
* Is the precedent stale or contextually different?

## Important rule

Historical difference is not itself a defect.

Unexplained or uninformed difference may be.

## Outputs

* relevant precedent;
* similarity;
* difference;
* applicability assessment;
* recommended explanation or control action.

---

# 32. Assurance Policy: Intent Preservation

## Purpose

Determine whether a descendant PWU Instance, artifact, or completed product still serves the originating Product Intent.

## Applicable points

* after decomposition;
* after architecture;
* after implementation planning;
* after implementation;
* during integrated validation;
* before baseline promotion.

## Required evidence

* approved intent;
* relevant intermediate shapes;
* current artifact;
* traceability;
* decisions and waivers;
* change history.

## Common shape failures

* scope expansion;
* lost outcome;
* weakened constraint;
* implementation substitution;
* locally correct but globally irrelevant result;
* child objective divergence;
* test success without user-value satisfaction.

## Blocking conditions

Material divergence without authorized intent revision.

---

# 33. Assurance Policy: Test Adequacy

## Purpose

Determine whether the test strategy and evidence are sufficient for the claims being made.

## Evaluation dimensions

* requirement coverage;
* journey coverage;
* failure-path coverage;
* integration coverage;
* regression scope;
* boundary-value coverage;
* test independence;
* environment fidelity;
* determinism;
* evidence freshness.

## Important rule

Test count is not test adequacy.

Passing tests support only the claims within their scope.

---

# 34. Assurance Policy: Fitness for Purpose

## Purpose

Determine whether the completed product is suitable for the actual user outcome, not merely internally consistent or technically correct.

## Inputs

* Product Intent;
* critical journeys;
* acceptance criteria;
* implementation;
* integrated evidence;
* known limitations;
* residual uncertainty.

## Questions

* Can intended users achieve the desired outcome?
* Are critical constraints preserved?
* Are known limitations acceptable?
* Does the result solve the intended problem?
* Has technical success obscured product failure?
* Are material user or operational conditions missing?

## Independence

Standard profile: independent validator implementation.

High-assurance profile: independent validator implementation plus human product review.

---

# 35. Assurance Policy: Baseline Promotion

## Purpose

Determine whether a candidate product state may become authoritative.

## Required evidence

* approved Product Intent;
* applicable baselines;
* validation package;
* open findings;
* waivers;
* exact candidate artifact identities;
* authority;
* rollback or recovery where required.

## Blocking conditions

* candidate differs from reviewed version;
* unresolved critical observation;
* expired waiver;
* invalidated evidence;
* missing authority;
* contested root completion claim;
* unacknowledged residual risk.

---

# 36. Role Model

The Product Realization PWA defines professional responsibilities, not fixed model bindings.

## Technical Expert

Responsibilities:

* intent discovery;
* clarification;
* product reasoning;
* explanation;
* shaping support.

Authority:

* may propose intent;
* may not approve user intent unless delegated.

## Product Modeler

Responsibilities:

* actors;
* journeys;
* capabilities;
* requirements;
* domain entities;
* acceptance criteria.

## Architect

Responsibilities:

* system structure;
* interfaces;
* decisions;
* technical constraints;
* architecture evidence.

## Planner

Responsibilities:

* decomposition;
* dependencies;
* execution strategy;
* risk and rollback planning.

## Maker

Responsibilities:

* implementation;
* code and artifact production;
* execution evidence;
* disclosure of discovered assumptions and deviations.

## Verifier

Responsibilities:

* evidence gathering;
* claim evaluation;
* contradiction detection;
* assurance assessment.

## Historian-Interpreter

Responsibilities:

* retrieve relevant precedent;
* evaluate historical applicability;
* identify unexplained divergence or recurrence.

## Hypothesizer

Responsibilities:

* generate plausible failure hypotheses;
* challenge evidence;
* identify untested conditions;
* propose discriminating checks.

## Human Governor

Responsibilities:

* approve intent;
* resolve ambiguity;
* accept risk;
* grant waiver;
* approve material shape changes;
* promote baseline.

Role assignment is a Harness Engineering concern. Role responsibility and independence are ontology concerns.

---

# 37. Context Policy Defaults

Each PWU Type defines default context classes.

## Intent PWU Types

Include:

* user expression;
* dialogue;
* supplied documents;
* known constraints;
* current product state.

Exclude by default:

* speculative implementation detail;
* unrelated repository history;
* unverified external claims.

## Architecture PWU Types

Include:

* approved intent;
* requirements;
* journeys;
* existing architecture;
* repository structure;
* technical constraints;
* relevant historical decisions.

## Implementation PWU Types

Include:

* allocated requirements;
* relevant architecture;
* target files;
* dependencies;
* tests;
* constraints;
* open assumptions;
* applicable assurance observations.

## Assurance assessments

Include:

* claim;
* applicable policy;
* evidence;
* subject artifact;
* relevant intent and constraints;
* producer provenance;
* prior findings where relevant.

Context must be selected by relationship to the work, not only semantic similarity.

---

# 38. Decomposition Rules

## 38.1 Decompose by professional responsibility

Prefer children representing coherent obligations over generic activity labels.

Prefer:

```text
Authentication Architecture PWU Type
```

over:

```text
Analyze
Design
Write
Review
```

The latter are execution steps.

## 38.2 Preserve semantic inheritance

Every child must inherit or reference:

* relevant intent;
* allocated obligations;
* constraints;
* assumptions;
* required evidence;
* parent relationship.

## 38.3 Avoid premature decomposition

Do not decompose when:

* parent intent is too ambiguous;
* boundaries are unstable;
* constraints are unknown;
* decomposition would create false precision.

## 38.4 Permit recursive discovery

A PWU Instance may create discovery child PWU Instances when the required shape is not yet known.

## 38.5 Require recomposition strategy

A decomposition is incomplete until it explains how child results will establish the parent claim.

---

# 39. Recomposition Rules

Recomposition must evaluate:

* child completion state;
* child assurance state;
* unresolved findings;
* obligation coverage;
* constraint preservation;
* artifact compatibility;
* contradictions;
* missing integration evidence;
* parent-level fitness.

The following is invalid:

```text
All children completed
therefore parent satisfied.
```

The valid reasoning is:

```text
Required children produced assured outputs
+ outputs are mutually compatible
+ parent constraints remain satisfied
+ combined evidence supports parent claim
therefore parent may be satisfied.
```

---

# 40. Product Realization PWA Profiles

The Product Realization PWA defines standard profiles that an Undertaking may select at instantiation or adopt through a governed PWA version migration.

## Exploratory Product Shape

Used when the user is still discovering the problem.

Characteristics:

* provisional intent;
* competing hypotheses;
* lightweight architecture;
* reversible experiments;
* explicit uncertainty;
* no production baseline claim.

## Feature Delivery Shape

Used for ordinary product features.

Characteristics:

* approved intent;
* journeys and requirements;
* architecture impact;
* implementation PWU Instances;
* tests;
* integrated validation;
* baseline promotion.

## Brownfield Change Shape

Used for existing systems.

Additional requirements:

* existing-structure inquiry;
* dependency analysis;
* historical rationale;
* change impact;
* regression evidence;
* compatibility constraints;
* Chesterton’s Fence assurance.

## Migration Shape

Additional requirements:

* source and target state;
* data transformation;
* cutover strategy;
* rollback;
* reconciliation;
* integrity evidence;
* operational monitoring.

## High-Assurance Shape

Additional requirements:

* independent verification;
* stricter authority;
* stronger evidence;
* policy conformance;
* explicit residual risk;
* immutable evidence package.

---

# 41. Product Realization PWA Controller Defaults

The ontology supplies recommended controller responses.

## Missing intent information

Preferred actions:

* clarify;
* gather context;
* create ambiguity object;
* block high-impact work.

## Material assumption discovered

Preferred actions:

* create Assumption Object;
* assess materiality;
* verify or seek acceptance;
* perform impact analysis.

## Validator recommendation of rejection

Preferred actions:

* gather evidence;
* retry with changed strategy;
* reshape affected PWU Instance;
* revise decomposition;
* escalate.

## Architecture-implementation conflict

Preferred actions:

* determine whether architecture or implementation is wrong;
* do not automatically force implementation conformance;
* create decision if architecture must change;
* invalidate affected approvals and evidence.

## Repeated non-convergence

Preferred actions:

* stop local retries;
* broaden search;
* change model or role;
* revise context;
* challenge assumptions;
* escalate.

## Intent drift

Preferred actions:

* mark Shape Integrity `AT_RISK` or `VIOLATED`;
* suspend affected irreversible work;
* identify first divergence;
* reshape;
* obtain authority for intent revision if appropriate.

---

# 42. Human Governance Points

The Product Realization PWA should support policy-triggered governance rather than one universal legacy `REVIEW` phase.

Candidate decision points include:

* Intent approval;
* Product boundary approval;
* Architecture approval;
* Critical assumption acceptance;
* High-impact plan approval;
* Security exception;
* Scope change;
* Waiver;
* Irreversible migration;
* Residual-risk acceptance;
* Baseline promotion.

Each governance point must define:

* decision authority;
* subject;
* evidence package;
* allowed dispositions;
* conditions;
* expiration;
* invalidation triggers.

---

# 43. Compatibility Mapping from the Legacy Product Lens

| Legacy phase         | Product Realization PWA interpretation                      |
| -------------------- | ----------------------------------------------------------- |
| INTAKE               | Intent and Product Definition PWU Instances                 |
| ARCHITECTURE         | Architecture Definition PWU Instance hierarchy              |
| PROPOSE              | Implementation Planning PWU Instances and candidate Execution Plan |
| ASSUMPTION_SURFACING | Assumption Disclosure Assurance Policy                     |
| VERIFY               | Claim-specific Assurance Assessments and verification PWU Instances |
| HISTORICAL_CHECK     | Historical Consistency Assurance Policy                    |
| REVIEW               | Policy-triggered Governance Decisions                      |
| EXECUTE              | Product Implementation PWU Instances and Execution Plans    |
| VALIDATE             | Integrated Product Validation PWU Instances and Assurance Policies |
| COMMIT               | Repository Commit Artifact operation plus separate Product Baseline Promotion governance |
| REPLAN               | Controller action that revises shape or execution strategy |

The initial migration may preserve the visible milestone sequence while using this ontology underneath.

---

# 44. Minimum Product Realization PWA Package

The initial Product Realization PWA release should contain:

## PWU Types

* Product Realization
* Intent and Product Definition
* Intent Discovery
* Product Boundary
* Product Behavior Definition
* User Journey Definition
* Requirement Definition
* Architecture Definition
* Architecture Decision
* Implementation Planning
* Work Decomposition
* Product Implementation
* Integrated Product Validation
* Product Baseline Promotion

## Assurance policies

* Intent Fidelity
* Intent Completeness
* Assumption Disclosure
* Requirement Coverage
* Requirement Quality
* Journey Coverage
* Decomposition Coverage
* Constraint Propagation
* Architecture Coverage
* Architecture Consistency
* Historical Consistency
* Intent Preservation
* Implementation Scope Conformance
* Test Adequacy
* Fitness for Purpose
* Evidence Package Completeness
* Baseline Promotion

## Artifact schemas

* Product Intent
* User Journey
* Requirement
* Domain Entity
* Integration Definition
* Architecture Description
* Architecture Decision
* Execution Plan
* Test Strategy
* Product Artifact
* Assurance Assessment
* Evidence Package
* Baseline

## Role defaults

* Technical Expert
* Product Modeler
* Architect
* Planner
* Maker
* Verifier
* Historian-Interpreter
* Hypothesizer
* Human Governor

---

# 45. PWA Validation Rules

A Product Realization PWA package is valid only if:

1. Every PWU Type defines purpose, inputs, outputs, claims, evidence, and assurance defaults.
2. Every artifact type has identity, provenance, versioning, and producing relationships.
3. Every assurance policy identifies claims and evidence.
4. Every mandatory root obligation can be allocated through available PWU Types.
5. Every decomposition pattern has a recomposition rule.
6. Every human decision identifies authority.
7. Every baseline type identifies promotion requirements.
8. Runtime roles are not hardcoded into work identity.
9. Execution order is not embedded as the only ontology representation.
10. Product-level validation includes Intent Preservation and Fitness for Purpose.

---

# 46. Product Realization PWA Acceptance Criteria

The Product Realization PWA is ready for implementation when:

* the legacy Product Lens behavior can be represented without authoritative phase semantics;
* the Product Realization PWU Type can be instantiated as a complete root PWU Instance within an Undertaking;
* each legacy phase maps to canonical PWU Types, instantiated PWU Instances, assurance policies, governance, or control operations;
* Product Intent can be traced to requirements, PWU Instances, artifacts, claims, evidence, and baseline;
* decomposition coverage can be evaluated;
* assumptions are first-class;
* architecture decisions are explicit;
* implementation execution and assurance remain independent;
* validation can reject a technically successful implementation;
* historical findings include provenance;
* baseline promotion requires evidence and authority;
* the same ontology can support more than one execution strategy;
* the workbench can project Work, Execution, Assurance, and Traceability views from the same objects.

---

# 47. Initial Implementation Sequence

## Step 1: Encode the ontology package

Create versioned TypeScript and JSON Schema definitions for:

* Product Realization PWA concepts;
* PWU Types;
* artifact templates;
* assurance policies;
* decomposition rules;
* role defaults.

## Step 2: Instantiate the first Product Realization fixture

Use a representative software-product request and create:

* Product Intent;
* journey;
* requirements;
* architecture;
* implementation PWU Instances;
* claims;
* evidence;
* decisions;
* baseline.

## Step 3: Map current roles and prompts

Bind legacy Product Lens roles and prompts to the relevant PWU Types, PWU Instances, and assurance policies without making the legacy roles or prompts canonical.

## Step 4: Implement policy applicability

Determine which assurance policies activate for each PWU Type, PWU Instance, and risk profile.

## Step 5: Implement Work and Assurance projections

Render the fixture and current execution state.

## Step 6: Run compatibility execution

Use the legacy Product Lens sequence as an Execution Plan over the Product Realization PWA and the Undertaking's instantiated Professional Work Graph.

## Step 7: Measure conformance

Verify:

* intent preservation;
* obligation coverage;
* assumption disclosure;
* assurance completeness;
* human authority;
* baseline traceability.

---

# 48. Open Questions

The following should remain explicit during implementation:

1. Which Product Realization PWA concepts require separate database tables versus PWA extensions?
2. How should competing product interpretations be represented?
3. When does a product requirement become authoritative?
4. Which assurance policies are mandatory at each risk profile?
5. How should product-quality claims be scoped?
6. Which historical memories are admissible as evidence?
7. How should user preference differ from mandatory constraint?
8. How should product baselines relate to Git commits, branches, and releases?
9. What constitutes sufficient journey coverage?
10. When may the system automatically accept low-risk assumptions?
11. Which role combinations satisfy validator-implementation independence?
12. How much ontology editing should be exposed through the first workbench?
13. How should Product Realization PWU Types evolve without invalidating existing Undertakings?
14. How should ontology changes trigger revalidation?

---

# 49. Closing Definition

The Product Realization PWA is the reusable professional-work architecture through which Janumi Professional Workbench understands software-product-realization work.

It defines the concepts, work units, artifacts, claims, evidence, assurance policies, and governance structures required to transform user intent into an authoritative software outcome.

The Product Realization PWA does not prescribe one fixed Execution Workflow.

It gives professional work a shape that multiple execution strategies can act upon while the Recursive Professional Harness preserves intent, collects evidence, detects drift, revises invalid structures, and prevents unsupported work from being accepted merely because an agent completed its assigned steps.

The legacy hardcoded Product Lens demonstrated that reliable agentic software development requires more than generation and execution.

This ontology makes those requirements explicit, reusable, governable, and executable.
