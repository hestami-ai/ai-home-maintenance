# JAN-IRP-000 — Janumi Self-Instantiating Normative Implementation Roadmap Corpus

**Version:** 0.3.0  
**Status:** Proposed Normative Draft  
**Authority tier:** Implementation governance; subordinate to the approved Janumi doctrine, Constitution, ontology, architecture, PWA, execution, runtime, and experience specifications  
**Applies to:** All implementations of the Janumi Platform and all Professional Work Architectures  
**Primary audiences:** Human architects, coding agents, reviewers, assurance personnel, platform engineers, PWA authors, and implementation authorities

## 1. Purpose

This corpus defines the governed process by which an implementation repository is discovered, reconstructed, reconciled with Janumi's normative target, transformed through dependency-correct capability increments, and accepted on the basis of evidence.

It is **self-instantiating**: the repository-specific roadmap is not assumed to exist before repository access. Instead, this corpus makes repository acquisition, investigation, current-state reconstruction, conformance assessment, and transition design part of the roadmap itself.

The governing transformation is:

```text
Normative Janumi corpus
        +
Implementation repository and operational evidence
        ↓
Repository investigation
        ↓
Current-state reconstruction
        ↓
Normative conformance and reconciliation
        ↓
Transition architecture
        ↓
Repository-specific roadmap instance
        ↓
Authorized capability increments
        ↓
Conformance evidence and accepted implementation baseline
```

## 2. What this corpus is

This corpus is the canonical **implementation realization program**. It governs:

- program phases and gates;
- source authority and requirement derivation;
- repository evidence acquisition;
- current-state semantic reconstruction;
- conformance assessment;
- code–specification reconciliation;
- transition architecture;
- canonical capability outcomes;
- repository-specific roadmap generation;
- increment authorization;
- evidence and independent review;
- deviations, deferrals, and specification changes;
- coding-agent operating boundaries;
- release and continued evolution.

It does not prescribe dates, staffing levels, sprint assignments, or estimates. Those belong in a separate mutable operating plan.

## 3. Canonical corpus versus repository-specific instance

### 3.1 Canonical corpus

The files in this package are repository-independent. They define how implementation realization **shall** be conducted regardless of the repository's present architecture.

### 3.2 Repository-specific roadmap instance

Execution of program phases `P1` through `P6` produces an instance containing:

- exact repository revision and evidence manifest;
- current-state architecture and semantic models;
- requirement-to-code and requirement-to-test traces;
- discrepancy and reconciliation decisions;
- transition mappings;
- repository-specific dependency graph;
- bounded implementation increments;
- entrance and exit gates;
- exact evidence obligations.

The instance shall not be guessed in advance.

## 4. Document catalog

| Document ID | File | Purpose |
|---|---|---|
| `JAN-IRP-000` | `00-JAN-IRP-000-README.md` | Entry point, authority, package use, and execution sequence. |
| `JAN-IRP-001` | `01-JAN-IRP-001-Program-Charter.md` | Mission, scope, governance, roles, principles, and program completion condition. |
| `JAN-IRP-002` | `02-JAN-IRP-002-Program-Lifecycle-and-Gate-Model.md` | Program phases `P0–P9`, state model, gates, dependencies, and parallelization. |
| `JAN-IRP-003` | `03-JAN-IRP-003-Source-Corpus-and-Requirement-Derivation.md` | Source materialization, authority hierarchy, clause extraction, stable requirement IDs, and coverage. |
| `JAN-IRP-004` | `04-JAN-IRP-004-Repository-Investigation-and-Evidence-Acquisition.md` | Repository intake, preservation, inventory, baseline execution, evidence identity, and investigative write boundary. |
| `JAN-IRP-005` | `05-JAN-IRP-005-Current-State-Reconstruction-Specification.md` | Required semantic, UI, runtime, agent, security, data, test, and deployment current-state models. |
| `JAN-IRP-006` | `06-JAN-IRP-006-Conformance-and-Reconciliation-Control.md` | Requirement assessment, discrepancy classification, authority reconciliation, and dispositions. |
| `JAN-IRP-007` | `07-JAN-IRP-007-Transition-Architecture-Specification.md` | Preserve/adapt/wrap/refactor/migrate/replace decisions and controlled transition design. |
| `JAN-IRP-008` | `08-JAN-IRP-008-Canonical-Capability-Increment-Catalog.md` | Stable target capability outcomes `C1–C11` and their proof obligations. |
| `JAN-IRP-009` | `09-JAN-IRP-009-Roadmap-Instantiation-Procedure.md` | Procedure that binds canonical capabilities to discovered repository work. |
| `JAN-IRP-010` | `10-JAN-IRP-010-Gate-Assurance-and-Evidence-Standard.md` | Evidence quality, independent review, gate packages, and acceptance decisions. |
| `JAN-IRP-011` | `11-JAN-IRP-011-Deviation-Deferral-and-Change-Control.md` | Temporary nonconformance, deferred scope, emergency change, and upstream specification change. |
| `JAN-IRP-012` | `12-JAN-IRP-012-Coding-Agent-Operating-Contract.md` | Phase-specific coding-agent authority, prohibitions, outputs, handoffs, and self-approval constraints. |
| `JAN-IRP-013` | `13-JAN-IRP-013-Machine-Readable-Control-Schemas.md` | Control-record formats, schemas, validation, IDs, and package automation. |
| `JAN-IRP-014` | `14-JAN-IRP-014-Supersession-and-Incorporation-Map.md` | Incorporation and supersession of the earlier roadmap and G0 packages. |
| `JAN-IRP-015` | `15-JAN-IRP-015-Reference-Execution-Scenario.md` | End-to-end example from disconnected corpus and repository to accepted implementation baseline. |

## 5. Incorporated baseline controls

The `baseline/` directory contains the prior source baseline, 157-requirement register, and conformance matrix. They are retained as controlled inputs and shall be audited during `P0` rather than treated as infallible.

The `control/` directory contains machine-readable versions of the requirement register, program model, capability catalog, and package manifest.

## 6. Execution sequence

```text
P0  Program foundation and source baseline
P1  Repository intake and evidence preservation
P2  Current-state semantic reconstruction
P3  Normative applicability and conformance assessment
P4  Code–specification reconciliation
P5  Transition architecture
P6  Repository-specific roadmap instantiation
P7  Capability realization
P8  Integration and operational conformance
P9  Release and evolution baseline
```

A repository-specific implementation increment shall not be authorized before the evidence required by its prerequisite phases exists.

## 7. Recommended consumption order

### Program authority or architect

Read all numbered documents in order, then inspect `baseline/`, `schemas/`, and `templates/`.

### Primary repository-investigation agent

Read:

1. `JAN-IRP-000` through `JAN-IRP-006`;
2. `JAN-IRP-010` through `JAN-IRP-012`;
3. the normative source corpus;
4. `agent-prompts/P1-P3-primary-investigation.md`.

### Reconciliation and transition architect

Read `JAN-IRP-006`, `JAN-IRP-007`, `JAN-IRP-010`, `JAN-IRP-011`, and the accepted current-state evidence.

### Roadmap-instantiation agent

Read `JAN-IRP-008`, `JAN-IRP-009`, all accepted `P1–P5` outputs, and `agent-prompts/P6-roadmap-instantiation.md`.

### Capability implementation agent

Read the authorized repository-specific increment, its cited normative sources, `JAN-IRP-010` through `JAN-IRP-012`, and only the repository contexts necessary for the increment.

## 8. Normative language

`SHALL`, `SHALL NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` are normative. `SHALL` and `SHALL NOT` are mandatory unless an approved, time-bounded deviation explicitly permits temporary nonconformance.

## 9. Fundamental operating rules

1. Repository investigation is implementation-program work, not an external prerequisite.
2. Source code is evidence of current state; approved doctrine governs target intent to the extent that it remains valid.
3. Neither code nor documentation wins automatically when they conflict.
4. Every material discrepancy shall receive an explicit classification and disposition.
5. Capability outcomes remain stable; repository-level tasks are generated only after investigation.
6. A route rendering, build passing, merge occurring, or agent completing is not sufficient evidence of professional completion.
7. The producing agent shall not self-approve a phase or capability gate requiring independent review.
8. Unknowns shall be represented as controlled resolution obligations rather than hidden `TBD` assumptions.
9. Dates and staffing shall not redefine normative gates.
10. No implementation change shall erase evidence needed to reconstruct the pre-change state.

## 10. Quick start when repository access becomes available

```bash
# 1. Copy this corpus and the approved normative source corpus into a controlled workspace.
# 2. Record the repository revision and working-tree state.
# 3. Run the read-only inventory helper.
python tools/repository_evidence_inventory.py \
  --repo /path/to/repository \
  --output /path/to/program-instance/evidence/repository-inventory

# 4. Create instance records from templates/.
# 5. Validate machine-readable controls.
python tools/validate_control_artifacts.py \
  --schema-dir schemas \
  --instance-dir /path/to/program-instance
```

The inventory helper produces candidate evidence only. Semantic conclusions require manual or agent-assisted inspection under `JAN-IRP-005` and `JAN-IRP-006`.

## 11. Package status

This package is a proposed normative draft. Formal adoption requires assignment of owners and approval authorities, source-corpus materialization, and a `P0` acceptance decision.
