# Shape Engineering Handbook

## Method for Designing Professional Work Architectures

**Document ID:** `JAN-SEH-001`
**Version:** `0.1.0`
**Status:** Draft
**Specification:** SEH v0.1.0
**Applies to:** Janumi Professional Workbench, Professional Work Architecture authors, domain experts, systems engineers, AI agents, ontology designers, validator developers, UX architects, and platform engineers
**Produces:** A validated Professional Work Architecture encoded in JSDL and suitable for execution through the Janumi Platform

---

# 1. Purpose

Shape Engineering is the disciplined method by which an underspecified professional domain, outcome, or operating concept is transformed into an explicit, executable Professional Work Architecture.

It governs the creation of domain architectures such as:

* JanumiCode;
* JanumiScience;
* JanumiLegal;
* JanumiConstruction;
* JanumiHealthcare;
* JanumiFinance;
* JanumiGovernment;
* future domain-specific professional environments.

Shape Engineering converts professional practice into:

* explicit outcomes;
* semantic models;
* professional roles;
* authority structures;
* representations;
* reasoning patterns;
* Professional Work Units;
* Recursive Professional Harness behaviors;
* validators;
* projections;
* interaction contracts;
* executable JSDL definitions.

The method is not limited to documenting how a profession currently operates.

It may also define how a profession should operate within an AI-native professional organization.

---

# 2. Central Proposition

A Professional Work Architecture cannot be designed by beginning with screens, workflows, agents, or database entities.

It must be derived from the professional reality it is intended to support.

The canonical derivation is:

```text
Professional Domain
        ↓
Desired Outcomes
        ↓
Professional Cognition
        ↓
Semantic Model
        ↓
Work and Coordination Model
        ↓
Validation and Governance
        ↓
Experience Model
        ↓
JSDL
        ↓
Executable Platform
```

Shape Engineering preserves this direction.

---

# 3. Definition

**Shape Engineering** is:

> The recursive process of discovering, formalizing, testing, and refining the semantic, cognitive, operational, and experiential structure required to achieve professional outcomes coherently through coordinated human and artificial reasoning.

The resulting “shape” is not merely a process diagram.

It includes:

* what exists;
* why it exists;
* how it changes;
* who has authority;
* what evidence matters;
* how uncertainty is reduced;
* how work decomposes;
* how understanding is reconstructed;
* how correctness is evaluated;
* how the professional environment is experienced;
* how the model becomes executable.

---

# 4. Shape Engineering Outputs

A complete Shape Engineering effort SHALL produce:

1. Domain Characterization;
2. Outcome Model;
3. Stakeholder and Participant Model;
4. Professional Cognition Model;
5. Domain Ontology Profile;
6. Representation Catalog;
7. Decision, Evidence, and Confidence Model;
8. Assumption, Constraint, Risk, and Invariant Model;
9. Professional Work Unit Catalog;
10. Recursive Professional Harness Model;
11. Professional Cognition Lifecycle Profile;
12. Validation and Governance Model;
13. Projection and Workspace Model;
14. Integration and Observation Model;
15. JSDL Module Set;
16. Conformance Test Suite;
17. Reference Operational Scenarios;
18. Implementation and Evolution Plan.

A PWA is not complete merely because its entities and screens have been named.

---

# 5. Method Principles

## 5.1 Outcomes Before Artifacts

Begin with desired changes in reality.

Do not begin with:

* forms;
* documents;
* tasks;
* dashboards;
* agent roles;
* existing software modules.

## 5.2 Cognition Before Workflow

Identify what professionals must understand, decide, validate, and reconcile before describing process steps.

## 5.3 Semantics Before Technology

Define professional meaning before selecting databases, APIs, UI frameworks, or models.

## 5.4 Explicit Uncertainty

Unknowns, assumptions, disagreement, and incomplete knowledge are first-class design inputs.

## 5.5 Recursive Decomposition

Large professional responsibilities are decomposed until each unit is professionally coherent and governable.

## 5.6 Reconstruction Obligation

Every decomposition creates an explicit synthesis and recomposition obligation.

## 5.7 Human–AI Symmetry

Human and artificial Participants are modeled through the same professional obligations while preserving differences in authority, capability, and accountability.

## 5.8 Evidence-Bearing Design

Claims, recommendations, and Decisions remain connected to Evidence and confidence.

## 5.9 Continuous Reconciliation

The PWA must define how professional understanding changes when reality, Intent, policy, or Evidence changes.

## 5.10 Executability

The final architecture must be precise enough to encode in JSDL and validate mechanically.

---

# 6. Shape Engineering Lifecycle

The canonical Shape Engineering lifecycle contains ten phases:

```text
1. Frame
2. Observe
3. Model Outcomes
4. Model Cognition
5. Model Work
6. Model Governance
7. Model Experience
8. Encode
9. Validate
10. Operationalize and Evolve
```

The phases are recursive rather than strictly sequential.

Later discoveries may reopen earlier phases.

---

# 7. Phase 1 — Frame the Domain

## 7.1 Purpose

Establish what professional domain or capability is being architected and why.

## 7.2 Core Questions

* What profession, professional capability, or outcome is in scope?
* Is the architecture describing current practice, desired future practice, or both?
* What operating environments are included?
* Which parts of the profession are excluded?
* What motivates creation of the PWA?
* Who possesses authority to define or approve it?
* Which risks arise if the domain is modeled incorrectly?

## 7.3 Required Deliverables

```text
PWA Charter
Domain Boundary Statement
Initial Intent
Initial Outcomes
Scope and Non-Goals
Authority and Sponsorship
Initial Assumptions
Initial Constraints
Known Domain Sources
```

## 7.4 Domain Boundary Statement

The boundary statement SHALL identify:

```text
includedProfessionalActivities
excludedProfessionalActivities
organizationalScope
jurisdictionalScope
operatingContexts
intendedUsers
timeHorizon
integrationBoundaries
```

## 7.5 Exploratory Versus Normative Mode

The effort SHALL declare whether it is:

```text
descriptive
normative
transformational
hybrid
```

### Descriptive

Models how professional work currently occurs.

### Normative

Defines how work should occur.

### Transformational

Defines a materially new AI-native operating model.

### Hybrid

Preserves selected current practices while redesigning others.

## 7.6 Phase Gate

The phase may complete when:

* the domain boundary is intelligible;
* initial outcomes are identified;
* authority is known;
* major exclusions are explicit;
* unresolved framing questions are recorded.

---

# 8. Phase 2 — Observe Professional Reality

## 8.1 Purpose

Understand the profession as actually practiced rather than relying solely on idealized process descriptions.

## 8.2 Observation Sources

```text
interviews
job_shadowing
existing_documents
regulations
standards
case_files
incident_history
operational_data
training_material
professional_literature
software_tools
decision_records
reviews
audits
```

## 8.3 What to Observe

* actual outcomes sought;
* recurring questions;
* decisions;
* handoffs;
* informal workarounds;
* evidence use;
* sources of delay;
* sources of disagreement;
* recurring failures;
* authority boundaries;
* hidden assumptions;
* document and tool fragmentation;
* reconstruction work;
* professional judgment;
* exceptional cases.

## 8.4 Activity Versus Cognition

Observers SHALL distinguish:

```text
What people do
```

from:

```text
What people are trying to understand or decide
```

Example:

```text
Activity: Review a contract.
Cognition: Determine whether obligations, rights, and risks are acceptable.
```

The latter is more important to the PWA.

## 8.5 Professional Failure Dynamics

The observation effort SHOULD identify recurring failure dynamics such as:

* intent drift;
* fragmented knowledge;
* contradictory representations;
* unsupported conclusions;
* authority ambiguity;
* lost rationale;
* stale evidence;
* premature closure;
* insufficient validation;
* local optimization;
* failed recomposition;
* delayed escalation.

## 8.6 Deliverables

```text
Professional Observation Record
Current-State Practice Map
Tool and Repository Map
Decision Inventory
Evidence Inventory
Failure-Dynamics Catalog
Informal Practice Catalog
Domain Vocabulary
Open Questions
```

## 8.7 Phase Gate

The phase may complete when the team can explain:

* how work really occurs;
* how it differs from official descriptions;
* where cognition resides;
* where coherence is lost;
* which professional judgments are difficult to automate.

---

# 9. Phase 3 — Model Outcomes

## 9.1 Purpose

Define the desired changes in reality that justify the PWA.

## 9.2 Outcome Hierarchy

Outcomes MAY be organized as:

```text
Societal or Mission Outcome
    ↓
Organizational Outcome
    ↓
Professional Outcome
    ↓
Intermediate Outcome
    ↓
Enabling Outcome
```

## 9.3 Outcome Definition

Each material Outcome SHALL identify:

```text
description
beneficiary
successCriteria
evaluationMethod
timeHorizon
negativeOutcomesToAvoid
affectedStakeholders
currentConfidence
```

## 9.4 Outcome Versus Deliverable

The methodology SHALL challenge proposed outcomes that are actually deliverables.

Example:

```text
Deliverable: Submit a compliance package.
Outcome: Demonstrate and sustain compliance with applicable controls.
```

## 9.5 Outcome Conflict

Conflicting Outcomes SHALL be explicit.

Examples:

* speed versus assurance;
* cost versus resilience;
* autonomy versus oversight;
* privacy versus observability;
* local optimization versus enterprise coherence.

## 9.6 Outcome Trace

Every subsequent PWA construct SHALL be traceable to one or more Outcomes or to an explicit exploratory purpose.

## 9.7 Deliverables

```text
Outcome Catalog
Outcome Hierarchy
Success-Criteria Model
Outcome Conflict Matrix
Outcome Evidence Plan
Outcome Traceability Baseline
```

## 9.8 Phase Gate

The phase completes when:

* Outcomes are not merely artifacts;
* success can be evaluated;
* conflicts are visible;
* beneficiaries and affected parties are known;
* downstream work can trace to Outcomes.

---

# 10. Phase 4 — Model Professional Cognition

## 10.1 Purpose

Identify how the profession transforms uncertainty into justified action.

## 10.2 Cognitive Inventory

For each major professional responsibility, identify:

```text
Intent
Questions
Uncertainties
Representations
Claims
Assumptions
Evidence
Alternatives
Decisions
Actions
Observations
Reconciliation
```

## 10.3 Question Modeling

Questions SHOULD be classified as:

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

## 10.4 Uncertainty Modeling

Identify:

* what is unknown;
* what cannot be known precisely;
* what is disputed;
* what depends on interpretation;
* what changes over time;
* what level of uncertainty is acceptable.

## 10.5 Reasoning Pattern Catalog

Common reasoning patterns may include:

```text
diagnosis
comparison
trade_study
risk_analysis
classification
forecasting
design
interpretation
verification
validation
causal_analysis
simulation
reconciliation
```

## 10.6 Decision Inventory

For each material Decision, identify:

```text
decisionQuestion
authority
inputs
alternatives
criteria
evidence
assumptions
constraints
residualUncertainty
revisitTriggers
```

## 10.7 Evidence Model

Identify:

* what counts as Evidence;
* source authority;
* reliability;
* freshness;
* admissibility;
* required corroboration;
* conflicting Evidence treatment;
* expiration.

## 10.8 Confidence Model

The PWA SHALL define how confidence is expressed.

Options include:

```text
ordinal
probabilistic
interval
assurance_level
evidence_grade
domain_specific_scale
```

## 10.9 Deliverables

```text
Professional Cognition Map
Question Catalog
Uncertainty Taxonomy
Reasoning Pattern Catalog
Decision Catalog
Evidence Model
Confidence Model
Reconciliation Trigger Catalog
```

## 10.10 Phase Gate

The phase completes when the architecture can explain:

* what professionals reason about;
* what they decide;
* what Evidence matters;
* what uncertainty remains;
* what causes earlier conclusions to reopen.

---

# 11. Phase 5 — Model the Domain Ontology

## 11.1 Purpose

Specialize CPCO for the domain without duplicating or weakening canonical semantics.

## 11.2 Ontology Mapping

Each domain concept SHALL be mapped to:

* a CPCO primitive;
* a specialization;
* a relationship;
* a value object;
* or a justified new canonical proposal.

## 11.3 Mapping Table

A reference mapping table:

| Domain concept         | CPCO mapping                | Specialization        | Notes                              |
| ---------------------- | --------------------------- | --------------------- | ---------------------------------- |
| Legal opinion          | Claim and Representation    | LegalOpinion          | Carries jurisdiction and authority |
| Clinical test result   | Evidence and Observation    | ClinicalTestResult    | Observation may become Evidence    |
| Construction submittal | Representation and Artifact | ConstructionSubmittal | Requires review lifecycle          |
| Software requirement   | Representation              | Requirement           | Includes verification method       |

## 11.4 New-Concept Test

Before introducing a new canonical entity, ask:

1. Can it be represented through an existing CPCO entity?
2. Can specialization preserve its meaning?
3. Can a relationship express the distinction?
4. Is the distinction semantic or merely presentational?
5. Does the concept possess independent identity and lifecycle?

## 11.5 Vocabulary Governance

The PWA SHALL define:

* preferred terms;
* synonyms;
* prohibited ambiguous terms;
* domain-specific meanings;
* mappings to external standards.

## 11.6 Deliverables

```text
Domain Ontology Profile
CPCO Mapping Matrix
Entity Definitions
Relationship Definitions
Value Objects
Enumerations
Vocabulary and Synonym Catalog
Extension Justification Record
```

## 11.7 Phase Gate

The phase completes when:

* all material domain concepts have semantic homes;
* synonyms do not create duplicate truth;
* entity identity is clear;
* relationships are explicit;
* CPCO invariants remain intact.

---

# 12. Phase 6 — Model Professional Representations

## 12.1 Purpose

Identify the external cognitive structures through which professional understanding is expressed.

## 12.2 Representation Inventory

For each Representation, identify:

```text
name
professionalPurpose
owner
audience
inputs
semanticContent
lifecycle
authority
validation
versioning
relationships
artifactForms
```

## 12.3 Representation Questions

* What uncertainty does this Representation reduce?
* Which Decisions does it support?
* What does it claim to represent?
* How can it become stale?
* What depends upon it?
* Who may revise it?
* How is it validated?
* What happens when reality contradicts it?

## 12.4 Artifact Separation

The PWA SHALL distinguish Representation from Artifact.

One Representation may be embodied in:

* a document;
* a database record;
* a diagram;
* source code;
* a model;
* an external system.

## 12.5 Authority Model

The PWA SHALL identify whether a Representation is:

```text
draft
proposed
reviewed
validated
approved
authoritative
superseded
stale
disputed
```

These states SHALL not be inferred from storage location.

## 12.6 Deliverables

```text
Representation Catalog
Representation Lifecycle Models
Artifact Mapping
Authority Matrix
Validation Requirements
Staleness and Reconciliation Rules
```

## 12.7 Phase Gate

The phase completes when each major Representation has:

* a professional purpose;
* an authority model;
* validation;
* provenance;
* traceability;
* reconciliation rules.

---

# 13. Phase 7 — Model Assumptions, Constraints, Risks, and Invariants

## 13.1 Purpose

Expose the conditions upon which professional reasoning and acceptable outcomes depend.

## 13.2 Assumption Analysis

Assumptions SHALL be identified in:

* Intent;
* Outcomes;
* domain understanding;
* methods;
* evidence interpretation;
* resource plans;
* operating environments;
* AI capabilities;
* organizational authority.

## 13.3 Assumption Properties

```text
statement
basis
scope
criticality
validationMethod
dependentEntities
failureConsequences
status
```

## 13.4 Constraint Model

Constraints SHOULD be classified as:

```text
legal
regulatory
ethical
professional
technical
physical
financial
resource
schedule
organizational
contractual
security
safety
```

## 13.5 Risk Model

Each Risk SHALL connect:

```text
cause
uncertainty
potentialEffect
affectedOutcome
likelihood
impact
mitigation
observation
owner
```

## 13.6 Invariant Discovery

Invariants should be derived from:

* unacceptable Outcome failures;
* business or professional rules;
* safety obligations;
* authority boundaries;
* data integrity;
* ethical obligations;
* security properties;
* required continuity;
* irreversibility concerns.

## 13.7 Invariant Enforcement Map

Each critical invariant SHOULD map to:

```text
specification
implementation
verification
operationalObservation
violationResponse
```

## 13.8 Deliverables

```text
Assumption Register
Constraint Catalog
Risk Model
Invariant Catalog
Invariant Enforcement Matrix
Violation and Reconciliation Rules
```

## 13.9 Phase Gate

The phase completes when:

* critical assumptions are visible;
* mandatory constraints are enforceable;
* risks trace to Outcomes;
* critical invariants have enforcement and verification strategies.

---

# 14. Phase 8 — Derive Professional Work Units

## 14.1 Purpose

Define the smallest governable regions of professionally meaningful cognition.

## 14.2 PWU Derivation Questions

A candidate PWU should answer:

* What professional objective governs it?
* Which uncertainty or obligation does it address?
* Can responsibility be delegated coherently?
* Can completion be evaluated professionally?
* Does it produce meaningful outputs?
* Can its reasoning be reconstructed?
* Can it be recomposed into larger work?

## 14.3 PWU Boundary Tests

A candidate PWU is too broad when:

* it contains unrelated professional objectives;
* authority differs materially within it;
* independent validation is required;
* context exceeds responsible reasoning limits;
* completion cannot be assessed as one unit.

A candidate PWU is too narrow when:

* it is merely a mechanical step;
* it lacks a meaningful professional objective;
* it exists only because of implementation structure;
* it cannot be understood without hidden parent context;
* its output has no independent professional significance.

## 14.4 PWU Type Definition

Each PWU type SHALL define:

```text
name
professionalObjectivePattern
applicableCognitiveStates
requiredInputs
requiredOutputs
roles
authority
completionConditions
validationRequirements
decompositionRules
recompositionRules
escalationConditions
```

## 14.5 Delegation Contract

Each child PWU SHALL receive:

```text
delegatedObjective
scope
nonGoals
authority
constraints
inputs
outputs
completionConditions
escalationConditions
recompositionObligation
```

## 14.6 Deliverables

```text
PWU Type Catalog
PWU Lifecycle Specializations
Delegation Templates
Completion Rules
Decomposition Rules
Recomposition Rules
Escalation Rules
```

## 14.7 Phase Gate

The phase completes when PWUs are:

* professionally meaningful;
* bounded;
* governable;
* traceable;
* validatable;
* recursively composable.

---

# 15. Phase 9 — Derive Recursive Professional Harness Behavior

## 15.1 Purpose

Define how professional work is framed, allocated, coordinated, observed, synthesized, and escalated.

## 15.2 RPH Responsibilities

For the domain, identify:

* what the harness monitors;
* how work is created;
* how Participants are selected;
* how dependencies are coordinated;
* how progress is measured;
* when tactics change;
* when humans intervene;
* how child results are synthesized;
* when escalation is mandatory.

## 15.3 Allocation Model

The PWA SHOULD define suitability criteria for:

```text
human
AI_agent
team
external_system
specialist
subordinate_RPH
```

## 15.4 Progress Model

Professional progress SHALL be domain-specific.

Examples:

* diagnostic uncertainty reduction;
* evidence sufficiency;
* design maturity;
* review completion;
* regulatory assurance;
* construction readiness;
* verification coverage.

## 15.5 Tactic-Change Model

Define indicators such as:

```text
repeatedFailure
noUncertaintyReduction
evidenceContradiction
methodInvalidation
authorityBlock
resourceExhaustion
searchOscillation
excessiveCoordinationCost
```

## 15.6 Escalation Model

Define:

* triggers;
* recipient authority;
* escalation package;
* response options;
* deadlines;
* consequences of delay.

## 15.7 Deliverables

```text
RPH Responsibility Model
Coordination State Model
Allocation Policy
Progress Measures
Tactic-Change Policy
Escalation Policy
Synthesis Model
Resource Governance
```

## 15.8 Phase Gate

The phase completes when the architecture explains how professional work progresses even when:

* plans fail;
* Evidence changes;
* agents stall;
* authority is insufficient;
* child results conflict.

---

# 16. Phase 10 — Define Validation and Governance

## 16.1 Purpose

Define what correctness, sufficiency, authority, and acceptable risk mean in the domain.

## 16.2 Validator Categories

The PWA SHALL consider:

```text
structural
semantic
professional
methodological
evidentiary
coherence
governance
legal
regulatory
ethical
security
safety
temporal
outcome
```

## 16.3 Validator Definition

Each Validator SHALL identify:

```text
professionalPurpose
subject
criteria
inputs
method
performer
independence
resultScale
blockingEffect
expiration
limitations
```

## 16.4 Human and AI Validation

The architecture SHALL define:

* which Validators may be automated;
* which may be AI-assisted;
* which require human judgment;
* which require independent authority;
* when human review is mandatory.

## 16.5 Decision Authority

The PWA SHALL define authority for:

* proposing;
* reviewing;
* validating;
* approving;
* granting exceptions;
* accepting risk;
* changing Intent;
* terminating work.

## 16.6 Governance Matrix

A reference matrix:

| Action                    | Contributor | Reviewer | Validator | Approver | Exception Authority |
| ------------------------- | ----------: | -------: | --------: | -------: | ------------------: |
| Propose representation    |         Yes |      Yes |       Yes |      Yes |                 Yes |
| Validate representation   |          No | Optional |       Yes | Optional |            Optional |
| Approve decision          |          No |       No |        No |      Yes |                 Yes |
| Grant mandatory exception |          No |       No |        No |       No |                 Yes |

## 16.7 Deliverables

```text
Validator Catalog
Validator Dependency Graph
Authority Matrix
Role Conflict Rules
Approval Policies
Exception Policies
Risk-Acceptance Rules
Governance Events
```

## 16.8 Phase Gate

The phase completes when:

* authority is explicit;
* validation is not confused with approval;
* exception handling is governed;
* AI authority is bounded;
* professional sufficiency can be evaluated.

---

# 17. Phase 11 — Define Projections and Workspaces

## 17.1 Purpose

Define how Participants experience professional cognition.

## 17.2 Projection Derivation

Each projection SHALL begin with a professional question.

Examples:

* What remains uncertain?
* Is this Decision ready?
* What Evidence supports this conclusion?
* Where has professional coherence been lost?
* Which work requires my authority?
* What changed in our understanding?

## 17.3 Projection Contract

Each projection SHALL define:

```text
purpose
rootEntities
includedRelationships
filters
temporalMode
roleRules
authorityRules
requiredDisclosures
commands
stalenessRules
```

## 17.4 Workspace Model

Workspaces SHOULD map to cognitive activities rather than existing software modules.

Canonical workspace classes include:

```text
Outcome
Intent
Understanding
Reasoning
Evidence
Decision
Execution
Observation
Reconciliation
Coordination
Memory
```

## 17.5 Surface Profiles

Define semantic adaptations for:

```text
web
desktop
mobile
IDE
field
conversational
external_exchange
```

## 17.6 Attention Model

Define what requires professional attention and how it is prioritized.

## 17.7 Deliverables

```text
Projection Catalog
Workspace Inventory
Interaction Grammar
Role-Based Experience Model
Attention Model
Surface Profiles
UI Semantic Invariants
```

## 17.8 Phase Gate

The phase completes when every major screen or workspace can answer:

* which professional cognition it exposes;
* which Decisions it supports;
* what authority applies;
* which source entities make it authoritative.

---

# 18. Phase 12 — Define Integrations and Observation

## 18.1 Purpose

Connect the PWA to external reality and repositories.

## 18.2 Integration Inventory

Identify:

* authoritative external systems;
* external evidence sources;
* document repositories;
* operational systems;
* communication systems;
* identity systems;
* execution systems;
* regulatory sources;
* telemetry systems.

## 18.3 Integration Classification

Each integration SHALL identify whether it provides:

```text
Observation
Evidence
Artifact
Representation
Command
Action
Identity
Authority
Notification
```

## 18.4 Trust Boundary

For each integration, define:

* authentication;
* authorization;
* source authority;
* data validity;
* freshness;
* failure behavior;
* normalization;
* reconciliation;
* audit.

## 18.5 Observation Model

Define how the profession learns from reality.

Examples:

* test results;
* field inspections;
* production telemetry;
* client response;
* scientific measurements;
* court outcomes;
* health outcomes;
* construction progress.

## 18.6 Deliverables

```text
Integration Catalog
Authority and Source Map
Trust-Boundary Model
Observation Catalog
External Event Model
Normalization Rules
Failure and Reconciliation Rules
```

## 18.7 Phase Gate

The phase completes when external systems no longer appear as generic “integrations,” but as explicit sources of professional state and action.

---

# 19. Phase 13 — Encode the PWA in JSDL

## 19.1 Purpose

Transform the validated architecture into executable semantic definitions.

## 19.2 Recommended Module Structure

```text
janumi.pwa.<domain>.core
janumi.pwa.<domain>.ontology
janumi.pwa.<domain>.representations
janumi.pwa.<domain>.work
janumi.pwa.<domain>.coordination
janumi.pwa.<domain>.validators
janumi.pwa.<domain>.governance
janumi.pwa.<domain>.projections
janumi.pwa.<domain>.integrations
janumi.pwa.<domain>.observability
```

## 19.3 Encoding Order

Recommended order:

1. enums and value objects;
2. entities and extensions;
3. relationships;
4. lifecycles;
5. aggregates;
6. invariants;
7. validators;
8. permissions;
9. commands;
10. events;
11. projections;
12. observability;
13. test cases.

## 19.4 Source Traceability

Every JSDL declaration SHOULD trace to its Shape Engineering source decision or deliverable.

Example:

```yaml
annotations:
  shapeEngineeringSource:
    phase: professional_cognition
    decisionId: SE-DEC-024
    evidenceIds:
      - EV-102
      - EV-119
```

## 19.5 Deliverables

```text
JSDL Module Set
Module Dependency Graph
Compiler Diagnostics Baseline
Generated Type Contracts
Generated Schemas
Generated Documentation
Generated Projection Metadata
```

## 19.6 Phase Gate

The phase completes when:

* JSDL compiles;
* semantic references resolve;
* invariants validate;
* generated artifacts are deterministic;
* no material design concept exists only in prose.

---

# 20. Phase 14 — Validate the Professional Work Architecture

## 20.1 Purpose

Determine whether the PWA faithfully and usefully represents the profession.

## 20.2 Validation Layers

### Structural Validation

Does the PWA compile and satisfy CPCO and JSDL constraints?

### Semantic Validation

Do entities and relationships mean what the domain requires?

### Professional Validation

Do domain experts recognize the architecture as credible?

### Operational Validation

Can realistic work be performed through it?

### Cognitive Validation

Does it expose the reasoning professionals need?

### Governance Validation

Are authority and accountability correctly represented?

### Experience Validation

Do workspaces support professional decisions rather than software navigation?

### Outcome Validation

Does the architecture improve ability to achieve Outcomes?

## 20.3 Scenario Testing

The PWA SHALL be tested against:

```text
routine_case
complex_case
exception_case
failure_case
conflicting_evidence_case
authority_gap_case
cross_functional_case
long_running_case
reopened_case
operational_feedback_case
```

## 20.4 Adversarial Review

Reviewers SHOULD attempt to identify:

* missing concepts;
* misleading abstractions;
* circular definitions;
* overfit workflows;
* hidden assumptions;
* untestable validators;
* authority gaps;
* AI overreach;
* unbounded recursion;
* excessive complexity;
* missing reconciliation.

## 20.5 Deliverables

```text
PWA Conformance Report
Scenario Test Results
Expert Review Record
Gap and Contradiction Register
Usability Findings
Governance Findings
Revision Decisions
```

## 20.6 Phase Gate

The phase completes when:

* representative scenarios can be executed coherently;
* professional experts accept core semantics;
* critical gaps are resolved or explicitly deferred;
* implementation risks are known.

---

# 21. Phase 15 — Operationalize and Evolve

## 21.1 Purpose

Deploy the PWA as a living professional system and improve it through observed use.

## 21.2 Initial Operating Profile

Define:

* initial users;
* supported scenarios;
* unsupported scenarios;
* required human oversight;
* AI capabilities;
* integration scope;
* operational metrics;
* escalation support;
* feedback channels.

## 21.3 PWA Observation

The PWA itself SHALL be observed.

Potential signals include:

```text
frequent_reopened_work
validator_false_positive
validator_false_negative
authority_bottleneck
projection_avoidance
manual_workaround
unmodeled_concept
excessive_decomposition
failed_recomposition
agent_context_failure
reconciliation_backlog
```

## 21.4 PWA Evolution

Changes to the PWA SHALL use:

* versioned Shape Engineering Decisions;
* JSDL model diff;
* compatibility analysis;
* semantic migration;
* validation;
* release governance.

## 21.5 Deliverables

```text
Operating Profile
PWA Observability Model
Evolution Backlog
Semantic Version Policy
Migration Strategy
Feedback and Reconciliation Process
```

---

# 22. Shape Engineering Roles

A Shape Engineering team may include:

```text
domain_sponsor
professional_domain_expert
shape_engineer
systems_engineer
ontology_architect
work_architect
governance_architect
validator_designer
ux_architect
AI_agent_architect
platform_architect
integration_architect
security_reviewer
professional_reviewer
```

One person may fill several roles for a small PWA.

---

# 23. Shape Engineer

The Shape Engineer is responsible for maintaining coherence across the PWA design.

The role SHALL:

* preserve Outcome orientation;
* distinguish cognition from activity;
* maintain CPCO alignment;
* surface hidden assumptions;
* identify decomposition and reconstruction obligations;
* connect domain semantics to JSDL;
* prevent UI-first or workflow-first drift;
* coordinate validation.

The Shape Engineer is not required to be the sole domain expert.

---

# 24. AI Participation in Shape Engineering

AI Agents may support:

```text
domain_research
vocabulary_extraction
decision_inventory
assumption_surfacing
failure_mode_analysis
ontology_mapping
representation_cataloging
PWU_candidate_generation
validator_generation
scenario_generation
contradiction_detection
JSDL_generation
documentation_generation
```

AI-generated Shape Engineering outputs SHALL remain proposed until appropriately reviewed.

---

# 25. Shape Engineering PWUs

The Shape Engineering effort should itself be represented through PWUs.

Canonical types include:

```text
domain_framing
professional_observation
outcome_modeling
cognition_modeling
ontology_modeling
representation_modeling
invariant_modeling
pwu_design
rph_design
governance_design
projection_design
integration_design
jsdl_encoding
pwa_validation
pwa_operationalization
```

This makes PWA creation an instance of the same professional cognition model it produces.

---

# 26. Shape Engineering Decision Record

Material design choices SHALL be preserved.

A Shape Engineering Decision SHOULD include:

```text
decisionQuestion
professionalContext
alternatives
selectedApproach
rationale
evidence
assumptions
constraints
consequences
affectedPwaElements
revisitTriggers
```

Examples:

* whether a concept should be an entity or relationship;
* whether a process requires independent validation;
* whether an AI Agent may approve;
* whether two PWU types should be merged;
* whether a domain-specific confidence scale is required.

---

# 27. Professional Work Architecture Charter

A PWA Charter SHOULD include:

```text
PWA Name
Domain
Mission
Intended Outcomes
Target Professionals
Target Organizations
Operating Contexts
Scope
Non-Goals
Authority
Transformation Ambition
Initial AI Role
Critical Risks
Success Criteria
```

---

# 28. PWA Conformance Model

A PWA is conformant when it:

1. preserves CPCO semantic distinctions;
2. defines domain Outcomes;
3. identifies professional Participants and authority;
4. defines domain Representations;
5. models Questions, Evidence, Decisions, and uncertainty;
6. defines PWU types;
7. defines RPH coordination behavior;
8. defines validation and governance;
9. defines projections and workspaces;
10. defines reconciliation;
11. encodes material semantics in JSDL;
12. passes scenario and conformance testing.

---

# 29. PWA Maturity Levels

## Level 0 — Vocabulary

The domain has named concepts but no coherent architecture.

## Level 1 — Documented Practice

Activities, roles, and artifacts are documented.

## Level 2 — Semantic Architecture

Domain concepts, relationships, Decisions, and Evidence are explicit.

## Level 3 — Executable Work Architecture

PWUs, lifecycles, Commands, Events, authority, and Validators are encoded.

## Level 4 — AI-Native Operation

Human and AI Participants operate through the PWA with governed coordination.

## Level 5 — Continuously Reconciled Profession

The domain model, work, operation, and Outcomes are continuously observed and reconciled.

A PWA should not claim Level 4 or Level 5 merely because it uses generative AI.

---

# 30. PWA Quality Dimensions

A PWA SHOULD be evaluated across:

```text
outcome_fidelity
semantic_clarity
professional_credibility
cognitive_completeness
traceability
governance_integrity
evidence_integrity
recursive_composability
reconstructability
reconciliation_capability
experience_coherence
executability
evolvability
```

---

# 31. Outcome Fidelity

Does the PWA remain centered on real professional Outcomes rather than artifact production?

Failure signals:

* success defined as document generation;
* excessive task orientation;
* workflows without Outcome trace;
* no operational validation.

---

# 32. Semantic Clarity

Are concepts distinct and consistently defined?

Failure signals:

* Decision and Claim conflated;
* Observation and Evidence conflated;
* approval and validation conflated;
* Artifact and Representation conflated;
* workflow state inferred from missing fields.

---

# 33. Professional Credibility

Would competent professionals recognize the PWA as reflecting the substantive demands of their work?

Failure signals:

* superficial role names;
* idealized happy paths;
* missing exceptions;
* ignored authority;
* absent professional judgment;
* automation of inherently unresolved questions.

---

# 34. Cognitive Completeness

Does the architecture represent:

* uncertainty;
* questions;
* assumptions;
* evidence;
* alternatives;
* decisions;
* confidence;
* observations;
* reconciliation?

A system that only models tasks and outputs is cognitively incomplete.

---

# 35. Recursive Composability

Can complex work decompose without losing meaning?

Can child results be reconstructed into parent understanding?

Failure signals:

* arbitrary task fragmentation;
* no delegation contracts;
* no recomposition;
* completed children treated as completed parent;
* hidden cross-boundary assumptions.

---

# 36. Governance Integrity

Does authority match professional consequence?

Failure signals:

* UI permissions treated as authority;
* AI approving its own material output;
* no exception authority;
* unclear risk acceptance;
* validator and approver conflated.

---

# 37. Reconciliation Capability

Can the PWA handle:

* new Evidence;
* failed assumptions;
* changed Intent;
* contradictory Representations;
* operational variance;
* stale policy;
* cross-PWU conflict?

Failure signals:

* overwrite instead of reconciliation;
* no historical state;
* no impact analysis;
* “completed” work cannot reopen.

---

# 38. Experience Coherence

Does the UI expose one professional cognition model through multiple projections?

Failure signals:

* separate truth per module;
* file hierarchy as primary architecture;
* chat history as memory;
* generic dashboards;
* hidden uncertainty;
* unexplained status colors.

---

# 39. Shape Engineering Anti-Patterns

## 39.1 Screen-First Design

Beginning with page inventory before defining professional cognition.

## 39.2 Workflow Transcription

Copying an existing process diagram into software without questioning why the process exists.

## 39.3 Artifact Ontology

Treating documents, forms, and files as the profession’s primary semantic objects.

## 39.4 Agent Role Proliferation

Creating many named agents without defining distinct professional responsibilities.

## 39.5 Happy-Path Modeling

Ignoring exceptions, disagreement, uncertainty, escalation, and failure.

## 39.6 Automation Inflation

Assuming every professional judgment should become autonomous.

## 39.7 Domain Vocabulary Duplication

Creating domain entities that duplicate CPCO concepts under different names.

## 39.8 Validation Theater

Adding review steps without explicit criteria, authority, or Evidence.

## 39.9 Recursive Explosion

Decomposing work indefinitely without cost controls or synthesis.

## 39.10 False Formalism

Encoding a weak professional model precisely without validating whether the model is substantively correct.

---

# 40. Shape Engineering Review Questions

Before approving a PWA, reviewers SHALL be able to answer:

* What real Outcomes does this architecture support?
* What makes the work professionally difficult?
* What uncertainty is being reduced?
* Which Decisions matter?
* What Evidence justifies them?
* Which assumptions carry the most risk?
* Which invariants must remain true?
* How does work decompose?
* How is it recomposed?
* When does tactic change occur?
* When must work escalate?
* Which AI actions require human review?
* What happens when reality contradicts the model?
* How is the current state experienced in the UI?
* Which parts are encoded in JSDL?
* How will the PWA evolve?

---

# 41. Reference Shape Engineering Repository

```text
pwa-<domain>/
├── charter/
│   └── pwa-charter.md
├── research/
│   ├── observations/
│   ├── interviews/
│   ├── standards/
│   └── evidence/
├── models/
│   ├── outcomes/
│   ├── cognition/
│   ├── ontology/
│   ├── representations/
│   ├── work/
│   ├── governance/
│   ├── projections/
│   └── integrations/
├── decisions/
├── scenarios/
├── jsdl/
├── generated/
├── conformance/
├── migrations/
└── releases/
```

---

# 42. Reference Deliverable Index

A complete PWA package SHOULD contain:

```text
PWA-001 Charter
PWA-002 Domain Boundary
PWA-003 Outcome Model
PWA-004 Stakeholder Model
PWA-005 Participant and Authority Model
PWA-006 Cognition Model
PWA-007 Ontology Profile
PWA-008 Representation Catalog
PWA-009 Assumption Register
PWA-010 Constraint Model
PWA-011 Risk Model
PWA-012 Invariant Catalog
PWA-013 PWU Catalog
PWA-014 RPH Model
PWA-015 Validator Catalog
PWA-016 Governance Matrix
PWA-017 Projection Catalog
PWA-018 Workspace Model
PWA-019 Integration Model
PWA-020 Observation Model
PWA-021 JSDL Modules
PWA-022 Conformance Tests
PWA-023 Reference Scenarios
PWA-024 Operating Profile
PWA-025 Evolution Plan
```

---

# 43. Minimum Viable Shape Engineering

A smaller PWA effort MAY begin with:

```text
Charter
Outcome Model
Cognition Model
Ontology Profile
Representation Catalog
PWU Catalog
Validator Catalog
Projection Catalog
JSDL Core Module
Three Reference Scenarios
Conformance Review
```

The effort SHALL explicitly identify deferred architecture areas.

---

# 44. Reference Scenario Template

Each scenario SHOULD include:

```text
scenarioName
professionalContext
participants
originatingIntent
desiredOutcome
initialState
uncertainties
evidence
decisions
pwuStructure
rphBehavior
exceptions
observations
reconciliation
completionAssessment
```

---

# 45. PWA Scenario Set

Every PWA SHOULD include at least:

## 45.1 Routine Scenario

Common professional work with expected Evidence and authority.

## 45.2 Ambiguous Scenario

Intent or Evidence is incomplete.

## 45.3 Conflicting-Evidence Scenario

Credible Evidence supports incompatible conclusions.

## 45.4 Authority Scenario

Work reaches an authority boundary.

## 45.5 Failure Scenario

The selected method or Action fails.

## 45.6 Cross-Functional Scenario

Several disciplines must coordinate.

## 45.7 Long-Running Scenario

Work suspends and resumes across time.

## 45.8 Reopened Scenario

Completed work is reopened by new Evidence.

## 45.9 Operational Feedback Scenario

Observed reality contradicts professional expectations.

## 45.10 AI-Escalation Scenario

An AI Participant recognizes that it cannot continue responsibly.

---

# 46. Shape Engineering Commands

Canonical Shape Engineering Commands may include:

```text
CreatePwaCharter
ReviseDomainBoundary
DefineOutcome
RegisterDomainConcept
MapConceptToCpco
DefineRepresentation
RegisterAssumption
DefineInvariant
CreatePwuType
DefineRphPolicy
CreateValidator
DefineAuthorityRule
CreateProjection
AddReferenceScenario
EncodeJsdlModule
ValidatePwa
ApprovePwaRelease
SupersedePwaVersion
```

---

# 47. Shape Engineering Events

Canonical events may include:

```text
PwaCharterCreated
DomainBoundaryRevised
OutcomeDefined
DomainConceptRegistered
CpcoMappingApproved
RepresentationDefined
CriticalAssumptionIdentified
InvariantAccepted
PwuTypeDefined
RphPolicyDefined
ValidatorApproved
AuthorityRuleApproved
ProjectionDefined
ReferenceScenarioValidated
JsdlModuleCompiled
PwaConformancePassed
PwaReleased
PwaSuperseded
```

---

# 48. Shape Engineering Invariants

## SE-INV-001 — Outcome Traceability

Every material PWA construct SHALL trace to an Outcome, Intent, obligation, or explicit exploratory purpose.

## SE-INV-002 — CPCO Preservation

Domain specialization SHALL not weaken CPCO semantic distinctions.

## SE-INV-003 — Explicit Authority

Material Commands and Decisions SHALL identify required authority.

## SE-INV-004 — Evidence Integrity

Professional Claims and Decisions SHALL preserve Evidence relationships.

## SE-INV-005 — Critical Assumption Visibility

Critical assumptions SHALL be explicit.

## SE-INV-006 — Work Coherence

Every PWU type SHALL possess a professionally meaningful objective.

## SE-INV-007 — Recomposition

Recursive decomposition SHALL define reconstruction obligations.

## SE-INV-008 — Validator Semantics

Validators SHALL define criteria and professional effect.

## SE-INV-009 — AI Authority Boundaries

AI authority SHALL be explicit and bounded.

## SE-INV-010 — Reconciliation

The PWA SHALL define how changed reality updates professional understanding.

## SE-INV-011 — Projection Authority

Workspaces SHALL derive from authoritative semantic state.

## SE-INV-012 — Executable Semantics

Material architecture concepts SHALL be encoded in JSDL or explicitly identified as non-executable doctrine.

## SE-INV-013 — Scenario Validation

A PWA SHALL pass representative operational scenarios before release.

## SE-INV-014 — Versioned Evolution

Material PWA changes SHALL be versioned and assessed for compatibility.

## SE-INV-015 — No False Completion

PWA approval SHALL not be based solely on document completion or successful compilation.

---

# 49. Shape Engineering Conformance Test

A Shape Engineering effort is conformant when it can demonstrate:

* the domain is bounded;
* real Outcomes are explicit;
* professional cognition is modeled;
* CPCO mappings are complete;
* critical Representations are defined;
* assumptions and invariants are visible;
* PWUs are professionally coherent;
* RPH coordination handles failure and tactic change;
* authority and validation are explicit;
* projections support professional reasoning;
* external reality can update the model;
* JSDL compiles;
* representative scenarios pass;
* evolution is governed.

---

# 50. Application to JanumiCode

JanumiCode is the first reference application of Shape Engineering.

Its development should now be interpreted as:

```text
Shape Engineering Method
        ↓
JanumiCode Professional Work Architecture
        ↓
JanumiCode JSDL Modules
        ↓
Generated Semantic Contracts
        ↓
Janumi Runtime
        ↓
JanumiCode Workbench and VS Code Experience
```

JanumiCode is therefore not the template from which every profession is copied.

It is one PWA produced by the Shape Engineering method.

---

# 51. Application to Future PWAs

## 51.1 JanumiScience

Would specialize:

* hypotheses;
* experiments;
* datasets;
* scientific claims;
* reproducibility;
* uncertainty;
* peer review;
* research protocols;
* scientific Evidence.

## 51.2 JanumiLegal

Would specialize:

* matters;
* legal issues;
* authorities;
* arguments;
* obligations;
* opinions;
* legal decisions;
* jurisdictions;
* privilege;
* review and approval.

## 51.3 JanumiConstruction

Would specialize:

* project outcomes;
* design;
* permits;
* submittals;
* RFIs;
* field observations;
* schedule;
* safety;
* quality;
* subcontractor coordination;
* change orders;
* inspections.

## 51.4 JanumiHealthcare

Would specialize:

* patient outcomes;
* clinical questions;
* observations;
* diagnoses;
* treatments;
* clinical Evidence;
* consent;
* safety;
* care coordination;
* outcome monitoring.

Each PWA remains domain-specific while preserving the same professional cognition foundation.

---

# 52. Shape Engineering as a Platform Capability

The Janumi Professional Workbench SHOULD eventually support Shape Engineering directly.

Potential capabilities include:

```text
PWA Charter Workspace
Outcome Modeler
Ontology Mapper
Representation Catalog
Assumption and Invariant Workspace
PWU Designer
RPH Policy Designer
Validator Studio
Authority Matrix Editor
Projection Designer
Scenario Simulator
JSDL Editor
Compiler Diagnostics
Conformance Dashboard
PWA Release Manager
```

These workspaces would allow domain architects to construct PWAs without manually editing every JSDL file.

---

# 53. Generated Versus Handcrafted Architecture

Shape Engineering SHOULD support three levels of authoring:

## 53.1 Guided Authoring

Structured workspaces help domain experts define the PWA.

## 53.2 AI-Assisted Authoring

Agents propose models, mappings, Validators, and scenarios.

## 53.3 Direct JSDL Authoring

Advanced architects edit canonical definitions directly.

All three SHALL converge on the same JSDL source of truth.

---

# 54. Shape Engineering Meta-RPH

The creation of a PWA may itself be coordinated by a Shape Engineering RPH.

A reference structure:

```text
Shape Engineering RPH
├── Domain Research RPH
├── Outcome Modeling RPH
├── Cognition Modeling RPH
├── Ontology RPH
├── Work Architecture RPH
├── Governance RPH
├── Experience RPH
├── JSDL Encoding RPH
└── PWA Validation RPH
```

The meta-RPH SHALL synthesize all child outputs into one coherent PWA.

---

# 55. Resulting Strategic Interpretation

Shape Engineering establishes Janumi’s highest-level generative capability.

Janumi is not merely:

* a platform for agents;
* a workflow system;
* a professional knowledge graph;
* a coding environment;
* a collection of domain applications.

It is a system for transforming professional knowledge, reasoning, authority, and practice into executable Professional Work Architectures.

In that precise sense, Janumi functions as a compiler for professions:

```text
Professional Reality
        ↓
Shape Engineering
        ↓
Professional Work Architecture
        ↓
JSDL
        ↓
Janumi Execution Model
        ↓
Runtime
        ↓
AI-Native Professional Organization
```

The phrase “compiler for professions” does not mean that a profession is reduced to deterministic software.

It means that its explicit professional structures become sufficiently formalized to be:

* inspected;
* coordinated;
* validated;
* assisted;
* executed where appropriate;
* observed;
* continuously reconciled.

Professional judgment, uncertainty, and human authority remain part of the executable model rather than being abstracted away.

---

# 56. Immediate Implementation Consequence

The conceptual foundation is now complete enough to stop introducing new architecture layers.

The next implementation deliverable SHALL be the **JanumiCode UI Information Architecture and Screen Contract**.

That artifact shall define:

* concrete route hierarchy;
* screen inventory;
* workspace composition;
* component contracts;
* required data projections;
* professional Commands;
* loading and failure behavior;
* responsive profiles;
* screen-level acceptance criteria;
* implementation sequence for the current coding agent.

No new conceptual document is required before that work begins.
