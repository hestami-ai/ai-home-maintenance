## Implementation Roadmap: JanumiCode Validation Convergence System

The roadmap should **not** begin with “add a new validator architecture.” It should begin with:

> **Reconcile the proposed validator-convergence model with the actual JanumiCode codebase as implemented today.**

That matters because JanumiCode already has many adjacent mechanisms: Reasoning Review, Verification Ensemble, deterministic Invariant Checks, Loop Detection, Phase Gates, quarantine behavior, warning acknowledgment, JSON repair, scope gatekeeping, and audit pauses. The convergence system should **formalize and compose what already exists first**, then add missing abstractions only where the current implementation cannot support the needed behavior.

The v2.3 spec already says each artifact-producing Sub-Phase has its own Agent Invocation, Context Payload, Execution Trace capture, Invariant Check before Reasoning Review, Reasoning Review, and Governed Stream recording. It also defines the Governed Stream as the lossless system of record for artifacts, tool calls, tool results, decisions, memory, and execution traces.  

---

# Roadmap principle

The implementation should follow this rule:

> **Do not introduce a new convergence subsystem until the existing validation, repair, gate, and stream mechanisms have been mapped, reused, or deliberately superseded.**

So the work proceeds in three layers:

```text
Layer 1 — Reconcile with current implementation
Layer 2 — Normalize existing validators into a common Finding model
Layer 3 — Add convergence, repair tracking, and targeted revalidation
```

---

# Phase 0 — Current Implementation Reconciliation

## Objective

Create a precise map of how JanumiCode currently performs validation, repair, retry, gatekeeping, and human escalation.

This is the most important phase.

## Why this comes first

The current implementation already appears to have meaningful validation infrastructure. The README describes a state machine/orchestrator, Verifier role, MAKER Task Engine, human gates, and gate resolutions such as `APPROVE`, `REJECT`, `OVERRIDE`, and `REFRAME`.  The run harness also shows existing operational controls for `reasoning_review`, Stage III ingestion, audit pause, scope gatekeeper, JSON repair records, LLM failure/recovery records, deterministic verifiers, and coverage verification. 

So the first task is not implementation. It is **implementation archaeology**.

## Required audit targets

Inspect the actual codebase for:

```text
OrchestratorEngine
StateMachine
ContextBuilder
TemplateLoader
AgentInvoker
LLMCaller
InvariantChecker
ReasoningReview runner
VerificationEnsemble runner
LoopDetectionMonitor
ScopeGatekeeper
JSON repair mechanism
MAKER bounds repair mechanism
PhaseGate evaluator
GovernedStreamWriter
Governed Stream schema/migrations
Prompt template execution flow
Thin-slice harness
Audit pause implementation
Human gate UI flow
```

## Deliverables

1. **Current Validation Flow Map**

```text
Sub-Phase starts
→ Context built
→ Agent invoked
→ Artifact recorded
→ JSON repair?
→ Invariant checks?
→ Reasoning Review?
→ Verification Ensemble?
→ Scope gatekeeper?
→ Audit pause?
→ Human gate?
→ Retry / repair / abort?
```

2. **Existing Record Inventory**

Classify existing records into:

```text
Already usable for convergence
Needs extension
Should remain separate
Should be deprecated
```

The v2.3 schema list already includes records such as `reasoning_review_record`, `domain_compliance_review_record`, `loop_detection_record`, `verification_ensemble_disagreement`, `warning_acknowledged`, `quarantine_override`, `json_repair_record`, `llm_api_failure`, and `llm_api_recovery`. 

3. **Gap Register**

Example rows:

| Capability            |     Current support | Gap                                                        | Recommendation                             |
| --------------------- | ------------------: | ---------------------------------------------------------- | ------------------------------------------ |
| Validator findings    |             Partial | Findings are not normalized across validator types         | Add canonical `validator_finding_record`   |
| Repair tracking       |             Partial | Repair attempts may not be explicitly linked to findings   | Add `repair_event`                         |
| Convergence           | Missing or informal | No durable proof that all findings were resolved           | Add `validation_convergence_record`        |
| Targeted revalidation |             Partial | Existing retries may not select validators by diff surface | Add impact matrix                          |
| Validator canaries    |             Missing | No validator-system self-test                              | Add meta-validation later                  |
| Gate health           |             Missing | Human gate telemetry not interpreted                       | Add non-blocking gate health records later |

## Exit criteria

Do not proceed until this exists:

```text
A. Actual code paths documented
B. Existing validation records mapped
C. Existing retry/repair mechanisms understood
D. Minimal schema additions identified
E. No duplicated subsystem proposed where existing code can be extended
```

---

# Phase 1 — Define the Canonical Finding Model

## Objective

Normalize every validator, verifier, invariant check, scope gatekeeper, repair check, and LLM review output into a common **Finding** abstraction.

## Recommendation

Add a canonical record:

```text
validator_finding_record
```

But do **not** immediately force every existing record to disappear. Instead, introduce it as a normalized projection layer.

Existing records can remain source records:

```text
reasoning_review_record
domain_compliance_review_record
invariant_violation
verification_ensemble_disagreement
json_repair_record
scope_gatekeeper_result
coverage_verifier_result
```

The new `validator_finding_record` becomes the common operational object.

## Minimal schema

```json
{
  "record_type": "validator_finding_record",
  "schema_version": "1.0",
  "workflow_run_id": "...",
  "phase_id": "...",
  "sub_phase_id": "...",
  "stage": "POST_GENERATION",
  "validator_id": "...",
  "validator_family": "...",
  "source_record_id": "...",
  "target_type": "Artifact | GenerationContext | RepairEvent | Gate | ValidatorSystem",
  "target_record_id": "...",
  "severity": "INFO | WARN | BLOCK | CRITICAL",
  "failure_mode": "...",
  "summary": "...",
  "evidence": [],
  "recommended_action": "...",
  "status": "OPEN"
}
```

This implements the feedback’s widened target model: findings should be able to indict not only artifacts, but also the generation process, validator system, repair process, or gate. 

## Remediation likely needed

If current validators emit incompatible shapes, add adapters:

```text
ReasoningReviewFindingAdapter
InvariantViolationFindingAdapter
VerificationEnsembleFindingAdapter
ScopeGatekeeperFindingAdapter
JsonRepairFindingAdapter
HumanGateFindingAdapter
```

Do not rewrite validators yet. Wrap them.

---

# Phase 2 — Introduce Stage Binding Without Rewriting Phase Logic

## Objective

Add the concept of **generation lifecycle stage** alongside JanumiCode’s existing phase/sub-phase model.

## Why

Phase binding answers:

> Where are we in JanumiCode’s workflow?

Stage binding answers:

> Where are we in the generation lifecycle?

The feedback correctly identifies stages such as `PRE_GENERATION`, `POST_GENERATION`, `POST_VALIDATION`, `POST_REPAIR`, `PRE_GATE`, `POST_GATE`, and `CONTINUOUS`. 

## Implementation approach

Do not alter the phase engine first. Add stage as metadata to validation events.

```ts
type ValidationStage =
  | "PRE_GENERATION"
  | "POST_GENERATION"
  | "POST_VALIDATION"
  | "POST_REPAIR"
  | "PRE_GATE"
  | "POST_GATE"
  | "CONTINUOUS";
```

## Initial stage bindings

| Stage             | Existing JanumiCode hook to reconcile with                       |
| ----------------- | ---------------------------------------------------------------- |
| `PRE_GENERATION`  | `ContextBuilder`, `TemplateLoader`, required variable validation |
| `POST_GENERATION` | artifact parse, JSON repair, schema validation, Invariant Check  |
| `POST_VALIDATION` | Reasoning Review, Verification Ensemble, scope gatekeeper        |
| `POST_REPAIR`     | retry/repair loop, JSON repair, MAKER bounds repair              |
| `PRE_GATE`        | Phase Gate evaluation                                            |
| `POST_GATE`       | human decision records                                           |
| `CONTINUOUS`      | loop detection, telemetry, harness analytics                     |

## Exit criteria

Every validation event can answer:

```text
phase_id
sub_phase_id
stage
target_record_id
validator_id
source_record_id
```

---

# Phase 3 — Add the Validation Convergence Controller Skeleton

## Objective

Introduce a controller that can track whether validator findings are resolved, but initially only in **observe mode**.

## Why observe mode first

JanumiCode already has active validation and retry behavior. Dropping a blocking convergence controller into the middle could destabilize the workflow.

Start by recording convergence state without enforcing it.

## New component

```text
ValidationConvergenceController
```

Initial responsibilities:

```text
1. Collect normalized findings for a target artifact.
2. Group findings by severity and failure mode.
3. Track whether subsequent records appear to address them.
4. Produce a convergence summary.
5. Do not block phase progression yet.
```

## Initial output record

```text
validation_convergence_record
```

Example:

```json
{
  "record_type": "validation_convergence_record",
  "schema_version": "0.1",
  "workflow_run_id": "...",
  "phase_id": "phase_04_architecture",
  "sub_phase_id": "04_2_architecture_definition",
  "target_artifact_record_id": "...",
  "mode": "observe_only",
  "convergence_status": "UNKNOWN | CLEAN | UNRESOLVED | PARTIAL | DIVERGING",
  "open_findings": [],
  "resolved_findings": [],
  "unaccounted_findings": [],
  "new_findings_after_repair": [],
  "repair_iterations": 0,
  "would_block_gate": false
}
```

## Remediation likely needed

If current validators do not expose stable finding IDs, add deterministic IDs:

```text
finding_id = hash(workflow_run_id, phase_id, sub_phase_id, validator_id, target_id, failure_mode, normalized_evidence_pointer)
```

This prevents findings from “disappearing” across retries because the text changed slightly.

---

# Phase 4 — Formalize Repair Events

## Objective

Make repairs durable, inspectable, and linked to findings.

The feedback’s `RepairEvent` concept is essential because it makes repair regression tractable by linking the triggering finding, pre-repair hash, post-repair hash, diff scope, and revalidation set. 

## New record

```text
repair_event
```

Minimal schema:

```json
{
  "record_type": "repair_event",
  "schema_version": "1.0",
  "workflow_run_id": "...",
  "phase_id": "...",
  "sub_phase_id": "...",
  "stage": "POST_REPAIR",
  "triggering_finding_ids": [],
  "repair_strategy": "LOCAL_EDIT | STRUCTURAL_EDIT | REPRESENTATION_REVISION | CONTEXT_REASSEMBLY | RE_RETRIEVE | IDENTITY_RECONCILIATION | HUMAN_DECISION_REQUIRED | ROLLBACK_REPAIR",
  "pre_repair_artifact_record_id": "...",
  "post_repair_artifact_record_id": "...",
  "pre_repair_artifact_hash": "...",
  "post_repair_artifact_hash": "...",
  "diff_scope": {},
  "revalidation_set": [],
  "repair_notes": "..."
}
```

## Integration points

Map existing behavior into `repair_event`:

| Current behavior                   | Repair event mapping                                          |
| ---------------------------------- | ------------------------------------------------------------- |
| JSON repair                        | `LOCAL_EDIT` or `STRUCTURAL_EDIT`                             |
| Retry after Reasoning Review flaw  | `LOCAL_EDIT`, `STRUCTURAL_EDIT`, or `REPRESENTATION_REVISION` |
| Context missing required variables | `CONTEXT_REASSEMBLY`                                          |
| Stale retrieval                    | `RE_RETRIEVE`                                                 |
| MAKER bounds repair                | likely `STRUCTURAL_EDIT` or `HUMAN_DECISION_REQUIRED`         |
| Human reframe                      | `HUMAN_DECISION_REQUIRED` followed by new artifact lineage    |
| Rollback                           | `ROLLBACK_REPAIR`                                             |

## Exit criteria

Every nontrivial retry or repair has:

```text
triggering finding
repair strategy
before/after artifact identity
diff scope
revalidation set
```

---

# Phase 5 — Targeted Revalidation Matrix

## Objective

After a repair, JanumiCode should rerun the validators whose inspection surface intersects the repair.

## Why

Running every validator every time is expensive. Running too few validators misses regressions.

## Add a validator impact matrix

```json
{
  "identity_fields_changed": [
    "entity_existence_validator",
    "identifier_fidelity_validator",
    "reference_integrity_validator",
    "parent_child_integrity_validator",
    "semantic_identity_continuity_validator"
  ],
  "requirement_text_changed": [
    "intent_to_requirement_traceability_validator",
    "requirement_testability_validator",
    "conflict_validator",
    "acceptance_criteria_validator"
  ],
  "architecture_component_changed": [
    "component_responsibility_validator",
    "dependency_direction_validator",
    "architecture_consistency_validator",
    "representation_adequacy_validator"
  ],
  "technical_spec_api_changed": [
    "api_surface_validator",
    "interface_contract_validator",
    "version_currency_validator",
    "package_existence_validator"
  ],
  "test_plan_changed": [
    "acceptance_coverage_validator",
    "negative_case_coverage_validator",
    "test_oracle_validator",
    "regression_coverage_validator"
  ]
}
```

## Non-negotiable rule

Any repair that changes identifiers, parent-child relationships, references, trace links, or entity semantics must rerun the **full Entity Integrity family**.

This directly addresses the smaller-model identifier drift issue you noticed.

## Remediation likely needed

If artifacts are not currently diffed structurally, add a JSON-path diff layer:

```text
ArtifactDiffService
├── changed_json_paths
├── changed_entity_ids
├── changed_reference_edges
├── changed_semantic_fields
└── changed_governing_fields
```

---

# Phase 6 — Enforce Convergence Before Phase Gates

## Objective

Move from observe mode to enforce mode.

## Gate invariant

A phase or sub-phase cannot proceed to the human Phase Gate unless:

```text
1. No unresolved CRITICAL finding exists.
2. No unresolved BLOCK finding exists.
3. WARN findings are resolved, accepted, or explicitly deferred.
4. No repair introduced a new BLOCK or CRITICAL finding.
5. Required deterministic checks pass.
6. Entity registry remains consistent.
7. Traceability links remain valid.
8. The artifact satisfies schema and invariant checks.
9. Validator disagreements requiring human judgment are surfaced.
```

## Important human-authority preservation

Gate Health validators should not block human decisions. The feedback is right: a system that blocks its human overseer for reviewing “too fast” inverts the authority hierarchy. Gate Health should emit telemetry and review flags, not hard blocks. 

## Phase Gate evidence package

Add convergence evidence to the human gate UI:

```text
Phase Gate Evidence
├── Current artifact
├── Validator finding summary
├── Resolved findings
├── Accepted/deferred warnings
├── Repair events
├── Revalidation results
├── Remaining human-judgment items
└── Convergence status
```

---

# Phase 7 — Add Root-Cause and Representation Repair Policies

## Objective

Prevent superficial fixes such as regex-only patches for semantic identity failures.

## Add a policy table

```text
FailureMode → AllowedRepairStrategies
```

Example:

| Failure mode                  | Disallowed shallow repair | Required repair                                  |
| ----------------------------- | ------------------------- | ------------------------------------------------ |
| Referential Integrity Failure | Regex-only normalization  | Identity registry, alias mapping, reconciliation |
| Representation Failure        | Local wording patch       | Representation revision                          |
| Context Failure               | Regenerate artifact       | Reassemble context                               |
| Stale Retrieval               | Patch artifact            | Re-retrieve and re-evaluate                      |
| Numeric Infidelity            | Regenerate number         | Deterministic recomputation                      |
| Goodhart Pressure             | Satisfy validator text    | Rotate judge, holdout refresh, widen rubric      |
| Human Judgment Boundary       | Agent decides             | Human menu or reframe                            |

## New validators to prioritize

```text
Root-Cause Adequacy Validator
Representation Adequacy Validator
Repair Scope Validator
Finding Resolution Validator
Goodhart Pressure Validator
```

## Implementation note

These should not all be model calls at first.

Start with hybrid checks:

```text
deterministic failure-mode routing
+ rule-based repair strategy constraints
+ LLM validator only when semantic judgment is needed
```

---

# Phase 8 — Entity Registry and Identity Convergence

## Objective

Fix identifier drift systematically.

## Recommendation

Implement a governed entity registry for phase artifacts:

```text
Entity Registry
├── canonical_entity_id
├── entity_type
├── canonical_label
├── aliases
├── parent_entity_id
├── source_artifact_id
├── created_in_phase
├── current_definition_hash
├── semantic_summary
├── superseded_by
└── status
```

## Identity resolution hierarchy

```text
1. Exact canonical ID match
2. Deterministic alias table match
3. Normalized lexical match
4. Embedding candidate retrieval
5. LLM semantic equivalence judge
6. Human escalation
```

## Where to integrate

Start with requirements trees in Phase 2, then extend to:

```text
System Requirements
Interface Contracts
Components
Component Responsibilities
ADRs
Technical Specifications
Implementation Tasks
Test Cases
Evaluation Criteria
```

## Convergence-specific rule

A repaired artifact cannot converge if it references:

```text
missing entities
duplicate identities
ambiguous identities
orphaned child nodes
collided identifiers
silently mutated entity meanings
```

---

# Phase 9 — Process Validators

## Objective

Add validators that inspect the generation process itself, not only artifacts.

## Priority order

Do not implement the full Process Validator branch at once. Start with the highest-leverage validators:

```text
1. Context Sufficiency Validator
2. Registry Inclusion Validator
3. Provenance Tagging Validator
4. Injection Screening Validator
5. Completion / Parse Validator
6. Repair Regression Validator
7. Finding Resolution Validator
8. Validator Context Isolation Validator
```

## Why these first

These are most likely to catch failures before expensive downstream reasoning:

```text
bad context
missing registry
untrusted instruction leakage
malformed output
bad repair
validator-rubric leakage
```

The v2.3 spec already contains a strong context assembly design: a stdin directive channel plus detail file, with a hard guarantee that governing constraints cannot be silently truncated.  Process validators should build on that rather than replace it.

---

# Phase 10 — Meta-Validation and Canary Injection

## Objective

Validate the validators.

## Add canary tests

Create known-good artifacts, deterministically corrupt them, and verify that the validator ensemble catches the corruption.

Examples:

```text
Break a requirement ID
Orphan a child requirement
Invert an acceptance criterion
Delete a traceability link
Invent a nonexistent API
Use a stale package version
Inject instruction-bearing content into retrieved context
```

## Canary rule

If a canary passes undetected, the finding is against the validator system:

```text
target_type: ValidatorSystem
severity: CRITICAL
recommended_action: SuspendValidator | RotateJudge | RefreshRubric
```

## Start in the harness

The current harness is already designed for thin-slice testing and prompt iteration, with reasoning review and audit-pause toggles.  Extend that harness before integrating canaries into normal workflow execution.

---

# Phase 11 — UI and Human Review Integration

## Objective

Expose convergence without overwhelming the user.

## Add UI cards

```text
Validator Finding Card
Repair Event Card
Convergence Summary Card
Unresolved Finding Card
Human Judgment Required Card
Gate Health Telemetry Card
Validator System Health Card
```

## Human gate actions

Use the existing gate resolution vocabulary where possible:

```text
APPROVE
REJECT
OVERRIDE
REFRAME
```

But add convergence-specific meanings:

| Human action | Meaning                                  |
| ------------ | ---------------------------------------- |
| `APPROVE`    | Accept artifact and resolved finding set |
| `REJECT`     | Reject artifact or repair                |
| `OVERRIDE`   | Accept known residual risk               |
| `REFRAME`    | Change governing intent/scope/constraint |

## Important rule

Human override should not erase findings. It should create:

```text
human_risk_acceptance_record
```

or extend the existing warning/quarantine override records if those already fit.

---

# Phase 12 — Turn on Enforcement Gradually

## Objective

Avoid destabilizing JanumiCode by enforcing every validator at once.

## Recommended rollout

| Release | Enforcement level                          |
| ------- | ------------------------------------------ |
| R1      | Observe-only convergence records           |
| R2      | Enforce CRITICAL only                      |
| R3      | Enforce CRITICAL + deterministic BLOCK     |
| R4      | Enforce all BLOCK findings                 |
| R5      | Require explicit WARN defer/acceptance     |
| R6      | Add canary-based validator health blocking |
| R7      | Add severity profiles by workflow/domain   |

## Severity profiles

Adopt the feedback’s idea that severity should be configurable by profile. JanumiCode and JanumiLegal may share the ontology but differ in severity mappings. 

Example:

```json
{
  "severity_profile": "janumicode_default",
  "overrides": {
    "package_existence_validator": "CRITICAL",
    "gate_latency_validator": "INFO",
    "closed_world_boundary_validator": "BLOCK"
  }
}
```

---

# Recommended implementation sequence

The actual implementation order should be:

```text
1. Codebase reconciliation audit
2. Current validation flow map
3. Existing record inventory
4. Canonical finding adapter layer
5. Stage metadata
6. Observe-only convergence records
7. Repair event records
8. Targeted revalidation matrix
9. Enforced convergence before Phase Gates
10. Entity registry / identity convergence
11. Process validators
12. Canary injection
13. UI integration
14. Severity profiles
```

---

# Initial implementation backlog

## Epic 1 — Reconciliation and gap analysis

```text
Task 1.1: Inventory current validation-related classes and files.
Task 1.2: Map current Sub-Phase execution flow from context assembly to Phase Gate.
Task 1.3: Inventory all validation, repair, retry, gate, and quarantine records.
Task 1.4: Identify duplicate or overlapping mechanisms.
Task 1.5: Produce Current-State Validation Architecture document.
Task 1.6: Produce Gap Register and Remediation Plan.
```

## Epic 2 — Finding normalization

```text
Task 2.1: Define validator_finding_record schema.
Task 2.2: Add migration for finding records.
Task 2.3: Build ReasoningReviewFindingAdapter.
Task 2.4: Build InvariantFindingAdapter.
Task 2.5: Build VerificationEnsembleFindingAdapter.
Task 2.6: Build ScopeGatekeeperFindingAdapter.
Task 2.7: Store normalized findings in Governed Stream.
```

## Epic 3 — Convergence observe mode

```text
Task 3.1: Add ValidationConvergenceController shell.
Task 3.2: Add validation_convergence_record schema.
Task 3.3: Collect findings per artifact.
Task 3.4: Compute unresolved/resolved/unknown status.
Task 3.5: Emit observe-only convergence records.
Task 3.6: Add harness reporting for convergence summaries.
```

## Epic 4 — Repair events

```text
Task 4.1: Define repair_event schema.
Task 4.2: Add repair event writer.
Task 4.3: Wrap JSON repair with repair_event generation.
Task 4.4: Wrap retry/regeneration with repair_event generation.
Task 4.5: Link repair events to triggering findings.
Task 4.6: Compute artifact before/after hashes.
```

## Epic 5 — Targeted revalidation

```text
Task 5.1: Add ArtifactDiffService.
Task 5.2: Add validator impact matrix config.
Task 5.3: Select revalidation set from diff scope.
Task 5.4: Always rerun Entity Integrity family on identity/reference diffs.
Task 5.5: Record revalidation results.
```

## Epic 6 — Enforcement

```text
Task 6.1: Add convergence precondition to PhaseGateEvaluator.
Task 6.2: Enforce unresolved CRITICAL findings.
Task 6.3: Enforce deterministic BLOCK findings.
Task 6.4: Add human override path for residual risk.
Task 6.5: Add convergence evidence to Phase Gate UI.
```

## Epic 7 — Identity integrity

```text
Task 7.1: Define entity_registry schema.
Task 7.2: Register Phase 2 requirements as canonical entities.
Task 7.3: Add alias table.
Task 7.4: Add reference integrity checks.
Task 7.5: Add semantic identity reconciliation validator.
Task 7.6: Add human escalation for ambiguous identity resolution.
```

## Epic 8 — Process validation

```text
Task 8.1: Add GenerationContext record or projection.
Task 8.2: Add Context Sufficiency Validator.
Task 8.3: Add Registry Inclusion Validator.
Task 8.4: Add Provenance Tagging Validator.
Task 8.5: Add Injection Screening Validator.
Task 8.6: Add Validator Context Isolation Validator.
```

## Epic 9 — Meta-validation

```text
Task 9.1: Add canary artifact generator.
Task 9.2: Add deterministic corruption library.
Task 9.3: Run canaries in thin-slice harness.
Task 9.4: Emit validator_system finding when canary passes undetected.
Task 9.5: Add validator health dashboard.
```

---

# Near-term MVP cut

The smallest useful implementation is:

```text
1. Canonical validator_finding_record
2. Finding adapters for existing validators
3. validation_convergence_record in observe mode
4. repair_event for JSON repair and retry/regeneration
5. pre-gate convergence summary
6. harness report showing unresolved findings
```

That gives you value before enforcing anything.

The first enforcement cut should be:

```text
Unresolved CRITICAL findings block Phase Gate eligibility.
```

The second enforcement cut should be:

```text
Deterministic BLOCK findings block Phase Gate eligibility.
```

Only after that should LLM-judge BLOCK findings become hard blockers.

---

# The most important remediation recommendation

The current system appears to already have validators, reviews, repairs, and gates. The risk is not that JanumiCode lacks validation. The risk is that validation outcomes are not yet treated as durable obligations.

So the key remediation is:

> **Convert validator output from transient advice into governed obligations with lifecycle state.**

That lifecycle should be:

```text
OPEN
→ ASSIGNED_TO_REPAIR_PLAN
→ REPAIR_ATTEMPTED
→ REVALIDATION_PENDING
→ RESOLVED
```

or one of:

```text
HUMAN_ACCEPTED_RISK
DEFERRED_WITH_RATIONALE
SUPERSEDED_BY_STRONGER_FINDING
ESCALATED_TO_HUMAN
ROLLBACK_REQUIRED
```

No validator finding should disappear merely because the artifact was regenerated.

That is the core implementation move.
