# JAN-IRP-009 — Repository-Specific Roadmap Instantiation Procedure

**Version:** 0.3.0  
**Status:** Proposed Normative Draft  
**Program phase:** `P6`  
**Purpose:** Transform accepted investigation, conformance, reconciliation, and transition artifacts into an exact, dependency-correct repository-specific implementation roadmap.

## 1. Instantiation equation

```text
Canonical capability catalog
+ controlled requirement register
+ accepted current-state reconstruction
+ accepted conformance assessments
+ reconciliation decisions
+ transition architecture
+ repository dependency evidence
= repository-specific roadmap instance
```

The result shall not be generated from normative documents alone.

## 2. Required inputs

- accepted P0 source and requirement baseline;
- P1 repository evidence manifest;
- accepted P2 current-state models;
- P3 conformance matrix;
- P4 discrepancy and reconciliation decisions;
- P5 transition records and compatibility strategy;
- canonical capabilities `C1–C11`;
- release-profile scope and mandatory constraints;
- current operational continuity requirements.

## 3. Roadmap instance identity

```text
roadmapInstanceId
canonicalCorpusVersion
sourceBaselineId
repositoryRevision
currentStateModelVersion
transitionArchitectureVersion
releaseProfile
createdBy
createdAt
status
```

Any change to the assessed repository revision or accepted source baseline shall trigger impact assessment and may require a new instance version.

## 4. Binding statuses

For each canonical capability and requirement, assign:

```text
PRESERVE_CONFORMANT
DOCUMENT_EXISTING
ADAPT_EXISTING
WRAP_EXISTING
REFACTOR_EXISTING
MIGRATE_EXISTING
REPLACE_EXISTING
RETIRE_EXISTING
CREATE_NEW
DEFER_APPROVED
NOT_APPLICABLE
BLOCKED_BY_SPECIFICATION
REQUIRES_FOCUSED_INVESTIGATION
```

## 5. Instantiation algorithm

## Step 1 — Confirm baseline integrity

Verify that all input gate decisions are accepted or conditionally accepted and that conditions permit P6.

## Step 2 — Bind requirements to capability outcomes

For every applicable requirement:

- identify canonical capability;
- identify current conformance;
- identify discrepancy and transition records;
- identify existing implementation and tests;
- determine whether work is preserve, adapt, migrate, create, or another strategy.

## Step 3 — Construct implementation element graph

Create nodes for:

```text
semantic types
schemas and migrations
commands and handlers
events and processes
projections and APIs
routes and workspaces
validators and tests
agents and tools
runtime and deployment controls
```

Create edges for:

```text
requires
migrates_before
consumer_of
produces
validates
shares_transaction_with
shares_schema_with
must_remain_compatible_with
operationally_depends_on
```

## Step 4 — Detect dependency cycles

Classify cycles as:

```text
MODEL_CYCLE
MIGRATION_CYCLE
DEPLOYMENT_CYCLE
ORGANIZATIONAL_CYCLE
FALSE_CYCLE_FROM_OVERBROAD_SCOPE
```

Resolve by decomposition, interface extraction, compatibility staging, or explicit joint increment. Do not ignore cycles.

## Step 5 — Identify vertical increment candidates

An increment should produce one professionally meaningful capability slice across the necessary layers.

Candidate boundary test:

- one clear capability outcome;
- bounded target and repository scope;
- coherent migration and rollback;
- independently testable proof obligations;
- no hidden reliance on future semantics;
- manageable review surface;
- explicit non-goals.

## Step 6 — Assign preserved conformance

Do not create implementation work for conformant behavior merely to make the roadmap appear complete. Instead:

- bind requirement to preserved code and tests;
- add missing evidence or regression protection;
- identify any documentation or source-control action;
- record capability credit.

## Step 7 — Assign migration and creation work

For nonconformant or absent behavior, create bounded increments containing exact repository elements and transition records.

## Step 8 — Construct increment dependency DAG

Each increment shall declare:

```text
hardPrerequisites
softPrerequisites
parallelSafeWith
conflictsWith
migrationOrder
externalDependencies
bootstrapDependencies
```

## Step 9 — Define implementation waves

Waves express an admissible ordering and parallelism, not a calendar.

Example:

```text
Wave 1: preserve evidence and introduce compatibility boundaries
Wave 2: establish semantic and command spine
Wave 3: migrate PWU vertical slice
Wave 4: reasoning, evidence, recursive work, and RPH
Wave 5: JanumiCode chain and governed agents
Wave 6: operational assurance and legacy retirement
```

Actual waves shall be derived from the repository.

## Step 10 — Generate increment specifications

Every increment shall use the template in `templates/capability-increment-authorization.json` and include:

- outcome;
- governing requirements and sources;
- current baseline;
- transition strategy;
- included and excluded scope;
- exact repository references;
- prerequisites;
- semantic commands, events, projections, validators, and migrations;
- prohibited shortcuts;
- bootstrap concessions;
- test and evidence plan;
- entrance and exit gate;
- reviewer and acceptance authority.

## Step 11 — Validate requirement coverage

Every applicable mandatory requirement shall map to exactly one or more of:

```text
preserved_conformance
implementation_increment
approved_deviation
approved_deferral
not_applicable_decision
upstream_specification_blocker
```

No mandatory requirement may disappear between the register and roadmap instance.

## Step 12 — Validate operational continuity

The roadmap shall show how each wave preserves or intentionally changes:

- current users and routes;
- data and migrations;
- API and event consumers;
- in-flight processes;
- agent work;
- deployment and rollback;
- backups and recovery.

## Step 13 — Independent review

Review:

- completeness;
- dependency correctness;
- overbroad increments;
- hidden target changes;
- preserved valid behavior;
- unsafe migration;
- bootstrap concessions;
- evidence adequacy;
- operational feasibility.

## Step 14 — Accept P6 and authorize the first increment

P6 acceptance shall identify the exact first authorized increment or wave. It shall not authorize the entire backlog indiscriminately.

## 6. Increment record example

```yaml
incrementId: JAN-RI-004
canonicalCapabilities: [C2, C4]
title: Migrate PWU dual-state and completion contract
outcome: >
  Existing PWUs preserve identity and history while gaining distinct lifecycle
  and cognitive state, explicit completion conditions, guarded semantic commands,
  and a conformant overview projection.
currentBaseline:
  evidenceIds: [EV-REPO-101, EV-DB-033, EV-UI-078]
  conformance: PARTIALLY_CONFORMANT
transitionStrategies: [ADAPT_EXISTING, MIGRATE_EXISTING]
repositoryScope:
  include:
    - services/work/pwu.ts
    - db/migrations/*
    - api/pwu-routes.ts
    - web/routes/pwus/[id]/*
  exclude:
    - evidence graph
    - RPH tactic engine
requirements:
  - JAN-REQ-PWU-003
  - JAN-REQ-PWU-007
  - JAN-REQ-PROJ-...
prerequisites: [JAN-RI-002, JAN-RI-003]
exitEvidence:
  - migration property tests
  - lifecycle command integration tests
  - projection contract tests
  - UI acceptance journey
```

## 7. Prioritization

Normative priority derives from:

- hard dependency;
- semantic centrality;
- criticality;
- risk reduction;
- migration safety;
- unlock value;
- operational urgency;
- evidence availability.

Dates, team availability, and estimates may influence the operating plan but shall not alter capability meaning or acceptance criteria.

## 8. Roadmap-instance outputs

```text
program-instance/roadmap/roadmap-instance.json
program-instance/roadmap/capability-binding-matrix.csv
program-instance/roadmap/requirement-coverage.csv
program-instance/roadmap/increment-dependency-graph.json
program-instance/roadmap/implementation-waves.md
program-instance/roadmap/increments/*.json
program-instance/roadmap/evidence-plans/*.md
program-instance/reviews/P6-independent-review.md
program-instance/decisions/P6-gate-decision.json
```

## 9. P6 acceptance tests

- All applicable requirements are covered.
- Every increment has exact repository scope or an explicit investigation prerequisite.
- No increment silently changes target semantics.
- Preserved behavior is represented, not omitted.
- The dependency graph is acyclic or has accepted joint increments.
- Migration and rollback obligations are represented.
- The first increment can be executed without guessing future decisions.
- Review and acceptance authorities are assigned.

## 10. Prohibitions

- Do not translate every requirement into an isolated ticket.
- Do not recreate conformant code for architectural aesthetic preference.
- Do not generate one monolithic "implement Janumi" increment.
- Do not let package structure alone define professional capability boundaries.
- Do not hide uncertain repository bindings inside generic tasks.
- Do not put estimates or dates into normative exit criteria.
- Do not authorize future increments opportunistically through the first increment.
