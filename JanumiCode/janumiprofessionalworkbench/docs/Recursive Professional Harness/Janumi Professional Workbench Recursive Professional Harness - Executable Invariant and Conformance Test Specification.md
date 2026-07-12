# Janumi Professional Workbench Recursive Professional Harness

## Executable Invariant and Conformance Test Specification

**Document ID:** `RPH-DOC-008`
**Status:** Initial test baseline
**Applies to:** Product Realization PWA intent-to-architecture vertical slice
**Primary purpose:** Convert RPH architectural rules into executable tests that prevent semantic collapse into a conventional Execution Workflow engine
**Target test layers:** Domain unit tests, property-based tests, contract tests, persistence tests, replay tests, integration tests, and end-to-end conformance tests

## Canonical vocabulary context

The fixture under test is the Field Service Management SaaS Reference Undertaking, instantiated under the Product Realization PWA. Its runtime PWUs are PWU Instances in a Professional Work Graph. Compatibility projections may expose legacy Product Lens and phase labels, but those labels are never authoritative PWA, Undertaking, or PWU state.

---

# 1. Purpose

This specification defines the tests required to establish that the initial Recursive Professional Harness implementation conforms to its architecture.

The test suite must prove that Janumi Professional Workbench preserves the distinction among:

* user intent;
* professional work;
* execution strategy;
* runtime capability;
* evidence;
* assurance;
* governance;
* baseline state;
* visual presentation.

The suite must prevent implementations in which:

* successful model output automatically satisfies a PWU;
* completion of a legacy phase label becomes authoritative professional state;
* constraints disappear during decomposition;
* assumptions remain buried in prose;
* stale assessments approve changed objects;
* invalid evidence continues supporting claims;
* human decisions lack version binding;
* source commits are treated as accepted baselines;
* graph layout changes mutate professional semantics.

The suite is an executable architectural constitution.

---

# 2. Scope

## 2.1 Included

The initial suite covers:

* command-envelope validation;
* event-envelope validation;
* aggregate state transitions;
* PWU lifecycle;
* intent lifecycle;
* execution lifecycle;
* assurance lifecycle;
* baseline lifecycle;
* obligation preservation;
* constraint propagation;
* assumption disclosure and falsification;
* claim and evidence relationships;
* validator independence;
* policy disposition enforcement;
* human authority;
* semantic version binding;
* idempotency;
* optimistic concurrency;
* event replay;
* restart recovery;
* projection correctness;
* legacy Product Lens compatibility projection;
* Field Service Management SaaS Reference Undertaking fixture;
* intent-to-architecture vertical slice.

## 2.2 Deferred

The initial suite does not fully cover:

* unrestricted dynamic planning;
* distributed execution;
* multi-tenant SaaS isolation;
* arbitrary professional ontologies;
* marketplace-imported policies;
* numerical confidence aggregation;
* full implementation and release baselines;
* production deployment.

---

# 3. Test Taxonomy

The test suite is organized into seven layers.

## 3.1 Schema conformance tests

Verify structural validity of:

* commands;
* events;
* domain objects;
* validator outputs;
* policy definitions;
* projections;
* fixture files.

## 3.2 Domain invariant tests

Verify rules inside and across aggregates.

Examples:

* execution success cannot imply assurance success;
* approved intent must contain desired outcomes;
* authoritative baselines are immutable.

## 3.3 State-transition tests

Verify:

* legal transitions succeed;
* illegal transitions fail;
* required preconditions are enforced;
* appropriate events are emitted.

## 3.4 Property-based tests

Generate varied command sequences and structures to prove general properties.

Examples:

* mandatory obligations never silently disappear;
* duplicate commands never produce duplicate decisions.

## 3.5 Persistence and replay tests

Verify:

* event durability;
* aggregate reconstruction;
* projection rebuilding;
* outbox correctness;
* restart recovery;
* event upcasting.

## 3.6 Service integration tests

Verify collaboration among:

* Work Service;
* Execution Service;
* Assurance Service;
* Governance Service;
* Baseline Service;
* Traceability Service.

## 3.7 End-to-end conformance tests

Verify complete professional scenarios from intent through baseline promotion.

---

# 4. Test Conventions

## 4.1 Given–When–Then format

Each behavioral test should be written in the form:

```text
Given
    an established domain state

When
    a command or event occurs

Then
    the resulting state, events, errors, and side effects are asserted
```

## 4.2 Test identifiers

Use stable identifiers:

```text
RPH-INT-001
RPH-PWU-014
RPH-ASR-008
RPH-BAS-004
RPH-E2E-002
```

Recommended prefixes:

| Area            | Prefix    |
| --------------- | --------- |
| Contract/schema | `RPH-CON` |
| Intent          | `RPH-INT` |
| PWU             | `RPH-PWU` |
| Decomposition   | `RPH-DEC` |
| Constraint      | `RPH-CNS` |
| Assumption      | `RPH-ASM` |
| Execution       | `RPH-EXE` |
| Claim/evidence  | `RPH-EVD` |
| Assurance       | `RPH-ASR` |
| Governance      | `RPH-GOV` |
| Baseline        | `RPH-BAS` |
| Traceability    | `RPH-TRC` |
| Persistence     | `RPH-PER` |
| Projection      | `RPH-PRJ` |
| Compatibility   | `RPH-CMP` |
| End-to-end      | `RPH-E2E` |

## 4.3 Required assertions

Tests should assert more than final state.

Where applicable, assert:

* returned command status;
* error code;
* aggregate revision;
* semantic version;
* emitted event types;
* event payload;
* event order;
* created trace links;
* affected projections;
* outbox messages;
* absence of prohibited side effects.

---

# 5. Recommended Test Technology

The implementation may use:

* Vitest or Jest for TypeScript unit and integration testing;
* fast-check for property-based testing;
* Testcontainers for database integration;
* JSON Schema test utilities for contract conformance;
* snapshot tests only for stable serialized contracts;
* deterministic fixture replay;
* Playwright for VS Code webview or workbench UI tests where appropriate.

Avoid relying primarily on UI snapshot tests for semantic correctness.

The canonical domain behavior must be tested below the UI.

---

# 6. Schema and Contract Tests

## RPH-CON-001 — Minimum valid command envelope

**Given**

A command envelope containing all required fields.

**When**

It is validated against the command schema.

**Then**

Validation succeeds.

---

## RPH-CON-002 — Unknown command property rejected

**Given**

A canonical command payload with an undeclared property.

**When**

The payload is validated.

**Then**

Validation fails with:

```text
RPH_VALIDATION_SCHEMA_FAILED
```

---

## RPH-CON-003 — Missing expected revision on aggregate update

**Given**

A command that updates an existing aggregate.

**When**

`expectedRevision` is omitted.

**Then**

The command is rejected unless the command type is explicitly exempt.

---

## RPH-CON-004 — Malformed timestamp rejected

**Given**

A command containing a non-RFC-3339 timestamp.

**Then**

Schema validation fails.

---

## RPH-CON-005 — Validator result with missing criterion rejected

**Given**

An active policy with five mandatory criteria.

**When**

A validator result includes only four criterion results.

**Then**

The Assurance Service rejects the result with:

```text
RPH_VALIDATOR_OUTPUT_INVALID
```

---

## RPH-CON-006 — Policy version mismatch rejected

**Given**

An assessment created under policy version `1.2.0`.

**When**

A validator returns a result for policy version `1.1.0`.

**Then**

The result is rejected with:

```text
RPH_POLICY_VERSION_MISMATCH
```

---

## RPH-CON-007 — Subject semantic version mismatch rejected

**Given**

An assessment targeting Architecture semantic version 2.

**When**

The validator result claims to assess version 1.

**Then**

The result is rejected with:

```text
RPH_SUBJECT_VERSION_MISMATCH
```

---

## RPH-CON-008 — Presentation schema cannot mutate semantic state

**Given**

A canvas-layout command.

**When**

Its schema is inspected or executed.

**Then**

It cannot contain:

* semantic version fields;
* PWU lifecycle mutations;
* assurance disposition mutations;
* baseline operations.

---

## RPH-CON-009 — PWU Instance ownership binding

**Given**

An Undertaking bound to Product Realization PWA version 1.3.

**When**

A PWU Instance is proposed.

**Then**

* `undertakingId` identifies that Undertaking;
* a non-local instance's `pwuTypeId` resolves to a PWU Type in Product Realization PWA version 1.3;
* an Undertaking-local instance sets `isLocalExtension = true` and does not claim a published `pwuTypeId`;
* a `pwuKind` string alone is insufficient to establish either binding.

---

# 7. Intent Lifecycle Tests

## RPH-INT-001 — Capture raw intent

**Given**

A valid originating expression.

**When**

`CaptureIntent` is accepted.

**Then**

* `IntentCaptured` is emitted;
* intent status is `RAW`;
* semantic version is 1;
* revision is 1;
* `undertakingId` binds the Intent to the owning Undertaking;
* originating expression is preserved exactly;
* no formalized objective is inferred automatically.

---

## RPH-INT-002 — Formalize intent

**Given**

An intent in `UNDER_DISCOVERY`.

**When**

`FormalizeIntent` is accepted.

**Then**

* status becomes `FORMALIZED`;
* semantic version increments;
* desired outcomes and success conditions are persisted;
* `IntentFormalized` is emitted.

---

## RPH-INT-003 — Cannot approve raw intent

**Given**

An intent in `RAW`.

**When**

`ApproveIntent` is issued.

**Then**

The command is rejected with:

```text
RPH_ILLEGAL_STATE_TRANSITION
```

---

## RPH-INT-004 — Approved intent requires desired outcome

**Given**

A formalized intent with no desired outcomes.

**When**

Approval is requested.

**Then**

Approval is rejected with:

```text
RPH_INVARIANT_VIOLATION
```

---

## RPH-INT-005 — Approval binds semantic version

**Given**

Intent semantic version 3.

**When**

A human approves semantic version 3.

**Then**

The approval decision references version 3.

If version 4 is later created, the version-3 approval does not authorize version 4.

---

## RPH-INT-006 — Intent revision triggers impact analysis

**Given**

An approved intent with descendant PWUs and an Architecture Baseline.

**When**

The intent is materially revised.

**Then**

* semantic version increments;
* `IntentRevised` is emitted;
* impact analysis is requested;
* affected descendants are classified;
* the prior baseline remains immutable;
* prior approvals are marked review-required where applicable.

---

## RPH-INT-007 — Superseded intent cannot authorize new work

**Given**

An intent in `SUPERSEDED`.

**When**

a new PWU is proposed using it as authority.

**Then**

The command is rejected.

---

# 8. PWU Lifecycle Tests

## RPH-PWU-001 — Propose PWU

**Given**

A valid intent.

**When**

`ProposePwu` is accepted.

**Then**

* state is `PROPOSED`;
* execution state is `NOT_PLANNED`;
* assurance state is `UNASSESSED`;
* shape integrity is `UNKNOWN`;
* `PwuProposed` is emitted.

---

## RPH-PWU-002 — PWU requires intent

**Given**

A proposed PWU without an intent reference.

**Then**

The command is rejected.

---

## RPH-PWU-003 — Non-root PWU requires parent

**Given**

A non-root PWU without a parent or independent authority.

**Then**

The command is rejected.

---

## RPH-PWU-004 — Mark PWU ready requires shape readiness

**Given**

A PWU missing expected outputs and verification criteria.

**When**

`MarkPwuReady` is issued.

**Then**

The command is rejected.

---

## RPH-PWU-005 — Execution success does not satisfy PWU

**Given**

A PWU in `EXECUTING`.

**When**

its active execution plan succeeds.

**Then**

* execution state becomes `SUCCEEDED`;
* lifecycle becomes `EVIDENCE_PENDING`;
* assurance state is not automatically `SATISFIED`;
* PWU lifecycle is not `SATISFIED`.

---

## RPH-PWU-006 — Assurance satisfaction permits PWU satisfaction

**Given**

* execution succeeded;
* required evidence is admitted;
* all mandatory assurance assessments are satisfied.

**When**

the controller evaluates the PWU.

**Then**

the PWU may transition to `SATISFIED`.

---

## RPH-PWU-007 — Rejected assurance prevents satisfaction

**Given**

execution state `SUCCEEDED`.

**And**

a required assurance assessment is `REJECTED`.

**Then**

the PWU cannot transition to `SATISFIED`.

---

## RPH-PWU-008 — Invalidated PWU cannot baseline

**Given**

a PWU in `INVALIDATED`.

**When**

baseline promotion is requested.

**Then**

promotion is rejected.

---

## RPH-PWU-009 — Superseded PWU cannot execute

**Given**

a PWU in `SUPERSEDED`.

**When**

an execution step is started.

**Then**

the command is rejected.

---

## RPH-PWU-010 — Baselined PWU cannot resume execution in place

**Given**

a PWU in `BASELINED`.

**When**

new execution is requested against the same semantic version.

**Then**

the command is rejected.

A successor revision or successor PWU is required.

---

# 9. Decomposition Tests

## RPH-DEC-001 — Valid decomposition

**Given**

a parent PWU with three mandatory obligations.

**And**

children collectively allocate all three obligations.

**And**

all applicable constraints are propagated or retained.

**And**

a recomposition contract exists.

**When**

the decomposition is assessed.

**Then**

it may become `VALID`.

---

## RPH-DEC-002 — Missing mandatory obligation

**Given**

a parent with a mandatory obligation not allocated, retained, satisfied, or waived.

**When**

decomposition validation runs.

**Then**

* finding `MISSING_OBLIGATION_ALLOCATION` is emitted;
* decomposition is `INVALID`;
* child execution is blocked.

---

## RPH-DEC-003 — Silent constraint drop

**Given**

a mandatory parent security constraint.

**And**

a relevant child does not inherit or disposition the constraint.

**Then**

decomposition is rejected.

---

## RPH-DEC-004 — Child intent divergence

**Given**

a parent PWU for small-business field-service software.

**And**

a child PWU introduces national-enterprise workforce optimization without authorization.

**Then**

* `CHILD_INTENT_DIVERGENCE` is emitted;
* decomposition is rejected or requires human decision.

---

## RPH-DEC-005 — Missing recomposition contract

**Given**

a material parent decomposed into children.

**When**

no recomposition strategy exists.

**Then**

the decomposition cannot become valid.

---

## RPH-DEC-006 — All children complete but parent recomposition fails

**Given**

all child PWUs are individually satisfied.

**And**

their artifacts use incompatible tenant-identity models.

**When**

recomposition runs.

**Then**

* parent is not satisfied;
* recomposition state becomes `CONFLICTED`;
* conflict observation is emitted.

---

## RPH-DEC-007 — Property: no obligation disappears

Generate:

* arbitrary parent obligations;
* arbitrary child allocations;
* retained obligations;
* waivers.

Property:

```text
mandatory parent obligations
=
allocated
+ retained
+ already satisfied
+ authorized waivers
```

Any generated decomposition violating the equation must be rejected.

---

# 10. Constraint Tests

## RPH-CNS-001 — Constraint propagation preserves strength

**Given**

a mandatory parent constraint.

**When**

propagated to a child.

**Then**

the child constraint remains mandatory unless an authorized decision changes it.

---

## RPH-CNS-002 — Constraint weakening requires authority

**Given**

a mandatory security constraint.

**When**

a model proposes changing it to advisory.

**Then**

the mutation is rejected without authority.

---

## RPH-CNS-003 — Inapplicability requires rationale

**Given**

a mandatory parent constraint.

**When**

a child marks it inapplicable.

**Then**

a rationale and authority or policy basis are required.

---

## RPH-CNS-004 — Expired waiver no longer satisfies constraint disposition

**Given**

a constraint waiver with an expiration.

**When**

the expiration passes.

**Then**

* the waiver becomes expired;
* affected work becomes review-required;
* baseline promotion is blocked if the constraint remains applicable.

---

# 11. Assumption Tests

## RPH-ASM-001 — Material assumption becomes first-class

**Given**

a model output containing a material implementation premise.

**When**

Assumption Disclosure runs.

**Then**

an Assumption Object is created and linked to affected objects.

---

## RPH-ASM-002 — Assumption cannot remain only in prose

**Given**

a validator identifies a material assumption.

**When**

the assessment completes without creating an Assumption Object.

**Then**

the assessment result is rejected or remains incomplete.

---

## RPH-ASM-003 — Accepted is not verified

**Given**

a human accepts a material assumption.

**Then**

its status becomes `ACCEPTED`, not `VERIFIED`.

---

## RPH-ASM-004 — Falsified assumption triggers impact analysis

**Given**

a verified or accepted assumption supporting architecture and plan objects.

**When**

contradicting evidence falsifies it.

**Then**

* status becomes `FALSIFIED`;
* `AssumptionFalsified` is emitted;
* impact analysis is required;
* affected PWUs become `AT_RISK`, `RESHAPING_REQUIRED`, or `INVALIDATED`;
* dependent claims are reviewed.

---

## RPH-ASM-005 — Critical assumption blocks irreversible work

**Given**

a critical assumption is unresolved.

**When**

an irreversible execution step is requested.

**Then**

execution is blocked unless:

* the assumption is verified; or
* authorized acceptance explicitly permits proceeding.

---

## RPH-ASM-006 — Expired assumption cannot authorize new work

**Given**

an assumption in `EXPIRED`.

**When**

a new execution plan depends on it.

**Then**

plan approval is rejected.

---

# 12. Execution Tests

## RPH-EXE-001 — One active plan per PWU

**Given**

a PWU with an active plan.

**When**

a second plan is activated without superseding the first.

**Then**

the command is rejected.

---

## RPH-EXE-002 — Superseded plan cannot start step

**Given**

an execution plan in `SUPERSEDED`.

**When**

a step start is requested.

**Then**

the command is rejected.

---

## RPH-EXE-003 — Runtime binding authorization required

**Given**

an approved execution plan.

**And**

a runtime binding in `REQUESTED`.

**When**

execution starts.

**Then**

the command is rejected.

---

## RPH-EXE-004 — Requested capability is not granted capability

**Given**

a runtime binding requesting file-system and network access.

**And**

only file-system access is granted.

**Then**

network operations fail authorization.

---

## RPH-EXE-005 — Step precondition enforcement

**Given**

an execution step whose required input artifact is absent.

**When**

the step is started.

**Then**

the step remains not ready and no model/tool invocation occurs.

---

## RPH-EXE-006 — Step success requires explicit result

**Given**

a running step.

**When**

completion is requested without output or explicit no-output result.

**Then**

completion is rejected.

---

## RPH-EXE-007 — Duplicate external side effect prevented

**Given**

an execution attempt that creates a source-control commit.

**When**

the command is retried with the same idempotency key.

**Then**

no second commit occurs.

---

## RPH-EXE-008 — Retry exhaustion triggers alternate control action

**Given**

a retry policy with maximum three attempts.

**When**

the third retry fails.

**Then**

the controller must not issue a fourth retry.

It must select:

* change tactic;
* replan;
* escalate;
* reject;
* abandon.

---

## RPH-EXE-009 — Model output treated as untrusted

**Given**

a model returns a malformed structured result.

**Then**

* raw output is retained for diagnostics;
* boundary validation fails;
* authoritative objects are not created;
* retry or alternate strategy may be selected.

---

# 13. Claim and Evidence Tests

## RPH-EVD-001 — Completion assertion creates claim

**Given**

an agent states that architecture is complete.

**Then**

the statement must become or reference a Claim Object before assurance can evaluate it.

---

## RPH-EVD-002 — Supported claim requires evidence

**Given**

a claim with no admissible evidence.

**When**

status is changed to `SUPPORTED`.

**Then**

the command is rejected.

---

## RPH-EVD-003 — Evidence requires provenance

**Given**

an Evidence Object with no producing actor or source.

**Then**

admission is rejected.

---

## RPH-EVD-004 — Evidence scope enforced

**Given**

a unit-test result.

**When**

it is used to support full product fitness.

**Then**

the assessment must reject or qualify the evidence as out of scope.

---

## RPH-EVD-005 — Invalidated evidence propagates

**Given**

admissible evidence supporting two claims and one assessment.

**When**

the evidence is invalidated.

**Then**

* dependent claims become contested or under assessment;
* dependent assessment becomes invalidated or review-required;
* baseline readiness is recalculated.

---

## RPH-EVD-006 — Contradictory evidence remains visible

**Given**

one evidence item supports a claim and another contradicts it.

**Then**

both remain attached.

The system cannot silently discard the contradicting evidence.

---

## RPH-EVD-007 — Generated prose is not automatically admitted

**Given**

a model-generated architecture explanation.

**Then**

it may be an Artifact.

It becomes Evidence only after evidence admission evaluates provenance, relevance, scope, and limitations.

---

# 14. Assurance Tests

## RPH-ASR-001 — Required policy activates

**Given**

an Architecture PWU enters `EVIDENCE_PENDING`.

**And**

Architecture Coverage is required for its profile.

**Then**

an Assurance Assessment is requested.

---

## RPH-ASR-002 — Missing required evidence

**Given**

an Architecture Coverage assessment without a requirement trace matrix.

**Then**

the assessment becomes:

* `EVIDENCE_PENDING`; or
* `INCONCLUSIVE`.

It cannot become `SATISFIED`.

---

## RPH-ASR-003 — Required independence enforced

**Given**

a policy requiring `DIFFERENT_AGENT`.

**And**

the same producing agent is selected as validator.

**Then**

* evaluation is blocked;
* `INDEPENDENCE_VIOLATION` is recorded;
* a different validator or waiver is required.

---

## RPH-ASR-004 — Validator recommendation is not authoritative disposition

**Given**

a validator recommends `SATISFIED`.

**And**

one blocking criterion is `NOT_MET`.

**Then**

the Assurance Service rejects the recommendation and produces `REJECTED`.

---

## RPH-ASR-005 — Unable to determine is not met

**Given**

a mandatory criterion result `UNABLE_TO_DETERMINE`.

**Then**

the assessment cannot become satisfied.

---

## RPH-ASR-006 — Validator execution failure differs from rejection

**Given**

a validator times out.

**Then**

assessment state becomes `VALIDATOR_FAILED` or returns to ready for retry.

The assessed work is not automatically rejected.

---

## RPH-ASR-007 — Invalid validator schema cannot mutate state

**Given**

a validator returns malformed JSON.

**Then**

* output is rejected;
* no authoritative observations are created;
* no assurance disposition changes;
* diagnostic evidence is retained.

---

## RPH-ASR-008 — Open critical finding blocks satisfaction

**Given**

a critical open observation.

**Then**

aggregate assurance cannot be `SATISFIED`.

---

## RPH-ASR-009 — Conditional assurance remains conditional

**Given**

an assessment is conditionally satisfied subject to offline behavior being deferred.

**Then**

the condition remains visible in:

* assessment;
* PWU assurance view;
* review package;
* baseline package.

---

## RPH-ASR-010 — Semantic change invalidates prior assessment

**Given**

an assessment of Architecture semantic version 2.

**When**

Architecture version 3 is created.

**Then**

the version-2 assessment cannot satisfy version 3.

---

## RPH-ASR-011 — Conflicting validators preserved

**Given**

one valid assessment supports a claim.

**And**

another valid assessment rejects it.

**Then**

* both remain visible;
* aggregate state becomes contested, inconclusive, or escalated;
* results are not averaged silently.

---

## RPH-ASR-012 — Policy composition uses strictest unresolved disposition

**Given**

five required policies:

* four satisfied;
* one rejected.

**Then**

aggregate assurance is rejected.

---

# 15. Governance and Waiver Tests

## RPH-GOV-001 — Approval requires authority

**Given**

an agent without approval authority.

**When**

it issues `ApproveDecision`.

**Then**

the command is rejected with:

```text
RPH_AUTHORITY_INSUFFICIENT
```

---

## RPH-GOV-002 — Recommendation is not approval

**Given**

a Product Owner agent recommends approval.

**Then**

no effective governance decision exists until an authorized actor approves it.

---

## RPH-GOV-003 — Decision binds subject versions

**Given**

Architecture version 2 is approved.

**When**

Architecture version 3 is created.

**Then**

the version-2 decision does not approve version 3.

---

## RPH-GOV-004 — Human override preserves findings

**Given**

a human grants a waiver for a material finding.

**Then**

* the finding remains visible;
* disposition becomes `WAIVED`;
* rationale and authority are recorded;
* evidence is unchanged.

---

## RPH-GOV-005 — Waiver scope enforced

**Given**

a waiver for policy criterion `AC-04` on Architecture version 2.

**Then**

it does not waive:

* another criterion;
* another object;
* Architecture version 3.

---

## RPH-GOV-006 — Expired waiver blocks promotion

**Given**

a required waiver is expired.

**When**

baseline promotion is requested.

**Then**

promotion is rejected.

---

## RPH-GOV-007 — Decision revocation triggers impact analysis

**Given**

an effective Architecture approval.

**When**

the decision is revoked.

**Then**

* Architecture Baseline becomes review-required or revoked;
* downstream planning is impacted;
* impact analysis is initiated.

---

# 16. Baseline Tests

## RPH-BAS-001 — Candidate baseline identifies exact versions

**Given**

an Architecture Baseline candidate.

**Then**

every item includes:

* object ID;
* semantic version;
* content hash where applicable.

---

## RPH-BAS-002 — Baseline version mismatch rejected

**Given**

a reviewed artifact hash.

**When**

promotion specifies a different hash.

**Then**

promotion fails with:

```text
RPH_BASELINE_VERSION_MISMATCH
```

---

## RPH-BAS-003 — Open blocking finding prevents promotion

**Given**

an open blocking tenant-isolation finding.

**When**

Architecture Baseline promotion is requested.

**Then**

promotion is rejected.

---

## RPH-BAS-004 — Missing required assessment prevents promotion

**Given**

Baseline Promotion requires:

* Architecture Coverage;
* Intent Preservation;
* Assumption Disclosure.

**And**

Intent Preservation has not completed.

**Then**

promotion is rejected.

---

## RPH-BAS-005 — Authoritative baseline immutable

**Given**

an authoritative Architecture Baseline.

**When**

an item is changed.

**Then**

the original baseline is unchanged.

A successor baseline must be created.

---

## RPH-BAS-006 — Commit is not baseline

**Given**

source code or architecture artifacts are committed to version control.

**Then**

no baseline becomes authoritative without promotion decision and assurance.

---

## RPH-BAS-007 — Supersession preserves history

**Given**

Architecture Baseline 1 is superseded by Baseline 2.

**Then**

* Baseline 1 remains queryable;
* supersession trace exists;
* prior evidence and decision remain intact.

---

# 17. Traceability Tests

## RPH-TRC-001 — Intent-to-baseline path exists

For an authoritative Architecture Baseline, a typed path must exist from:

```text
Originating expression
→ approved intent
→ Architecture PWU
→ Architecture Artifact
→ Claim
→ Evidence
→ Assurance Assessment
→ Approval Decision
→ Architecture Baseline
```

---

## RPH-TRC-002 — Constraint propagation path exists

For each mandatory architecture constraint, a trace must exist to relevant child PWUs and artifacts.

---

## RPH-TRC-003 — Unsupported object detected

Given an Architecture Artifact with no producing PWU or execution attempt.

Then traceability validation fails.

---

## RPH-TRC-004 — Trace link is immutable

Given an existing trace link.

When its relation is corrected.

Then a replacement or superseding link is created; the old link is not overwritten silently.

---

## RPH-TRC-005 — Invalidated source affects downstream trace

Given invalidated evidence supporting a claim.

Then downstream traceability indicates that the claim support is no longer valid.

---

# 18. Concurrency and Idempotency Tests

## RPH-PER-001 — Optimistic concurrency conflict

**Given**

aggregate revision 5.

**And**

two commands expect revision 5.

**When**

the first succeeds and produces revision 6.

**Then**

the second is rejected with:

```text
RPH_REVISION_CONFLICT
```

---

## RPH-PER-002 — Duplicate command returns prior result

**Given**

a previously accepted command with an idempotency key.

**When**

the same key is submitted again.

**Then**

* no new domain events are emitted;
* the original result is returned.

---

## RPH-PER-003 — Duplicate decision prevented

A retried approval request cannot create two effective decisions.

---

## RPH-PER-004 — Duplicate baseline prevented

A retried baseline-promotion command cannot create two authoritative baselines.

---

## RPH-PER-005 — Event revision sequence enforced

Events for an aggregate must have contiguous revisions.

A gap or duplicate revision is rejected by the event store.

---

# 19. Persistence and Replay Tests

## RPH-PER-006 — Aggregate replay equivalence

**Given**

an event stream for an Intent or PWU.

**When**

the aggregate is reconstructed.

**Then**

its state matches the materialized current state.

---

## RPH-PER-007 — Projection rebuild

**Given**

all domain events and empty projection tables.

**When**

projections are rebuilt.

**Then**

Work, Assurance, and Compatibility views match the expected fixture projections.

---

## RPH-PER-008 — Outbox atomicity

**Given**

a successful aggregate mutation.

**Then**

domain events and outbox rows are committed atomically.

A transaction rollback leaves neither persisted.

---

## RPH-PER-009 — Projection lag does not change authoritative state

**Given**

the read projection is behind.

**Then**

commands continue to validate against canonical aggregate state, not stale projection state.

---

## RPH-PER-010 — Event upcasting

**Given**

a persisted version-1 event.

**When**

the current runtime loads it.

**Then**

the registered upcaster produces the current internal representation without rewriting the event.

---

# 20. Restart and Recovery Tests

## RPH-PER-011 — Restart after command persistence

**Given**

events are committed but projection update is interrupted.

**When**

the service restarts.

**Then**

the projection is eventually updated from the event/outbox stream.

---

## RPH-PER-012 — Restart during model invocation

**Given**

an execution attempt was started before restart.

**And**

the external operation’s completion is uncertain.

**When**

the runtime restarts.

**Then**

the attempt enters a reconciliation state.

The system must not blindly repeat the side effect.

---

## RPH-PER-013 — Restart during human wait

**Given**

a PWU waiting for human approval.

**When**

the extension restarts.

**Then**

the pending decision remains available and no duplicate review request is created.

---

## RPH-PER-014 — Restart after validator result but before assessment disposition

**Given**

a valid raw validator result persisted.

**When**

the Assurance Service restarts before authoritative disposition.

**Then**

processing resumes idempotently.

---

# 21. Projection Tests

## RPH-PRJ-001 — Work View shows independent states

A PWU with:

* execution `SUCCEEDED`;
* assurance `REJECTED`;
* shape integrity `AT_RISK`;

must display all three states distinctly.

---

## RPH-PRJ-002 — Green status requires assurance

The UI cannot show an unqualified green completion indicator when execution succeeded but assurance remains incomplete.

---

## RPH-PRJ-003 — Linked selection consistency

Selecting a PWU in Work View must select the same underlying object in:

* Execution View;
* Assurance View;
* Traceability View.

---

## RPH-PRJ-004 — Layout change updates presentation only

Moving a node:

* updates presentation revision;
* does not change semantic version;
* emits no PWU semantic event;
* does not invalidate assurance.

---

## RPH-PRJ-005 — Open finding count accurate

Observation counts shown on a node must match canonical open observations by severity.

---

# 22. Compatibility Projection Tests

## RPH-CMP-001 — INTAKE milestone derived

Given an approved Intent Baseline and completed intent PWUs.

Then compatibility milestone `INTAKE` is `COMPLETE`.

---

## RPH-CMP-002 — Legacy phase label is non-authoritative

Changing the legacy compatibility phase field directly must not mutate PWU or assurance state.

---

## RPH-CMP-003 — Architecture milestone may be complete while root remains incomplete

Given Architecture Baseline is promoted but implementation has not begun.

Then:

* `ARCHITECTURE = COMPLETE`;
* root Product Realization PWU Instance is not complete.

---

## RPH-CMP-004 — REPLAN derived from control action

A `REPLAN` compatibility milestone may be shown when a replan control action is active.

It is not stored as the semantic lifecycle state.

---

# 23. Product Realization PWA Reference Undertaking Fixture Tests

## RPH-FIX-001 — Fixture reference integrity

Every object reference in the Field Service Management SaaS Reference Undertaking fixture resolves.

---

## RPH-FIX-002 — Fixture schema validity

Every fixture file validates against its registered schema.

---

## RPH-FIX-003 — Expected event replay

Replaying `expected-events.jsonl` produces:

* approved Intent Baseline;
* satisfied Product Behavior PWU;
* authoritative Architecture Baseline;
* expected open residual condition.

---

## RPH-FIX-004 — Architecture decomposition coverage

All architecture obligations in the fixture are allocated to child PWUs.

---

## RPH-FIX-005 — Tenant isolation traceability

The fixture must expose:

```text
Multi-Tenancy Constraint
→ Multi-Tenancy Architecture PWU
→ Tenant Isolation Artifact
→ Tenant Isolation Claim
→ Assurance Assessment
→ Implementation Verification Obligation
```

---

## RPH-FIX-006 — Offline condition remains explicit

The deferred offline capability must remain represented as:

* assumption or constraint;
* residual condition;
* baseline scope statement;
* future implementation obligation where applicable.

---

# 24. End-to-End Scenarios

## RPH-E2E-001 — Normal intent-to-architecture success

### Given

A user requests a Field Service Management SaaS, and the Product Realization PWA is instantiated as the Field Service Management SaaS Undertaking for that objective.

### When

The system:

1. captures the intent;
2. conducts intent discovery;
3. formalizes intent;
4. runs Intent Fidelity and Completeness;
5. obtains human approval;
6. creates Intent Baseline;
7. creates Architecture PWU and decomposition;
8. validates decomposition;
9. executes architecture generation;
10. captures assumptions and evidence;
11. runs Architecture Coverage and Intent Preservation;
12. obtains human approval;
13. promotes Architecture Baseline.

### Then

* intent is approved;
* Architecture PWU is baselined;
* evidence and assessments are traceable;
* compatibility milestone shows Architecture complete;
* root Product Realization PWU Instance remains incomplete.

---

## RPH-E2E-002 — Architecture execution succeeds but assurance fails

### Given

Architecture generation succeeds.

### And

the architecture lacks enforceable tenant isolation.

### When

Architecture Coverage runs.

### Then

* execution state is `SUCCEEDED`;
* assurance state is `REJECTED`;
* Architecture PWU is not satisfied;
* a blocking observation is created;
* baseline promotion is unavailable;
* controller recommends reshape or replan.

---

## RPH-E2E-003 — Material assumption falsified

### Given

Architecture assumes small-business scale.

### When

the user clarifies that the product must support national enterprises.

### Then

* assumption becomes falsified;
* intent is revised;
* impact analysis identifies architecture and behavior PWUs;
* Architecture Baseline remains immutable but review-required;
* successor architecture work is created;
* stale approval is not reused.

---

## RPH-E2E-004 — Human waiver

### Given

A material but noncritical observation remains open.

### When

an authorized human grants a scoped waiver.

### Then

* finding remains visible;
* waiver records rationale and expiration;
* assurance becomes waived or conditionally satisfied;
* baseline package includes the waiver;
* unrelated findings remain unaffected.

---

## RPH-E2E-005 — Validator disagreement

### Given

one architecture validator approves tenant isolation.

### And

an independent security validator rejects it.

### Then

* both assessments are preserved;
* aggregate assurance is contested or rejected;
* human review package summarizes disagreement;
* baseline is not promoted automatically.

---

## RPH-E2E-006 — Restart during architecture execution

### Given

architecture generation begins.

### When

the extension or runtime restarts before completion status is known.

### Then

* attempt state is reconciled;
* duplicate generation or side effects are avoided;
* execution resumes or is retried according to policy;
* event history remains coherent.

---

## RPH-E2E-007 — Changed artifact after approval

### Given

Architecture version 2 is approved.

### When

the artifact changes to version 3 before baseline promotion.

### Then

* promotion using version-2 decision is rejected;
* assurance and approval for version 3 are required.

---

# 25. Property-Based Test Catalog

## Property P1 — Execution never implies assurance

For any generated legal command sequence:

```text
executionState = SUCCEEDED
```

must never alone cause:

```text
assuranceState = SATISFIED
```

---

## Property P2 — Mandatory obligations persist

For every valid decomposition, every mandatory parent obligation has exactly one or more valid dispositions:

* allocated;
* retained;
* satisfied;
* authorized waiver.

---

## Property P3 — Mandatory constraints persist

For every relevant child, every mandatory applicable parent constraint is:

* propagated;
* retained;
* inapplicable with valid rationale;
* waived;
* superseded.

---

## Property P4 — Invalid evidence cannot support active satisfaction

For every state:

If evidence is invalidated, no active supported claim or satisfied assessment may rely exclusively on it.

---

## Property P5 — Semantic version approval isolation

A decision approving semantic version `n` never authorizes semantic version `n+1`.

---

## Property P6 — Idempotent commands

For every command:

Executing the same idempotency key multiple times produces the same business result and no additional domain events.

---

## Property P7 — Authoritative baselines immutable

No legal command mutates an authoritative baseline’s item set.

---

## Property P8 — Presentation independence

For arbitrary layout changes, semantic object versions and assurance states remain unchanged.

---

# 26. Mutation Testing Requirements

Use mutation testing on critical invariant handlers.

Mutations that must be caught include:

* removing the assurance check before PWU satisfaction;
* allowing baseline promotion with an open blocking finding;
* removing semantic-version comparison;
* treating `UNABLE_TO_DETERMINE` as `MET`;
* allowing expired waivers;
* omitting expected-revision checks;
* accepting invalid evidence;
* allowing duplicate idempotency effects;
* dropping mandatory constraints during decomposition.

Critical domain modules should achieve a high mutation score, not merely line coverage.

---

# 27. Coverage Expectations

Coverage goals should prioritize decision logic.

Recommended minimums:

| Area                         | Branch coverage |
| ---------------------------- | --------------: |
| State-transition guards      |            100% |
| Domain invariant handlers    |            100% |
| Assurance disposition engine |            100% |
| Baseline promotion checks    |            100% |
| Command idempotency          |            100% |
| Event upcasters              |            100% |
| Projection builders          |             90% |
| UI components                |      Risk-based |

Line coverage alone is not sufficient.

---

# 28. Test Data Builders

Provide typed builders for:

```text
PwaVersionBuilder
PwuTypeBuilder
UndertakingBuilder
IntentBuilder
PwuInstanceBuilder
ConstraintBuilder
AssumptionBuilder
ClaimBuilder
EvidenceBuilder
AssurancePolicyBuilder
AssessmentBuilder
ObservationBuilder
ExecutionPlanBuilder
DecisionBuilder
BaselineBuilder
```

Builders should default to valid minimum objects.

Tests that need invalid objects should modify one characteristic deliberately.

This keeps failures attributable.

---

# 29. Model and Validator Test Doubles

Provide:

* deterministic successful model;
* malformed-output model;
* timeout model;
* contradictory validator;
* stale-evidence validator;
* same-agent independence violator;
* human approval stub;
* denied-authority actor;
* external tool with idempotency support;
* external tool with uncertain completion.

Do not mock away domain boundaries in integration tests.

---

# 30. CI Test Stages

Recommended pipeline:

## Stage 1 — Static contracts

* TypeScript compilation;
* schema validation;
* generated-type drift check;
* policy-definition validation.

## Stage 2 — Domain unit tests

* state transitions;
* invariants;
* disposition rules;
* authority rules.

## Stage 3 — Property and mutation tests

* obligation preservation;
* constraint propagation;
* idempotency;
* semantic version isolation.

## Stage 4 — Persistence tests

* event store;
* concurrency;
* outbox;
* replay;
* projection rebuild.

## Stage 5 — Fixture conformance

* fixture schema;
* event replay;
* expected projections;
* traceability.

## Stage 6 — Vertical-slice integration

* intent to Architecture Baseline.

## Stage 7 — UI projection tests

* Work View;
* Assurance View;
* linked selection;
* state rendering.

---

# 31. Failure Reporting

A failed conformance test should identify:

* test ID;
* architectural rule;
* command sequence;
* aggregate state;
* expected events;
* actual events;
* semantic versions;
* relevant trace links;
* invariant violated.

Example:

```text
RPH-ASR-004 failed

Rule:
Validator recommendation cannot override mandatory policy criteria.

Expected:
AssuranceAssessmentRejected

Actual:
AssuranceAssessmentSatisfied

Blocking criterion:
AC-07 Tenant isolation boundary — NOT_MET

Subject:
pwu_architecture v3

Validator:
validator.architecture-review v1.2.0
```

---

# 32. Definition of Done

The executable invariant and conformance suite is complete for the first vertical slice when:

1. All listed legal transition tests pass.
2. All listed illegal transition tests pass.
3. Property-based obligation and constraint tests pass.
4. Validator independence is enforced.
5. Invalidated evidence propagation is tested.
6. Human authority and waiver scope are tested.
7. Baseline version binding is tested.
8. Duplicate command effects are prevented.
9. Event replay reconstructs canonical state.
10. Projection rebuild produces expected views.
11. Restart-recovery scenarios pass.
12. The Field Service Management SaaS Reference Undertaking fixture passes conformance mode.
13. The complete intent-to-architecture scenario passes.
14. Architecture execution success with assurance failure is demonstrated.
15. Canvas layout changes have no semantic effects.
16. Critical mutation tests are detected.
17. CI fails when an architectural invariant is violated.

---

# 33. Closing Test Rule

The test suite must prove not merely that Janumi Professional Workbench can execute a sequence of operations.

It must prove that the system refuses to confuse:

* an instruction with intent;
* a task with professional obligation;
* an output with evidence;
* evidence with proof;
* validator prose with assurance;
* execution success with satisfaction;
* human preference with authority;
* a commit with an accepted baseline;
* an Execution Workflow visualization with the professional work itself.

When these distinctions are executable and continuously tested, the Recursive Professional Harness ceases to be only an architectural idea.

It becomes an enforceable property of the system.
