# Janumi Professional Workbench Recursive Professional Harness

## Canonical Domain Model, Invariant Catalog, State Machines, and Event Contract

**Document ID:** `RPH-DOC-002`
**Status:** Architecture baseline draft
**Applies to:** RPH runtime semantics, initially exercised through the Product Realization PWA intent-to-architecture vertical slice
**Purpose:** Define the minimum authoritative model and behavioral rules required to implement the Recursive Professional Harness runtime

## Canonical vocabulary context

The RPH is the underlying control and runtime architecture. The Janumi Professional Workbench (JPWB) is the principal user-facing environment that exposes it.

This runtime specification operates inside the ownership hierarchy established by the canonical vocabulary charter:

```text
Professional Work Architecture
    defines reusable PWU Types

Undertaking
    is instantiated under a selected PWA version
    and owns concrete PWU Instances

Professional Work Graph
    is the instantiated semantic graph of those PWU Instances

Execution Plan and Execution Workflow
    govern how selected PWU Instances are performed over time
```

Unless a type-level definition is explicitly discussed, an unqualified `PWU` in this runtime document means a concrete PWU Instance. It never means the PWA itself, the Undertaking, its Professional Work Graph, or an Execution Workflow.

---

# 1. Purpose

This specification converts the Recursive Professional Harness architecture into an implementation contract.

It defines:

* canonical domain objects;
* object identity and versioning rules;
* lifecycle state machines;
* legal and illegal transitions;
* cross-object invariants;
* decomposition and recomposition semantics;
* assurance semantics;
* evidence and claim relationships;
* event types;
* command boundaries;
* persistence requirements;
* concurrency expectations;
* failure and invalidation behavior.

This specification is intentionally narrower than the broader RPH architecture.

It does not define:

* final user interface layouts;
* model prompts;
* complete Product Realization PWA ontology content;
* every validator;
* marketplace behavior;
* arbitrary external integrations;
* multi-tenant SaaS deployment.

Its purpose is to ensure that implementation agents cannot accidentally reduce the RPH to:

* an Execution Workflow graph;
* a node executor;
* a collection of prompts;
* a pass/fail validation pipeline;
* a generic task hierarchy.

The canonical model must preserve the distinction among:

* professional work;
* execution strategy;
* runtime capability;
* assurance;
* evidence;
* governance;
* presentation.

---

# 2. Canonical Model Principles

## 2.1 Professional Work Objects are authoritative

The authoritative state of the Undertaking is represented by Professional Work Objects and their relationships.

Canvas nodes, Execution Workflow diagrams, chat messages, and legacy phase labels are projections or interaction surfaces.

They are not the canonical source of truth.

## 2.2 Professional Work Units represent executable obligations

A PWU is not merely a task.

It represents a bounded professional obligation with:

* intent;
* authority;
* boundaries;
* inherited constraints;
* expected outputs;
* evidence requirements;
* verification criteria;
* lifecycle state;
* traceability.

## 2.3 Execution Plans are replaceable strategies

An Execution Plan describes how a PWU is currently intended to be performed.

Changing the plan does not necessarily change the identity or meaning of the PWU.

A PWU may have:

* no execution plan;
* one active execution plan;
* several superseded plans;
* alternative candidate plans.

## 2.4 Runtime Bindings grant no semantic authority

Runtime Bindings connect execution steps to:

* agents;
* models;
* tools;
* sandboxes;
* permissions;
* context policies;
* observability policies.

They cannot redefine the intent or obligations of the work.

## 2.5 Assurance evaluates claims

Assurance does not merely inspect node output.

It evaluates explicit or implicit claims using:

* criteria;
* evidence;
* observations;
* authority;
* policy.

## 2.6 State must be explicit

No semantic state may be inferred solely from:

* null values;
* empty arrays;
* missing rows;
* absent output;
* legacy phase order;
* UI position;
* agent prose.

Illegal or incomplete states must be represented explicitly.

## 2.7 History is append-oriented

Material semantic changes must preserve:

* prior values;
* change actor;
* change rationale;
* timestamp;
* causal relationship;
* affected objects.

Current state may be materialized for performance, but authoritative history must remain reconstructable.

---

# 3. Aggregate Boundaries

JPWB provides two enclosing ownership boundaries before the RPH runtime aggregates:

* a published PWA version owns reusable PWU Types and definition-time rules;
* an Undertaking is bound to one selected PWA version and owns the concrete Professional Work Graph.

The PWA definition and Undertaking identity must remain explicit even when their management contracts are implemented by adjacent JPWB services. They are not replaced by the Work Aggregate or an Execution Workflow.

Within an Undertaking, the initial RPH runtime implementation should use five principal aggregates.

## 3.1 Work Aggregate

Owns:

* Intent;
* Professional Work Unit Instance;
* Constraint;
* Assumption;
* Obligation;
* Decomposition Contract;
* Recomposition Contract;
* work-level state transitions.

Aggregate root:

> Professional Work Unit Instance

## 3.2 Assurance Aggregate

Owns:

* Claim;
* Evidence;
* Assurance Policy;
* Assurance Assessment;
* Assurance Observation;
* waiver;
* assurance disposition.

Aggregate root:

> Assurance Assessment

## 3.3 Execution Aggregate

Owns:

* Execution Plan;
* Execution Step;
* Execution Attempt;
* Execution Event;
* runtime result;
* retry and tactical-change state.

Aggregate root:

> Execution Plan

## 3.4 Governance Aggregate

Owns:

* Decision;
* Approval;
* Waiver authorization;
* Escalation;
* Baseline Promotion;
* revocation.

Aggregate root:

> Decision

## 3.5 Baseline Aggregate

Owns:

* Baseline;
* Baseline Item;
* promoted artifacts;
* assurance package;
* configuration state;
* supersession.

Aggregate root:

> Baseline

## 3.6 Design-time PWA authoring is not an Undertaking aggregate

The five aggregates above own the runtime of an *Undertaking* (RPH-DOC-000: PWA → Undertaking → Professional Work Graph). Defining a PWA — authoring PWU Types, composition, and assurance-policy assignments — is design-time work that yields a PWA version, not an Undertaking runtime object. It is therefore outside all five aggregates. Two consequences, both of which the Execution Aggregate already implies:

* Authoring creates **no Execution Plan, Execution Step, or Execution Attempt.** The Execution Aggregate (§3.3) is rooted at an Execution Plan and governs the runtime execution of PWU Instances; a design-time authoring model call is not the execution of a PWU Instance and has no Plan for an Attempt to be rooted in. Authoring is still governed — it is carried by its own Commands and Events (`DefinePwuType` → `PwuTypeDefined`) and its authored objects (the `PWU_TYPE`s and the `PROFESSIONAL_WORK_ARCHITECTURE`), with the `AUTHORING_CONVERSATION` as the event-sourced record of the authoring interaction — but never as an Attempt.
* An **authored artifact therefore has no producing Execution Attempt.** The artifact provenance field that names one (`producingExecutionAttemptId`, RPH-DOC-009 §18.1 — a nullable reference to `execution_attempts(id)`) is legitimately absent on the authoring plane: an authored artifact's provenance is its own creation context, and only a runtime-produced artifact binds a producing Attempt. Absence there is the model, not an omission.

This records, as an ontology decision under the standing authoring grant (2026-07-18), the boundary the Execution Aggregate already implies: RPH-DOC-002 roots every Attempt in an Execution Plan, and the authoring plane has none. The code already conforms — the authoring path constructs no Execution Plan or Attempt. Full reasoning: `docs/_working/DECISION-item23-attempt-record.md`; HARMONIZATION-LOG PART 5.

Cross-aggregate updates must occur through commands and events rather than direct mutation of another aggregate’s internal state.

---

# 4. Common Object Envelope

All Professional Work Objects use a common envelope.

```typescript
type ProfessionalWorkObjectType =
  | 'PROFESSIONAL_WORK_ARCHITECTURE'
  | 'PWU_TYPE'
  | 'UNDERTAKING'
  | 'INTENT'
  | 'PROFESSIONAL_WORK_UNIT'
  | 'OBLIGATION'
  | 'CONSTRAINT'
  | 'ASSUMPTION'
  | 'CLAIM'
  | 'EVIDENCE'
  | 'ASSURANCE_POLICY'
  | 'ASSURANCE_ASSESSMENT'
  | 'ASSURANCE_OBSERVATION'
  | 'DECISION'
  | 'ARTIFACT'
  | 'DECOMPOSITION_CONTRACT'
  | 'RECOMPOSITION_CONTRACT'
  | 'EXECUTION_PLAN'
  | 'RUNTIME_BINDING'
  | 'BASELINE';

interface ObjectEnvelope {
  id: string;
  objectType: ProfessionalWorkObjectType;

  semanticVersion: number;
  revision: number;

  lifecycleStatus: string;

  createdAt: string;
  createdBy: ActorReference;

  updatedAt: string;
  updatedBy: ActorReference;

  provenance: ProvenanceRecord;

  authorityId?: string;
  ontologyId?: string;
  ontologyVersion?: string;

  tags: string[];
  extensions: ExtensionPayload[];
}
```

The serialized discriminator `PROFESSIONAL_WORK_UNIT` denotes a concrete PWU Instance. Reusable definitions use `PWU_TYPE`; the two must never be inferred from `pwuKind` alone.

## 4.1 Semantic version versus revision

`revision` increments for any persisted change.

`semanticVersion` increments only when the meaning, obligations, assurance requirements, or authority of the object changes.

Examples:

| Change                                       | Revision |                      Semantic version |
| -------------------------------------------- | -------: | ------------------------------------: |
| Move node on canvas                          |      Yes |                                    No |
| Correct typographical error                  |      Yes |                            Usually no |
| Add mandatory constraint                     |      Yes |                                   Yes |
| Replace model binding                        |      Yes | No, unless outcome obligations change |
| Change evidence requirement                  |      Yes |                                   Yes |
| Change title wording without semantic effect |      Yes |                                    No |
| Waive an obligation                          |      Yes |                                   Yes |
| Change execution retry count                 |      Yes |                            Usually no |

## 4.2 Identifier rules

Identifiers must be:

* globally unique within a Janumi installation;
* immutable;
* opaque;
* independent of titles and hierarchy;
* preserved across presentation changes.

Recommended format:

```text
pwa_01J...
pwut_01J...
und_01J...
pwu_01J...
int_01J...
clm_01J...
evd_01J...
```

ULID or UUIDv7 is preferred for locality and temporal ordering.

---

# 5. Actor and Authority Model

```typescript
type ActorType =
  | 'HUMAN'
  | 'AGENT'
  | 'MODEL'
  | 'SERVICE'
  | 'POLICY_ENGINE'
  | 'EXTERNAL_SYSTEM';

interface ActorReference {
  actorId: string;
  actorType: ActorType;
  displayName: string;
  executionInstanceId?: string;
  modelId?: string;
  roleId?: string;
}
```

Authority is distinct from actor identity.

```typescript
interface AuthorityReference {
  authorityId: string;
  authorityType:
    | 'USER'
    | 'ORGANIZATIONAL_ROLE'
    | 'POLICY'
    | 'LEGAL_REQUIREMENT'
    | 'SYSTEM_OWNER'
    | 'DELEGATED_AGENT';

  grantedBy?: string;
  scope: string[];
  validFrom: string;
  validUntil?: string;
}
```

An agent may create a proposal without having authority to approve it.

---

# 6. Intent Model

## 6.1 Intent Object

```typescript
interface IntentObject extends ObjectEnvelope {
  objectType: 'INTENT';

  undertakingId: string;

  originatingExpression: string;
  formalizedObjective: string;

  desiredOutcomes: DesiredOutcome[];
  successConditions: SuccessCondition[];
  nonGoals: string[];

  ambiguityIds: string[];
  constraintIds: string[];
  stakeholderIds: string[];

  parentIntentId?: string;
  supersedesIntentId?: string;

  intentStatus:
    | 'RAW'
    | 'UNDER_DISCOVERY'
    | 'PROVISIONAL'
    | 'FORMALIZED'
    | 'APPROVED'
    | 'REVISED'
    | 'SUPERSEDED'
    | 'WITHDRAWN';
}
```

## 6.2 Intent transition matrix

| Current                         | Command                   | Next            | Required conditions                            |
| ------------------------------- | ------------------------- | --------------- | ---------------------------------------------- |
| RAW                             | Begin discovery           | UNDER_DISCOVERY | Originating expression exists                  |
| UNDER_DISCOVERY                 | Create provisional intent | PROVISIONAL     | Objective and known ambiguities recorded       |
| PROVISIONAL                     | Formalize                 | FORMALIZED      | Outcomes, non-goals, and constraints defined   |
| FORMALIZED                      | Approve                   | APPROVED        | Authorized decision exists                     |
| APPROVED                        | Revise                    | REVISED         | Change rationale and impact analysis initiated |
| REVISED                         | Approve revision          | APPROVED        | Revised intent receives authorization          |
| Any active                      | Supersede                 | SUPERSEDED      | Replacement intent identified                  |
| RAW/UNDER_DISCOVERY/PROVISIONAL | Withdraw                  | WITHDRAWN       | Authorized actor                               |

## 6.3 Intent invariants

* An `APPROVED` intent must have at least one desired outcome.
* An `APPROVED` intent must have at least one success condition or an explicit statement that success is exploratory.
* A root PWU cannot enter `READY` unless its intent is at least `PROVISIONAL`.
* A root PWU cannot become `SATISFIED` unless its intent is `APPROVED` or the result is explicitly marked provisional.
* Revising an approved intent requires change-impact analysis.
* An intent cannot be deleted after downstream PWUs exist.
* A superseded intent cannot authorize new PWUs.

---

# 7. Professional Work Unit Instance Model

## 7.1 PWU Instance definition

```typescript
interface ProfessionalWorkUnit extends ObjectEnvelope {
  objectType: 'PROFESSIONAL_WORK_UNIT';

  undertakingId: string;
  pwuTypeId?: string;
  isLocalExtension: boolean;

  pwuKind: string;
  title: string;
  description: string;

  intentId: string;
  parentWorkUnitId?: string;

  boundary: WorkBoundary;

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

  activeExecutionPlanId?: string;
  assurancePolicyIds: string[];

  executionState: ExecutionState;
  assuranceState: AssuranceState;
  shapeIntegrityState: ShapeIntegrityState;
  workLifecycleState: WorkLifecycleState;

  riskProfile: WorkRiskProfile;

  currentBaselineId?: string;
}
```

Every runtime `ProfessionalWorkUnit` record is a PWU Instance owned by exactly one Undertaking.

* A non-local PWU Instance must reference a PWU Type from the immutable PWA version selected by its Undertaking.
* An Undertaking-local PWU Instance must set `isLocalExtension = true`, must not claim a published `pwuTypeId`, and does not mutate the selected PWA.
* `pwuKind` is a descriptive or compatibility discriminator; it does not replace the canonical PWU Type identity.

## 7.2 Work lifecycle states

```typescript
type WorkLifecycleState =
  | 'PROPOSED'
  | 'SHAPING'
  | 'READY'
  | 'PLANNED'
  | 'EXECUTING'
  | 'EVIDENCE_PENDING'
  | 'UNDER_ASSURANCE'
  | 'CONDITIONALLY_SATISFIED'
  | 'SATISFIED'
  | 'RECOMPOSING'
  | 'RECOMPOSED'
  | 'BASELINED'
  | 'BLOCKED'
  | 'CHALLENGED'
  | 'RESHAPING'
  | 'ESCALATED'
  | 'INVALIDATED'
  | 'REJECTED'
  | 'ABANDONED'
  | 'SUPERSEDED';
```

## 7.3 Execution states

```typescript
type ExecutionState =
  | 'NOT_PLANNED'
  | 'PLANNED'
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING'
  | 'RETRYING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'SUPERSEDED';
```

## 7.4 Assurance states

```typescript
type AssuranceState =
  | 'NOT_REQUIRED'
  | 'UNASSESSED'
  | 'EVIDENCE_REQUIRED'
  | 'READY_FOR_ASSESSMENT'
  | 'ASSESSING'
  | 'CONDITIONALLY_SATISFIED'
  | 'SATISFIED'
  | 'REJECTED'
  | 'WAIVED'
  | 'INVALIDATED'
  | 'ESCALATED';
```

## 7.5 Shape-integrity states

```typescript
type ShapeIntegrityState =
  | 'UNKNOWN'
  | 'PRESERVED'
  | 'AT_RISK'
  | 'VIOLATED'
  | 'RESHAPING_REQUIRED'
  | 'RESHAPING_IN_PROGRESS'
  | 'RESTORED';
```

---

# 8. PWU Lifecycle Transition Matrix

## 8.1 Primary transitions

| Current              | Command                  | Next                    | Required conditions                                           |
| -------------------- | ------------------------ | ----------------------- | ------------------------------------------------------------- |
| PROPOSED             | Begin shaping            | SHAPING                 | Intent exists                                                 |
| SHAPING              | Mark ready               | READY                   | Shape readiness policy satisfied                              |
| READY                | Approve plan             | PLANNED                 | Active execution plan approved                                |
| PLANNED              | Start execution          | EXECUTING               | Runtime bindings authorized                                   |
| EXECUTING            | Record execution success | EVIDENCE_PENDING        | Execution state is SUCCEEDED                                  |
| EVIDENCE_PENDING     | Begin assurance          | UNDER_ASSURANCE         | Required evidence is available or deficit explicitly recorded |
| UNDER_ASSURANCE      | Conditionally satisfy    | CONDITIONALLY_SATISFIED | Conditional disposition exists                                |
| UNDER_ASSURANCE      | Satisfy                  | SATISFIED               | Assurance state is SATISFIED                                  |
| SATISFIED            | Begin recomposition      | RECOMPOSING             | Parent exists and recomposition is required                   |
| RECOMPOSING          | Complete recomposition   | RECOMPOSED              | Recomposition contract satisfied                              |
| SATISFIED/RECOMPOSED | Promote baseline         | BASELINED               | Authorized promotion decision                                 |

## 8.2 Exception transitions

| Current                 | Trigger                        | Next                  |
| ----------------------- | ------------------------------ | --------------------- |
| SHAPING                 | Missing information            | BLOCKED               |
| READY                   | Shape challenge                | CHALLENGED            |
| PLANNED/EXECUTING       | Runtime dependency unavailable | BLOCKED               |
| EXECUTING               | Material assumption falsified  | RESHAPING             |
| EVIDENCE_PENDING        | Evidence impossible to obtain  | ESCALATED             |
| UNDER_ASSURANCE         | Blocking finding               | REJECTED or RESHAPING |
| CONDITIONALLY_SATISFIED | Condition violated             | INVALIDATED           |
| SATISFIED               | Upstream change                | INVALIDATED           |
| RECOMPOSED              | Sibling conflict discovered    | INVALIDATED           |
| Any active              | Authorized abandonment         | ABANDONED             |
| Any non-baselined       | Replacement PWU created        | SUPERSEDED            |

## 8.3 Illegal transitions

The following must be rejected:

* `PROPOSED → EXECUTING`
* `SHAPING → SATISFIED`
* `READY → BASELINED`
* `EXECUTING → SATISFIED` without assurance
* `FAILED → SATISFIED`
* `INVALIDATED → BASELINED`
* `SUPERSEDED → EXECUTING`
* `ABANDONED → READY`
* `BASELINED → EXECUTING` without creating a new revision or successor PWU

---

# 9. PWU Shape Readiness

A PWU may enter `READY` only if its Shape Readiness Profile is satisfied.

## 9.1 Minimum shape readiness fields

Every PWU requires:

* explicit intent reference;
* title and professional purpose;
* in-scope statement;
* out-of-scope statement or explicit “not yet known” status;
* expected output;
* at least one completion claim or verification criterion;
* known mandatory constraints;
* current assumptions;
* identified authority;
* declared risk profile.

## 9.2 Risk-proportional readiness

```typescript
interface WorkRiskProfile {
  consequence: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  uncertainty: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  irreversibility: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  securitySensitivity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  regulatoryExposure: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
}
```

Higher-risk PWUs may additionally require:

* approved decomposition;
* independent assurance;
* rollback strategy;
* explicit residual-risk acceptance;
* human approval;
* stronger evidence;
* sandbox restrictions.

---

# 10. Obligations

## 10.1 Obligation Object

```typescript
interface ObligationObject extends ObjectEnvelope {
  objectType: 'OBLIGATION';

  statement: string;

  obligationType:
    | 'FUNCTIONAL'
    | 'QUALITY'
    | 'COMPLIANCE'
    | 'SAFETY'
    | 'SECURITY'
    | 'PROCESS'
    | 'EVIDENCE'
    | 'GOVERNANCE';

  sourceObjectId: string;
  authority: AuthorityReference;

  strength:
    | 'MANDATORY'
    | 'CONDITIONAL'
    | 'ADVISORY';

  status:
    | 'PROPOSED'
    | 'ACTIVE'
    | 'ALLOCATED'
    | 'SATISFIED'
    | 'WAIVED'
    | 'VIOLATED'
    | 'SUPERSEDED';
}
```

## 10.2 Obligation invariants

* Every mandatory obligation must have an authoritative source.
* A child PWU may satisfy a parent obligation only through an explicit allocation.
* An obligation cannot become `SATISFIED` solely because a related PWU is completed.
* Satisfaction requires a supported claim.
* A waived mandatory obligation requires an authorized waiver.
* A violated obligation must affect assurance disposition.
* An active obligation cannot disappear during decomposition.

---

# 11. Constraints

## 11.1 Constraint Object

```typescript
interface ConstraintObject extends ObjectEnvelope {
  objectType: 'CONSTRAINT';

  statement: string;

  constraintType:
    | 'TECHNICAL'
    | 'BUSINESS'
    | 'LEGAL'
    | 'SECURITY'
    | 'POLICY'
    | 'RESOURCE'
    | 'TEMPORAL'
    | 'USER_PREFERENCE'
    | 'ARCHITECTURAL';

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
    | 'INAPPLICABLE'
    | 'VIOLATED'
    | 'SUPERSEDED'
    | 'INVALIDATED';
}
```

## 11.2 Constraint propagation rule

For every mandatory parent constraint, one of the following must be true for each relevant child:

* propagated;
* retained at parent level;
* marked inapplicable with rationale;
* waived through authority;
* superseded by a stronger constraint.

No silent omission is permitted.

---

# 12. Assumptions

## 12.1 Assumption Object

```typescript
interface AssumptionObject extends ObjectEnvelope {
  objectType: 'ASSUMPTION';

  statement: string;
  basis?: string;

  introducedBy: ActorReference;
  affectedObjectIds: string[];

  materiality:
    | 'IMMATERIAL'
    | 'MATERIAL'
    | 'CRITICAL';

  verificationMethod?: string;
  expirationCondition?: string;

  status:
    | 'PROPOSED'
    | 'DISCLOSED'
    | 'UNDER_VERIFICATION'
    | 'ACCEPTED'
    | 'VERIFIED'
    | 'FALSIFIED'
    | 'EXPIRED'
    | 'SUPERSEDED';
}
```

## 12.2 Assumption invariants

* A material assumption detected during execution must become a first-class object.
* No material assumption may remain embedded only in model prose.
* A critical assumption must be verified or explicitly accepted by authority before dependent irreversible work proceeds.
* Falsification triggers impact analysis.
* Expired assumptions cannot continue authorizing work.
* Accepted is not equivalent to verified.

---

# 13. Decomposition Contract

## 13.1 Contract model

```typescript
interface DecompositionContract extends ObjectEnvelope {
  objectType: 'DECOMPOSITION_CONTRACT';

  parentWorkUnitId: string;
  childWorkUnitIds: string[];

  rationale: string;

  intentMappings: IntentMapping[];
  obligationAllocations: ObligationAllocation[];
  constraintPropagations: ConstraintPropagation[];
  assumptionPropagations: AssumptionPropagation[];

  retainedParentObligationIds: string[];

  coverageClaims: CoverageClaim[];
  siblingDependencyIds: string[];

  recompositionContractId: string;

  status:
    | 'DRAFT'
    | 'UNDER_REVIEW'
    | 'VALID'
    | 'CONDITIONALLY_VALID'
    | 'INVALID'
    | 'SUPERSEDED';
}
```

## 13.2 Decomposition invariants

* Every child must trace to the parent.
* Every child must state which parent intent or obligation it serves.
* Every mandatory obligation must be allocated or retained.
* Every relevant mandatory constraint must be propagated.
* Material assumptions must be propagated when applicable.
* Sibling dependencies must be explicit.
* The parent cannot become `PLANNED` through child execution unless the decomposition contract is valid or conditionally valid.
* Decomposition validation must be independent for high-risk work.
* Child PWUs may introduce new obligations, but those must be traceable to evidence, policy, or discovered need.
* A decomposition may be revised without changing parent identity, but it increments semantic version.

## 13.3 Coverage Claim

```typescript
interface CoverageClaim {
  claimId: string;
  parentObligationIds: string[];
  childWorkUnitIds: string[];
  coverageType:
    | 'COMPLETE'
    | 'PARTIAL'
    | 'CONDITIONAL'
    | 'EXPLORATORY';

  rationale: string;
}
```

---

# 14. Recomposition Contract

```typescript
interface RecompositionContract extends ObjectEnvelope {
  objectType: 'RECOMPOSITION_CONTRACT';

  parentWorkUnitId: string;
  requiredChildWorkUnitIds: string[];

  aggregationRules: AggregationRule[];
  conflictResolutionRules: ConflictResolutionRule[];

  parentCompletionClaimId: string;

  status:
    | 'DRAFT'
    | 'READY'
    | 'EVALUATING'
    | 'COMPOSABLE'
    | 'CONFLICTED'
    | 'INSUFFICIENT'
    | 'SATISFIED'
    | 'SUPERSEDED';
}
```

## 14.1 Recomposition invariants

* All required child PWUs must be satisfied, conditionally satisfied, waived, or superseded through an authorized decision.
* Child outputs must be checked for contradiction.
* Child evidence must support the parent claim, not merely child claims.
* Parent constraints must be evaluated against the recomposed result.
* Recomposition may fail even when all child PWUs are individually satisfied.
* A recomposed result requires an explicit assessment.

---

# 15. Claims

## 15.1 Claim Object

```typescript
interface ClaimObject extends ObjectEnvelope {
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
    | 'PERFORMANCE'
    | 'SECURITY'
    | 'COVERAGE';

  assertedBy: ActorReference;
  subjectObjectIds: string[];

  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];

  status:
    | 'OPEN'
    | 'UNDER_ASSESSMENT'
    | 'SUPPORTED'
    | 'CONDITIONALLY_SUPPORTED'
    | 'CONTESTED'
    | 'REJECTED'
    | 'WAIVED'
    | 'SUPERSEDED';
}
```

## 15.2 Claim invariants

* Every completion assertion must be represented as a claim.
* A claim must have a subject.
* A supported claim must reference admissible evidence.
* A contested claim cannot authorize baseline promotion unless resolved or waived.
* Confidence values must not replace evidence.
* A claim may be supported by multiple evidence items and assurance assessments.
* Contradicting evidence must remain visible.

---

# 16. Evidence

## 16.1 Evidence Object

```typescript
interface EvidenceObject extends ObjectEnvelope {
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
  validFrom?: string;
  validUntil?: string;

  status:
    | 'PROPOSED'
    | 'ADMISSIBLE'
    | 'REJECTED'
    | 'SUPERSEDED'
    | 'INVALIDATED';
}
```

## 16.2 Evidence invariants

* Evidence must have provenance.
* Evidence must state scope and limitations.
* Evidence cannot support a claim outside its declared scope without an explicit assessment.
* Invalidated evidence cannot support an active claim.
* Generated prose is not automatically evidence.
* A validator opinion is an observation; its underlying basis may be evidence.
* Evidence expiration must trigger reassessment of dependent claims.
* Evidence immutability is preferred; corrections create a new version.

---

# 17. Assurance Policies

## 17.1 Assurance Policy Object

```typescript
interface AssurancePolicy extends ObjectEnvelope {
  objectType: 'ASSURANCE_POLICY';

  targetTypes: ProfessionalWorkObjectType[];
  applicabilityRule: ApplicabilityRule;

  evaluatedClaimTypes: ClaimType[];
  requiredEvidenceRequirements: EvidenceRequirement[];
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

  status:
    | 'DRAFT'
    | 'ACTIVE'
    | 'SUSPENDED'
    | 'SUPERSEDED';
}
```

---

# 18. Assurance Assessment

An assessment is a specific application of an Assurance Policy.

```typescript
interface AssuranceAssessment extends ObjectEnvelope {
  objectType: 'ASSURANCE_ASSESSMENT';

  assurancePolicyId: string;
  policySemanticVersion: number;

  subjectObjectIds: string[];
  claimIds: string[];

  evaluator: ActorReference;

  evidenceConsideredIds: string[];
  observationIds: string[];

  startedAt: string;
  completedAt?: string;

  disposition:
    | 'PENDING'
    | 'ASSESSING'
    | 'SATISFIED'
    | 'CONDITIONALLY_SATISFIED'
    | 'REJECTED'
    | 'INCONCLUSIVE'
    | 'WAIVED'
    | 'ESCALATED';

  confidence?: ConfidenceAssessment;
  residualUncertainty: string[];

  recommendedControlAction?:
    | 'CONTINUE'
    | 'GATHER_EVIDENCE'
    | 'RETRY'
    | 'CHANGE_TACTIC'
    | 'REVISE_CONTEXT'
    | 'RESHAPE'
    | 'REPLAN'
    | 'ESCALATE'
    | 'REJECT'
    | 'ACCEPT';
}
```

## 18.1 Assurance invariants

* Every assessment must identify the policy version used.
* Every disposition must identify evidence considered.
* A satisfied disposition must identify criteria met.
* An inconclusive disposition cannot be treated as satisfied.
* Confidence must include basis and limitations.
* Independence requirements must be checked before evaluation begins.
* A policy cannot waive its own blocking finding unless waiver authority is separately defined.
* Assurance observations must remain visible after remediation.

---

# 19. Assurance Observations

```typescript
interface AssuranceObservation extends ObjectEnvelope {
  objectType: 'ASSURANCE_OBSERVATION';

  assessmentId: string;
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

---

# 20. Execution Plans

## 20.1 Execution Plan Object

```typescript
interface ExecutionPlan extends ObjectEnvelope {
  objectType: 'EXECUTION_PLAN';

  workUnitId: string;
  planVersion: number;

  stepIds: string[];
  transitionIds: string[];

  retryPolicy: RetryPolicy;
  tacticalChangePolicy: TacticalChangePolicy;
  escalationPolicy: EscalationPolicy;
  terminationPolicy: TerminationPolicy;

  status:
    | 'PROPOSED'
    | 'UNDER_REVIEW'
    | 'APPROVED'
    | 'ACTIVE'
    | 'COMPLETED'
    | 'FAILED'
    | 'SUPERSEDED'
    | 'CANCELLED';
}
```

## 20.2 Execution Plan invariants

* An active plan must reference exactly one PWU.
* A PWU may have only one active plan at a time.
* A plan may not change PWU intent or obligations.
* Plan approval is required before irreversible execution for high-risk work.
* Runtime privileges are not granted by plan approval.
* A superseded plan cannot create new execution attempts.
* Plan revision preserves prior attempt history.
* Tactical changes may occur within a plan only if authorized by policy.

---

# 21. Execution Steps

```typescript
interface ExecutionStep {
  id: string;
  executionPlanId: string;

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

  runtimeBindingId?: string;

  preconditions: Condition[];
  postconditions: Condition[];

  stepState:
    | 'NOT_READY'
    | 'READY'
    | 'QUEUED'
    | 'RUNNING'
    | 'WAITING'
    | 'SUCCEEDED'
    | 'FAILED'
    | 'SKIPPED'
    | 'CANCELLED'
    | 'SUPERSEDED';
}
```

## 21.1 Step invariants

* A step cannot run until preconditions are satisfied.
* A succeeded step must record outputs or an explicit no-output result.
* Step success does not imply PWU success.
* A skipped mandatory step requires an authorized plan revision or waiver.
* Every tool or model invocation must produce provenance.
* External outputs are untrusted until parsed and validated.

---

# 22. Runtime Bindings

```typescript
interface RuntimeBinding extends ObjectEnvelope {
  objectType: 'RUNTIME_BINDING';

  executionStepId: string;

  roleId: string;
  modelSelectionPolicy: ModelSelectionPolicy;

  requestedCapabilities: CapabilityRequest[];
  grantedCapabilities: CapabilityGrant[];

  sandboxPolicy: SandboxPolicy;
  contextAssemblyPolicyId: string;
  observabilityPolicyId: string;
  memoryPolicyId?: string;

  authorizationStatus:
    | 'REQUESTED'
    | 'AUTHORIZED'
    | 'PARTIALLY_AUTHORIZED'
    | 'DENIED'
    | 'REVOKED';
}
```

## 22.1 Runtime invariants

* Requested capability is not granted capability.
* Capability scope must be explicit.
* Secret access must never be inferred from tool availability.
* Runtime Binding changes increment revision but not necessarily PWU semantic version.
* Privilege expansion requires a new authorization event.
* Revoked bindings cannot be used for new attempts.
* Model output is treated as untrusted external input.

---

# 23. Decisions and Governance

## 23.1 Decision Object

```typescript
interface DecisionObject extends ObjectEnvelope {
  objectType: 'DECISION';

  decisionType:
    | 'APPROVAL'
    | 'REJECTION'
    | 'WAIVER'
    | 'ESCALATION'
    | 'RESHAPE'
    | 'REPLAN'
    | 'PROMOTE_BASELINE'
    | 'ABANDON'
    | 'REVOKE';

  subjectObjectIds: string[];
  selectedOption: string;

  rationale: string;
  authority: ActorReference;

  consideredEvidenceIds: string[];
  consideredObservationIds: string[];

  effectiveAt?: string;

  status:
    | 'PROPOSED'
    | 'EFFECTIVE'
    | 'REVOKED'
    | 'SUPERSEDED';
}
```

## 23.2 Governance invariants

* Approval requires authority.
* Waiver requires scope, rationale, duration, and affected objects.
* Human override must not erase prior assurance findings.
* A decision cannot retroactively change evidence.
* Revocation triggers impact analysis.
* Baseline promotion requires explicit effective decision.
* An agent may recommend a decision but cannot exercise authority unless delegated.

---

# 24. Baselines

## 24.1 Baseline Object

```typescript
interface BaselineObject extends ObjectEnvelope {
  objectType: 'BASELINE';

  baselineType:
    | 'INTENT'
    | 'REQUIREMENTS'
    | 'ARCHITECTURE'
    | 'IMPLEMENTATION'
    | 'RELEASE'
    | 'EVIDENCE_PACKAGE';

  itemObjectIds: string[];
  assuranceAssessmentIds: string[];
  promotionDecisionId: string;

  status:
    | 'DRAFT'
    | 'CANDIDATE'
    | 'UNDER_REVIEW'
    | 'APPROVED'
    | 'AUTHORITATIVE'
    | 'SUPERSEDED'
    | 'REVOKED';
}
```

## 24.2 Baseline invariants

* An authoritative baseline is immutable.
* Changes create a successor baseline.
* Open blocking observations prevent promotion unless waived.
* Promotion evidence must be retained.
* Supersession preserves traceability.
* Repository commit and baseline are related but not synonymous.
* A commit may exist without baseline promotion.
* Baseline promotion is a governance event, not an execution step.

---

# 25. Typed Traceability

```typescript
type TraceRelation =
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
  | 'PROMOTES'
  | 'ALLOCATES'
  | 'PROPAGATES'
  | 'GOVERNS';

interface TraceLink {
  id: string;
  sourceObjectId: string;
  targetObjectId: string;
  relation: TraceRelation;

  rationale?: string;

  createdAt: string;
  createdBy: ActorReference;
}
```

## 25.1 Trace invariants

* Trace links are directed and typed.
* `DECOMPOSES` must connect a parent PWU to a child PWU.
* `SUPPORTS` must originate from Evidence or Assessment and target a Claim.
* `VERIFIES` must originate from an Assessment.
* `PROMOTES` must connect a Decision to a Baseline or Baseline Item.
* Trace links cannot be silently rewritten.
* Invalidated source objects may invalidate downstream trace claims.

---

# 26. Event Model

The runtime should use domain events for all material changes.

## 26.1 Event envelope

```typescript
interface DomainEvent<TPayload = unknown> {
  eventId: string;
  eventType: string;

  aggregateType: string;
  aggregateId: string;

  aggregateRevision: number;

  occurredAt: string;
  recordedAt: string;

  actor: ActorReference;

  correlationId: string;
  causationId?: string;
  commandId?: string;

  payload: TPayload;

  schemaVersion: number;
}
```

## 26.2 Core work events

```text
IntentCaptured
IntentDiscoveryStarted
IntentFormalized
IntentApproved
IntentRevised
IntentSuperseded

PwuProposed
PwuShapingStarted
PwuMarkedReady
PwuBlocked
PwuChallenged
PwuReshapingStarted
PwuSatisfied
PwuConditionallySatisfied
PwuRejected
PwuInvalidated
PwuSuperseded
PwuAbandoned

DecompositionProposed
DecompositionValidated
DecompositionRejected
DecompositionRevised

RecompositionStarted
RecompositionConflictDetected
RecompositionCompleted
RecompositionFailed
```

## 26.3 Assumption and constraint events

```text
AssumptionDetected
AssumptionDisclosed
AssumptionAccepted
AssumptionVerificationStarted
AssumptionVerified
AssumptionFalsified
AssumptionExpired

ConstraintAdded
ConstraintPropagated
ConstraintDeclaredInapplicable
ConstraintWaived
ConstraintViolated
ConstraintSuperseded

ObligationAllocated
ObligationRetained
ObligationSatisfied
ObligationWaived
ObligationViolated
```

## 26.4 Execution events

```text
ExecutionPlanProposed
ExecutionPlanApproved
ExecutionPlanActivated
ExecutionPlanSuperseded

ExecutionStepReady
ExecutionStepStarted
ExecutionStepWaiting
ExecutionStepSucceeded
ExecutionStepFailed
ExecutionStepRetried
ExecutionStepSkipped
ExecutionStepCancelled

RuntimeBindingRequested
RuntimeBindingAuthorized
RuntimeBindingDenied
RuntimeCapabilityRevoked

TacticalChangeRequested
TacticalChangeApplied
ExecutionEscalated
ExecutionTerminated
```

## 26.5 Assurance events

```text
ClaimAsserted
ClaimContested
ClaimSupported
ClaimRejected

EvidenceProposed
EvidenceAdmitted
EvidenceRejected
EvidenceInvalidated
EvidenceExpired

AssuranceAssessmentRequested
AssuranceAssessmentStarted
AssuranceObservationRecorded
AssuranceAssessmentSatisfied
AssuranceAssessmentConditionallySatisfied
AssuranceAssessmentRejected
AssuranceAssessmentInconclusive
AssuranceAssessmentEscalated

WaiverRequested
WaiverGranted
WaiverDenied
WaiverExpired
```

## 26.6 Governance and baseline events

```text
DecisionProposed
DecisionApproved
DecisionRejected
DecisionEffective
DecisionRevoked

BaselineCreated
BaselineSubmittedForReview
BaselineApproved
BaselinePromoted
BaselineSuperseded
BaselineRevoked
```

---

# 27. Command Model

Commands express requested state changes.

Events record accepted state changes.

## 27.1 Command envelope

```typescript
interface DomainCommand<TPayload = unknown> {
  commandId: string;
  commandType: string;

  targetAggregateId: string;
  expectedRevision?: number;

  issuedAt: string;
  issuedBy: ActorReference;

  correlationId: string;
  causationId?: string;

  payload: TPayload;
}
```

## 27.2 Required command behavior

Every command handler must:

1. authenticate actor;
2. authorize requested operation;
3. load aggregate;
4. check expected revision;
5. validate preconditions;
6. enforce invariants;
7. produce one or more domain events;
8. persist events atomically;
9. update projections;
10. emit integration events where necessary.

No command handler may directly update read-model tables without generating the corresponding domain event.

---

# 28. Concurrency and Idempotency

## 28.1 Optimistic concurrency

All aggregate mutations require an expected revision.

On conflict:

* reject the command;
* reload current state;
* require re-evaluation;
* never silently overwrite.

## 28.2 Idempotency

Commands with the same `commandId` must not execute twice.

External tool operations must use idempotency keys where supported.

Agent retries must not duplicate:

* commits;
* external API mutations;
* baseline promotion;
* approval decisions;
* evidence records.

## 28.3 Parallel child work

Parallel child PWUs may execute concurrently.

Their outputs cannot be recomposed until:

* required children reach acceptable states;
* shared dependencies are resolved;
* conflicts are assessed.

---

# 29. Invalidation and Impact Analysis

Invalidation is a first-class operation.

## 29.1 Invalidation triggers

* intent revision;
* mandatory constraint change;
* assumption falsification;
* evidence invalidation;
* authority revocation;
* assurance-policy change;
* architecture baseline change;
* dependency failure;
* child conflict;
* external reality change.

## 29.2 Impact traversal

The impact engine should traverse typed relationships such as:

```text
Intent
  → refines
Requirement
  → allocated to
PWU
  → produces
Artifact
  → supports
Evidence
  → supports
Claim
  → verifies
Baseline
```

## 29.3 Invalidation outcomes

Each affected object is classified:

* unaffected;
* review required;
* evidence refresh required;
* revalidation required;
* replanning required;
* reshaping required;
* invalidated.

Automatic invalidation must be conservative where consequences are high.

---

# 30. Legacy Product Lens Compatibility Mapping Contract

The legacy Product Lens phase labels map to canonical objects as follows.

| Legacy phase label   | Canonical representation                           |
| -------------------- | -------------------------------------------------- |
| INTAKE               | Root Intent plus intent-shaping PWUs               |
| ARCHITECTURE         | Architecture PWU hierarchy                         |
| PROPOSE              | Proposal PWU plus candidate Execution Plan         |
| ASSUMPTION_SURFACING | Assurance Policy plus Assumption Objects           |
| VERIFY               | Assurance Assessments and verification PWUs        |
| HISTORICAL_CHECK     | Historical Consistency Assurance Policy            |
| REVIEW               | Governance Decision                                |
| EXECUTE              | Actionable PWUs, Execution Plans, Runtime Bindings |
| VALIDATE             | Assurance Policy set and Assessments               |
| COMMIT               | Repository Commit Artifact operation plus separate Baseline Promotion Decision and Baseline |
| REPLAN               | Control action producing revised plan or shape     |

The migration adapter may expose legacy phase-compatible labels, but these labels cannot remain authoritative state.

---

# 31. Minimum Persistence Schema

The initial relational implementation should include:

```text
professional_work_architectures
pwu_types
undertakings
professional_work_objects
professional_work_object_versions

intents
professional_work_units
obligations
constraints
assumptions

decomposition_contracts
decomposition_allocations
recomposition_contracts

claims
evidence
claim_evidence_links

assurance_policies
assurance_assessments
assurance_observations

execution_plans
execution_steps
execution_transitions
execution_attempts

runtime_bindings
capability_requests
capability_grants

decisions
baselines
baseline_items

trace_links

domain_events
command_receipts
outbox_events

pwu_state_history
assurance_state_history
execution_state_history
shape_integrity_history
```

## 31.1 Storage guidance

* Use normalized relational columns for universal semantics.
* Use JSON only for versioned extension payloads and policy expressions.
* Store large artifacts outside core relational rows where appropriate.
* Preserve content hashes for evidence and artifacts.
* Do not use EAV as the canonical model.
* Use an outbox pattern for event publication.

---

# 32. Read Models and Projections

The UI should consume purpose-built projections.

## 32.1 Professional Work Graph Projection

Contains:

* PWU hierarchy;
* lifecycle state;
* shape-integrity state;
* inherited constraints;
* open assumptions;
* child coverage.

## 32.2 Execution Graph Projection

Contains:

* active plan;
* step state;
* current role;
* tool/model binding;
* retries;
* blocked conditions.

## 32.3 Assurance Graph Projection

Contains:

* active policies;
* claims;
* evidence;
* observations;
* dispositions;
* waivers.

## 32.4 Traceability Projection

Contains:

* user intent;
* derived objectives;
* PWUs;
* artifacts;
* evidence;
* claims;
* baselines.

## 32.5 Change-Impact Projection

Contains:

* changed object;
* affected objects;
* invalidation status;
* required remediation.

Read models may be rebuilt from domain events and canonical tables.

---

# 33. Service Boundaries

## 33.1 Work Service

Responsibilities:

* create and revise PWUs;
* enforce work lifecycle;
* manage obligations and constraints;
* manage decomposition and recomposition;
* evaluate shape readiness.

## 33.2 Assurance Service

Responsibilities:

* instantiate policies;
* create assessments;
* manage claims and evidence;
* record observations;
* determine assurance disposition;
* recommend control actions.

## 33.3 Execution Service

Responsibilities:

* create and activate plans;
* schedule steps;
* manage attempts;
* apply retry and tactical-change policy;
* publish execution events.

## 33.4 Runtime Authorization Service

Responsibilities:

* evaluate capability requests;
* grant scoped privileges;
* revoke access;
* enforce sandbox and tool policies.

## 33.5 Governance Service

Responsibilities:

* approvals;
* waivers;
* escalations;
* baseline promotion;
* decision authority.

## 33.6 Traceability and Impact Service

Responsibilities:

* typed relationships;
* lineage queries;
* impact traversal;
* invalidation propagation.

---

# 34. Minimum API Surface

The first implementation should expose commands and queries rather than unrestricted CRUD.

## 34.1 Work commands

Before these commands are accepted, JPWB must have established the selected PWA version, Undertaking identity, and any referenced PWU Type through its definition and Undertaking-management contracts.

```text
captureIntent
formalizeIntent
approveIntent
reviseIntent

proposePwu
beginPwuShaping
markPwuReady
challengePwu
reshapePwu
invalidatePwu
supersedePwu

proposeDecomposition
validateDecomposition
reviseDecomposition

beginRecomposition
completeRecomposition
```

## 34.2 Assurance commands

```text
assertClaim
proposeEvidence
admitEvidence
invalidateEvidence

requestAssuranceAssessment
recordAssuranceObservation
completeAssuranceAssessment

requestWaiver
grantWaiver
denyWaiver
```

## 34.3 Execution commands

```text
proposeExecutionPlan
approveExecutionPlan
activateExecutionPlan
startExecutionStep
completeExecutionStep
failExecutionStep
retryExecutionStep
applyTacticalChange
cancelExecutionPlan
```

## 34.4 Governance commands

```text
proposeDecision
approveDecision
revokeDecision
promoteBaseline
supersedeBaseline
```

## 34.5 Queries

```text
getPwaVersion
getPwuType
getUndertaking
getProfessionalWorkGraph
getPwu
getPwuHierarchy
getPwuTraceability
getPwuAssuranceStatus
getPwuExecutionStatus
getOpenObservations
getImpactAnalysis
getBaseline
getDecisionHistory
getEventHistory
```

---

# 35. Property-Based and Invariant Testing

The domain model should be tested with generated command sequences.

## 35.1 Required properties

### No execution implies assurance

For any command sequence:

```text
ExecutionState = SUCCEEDED
```

must not automatically imply:

```text
AssuranceState = SATISFIED
```

### No obligation disappears

After any valid decomposition:

```text
Parent mandatory obligations
=
allocated
+ retained
+ satisfied
+ authorized waivers
```

### No constraint silently drops

Every mandatory applicable constraint must remain traceable after decomposition.

### Invalid evidence cannot support satisfaction

If evidence becomes invalidated, every dependent supported claim must become contested, under review, or invalidated.

### No unauthorized baseline

A baseline cannot become authoritative without an effective promotion decision.

### No superseded execution

No new step may begin under a superseded Execution Plan.

### No hidden material assumption

Every material assumption emitted by an agent must become an Assumption Object before dependent work reaches `READY`.

### No semantic mutation from presentation

Canvas layout operations must never increment semantic version.

---

# 36. Failure Taxonomy

The runtime should classify failures explicitly.

## 36.1 Shape failures

* intent ambiguity;
* scope drift;
* obligation loss;
* constraint erosion;
* assumption mutation;
* invalid decomposition;
* recomposition conflict;
* shape-integrity violation.

## 36.2 Execution failures

* tool failure;
* model failure;
* timeout;
* sandbox failure;
* dependency unavailable;
* retry exhaustion;
* invalid output schema.

## 36.3 Assurance failures

* insufficient evidence;
* unsupported claim;
* validator disagreement;
* policy violation;
* independence violation;
* inconclusive result;
* residual risk above threshold.

## 36.4 Governance failures

* missing authority;
* expired waiver;
* revoked approval;
* unresolved escalation;
* baseline-promotion denial.

## 36.5 Persistence failures

* concurrency conflict;
* event write failure;
* projection lag;
* corrupted extension payload;
* schema-version mismatch.

Each failure class must map to permitted control actions.

---

# 37. Controller Decision Contract

The controller may select one of the following actions:

```typescript
type ControlAction =
  | 'CONTINUE'
  | 'WAIT'
  | 'RETRY'
  | 'GATHER_EVIDENCE'
  | 'REVISE_CONTEXT'
  | 'REVISE_PROMPT'
  | 'CHANGE_MODEL'
  | 'CHANGE_TOOL'
  | 'CHANGE_TACTIC'
  | 'RESHAPE_PWU'
  | 'REVISE_DECOMPOSITION'
  | 'REPLAN_EXECUTION'
  | 'ESCALATE'
  | 'WAIVE'
  | 'REJECT'
  | 'ABANDON'
  | 'ACCEPT'
  | 'PROMOTE_BASELINE';
```

Every control action must record:

* triggering condition;
* evidence or observations considered;
* policy authorizing the action;
* actor;
* affected objects;
* expected outcome.

---

# 38. Initial Implementation Boundary

The first production slice should support:

* one root Product Realization PWU Instance in an Undertaking;
* a fixed Product Realization PWA-derived PWU Instance hierarchy;
* static Execution Plans preserving the legacy phase order;
* current Janumi Professional Workbench agents as Runtime Bindings;
* current validators represented as Assurance Policies;
* human approval as Decisions;
* source commit represented separately from Baseline Promotion;
* read-only Work, Execution, and Assurance projections;
* durable domain events;
* independent execution and assurance states.

The first slice does not require:

* arbitrary user-created ontologies;
* dynamic graph editing;
* autonomous privilege changes;
* confidence fusion across validators;
* full recursive dynamic decomposition;
* marketplace templates.

---

# 39. Migration Acceptance Tests

## Scenario 1: Normal successful Product Realization Undertaking run

Expected:

* approved intent;
* PWU hierarchy created;
* static Product Realization execution plan executed;
* assumptions disclosed;
* claims verified;
* historical assessment completed;
* human approval recorded;
* implementation executed;
* validation assessments satisfied;
* commit artifact created;
* baseline promoted;
* trace from intent to baseline available.

## Scenario 2: Falsified assumption

Expected:

* assumption becomes `FALSIFIED`;
* affected PWUs identified;
* shape-integrity state becomes `AT_RISK` or `VIOLATED`;
* affected evidence is reviewed;
* controller selects reshape or replan;
* execution does not continue blindly.

## Scenario 3: Execution succeeds, validation fails

Expected:

* execution state becomes `SUCCEEDED`;
* assurance state becomes `REJECTED`;
* PWU does not become `SATISFIED`;
* baseline promotion is blocked;
* remediation action is generated.

## Scenario 4: Human waiver

Expected:

* blocking observation remains visible;
* waiver includes scope, rationale, authority, and duration;
* assurance state becomes `WAIVED` or conditionally satisfied;
* baseline record includes waiver.

## Scenario 5: Intent changes after implementation

Expected:

* intent semantic version increments;
* impact analysis traverses affected PWUs and evidence;
* affected satisfied PWUs become review-required or invalidated;
* prior baseline remains immutable;
* successor baseline is required.

## Scenario 6: Extension restart during execution

Expected:

* execution resumes from durable state;
* no duplicate tool side effects;
* no duplicate decisions;
* in-flight attempt disposition is reconciled.

---

# 40. Definition of Done for the Initial Implementation Milestone

The initial implementation milestone is complete when:

* canonical TypeScript schemas exist;
* JSON Schema or equivalent validation exists;
* database migrations exist;
* all lifecycle transitions are encoded;
* illegal transitions are rejected;
* domain events are emitted for all material changes;
* command idempotency is implemented;
* optimistic concurrency is enforced;
* invariant tests pass;
* legacy Product Lens phase labels can be mapped to canonical objects;
* a sample Product Realization Undertaking can be represented entirely through the model;
* execution and assurance are demonstrably independent;
* intent-to-baseline traceability can be queried;
* the canvas is not required for the model to function.

---

# 41. Recommended Implementation Order

1. Common object envelope and identifiers
2. Domain event store and command receipts
3. PWA Version, PWU Type, and Undertaking identity and binding
4. Intent aggregate
5. PWU Instance aggregate and lifecycle
6. Obligation, constraint, and assumption models
7. Decomposition and recomposition contracts
8. Execution Plan aggregate
9. Runtime Binding authorization
10. Claim and Evidence models
11. Assurance Assessment aggregate
12. Decision and Baseline aggregates
13. Typed traceability
14. Invalidation and impact analysis
15. legacy Product Lens compatibility adapter
16. Read-model projections
17. Workbench integration

---

# 42. Architectural Litmus Tests

Before accepting any implementation design, ask:

1. Can the work be understood without viewing the execution graph?
2. Can the execution plan be replaced without changing the PWU?
3. Can execution succeed while assurance fails?
4. Can a validator explain which claim it evaluated and which evidence it considered?
5. Can a parent obligation be traced into child PWUs?
6. Can a falsified assumption invalidate downstream work?
7. Can a user determine why a baseline was promoted?
8. Can a graph layout change occur without changing semantics?
9. Can a human override be identified without erasing the original finding?
10. Can the system explain whether it is blocked because of work shape, execution, assurance, governance, or infrastructure?

If the answer to any of these is no, the implementation is collapsing architectural concerns that the RPH requires to remain distinct.

---

# 43. Closing Architecture Rule

The minimum viable Recursive Professional Harness is not the smallest system that can execute a configurable series of AI steps.

It is the smallest system that can:

* represent user intent;
* structure that intent into bounded professional obligations;
* preserve those obligations through decomposition;
* execute them through replaceable plans and governed runtime capabilities;
* collect evidence;
* assess claims;
* react to drift, falsification, and failure;
* recompose child outcomes;
* and justify promotion of the resulting work into an authoritative baseline.

That is the implementation boundary this specification establishes.
