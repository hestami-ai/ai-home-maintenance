# Janumi Professional Workbench Product Realization PWA Migration to the Recursive Professional Harness

## Architecture and Feature Specification

**Document ID:** `RPH-DOC-001`
**Status:** Initial architecture draft
**Target:** Janumi Professional Workbench VS Code Extension
**Primary migration target:** Existing hardcoded legacy Product Lens execution workflow
**Architectural foundation:** Recursive Professional Harness, Professional Work Units, Shape Engineering, Assurance Engineering, Harness Engineering, and Loop Engineering

---

# 1. Executive Summary

The legacy Janumi Professional Workbench Product Lens implementation uses a hardcoded sequence of compatibility phases:

1. INTAKE
2. ARCHITECTURE
3. PROPOSE
4. ASSUMPTION_SURFACING
5. VERIFY
6. HISTORICAL_CHECK
7. REVIEW
8. EXECUTE
9. VALIDATE
10. COMMIT
11. REPLAN

This implementation has successfully demonstrated a governed, multi-agent approach to software development. It also exposes a fundamental architectural limitation: professional work definition, execution sequencing, agent assignment, validation, governance, and state progression are encoded together in one linear legacy phase machine.

The migration described here replaces that hardcoded legacy phase engine with a **Recursive Professional Harness**, or RPH.

The RPH does not treat an Execution Workflow as the authoritative representation of an Undertaking. Instead, it represents the Undertaking as a Professional Work Graph of persistent **Professional Work Objects**, including executable **Professional Work Units**, or PWUs.

Each PWU carries sufficient semantic structure to preserve the user’s intent as work is:

* interpreted;
* decomposed;
* delegated;
* executed;
* validated;
* revised;
* recomposed;
* accepted into an authoritative baseline.

The new architecture separates six concerns:

* **Prompt Engineering** formulates model interactions.
* **Context Engineering** assembles information available to models.
* **Harness Engineering** provides tools, models, sandboxes, permissions, memory, and runtime controls.
* **Loop Engineering** determines how execution progresses, retries, branches, changes tactics, escalates, and stops.
* **Shape Engineering** defines the professional work and what must remain true as it changes form.
* **Assurance Engineering** establishes justified confidence that the evolving work remains faithful to the originating intent.

The initial migration will preserve the effective behavior of the legacy Product Lens. It will not initially introduce unrestricted AI-generated Execution Workflows or fully dynamic planning. Instead, it will:

1. represent the legacy Product Lens as the Product Realization PWA using PWU Types, assurance policies, execution plans, and runtime bindings;
2. execute that representation through a new durable runtime;
3. expose synchronized Work, Execution, and Assurance views;
4. prove semantic and behavioral parity with the legacy orchestrator;
5. create the foundation for later dynamic decomposition, reshaping, alternative plans, and additional PWAs.

---

# 2. Problem Statement

## 2.1 Current architecture

The legacy Product Lens uses a hardcoded phase enum and orchestrator switch statement. Each legacy phase invokes specialized logic and moves the legacy dialogue toward the next compatibility phase.

This design combines several different architectural concerns:

* the professional activity being performed;
* the sequence in which activities occur;
* the role or agent performing each activity;
* the legacy validator implementations attached to each activity;
* human approval gates;
* legacy workflow and dialogue state;
* recovery and replanning behavior.

This coupling creates five limitations.

### Rigidity

Adding, removing, or rearranging professional activities requires code changes to the orchestrator.

### Semantic ambiguity

A legacy phase name can simultaneously represent:

* a work product;
* an action;
* a validator implementation;
* a role invocation;
* a gate;
* a state transition.

For example, `ASSUMPTION_SURFACING` is encoded as a legacy phase but semantically behaves more like a cross-cutting assurance activity.

### Weak recursive semantics

The legacy structure can contain subphases, but it does not formally define:

* inherited intent;
* propagated constraints;
* delegated obligations;
* child-to-parent evidence;
* recomposition criteria;
* decomposition validity.

### Completion conflation

Legacy phase or node completion may be treated as equivalent to professional obligation satisfaction. Execution completion and assurance completion are not the same.

### Limited adaptability

`REPLAN` exists as a legacy phase, but reshaping and replanning are actually control operations that may be needed at any point in the work.

---

# 3. Product Vision

Janumi Professional Workbench will become a **Shape Engineering workbench and execution runtime for governed professional software development**.

The user begins with an intent, which may be incomplete, ambiguous, inconsistent, or only partially feasible.

Janumi Professional Workbench converts that intent into a recursively structured set of Professional Work Units. Each PWU carries:

* why the work exists;
* what it must accomplish;
* what constraints it inherits;
* what assumptions govern it;
* what evidence it must produce;
* how its success will be verified;
* how its result contributes to its parent objective.

The system then:

1. shapes the work;
2. generates or selects an execution strategy;
3. binds agents, models, tools, permissions, and context;
4. executes the work;
5. captures evidence;
6. performs assurance;
7. decides whether to accept, retry, reshape, replan, escalate, or abandon;
8. recomposes assured child results into the parent objective;
9. promotes accepted results into an authoritative baseline.

The central product promise is:

> Janumi Professional Workbench will not merely execute an AI Execution Workflow. It will preserve and assure the user’s intent as professional work is recursively transformed into a verified software outcome.

---

# 4. Scope

## 4.1 Included in the initial migration

The initial release will include:

* canonical Professional Work Object model;
* Professional Work Unit model;
* Product Realization PWA definition, profile, and templates;
* legacy Product Lens phase behavior represented as PWU Types, assurance policies, execution plans, and compatibility milestones;
* explicit execution, assurance, and shape-integrity states;
* typed assumptions, constraints, claims, evidence, decisions, and trace links;
* execution plans separated from PWU definitions;
* runtime bindings for existing Janumi Professional Workbench agents and CLI providers;
* human gates and governance decisions;
* findings from legacy validator implementations represented as typed assurance observations;
* read-only synchronized workbench projections;
* behavioral parity with the legacy Product Lens;
* compatibility with legacy dialogues where feasible;
* traceability from original intent to accepted artifacts.

## 4.2 Deferred from the initial migration

The following are intentionally deferred:

* unrestricted natural-language generation of arbitrary RPH structures;
* fully dynamic replacement of the Product Realization PWA compatibility execution strategy;
* template marketplace;
* public Execution Workflow sharing;
* arbitrary professional-domain ontologies;
* distributed execution;
* automatic confidence aggregation across unrelated assurance methods;
* fully editable execution graphs;
* autonomous changes to runtime privileges;
* broad SaaS multi-tenancy concerns beyond preserving compatible boundaries.

## 4.3 Explicit non-goals

The initial implementation is not intended to become:

* a generic low-code automation platform;
* a visual replacement for all source code;
* a business process notation editor;
* a DAG runner with AI nodes;
* a project management system;
* an unrestricted autonomous coding system.

---

# 5. Core Architectural Principles

## 5.1 Intent is authoritative

All work must remain traceable to the originating user intent or to a later authorized intent revision.

The decomposition exists to serve the intent.

The intent does not exist to stabilize the decomposition.

## 5.2 The Execution Workflow is not the PWA or Professional Work Graph

An Execution Workflow is a temporal execution projection.

It is not the authoritative definition of professional work.

The same PWU may be executed using different plans, agents, models, tools, or sequencing strategies without changing the identity of the work.

## 5.3 Execution completion is not assurance completion

A model or tool may successfully produce an output while the professional obligation remains unsatisfied.

Execution and assurance must use separate states.

## 5.4 Decomposition is a claim

When a parent PWU is decomposed into children, the system is making a claim that the children collectively cover the parent obligation.

That claim must be explicit and, for material work, validated.

## 5.5 Evidence must support claims

Outputs are not automatically evidence.

Evidence must identify:

* the claim it supports;
* its provenance;
* its scope;
* its limitations;
* its validity;
* its disposition.

## 5.6 Assurance is continuous

Assurance is not confined to the legacy final `VALIDATE` phase.

It may operate:

* before decomposition;
* after decomposition;
* before execution;
* during execution;
* after execution;
* during recomposition;
* before baseline promotion.

## 5.7 Reshaping may occur anywhere

Replanning and reshaping are control operations, not terminal legacy workflow phases.

The runtime must permit work to be revised when:

* an assumption is falsified;
* evidence is insufficient;
* decomposition is invalid;
* a constraint changes;
* outputs conflict;
* the objective becomes infeasible;
* an assurance policy requires escalation.

## 5.8 Runtime authority is separate from work definition

A PWU or template may request a capability.

Only the runtime policy system may grant:

* tool access;
* file access;
* network access;
* secret access;
* command execution;
* model access;
* sandbox privileges.

## 5.9 Shape complexity must be proportional

The amount of structure and assurance applied to a PWU should reflect:

* consequence;
* uncertainty;
* irreversibility;
* regulatory exposure;
* security sensitivity;
* organizational policy.

---

# 6. Conceptual Architecture

The system consists of two complementary stacks.

## 6.1 Execution Stack

### Prompt Engineering

Formulates the interaction with intelligence.

It defines:

* instructions;
* roles;
* immediate objectives;
* output expectations;
* formatting;
* examples;
* invocation-level constraints.

### Context Engineering

Assembles the information available to intelligence.

It defines:

* relevant artifacts;
* workspace files;
* conversation history;
* decisions;
* assumptions;
* prior findings;
* retrieved sources;
* context prioritization;
* compression;
* exclusion;
* freshness.

### Harness Engineering

Provides the operational machinery.

It defines:

* agents;
* models;
* tools;
* sandboxes;
* permissions;
* memory infrastructure;
* state persistence;
* observability;
* policies;
* execution boundaries;
* recovery mechanisms;
* runtime controls.

### Loop Engineering

Composes the machinery into behavior through time.

It defines:

* what happens next;
* retry conditions;
* branching;
* parallel execution;
* tactical changes;
* convergence;
* escalation;
* termination;
* reshaping triggers.

## 6.2 Professional Work Stack

### Shape Engineering

Defines what the work is and what must remain coherent.

It governs:

* intent;
* boundaries;
* state;
* structure;
* dependencies;
* constraints;
* assumptions;
* required outputs;
* decomposition;
* recomposition;
* shape integrity.

### Assurance Engineering

Establishes justified confidence that the work remains faithful to intent.

It governs:

* claims;
* evidence;
* observations;
* assurance-policy implementations, including validators;
* criteria;
* confidence;
* human decisions;
* waivers;
* residual uncertainty;
* acceptance;
* baseline promotion.

## 6.3 Recursive Professional Harness

The RPH joins these stacks.

It contains the persistent Professional Work Objects while the execution stack acts on them and the assurance system measures whether the work remains within acceptable semantic and operational bounds.

---

# 7. Canonical Domain Model

## 7.1 Professional Work Object

A Professional Work Object, or PWO, is any persistent professional entity with identity, provenance, lifecycle, and relationships.

Examples include:

* intent;
* PWU;
* requirement;
* constraint;
* assumption;
* claim;
* evidence;
* decision;
* finding;
* artifact;
* baseline;
* policy;
* approval;
* execution plan.

```typescript
interface ProfessionalWorkObject {
  id: string;
  objectType: ProfessionalWorkObjectType;
  title: string;
  description?: string;

  version: number;
  status: string;

  createdAt: string;
  updatedAt: string;

  createdBy: ActorReference;
  provenance: ProvenanceRecord;

  tags?: string[];
  extensions?: ExtensionPayload[];
}
```

## 7.2 Professional Work Unit

A PWU is an executable Professional Work Object.

```typescript
interface ProfessionalWorkUnit extends ProfessionalWorkObject {
  objectType: 'PROFESSIONAL_WORK_UNIT';

  kind: string;
  intentId: string;
  parentWorkUnitId?: string;

  boundaries: WorkBoundaries;

  obligationIds: string[];
  constraintIds: string[];
  assumptionIds: string[];
  dependencyIds: string[];

  inputRequirements: ArtifactRequirement[];
  expectedOutputs: OutputDefinition[];

  evidenceRequirementIds: string[];
  verificationCriterionIds: string[];

  decompositionContractId?: string;
  recompositionContractId?: string;

  executionPolicyId?: string;
  assurancePolicyIds: string[];

  executionState: ExecutionState;
  assuranceState: AssuranceState;
  shapeIntegrityState: ShapeIntegrityState;

  currentExecutionPlanId?: string;
  currentBaselineId?: string;
}
```

## 7.3 Intent

```typescript
interface IntentObject extends ProfessionalWorkObject {
  objectType: 'INTENT';

  originatingExpression: string;
  formalizedObjective: string;

  desiredOutcomes: OutcomeDefinition[];
  successConditions: SuccessCondition[];
  nonGoals: string[];

  ambiguityIds: string[];
  constraintIds: string[];
  stakeholderIds: string[];

  status:
    | 'RAW'
    | 'UNDER_DISCOVERY'
    | 'FORMALIZED'
    | 'APPROVED'
    | 'REVISED'
    | 'SUPERSEDED';
}
```

## 7.4 Constraint

```typescript
interface ConstraintObject extends ProfessionalWorkObject {
  objectType: 'CONSTRAINT';

  constraintType:
    | 'TECHNICAL'
    | 'BUSINESS'
    | 'LEGAL'
    | 'SECURITY'
    | 'POLICY'
    | 'RESOURCE'
    | 'TEMPORAL'
    | 'USER_PREFERENCE';

  statement: string;
  authority: AuthorityReference;
  applicability: ApplicabilityRule;

  strength:
    | 'MANDATORY'
    | 'PREFERRED'
    | 'ADVISORY';

  status:
    | 'PROPOSED'
    | 'ACTIVE'
    | 'WAIVED'
    | 'SUPERSEDED'
    | 'INVALIDATED';
}
```

## 7.5 Assumption

```typescript
interface AssumptionObject extends ProfessionalWorkObject {
  objectType: 'ASSUMPTION';

  statement: string;
  basis?: string;

  introducedBy: ActorReference;
  affectedObjectIds: string[];

  validationRequirement?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  status:
    | 'PROPOSED'
    | 'DISCLOSED'
    | 'ACCEPTED'
    | 'VERIFIED'
    | 'FALSIFIED'
    | 'EXPIRED'
    | 'SUPERSEDED';
}
```

## 7.6 Claim

```typescript
interface ClaimObject extends ProfessionalWorkObject {
  objectType: 'CLAIM';

  statement: string;
  claimType:
    | 'COMPLETENESS'
    | 'CORRECTNESS'
    | 'COMPLIANCE'
    | 'CONSISTENCY'
    | 'FITNESS'
    | 'PRESERVATION'
    | 'FEASIBILITY'
    | 'PERFORMANCE';

  assertedBy: ActorReference;
  subjectObjectIds: string[];

  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];

  status:
    | 'OPEN'
    | 'SUPPORTED'
    | 'CONTESTED'
    | 'REJECTED'
    | 'WAIVED'
    | 'SUPERSEDED';
}
```

## 7.7 Evidence

```typescript
interface EvidenceObject extends ProfessionalWorkObject {
  objectType: 'EVIDENCE';

  evidenceType:
    | 'ARTIFACT'
    | 'TEST_RESULT'
    | 'SOURCE'
    | 'TRACE'
    | 'OBSERVATION'
    | 'ANALYSIS'
    | 'MEASUREMENT'
    | 'APPROVAL'
    | 'REVIEW';

  contentReference: ArtifactReference;
  producedBy: ActorReference;

  supportsClaimIds: string[];
  contradictsClaimIds: string[];

  scope: string;
  limitations: string[];
  capturedAt: string;
  validityWindow?: TimeWindow;

  status:
    | 'PROPOSED'
    | 'ADMISSIBLE'
    | 'REJECTED'
    | 'SUPERSEDED'
    | 'INVALIDATED';
}
```

## 7.8 Assurance Observation

```typescript
interface AssuranceObservation extends ProfessionalWorkObject {
  objectType: 'ASSURANCE_OBSERVATION';

  assurancePolicyId: string;
  subjectObjectIds: string[];

  observationType:
    | 'FINDING'
    | 'MEASUREMENT'
    | 'CONFLICT'
    | 'EVIDENCE_DEFICIT'
    | 'SHAPE_RISK'
    | 'POLICY_VIOLATION'
    | 'RECOMMENDATION';

  severity:
    | 'INFORMATIONAL'
    | 'ADVISORY'
    | 'MATERIAL'
    | 'BLOCKING'
    | 'CRITICAL';

  statement: string;
  evidenceIds: string[];

  disposition:
    | 'OPEN'
    | 'ACCEPTED'
    | 'REMEDIATED'
    | 'WAIVED'
    | 'REJECTED'
    | 'SUPERSEDED';
}
```

## 7.9 Decision

```typescript
interface DecisionObject extends ProfessionalWorkObject {
  objectType: 'DECISION';

  decisionType:
    | 'APPROVAL'
    | 'REJECTION'
    | 'WAIVER'
    | 'ESCALATION'
    | 'RESHAPE'
    | 'REPLAN'
    | 'PROMOTE_BASELINE'
    | 'ABANDON';

  subjectObjectIds: string[];
  selectedOption: string;
  rationale: string;

  authority: ActorReference;
  consideredEvidenceIds: string[];
  consideredObservationIds: string[];

  status:
    | 'PROPOSED'
    | 'EFFECTIVE'
    | 'REVOKED'
    | 'SUPERSEDED';
}
```

## 7.10 Trace Link

```typescript
interface TraceLink {
  id: string;
  sourceObjectId: string;
  targetObjectId: string;

  relation:
    | 'DERIVED_FROM'
    | 'REFINES'
    | 'DECOMPOSES'
    | 'SATISFIES'
    | 'DEPENDS_ON'
    | 'CONSTRAINED_BY'
    | 'ASSUMES'
    | 'PRODUCES'
    | 'SUPPORTS'
    | 'CONTRADICTS'
    | 'VERIFIES'
    | 'INVALIDATES'
    | 'SUPERSEDES'
    | 'PROMOTES';

  createdAt: string;
  createdBy: ActorReference;
}
```

---

# 8. Decomposition and Recomposition

## 8.1 Decomposition Contract

Every material decomposition must define how parent obligations are allocated.

```typescript
interface DecompositionContract extends ProfessionalWorkObject {
  objectType: 'DECOMPOSITION_CONTRACT';

  parentWorkUnitId: string;
  childWorkUnitIds: string[];

  rationale: string;

  inheritedIntentMappings: IntentMapping[];
  obligationAllocations: ObligationAllocation[];
  constraintPropagations: ConstraintPropagation[];

  retainedParentObligationIds: string[];
  coverageClaims: CoverageClaim[];

  siblingCoordinationRules: CoordinationRule[];
  recompositionStrategyId: string;

  validationStatus:
    | 'UNVALIDATED'
    | 'VALID'
    | 'CONDITIONALLY_VALID'
    | 'INVALID';
}
```

## 8.2 Required decomposition invariants

For every parent PWU:

* every mandatory parent constraint must be propagated, retained, or explicitly waived;
* every parent obligation must be delegated, retained, or explicitly removed through an authorized decision;
* child PWUs must have non-overlapping identities even when responsibilities overlap;
* sibling dependencies must be explicit;
* the recomposition strategy must explain how child results support the parent completion claim;
* decomposition approval must be distinct from execution approval for material work.

## 8.3 Recomposition Contract

```typescript
interface RecompositionContract extends ProfessionalWorkObject {
  objectType: 'RECOMPOSITION_CONTRACT';

  parentWorkUnitId: string;
  requiredChildWorkUnitIds: string[];

  aggregationRules: AggregationRule[];
  conflictResolutionRules: ConflictResolutionRule[];

  requiredEvidenceIds?: string[];
  parentCompletionClaimId: string;

  result:
    | 'PENDING'
    | 'COMPOSABLE'
    | 'CONFLICTED'
    | 'INSUFFICIENT'
    | 'SATISFIED';
}
```

Recomposition is not merely concatenation. It must determine whether assured child results collectively satisfy the parent intent.

---

# 9. Legacy Product Lens Semantic Migration

## 9.1 Migration principle

Legacy phases will not be mechanically converted into generic Execution Workflow nodes.

Each legacy phase will be reclassified as one or more of:

* PWU;
* execution strategy;
* assurance policy;
* governance decision;
* baseline transition;
* control operation.

## 9.2 Legacy phase mapping

### INTAKE

**Current role:** Conversational planning and intent clarification.

**New representation:**

* Root Intent object
* Intent Discovery PWU
* Product Scope PWU
* Stakeholder and Actor Discovery PWU
* User Journey Discovery PWU
* Domain Entity Discovery PWU
* Integration Discovery PWU
* Intent Approval Decision

The existing INTAKE substates become either:

* PWU lifecycle states;
* child PWUs;
* human decision gates;
* interaction modes.

`DISCUSSING` is not a professional completion state. It is an interaction mode.

`SYNTHESIZING` is an execution state for producing an intent baseline.

`AWAITING_APPROVAL` is a governance state.

`INTENT_DISCOVERY`, `PRODUCT_REVIEW`, and proposer activities are candidate PWUs or PWU groups.

`CLARIFYING` is a control operation that can occur whenever required information is missing.

### ARCHITECTURE

**Current role:** Architecture decomposition and design.

**New representation:**

* Architecture Definition PWU Type, instantiated as an Architecture Definition PWU Instance
* System Boundary PWU Type, instantiated as a System Boundary PWU Instance
* Component Model PWU Type, instantiated as a Component Model PWU Instance
* Data Architecture PWU Type, instantiated as a Data Architecture PWU Instance
* Integration Architecture PWU Type, instantiated as an Integration Architecture PWU Instance
* Security Architecture PWU Type, instantiated as a Security Architecture PWU Instance
* Deployment Architecture PWU Type, instantiated as a Deployment Architecture PWU Instance
* Architecture Decision objects
* Architecture Artifact objects

Architecture may initially preserve the current effective sequence but should be modeled as a decomposable PWU Type hierarchy that becomes a concrete PWU Instance hierarchy in an Undertaking.

### PROPOSE

**Current role:** Executor proposes work and surfaces assumptions.

**New representation:**

* Implementation Proposal PWU
* Candidate Execution Plan
* Proposed Artifact Changes
* Proposed Decisions
* Proposed Assumptions
* Feasibility Claims
* Scope and Impact Claims

Proposal is a work-producing activity.

It must not automatically make its assumptions authoritative.

### ASSUMPTION_SURFACING

**Current role:** Convert executor assumptions into claims.

**New representation:**

* Assumption Disclosure Assurance Policy
* Assumption Extraction execution activity
* Assumption objects
* Verification obligations for material assumptions
* Shape-integrity findings where assumptions alter intent or scope

This is no longer a mandatory global legacy phase in the canonical model. It is a cross-cutting assurance policy attached to material PWUs and execution outputs.

### VERIFY

**Current role:** Verify open claims.

**New representation:**

* Claim Verification Assurance Policies
* Verification PWUs where substantive research or analysis is required
* Evidence objects
* Assurance observations
* Claim dispositions

Verification may run repeatedly and at different levels.

### HISTORICAL_CHECK

**Current role:** Compare work against historical patterns.

**New representation:**

* Historical Consistency Assurance Policy
* Narrative Memory retrieval
* Historical precedent evidence
* Deviation findings
* Rationale requirement for intentional divergence

This policy may attach to:

* intent;
* requirements;
* architecture;
* proposed decisions;
* execution plans;
* final validation.

### REVIEW

**Current role:** Human review and decision.

**New representation:**

* Human Governance Decision
* Approval or rejection
* Waiver
* Reshape decision
* Replan decision
* Escalation
* Baseline promotion authorization

Review is not represented as an ordinary legacy execution phase in the canonical model. It is a governance event triggered by policy.

### EXECUTE

**Current role:** Perform coding tasks through the MAKER agent system.

**New representation:**

* Actionable implementation PWUs
* Execution Plans
* Runtime Bindings
* Agent invocations
* Tool executions
* Code artifacts
* Tests and traces
* Execution telemetry

The MAKER system becomes one execution strategy available to appropriate PWUs.

### VALIDATE

**Current role:** Deep validation with hypothesizer agents.

**New representation:**

A set of assurance policies, potentially including:

* intent-preservation validation;
* requirements coverage;
* architecture conformance;
* test adequacy;
* regression analysis;
* security validation;
* historical consistency;
* code quality;
* integration correctness;
* fitness for purpose;
* unsupported-claim detection.

Validation becomes continuous and policy-driven rather than one terminal legacy phase.

### COMMIT

**Current role:** Legacy final source commit and deployment transition.

**New representation:**

* Repository Commit Artifact
* Repository state transition
* Baseline Promotion Decision, evaluated separately
* Configuration Baseline object, created only after authorized promotion
* Release or deployment approval where applicable

A repository commit is a technical configuration-management operation. Baseline promotion is a separate governance operation and must not be inferred from commit success.

### REPLAN

**Current role:** Replanning based on feedback.

**New representation:**

* Control action available from multiple states
* Replacement Execution Plan
* Revised Decomposition Contract
* New or superseded PWUs
* Invalidation of affected descendants
* Decision record and rationale

REPLAN is removed as a terminal phase from the canonical model and retained only as a legacy compatibility label.

---

# 10. Product Realization PWA Initial PWU Type Hierarchy

The initial Product Realization PWA should define approximately the following PWU Type hierarchy:

```text
Product Realization PWU Type
├── Intent and Product Definition PWU Type
│   ├── Intent Discovery PWU Type
│   ├── Product Boundary PWU Type
│   ├── Stakeholder Definition PWU Type
│   ├── Business Domain Discovery PWU Type
│   ├── User Journey Definition PWU Type
│   ├── Domain Entity Definition PWU Type
│   └── Integration Discovery PWU Type
│
├── Architecture Definition PWU Type
│   ├── System Context PWU Type
│   ├── Component Architecture PWU Type
│   ├── Data Architecture PWU Type
│   ├── Integration Architecture PWU Type
│   ├── Security Architecture PWU Type
│   └── Deployment Architecture PWU Type
│
├── Implementation Planning PWU Type
│   ├── Proposal Generation PWU Type
│   ├── Work Decomposition PWU Type
│   ├── Dependency Analysis PWU Type
│   ├── Risk Analysis PWU Type
│   └── Execution Plan Definition PWU Type
│
├── Implementation PWU Type
│   ├── Dynamically generated feature PWU Types
│   ├── Test PWU Types
│   ├── Documentation PWU Types
│   └── Migration PWU Types
│
├── Integrated Validation PWU Type
│   ├── Requirements Coverage PWU Type
│   ├── Architecture Conformance PWU Type
│   ├── Integration Validation PWU Type
│   ├── Regression Validation PWU Type
│   └── Fitness-for-Purpose PWU Type
│
└── Baseline Promotion PWU Type
    ├── Evidence Package Assembly PWU Type
    ├── Human Acceptance Decision
    └── Configuration Baseline Promotion
```

Not every PWU Type must be instantiated as a PWU Instance for every Undertaking. The Product Realization PWA definition, selected profile, and shaping policies determine which instances are required.

---

# 11. State Machines

## 11.1 PWU lifecycle

```text
PROPOSED
    ↓
SHAPING
    ↓
READY
    ↓
PLANNED
    ↓
EXECUTING
    ↓
EVIDENCE_PENDING
    ↓
UNDER_ASSURANCE
    ↓
SATISFIED
    ↓
RECOMPOSED
    ↓
BASELINED
```

Alternate transitions:

```text
SHAPING → BLOCKED
READY → CHALLENGED
EXECUTING → BLOCKED
EXECUTING → FAILED
EVIDENCE_PENDING → RESHAPING
UNDER_ASSURANCE → REJECTED
UNDER_ASSURANCE → CONDITIONALLY_SATISFIED
SATISFIED → INVALIDATED
ANY ACTIVE STATE → ESCALATED
ANY NON-BASELINED STATE → ABANDONED
ANY STATE → SUPERSEDED
```

## 11.2 Execution state

```text
NOT_PLANNED
PLANNED
QUEUED
RUNNING
WAITING
RETRYING
SUCCEEDED
FAILED
CANCELLED
SUPERSEDED
```

## 11.3 Assurance state

```text
NOT_REQUIRED
UNASSESSED
EVIDENCE_REQUIRED
READY_FOR_ASSESSMENT
ASSESSING
SATISFIED
CONDITIONALLY_SATISFIED
REJECTED
WAIVED
INVALIDATED
ESCALATED
```

## 11.4 Shape-integrity state

```text
UNKNOWN
PRESERVED
AT_RISK
VIOLATED
RESHAPING_REQUIRED
RESHAPING_IN_PROGRESS
RESTORED
```

## 11.5 Assumption lifecycle

```text
PROPOSED
DISCLOSED
UNDER_VERIFICATION
ACCEPTED
VERIFIED
FALSIFIED
EXPIRED
SUPERSEDED
```

A falsified material assumption must trigger impact analysis.

## 11.6 Baseline lifecycle

```text
DRAFT
CANDIDATE
UNDER_REVIEW
APPROVED
AUTHORITATIVE
SUPERSEDED
REVOKED
```

---

# 12. Assurance Architecture

## 12.1 Assurance Policy

```typescript
interface AssurancePolicy extends ProfessionalWorkObject {
  objectType: 'ASSURANCE_POLICY';

  targetTypes: ProfessionalWorkObjectType[];
  applicabilityRule: ApplicabilityRule;

  evaluatedClaimTypes: ClaimType[];
  requiredEvidence: EvidenceRequirement[];
  criteria: VerificationCriterion[];

  validatorRole: string;
  independenceRequirement:
    | 'NONE'
    | 'DIFFERENT_INVOCATION'
    | 'DIFFERENT_AGENT'
    | 'DIFFERENT_MODEL'
    | 'HUMAN';

  failureSeverity:
    | 'ADVISORY'
    | 'MATERIAL'
    | 'BLOCKING'
    | 'CRITICAL';

  remediationPolicy: RemediationPolicy;
  escalationPolicy: EscalationPolicy;
  waiverPolicy?: WaiverPolicy;
}
```

## 12.2 Initial Product Realization PWA assurance policies

The migration should define at least:

* Intent Completeness Policy
* Intent Preservation Policy
* Boundary Integrity Policy
* Assumption Disclosure Policy
* Assumption Verification Policy
* Requirement Coverage Policy
* Decomposition Coverage Policy
* Constraint Propagation Policy
* Architecture Consistency Policy
* Historical Consistency Policy
* Evidence Sufficiency Policy
* Test Adequacy Policy
* Integration Correctness Policy
* Security Review Policy
* Fitness-for-Purpose Policy
* Recomposition Integrity Policy
* Baseline Promotion Policy

## 12.3 Assurance outputs

Assurance Policy implementations, including validators, must not return only pass or fail.

They should emit:

* observations;
* measurements where meaningful;
* evidence references;
* severity;
* confidence or uncertainty where defensible;
* recommended control action;
* affected objects;
* residual concerns.

## 12.4 Permitted control actions

Assurance findings may trigger:

* continue;
* continue with condition;
* request more evidence;
* retry execution;
* use a different model or tool;
* invoke another Assurance Policy implementation;
* revise context;
* revise prompt;
* reshape PWU;
* revise decomposition;
* replace execution plan;
* escalate to human;
* waive;
* reject;
* abandon.

---

# 13. Execution Architecture

## 13.1 Execution Plan

A PWU does not directly encode its runtime sequence.

```typescript
interface ExecutionPlan extends ProfessionalWorkObject {
  objectType: 'EXECUTION_PLAN';

  workUnitId: string;
  planVersion: number;

  steps: ExecutionStep[];
  transitions: ExecutionTransition[];

  retryPolicy: RetryPolicy;
  tacticalChangePolicy: TacticalChangePolicy;
  escalationPolicy: EscalationPolicy;
  terminationPolicy: TerminationPolicy;

  status:
    | 'PROPOSED'
    | 'APPROVED'
    | 'ACTIVE'
    | 'SUPERSEDED'
    | 'COMPLETED'
    | 'FAILED';
}
```

## 13.2 Execution Step

```typescript
interface ExecutionStep {
  id: string;
  stepType:
    | 'MODEL_INVOCATION'
    | 'TOOL_INVOCATION'
    | 'RETRIEVAL'
    | 'TRANSFORMATION'
    | 'HUMAN_INTERACTION'
    | 'WAIT'
    | 'BRANCH'
    | 'PARALLEL_GROUP'
    | 'ASSURANCE_INVOCATION';

  purpose: string;
  inputBindings: InputBinding[];
  outputBindings: OutputBinding[];

  runtimeBindingId: string;
  assurancePolicyIds?: string[];
}
```

## 13.3 Runtime Binding

```typescript
interface RuntimeBinding extends ProfessionalWorkObject {
  objectType: 'RUNTIME_BINDING';

  executionStepId: string;

  roleId: string;
  modelSelectionPolicy: ModelSelectionPolicy;
  toolCapabilities: CapabilityRequest[];
  sandboxPolicy: SandboxPolicy;
  contextAssemblyPolicyId: string;
  observabilityPolicyId: string;
  memoryPolicyId?: string;

  authorizationStatus:
    | 'REQUESTED'
    | 'AUTHORIZED'
    | 'DENIED'
    | 'REVOKED';
}
```

## 13.4 Runtime services

The initial runtime should include:

* Work Object Repository
* PWU Lifecycle Service
* Shape Service
* Decomposition Service
* Execution Planning Service
* Execution Controller
* Harness Binding Service
* Context Assembly Service
* Prompt Rendering Service
* Agent Invocation Service
* Tool and Sandbox Service
* Evidence Service
* Assurance Service
* Traceability Service
* Impact Analysis Service
* Baseline Service
* Human Governance Service
* Event and Observability Service
* Compatibility Adapter for the current orchestrator

---

# 14. Controller Behavior

The controller evaluates the current PWU state, execution state, assurance state, shape-integrity state, and open observations.

A simplified decision sequence is:

```text
Is the PWU sufficiently shaped?
    No → continue shaping or escalate
    Yes
      ↓
Is decomposition required?
    Yes → create and validate decomposition
    No
      ↓
Is there an approved execution plan?
    No → generate or select plan
    Yes
      ↓
Are runtime bindings authorized?
    No → request authorization or select alternative
    Yes
      ↓
Execute next eligible step
      ↓
Capture artifacts, evidence, and observations
      ↓
Evaluate assurance policies
      ↓
Select control action:
    continue
    retry
    gather evidence
    revise context
    change tactics
    reshape
    replan
    escalate
    reject
    accept
      ↓
If child PWU is satisfied:
    recompose into parent
      ↓
If root PWU is satisfied:
    assemble evidence package
    request baseline promotion
```

The first implementation may preserve the legacy phase order through a static compatibility Execution Plan for the Product Realization PWA. The runtime model must nevertheless support later dynamic control actions.

---

# 15. Visual Workbench

The workbench will provide multiple synchronized projections over the same underlying objects.

## 15.1 Work View

Shows:

* intent;
* PWU hierarchy;
* parent-child relationships;
* obligations;
* constraints;
* assumptions;
* dependencies;
* shape-integrity status;
* decomposition coverage.

Primary question:

> What professional work exists, and what must remain true?

## 15.2 Execution View

Shows:

* active execution plans;
* steps;
* branches;
* loops;
* retries;
* runtime roles;
* tools;
* models;
* current execution state;
* blocked work.

Primary question:

> What is happening next, and why?

## 15.3 Assurance View

Shows:

* assurance policies;
* Assurance Policy implementations;
* claims;
* evidence requirements;
* findings;
* open observations;
* dispositions;
* human decisions;
* assurance state.

Primary question:

> Why should the user trust the result?

## 15.4 Traceability View

Shows:

* original intent;
* formalized objectives;
* constraints;
* PWUs;
* decisions;
* artifacts;
* evidence;
* verification;
* baseline.

Primary question:

> Where did this result come from, and what supports it?

## 15.5 Runtime View

Shows:

* models;
* agents;
* tools;
* permissions;
* sandboxes;
* context policies;
* memory;
* token and cost usage;
* failures;
* traces.

Primary question:

> What operational machinery is acting on the work?

## 15.6 Change-Impact View

Shows:

* changed intent or constraint;
* affected PWUs;
* affected execution plans;
* invalidated evidence;
* required revalidation;
* affected baselines.

Primary question:

> What must be reconsidered if this changes?

## 15.7 Initial UI scope

The first release should provide read-only or minimally interactive versions of:

* Work View;
* Execution View;
* Assurance View.

Editing should initially occur through controlled forms and existing Janumi Professional Workbench interactions, not unrestricted graph manipulation.

---

# 16. Persistence Model

The initial schema should avoid one generic Execution Workflow JSON document as the primary source of truth.

Recommended logical tables include:

* `professional_work_objects`
* `intents`
* `professional_work_units`
* `constraints`
* `assumptions`
* `claims`
* `evidence`
* `assurance_policies`
* `assurance_observations`
* `decisions`
* `artifacts`
* `trace_links`
* `decomposition_contracts`
* `recomposition_contracts`
* `execution_plans`
* `execution_steps`
* `runtime_bindings`
* `executions`
* `execution_events`
* `baselines`
* `pwu_state_history`
* `object_versions`

A relational core should be used for universal semantics.

Domain-specific extension data should use schema-versioned JSON payloads.

EAV should not be used as the canonical extension mechanism.

---

# 17. Versioning

The system must distinguish at least five version categories.

## Shape version

Changes to:

* intent;
* PWU structure;
* boundaries;
* obligations;
* constraints;
* assumptions;
* decomposition;
* recomposition.

## Execution-plan version

Changes to:

* steps;
* sequencing;
* branching;
* retry behavior;
* tactical changes.

## Assurance-policy version

Changes to:

* claims evaluated;
* evidence required;
* Assurance Policy implementations;
* criteria;
* severity;
* independence;
* waiver and escalation.

## Runtime-binding version

Changes to:

* agents;
* models;
* tools;
* permissions;
* context policies;
* sandbox policies.

## Presentation version

Changes only to:

* canvas position;
* grouping;
* visual layout;
* filters;
* display preferences.

Presentation changes must not alter semantic versions.

---

# 18. Migration Strategy

## Stage 1: Inventory current behavior

Document:

* each legacy phase;
* legacy phase inputs and outputs;
* role invocations;
* legacy validator implementation invocations;
* state transitions;
* human gates;
* failure handling;
* legacy dialogue interactions;
* database writes;
* generated artifacts.

## Stage 2: Build the Product Realization PWA compatibility profile

Create the Product Realization PWA, its PWU Types, and its compatibility profile sufficient to represent legacy behavior.

## Stage 3: Encode the legacy Product Lens as the Product Realization PWA

Represent the legacy fixed sequence as:

* root PWU hierarchy;
* assurance policies;
* static execution plans;
* runtime bindings;
* governance decisions;
* baseline promotion.

## Stage 4: Introduce the new runtime behind a feature flag

Run selected legacy dialogues using the new runtime while preserving the existing UI where possible.

## Stage 5: Compare behavior

Compare:

* artifacts;
* legacy phase-equivalent compatibility milestones;
* assumptions;
* claims;
* legacy validator findings mapped to Assurance Policy results;
* human decisions;
* final repository state;
* execution time;
* failure behavior;
* traceability completeness.

## Stage 6: Add read-only workbench views

Expose Work, Execution, and Assurance projections.

## Stage 7: Migrate authoritative state

Once parity is demonstrated, make the RPH object model authoritative and retain the legacy orchestrator as a compatibility adapter.

## Stage 8: Enable controlled dynamic behavior

Introduce:

* assurance-triggered retries;
* context revision;
* tactical model changes;
* local reshaping;
* dynamic child PWU creation;
* invalidation propagation.

## Stage 9: Remove hardcoded legacy phase authority

The legacy phase enum may remain as a compatibility or display concept, but it no longer controls the architecture.

---

# 19. Implementation Stages

## Stage 0: Domain model and invariants

Deliver:

* canonical schemas;
* lifecycle definitions;
* invariants;
* transition rules;
* object identity rules;
* traceability rules;
* property-based tests.

## Stage 1: Current-system instrumentation

Deliver:

* complete event traces from the hardcoded legacy Product Lens;
* legacy phase input/output contracts;
* legacy validator implementation inventory;
* human-gate inventory;
* state-transition map.

## Stage 2: Product Realization PWA RPH encoding

Deliver:

* root Product Realization PWU Type;
* child PWU Types and applicable templates;
* legacy phase mapping;
* static execution plans;
* runtime bindings;
* assurance policies.

## Stage 3: Runtime foundation

Deliver:

* PWO repository;
* PWU lifecycle service;
* execution controller;
* assurance service;
* evidence service;
* traceability service;
* event bus integration.

## Stage 4: Compatibility execution

Deliver:

* feature-flagged RPH execution;
* current-agent integration;
* current CLI provider integration;
* human approval compatibility;
* legacy-dialogue adapter.

## Stage 5: Workbench projections

Deliver:

* Work View;
* Execution View;
* Assurance View;
* object inspector;
* linked selection across views;
* execution status updates.

## Stage 6: Behavioral parity and migration

Deliver:

* parity test suite;
* migration tool;
* fallback mechanism;
* state conversion;
* documentation.

## Stage 7: Controlled reshaping

Deliver:

* local PWU revision;
* decomposition revision;
* assumption falsification handling;
* impact analysis;
* invalidation propagation;
* assurance-triggered replanning.

## Stage 8: AI-assisted shaping

Deliver:

* intent formalization proposals;
* PWU decomposition proposals;
* assurance-plan proposals;
* execution-plan proposals;
* semantic diffs;
* human approval controls.

---

# 20. Core Invariants

The implementation must enforce the following.

1. Every root PWU must trace to an approved or explicitly provisional intent.

2. Every non-root PWU must have a parent or an explicit independent authority.

3. Every mandatory parent obligation must be delegated, retained, satisfied, waived, or superseded.

4. Every mandatory parent constraint must be propagated, retained, waived, or declared inapplicable with rationale.

5. A PWU cannot enter `SATISFIED` solely because execution succeeded.

6. A completion claim must reference admissible evidence.

7. Every assurance result must identify:

   * the claim or subject assessed;
   * the evidence considered;
   * the criteria applied;
   * the disposition;
   * the Assurance Policy implementation identity.

8. A material assumption cannot remain implicit after an assurance policy detects it.

9. A falsified material assumption must trigger impact analysis.

10. A change to intent, constraints, or architecture must identify potentially affected descendants.

11. Invalidated evidence cannot support an active completion claim.

12. Baseline promotion requires an authorized decision.

13. Runtime capabilities cannot be granted by a PWU or template alone.

14. Human overrides must record authority, rationale, scope, and affected objects.

15. Recomposition must establish that child results collectively support the parent claim.

16. Graph layout changes cannot alter work semantics.

17. Every semantic object revision must retain provenance and version history.

18. Open blocking observations prevent baseline promotion unless an authorized waiver exists.

---

# 21. Acceptance Criteria

## Domain model

* The legacy Product Lens can be represented as the Product Realization PWA without using the hardcoded phase enum as the authoritative work model.
* Every legacy phase behavior maps to at least one PWU, Assurance Policy, governance decision, Execution Plan, compatibility milestone, or control action.
* PWU execution and assurance states are stored independently.
* Assumptions, claims, evidence, findings, and decisions are first-class objects.

## Intent preservation

* Every implementation PWU traces to one or more approved objectives.
* Constraint propagation can be inspected for every decomposition.
* The system detects when a mandatory parent obligation is not allocated.
* An intent or constraint change produces a list of potentially affected objects.

## Assurance

* Assurance Policy implementation output, including output from legacy validators, produces typed assurance observations.
* Completion claims identify supporting evidence.
* Assurance policies may block, conditionally accept, waive, or escalate.
* Independent validation requirements can be configured by policy.
* Human review decisions are persisted with rationale and evidence references.

## Runtime

* Legacy Product Lens agent roles and CLI providers can be invoked through runtime bindings.
* The effective legacy Product Lens sequence can execute as a compatibility Execution Workflow through the new controller.
* Retry, failure, cancellation, and human-wait states survive extension restarts.
* Runtime permissions are checked independently from work definitions.

## Workbench

* The same PWU can be selected across Work, Execution, and Assurance views.
* A user can inspect:

  * inherited intent;
  * constraints;
  * assumptions;
  * execution history;
  * evidence;
  * findings from Assurance Policy implementations;
  * traceability;
  * current states.
* A completed execution with incomplete assurance is visually distinct from an assured PWU.
* Canvas position changes do not create semantic revisions.

## Migration

* Legacy dialogues can either continue through the compatibility layer or be migrated with explicit status reporting.
* The new runtime produces equivalent or improved artifacts for representative legacy Product Lens scenarios.
* The migration has a reversible fallback until parity criteria are met.
* The hardcoded orchestrator can be disabled after successful migration without loss of core legacy Product Lens behavior.

---

# 22. Success Metrics

## Shape integrity

* percentage of parent obligations explicitly allocated;
* mandatory constraint propagation rate;
* untracked-assumption rate;
* decomposition revision rate;
* shape-integrity violation rate;
* mean time to detect intent drift.

## Assurance quality

* percentage of completion claims with admissible evidence;
* first-pass evidence sufficiency;
* escaped-defect rate after assurance;
* false-pass and false-fail rates;
* open blocking findings at attempted baseline promotion;
* waiver frequency and subsequent defect rate.

## Execution quality

* successful recovery rate;
* repeated-loop rate without measurable progress;
* tactical-change success rate;
* escalation appropriateness;
* durable recovery after extension or process restart;
* invalidation propagation latency.

## Human outcomes

* time required to understand why a decision was made;
* time required to identify change impact;
* number of hidden assumptions detected before execution;
* human review effort;
* percentage of AI-proposed changes accepted after semantic review;
* trust calibration between displayed assurance and actual outcome quality.

## Migration quality

* behavioral parity rate;
* legacy-dialogue migration success;
* artifact equivalence;
* reduction in hardcoded legacy phase-specific logic;
* percentage of legacy Product Lens behavior expressed through the Product Realization PWA, reusable policies, and PWUs.

---

# 23. Key Risks

## Over-modeling

The architecture could become too complex for ordinary coding tasks.

**Mitigation:** use risk-proportional shaping and assurance profiles.

## False confidence

Explicit structure may appear authoritative even when it encodes an incorrect interpretation.

**Mitigation:** distinguish proposal, approval, evidence, and assurance states; retain uncertainty and competing interpretations.

## Graph overload

Multiple object and relationship types may create unusable canvases.

**Mitigation:** synchronized projections, semantic zoom, filtering, clustering, and object-focused inspection.

## Migration mismatch

Legacy phase behavior may rely on undocumented side effects.

**Mitigation:** instrument the existing orchestrator before replacement and build scenario-level parity tests.

## Assurance recursion

Assurance may become unbounded.

**Mitigation:** bounded assurance profiles, risk-based stopping rules, escalation, and explicit residual uncertainty.

## Runtime privilege risk

AI-generated plans may request unsafe capabilities.

**Mitigation:** capability-based authorization, policy enforcement, sandboxing, and human approval for privilege expansion.

## Semantic drift in generated structures

AI-generated PWUs may create attractive but incorrect decompositions.

**Mitigation:** decomposition contracts, coverage claims, independent validation, and human approval for high-impact shapes.

---

# 24. Architectural Decision Summary

The migration adopts the following decisions:

1. The Execution Workflow graph is not the canonical model.
2. Professional Work Objects are the canonical model.
3. Professional Work Units are executable work objects.
4. Execution plans are separate from PWUs.
5. Runtime bindings are separate from execution plans.
6. Assurance policies are separate from execution nodes.
7. Assurance Policy implementations, including legacy validators, emit typed observations and evidence, not only pass/fail.
8. Execution state and assurance state are distinct.
9. Decomposition and recomposition are explicit, validated operations.
10. REPLAN becomes a general control action.
11. COMMIT is decomposed into a repository operation plus separate baseline governance; a commit never implies baseline promotion.
12. REVIEW becomes governance.
13. ASSUMPTION_SURFACING and HISTORICAL_CHECK become cross-cutting assurance capabilities.
14. The workbench presents synchronized projections of one underlying RPH.
15. The first migration target is behavioral parity, not maximum autonomy.
16. Dynamic AI-generated structures are introduced only after the runtime can validate and govern them.

---

# 25. Definition of Done for the Initial Migration

The migration is complete when:

* the legacy Product Lens can execute as a Product Realization PWA compatibility profile through the RPH runtime;
* the hardcoded legacy phase sequence is no longer the authoritative model of the work;
* all material legacy Product Lens work is represented as PWU Instances under the Product Realization PWA;
* assurance mechanisms are represented as policies and observations;
* user intent traces to accepted artifacts and baseline decisions;
* execution, assurance, and shape-integrity states are independently visible;
* current agents, legacy validator implementations, human gates, and repository operations remain functional;
* representative scenarios meet behavioral parity criteria;
* the Work, Execution, and Assurance views accurately project the underlying state;
* the system can retry, escalate, reshape, and replan without requiring a dedicated terminal legacy phase;
* the original orchestrator can be disabled behind a reversible migration control.

---

# 26. Closing Product Statement

The purpose of this migration is not merely to make the legacy Product Lens configurable.

It is to change the fundamental unit of Janumi Professional Workbench from the legacy execution-workflow phase to the Professional Work Unit.

The hardcoded legacy Product Lens represents an important first implementation of governed AI-assisted software development. Its limitations arise not because the underlying concept is wrong, but because several concerns were necessarily collapsed into a single sequential orchestrator.

The Recursive Professional Harness separates those concerns while preserving their coordinated operation.

Shape Engineering defines the work and protects its semantic integrity.

Harness Engineering provides the capabilities and operational controls required for execution.

Loop Engineering determines how execution progresses through time.

Assurance Engineering continuously evaluates whether the evolving work remains faithful to the originating intent.

The Product Realization PWA becomes the first reusable Professional Work Architecture instantiated on this architecture, with its assurance policies and compatibility execution strategy defined separately.

The resulting Janumi Professional Workbench system will not merely execute a configurable Execution Workflow. It will provide a governed environment in which user intent is recursively transformed into professional work, acted upon by generative agents, continuously challenged through assurance, and promoted into an authoritative software outcome only when the available evidence justifies doing so.
