# Janumi Execution Model

## JEM Specification v0.1.0

**Document ID:** `JAN-JEM-001`
**Version:** `0.1.0`
**Status:** Draft
**Depends on:** CPCO v0.1, PWU Specification v0.1, RPH Coordination Specification v0.1, Canonical Projection Model v0.1, JSDL Core v0.1, JSDL Compiler Architecture v0.1
**Applies to:** Every Janumi runtime profile, including single-node, distributed, enterprise, offline, edge, development, and testing runtimes
**Primary audiences:** Runtime architects, backend engineers, workflow engineers, agent-platform developers, coding agents, platform security engineers, SREs, PWA authors

---

# 1. Purpose

The Janumi Execution Model, or JEM, defines the invariant behavioral semantics by which Janumi professional cognition becomes executable.

JSDL defines the semantic model.

JEM defines how changes to that model are:

* requested;
* authorized;
* validated;
* committed;
* observed;
* projected;
* coordinated;
* suspended;
* resumed;
* retried;
* reconciled;
* escalated;
* audited.

JEM is independent of any particular:

* database;
* programming language;
* deployment platform;
* messaging system;
* workflow engine;
* API style;
* infrastructure topology.

A runtime is Janumi-conformant only if it preserves the semantics defined in this specification.

---

# 2. Architectural Position

```text
Professional Cognition Discipline
        ↓
Canonical Professional Cognition Ontology
        ↓
JSDL Semantic Definitions
        ↓
Janumi Execution Model
        ↓
Runtime Profile
        ↓
Infrastructure and Deployment
```

The runtime profile may vary.

The execution semantics SHALL not.

---

# 3. Central Execution Principle

A Janumi state change becomes authoritative only when:

1. a semantic Command has been received;
2. the caller has been authenticated;
3. authority has been evaluated;
4. the target semantic state has been loaded;
5. concurrency expectations have been checked;
6. applicable preconditions and invariants have been evaluated;
7. the resulting state transition has been accepted;
8. immutable semantic Events have been persisted;
9. the authoritative state has been committed atomically within the declared consistency boundary.

Nothing is authoritative merely because:

* an agent generated output;
* a workflow step completed;
* a UI submitted a form;
* an external tool returned successfully;
* an event was placed on a message bus;
* a projection displayed the result;
* an artifact was created;
* a human expressed informal approval.

---

# 4. Execution Objects

JEM recognizes the following execution objects.

## 4.1 Command

A request to perform a professionally meaningful state transition.

## 4.2 Command Context

The authenticated and semantic context under which a Command is evaluated.

## 4.3 Aggregate

The transactional consistency boundary for authoritative mutation.

## 4.4 Event

An immutable semantic fact resulting from an accepted Command or governed runtime process.

## 4.5 Validator

A governed evaluation that determines whether a condition is satisfied.

## 4.6 Process Instance

A durable coordinator spanning multiple Commands, Aggregates, Participants, or time periods.

## 4.7 RPH Instance

A specialized Process Instance that coordinates professional cognition across one or more PWUs.

## 4.8 Agent Execution

A bounded invocation of an AI Participant under an explicit professional contract.

## 4.9 Projection

A derived view over authoritative state and Events.

## 4.10 Reconciliation Case

A governed process for resolving detected incoherence.

## 4.11 Attention Item

A durable indication that professional intervention is required.

---

# 5. Command Envelope

Every authoritative Command SHALL include:

```text
commandId
commandType
commandVersion
targetType
targetId
expectedVersion
requestedBy
requestedAt
correlationId
causationId
tenantId
organizationId
professionalContext
originatingProjection
payload
idempotencyKey
```

## 5.1 `commandId`

Globally unique identity for this Command request.

## 5.2 `expectedVersion`

The authoritative version the caller believes it is changing.

This MAY be optional for create operations.

## 5.3 `correlationId`

Groups related professional and computational work.

## 5.4 `causationId`

Identifies the prior Command, Event, Agent Execution, or Process action that caused this Command.

## 5.5 `professionalContext`

SHOULD identify:

```text
endeavorId
pwuId
rphId
intentIds
participantRole
authorityScope
temporalMode
```

## 5.6 `originatingProjection`

Preserves the UI or agent projection from which the Command arose.

## 5.7 `idempotencyKey`

Allows safe replay of semantically identical requests.

---

# 6. Command Handling Pipeline

A conformant runtime SHALL process a Command through the following stages.

```text
Receive
  ↓
Authenticate
  ↓
Resolve Tenant and Organization
  ↓
Load Semantic Definition
  ↓
Evaluate Idempotency
  ↓
Load Aggregate
  ↓
Check Expected Version
  ↓
Evaluate Authority
  ↓
Normalize and Validate Payload
  ↓
Execute Preconditions
  ↓
Evaluate Invariants
  ↓
Apply Semantic Transition
  ↓
Create Events
  ↓
Commit Aggregate and Events
  ↓
Publish Post-Commit Notifications
  ↓
Update Projections
  ↓
Return Result
```

The runtime MAY optimize implementation details but SHALL preserve this observable semantic order.

---

# 7. Authentication and Identity

The runtime SHALL distinguish:

* authenticated identity;
* represented Participant;
* delegated Participant;
* executing service;
* AI agent identity;
* human principal;
* external system principal.

## 7.1 Authentication

Authentication establishes who or what initiated the request.

## 7.2 Participant Resolution

The authenticated principal SHALL resolve to one or more Janumi Participants.

## 7.3 Delegation

Delegated authority SHALL be explicit, scoped, and time-bounded where applicable.

## 7.4 AI Identity

An AI Agent execution SHALL identify:

```text
agentId
agentRole
modelIdentity
modelVersion
executionPolicy
toolAuthority
delegatingParticipant
```

An AI request SHALL not inherit unrestricted authority from the service account executing it.

---

# 8. Authority Evaluation

Authority SHALL be evaluated at Command execution time.

It SHALL not be trusted solely from:

* UI visibility;
* stale access tokens;
* prior role assignment;
* agent prompt instructions;
* cached projection metadata.

## 8.1 Authority Inputs

Authority evaluation SHALL consider:

```text
authenticatedPrincipal
representedParticipant
assignedRoles
delegatedAuthority
targetScope
commandType
currentLifecycleState
organizationPolicy
PWA Policy
mandatoryConstraints
timeValidity
exceptionAuthority
```

## 8.2 Authority Outcomes

```text
authorized
authorized_conditionally
unauthorized
requires_additional_approval
requires_exception
```

## 8.3 Conditional Authority

Conditional authority SHALL identify the unmet condition.

## 8.4 Multi-Party Authority

Where multiple approvals or quorum are required, one approval SHALL produce an intermediate authoritative state rather than final approval.

---

# 9. Aggregate Loading

The runtime SHALL load the authoritative Aggregate state required to evaluate the Command.

The Aggregate may be reconstructed from:

* current state tables;
* event history;
* snapshots plus Events;
* a hybrid persistence model.

The result SHALL be semantically equivalent.

## 9.1 Aggregate Version

Every mutable Aggregate SHALL expose an authoritative version.

## 9.2 Snapshot Correctness

A snapshot SHALL identify:

```text
aggregateId
aggregateVersion
sourceEventPosition
modelVersion
createdAt
```

A snapshot is an optimization, not an independent truth.

---

# 10. Optimistic Concurrency

Optimistic concurrency is the default JEM consistency mechanism.

## 10.1 Version Check

If:

```text
command.expectedVersion != aggregate.currentVersion
```

the Command SHALL fail unless the Command type explicitly supports merge or reconciliation semantics.

## 10.2 Concurrency Failure

The runtime SHALL return:

```text
currentVersion
expectedVersion
materialChangesSinceExpectedVersion
recommendedDisposition
```

where feasible.

## 10.3 No Silent Last-Write-Wins

Material professional state SHALL not use silent last-write-wins behavior.

## 10.4 Retry After Concurrency Failure

A client or Process MAY:

* reload;
* compare;
* revise;
* issue a new Command;
* open reconciliation.

It SHALL not automatically resubmit a stale material Command without revalidation.

---

# 11. Idempotency

Every externally initiated state-changing Command SHOULD be idempotent.

## 11.1 Idempotency Scope

Idempotency SHALL be scoped by:

```text
tenantId
commandType
targetId
idempotencyKey
```

## 11.2 Duplicate Command

When an identical Command has already completed, the runtime SHALL return the prior authoritative result.

## 11.3 Conflicting Reuse

Reusing an idempotency key with different payload or target SHALL fail.

## 11.4 Event Duplication

Idempotency SHALL prevent duplicate semantic Events from being committed for the same accepted Command.

---

# 12. Payload Normalization

Command payloads SHALL be normalized before semantic validation.

Normalization MAY include:

* canonical identifiers;
* date normalization;
* enum normalization;
* whitespace normalization;
* reference normalization;
* source-type normalization;
* PWA-specific canonicalization.

Normalization SHALL not change professional intent.

## 12.1 Boundary Contract

All external inputs are untrusted.

The runtime SHALL:

```text
parse
normalize
validate
canonicalize
authorize
```

before authoritative mutation.

---

# 13. Validator Execution Model

Validators may be:

```text
structural
semantic
professional
coherence
governance
temporal
security
safety
external
human
AI-assisted
```

## 13.1 Validator Ordering

Unless a JSDL definition specifies stricter order, validators SHALL execute in this sequence:

1. structural;
2. type and schema;
3. authority-independent semantic;
4. governance;
5. security and safety;
6. aggregate invariants;
7. cross-aggregate coherence;
8. external;
9. AI-assisted;
10. human validation.

This order minimizes expensive or external work on obviously invalid Commands.

## 13.2 Validator Result

Every Validator SHALL return:

```text
validatorId
validatorVersion
subjectId
result
severity
rationale
evidenceIds
performedBy
performedAt
expiresAt
limitations
```

## 13.3 Result Values

```text
pass
fail
conditional_pass
inconclusive
not_applicable
```

## 13.4 Inconclusive Result

An inconclusive Validator result SHALL not be silently treated as pass.

The governing Command or lifecycle transition SHALL define whether inconclusive:

* blocks;
* requests Evidence;
* requires human review;
* permits conditional continuation;
* escalates.

## 13.5 Validator Side Effects

A Validator SHALL not directly mutate authoritative domain state.

It MAY produce:

* a Validation entity;
* Evidence;
* an Attention Item;
* a recommendation;
* a follow-on Command proposal.

Authoritative changes require Commands.

---

# 14. Synchronous and Asynchronous Validation

## 14.1 Synchronous Validators

Used when:

* execution is bounded;
* results are immediately available;
* Command acceptance depends on the result;
* the Validator does not require human or long-running external work.

## 14.2 Asynchronous Validators

Used when validation requires:

* external systems;
* human review;
* long-running analysis;
* substantial AI reasoning;
* physical inspection;
* scientific experiment;
* legal or policy review.

## 14.3 Pending Validation

A Command requiring asynchronous validation SHALL not falsely complete.

It SHALL instead produce an appropriate intermediate state such as:

```text
awaiting_review
awaiting_evidence
awaiting_external
```

and a durable Process Instance.

---

# 15. Invariant Evaluation

Invariants SHALL be evaluated:

* before committing a mutation;
* after applying the proposed transition;
* against the resulting authoritative state;
* within the relevant consistency boundary.

## 15.1 Pre-State and Post-State

An invariant may refer to:

```text
priorState
command
proposedState
actor
authorityContext
```

## 15.2 Invariant Failure

An error-level invariant failure SHALL abort the transaction.

No authoritative Events SHALL be committed.

## 15.3 Advisory Invariants

Warning or advisory conditions MAY permit continuation but SHALL remain observable and may create Attention Items.

---

# 16. Transaction Boundary

The minimum atomic transaction SHALL include:

1. authoritative Aggregate state change;
2. Aggregate version increment;
3. immutable Event persistence;
4. Command-result persistence;
5. idempotency record.

These SHALL either all commit or none commit.

## 16.1 Outbox

Where post-commit publication uses a message broker, the runtime SHALL use a transactional outbox or equivalent guarantee.

## 16.2 Projection Update

Projection updates MAY occur outside the authoritative transaction.

They SHALL be driven by committed Events or authoritative state.

## 16.3 External Side Effects

External side effects SHALL not be assumed atomic with the Aggregate transaction unless the runtime profile explicitly provides that guarantee.

They SHALL use durable Process or saga semantics.

---

# 17. Event Persistence

Every accepted material Command SHALL produce one or more immutable Events.

## 17.1 Event Envelope

```text
eventId
eventType
eventVersion
aggregateId
aggregateType
aggregateVersion
occurredAt
recordedAt
actorId
participantId
tenantId
organizationId
correlationId
causationId
commandId
payload
provenance
semanticModelVersion
```

## 17.2 Event Ordering

Events for a single Aggregate SHALL have a total order.

The authoritative ordering key SHOULD be:

```text
aggregateVersion
```

## 17.3 Cross-Aggregate Ordering

JEM does not require a total global event order.

Cross-Aggregate coordination SHALL use:

* correlation;
* causation;
* process state;
* logical clocks;
* durable sequence positions;
* reconciliation when necessary.

## 17.4 Event Time

`occurredAt` represents semantic occurrence.

`recordedAt` represents runtime persistence.

These SHALL remain distinct.

---

# 18. Event Publication

Post-commit Event publication MAY be:

* synchronous;
* asynchronous;
* brokered;
* polled from an outbox;
* delivered through database change streams.

## 18.1 At-Least-Once Delivery

Runtime profiles MAY use at-least-once delivery.

Consumers SHALL therefore be idempotent.

## 18.2 Delivery Does Not Define Authority

An Event is authoritative because it was committed, not because it was delivered.

## 18.3 Publication Failure

Publication failure SHALL not roll back already committed authoritative state.

It SHALL trigger retry and operational attention.

---

# 19. Projection Execution

Projections are derived and MAY be eventually consistent.

## 19.1 Projection Source

A projection builder SHALL consume:

* committed Events;
* authoritative state;
* or both.

## 19.2 Projection Checkpoint

Each projection instance or store SHALL track a checkpoint.

```text
projectionId
partition
lastProcessedEventPosition
updatedAt
status
```

## 19.3 Projection Status

```text
current
catching_up
stale
failed
rebuilding
partial
offline
```

## 19.4 Command Safety from Projections

A state-changing Command initiated from a projection SHALL include expected Aggregate versions or equivalent semantic version context.

## 19.5 Rebuild

A projection SHALL be rebuildable from authoritative state and Event history.

A projection that cannot be rebuilt SHALL be treated as an authoritative subsystem and governed separately.

---

# 20. Projection Consistency Model

JEM supports:

## 20.1 Strongly Current Projection

Generated within or immediately from the authoritative transaction.

Use sparingly.

## 20.2 Read-After-Write Projection

The initiating caller is guaranteed to observe its accepted Command result.

## 20.3 Eventually Consistent Projection

Updated asynchronously after Event commit.

## 20.4 Historical Projection

Derived as of a selected temporal point.

## 20.5 Predictive Projection

Derived from models and explicitly non-authoritative.

Every projection SHALL disclose its consistency mode.

---

# 21. Process Instances

A Process Instance coordinates work spanning:

* multiple transactions;
* multiple Aggregates;
* long time periods;
* human participation;
* external systems;
* retries;
* suspension.

Examples:

* asynchronous validation;
* Decision approval;
* RPH coordination;
* external Evidence collection;
* reconciliation;
* agent execution with review.

## 21.1 Process State

Every Process Instance SHALL persist:

```text
processId
processType
processVersion
status
currentStep
correlationId
causationId
startedAt
updatedAt
deadline
retryState
suspensionReason
inputReferences
outputReferences
history
```

## 21.2 Process Status

```text
created
running
waiting
suspended
retrying
reconciling
completed
failed
cancelled
escalated
```

## 21.3 Durable Waiting

Waiting for:

* human review;
* external Evidence;
* time;
* external callback;
* another PWU;
* authority;
* resource availability

SHALL be represented durably, not by keeping an in-memory thread alive.

---

# 22. RPH Instance Lifecycle

An RPH Instance is a durable professional coordination Process.

## 22.1 RPH States

```text
initializing
framing
planning
allocating
coordinating
observing
validating
reconciling
synthesizing
awaiting_human
awaiting_external
changing_tactic
escalating
completed
failed
cancelled
```

## 22.2 RPH State Is Not PWU State

An RPH may be:

```text
observing
```

while its coordinated PWUs occupy many different lifecycle states.

## 22.3 RPH Authoritative State

An RPH SHALL persist:

```text
rphId
professionalObjective
authority
scope
coordinatedPwuIds
childRphIds
participants
allocationState
currentPlan
activeTactics
validationPolicy
reconciliationPolicy
escalationPolicy
synthesisState
observabilityState
```

---

# 23. RPH Planning Semantics

Planning is continuous and versioned.

## 23.1 Plan

An RPH plan SHALL identify:

```text
planId
planVersion
professionalObjective
requiredPWUs
dependencies
allocations
validationPoints
decisionPoints
synthesisPoints
escalationConditions
assumptions
```

## 23.2 Plan Revision

A material plan revision SHALL record:

* trigger;
* prior plan;
* changed assumptions;
* affected PWUs;
* affected Participants;
* expected effect;
* authority.

## 23.3 Plan Is Not Authority

The plan does not directly mutate PWUs.

It produces or proposes semantic Commands.

---

# 24. Work Allocation

Allocation assigns bounded responsibility to:

* humans;
* AI Agents;
* teams;
* external systems;
* child RPHs;
* external organizations.

## 24.1 Allocation Contract

```text
allocationId
objective
scope
authority
participant
requiredInputs
requiredOutputs
constraints
completionConditions
validationRequirements
escalationConditions
deadline
```

## 24.2 Capability Evaluation

Allocation SHOULD consider:

```text
capability
authority
availability
cost
risk
domain suitability
historical quality
tool access
conflict of interest
independence requirements
```

## 24.3 Allocation Failure

If no responsible allocation can be made, the RPH SHALL:

* revise scope;
* seek another Participant;
* create an Attention Item;
* escalate;
* or fail explicitly.

---

# 25. Agent Execution Contract

Every AI Agent invocation SHALL be a durable, attributable execution object.

## 25.1 Required Inputs

```text
agentExecutionId
agentId
agentRole
modelIdentity
objective
originatingIntent
scope
authority
constraints
contextProjection
availableEvidence
requiredOutputs
validationCriteria
completionConditions
terminationConditions
escalationConditions
toolPermissions
resourceLimits
```

## 25.2 Required Outputs

```text
producedEntityProposals
reasoningSummary
evidenceUsed
assumptionsIntroduced
claimsProduced
confidenceAssessments
limitations
unresolvedQuestions
residualUncertainty
recommendedCommands
validationResults
provenance
```

## 25.3 Proposal Boundary

AI output SHALL be treated as proposed professional state unless the AI possesses explicit governed authority for the relevant Command.

## 25.4 Agent Tool Use

Each tool invocation SHALL record:

```text
toolCallId
toolId
input
authorizationScope
startedAt
completedAt
resultReference
error
```

Secrets and protected content SHALL be handled according to security policy.

## 25.5 Hidden Reasoning

The runtime SHALL not require storage of private model chain-of-thought.

It SHALL preserve professional rationale, Evidence, assumptions, methods, and limitations sufficient for review.

---

# 26. Agent Execution States

```text
created
queued
running
waiting_for_tool
waiting_for_evidence
waiting_for_human
validating
completed
failed
cancelled
escalated
timed_out
```

## 26.1 Agent Completion

An Agent Execution may complete successfully while the PWU remains incomplete.

## 26.2 Agent Failure

Agent failure SHALL preserve:

* work performed;
* outputs produced;
* tool history;
* failure classification;
* remaining uncertainty;
* recommended next tactic.

---

# 27. Retry Semantics

Retries SHALL distinguish transient execution failure from professional reasoning failure.

## 27.1 Technical Retry

Appropriate for:

* temporary network failure;
* transient service outage;
* rate limiting;
* temporary resource unavailability;
* broker delivery failure.

## 27.2 Professional Retry

A repeated attempt at the same reasoning or validation method.

This SHALL not be automatic without policy because repetition may provide no professional value.

## 27.3 Retry Policy

```text
maxAttempts
backoff
retryableFailureClasses
deadline
jitterPolicy
escalationAfterExhaustion
```

## 27.4 Idempotent Retry

Technical retries SHALL preserve idempotency.

## 27.5 Retry Observability

Retries SHALL be observable and correlated to the original execution.

---

# 28. Tactic Change Semantics

A tactic change is not a retry.

It changes the professional approach.

## 28.1 Trigger Conditions

Examples:

* no material uncertainty reduction;
* repeated validation failure;
* recurring identical defect;
* oscillation among Alternatives;
* contradictory Evidence;
* method invalidation;
* context-window saturation;
* insufficient domain capability;
* excessive decomposition overhead;
* tool limitation.

## 28.2 Tactic Change Actions

```text
change_method
change_agent
change_model
request_human
add_evidence
broaden_search
narrow_scope
reframe_question
challenge_assumption
decompose
recompose
merge_work
escalate
```

## 28.3 Authority

A tactic change SHALL occur only within delegated coordination authority.

## 28.4 Tactic History

The RPH SHALL preserve:

* prior tactic;
* observed result;
* reason for change;
* selected new tactic;
* expected improvement.

---

# 29. Progress Evaluation

JEM SHALL distinguish:

* computational activity;
* professional progress.

## 29.1 Computational Activity

Examples:

* tool calls;
* generated tokens;
* files modified;
* tests run;
* messages exchanged.

## 29.2 Professional Progress

Examples:

* uncertainty reduced;
* Evidence improved;
* Claim confidence changed;
* Decision readiness increased;
* contradiction resolved;
* validation completed;
* synthesis advanced.

## 29.3 No-Progress Detection

RPH policy MAY define a no-progress window based on:

```text
iterationCount
elapsedTime
cost
unchangedUncertainty
unchangedValidationState
repeatedFailureClass
oscillation
```

No-progress detection SHOULD trigger tactic evaluation, not immediate blind retry.

---

# 30. Suspension and Resumption

Long-running professional work frequently waits.

## 30.1 Suspension Reasons

```text
awaiting_human
awaiting_evidence
awaiting_external
awaiting_decision
awaiting_time
resource_unavailable
policy_hold
manual_pause
```

## 30.2 Suspension State

The runtime SHALL persist:

```text
suspendedAt
suspensionReason
resumeTrigger
deadline
responsibleParticipant
attentionItemId
```

## 30.3 Resume Triggers

```text
command
event
time
external_callback
evidence_arrival
decision_approval
dependency_satisfied
manual_resume
```

## 30.4 Resume Validation

Resumption SHALL re-evaluate:

* authority;
* current semantic state;
* relevant Constraints;
* stale assumptions;
* model version compatibility;
* deadlines;
* dependency state.

A suspended Process SHALL not assume that the world remained unchanged.

---

# 31. Timers and Deadlines

Timers SHALL be durable.

## 31.1 Timer Types

```text
deadline
review_due
evidence_due
retry_due
reconciliation_review
temporary_exception_expiration
attention_escalation
```

## 31.2 Clock Source

The runtime SHALL use a trusted, consistent clock source.

## 31.3 Timer Event

Timer expiration SHALL generate an Event or Process wake-up.

It SHALL not mutate domain state invisibly.

---

# 32. External Integration Semantics

External systems may provide:

* Evidence;
* Artifacts;
* Observations;
* identity;
* approvals;
* execution;
* telemetry.

## 32.1 Integration Boundary

External input SHALL be normalized into explicit CPCO or runtime objects.

## 32.2 External Command

Where Janumi instructs an external system, the runtime SHALL persist:

```text
externalOperationId
request
authorization
idempotencyKey
status
response
attempts
```

## 32.3 Callback

External callbacks SHALL be authenticated and idempotent.

## 32.4 External Success

External operation success SHALL not automatically imply:

* Decision correctness;
* Action validation;
* outcome achievement;
* PWU completion.

---

# 33. Saga and Compensation Semantics

Multi-system operations SHALL use durable saga-style coordination.

## 33.1 Compensation

A compensation is a new professional or technical Action.

It is not a rollback of history.

## 33.2 Compensation Record

```text
originalAction
failure
compensatingAction
authority
result
residualEffect
```

## 33.3 Non-Compensable Actions

Where an Action cannot be reversed, the process SHALL identify:

* irreversibility;
* risk;
* approval requirement;
* recovery strategy;
* observation requirements.

---

# 34. Reconciliation Execution

Reconciliation SHALL be a first-class Process.

## 34.1 Detection

A reconciliation trigger may arise from:

* new Evidence;
* contradiction;
* assumption failure;
* intent revision;
* constraint change;
* validation failure;
* observation mismatch;
* cross-PWU conflict;
* external event;
* concurrency conflict;
* offline synchronization conflict.

## 34.2 Reconciliation Case

```text
reconciliationId
trigger
affectedEntities
affectedAggregates
affectedPWUs
affectedDecisions
priorStateReferences
proposedChanges
impactAssessment
requiredAuthority
validationPlan
status
```

## 34.3 Reconciliation States

```text
detected
analyzing
proposed
awaiting_review
accepted
rejected
applying
applied
partially_applied
escalated
failed
```

## 34.4 Application

Applying reconciliation SHALL issue normal semantic Commands.

The reconciliation Process SHALL not bypass Aggregate invariants.

## 34.5 Partial Application

If some changes commit and others fail, the Process SHALL:

* preserve committed changes;
* identify remaining incoherence;
* reassess impact;
* retry, revise, compensate, or escalate.

---

# 35. Cross-Aggregate Consistency

JEM does not require distributed ACID transactions across all professional state.

Cross-Aggregate coherence SHALL be maintained through:

* Commands;
* Events;
* Process Instances;
* Validators;
* reconciliation;
* compensating Actions;
* explicit temporary incoherence.

## 35.1 Temporary Incoherence

Temporary incoherence SHALL be:

* visible;
* bounded;
* risk-assessed;
* authorized;
* reviewed;
* time-qualified.

## 35.2 Cross-Aggregate Validator

A cross-Aggregate Validator may inspect multiple authoritative states.

It SHALL not mutate them directly.

---

# 36. Parent–Child PWU Execution

## 36.1 Decomposition

Creating a child PWU SHALL:

1. validate the parent’s authority;
2. create a delegation contract;
3. create the child Aggregate;
4. link parent and child;
5. establish recomposition obligations;
6. emit corresponding Events.

## 36.2 Child Independence

A child PWU advances under its own lifecycle and concurrency version.

## 36.3 Parent Observation

The parent or RPH observes child Events through projections or coordination Processes.

## 36.4 Recomposition

The parent SHALL not complete until required recomposition is accepted.

## 36.5 Child Reopening

A child may be reopened after parent synthesis if new conflict or Evidence emerges.

This SHALL trigger parent impact assessment.

---

# 37. Synthesis Execution

Synthesis reconstructs parent understanding from subordinate work.

## 37.1 Synthesis Inputs

```text
childOutputs
childClaims
childEvidence
childDecisions
childAssumptions
childResidualUncertainty
childValidations
crossChildDependencies
contradictions
```

## 37.2 Synthesis Output

Synthesis SHALL produce explicit professional entities, such as:

* synthesized Representation;
* parent Claims;
* confidence assessment;
* contradiction set;
* follow-on PWUs;
* updated Decision proposal;
* recomposition Validation.

## 37.3 Synthesis Authority

Synthesis may be AI-assisted, but acceptance SHALL follow normal authority and validation rules.

---

# 38. Human Interaction Semantics

Human work may occur through:

* UI Command;
* review;
* approval;
* Evidence contribution;
* external action;
* structured response;
* conversational proposal.

## 38.1 Human Task

A human task SHALL be durable and semantically typed.

```text
review_required
decision_required
evidence_required
validation_required
exception_required
reconciliation_required
```

## 38.2 Human Response

A human response SHALL be converted into:

* a Command;
* Evidence;
* Observation;
* Validation;
* Decision;
* or another explicit entity.

It SHALL not remain only as unstructured process metadata.

---

# 39. Attention Semantics

Attention Items represent required professional intervention.

## 39.1 Creation

Attention may be created by:

* Validator result;
* RPH escalation;
* timeout;
* failed dependency;
* contradiction;
* intent change;
* assumption invalidation;
* pending Decision;
* reconciliation.

## 39.2 Disposition

Attention SHALL remain until:

```text
resolved
delegated
deferred
accepted_risk
not_applicable
duplicate
escalated
superseded
```

## 39.3 Notification Delivery

Notification is a delivery mechanism.

The Attention Item is the durable professional state.

---

# 40. Failure Taxonomy

JEM SHALL classify failures.

## 40.1 Command Failure

The requested semantic transition was rejected.

## 40.2 Validation Failure

Required criteria were not satisfied.

## 40.3 Technical Failure

Infrastructure or software prevented execution.

## 40.4 Dependency Failure

Required internal or external state was unavailable or invalid.

## 40.5 Professional Failure

The objective could not responsibly be achieved.

## 40.6 Authority Failure

Required authority was absent.

## 40.7 Reconciliation Failure

Coherence could not be restored within current scope or authority.

## 40.8 Security or Safety Failure

Continuing would violate a safety, security, ethical, or legal boundary.

---

# 41. Error Contract

Every failed operation SHALL return or persist:

```text
errorCode
errorCategory
professionalMessage
technicalMessage
retryable
currentState
failedCondition
relatedEntityIds
correlationId
recommendedDisposition
```

The professional message SHALL explain the semantic reason.

The technical message MAY contain implementation detail appropriate to the caller.

---

# 42. Escalation Semantics

Escalation is a governed transfer of unresolved professional responsibility.

## 42.1 Escalation Trigger

An escalation SHALL occur when:

* authority is insufficient;
* Evidence is insufficient;
* repeated tactics fail;
* Constraints conflict;
* safety, legality, ethics, or security require review;
* required human judgment is identified;
* resource limits prevent responsible continuation;
* professional uncertainty cannot be responsibly reduced.

## 42.2 Escalation Package

```text
objective
currentState
blockingCondition
workPerformed
tacticsAttempted
evidence
assumptions
constraints
remainingUncertainty
decisionRequired
options
recommendation
riskOfDelay
riskOfProceeding
```

## 42.3 Receiving Authority

The receiving Participant or parent RPH SHALL be explicit.

## 42.4 Escalation Outcome

```text
accepted
redirected
returned_for_more_information
resolved
deferred
rejected
```

---

# 43. Completion Semantics

PWU completion and RPH completion SHALL remain distinct.

## 43.1 PWU Completion

Requires satisfaction of PWU completion conditions.

## 43.2 RPH Completion

Requires that the coordination responsibility has reached a valid disposition.

An RPH may complete because:

* coordinated work completed;
* responsibility transferred;
* escalation accepted;
* work cancelled;
* failure disposition recorded.

## 43.3 Process Completion

Process completion does not imply professional outcome achievement unless explicitly defined.

---

# 44. Cancellation Semantics

Cancellation SHALL be explicit and governed.

## 44.1 Cancellation Types

```text
user_requested
authority_directed
superseded
policy_required
resource_terminated
timeout
professional_abandonment
```

## 44.2 Cancellation Effects

Cancellation SHALL specify:

* whether active external Actions are stopped;
* whether compensation is required;
* whether partial outputs remain valid;
* whether child PWUs are cancelled;
* whether attention remains;
* whether follow-on reconciliation is required.

---

# 45. Semantic Model Versioning at Runtime

Every authoritative object SHALL identify the semantic model version under which it was created or last validated.

## 45.1 Runtime Compatibility

A runtime SHALL not execute a Command against a semantic definition it cannot interpret.

## 45.2 Model Upgrade

A model upgrade MAY require:

* data migration;
* event upcasting;
* projection rebuild;
* Validator re-execution;
* Command compatibility layer;
* runtime dual-version support.

## 45.3 Historical Interpretation

Historical Events SHALL remain interpretable under their original schema version.

---

# 46. Event Upcasting

An Event upcaster transforms an older Event representation into a newer in-memory representation without changing historical meaning.

## 46.1 Upcaster Rule

An upcaster SHALL not invent professional facts absent from the original Event.

## 46.2 Irreducible Change

Where an old Event cannot be faithfully mapped, the runtime SHALL retain version-specific handling or require explicit migration.

---

# 47. Data Migration

Data migration SHALL distinguish:

* structural migration;
* semantic migration;
* reconciliation.

## 47.1 Structural Migration

Changes technical representation without professional meaning.

## 47.2 Semantic Migration

Changes how professional state is represented or classified.

It SHALL be explicit and auditable.

## 47.3 Reconciliation

Required when the new model reveals substantive incoherence or ambiguity.

---

# 48. Security Semantics

## 48.1 Tenant Isolation

Every Command, Event, Aggregate, Process, Projection, and Attention Item SHALL be tenant-scoped.

## 48.2 Organization Boundary

Cross-organization access SHALL require explicit federation or sharing policy.

## 48.3 Least Authority

Services, humans, and AI Agents SHALL receive minimum necessary authority.

## 48.4 Sensitive Evidence

Evidence access restrictions SHALL propagate into projections and Agent context.

## 48.5 Audit

Security-relevant authority changes and access to protected professional state SHALL be auditable.

---

# 49. Provenance Semantics

Every material professional entity SHALL preserve provenance.

## 49.1 Provenance Chain

The runtime SHOULD support tracing:

```text
Entity
← Event
← Command
← Participant or Process
← Projection or Agent Execution
← Evidence and Context
```

## 49.2 AI Provenance

AI provenance SHALL include:

* Agent;
* model;
* policy;
* context sources;
* tool calls;
* validation;
* accepting human or authority where applicable.

---

# 50. Audit Semantics

Audit records SHALL be append-only or equivalently tamper-evident.

Audit SHALL include:

* authority evaluation;
* Command acceptance and rejection;
* state transitions;
* access to protected content;
* model version changes;
* exception grants;
* reconciliation;
* escalation;
* AI execution.

Audit records are not a substitute for domain Events.

---

# 51. Observability Model

JEM requires computational and cognitive observability.

## 51.1 Computational Observability

```text
command_latency
command_failure
transaction_retry
event_publication_lag
projection_lag
process_wait_time
agent_execution_duration
tool_failure
resource_usage
```

## 51.2 Cognitive Observability

```text
uncertainty_reduction
unsupported_claims
critical_assumption_exposure
decision_wait_time
validation_backlog
reconciliation_backlog
dependency_blockage
tactic_change_rate
escalation_rate
synthesis_queue
human_review_latency
```

## 51.3 Trace Boundaries

Material trace spans SHOULD include:

```text
CommandReceived
AuthorityEvaluated
AggregateLoaded
ValidationExecuted
TransactionCommitted
EventsPublished
ProjectionUpdated
AgentInvoked
ProcessSuspended
ProcessResumed
ReconciliationApplied
```

---

# 52. Trace Correlation

All work arising from a professional request SHALL retain:

```text
correlationId
causationId
endeavorId
pwuId
rphId
participantId
agentExecutionId
```

where applicable.

This enables reconstruction across:

* API;
* runtime;
* workflow;
* tool;
* agent;
* Event;
* projection.

---

# 53. Replay Semantics

The runtime MAY replay Events to:

* rebuild projections;
* reconstruct Aggregates;
* test migrations;
* simulate alternative logic;
* recover state.

## 53.1 No External Side Effects During Replay

Replay SHALL not repeat external Actions unless explicitly operating in a controlled simulation.

## 53.2 Determinism

Aggregate reconstruction from the same Event sequence and semantic model version SHALL be deterministic.

---

# 54. Simulation Mode

A runtime MAY support simulation.

Simulation SHALL be visibly and technically separated from authoritative execution.

## 54.1 Simulation Output

Simulation may produce:

* predicted Events;
* candidate projections;
* alternative Decisions;
* risk estimates;
* reconciliation proposals.

## 54.2 Promotion

Simulation output SHALL not become authoritative without normal Commands, validation, and authority.

---

# 55. Offline Execution

An offline runtime profile MAY permit local Commands and projections.

## 55.1 Local Authority

Offline authority SHALL be explicitly defined.

## 55.2 Synchronization

On synchronization, the runtime SHALL:

* compare authoritative versions;
* detect conflicts;
* apply safe idempotent Commands;
* open reconciliation where semantic conflicts exist.

## 55.3 Offline Events

Locally created Events SHALL identify their offline origin and synchronization status.

## 55.4 Conflict

A semantic conflict SHALL not be silently resolved by timestamp.

---

# 56. Runtime Conformance Requirements

A runtime profile is JEM-conformant only if it supports:

1. semantic Commands;
2. explicit authority evaluation;
3. Aggregate consistency boundaries;
4. optimistic concurrency or a stronger documented equivalent;
5. atomic state-and-Event commit;
6. idempotent Command handling;
7. immutable Event history;
8. durable Process Instances;
9. asynchronous human and external waiting;
10. attributable Agent Execution;
11. Validator execution with explicit outcomes;
12. projection consistency disclosure;
13. reconciliation;
14. tactic change;
15. escalation;
16. provenance;
17. computational and cognitive observability;
18. semantic model versioning;
19. safe replay or equivalent reconstruction;
20. professional error contracts.

---

# 57. Reference Command Result

```text
commandId
status
acceptedAt
aggregateId
priorVersion
newVersion
emittedEventIds
resultEntityIds
validationResults
attentionItemIds
processIds
projectionRefreshHints
professionalMessage
```

## 57.1 Command Status

```text
accepted
rejected
duplicate
pending_async_validation
requires_approval
conflicted
```

---

# 58. Reference Process Result

```text
processId
processType
status
currentStep
waitingFor
nextEligibleAction
deadline
outputEntityIds
attentionItemIds
failure
```

---

# 59. JSDL-to-JEM Binding

Generated JSDL artifacts SHALL provide JEM with:

* Command definitions;
* Event definitions;
* lifecycle transitions;
* invariant expressions;
* Validator contracts;
* permission rules;
* Aggregate definitions;
* projection metadata;
* observability metadata;
* semantic version information.

The runtime SHALL not duplicate these definitions manually unless implementing a generated interface.

---

# 60. Runtime Service Boundaries

A runtime profile MAY implement the following logical services:

```text
Command Service
Authority Service
Aggregate Repository
Event Store
Process Coordinator
RPH Service
Agent Execution Service
Validator Service
Projection Service
Reconciliation Service
Attention Service
Artifact Service
Integration Service
Audit Service
Observability Service
```

These are logical responsibilities.

They need not be separately deployed services.

---

# 61. Single-Process and Distributed Equivalence

A single-process runtime and a distributed runtime are semantically equivalent when they preserve:

* transaction boundaries;
* Command order per Aggregate;
* Event immutability;
* Process durability;
* idempotency;
* authority;
* validation;
* projection disclosure;
* reconciliation.

Deployment topology SHALL not change professional meaning.

---

# 62. Failure Recovery

After runtime restart, the system SHALL recover:

* committed Aggregate state;
* committed Events;
* pending Process Instances;
* scheduled timers;
* pending external operations;
* projection checkpoints;
* idempotency records;
* Agent Execution status.

In-memory-only state SHALL not be required for professional correctness.

---

# 63. Exactly-Once Semantics

JEM does not require globally exactly-once message delivery.

It requires effectively-once professional state transitions through:

* Command idempotency;
* Aggregate versioning;
* atomic Event persistence;
* idempotent consumers;
* deduplicated external-operation handling.

---

# 64. Backpressure

A runtime SHALL protect itself from unbounded:

* Command ingestion;
* Agent execution;
* projection lag;
* external callbacks;
* reconciliation storms;
* recursive decomposition;
* Event publication backlog.

Backpressure SHALL be observable and MAY create operational Attention Items.

---

# 65. Recursive Expansion Limits

RPH recursion and PWU decomposition SHALL be governed by policy.

Possible limits include:

```text
maximumDepth
maximumActiveChildren
maximumTotalDescendants
maximumConcurrentAgents
maximumCost
maximumElapsedTime
maximumContextSize
```

Reaching a limit SHALL trigger:

* synthesis;
* tactic change;
* scope revision;
* escalation;
* or explicit failure.

It SHALL not silently truncate professional work.

---

# 66. Cost and Resource Governance

Agent and external execution MAY be constrained by:

```text
tokenBudget
computeBudget
monetaryBudget
timeBudget
toolCallBudget
storageBudget
```

Budget exhaustion SHALL produce a governed state.

It SHALL not cause the runtime to fabricate completion.

---

# 67. Professional Safe Stop

A Process or Agent SHALL support safe stop.

A safe stop SHALL:

* stop initiating new Actions;
* preserve current state;
* record partial work;
* identify unresolved uncertainty;
* release or retain resources according to policy;
* produce a restart or escalation recommendation.

---

# 68. JEM Invariants

## JEM-INV-001 — No Authoritative Mutation Without Command

Material state SHALL not change without a semantic Command or explicitly defined system Command.

## JEM-INV-002 — Authority at Execution Time

Authority SHALL be evaluated when the Command executes.

## JEM-INV-003 — Atomic Commit

Aggregate state, version, Events, Command result, and idempotency record SHALL commit atomically.

## JEM-INV-004 — Immutable Events

Committed Events SHALL not be mutated.

## JEM-INV-005 — No Silent Concurrency Overwrite

Stale material Commands SHALL not silently overwrite current state.

## JEM-INV-006 — Validator Non-Mutation

Validators SHALL not directly mutate authoritative state.

## JEM-INV-007 — Explicit Waiting

Long-running waiting SHALL be durably represented.

## JEM-INV-008 — AI Proposal Default

AI output is proposed state unless explicit authority permits otherwise.

## JEM-INV-009 — Process Durability

Professional correctness SHALL not depend on in-memory Process state.

## JEM-INV-010 — Projection Non-Authority

Projection state SHALL not independently become authoritative.

## JEM-INV-011 — Reconciliation Through Commands

Reconciliation changes SHALL use normal semantic Commands.

## JEM-INV-012 — Technical Success Is Not Professional Completion

Successful execution SHALL not imply PWU or outcome completion.

## JEM-INV-013 — Distinct Retry and Tactic Change

Retry and tactic change SHALL remain distinct.

## JEM-INV-014 — Explicit Escalation

Insufficient authority or capability SHALL trigger escalation rather than invented resolution.

## JEM-INV-015 — Provenance Preservation

Material state SHALL remain traceable to its origin.

## JEM-INV-016 — Model Version Traceability

Authoritative objects and Events SHALL identify their semantic model version.

## JEM-INV-017 — Replay Safety

Replay SHALL not repeat external side effects.

## JEM-INV-018 — Tenant Scope

All authoritative and derived execution state SHALL be tenant-scoped.

## JEM-INV-019 — No Hidden Incoherence

Detected material incoherence SHALL remain visible until disposition.

## JEM-INV-020 — Durable Attention

Required professional intervention SHALL be represented by durable Attention state.

---

# 69. Minimum Conformant Runtime

A minimum JEM-conformant runtime SHALL implement:

```text
Command handling
Authority evaluation
Aggregate repository
Optimistic concurrency
Transactional Event persistence
Idempotency
Synchronous Validators
Durable Process state
Basic RPH coordination
Agent Execution records
Projection updates
Attention Items
Reconciliation cases
Audit and provenance
OpenTelemetry-compatible tracing
```

It MAY initially omit:

* distributed processing;
* offline operation;
* complex model migration;
* predictive projections;
* multi-region replication;
* advanced saga compensation;
* dynamic runtime plugins.

---

# 70. Acceptance Scenarios

## Scenario A — Accepted Command

Given:

* a valid `ApproveDecision` Command;
* current Aggregate version 12;
* expected version 12;
* authorized approver;
* all mandatory Validators pass;

When:

* the Command executes;

Then:

* the Decision state changes;
* Aggregate version becomes 13;
* immutable Events are persisted;
* the Command result is stored;
* the transaction commits atomically;
* post-commit Event publication begins;
* relevant projections update;
* the caller receives the accepted result.

---

## Scenario B — Stale Command

Given:

* current Aggregate version 14;
* a Command expects version 12;

When:

* the Command executes;

Then:

* authority MAY be evaluated;
* no mutation occurs;
* no domain Event is committed;
* a concurrency error is returned;
* material changes since version 12 are identified where feasible;
* the user may refresh or reconcile.

---

## Scenario C — Duplicate Command

Given:

* a previously accepted Command with idempotency key K;

When:

* the same Command is submitted again with K;

Then:

* no new mutation occurs;
* no duplicate Event is committed;
* the prior Command result is returned.

---

## Scenario D — Asynchronous Human Review

Given:

* a proposed Decision requires legal review;

When:

* the approval Process reaches that condition;

Then:

* a durable Process enters waiting state;
* a legal-review Attention Item is created;
* the Decision does not become approved;
* runtime restart does not lose the waiting state;
* legal response resumes the Process through a semantic Command.

---

## Scenario E — Agent Tool Failure

Given:

* an AI Agent is performing research;
* an external search tool fails transiently;

When:

* retry policy permits another attempt;

Then:

* the tool call is retried idempotently;
* the Agent Execution remains running or retrying;
* no professional Claim is fabricated;
* retry history is observable.

---

## Scenario F — Repeated No Progress

Given:

* an Agent has repeated the same tactic;
* uncertainty has not materially reduced;
* validation failures repeat;

When:

* the no-progress policy triggers;

Then:

* the RPH enters tactic evaluation;
* a new tactic is selected or proposed;
* the tactic change is recorded;
* blind retry does not continue indefinitely.

---

## Scenario G — Reconciliation

Given:

* new Evidence invalidates a critical Assumption supporting an approved Decision;

When:

* the Evidence is accepted;

Then:

* affected entities are identified;
* a reconciliation case is created;
* affected Decisions and PWUs are marked for impact assessment;
* normal Commands apply accepted changes;
* prior state remains reconstructable.

---

## Scenario H — External Action Success Without Outcome Success

Given:

* deployment to production succeeds;
* health validation fails;

When:

* the deployment Process reports completion;

Then:

* the Action is marked completed;
* outcome achievement remains unconfirmed;
* validation failure is recorded;
* reconciliation or remediation is initiated;
* the PWU does not automatically complete.

---

## Scenario I — Runtime Restart

Given:

* an RPH awaits external Evidence;
* timers and Attention Items are active;

When:

* the runtime restarts;

Then:

* the RPH state is restored;
* timers remain scheduled;
* Attention Items remain available;
* no work is silently lost or duplicated.

---

# 71. Runtime Conformance Test Suite

Every runtime profile SHALL pass tests covering:

```text
Command authorization
Idempotency
Optimistic concurrency
Atomic Event commit
Event ordering per Aggregate
Projection lag disclosure
Durable waiting
Process recovery
Agent attribution
Validator outcomes
Reconciliation
Escalation
Tactic change
Model version compatibility
Tenant isolation
Replay safety
```

---

# 72. Initial Implementation Sequence

The first runtime implementation SHOULD proceed in this order:

## Phase 1 — Command and Aggregate Core

Implement:

* generated Command contracts;
* Command dispatcher;
* authority interface;
* Aggregate repository;
* optimistic concurrency;
* transaction boundary;
* Event persistence;
* idempotency.

## Phase 2 — Validation and Errors

Implement:

* generated invariant execution;
* Validator interface;
* synchronous Validator pipeline;
* professional error contract;
* Command-result persistence.

## Phase 3 — Projection Pipeline

Implement:

* outbox;
* Event dispatcher;
* projection checkpoints;
* PWU overview projection;
* history projection;
* lag disclosure.

## Phase 4 — Durable Processes

Implement:

* Process Instance persistence;
* waiting and resumption;
* timers;
* retry;
* human Attention Items.

## Phase 5 — Agent Execution

Implement:

* Agent Execution records;
* context projection;
* tool-call records;
* proposal conversion;
* review boundary;
* resource governance.

## Phase 6 — RPH Coordination

Implement:

* RPH lifecycle;
* planning;
* allocation;
* child PWUs;
* no-progress detection;
* tactic change;
* escalation;
* synthesis.

## Phase 7 — Reconciliation

Implement:

* contradiction and trigger detection;
* reconciliation cases;
* impact analysis;
* proposed Commands;
* partial application;
* escalation.

---

# 73. Coding Agent Implementation Contract

A coding agent implementing a JEM runtime SHALL:

1. Treat generated JSDL contracts as authoritative.
2. Implement semantic Commands rather than generic CRUD mutation.
3. Evaluate authority at execution time.
4. preserve Aggregate versioning.
5. Commit state and Events atomically.
6. implement Command idempotency.
7. keep Validators side-effect free.
8. represent long-running waiting durably.
9. distinguish Agent completion from PWU completion.
10. preserve AI identity, model, context, and tool provenance.
11. distinguish technical retry from tactic change.
12. prevent unlimited recursive decomposition.
13. preserve process state across restart.
14. disclose projection consistency.
15. use reconciliation rather than silent conflict resolution.
16. never treat broker delivery as authoritative commit.
17. never permit UI state to mutate authoritative state directly.
18. instrument every material decision boundary.
19. return professional error explanations.
20. preserve tenant and organization isolation.
21. test replay and recovery.
22. record architecture deviations as explicit Decisions.

---

# 74. Resulting Runtime Contract

JEM establishes that Janumi is not simply an application that stores professional records.

It is an execution environment for governed professional cognition.

Within that environment:

* Commands express professional intent;
* Aggregates preserve local consistency;
* Events preserve history;
* Validators evaluate professional sufficiency;
* Processes coordinate work across time;
* RPHs coordinate recursive cognition;
* Agents contribute attributable reasoning;
* Projections make cognition operable;
* reconciliation restores coherence;
* Attention directs human judgment;
* observability reveals both system execution and professional progress.

This execution contract remains constant whether the runtime is implemented as:

* one process and one PostgreSQL database;
* several services on a single node;
* a distributed enterprise platform;
* an offline field application;
* a future federated professional network.

---

# 75. Next Required Artifact

The next artifact is the **Janumi Single-Node Runtime Profile v0.1**.

It shall realize JEM concretely for the initial Janumi deployment and define:

* PostgreSQL authoritative persistence;
* transactional outbox;
* command service;
* event and projection workers;
* durable process execution;
* RPH scheduling;
* AI Agent execution;
* OpenSandbox integration;
* object storage;
* OpenTelemetry;
* tenant isolation;
* backup and recovery;
* Docker or RKE2 deployment;
* scaling boundaries;
* migration path toward a distributed runtime.
