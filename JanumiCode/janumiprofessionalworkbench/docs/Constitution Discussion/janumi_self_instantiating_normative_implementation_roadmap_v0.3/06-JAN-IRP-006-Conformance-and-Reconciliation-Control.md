# JAN-IRP-006 — Conformance and Reconciliation Control

**Version:** 0.3.0  
**Status:** Proposed Normative Draft  
**Program phases:** `P3–P4`  
**Purpose:** Govern requirement applicability, current-state conformance claims, implementation–specification discrepancies, and the professional judgment required to determine what shall change.

## 1. Central rule

Neither implementation nor documentation shall be presumed correct merely because it exists, is newer, or appears formal.

```text
Implementation evidence establishes current reality.
Approved normative sources establish target intent to the extent that they remain valid.
Conflict requires explicit reconciliation.
```

## 2. Unit of assessment

The unit of assessment is a stable requirement from the controlled requirement register.

Each assessment shall contain:

```text
assessmentId
requirementId
applicability
conformanceStatus
assessmentConfidence
currentImplementationSummary
implementationReferences
testReferences
runtimeEvidenceReferences
semanticAnalysis
gapDescription
discrepancyIds
recommendedDisposition
assessedBy
reviewedBy
assessmentDate
```

## 3. Applicability statuses

```text
APPLICABLE
CONDITIONALLY_APPLICABLE
NOT_APPLICABLE
APPLICABILITY_UNKNOWN
```

`NOT_APPLICABLE` shall not mean "not implemented" or "not currently planned." It requires a semantic or profile reason.

## 4. Conformance statuses

### `CONFORMANT`

The current implementation satisfies the requirement's professional and technical meaning, and sufficient evidence exists.

### `PARTIALLY_CONFORMANT`

Some material aspects conform, but one or more required conditions, surfaces, states, or evidence obligations remain incomplete.

### `NONCONFORMANT`

The implementation materially contradicts or violates the requirement.

### `NOT_IMPLEMENTED`

No implementation of the applicable requirement was found after sufficient inspection.

### `NOT_APPLICABLE`

The requirement does not apply under the accepted profile or scope, with approved rationale.

### `UNKNOWN`

Available evidence is insufficient to make a responsible determination.

### `BLOCKED_BY_SPECIFICATION`

The governing source is materially ambiguous, contradictory, missing, or defective such that implementation conformance cannot be assessed responsibly.

## 5. Assessment confidence

```text
HIGH
MEDIUM
LOW
UNKNOWN
CONFLICTED
```

A requirement cannot be accepted as conformant with `LOW`, `UNKNOWN`, or `CONFLICTED` confidence unless the gate explicitly accepts residual uncertainty and the requirement's criticality permits it.

## 6. Three-pass assessment method

### Pass A — Candidate mapping

Identify potential implementation, test, runtime, and UI locations. Keyword matches are only candidates.

### Pass B — Semantic inspection

Determine whether the implementation means and behaves as the requirement demands. Inspect state transitions, authority, failure behavior, persistence, and user experience—not only names and schemas.

### Pass C — Evidence and disposition

Record status, confidence, evidence, gap, candidate discrepancy classification, and required follow-on work.

## 7. Evidence sufficiency

### Insufficient example

```text
Conformant because ProfessionalWorkUnit.ts exists.
```

### Better example

```text
PARTIALLY_CONFORMANT. ProfessionalWorkUnit persists objective and one status field
in services/work/pwu.ts:L42-L118 and migration 0031. No distinct cognitive-state field,
transition guard, or completion-condition enforcement was found. UI route
src/routes/pwus/[id]/+page.svelte displays status but not cognitive state. Tests cover
creation only. Evidence: EV-..., EV-..., EV-....
```

## 8. Special semantic review rules

### 8.1 Claims of absence

A claim that a capability does not exist shall document search scope, terminology variants, dynamic or generated sources inspected, and runtime observation where relevant.

### 8.2 UI conformance

A screen is not conformant because it contains the right labels. Verify source projection, authority, staleness, state distinctions, commands, errors, and context preservation.

### 8.3 Runtime conformance

A handler is not conformant because it resembles a command. Verify authentication, authority, concurrency, validation, transaction, event, idempotency, and projection behavior.

### 8.4 Agent conformance

A prompt is not sufficient. Verify agent identity, scope, authority, context provenance, tool permissions, output disposition, validation, persistence, safe stop, and escalation.

### 8.5 Professional completion

Successful code execution, workflow termination, artifact creation, merge, deployment, or agent completion shall not be accepted as proof of PWU or outcome completion unless the normative completion conditions are demonstrated.

## 9. Discrepancy definition

A discrepancy exists when any of the following differ materially:

- normative requirement and observed implementation;
- two normative sources;
- code and test expectation;
- schema and runtime behavior;
- UI state and authoritative state;
- current representation and operational observation;
- two repository components claiming the same authority;
- code and existing documentation describing current state.

## 10. Mandatory discrepancy classifications

### `IMPLEMENTATION_DEFECT`

The normative requirement is valid and applicable, and the implementation fails to satisfy it.

### `SPECIFICATION_DEFECT`

The normative source is incorrect, incomplete, internally inconsistent, or unsuitable in light of stronger evidence or higher authority.

### `DOCUMENTATION_STALENESS`

Documentation purporting to describe current state no longer matches implementation or operation, while target intent remains unaffected.

### `VALID_EXISTING_BEHAVIOR`

The implementation contains professionally valuable, coherent behavior that is absent from or underspecified by the target corpus and should be preserved or incorporated.

### `TEMPORARY_DEVIATION`

Known nonconformance is intentionally tolerated for a bounded period with authority, risk assessment, controls, expiration, and remediation.

### `UNRESOLVED_AMBIGUITY`

Available evidence or authority cannot yet determine the correct target or disposition.

## 11. Discrepancy record

```text
discrepancyId
title
classification
severity
requirementIds
sourceClauses
currentState
targetState
evidenceIds
professionalImpact
technicalImpact
securityOrOperationalImpact
downstreamDependencies
candidateDispositions
recommendedDisposition
owner
authority
status
resolutionDueByPhase
```

## 12. Severity

```text
S1  Invalidates core semantics, authority, tenant isolation, safety, data integrity, recovery, or professional completion.
S2  Materially impairs a required capability, assurance, or transition.
S3  Limited nonconformance or quality degradation with contained impact.
S4  Editorial, cosmetic, or low-impact issue.
```

An unresolved `S1` discrepancy normally blocks downstream acceptance.

## 13. Reconciliation decision sequence

For each discrepancy:

1. identify the current-state evidence;
2. identify applicable normative clauses and authority tiers;
3. determine whether the clauses are coherent and applicable;
4. identify valid existing behavior and original design rationale where available;
5. identify affected data, APIs, UI, tests, operations, and downstream work;
6. generate feasible dispositions;
7. compare professional outcome, intent preservation, risk, migration cost, and reversibility;
8. select a disposition under appropriate authority;
9. record required source or implementation changes;
10. update the conformance and transition records.

## 14. Allowed dispositions

### `PRESERVE`

Retain current behavior and establish it as conformant or propose its incorporation into the target.

### `DOCUMENT`

Preserve implementation and correct stale or missing current-state documentation.

### `ADAPT`

Modify current implementation incrementally while preserving its useful structure or interfaces.

### `WRAP`

Place a conformant boundary around nonconformant or external behavior as an interim or permanent integration strategy.

### `REFACTOR`

Change internal structure while preserving accepted external and professional semantics.

### `MIGRATE`

Move state, behavior, or consumers to a new model through controlled coexistence and conversion.

### `REPLACE`

Substitute a new implementation because adaptation is unsafe or disproportionately costly.

### `RETIRE`

Remove behavior or representation that no longer serves accepted intent, after dependency and data handling.

### `CREATE`

Implement an absent capability.

### `ESCALATE`

Transfer unresolved meaning, risk, or authority to the appropriate professional decision-maker.

## 15. Current-state versus target-state authority

### 15.1 Current-state description

Where source code, schema, tests, and deployed behavior disagree with stale descriptive documents, the evidence with the strongest demonstrated connection to actual behavior shall govern the current-state model.

### 15.2 Target-state obligation

Approved higher-tier normative sources govern the target unless P4 determines they contain a specification defect or are inapplicable.

### 15.3 Greenfield and early target-dominant areas

Where implementation is absent or intentionally provisional, approved normative documentation may dominate target decisions.

### 15.4 Brownfield and reality-dominant areas

Where a mature implementation embodies validated behavior, contracts, migrations, or operational learning, changes shall account for that evidence and may require the specification to evolve.

## 16. Reconciliation outputs

A reconciliation may produce:

```text
implementation_defect
specification_change_proposal
documentation_update
preservation_decision
transition_decision
temporary_deviation
focused_investigation_pwu
risk_acceptance
requirement_revision
```

## 17. Independent review

At minimum, independent review shall cover:

- all `S1` and `S2` discrepancies;
- all `SPECIFICATION_DEFECT` classifications;
- all `VALID_EXISTING_BEHAVIOR` decisions affecting target semantics;
- all `NOT_APPLICABLE` dispositions for `P0` or `P1` requirements;
- all temporary deviations;
- a risk-based sample of conformant assessments.

## 18. P4 exit conditions

- every material discrepancy has a classification and disposition;
- no silent code/document conflict remains;
- specification changes have owners and affected requirements;
- valid existing behavior has preservation controls;
- deviations are bounded;
- unknowns have investigation or escalation paths;
- transition architecture may be designed without unresolved target ambiguity that affects its scope.

## 19. Prohibitions

- Do not mark code as defective solely because it uses different names.
- Do not mark documentation stale merely to avoid implementation work.
- Do not call an intentional future requirement a specification defect because it is difficult.
- Do not preserve behavior without checking target intent and downstream risk.
- Do not classify unresolved uncertainty as temporary deviation.
- Do not fix a discrepancy before preserving the evidence and recording its disposition.
