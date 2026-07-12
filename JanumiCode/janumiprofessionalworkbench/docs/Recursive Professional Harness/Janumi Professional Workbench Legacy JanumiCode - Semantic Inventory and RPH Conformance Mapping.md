# Janumi Professional Workbench Legacy JanumiCode Semantic Inventory and Product Realization PWA Conformance Mapping

## Current-State Analysis, Canonical Encoding, Gap Register, and Initial Vertical-Slice Backlog

**Document ID:** `RPH-DOC-005`
**Status:** Initial migration baseline
**Target system:** Janumi Professional Workbench VS Code extension
**Migration source:** Legacy hardcoded Product Lens Execution Workflow
**Target architecture:** Recursive Professional Harness
**Primary abstractions:** Professional Work Objects, Professional Work Units, Shape Engineering, Assurance Engineering, Loop Engineering, and Harness Engineering

---

# 1. Purpose

This document establishes the bridge between the legacy Janumi Professional Workbench Product Lens and the Product Realization PWA implemented on the Recursive Professional Harness architecture.

It answers four implementation questions:

1. What does the legacy Product Lens currently do?
2. How should that behavior be represented by the Product Realization PWA using canonical RPH objects?
3. What behavior or semantics remain missing, ambiguous, or coupled?
4. What is the smallest implementation slice that can prove the new architecture?

This document does not assume that every existing legacy phase should survive unchanged.

The migration must distinguish among:

* essential professional semantics;
* essential execution behavior;
* existing assurance behavior;
* user-governance behavior;
* compatibility requirements;
* implementation artifacts caused by the current hardcoded orchestrator.

The goal is not to reproduce the switch statement in a database.

The goal is to preserve the value of the legacy Product Lens while replacing its legacy-phase-centric architecture with the Product Realization PWA and an intent-centered, recursively structured, evidence-backed model of professional work.

Canonical naming in this document distinguishes reusable definitions from concrete work. The Product Realization PWA contains PWU Types; an Undertaking binds to a PWA version and contains PWU Instances. `Product Lens`, phase codes, dialogue records, Workflow Canvas labels, and validator names are retained only when this document inventories a legacy source contract or a compatibility projection.

---

# 2. Source Confidence Model

The present inventory is based on the supplied legacy Execution Workflow description and earlier feature specification, not a complete code-level audit.

Every finding is assigned one of three confidence levels.

## 2.1 Confirmed

Explicitly described in the supplied legacy Product Lens summary or legacy Workflow Canvas document.

## 2.2 Strongly inferred

Required or strongly suggested by the described behavior, but not yet verified against implementation code and persistence.

## 2.3 Discovery required

Cannot be safely determined without inspecting:

* source code;
* prompts;
* database tables;
* role implementations;
* legacy validator implementations;
* event handling;
* error handling;
* representative execution traces.

The Stage 0 implementation must replace inferred descriptions with code-grounded contracts before migration.

---

# 3. Legacy Product Lens at a Glance

The legacy Product Lens contains eleven top-level compatibility phases:

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
→ REPLAN
```

The legacy orchestrator dispatches legacy phase-specific functions from a central switch statement and stores legacy workflow state in the database.

The system is described as:

* hardcoded;
* predominantly sequential;
* role-based;
* gate-driven;
* stateful;
* assisted by legacy validator implementations;
* capable of human review and replanning.

INTAKE has its own internal substate model:

```text
DISCUSSING
SYNTHESIZING
AWAITING_APPROVAL
INTENT_DISCOVERY
PRODUCT_REVIEW
PROPOSING
CLARIFYING
```

These labels currently combine several different semantic categories:

* interaction mode;
* professional activity;
* execution state;
* governance state;
* control operation.

That conflation is one of the principal migration targets.

---

# 4. High-Level Semantic Interpretation

The legacy phase sequence appears linear, but its semantic structure is approximately:

```text
User intent
    ↓
Intent discovery and product shaping
    ↓
Architecture shaping
    ↓
Implementation proposal
    ↓
Assumption and claim assurance
    ↓
Historical assurance
    ↓
Human governance
    ↓
Implementation execution
    ↓
Integrated assurance
    ↓
Baseline promotion
```

`REPLAN` is not a canonical work unit or terminal structure. It is a legacy phase label for a control response that can be triggered when work, execution, or assurance indicates that the current plan is no longer valid.

A useful reclassification is:

| Legacy phase         | Dominant architectural concern                |
| -------------------- | --------------------------------------------- |
| INTAKE               | Shape Engineering                             |
| ARCHITECTURE         | Shape Engineering                             |
| PROPOSE              | Shape Engineering plus Loop Engineering       |
| ASSUMPTION_SURFACING | Assurance Engineering                         |
| VERIFY               | Assurance Engineering                         |
| HISTORICAL_CHECK     | Assurance Engineering and Context Engineering |
| REVIEW               | Governance                                    |
| EXECUTE              | Loop and Harness Engineering                  |
| VALIDATE             | Assurance Engineering                         |
| COMMIT               | Repository operation plus separate baseline governance |
| REPLAN               | Loop control and reshaping                    |

This does not mean that each legacy phase belongs exclusively to one category. It means that the legacy phase abstraction hides several underlying objects and operations.

---

# 5. Current-State Semantic Inventory

## 5.1 INTAKE

### Confirmed purpose

INTAKE is a legacy conversational planning phase in which a human works with a Technical Expert to discuss and clarify requirements.

It contains multiple substates related to:

* open discussion;
* synthesis;
* approval;
* intent discovery;
* product review;
* proposal of domains, journeys, entities, and integrations;
* clarification.

### Likely inputs

* user’s natural-language request;
* legacy dialogue history;
* workspace or project context;
* previously supplied constraints;
* external files or links;
* current repository state.

### Likely outputs

* synthesized understanding of the user’s intent;
* initial product definition;
* identified business domains;
* candidate user journeys;
* candidate entities;
* candidate integrations;
* open questions;
* assumptions;
* human approval or rejection.

### RPH interpretation

INTAKE is not one PWU Type.

It is a legacy compatibility container whose professional content maps to multiple PWU Types plus interaction and control activities.

Recommended initial structure:

```text
Intent and Product Definition PWU Type
├── Intent Discovery PWU Type
├── Product Boundary PWU Type
├── Stakeholder and Actor Discovery PWU Type
├── Business Domain Discovery PWU Type
├── User Journey Discovery PWU Type
├── Domain Entity Discovery PWU Type
├── Integration Discovery PWU Type
└── Intent Baseline Assembly PWU Type
```

### Substate reclassification

| Current substate  | Proposed representation                             |
| ----------------- | --------------------------------------------------- |
| DISCUSSING        | Legacy dialogue interaction mode                    |
| SYNTHESIZING      | Execution state within a shaping PWU                |
| AWAITING_APPROVAL | Governance wait state                               |
| INTENT_DISCOVERY  | PWU                                                 |
| PRODUCT_REVIEW    | Assurance assessment or review PWU                  |
| PROPOSING         | Execution activity producing candidate work objects |
| CLARIFYING        | Control action available from any shaping state     |

### Gaps requiring discovery

* What exact artifact marks legacy INTAKE completion?
* Is the output structured or primarily prose?
* Are user journeys, entities, and integrations stored as first-class objects?
* How are rejected or deferred proposals represented?
* Are assumptions captured during INTAKE or only later?
* Which Assurance Policies are implemented by the legacy validators before approval?
* What conditions cause more clarification?
* Can the user revise an approved intake result?
* Does approval establish a baseline or only permit the next legacy phase?

---

## 5.2 ARCHITECTURE

### Confirmed purpose

Architecture decomposition and design.

### Likely inputs

* approved or provisional product definition;
* requirements and user journeys;
* domain entities;
* integrations;
* repository and platform constraints;
* existing architecture;
* technical standards.

### Likely outputs

* architecture description;
* component decomposition;
* data model;
* interfaces;
* technology decisions;
* deployment considerations;
* implementation constraints;
* architecture assumptions.

### RPH interpretation

ARCHITECTURE maps to a recursively decomposable PWU Type hierarchy in the Product Realization PWA.

```text
Architecture Definition PWU Type
├── System Context PWU Type
├── System Boundary PWU Type
├── Component Architecture PWU Type
├── Data Architecture PWU Type
├── Integration Architecture PWU Type
├── Security Architecture PWU Type
├── Deployment Architecture PWU Type
└── Architecture Decision Consolidation PWU Type
```

Not every PWU Type is instantiated in every Undertaking. The Product Realization PWA definition, selected profile, and risk profile determine applicability.

### Required canonical objects

* Architecture PWU Types in the PWA and Architecture PWU Instances in an Undertaking
* Architecture Artifacts
* Architecture Decisions
* Constraints
* Assumptions
* Claims of completeness and consistency
* Trace links to product intent and requirements
* Decomposition Contract
* Recomposition Contract

### Gaps requiring discovery

* Is the legacy phase producing one architecture artifact or several?
* How does architecture trace back to user journeys and requirements?
* Are architecture decisions explicitly recorded?
* Does the current implementation distinguish requirements from proposed architecture?
* Are existing repository structures treated as constraints or only context?
* Are legacy architecture validator implementations invoked locally or only during later validation?
* Can architecture be revised after execution begins?
* What constitutes architecture approval?

---

## 5.3 PROPOSE

### Confirmed purpose

The Executor generates a proposal and surfaces assumptions.

### Likely inputs

* approved product definition;
* architecture;
* repository state;
* prior decisions;
* implementation constraints;
* available agents and tools.

### Likely outputs

* implementation proposal;
* work decomposition;
* candidate plan;
* assumptions;
* dependencies;
* risks;
* implementation strategy.

### RPH interpretation

PROPOSE should be separated into two distinct semantic outputs:

1. **Implementation Planning PWU Instance governed by the corresponding Product Realization PWU Type**
2. **Candidate Execution Plan**

A proposal may also create:

* proposed PWU Instances;
* proposed dependencies;
* proposed assumptions;
* feasibility claims;
* impact claims;
* runtime capability requests.

### Important distinction

A proposed task hierarchy is not yet an approved PWU hierarchy.

A proposed sequence is not yet an active Execution Plan.

An assumption mentioned in proposal prose is not yet an accepted Assumption Object.

### Gaps requiring discovery

* What proposal schema currently exists?
* Does the Executor create tasks, code changes, or both?
* Are task dependencies explicit?
* Are assumptions emitted in a parseable form?
* Does PROPOSE modify authoritative legacy workflow state?
* Does it generate one proposal or alternatives?
* Can a human modify the proposal before verification?
* What makes a proposal eligible for ASSUMPTION_SURFACING?

---

## 5.4 ASSUMPTION_SURFACING

### Confirmed purpose

Converts Executor assumptions into claims.

### RPH interpretation

This legacy behavior is not best represented as a global sequential legacy phase in the canonical model.

It is a cross-cutting assurance capability consisting of:

* Assumption Disclosure Policy;
* Assumption Extraction execution step;
* Assumption Objects;
* dependent Claim Objects;
* materiality assessment;
* verification requirements;
* impact relationships.

### Recommended behavior

For each detected assumption:

1. Create or deduplicate an Assumption Object.
2. Identify who or what introduced it.
3. Identify affected PWUs, claims, and artifacts.
4. Classify materiality.
5. Determine whether it must be:

   * verified;
   * accepted by authority;
   * tracked as uncertainty;
   * rejected;
   * expired later.
6. Generate assurance observations when assumptions:

   * alter scope;
   * weaken constraints;
   * contradict intent;
   * affect irreversible work.

### Friction

The current description says assumptions are converted to claims. That may be too narrow.

An assumption is not always a claim to be verified immediately. It may be:

* a provisional premise;
* an operating condition;
* an unresolved uncertainty;
* a risk;
* a decision dependency;
* a temporary simplification.

The migration must preserve this distinction.

### Gaps requiring discovery

* What is the current assumption schema?
* What does “convert to claims” mean operationally?
* Are assumptions deduplicated?
* Are they linked to the proposal text or affected tasks?
* Are materiality and impact recorded?
* Can assumptions be accepted without verification?
* What happens when an assumption is falsified?
* Does the legacy phase block all work until all assumptions close?

---

## 5.5 VERIFY

### Confirmed purpose

The Verifier checks all open claims.

### RPH interpretation

VERIFY becomes policy-driven Assurance Assessments.

Each assessment should identify:

* claims under review;
* applicable policy;
* evidence considered;
* evaluator identity;
* independence requirement;
* criteria;
* observations;
* disposition;
* residual uncertainty;
* recommended control action.

### Likely dispositions

* supported;
* conditionally supported;
* contested;
* rejected;
* inconclusive;
* waived;
* escalated.

### Potential verification PWUs

Some verification activities may be large enough to require their own PWU, particularly where verification requires:

* research;
* repository analysis;
* experimentation;
* source evaluation;
* benchmarking;
* security testing.

The distinction should be:

* the **Assurance Assessment** defines what must be established;
* the **verification PWU** performs substantive work needed to gather evidence.

### Gaps requiring discovery

* What claims are currently generated?
* What evidence sources may the Verifier use?
* Is the Verifier independent from the Executor?
* What happens when evidence is inconclusive?
* Are claim results persisted individually?
* Can a claim be reopened?
* Does the Verifier distinguish unsupported from false?
* Can verification alter the proposal directly?

---

## 5.6 HISTORICAL_CHECK

### Confirmed purpose

A Historian-Interpreter analyzes historical patterns.

### RPH interpretation

This becomes a Historical Consistency Assurance Policy supported by narrative and organizational memory.

It may evaluate claims such as:

* this proposal is consistent with prior decisions;
* this architecture does not reintroduce a known failure;
* this change intentionally departs from precedent;
* the rationale for historical divergence is adequate.

### Recommended outputs

* historical precedent Evidence Objects;
* similarity or deviation observations;
* prior decision references;
* known failure-pattern findings;
* unresolved historical conflicts;
* recommendation to continue, explain, reshape, or escalate.

### Important design distinction

Historical consistency should not mean “repeat the past.”

The policy should detect:

* unexplained divergence;
* accidental recurrence;
* forgotten rationale;
* invalid reuse of outdated precedent.

Intentional divergence should remain possible through an explicit Decision Object.

### Gaps requiring discovery

* What historical sources are queried?
* Is narrative memory already structured?
* How is relevance determined?
* How is stale history treated?
* Does the Historian merely advise or block?
* Are findings linked to exact prior decisions or artifacts?
* Can contradictory historical precedents coexist?
* Is organizational precedent treated as evidence, policy, or context?

---

## 5.7 REVIEW

### Confirmed purpose

A human reviews findings and makes decisions.

### RPH interpretation

REVIEW is governance, not merely another legacy work phase.

It should produce one or more Decision Objects:

* approval;
* rejection;
* request for clarification;
* waiver;
* acceptance of assumption;
* reshape;
* replan;
* escalation;
* conditional approval.

### Required decision record

Every material decision should include:

* decision subject;
* available options;
* selected option;
* authority;
* rationale;
* evidence considered;
* assurance observations considered;
* conditions;
* scope;
* effective date.

### Gaps requiring discovery

* What exactly is shown to the human?
* Is review one decision or several?
* Can the human approve some findings and reject others?
* Are waivers currently possible?
* Is rationale required?
* Can agents make changes during review?
* Is approval tied to a specific semantic version?
* What happens when the underlying proposal changes after approval?

---

## 5.8 EXECUTE

### Confirmed purpose

Task execution through the MAKER agent system.

### RPH interpretation

EXECUTE becomes the operation of actionable implementation PWUs using approved Execution Plans and authorized Runtime Bindings.

### Canonical structure

```text
Implementation PWU
    ↓
Approved Execution Plan
    ↓
Execution Steps
    ↓
Runtime Bindings
    ↓
Execution Attempts
    ↓
Artifacts and Evidence
```

### Required separation

The following must not be conflated:

* PWU identity;
* execution plan;
* agent role;
* model;
* tool access;
* execution attempt;
* produced artifact;
* evidence;
* completion claim.

### Likely outputs

* source-code changes;
* tests;
* configuration;
* documentation;
* migration scripts;
* execution traces;
* implementation claims;
* newly discovered assumptions;
* new constraints or risks.

### Gaps requiring discovery

* How does MAKER decompose tasks?
* Can MAKER create additional tasks dynamically?
* What execution state is durable?
* How are retries handled?
* How are partial successes represented?
* Are tool side effects idempotent?
* How are files and repository commits tracked?
* Can an execution result challenge architecture or requirements?
* What happens when execution discovers that the plan is invalid?

---

## 5.9 VALIDATE

### Confirmed purpose

Deep validation with hypothesizer agents.

### RPH interpretation

VALIDATE becomes a set of Assurance Policies and, where required, validation PWUs.

Candidate policies include:

* Intent Preservation Policy
* Requirements Coverage Policy
* Architecture Conformance Policy
* Assumption Closure Policy
* Test Adequacy Policy
* Integration Correctness Policy
* Regression Policy
* Security Policy
* Unsupported Claim Policy
* Fitness-for-Purpose Policy
* Recomposition Integrity Policy

### Important change

Validation should not exist only after implementation.

Some policies should operate:

* during intent shaping;
* after decomposition;
* before execution;
* during execution;
* after artifact production;
* before baseline promotion.

The legacy final VALIDATE phase may remain as a compatibility milestone, but not as the only validation point.

### Gaps requiring discovery

* What hypothesizer agents exist?
* What hypotheses do they generate?
* What evidence do they inspect?
* Do they test outputs or critique reasoning?
* How are disagreements resolved?
* What conditions produce rework versus escalation?
* Are validation results persisted separately?
* Does validation include intent-preservation checks today?
* Can validation invalidate earlier approved work?

---

## 5.10 COMMIT

### Confirmed legacy purpose

Legacy final source commit and deployment.

### RPH interpretation

The legacy COMMIT phase contains at least two distinct operations:

1. repository or artifact mutation;
2. promotion into an authoritative baseline.

These must be separated.

A source-control commit is a technical Artifact or configuration event.

Baseline Promotion is a Governance Decision supported by an assurance package.

### Recommended structure

```text
Candidate implementation
    ↓
Evidence package assembly
    ↓
Baseline promotion assessment
    ↓
Authorized promotion decision
    ↓
Authoritative baseline
    ↓
Optional deployment action
```

### Gaps requiring discovery

* Does legacy COMMIT create only a source commit or also deploy?
* Is the commit reversible?
* Is user approval required?
* Are legacy validator findings included?
* Is the exact approved version guaranteed to be committed?
* Is deployment a separate operation?
* How are failed commits handled?
* Is there a configuration baseline today?

---

## 5.11 REPLAN

### Confirmed purpose

Legacy pass-through phase for replanning based on feedback.

### RPH interpretation

REPLAN should not remain a normal terminal legacy phase in the canonical model.

It becomes a family of control actions:

* revise prompt;
* revise context;
* change model;
* change tool;
* retry;
* change tactic;
* revise Execution Plan;
* reshape PWU;
* revise decomposition;
* challenge parent intent;
* escalate.

### Required output

Every replan or reshape action should record:

* triggering finding or failure;
* affected PWUs;
* superseded plan;
* replacement plan or revised shape;
* invalidated work;
* retained evidence;
* required revalidation;
* decision authority.

### Gaps requiring discovery

* What currently triggers REPLAN?
* Does it modify the same proposal or create a replacement?
* Which legacy phase follows REPLAN?
* Are previous outputs retained?
* Does it invalidate prior legacy validator findings?
* Can the user initiate replanning?
* Can replanning revise intent?
* Is there any loop-count or escalation policy?

---

# 6. Product Realization PWA Compatibility Encoding

## 6.1 Root structure

The initial compatibility profile of the Product Realization PWA should define one root PWU Type:

```text
Product Realization PWU Type
```

Its intent is:

> Transform the user’s approved product intent into an implemented, validated, and governed software baseline.

Recommended child PWU Types:

```text
Product Realization PWU Type
├── Intent and Product Definition PWU Type
├── Architecture Definition PWU Type
├── Implementation Planning PWU Type
├── Implementation PWU Type
├── Integrated Validation PWU Type
└── Baseline Promotion PWU Type
```

This is a reusable semantic decomposition, not the execution sequence. An Undertaking bound to this PWA version instantiates the applicable types as PWU Instances.

## 6.2 Initial compatibility Execution Plan

To preserve current behavior, the first Execution Plan may remain approximately sequential:

```text
Intent and Product Definition
→ Architecture Definition
→ Implementation Planning
→ Assumption Assurance
→ Claim Verification
→ Historical Consistency Assessment
→ Human Governance Decision
→ Implementation
→ Integrated Validation
→ Baseline Promotion
```

This plan should be represented as a compatibility strategy for temporal execution, not embedded into the PWA's PWU Type hierarchy or an Undertaking's Professional Work Graph.

## 6.3 Initial runtime bindings

| Activity              | Initial binding                        |
| --------------------- | -------------------------------------- |
| Intent discussion     | Technical Expert role plus human       |
| Architecture          | Existing architecture role or executor |
| Proposal              | Executor                               |
| Assumption extraction | Assumptions Surfacer                   |
| Claim verification    | Verifier                               |
| Historical assessment | Historian-Interpreter                  |
| Governance            | Human                                  |
| Implementation        | MAKER                                  |
| Deep validation       | Hypothesizer and legacy validator roles |
| Repository commit operation | Existing repository integration  |

The exact model, CLI provider, tool, sandbox, and permission assignments remain Runtime Bindings.

## 6.4 Initial assurance policies

At minimum, encode:

1. Intent Completeness
2. Intent Approval
3. Architecture Coverage
4. Assumption Disclosure
5. Material Assumption Verification
6. Claim Verification
7. Historical Consistency
8. Human Governance
9. Implementation Evidence Sufficiency
10. Intent Preservation
11. Integrated Validation
12. Baseline Promotion

---

# 7. Current-to-Canonical Object Mapping

| Legacy concept       | Canonical RPH object or treatment                                  |
| -------------------- | ------------------------------------------------------------------ |
| Legacy dialogue      | Interaction record linked to Work Objects                          |
| Legacy workflow state | Compatibility projection over PWU, execution, and assurance states |
| Legacy phase         | Compatibility milestone or Execution Plan grouping                 |
| Legacy INTAKE substate | PWU state, execution state, governance state, or interaction mode |
| Prompt               | Prompt template within an Execution Step                           |
| Role invocation      | Runtime Binding and Execution Attempt                              |
| Generated plan       | Candidate PWUs plus candidate Execution Plan                       |
| Assumption text      | Assumption Object                                                  |
| Open claim           | Claim Object                                                       |
| Legacy validator result | Assurance Policy implementation result, Assessment, and Observations |
| Carried feedback     | Typed Observation, Constraint, Assumption, Risk, or Obligation     |
| Human gate           | Governance Decision requirement                                    |
| Legacy phase completion | Compatibility milestone, not semantic satisfaction              |
| Replan               | Control Action                                                     |
| Legacy COMMIT        | Repository Artifact operation plus separate baseline governance    |
| Final acceptance     | Baseline Promotion Decision                                        |
| Legacy Workflow Canvas node | Projection node                                             |
| Legacy workflow template | PWA profile plus PWU Type and policy templates                  |
| Legacy validator mapping | Assurance Policy applicability and implementation binding      |
| Loop edge            | Execution transition or controller response                        |

---

# 8. Conformance Assessment

## 8.1 Existing strengths

The legacy Product Lens already contains several RPH-compatible ideas:

* explicit legacy phases;
* specialized professional roles;
* deliberate assumption surfacing;
* claim verification;
* organizational-history review;
* human governance;
* independent validation;
* replanning;
* durable legacy workflow state;
* separation between proposal and execution.

These are substantial assets.

The migration is not inventing governed professional execution from nothing. It is formalizing and generalizing mechanisms that already exist.

## 8.2 Principal conformance gaps

### Gap 1: Intent is not clearly first-class

The legacy Execution Workflow begins with INTAKE, but it is not yet clear whether intent has:

* stable identity;
* semantic versioning;
* approval state;
* explicit outcomes;
* non-goals;
* traceability.

**Required remediation:** Introduce the Intent Object and approved intent baseline.

### Gap 2: Legacy phase identity substitutes for work identity

The legacy phase indicates where the system is, but not necessarily which bounded professional obligation exists.

**Required remediation:** Introduce stable PWU Instance identity independent of legacy phase.

### Gap 3: Work hierarchy and execution order are coupled

Legacy subphases and phase order appear to define both the structure of the work and how it runs.

**Required remediation:** Separate PWU hierarchy from Execution Plan.

### Gap 4: Assumptions and claims may lack typed semantics

The current system surfaces assumptions and converts them into claims, but materiality, scope, dependency, and lifecycle may be underspecified.

**Required remediation:** Introduce Assumption and Claim Objects with explicit relationships.

### Gap 5: Legacy validator output may be too message-oriented

The prior canvas proposal described pass/fail status, feedback messages, and carried context.

**Required remediation:** Map each legacy validator to an Assurance Policy implementation that produces Assurance Assessments, Evidence, and typed Observations.

### Gap 6: Execution and assurance completion may be conflated

A legacy phase may complete even if professional confidence remains conditional.

**Required remediation:** Store independent execution, assurance, and shape-integrity states.

### Gap 7: Historical findings may lack authoritative provenance

Historical analysis may be advisory prose rather than evidence-backed assessment.

**Required remediation:** Link findings to specific precedents and record their scope and freshness.

### Gap 8: Human decisions may be insufficiently structured

Approval may be recorded as a gate state without complete rationale, scope, and evidence.

**Required remediation:** Introduce Decision Objects.

### Gap 9: Replanning is localized to one legacy phase

Feedback-induced reshaping should be possible at any point.

**Required remediation:** Implement controller-level Control Actions.

### Gap 10: Legacy COMMIT may conflate repository mutation and acceptance

A repository commit is not proof that the user’s intent has been satisfied.

**Required remediation:** Separate the Repository Commit Artifact operation from Baseline Promotion governance.

### Gap 11: Traceability is incomplete

The current description does not establish end-to-end links from intent through artifacts and evidence.

**Required remediation:** Introduce typed Trace Links.

### Gap 12: Decomposition validity is not explicit

The system may generate tasks without proving that they preserve parent obligations.

**Required remediation:** Introduce Decomposition Contracts and coverage assurance.

---

# 9. Architectural Frictions to Resolve

## 9.1 What counts as a PWU?

Not every operation should become a PWU.

Use a PWU when the activity:

* has a professional purpose;
* produces a meaningful work product or decision;
* can be assigned;
* has completion claims;
* requires evidence or verification;
* may need decomposition;
* has independent lifecycle significance.

Do not use a PWU for:

* formatting;
* prompt rendering;
* one API call;
* a database update;
* retry delay;
* UI interaction;
* ordinary context assembly.

Those belong to Execution Steps or runtime services.

## 9.2 How do legacy validators implement Assurance Policies?

Under the canonical vocabulary, a validator is an implementation of an Assurance Policy, not a separate work architecture. Some legacy validators merely assess existing evidence.

Other policy implementations must initiate substantial work to obtain evidence.

The architecture should support both:

```text
Assurance Policy
    ↓ implemented by
Assurance Policy implementation
    ↓ produces
Assurance Assessment
```

and:

```text
Assurance Policy
    ↓ requires
Verification PWU Instance
    ↓
Evidence
    ↓
Assurance Assessment
```

## 9.3 How much existing behavior should be preserved?

The compatibility implementation should preserve:

* user-visible sequencing;
* role responsibilities;
* existing prompts where practical;
* approval points;
* results from legacy validator implementations;
* repository effects;
* legacy dialogue continuity.

It should not preserve accidental coupling such as:

* legacy phase names as database authority;
* pass/fail as the only assurance state;
* untyped carried context;
* a dedicated REPLAN endpoint in the semantic model;
* automatic equivalence between validation completion and acceptance.

## 9.4 How does the legacy Product Lens map to the Product Realization PWA?

The legacy Product Lens is more than an Execution Workflow, but its reusable professional structure belongs in the Product Realization PWA.

For the initial implementation, define a **Product Realization PWA compatibility profile** containing:

* PWU Type templates;
* artifact types;
* professional concepts;
* assurance policies;
* decomposition rules;
* context policies;
* runtime-role defaults.

This allows gradual formalization without requiring a full ontology language immediately.

## 9.5 How should confidence be handled?

Do not begin by aggregating legacy validator or Assurance Assessment scores into one numerical confidence value.

Initial assurance should use:

* explicit dispositions;
* evidence sufficiency;
* open observations;
* residual uncertainty;
* blocking conditions;
* human decisions.

Numerical confidence should be introduced only where it has a defensible interpretation.

---

# 10. Code-Level Semantic Inventory Plan

Before implementing migration logic, instrument and inspect the current codebase.

## 10.1 Legacy phase inventory template

For each top-level legacy phase and INTAKE substate, capture:

```text
Identifier
Purpose
Entry conditions
Exit conditions
Inputs
Outputs
Prompt templates
Context sources
Roles invoked
Models/providers invoked
Tools invoked
Database reads
Database writes
Artifacts produced
Claims produced
Assumptions produced
Legacy validators and Assurance Policy implementations invoked
Human interactions
Retry behavior
Failure behavior
Next-state logic
Side effects
Observability events
Known invariants
```

## 10.2 Legacy validator-to-policy implementation inventory template

For every existing legacy validator:

```text
Legacy validator identifier
Professional purpose
Target legacy phase or artifact
Claims evaluated
Inputs
Evidence considered
Prompt or deterministic logic
Assurance evaluator role/model
Independence from producer
Possible findings
Severity model
Pass/fail rules
Retry behavior
Escalation behavior
Carried feedback
Persistence
Downstream consumers
```

## 10.3 Role inventory template

For each role:

```text
Role identifier
Professional responsibility
Authority
Model/provider
Prompt family
Context policy
Tool capabilities
Outputs
Limitations
Assurance Policy implementation independence constraints
Escalation path
```

## 10.4 Persistence inventory

Inspect:

* legacy `workflow_state`;
* legacy dialogue tables;
* legacy phase-result tables;
* assumption and claim storage;
* legacy validator-result storage;
* role messages;
* artifacts;
* repository commit records;
* event or trace tables.

Identify which table currently acts as the practical source of truth.

## 10.5 Execution-trace sampling

Capture at least:

* one successful small project;
* one project requiring clarification;
* one project with false assumptions;
* one legacy validator implementation failure;
* one human rejection;
* one replanning cycle;
* one execution failure;
* one repository commit failure or cancellation.

The new runtime must explain every materially different state observed in these traces.

---

# 11. First Vertical Slice

## 11.1 Slice objective

Prove that the RPH model can instantiate and execute a meaningful portion of the Product Realization PWA while preserving legacy Product Lens behavior without relying on the legacy phase enum as the semantic source of truth.

## 11.2 Slice scope

Implement:

```text
Raw user request
→ Intent Discovery PWU Instance
→ Intent Baseline
→ Architecture Definition PWU Instance
→ Assumption Disclosure Assessment
→ Human Governance Decision
→ Candidate Architecture Baseline
```

This slice intentionally stops before full MAKER execution.

It tests:

* user intent;
* PWU lifecycle;
* Shape Engineering;
* one cross-cutting assurance policy;
* evidence;
* human governance;
* baseline promotion;
* synchronized views.

## 11.3 Required objects

* one selected Product Realization PWA and version;
* one Undertaking bound to that PWA version;
* one Intent Object;
* one root Product Realization PWU Instance;
* one Intent and Product Definition PWU Instance;
* one Architecture Definition PWU Instance;
* one Assumption Disclosure Policy;
* zero or more Assumption Objects;
* one or more Claims;
* Evidence Objects;
* one Assurance Assessment;
* one Decision Object;
* one candidate Architecture Baseline;
* typed Trace Links.

## 11.4 Execution strategy

Initially use a static plan:

```text
Capture request
→ Conduct legacy-dialogue-compatible intent interaction
→ Synthesize intent
→ Request intent approval
→ Generate architecture
→ Extract assumptions
→ Assess assumptions
→ Request architecture review
→ Promote candidate architecture baseline
```

## 11.5 Runtime bindings

Reuse current:

* Technical Expert role;
* architecture or executor role;
* Assumptions Surfacer;
* human interaction mechanism;
* context builder;
* CLI provider infrastructure;
* database and event bus.

## 11.6 Required UI

### Work view

Show:

* intent;
* root PWU;
* intent PWU;
* architecture PWU;
* assumptions;
* boundaries;
* lifecycle states.

### Assurance view

Show:

* assumption policy;
* assessment;
* assumptions found;
* observations;
* evidence;
* disposition.

### Minimal trace view

Show:

```text
User request
→ formalized intent
→ architecture PWU
→ architecture artifact
→ assurance evidence
→ approval decision
→ architecture baseline
```

## 11.7 Vertical-slice success criteria

* The legacy phase enum is not required to identify the professional work.
* Intent has stable identity and approval state.
* Architecture has a stable PWU identity.
* Model execution success does not automatically satisfy the architecture PWU.
* Assumptions become typed objects.
* The human decision references the architecture and assurance findings.
* Baseline promotion requires an effective decision.
* Traceability is queryable.
* Restart does not lose state.
* The legacy Product Lens surface can still display compatibility milestones.

---

# 12. Initial Implementation Backlog

## Epic A: Current-system instrumentation

### A1. Legacy phase compatibility trace instrumentation

Add structured events around every legacy phase entry and exit.

### A2. Role invocation instrumentation

Record role, model/provider, prompt identity, context inputs, tool use, and result.

### A3. Legacy validator and Assurance Policy implementation instrumentation

Record target, inputs, output, disposition, and downstream effect.

### A4. Human-gate instrumentation

Record displayed information, user decision, rationale, and next-state effect.

### A5. Representative trace capture

Persist the required scenario traces.

---

## Epic B: Canonical object foundation

### B1. Common object envelope

Implement IDs, revisions, semantic versions, provenance, and authority references.

### B2. Intent aggregate

Implement capture, formalization, approval, revision, and supersession.

### B3. PWU aggregate

Implement lifecycle, execution state, assurance state, and shape-integrity state.

### B4. Assumption, Claim, Evidence, and Decision objects

Implement typed schemas and persistence.

### B5. Typed trace links

Implement creation, validation, and traversal.

### B6. Baseline aggregate

Implement candidate, approved, authoritative, and superseded states.

---

## Epic C: Domain events and commands

### C1. Event envelope

Implement correlation, causation, actor, revision, and schema version.

### C2. Command receipt and idempotency

Prevent duplicate semantic operations.

### C3. Optimistic concurrency

Require expected aggregate revision.

### C4. Outbox

Publish reliable integration events.

### C5. Projection rebuilding

Allow read models to be rebuilt from canonical records and events.

---

## Epic D: Intent vertical slice

### D1. Capture raw intent

Create an Intent Object from the legacy dialogue start.

### D2. Conduct intent discovery

Bind current Technical Expert interaction to the Intent Discovery PWU.

### D3. Synthesize formalized intent

Create formalized objective, desired outcomes, non-goals, constraints, and ambiguities.

### D4. Human approval

Create an effective Approval Decision.

### D5. Intent baseline

Promote approved intent into an Intent Baseline.

---

## Epic E: Architecture vertical slice

### E1. Create Architecture PWU

Trace it to approved intent.

### E2. Create static Execution Plan

Bind current architecture generation behavior.

### E3. Persist Architecture Artifact

Record provenance and content hash.

### E4. Assert architecture claims

At minimum:

* architecture addresses the approved intent;
* required concerns are covered;
* known constraints are preserved.

### E5. Separate execution and assurance state

Architecture output may exist before assurance succeeds.

---

## Epic F: Assumption assurance

### F1. Define Assumption Disclosure Policy

Target architecture output and associated reasoning.

### F2. Extract assumptions

Create typed objects rather than prose-only findings.

### F3. Classify materiality

Support immaterial, material, and critical.

### F4. Link affected objects

Trace assumptions to intent, architecture, and claims.

### F5. Complete assessment

Produce observations, evidence references, disposition, and control recommendation.

---

## Epic G: Human governance and baseline

### G1. Architecture review package

Present intent, architecture, claims, assumptions, evidence, and observations.

### G2. Approval decision

Persist scope, rationale, and considered evidence.

### G3. Candidate baseline

Create immutable candidate Architecture Baseline.

### G4. Promotion

Require authorized effective decision.

### G5. Supersession

Support successor baseline when architecture changes.

---

## Epic H: Minimal workbench

### H1. Work projection

Render PWU hierarchy and semantic states.

### H2. Assurance projection

Render claims, assumptions, evidence, and observations.

### H3. Object inspector

Show provenance, state history, traceability, and versions.

### H4. Linked selection

Selecting an architecture PWU reveals its assurance and trace records.

### H5. Compatibility labels

Show the legacy phase-equivalent compatibility milestone without making it authoritative.

---

# 13. Initial Invariant Test Set

The vertical slice must enforce:

1. An Architecture PWU cannot enter `READY` without an intent reference.
2. An Architecture PWU cannot become `SATISFIED` solely because architecture generation succeeded.
3. Every material assumption must be persisted.
4. A critical assumption must be verified or explicitly accepted before architecture baseline promotion.
5. Human approval must reference a specific architecture semantic version.
6. Changing architecture after approval invalidates or supersedes the prior approval.
7. Baseline promotion requires an effective decision.
8. A layout change cannot change semantic version.
9. Invalidated evidence cannot support the current architecture claim.
10. Intent revision triggers architecture impact analysis.
11. An assurance assessment must state which policy version was applied.
12. Assumption findings cannot be erased by remediation; their disposition changes.
13. An inconclusive assessment cannot be converted to satisfied without additional evidence or waiver.
14. Runtime model changes do not change architecture PWU identity.
15. Duplicate commands do not create duplicate decisions or baselines.

---

# 14. Parallel-Run Conformance Plan

After the vertical slice works, run the current and RPH implementations in parallel.

## 14.1 Comparison dimensions

Compare:

* formalized intent;
* architecture content;
* assumptions detected;
* verifier findings;
* human decision;
* final approved artifact;
* state transitions;
* number of model calls;
* token and cost usage;
* time;
* recoverability;
* traceability;
* unexplained differences.

## 14.2 Difference classification

Every difference must be classified as:

* intentional semantic improvement;
* representation-only difference;
* missing legacy behavior;
* accidental legacy behavior;
* new implementation defect;
* unresolved design decision.

## 14.3 Parity threshold

The first slice should not require byte-level artifact equivalence.

It should require:

* equivalent professional intent;
* no material requirement loss;
* equivalent or stronger assumption disclosure;
* equivalent or stronger human control;
* no reduction in evidence;
* no unintended repository side effect;
* explainable differences.

---

# 15. Unresolved Design Decisions

## Decision 1: Intent approval granularity

Should the user approve:

* one complete intent baseline;
* individual outcomes and constraints;
* both?

**Initial recommendation:** approve the baseline as a whole while allowing explicit objection to individual elements.

## Decision 2: Architecture completeness

Should the initial Architecture PWU always decompose into fixed children?

**Initial recommendation:** use an applicability profile. Do not create meaningless empty PWUs.

## Decision 3: Assumption acceptance authority

Can low-risk assumptions be accepted automatically?

**Initial recommendation:** allow policy-based acceptance only for low-risk, reversible work. Material assumptions require explicit assessment.

## Decision 4: Assurance Policy implementation independence

Must the Assumption Disclosure Policy implementation use a different model from architecture generation?

**Initial recommendation:** require a different invocation initially; require a different agent or model for high-risk work.

## Decision 5: Baseline meaning

Does an Architecture Baseline mean approved for implementation or merely approved as a current reference?

**Initial recommendation:** represent this explicitly as baseline purpose and authority scope.

## Decision 6: Legacy dialogue storage

Is chat history itself canonical evidence?

**Initial recommendation:** legacy dialogue is provenance and context. Extracted, admitted portions may become Evidence Objects.

## Decision 7: Legacy workflow-state compatibility

Should the legacy phase field remain writable?

**Initial recommendation:** during migration, derive it from RPH state wherever possible. Avoid dual authoritative writes.

## Decision 8: Confidence scoring

Should assessments emit numeric confidence?

**Initial recommendation:** defer general numerical aggregation. Use explicit dispositions and residual uncertainty first.

---

# 16. Migration Exit Criteria

The semantic inventory and first conformance stage are complete when:

* every legacy phase has a code-grounded behavior inventory;
* every legacy validator has a canonical Assurance Policy implementation mapping;
* every role has an authority and runtime-binding definition;
* current persistence sources of truth are identified;
* representative execution traces are captured;
* the vertical slice runs through the new model;
* execution and assurance states are independent;
* intent-to-baseline traceability works;
* the existing UI can display compatibility milestones;
* unexplained behavioral differences are within the agreed threshold;
* the architecture has survived contact with the actual legacy Product Lens code.

---

# 17. Final Migration Position

The legacy Product Lens is not merely a sequence to be made configurable.

It is an early implementation of a governed professional control system whose semantics are encoded indirectly through legacy phases, roles, prompts, legacy validator implementations, human gates, and database state.

The migration should preserve that governance while making its underlying professional structure explicit.

The new authoritative sequence is not:

```text
Legacy phase
→ Legacy phase
→ Legacy phase
```

It is:

```text
Intent
→ shaped Professional Work Units
→ approved execution strategies
→ governed runtime execution
→ evidence
→ assurance
→ control response
→ recomposition
→ authoritative baseline
```

The Product Realization PWA is the first canonical reusable architecture derived from that legacy application.

The Recursive Professional Harness becomes the architecture that allows its intent, work, execution, assurance, and governance to evolve independently without losing coherence.
