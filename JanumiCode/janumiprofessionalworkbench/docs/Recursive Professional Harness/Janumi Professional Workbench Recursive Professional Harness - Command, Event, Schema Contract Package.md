# Janumi Professional Workbench Recursive Professional Harness

## Command, Event, and Schema Contract Package

**Document ID:** `RPH-DOC-007`
**Status:** Initial implementation baseline
**Contract version:** `0.1.0`
**Applies to:** Product Realization PWA intent-to-architecture vertical slice
**Primary consumers:** VS Code extension, RPH runtime, assurance service, projection builders, persistence layer, migration adapters, and test harness

## Canonical vocabulary context

This package serializes runtime activity for a concrete Undertaking. The selected Product Realization PWA and version define the applicable PWU Types; the runtime records are PWU Instances in the Undertaking's Professional Work Graph. Execution Plans and Execution Workflows perform those instances but are not the PWA or the Professional Work Graph.

PWA authoring and PWU Type publication contracts are outside this initial package. Their absence from the first vertical slice must not be interpreted as permission to treat an Undertaking-local runtime hierarchy as the reusable PWA definition.

---

# 1. Purpose

This specification converts the Recursive Professional Harness domain model into versioned machine contracts.

It defines:

* package structure;
* identifier conventions;
* common schema definitions;
* command envelopes;
* domain-event envelopes;
* canonical aggregate payloads;
* validator result contracts;
* policy expression contracts;
* projection contracts;
* compatibility rules;
* schema evolution rules;
* validation boundaries;
* error contracts;
* fixture and replay requirements.

The initial package supports this vertical slice:

```text
Selected Product Realization PWA version
→ Field Service Management SaaS Undertaking
→ Raw user intent
→ Intent Discovery PWU Instance
→ approved Intent Baseline
→ Architecture Definition PWU Instance
→ Architecture Execution Plan
→ Architecture Artifact
→ Assumption Disclosure
→ Architecture Coverage Assurance
→ Human Architecture Decision
→ Architecture Baseline
```

This package is not the complete RPH schema library. It is the minimum coherent contract set required to implement and validate the first production slice.

---

# 2. Contract Design Principles

## 2.1 Commands request; events assert

A command expresses a requested mutation.

An event records that the domain accepted a mutation.

```text
Command:
Approve this intent.

Event:
IntentApproved.
```

Commands may fail.

Persisted domain events represent accepted state changes and must not be rewritten.

## 2.2 Schemas describe boundaries, not internal classes

The JSON Schemas define:

* service boundaries;
* persisted event payloads;
* extension-to-runtime messages;
* validator results;
* fixtures;
* read projections.

Internal implementation classes may differ, provided they preserve the contract.

## 2.3 Semantic state is explicit

Schemas must not infer semantic state from:

* missing properties;
* null values;
* empty arrays;
* current legacy compatibility phase label;
* event ordering alone;
* UI state.

Status fields are required where semantic state matters.

## 2.4 Unknown and absent are different

Use explicit representations:

```json
{
  "status": "UNKNOWN"
}
```

rather than:

```json
{}
```

An omitted optional field means the field is not part of that message.

It does not automatically mean unknown, false, empty, or inapplicable.

## 2.5 External inputs are untrusted

All inbound data must be:

1. parsed;
2. structurally validated;
3. normalized;
4. semantically validated;
5. authorized;
6. converted into internal domain values.

This applies to:

* user input;
* model output;
* validator output;
* database migration data;
* tool output;
* imported templates;
* external API responses.

## 2.6 Every mutation is attributable

Commands and events must identify:

* actor;
* correlation;
* causation;
* aggregate;
* expected or resulting revision;
* timestamp;
* schema version.

## 2.7 Presentation is non-semantic

Canvas layout and view-state contracts must remain separate from semantic object contracts.

Moving a node cannot alter a PWU semantic version.

---

# 3. Package Layout

Recommended repository structure:

```text
packages/
└── rph-contracts/
    ├── package.json
    ├── tsconfig.json
    ├── README.md
    ├── src/
    │   ├── generated/
    │   │   └── types.ts
    │   ├── ids.ts
    │   ├── enums.ts
    │   ├── validation.ts
    │   └── index.ts
    ├── schemas/
    │   ├── common/
    │   │   ├── actor-reference.schema.json
    │   │   ├── authority-reference.schema.json
    │   │   ├── object-envelope.schema.json
    │   │   ├── provenance-record.schema.json
    │   │   ├── artifact-reference.schema.json
    │   │   ├── pwa-version-reference.schema.json
    │   │   ├── pwu-type-reference.schema.json
    │   │   ├── undertaking-reference.schema.json
    │   │   ├── schema-reference.schema.json
    │   │   ├── error.schema.json
    │   │   └── extension-payload.schema.json
    │   ├── objects/
    │   │   ├── intent.schema.json
    │   │   ├── professional-work-unit-instance.schema.json
    │   │   ├── constraint.schema.json
    │   │   ├── assumption.schema.json
    │   │   ├── claim.schema.json
    │   │   ├── evidence.schema.json
    │   │   ├── assurance-policy.schema.json
    │   │   ├── assurance-assessment.schema.json
    │   │   ├── assurance-observation.schema.json
    │   │   ├── execution-plan.schema.json
    │   │   ├── runtime-binding.schema.json
    │   │   ├── decision.schema.json
    │   │   ├── baseline.schema.json
    │   │   └── trace-link.schema.json
    │   ├── commands/
    │   │   ├── command-envelope.schema.json
    │   │   ├── capture-intent.command.schema.json
    │   │   ├── formalize-intent.command.schema.json
    │   │   ├── approve-intent.command.schema.json
    │   │   ├── propose-pwu.command.schema.json
    │   │   ├── mark-pwu-ready.command.schema.json
    │   │   ├── propose-execution-plan.command.schema.json
    │   │   ├── activate-execution-plan.command.schema.json
    │   │   ├── complete-execution-step.command.schema.json
    │   │   ├── request-assurance-assessment.command.schema.json
    │   │   ├── record-assurance-observation.command.schema.json
    │   │   ├── complete-assurance-assessment.command.schema.json
    │   │   ├── approve-decision.command.schema.json
    │   │   └── promote-baseline.command.schema.json
    │   ├── events/
    │   │   ├── domain-event-envelope.schema.json
    │   │   ├── intent-captured.event.schema.json
    │   │   ├── intent-formalized.event.schema.json
    │   │   ├── intent-approved.event.schema.json
    │   │   ├── pwu-proposed.event.schema.json
    │   │   ├── pwu-state-changed.event.schema.json
    │   │   ├── execution-plan-activated.event.schema.json
    │   │   ├── execution-step-succeeded.event.schema.json
    │   │   ├── assumption-detected.event.schema.json
    │   │   ├── evidence-admitted.event.schema.json
    │   │   ├── assurance-observation-recorded.event.schema.json
    │   │   ├── assurance-assessment-completed.event.schema.json
    │   │   ├── decision-effective.event.schema.json
    │   │   └── baseline-promoted.event.schema.json
    │   ├── validators/
    │   │   ├── validator-contract.schema.json
    │   │   ├── validator-result.schema.json
    │   │   ├── criterion-result.schema.json
    │   │   └── control-action-recommendation.schema.json
    │   ├── policies/
    │   │   ├── applicability-expression.schema.json
    │   │   ├── assurance-policy-definition.schema.json
    │   │   ├── evidence-requirement.schema.json
    │   │   └── disposition-rule.schema.json
    │   └── projections/
    │       ├── work-view.schema.json
    │       ├── execution-view.schema.json
    │       ├── assurance-view.schema.json
    │       ├── traceability-view.schema.json
    │       └── compatibility-milestone.schema.json
    ├── fixtures/
    │   └── field-service-management/
    ├── examples/
    └── tests/
        ├── schema-conformance/
        ├── compatibility/
        └── fixtures/
```

---

# 4. Schema Standard

Use:

```text
JSON Schema Draft 2020-12
```

Every schema must declare:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:janumi:rph:schema:<category>:<name>:<version>",
  "title": "...",
  "type": "object",
  "additionalProperties": false
}
```

## 4.1 Additional properties

Use:

```json
"additionalProperties": false
```

for canonical command, event, object, and validator contracts.

Extensibility must occur through a declared `extensions` array, not arbitrary properties.

## 4.2 Required fields

Require fields when their absence would cause semantic ambiguity.

Do not require fields merely because they are convenient for one implementation.

## 4.3 Nullability

Avoid nullable fields unless null has a specific domain meaning.

Prefer:

```json
{
  "formalizedObjectiveStatus": "NOT_CREATED"
}
```

over:

```json
{
  "formalizedObjective": null
}
```

Where a value is genuinely optional, omit it rather than sending null.

## 4.4 Date and time

Use RFC 3339 UTC timestamps:

```text
2026-07-10T19:22:31.482Z
```

## 4.5 Enumerations

Enumerations are uppercase snake case:

```text
UNDER_ASSURANCE
CONDITIONALLY_SATISFIED
DIFFERENT_MODEL
```

## 4.6 Version fields

Use:

```json
{
  "contractVersion": "0.1.0",
  "schemaVersion": 1,
  "semanticVersion": 3,
  "revision": 17
}
```

These values have different meanings.

* `contractVersion`: package release.
* `schemaVersion`: serialized payload shape.
* `semanticVersion`: domain meaning revision.
* `revision`: aggregate concurrency revision.

---

# 5. Identifier Contract

## 5.1 Identifier type

```typescript
type RphId = string;
```

Format:

```text
<prefix>_<ULID>
```

Examples:

```text
int_01JZ...
pwa_01JZ...
pwut_01JZ...
und_01JZ...
pwu_01JZ...
asm_01JZ...
clm_01JZ...
evd_01JZ...
assess_01JZ...
dec_01JZ...
base_01JZ...
evt_01JZ...
cmd_01JZ...
```

## 5.2 Prefix registry

| Object                             | Prefix    |
| ---------------------------------- | --------- |
| Professional Work Architecture version | `pwa`     |
| PWU Type                           | `pwut`    |
| Undertaking                        | `und`     |
| Intent                             | `int`     |
| PWU Instance                       | `pwu`     |
| Constraint                         | `con`     |
| Assumption                         | `asm`     |
| Claim                              | `clm`     |
| Evidence                           | `evd`     |
| Assurance Policy                   | `pol`     |
| Assurance Assessment               | `assess`  |
| Assurance Observation              | `obs`     |
| Execution Plan                     | `plan`    |
| Execution Step                     | `step`    |
| Runtime Binding                    | `bind`    |
| Decision                           | `dec`     |
| Baseline                           | `base`    |
| Trace Link                         | `trace`   |
| Command                            | `cmd`     |
| Event                              | `evt`     |
| Execution Attempt                  | `attempt` |

IDs are opaque and immutable.

---

# 6. Common Actor Contract

```typescript
interface ActorReference {
  actorId: string;
  actorType:
    | 'HUMAN'
    | 'AGENT'
    | 'MODEL'
    | 'SERVICE'
    | 'POLICY_ENGINE'
    | 'EXTERNAL_SYSTEM';

  displayName: string;

  roleId?: string;
  modelId?: string;
  providerId?: string;
  executionInstanceId?: string;
}
```

JSON Schema fragment:

```json
{
  "$id": "urn:janumi:rph:schema:common:actor-reference:1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "actorId",
    "actorType",
    "displayName"
  ],
  "properties": {
    "actorId": {
      "type": "string",
      "minLength": 1
    },
    "actorType": {
      "enum": [
        "HUMAN",
        "AGENT",
        "MODEL",
        "SERVICE",
        "POLICY_ENGINE",
        "EXTERNAL_SYSTEM"
      ]
    },
    "displayName": {
      "type": "string",
      "minLength": 1
    },
    "roleId": {
      "type": "string"
    },
    "modelId": {
      "type": "string"
    },
    "providerId": {
      "type": "string"
    },
    "executionInstanceId": {
      "type": "string"
    }
  }
}
```

---

# 7. Common Object Envelope

```typescript
interface ObjectEnvelope {
  id: RphId;
  objectType: ProfessionalWorkObjectType;

  schemaVersion: number;
  semanticVersion: number;
  revision: number;

  lifecycleStatus: string;

  createdAt: string;
  createdBy: ActorReference;

  updatedAt: string;
  updatedBy: ActorReference;

  provenance: ProvenanceRecord;

  ontologyId?: string;
  ontologyVersion?: string;

  tags: string[];
  extensions: ExtensionPayload[];
}
```

## 7.1 Provenance contract

```typescript
interface ProvenanceRecord {
  originType:
    | 'USER_INPUT'
    | 'MODEL_GENERATION'
    | 'TOOL_OUTPUT'
    | 'HUMAN_DECISION'
    | 'MIGRATION'
    | 'DERIVED'
    | 'IMPORTED';

  sourceObjectIds: string[];
  sourceEventIds: string[];

  producingExecutionAttemptId?: string;
  producingValidatorId?: string;

  contentHash?: string;
}
```

## 7.2 Canonical ownership references

```typescript
interface PwaVersionReference {
  pwaId: string;
  pwaVersion: string;
}

interface PwuTypeReference extends PwaVersionReference {
  pwuTypeId: string;
}

interface UndertakingReference extends PwaVersionReference {
  undertakingId: string;
}
```

These references carry canonical ownership identity. An ontology identifier may describe a domain extension, but it does not replace the selected PWA version, Undertaking, or PWU Type.

---

# 8. Command Envelope

```typescript
interface DomainCommand<TPayload> {
  commandId: string;
  commandType: string;
  commandSchemaVersion: number;

  targetAggregateType: string;
  targetAggregateId: string;

  expectedRevision?: number;

  issuedAt: string;
  issuedBy: ActorReference;

  correlationId: string;
  causationId?: string;

  idempotencyKey: string;

  payload: TPayload;
}
```

## 8.1 Command requirements

* `commandId` is globally unique.
* `idempotencyKey` prevents repeated business effects.
* `expectedRevision` is mandatory for updates to existing aggregates.
* `correlationId` groups one professional operation across services.
* `causationId` identifies the command or event that caused this command.

## 8.2 Command rejection

A command rejection does not produce a domain state-change event.

It produces a command result:

```typescript
interface CommandResult {
  commandId: string;

  status:
    | 'ACCEPTED'
    | 'REJECTED'
    | 'CONFLICT'
    | 'DUPLICATE'
    | 'UNAUTHORIZED'
    | 'VALIDATION_FAILED';

  producedEventIds: string[];

  error?: RphError;
}
```

---

# 9. Domain Event Envelope

```typescript
interface DomainEvent<TPayload> {
  eventId: string;
  eventType: string;
  eventSchemaVersion: number;

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
}
```

## 9.1 Event rules

* Events are immutable.
* Aggregate revision increases monotonically.
* The event type uses past tense.
* Payload contains the accepted facts, not the original request.
* Events do not contain presentation state.
* Sensitive raw prompts or secrets must not be embedded unless explicitly required and protected.

---

# 10. Intent Contract

## 10.1 Intent object

```typescript
interface IntentObject extends ObjectEnvelope {
  objectType: 'INTENT';

  undertakingId: string;

  originatingExpression: string;
  formalizedObjective?: string;

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

## 10.2 Capture intent command

```typescript
interface CaptureIntentPayload {
  intentId: string;
  undertakingId: string;
  originatingExpression: string;
  ontologyId: string;
  ontologyVersion: string;
}
```

Command type:

```text
CaptureIntent
```

## 10.3 Intent captured event

```typescript
interface IntentCapturedPayload {
  intentId: string;
  undertakingId: string;
  originatingExpression: string;
  intentStatus: 'RAW';
  ontologyId: string;
  ontologyVersion: string;
}
```

Event type:

```text
IntentCaptured
```

## 10.4 Formalize intent command

```typescript
interface FormalizeIntentPayload {
  formalizedObjective: string;
  desiredOutcomes: DesiredOutcome[];
  successConditions: SuccessCondition[];
  nonGoals: string[];
  ambiguityIds: string[];
  constraintIds: string[];
  stakeholderIds: string[];
}
```

## 10.5 Intent formalized event

```typescript
interface IntentFormalizedPayload {
  priorSemanticVersion: number;
  newSemanticVersion: number;

  formalizedObjective: string;
  desiredOutcomes: DesiredOutcome[];
  successConditions: SuccessCondition[];
  nonGoals: string[];

  intentStatus: 'FORMALIZED';
}
```

## 10.6 Approve intent command

```typescript
interface ApproveIntentPayload {
  decisionId: string;
  approvedSemanticVersion: number;
  approvalScope: string;
}
```

## 10.7 Intent approved event

```typescript
interface IntentApprovedPayload {
  decisionId: string;
  approvedSemanticVersion: number;
  intentStatus: 'APPROVED';
}
```

---

# 11. PWU Instance Contract

## 11.1 PWU Instance object

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

  boundaries: {
    inScope: string[];
    outOfScope: string[];
    permittedChanges: string[];
    prohibitedChanges: string[];
  };

  obligationIds: string[];
  constraintIds: string[];
  assumptionIds: string[];
  dependencyIds: string[];

  inputRequirements: ArtifactRequirement[];
  expectedOutputs: OutputDefinition[];

  evidenceRequirementIds: string[];
  verificationCriterionIds: string[];

  activeExecutionPlanId?: string;
  assurancePolicyIds: string[];

  workLifecycleState: WorkLifecycleState;
  executionState: ExecutionState;
  assuranceState: AssuranceState;
  shapeIntegrityState: ShapeIntegrityState;

  riskProfile: WorkRiskProfile;
}
```

## 11.2 Propose PWU command

```typescript
interface ProposePwuPayload {
  pwuId: string;
  undertakingId: string;
  pwuTypeId?: string;
  isLocalExtension: boolean;

  pwuKind: string;
  title: string;
  description: string;

  intentId: string;
  parentWorkUnitId?: string;

  boundaries: WorkBoundary;
  obligationIds: string[];
  constraintIds: string[];
  assumptionIds: string[];

  expectedOutputs: OutputDefinition[];
  assurancePolicyIds: string[];

  riskProfile: WorkRiskProfile;
}
```

## 11.3 PWU proposed event

```typescript
interface PwuProposedPayload {
  pwuId: string;
  undertakingId: string;
  pwuTypeId?: string;
  isLocalExtension: boolean;

  pwuKind: string;
  title: string;

  intentId: string;
  parentWorkUnitId?: string;

  workLifecycleState: 'PROPOSED';
  executionState: 'NOT_PLANNED';
  assuranceState: 'UNASSESSED';
  shapeIntegrityState: 'UNKNOWN';
}
```

The command and event boundary must enforce:

* the Undertaking exists and is bound to an immutable PWA version;
* a non-local PWU Instance references a PWU Type in that same PWA version;
* an Undertaking-local PWU Instance has no published `pwuTypeId`;
* `pwuKind` does not substitute for either `undertakingId` or `pwuTypeId`.

## 11.4 Mark PWU ready command

```typescript
interface MarkPwuReadyPayload {
  shapeReadinessAssessmentId: string;
  expectedSemanticVersion: number;
}
```

## 11.5 PWU state changed event

```typescript
interface PwuStateChangedPayload {
  previousState: WorkLifecycleState;
  newState: WorkLifecycleState;

  executionState: ExecutionState;
  assuranceState: AssuranceState;
  shapeIntegrityState: ShapeIntegrityState;

  reasonCode: string;
  supportingObjectIds: string[];
}
```

---

# 12. Assumption Contract

## 12.1 Assumption object

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

## 12.2 Assumption detected event

```typescript
interface AssumptionDetectedPayload {
  assumptionId: string;
  statement: string;
  basis?: string;

  introducedBy: ActorReference;
  affectedObjectIds: string[];

  materiality: 'IMMATERIAL' | 'MATERIAL' | 'CRITICAL';
  status: 'DISCLOSED';

  sourceArtifactId?: string;
  sourceExecutionAttemptId?: string;
}
```

## 12.3 Assumption falsified event

```typescript
interface AssumptionFalsifiedPayload {
  assumptionId: string;
  priorStatus: string;
  newStatus: 'FALSIFIED';

  contradictingEvidenceIds: string[];
  affectedObjectIds: string[];

  impactAnalysisRequired: true;
}
```

---

# 13. Claim Contract

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

## 13.1 Claim asserted event

```typescript
interface ClaimAssertedPayload {
  claimId: string;
  statement: string;
  claimType: ClaimType;

  subjectObjectIds: string[];
  assertedBy: ActorReference;

  status: 'OPEN';
}
```

---

# 14. Evidence Contract

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

## 14.1 Propose evidence command

```typescript
interface ProposeEvidencePayload {
  evidenceId: string;
  evidenceType: EvidenceType;
  contentReference: ArtifactReference;

  producedBy: ActorReference;

  supportsClaimIds: string[];
  contradictsClaimIds: string[];

  scope: string;
  limitations: string[];
  capturedAt: string;
}
```

## 14.2 Admit evidence command

```typescript
interface AdmitEvidencePayload {
  admissibilityAssessmentId: string;
  admittedScope: string;
  admittedClaimIds: string[];
}
```

## 14.3 Evidence admitted event

```typescript
interface EvidenceAdmittedPayload {
  evidenceId: string;
  status: 'ADMISSIBLE';

  admissibilityAssessmentId: string;
  admittedScope: string;
  admittedClaimIds: string[];
}
```

---

# 15. Execution Plan Contract

```typescript
interface ExecutionPlan extends ObjectEnvelope {
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
    | 'UNDER_REVIEW'
    | 'APPROVED'
    | 'ACTIVE'
    | 'COMPLETED'
    | 'FAILED'
    | 'SUPERSEDED'
    | 'CANCELLED';
}
```

## 15.1 Propose execution plan command

```typescript
interface ProposeExecutionPlanPayload {
  executionPlanId: string;
  workUnitId: string;

  steps: ExecutionStep[];
  transitions: ExecutionTransition[];

  retryPolicy: RetryPolicy;
  tacticalChangePolicy: TacticalChangePolicy;
  escalationPolicy: EscalationPolicy;
  terminationPolicy: TerminationPolicy;
}
```

## 15.2 Activate execution plan command

```typescript
interface ActivateExecutionPlanPayload {
  approvalDecisionId?: string;
  authorizedRuntimeBindingIds: string[];
}
```

## 15.3 Execution plan activated event

```typescript
interface ExecutionPlanActivatedPayload {
  executionPlanId: string;
  workUnitId: string;

  planVersion: number;
  status: 'ACTIVE';

  authorizedRuntimeBindingIds: string[];
}
```

---

# 16. Execution Step Result Contract

## 16.1 Complete execution step command

```typescript
interface CompleteExecutionStepPayload {
  executionStepId: string;
  executionAttemptId: string;

  resultStatus: 'SUCCEEDED';

  outputArtifactIds: string[];
  proposedEvidenceIds: string[];
  detectedAssumptionIds: string[];

  structuredResult: unknown;

  executionProvenance: ExecutionProvenance;
}
```

## 16.2 Execution step succeeded event

```typescript
interface ExecutionStepSucceededPayload {
  executionStepId: string;
  executionAttemptId: string;

  outputArtifactIds: string[];
  proposedEvidenceIds: string[];
  detectedAssumptionIds: string[];

  resultingExecutionState: 'SUCCEEDED';
}
```

Execution-step success does not alter assurance state to `SATISFIED`.

---

# 17. Assurance Policy Definition Contract

```typescript
interface AssurancePolicyDefinition {
  id: string;
  version: string;
  semanticVersion: number;

  name: string;
  purpose: string;
  rationale: string;

  applicableObjectTypes: ProfessionalWorkObjectType[];
  applicability: ApplicabilityExpression;

  evaluatedClaimTypes: ClaimType[];
  defaultClaimTemplates: ClaimTemplate[];

  requiredEvidence: EvidenceRequirement[];
  optionalEvidence: EvidenceRequirement[];

  criteria: AssessmentCriterion[];

  evaluatorRole: string;
  independenceRequirement: IndependenceRequirement;

  findingDefinitions: FindingDefinition[];
  dispositionRules: DispositionRule[];

  permittedControlActions: ControlAction[];
  remediationRules: RemediationRule[];
  escalationRules: EscalationRule[];
  waiverRules: WaiverRule[];

  status:
    | 'DRAFT'
    | 'ACTIVE'
    | 'SUSPENDED'
    | 'SUPERSEDED';
}
```

---

# 18. Applicability Expression Contract

Do not allow arbitrary JavaScript or SQL expressions.

Use a declarative expression language.

```typescript
type ApplicabilityExpression =
  | {
      op: 'ALL';
      operands: ApplicabilityExpression[];
    }
  | {
      op: 'ANY';
      operands: ApplicabilityExpression[];
    }
  | {
      op: 'NOT';
      operand: ApplicabilityExpression;
    }
  | {
      op: 'EQUALS';
      path: string;
      value: string | number | boolean;
    }
  | {
      op: 'IN';
      path: string;
      values: Array<string | number>;
    }
  | {
      op: 'CONTAINS';
      path: string;
      value: string;
    }
  | {
      op: 'EXISTS';
      path: string;
    }
  | {
      op: 'RISK_AT_LEAST';
      dimension:
        | 'CONSEQUENCE'
        | 'UNCERTAINTY'
        | 'IRREVERSIBILITY'
        | 'SECURITY_SENSITIVITY'
        | 'REGULATORY_EXPOSURE';
      level:
        | 'LOW'
        | 'MEDIUM'
        | 'HIGH'
        | 'CRITICAL';
    };
```

Example:

```json
{
  "op": "ALL",
  "operands": [
    {
      "op": "EQUALS",
      "path": "$.objectType",
      "value": "PROFESSIONAL_WORK_UNIT"
    },
    {
      "op": "EQUALS",
      "path": "$.pwuKind",
      "value": "ARCHITECTURE_DEFINITION"
    },
    {
      "op": "IN",
      "path": "$.workLifecycleState",
      "values": [
        "EVIDENCE_PENDING",
        "UNDER_ASSURANCE"
      ]
    }
  ]
}
```

---

# 19. Assurance Assessment Contract

```typescript
interface AssuranceAssessment extends ObjectEnvelope {
  objectType: 'ASSURANCE_ASSESSMENT';

  assurancePolicyId: string;
  policyVersion: string;
  policySemanticVersion: number;

  subjectObjectIds: string[];
  subjectSemanticVersions: Record<string, number>;

  claimIds: string[];

  evaluator?: ActorReference;

  evidenceConsideredIds: string[];
  rejectedEvidence: RejectedEvidenceReference[];

  observationIds: string[];

  assessmentState:
    | 'REQUESTED'
    | 'EVIDENCE_PENDING'
    | 'READY'
    | 'ASSESSING'
    | 'SATISFIED'
    | 'CONDITIONALLY_SATISFIED'
    | 'REJECTED'
    | 'INCONCLUSIVE'
    | 'ESCALATED'
    | 'WAIVED'
    | 'INVALIDATED'
    | 'VALIDATOR_FAILED'
    | 'INDEPENDENCE_VIOLATION'
    | 'CANCELLED';

  residualUncertainty: string[];

  recommendedControlActions: ControlActionRecommendation[];
}
```

## 19.1 Request assurance assessment command

```typescript
interface RequestAssuranceAssessmentPayload {
  assessmentId: string;

  assurancePolicyId: string;
  policyVersion: string;

  subjectObjectIds: string[];
  subjectSemanticVersions: Record<string, number>;

  claimIds: string[];
}
```

## 19.2 Complete assurance assessment command

```typescript
interface CompleteAssuranceAssessmentPayload {
  validatorResult: ValidatorResult;
}
```

## 19.3 Assurance assessment completed event

```typescript
interface AssuranceAssessmentCompletedPayload {
  assessmentId: string;

  assurancePolicyId: string;
  policyVersion: string;

  subjectObjectIds: string[];
  subjectSemanticVersions: Record<string, number>;

  disposition:
    | 'SATISFIED'
    | 'CONDITIONALLY_SATISFIED'
    | 'REJECTED'
    | 'INCONCLUSIVE'
    | 'ESCALATED';

  evidenceConsideredIds: string[];
  observationIds: string[];

  residualUncertainty: string[];
  recommendedControlActions: ControlActionRecommendation[];
}
```

---

# 20. Validator Result Contract

```typescript
interface ValidatorResult {
  validatorId: string;
  validatorVersion: string;

  policyId: string;
  policyVersion: string;

  assessmentId: string;

  subjectObjectIds: string[];
  subjectSemanticVersions: Record<string, number>;

  claimResults: ClaimAssessmentResult[];

  evidenceConsideredIds: string[];
  evidenceRejected: RejectedEvidenceReference[];

  observations: ProposedAssuranceObservation[];

  dispositionRecommendation:
    | 'SATISFIED'
    | 'CONDITIONALLY_SATISFIED'
    | 'REJECTED'
    | 'INCONCLUSIVE'
    | 'ESCALATED';

  recommendedControlActions: ControlActionRecommendation[];

  residualUncertainty: string[];
  limitations: string[];

  executionProvenance: ExecutionProvenance;
}
```

## 20.1 Criterion result

```typescript
interface CriterionResult {
  criterionId: string;

  result:
    | 'MET'
    | 'PARTIALLY_MET'
    | 'NOT_MET'
    | 'NOT_APPLICABLE'
    | 'UNABLE_TO_DETERMINE';

  rationale: string;
  evidenceIds: string[];
}
```

## 20.2 Validator result acceptance rules

The Assurance Service must reject a validator result when:

* policy identity or version mismatches;
* assessment identity mismatches;
* subject semantic version mismatches;
* required criteria are missing;
* referenced evidence does not exist;
* evidence is invalidated;
* disposition contradicts mandatory policy rules;
* output fails schema validation;
* independence requirements are not satisfied.

---

# 21. Assurance Observation Contract

```typescript
interface AssuranceObservation extends ObjectEnvelope {
  objectType: 'ASSURANCE_OBSERVATION';

  assessmentId: string;
  policyId: string;
  criterionId?: string;

  subjectObjectIds: string[];

  findingCode: string;

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
  implication: string;

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

## 21.1 Observation recorded event

```typescript
interface AssuranceObservationRecordedPayload {
  observationId: string;
  assessmentId: string;
  policyId: string;

  subjectObjectIds: string[];

  findingCode: string;
  severity: ObservationSeverity;

  statement: string;
  implication: string;

  evidenceIds: string[];

  disposition: 'OPEN';
}
```

---

# 22. Decision Contract

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
  subjectSemanticVersions: Record<string, number>;

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

## 22.1 Approve decision command

```typescript
interface ApproveDecisionPayload {
  selectedOption: string;
  rationale: string;

  consideredEvidenceIds: string[];
  consideredObservationIds: string[];

  subjectSemanticVersions: Record<string, number>;
}
```

## 22.2 Decision effective event

```typescript
interface DecisionEffectivePayload {
  decisionId: string;
  decisionType: string;

  subjectObjectIds: string[];
  subjectSemanticVersions: Record<string, number>;

  selectedOption: string;
  rationale: string;

  effectiveAt: string;
}
```

---

# 23. Baseline Contract

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

  purpose: string;
  scope: string;

  itemObjectVersions: Array<{
    objectId: string;
    semanticVersion: number;
    contentHash?: string;
  }>;

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

## 23.1 Promote baseline command

```typescript
interface PromoteBaselinePayload {
  promotionDecisionId: string;

  expectedItemObjectVersions: Array<{
    objectId: string;
    semanticVersion: number;
    contentHash?: string;
  }>;

  requiredAssessmentIds: string[];
}
```

## 23.2 Baseline promoted event

```typescript
interface BaselinePromotedPayload {
  baselineId: string;
  baselineType: string;

  promotionDecisionId: string;

  itemObjectVersions: Array<{
    objectId: string;
    semanticVersion: number;
    contentHash?: string;
  }>;

  assuranceAssessmentIds: string[];

  status: 'AUTHORITATIVE';
}
```

---

# 24. Trace Link Contract

```typescript
interface TraceLink {
  id: string;

  sourceObjectId: string;
  sourceSemanticVersion?: number;

  targetObjectId: string;
  targetSemanticVersion?: number;

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
    | 'PROMOTES'
    | 'ALLOCATES'
    | 'PROPAGATES'
    | 'GOVERNS';

  rationale?: string;

  createdAt: string;
  createdBy: ActorReference;
}
```

Trace links are immutable.

Corrections supersede the prior link.

---

# 25. Error Contract

```typescript
interface RphError {
  code: string;

  category:
    | 'VALIDATION'
    | 'AUTHORIZATION'
    | 'CONCURRENCY'
    | 'NOT_FOUND'
    | 'INVARIANT'
    | 'EXECUTION'
    | 'ASSURANCE'
    | 'PERSISTENCE'
    | 'EXTERNAL_DEPENDENCY'
    | 'SCHEMA_COMPATIBILITY';

  message: string;

  retryable: boolean;

  targetObjectIds: string[];

  details?: Record<string, unknown>;

  correlationId: string;
}
```

## 25.1 Required error codes

```text
RPH_VALIDATION_SCHEMA_FAILED
RPH_VALIDATION_SEMANTIC_FAILED
RPH_AUTHORITY_INSUFFICIENT
RPH_REVISION_CONFLICT
RPH_ILLEGAL_STATE_TRANSITION
RPH_INVARIANT_VIOLATION
RPH_EVIDENCE_MISSING
RPH_EVIDENCE_INVALIDATED
RPH_VALIDATOR_OUTPUT_INVALID
RPH_VALIDATOR_INDEPENDENCE_VIOLATION
RPH_POLICY_VERSION_MISMATCH
RPH_SUBJECT_VERSION_MISMATCH
RPH_BASELINE_VERSION_MISMATCH
RPH_IDEMPOTENCY_DUPLICATE
RPH_EXTERNAL_OPERATION_UNCERTAIN
```

Errors must be typed and observable.

They must not be represented only as arbitrary strings.

---

# 26. Projection Contracts

## 26.1 Work View

```typescript
interface WorkViewProjection {
  projectionId: string;
  rootWorkUnitId: string;
  projectionRevision: number;

  nodes: WorkViewNode[];
  edges: WorkViewEdge[];

  generatedAt: string;
}
```

```typescript
interface WorkViewNode {
  objectId: string;
  objectType: string;

  title: string;
  pwuKind?: string;

  workLifecycleState?: WorkLifecycleState;
  executionState?: ExecutionState;
  assuranceState?: AssuranceState;
  shapeIntegrityState?: ShapeIntegrityState;

  openObservationCounts: {
    informational: number;
    advisory: number;
    material: number;
    blocking: number;
    critical: number;
  };

  semanticVersion: number;
}
```

## 26.2 Assurance View

```typescript
interface AssuranceViewProjection {
  projectionId: string;
  subjectObjectId: string;

  aggregateDisposition:
    | 'UNASSESSED'
    | 'EVIDENCE_REQUIRED'
    | 'ASSESSING'
    | 'SATISFIED'
    | 'CONDITIONALLY_SATISFIED'
    | 'REJECTED'
    | 'INCONCLUSIVE'
    | 'WAIVED'
    | 'INVALIDATED';

  policyAssessments: AssurancePolicyProjection[];
  openObservations: ObservationProjection[];
  evidenceSummary: EvidenceProjection[];

  generatedAt: string;
}
```

## 26.3 Compatibility milestone projection

```typescript
interface CompatibilityMilestoneProjection {
  dialogueId: string;

  currentMilestone:
    | 'INTAKE'
    | 'ARCHITECTURE'
    | 'PROPOSE'
    | 'ASSUMPTION_SURFACING'
    | 'VERIFY'
    | 'HISTORICAL_CHECK'
    | 'REVIEW'
    | 'EXECUTE'
    | 'VALIDATE'
    | 'COMMIT'
    | 'REPLAN';

  milestoneStatus:
    | 'NOT_STARTED'
    | 'IN_PROGRESS'
    | 'WAITING'
    | 'COMPLETE'
    | 'FAILED'
    | 'BLOCKED';

  derivedFromObjectIds: string[];
  derivedAt: string;
}
```

This projection preserves `dialogue` and phase vocabulary only at the legacy compatibility boundary. It is derived and non-authoritative.

---

# 27. Compatibility and Evolution Rules

## 27.1 Semantic Versioning

Use package SemVer:

```text
MAJOR.MINOR.PATCH
```

### Major

Breaking contract change requiring consumer modification.

Examples:

* removing a required property;
* changing property meaning;
* changing enum semantics;
* changing event interpretation;
* changing ID format incompatibly.

### Minor

Backward-compatible addition.

Examples:

* new optional property;
* new command or event schema;
* new object type;
* new enum value where consumers are required to tolerate unknown values.

### Patch

Correction without contract-shape change.

Examples:

* description correction;
* example correction;
* validation bug fix that restores documented behavior.

## 27.2 Event compatibility

Persisted event schemas are permanent.

A new event payload version must not rewrite old events.

Use upcasters when loading older events:

```text
Event v1
→ upcaster
→ internal current representation
```

## 27.3 Unknown event handling

Consumers must:

* reject unknown mandatory event categories;
* tolerate unknown optional integration events;
* log unsupported schema versions;
* never silently discard authoritative domain events.

## 27.4 Enum evolution

Consumers must not assume they know every future enum value.

Generated TypeScript may include an unknown fallback:

```typescript
type ForwardCompatibleStatus =
  | KnownStatus
  | `UNKNOWN:${string}`;
```

For canonical writes, only registered values are allowed.

---

# 28. Validation Pipeline

Every inbound command follows:

```text
Receive
→ Parse JSON
→ Validate envelope schema
→ Validate payload schema
→ Normalize identifiers and timestamps
→ Validate authorization
→ Load aggregate
→ Check expected revision
→ Evaluate domain invariants
→ Produce events
→ Persist events and outbox atomically
→ Update projections asynchronously
```

Every validator result follows:

```text
Receive
→ Parse
→ Schema validate
→ Verify validator registry identity
→ Verify policy/version
→ Verify assessment identity
→ Verify subject versions
→ Verify evidence references
→ Verify independence
→ Apply policy disposition rules
→ Persist observations and assessment event
→ Publish controller recommendation
```

---

# 29. Outbox Contract

```typescript
interface OutboxMessage {
  outboxId: string;
  eventId: string;

  topic: string;
  partitionKey: string;

  payload: DomainEvent<unknown>;

  status:
    | 'PENDING'
    | 'PUBLISHED'
    | 'FAILED';

  attemptCount: number;

  createdAt: string;
  publishedAt?: string;
  lastError?: string;
}
```

Domain events and their outbox messages must be committed in the same database transaction.

---

# 30. Command Idempotency Contract

```typescript
interface CommandReceipt {
  commandId: string;
  idempotencyKey: string;

  commandType: string;
  targetAggregateId: string;

  status:
    | 'PROCESSING'
    | 'ACCEPTED'
    | 'REJECTED';

  producedEventIds: string[];

  resultHash?: string;
  createdAt: string;
  completedAt?: string;
}
```

When a duplicate idempotency key is received:

* return the prior result;
* do not execute the domain operation again.

---

# 31. Fixture Manifest Contract

```typescript
interface FixtureManifest {
  fixtureId: string;
  fixtureVersion: string;

  name: string;
  description: string;

  contractPackageVersion: string;
  pwaId: string;
  pwaVersion: string;
  undertakingId: string;

  files: FixtureFileReference[];

  rootIntentId: string;
  rootWorkUnitId: string;

  expectedFinalState: {
    intentStatus: string;
    rootWorkLifecycleState: string;
    authoritativeBaselineIds: string[];
  };
}
```

The Field Service Management SaaS Reference Undertaking fixture must validate against the package before it may be used for:

* seed;
* replay;
* conformance;
* UI testing.

---

# 32. Required First-Slice Commands

Implement first:

```text
CaptureIntent
FormalizeIntent
ApproveIntent

ProposePwu
BeginPwuShaping
MarkPwuReady
ChangePwuState

ProposeExecutionPlan
ApproveExecutionPlan
ActivateExecutionPlan

StartExecutionStep
CompleteExecutionStep
FailExecutionStep

DetectAssumption
ProposeEvidence
AdmitEvidence

AssertClaim
RequestAssuranceAssessment
RecordAssuranceObservation
CompleteAssuranceAssessment

ProposeDecision
ApproveDecision

CreateBaseline
PromoteBaseline
```

---

# 33. Required First-Slice Events

Implement first:

```text
IntentCaptured
IntentFormalized
IntentApproved

PwuProposed
PwuShapingStarted
PwuMarkedReady
PwuStateChanged

ExecutionPlanProposed
ExecutionPlanApproved
ExecutionPlanActivated

ExecutionStepStarted
ExecutionStepSucceeded
ExecutionStepFailed

AssumptionDetected
EvidenceProposed
EvidenceAdmitted

ClaimAsserted
AssuranceAssessmentRequested
AssuranceObservationRecorded
AssuranceAssessmentCompleted

DecisionProposed
DecisionEffective

BaselineCreated
BaselinePromoted
```

---

# 34. Schema Conformance Tests

Every schema must include tests for:

* valid minimum payload;
* valid complete payload;
* missing required field;
* unknown property;
* malformed ID;
* malformed timestamp;
* unknown schema version;
* invalid enum;
* invalid nested reference;
* extension payload validation;
* forward-compatible reader behavior.

---

# 35. Contract-Level Invariant Tests

## 35.1 Subject version binding

An Assurance Assessment result referencing Architecture semantic version 2 must not be applied to version 3.

## 35.2 Execution versus assurance

`ExecutionStepSucceeded` cannot directly produce:

```text
AssuranceState = SATISFIED
```

## 35.3 Baseline identity

`PromoteBaseline` must include exact semantic versions and hashes for reviewed items.

## 35.4 Evidence status

Evidence with:

```text
status = INVALIDATED
```

cannot appear as accepted support in a completed assessment.

## 35.5 Decision authority

An approval command without sufficient authority must be rejected before producing `DecisionEffective`.

## 35.6 Event revision

An event with an aggregate revision not equal to prior revision plus one must be rejected by the event store.

## 35.7 Duplicate command

A duplicate idempotency key produces no additional domain event.

## 35.8 Presentation isolation

No canvas-layout schema may reference a command capable of mutating PWU semantic state.

---

# 36. Type Generation

Generate TypeScript from JSON Schema or generate both from a single canonical source.

Do not maintain hand-written schemas and hand-written TypeScript independently.

Recommended options:

* TypeBox;
* Zod with JSON Schema generation;
* JSON Schema as source with code generation;
* Effect Schema.

Selection criteria:

* Draft 2020-12 support;
* discriminated unions;
* recursive types;
* generated JSON Schema quality;
* runtime validation;
* readable TypeScript;
* stable schema identifiers;
* support for custom semantic validators.

Structural validation and semantic validation must remain separate.

---

# 37. Semantic Validator API

```typescript
interface SemanticValidationContext {
  actor: ActorReference;

  objectRepository: ObjectRepositoryReader;
  policyRepository: PolicyRepositoryReader;
  authorityService: AuthorityReader;

  currentTime: string;
}

interface SemanticValidator<T> {
  validate(
    value: T,
    context: SemanticValidationContext
  ): Promise<SemanticValidationResult>;
}

interface SemanticValidationResult {
  valid: boolean;
  violations: SemanticViolation[];
}

interface SemanticViolation {
  code: string;
  message: string;
  severity:
    | 'ERROR'
    | 'WARNING';

  objectIds: string[];
  fieldPath?: string;
}
```

JSON Schema determines whether a payload has the correct shape.

Semantic validators determine whether the requested state is professionally and architecturally legal.

---

# 38. Logging and Trace Requirements

For every command:

* command ID;
* command type;
* actor;
* target;
* expected revision;
* correlation ID;
* result;
* produced events;
* latency.

For every validator call:

* assessment ID;
* policy/version;
* validator/version;
* subject versions;
* evidence IDs;
* independence result;
* disposition recommendation;
* authoritative disposition;
* limitations;
* latency and cost.

Do not log:

* secrets;
* unrestricted full context;
* raw protected user data;
* authorization tokens.

---

# 39. Security Requirements

* All IDs received externally must be validated.
* Runtime capabilities must use separate authorization contracts.
* Validator output cannot grant permissions.
* Imported policy definitions are untrusted until registered.
* Applicability expressions cannot execute arbitrary code.
* Artifact references must use allowlisted schemes.
* Content hashes should be stored for baseline artifacts and evidence.
* Sensitive evidence requires classification metadata and access checks.
* Event payloads must avoid embedding secrets.
* Human decisions require authenticated identity.

---

# 40. Definition of Done

The contract package is complete for the first vertical slice when:

1. Every first-slice object has a versioned schema.
2. Every first-slice command has an envelope and payload schema.
3. Every first-slice domain event has an envelope and payload schema.
4. Validator results are schema-validated.
5. Policy applicability uses a non-executable declarative language.
6. TypeScript types are generated from the canonical contract source.
7. Structural and semantic validation are separate.
8. Schema conformance tests pass.
9. The Field Service Management SaaS Reference Undertaking fixture validates fully.
10. The expected event trace validates and replays.
11. Unknown properties are rejected at canonical write boundaries.
12. Optimistic concurrency fields are present.
13. Idempotency is contractually defined.
14. Baseline promotion binds exact reviewed versions.
15. Presentation contracts are separate from semantic contracts.
16. The VS Code extension and runtime can share the same package.
17. Persisted event payloads can be upcast from older schema versions.
18. Contract errors are typed and observable.

---

# 41. Immediate Implementation Sequence

## Step 1

Select the canonical schema-authoring technology.

## Step 2

Implement:

* IDs;
* actor;
* provenance;
* object envelope;
* command envelope;
* event envelope;
* error contract.

## Step 3

Implement first semantic objects:

* PWA Version Reference;
* PWU Type Reference;
* Undertaking Reference;
* Intent;
* PWU Instance;
* Assumption;
* Claim;
* Evidence;
* Assurance Assessment;
* Decision;
* Baseline.

## Step 4

Implement first commands and events.

## Step 5

Implement Validator Result and Assurance Policy schemas.

## Step 6

Convert the Field Service Management SaaS Reference Undertaking into actual fixture files.

## Step 7

Run schema and replay conformance tests.

## Step 8

Begin the intent-to-architecture vertical-slice runtime.

---

# 42. Closing Contract Rule

The RPH contract package must make it difficult to implement the wrong architecture accidentally.

A service should not be able to:

* mark work satisfied because a model returned output;
* approve a changed object using stale assurance;
* promote an unreviewed artifact version;
* hide material assumptions in prose;
* treat invalidated evidence as active support;
* grant runtime authority through an Execution Workflow template;
* mutate semantic state through a canvas operation;
* collapse validator recommendations into authoritative decisions.

The machine contracts defined here are therefore not only serialization formats.

They are the first executable boundary around the architectural commitments of the Recursive Professional Harness.
