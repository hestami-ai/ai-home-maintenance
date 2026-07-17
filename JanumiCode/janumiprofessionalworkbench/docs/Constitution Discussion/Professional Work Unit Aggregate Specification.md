# Professional Work Unit Aggregate Specification

## PWU Specification v0.1.0

**Document ID:** `JAN-PWU-001`
**Version:** `0.1.0`
**Status:** Draft
**Depends on:** Canonical Professional Cognition Ontology v0.1
**Applies to:** Janumi Platform, Recursive Professional Harnesses, Professional Work Architectures, user interfaces, agents, validators, APIs, persistence, and observability
**Primary audiences:** Platform architects, coding agents, backend engineers, frontend engineers, workflow engineers, agent developers, PWA authors, validator developers

---

# 1. Purpose

This specification defines the **Professional Work Unit**, or PWU, as the canonical bounded aggregate through which professional cognition is framed, advanced, coordinated, validated, reconciled, and completed within Janumi.

The CPCO defines the semantic entities of professional cognition.

This specification defines how those entities are assembled into a governable unit of professional work.

A PWU is not:

* a task;
* a ticket;
* a document container;
* a folder;
* a workflow run;
* an agent conversation;
* a project-management record;
* a generic graph node;
* a unit of computational execution.

A PWU is a bounded region of professional cognition organized around a meaningful objective, uncertainty, decision, obligation, or outcome.

---

# 2. Canonical Definition

A **Professional Work Unit** is:

> A bounded, versioned, governable aggregate of intent, professional objective, uncertainty, representations, reasoning, evidence, decisions, actions, observations, dependencies, validations, participants, and history that can be understood, coordinated, evaluated, reconciled, and recomposed as one professionally meaningful unit.

A PWU establishes a local coherence boundary.

Within that boundary, Janumi must be able to determine:

* why the work exists;
* what it is intended to accomplish;
* what is known;
* what remains uncertain;
* what reasoning is being performed;
* what evidence is available;
* what decisions have been made;
* what actions are authorized;
* what dependencies exist;
* what has changed;
* what completion means;
* how this work contributes to broader outcomes.

---

# 3. Aggregate Boundary

The PWU aggregate owns the professional state required to govern one bounded area of work.

## 3.1 Aggregate Root

The `ProfessionalWorkUnit` is the aggregate root.

All state-changing operations affecting the PWU SHALL be authorized through the aggregate root or an explicitly governed service acting on its behalf.

## 3.2 Owned State

A PWU SHALL directly own or maintain authoritative references to:

```text
ProfessionalWorkUnit
├── Identity and Type
├── Professional Objective
├── Originating Intent
├── Scope
├── Lifecycle State
├── Cognitive State
├── Authority and Governance
├── Participants and Roles
├── Questions
├── Uncertainties
├── Assumptions
├── Constraints
├── Representations
├── Reasoning Activities
├── Claims
├── Evidence
├── Confidence Assessments
├── Alternatives
├── Decisions
├── Actions
├── Observations
├── Risks
├── Issues
├── Dependencies
├── Validations
├── Reconciliations
├── Child PWUs
├── Completion Conditions
├── Escalation Conditions
├── History
└── Observability State
```

## 3.3 Referenced State

A PWU MAY reference entities governed outside its aggregate boundary, including:

* organizational policies;
* external regulations;
* enterprise capabilities;
* shared representations;
* reusable methods;
* authoritative data sources;
* parent PWUs;
* peer PWUs;
* external systems;
* shared participants;
* global outcomes.

Externally governed entities SHALL NOT be silently modified through the PWU.

Changes requiring cross-boundary mutation SHALL use an explicit command, event, reconciliation, or governed service.

---

# 4. PWU Identity

Every PWU SHALL possess:

```text
pwuId
pwuType
title
professionalObjective
endeavorId
parentPwuId?
rootPwuId
version
createdAt
createdBy
```

## 4.1 Stable Identity

The `pwuId` SHALL remain stable across:

* lifecycle changes;
* reassignment;
* decomposition;
* reopening;
* reconciliation;
* representation changes;
* title changes.

## 4.2 Root Relationship

Every PWU SHALL identify its root PWU.

For a root PWU:

```text
rootPwuId == pwuId
parentPwuId == null
```

For a child PWU:

```text
rootPwuId == ancestor root
parentPwuId == immediate parent
```

---

# 5. PWU Type Model

PWU types express the dominant professional purpose of the aggregate.

Canonical types include:

```text
discovery
framing
research
analysis
design
planning
decision
implementation
execution
verification
validation
review
reconciliation
incident
remediation
governance
integration
observation
learning
```

A PWA MAY define specialized subtypes.

Examples in JanumiCode:

```text
intent_formalization
user_journey_generation
requirements_analysis
architecture_design
data_model_design
implementation_slice
test_strategy
security_review
release_readiness
production_incident
```

## 5.1 Type Is Not State

A PWU type describes what kind of professional work is being performed.

Lifecycle state describes where that work currently stands.

These SHALL remain separate.

## 5.2 Type Evolution

A PWU SHOULD NOT change type after activation unless the original classification was incorrect.

When the professional objective materially changes, the preferred response is:

* revise scope;
* create a successor PWU;
* decompose the work;
* supersede the original PWU.

---

# 6. Professional Objective

Every PWU SHALL possess one explicit professional objective.

The objective SHALL state:

* the professionally meaningful result sought;
* the uncertainty, obligation, decision, or outcome being addressed;
* the intended contribution to broader work.

A valid objective describes a cognitive or real-world result.

Valid examples:

* Determine whether the proposed authentication architecture satisfies enterprise security constraints.
* Produce and validate a domain model sufficient to implement tenant billing.
* Resolve the contradiction between the approved requirements and the current implementation.
* Establish whether the drainage design adequately addresses shallow groundwater affecting the identified properties.

Invalid examples:

* Work on authentication.
* Create some files.
* Run the agent.
* Complete ticket 481.
* Review the document.

These may describe activity but not a professional objective.

---

# 7. PWU Scope

Every PWU SHALL define an explicit scope.

## 7.1 Scope Components

```text
included
excluded
boundaryConditions
affectedDomains
affectedSystems
timeHorizon
geographicScope
organizationalScope
```

## 7.2 Non-Goals

Material non-goals SHOULD be recorded explicitly.

Non-goals prevent:

* accidental scope expansion;
* speculative implementation;
* over-generalization;
* substitution of adjacent objectives;
* unbounded agent exploration.

## 7.3 Scope Change

A material scope change SHALL produce:

* a new PWU version;
* a change rationale;
* an assessment of downstream impact;
* updated completion conditions;
* updated dependencies;
* a reconciliation event where necessary.

An AI Participant SHALL NOT materially broaden scope without authorization.

---

# 8. Dual State Model

A PWU SHALL maintain two distinct state dimensions:

1. **Lifecycle State**
2. **Cognitive State**

These SHALL NOT be collapsed into a single status field.

---

# 9. Lifecycle State

Lifecycle state describes the governance and execution condition of the PWU.

Canonical lifecycle states are:

```text
proposed
framing
ready
active
blocked
awaiting_evidence
awaiting_decision
awaiting_review
awaiting_external
reconciling
suspended
completed
cancelled
superseded
reopened
failed
```

## 9.1 Proposed

The PWU has been identified but has not yet been sufficiently framed.

Permitted conditions:

* objective may be provisional;
* scope may be incomplete;
* participants may be unassigned;
* completion conditions may be undefined.

The PWU SHALL NOT begin authoritative execution in this state.

## 9.2 Framing

The objective, scope, authority, inputs, uncertainties, and completion conditions are being established.

Exit criteria SHOULD include:

* objective defined;
* originating Intent linked;
* scope defined;
* initial uncertainties identified;
* required authority identified;
* completion conditions defined;
* blocking prerequisites identified.

## 9.3 Ready

The PWU is sufficiently framed to begin active work.

A ready PWU SHALL have:

* valid professional objective;
* active Intent or exploratory purpose;
* explicit scope;
* responsible participant or harness;
* applicable constraints;
* initial completion conditions;
* no unresolved mandatory framing validation failure.

## 9.4 Active

Professional cognition or action is currently advancing.

Active does not imply unblocked progress. A temporary local delay may exist without requiring a lifecycle transition.

## 9.5 Blocked

The PWU cannot responsibly advance because a required condition is unsatisfied.

A blocked PWU SHALL identify:

```text
blockingCondition
blockedBy
blockedAt
requiredResolution
escalationDeadline?
```

## 9.6 Awaiting Evidence

Advancement depends on evidence that has not yet been obtained or validated.

## 9.7 Awaiting Decision

Advancement depends on an authorized decision.

## 9.8 Awaiting Review

Work has reached a review boundary and requires evaluation by an authorized Participant.

## 9.9 Awaiting External

Advancement depends on a person, organization, system, event, or condition outside the immediate Janumi-controlled work context.

## 9.10 Reconciling

A material coherence issue is being analyzed or resolved.

During reconciliation:

* prior state remains reconstructable;
* affected entities are identified;
* downstream impact is assessed;
* completion SHALL NOT be declared unless reconciliation is complete or formally deferred.

## 9.11 Suspended

Work is intentionally paused.

Suspension SHALL record:

* authority;
* reason;
* resume condition;
* effects on dependent PWUs.

## 9.12 Completed

The PWU satisfies its professional completion conditions.

Completion SHALL NOT be inferred from:

* all subtasks being checked;
* an agent reaching its final step;
* a workflow terminating;
* an artifact being generated;
* a pull request being merged;
* a human saying “done” without satisfying completion rules.

## 9.13 Cancelled

The work will not continue and has not achieved its objective.

Cancellation SHALL preserve:

* cancellation authority;
* rationale;
* completed outputs;
* transferable knowledge;
* downstream effects.

## 9.14 Superseded

Another PWU has replaced this PWU as the governing work context.

The superseding PWU SHALL be identified.

## 9.15 Reopened

A previously completed, cancelled, failed, or superseded PWU has resumed because:

* new evidence emerged;
* an assumption failed;
* intent changed;
* validation failed;
* observed reality diverged;
* prior completion was invalid.

Reopening SHALL preserve the prior closure record.

## 9.16 Failed

The PWU could not responsibly complete its objective within its authority, capability, constraints, or escalation rules.

Failure SHALL identify:

* failure class;
* work completed;
* unresolved conditions;
* attempted tactics;
* evidence gathered;
* recommended disposition.

---

# 10. Cognitive State

Cognitive state describes the current region of the Professional Cognition Life Cycle being emphasized.

Canonical cognitive states are:

```text
intent
understanding
representation
reasoning
decision
action
observation
reconciliation
```

A PWU MAY contain activity across multiple cognitive states, but one state SHOULD be designated as currently dominant.

## 10.1 Intent State

The desired result and rationale are being established or revised.

## 10.2 Understanding State

The problem, context, known facts, assumptions, and uncertainties are being developed.

## 10.3 Representation State

Understanding is being externalized into requirements, models, plans, specifications, code, contracts, or other representations.

## 10.4 Reasoning State

Representations are being analyzed, transformed, compared, decomposed, synthesized, tested, or critiqued.

## 10.5 Decision State

An authorized commitment is being prepared, reviewed, or made.

## 10.6 Action State

Reality or an operational system is being changed.

## 10.7 Observation State

Results, measurements, telemetry, feedback, or conditions are being recorded and interpreted.

## 10.8 Reconciliation State

Current understanding is being updated to restore coherence.

---

# 11. State Transition Rules

All material lifecycle transitions SHALL be explicit, validated, and evented.

## 11.1 Canonical Lifecycle Transitions

```text
proposed → framing
framing → ready
framing → cancelled
ready → active
ready → suspended
active → blocked
active → awaiting_evidence
active → awaiting_decision
active → awaiting_review
active → awaiting_external
active → reconciling
active → completed
active → failed
active → suspended
blocked → active
blocked → reconciling
blocked → failed
awaiting_evidence → active
awaiting_evidence → reconciling
awaiting_decision → active
awaiting_decision → cancelled
awaiting_review → active
awaiting_review → completed
awaiting_review → reconciling
awaiting_external → active
awaiting_external → failed
reconciling → active
reconciling → awaiting_decision
reconciling → completed
reconciling → failed
suspended → ready
suspended → active
suspended → cancelled
completed → reopened
cancelled → reopened
failed → reopened
superseded → reopened
any_non_terminal → cancelled
any_non_terminal → superseded
```

## 11.2 Illegal Transitions

The following SHALL be illegal without an intermediate governed transition:

```text
proposed → completed
framing → completed
ready → completed
blocked → completed
cancelled → active
completed → active
failed → active
superseded → active
```

A closed PWU must first transition to `reopened`.

## 11.3 Transition Preconditions

Every transition SHALL define:

```text
sourceState
targetState
requestedBy
authority
preconditions
validationResults
transitionReason
occurredAt
```

## 11.4 Transition Failure

When a transition fails validation:

* the current state SHALL remain unchanged;
* failure reasons SHALL be returned;
* the attempted transition SHOULD be observable;
* no partial semantic transition SHALL occur.

---

# 12. Framing Contract

A PWU SHALL satisfy a minimum framing contract before activation.

## 12.1 Required Framing Elements

```text
professionalObjective
originatingIntent
scope
responsibleParticipantOrHarness
initialQuestionsOrUncertainties
applicableConstraints
requiredInputs
completionConditions
validationRequirements
escalationConditions
```

## 12.2 Framing Validation

A PWU SHALL NOT become `ready` when:

* the objective is activity-only;
* no Intent or exploratory purpose exists;
* scope is materially ambiguous;
* mandatory authority is absent;
* a known mandatory constraint is unresolved;
* completion is defined only as artifact generation;
* the PWU duplicates existing work without an explicit relationship;
* required parent delegation information is missing.

---

# 13. Participant and Role Model

PWU participation SHALL be role-based and explicit.

## 13.1 Canonical PWU Roles

```text
sponsor
owner
steward
coordinator
contributor
reasoner
executor
reviewer
validator
approver
observer
subject_matter_expert
affected_stakeholder
external_dependency
```

## 13.2 Role Semantics

### Sponsor

Authorizes or materially supports the professional objective.

### Owner

Accountable for the PWU reaching a valid disposition.

### Steward

Maintains semantic quality, traceability, and coherence.

### Coordinator

Advances work across Participants and dependencies.

### Contributor

Produces or improves professional entities.

### Reasoner

Performs analysis, synthesis, design, diagnosis, or related cognition.

### Executor

Performs authorized Actions that change reality or operational systems.

### Reviewer

Evaluates work but does not necessarily establish authoritative validity.

### Validator

Performs an explicit Validation against declared criteria.

### Approver

Possesses authority to establish an approved Decision or accepted result.

### Observer

Receives updates or inspects state without changing it.

## 13.3 Human and AI Roles

Both humans and AI Participants MAY occupy supported roles.

AI role assignments SHALL declare:

* delegated authority;
* prohibited actions;
* required review points;
* tool permissions;
* evidence requirements;
* escalation conditions.

## 13.4 Role Conflicts

A PWA MAY prohibit a Participant from serving in conflicting roles.

Examples:

* an AI executor may not approve its own material work;
* an author may not satisfy independent validation requirements;
* a reviewer may advise without possessing approval authority.

---

# 14. Input Model

Inputs are CPCO entities or external references required to begin or advance the PWU.

## 14.1 Input Categories

```text
intent
representation
evidence
observation
decision
constraint
policy
artifact
external_data
parent_context
method
tool
```

## 14.2 Input Readiness

Each required input SHALL declare:

```text
required
availability
validity
freshness
authority
version
```

## 14.3 Input Trust Boundary

All external inputs SHALL be treated as untrusted until normalized and validated according to the governing PWA.

The PWU SHALL distinguish:

* received;
* parsed;
* normalized;
* validated;
* accepted for use;
* rejected.

---

# 15. Output Model

Outputs are entities created, revised, validated, or reconciled through the PWU.

## 15.1 Output Categories

```text
representation
claim
evidence
decision
action
artifact
observation
validation
reconciliation
child_pwu
narrative_memory
```

## 15.2 Output Contract

Every required output SHALL define:

```text
outputType
semanticPurpose
acceptanceCriteria
requiredValidation
authoritativeStatus
downstreamConsumers
```

## 15.3 Output Absence

Where a PWU produces no valid output, it SHALL record:

* why;
* what was attempted;
* what was learned;
* whether the objective remains unresolved;
* whether escalation is required.

“No result” may be professionally meaningful and SHALL NOT be silently converted into success.

---

# 16. Question and Uncertainty Model

Questions and uncertainties SHALL drive work rather than remain incidental annotations.

## 16.1 Initial Uncertainty

At framing, the PWU SHOULD identify:

* primary uncertainty;
* secondary uncertainties;
* uncertainty type;
* decision impact;
* known reduction methods.

## 16.2 Uncertainty Evolution

An uncertainty MAY be:

```text
identified
characterized
reduced
transformed
accepted
transferred
deferred
resolved
invalidated
```

## 16.3 Residual Uncertainty

Completion MAY occur with residual uncertainty only when:

* it is explicitly documented;
* its impact is assessed;
* an authorized Participant accepts it;
* dependent Decisions and PWUs can inspect it;
* required mitigations are recorded.

---

# 17. Assumptions and Constraints

## 17.1 Assumption Registration

A detected material assumption SHALL be registered as an entity.

An assumption SHALL include:

* statement;
* scope;
* basis;
* criticality;
* validation method;
* dependent entities.

## 17.2 Critical Assumptions

Critical assumptions SHOULD be visible in the default PWU workspace.

A critical assumption is one whose invalidation could materially alter:

* the objective;
* a decision;
* architecture;
* safety;
* legality;
* cost;
* schedule;
* outcome confidence.

## 17.3 Constraint Evaluation

Mandatory constraints SHALL be evaluated at:

* framing;
* relevant decisions;
* action authorization;
* completion;
* reconciliation.

---

# 18. Reasoning Activity Model

Reasoning Activities are explicit bounded transformations within the PWU.

## 18.1 Required Reasoning Record

```text
reasoningActivityId
reasoningType
purpose
inputEntityIds
method
performedBy
startedAt
completedAt?
status
outputEntityIds
assumptionsIntroduced
limitations
```

## 18.2 Reasoning Status

```text
planned
active
paused
completed
failed
inconclusive
invalidated
superseded
```

## 18.3 Reasoning Completion

A Reasoning Activity SHALL NOT be marked complete unless:

* outputs are identified;
* absence of outputs is explicitly recorded;
* limitations are captured where material;
* provenance is complete;
* unresolved material uncertainty is surfaced.

## 18.4 AI Reasoning

AI-generated reasoning SHALL record, where available:

```text
agentId
modelIdentity
modelVersion
promptOrInstructionReference
contextReferences
toolCalls
executionParameters
tokenOrResourceUse
validationStatus
```

The platform MAY store a concise reasoning summary rather than hidden internal chain-of-thought.

The summary SHALL be sufficient to reconstruct the professional basis of the output without requiring private model internals.

---

# 19. Claim, Evidence, and Confidence Model

## 19.1 Claim Registration

A material conclusion SHALL be represented as a Claim rather than embedded only in prose.

## 19.2 Evidence Relationship

Evidence SHALL connect explicitly to Claims through typed relationships:

```text
supports
contradicts
qualifies
inconclusive_for
```

## 19.3 Confidence Change

A change in Claim confidence SHOULD record:

```text
priorAssessment
newAssessment
changeReason
evidenceAddedOrRemoved
assumptionsChanged
assessedBy
```

## 19.4 Unsupported Claims

The PWU SHALL expose material Claims lacking sufficient Evidence.

Unsupported does not necessarily mean false.

It means the current evidentiary basis is insufficient for the required use.

---

# 20. Decision Model

Material decisions SHALL be explicit entities within the PWU.

## 20.1 Decision Readiness

A decision may become `pending` only when:

* the decision question is explicit;
* authority is known;
* relevant alternatives are available or their absence is justified;
* material constraints are identified;
* available evidence is linked;
* residual uncertainty is visible.

## 20.2 Decision Approval

Approval SHALL capture:

```text
decisionId
decisionStatement
selectedAlternative
approver
authorityBasis
supportingClaims
supportingEvidence
acceptedAssumptions
applicableConstraints
residualUncertainty
effectiveAt
rationale
```

## 20.3 Decision Reopening

A decision SHOULD be reopened when:

* material new evidence emerges;
* a critical assumption fails;
* intent changes;
* a governing constraint changes;
* implementation or observation contradicts expectations;
* validation reveals a material defect.

---

# 21. Action Model

Actions implement decisions or otherwise advance the PWU.

## 21.1 Action Authorization

An Action that materially changes reality SHALL identify:

* authorizing Decision or authority;
* intended effect;
* executor;
* constraints;
* rollback or recovery expectations where applicable;
* required observations.

## 21.2 Action Completion

Action completion SHALL remain distinct from PWU completion.

An Action may execute successfully while:

* the intended outcome is not achieved;
* validation fails;
* new uncertainty emerges;
* reconciliation remains pending.

---

# 22. Observation and Feedback Model

Observations compare reality or execution against expectations.

## 22.1 Expected State

Where appropriate, an Action or Decision SHOULD define an expected observation.

## 22.2 Variance

Observation handling SHOULD classify:

```text
matches_expectation
within_tolerance
unexpected_beneficial
unexpected_adverse
inconclusive
measurement_failure
```

## 22.3 Reconciliation Trigger

An Observation SHALL trigger reconciliation when it materially conflicts with:

* a Claim;
* an Assumption;
* an approved Representation;
* a Decision rationale;
* an expected outcome;
* a mandatory Constraint.

---

# 23. Dependency Model

Dependencies SHALL be explicit and typed.

## 23.1 Dependency Categories

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
parent_child
cross_pwu
external
```

## 23.2 Dependency Direction

Each dependency SHALL identify:

```text
dependentEntity
requiredEntity
satisfactionCondition
criticality
status
```

## 23.3 Blocking Dependencies

A dependency blocks the PWU when:

* it is mandatory;
* its satisfaction condition is unmet;
* no valid substitute exists;
* responsible work cannot proceed without irresponsible assumption.

## 23.4 Cross-PWU Dependencies

Cross-PWU dependencies SHALL be visible from both PWUs.

A change to one side SHOULD trigger impact analysis on the other.

---

# 24. Risk and Issue Model

## 24.1 Risk Registration

Material risks SHALL identify:

* cause;
* potential effect;
* likelihood;
* impact;
* affected outcomes;
* mitigation;
* monitoring observations;
* responsible Participant.

## 24.2 Issue Conversion

A Risk MAY become an Issue when its triggering condition is observed.

The relationship between the original Risk and resulting Issue SHALL be preserved.

---

# 25. Validation Model

Validation determines whether PWU entities or the PWU itself satisfy declared criteria.

## 25.1 Validation Layers

```text
structural
semantic
professional
coherence
governance
temporal
security
safety
outcome
```

## 25.2 Required Validation Plan

A PWU SHOULD define required validations during framing.

Each required validation SHALL identify:

```text
subject
criteria
validator
timing
blockingCondition
requiredResult
```

## 25.3 Validation Independence

A PWA MAY require independence between:

* producer and validator;
* executor and approver;
* AI agent and reviewing participant;
* child PWU and parent synthesis.

## 25.4 Inconclusive Validation

An inconclusive result SHALL NOT be silently treated as pass.

It SHALL produce one of:

* additional evidence request;
* revised method;
* accepted residual uncertainty;
* escalation;
* failure;
* scope revision.

---

# 26. Reconciliation Model

Reconciliation restores coherence within or across PWUs.

## 26.1 Reconciliation Triggers

```text
new_evidence
contradiction
assumption_failure
intent_change
constraint_change
dependency_change
validation_failure
observation_mismatch
external_change
manual_request
```

## 26.2 Reconciliation Scope

A reconciliation SHALL identify:

* trigger;
* affected entities;
* affected PWUs;
* affected decisions;
* affected outcomes;
* prior state;
* proposed state;
* downstream consequences.

## 26.3 Reconciliation Application

A reconciliation may:

* revise an entity;
* supersede an entity;
* reopen a Decision;
* reopen a PWU;
* create a child PWU;
* modify completion conditions;
* escalate an unresolved conflict;
* accept a documented inconsistency temporarily.

## 26.4 Temporary Incoherence

Temporary incoherence MAY be tolerated when explicitly authorized.

It SHALL record:

```text
acceptedBy
reason
scope
risk
expirationOrReviewDate
mitigation
```

---

# 27. Decomposition Model

Decomposition creates child PWUs to reduce cognitive or organizational complexity.

## 27.1 Valid Reasons to Decompose

A PWU SHOULD be decomposed when:

* the objective contains independently reasoned sub-objectives;
* different professional disciplines are required;
* different authorities apply;
* independent validation is required;
* the cognitive context exceeds responsible operating limits;
* parallel work can proceed without losing coherence;
* specialized tools or agents are required;
* uncertainty classes require different methods.

## 27.2 Invalid Reasons to Decompose

A PWU SHOULD NOT be decomposed solely because:

* the UI prefers smaller cards;
* a task list is desired;
* arbitrary time-boxing is convenient;
* the implementation framework maps naturally to child objects;
* an agent wants to offload context without preserving rationale.

## 27.3 Child PWU Delegation Contract

Every child PWU SHALL receive:

```text
delegatedObjective
originatingIntent
delegatedScope
excludedScope
authority
requiredInputs
requiredOutputs
applicableConstraints
parentDependencies
completionConditions
escalationConditions
recompositionObligation
```

## 27.4 Child Relationship Types

```text
decomposition
delegation
specialization
support
verification
validation
mitigation
research
reconciliation
implementation
```

## 27.5 Parent Responsibility

The parent retains responsibility for:

* cross-child coherence;
* unresolved boundary conditions;
* synthesis;
* dependency management;
* overall completion;
* residual uncertainty;
* outcome alignment.

Delegation SHALL NOT transfer responsibility for recomposition.

---

# 28. Recomposition Model

Recomposition integrates child PWU results into coherent parent understanding.

## 28.1 Recomposition Is Mandatory

A parent PWU with children SHALL perform recomposition before completion unless all child work was cancelled or formally detached.

## 28.2 Recomposition Inputs

```text
childOutputs
childDecisions
childResidualUncertainty
childAssumptions
childValidations
crossChildDependencies
contradictions
boundaryConditions
```

## 28.3 Recomposition Outputs

```text
synthesizedRepresentation
crossChildCoherenceAssessment
unresolvedContradictions
integratedConfidenceAssessment
parentDecisionUpdates
parentCompletionAssessment
followOnPWUs
```

## 28.4 Local Completion Does Not Imply Global Coherence

All child PWUs may be individually complete while the parent remains incomplete because:

* child outputs conflict;
* interfaces do not align;
* combined constraints are violated;
* global outcome criteria are not met;
* residual uncertainty compounds;
* integration validation is missing.

---

# 29. Completion Model

PWU completion is a professional judgment constrained by explicit rules.

## 29.1 Completion Conditions

Every PWU SHALL define completion conditions.

Completion conditions MAY include:

```text
objectiveSatisfied
requiredOutputsAccepted
mandatoryValidationsPassed
requiredDecisionsMade
requiredActionsCompleted
criticalDependenciesSatisfied
reconciliationComplete
residualUncertaintyAccepted
traceabilityComplete
parentRecompositionDelivered
```

## 29.2 Completion Assessment

A completion assessment SHALL identify:

```text
condition
result
evidence
validator
exceptions
```

## 29.3 Completion Outcomes

```text
completed_successfully
completed_with_accepted_residual_uncertainty
completed_as_inconclusive
completed_by_transfer
completed_by_supersession
```

These may map to lifecycle `completed` while retaining distinct disposition semantics.

## 29.4 Completion Prohibitions

A PWU SHALL NOT complete when:

* a mandatory validation failed;
* a blocking dependency remains unresolved;
* a mandatory constraint is violated;
* material contradiction remains unacknowledged;
* required parent synthesis is absent;
* the only output is an unvalidated AI result;
* objective satisfaction cannot be assessed and no authorized inconclusive disposition exists.

---

# 30. Failure, Tactic Change, and Escalation

The PWU SHALL distinguish ordinary iteration from professional failure.

## 30.1 Failure Classes

```text
insufficient_evidence
insufficient_authority
insufficient_capability
invalid_method
tool_failure
dependency_failure
constraint_conflict
unresolvable_contradiction
resource_exhaustion
time_exhaustion
scope_invalidity
intent_ambiguity
validation_failure
external_blockage
```

## 30.2 Tactic Change Trigger

A tactic change SHOULD occur when:

* repeated reasoning produces no material uncertainty reduction;
* the same validation failure recurs;
* new evidence invalidates the current method;
* progress stalls beyond a defined threshold;
* search remains confined to a failing solution space;
* the current Participant lacks required expertise;
* tool limitations materially constrain quality.

## 30.3 Tactic Change Options

```text
change_method
expand_search_space
narrow_scope
decompose
request_specialist
change_tool
change_agent
increase_evidence
challenge_assumptions
reframe_question
escalate_authority
```

## 30.4 Escalation Conditions

A PWU SHALL escalate when:

* required authority exceeds current delegation;
* material uncertainty cannot be responsibly reduced;
* constraints conflict without resolution authority;
* safety, legality, or ethics are implicated;
* repeated tactics fail;
* evidence remains insufficient for a required decision;
* human judgment is explicitly required;
* a governing PWA requires escalation;
* continued execution would be professionally irresponsible.

## 30.5 Escalation Package

Escalation SHALL include:

```text
professionalObjective
currentState
blockingCondition
workPerformed
tacticsAttempted
evidenceGathered
assumptions
constraints
decisionsRequired
recommendedOptions
riskOfDelay
riskOfProceeding
```

---

# 31. Command Model

PWU state SHALL be changed through semantically meaningful commands.

## 31.1 Core Commands

```text
ProposePWU
FramePWU
RevisePWUScope
AssignParticipant
RemoveParticipant
DeclareReady
ActivatePWU
IdentifyQuestion
IdentifyUncertainty
RegisterAssumption
RegisterConstraint
AddRepresentation
StartReasoning
CompleteReasoning
ProposeClaim
AddEvidence
AssessConfidence
IdentifyAlternative
ProposeDecision
ApproveDecision
RejectDecision
AuthorizeAction
RecordObservation
AddDependency
SatisfyDependency
BlockPWU
UnblockPWU
RequestEvidence
RequestDecision
RequestReview
StartReconciliation
ApplyReconciliation
DecomposePWU
RecomposePWU
ValidatePWU
CompletePWU
SuspendPWU
CancelPWU
SupersedePWU
ReopenPWU
FailPWU
EscalatePWU
```

## 31.2 Command Envelope

Every command SHALL include:

```text
commandId
commandType
pwuId
expectedVersion
requestedBy
requestedAt
correlationId
causationId
payload
```

## 31.3 Optimistic Concurrency

Commands SHOULD include `expectedVersion`.

A stale command SHALL fail rather than silently overwrite newer professional state.

---

# 32. Event Model

Successful commands SHALL emit one or more immutable events.

## 32.1 Core PWU Events

```text
PWUProposed
PWUFramingStarted
PWUFramed
PWUScopeRevised
ParticipantAssigned
ParticipantRemoved
PWUDeclaredReady
PWUActivated
QuestionIdentified
UncertaintyIdentified
AssumptionRegistered
ConstraintRegistered
RepresentationAdded
ReasoningStarted
ReasoningCompleted
ReasoningFailed
ClaimProposed
EvidenceAdded
ConfidenceAssessed
AlternativeIdentified
DecisionProposed
DecisionApproved
DecisionRejected
ActionAuthorized
ObservationRecorded
DependencyAdded
DependencySatisfied
PWUBlocked
PWUUnblocked
EvidenceRequested
DecisionRequested
ReviewRequested
ReconciliationStarted
ReconciliationApplied
PWUDecomposed
PWURecomposed
PWUValidationPassed
PWUValidationFailed
PWUCompleted
PWUSuspended
PWUCancelled
PWUSuperseded
PWUReopened
PWUFailed
PWUEscalated
```

## 32.2 Event Requirements

Every event SHALL include:

```text
eventId
eventType
pwuId
pwuVersion
occurredAt
recordedAt
actorId
correlationId
causationId
payload
provenance
```

---

# 33. Aggregate Invariants

## PWU-INV-001 — Objective Required

A PWU SHALL possess exactly one active professional objective.

## PWU-INV-002 — Intent Required

A non-exploratory PWU SHALL trace to at least one active Intent.

## PWU-INV-003 — Explicit State

Lifecycle and cognitive state SHALL be explicit.

## PWU-INV-004 — Scope Integrity

Material work SHALL remain within authorized scope unless scope is revised.

## PWU-INV-005 — Provenance

Material entities created within the PWU SHALL record provenance.

## PWU-INV-006 — AI Attribution

AI-created work SHALL remain explicitly attributable to the AI Participant and execution context.

## PWU-INV-007 — Completion Conditions

A PWU SHALL define completion conditions before activation.

## PWU-INV-008 — No Activity-Only Completion

Activity execution alone SHALL NOT satisfy PWU completion.

## PWU-INV-009 — Blocking Transparency

A blocked PWU SHALL identify the blocking condition and required resolution.

## PWU-INV-010 — Decision Authority

A Decision SHALL NOT become approved without valid authority.

## PWU-INV-011 — Mandatory Constraint Enforcement

A PWU SHALL NOT authorize an Action that violates a mandatory Constraint without an authorized exception.

## PWU-INV-012 — Critical Assumption Visibility

Critical assumptions SHALL be explicit and linked to dependent work.

## PWU-INV-013 — Evidence Separation

Claims and supporting Evidence SHALL remain distinct entities.

## PWU-INV-014 — Observation Separation

Observation, interpretation, and Claim SHALL remain distinguishable.

## PWU-INV-015 — Child Delegation

A child PWU SHALL possess a delegation contract.

## PWU-INV-016 — Parent Recomposition

A parent PWU SHALL recompose child work before completion.

## PWU-INV-017 — Historical Preservation

Reopening, supersession, and reconciliation SHALL preserve prior state.

## PWU-INV-018 — Unresolved Contradiction Visibility

Material contradictions SHALL remain visible until disposition.

## PWU-INV-019 — Escalation

The PWU SHALL escalate when responsible advancement exceeds available authority or capability.

## PWU-INV-020 — Projection Non-Authority

UI state SHALL NOT independently alter professional state without a valid command.

---

# 34. API Resource Model

A reference API MAY expose:

```text
/endeavors/{endeavorId}/pwus
/pwus/{pwuId}
/pwus/{pwuId}/state
/pwus/{pwuId}/participants
/pwus/{pwuId}/questions
/pwus/{pwuId}/uncertainties
/pwus/{pwuId}/assumptions
/pwus/{pwuId}/constraints
/pwus/{pwuId}/representations
/pwus/{pwuId}/reasoning
/pwus/{pwuId}/claims
/pwus/{pwuId}/evidence
/pwus/{pwuId}/decisions
/pwus/{pwuId}/actions
/pwus/{pwuId}/observations
/pwus/{pwuId}/dependencies
/pwus/{pwuId}/validations
/pwus/{pwuId}/reconciliations
/pwus/{pwuId}/children
/pwus/{pwuId}/history
/pwus/{pwuId}/commands
```

Public API operations SHOULD express professional semantics rather than generic field mutation.

Preferred:

```text
POST /pwus/{id}/commands/identify-uncertainty
POST /pwus/{id}/commands/propose-decision
POST /pwus/{id}/commands/decompose
POST /pwus/{id}/commands/complete
```

Discouraged as the primary contract:

```text
PATCH /pwus/{id}
{
  "status": "complete"
}
```

---

# 35. Reference Data Structure

A minimum logical PWU representation may take the following form:

```json
{
  "pwuId": "pwu_01",
  "pwuType": "architecture_design",
  "title": "Define tenant isolation architecture",
  "professionalObjective": {
    "statement": "Define and validate an architecture that prevents unauthorized cross-tenant data access.",
    "outcomeContributionIds": ["outcome_secure_multitenancy"]
  },
  "endeavorId": "endeavor_janumi_platform",
  "parentPwuId": "pwu_platform_architecture",
  "rootPwuId": "pwu_janumi_product_realization",
  "version": 7,
  "lifecycleState": "active",
  "cognitiveState": "reasoning",
  "originatingIntentIds": ["intent_enterprise_multitenancy"],
  "scope": {
    "included": [
      "application-level tenant isolation",
      "database isolation strategy",
      "authorization boundaries"
    ],
    "excluded": [
      "commercial packaging",
      "tenant-specific branding"
    ]
  },
  "participants": [],
  "questions": [],
  "uncertainties": [],
  "assumptions": [],
  "constraints": [],
  "representations": [],
  "reasoningActivities": [],
  "claims": [],
  "evidence": [],
  "confidenceAssessments": [],
  "alternatives": [],
  "decisions": [],
  "actions": [],
  "observations": [],
  "dependencies": [],
  "validations": [],
  "reconciliations": [],
  "childPwuIds": [],
  "completionConditions": [],
  "escalationConditions": [],
  "createdAt": "2026-07-13T16:00:00-04:00",
  "createdBy": "participant_architect"
}
```

This structure is illustrative, not yet the machine schema.

---

# 36. Reference UI Projection

The canonical PWU workspace SHALL present the aggregate as professional cognition rather than as a generic record form.

## 36.1 Workspace Header

The header SHOULD expose:

* title;
* professional objective;
* lifecycle state;
* cognitive state;
* parent context;
* Intent trace;
* owner;
* current confidence;
* unresolved critical uncertainty;
* pending reconciliation.

## 36.2 Persistent Context Rail

The workspace SHOULD preserve persistent access to:

```text
Intent
Objective
Scope
Participants
Dependencies
Assumptions
Constraints
History
```

## 36.3 Primary Cognitive Canvas

The central workspace SHALL change according to the active projection:

```text
understanding
reasoning
evidence
decision
execution
observation
reconciliation
decomposition
```

## 36.4 Action Region

Available controls SHALL derive from:

* lifecycle state;
* cognitive state;
* Participant role;
* authority;
* validation status;
* blocking conditions;
* PWA policy.

A user SHALL NOT see an enabled “Complete” action when completion preconditions are unsatisfied.

## 36.5 State Explanation

Every lifecycle state SHOULD answer:

* Why is the PWU in this state?
* What must happen next?
* Who can act?
* What is blocking progress?
* What professional condition permits transition?

---

# 37. Minimum Viable PWU Implementation

A first implementation SHALL support:

## 37.1 Core State

```text
identity
objective
intent links
scope
lifecycle state
cognitive state
participants
dependencies
completion conditions
history
```

## 37.2 Core Cognition

```text
questions
uncertainties
assumptions
representations
reasoning activities
claims
evidence
decisions
validations
reconciliations
```

## 37.3 Core Operations

```text
propose
frame
activate
block
unblock
decompose
record reasoning
add evidence
propose decision
approve decision
validate
reconcile
complete
reopen
escalate
```

## 37.4 Core UI

```text
PWU overview
reasoning projection
evidence projection
decision projection
decomposition projection
reconciliation projection
history projection
```

---

# 38. Coding Agent Implementation Contract

A coding agent implementing the PWU model SHALL:

1. Model lifecycle and cognitive state independently.
2. Implement explicit commands rather than unrestricted status mutation.
3. Validate state transitions server-side.
4. preserve optimistic concurrency.
5. Record immutable domain events.
6. Distinguish aggregate-owned entities from external references.
7. Preserve provenance for human and AI contributions.
8. Prevent completion when completion conditions fail.
9. Implement child delegation and parent recomposition explicitly.
10. Expose contradictions and unresolved uncertainty.
11. Avoid modeling PWUs as generic tasks.
12. Avoid deriving state from missing or empty fields.
13. Avoid allowing UI projections to become independent sources of truth.
14. Produce typed failures for invalid commands and transitions.
15. Emit observability events at every material decision boundary.

---

# 39. Acceptance Scenarios

## Scenario A — Valid Activation

Given:

* a PWU in `framing`;
* a valid objective;
* active Intent;
* defined scope;
* assigned owner;
* completion conditions;
* no mandatory framing failures;

When:

* `DeclareReady` is accepted;
* `ActivatePWU` is accepted;

Then:

* lifecycle state becomes `active`;
* separate events are emitted;
* version increments for each accepted command;
* state rationale is reconstructable.

## Scenario B — Invalid Completion

Given:

* a PWU in `awaiting_review`;
* a mandatory validation result of `fail`;

When:

* a Participant requests `CompletePWU`;

Then:

* completion is rejected;
* lifecycle state remains unchanged;
* a typed `MANDATORY_VALIDATION_FAILED` error is returned;
* the failed attempt is observable;
* no completion event is emitted.

## Scenario C — Assumption Failure

Given:

* an active PWU;
* a critical assumption supporting an approved Decision;
* new Evidence invalidating the assumption;

When:

* the Evidence is accepted;

Then:

* the assumption becomes `invalidated`;
* affected Claims and Decisions are marked for impact assessment;
* reconciliation is triggered;
* the PWU may transition to `reconciling`;
* dependent PWUs receive impact events.

## Scenario D — Child Completion Without Recomposition

Given:

* a parent PWU with three child PWUs;
* all children are completed;
* no parent recomposition exists;

When:

* parent completion is requested;

Then:

* completion is rejected;
* `RECOMPOSITION_REQUIRED` is returned;
* the parent remains active or awaiting review.

## Scenario E — Responsible Escalation

Given:

* an AI Reasoner;
* repeated failed tactics;
* unresolved legal ambiguity;
* no delegated legal authority;

When:

* the agent determines it cannot continue responsibly;

Then:

* `EscalatePWU` is issued;
* the PWU enters an appropriate awaiting or escalated condition;
* the escalation package identifies attempted tactics, evidence, uncertainty, and required authority;
* the agent does not fabricate a legal conclusion.

---

# 40. Resulting Architectural Interpretation

The PWU is the smallest Janumi aggregate that can answer:

* Why does this work exist?
* What professional objective governs it?
* What is currently understood?
* What remains uncertain?
* What reasoning is underway?
* What evidence exists?
* What decisions have been made?
* What actions are authorized?
* What did reality reveal?
* What contradictions exist?
* What makes this work complete?
* How does it connect to larger work?
* Can its reasoning be reconstructed?

A task system records that activity occurred.

A PWU records how professional cognition advanced, failed, changed, and contributed to an outcome.

---

# 41. Next Normative Artifact

The next required specification is the **Recursive Professional Harness Coordination Specification**.

That specification shall define:

* how an RPH creates and advances PWUs;
* recursive delegation;
* agent allocation;
* control states;
* planning and replanning;
* tactic-change thresholds;
* retries;
* validation boundaries;
* human intervention;
* cross-PWU synthesis;
* escalation;
* failure disposition;
* continuous reconciliation;
* harness observability.

The RPH specification will make the PWU aggregate operational without reducing it to a conventional workflow.
