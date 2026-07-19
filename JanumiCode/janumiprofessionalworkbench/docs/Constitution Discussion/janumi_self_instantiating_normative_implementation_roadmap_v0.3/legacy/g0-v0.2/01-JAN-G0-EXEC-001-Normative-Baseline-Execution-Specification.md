# JAN-G0-EXEC-001 — Normative Baseline Execution Specification

**Version:** 0.1  
**Status:** Proposed normative execution specification  
**Implements:** `JAN-RMAP-001 / G0`  
**Applicable requirements:** `JAN-REQ-GOV-001`, `JAN-REQ-GOV-012`, `JAN-REQ-GOV-013`, `JAN-REQ-GOV-014`

## 1. Purpose

This specification governs execution of Gate G0. It establishes the first evidence-backed baseline connecting the Janumi normative corpus to the implementation repository.

G0 shall not assert that code conforms merely because routes render, tests pass, or concepts share names with the specifications. G0 shall determine the actual semantics, behavior, authority boundaries, persistence model, interaction model, and operational controls currently present.

## 2. Capability outcome

At G0 acceptance:

- every governing source has a stable document identity, version, status, owner, and authority tier;
- the existing implementation is inventoried at a level sufficient to evaluate later requirements;
- all 157 registered requirements have a baseline disposition other than `UNASSESSED`;
- every material conflict among code, documentation, tests, and observed behavior has a classification and disposition path;
- dates, estimates, staffing, and sprint assignments remain outside normative gate semantics;
- the acceptance authority can authorize a bounded G1 increment without relying on undocumented assumptions.

## 3. Non-goals

G0 shall not:

- implement G1–G9 capabilities;
- refactor product code to resemble the target architecture;
- introduce new runtime services, routes, screens, schemas, or agents;
- rewrite source specifications merely to match current code;
- declare unknown behavior conformant;
- resolve semantic conflicts through filename or keyword similarity;
- treat generated inventories as substitutes for professional inspection;
- create delivery dates or estimates as normative requirements.

## 4. Roles

| Role | Responsibility |
|---|---|
| G0 Coordinator | Maintains scope, records, evidence completeness, and gate state. |
| Primary Assessment Agent | Performs repository inventory, semantic inspection, trace mapping, and initial classifications. |
| Independent Reviewer | Challenges unsupported conclusions, missing evidence, false conformance, and silent authority choices. |
| Source Steward | Consolidates and versions the source corpus without altering approved meaning. |
| Implementation Steward | Confirms current behavior, paths, tests, and operational facts. |
| Acceptance Authority | Accepts, rejects, or conditionally accepts G0 and authorizes G1. |

The Primary Assessment Agent shall not serve as the sole acceptance authority for its own assessment.

## 5. Required inputs

- Current source repository and all relevant subrepositories.
- Current branch, commit, and dirty-state evidence.
- Database migrations and current schema definitions.
- Frontend routes, components, state management, and API clients.
- Backend endpoints, services, workers, command handlers, models, and tests.
- Deployment manifests, CI/CD definitions, observability configuration, and runbooks.
- Current normative source corpus.
- `JAN-SRC-001`, `JAN-REQ-001`, `JAN-RMAP-001`, and `JAN-CONF-001`.

If a required source is unavailable, it shall be recorded as `UNKNOWN`; the assessor shall not infer its content.

## 6. Required outputs

```text
docs/implementation-baseline/
├── 00-G0-Baseline-Assessment-Report.md
├── 01-Current-State-Architecture.md
├── 02-Normative-Source-Consolidation-Report.md
├── 03-G0-Gate-Acceptance-Decision.md
├── registers/
│   ├── implementation-inventory.csv
│   ├── requirement-assessment.csv
│   ├── discrepancy-register.csv
│   ├── deviation-register.csv
│   ├── deferral-register.csv
│   └── evidence-index.csv
└── evidence/
    ├── repository-inventory/
    ├── commands/
    ├── tests/
    ├── screenshots/
    ├── schemas/
    ├── runtime/
    └── source-baseline/
```

## 7. G0 execution state model

```text
NOT_STARTED
    ↓
INITIALIZING
    ↓
SOURCE_BASELINING
    ↓
INVENTORYING
    ↓
ASSESSING
    ↓
RECONCILING
    ↓
INDEPENDENT_REVIEW
    ↓
EVIDENCE_REVIEW
    ↓
ACCEPTED | CONDITIONALLY_ACCEPTED | REJECTED
```

A conditionally accepted G0 may authorize G1 only when the conditions do not create unresolved authority ambiguity or invalidate the selected G1 semantic subset.

## 8. Phase G0.0 — Initialize and preserve evidence

The assessor shall:

1. Record repository root, remote identity when available, branch, commit, submodules, and dirty state.
2. Create a dedicated branch or worktree for assessment artifacts.
3. Record tool versions used for inventory and tests.
4. Establish the G0 write boundary.
5. Copy or reference the roadmap and source corpus under repository change control.
6. Record unavailable repositories, services, environments, and credentials.

### Required evidence

- `git rev-parse` output or equivalent.
- `git status --porcelain` output or equivalent.
- Repository and subrepository list.
- Assessment-environment record.

## 9. Phase G0.1 — Materialize and consolidate the normative corpus

The Source Steward shall:

1. Assign or confirm permanent document IDs.
2. Confirm version, status, owner, approval authority, dependencies, and supersession relationships.
3. Identify duplicate, overlapping, provisional, and superseded formulations.
4. Produce a consolidation map showing which source text governs each concept.
5. Preserve unresolved differences as source discrepancies.
6. Confirm that lower-tier profiles do not silently redefine higher-tier semantics.

Conversational existence is not approval. A document may remain `PROPOSED_*`; its status shall be explicit.

### Required output

`02-Normative-Source-Consolidation-Report.md`

## 10. Phase G0.2 — Inventory the implementation

The implementation inventory shall cover at least:

- repositories and packages;
- frontend routes and UI components;
- frontend state and data-access layers;
- APIs and externally visible contracts;
- semantic commands and generic mutation endpoints;
- entities, data models, migrations, and tables;
- events, queues, workers, and durable processes;
- projections, read models, caches, and search indexes;
- authorization, identity, tenant, and organization boundaries;
- PWU, PWA, RPH, agent, validator, and reconciliation implementations;
- tests and test environments;
- CI/CD and repository integrations;
- deployments, containers, orchestration, secrets, and object storage;
- logs, traces, metrics, alerts, backups, recovery, and administrative tooling.

Automated inventory is candidate evidence. Every material conclusion requires semantic inspection.

## 11. Phase G0.3 — Construct the current-state architecture

`01-Current-State-Architecture.md` shall describe:

- actual runtime topology;
- authoritative and derived data stores;
- current mutation paths;
- current read/query paths;
- current identity and authority evaluation;
- current frontend shell and navigation;
- current PWU/PWA/RPH semantics, if any;
- current agent execution and tool boundaries;
- current testing, CI/CD, deployment, and observability;
- known in-memory-only or nonrecoverable state;
- current semantic sources of truth and any competing truths.

The architecture shall be based on observed implementation evidence, not target-state diagrams.

## 12. Phase G0.4 — Assess the requirement register

Every `JAN-REQ-*` record shall receive one baseline status:

```text
CONFORMANT
PARTIAL
NONCONFORMANT
UNKNOWN
NOT_APPLICABLE
RECONCILIATION_REQUIRED
```

`UNASSESSED` is prohibited at G0 exit.

### Assessment rules

- `CONFORMANT` requires direct evidence of the required semantics, not a similarly named class or screen.
- `PARTIAL` means a meaningful subset exists but one or more required conditions are absent or unproven.
- `NONCONFORMANT` includes capabilities that are absent, contradicted, or implemented through a prohibited semantic shortcut.
- `UNKNOWN` is appropriate when evidence cannot be obtained. Unknown is not failure, but it may block G1 when material.
- `NOT_APPLICABLE` requires rationale and reviewer agreement.
- `RECONCILIATION_REQUIRED` means the assessor cannot responsibly classify the implementation until a code-versus-specification conflict is resolved.

For requirements first activated after G0, the assessment may be architectural and triage-level, but it shall still cite evidence or absence. G0 requirements require full gate evidence.

## 13. Phase G0.5 — Classify discrepancies

Every material discrepancy shall use one classification:

```text
IMPLEMENTATION_DEFECT
SPECIFICATION_DEFECT
DOCUMENTATION_STALENESS
VALID_EXISTING_BEHAVIOR
TEMPORARY_DEVIATION
UNRESOLVED_AMBIGUITY
```

Each discrepancy shall identify:

- current implementation evidence;
- target normative source;
- professional and technical impact;
- downstream requirements and gates;
- proposed disposition;
- authority required;
- remediation or reconciliation trigger.

Neither code nor documentation wins automatically.

## 14. Phase G0.6 — Establish control registers

The following registers shall exist even when empty:

- discrepancy register;
- deviation register;
- deferral register;
- evidence index;
- source consolidation register.

A temporary deviation shall have an expiration gate and compensating control. A deferral shall not silently downgrade a mandatory requirement.

## 15. Phase G0.7 — Independent review

The Independent Reviewer shall:

- sample every requirement family;
- review every P0 requirement classified `CONFORMANT`;
- review every `NOT_APPLICABLE` classification;
- review every discrepancy affecting G1 or G2;
- challenge claims based only on names, comments, or planned behavior;
- verify that evidence paths are reproducible;
- identify uninspected repositories, runtime states, or deployment surfaces;
- ensure source conflicts were not silently normalized.

The reviewer shall issue `ACCEPT`, `REVISE`, or `ESCALATE` for each challenged record.

## 16. Phase G0.8 — Gate evidence review and decision

G0 may be accepted only when:

- all source documents have controlled metadata;
- all 157 requirements have a baseline status;
- every G0 requirement is conformant or covered by an approved deviation;
- every P0 unknown or reconciliation-required record has a disposition;
- the implementation inventory covers all known repositories and deployed surfaces;
- the current-state architecture identifies authoritative mutation and read paths;
- the discrepancy, deviation, deferral, and evidence registers are complete;
- roadmap gates remain separate from dates and sprint scheduling;
- no unresolved authority ambiguity blocks G1;
- the Acceptance Authority records a decision.

## 17. G0 evidence package

The package shall include:

| Evidence class | Required content |
|---|---|
| Source baseline | Source catalog, metadata, authority, consolidation, unresolved source conflicts. |
| Repository identity | Commit, branch, dirty state, repositories, tool versions. |
| Inventory | Machine inventory plus reviewed semantic inventory. |
| Architecture | Current-state mutation, query, data, runtime, UI, agent, and operational views. |
| Requirement trace | All 157 requirements with status, references, evidence, and notes. |
| Discrepancies | Classification, impact, disposition, and authority. |
| Independent review | Reviewer findings and resolutions. |
| Gate decision | Acceptance, residual uncertainty, conditions, and G1 authority. |

## 18. Prohibited shortcuts

The assessor shall not:

- change product code before recording the baseline;
- mark a requirement conformant based only on filenames, comments, types, or intended behavior;
- use passing tests as proof when the tests do not exercise the normative semantics;
- classify absent capability as `NOT_APPLICABLE` merely because it has not been implemented;
- omit inconvenient repositories or deployment configuration;
- combine documentation reconciliation with implementation remediation without separate records;
- use dates or estimates to weaken a gate obligation;
- leave G0 with `UNASSESSED` requirements.

## 19. Next authorized action

After G0 acceptance, the project shall derive a bounded G1 Capability Increment Execution Specification. It shall select the minimum CPCO/PWU/JanumiCode semantic subset required for the first vertical slice based on the baseline evidence; it shall not authorize the entirety of G1 as one undifferentiated coding task.
