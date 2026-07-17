# Janumi Semantic Definition Language

## Concrete Syntax, Module System, and Semantic Model

**Document ID:** `JAN-JSDL-001`
**Version:** `0.1.0`
**Status:** Draft
**Specification:** JSDL Core v0.1.0
**Depends on:** CPCO v0.1, PWU Specification v0.1, RPH Specification v0.1, Canonical Projection Model v0.1, Reference Interaction and Workspace Specification v0.1
**Primary audiences:** Compiler engineers, platform architects, coding agents, backend engineers, frontend engineers, PWA authors, validator developers

---

# 1. Purpose

This specification defines the first concrete, machine-readable form of the Janumi Semantic Definition Language.

JSDL is the canonical source language for defining:

* semantic entities;
* value objects;
* enumerations;
* relationships;
* aggregates;
* lifecycle models;
* commands;
* events;
* invariants;
* validators;
* projections;
* permissions;
* observability contracts;
* Professional Work Architecture extensions.

A JSDL compiler transforms these definitions into implementation artifacts while preserving the professional semantics established by the Janumi foundational specifications.

---

# 2. Source Format

JSDL v0.1 SHALL use YAML as its canonical authoring syntax.

YAML was selected because it is:

* human-readable;
* machine-readable;
* suitable for version control;
* widely supported;
* structurally expressive;
* practical for initial compiler implementation.

JSON MAY be accepted as an equivalent interchange syntax.

The canonical semantic model SHALL not depend on YAML-specific behavior.

---

# 3. File Extension

Canonical JSDL files SHALL use:

```text
.jsdl.yaml
```

Equivalent JSON files MAY use:

```text
.jsdl.json
```

Examples:

```text
foundation.jsdl.yaml
cpco-core.jsdl.yaml
pwu.jsdl.yaml
rph.jsdl.yaml
janumicode.jsdl.yaml
```

---

# 4. Module Structure

Every JSDL source file SHALL declare a module.

```yaml
jsdl: "0.1"

module:
  name: janumi.cpco.core
  version: 0.1.0
  status: draft
  namespace: https://janumi.example/semantic/cpco/core
```

## 4.1 Required Module Fields

```text
name
version
namespace
```

## 4.2 Optional Module Fields

```text
status
description
authors
license
imports
exports
compatibility
annotations
```

## 4.3 Module Naming

Module names SHOULD use reverse hierarchical semantic naming.

Examples:

```text
janumi.foundation
janumi.cpco.core
janumi.work.pwu
janumi.coordination.rph
janumi.projection.core
janumi.pwa.code
janumi.pwa.science
```

Module names SHALL be globally unique within a compiled model.

---

# 5. Import Model

Modules MAY import semantic definitions from other modules.

```yaml
imports:
  - module: janumi.foundation
    version: "^0.1.0"
    alias: foundation

  - module: janumi.cpco.core
    version: "^0.1.0"
    alias: cpco
```

## 5.1 Import Fields

```text
module
version
alias
optional
symbols
```

## 5.2 Selective Imports

```yaml
imports:
  - module: janumi.cpco.core
    version: "^0.1.0"
    symbols:
      - Intent
      - Outcome
      - Participant
      - Evidence
```

## 5.3 Import Invariants

A compiler SHALL reject:

* unresolved imports;
* incompatible versions;
* duplicate aliases;
* cyclic imports that require incomplete semantic definitions;
* ambiguous unqualified names.

---

# 6. Top-Level Document Structure

A JSDL module MAY contain:

```yaml
jsdl: "0.1"

module: {}

imports: []

annotations: {}

enums: {}
valueObjects: {}
entities: {}
relationships: {}
aggregates: {}
lifecycles: {}
commands: {}
events: {}
invariants: {}
validators: {}
projections: {}
permissions: {}
observability: {}
extensions: {}
testCases: {}
```

Unknown top-level sections SHALL produce a compiler error unless declared by a supported extension mechanism.

---

# 7. Naming Rules

Semantic identifiers SHALL:

* begin with a letter;
* contain letters, digits, or underscores;
* use PascalCase for types;
* use camelCase for properties;
* use SCREAMING_SNAKE_CASE for invariant and error codes;
* avoid implementation-specific terminology unless defining an implementation profile.

Examples:

```text
ProfessionalWorkUnit
ConfidenceAssessment
professionalObjective
originatingIntentIds
PWU_INV_001
MANDATORY_VALIDATION_FAILED
```

---

# 8. Primitive Types

JSDL v0.1 SHALL support the following primitive types:

```text
String
Text
Boolean
Integer
Decimal
Timestamp
Date
Duration
Uri
Uuid
Json
Bytes
```

## 8.1 Semantic Scalar Aliases

Modules MAY define constrained aliases.

```yaml
valueObjects:
  EntityId:
    kind: scalar
    base: Uuid

  ConfidenceValue:
    kind: scalar
    base: Decimal
    constraints:
      minimum: 0
      maximum: 1
```

## 8.2 Required Versus Optional

Properties are required by default.

Optional properties SHALL declare:

```yaml
required: false
```

## 8.3 Nullability

Optionality and nullability SHALL remain distinct.

```yaml
properties:
  validUntil:
    type: Timestamp
    required: false
    nullable: false
```

This means the property may be absent, but when present it may not be null.

Explicit null SHOULD be avoided for professional state.

---

# 9. Collection Types

JSDL supports:

```text
List<T>
Set<T>
Map<K,V>
Reference<T>
Owned<T>
```

Examples:

```yaml
properties:
  stakeholderIds:
    type: Set<Reference<Stakeholder>>

  evidence:
    type: List<Owned<EvidenceReference>>

  metadata:
    type: Map<String, Json>
```

## 9.1 Collection Constraints

```yaml
properties:
  originatingIntentIds:
    type: Set<Reference<Intent>>
    constraints:
      minItems: 1
      unique: true
```

---

# 10. Enumerations

Enumerations define closed semantic value sets.

```yaml
enums:
  ParticipantType:
    values:
      - human
      - ai_agent
      - team
      - organization
      - external_system
      - institution
```

## 10.1 Rich Enum Values

```yaml
enums:
  ValidationResult:
    values:
      pass:
        label: Pass
        terminal: true

      fail:
        label: Fail
        terminal: true

      conditional_pass:
        label: Conditional Pass
        terminal: true

      inconclusive:
        label: Inconclusive
        terminal: true

      not_applicable:
        label: Not Applicable
        terminal: true
```

## 10.2 Enum Stability

Existing enum semantics SHALL NOT be changed incompatibly without a breaking module version.

---

# 11. Value Objects

Value objects are immutable semantic structures without independent identity.

```yaml
valueObjects:
  ProfessionalObjective:
    description: >
      A professionally meaningful result sought by a work unit.
    properties:
      statement:
        type: Text

      outcomeContributionIds:
        type: Set<Reference<Outcome>>
        required: false

      decisionContributionIds:
        type: Set<Reference<Decision>>
        required: false
```

## 11.1 Value Object Invariants

```yaml
valueObjects:
  ProfessionalObjective:
    properties:
      statement:
        type: Text

    invariants:
      - code: OBJECTIVE_NOT_EMPTY
        expression: length(trim(self.statement)) > 0
```

---

# 12. Entity Definitions

An entity possesses stable identity and independent lifecycle semantics.

```yaml
entities:
  Intent:
    description: >
      The desired outcome and rationale motivating professional work.

    identity:
      property: intentId
      type: EntityId

    properties:
      statement:
        type: Text

      rationale:
        type: Text

      priority:
        type: Priority

      status:
        type: IntentStatus

      createdBy:
        type: Reference<Participant>

      createdAt:
        type: Timestamp
```

## 12.1 Entity Definition Fields

An entity MAY declare:

```text
description
extends
identity
properties
relationships
lifecycle
invariants
validators
commands
events
projectionMetadata
annotations
```

## 12.2 Entity Inheritance

```yaml
entities:
  Representation:
    abstract: true
    identity:
      property: representationId
      type: EntityId

    properties:
      semanticPurpose:
        type: Text

      status:
        type: RepresentationStatus

  Requirement:
    extends: Representation

    properties:
      requirementType:
        type: RequirementType
```

Inheritance SHALL represent valid semantic specialization.

It SHALL NOT be used merely for code reuse.

## 12.3 Entity Extension

A PWA SHOULD use extension declarations rather than modifying canonical entities directly.

---

# 13. Universal Entity Metadata

Canonical entities SHOULD inherit or compose the universal entity contract.

```yaml
valueObjects:
  Provenance:
    properties:
      createdBy:
        type: Reference<Participant>

      createdAt:
        type: Timestamp

      sourceType:
        type: SourceType

      sourceReferences:
        type: Set<Uri>
        required: false

      aiExecutionContext:
        type: AiExecutionContext
        required: false
```

A compiler MAY generate universal metadata fields through annotations:

```yaml
entities:
  Claim:
    annotations:
      janumi.provenance: required
      janumi.versioned: true
      janumi.temporal: true
```

---

# 14. Relationships

Relationships are first-class semantic definitions.

```yaml
relationships:
  EvidenceSupportsClaim:
    source: Evidence
    target: Claim
    cardinality:
      sourceToTarget: many
      targetToSource: many

    properties:
      relevance:
        type: RelevanceAssessment

      strength:
        type: ConfidenceValue

      rationale:
        type: Text

    inverseName: supportedByEvidence
```

## 14.1 Relationship Fields

```text
source
target
cardinality
properties
inverseName
temporal
versioned
invariants
annotations
```

## 14.2 Relationship Identity

Material relationships SHOULD have stable identity.

```yaml
relationships:
  EvidenceSupportsClaim:
    identity:
      property: relationshipId
      type: EntityId
```

## 14.3 Relationship Invariants

```yaml
invariants:
  - code: EVIDENCE_SUPPORT_REQUIRES_RATIONALE
    expression: length(trim(self.rationale)) > 0
```

## 14.4 Implicit Relationship Prohibition

Semantic meaning SHALL NOT be inferred from:

* physical containment;
* document attachment;
* proximity in a UI;
* sequence in a list;
* shared storage location.

---

# 15. Lifecycle Definitions

Lifecycle models define explicit legal states and transitions.

```yaml
lifecycles:
  PwuLifecycle:
    initialState: proposed

    states:
      proposed: {}
      framing: {}
      ready: {}
      active: {}
      blocked: {}
      awaiting_evidence: {}
      awaiting_decision: {}
      awaiting_review: {}
      awaiting_external: {}
      reconciling: {}
      suspended: {}
      completed:
        terminal: true
      cancelled:
        terminal: true
      superseded:
        terminal: true
      failed:
        terminal: true
      reopened: {}

    transitions:
      StartFraming:
        from: proposed
        to: framing

      DeclareReady:
        from: framing
        to: ready
        guard: validators.PwuReadyValidator

      Activate:
        from:
          - ready
          - reopened
        to: active

      Complete:
        from:
          - active
          - awaiting_review
          - reconciling
        to: completed
        guard: validators.PwuCompletionValidator
```

## 15.1 Transition Fields

```text
from
to
guard
authority
command
emits
effects
description
```

## 15.2 Terminal State Reopening

Transitions from terminal states SHALL be explicit.

```yaml
Reopen:
  from:
    - completed
    - cancelled
    - superseded
    - failed
  to: reopened
  authority: permissions.ReopenPwu
```

## 15.3 State Inference Prohibition

Lifecycle state SHALL not be inferred from property presence, absence, or content.

---

# 16. Aggregate Definitions

Aggregates define semantic consistency boundaries.

```yaml
aggregates:
  ProfessionalWorkUnitAggregate:
    root: ProfessionalWorkUnit

    owned:
      - CompletionCondition
      - PwuParticipantAssignment
      - PwuStateExplanation

    referenced:
      - Intent
      - Outcome
      - Participant
      - Question
      - Uncertainty
      - Representation
      - Claim
      - Evidence
      - Decision
      - Observation
      - Validation
      - Reconciliation

    concurrency:
      strategy: optimistic
      versionProperty: aggregateVersion

    commands:
      - ProposePWU
      - FramePWU
      - DeclareReady
      - ActivatePWU
      - BlockPWU
      - CompletePWU
      - ReopenPWU
      - DecomposePWU
```

## 16.1 Semantic Versus Transactional Aggregate

A JSDL aggregate definition SHALL describe a transactional consistency boundary.

A semantic PWU MAY reference multiple transactional aggregates.

The compiler SHALL NOT assume that all semantic PWU content resides in one transaction.

## 16.2 Aggregate Invariant Scope

Aggregate invariants SHALL be enforceable within the declared consistency boundary.

Cross-aggregate coherence rules SHALL be declared as validators or process policies.

---

# 17. Command Definitions

Commands express professionally meaningful requested state changes.

```yaml
commands:
  CompletePWU:
    description: >
      Request professional completion of a work unit after all
      declared completion conditions have been evaluated.

    targetAggregate: ProfessionalWorkUnitAggregate

    payload:
      completionDisposition:
        type: CompletionDisposition

      completionRationale:
        type: Text

      acceptedResidualUncertaintyIds:
        type: Set<Reference<Uncertainty>>
        required: false

    authority:
      permission: permissions.CompletePwu

    preconditions:
      - validator: validators.PwuCompletionValidator

    emits:
      - PWUCompleted

    failures:
      - code: MANDATORY_VALIDATION_FAILED
      - code: BLOCKING_DEPENDENCY_UNRESOLVED
      - code: RECOMPOSITION_REQUIRED
      - code: RESIDUAL_UNCERTAINTY_NOT_ACCEPTED
      - code: STALE_AGGREGATE_VERSION
```

## 17.1 Command Envelope

All generated command contracts SHALL include:

```yaml
commandEnvelope:
  properties:
    commandId:
      type: EntityId

    expectedVersion:
      type: Integer

    requestedBy:
      type: Reference<Participant>

    requestedAt:
      type: Timestamp

    correlationId:
      type: EntityId

    causationId:
      type: EntityId
      required: false

    originatingProjection:
      type: ProjectionContext
      required: false
```

## 17.2 Command Effects

Commands MAY declare deterministic semantic effects.

```yaml
effects:
  - set: root.lifecycleState
    value: completed

  - increment: root.aggregateVersion
```

Complex professional logic SHOULD remain in generated or handwritten command handlers rather than an unrestricted expression language.

---

# 18. Event Definitions

Events represent immutable semantic facts.

```yaml
events:
  PWUCompleted:
    description: >
      A Professional Work Unit satisfied an authorized completion
      disposition.

    aggregate: ProfessionalWorkUnitAggregate

    payload:
      pwuId:
        type: Reference<ProfessionalWorkUnit>

      completionDisposition:
        type: CompletionDisposition

      completedBy:
        type: Reference<Participant>

      completedAt:
        type: Timestamp

      residualUncertaintyIds:
        type: Set<Reference<Uncertainty>>
        required: false

    observability:
      category: professional_state_transition
      severity: informational
```

## 18.1 Event Envelope

All generated event contracts SHALL include:

```text
eventId
eventType
occurredAt
recordedAt
actorId
correlationId
causationId
aggregateId
aggregateVersion
moduleVersion
payload
provenance
```

## 18.2 Event Immutability

Events SHALL be immutable.

Correction SHALL occur through new events, reconciliation, or superseding facts.

---

# 19. Invariant Definitions

Invariants express conditions that SHALL always hold.

```yaml
invariants:
  PWU_INV_001:
    description: A PWU shall possess exactly one active professional objective.
    scope: ProfessionalWorkUnit
    severity: error
    expression: self.professionalObjective != null

  PWU_INV_002:
    description: A non-exploratory PWU shall trace to at least one active Intent.
    scope: ProfessionalWorkUnit
    severity: error
    expression: >
      self.exploratoryPurpose != true
      implies size(self.originatingIntentIds) >= 1
```

## 19.1 Invariant Severity

```text
error
warning
advisory
```

An error-level invariant violation SHALL prevent the relevant state transition or authoritative mutation.

## 19.2 Expression Language

JSDL v0.1 SHALL support a constrained expression language with:

```text
Boolean operators
Comparison operators
Collection size and membership
Property access
Null and presence checks
Implication
Quantifiers: all, any, none
Simple temporal comparisons
Named validator invocation
```

The expression language SHALL not permit arbitrary filesystem, network, or process access.

---

# 20. Validator Definitions

Validators perform structured semantic evaluation.

```yaml
validators:
  PwuReadyValidator:
    type: composite
    description: >
      Determines whether a framed PWU may enter the ready state.

    checks:
      - invariant: PWU_INV_001
      - invariant: PWU_INV_002
      - validator: ObjectiveSemanticValidator
      - validator: ScopeCompletenessValidator
      - validator: AuthorityAssignmentValidator
      - validator: CompletionConditionValidator

    result:
      type: ValidationResult
```

## 20.1 Validator Kinds

```text
expression
composite
external
human
ai_assisted
policy
cross_aggregate
```

## 20.2 External Validator

```yaml
validators:
  RegulatoryComplianceValidator:
    type: external
    interface:
      requestType: RegulatoryValidationRequest
      responseType: RegulatoryValidationResponse

    timeout: PT30S
    failurePolicy: inconclusive
```

## 20.3 AI-Assisted Validator

```yaml
validators:
  ObjectiveSemanticValidator:
    type: ai_assisted

    professionalPurpose: >
      Determine whether the stated objective describes a professionally
      meaningful result rather than activity alone.

    inputs:
      - professionalObjective
      - originatingIntentIds
      - scope

    outputs:
      result:
        type: ValidationResult
      rationale:
        type: Text
      confidence:
        type: ConfidenceValue

    requiresHumanReviewWhen:
      expression: self.confidence < 0.8
```

AI-assisted validation SHALL remain attributable and reviewable.

---

# 21. Permission and Authority Definitions

Permissions define the authority required to perform semantic commands.

```yaml
permissions:
  CompletePwu:
    description: Complete a Professional Work Unit.
    appliesTo: CompletePWU

    allowedRoles:
      - owner
      - approver

    conditions:
      - expression: actor.participantId == target.ownerId
        or: actor.roles contains approver

    deniedWhen:
      - expression: target.lifecycleState == cancelled
      - expression: target.lifecycleState == superseded
```

## 21.1 Role Does Not Imply Universal Authority

A role assignment SHALL be scoped.

```yaml
scope:
  type: pwu
  reference: pwuId
```

## 21.2 AI Authority

AI permissions SHALL explicitly state whether the AI may:

```text
propose
validate
execute
approve
grant_exception
```

Approval and exception authority SHOULD default to denied.

---

# 22. Projection Definitions

Projections define semantic views over authoritative state.

```yaml
projections:
  PwuDecisionProjection:
    type: decision

    purpose: >
      Support an authorized Participant in evaluating a material
      professional decision.

    root:
      entity: Decision

    include:
      entities:
        - Question
        - Alternative
        - Claim
        - Evidence
        - Assumption
        - Constraint
        - Risk
        - ConfidenceAssessment
        - Participant

      relationships:
        - ClaimJustifiesDecision
        - EvidenceSupportsClaim
        - EvidenceContradictsClaim
        - DecisionSelectsAlternative

    temporal:
      modes:
        - current
        - as_of
        - comparison

    disclosures:
      - provenance
      - confidence
      - residual_uncertainty
      - contradictory_evidence
      - authority
      - staleness

    commands:
      owner:
        - ProposeDecision
      approver:
        - ApproveDecision
        - RejectDecision
        - DeferDecision
      reviewer:
        - AddEvidence
        - ChallengeClaim
```

## 22.1 Projection Presentation Metadata

JSDL MAY include semantic presentation hints.

```yaml
presentation:
  preferredModes:
    - structured_workspace
    - comparison_matrix

  primaryFields:
    - decisionQuestion
    - status
    - authority
    - residualUncertainty

  prominence:
    contradictions: critical
    mandatoryConstraints: critical
```

Pixel dimensions, colors, and framework-specific component names SHALL not be part of the canonical semantic model.

---

# 23. Observability Definitions

```yaml
observability:
  metrics:
    UnsupportedClaimCount:
      type: gauge
      professionalMeaning: >
        Number of material Claims lacking sufficient supporting Evidence.

      source:
        projection: UnsupportedClaimsProjection

      dimensions:
        - organizationId
        - endeavorId
        - pwuId
        - pwa

  traces:
    CompletePwuTrace:
      beginsOn: CompletePWU
      endsOn:
        - PWUCompleted
        - CommandRejected

      attributes:
        - pwuId
        - expectedVersion
        - participantId
        - validationResult
```

## 23.1 Cognitive Metrics

Metrics SHALL include professional meaning and SHALL not be defined solely as implementation counters.

---

# 24. Error Definitions

```yaml
errors:
  MANDATORY_VALIDATION_FAILED:
    category: professional_invariant
    retryable: false
    messageTemplate: >
      Completion is unavailable because one or more mandatory
      validations failed.

  STALE_AGGREGATE_VERSION:
    category: concurrency
    retryable: true
    messageTemplate: >
      The work unit changed after this view was generated.
      Refresh or reconcile the new state before retrying.
```

## 24.1 Error Categories

```text
validation
professional_invariant
authorization
concurrency
dependency
external_system
technical
policy
```

Generated APIs SHALL preserve machine-readable error codes and professional explanations.

---

# 25. Extension Model

PWA modules MAY extend canonical definitions.

```yaml
extensions:
  SourceCodeRepresentation:
    extendsEntity: Representation

    subtypeName: source_code

    properties:
      repositoryUri:
        type: Uri

      commitHash:
        type: String

      filePaths:
        type: Set<String>

      language:
        type: ProgrammingLanguage

    validators:
      - SourceReferenceValidator
```

## 25.1 Extension Invariants

An extension SHALL NOT:

* weaken canonical invariants;
* alter canonical semantic meaning;
* redefine existing enum values incompatibly;
* bypass provenance;
* bypass authority;
* replace canonical identity.

## 25.2 New Canonical Concepts

A PWA concept that cannot be faithfully represented as an extension MAY propose a new CPCO concept.

Such a proposal SHALL explain why composition, specialization, or relationship modeling is insufficient.

---

# 26. Deprecation

Definitions MAY be deprecated.

```yaml
entities:
  LegacyTask:
    deprecated:
      since: 0.2.0
      replacement: ProfessionalWorkUnit
      removalTarget: 1.0.0
      reason: >
        Task semantics are insufficient to represent professional cognition.
```

Generated artifacts SHOULD surface deprecation warnings.

---

# 27. Versioning Rules

JSDL modules SHALL use semantic versioning.

## 27.1 Patch Change

May include:

* documentation corrections;
* non-semantic annotations;
* compatible generator hints;
* error-message clarification.

## 27.2 Minor Change

May include:

* new optional property;
* new entity;
* new relationship;
* new command;
* new event;
* new projection;
* new non-breaking enum value where consumers support unknown values.

## 27.3 Major Change

Includes:

* changing property meaning;
* removing required semantic definition;
* narrowing previously valid values;
* changing lifecycle transition meaning;
* weakening or replacing invariants;
* changing relationship semantics;
* changing command professional effect.

---

# 28. Semantic Compilation Phases

A conforming JSDL compiler SHALL process modules through the following phases.

## Phase 1 — Parsing

Convert YAML or JSON source into a raw syntax tree.

## Phase 2 — Module Resolution

Resolve imports, versions, aliases, and namespaces.

## Phase 3 — Symbol Resolution

Resolve type, entity, relationship, command, event, and validator references.

## Phase 4 — Type Validation

Validate primitive, collection, inheritance, and property types.

## Phase 5 — Semantic Validation

Validate:

* entity identity;
* aggregate boundaries;
* lifecycle completeness;
* command targets;
* event causation;
* authority references;
* projection references;
* validator references;
* invariant expressions.

## Phase 6 — Canonical Intermediate Representation

Produce the normalized JSDL semantic graph.

## Phase 7 — Target Generation

Generate selected implementation artifacts.

## Phase 8 — Generated Artifact Validation

Validate generated schemas, models, APIs, and migration plans.

---

# 29. Canonical Intermediate Representation

The compiler SHALL produce a technology-neutral intermediate representation.

```text
JSDL Source
    ↓
Parsed Syntax Tree
    ↓
Resolved Semantic Graph
    ↓
Canonical Intermediate Representation
    ↓
Target Generators
```

The intermediate representation SHALL contain:

```text
modules
symbols
types
entities
relationships
aggregates
lifecycles
commands
events
invariants
validators
permissions
projections
observability
extensions
sourceLocations
versionMetadata
```

Every generated artifact SHOULD be traceable to its source JSDL location.

---

# 30. Reference JSDL Module

The following example defines a minimal PWU core.

```yaml
jsdl: "0.1"

module:
  name: janumi.work.pwu
  version: 0.1.0
  status: draft
  namespace: https://janumi.example/semantic/work/pwu

imports:
  - module: janumi.foundation
    version: "^0.1.0"
    alias: foundation

  - module: janumi.cpco.core
    version: "^0.1.0"
    alias: cpco

enums:
  PwuLifecycleState:
    values:
      - proposed
      - framing
      - ready
      - active
      - blocked
      - awaiting_evidence
      - awaiting_decision
      - awaiting_review
      - awaiting_external
      - reconciling
      - suspended
      - completed
      - cancelled
      - superseded
      - reopened
      - failed

  PwuCognitiveState:
    values:
      - intent
      - understanding
      - representation
      - reasoning
      - decision
      - action
      - observation
      - reconciliation

  CompletionDisposition:
    values:
      - completed_successfully
      - completed_with_accepted_residual_uncertainty
      - completed_as_inconclusive
      - completed_by_transfer
      - completed_by_supersession

valueObjects:
  ProfessionalObjective:
    properties:
      statement:
        type: Text

      outcomeContributionIds:
        type: Set<Reference<cpco.Outcome>>
        required: false

    invariants:
      - code: OBJECTIVE_NOT_EMPTY
        expression: length(trim(self.statement)) > 0

  PwuScope:
    properties:
      included:
        type: Set<Text>

      excluded:
        type: Set<Text>
        required: false

      boundaryConditions:
        type: Set<Text>
        required: false

  CompletionCondition:
    properties:
      conditionId:
        type: foundation.EntityId

      statement:
        type: Text

      mandatory:
        type: Boolean

      status:
        type: cpco.ValidationResult

entities:
  ProfessionalWorkUnit:
    identity:
      property: pwuId
      type: foundation.EntityId

    annotations:
      janumi.provenance: required
      janumi.versioned: true
      janumi.temporal: true

    properties:
      pwuType:
        type: String

      title:
        type: String

      professionalObjective:
        type: ProfessionalObjective

      endeavorId:
        type: Reference<cpco.ProfessionalEndeavor>

      parentPwuId:
        type: Reference<ProfessionalWorkUnit>
        required: false

      rootPwuId:
        type: Reference<ProfessionalWorkUnit>

      aggregateVersion:
        type: Integer

      lifecycleState:
        type: PwuLifecycleState

      cognitiveState:
        type: PwuCognitiveState

      originatingIntentIds:
        type: Set<Reference<cpco.Intent>>

      scope:
        type: PwuScope

      ownerId:
        type: Reference<cpco.Participant>

      childPwuIds:
        type: Set<Reference<ProfessionalWorkUnit>>
        required: false

      completionConditions:
        type: List<Owned<CompletionCondition>>

      residualUncertaintyIds:
        type: Set<Reference<cpco.Uncertainty>>
        required: false

    lifecycle: PwuLifecycle

    invariants:
      - PWU_INV_001
      - PWU_INV_002
      - PWU_INV_003
      - PWU_INV_007

lifecycles:
  PwuLifecycle:
    initialState: proposed

    states:
      proposed: {}
      framing: {}
      ready: {}
      active: {}
      blocked: {}
      awaiting_evidence: {}
      awaiting_decision: {}
      awaiting_review: {}
      awaiting_external: {}
      reconciling: {}
      suspended: {}
      completed:
        terminal: true
      cancelled:
        terminal: true
      superseded:
        terminal: true
      reopened: {}
      failed:
        terminal: true

    transitions:
      StartFraming:
        from: proposed
        to: framing
        command: StartPwuFraming
        emits:
          - PwuFramingStarted

      DeclareReady:
        from: framing
        to: ready
        command: DeclarePwuReady
        guard: PwuReadyValidator
        emits:
          - PwuDeclaredReady

      Activate:
        from:
          - ready
          - reopened
        to: active
        command: ActivatePWU
        emits:
          - PwuActivated

      Complete:
        from:
          - active
          - awaiting_review
          - reconciling
        to: completed
        command: CompletePWU
        guard: PwuCompletionValidator
        emits:
          - PwuCompleted

      Reopen:
        from:
          - completed
          - cancelled
          - superseded
          - failed
        to: reopened
        command: ReopenPWU
        authority:
          permission: ReopenPwu
        emits:
          - PwuReopened

aggregates:
  ProfessionalWorkUnitAggregate:
    root: ProfessionalWorkUnit

    owned:
      - CompletionCondition

    referenced:
      - cpco.Intent
      - cpco.Outcome
      - cpco.Uncertainty
      - cpco.Participant

    concurrency:
      strategy: optimistic
      versionProperty: aggregateVersion

    commands:
      - StartPwuFraming
      - DeclarePwuReady
      - ActivatePWU
      - CompletePWU
      - ReopenPWU

invariants:
  PWU_INV_001:
    scope: ProfessionalWorkUnit
    severity: error
    description: A PWU shall possess one active professional objective.
    expression: self.professionalObjective != null

  PWU_INV_002:
    scope: ProfessionalWorkUnit
    severity: error
    description: A non-exploratory PWU shall trace to an active Intent.
    expression: size(self.originatingIntentIds) >= 1

  PWU_INV_003:
    scope: ProfessionalWorkUnit
    severity: error
    description: Lifecycle and cognitive state shall be explicit.
    expression: >
      self.lifecycleState != null
      and self.cognitiveState != null

  PWU_INV_007:
    scope: ProfessionalWorkUnit
    severity: error
    description: Completion conditions shall exist before activation.
    expression: >
      self.lifecycleState in [proposed, framing]
      or size(self.completionConditions) >= 1

validators:
  PwuReadyValidator:
    type: composite
    checks:
      - invariant: PWU_INV_001
      - invariant: PWU_INV_002
      - invariant: PWU_INV_003
      - invariant: PWU_INV_007

  PwuCompletionValidator:
    type: composite
    checks:
      - validator: MandatoryCompletionConditionsValidator
      - validator: MandatoryValidationStatusValidator
      - validator: BlockingDependencyValidator
      - validator: RecompositionValidator
      - validator: ResidualUncertaintyAcceptanceValidator

permissions:
  CompletePwu:
    appliesTo: CompletePWU
    allowedRoles:
      - owner
      - approver

  ReopenPwu:
    appliesTo: ReopenPWU
    allowedRoles:
      - owner
      - approver
      - coordinator

commands:
  CompletePWU:
    targetAggregate: ProfessionalWorkUnitAggregate

    payload:
      completionDisposition:
        type: CompletionDisposition

      completionRationale:
        type: Text

      acceptedResidualUncertaintyIds:
        type: Set<Reference<cpco.Uncertainty>>
        required: false

    authority:
      permission: CompletePwu

    preconditions:
      - validator: PwuCompletionValidator

    emits:
      - PwuCompleted

    failures:
      - MANDATORY_VALIDATION_FAILED
      - BLOCKING_DEPENDENCY_UNRESOLVED
      - RECOMPOSITION_REQUIRED
      - RESIDUAL_UNCERTAINTY_NOT_ACCEPTED
      - STALE_AGGREGATE_VERSION

events:
  PwuCompleted:
    aggregate: ProfessionalWorkUnitAggregate

    payload:
      pwuId:
        type: Reference<ProfessionalWorkUnit>

      completionDisposition:
        type: CompletionDisposition

      completedBy:
        type: Reference<cpco.Participant>

      completedAt:
        type: Timestamp

      residualUncertaintyIds:
        type: Set<Reference<cpco.Uncertainty>>
        required: false

    observability:
      category: professional_state_transition
      severity: informational
```

---

# 31. Compiler Diagnostics

Compiler errors SHALL include:

```text
diagnosticCode
severity
message
sourceFile
sourceLine
sourceColumn
semanticPath
relatedLocations
suggestedCorrection
```

Example:

```text
JSDL-E142
Entity ProfessionalWorkUnit references lifecycle PwuLifecycle,
but lifecycle state property lifecycleState is missing.
```

## 31.1 Diagnostic Categories

```text
syntax
module_resolution
symbol_resolution
type
semantic
lifecycle
aggregate
command
event
invariant
projection
permission
versioning
extension
```

---

# 32. Source Mapping

Generated artifacts SHOULD contain source-map metadata.

Example generated TypeScript:

```typescript
/**
 * Generated from:
 * janumi.work.pwu@0.1.0
 * entities.ProfessionalWorkUnit
 * source: pwu.jsdl.yaml:84
 */
export interface ProfessionalWorkUnit {
  // ...
}
```

Manual edits to generated files SHOULD be prohibited or overwritten.

---

# 33. Initial Compiler Architecture

The reference JSDL compiler SHOULD contain:

```text
jsdl-cli
jsdl-parser
jsdl-module-resolver
jsdl-symbol-table
jsdl-type-checker
jsdl-semantic-validator
jsdl-ir
jsdl-generator-typescript
jsdl-generator-json-schema
jsdl-generator-openapi
jsdl-generator-postgresql
jsdl-generator-docs
jsdl-testkit
```

## 33.1 Reference Implementation Language

TypeScript is recommended for the initial compiler because:

* the existing UI stack uses TypeScript-compatible tooling;
* YAML and JSON Schema ecosystems are mature;
* generated frontend types are a near-term priority;
* compiler implementation can run in Node.js or Bun;
* shared validation libraries can support frontend and backend development.

This is an implementation recommendation, not a semantic requirement.

---

# 34. Initial Generator Outputs

The first compiler milestone SHALL generate:

## 34.1 TypeScript

* interfaces;
* discriminated unions;
* enums;
* command payloads;
* event payloads;
* validator result types;
* projection metadata types.

## 34.2 JSON Schema

* entity payload schemas;
* value-object schemas;
* command schemas;
* event schemas;
* validation-result schemas.

## 34.3 Documentation

* entity catalog;
* relationship catalog;
* lifecycle diagrams;
* command reference;
* invariant reference;
* module dependency graph.

## 34.4 Test Fixtures

* valid examples;
* invalid examples;
* lifecycle-transition fixtures;
* command-failure fixtures;
* compatibility fixtures.

PostgreSQL and OpenAPI generation SHOULD follow after the semantic model and first generators stabilize.

---

# 35. Compiler Conformance Requirements

A conforming JSDL compiler SHALL:

1. Parse canonical YAML JSDL.
2. Resolve modules and version constraints.
3. Resolve semantic symbols.
4. Validate type references.
5. validate entity identity.
6. Validate lifecycle definitions.
7. Validate command targets and event emissions.
8. Validate aggregate ownership.
9. Validate invariant expressions.
10. Validate permission references.
11. Validate projection entity and relationship paths.
12. Produce a canonical intermediate representation.
13. Generate deterministic output.
14. Preserve source mappings.
15. produce structured diagnostics.
16. reject ambiguous semantics.
17. support reproducible builds.
18. expose compiler and model versions.
19. prevent target generators from changing semantic meaning.
20. support golden-file conformance tests.

---

# 36. Initial Repository Layout

```text
janumi-semantics/
├── jsdl/
│   ├── foundation/
│   │   └── foundation.jsdl.yaml
│   ├── cpco/
│   │   └── cpco-core.jsdl.yaml
│   ├── work/
│   │   └── pwu.jsdl.yaml
│   ├── coordination/
│   │   └── rph.jsdl.yaml
│   ├── projection/
│   │   └── projection-core.jsdl.yaml
│   └── pwa/
│       └── janumicode.jsdl.yaml
│
├── compiler/
│   ├── cli/
│   ├── parser/
│   ├── semantic/
│   ├── ir/
│   ├── generators/
│   └── testkit/
│
├── generated/
│   ├── typescript/
│   ├── json-schema/
│   ├── openapi/
│   ├── sql/
│   └── docs/
│
├── tests/
│   ├── valid/
│   ├── invalid/
│   ├── compatibility/
│   └── golden/
│
└── jsdl.config.yaml
```

---

# 37. Build Configuration

```yaml
jsdl:
  compilerVersion: 0.1.0

sources:
  - jsdl/**/*.jsdl.yaml

outputs:
  typescript:
    enabled: true
    directory: generated/typescript

  jsonSchema:
    enabled: true
    directory: generated/json-schema

  documentation:
    enabled: true
    directory: generated/docs

validation:
  failOnWarnings: false
  requireSourceMappings: true
  requireDeterministicOutput: true
```

---

# 38. Initial CLI

```text
jsdl validate
jsdl compile
jsdl generate typescript
jsdl generate json-schema
jsdl generate docs
jsdl inspect module janumi.work.pwu
jsdl inspect entity ProfessionalWorkUnit
jsdl diff model-v1 model-v2
jsdl test
```

## 38.1 Validate

Parses and semantically validates all configured sources.

## 38.2 Compile

Produces the canonical intermediate representation.

## 38.3 Generate

Runs one or more target generators.

## 38.4 Inspect

Presents normalized semantic information.

## 38.5 Diff

Classifies changes as:

```text
patch-compatible
minor-compatible
potentially-breaking
breaking
```

## 38.6 Test

Executes JSDL conformance and fixture tests.

---

# 39. Security Model

JSDL source SHALL be treated as trusted build input only after review.

The compiler SHALL:

* avoid arbitrary code execution;
* prohibit unrestricted expression evaluation;
* prohibit network access during deterministic compilation unless explicitly enabled;
* validate import integrity;
* support module checksums;
* record dependency versions;
* avoid embedding secrets in generated artifacts.

External validators are runtime integration contracts, not compiler-executed arbitrary code.

---

# 40. Acceptance Criteria for JSDL Core v0.1

JSDL Core v0.1 is acceptable when:

* the reference PWU module parses successfully;
* invalid lifecycle transitions are rejected;
* unresolved entity references are rejected;
* aggregate ownership conflicts are rejected;
* invalid command targets are rejected;
* event payloads are type checked;
* invariant expressions are validated;
* generated TypeScript compiles;
* generated JSON Schemas validate reference instances;
* output is deterministic;
* diagnostics include source locations;
* a model diff identifies breaking changes;
* golden tests pass in continuous integration.

---

# 41. Implementation Sequence

The reference implementation SHALL proceed in the following order.

## Step 1 — Bootstrap Schema

Define a JSON Schema for JSDL source documents sufficient to validate basic structure.

This bootstrap schema does not replace semantic compilation.

## Step 2 — Parser

Parse YAML into typed raw syntax nodes while preserving source locations.

## Step 3 — Symbol Table

Register module and local symbols.

## Step 4 — Resolver

Resolve imports, aliases, type references, and semantic paths.

## Step 5 — Type Checker

Validate primitive, collection, inheritance, and property types.

## Step 6 — Semantic Validator

Validate entities, relationships, aggregates, lifecycles, commands, events, invariants, permissions, and projections.

## Step 7 — Intermediate Representation

Normalize the model into a stable semantic graph.

## Step 8 — TypeScript Generator

Generate first-class domain and contract types.

## Step 9 — JSON Schema Generator

Generate runtime validation schemas.

## Step 10 — Documentation Generator

Generate human-readable reference documentation from the same source.

## Step 11 — Model Diff

Detect semantic compatibility changes.

## Step 12 — Additional Generators

Add OpenAPI, PostgreSQL, event registry, and frontend metadata generation after the core semantics stabilize.

---

# 42. Coding Agent Instruction

A coding agent implementing JSDL SHALL be instructed:

> Implement JSDL as a deterministic semantic compiler, not as a YAML-to-code template engine. Preserve the distinctions among ontology, aggregate boundaries, lifecycle state, professional commands, immutable events, invariants, validators, permissions, projections, and presentation metadata. Reject ambiguous or unresolved semantics. Every generated artifact must remain traceable to canonical JSDL source and must not introduce professional meaning absent from that source.

---

# 43. Resulting Platform Architecture

With JSDL in place, Janumi gains a controlled semantic generation pipeline:

```text
Foundational Doctrine
        ↓
CPCO and Architectural Specifications
        ↓
JSDL Canonical Source
        ↓
Semantic Compiler
        ↓
Canonical Intermediate Representation
        ↓
Generated Contracts and Models
        ↓
Janumi Runtime and Workbench
```

The resulting architecture prevents the frontend, backend, agents, APIs, events, validators, and documentation from developing incompatible definitions of professional work.

JSDL therefore serves as the executable bridge between the Janumi discipline and the Janumi Platform.

---

# 44. Next Required Artifact

The next required output is the **JSDL Compiler Architecture and Bootstrap Implementation Specification**.

It shall define:

* parser structures;
* abstract and resolved syntax trees;
* source-location handling;
* symbol tables;
* module resolution;
* semantic graph construction;
* invariant expression parsing;
* compiler diagnostics;
* generator interfaces;
* deterministic compilation;
* testing strategy;
* initial TypeScript package boundaries;
* concrete implementation backlog for the coding agent.
