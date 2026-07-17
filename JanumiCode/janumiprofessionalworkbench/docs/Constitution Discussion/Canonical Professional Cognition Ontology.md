# Canonical Professional Cognition Ontology

## CPCO Specification v0.1.0

**Document ID:** `JAN-CPCO-001`
**Version:** `0.1.0`
**Status:** Draft
**Scope:** Janumi Platform and all Professional Work Architectures
**Primary audiences:** Platform architects, coding agents, domain-model authors, UX engineers, agent developers, validator developers
**Normative keywords:** SHALL, SHALL NOT, SHOULD, SHOULD NOT, MAY

---

# 1. Purpose

The Canonical Professional Cognition Ontology, or CPCO, defines the domain-independent semantic model for professional cognition within Janumi.

It specifies:

* the primitive entities of professional work;
* the relationships among those entities;
* the invariants that preserve professional coherence;
* the distinction between cognition, coordination, execution, and observation;
* the semantic basis of Professional Work Units;
* the semantic basis of Recursive Professional Harnesses;
* the semantic basis of the Living Enterprise Model;
* the projections required by Janumi user interfaces;
* the contracts required by human and artificial participants.

CPCO is not:

* a database schema;
* a UI component model;
* a workflow definition;
* a task-management ontology;
* a product-specific domain model;
* a replacement for domain-specific terminology.

CPCO is the canonical semantic layer from which those implementation artifacts are derived.

---

# 2. Foundational Model

Professional work is modeled as an evolving graph of cognition directed toward outcomes.

The core transformation is:

```text
Intent
  ↓
Understanding
  ↓
Representation
  ↓
Reasoning
  ↓
Decision
  ↓
Action
  ↓
Observation
  ↓
Reconciliation
  ↺
```

This loop is non-linear and recursive. Any conclusion, representation, decision, or observation may initiate additional professional work.

The ontology therefore represents professional cognition as:

```text
Cognitive Entity
+
Semantic Relationships
+
Temporal Evolution
+
Evidence and Provenance
+
Coordination State
+
Coherence Constraints
```

---

# 3. Ontological Layers

CPCO separates five layers that SHALL NOT be collapsed into one another.

## 3.1 Reality Layer

The external world that professional work seeks to understand or change.

Examples:

* a deployed software system;
* a building site;
* a patient;
* a market;
* a regulation;
* an organizational operating condition.

Reality is never fully represented within Janumi. Janumi contains observations and representations of reality.

## 3.2 Cognitive Layer

The organization’s explicit professional understanding.

Examples:

* intents;
* claims;
* assumptions;
* models;
* alternatives;
* decisions;
* confidence assessments.

## 3.3 Work Layer

Bounded units through which cognition is advanced.

The canonical work-layer construct is the Professional Work Unit.

## 3.4 Coordination Layer

Mechanisms that allocate, sequence, supervise, reconcile, and escalate professional work.

The canonical coordination-layer construct is the Recursive Professional Harness.

## 3.5 Projection Layer

Human- and machine-usable views over the cognitive graph.

Examples:

* intent view;
* evidence view;
* reasoning graph;
* decomposition view;
* decision view;
* reconciliation view;
* implementation view.

A projection SHALL NOT become an independent semantic source of truth.

---

# 4. Universal Entity Contract

Every CPCO entity SHALL conform to the following universal contract.

## 4.1 Identity

Each entity SHALL possess a stable, globally unique identifier.

```text
EntityId
```

Identity SHALL survive:

* renaming;
* revision;
* movement between work contexts;
* changes in ownership;
* changes in lifecycle state.

## 4.2 Type

Each entity SHALL declare a canonical entity type.

```text
EntityType
```

Domain-specific subtypes MAY refine canonical types but SHALL NOT violate their semantics.

## 4.3 Version

Each mutable entity SHALL possess a version identifier.

```text
VersionId
```

Historical versions SHALL remain reconstructable when required for traceability, audit, or reasoning recovery.

## 4.4 Provenance

Each entity SHALL record its provenance.

At minimum:

```text
createdBy
createdAt
creationContext
sourceType
sourceReferences
```

Where applicable, provenance SHALL distinguish:

* human-authored;
* AI-generated;
* imported;
* mechanically derived;
* observed;
* reconciled;
* approved.

## 4.5 Lifecycle State

Each entity SHALL declare a lifecycle state appropriate to its type.

Lifecycle state SHALL NOT be inferred from null fields, missing values, or UI placement.

## 4.6 Validity

Each entity SHALL expose its current validation condition.

```text
unvalidated
valid
conditionally_valid
invalid
superseded
stale
disputed
```

## 4.7 Temporal Context

Entities whose meaning changes over time SHALL record:

```text
validFrom
validUntil
observedAt
supersededAt
```

Creation time and semantic validity time SHALL remain distinct.

## 4.8 Access and Responsibility

Entities MAY define:

```text
owner
stewards
contributors
reviewers
approvers
visibility
```

Ownership SHALL NOT be treated as equivalent to authorship or accountability.

---

# 5. Canonical Entity Types

## 5.1 Professional Endeavor

A **Professional Endeavor** is a coherent undertaking directed toward one or more outcomes.

Examples:

* developing a product;
* establishing regulatory compliance;
* diagnosing a patient;
* designing a building;
* conducting a scientific investigation.

A Professional Endeavor provides the broadest bounded context for professional cognition.

### Required properties

```text
endeavorId
name
purpose
lifecycleState
primaryIntentIds
outcomeIds
participantIds
workUnitIds
```

### Constraints

A Professional Endeavor SHALL possess at least one Intent.

A Professional Endeavor SHALL define at least one desired Outcome unless it is explicitly classified as exploratory.

---

## 5.2 Outcome

An **Outcome** is a desired or observed change in reality.

Outcomes are not artifacts, activities, or deliverables.

### Examples

Valid outcomes:

* customers can reliably schedule field service appointments;
* a structure satisfies applicable load requirements;
* an organization demonstrates CMMC Level 2 compliance;
* an experiment resolves a specified scientific uncertainty.

Not outcomes:

* produce a report;
* hold a meeting;
* create a dashboard;
* write a test plan.

Those may be outputs or actions supporting an outcome.

### Required properties

```text
outcomeId
description
outcomeType
successCriteria
evaluationMethod
currentAssessment
```

### Outcome types

```text
desired
intermediate
enabling
protective
preventive
observed
unintended
adverse
```

### Relationships

An Outcome MAY:

* realize an Intent;
* depend on another Outcome;
* conflict with another Outcome;
* be evaluated by Evidence;
* be affected by a Decision;
* be produced or modified by an Action.

---

## 5.3 Intent

**Intent** expresses the desired outcome and the rationale for pursuing it.

Intent answers:

* What should change?
* Why should it change?
* For whom?
* Under which constraints?
* What must not be sacrificed?

### Required properties

```text
intentId
statement
rationale
priority
authority
successInterpretation
```

### Optional properties

```text
nonGoals
ethicalConstraints
organizationalConstraints
timeHorizon
riskTolerance
```

### Relationships

Intent MAY:

* refine another Intent;
* supersede another Intent;
* motivate an Outcome;
* constrain a Decision;
* originate a PWU;
* be interpreted by a Requirement or other Representation.

### Invariant

Every significant work product SHALL remain traceable to one or more active Intents.

---

## 5.4 Stakeholder

A **Stakeholder** is a person, group, organization, system, community, or affected party with an interest in the endeavor or its outcomes.

### Required properties

```text
stakeholderId
stakeholderType
interest
influence
impact
```

### Distinction

A Stakeholder is not necessarily a Participant.

A person affected by a decision may be a Stakeholder without performing work in Janumi.

---

## 5.5 Participant

A **Participant** is an actor that performs, contributes to, evaluates, supervises, or authorizes professional cognition or action.

### Participant types

```text
human
ai_agent
team
organization
external_system
institution
```

### Required properties

```text
participantId
participantType
capabilities
authority
responsibilities
```

### AI-specific properties

```text
modelIdentity
agentRole
toolPermissions
operatingPolicy
contextSources
validationRequirements
```

### Invariant

AI Participants SHALL be represented explicitly. AI-originated cognition SHALL NOT be attributed to a human participant.

---

## 5.6 Question

A **Question** is an explicit expression of uncertainty requiring investigation or resolution.

Questions are first-class entities because professional work is organized around unresolved uncertainty.

### Question types

```text
descriptive
causal
predictive
evaluative
normative
design
verification
operational
strategic
```

### Required properties

```text
questionId
questionText
questionType
importance
resolutionCriteria
status
```

### Status values

```text
open
investigating
partially_resolved
resolved
blocked
deferred
invalidated
```

### Relationships

A Question MAY:

* arise from an Observation;
* challenge a Claim;
* motivate Reasoning;
* be answered by a Claim;
* decompose into subquestions;
* block a Decision.

---

## 5.7 Uncertainty

An **Uncertainty** is a characterized insufficiency in professional knowledge.

Unlike a Question, uncertainty may exist before it is formulated as a precise inquiry.

### Uncertainty categories

```text
epistemic
aleatory
interpretive
requirements
technical
operational
organizational
legal
ethical
resource
temporal
```

### Required properties

```text
uncertaintyId
description
category
severity
decisionImpact
reducibility
```

### Relationships

An Uncertainty MAY:

* generate one or more Questions;
* reduce confidence in a Claim;
* block a Decision;
* motivate a PWU;
* be reduced by Evidence;
* remain as residual uncertainty after a Decision.

---

## 5.8 Representation

A **Representation** is an externalized model, description, specification, expression, or encoding of professional understanding.

### Representation subtypes

```text
requirement
model
diagram
document
specification
architecture
plan
source_code
contract
simulation
dataset
procedure
policy
test_case
test_result
risk_model
financial_model
medical_record
scientific_model
```

Domain-specific PWAs MAY define additional subtypes.

### Required properties

```text
representationId
representationType
contentReference
semanticPurpose
fidelity
status
```

### Invariant

A Representation SHALL declare what it represents and for which professional purpose.

Storage location alone SHALL NOT define semantic identity.

---

## 5.9 Assumption

An **Assumption** is a proposition provisionally treated as true for the purpose of reasoning.

### Required properties

```text
assumptionId
statement
scope
basis
criticality
validationMethod
status
```

### Status values

```text
unexamined
accepted
provisionally_accepted
validated
invalidated
superseded
contested
```

### Invariant

Critical assumptions SHALL be explicit and traceable to the reasoning and decisions that depend upon them.

---

## 5.10 Constraint

A **Constraint** limits the acceptable solution space.

### Constraint types

```text
legal
regulatory
technical
architectural
ethical
financial
resource
schedule
organizational
physical
contractual
security
safety
```

### Required properties

```text
constraintId
statement
constraintType
authority
enforcementLevel
applicability
```

### Enforcement levels

```text
mandatory
strong_preference
preference
advisory
```

### Invariant

A Decision that violates a mandatory Constraint SHALL be invalid unless an authorized exception exists.

---

## 5.11 Claim

A **Claim** is a proposition asserted to describe, explain, predict, evaluate, or prescribe something relevant to the endeavor.

### Claim types

```text
factual
causal
predictive
evaluative
normative
design
verification
operational
```

### Required properties

```text
claimId
statement
claimType
confidenceAssessmentId
status
```

### Status values

```text
proposed
supported
accepted
contested
refuted
superseded
withdrawn
```

### Relationships

A Claim MAY:

* answer a Question;
* be supported or contradicted by Evidence;
* depend on an Assumption;
* justify a Decision;
* be derived from other Claims;
* be produced by Reasoning.

---

## 5.12 Evidence

**Evidence** is information used to increase or decrease confidence in a Claim, Assumption, Representation, or Decision.

### Evidence types

```text
observation
measurement
experiment
test_result
inspection
simulation_result
authoritative_source
expert_judgment
operational_telemetry
user_feedback
historical_record
formal_proof
```

### Required properties

```text
evidenceId
evidenceType
source
contentReference
reliabilityAssessment
relevanceAssessment
observedAt
```

### Evidence relation types

```text
supports
contradicts
qualifies
is_inconclusive_for
```

### Invariant

Evidence SHALL NOT be represented as supporting a Claim without an explicit support relationship.

Mere attachment or proximity SHALL NOT imply evidentiary support.

---

## 5.13 Confidence Assessment

A **Confidence Assessment** expresses the degree of warranted belief in a Claim, Assumption, Decision, or Representation.

### Required properties

```text
confidenceAssessmentId
subjectId
confidenceLevel
basis
assessedBy
assessedAt
```

### Confidence representation

Implementations MAY use:

* ordinal categories;
* numeric probability;
* interval;
* belief distribution;
* domain-specific assurance level.

The representation SHALL declare its interpretation.

### Invariant

Confidence SHALL be distinguishable from:

* priority;
* approval;
* completion;
* certainty;
* severity.

---

## 5.14 Reasoning Activity

A **Reasoning Activity** is a bounded transformation of professional representations intended to reduce uncertainty, generate claims, compare alternatives, or support decisions.

### Reasoning types

```text
analysis
synthesis
decomposition
comparison
diagnosis
prediction
simulation
design
planning
interpretation
verification
validation
reconciliation
critique
review
```

### Required properties

```text
reasoningActivityId
reasoningType
purpose
inputIds
outputIds
performedBy
startedAt
status
```

### Optional properties

```text
method
tools
model
prompt
parameters
terminationCondition
```

### Invariant

Every completed Reasoning Activity SHALL identify its outputs or explicitly record that it produced no valid conclusion.

---

## 5.15 Alternative

An **Alternative** is a candidate interpretation, explanation, design, action, or decision under consideration.

### Required properties

```text
alternativeId
description
alternativeType
evaluationCriteria
status
```

### Status values

```text
identified
under_evaluation
viable
rejected
selected
superseded
```

### Invariant

Rejected Alternatives SHOULD retain rejection rationale when they were materially considered.

---

## 5.16 Decision

A **Decision** is an authorized commitment to a conclusion, interpretation, design, priority, or course of action.

### Required properties

```text
decisionId
decisionStatement
decisionType
authority
status
effectiveAt
```

### Decision states

```text
proposed
pending
approved
rejected
deferred
conditional
implemented
reopened
superseded
reversed
```

### Required relationships

A material Decision SHALL identify:

```text
supportingClaims
supportingEvidence
consideredAlternatives
applicableConstraints
residualUncertainty
decisionRationale
```

### Invariant

A Decision SHALL NOT be treated as equivalent to truth.

A Decision represents commitment under available knowledge and authority.

---

## 5.17 Action

An **Action** is an intentional intervention intended to change reality or the state of professional work.

### Action types

```text
implementation
communication
deployment
construction
execution
experiment
inspection
review
approval
escalation
data_collection
remediation
```

### Required properties

```text
actionId
actionType
intendedEffect
authorizedBy
performedBy
status
```

### Relationships

An Action MAY:

* implement a Decision;
* produce an Artifact;
* change a Representation;
* affect an Outcome;
* generate an Observation.

---

## 5.18 Observation

An **Observation** is a recorded perception, measurement, report, or detected condition concerning reality or system behavior.

### Required properties

```text
observationId
observationType
observedSubject
observedValue
observedAt
observer
```

### Distinction

An Observation is not automatically Evidence.

It becomes Evidence when used in relation to a Claim, Assumption, or Decision.

### Invariant

Raw Observation, interpreted Observation, and derived Claim SHOULD remain distinguishable.

---

## 5.19 Artifact

An **Artifact** is a material or digital output produced during professional work.

Examples:

* a source-code commit;
* a report;
* a drawing;
* a contract;
* a deployed service;
* a test record;
* a presentation.

An Artifact may embody one or more Representations but is not semantically identical to them.

### Example

A PDF file is an Artifact.

The system architecture expressed within that PDF is a Representation.

---

## 5.20 Dependency

A **Dependency** expresses a condition in which one entity’s validity, availability, execution, or meaning depends upon another entity.

### Dependency types

```text
informational
logical
temporal
resource
authority
evidence
implementation
validation
operational
```

### Required properties

```text
dependencyId
sourceId
targetId
dependencyType
criticality
status
```

### Status values

```text
unresolved
satisfied
partially_satisfied
blocked
violated
obsolete
```

---

## 5.21 Risk

A **Risk** is the possibility that uncertainty or future conditions will adversely affect outcomes.

### Required properties

```text
riskId
description
cause
potentialEffect
likelihood
impact
exposure
status
```

### Relationships

A Risk MAY:

* arise from an Assumption;
* relate to an Uncertainty;
* threaten an Outcome;
* motivate a Decision;
* be mitigated by an Action;
* be monitored through Observations.

---

## 5.22 Issue

An **Issue** is a realized condition requiring resolution.

Risk concerns possible future impact.

Issue concerns an existing condition.

### Required properties

```text
issueId
description
severity
detectedAt
status
```

---

## 5.23 Validation

A **Validation** is an evaluation of whether an entity satisfies defined semantic, professional, procedural, or technical criteria.

### Validation types

```text
schema
logical
evidentiary
methodological
regulatory
policy
professional
security
safety
usability
outcome
```

### Required properties

```text
validationId
subjectId
validationType
criteria
result
performedBy
performedAt
```

### Results

```text
pass
fail
conditional_pass
inconclusive
not_applicable
```

---

## 5.24 Reconciliation

A **Reconciliation** is a deliberate process for restoring or improving coherence among representations, intent, evidence, decisions, and observed reality.

### Reconciliation triggers

```text
new_evidence
contradiction
intent_change
assumption_failure
dependency_change
observation_mismatch
policy_change
external_event
validation_failure
manual_request
```

### Required properties

```text
reconciliationId
trigger
affectedEntityIds
detectedIncoherence
proposedResolution
status
```

### Reconciliation states

```text
detected
analyzing
proposed
under_review
accepted
rejected
applied
partially_applied
escalated
```

### Invariant

Reconciliation SHALL preserve the history of the prior coherent state and the reason for change.

---

## 5.25 Narrative Memory

A **Narrative Memory** is a temporally organized account that preserves the evolution and significance of professional cognition.

Narrative Memory does not replace the canonical graph. It provides interpretive continuity across that graph.

### Required properties

```text
memoryId
scope
timeRange
narrative
sourceEntityIds
generatedBy
validationStatus
```

### Invariant

Narrative Memory SHALL identify its source entities and SHALL NOT silently invent missing rationale.

---

# 6. Canonical Relationships

Relationships are first-class semantic objects. They SHALL possess identity, provenance, validity, and temporal context where appropriate.

## 6.1 Intent Relationships

```text
INTENT_MOTIVATES_OUTCOME
INTENT_REFINES_INTENT
INTENT_SUPERSEDES_INTENT
INTENT_CONSTRAINS_DECISION
ENTITY_TRACES_TO_INTENT
```

## 6.2 Reasoning Relationships

```text
QUESTION_MOTIVATES_REASONING
REASONING_CONSUMES_ENTITY
REASONING_PRODUCES_ENTITY
REASONING_DECOMPOSES_ENTITY
REASONING_SYNTHESIZES_ENTITY
REASONING_CHALLENGES_CLAIM
```

## 6.3 Evidence Relationships

```text
EVIDENCE_SUPPORTS_CLAIM
EVIDENCE_CONTRADICTS_CLAIM
EVIDENCE_QUALIFIES_CLAIM
EVIDENCE_VALIDATES_ASSUMPTION
EVIDENCE_INVALIDATES_ASSUMPTION
```

## 6.4 Decision Relationships

```text
CLAIM_JUSTIFIES_DECISION
DECISION_SELECTS_ALTERNATIVE
DECISION_REJECTS_ALTERNATIVE
DECISION_AUTHORIZES_ACTION
DECISION_SUPERSEDES_DECISION
DECISION_ACCEPTS_RESIDUAL_UNCERTAINTY
```

## 6.5 Execution Relationships

```text
ACTION_IMPLEMENTS_DECISION
ACTION_PRODUCES_ARTIFACT
ACTION_AFFECTS_OUTCOME
ACTION_GENERATES_OBSERVATION
```

## 6.6 Reconciliation Relationships

```text
OBSERVATION_TRIGGERS_RECONCILIATION
VALIDATION_TRIGGERS_RECONCILIATION
RECONCILIATION_UPDATES_ENTITY
RECONCILIATION_SUPERSEDES_ENTITY_VERSION
RECONCILIATION_RESOLVES_CONTRADICTION
```

## 6.7 Structural Relationships

```text
ENTITY_DEPENDS_ON_ENTITY
ENTITY_CONTAINS_ENTITY
ENTITY_DERIVED_FROM_ENTITY
ENTITY_REFERENCES_ENTITY
ENTITY_SUPERSEDES_ENTITY
ENTITY_CONFLICTS_WITH_ENTITY
ENTITY_VALIDATED_BY_VALIDATION
```

---

# 7. Professional Work Unit Architectural Profile

A Professional Work Unit is not a primitive ontological entity. It is a bounded aggregate over CPCO entities.

## 7.1 Canonical Definition

A **Professional Work Unit** is a bounded, governable region of professional cognition organized around a professionally meaningful objective, uncertainty, decision, or outcome.

A PWU packages sufficient semantic context to allow its work to be:

* understood;
* assigned;
* reasoned about;
* validated;
* coordinated;
* observed;
* reconciled;
* reconstructed.

## 7.2 Required PWU Composition

Every PWU SHALL contain or reference:

```text
PWU
├── Objective
├── Originating Intent
├── Scope
├── Current Lifecycle State
├── Participants
├── Questions and Uncertainties
├── Inputs
├── Reasoning Activities
├── Representations
├── Claims
├── Evidence
├── Assumptions
├── Constraints
├── Decisions
├── Actions
├── Observations
├── Dependencies
├── Validations
├── Reconciliations
└── History
```

Not every collection must be non-empty at creation.

The PWU SHALL, however, distinguish:

* absent;
* unknown;
* not yet produced;
* not applicable;
* intentionally omitted.

## 7.3 PWU Types

PWAs MAY define specialized PWU types.

Canonical categories include:

```text
discovery
analysis
design
implementation
verification
validation
decision
research
review
reconciliation
incident
governance
planning
execution
```

## 7.4 PWU Lifecycle

```text
proposed
framing
ready
active
blocked
awaiting_evidence
awaiting_decision
awaiting_review
reconciling
completed
suspended
cancelled
superseded
reopened
```

## 7.5 PWU Completion

Completion SHALL NOT be inferred solely from task execution.

A PWU may be completed only when its declared completion conditions are satisfied.

Completion conditions SHOULD include:

* objective achieved or explicitly abandoned;
* required outputs produced;
* mandatory validations passed;
* significant decisions recorded;
* residual uncertainty documented;
* dependencies resolved or transferred;
* reconciliation completed;
* traceability intact.

## 7.6 Recursive Composition

A PWU MAY contain child PWUs.

Parent-child composition SHALL declare the semantic relationship:

```text
decomposition
delegation
specialization
verification
support
mitigation
reconciliation
```

A parent PWU SHALL NOT be considered coherent merely because child PWUs are individually complete.

Reconstruction or synthesis SHALL occur at the parent boundary.

---

# 8. Recursive Professional Harness Architectural Profile

The Recursive Professional Harness is a coordination mechanism over one or more PWUs.

## 8.1 Canonical Definition

An **RPH** is a recursive coordination system that advances professional cognition through the Professional Cognition Life Cycle while preserving intent, traceability, evidence, responsibility, and coherence.

## 8.2 RPH Responsibilities

An RPH SHALL:

* establish or receive intent;
* frame professional work;
* create or select PWUs;
* allocate participants;
* coordinate dependencies;
* monitor reasoning state;
* invoke tools and agents;
* request validation;
* detect blocking conditions;
* trigger reconciliation;
* escalate unresolved conditions;
* synthesize child work;
* preserve provenance;
* emit observability events.

## 8.3 RPH Non-Responsibilities

An RPH SHALL NOT:

* treat successful tool execution as successful professional reasoning;
* infer professional completion from workflow termination;
* conceal unresolved uncertainty;
* silently rewrite intent;
* discard rejected alternatives without rationale;
* attribute AI output to human authors;
* suppress validation failures;
* collapse disagreement into false consensus.

## 8.4 Recursive Behavior

An RPH MAY create subordinate RPH instances when coordination itself requires bounded professional work.

Every subordinate RPH SHALL possess:

* an originating purpose;
* a parent relationship;
* delegated authority;
* completion or escalation conditions;
* traceability to the parent work context.

## 8.5 Harness Control States

```text
initializing
framing
planning
allocating
executing
observing
validating
reconciling
awaiting_human
awaiting_external
escalating
completed
failed
cancelled
```

Harness state SHALL remain distinct from PWU lifecycle state.

---

# 9. Living Enterprise Model Architectural Profile

## 9.1 Canonical Definition

The **Living Enterprise Model** is the continuously reconciled global projection of the organization’s professional cognition, operating context, commitments, capabilities, evidence, decisions, work, and outcomes.

It is not a single document, graph visualization, or database.

It is the authoritative semantic state produced from CPCO-compliant entities and relationships.

## 9.2 Required Capabilities

The Living Enterprise Model SHALL support queries such as:

* What outcomes is the organization pursuing?
* Which intents justify current work?
* What uncertainty most threatens each outcome?
* Which decisions are pending?
* Which claims lack sufficient evidence?
* Which assumptions are critical and unvalidated?
* Where do representations conflict?
* Which PWUs are blocked and why?
* Which AI agents produced material conclusions?
* Where has confidence changed?
* Which observations contradict current expectations?
* What reconciliation is pending?
* What reasoning led to the current organizational state?

## 9.3 Authority

The Living Enterprise Model is authoritative only to the extent that its inputs are:

* current;
* traceable;
* validated;
* reconciled;
* appropriately governed.

It SHALL expose uncertainty about its own completeness and correctness.

---

# 10. Professional Work Architecture Profile

## 10.1 Canonical Definition

A **Professional Work Architecture** is a domain-specific specialization of CPCO and the Janumi operational model.

A PWA defines:

* domain vocabulary;
* specialized entity subtypes;
* domain relationships;
* domain lifecycle states;
* permissible reasoning methods;
* professional roles;
* artifact types;
* validations;
* policies;
* decision authorities;
* UI projections;
* agent capabilities;
* integration mappings.

## 10.2 PWA Conformance

A PWA SHALL:

* map each domain construct to CPCO primitives or justified extensions;
* preserve CPCO invariants;
* define domain-specific validation;
* identify authoritative external sources;
* distinguish domain truth from organizational decision;
* declare its reconciliation rules;
* declare its observability events;
* declare its human oversight points.

## 10.3 Example

JanumiCode may specialize:

```text
Representation → Requirement
Representation → Architecture Model
Representation → Source Code
Validation → Unit Test
Validation → Integration Test
Observation → Production Telemetry
Decision → Architecture Decision
PWU → Implementation Work Unit
PWU → Verification Work Unit
```

These remain projections of the same professional cognition graph.

---

# 11. Coherence Model

Coherence SHALL be treated as a multi-dimensional property.

## 11.1 Intent Coherence

Degree to which work, representations, decisions, and actions remain aligned with active Intent.

## 11.2 Internal Coherence

Degree to which representations and claims are mutually compatible.

## 11.3 Evidentiary Coherence

Degree to which confidence and decisions are proportionate to available Evidence.

## 11.4 Temporal Coherence

Degree to which the model reflects the relevant current state rather than stale conditions.

## 11.5 Operational Coherence

Degree to which Decisions, Actions, and observed reality remain aligned.

## 11.6 Authority Coherence

Degree to which Decisions were made by authorized Participants under applicable governance.

## 11.7 Cross-PWU Coherence

Degree to which independently conducted work remains compatible when recomposed.

## 11.8 Domain Coherence

Degree to which domain-specific reasoning complies with the governing PWA.

---

# 12. Canonical Invariants

The following invariants are normative.

## INV-001 — Intent Traceability

Every material Decision, Action, Representation, and PWU SHALL trace to at least one active Intent or explicitly declared exploratory purpose.

## INV-002 — Explicit Provenance

Every Claim, Representation, Decision, Evidence item, and Reasoning Activity SHALL identify its origin.

## INV-003 — AI Attribution

Every AI-generated entity SHALL identify the responsible AI Participant, execution context, and relevant model or agent identity.

## INV-004 — Evidence Separation

Evidence SHALL remain distinguishable from the Claim it supports.

## INV-005 — Assumption Visibility

A critical Assumption SHALL NOT remain implicit once detected.

## INV-006 — Decision Rationale

Every material approved Decision SHALL preserve rationale, authority, considered Alternatives, and residual Uncertainty.

## INV-007 — State Explicitness

Lifecycle state SHALL be explicit. Missing fields SHALL NOT imply workflow state.

## INV-008 — Historical Reconstructability

Superseded material entities SHALL remain reconstructable when required for professional reasoning, audit, or governance.

## INV-009 — Validation Before Authority

An entity SHALL NOT be represented as validated, approved, or authoritative without an explicit Validation or Decision establishing that status.

## INV-010 — Observation–Interpretation Separation

Observed facts, interpretations, and derived Claims SHALL remain distinguishable.

## INV-011 — Recursive Traceability

A child PWU SHALL trace to the parent purpose, delegated scope, and recomposition obligation.

## INV-012 — No Completion by Activity Alone

Completion SHALL be determined by professional completion conditions, not merely by execution of planned activities.

## INV-013 — Coherence Conflict Visibility

Detected contradictions SHALL remain visible until resolved, accepted, deferred, or explicitly dismissed.

## INV-014 — Intent Change Explicitness

A change in Intent SHALL produce a new version, superseding relationship, or authorized amendment.

## INV-015 — Confidence Basis

Every material Confidence Assessment SHALL identify its basis.

## INV-016 — Constraint Enforcement

Mandatory Constraints SHALL be evaluated before a conflicting Decision becomes effective.

## INV-017 — Reconciliation Preservation

Reconciliation SHALL preserve both the prior state and the rationale for the updated state.

## INV-018 — Projection Non-Authority

No UI projection, cache, report, or denormalized view SHALL independently become authoritative.

## INV-019 — Human Oversight Availability

Material AI-originated conclusions SHALL remain reviewable by an authorized human unless a PWA explicitly defines a governed autonomous operating mode.

## INV-020 — Escalation of Unresolved Professional Failure

A harness SHALL escalate when its authority, evidence, capability, or search process is insufficient to continue responsibly.

---

# 13. Contradiction Model

Contradictions SHALL be first-class entities or relationships.

## 13.1 Contradiction Types

```text
claim_vs_claim
claim_vs_evidence
representation_vs_representation
representation_vs_reality
decision_vs_constraint
action_vs_intent
observation_vs_expectation
pwu_vs_pwu
policy_vs_policy
authority_vs_authority
```

## 13.2 Contradiction State

```text
detected
confirmed
under_investigation
temporarily_tolerated
resolved
dismissed
escalated
```

## 13.3 Resolution Methods

```text
evidence_precedence
authority_decision
scope_separation
temporal_separation
representation_revision
assumption_invalidation
intent_revision
accepted_tradeoff
```

A contradiction SHALL NOT be erased merely because one representation is newer.

---

# 14. Temporal and Version Model

CPCO SHALL distinguish four forms of time:

## 14.1 Transaction Time

When the platform recorded a fact.

## 14.2 Valid Time

When the fact was considered true or applicable.

## 14.3 Observation Time

When reality was observed.

## 14.4 Decision Effective Time

When a Decision became operative.

This distinction is required because professional understanding may be updated after the fact.

Example:

```text
Observation occurred: July 1
Observation recorded: July 3
Claim revised: July 4
Decision effective: July 6
```

All four times may be relevant.

---

# 15. Event Model

Every material semantic transition SHALL emit a domain event.

## 15.1 Canonical Event Envelope

```text
eventId
eventType
occurredAt
recordedAt
actorId
correlationId
causationId
endeavorId
pwuId
entityId
entityVersion
payload
provenance
```

## 15.2 Core Event Types

```text
IntentCreated
IntentRevised
IntentSuperseded

OutcomeDefined
OutcomeAssessmentChanged

QuestionOpened
QuestionResolved

UncertaintyIdentified
UncertaintyReduced
UncertaintyAccepted

AssumptionCreated
AssumptionValidated
AssumptionInvalidated

ClaimProposed
ClaimSupported
ClaimContested
ClaimRefuted

EvidenceAdded
EvidenceReclassified
EvidenceInvalidated

ReasoningStarted
ReasoningCompleted
ReasoningFailed
ReasoningEscalated

AlternativeIdentified
AlternativeRejected
AlternativeSelected

DecisionProposed
DecisionApproved
DecisionRejected
DecisionReopened
DecisionSuperseded

ActionAuthorized
ActionStarted
ActionCompleted
ActionFailed

ObservationRecorded
UnexpectedObservationDetected

ValidationStarted
ValidationPassed
ValidationFailed
ValidationInconclusive

ContradictionDetected
ContradictionResolved

ReconciliationTriggered
ReconciliationProposed
ReconciliationApplied
ReconciliationEscalated

PWUCreated
PWUActivated
PWUBlocked
PWUCompleted
PWUReopened

HarnessCreated
HarnessDelegated
HarnessAwaitingHuman
HarnessEscalated
HarnessCompleted
HarnessFailed
```

---

# 16. Reference UX Projection Model

The UI SHALL be derived from CPCO entities, PCLC state, user role, and current professional objective.

## 16.1 Canonical Projections

### Outcome Projection

Shows:

* desired outcomes;
* success criteria;
* current assessment;
* threats;
* supporting and conflicting work.

### Intent Projection

Shows:

* active intent;
* rationale;
* constraints;
* non-goals;
* superseded intent;
* affected PWUs.

### Understanding Projection

Shows:

* known claims;
* open questions;
* uncertainty;
* assumptions;
* confidence.

### Reasoning Projection

Shows:

* active reasoning activities;
* inputs;
* methods;
* participants;
* alternatives;
* emerging outputs.

### Evidence Projection

Shows:

* evidence network;
* provenance;
* reliability;
* claims supported or contradicted;
* evidence gaps.

### Decision Projection

Shows:

* pending decisions;
* authority;
* alternatives;
* rationale;
* evidence;
* constraints;
* residual uncertainty.

### Execution Projection

Shows:

* authorized actions;
* execution state;
* produced artifacts;
* affected outcomes;
* operational dependencies.

### Observation Projection

Shows:

* observations;
* expected versus observed state;
* anomalies;
* emerging evidence.

### Reconciliation Projection

Shows:

* detected incoherence;
* affected entities;
* proposed changes;
* downstream impact;
* approval state.

### Decomposition Projection

Shows:

* parent and child PWUs;
* delegated scope;
* dependency structure;
* recomposition obligations;
* local versus global coherence.

## 16.2 Persistent Cognitive Context

Every material workspace SHOULD preserve access to:

```text
currentIntent
currentObjective
currentUncertainty
currentConfidence
currentDependencies
currentParticipants
currentEvidence
currentLifecycleState
pendingReconciliation
```

## 16.3 UI Prohibitions

The interface SHALL NOT:

* present completion percentages without explaining their semantic basis;
* use a single status color as a substitute for professional state;
* hide uncertainty behind generic “in progress” labels;
* merge AI and human contributions without attribution;
* display a Decision without access to rationale;
* display Evidence without provenance;
* display a derived Representation as though it were reality;
* treat folder hierarchy as the primary model of professional cognition.

---

# 17. Agent Interaction Contract

Every AI Participant SHALL operate through an explicit professional contract.

## 17.1 Required Inputs

```text
assignedRole
objective
originatingIntent
scope
authority
constraints
availableEvidence
applicableRepresentations
openQuestions
requiredOutputs
validationCriteria
terminationConditions
escalationConditions
```

## 17.2 Required Outputs

```text
producedEntities
reasoningSummary
assumptionsIntroduced
evidenceUsed
claimsProduced
confidenceAssessments
unresolvedQuestions
residualUncertainty
validationResults
recommendedNextActions
provenance
```

## 17.3 Agent Prohibitions

An AI Participant SHALL NOT:

* silently broaden scope;
* substitute a different Intent;
* represent unsupported Claims as facts;
* hide assumptions;
* mark its own output approved unless explicitly authorized;
* suppress contradictory Evidence;
* infer human approval;
* terminate without recording unresolved material conditions;
* claim outcome achievement based only on artifact production.

---

# 18. Minimum Viable Implementation Profile

The first Janumi implementation need not implement every CPCO entity at maximum sophistication.

A minimum viable compliant implementation SHALL support:

## 18.1 Required Entities

```text
ProfessionalEndeavor
Outcome
Intent
Participant
PWU
Question
Uncertainty
Representation
Assumption
Constraint
Claim
Evidence
ConfidenceAssessment
ReasoningActivity
Decision
Action
Observation
Dependency
Validation
Reconciliation
```

## 18.2 Required Relationships

```text
traces_to_intent
supports
contradicts
depends_on
produced_by
derived_from
justifies
implements
observed_by
validated_by
supersedes
contains
```

## 18.3 Required Platform Behaviors

* explicit provenance;
* explicit lifecycle state;
* parent-child PWU decomposition;
* reasoning and decision traceability;
* evidence-to-claim relationships;
* human and AI attribution;
* validation records;
* contradiction detection;
* reconciliation records;
* event emission;
* role-aware projections.

## 18.4 Required UI Surfaces

* Endeavor overview;
* PWU workspace;
* decomposition view;
* reasoning view;
* evidence view;
* decision view;
* reconciliation view;
* history and provenance view.

---

# 19. Initial Persistence Guidance

CPCO is naturally graph-shaped, but graph semantics do not mandate a graph database.

A practical initial implementation MAY use:

* PostgreSQL for authoritative persistence;
* typed relational entities;
* relationship tables;
* JSONB for subtype-specific properties;
* event log for temporal evolution;
* materialized projections for UI queries;
* search index for retrieval;
* object storage for large Artifacts.

The implementation SHOULD preserve the ability to project the data as a property graph.

## 19.1 Recommended Core Tables

```text
entities
entity_versions
relationships
relationship_versions
participants
endeavors
work_units
events
validations
reconciliations
artifacts
```

## 19.2 Entity Table Pattern

```text
id
entity_type
subtype
endeavor_id
current_version_id
lifecycle_state
validity_state
created_by
created_at
updated_at
```

## 19.3 Version Table Pattern

```text
version_id
entity_id
version_number
payload
valid_from
valid_until
created_by
created_at
change_reason
supersedes_version_id
```

## 19.4 Relationship Table Pattern

```text
relationship_id
relationship_type
source_entity_id
target_entity_id
properties
valid_from
valid_until
created_by
created_at
```

---

# 20. Initial API Guidance

The API SHOULD expose semantic operations rather than CRUD alone.

Examples:

```text
createIntent()
reviseIntent()
identifyUncertainty()
proposeClaim()
attachSupportingEvidence()
contradictClaim()
recordReasoningActivity()
proposeDecision()
approveDecision()
authorizeAction()
recordObservation()
validateEntity()
triggerReconciliation()
decomposePWU()
completePWU()
reopenPWU()
```

Generic CRUD MAY exist internally, but public contracts SHOULD encode professional meaning.

---

# 21. Validation Architecture

Validators SHALL operate at multiple layers.

## 21.1 Structural Validators

Check schema and relationship correctness.

Example:

* a Decision references at least one Intent;
* an Evidence relationship identifies its target Claim.

## 21.2 Semantic Validators

Check conceptual correctness.

Example:

* a deliverable has not been misclassified as an Outcome;
* a Decision has not been represented as a verified fact.

## 21.3 Professional Validators

Check domain-specific practice.

Example:

* a software architecture decision contains required trade-off analysis;
* a legal conclusion cites applicable authority;
* a scientific claim includes appropriate evidence.

## 21.4 Coherence Validators

Check cross-entity alignment.

Example:

* implementation does not violate architecture;
* test strategy covers material requirements;
* current work remains aligned with active Intent.

## 21.5 Governance Validators

Check authority and policy.

Example:

* the approving Participant possesses required authority;
* a regulated change received required review.

## 21.6 Temporal Validators

Check currency and validity.

Example:

* Evidence has not expired;
* a Constraint reflects the current regulation;
* a Representation is not based on a superseded Intent.

---

# 22. Observability Model

Janumi SHALL emit observability data for both computational execution and professional cognition.

## 22.1 Computational Observability

```text
latency
errors
retries
tool_calls
token_usage
resource_usage
workflow_state
```

## 22.2 Cognitive Observability

```text
open_uncertainty_count
critical_assumption_count
unsupported_claim_count
confidence_change
decision_wait_time
evidence_gap_count
contradiction_count
reconciliation_backlog
blocked_dependency_count
intent_drift_score
validation_failure_count
human_review_backlog
```

## 22.3 Coherence Signals

A coherence signal SHALL explain its basis.

A single synthetic coherence score MAY be provided for orientation, but SHALL NOT replace the underlying dimensions.

---

# 23. Semantic Boundary Rules

The following distinctions SHALL remain explicit throughout the platform.

```text
Outcome ≠ Artifact
Intent ≠ Requirement
Question ≠ Uncertainty
Observation ≠ Evidence
Evidence ≠ Claim
Claim ≠ Decision
Decision ≠ Truth
Decision ≠ Action
Action ≠ Outcome
Representation ≠ Reality
Participant ≠ Stakeholder
Ownership ≠ Authority
Completion ≠ Validation
Validation ≠ Approval
Confidence ≠ Certainty
PWU ≠ Task
RPH ≠ Workflow Engine
Narrative Memory ≠ Source of Truth
UI Projection ≠ Authoritative Model
```

These distinctions are essential to prevent conventional project-management or document-management semantics from re-entering the architecture.

---

# 24. Implementation Decision Rules

When an engineer or coding agent encounters an ambiguous design decision, it SHALL apply the following sequence:

1. Identify the professional outcome being supported.
2. Identify the active Intent.
3. Identify the professional uncertainty or decision involved.
4. Identify the CPCO entities being created, transformed, or inspected.
5. Identify the relevant lifecycle state.
6. Identify the required provenance and validation.
7. Identify the coherence implications.
8. Determine the appropriate PWU boundary.
9. Determine whether RPH coordination is required.
10. Select the UI projection that best supports the cognitive activity.
11. Implement the narrowest mechanism that satisfies these semantics.
12. Reject conventional UI or workflow patterns that obscure the model.

---

# 25. Conformance Test

A Janumi implementation is CPCO-conformant only if it can answer, for every material professional object:

* What is this?
* Why does it exist?
* Which Intent does it serve?
* Which Outcome does it affect?
* Who or what created it?
* What Evidence supports it?
* Which Assumptions does it depend on?
* What is its current validity?
* What uncertainty remains?
* What decisions depend upon it?
* What changed it?
* What has superseded it?
* What reconciliation has occurred?
* How does it relate to its parent and dependent work?
* Can its reasoning history be reconstructed?

An implementation that cannot answer these questions may store professional artifacts, but it does not yet represent professional cognition.

---

# 26. Immediate Engineering Consequences

The coding agent implementing the Janumi UI/UX SHALL now work from the following architecture:

```text
CPCO Semantic Model
        ↓
PWU Aggregate Model
        ↓
RPH Coordination Model
        ↓
PCLC State
        ↓
Role- and Purpose-Specific Projection
        ↓
UI Components
```

It SHALL NOT begin from:

```text
Pages
  ↓
Components
  ↓
Forms
  ↓
Backend Tables
```

The primary frontend abstraction is therefore not the page.

It is the **Cognitive Projection**.

The primary backend abstraction is not the task.

It is the **Versioned Cognitive Entity and Relationship**.

The primary orchestration abstraction is not the workflow step.

It is the **Professionally Meaningful State Transition**.

The primary validation abstraction is not schema compliance.

It is the **Preservation of Professional Coherence**.

---

# 27. Next Normative Artifacts

This specification establishes the semantic source of truth. The next engineering artifacts shall be derived in this order:

1. **CPCO Machine Schema**

   * entity definitions;
   * relationship definitions;
   * enums;
   * validation constraints;
   * JSON Schema or equivalent.

2. **PWU Aggregate Specification**

   * commands;
   * lifecycle transitions;
   * completion rules;
   * decomposition and recomposition behavior.

3. **RPH Coordination Specification**

   * control states;
   * orchestration policies;
   * escalation;
   * retry and tactic-change logic;
   * human intervention points.

4. **Reference Interaction Model**

   * cognitive projections;
   * navigation;
   * zoom;
   * context preservation;
   * cross-projection transitions.

5. **Reference UI Specification**

   * shell;
   * workspace anatomy;
   * component semantics;
   * interaction invariants;
   * responsive profiles.

6. **JanumiCode PWA Profile**

   * requirements;
   * architecture;
   * implementation;
   * verification;
   * release;
   * operational feedback.

---

# Closing Statement

CPCO establishes the core architectural truth of Janumi:

> Professional work is not fundamentally a collection of tasks, documents, or workflows. It is an evolving, distributed, evidence-bearing system of intent, uncertainty, representations, reasoning, decisions, actions, observations, and reconciliation.

Professional Work Units bound that cognition.

Recursive Professional Harnesses coordinate it.

Professional Work Architectures specialize it.

The Living Enterprise Model projects its current global state.

The Janumi interface makes it inspectable and operable.

Continuous reconciliation keeps it coherent.
