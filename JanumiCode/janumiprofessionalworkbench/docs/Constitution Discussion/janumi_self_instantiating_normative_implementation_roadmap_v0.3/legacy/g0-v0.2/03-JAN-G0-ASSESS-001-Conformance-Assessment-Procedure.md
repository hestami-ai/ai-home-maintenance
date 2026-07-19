# JAN-G0-ASSESS-001 — Conformance Assessment Procedure

**Version:** 0.1  
**Status:** Normative G0 procedure

## 1. Purpose

This procedure determines the current conformance status of every registered Janumi requirement without confusing textual similarity, partial scaffolding, or planned behavior with implemented semantics.

## 2. Three-pass assessment

### Pass A — Candidate mapping

Use inventory, search, route maps, schema maps, tests, and runtime configuration to identify possible implementation references for each requirement.

Candidate mapping is not conformance.

### Pass B — Semantic inspection

Inspect the actual code paths, data contracts, state transitions, authority checks, tests, UI behavior, and operational boundaries relevant to the requirement.

Determine:

- what state is authoritative;
- how state changes;
- what invariants are enforced;
- what evidence exists;
- what happens on failure, restart, conflict, and stale input;
- whether the UI meaning matches backend semantics;
- whether the implementation applies to all required tenants, roles, and contexts.

### Pass C — Evidence and disposition

Assign the status, cite reproducible evidence, identify gaps, and create a discrepancy record when code and target semantics differ materially.

## 3. Status decision table

| Status | Use when |
|---|---|
| `CONFORMANT` | All material parts of the obligation are implemented and directly evidenced. |
| `PARTIAL` | A meaningful subset is implemented, but the obligation is incomplete or not fully proven. |
| `NONCONFORMANT` | The capability is absent, contradicted, or realized through a prohibited shortcut. |
| `UNKNOWN` | Evidence cannot presently establish current behavior. |
| `NOT_APPLICABLE` | The obligation genuinely does not apply to the assessed implementation boundary; rationale and review are required. |
| `RECONCILIATION_REQUIRED` | A code/specification/behavior conflict prevents responsible classification. |

## 4. Evidence confidence

```text
HIGH    Direct code/runtime/test evidence converges.
MEDIUM  Direct evidence exists but coverage or runtime confirmation is incomplete.
LOW     Classification relies materially on inference or incomplete access.
```

A `CONFORMANT` P0 requirement should normally have `HIGH` confidence.

## 5. Conformance claim structure

Every claim shall answer:

```text
Requirement
Current behavior
Implementation references
Verification references
Evidence references
Coverage limits
Status
Confidence
Discrepancy or deviation
Reviewer disposition
```

## 6. Special review rules

The Independent Reviewer shall review:

- every G0 requirement;
- every P0 requirement marked `CONFORMANT`;
- every `NOT_APPLICABLE` record;
- every `RECONCILIATION_REQUIRED` record;
- every G1/G2 requirement marked `CONFORMANT` or `PARTIAL`;
- a representative sample from every remaining family and gate.

## 7. Evidence sufficiency examples

### Insufficient

```text
Requirement: Lifecycle and cognitive state shall be explicit and distinct.
Evidence: A file named pwu-state.ts exists.
```

### Better

```text
Current behavior: PWU lifecycle and cognitive state are persisted in separate columns,
validated by separate enums, returned independently by the overview projection, and
rendered by separate UI components.
Evidence:
- repo://backend/pwu/model.ts#L31-L47
- db://janumi_semantic/pwus
- test://pwu-dual-state-transition
- repo://frontend/PwuWorkspaceHeader.svelte#L18-L43
```

## 8. Requirement-family focus

| Family | G0 inspection focus |
|---|---|
| `GOV` | Outcomes, authority hierarchy, traceability, and source conflict behavior. |
| `SEM` | Identity, types, semantic boundaries, provenance, temporal and relationship models. |
| `PWU` | Objective, scope, dual state, lifecycle, commands, completion, dependency, and decomposition. |
| `RPH` | Coordination, plans, allocation, progress, tactics, synthesis, and escalation. |
| `PROJ` | Authoritative source, mutation boundary, state disclosure, context preservation, and accessibility. |
| `JSDL` | Machine-readable semantics, compiler phases, IR, generation, and deterministic contracts. |
| `JEM` | Commands, authority, transactions, events, processes, agents, projections, and replay. |
| `OPS` | Tenancy, outbox, durability, recovery, isolation, observability, and resource control. |
| `JCODE` | Intent-to-observation trace, requirements, architecture, implementation, verification, release, and operations. |

## 9. Discrepancy classification test

### `IMPLEMENTATION_DEFECT`

The target requirement is valid and applicable; implementation behavior is wrong or missing.

### `SPECIFICATION_DEFECT`

The target source is internally inconsistent, impossible, unsafe, or substantively wrong.

### `DOCUMENTATION_STALENESS`

The source claims to describe current implementation, but code and validated behavior have legitimately evolved.

### `VALID_EXISTING_BEHAVIOR`

Current behavior is valuable and compatible with higher authority but absent from lower-level specifications; the specification should be updated or extended.

### `TEMPORARY_DEVIATION`

Nonconformance is intentionally accepted for bounded scope and time with compensating controls.

### `UNRESOLVED_AMBIGUITY`

Available evidence or authority is insufficient to determine the correct target.

## 10. Baseline completion rule

The baseline is complete only when no requirement remains `UNASSESSED`, even when the honest classification is `UNKNOWN` or `RECONCILIATION_REQUIRED`.
